#!/usr/bin/env node
// The probe world, end to end through the BUILT package: ceremony →
// trust act → group over the channel → §6a continuity. This is the CI
// echo of the four simulator suites (the deep oracle with ~91 checks
// lives in simulator/*-test.mjs and runs against the same bodies).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { introduce as I, trust as T, continuity as CN, membership as G } from '../dist/probe.js'

const T0 = Date.parse('2026-08-27T12:00:00Z')

test('probe — ceremony, trust act, group admission, continuity chain', async () => {
  const anton = I.createPerson('Anton')
  const berta = I.createPerson('Berta')

  // ceremony: fresh tuple, both sides hold each other
  await I.ceremony(anton, berta, T0)
  const bKey = [...anton.contacts.keys()][0]
  assert.equal(anton.contacts.get(bKey).state, '✓', 'verified after the ceremony')

  // trust act: Anton disclosed his community anchor to Berta — one-way
  const deliver = async (to, env, when) => {
    const r = await T.receiveTrustDoc(to, env, when)
    assert.equal(r.handled, true, 'trust doc handled')
    return r
  }
  const pkt = await T.setTrust(anton, bKey, T0 + 10_000)
  const rt = await deliver(berta, pkt.env, T0 + 11_000)
  assert.equal(rt.disclosed, (await T.communityContext(anton)).anchor, 'the VERIFIED mapping discloses exactly the community anchor')
  const aKey = [...berta.contacts.keys()][0]
  assert.ok(berta.contacts.get(aKey).trustReceived, 'Berta holds the disclosure (stamped)')
  assert.ok(!berta.contacts.get(aKey).trustGiven, 'one-way: nothing given back')
  assert.ok(anton.contacts.get(bKey).trustGiven, "Anton's journal: the one-way door is open")

  // group: Berta founds, invites Anton over the verified channel
  const g = await G.foundGroup(berta, 'Probewerk', T0 + 100_000)
  const p1 = await G.preludeRequest(berta, aKey, g.genesisDigest, T0 + 110_000)
  let r = await G.receiveDoc(anton, p1.env, T0 + 115_000)         // derivation + reply
  r = await G.receiveDoc(berta, r.outbound[0].env, T0 + 120_000)  // reply → invite
  r = await G.receiveDoc(anton, r.outbound[0].env, T0 + 125_000)  // invite → prompt
  const acc = await G.acceptInvite(anton, r.prompt, T0 + 200_000)
  r = await G.receiveDoc(berta, acc.env, T0 + 205_000)            // accept → admission + welcome
  await G.receiveDoc(anton, r.outbound[0].env, T0 + 210_000)      // welcome
  assert.equal(anton.groups.get(g.genesisDigest)?.role, 'member', 'Anton is a member')
  assert.equal(berta.groups.get(g.genesisDigest).roster.size, 2, 'roster carries both')

  // continuity §6a: a re-encounter chains instead of duplicating
  await I.ceremony(anton, berta, T0 + 300_000)
  const newKey = [...anton.contacts.keys()].find((k) => k !== bKey)
  const outbound = await CN.buildProbe(anton, newKey)
  assert.ok(outbound.length >= 1, 'the probe travels sealed, chunked and padded')
  let chained = false
  const q = outbound.map((o) => [berta, o.env])
  while (q.length) {                              // Probe → Mapping → Gegenseite, bis der Draht schweigt
    const [to, env] = q.shift()
    const rc = await CN.receiveContinuity(to, env, T0 + 305_000)
    assert.equal(rc.handled, true, 'continuity handled')
    if (rc.chained) chained = true
    for (const o of rc.outbound ?? []) q.push([to === berta ? anton : berta, o.env])
  }
  assert.equal(chained, true, '§6a: the re-encounter CHAINS instead of duplicating')
})

