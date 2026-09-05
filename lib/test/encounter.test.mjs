#!/usr/bin/env node
// Encounter-Nachzug: the ceremony's transmission on the normative forms —
// encounter-bundle/0.1 · encounter-credential-delivery/0.1 · delivery-ack/0.1
// (Encounter 0.29 §5.3–5.8 on Delivery 0.79 §4.1–4.3, §6.1).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { introduce as I } from '../dist/probe.js'
import { ceremony as E } from '../dist/index.js'
import { visibility, unseal, seal, base58, fromB64u, jcs, signCard, cardBody, issueCredential, CEREMONY, diSign } from '../dist/index.js'
const T = visibility.trust
const T0 = Date.parse('2026-09-05T10:00:00Z')
const disp = async (to, env, when) => { let r = await E.receiveEncounter(to, env, when); if (!r.handled) r = await T.receiveTrustDoc(to, env, when); if (r.acceptance) Object.assign(r, await r.acceptance); return r }
const H = 3_600_000, M = 60_000
// a bundle whose credential claims a late issuance (a non-conformant scanner would emit it; a conformant one refuses past the window)
const staleBundle = async (scanner, receiver, shown, bu, lateMs) => {
  const rCtx = receiver.contexts.get(shown.ctx.anchor)
  const d = (await unseal(bu.env, rCtx.x.priv)).document
  const t = scanner.contacts.get(shown.ctx.anchor)
  const late = await issueCredential(t.channel.own, shown.ctx.anchor, CEREMONY, t.peerChallenge, t.bind, new Date(lateMs).toISOString().replace(/\.\d{3}Z$/, 'Z'))
  return seal({ ...d, id: globalThis.crypto.randomUUID(), threadId: globalThis.crypto.randomUUID(), payload: { ...d.payload, credential: late } }, rCtx.keyAgreement)
}


test('encounter — connected path: bundle → ack (delivered), counter in the bundle thread → mutual', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const bu = await E.scan(a, shB.card, T0 + 2000)
  assert.equal(bu.kind, 'encounter-bundle/0.1'); assert.ok(bu.threadId, 'fresh threadId opens the exchange')
  assert.equal(a.contacts.get(shB.ctx.anchor).state, '→', 'A: one-sided until the counter-step')
  assert.notEqual(bu.sentCard.challenge.value, undefined); assert.notEqual(bu.sentCard.challenge.value, shB.ch, 'c_A is fresh — never a display challenge')
  const rB = await disp(b, bu.env, T0 + 3000)
  assert.ok(rB.recorded && rB.prompt && rB.ack, 'B: record-creating effect + prompt + ack')
  assert.equal(b.contacts.get(bu.ctx.anchor).state, '←')
  assert.ok(!a.contacts.get(shB.ctx.anchor).bundleAcked, 'delivered is NOT arrival')
  const rA = await disp(a, rB.ack.env, T0 + 4000)
  assert.equal(rA.acked, 'encounter-bundle'); assert.ok(a.contacts.get(shB.ctx.anchor).bundleAcked, 'delivered = valid ack (6.1)')
  const dup = await disp(b, bu.env, T0 + 4500)
  assert.ok(dup.duplicate); assert.deepEqual(dup.ack.env, rB.ack.env, 'redelivery → duplicate-known + byte-identical re-ack')
  const ctr = await E.counter(b, bu.ctx.anchor, T0 + 5000)
  assert.equal(ctr.kind, 'encounter-credential-delivery/0.1'); assert.equal(ctr.threadId, bu.threadId, 'counter-step continues the bundle thread')
  assert.equal(b.contacts.get(bu.ctx.anchor).state, '✓', 'B holds both credentials')
  const rAc = await disp(a, ctr.env, T0 + 6000)
  assert.ok(rAc.accepted && rAc.mutual && rAc.ack); assert.equal(a.contacts.get(shB.ctx.anchor).state, '✓')
  const rBack = await disp(b, rAc.ack.env, T0 + 7000)
  assert.equal(rBack.acked, 'encounter-credential-delivery'); assert.ok(b.contacts.get(bu.ctx.anchor).counterAcked)
  assert.equal(E.flushEncounter(a).outbound.length, 0, 'nothing left to redeliver on A')
})

test('encounter — optical leg: sent card creates the record, the late bundle is accepted via it (no second record)', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const bu = await E.scan(a, shB.card, T0 + 2000)
  const cap = await E.captureSentCard(b, bu.sentCard, T0 + 3000)
  assert.ok(cap.recorded); assert.equal(b.contacts.get(bu.ctx.anchor).state, '◇', 'a record alone has no direction (4.2)'); assert.ok(b.contacts.get(bu.ctx.anchor).credentialPending)
  assert.ok((await E.captureSentCard(b, bu.sentCard, T0 + 3500)).idempotent, 're-scan is an idempotent no-op')
  const late = await disp(b, bu.env, T0 + 9 * M)
  assert.ok(late.accepted && late.ack); assert.equal(b.records.size, 1, 'record-aware effect, no second record')
  assert.ok(!b.contacts.get(bu.ctx.anchor).credentialPending)
  // counter after the bundle: the bundle thread is known → step counter in that thread
  const ctr = await E.counter(b, bu.ctx.anchor, T0 + 10 * M)
  assert.equal(ctr.threadId, bu.threadId)
  assert.equal(ctr.sentCard, undefined, 'no optical carrier for the counter-step (5.8 step 4 · 5.3)')
  const rA = await disp(a, ctr.env, T0 + 11 * M)
  assert.ok(rA.mutual)
})

test('encounter — optical leg FIRST, counter before the bundle: credential issued at once, the delivery document waits for the bundle thread (4.3 step counter)', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const bu = await E.scan(a, shB.card, T0 + 2000)
  assert.ok((await E.captureSentCard(b, bu.sentCard, T0 + 3000)).recorded)
  const ctr = await E.counter(b, bu.ctx.anchor, T0 + 4000)
  assert.ok(ctr.deferred && ctr.credential, 'credential issued and committed; document deferred')
  const t = b.contacts.get(bu.ctx.anchor)
  assert.ok(t.credential && t.counterDocPending); assert.equal(t.state, '→')
  assert.equal(E.flushEncounter(b).outbound.length, 0, 'nothing on the wire yet — no fresh-thread "deliver" document')
  assert.equal((await E.counter(b, bu.ctx.anchor, T0 + 4500)).deferred, true, 'idempotent: still deferred, no second credential')
  // the bundle lands → record-aware acceptance AND the pending counter document in the bundle thread
  const late = await disp(b, bu.env, T0 + 6000)
  assert.ok(late.accepted && late.mutual, 'B holds both credentials now')
  assert.ok(late.counterOut?.env); assert.equal(late.counterOut.threadId, bu.threadId)
  assert.ok(!t.counterDocPending)
  const opened = await unseal(late.counterOut.env, a.contacts.get(shB.ctx.anchor).channel.own.x.priv)
  assert.equal(opened.document.ceremony.step, 'counter'); assert.equal(opened.document.ceremony.enactment, t.bind, 'ceremony carries the recomputable enactment (4.3)'); assert.equal(opened.document.threadId, bu.threadId)
  const rA = await disp(a, late.counterOut.env, T0 + 7000)
  assert.ok(rA.mutual)
})

test('encounter — negatives consume nothing and earn no ack', async () => {
  // consumed-challenge: a second scanner's bundle for the same displayed challenge
  const a = I.createPerson('A'), b = I.createPerson('B'), x = I.createPerson('X')
  const shB = await E.show(b, T0)
  const bu = await E.scan(a, shB.card, T0 + 2000), bx = await E.scan(x, shB.card, T0 + 2500)
  await disp(b, bu.env, T0 + 3000)
  const rX = await disp(b, bx.env, T0 + 3500)
  assert.equal(rX.error, 'consumed-challenge'); assert.equal(rX.ack, undefined); assert.equal(b.records.size, 1)
  // gate-expired (optical) + unknown (bundle) after aging: PT5M + skew PT5M
  const a2 = I.createPerson('A2'), b2 = I.createPerson('B2')
  const shB2 = await E.show(b2, T0)
  const bu2 = await E.scan(a2, shB2.card, T0 + 1000)
  assert.equal((await E.captureSentCard(b2, bu2.sentCard, T0 + 11 * M)).error, 'gate-expired')
  assert.match((await disp(b2, bu2.env, T0 + 11 * M)).error, /challenge unknown/)
  assert.ok(b2.challenges.get(shB2.ch).aged, 'the aging latch stands (set-only)')
  // stale-issuance: own challenge still open, issuance 25h out of the window
  const a3 = I.createPerson('A3'), b3 = I.createPerson('B3')
  const shB3 = await E.show(b3, T0)
  const bu3 = await E.scan(a3, shB3.card, T0 + 1000)
  assert.equal((await disp(b3, await staleBundle(a3, b3, shB3, bu3, T0 + 25 * H), T0 + 2 * M)).error, 'stale-issuance')
  assert.match((await E.scan(I.createPerson('A3b'), shB3.card, T0 + 25 * H)).error, /stale-issuance/, 'a conformant scanner refuses to issue past the window')
  // card differing from the record (optical first, then a bundle with a re-signed card)
  const a4 = I.createPerson('A4'), b4 = I.createPerson('B4')
  const shB4 = await E.show(b4, T0)
  const bu4 = await E.scan(a4, shB4.card, T0 + 1000)
  await E.captureSentCard(b4, bu4.sentCard, T0 + 2000)
  const bCtx = b4.contacts.get(bu4.ctx.anchor).channel.own
  const doc = (await unseal(bu4.env, bCtx.x.priv)).document
  const aCtx = a4.contexts.get(bu4.ctx.anchor)
  const { signCard, cardBody } = await import('../dist/index.js')
  const other = await signCard(aCtx, cardBody(aCtx, { name: 'A4 (anders)', challenge: bu4.sentCard.challenge, sentTo: bu4.sentCard.sentTo, boundTo: bu4.sentCard.boundTo }), bu4.sentCard.challenge.issuedAt)
  const forged = { ...doc, id: globalThis.crypto.randomUUID(), payload: { ...doc.payload, card: other } }
  const rF = await disp(b4, await seal(forged, bCtx.keyAgreement), T0 + 3000)
  assert.match(rF.error, /card differs from record/); assert.equal(rF.ack, undefined)
  // enactment member that does not recompute → validation-failed, no effect
  const bad = { ...doc, id: globalThis.crypto.randomUUID(), ceremony: { enactment: 'uEiAFrei' } }
  const rE = await disp(b4, await seal(bad, bCtx.keyAgreement), T0 + 3500)
  assert.match(rE.error, /enactment/); assert.equal(rE.ack, undefined)
  // stage order: malformed payload + wrong recipient → recipient (stage 5) first; malformed payload alone → malformed (7)
  const wrongRec = { ...doc, id: globalThis.crypto.randomUUID(), recipient: bu4.ctx.anchor, payload: {} }   // valid DID, not ours
  assert.equal((await disp(b4, await seal(wrongRec, bCtx.keyAgreement), T0 + 4000)).error, 'wrong-recipient')
  const junk = { ...doc, id: globalThis.crypto.randomUUID(), payload: {} }
  assert.match((await disp(b4, await seal(junk, bCtx.keyAgreement), T0 + 4500)).error, /malformed/)
})

