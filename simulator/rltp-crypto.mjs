// rltp-crypto — the shared crypto layer of the RLTP reference
// implementation (WebCrypto twin of simulator/engine.mjs's primitives).
//
// SECOND EXTRACTION STEP of the library (after rltp-core.mjs, the form
// layer): identity derivation, eddsa-jcs-2022 Data Integrity, the
// enactment binding, the DTG-form builders (0.25 wire) and the sealed
// envelope (Delivery §5) — DOM-free, dependency-free, running on
// globalThis.crypto.subtle in both the browser and node ≥ 20.
//
// Determinism: every construction takes its entropy from the caller
// (nonces, ephemeral seeds) — the graph-web review-1 invariant — so the
// whole layer is replayable and vector-testable. Random helpers exist,
// but nothing in here calls them implicitly.
//
// Anchored by simulator/rltp-crypto-test.mjs against the SHIPPED vectors:
// identity-derivation.json (every anchor), seal.json (byte-for-byte),
// encounter-cards.json + dtg-credentials.json (DI verification), plus a
// cross-implementation check against the node-crypto conformance lib.
import { jcs, base58, fromBase58, b64uOf, fromB64u } from './rltp-core.mjs'
export { b64uOf, fromB64u, base58, fromBase58 }

const te = new TextEncoder()
const S = globalThis.crypto.subtle

// ── bytes ───────────────────────────────────────────────────────────────
export const cat = (...bs) => {
  const o = new Uint8Array(bs.reduce((n, b) => n + b.length, 0))
  let i = 0; for (const b of bs) { o.set(b, i); i += b.length }
  return o
}
export const rand = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))

// ── hashes, KDF, digests ────────────────────────────────────────────────
export const sha = async (bytes) => new Uint8Array(await S.digest('SHA-256', bytes))
export const hkdf = async (ikm, info, len = 32) => {
  const k = await S.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await S.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: te.encode(info) }, k, len * 8))
}
// multibase multihash (u, sha2-256) over raw BYTES — pair labels digest the nonce bytes
export const digestBytes = async (bytes) => 'u' + b64uOf(cat(Uint8Array.from([0x12, 0x20]), await sha(bytes)))
// …and over the JCS of a document — the document digest of the stack
export const digestDoc = async (obj) => digestBytes(te.encode(jcs(obj)))

// ── keys (Ed25519 signing, X25519 agreement; did:key / multikey) ────────
const ED_PKCS8 = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20])
const X_PKCS8 = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20])
const jwkX = async (priv) => fromB64u((await S.exportKey('jwk', priv)).x)
export async function edFromSeed (seed) {
  const priv = await S.importKey('pkcs8', cat(ED_PKCS8, seed), { name: 'Ed25519' }, true, ['sign'])
  return { priv, pubRaw: await jwkX(priv) }
}
export async function xFromSeed (seed) {
  const priv = await S.importKey('pkcs8', cat(X_PKCS8, seed), { name: 'X25519' }, true, ['deriveBits'])
  return { priv, pubRaw: await jwkX(priv) }
}
export const anchorOfEd = (pubRaw) => 'did:key:z' + base58(cat(Uint8Array.from([0xed, 0x01]), pubRaw))
export const mkOfX = (pubRaw) => 'z' + base58(cat(Uint8Array.from([0xec, 0x01]), pubRaw))
export const edRawOfAnchor = (did) => {
  if (typeof did !== 'string' || !did.startsWith('did:key:z')) return null
  const b = fromBase58(did.slice('did:key:z'.length))
  return (b && b.length === 34 && b[0] === 0xed && b[1] === 0x01) ? b.subarray(2) : null
}
export const xRawOfMk = (mk) => {
  if (typeof mk !== 'string' || mk[0] !== 'z') return null
  const b = fromBase58(mk.slice(1))
  return (b && b.length === 34 && b[0] === 0xec && b[1] === 0x01) ? b.subarray(2) : null
}
export const ecdh = async (xPriv, theirPubRaw) => {
  const pub = await S.importKey('raw', theirPubRaw, { name: 'X25519' }, false, [])
  return new Uint8Array(await S.deriveBits({ name: 'X25519', public: pub }, xPriv, 256))
}

// ── identity contexts (Identity §6; fresh-always pair class) ────────────
export async function labeledContext (rootIkm, label) {
  const edInfo = label === 'self' ? 'wot/identity/ed25519/v1' : 'rltp/anchor/ed/' + label
  const xInfo = label === 'self' ? 'wot/encryption/x25519/v1' : 'rltp/anchor/x/' + label
  const ed = await edFromSeed(await hkdf(rootIkm, edInfo))
  const x = await xFromSeed(await hkdf(rootIkm, xInfo))
  return { label, ed, x, anchor: anchorOfEd(ed.pubRaw), keyAgreement: mkOfX(x.pubRaw) }
}
// fresh-always (Encounter 4.4): label = pair/<multihash over the NONCE BYTES>
export async function pairContext (rootIkm, nonce) {
  return labeledContext(rootIkm, 'pair/' + await digestBytes(nonce))
}

