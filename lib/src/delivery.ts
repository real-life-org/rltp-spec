// delivery — the Delivery Contract: how documents travel, and what a
// receiver must check before anything takes effect.
//
// The sealed envelope (X25519 ephemeral -> HKDF -> AES-256-GCM) and the
// generic receive chain in its declared ORDER: the size bound holds
// BEFORE decryption, the envelope form before that, and the digest is
// taken over the canonical form of the PARSED document — never over the
// raw bytes. Each stage names the disposition it produces, so a
// rejection can always say where it happened.
//
// What this module deliberately does NOT carry: the type-specific stages
// (proofs, bindings, effects) — those belong to the artifact's layer —
// and the completed-effect CACHE itself. The cache contract is the
// caller's to keep: only a COMPLETED effect's digest goes in (a
// rejection is not an effect and stays repeatable); a cached digest
// answers 'duplicate-known' forever after, and a second delivery never
// produces a second effect. receive() honors such a cache when given one.
import { jcs, b64uOf, fromB64u } from './core.js'
import type { Json } from './core.js'
import { hkdf, xFromSeed, xRawOfMk, ecdh, digestDoc, rand } from './crypto.js'

const te = new TextEncoder()
const S = globalThis.crypto.subtle

// canonical base64url or nothing — a second spelling of the same bytes
// is a different string, and dedup digests are computed over strings
const canonicalB64u = (s: unknown): Uint8Array | null => {
  if (typeof s !== 'string') return null
  let b: Uint8Array
  try { b = fromB64u(s) } catch { return null }
  return b64uOf(b) === s ? b : null
}