test('encounter — uniqueness (5.6 step 8): equal digest idempotent, a re-proofed copy is ERR_CONFLICT — buffered + acked, never signaled (4.3)', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const bu = await E.scan(a, shB.card, T0 + 1000)
  await disp(b, bu.env, T0 + 2000)
  const ctr = await E.counter(b, bu.ctx.anchor, T0 + 3000)
  await disp(a, ctr.env, T0 + 4000)
  // a second delivery of the SAME credential in a fresh document → idempotent acceptance (+ ack)
  const aCtx = a.contacts.get(shB.ctx.anchor).channel.own
  const doc = (await unseal(ctr.env, aCtx.x.priv)).document
  const again = { ...doc, id: globalThis.crypto.randomUUID() }
  const r2 = await disp(a, await seal(again, aCtx.keyAgreement), T0 + 5000)
  assert.ok(r2.accepted && r2.ack, 'equal credential digest → idempotent acceptance')
  // a re-proofed copy (different digest) → buffered and ACKED like any delivery; acceptance fails ERR_CONFLICT locally
  const t = b.contacts.get(bu.ctx.anchor)
  const re = await issueCredential(t.channel.own, bu.ctx.anchor, CEREMONY, t.peerChallenge, t.bind, new Date(T0 + 6000).toISOString().replace(/\.\d{3}Z$/, 'Z'))
  const conflict = { ...doc, id: globalThis.crypto.randomUUID(), payload: { credential: re } }
  const r3 = await disp(a, await seal(conflict, aCtx.keyAgreement), T0 + 7000)
  assert.ok(r3.buffered && r3.ack, 'the ack is sent at buffering (4.3)'); assert.equal(r3.accepted, false); assert.equal(r3.verdict, 'ERR_CONFLICT')
  assert.deepEqual(a.contacts.get(shB.ctx.anchor).credentialIn, doc.payload.credential, 'the first accepted credential stands')
  // the ack for the rejected copy is indistinguishable in kind from an accepted one
  assert.equal(r3.ack.kind, r2.ack.kind)
})

test('encounter — review 1 regressions (B-1, B-3/4 above, B-5, B-6, B-7, B-9)', async () => {
  // B-1: a stale counter credential is buffered + acked; the issuer sees "delivered", never the verdict
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const bu = await E.scan(a, shB.card, T0 + 1000)
  await disp(b, bu.env, T0 + 2000)
  assert.match((await E.counter(b, bu.ctx.anchor, T0 + 25 * H)).error, /stale-issuance/, 'no counter issuance past the window (§9)')
  const tB = b.contacts.get(bu.ctx.anchor), aCtx1 = a.contacts.get(shB.ctx.anchor).channel.own
  const staleCred = await issueCredential(tB.channel.own, bu.ctx.anchor, CEREMONY, tB.peerChallenge, tB.bind, new Date(T0 + 25 * H).toISOString().replace(/\.\d{3}Z$/, 'Z'))
  const staleDoc = { id: globalThis.crypto.randomUUID(), type: E.DELIVERY_TYPE, issuer: tB.channel.own.anchor, recipient: aCtx1.anchor, threadId: bu.threadId, issuedAt: new Date(T0 + 25 * H).toISOString().replace(/\.\d{3}Z$/, 'Z'), payload: { credential: staleCred } }
  const rA = await disp(a, await seal(staleDoc, aCtx1.keyAgreement), T0 + 25 * H + 1000)
  assert.ok(rA.buffered && rA.ack && rA.accepted === false && rA.verdict === 'ERR_STALE_ISSUANCE', 'a stale credential from a non-conformant issuer: buffered + acked, rejected locally, never signaled')
  assert.equal(a.contacts.get(shB.ctx.anchor).credentialIn, undefined, 'not an encounter credential — not counted')
  // B-5: digest equality over decoded bytes — a z-rendered enactmentBinding is the same digest
  const a5 = I.createPerson('A5'), b5 = I.createPerson('B5')
  const sh5 = await E.show(b5, T0)
  const bu5 = await E.scan(a5, sh5.card, T0 + 1000)
  await disp(b5, bu5.env, T0 + 2000)
  const t5 = b5.contacts.get(bu5.ctx.anchor)
  const zBind = 'z' + base58(fromB64u(t5.bind.slice(1)))
  const credZ = await issueCredential(t5.channel.own, bu5.ctx.anchor, CEREMONY, t5.peerChallenge, zBind, new Date(T0 + 3000).toISOString().replace(/\.\d{3}Z$/, 'Z'))
  const a5Ctx = a5.contacts.get(sh5.ctx.anchor).channel.own
  const docZ = { id: globalThis.crypto.randomUUID(), type: E.DELIVERY_TYPE, issuer: t5.channel.own.anchor, recipient: a5Ctx.anchor, threadId: bu5.threadId, issuedAt: new Date(T0 + 3000).toISOString().replace(/\.\d{3}Z$/, 'Z'), payload: { credential: credZ }, ceremony: { step: 'counter', enactment: zBind } }
  const rZ = await disp(a5, await seal(docZ, a5Ctx.keyAgreement), T0 + 4000)
  assert.ok(rZ.accepted && rZ.mutual, 'z-rendering accepted: binding + ceremony.enactment compare over bytes')
  // B-5 (bundle side): a bundle whose credential carries the z-rendered binding
  const a5b = I.createPerson('A5b'), b5b = I.createPerson('B5b')
  const sh5b = await E.show(b5b, T0)
  const bu5b = await E.scan(a5b, sh5b.card, T0 + 1000)
  const b5bCtx = b5b.contexts.get(sh5b.ctx.anchor)
  const d5b = (await unseal(bu5b.env, b5bCtx.x.priv)).document
  const aTuple = a5b.contacts.get(sh5b.ctx.anchor)
  const zb = 'z' + base58(fromB64u(aTuple.bind.slice(1)))
  const credZb = await issueCredential(aTuple.channel.own, sh5b.ctx.anchor, CEREMONY, aTuple.peerChallenge, zb, d5b.payload.credential.validFrom)
  const rZb = await disp(b5b, await seal({ ...d5b, id: globalThis.crypto.randomUUID(), payload: { ...d5b.payload, credential: credZb } }, b5bCtx.keyAgreement), T0 + 2000)
  assert.ok(rZb.recorded && rZb.ack, 'bundle with z-rendered binding recomputes (bytes)')
  // B-6: cards outside the schema never enter an enactment
  const a6 = I.createPerson('A6'), b6 = I.createPerson('B6')
  const sh6 = await E.show(b6, T0)
  const bad1 = await signCard(sh6.ctx, { ...cardBody(sh6.ctx, { name: 'B6', challenge: sh6.card.challenge }), boundTo: sh6.ch }, sh6.card.challenge.issuedAt)   // boundTo without sentTo
  assert.match((await E.scan(a6, bad1, T0 + 1000)).error, /schema/)
  const bu6 = await E.scan(a6, sh6.card, T0 + 1000)
  const body = cardBody(bu6.ctx, { name: 'A6', challenge: { value: bu6.sentCard.challenge.value }, sentTo: bu6.sentCard.sentTo, boundTo: bu6.sentCard.boundTo })
  const bad2 = await signCard(bu6.ctx, body, bu6.sentCard.challenge.issuedAt)   // challenge without issuedAt (required)
  assert.match((await E.captureSentCard(b6, bad2, T0 + 2000)).error, /schema/)
  assert.equal(b6.records?.size ?? 0, 0)
  // B-7: two scans with the same own-challenge value → one record, one contact, the second refused
  const a7 = I.createPerson('A7'), b7 = I.createPerson('B7'), x7 = I.createPerson('X7')
  const sh7 = await E.show(b7, T0), shx = await E.show(x7, T0)
  const ch = new Uint8Array(17).fill(7)
  const one = await E.scan(a7, sh7.card, T0 + 1000, { ch })
  assert.ok(one.env)
  const two = await E.scan(a7, shx.card, T0 + 1500, { ch })
  assert.match(two.error, /already in use/); assert.equal(a7.records.size, 1); assert.equal(a7.contacts.size, 1)
  assert.equal(a7.records.get(one.sentCard.challenge.value).counterpart, sh7.ctx.anchor, 'the first record stands untouched')
  // B-9: pre-lock order — a credential with a broken proof (format still valid) fails ERR_SIG before addressee/record/binding
  const a9 = I.createPerson('A9'), b9 = I.createPerson('B9')
  const sh9 = await E.show(b9, T0)
  const bu9 = await E.scan(a9, sh9.card, T0 + 1000)
  const b9Ctx = b9.contexts.get(sh9.ctx.anchor)
  const d9 = (await unseal(bu9.env, b9Ctx.x.priv)).document
  const tampered = { ...d9.payload.credential, validFrom: new Date(T0 + 3000).toISOString().replace(/\.\d{3}Z$/, 'Z') }   // format valid, equalities intact, proof broken
  const r9 = await disp(b9, await seal({ ...d9, id: globalThis.crypto.randomUUID(), payload: { ...d9.payload, credential: tampered } }, b9Ctx.keyAgreement), T0 + 2000)
  assert.match(r9.error, /ERR_SIG/); assert.equal(r9.ack, undefined); assert.equal(b9.records?.size ?? 0, 0)
  assert.equal(E.resolve(b9, sh9.ch, T0 + 2000), 'open', 'nothing consumed')
})

