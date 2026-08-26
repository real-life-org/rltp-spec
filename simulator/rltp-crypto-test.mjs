#!/usr/bin/env node
// rltp-crypto acceptance: the WebCrypto layer reproduces the SAME oracle
// as the node-crypto conformance suite — anchored on the shipped vectors,
// plus a cross-implementation check (WebCrypto signature verified by the
// node-crypto lib and vice versa).
//
//   usage: node simulator/rltp-crypto-test.mjs
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as C from './rltp-crypto.mjs'
import { jcs, makeValidator, toU } from './rltp-core.mjs'
import { diVerify as nodeDiVerify, SCHEMAS } from '../conformance/lib.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const J = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'))
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('')
const fromHex = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)))

let pass = 0, fail = 0
const check = (c, m) => { if (c) { pass++; console.log(`  ok    ${m}`) } else { fail++; console.error(`  FAIL  ${m}`) } }
const section = (t) => console.log(`\n── ${t}`)

// ── 1. identity oracle: every shipped derivation reproduces ─────────────
section('identity-derivation.json — every anchor via WebCrypto')
const ID = J('vectors/identity-derivation.json')
const IKM = fromHex(ID.rootIkm)
for (const v of ID.vectors) {
  const edInfo = v.edInfo || 'rltp/anchor/ed/' + v.label
  const xInfo = v.xInfo || 'rltp/anchor/x/' + v.label
  const ed = await C.edFromSeed(await C.hkdf(IKM, edInfo))
  const x = await C.xFromSeed(await C.hkdf(IKM, xInfo))
  check(C.anchorOfEd(ed.pubRaw) === v.anchor && C.mkOfX(x.pubRaw) === v.keyAgreement, `${v.label}: anchor + keyAgreement`)
}
{
  const g = ID.vectors.find((v) => v.label.startsWith('group/'))
  const ctx = await C.labeledContext(IKM, g.label)
  check(ctx.anchor === g.anchor && ctx.keyAgreement === g.keyAgreement, 'labeledContext() wraps the derivation correctly')
  const p = ID.vectors.find((v) => v.relationshipNonce)
  if (p) {
    const pc = await C.pairContext(IKM, fromHex(p.relationshipNonce))
    check(pc.label === p.label && pc.anchor === p.anchor, 'pairContext(): label = pair/<multihash(nonce)>, same anchor')
  }
}

// ── 2. seal vector: byte-for-byte ───────────────────────────────────────
section('seal.json — Delivery §5 construction reproduces byte-for-byte')
{
  const SV = J('vectors/seal.json'); const inp = SV.inputs
  const env = await C.seal(inp.document, inp.rkid, { ephSeed: fromB64u_(inp.ephemeralPrivateKeyRaw), nonce: fromB64u_(inp.nonce) })
  check(jcs(env) === jcs(SV.output.sealedEnvelope), 'sealed envelope is byte-identical to the shipped vector')
  const recip = await C.xFromSeed(fromB64u_(inp.recipientPrivateKeyRaw))
  const open = await C.unseal(env, recip.priv)
  check(!open.error && jcs(open.document) === SV.intermediate.plaintextJcs, 'unseal roundtrip yields the exact plaintext JCS')
  check(await C.digestDoc(inp.document) === SV.output.documentDigest, 'document digest matches')
  const tampered = { ...env, ciphertext: env.ciphertext.slice(0, -2) + 'AA' }
  check((await C.unseal(tampered, recip.priv)).error === 'decryption-failed', 'tampered ciphertext fails the tag')
}
function fromB64u_ (s) { return Uint8Array.from(Buffer.from(s, 'base64url')) }

