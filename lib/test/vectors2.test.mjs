#!/usr/bin/env node
// Review-2 breadth (M-7): the DTG-credential and visibility vectors, as
// far as the core primitives reach — plus regression tests for every
// review-2 hardening. What the lib cannot check mechanically is stated,
// not skipped silently: MAC-based semantics (star matching, continuity
// verdicts) live in the probe suites, which CI runs against dist via
// the frozen simulator copy (scripts/build-simulator-lib.mjs --check).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as C from '../dist/index.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const vec = (f) => JSON.parse(readFileSync(join(ROOT, 'vectors', f), 'utf8'))
const hex = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)))

test('dtg-credentials — u/z equivalence, member-anchor derivation, vouch proof in both renderings', async () => {
  const v = vec('dtg-credentials.json')
  assert.equal(C.sameDigest(v.uzEquivalence.genesisDigest.u, v.uzEquivalence.genesisDigest.z), true, 'one digest, two renderings')
  const mad = v.memberAnchorDerivation
  assert.equal('group/' + C.toU(v.uzEquivalence.genesisDigest.z), mad.label, 'Access 5.1: canonical-u re-encoding BEFORE the label')
  for (const [name, cred] of [['vouch.u', v.vouch.u], ['vouch.z', v.vouch.z]]) {
    assert.equal(await C.diVerify(cred, cred.issuer), true, `${name} verifies under its member anchor`)
  }
})

test('visibility — the artifact set is complete and well-formed', () => {
  // These artifacts carry ABBREVIATED proofs (bare proofValue / MAC):
  // verifying them requires the relationship keys of the probe world,
  // which is exactly what the four simulator suites do — and since
  // Faden 3 those suites RUN on the library (via the frozen copy in
  // simulator/lib/, byte-identity checked in CI).
  // Here we pin what IS mechanical: the set exists, every artifact has
  // body + proof, and every negative names its reason.
  const v = vec('visibility.json')
  for (const name of ['star', 'selfCard', 'anchorMapping', 'continuityProbe', 'continuityMapping', 'introductionRequest']) {
    const a = v.artifacts[name]
    assert.ok(a?.body && a?.proof, `artifact ${name} carries body and proof`)
  }
  assert.ok(v.negative.length >= 3, 'negative cases travel with the artifact set')
})

test('identity — the persona repertoire is pinned to Unicode 15.0, not the platform', async () => {
  const root = new Uint8Array(32)
  // assigned only AFTER 15.0 — the platform (Node 22 = Unicode 16) knows
  // them, the pin must not: CJK Ext I, the 15.1 IDCs
  for (const cp of [0x2EBF0, 0x2FFC, 0x31EF]) {
    await assert.rejects(() => C.labeledContext(root, 'persona/' + String.fromCodePoint(cp)), undefined, `U+${cp.toString(16)} is post-15.0`)
  }
  await C.labeledContext(root, 'persona/日本')       // assigned since always
  await C.labeledContext(root, 'persona/\u{1F600}') // So, assigned in 15.0
})

test('delivery — receive() is total: hostile plaintext never leaves as an exception', async () => {
  const v = vec('seal.json')
  const recipient = await C.xFromSeed(C.fromB64u(v.inputs.recipientPrivateKeyRaw))
  const keyFor = (rkid) => rkid === v.inputs.rkid ? recipient.priv : undefined
  // 1e400 parses to Infinity — jcs has no canonical form for it (B-2)
  const evil = await C.seal({ x: 1 }, v.inputs.rkid, {})
  const rawSeal = async (plaintextObj) => {
    // seal() refuses non-JSON, so build the envelope at the crypto layer
    const eph = await C.xFromSeed(C.rand(32))
    const shared = await C.ecdh(eph.priv, C.xRawOfMk(v.inputs.rkid))
    const key = await globalThis.crypto.subtle.importKey('raw', await C.hkdf(shared, 'rltp/v1/seal'), { name: 'AES-GCM' }, false, ['encrypt'])
    const n = C.rand(12)
    const ct = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv: n }, key, new TextEncoder().encode(plaintextObj)))
    return { rkid: v.inputs.rkid, epk: C.b64uOf(eph.pubRaw), nonce: C.b64uOf(n), ciphertext: C.b64uOf(ct) }
  }
  const r1 = await C.receive(await rawSeal('{"x":1e400}'), keyFor)
  assert.equal(r1.disposition, 'failed(malformed)', 'non-finite number dies at stage 4, named')
  const r2 = await C.receive(await rawSeal('[1,2]'), keyFor)
  assert.equal(r2.disposition, 'failed(malformed)', 'an array is not a document')
  // invalid UTF-8 in the plaintext: fatal decoder, no U+FFFD repair
  const eph = await C.xFromSeed(C.rand(32))
  const shared = await C.ecdh(eph.priv, C.xRawOfMk(v.inputs.rkid))
  const key = await globalThis.crypto.subtle.importKey('raw', await C.hkdf(shared, 'rltp/v1/seal'), { name: 'AES-GCM' }, false, ['encrypt'])
  const n = C.rand(12)
  const ct = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv: n }, key, Uint8Array.from([0x22, 0xff, 0x22])))
  const r3 = await C.receive({ rkid: v.inputs.rkid, epk: C.b64uOf(eph.pubRaw), nonce: C.b64uOf(n), ciphertext: C.b64uOf(ct) }, keyFor)
  // the tag VERIFIED — the failure is the document's form, not the crypto
  assert.equal(r3.disposition, 'failed(malformed)', 'authenticated invalid UTF-8 dies at stage 4, not stage 3')
  assert.equal(r3.stages.filter((s) => s.ok).length, 3, 'stages 1–3 passed before the parse failed')
  assert.equal(evil.rkid, v.inputs.rkid)
})