test('encounter — review 2 regressions (latch monotone · keys decoded · digest format · z-ref ack · deactivated tuple · counter serialized)', async () => {
  const isoAt = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
  // B-1: show() never resurrects an aged value (no transition out of unknown)
  const p = I.createPerson('P')
  const entropy = new Uint8Array(17).fill(7)
  const first = await E.show(p, T0, { ch: entropy })
  assert.equal(E.resolve(p, first.ch, T0 + 11 * M), 'unknown')
  const again = await E.show(p, T0 + 20 * M, { ch: entropy })
  assert.match(again.error, /already issued/)
  assert.equal(E.resolve(p, first.ch, T0 + 20 * M), 'unknown', 'the latch stands')
  // B-2: pattern-valid but decoded-invalid X25519 Multikey → no record (optical AND bundle)
  const a3 = I.createPerson('A3'), b3 = I.createPerson('B3')
  const sh3 = await E.show(b3, T0)
  const bu3 = await E.scan(a3, sh3.card, T0 + 1000)
  const { proof: _p3, ...body3 } = bu3.sentCard
  const badKa = await signCard(bu3.ctx, { ...body3, keyAgreement: 'z6LS' + '1'.repeat(44) }, bu3.sentCard.proof.created)
  assert.match((await E.captureSentCard(b3, badKa, T0 + 2000)).error, /keyAgreement/)
  const b3Ctx = b3.contexts.get(sh3.ctx.anchor)
  const d3 = (await unseal(bu3.env, b3Ctx.x.priv)).document
  const rKa = await disp(b3, await seal({ ...d3, id: globalThis.crypto.randomUUID(), payload: { ...d3.payload, card: badKa } }, b3Ctx.keyAgreement), T0 + 2500)
  assert.match(rKa.error, /keys do not decode/); assert.equal(rKa.ack, undefined); assert.equal(b3.records?.size ?? 0, 0)
  // B-3: a decoded-invalid enactmentBinding fails at the FORMAT step (ERR_VERSION), not as ERR_BINDING
  const a4 = I.createPerson('A4'), b4 = I.createPerson('B4')
  const sh4 = await E.show(b4, T0)
  const bu4 = await E.scan(a4, sh4.card, T0 + 1000)
  await disp(b4, bu4.env, T0 + 2000)
  const t4 = b4.contacts.get(bu4.ctx.anchor), a4Ctx = a4.contacts.get(sh4.ctx.anchor).channel.own
  const badCred = await issueCredential(t4.channel.own, bu4.ctx.anchor, CEREMONY, t4.peerChallenge, 'u' + 'A'.repeat(46), isoAt(T0 + 3000))
  const badDoc = { id: globalThis.crypto.randomUUID(), type: E.DELIVERY_TYPE, issuer: t4.channel.own.anchor, recipient: a4Ctx.anchor, threadId: bu4.threadId, issuedAt: isoAt(T0 + 3000), payload: { credential: badCred } }
  const rBad = await disp(a4, await seal(badDoc, a4Ctx.keyAgreement), T0 + 4000)
  assert.ok(rBad.buffered && rBad.ack); assert.equal(rBad.verdict, 'ERR_VERSION')
  // B-4: a valid ack whose ref is the z-rendering of the digest sets delivered
  const a2 = I.createPerson('A2'), b2 = I.createPerson('B2')
  const sh2 = await E.show(b2, T0)
  const bu2 = await E.scan(a2, sh2.card, T0 + 1000)
  const rc2 = await disp(b2, bu2.env, T0 + 2000)
  const a2T = a2.contacts.get(sh2.ctx.anchor), b2T = b2.contacts.get(bu2.ctx.anchor)
  const ackDoc = (await unseal(rc2.ack.env, a2T.channel.own.x.priv)).document
  assert.equal(ackDoc.proof.type, 'DataIntegrityProof', 'signature-class payload → signed ack (4.2/4.4)'); assert.equal(ackDoc.proof.mac, undefined)
  const { proof: _ap, ...ackBody0 } = ackDoc
  const ackBody = { ...ackBody0, payload: { ...ackBody0.payload, ref: 'z' + base58(fromB64u(ackDoc.payload.ref.slice(1))) } }
  const zAck = await disp(a2, await seal(await diSign(b2T.channel.own, ackBody, ackBody.issuedAt), b2T.channel.counterpartKa), T0 + 3000)
  assert.equal(zAck.acked, 'encounter-bundle'); assert.ok(a2T.bundleAcked); assert.equal(a2T.outbox.size, 0)
  // B-5: a deactivated (chained-away) tuple still takes the late valid ack and the late counter credential
  const a5 = I.createPerson('A5'), b5 = I.createPerson('B5')
  const sh5 = await E.show(b5, T0)
  const bu5 = await E.scan(a5, sh5.card, T0 + 1000)
  const rc5 = await disp(b5, bu5.env, T0 + 2000)
  const ctr5 = await E.counter(b5, bu5.ctx.anchor, T0 + 3000)
  const a5T = a5.contacts.get(sh5.ctx.anchor)
  a5T.deactivated = true; a5T.chainedInto = 'did:key:z6Mkhead'
  const lateAck = await disp(a5, rc5.ack.env, T0 + 4000)
  assert.equal(lateAck.acked, 'encounter-bundle'); assert.ok(a5T.bundleAcked, 'late valid ack → delivered (6.1)')
  const lateCtr = await disp(a5, ctr5.env, T0 + 5000)
  assert.ok(lateCtr.buffered && lateCtr.ack && lateCtr.accepted, 'late counter credential accepted against the record (4.2)')
  assert.ok(a5T.credentialIn); assert.equal(a5T.state, '✓')
  // M-6: two concurrent counter() calls → ONE credential, ONE document
  const c = I.createPerson('C'), d = I.createPerson('D')
  const shD = await E.show(d, T0)
  const buC = await E.scan(c, shD.card, T0 + 1000)
  await disp(d, buC.env, T0 + 2000)
  const [c1, c2] = await Promise.all([E.counter(d, buC.ctx.anchor, T0 + 3000), E.counter(d, buC.ctx.anchor, T0 + 4000)])
  assert.ok(!!c1.env !== !!c2.env, 'exactly one document'); assert.match((c1.error ?? c2.error), /already issued/)
  assert.equal(d.contacts.get(buC.ctx.anchor).outbox.size, 1)
})

test('encounter — review 3 regressions (ack class · pre-lock order · ceremony version · acceptance resolves · fresh anchors · fresh threads)', async () => {
  const isoAt = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const bu = await E.scan(a, shB.card, T0 + 1000)
  const bCtx = b.contexts.get(shB.ctx.anchor)
  const doc = (await unseal(bu.env, bCtx.x.priv)).document
  // B-1: a MAC-form ack for a signature-class payload is invalid; the signed one is accepted
  const rc = await disp(b, bu.env, T0 + 2000)
  const aT = a.contacts.get(shB.ctx.anchor), bT = b.contacts.get(bu.ctx.anchor)
  const ackDoc = (await unseal(rc.ack.env, aT.channel.own.x.priv)).document
  const { proof: _p, ...ackBody } = ackDoc
  const { ackKey } = await import('../dist/probe/acks.js')
  const k = await ackKey(bT.channel.own, bT.channel.counterpartKa, ackBody.issuer, ackBody.recipient)
  const ck = await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = 'u' + Buffer.from(await crypto.subtle.sign('HMAC', ck, new TextEncoder().encode(jcs(ackBody)))).toString('base64url')
  const macAck = await disp(a, await seal({ ...ackBody, id: globalThis.crypto.randomUUID(), proof: { mac } }, bT.channel.counterpartKa), T0 + 2500)
  assert.equal(macAck.error, 'ack invalid'); assert.ok(!aT.bundleAcked, 'wrong proof class → discarded, status unchanged')
  const okAck = await disp(a, rc.ack.env, T0 + 3000)
  assert.equal(okAck.acked, 'encounter-bundle'); assert.ok(aT.bundleAcked)
  // B-2: calendar-invalid credential timestamp + broken card proof → the FORMAT/calendar failure names the disposition
  const a2 = I.createPerson('A2'), b2 = I.createPerson('B2')
  const sh2 = await E.show(b2, T0)
  const bu2 = await E.scan(a2, sh2.card, T0 + 1000)
  const b2Ctx = b2.contexts.get(sh2.ctx.anchor)
  const d2 = (await unseal(bu2.env, b2Ctx.x.priv)).document
  const badCard = structuredClone(d2.payload.card); badCard.proof.proofValue = badCard.proof.proofValue.slice(0, -1) + (badCard.proof.proofValue.at(-1) === '1' ? '2' : '1')
  const badCred = { ...d2.payload.credential, validFrom: '2026-02-30T10:00:00Z' }
  const r2 = await disp(b2, await seal({ ...d2, id: globalThis.crypto.randomUUID(), payload: { card: badCard, credential: badCred } }, b2Ctx.keyAgreement), T0 + 2000)
  assert.match(r2.error, /ERR_VERSION/); assert.equal(r2.ack, undefined)
  // B-3: an unknown ceremony version is ERR_VERSION (step 1), never ERR_CEREMONY — bundle AND delivery
  const oldCer = await issueCredential(a2.contacts.get(sh2.ctx.anchor).channel.own, sh2.ctx.anchor, 'encounter-scan@0.1', a2.contacts.get(sh2.ctx.anchor).peerChallenge, a2.contacts.get(sh2.ctx.anchor).bind, d2.payload.credential.validFrom)
  const r3 = await disp(b2, await seal({ ...d2, id: globalThis.crypto.randomUUID(), payload: { ...d2.payload, credential: oldCer } }, b2Ctx.keyAgreement), T0 + 2500)
  assert.match(r3.error, /ceremony/)   // bundle path: 4.1 step 5 (after card proof, credential proof, addressee)
  await disp(b2, bu2.env, T0 + 3000)
  const t2 = b2.contacts.get(bu2.ctx.anchor), a2Ctx = a2.contacts.get(sh2.ctx.anchor).channel.own
  const oldCtr = await issueCredential(t2.channel.own, bu2.ctx.anchor, 'encounter-scan@0.1', t2.peerChallenge, t2.bind, isoAt(T0 + 3500))
  const r3b = await disp(a2, await seal({ id: globalThis.crypto.randomUUID(), type: E.DELIVERY_TYPE, issuer: t2.channel.own.anchor, recipient: a2Ctx.anchor, threadId: bu2.threadId, issuedAt: isoAt(T0 + 3500), payload: { credential: oldCtr } }, a2Ctx.keyAgreement), T0 + 4000)
  assert.equal(r3b.verdict, 'ERR_VERSION')
  // B-4: credential acceptance goes through resolution — an aged held value latches
  const a4 = I.createPerson('A4'), b4 = I.createPerson('B4')
  const sh4 = await E.show(b4, T0)
  const bu4 = await E.scan(a4, sh4.card, T0 + 1000)
  await disp(b4, bu4.env, T0 + 2000)
  const extra = await E.show(a4, T0 + 3000)   // a held, record-less value on A4
  const t4 = b4.contacts.get(bu4.ctx.anchor), a4Ctx = a4.contacts.get(sh4.ctx.anchor).channel.own
  const noRec = await issueCredential(t4.channel.own, bu4.ctx.anchor, CEREMONY, extra.ch, t4.bind, isoAt(T0 + 20 * M))
  const r4 = await disp(a4, await seal({ id: globalThis.crypto.randomUUID(), type: E.DELIVERY_TYPE, issuer: t4.channel.own.anchor, recipient: a4Ctx.anchor, threadId: bu4.threadId, issuedAt: isoAt(T0 + 20 * M), payload: { credential: noRec } }, a4Ctx.keyAgreement), T0 + 20 * M)
  assert.equal(r4.verdict, 'ERR_NO_RECORD'); assert.ok(a4.challenges.get(extra.ch).aged, 'resolution latched the aged value')
  assert.equal(E.resolve(a4, extra.ch, T0 + 4000), 'unknown', 'no transition out of unknown, even with a rewound clock')
  // B-5: fresh-always — a reused pair nonce is refused (show and scan)
  const f = I.createPerson('F')
  const n = new Uint8Array(32).fill(9)
  const f1 = await E.show(f, T0, { nonce: n })
  assert.ok(f1.card); assert.match((await E.show(f, T0 + 1000, { nonce: n })).error, /fresh-always/)
  assert.match((await E.scan(f, shB.card, T0 + 1000, { nonce: n })).error, /fresh-always/)
  // B-6: a bundle's threadId is fresh — a reused one is refused
  const s6 = I.createPerson('S6'), x6 = I.createPerson('X6'), y6 = I.createPerson('Y6')
  const shx = await E.show(x6, T0), shy = await E.show(y6, T0)
  const tid = globalThis.crypto.randomUUID()
  assert.ok((await E.scan(s6, shx.card, T0 + 1000, { threadId: tid })).env)
  assert.match((await E.scan(s6, shy.card, T0 + 1500, { threadId: tid })).error, /threadId not fresh/)
})

