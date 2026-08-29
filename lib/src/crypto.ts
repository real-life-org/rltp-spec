// crypto — the primitives, and nothing above them.
//
// Byte helpers, hashes, HKDF, key pairs (Ed25519 signing, X25519
// agreement), the did:key / multikey renderings, ECDH — plus the
// eddsa-jcs-2022 Data Integrity proof, which every layer signs with.
//
// This module answers "how", never "what": what a proof MEANS is decided
// by the layer that issues it. Runs on globalThis.crypto.subtle in
// browsers, Node >= 20, Deno and Bun alike.
//
// Determinism: every construction takes its entropy from the CALLER
// (nonces, ephemeral seeds). Random helpers exist, but nothing here
// calls them implicitly — that is what makes the whole stack replayable
// and vector-testable.
import { jcs, base58, fromBase58, b64uOf, fromB64u, calOK } from './core.js'
export { b64uOf, fromB64u, base58, fromBase58 }

const te = new TextEncoder()
const S = globalThis.crypto.subtle

// ── bytes ───────────────────────────────────────────────────────────────
export const cat = (...bs: Uint8Array[]): Uint8Array => {
  const o = new Uint8Array(bs.reduce((n, b) => n + b.length, 0))
  let i = 0; for (const b of bs) { o.set(b, i); i += b.length }
  return o
}
export const rand = (n: number): Uint8Array => globalThis.crypto.getRandomValues(new Uint8Array(n))

// ── hashes, KDF, digests ────────────────────────────────────────────────
export const sha = async (bytes: Uint8Array): Promise<Uint8Array> => new Uint8Array(await S.digest('SHA-256', bytes))
export const hkdf = async (ikm: Uint8Array, info: string, len = 32): Promise<Uint8Array> => {
  const k = await S.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await S.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: te.encode(info) }, k, len * 8))
}
// multibase multihash (u, sha2-256) over raw BYTES — pair labels digest the nonce bytes
export const digestBytes = async (bytes: Uint8Array): Promise<string> => 'u' + b64uOf(cat(Uint8Array.from([0x12, 0x20]), await sha(bytes)))
// …and over the JCS of a document — the document digest of the stack
export const digestDoc = async (obj: unknown): Promise<string> => digestBytes(te.encode(jcs(obj)))

// ── keys (Ed25519 signing, X25519 agreement; did:key / multikey) ────────
const ED_PKCS8 = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20])
const X_PKCS8 = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20])
const jwkX = async (priv: CryptoKey): Promise<Uint8Array> => fromB64u((await S.exportKey('jwk', priv)).x!)
/** A key pair as this library carries it: the private CryptoKey plus the raw public bytes. */
export interface KeyPair { priv: CryptoKey, pubRaw: Uint8Array }

export async function edFromSeed (seed: Uint8Array): Promise<KeyPair> {
  const priv = await S.importKey('pkcs8', cat(ED_PKCS8, seed), { name: 'Ed25519' }, true, ['sign'])
  return { priv, pubRaw: await jwkX(priv) }
}
export async function xFromSeed (seed: Uint8Array): Promise<KeyPair> {
  const priv = await S.importKey('pkcs8', cat(X_PKCS8, seed), { name: 'X25519' }, true, ['deriveBits'])
  return { priv, pubRaw: await jwkX(priv) }
}
export const anchorOfEd = (pubRaw: Uint8Array): string => 'did:key:z' + base58(cat(Uint8Array.from([0xed, 0x01]), pubRaw))
export const mkOfX = (pubRaw: Uint8Array): string => 'z' + base58(cat(Uint8Array.from([0xec, 0x01]), pubRaw))
export const edRawOfAnchor = (did: unknown): Uint8Array | null => {
  if (typeof did !== 'string' || !did.startsWith('did:key:z')) return null
  const b = fromBase58(did.slice('did:key:z'.length))
  return (b && b.length === 34 && b[0] === 0xed && b[1] === 0x01) ? b.subarray(2) : null
}
export const xRawOfMk = (mk: unknown): Uint8Array | null => {
  if (typeof mk !== 'string' || mk[0] !== 'z') return null
  const b = fromBase58(mk.slice(1))
  return (b && b.length === 34 && b[0] === 0xec && b[1] === 0x01) ? b.subarray(2) : null
}
export const ecdh = async (xPriv: CryptoKey, theirPubRaw: Uint8Array): Promise<Uint8Array> => {
  const pub = await S.importKey('raw', theirPubRaw, { name: 'X25519' }, false, [])
  return new Uint8Array(await S.deriveBits({ name: 'X25519', public: pub }, xPriv, 256))
}

