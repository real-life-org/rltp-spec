#!/usr/bin/env node
// Der Vertrag des Pakets: reproduziert die kompilierte Bibliothek die
// AUSGELIEFERTEN Vektoren byte-genau? Eine Version, die das nicht tut,
// ist keine gültige Version — deshalb läuft dieser Test in der CI, nicht
// nur nach Belieben.
//
// Die Vektoren liegen im selben Repo wie das Paket. Wer RLTP in einer
// anderen Sprache implementiert, prüft sich gegen dieselben Dateien und
// braucht dieses Paket dafür nicht.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
// Bewusst gegen den EINSTIEGSPUNKT, nicht gegen interne Pfade: geprüft
// wird, was das Paket zusagt — nicht, wie es intern geschnitten ist.
import * as C from '../dist/index.js'
import { sameDigest, calOK, tsec, jcs } from '../dist/index.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const vec = (f) => JSON.parse(readFileSync(join(ROOT, 'vectors', f), 'utf8'))
const hex = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)))

test('identity derivation — every anchor of the vector', async () => {
  const v = vec('identity-derivation.json')
  const root = hex(v.rootIkm)
  for (const c of v.vectors) {
    // two derivation paths in the vector set: the two recovery contexts
    // carry their own info strings (they are NOT of the anchor family),
    // everything else goes through the ordinary rltp/anchor family
    const [anchor, keyAgreement] = c.edInfo
      ? [C.anchorOfEd((await C.edFromSeed(await C.hkdf(root, c.edInfo))).pubRaw),
         C.mkOfX((await C.xFromSeed(await C.hkdf(root, c.xInfo))).pubRaw)]
      : await C.labeledContext(root, c.label).then((x) => [x.anchor, x.keyAgreement])
    assert.equal(anchor, c.anchor, `anchor of ${c.label}`)
    assert.equal(keyAgreement, c.keyAgreement, `keyAgreement of ${c.label}`)
  }
})

test('seal — the sealed envelope, byte for byte', async () => {
  const v = vec('seal.json')
  const i = v.inputs
  const env = await C.seal(i.document, i.rkid, {
    ephSeed: C.fromB64u(i.ephemeralPrivateKeyRaw),
    nonce: C.fromB64u(i.nonce),
  })
  for (const k of ['rkid', 'epk', 'nonce', 'ciphertext']) {
    assert.equal(env[k], v.output.sealedEnvelope[k], `sealed envelope: ${k}`)
  }
  assert.equal(await C.digestDoc(i.document), v.output.documentDigest, 'document digest')
})

test('seal — unsealing returns the very same document', async () => {
  const v = vec('seal.json')
  const i = v.inputs
  const recipient = await C.xFromSeed(C.fromB64u(i.recipientPrivateKeyRaw))
  const opened = await C.unseal(v.output.sealedEnvelope, recipient.priv)
  assert.equal(opened.error, undefined, 'no error')
  assert.equal(jcs(opened.document), jcs(i.document), 'round trip')
})

test('form layer — the same digest in u and z encoding is the same digest', async () => {
  // The rule that cost four review rounds to get right: equality is
  // decided over the DECODED bytes, never over the string. A z-carried
  // digest and its u twin must compare equal, and a non-canonical
  // base58 rendering must not be accepted at all.
  const u = await C.digestDoc({ hello: 'world' })
  const bytes = C.fromB64u(u.slice(1))
  const z = 'z' + C.base58(bytes)
  assert.equal(sameDigest(u, z), true, 'u equals its own z rendering')
  assert.equal(sameDigest(z, u), true, 'and the other way round')
  const other = await C.digestDoc({ hello: 'world!' })
  assert.equal(sameDigest(u, other), false, 'different documents differ')
  assert.equal(sameDigest(u, 42), false, 'non-strings are never equal')
  assert.equal(sameDigest(u, 'u' + C.b64uOf(bytes.slice(0, 33))), false, 'a 33-byte value is not a sha2-256 multihash')
})

test('form layer — the calendar gate rejects what Date.parse silently repairs', () => {
  assert.equal(calOK('2026-02-30T10:00:00Z'), false, 'February 30th does not exist')
  assert.equal(calOK('2026-08-27T10:00:00.123Z'), true)
  assert.equal(calOK('2026-08-27T10:00:00.1234Z'), false, 'at most three fractional digits')
  assert.equal(tsec('2026-08-27T15:00:00.999Z'), tsec('2026-08-27T15:00:00Z'), 'whole seconds')
})

test('identity — the closed registry rejects every shipped reject vector', async () => {
  const v = vec('identity-derivation.json')
  const root = hex(v.rootIkm)
  for (const r of v.rejects) {
    await assert.rejects(() => C.labeledContext(root, r.label), undefined, `${JSON.stringify(r.label)} — ${r.reason}`)
  }
  // and the guards around the registry: nonce length and half a sent card
  await assert.rejects(() => C.pairContext(root, new Uint8Array(31)), undefined, 'a 31-byte pair nonce is not a pair nonce')
  assert.throws(() => C.cardBody({ anchor: 'a', keyAgreement: 'k' }, { sentTo: 'x' }), undefined, 'half a sent-card profile')
})