test('encounter — review 4 regressions (counter ceremony.enactment · c_A ≠ c_B)', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B')
  const ch = new Uint8Array(17).fill(3)
  const shB = await E.show(b, T0, { ch })
  // B-2: injected entropy equal to the displayed challenge → refused; random draws never collide
  assert.match((await E.scan(a, shB.card, T0 + 1000, { ch })).error, /never reused/)
  assert.equal(a.records?.size ?? 0, 0); assert.equal(a.contacts.size, 0)
  const bu = await E.scan(a, shB.card, T0 + 1000)
  assert.notEqual(bu.sentCard.challenge.value, shB.ch)
  // B-1: the counter-step's ceremony member carries a recomputable enactment
  await disp(b, bu.env, T0 + 2000)
  const ctr = await E.counter(b, bu.ctx.anchor, T0 + 3000)
  const aCtx = a.contacts.get(shB.ctx.anchor).channel.own
  const cdoc = (await unseal(ctr.env, aCtx.x.priv)).document
  assert.equal(cdoc.ceremony.step, 'counter'); assert.equal(cdoc.ceremony.enactment, cdoc.payload.credential.credentialSubject.enactmentBinding)
  assert.ok((await disp(a, ctr.env, T0 + 4000)).mutual)
  // a ceremony member whose enactment lies is validation-failed, no ack (already pinned for bundles; here for the delivery form)
  const lie = { ...cdoc, id: globalThis.crypto.randomUUID(), ceremony: { step: 'counter', enactment: 'uEiAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } }
  const rl = await disp(a, await seal(lie, aCtx.keyAgreement), T0 + 5000)
  assert.match(rl.error, /enactment/); assert.equal(rl.ack, undefined)
})

test('encounter — review 5 regressions (4.3 step/thread rules · verificationMethod decodes at format · stores keep their own copies)', async () => {
  const isoAt = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const bu = await E.scan(a, shB.card, T0 + 1000)
  const rc = await disp(b, bu.env, T0 + 2000)
  const t = b.contacts.get(bu.ctx.anchor), aCtx = a.contacts.get(shB.ctx.anchor).channel.own
  const cred = await issueCredential(t.channel.own, bu.ctx.anchor, CEREMONY, t.peerChallenge, t.bind, isoAt(T0 + 3000))
  const mk = (over) => ({ id: globalThis.crypto.randomUUID(), type: E.DELIVERY_TYPE, issuer: t.channel.own.anchor, recipient: aCtx.anchor, threadId: bu.threadId, issuedAt: isoAt(T0 + 3000), payload: { credential: cred }, ...over })
  // B-1: step outside the set · counter outside the bundle thread · deliver inside it → validation-failed, no ack
  for (const bad of [mk({ ceremony: { step: 'counter' }, threadId: globalThis.crypto.randomUUID() }), mk({ ceremony: { step: 'deliver' } })]) {
    const r = await disp(a, await seal(bad, aCtx.keyAgreement), T0 + 4000)
    assert.match(r.error, /validation-failed/); assert.equal(r.ack, undefined)
  }
  assert.equal(a.contacts.get(shB.ctx.anchor).credentialIn, undefined)
  const okC = await disp(a, await seal(mk({ ceremony: { step: 'counter', enactment: t.bind } }), aCtx.keyAgreement), T0 + 4500)
  assert.ok(okC.accepted && okC.mutual)
  // B-3: a schema-valid but undecodable verificationMethod is a FORMAT failure (ERR_VERSION), not ERR_SIG
  const a3 = I.createPerson('A3'), b3 = I.createPerson('B3')
  const sh3 = await E.show(b3, T0)
  const bu3 = await E.scan(a3, sh3.card, T0 + 1000)
  await disp(b3, bu3.env, T0 + 2000)
  const t3 = b3.contacts.get(bu3.ctx.anchor), a3Ctx = a3.contacts.get(sh3.ctx.anchor).channel.own
  const c3 = await issueCredential(t3.channel.own, bu3.ctx.anchor, CEREMONY, t3.peerChallenge, t3.bind, isoAt(T0 + 3000))
  const fakeKey = 'z6Mk' + '1'.repeat(44)
  const badVm = { ...c3, proof: { ...c3.proof, verificationMethod: `did:key:${fakeKey}#${fakeKey}` } }
  const r3 = await disp(a3, await seal({ id: globalThis.crypto.randomUUID(), type: E.DELIVERY_TYPE, issuer: t3.channel.own.anchor, recipient: a3Ctx.anchor, threadId: bu3.threadId, issuedAt: isoAt(T0 + 3000), payload: { credential: badVm } }, a3Ctx.keyAgreement), T0 + 4000)
  assert.ok(r3.buffered && r3.ack); assert.equal(r3.verdict, 'ERR_VERSION')
  // M-4: mutating the returned ack env never alters the retained one (byte-identical re-ack); same for the outbox
  const stored = structuredClone(rc.ack.env)
  rc.ack.env.ciphertext = 'AAAA'
  const re = await disp(b, bu.env, T0 + 5000)
  assert.ok(re.duplicate); assert.deepEqual(re.ack.env, stored, 're-ack is the stored document, untouched by the host handle')
  bu.env.ciphertext = 'BBBB'
  const flushed = E.flushEncounter(a).outbound.find((o) => o.kind.startsWith('encounter-bundle'))
  assert.ok(flushed === undefined || flushed.env.ciphertext !== 'BBBB', 'outbox keeps its own copy')
})

test('encounter — review 6 regressions (input snapshot · 5.6 order before resolution · inbound thread reserved · flush copies)', async () => {
  const isoAt = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
  // B-1: a card mutated after the call (before its promise settles) never reaches the record
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const bu = await E.scan(a, shB.card, T0 + 1000)
  const card = structuredClone(bu.sentCard)
  const pending = E.captureSentCard(b, card, T0 + 2000)
  card.name = 'UNSIGNED-MUTATION'
  assert.ok((await pending).recorded)
  assert.equal(b.records.get(shB.ch).card.name, 'A'); assert.equal(b.contacts.get(bu.ctx.anchor).name, 'A')
  const shown = structuredClone(shB.card)
  const pendingScan = E.scan(I.createPerson('A1'), shown, T0 + 1000)
  shown.name = 'MUTATED'
  assert.equal((await pendingScan).to.name, 'B')
  // B-2: an invalid signature stops at step 2 — no resolution, no latch on an aged held value
  const a2 = I.createPerson('A2'), b2 = I.createPerson('B2')
  const sh2 = await E.show(b2, T0)
  const bu2 = await E.scan(a2, sh2.card, T0 + 1000)
  await disp(b2, bu2.env, T0 + 2000)
  const extra = await E.show(a2, T0 + 3000)   // held, record-less, will be aged at T0+20min
  const t2 = b2.contacts.get(bu2.ctx.anchor), a2Ctx = a2.contacts.get(sh2.ctx.anchor).channel.own
  const c2 = await issueCredential(t2.channel.own, bu2.ctx.anchor, CEREMONY, t2.peerChallenge, t2.bind, isoAt(T0 + 20 * M))
  const badSig = { ...c2, credentialSubject: { ...c2.credentialSubject, challenge: extra.ch } }   // format valid, signature broken, bound to the held value
  const r2 = await disp(a2, await seal({ id: globalThis.crypto.randomUUID(), type: E.DELIVERY_TYPE, issuer: t2.channel.own.anchor, recipient: a2Ctx.anchor, threadId: bu2.threadId, issuedAt: isoAt(T0 + 20 * M), payload: { credential: badSig } }, a2Ctx.keyAgreement), T0 + 20 * M)
  assert.equal(r2.verdict, 'ERR_SIG'); assert.ok(!a2.challenges.get(extra.ch).aged, 'no resolution ran — the latch is untouched')
  // M-3: a second, digest-different standalone delivery on an already used fresh thread is refused
  const tid = globalThis.crypto.randomUUID()
  const mk = (cred, over = {}) => ({ id: globalThis.crypto.randomUUID(), type: E.DELIVERY_TYPE, issuer: t2.channel.own.anchor, recipient: a2Ctx.anchor, threadId: tid, issuedAt: isoAt(T0 + 4000), payload: { credential: cred }, ceremony: { step: 'deliver' }, ...over })
  const good = await issueCredential(t2.channel.own, bu2.ctx.anchor, CEREMONY, t2.peerChallenge, t2.bind, isoAt(T0 + 4000))
  const first = await disp(a2, await seal(mk(good), a2Ctx.keyAgreement), T0 + 5000)
  assert.ok(first.buffered && first.accepted)
  const second = await disp(a2, await seal(mk(good), a2Ctx.keyAgreement), T0 + 5500)   // fresh id → different digest, same thread
  assert.match(second.error, /threadId not fresh/); assert.equal(second.ack, undefined)
  // M-4: a flushed envelope is a copy — mutating it leaves the outbox intact
  const f1 = E.flushEncounter(a).outbound[0]
  assert.ok(f1); f1.env.ciphertext = 'XXXX'
  assert.notEqual(E.flushEncounter(a).outbound[0].env.ciphertext, 'XXXX')
})

test('encounter — review 7 regressions (inbound bundle thread fresh · own-thread redelivery still idempotent · optical result exposes no record)', async () => {
  const a = I.createPerson('A'), x = I.createPerson('X'), b = I.createPerson('B')
  const sh1 = await E.show(b, T0)
  const bu1 = await E.scan(a, sh1.card, T0 + 1000)
  assert.ok((await disp(b, bu1.env, T0 + 2000)).recorded)
  // B-1: a second scanner's bundle on the FIRST bundle's thread → not fresh, no second record
  const sh2 = await E.show(b, T0 + 2500)
  const bu2 = await E.scan(x, sh2.card, T0 + 3000, { threadId: bu1.threadId })
  const r2 = await disp(b, bu2.env, T0 + 3500)
  assert.match(r2.error, /threadId not fresh/); assert.equal(r2.ack, undefined); assert.equal(b.records.size, 1)
  // 4.1 "Thread freshness under re-issue": a RE-ISSUED bundle (new id, new digest) on the OLD thread is not fresh …
  const bCtx = b.contexts.get(sh1.ctx.anchor)
  const d1 = (await unseal(bu1.env, bCtx.x.priv)).document
  const sameThread = await disp(b, await seal({ ...d1, id: globalThis.crypto.randomUUID() }, bCtx.keyAgreement), T0 + 4000)
  assert.match(sameThread.error, /threadId not fresh/); assert.equal(sameThread.ack, undefined)
  // … on a FRESH thread it lands idempotently via the record-aware effect; the record keeps the first thread
  const again = await disp(b, await seal({ ...d1, id: globalThis.crypto.randomUUID(), threadId: globalThis.crypto.randomUUID() }, bCtx.keyAgreement), T0 + 4500)
  assert.ok(again.accepted && again.ack); assert.equal(b.records.size, 1); assert.equal(b.contacts.get(bu1.ctx.anchor).bundleThread, bu1.threadId)
  // M-3: the optical result carries no reference to the record
  const a3 = I.createPerson('A3'), b3 = I.createPerson('B3')
  const sh3 = await E.show(b3, T0)
  const bu3 = await E.scan(a3, sh3.card, T0 + 1000)
  const cap = await E.captureSentCard(b3, bu3.sentCard, T0 + 2000)
  assert.ok(cap.recorded); assert.equal(cap.tuple, undefined); assert.equal(cap.name, 'A3')
  const late = await disp(b3, bu3.env, T0 + 3000)
  assert.ok(late.accepted, 'the unchanged bundle is accepted via the untouched record')
})

test('encounter — review 8 regressions (trust-path re-ack is a copy · ack stage 5 order: profile before recipient)', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const bu = await E.scan(a, shB.card, T0 + 1000)
  const rc = await disp(b, bu.env, T0 + 2000)
  const stored = structuredClone(rc.ack.env)
  // the host's dispatch order puts receiveTrustDoc first — its duplicate path must hand out a copy too
  const dup1 = await T.receiveTrustDoc(b, bu.env, T0 + 3000)
  assert.ok(dup1.duplicate && dup1.ack); dup1.ack.env.ciphertext = 'ZZZZ'
  const dup2 = await T.receiveTrustDoc(b, bu.env, T0 + 3500)
  assert.deepEqual(dup2.ack.env, stored, 'byte-identical re-ack, untouched by the host handle')
  // ack with a schema-foreign root member AND a wrong recipient → malformed (stage 5 profile first)
  const aT = a.contacts.get(shB.ctx.anchor), bT = b.contacts.get(bu.ctx.anchor)
  const ackDoc = (await unseal(rc.ack.env, aT.channel.own.x.priv)).document
  const { proof: _p, ...body } = ackDoc
  const bad = await diSign(bT.channel.own, { ...body, id: globalThis.crypto.randomUUID(), recipient: bT.channel.own.anchor, extraRoot: 1 }, body.issuedAt)
  const r = await T.receiveTrustDoc(a, await seal(bad, bT.channel.counterpartKa), T0 + 4000)
  assert.equal(r.error, 'malformed document')
})