// ── eddsa-jcs-2022 Data Integrity (W3C-true; Encounter 2.3) ─────────────
// hashData = SHA256(JCS(proofConfig incl. @context where the document has
// one)) || SHA256(JCS(document without proof)); Ed25519 over hashData;
// proofValue = z-base58btc of the exactly-64-byte signature.
export async function diSign (ctx, doc, created) {
  const cfg = { type: 'DataIntegrityProof', cryptosuite: 'eddsa-jcs-2022', created, verificationMethod: ctx.anchor + '#' + ctx.anchor.slice(8), proofPurpose: 'assertionMethod' }
  if ('@context' in doc) cfg['@context'] = doc['@context']
  const hashData = cat(await sha(te.encode(jcs(cfg))), await sha(te.encode(jcs(doc))))
  const sig = new Uint8Array(await S.sign({ name: 'Ed25519' }, ctx.ed.priv, hashData))
  return { ...doc, proof: { ...cfg, proofValue: 'z' + base58(sig) } }
}
export async function diVerify (doc, expectedAnchor) {
  const { proof, ...rest } = doc ?? {}
  if (!proof?.proofValue || !proof?.verificationMethod) return false
  const vmDid = proof.verificationMethod.split('#')[0]
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

// ── wire builders (0.25 generation, DTG adoption) ───────────────────────
export const CEREMONY = 'encounter-scan@0.25'
export const CARD_VERSION = 'rltp-card/0.25'
export const CRED_FORMAT = 'rltp-encounter-credential/0.25'
export const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
export const binding = (ceremony, c1, c2) => digestDoc({ ceremony, challenges: [c1, c2].sort() })
export const challengeOf = (bytes17) => b64uOf(bytes17).slice(0, 22)

// cards carry no @context (the proof carries none either — W3C-true)
export const signCard = (ctx, body, created) => diSign(ctx, body, created)
export function cardBody (ctx, { name, challenge, sentTo, boundTo } = {}) {
  const b = { version: CARD_VERSION, anchor: ctx.anchor, keyAgreement: ctx.keyAgreement }
  if (name !== undefined) b.name = name
  if (challenge !== undefined) b.challenge = challenge
  if (sentTo !== undefined) { b.sentTo = sentTo; b.boundTo = boundTo }
  return b
}
export async function issueCredential (ctx, subjectAnchor, ceremony, subjectChallenge, enactmentBinding, whenIso) {
  const body = {
    '@context': ['https://www.w3.org/ns/credentials/v2', 'https://firstperson.network/credentials/dtg/v1', 'https://real-life.org/rltp/v1'],
    type: ['VerifiableCredential', 'DTGCredential', 'RelationshipCredential', 'EncounterCredential'],
    issuer: ctx.anchor,
    validFrom: whenIso,
    credentialSubject: { id: subjectAnchor, format: CRED_FORMAT, ceremony, challenge: subjectChallenge, enactmentBinding },
  }
  return diSign(ctx, body, whenIso)
}

// ── sealed envelope (Delivery §5) ───────────────────────────────────────
// X25519 ephemeral → HKDF('rltp/v1/seal') → AES-256-GCM (12-byte nonce,
// 16-byte tag appended). Entropy is caller-suppliable for replay.
const aesKey = async (shared, usage) => {
  if (shared.every((b) => b === 0)) throw new Error('all-zero shared secret')
  return S.importKey('raw', await hkdf(shared, 'rltp/v1/seal'), { name: 'AES-GCM' }, false, [usage])
}
export async function seal (document, recipientKeyAgreement, { ephSeed, nonce } = {}) {
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
export async function unseal (env, xPriv) {
  const nonce = fromB64u(env.nonce), epkRaw = fromB64u(env.epk), raw = fromB64u(env.ciphertext)
  if (nonce.length !== 12 || epkRaw.length !== 32 || raw.length < 16) return { error: 'malformed' }
  if (raw.length - 16 > 65536) return { error: 'oversize' }          // size bound BEFORE decryption
  let key
  try { key = await aesKey(await ecdh(xPriv, epkRaw), 'decrypt') } catch { return { error: 'decryption-failed' } }
  let plaintext
  try { plaintext = new TextDecoder().decode(await S.decrypt({ name: 'AES-GCM', iv: nonce }, key, raw)) } catch { return { error: 'decryption-failed' } }
  try { return { document: JSON.parse(plaintext) } }
  catch { return { error: 'malformed' } }                            // parse failure is NOT a crypto failure
}
