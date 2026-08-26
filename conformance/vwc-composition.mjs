#!/usr/bin/env node
// vwc-composition.mjs — the O12 composition experiment, runnable.
//
// WHAT IT PROVES: our dual-typed EncounterCredential (a conformant DTG
// RelationshipCredential, vectors/encounter-cards.json) can be witnessed
// by a WD01-conformant Verifiable Witness Credential — participant
// evidence (tier 1) and third-party evidence (tier 2) verified together
// by ONE verifier built from rltp-core primitives. Digest bridging
// (WD01 sha256:<hex> ↔ digestMultibase u ↔ z) resolves to the same
// bytes. Deterministic: fixed witness seed, fixed timestamps.
//
// WHAT IT DOES NOT PROVE: this is composition of ARTIFACTS, not of
// protocols — no witness/session ceremony ran, and the witness here is
// a local key, not Keyring's witness-server. The VWC follows WD01 main
// (post-#14: digest REQUIRED, sha256:<hex> encoding) with a
// DataIntegrityProof/eddsa-jcs-2022 proof (the #18 direction); WD01's
// own example still shows the ed25519-2020 suite.
//
// Run: node conformance/vwc-composition.mjs [--quiet]

import { readFileSync } from 'node:fs'
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { jcs, base58, fromBase58, b64uOf, toU, sameDigest } from '../simulator/rltp-core.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const QUIET = process.argv.includes('--quiet')
let passed = 0; let failed = 0
const check = (name, ok, detail = '') => {
  if (ok) { passed++; if (!QUIET) console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`) }
  else { failed++; console.log(`  ✗ FAIL ${name}${detail ? ' — ' + detail : ''}`) }
}
const sha256 = (bytes) => createHash('sha256').update(bytes).digest()
const utf8 = (s) => Buffer.from(s, 'utf8')

// ---- eddsa-jcs-2022 (W3C DI): hash = sha256(jcs(proofConfig)) || sha256(jcs(document))
const diHash = (doc, proof) => {
  const config = { ...proof }; delete config.proofValue
  const unsecured = { ...doc }; delete unsecured.proof
  return Buffer.concat([sha256(utf8(jcs(config))), sha256(utf8(jcs(unsecured)))])
}
const didKeyToPub = (did) => {
  const ms = did.split(':').pop().split('#')[0]
  if (!ms.startsWith('z')) throw new Error('did:key must be base58btc')
  const bytes = fromBase58(ms.slice(1))
  if (bytes[0] !== 0xed || bytes[1] !== 0x01) throw new Error('not an Ed25519 did:key')
  return Buffer.from(bytes.slice(2))
}
const pubToKeyObject = (pub) => createPublicKey({ format: 'jwk', key: { kty: 'OKP', crv: 'Ed25519', x: b64uOf(pub) } })
const diVerify = (doc) => {
  const sig = fromBase58(doc.proof.proofValue.slice(1))
  return verify(null, diHash(doc, doc.proof), pubToKeyObject(didKeyToPub(doc.proof.verificationMethod)), Buffer.from(sig))
}

// ---- act 1: load the participant evidence (tier 1) and verify it
if (!QUIET) console.log('\n— act 1: tier 1, the participant credential —')
const vec = JSON.parse(readFileSync(join(ROOT, 'vectors', 'encounter-cards.json'), 'utf8'))
const enc = vec.credential
check('vector credential is the dual-typed form',
  enc.type.join(',') === 'VerifiableCredential,DTGCredential,RelationshipCredential,EncounterCredential')
check('its own eddsa-jcs-2022 proof verifies (participant evidence stands alone)', diVerify(enc))

// ---- act 2: the WD01 digest over OUR credential, in all three renderings
if (!QUIET) console.log('\n— act 2: one digest, three renderings —')
const encBytes = utf8(jcs(enc))
const digestBytes = sha256(encBytes)
const wd01Digest = 'sha256:' + digestBytes.toString('hex')          // cred-spec main (post-#14)
const multihash = Buffer.concat([Buffer.from([0x12, 0x20]), digestBytes])
const uDigest = 'u' + b64uOf(multihash)                             // Encounter 2.3 emit form
const zDigest = 'z' + base58(multihash)                             // accepted alternate
check('digestMultibase u and z decode to the same bytes', sameDigest(uDigest, zDigest))
check('WD01 sha256:<hex> names the same 32 bytes as the multihash payload',
  wd01Digest.slice(7) === Buffer.from(toU(uDigest) ? multihash.slice(2) : []).toString('hex'),
  'the bridge is re-encoding, never re-hashing')

// ---- act 3: wendy — a deterministic witness issues a WD01-conformant VWC
if (!QUIET) console.log('\n— act 3: tier 2, the witness credential over it —')
const SEED = Buffer.alloc(32, 0x77) // deterministic experiment witness, not a real party
const wendyPriv = createPrivateKey({ format: 'der', type: 'pkcs8', key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), SEED]) })
const wendyPubBytes = Buffer.from(createPublicKey(wendyPriv).export({ format: 'jwk' }).x, 'base64url')
const wendyDid = 'did:key:z' + base58(Buffer.concat([Buffer.from([0xed, 0x01]), wendyPubBytes]))
const DTG_CTX = ['https://www.w3.org/ns/credentials/v2', 'https://firstperson.network/credentials/dtg/v1']
const vwc = {
  '@context': DTG_CTX,
  type: ['VerifiableCredential', 'DTGCredential', 'WitnessCredential'],
  issuer: wendyDid,
  validFrom: '2026-08-26T12:00:00Z',
  taskContext: 'rltp-vwc-composition-0001',
  credentialSubject: {
    id: enc.issuer,
    digest: wd01Digest,
    witnessContext: { method: 'rltp-vwc-composition-experiment' }
  }
}
const proof = {
  type: 'DataIntegrityProof',
  cryptosuite: 'eddsa-jcs-2022',
  created: '2026-08-26T12:00:00Z',
  verificationMethod: wendyDid + '#' + wendyDid.slice('did:key:'.length),
  proofPurpose: 'assertionMethod',
  '@context': DTG_CTX
}
proof.proofValue = 'z' + base58(sign(null, diHash(vwc, proof), wendyPriv))
vwc.proof = proof
check('VWC carries every WD01-required member',
  vwc.type.includes('WitnessCredential') && !!vwc.taskContext &&
  !!vwc.credentialSubject.id && !!vwc.credentialSubject.digest)
check('credentialSubject.id is the issuer of the witnessed credential (direction rule)',
  vwc.credentialSubject.id === enc.issuer)

// ---- act 4: one verifier, both tiers
if (!QUIET) console.log('\n— act 4: one verifier serves both tiers —')
check('VWC proof verifies', diVerify(vwc))
const recomputed = 'sha256:' + sha256(utf8(jcs(enc))).toString('hex')
check('digest recomputation over the held credential matches the VWC binding', recomputed === vwc.credentialSubject.digest)
check('tier 1 still verifies with the SAME primitives (jcs + Ed25519 + multibase)', diVerify(enc))

// ---- act 5: negatives — the binding is content-bound, the proofs are real
if (!QUIET) console.log('\n— act 5: negatives —')
const mutated = JSON.parse(JSON.stringify(enc)); mutated.credentialSubject.challenge = 'u' + 'A'.repeat(43)
check('one mutated member breaks the digest (edge binding is content-bound)',
  'sha256:' + sha256(utf8(jcs(mutated))).toString('hex') !== vwc.credentialSubject.digest)
const tampered = JSON.parse(JSON.stringify(vwc)); tampered.credentialSubject.id = wendyDid
check('a tampered VWC fails proof verification', !diVerify(tampered))
const wrongDigest = JSON.parse(JSON.stringify(vwc))
wrongDigest.credentialSubject.digest = 'sha256:' + sha256(utf8(jcs(mutated))).toString('hex')
check('a resigned VWC over the wrong digest verifies but binds to NOTHING we hold',
  (() => { const c = { ...wrongDigest }; const p = { ...proof }; delete p.proofValue; p.proofValue = 'z' + base58(sign(null, diHash(c, p), wendyPriv)); c.proof = p; return diVerify(c) && c.credentialSubject.digest !== recomputed })(),
  'digest integrity is the verifier\'s check, not the signature\'s')

// ---- summary
const vwcBytes = utf8(jcs(vwc)).length
console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${passed} passed, ${failed} failed`)
console.log(`  measured: credential ${encBytes.length} B (JCS) · VWC ${vwcBytes} B (JCS) · witness did ${wendyDid.slice(0, 20)}…`)
process.exit(failed === 0 ? 0 : 1)