test('encounter — review 9 regression (credential delivery serializes on the digest alone; acceptance runs separately)', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const bu = await E.scan(a, shB.card, T0 + 1000)
  await disp(b, bu.env, T0 + 2000)
  const ctr = await E.counter(b, bu.ctx.anchor, T0 + 3000)
  // hold the RECORD KEY on A while the delivery arrives: buffering + ack must not wait for it
  const own = bu.sentCard.challenge.value
  const L = a.lockSet ?? (a.lockSet = { held: new Set(), waiters: [] })
  L.held.add(own)
  const r0 = await E.receiveEncounter(a, ctr.env, T0 + 4000)   // returns AT buffering — with the ack — while the record key is held elsewhere
  const t = a.contacts.get(shB.ctx.anchor)
  assert.ok(r0.buffered && r0.ack && t.ackStore?.size === 1 && a.deliveryCache.size >= 1, 'buffered + acked, ack handed out')
  let settled = false
  const pr = r0.acceptance.then((v) => { settled = true; return v })
  await new Promise((res) => setTimeout(res, 30))
  assert.equal(settled, false, 'acceptance waits for the record key — separately, without holding the ack back')
  L.held.delete(own); for (const w of L.waiters.splice(0)) w()
  const v = await pr
  assert.ok(v.accepted && v.mutual)
})

test('encounter — review 10 regressions (thread freshness atomic under concurrency · wrong-recipient disposition)', async () => {
  const isoAt = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
  // two concurrent bundles from two scanners on ONE thread → exactly one record, one ack
  const b = I.createPerson('B'), a1 = I.createPerson('A1'), a2 = I.createPerson('A2')
  const sh1 = await E.show(b, T0), sh2 = await E.show(b, T0 + 100)
  const tid = globalThis.crypto.randomUUID()
  const bu1 = await E.scan(a1, sh1.card, T0 + 1000, { threadId: tid }), bu2 = await E.scan(a2, sh2.card, T0 + 1000, { threadId: tid })
  const [r1, r2] = await Promise.all([disp(b, bu1.env, T0 + 2000), disp(b, bu2.env, T0 + 2000)])
  assert.equal([r1, r2].filter((r) => r.recorded).length, 1, 'exactly one bundle opens the thread'); assert.equal(b.records.size, 1)
  assert.match([r1, r2].find((r) => !r.recorded).error, /threadId not fresh/)
  // two concurrent standalone deliveries on one fresh thread → exactly one buffered + acked
  const a = I.createPerson('A'), c = I.createPerson('C')
  const shC = await E.show(c, T0)
  const bu = await E.scan(a, shC.card, T0 + 1000)
  await disp(c, bu.env, T0 + 2000)
  const t = c.contacts.get(bu.ctx.anchor), aCtx = a.contacts.get(shC.ctx.anchor).channel.own
  const cred = await issueCredential(t.channel.own, bu.ctx.anchor, CEREMONY, t.peerChallenge, t.bind, isoAt(T0 + 3000))
  const tid2 = globalThis.crypto.randomUUID()
  const mk = () => ({ id: globalThis.crypto.randomUUID(), type: E.DELIVERY_TYPE, issuer: t.channel.own.anchor, recipient: aCtx.anchor, threadId: tid2, issuedAt: isoAt(T0 + 3000), payload: { credential: cred }, ceremony: { step: 'deliver' } })
  const [d1, d2] = await Promise.all([seal(mk(), aCtx.keyAgreement), seal(mk(), aCtx.keyAgreement)])
  const [s1, s2] = await Promise.all([disp(a, d1, T0 + 4000), disp(a, d2, T0 + 4000)])
  assert.equal([s1, s2].filter((r) => r.buffered).length, 1); assert.equal([s1, s2].filter((r) => r.ack).length, 1)
  // stage 5 disposition name
  const bCtx = b.contexts.get(sh1.ctx.anchor)
  const d = (await unseal(bu1.env, bCtx.x.priv)).document
  assert.equal((await disp(b, await seal({ ...d, id: globalThis.crypto.randomUUID(), recipient: bu1.ctx.anchor }, bCtx.keyAgreement), T0 + 5000)).error, 'wrong-recipient')
})

test('encounter — review 11 regressions (one commit discipline: nothing read before an await decides a commit)', async () => {
  const perturb = (p, fn) => { p.__beforeVerify = () => { delete p.__beforeVerify; fn() } }
  // B-1 optical: the held value ages between prepare and verify → gate-expired, no record
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const bu = await E.scan(a, shB.card, T0 + 1000)
  perturb(b, () => { b.challenges.get(shB.ch).aged = true })   // the lock-free latch fires concurrently
  const cap = await E.captureSentCard(b, bu.sentCard, T0 + 2000)
  assert.equal(cap.error, 'gate-expired'); assert.equal(b.records?.size ?? 0, 0); assert.equal(b.contacts.size, 0)
  // B-1 bundle (open): the value ages between prepare and verify → validation-failed, nothing consumed, no ack
  const a2 = I.createPerson('A2'), b2 = I.createPerson('B2')
  const sh2 = await E.show(b2, T0)
  const bu2 = await E.scan(a2, sh2.card, T0 + 1000)
  perturb(b2, () => { b2.challenges.get(sh2.ch).aged = true })
  const r2 = await disp(b2, bu2.env, T0 + 2000)
  assert.match(r2.error, /challenge unknown/); assert.equal(r2.ack, undefined); assert.equal(b2.records?.size ?? 0, 0)
  // bundle (open → recorded by a concurrent optical leg of the SAME counterpart): re-entry lands record-aware, one record
  const a3 = I.createPerson('A3'), b3 = I.createPerson('B3')
  const sh3 = await E.show(b3, T0)
  const bu3 = await E.scan(a3, sh3.card, T0 + 1000)
  let opt
  perturb(b3, () => { opt = E.captureSentCard(b3, bu3.sentCard, T0 + 1500) })   // competes for the same record key; whichever commits first, the other lands on the record
  const r3 = await disp(b3, bu3.env, T0 + 2000)
  const o3 = await opt
  assert.ok(o3.recorded || o3.idempotent); assert.ok(r3.recorded || r3.accepted, 'bundle lands either way'); assert.equal(b3.records.size, 1)
  // bundle (open → recorded by a FOREIGN counterpart between prepare and verify) → consumed-challenge, no ack
  const a4 = I.createPerson('A4'), x4 = I.createPerson('X4'), b4 = I.createPerson('B4')
  const sh4 = await E.show(b4, T0)
  const bu4 = await E.scan(a4, sh4.card, T0 + 1000), bx4 = await E.scan(x4, sh4.card, T0 + 1000)
  perturb(b4, () => {
    // X4's record appears "concurrently": commit it directly through the optical leg's synchronous path is not possible here — emulate the committed state
    const rec = { ceremony: CEREMONY, counterpart: bx4.ctx.anchor, card: bx4.sentCard, ownValue: sh4.ch, peerValue: bx4.sentCard.challenge.value, tCh: T0, bind: 'uEiAx', at: T0 + 1500, ctxAnchor: sh4.ctx.anchor, accepted: {} }
    b4.records.set(sh4.ch, rec); b4.challenges.delete(sh4.ch)
    b4.contacts.set(bx4.ctx.anchor, { name: 'X4', card: bx4.sentCard, channel: { own: sh4.ctx, counterpartKa: bx4.sentCard.keyAgreement }, ownChallenge: sh4.ch, peerChallenge: bx4.sentCard.challenge.value, bind: 'uEiAx' })
  })
  const r4 = await disp(b4, bu4.env, T0 + 2000)
  assert.equal(r4.error, 'consumed-challenge'); assert.equal(r4.ack, undefined); assert.equal(b4.records.size, 1)
  // scan: the own value gets recorded by another path between prepare and verify → refused, no second record
  const a5 = I.createPerson('A5'), b5 = I.createPerson('B5')
  const sh5 = await E.show(b5, T0)
  const ch = new Uint8Array(17).fill(5)
  const own5 = (await import('../dist/index.js')).challengeOf(ch)
  perturb(a5, () => { (a5.challenges ??= new Map()).set(own5, { tCh: T0, ctxAnchor: 'x' }) })   // the very value enters use concurrently
  const s5 = await E.scan(a5, sh5.card, T0 + 1000, { ch })
  assert.match(s5.error, /already in use/); assert.equal(a5.records?.size ?? 0, 0)
  // delivery: the fresh thread gets reserved between prepare and verify → not fresh, no ack
  const a6 = I.createPerson('A6'), b6 = I.createPerson('B6')
  const sh6 = await E.show(b6, T0)
  const bu6 = await E.scan(a6, sh6.card, T0 + 1000)
  await disp(b6, bu6.env, T0 + 2000)
  const t6 = b6.contacts.get(bu6.ctx.anchor), a6Ctx = a6.contacts.get(sh6.ctx.anchor).channel.own
  const isoAt = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
  const c6 = await issueCredential(t6.channel.own, bu6.ctx.anchor, CEREMONY, t6.peerChallenge, t6.bind, isoAt(T0 + 3000))
  const tid6 = globalThis.crypto.randomUUID()
  perturb(a6, () => { (a6.contacts.get(sh6.ctx.anchor).inThreads ??= new Set()).add(tid6) })
  const r6 = await disp(a6, await seal({ id: globalThis.crypto.randomUUID(), type: E.DELIVERY_TYPE, issuer: t6.channel.own.anchor, recipient: a6Ctx.anchor, threadId: tid6, issuedAt: isoAt(T0 + 3000), payload: { credential: c6 }, ceremony: { step: 'deliver' } }, a6Ctx.keyAgreement), T0 + 4000)
  assert.match(r6.error, /threadId not fresh/); assert.equal(r6.ack, undefined)
})