// ── 3. shipped credentials verify under the WebCrypto DI ────────────────
section('encounter-cards.json + dtg-credentials.json — W3C-true DI via WebCrypto')
{
  const EC = J('vectors/encounter-cards.json'), D = J('vectors/dtg-credentials.json')
  for (const [label, doc, anchor] of [
    ['encounter credential', EC.credential, EC.credential.issuer],
    ['displayed card', EC.cards.displayedWithChallenge, EC.cards.displayedWithChallenge.anchor],
    ['sent card', EC.cards.sent, EC.cards.sent.anchor],
    ['invite credential', D.invite.payload.invite, D.invite.payload.invite.issuer],
    ['vouch (u)', D.vouch.u, D.vouch.u.issuer],
    ['vouch (z)', D.vouch.z, D.vouch.z.issuer],
    ['accept document', D.accept.document, D.accept.document.issuer],
  ]) check(await C.diVerify(doc, anchor), `${label}: verifies`)
  const mut = JSON.parse(JSON.stringify(EC.credential)); mut.credentialSubject.channel = 'video'
  check(!(await C.diVerify(mut, mut.issuer)), 'mutated credential fails')
  check(!(await C.diVerify({ ...EC.credential, proof: { ...EC.credential.proof, proofValue: 'z' + EC.credential.proof.proofValue.slice(2) } }, EC.credential.issuer)), 'shortened non-canonical signature fails (no left-pad repair)')
}

// ── 4. builders: fresh enactment, cross-implementation agreement ────────
section('builders — WebCrypto issues, node-crypto verifies (and back)')
{
  const nonceA = new Uint8Array(32).fill(1), nonceB = new Uint8Array(32).fill(2)
  const A = await C.pairContext(IKM, nonceA)
  const B = await C.pairContext(IKM, nonceB)
  const chA = C.challengeOf(new Uint8Array(17).fill(3)), chB = C.challengeOf(new Uint8Array(17).fill(4))
  const bind = await C.binding(C.CEREMONY, chA, chB)
  const cred = await C.issueCredential(A, B.anchor, C.CEREMONY, chB, bind, '2026-08-25T14:00:00Z')
  const V = makeValidator(SCHEMAS)
  const sch = SCHEMAS['encounter-credential-0.25.schema.json']
  check(V.validate(cred, sch, sch).length === 0, 'issued credential validates against the shipped 0.25 schema')
  check(nodeDiVerify(cred, A.anchor).ok === true, 'node-crypto lib verifies the WebCrypto signature (cross-implementation)')
  check(await C.diVerify(cred, A.anchor), 'WebCrypto verifies its own signature')
  const card = await C.signCard(A, C.cardBody(A, { name: 'A.', challenge: { value: chA, issuedAt: '2026-08-25T14:00:00Z' } }), '2026-08-25T14:00:00Z')
  const cardSch = SCHEMAS['contact-card-0.25.schema.json']
  check(V.validate(card, cardSch, cardSch).length === 0 && nodeDiVerify(card, A.anchor).ok === true, 'displayed card: schema-valid, node-verified')
  const sent = await C.signCard(A, C.cardBody(A, { name: 'A.', challenge: { value: chA, issuedAt: '2026-08-25T14:00:00Z' }, sentTo: B.anchor, boundTo: chB }), '2026-08-25T14:00:00Z')
  check(V.validate(sent, cardSch, cardSch).length === 0, 'sent card (sentTo/boundTo): schema-valid')
  // node-crypto signature verified by the WebCrypto layer (the other direction)
  const nodeCred = J('vectors/encounter-cards.json').credential // signed by the node generator
  check(await C.diVerify(nodeCred, nodeCred.issuer), 'WebCrypto verifies the node-generated vector signature (cross-implementation)')
  // seal both ways
  const env = await C.seal(cred, B.keyAgreement, { ephSeed: new Uint8Array(32).fill(5), nonce: new Uint8Array(12).fill(6) })
  const open = await C.unseal(env, B.x.priv)
  check(!open.error && jcs(open.document) === jcs(cred), 'seal → unseal roundtrip over the fresh tuple')
  check(toU(bind) === bind, 'binding is a canonical u multihash')
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) { console.error('rltp-crypto: FAILED'); process.exit(1) }
console.log('rltp-crypto: the WebCrypto layer reproduces the conformance oracle.')