test('probe — a transient seal failure never consumes the act (review 5)', async () => {
  const anton = I.createPerson('Anton')
  const berta = I.createPerson('Berta')
  await I.ceremony(anton, berta, T0)
  const bKey = [...anton.contacts.keys()][0]

  // setTrust: the one-way door only closes when the disclosure EXISTS
  await assert.rejects(() => T.setTrust(anton, bKey, T0 + 1000, { nonce: new Uint8Array(1) }), undefined, 'forced seal failure throws')
  assert.ok(!anton.contacts.get(bKey).trustGiven, 'the door is still open')
  const ok = await T.setTrust(anton, bKey, T0 + 2000)
  assert.ok(ok.env && anton.contacts.get(bKey).trustGiven, 'the retry succeeds and closes the door')

  // continuity: a failed mapping seal PERSISTS the obligation; the
  // retry path is the host's producing call — never a redelivery
  // (the freshness rule forbids chunk replays; review 6, B-3)
  await I.ceremony(anton, berta, T0 + 10_000)
  const newKeyA = [...anton.contacts.keys()].find((k) => k !== bKey)
  const outbound = await CN.buildProbe(anton, newKeyA)
  let due = null
  for (const o of outbound) {
    const r = await CN.receiveContinuity(berta, o.env, T0 + 11_000, { nonce: new Uint8Array(1) })
    assert.equal(r.handled, true, 'the effect completes despite the seal failure')
    if (r.outboundError) due = r
  }
  assert.ok(due, 'the failure is NAMED, not thrown')
  const bertaNewKey = [...berta.contacts.entries()].find(([, c]) => c.contMappingDue)?.[0]
  assert.ok(bertaNewKey, 'the obligation is PERSISTED on the tuple')
  // redelivery of the same chunk is now honestly a replay …
  const replay = await CN.receiveContinuity(berta, outbound[outbound.length - 1].env, T0 + 12_000)
  assert.ok(replay.duplicate || /replay/.test(replay.error ?? ''), 'redelivery is refused')
  // … and the producing call delivers what is owed
  const flushed = await CN.flushContinuity(berta, bertaNewKey, T0 + 13_000)
  assert.equal(flushed.outbound.length, 1, 'flushContinuity builds the owed mapping')
  assert.ok(!berta.contacts.get(bertaNewKey).contMappingDue, 'the obligation is cleared')
})

test('probe — concurrent setTrust: exactly one disclosure, distinct star salts', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B')
  await I.ceremony(a, b, T0)
  const k = [...a.contacts.keys()][0]
  const [r1, r2] = await Promise.all([T.setTrust(a, k, T0 + 1000), T.setTrust(a, k, T0 + 2000)])
  assert.equal([r1, r2].filter((r) => r.env).length, 1, 'the one-way door opens ONCE under concurrency')
  assert.ok([r1, r2].some((r) => r.error), 'the loser is refused by name')
  // and two concurrent star builds never share a salt
  const c = a.contacts.get(k)
  const [s1, s2] = await Promise.all([T.buildStar(a, c), T.buildStar(a, c)])
  assert.notEqual(s1.salt, s2.salt, 'sequence reservation is synchronous — no double salt')
})

test('probe — review-7 edges: latch survives bad input, delivery order, flush semantics', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B')
  await I.ceremony(a, b, T0)
  const k = [...a.contacts.keys()][0]
  // a throwing argument must not wedge the one-way door (B-1)
  await assert.rejects(() => T.setTrust(a, k, NaN), undefined, 'NaN time throws')
  const ok = await T.setTrust(a, k, T0 + 1000)
  assert.ok(ok.env, 'the latch was released — the retry succeeds')
  // ordered delivery: two concurrent builds commit in call order (B-2)
  const c = a.contacts.get(k)
  const [s1, s2] = await Promise.all([T.buildStar(a, c), T.buildStar(a, c)])
  assert.ok(Number(s2.salt) > Number(s1.salt), 'the lock serializes production')
  assert.equal(c.sentStar.salt, s2.salt, 'the journal holds the high-water star')
})

test('core — hidden own properties never collide with the bare twin (review 7, B-4)', async () => {
  const { jcs } = await import('../dist/index.js')
  const sim = await import('../../simulator/rltp-core.mjs')
  const o = { a: 1 }; Object.defineProperty(o, 'hidden', { value: 1 })
  const arr = [1]; Object.defineProperty(arr, 'hidden', { value: 1 })
  for (const [name, fn] of [['lib', jcs], ['sim', sim.jcs]]) {
    assert.throws(() => fn(o), undefined, `${name}: non-enumerable object property`)
    assert.throws(() => fn({ a: arr }), undefined, `${name}: non-enumerable array property`)
  }
})

