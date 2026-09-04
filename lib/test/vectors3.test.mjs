#!/usr/bin/env node
// Review-3 M-5 / Review-4 M-3: the visibility recomputation of
// conformance/runner.mjs suite 4, ported onto the library's own
// primitives — every party derivation, every MAC, both raw signatures,
// all card/request digests, and each negative at the check its
// checkOrder names. Stated limits (not covered here, by design): the
// legacy-version and star-salt-replay negatives pin FIXTURES (their
// gates are probe-state semantics, exercised by the simulator suites
// that CI runs against dist); epoch subkeys and AAD composition belong
// to the Access adapter, which this package does not implement.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as C from '../dist/index.js'
import { SCHEMAS } from '../dist/probe.js'
import { visibility } from '../dist/index.js'
const { trust } = visibility   // graduated 04.09.2026

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const vec = (f) => JSON.parse(readFileSync(join(ROOT, 'vectors', f), 'utf8'))
const hex = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)))
const IKM = hex(vec('identity-derivation.json').rootIkm)
const S = globalThis.crypto.subtle

// the vector MACs carry the multibase u prefix
const hmacU = async (key, msg) => 'u' + await trust.hmac(key, msg)
const relKey = async (ctx, peerMk, info) => C.hkdf(await C.ecdh(ctx.x.priv, C.xRawOfMk(peerMk)), info)
// raw Ed25519 over the JCS bytes, proofValue z-base58 (abbreviated proof form)
const verifyRaw = async (did, body, proofValue) => {
  const raw = C.edRawOfAnchor(did)
  const sig = C.fromBase58(proofValue.slice(1))
  if (!raw || !sig || proofValue[0] !== 'z') return false
  const pub = await S.importKey('raw', raw, { name: 'Ed25519' }, false, ['verify'])
  return S.verify({ name: 'Ed25519' }, pub, sig, new TextEncoder().encode(C.jcs(body)))
}
const VAL = C.makeValidator(SCHEMAS)
const schemaErrs = (data, file) => { const s = SCHEMAS[file]; if (!s) throw new Error('unknown schema ' + file); return VAL.validate(data, s, s) }

test('visibility — every party, MAC, signature and digest recomputes from the oracle', async () => {
  const V = vec('visibility.json')
  const P = {}
  for (const [k, v] of Object.entries(V.parties)) {
    const ctx = await C.pairContext(IKM, hex(v.relationshipNonce))
    assert.equal(ctx.label, v.label, `party ${k}: label`)
    assert.equal(ctx.anchor, v.anchor, `party ${k}: anchor`)
    assert.equal(ctx.keyAgreement, v.keyAgreement, `party ${k}: keyAgreement`)
    P[k] = ctx
  }
  const self = await C.labeledContext(IKM, V.self.label)
  assert.equal(self.anchor, V.self.anchor, 'community anchor: ordinary group-context derivation')
  const A = V.artifacts
  const mac = async (label, body, macVal, ctx, peerMk, info) =>
    assert.equal(await hmacU(await relKey(ctx, peerMk, info), C.jcs(body)), macVal, label)

  const kStar = await relKey(P.A, P.B.keyAgreement, `rltp/visibility/blind/star/${P.A.anchor}/${P.B.anchor}/1`)
  assert.equal(await hmacU(kStar, C.jcs(A.star.body)), A.star.proof.mac, 'star: mac')
  assert.ok(A.star.body.blinded.includes(await hmacU(kStar, V.self.anchor)), 'star: blinded entry = HMAC(k, self anchor)')
  await mac('grade: mac', A.gradeDeclaration.body, A.gradeDeclaration.proof.mac, P.B, P.A.keyAgreement, `rltp/visibility/mac/grade/${P.B.anchor}/${P.A.anchor}`)
  assert.ok(await verifyRaw(V.self.anchor, A.selfCard.body, A.selfCard.proof.proofValue), 'self-card: raw signature')
  await mac('anchor-mapping: mac1', A.anchorMapping.body, A.anchorMapping.proof.mac1, P.A, P.B.keyAgreement, 'rltp/visibility/mac/map1')
  await mac('anchor-mapping: mac2 (self key)', A.anchorMapping.body, A.anchorMapping.proof.mac2, self, P.B.keyAgreement, 'rltp/visibility/mac/map2')
  const kp = await relKey(P.A2, P.B2.keyAgreement, `rltp/visibility/blind/probe/${P.A2.anchor}/${P.B2.anchor}`)
  const pb = A.continuityProbe.body
  assert.equal(await hmacU(kp, C.jcs(pb)), A.continuityProbe.proof.mac, 'probe: mac')
  assert.ok(pb.blinded.length === 256 && new Set(pb.blinded).size === 256, 'probe: 256 unique entries')
  assert.equal(C.jcs(pb.blinded), C.jcs([...pb.blinded].sort()), 'probe: globally sorted')
  assert.ok(pb.blinded.includes(await hmacU(kp, P.A.anchor)), 'probe: contains the real prior entry')
  await mac('continuity mac1', A.continuityMapping.body, A.continuityMapping.proof.mac1, P.A, P.B.keyAgreement, 'rltp/visibility/mac/cont1')
  await mac('continuity mac2', A.continuityMapping.body, A.continuityMapping.proof.mac2, P.A2, P.B2.keyAgreement, 'rltp/visibility/mac/cont2')
  await mac('reverse mac1', A.continuityMappingReverse.body, A.continuityMappingReverse.proof.mac1, P.B, P.A.keyAgreement, 'rltp/visibility/mac/cont1')
  await mac('reverse mac2', A.continuityMappingReverse.body, A.continuityMappingReverse.proof.mac2, P.B2, P.A2.keyAgreement, 'rltp/visibility/mac/cont2')
  assert.ok(await verifyRaw(P.R_T.anchor, A.introductionRequest.body, A.introductionRequest.proof.proofValue), 'introduction-request: signature')
  assert.ok(await verifyRaw(P.T_I.anchor, A.introductionReply.body, A.introductionReply.proof.proofValue), 'introduction-reply: signature')
  await mac('ack: mac', A.introductionAck.body, A.introductionAck.proof.mac, P.M_R, P.R_M.keyAgreement, 'rltp/visibility/mac/ack')
  await mac('voucher→requester', A.introductionVoucherToRequester.body, A.introductionVoucherToRequester.proof.mac, P.M_R, P.R_M.keyAgreement, 'rltp/visibility/mac/voucher')
  await mac('voucher→target', A.introductionVoucherToTarget.body, A.introductionVoucherToTarget.proof.mac, P.M_T, P.T_M.keyAgreement, 'rltp/visibility/mac/voucher')
  assert.equal(A.introductionRequest.body.cardDigest, await C.digestDoc(V.introductionCards.requester), 'cardDigest = digest of the COMPLETE requester card')
  assert.equal(A.introductionReply.body.cardDigest, await C.digestDoc(V.introductionCards.target), 'reply cardDigest = digest of the COMPLETE target card')
  assert.equal(A.introductionReply.body.requestDigest, await C.digestDoc(A.introductionRequest.body), 'requestDigest = digest of the request body')
  assert.equal(await C.diVerify(V.introductionCards.requester, V.introductionCards.requester.anchor), true, 'requester card: DI proof')
  assert.equal(await C.diVerify(V.introductionCards.target, V.introductionCards.target.anchor), true, 'target card: DI proof')
})

