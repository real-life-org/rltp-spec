// Shared conformance primitives + JSON-Schema subset validator.
// Used by runner.mjs (vector self-verification) and by IUT bridges
// (implementations under test — the simulator first).
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// ── primitives ───────────────────────────────────────────────────────────
export const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
export const b58 = (b) => { let n = BigInt('0x' + b.toString('hex')), s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n } for (const x of b) { if (x === 0) s = '1' + s; else break } return s }
export const fromB58 = (s) => { let n = 0n; for (const c of s) { const i = B58.indexOf(c); if (i < 0) return null; n = n * 58n + BigInt(i) } let b; if (n === 0n) b = Buffer.alloc(0); else { let h = n.toString(16); if (h.length % 2) h = '0' + h; b = Buffer.from(h, 'hex') } let z = 0; for (const c of s) { if (c === '1') z++; else break } return Buffer.concat([Buffer.alloc(z), b]) }
import { jcs as coreJcs, makeValidator, toU as coreToU, sameDigest as coreSameDigest, tsec as coreTsec, calOK as coreCalOK } from '../simulator/rltp-core.mjs'
export { coreJcs as jcs, coreToU as toU, coreSameDigest as sameDigest, coreTsec as tsec, coreCalOK as calOK }
const jcs = coreJcs
export const sha = (b) => crypto.createHash('sha256').update(b).digest()
export const hkdf = (ikm, info) => Buffer.from(crypto.hkdfSync('sha256', ikm, Buffer.alloc(0), Buffer.from(info, 'utf8'), 32))
export const hmacU = (k, s) => 'u' + crypto.createHmac('sha256', k).update(Buffer.from(s, 'utf8')).digest('base64url')
export const digestU = (o) => 'u' + Buffer.concat([Buffer.from([0x12, 0x20]), sha(Buffer.from(jcs(o), 'utf8'))]).toString('base64url')
export const EDP = '302e020100300506032b657004220420', XP = '302e020100300506032b656e04220420'
export const EDS = '302a300506032b6570032100', XS = '302a300506032b656e032100'
export const privEd = (seed) => crypto.createPrivateKey({ key: Buffer.concat([Buffer.from(EDP, 'hex'), seed]), format: 'der', type: 'pkcs8' })
export const privX = (seed) => crypto.createPrivateKey({ key: Buffer.concat([Buffer.from(XP, 'hex'), seed]), format: 'der', type: 'pkcs8' })
export const pubFromRaw = (raw, spki) => crypto.createPublicKey({ key: Buffer.concat([Buffer.from(spki, 'hex'), raw]), format: 'der', type: 'spki' })
export const edPubOfDid = (did) => { const b = fromB58(did.slice('did:key:z'.length)); if (!b || b[0] !== 0xed || b[1] !== 1 || b.length !== 34) return null; return pubFromRaw(b.subarray(2), EDS) }
export const xRawOfMk = (mk) => { const b = fromB58(mk.slice(1)); if (!b || b[0] !== 0xec || b[1] !== 1 || b.length !== 34) return null; return b.subarray(2) }
export const pubRaw = (key) => { const s = crypto.createPublicKey(key).export({ format: 'der', type: 'spki' }); return s.subarray(s.length - 32) }
export const didOf = (seed) => 'did:key:z' + b58(Buffer.concat([Buffer.from([0xed, 1]), pubRaw(privEd(seed))]))
export const mkOf = (seed) => 'z' + b58(Buffer.concat([Buffer.from([0xec, 1]), pubRaw(privX(seed))]))
export const ecdhRaw = (privSeed, pubRawBytes) => crypto.diffieHellman({ privateKey: privX(privSeed), publicKey: pubFromRaw(pubRawBytes, XS) })
export const ecdh = (privSeed, mk) => ecdhRaw(privSeed, xRawOfMk(mk))
export const verifyRaw = (did, bytes, zsig) => { const pub = edPubOfDid(did); if (!pub) return false; if (typeof zsig !== 'string' || zsig[0] !== 'z') return false; const sig = fromB58(zsig.slice(1)); if (!sig || sig.length !== 64) return false; if ('z' + b58(sig) !== zsig) return false; return crypto.verify(null, bytes, pub, sig) } // exactly 64 bytes, canonical base58btc — a shortened non-canonical rendering is not a signature (Encounter 2.3)
// W3C eddsa-jcs-2022: proofConfig reconstructed from the EMBEDDED proof alone
export const diVerify = (doc, expectedAnchor) => {
  const { proof, ...rest } = doc
  if (!proof?.proofValue || !proof?.verificationMethod) return { ok: false, stage: 'form' }
  const vmDid = proof.verificationMethod.split('#')[0]
  if (proof.verificationMethod !== `${vmDid}#${vmDid.slice(8)}`) return { ok: false, stage: 'form' }
  if (expectedAnchor && vmDid !== expectedAnchor) return { ok: false, stage: 'binding' }
  const { proofValue, ...cfg } = proof
  const hashData = Buffer.concat([sha(Buffer.from(jcs(cfg), 'utf8')), sha(Buffer.from(jcs(rest), 'utf8'))])
  return { ok: verifyRaw(vmDid, hashData, proofValue), stage: 'crypto' }
}

// ── JSON-Schema subset validator: SINGLE SOURCE in simulator/rltp-core.mjs —
// this module only loads the authoritative schemas/ directory and binds
// the shared validator to it (the browser binds the generated bundle
// simulator/rltp-schemas.mjs to the same validator)
export const SCHEMAS = {}
for (const f of readdirSync(join(ROOT, 'schemas')).filter((f) => f.endsWith('.json'))) {
  SCHEMAS[f] = JSON.parse(readFileSync(join(ROOT, 'schemas', f), 'utf8'))
}
const V = makeValidator(SCHEMAS)
export const BYID = V.BYID
export const resolveRef = V.resolveRef
export const validate = V.validate
