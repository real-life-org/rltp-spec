// vectors4 — the deniable delivery-ack vector (Delivery 4.2/4.4
// acknowledgement class rule): recompute key, preimage and MAC from the
// stated inputs and hold them against vectors/delivery-ack.json,
// including every negative. Review 12, finding 7: the class rule is
// only as real as its executable vector.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pairContext } from '../dist/identity.js'
import { ecdh, hkdf, b64uOf, diVerify } from '../dist/crypto.js'
import { jcs, makeValidator } from '../dist/core.js'
import { SCHEMAS } from '../dist/schemas.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const v = JSON.parse(readFileSync(join(ROOT, 'vectors/delivery-ack.json'), 'utf8'))
const fill = (n, x) => new Uint8Array(n).fill(x)
const S = globalThis.crypto.subtle
const te = new TextEncoder()
const hmac = async (key, msg) => {
  const k = await S.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return 'u' + b64uOf(new Uint8Array(await S.sign('HMAC', k, te.encode(msg))))
}

test('delivery-ack vector — key, preimage and MAC reproduce byte-exactly', async () => {
  const A = await pairContext(fill(64, 7), fill(32, 3))
  const B = await pairContext(fill(64, 9), fill(32, 5))
  assert.equal(A.anchor, v.inputs.issuerPairAnchor)
  assert.equal(B.anchor, v.inputs.recipientPairAnchor)
  const info = `rltp/v1/delivery/mac/ack/${A.anchor}/${B.anchor}`
  assert.equal(info, v.inputs.info)
  const k = await hkdf(await ecdh(A.x.priv, B.x.pubRaw), info, 32)
  const preimage = jcs(v.inputs.document)
  assert.equal(preimage, v.intermediate.preimage)
  assert.equal(await hmac(k, preimage), v.output.proof.mac)
  // the recipient (payload sender) derives the SAME key from its side
  const k2 = await hkdf(await ecdh(B.x.priv, A.x.pubRaw), info, 32)
  assert.equal(await hmac(k2, preimage), v.output.proof.mac)
})

test('delivery-ack vector — every negative fails as declared', async () => {
  const A = await pairContext(fill(64, 7), fill(32, 3))
  const B = await pairContext(fill(64, 9), fill(32, 5))
  const k = await hkdf(await ecdh(A.x.priv, B.x.pubRaw), v.inputs.info, 32)
  const byName = Object.fromEntries(v.negatives.map((n) => [n.name, n]))
  // tampered preimage: the held document's MAC must not match the stored wrongMac's source
  const tampered = byName['tampered-preimage']
  assert.notEqual(await hmac(k, jcs(tampered.document)), v.output.proof.mac)
  assert.equal(await hmac(k, jcs(tampered.document)), tampered.wrongMac)
  // wrong direction: re-derive the reversed-info key and reproduce byte-exactly
  const kRev = await hkdf(await ecdh(A.x.priv, B.x.pubRaw), `rltp/v1/delivery/mac/ack/${B.anchor}/${A.anchor}`, 32)
  assert.equal(await hmac(kRev, v.intermediate.preimage), byName['wrong-direction'].wrongMac)
  assert.notEqual(byName['wrong-direction'].wrongMac, v.output.proof.mac)
  // wrong key: re-derive the foreign tuple's key from the vector's stated inputs
  const C = await pairContext(fill(64, 7), fill(32, 6))
  assert.equal(C.anchor, v.wrongKeyInputs.foreignPairAnchor)
  const kFor = await hkdf(await ecdh(C.x.priv, B.x.pubRaw), v.wrongKeyInputs.info, 32)
  assert.equal(await hmac(kFor, v.intermediate.preimage), byName['wrong-key'].wrongMac)
  assert.notEqual(byName['wrong-key'].wrongMac, v.output.proof.mac)
  // missing proof: the document schema's if/then rejects a proof-less ack
  const V = makeValidator(SCHEMAS)
  const schema = SCHEMAS['rltp-delivery-document.schema.json']
  const bare = { ...v.inputs.document }
  assert.ok(V.validate(bare, schema, schema).length > 0, 'a delivery-ack without proof must fail the document schema')
  const withProof = { ...v.inputs.document, proof: v.output.proof }
  assert.equal(V.validate(withProof, schema, schema).length, 0, 'the MAC-form ack must pass the document schema')
  // class crossings, EXECUTED: implement the 4.2 class predicate as
  // written and show each crossing is schema-valid, proof-valid, and
  // rejected by the class rule alone
  const DV_TYPES = new Set(['star', 'grade-declaration', 'anchor-mapping', 'continuity-probe', 'continuity-mapping', 'introduction-ack', 'introduction-voucher', 'member-mapping'].map((s) => `https://real-life.org/trust-tasks/${s}/0.1`))
  const proofForm = (d) => d.proof?.mac && d.proof?.proofValue ? 'hybrid' : d.proof?.mac ? 'mac' : d.proof?.proofValue ? 'signature' : 'none'
  const classOk = (d, acknowledgedType) => proofForm(d) === (DV_TYPES.has(acknowledgedType) ? 'mac' : 'signature')
  const c1 = byName['signature-form-for-dv-payload']
  assert.equal(V.validate(c1.document, schema, schema).length, 0, 'DI-form ack is schema-valid')
  assert.equal(await diVerify(c1.document, v.inputs.issuerPairAnchor), true, 'the crossing carries a GENUINE signature — only the class rejects it')
  assert.equal(classOk(c1.document, c1.acknowledgedType), false)
  assert.equal(c1.expected, 'failed(validation-failed)')
  const c2 = byName['mac-form-for-signature-payload']
  const c2doc = { ...c2.document, proof: c2.proof }
  assert.equal(V.validate(c2doc, schema, schema).length, 0, 'MAC-form ack is schema-valid')
  assert.equal(await hmac(k, jcs(c2.document)), c2.proof.mac, 'the crossing carries the GENUINE MAC — only the class rejects it')
  assert.equal(classOk(c2doc, c2.acknowledgedType), false)
  assert.equal(c2.expected, 'failed(validation-failed)')
  // and the matching (non-crossing) combinations pass the predicate —
  // member-mapping asserted directly (round 17 minor: regression-real)
  assert.equal(classOk(c2doc, 'https://real-life.org/trust-tasks/star/0.1'), true)
  assert.equal(classOk(c2doc, 'https://real-life.org/trust-tasks/member-mapping/0.1'), true)
  assert.equal(classOk(c1.document, 'https://real-life.org/trust-tasks/member-mapping/0.1'), false)
  assert.equal(classOk(c1.document, 'https://real-life.org/trust-tasks/encounter-credential-delivery/0.1'), true)
  // hybrid proof: schema-invalid (both branches closed) and never a valid form
  const hybrid = byName['hybrid-proof']
  const hdoc = { ...hybrid.document, proof: hybrid.proof }
  assert.ok(V.validate(hdoc, schema, schema).length > 0, 'a hybrid DI+mac proof must fail the document schema')
  assert.equal(proofForm(hdoc), 'hybrid')
  // outer proof on a proof-less own type is now schema-forbidden
  const bundle = { ...v.inputs.document, type: 'https://real-life.org/trust-tasks/encounter-bundle/0.1', proof: v.output.proof }
  assert.ok(V.validate(bundle, schema, schema).length > 0, 'an outer proof on encounter-bundle must fail the document schema')
})