test('encounter — review 12 regressions (re-issue thread reserved · owed issuance resumable · pair nonce never the envelope nonce)', async () => {
  // B-1: after a re-issued bundle on fresh thread T2 landed, a further re-issue on T2 is not fresh
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const bu = await E.scan(a, shB.card, T0 + 1000)
  await disp(b, bu.env, T0 + 2000)
  const bCtx = b.contexts.get(shB.ctx.anchor)
  const d = (await unseal(bu.env, bCtx.x.priv)).document
  const t2 = globalThis.crypto.randomUUID()
  const re1 = await disp(b, await seal({ ...d, id: globalThis.crypto.randomUUID(), threadId: t2 }, bCtx.keyAgreement), T0 + 3000)
  assert.ok(re1.accepted && re1.ack)
  const re2 = await disp(b, await seal({ ...d, id: globalThis.crypto.randomUUID(), threadId: t2 }, bCtx.keyAgreement), T0 + 3500)
  assert.match(re2.error, /threadId not fresh/); assert.equal(re2.ack, undefined)
  // M-2: a 32-byte pair nonce is fine (never forwarded to the sealer); a broken envelope nonce fails AFTER the record — and the duty is resumable
  const a2 = I.createPerson('A2'), b2 = I.createPerson('B2')
  const sh2 = await E.show(b2, T0)
  const ok = await E.scan(a2, sh2.card, T0 + 1000, { nonce: new Uint8Array(32).fill(4) })
  assert.ok(ok.env, 'pair nonce accepted, envelope sealed with its own nonce')
  const a3 = I.createPerson('A3'), b3 = I.createPerson('B3')
  const sh3 = await E.show(b3, T0)
  await assert.rejects(E.scan(a3, sh3.card, T0 + 1000, { envNonce: new Uint8Array(5) }), /nonce/)
  const t3 = a3.contacts.get(sh3.ctx.anchor)
  assert.ok(t3 && t3.bundlePending && a3.records.size === 1, 'record stands (5.5: before issuing), issuance owed')
  assert.equal(E.flushEncounter(a3).outbound.length, 0)
  const res = await E.resumeEncounter(a3, T0 + 2000)
  assert.equal(res.outbound.length, 1); assert.ok(!t3.bundlePending); assert.ok(t3.credential && t3.sentCard)
  const landed = await disp(b3, res.outbound[0].env, T0 + 3000)
  assert.ok(landed.recorded && landed.ack, 'the resumed bundle lands')
  assert.equal((await E.resumeEncounter(a3, T0 + 4000)).outbound.length, 0, 'idempotent: nothing owed any more')
  // the deferred counter document is resumed too
  const a4 = I.createPerson('A4'), b4 = I.createPerson('B4')
  const sh4 = await E.show(b4, T0)
  const bu4 = await E.scan(a4, sh4.card, T0 + 1000)
  await E.captureSentCard(b4, bu4.sentCard, T0 + 2000)
  assert.ok((await E.counter(b4, bu4.ctx.anchor, T0 + 3000)).deferred)
  const t4 = b4.contacts.get(bu4.ctx.anchor)
  t4.bundleThread = bu4.threadId   // the bundle "landed" without producing the document (crash between)
  const r4 = await E.resumeEncounter(b4, T0 + 4000)
  assert.equal(r4.outbound.length, 1); assert.ok(!t4.counterDocPending)
  assert.ok((await disp(a4, r4.outbound[0].env, T0 + 5000)).mutual)
})

test('encounter — review 13 regressions (unknown ceremony.step passes · challenge bound to its anchor · resume serialized · redelivery after retention lands record-aware)', async () => {
  const isoAt = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
  // B-1: an unknown framework step passes through (Delivery §3); the thread rule binds only counter/deliver
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const bu = await E.scan(a, shB.card, T0 + 1000)
  await disp(b, bu.env, T0 + 2000)
  const t = b.contacts.get(bu.ctx.anchor), aCtx = a.contacts.get(shB.ctx.anchor).channel.own
  const cred = await issueCredential(t.channel.own, bu.ctx.anchor, CEREMONY, t.peerChallenge, t.bind, isoAt(T0 + 3000))
  const fut = await disp(a, await seal({ id: globalThis.crypto.randomUUID(), type: E.DELIVERY_TYPE, issuer: t.channel.own.anchor, recipient: aCtx.anchor, threadId: bu.threadId, issuedAt: isoAt(T0 + 3000), payload: { credential: cred }, ceremony: { step: 'future-framework-step' } }, aCtx.keyAgreement), T0 + 4000)
  assert.ok(fut.buffered && fut.accepted && fut.ack)
  // B-2: a sent card pointing boundTo at c_1 but sentTo at ANOTHER local anchor of B → refused, optical and bundle
  const a2 = I.createPerson('A2'), b2 = I.createPerson('B2')
  const sh1 = await E.show(b2, T0), sh2 = await E.show(b2, T0 + 100)
  const bu2 = await E.scan(a2, sh1.card, T0 + 1000)
  const { proof: _p, ...body } = bu2.sentCard
  const forged = await signCard(bu2.ctx, { ...body, sentTo: sh2.ctx.anchor }, bu2.sentCard.proof.created)
  const opt = await E.captureSentCard(b2, forged, T0 + 2000)
  assert.match(opt.error, /another anchor/); assert.equal(b2.records?.size ?? 0, 0)
  const cred2 = await issueCredential(bu2.ctx, sh2.ctx.anchor, CEREMONY, sh1.ch, a2.contacts.get(sh1.ctx.anchor).bind, isoAt(T0 + 1000))
  const doc2 = { id: globalThis.crypto.randomUUID(), type: E.BUNDLE_TYPE, issuer: bu2.ctx.anchor, recipient: sh2.ctx.anchor, threadId: globalThis.crypto.randomUUID(), issuedAt: isoAt(T0 + 1000), payload: { card: forged, credential: cred2 } }
  const r2 = await disp(b2, await seal(doc2, sh2.ctx.keyAgreement), T0 + 2500)
  assert.match(r2.error, /another anchor/); assert.equal(r2.ack, undefined); assert.equal(b2.records?.size ?? 0, 0)
  assert.equal(E.resolve(b2, sh1.ch, T0 + 2500), 'open', 'nothing consumed')
  // B-3: two parallel resumes produce ONE bundle
  const a3 = I.createPerson('A3'), b3 = I.createPerson('B3')
  const sh3 = await E.show(b3, T0)
  await assert.rejects(E.scan(a3, sh3.card, T0 + 1000, { envNonce: new Uint8Array(5) }))
  const [x, y] = await Promise.all([E.resumeEncounter(a3, T0 + 2000), E.resumeEncounter(a3, T0 + 2000)])
  assert.equal(x.outbound.length + y.outbound.length, 1); assert.equal(a3.contacts.get(sh3.ctx.anchor).outbox.size, 1)
  // B-4: after cache + ack retention, the byte-identical original bundle lands record-aware with a fresh ack; a NEW document on that thread still does not
  const a4 = I.createPerson('A4'), b4 = I.createPerson('B4')
  const sh4 = await E.show(b4, T0)
  const bu4 = await E.scan(a4, sh4.card, T0 + 1000)
  const first = await disp(b4, bu4.env, T0 + 2000)
  const t4 = b4.contacts.get(bu4.ctx.anchor)
  b4.deliveryCache.clear(); t4.ackStore.clear()   // retention passed
  const again = await disp(b4, bu4.env, T0 + 3000)
  assert.ok(again.accepted && again.ack && !again.duplicate, 'record-aware, freshly acknowledged'); assert.equal(b4.records.size, 1)
  assert.notDeepEqual(again.ack.env, first.ack.env, 'a freshly generated ack')
  const b4Ctx = b4.contexts.get(sh4.ctx.anchor)
  const d4 = (await unseal(bu4.env, b4Ctx.x.priv)).document
  const fresh = await disp(b4, await seal({ ...d4, id: globalThis.crypto.randomUUID() }, b4Ctx.keyAgreement), T0 + 3500)
  assert.match(fresh.error, /threadId not fresh/)
})

test('encounter — review 14 regressions (deactivation keeps the pending counter duty)', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const bu = await E.scan(a, shB.card, T0 + 1000)
  assert.ok((await E.captureSentCard(b, bu.sentCard, T0 + 2000)).recorded)
  assert.ok((await E.counter(b, bu.ctx.anchor, T0 + 3000)).deferred)
  const t = b.contacts.get(bu.ctx.anchor)
  t.deactivated = true; t.chainedInto = 'did:key:z6Mkhead'   // chained away before the bundle arrived
  const late = await disp(b, bu.env, T0 + 4000)
  assert.ok(late.accepted && late.counterOut?.env, 'the bundle materializes the already issued counter document'); assert.ok(!t.counterDocPending)
  assert.ok((await disp(a, late.counterOut.env, T0 + 5000)).mutual)
  // a NEW counter issuance on a deactivated tuple is still refused
  const a2 = I.createPerson('A2'), b2 = I.createPerson('B2')
  const sh2 = await E.show(b2, T0)
  const bu2 = await E.scan(a2, sh2.card, T0 + 1000)
  await disp(b2, bu2.env, T0 + 2000)
  b2.contacts.get(bu2.ctx.anchor).deactivated = true
  assert.match((await E.counter(b2, bu2.ctx.anchor, T0 + 3000)).error, /no enactment record/)
  // resume materializes a pending document on a deactivated tuple once the thread is known
  const a3 = I.createPerson('A3'), b3 = I.createPerson('B3')
  const sh3 = await E.show(b3, T0)
  const bu3 = await E.scan(a3, sh3.card, T0 + 1000)
  await E.captureSentCard(b3, bu3.sentCard, T0 + 2000)
  await E.counter(b3, bu3.ctx.anchor, T0 + 3000)
  const t3 = b3.contacts.get(bu3.ctx.anchor); t3.deactivated = true; t3.bundleThread = bu3.threadId
  assert.equal((await E.resumeEncounter(b3, T0 + 4000)).outbound.length, 1); assert.ok(!t3.counterDocPending)
})

test('encounter — review 15 regression (an owed bundle survives deactivation: record → seal failure → deactivation → resume yields exactly one bundle)', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  await assert.rejects(E.scan(a, shB.card, T0 + 1000, { envNonce: new Uint8Array(5) }))
  const t = a.contacts.get(shB.ctx.anchor)
  assert.ok(t.bundlePending && t.credential && t.sentCard)
  t.deactivated = true; t.chainedInto = 'did:key:z6Mkhead'
  const res = await E.resumeEncounter(a, T0 + 2000)
  assert.equal(res.outbound.length, 1); assert.equal(t.outbox.size, 1); assert.ok(!t.bundlePending)
  assert.equal((await E.resumeEncounter(a, T0 + 2500)).outbound.length, 0)
  assert.deepEqual(E.flushEncounter(a).outbound[0].env, res.outbound[0].env, 'byte-identical redelivery of the one bundle')
  assert.ok((await disp(b, res.outbound[0].env, T0 + 3000)).recorded)
})