// ── eddsa-jcs-2022 Data Integrity (W3C-true; Encounter §2.3) ──────────
// hashData = SHA256(JCS(proofConfig incl. @context where the document has
// one)) || SHA256(JCS(document without proof)); Ed25519 over hashData;
// proofValue = z-base58btc of the exactly-64-byte signature.
/** What a signer must offer: its anchor and its Ed25519 key. A full identity Context satisfies this. */
export interface Signer { anchor: string, ed: { priv: CryptoKey } }

export async function diSign<T extends Record<string, any>> (ctx: Signer, doc: T, created: string): Promise<T & { proof: Record<string, any> }> {
  const cfg: Record<string, any> = { type: 'DataIntegrityProof', cryptosuite: 'eddsa-jcs-2022', created, verificationMethod: ctx.anchor + '#' + ctx.anchor.slice(8), proofPurpose: 'assertionMethod' }
  if ('@context' in doc) cfg['@context'] = doc['@context']
  const hashData = cat(await sha(te.encode(jcs(cfg))), await sha(te.encode(jcs(doc))))
  const sig = new Uint8Array(await S.sign({ name: 'Ed25519' }, ctx.ed.priv, hashData))
  return { ...doc, proof: { ...cfg, proofValue: 'z' + base58(sig) } }
}
export async function diVerify (doc: any, expectedAnchor?: string): Promise<boolean> {
  const { proof, ...rest } = doc ?? {}
  if (typeof proof?.proofValue !== 'string' || typeof proof?.verificationMethod !== 'string') return false
  // M-3 (review 1): this predicate verifies THE RLTP proof, not any
  // signature that happens to be valid under the key — a config with a
  // foreign type, suite, purpose or timestamp form is false here, whether
  // or not a schema runs first.
  if (proof.type !== 'DataIntegrityProof' || proof.cryptosuite !== 'eddsa-jcs-2022') return false
  if (proof.proofPurpose !== 'assertionMethod') return false
  if (typeof proof.created !== 'string' || !calOK(proof.created)) return false
  const vmDid = proof.verificationMethod.split('#')[0] as string
  if (proof.verificationMethod !== vmDid + '#' + vmDid.slice(8)) return false
  if (expectedAnchor && vmDid !== expectedAnchor) return false
  if ('@context' in rest && jcs(proof['@context'] ?? null) !== jcs(rest['@context'])) return false
  const raw = edRawOfAnchor(vmDid)
  if (!raw) return false
  const zsig = proof.proofValue
  if (typeof zsig !== 'string' || zsig[0] !== 'z') return false
  const sig = fromBase58(zsig.slice(1))
  // exactly 64 bytes, canonical base58btc — no left-pad repair (Encounter 2.3)
  if (!sig || sig.length !== 64 || 'z' + base58(sig) !== zsig) return false
  const { proofValue, ...cfg } = proof
  const hashData = cat(await sha(te.encode(jcs(cfg))), await sha(te.encode(jcs(rest))))
  const pub = await S.importKey('raw', raw, { name: 'Ed25519' }, false, ['verify'])
  return S.verify({ name: 'Ed25519' }, pub, sig, hashData)
}