test('visibility — every negative fails at its declared check', async () => {
  const V = vec('visibility.json')
  const P = {}
  for (const [k, v] of Object.entries(V.parties)) P[k] = await C.pairContext(IKM, hex(v.relationshipNonce))
  for (const n of V.negative) {
    const a = n.artifact
    if (n.name === 'mapping-foreign-self') {
      assert.notEqual(a.body.card.body.anchor, a.body.self, `${n.name}: card.anchor ≠ self is the failing check`)
      assert.equal(await hmacU(await relKey(P.A, P.B.keyAgreement, 'rltp/visibility/mac/map1'), C.jcs(a.body)), a.proof.mac1, `${n.name}: MACs over the mutated body still verify`)
    } else if (n.name === 'probe-shape-255') {
      assert.ok(schemaErrs(a, 'visibility-continuity-probe.schema.json').length > 0, `${n.name}: schema rejects`)
    } else if (n.name === 'reply-wrong-request-digest') {
      assert.ok(await verifyRaw(P.T_I.anchor, a.body, a.proof.proofValue), `${n.name}: signature over mutated body passes`)
      assert.notEqual(a.body.requestDigest, await C.digestDoc(V.artifacts.introductionRequest.body), `${n.name}: digest comparison fails`)
    } else if (n.name === 'legacy-version') {
      assert.equal(a.body.type, 'anchor-mapping@1', `${n.name}: unimplemented type`)
    } else if (n.name === 'star-salt-replay') {
      assert.equal(C.jcs(a), C.jcs(V.artifacts.star), `${n.name}: byte-identical state fixture`)
    } else assert.fail(`unknown negative ${n.name}`)
  }
})

test('dtg-credentials — invite, accept, digests, and all five negatives', async () => {
  const v = vec('dtg-credentials.json')
  assert.equal(await C.diVerify(v.invite.payload.invite, v.invite.payload.invite.issuer), true, 'invite credential verifies')
  assert.equal(await C.diVerify(v.accept.document, v.accept.document.issuer), true, 'accept document verifies')
  assert.equal(await C.digestDoc(v.invite.payload.invite), v.invite.credentialDigest, 'credentialDigest = digest of the credential')
  assert.equal(schemaErrs(v.invite.payload, 'payload-membership-invite.schema.json').length, 0, 'the shipped invite payload is schema-clean')
  for (const n of v.negative) {
    const file = /\(([\w.-]+\.schema\.json)\)/.exec(n.checkOrder)?.[1]
      ?? (n.name.startsWith('vouch') ? 'access-vouch.schema.json' : 'payload-membership-invite.schema.json')
    assert.ok(schemaErrs(n.artifact, file).length > 0, `${n.name}: ${file} rejects`)
  }
})