test('encounter — review 16 regressions (ack stage 7 before class · 4.1 order card proof before ceremony · unbounded re-entry · resumed sent card)', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const bu = await E.scan(a, shB.card, T0 + 1000)
  const rc = await disp(b, bu.env, T0 + 2000)
  // B-1: a correctly signed ack with an empty payload → malformed (stage 7), not 'ack invalid'
  const aT = a.contacts.get(shB.ctx.anchor), bT = b.contacts.get(bu.ctx.anchor)
  const ackDoc = (await unseal(rc.ack.env, aT.channel.own.x.priv)).document
  const { proof: _p, ...body } = ackDoc
  const bad = await diSign(bT.channel.own, { ...body, id: globalThis.crypto.randomUUID(), payload: {} }, body.issuedAt)
  assert.equal((await T.receiveTrustDoc(a, await seal(bad, bT.channel.counterpartKa), T0 + 3000)).error, 'malformed')
  // B-4: broken card proof + unknown ceremony → the card proof names the disposition (4.1 step 2 before step 5)
  const a4 = I.createPerson('A4'), b4 = I.createPerson('B4')
  const sh4 = await E.show(b4, T0)
  const bu4 = await E.scan(a4, sh4.card, T0 + 1000)
  const b4Ctx = b4.contexts.get(sh4.ctx.anchor)
  const d4 = (await unseal(bu4.env, b4Ctx.x.priv)).document
  const badCard = structuredClone(d4.payload.card); badCard.proof.proofValue = badCard.proof.proofValue.slice(0, -1) + (badCard.proof.proofValue.at(-1) === '1' ? '2' : '1')
  const t4 = a4.contacts.get(sh4.ctx.anchor)
  const oldCer = await issueCredential(t4.channel.own, sh4.ctx.anchor, 'encounter-scan@0.24', t4.peerChallenge, t4.bind, d4.payload.credential.validFrom)
  const r4 = await disp(b4, await seal({ ...d4, id: globalThis.crypto.randomUUID(), payload: { card: badCard, credential: oldCer } }, b4Ctx.keyAgreement), T0 + 2000)
  assert.equal(r4.error, 'card proof')
  const r4b = await disp(b4, await seal({ ...d4, id: globalThis.crypto.randomUUID(), payload: { ...d4.payload, credential: oldCer } }, b4Ctx.keyAgreement), T0 + 2500)
  assert.match(r4b.error, /ceremony/)
  // B-3: the state moves six times between prepare and verify, then holds → the document lands (unbounded re-entry)
  const a3 = I.createPerson('A3'), b3 = I.createPerson('B3')
  const sh3 = await E.show(b3, T0)
  const bu3 = await E.scan(a3, sh3.card, T0 + 1000)
  let moves = 0
  const ghost = { ceremony: CEREMONY, counterpart: 'did:key:z6Mkghost', card: {}, tCh: T0, bind: 'uEiAx', ctxAnchor: sh3.ctx.anchor, accepted: {} }
  // DETERMINISTIC: every hook call toggles the state (open ↔ a transient foreign
  // record) synchronously, so each verify sees a state different from its
  // prepare → retry; after six toggles the value is open again and stays
  b3.__beforeVerify = () => {
    moves++
    if (moves <= 6) {
      if (b3.records.has(sh3.ch)) { b3.records.delete(sh3.ch); b3.challenges.set(sh3.ch, { tCh: T0, ctxAnchor: sh3.ctx.anchor }) } else { b3.records.set(sh3.ch, ghost); b3.challenges.delete(sh3.ch) }
    } else delete b3.__beforeVerify
  }
  const r3 = await disp(b3, bu3.env, T0 + 2000)
  assert.ok(r3.recorded && r3.ack, 'accepted after the state settled'); assert.ok(moves >= 7, `re-entered at least six times (${moves})`)
  // MAJOR: a resumed bundle hands the sent card + thread to the host
  const a5 = I.createPerson('A5'), b5 = I.createPerson('B5')
  const sh5 = await E.show(b5, T0)
  await assert.rejects(E.scan(a5, sh5.card, T0 + 1000, { envNonce: new Uint8Array(5) }))
  const res = await E.resumeEncounter(a5, T0 + 2000)
  assert.ok(res.outbound[0].sentCard && res.outbound[0].threadId && res.outbound[0].peerAnchor === sh5.ctx.anchor)
})

test('encounter — review 17 regressions (pre-lock window for a foreign recorded bundle · waiter re-enters at stage 4 · optical decisions under the lock)', async () => {
  // B-1: second scanner, same displayed challenge, 25 h late → stale-issuance (pre-lock check 6), not consumed-challenge
  const a = I.createPerson('A'), x = I.createPerson('X'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const bu = await E.scan(a, shB.card, T0 + 1000)
  await disp(b, bu.env, T0 + 2000)
  const bx = await E.scan(x, shB.card, T0 + 1500)
  const rx = await disp(b, await staleBundle(x, b, shB, bx, T0 + 25 * H), T0 + 25 * H + 1000)
  assert.equal(rx.error, 'stale-issuance'); assert.equal(rx.ack, undefined); assert.equal(b.records.size, 1)
  const x2 = I.createPerson('X2')
  const bx2 = await E.scan(x2, shB.card, T0 + 3000)
  assert.equal((await disp(b, bx2.env, T0 + 3500)).error, 'consumed-challenge', 'in-window foreign bundle: the stage-9 verdict')
  // B-2: a waiter re-enters at stage 4 — while the record key is held, an arriving bundle waits holding nothing and evaluates afresh afterwards
  const a2 = I.createPerson('A2'), b2 = I.createPerson('B2')
  const sh2 = await E.show(b2, T0)
  const bu2 = await E.scan(a2, sh2.card, T0 + 1000)
  const L = b2.lockSet ?? (b2.lockSet = { held: new Set(), waiters: [] })
  L.held.add(sh2.ch)
  let settled = false
  const pr = disp(b2, bu2.env, T0 + 2000).then((r) => { settled = true; return r })
  await new Promise((res) => setTimeout(res, 30))
  assert.equal(settled, false); assert.equal(L.held.size, 1, 'the waiter holds nothing (only the foreign holder)')
  b2.challenges.get(sh2.ch).aged = true   // the state moves while the waiter waits
  L.held.delete(sh2.ch); for (const w of L.waiters.splice(0)) w()
  const r2 = await pr
  assert.match(r2.error, /challenge unknown/, 're-entered at stage 4 under the new state — not resumed on the stale evaluation')
  // B-3: optical unknown/recorded verdicts are produced under the record key
  const a3 = I.createPerson('A3'), b3 = I.createPerson('B3')
  const sh3 = await E.show(b3, T0)
  const bu3 = await E.scan(a3, sh3.card, T0 + 1000)
  const L3 = b3.lockSet ?? (b3.lockSet = { held: new Set(), waiters: [] })
  L3.held.add(sh3.ch)
  let done3 = false
  const p3 = E.captureSentCard(b3, bu3.sentCard, T0 + 11 * M).then((r) => { done3 = true; return r })
  await new Promise((res) => setTimeout(res, 30))
  assert.equal(done3, false, 'gate-expired is not decided outside the serialization point')
  L3.held.delete(sh3.ch); for (const w of L3.waiters.splice(0)) w()
  assert.equal((await p3).error, 'gate-expired')
})

test('encounter — review 18 regressions (receiver refuses c_A = c_B · recorded-branch verdicts only under the authoritative resolution)', async () => {
  const isoAt = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
  // B-1: a signed sent card reusing the displayed challenge as its own → refused optically and in a bundle
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const bu = await E.scan(a, shB.card, T0 + 1000)
  const { proof: _p, ...body } = bu.sentCard
  const reused = await signCard(bu.ctx, { ...body, challenge: { value: shB.ch, issuedAt: body.challenge.issuedAt } }, bu.sentCard.proof.created)
  assert.match((await E.captureSentCard(b, reused, T0 + 2000)).error, /equals the displayed/); assert.equal(b.records?.size ?? 0, 0)
  const { binding } = await import('../dist/index.js')
  const bind = await binding(CEREMONY, shB.ch, shB.ch)
  const cred = await issueCredential(bu.ctx, shB.ctx.anchor, CEREMONY, shB.ch, bind, isoAt(T0 + 1000))
  const doc = { id: globalThis.crypto.randomUUID(), type: E.BUNDLE_TYPE, issuer: bu.ctx.anchor, recipient: shB.ctx.anchor, threadId: globalThis.crypto.randomUUID(), issuedAt: isoAt(T0 + 1000), payload: { card: reused, credential: cred } }
  const r = await disp(b, await seal(doc, shB.ctx.keyAgreement), T0 + 2500)
  assert.match(r.error, /equals the displayed/); assert.equal(r.ack, undefined); assert.equal(E.resolve(b, shB.ch, T0 + 2500), 'open')
  // B-2: record + tuple vanish between prepare and verify → the authoritative resolution says unknown → validation-failed, never consumed-challenge
  const a2 = I.createPerson('A2'), x2 = I.createPerson('X2'), b2 = I.createPerson('B2')
  const sh2 = await E.show(b2, T0)
  const bu2 = await E.scan(a2, sh2.card, T0 + 1000), bx2 = await E.scan(x2, sh2.card, T0 + 1500)
  await disp(b2, bu2.env, T0 + 2000)
  b2.__beforeVerify = () => { delete b2.__beforeVerify; b2.records.delete(sh2.ch); b2.contacts.delete(bu2.ctx.anchor) }   // the relation is deleted concurrently
  const r2 = await disp(b2, bx2.env, T0 + 2500)
  assert.match(r2.error, /challenge unknown/); assert.equal(r2.ack, undefined)
})

test('encounter — review 19 regression (resolution before the ceremony check: an aged value latches even under a foreign ceremony; verdict under the lock)', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const bu = await E.scan(a, shB.card, T0 + 1000)
  const bCtx = b.contexts.get(shB.ctx.anchor)
  const d = (await unseal(bu.env, bCtx.x.priv)).document
  const t = a.contacts.get(shB.ctx.anchor)
  const old = await issueCredential(t.channel.own, shB.ctx.anchor, 'encounter-scan@0.24', t.peerChallenge, t.bind, d.payload.credential.validFrom)
  const r = await disp(b, await seal({ ...d, id: globalThis.crypto.randomUUID(), payload: { ...d.payload, credential: old } }, bCtx.keyAgreement), T0 + 11 * M)
  assert.match(r.error, /challenge unknown/, 'unknown decided at the serialization point'); assert.equal(r.ack, undefined)
  assert.ok(b.challenges.get(shB.ch).aged, 'the provisional resolution latched'); assert.equal(E.resolve(b, shB.ch, T0 + 1000), 'unknown', 'no way back')
})