test('probe — authenticated but malformed values never corrupt state or cache (review 9)', async () => {
  const anton = I.createPerson('Anton')
  const berta = I.createPerson('Berta')
  await I.ceremony(anton, berta, T0)
  const bKey = [...anton.contacts.keys()][0]
  const aKeyAtB = [...berta.contacts.keys()][0]
  const chan = berta.contacts.get(aKeyAtB).channel

  // a MAC-clean probe with probe:"NaN" must be malformed, not poison probeSeqIn
  const sealTo = async (body) => (await import('../dist/probe.js')).introduce // placeholder
  const kProbeDoc = { type: 'continuity-probe@1', probe: 'NaN', seq: '1', last: true, blinded: [] }
  // seal directly to Berta's channel context (the MAC will fail later than the form gate — the gate must win)
  const env = await (await import('../dist/index.js')).seal({ ...kProbeDoc, mac: 'x' }, chan.own.keyAgreement)
  const r = await CN.receiveContinuity(berta, env, T0 + 1000)
  assert.equal(r.error, 'malformed probe', 'NaN sequence dies at the form gate')
  assert.ok(berta.contacts.get(aKeyAtB).probeSeqIn === undefined, 'probeSeqIn untouched')

  // a signed star with non-integer salt / negative count is malformed, never stored
  const own = berta.contacts.get(aKeyAtB).channel.own
  const starDoc = {
    id: 'x', type: 'https://real-life.org/trust-tasks/trust-star@probe',
    issuer: own.anchor, recipient: aKeyAtB, issuedAt: '2026-08-29T12:00:00Z',
    payload: { star: { salt: 'not-an-int', count: -7, blinded: [7] } },
  }
  const C2 = await import('../dist/index.js')
  const signed = await C2.diSign(chan.own, starDoc, '2026-08-29T12:00:00Z')
  const env2 = await C2.seal(signed, anton.contacts.get(bKey).channel.own.keyAgreement)
  const r2 = await T.receiveTrustDoc(anton, env2, T0 + 2000)
  assert.equal(r2.error, 'malformed', 'value forms are bound before storage')
  assert.ok(!anton.contacts.get(bKey).starReceived, 'starReceived untouched')
})

test('probe — review-10 gaps: chunk form, voucher form, welcome digest', async () => {
  const C2 = await import('../dist/index.js')
  const anton = I.createPerson('Anton'), berta = I.createPerson('Berta')
  await I.ceremony(anton, berta, T0)
  const aKeyAtB = [...berta.contacts.keys()][0]
  const chan = berta.contacts.get(aKeyAtB).channel

  // a MAC-clean probe with 0 entries is malformed — the chunk form is FIXED at 256
  const env = await C2.seal({ type: 'continuity-probe@1', probe: '1', seq: '1', last: true, blinded: [], mac: 'x' }, chan.own.keyAgreement)
  const r = await CN.receiveContinuity(berta, env, T0 + 1000)
  assert.equal(r.error, 'malformed probe', 'empty blinded dies at the form gate')
  assert.equal(berta.contacts.get(aKeyAtB).probeSeqIn, undefined, 'no state, no cache effect')

  // an offer whose voucher is a number is malformed before the inbox
  const mediator = I.createPerson('Mira')
  await I.ceremony(mediator, anton, T0 + 2000)
  await I.ceremony(mediator, berta, T0 + 3000)
  const keyOf = (p, name) => [...p.contacts.entries()].find(([, c]) => c.name === name)[0]
  const intro = await I.introduce(mediator, keyOf(mediator, 'Anton'), keyOf(mediator, 'Berta'), T0 + 4000)
  const inboxBefore = anton.inbox.length
  const goodOffer = intro.offers[0]
  const openedGood = await C2.receive(goodOffer.env, (rk) => anton.contexts.get(rk)?.x.priv)
  const brokenOffer = { ...openedGood.document, voucherForCounterpart: 7 }
  const rkid = goodOffer.env.rkid
  const ka = anton.contexts.get(rkid).keyAgreement
  const badEnv = await C2.seal(brokenOffer, ka)
  const ro = await I.receiveOffer(anton, badEnv)
  assert.equal(ro.error, 'malformed offer', 'a numeric voucher never reaches the inbox')
  assert.equal(anton.inbox.length, inboxBefore, 'inbox unchanged')

  // a signed welcome with a garbage digest is a NAMED error and derives nothing
  const gBerta = await G.foundGroup(berta, 'W', T0 + 5000)
  const wBody = {
    id: 'w1', type: 'https://real-life.org/trust-tasks/membership-welcome@probe',
    issuer: gBerta.g?.myMemberCtx?.anchor ?? chan.own.anchor, recipient: 'did:key:z6MkX',
    threadId: 't', issuedAt: '2026-08-29T12:00:00Z',
    payload: { genesisDigest: 'not-a-digest', group: 'did:x', label: 'W', roster: [] },
  }
  const signedW = await C2.diSign(chan.own, wBody, '2026-08-29T12:00:00Z')
  const envW = await C2.seal(signedW, anton.contacts.get(keyOf(anton, 'Berta') ?? [...anton.contacts.keys()][0]).channel.own.keyAgreement)
  const ctxCountBefore = anton.contexts.size
  const rw = await G.receiveDoc(anton, envW, T0 + 6000)
  assert.ok(rw.error?.includes('malformed welcome') || rw.error?.includes('genesisDigest'), 'garbage digest is a named error: ' + rw.error)
  assert.equal(anton.contexts.size, ctxCountBefore, 'no context derived for group/null')
})