// ── sealed envelope (Delivery §5) ───────────────────────────────────────
// X25519 ephemeral → HKDF('rltp/v1/seal') → AES-256-GCM (12-byte nonce,
// 16-byte tag appended). Entropy is caller-suppliable for replay.
const aesKey = async (shared: Uint8Array, usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> => {
  if (shared.every((b) => b === 0)) throw new Error('all-zero shared secret')
  return S.importKey('raw', await hkdf(shared, 'rltp/v1/seal'), { name: 'AES-GCM' }, false, [usage])
}
/** A sealed envelope as it travels: recipient key id, ephemeral public key, nonce, ciphertext. */
export interface Envelope { rkid: string, epk: string, nonce: string, ciphertext: string }
/** Caller-supplied entropy — the invariant that makes every construction replayable. */
export interface SealEntropy { ephSeed?: Uint8Array, nonce?: Uint8Array }

export async function seal (
  document: Json, recipientKeyAgreement: string, { ephSeed, nonce }: SealEntropy = {},
): Promise<Envelope> {
  // a producer API never emits what the contract rejects (B-3): the only
  // envelope nonce is 96 bits, the only ephemeral seed 32 bytes
  if (ephSeed !== undefined && !(ephSeed instanceof Uint8Array && ephSeed.length === 32)) throw new Error('ephSeed must be exactly 32 bytes')
  if (nonce !== undefined && !(nonce instanceof Uint8Array && nonce.length === 12)) throw new Error('envelope nonce must be exactly 12 bytes (Delivery §5)')
  const eph = await xFromSeed(ephSeed ?? rand(32))
  const theirRaw = xRawOfMk(recipientKeyAgreement)
  if (!theirRaw) throw new Error('malformed recipient keyAgreement')
  const key = await aesKey(await ecdh(eph.priv, theirRaw), 'encrypt')
  const n = nonce ?? rand(12)
  const plaintext = te.encode(jcs(document))
  if (plaintext.length > 65536) throw new Error('oversize')
  const ct = new Uint8Array(await S.encrypt({ name: 'AES-GCM', iv: n }, key, plaintext))
  return { rkid: recipientKeyAgreement, epk: b64uOf(eph.pubRaw), nonce: b64uOf(n), ciphertext: b64uOf(ct) }
}

/** Opening an envelope never throws: every failure is a named reason. */
export type Unsealed = { document: Json, error?: undefined } | { document?: undefined, error: 'malformed' | 'oversize' | 'decryption-failed' }

export async function unseal (env: Envelope, xPriv: CryptoKey): Promise<Unsealed> {
  // total over ARBITRARY input (B-4): a foreign envelope with invalid or
  // non-canonical base64url is 'malformed', never an exception
  const nonce = canonicalB64u(env?.nonce), epkRaw = canonicalB64u(env?.epk), raw = canonicalB64u(env?.ciphertext)
  if (!nonce || !epkRaw || !raw) return { error: 'malformed' }
  if (nonce.length !== 12 || epkRaw.length !== 32 || raw.length < 16) return { error: 'malformed' }
  if (raw.length - 16 > 65536) return { error: 'oversize' }          // size bound BEFORE decryption
  let key
  try { key = await aesKey(await ecdh(xPriv, epkRaw), 'decrypt') } catch { return { error: 'decryption-failed' } }
  let bytes
  try { bytes = await S.decrypt({ name: 'AES-GCM', iv: nonce }, key, raw) } catch { return { error: 'decryption-failed' } }
  // from here the cryptography has SPOKEN — everything below is form:
  // authenticated invalid UTF-8 and unparseable JSON are 'malformed'
  // (stage 4 in the receive chain), never a crypto failure (review 3, M-2)
  let plaintext
  try { plaintext = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { return { error: 'malformed' } }
  try { return { document: JSON.parse(plaintext) } }
  catch { return { error: 'malformed' } }
}

// ── the generic receive chain (Delivery §4: stages 1–4) ─────────────────
export interface ReceiveStage { stage: 1 | 2 | 3 | 4, label: string, ok: boolean }
export type Disposition = 'unique' | 'duplicate-known' | 'failed(oversize)' | 'failed(malformed)' | 'failed(decryption-failed)'
export interface Received {
  stages: ReceiveStage[]
  disposition: Disposition
  /** present when the chain passed stage 4 (also on duplicate-known) */
  document?: Json
  digest?: string
}

/**
 * The generic stages every delivery passes before its layer sees it.
 * World-neutral: keys come from the caller's resolver, the
 * completed-effect cache is the caller's set of digests. This function
 * only READS the cache — the caller adds a digest after (and only
 * after) the type-specific effect completed.
 *
 * The resolver speaks three words (Delivery §4, stage 2/3): a CryptoKey
 * means "known, here is the key"; null means "known, but the key is
 * gone" (a tombstone — the envelope passes stage 2 and dies at stage 3
 * as decryption-failed, indistinguishable from any other undecryptable
 * envelope); undefined means "unknown rkid" and fails stage 2.
 */
export async function receive (
  env: unknown,
  keyForRkid: (rkid: string) => CryptoKey | null | undefined,
  completedEffects?: Set<string>,
): Promise<Received> {
  const stages: ReceiveStage[] = []
  const step = (stage: ReceiveStage['stage'], label: string, ok: boolean): boolean => { stages.push({ stage, label, ok }); return ok }
  const e = env as Partial<Envelope> | null | undefined

  // 1 — the size bound holds BEFORE any decoding or decryption work:
  //     estimated from the string alone, so an oversize envelope costs O(1)
  const ctEst = typeof e?.ciphertext === 'string' ? Math.floor(e.ciphertext.length * 3 / 4) : 0
  if (!step(1, `size bound: ciphertext − tag ≤ 65536 B (~${Math.max(0, ctEst - 16)} B)`, ctEst - 16 <= 65536)) return { stages, disposition: 'failed(oversize)' }

  // 2 — envelope form: the CLOSED shape — exactly the four fields, each
  //     canonical; the rkid a decodable multikey the resolver knows
  const isObj = e !== null && typeof e === 'object' && !Array.isArray(e)
  const ctBytes = isObj ? canonicalB64u((e as any).ciphertext) : null
  const closedForm = isObj && Object.keys(e).length === 4
    && canonicalB64u(e.epk)?.length === 32 && canonicalB64u(e.nonce)?.length === 12
    && ctBytes !== null && ctBytes.length >= 17                     // tag + at least one byte (schema lower bound)
    && typeof e.rkid === 'string' && xRawOfMk(e.rkid) !== null
  const key = closedForm ? keyForRkid((e as Envelope).rkid) : undefined
  if (!step(2, 'envelope: closed form · base64url canonical · epk 32 B · nonce 12 B · rkid known', closedForm && key !== undefined)) return { stages, disposition: 'failed(malformed)' }

  // 3 — decryption: X25519 + HKDF(rltp/v1/seal) + the AES-256-GCM tag.
  //     A tombstoned rkid (key === null) dies HERE, not at stage 2.
  const opened = key === null ? { error: 'decryption-failed' as const } : await unseal(e as Envelope, key as CryptoKey)
  // only CRYPTO failures belong to stage 3; an authenticated plaintext
  // that defeats UTF-8 or JSON is a stage-4 malformed (review 3, M-2)
  if (!step(3, 'decryption: X25519 + HKDF(rltp/v1/seal) + AES-256-GCM tag', opened.error !== 'decryption-failed' && opened.error !== 'oversize')) return { stages, disposition: `failed(${opened.error!})` as Disposition }
  if (opened.error === 'malformed') { step(4, 'parse — invalid UTF-8 or not JSON', false); return { stages, disposition: 'failed(malformed)' } }

  // 4 — parse: a JSON object; digest over its CANONICAL form; cache
  //     check. TOTAL: a document that parses but defeats the canonical
  //     form (JSON.parse turns 1e400 into Infinity) is malformed here,
  //     never an exception (review 2, B-2).
  const doc = (opened as { document?: Json }).document
  if (doc === null || doc === undefined || typeof doc !== 'object' || Array.isArray(doc)) { step(4, 'parse — not a JSON object', false); return { stages, disposition: 'failed(malformed)' } }
  let digest: string
  try { digest = await digestDoc(doc) } catch { step(4, 'parse — no canonical form (non-finite number)', false); return { stages, disposition: 'failed(malformed)' } }
  step(4, `parse + digest ${digest.slice(0, 14)}… · completed-effect cache`, true)
  if (completedEffects?.has(digest)) return { stages, disposition: 'duplicate-known', document: doc, digest }
  return { stages, disposition: 'unique', document: doc, digest }
}