test('identity — a persona label comes back NFC-canonical', async () => {
  const v = vec('identity-derivation.json')
  const root = hex(v.rootIkm)
  // Anna with a combining acute (NFD) must derive the same context as its NFC form
  const nfd = 'persona/Anné', nfc = 'persona/' + 'Anné'.normalize('NFC')
  const a = await C.labeledContext(root, nfd)
  const b = await C.labeledContext(root, nfc)
  assert.equal(a.label, nfc, 'the canonical label is the NFC form')
  assert.equal(a.anchor, b.anchor, 'one persona, one anchor — whatever spelling arrived')
})

test('encounter cards — every shipped card and the credential verify; every negative fails', async () => {
  const v = vec('encounter-cards.json')
  for (const [name, card] of Object.entries(v.cards)) {
    assert.equal(await C.diVerify(card, card.anchor), true, `card ${name}`)
  }
  assert.equal(await C.diVerify(v.credential, v.credential.issuer), true, 'encounter credential')
  for (const n of v.negative) {
    if (!n.artifact?.proof) continue
    assert.equal(await C.diVerify(n.artifact, n.artifact.anchor), false, n.name)
  }
})

test('diVerify — a valid signature under a foreign proof config is NOT an RLTP proof', async () => {
  const v = vec('identity-derivation.json')
  const ctx = await C.labeledContext(hex(v.rootIkm), 'persona/Anna')
  const doc = await C.diSign(ctx, { a: 1 }, '2026-08-27T15:00:00Z')
  assert.equal(await C.diVerify(doc, ctx.anchor), true, 'the honest proof verifies')
  for (const [k, bad] of [['type', 'NotDataIntegrityProof'], ['cryptosuite', 'not-rltp'], ['proofPurpose', 'authentication'], ['created', 'not-a-time']]) {
    const forged = { a: 1, proof: { ...doc.proof, [k]: bad } }
    // note: these carry the ORIGINAL signature, so only the config checks
    // can reject them — which is exactly what M-3 demanded
    assert.equal(await C.diVerify(forged, ctx.anchor), false, `foreign ${k} rejected`)
  }
})

test('delivery — seal refuses spec-violating entropy; unseal is total over garbage', async () => {
  const v = vec('seal.json')
  await assert.rejects(() => C.seal({ x: 1 }, v.inputs.rkid, { nonce: new Uint8Array(16) }), undefined, 'a 16-byte nonce never leaves a producer')
  await assert.rejects(() => C.seal({ x: 1 }, v.inputs.rkid, { ephSeed: new Uint8Array(16) }), undefined, 'a 16-byte ephSeed neither')
  const recipient = await C.xFromSeed(C.fromB64u(v.inputs.recipientPrivateKeyRaw))
  for (const env of [
    { rkid: v.inputs.rkid, epk: '!', nonce: 'DAwMDAwMDAwMDAwM', ciphertext: 'AAAA' },
    { rkid: v.inputs.rkid, epk: v.output.sealedEnvelope.epk + '=', nonce: v.output.sealedEnvelope.nonce, ciphertext: v.output.sealedEnvelope.ciphertext },
    null, {}, { rkid: 1, epk: 2, nonce: 3, ciphertext: 4 },
  ]) {
    const r = await C.unseal(env, recipient.priv)
    assert.equal(r.error, 'malformed', 'named reason, no exception: ' + JSON.stringify(env)?.slice(0, 60))
  }
})

test('delivery — the receive chain: stages in order, duplicate-known only from the cache', async () => {
  const v = vec('seal.json')
  const recipient = await C.xFromSeed(C.fromB64u(v.inputs.recipientPrivateKeyRaw))
  const keyFor = (rkid) => rkid === v.inputs.rkid ? recipient.priv : null
  const completed = new Set()
  const one = await C.receive(v.output.sealedEnvelope, keyFor, completed)
  assert.equal(one.disposition, 'unique')
  assert.equal(jcs(one.document), jcs(v.inputs.document), 'the vector document comes through')
  completed.add(one.digest)                       // the caller applied the effect
  const two = await C.receive(v.output.sealedEnvelope, keyFor, completed)
  assert.equal(two.disposition, 'duplicate-known', 'a cached digest never re-fires')
  const tampered = { ...v.output.sealedEnvelope, ciphertext: v.output.sealedEnvelope.ciphertext.slice(0, -2) + 'AA' }
  const three = await C.receive(tampered, keyFor, completed)
  assert.equal(three.disposition, 'failed(decryption-failed)', 'a flipped bit dies at stage 3')
  assert.equal((await C.receive({ ...v.output.sealedEnvelope, rkid: 'unknown' }, keyFor)).disposition, 'failed(malformed)', 'unknown rkid dies at stage 2')
})

test('core — non-canonical u spellings of one digest never compare equal', async () => {
  const u = await C.digestDoc({ hello: 'world' })
  assert.equal(sameDigest(u, u + '='), false, 'padding')
  const last = u.slice(-1)
  const twin = u.slice(0, -1) + (last === 'A' ? 'B' : 'A')
  // the twin decodes to different-or-same bytes depending on trailing
  // bits; either way only the canonical re-encoding may compare equal
  assert.equal(sameDigest(u, twin) && twin !== u + '', sameDigest(u, twin) && C.toU(twin) === u, 'trailing-bit spellings only via canonical form')
  assert.throws(() => jcs(Symbol()), undefined, 'a symbol never silently becomes undefined inside a digest')
})