test('delivery — stage 2 is the CLOSED form; a tombstone dies at stage 3', async () => {
  const v = vec('seal.json')
  const recipient = await C.xFromSeed(C.fromB64u(v.inputs.recipientPrivateKeyRaw))
  const good = v.output.sealedEnvelope
  const keyFor = (rkid) => rkid === v.inputs.rkid ? recipient.priv : undefined
  const extra = await C.receive({ ...good, unexpected: true }, keyFor)
  assert.equal(extra.disposition, 'failed(malformed)', 'a fifth field fails the closed form')
  const tombstoned = await C.receive(good, () => null)          // known rkid, key gone
  assert.equal(tombstoned.disposition, 'failed(decryption-failed)', 'tombstone passes stage 2, dies at stage 3')
  assert.equal(tombstoned.stages.filter((s) => s.ok).length, 2, 'stages 1 and 2 passed')
})

test('core — inherited property names are not schema properties', () => {
  const V = C.makeValidator({})
  const schema = { type: 'object', additionalProperties: false, properties: { a: { type: 'number' } } }
  for (const name of ['__proto__', 'constructor', 'toString']) {
    const data = JSON.parse(`{"a":1,${JSON.stringify(name)}:1}`)
    assert.ok(V.validate(data, schema, schema).length > 0, `${name} is an additionalProperty`)
  }
  const needsToString = { type: 'object', required: ['toString'] }
  assert.ok(V.validate({}, needsToString, needsToString).length > 0, 'required toString is genuinely missing')
})

test('crypto & encounter — malformed proof fields and short challenges are refused, not thrown', async () => {
  assert.equal(await C.diVerify({ a: 1, proof: { proofValue: true, verificationMethod: 42 } }), false, 'numeric verificationMethod is false, not a TypeError')
  assert.throws(() => C.challengeOf(new Uint8Array(1)), undefined, 'a 1-byte challenge never leaves a producer')
  assert.equal(C.challengeOf(new Uint8Array(17)).length >= 22, true, 'a real challenge carries its 128 bits')
})

test('core — jcs refuses what RFC 8785 refuses, on values, keys, and sparse arrays', async () => {
  const { jcs } = C
  assert.throws(() => jcs({ x: '\uD800' }), undefined, 'lone surrogate value')
  assert.throws(() => jcs({ ['\uD800']: 1 }), undefined, 'lone surrogate key')
  assert.throws(() => jcs({ a: Array(1) }), undefined, 'sparse array never collides with []')
  assert.equal(jcs({ a: [] }), '{"a":[]}', 'the empty array itself is fine')
  // and the SIMULATOR side answers identically (parity, review 4 B-1/B-3)
  const sim = await import('../../simulator/rltp-core.mjs')
  assert.throws(() => sim.jcs({ x: '\uD800' }), undefined, 'sim: lone surrogate value')
  assert.throws(() => sim.jcs({ ['\uD800']: 1 }), undefined, 'sim: lone surrogate key')
  assert.throws(() => sim.jcs({ a: Array(1) }), undefined, 'sim: sparse array')
  // non-JSON objects and non-values — BOTH sides throw, neither collides
  for (const [name, bad] of [['Date', new Date(0)], ['Map', new Map([['x', 1]])], ['Symbol', Symbol()], ['function', () => {}]]) {
    assert.throws(() => jcs({ v: bad }), undefined, `lib: ${name}`)
    assert.throws(() => sim.jcs({ v: bad }), undefined, `sim: ${name}`)
  }
  const withSym = { a: 1 }; withSym[Symbol('s')] = 2
  const arrX = [1]; arrX.x = 1
  assert.throws(() => jcs(withSym), undefined, 'lib: symbol key never collides with the plain twin')
  assert.throws(() => sim.jcs(withSym), undefined, 'sim: symbol key')
  assert.throws(() => jcs({ a: arrX }), undefined, 'lib: array with own property')
  assert.throws(() => sim.jcs({ a: arrX }), undefined, 'sim: array with own property')
  assert.equal(sim.jcs({ a: [1, '😀'] }), jcs({ a: [1, '😀'] }), 'both sides render identically')
})

test('probe — the schema bundle cannot be weakened in place', async () => {
  const { SCHEMAS } = await import('../dist/probe.js')
  assert.ok(Object.isFrozen(SCHEMAS), 'the bundle is frozen')
  assert.ok(Object.isFrozen(SCHEMAS['contact-card.schema.json']), 'each schema is frozen')
  assert.throws(() => { 'use strict'; delete SCHEMAS['contact-card.schema.json'] }, undefined, 'entries cannot be deleted')
})