test('encounter — review 20 regression (a re-issued bundle on its fresh thread is redeliverable after retention)', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const bu = await E.scan(a, shB.card, T0 + 1000)
  await disp(b, bu.env, T0 + 2000)
  const bCtx = b.contexts.get(shB.ctx.anchor)
  const d = (await unseal(bu.env, bCtx.x.priv)).document
  const env2 = await seal({ ...d, id: globalThis.crypto.randomUUID(), threadId: globalThis.crypto.randomUUID() }, bCtx.keyAgreement)
  const r1 = await disp(b, env2, T0 + 3000)
  assert.ok(r1.accepted && r1.ack)
  const t = b.contacts.get(bu.ctx.anchor)
  b.deliveryCache.clear(); t.ackStore.clear()   // retention passed
  const r2 = await disp(b, env2, T0 + 4000)
  assert.ok(r2.accepted && r2.ack && !r2.duplicate, 'the identical second bundle lands record-aware again, freshly acknowledged')
  const r3 = await disp(b, await seal({ ...d, id: globalThis.crypto.randomUUID(), threadId: r1.ack ? (await unseal(env2, bCtx.x.priv)).document.threadId : '' }, bCtx.keyAgreement), T0 + 4500)
  assert.match(r3.error, /threadId not fresh/, 'a NEW document on that thread is still refused')
})

test('encounter — review 21 regressions (display name within the card bound · injected ids must be UUID v4, refused before the record gate)', async () => {
  const long = I.createPerson('L'.repeat(230)), b = I.createPerson('B')
  const sh = await E.show(long, T0)
  assert.equal(sh.card.name.length, 200, 'display name truncated to the schema bound')
  const shB = await E.show(b, T0)
  const bu = await E.scan(long, shB.card, T0 + 1000)
  assert.equal(bu.sentCard.name.length, 200); assert.ok((await disp(b, bu.env, T0 + 2000)).recorded, 'a conformant scanner accepts the card')
  const a2 = I.createPerson('A2'), b2 = I.createPerson('B2')
  const sh2 = await E.show(b2, T0)
  assert.match((await E.scan(a2, sh2.card, T0 + 1000, { threadId: 'not-a-uuid' })).error, /UUID v4/)
  assert.match((await E.scan(a2, sh2.card, T0 + 1000, { id: 'nope' })).error, /UUID v4/)
  assert.equal(a2.records?.size ?? 0, 0, 'nothing recorded, no challenge consumed'); assert.equal(a2.contacts.size, 0)
  const ok = await E.scan(a2, sh2.card, T0 + 1000)
  await disp(b2, ok.env, T0 + 2000)
  assert.match((await E.counter(b2, ok.ctx.anchor, T0 + 3000, { id: 'bad' })).error, /UUID v4/)
  assert.ok(!b2.contacts.get(ok.ctx.anchor).credential, 'refused before any issuance')
})

test('encounter — review 22 regressions (double scan refused · resume never backdates · counter document never doubled)', async () => {
  // B-1: the same displayed code scanned twice by one scanner → second scan refused; the counter-step for the first still lands
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const bu1 = await E.scan(a, shB.card, T0 + 1000)
  const bu2 = await E.scan(a, shB.card, T0 + 1500)
  assert.match(bu2.error, /already scanned/); assert.equal(a.records.size, 1)
  await disp(b, bu1.env, T0 + 2000)
  const ctr = await E.counter(b, bu1.ctx.anchor, T0 + 3000)
  assert.ok((await disp(a, ctr.env, T0 + 4000)).mutual)
  // B-2: a resume 25 h after the record issues nothing (window closed); a resume inside the window dates the credential NOW
  const a2 = I.createPerson('A2'), b2 = I.createPerson('B2')
  const sh2 = await E.show(b2, T0)
  await assert.rejects(E.scan(a2, sh2.card, T0 + 1000, { envNonce: new Uint8Array(5) }))
  const t2 = a2.contacts.get(sh2.ctx.anchor); delete t2.credential; delete t2.sentCard   // crashed before signing
  const late = await E.resumeEncounter(a2, T0 + 25 * H)
  assert.equal(late.outbound.length, 0); assert.ok(!t2.bundlePending && t2.bundleLapsed === 'stale-issuance' && !t2.credential)
  const a3 = I.createPerson('A3'), b3 = I.createPerson('B3')
  const sh3 = await E.show(b3, T0)
  await assert.rejects(E.scan(a3, sh3.card, T0 + 1000, { envNonce: new Uint8Array(5) }))
  const t3 = a3.contacts.get(sh3.ctx.anchor); delete t3.credential; delete t3.sentCard
  const res = await E.resumeEncounter(a3, T0 + 2 * M)   // inside A's window AND inside B's display age bound
  assert.equal(res.outbound.length, 1)
  assert.equal(t3.credential.validFrom, new Date(T0 + 2 * M).toISOString().replace(/\.\d{3}Z$/, 'Z'), 'validFrom = actual issuance time')
  assert.equal(t3.sentCard.challenge.issuedAt, new Date(T0 + 1000).toISOString().replace(/\.\d{3}Z$/, 'Z'), 'the sent challenge keeps its t_ch')
  assert.ok((await disp(b3, res.outbound[0].env, T0 + 2 * M + 1000)).recorded, 'inside the window: accepted')
  // M-3: counter document in the outbox but the flag still set (crash between) → resume takes the existing document
  const a4 = I.createPerson('A4'), b4 = I.createPerson('B4')
  const sh4 = await E.show(b4, T0)
  const bu4 = await E.scan(a4, sh4.card, T0 + 1000)
  await disp(b4, bu4.env, T0 + 2000)
  const c4 = await E.counter(b4, bu4.ctx.anchor, T0 + 3000)
  const t4 = b4.contacts.get(bu4.ctx.anchor); t4.counterDocPending = true   // the flag survived, the document too
  const r4 = await E.resumeEncounter(b4, T0 + 4000)
  assert.equal(t4.outbox.size, 1); assert.ok(!t4.counterDocPending); assert.deepEqual(r4.outbound[0].env, c4.env)
})

test('encounter — review 23 regressions (re-ack survives relation deletion · chain head carries mutuality on the bundle path · no counter past the window)', async () => {
  // B-1: relation deleted after the effect — a redelivery is duplicate-known WITH the stored ack
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const bu = await E.scan(a, shB.card, T0 + 1000)
  const first = await disp(b, bu.env, T0 + 2000)
  b.contacts.delete(bu.ctx.anchor); b.records.delete(shB.ch)   // the relation is gone; the cache entry lives on
  const again = await disp(b, bu.env, T0 + 3000)
  assert.ok(again.duplicate && again.ack, 're-ack despite the deleted relation'); assert.deepEqual(again.ack.env, first.ack.env, 'byte-identical')
  // M-2: optical record → counter → deactivation → late bundle: the chain head carries ✓
  const a2 = I.createPerson('A2'), b2 = I.createPerson('B2')
  const sh2 = await E.show(b2, T0)
  const bu2 = await E.scan(a2, sh2.card, T0 + 1000)
  await E.captureSentCard(b2, bu2.sentCard, T0 + 2000)
  await E.counter(b2, bu2.ctx.anchor, T0 + 3000)
  const t2 = b2.contacts.get(bu2.ctx.anchor)
  const head = { name: 'A2', state: '→', provenance: 'other', channel: { own: sh2.ctx, counterpartKa: bu2.sentCard.keyAgreement } }
  b2.contacts.set('did:key:z6Mkhead2', head); t2.deactivated = true; t2.chainedInto = 'did:key:z6Mkhead2'
  const late = await disp(b2, bu2.env, T0 + 4000)
  assert.ok(late.accepted && late.mutual); assert.equal(head.state, '✓'); assert.equal(head.provenance, 'ceremony')
})

test('encounter — review 24 regression (parallel scans of one displayed code linearize: exactly one enactment)', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const results = await Promise.all(Array.from({ length: 20 }, () => E.scan(a, shB.card, T0 + 1000)))
  const ok = results.filter((r) => r.env)
  assert.equal(ok.length, 1, 'one bundle'); assert.equal(a.records.size, 1); assert.equal(a.contacts.size, 1)
  assert.ok(results.filter((r) => r.error).every((r) => /already scanned/.test(r.error)))
  await disp(b, ok[0].env, T0 + 2000)
  const ctr = await E.counter(b, ok[0].ctx.anchor, T0 + 3000)
  assert.ok((await disp(a, ctr.env, T0 + 4000)).mutual, 'the counter-step for the one enactment lands')
})

test('encounter — review 25 regressions (issuance window anchored at the subject challenge · direction derived from issued/received)', async () => {
  // M-1: c_B = T0, c_A = T0+9 min; the counter-step binds c_A → allowed until c_A + 24h10m
  const a = I.createPerson('A'), b = I.createPerson('B')
  const shB = await E.show(b, T0)
  const bu = await E.scan(a, shB.card, T0 + 9 * M)
  await disp(b, bu.env, T0 + 9 * M + 1000)
  const ctr = await E.counter(b, bu.ctx.anchor, T0 + 24 * H + 15 * M)
  assert.ok(ctr.env, 'inside the window anchored at c_A'); assert.ok((await disp(a, ctr.env, T0 + 24 * H + 16 * M)).mutual)
  const b2 = I.createPerson('B2'), a2 = I.createPerson('A2')
  const sh2 = await E.show(b2, T0)
  const bu2 = await E.scan(a2, sh2.card, T0 + 9 * M)
  await disp(b2, bu2.env, T0 + 9 * M + 1000)
  assert.match((await E.counter(b2, bu2.ctx.anchor, T0 + 24 * H + 20 * M)).error, /stale-issuance/, 'past c_A + 24h10m')
  // the scanner's bundle binds c_B: a resume at T0+24h12m is past c_B's window even though c_A's is open
  const a3 = I.createPerson('A3'), b3 = I.createPerson('B3')
  const sh3 = await E.show(b3, T0)
  await assert.rejects(E.scan(a3, sh3.card, T0 + 9 * M, { envNonce: new Uint8Array(5) }))
  const t3 = a3.contacts.get(sh3.ctx.anchor); delete t3.credential; delete t3.sentCard
  assert.equal((await E.resumeEncounter(a3, T0 + 24 * H + 12 * M)).outbound.length, 0); assert.equal(t3.bundleLapsed, 'stale-issuance')
  // M-2: direction from what exists — optical record ◇ · own credential → · received ← · both ✓
  const a4 = I.createPerson('A4'), b4 = I.createPerson('B4')
  const sh4 = await E.show(b4, T0)
  const bu4 = await E.scan(a4, sh4.card, T0 + 1000)
  assert.equal(a4.contacts.get(sh4.ctx.anchor).state, '→')
  await E.captureSentCard(b4, bu4.sentCard, T0 + 2000)
  const t4 = b4.contacts.get(bu4.ctx.anchor)
  assert.equal(t4.state, '◇', 'recorded, nothing issued or received')
  await E.counter(b4, bu4.ctx.anchor, T0 + 3000)
  assert.equal(t4.state, '→', 'issued')
  await disp(b4, bu4.env, T0 + 4000)
  assert.equal(t4.state, '✓', 'issued + received')
  // a scan whose issuance failed after the record: no direction claimed
  const a5 = I.createPerson('A5'), b5 = I.createPerson('B5')
  const sh5 = await E.show(b5, T0)
  await assert.rejects(E.scan(a5, sh5.card, T0 + 1000, { envNonce: new Uint8Array(5) }))
  const t5 = a5.contacts.get(sh5.ctx.anchor)
  assert.equal(t5.state, '→', 'the credential was issued before the seal failed — direction follows the credential, not the bundle')
})
