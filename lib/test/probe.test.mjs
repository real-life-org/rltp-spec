#!/usr/bin/env node
// The probe world, end to end through the BUILT package: ceremony →
// trust act → group over the channel → §6a continuity. This is the CI
// echo of the four simulator suites (the deep oracle with ~91 checks
// lives in simulator/*-test.mjs and runs against the same bodies).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { introduce as I, membership as G } from '../dist/probe.js'
import { visibility } from '../dist/index.js'
const { trust: T, continuity: CN } = visibility   // graduated 04.09.2026

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
  assert.equal(pkt.outbound.length, 2, 'trust act = anchor-mapping/0.1 + grade-declaration/0.1')
  const rt = await deliver(berta, pkt.outbound[0].env, T0 + 11_000)
  await deliver(berta, pkt.outbound[1].env, T0 + 11_500)
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
  const outbound = await CN.buildProbe(anton, newKey, T0 + 301_000)
  assert.ok(outbound.length >= 1, 'the probe travels sealed, chunked and padded')
  let chained = false
  const q = outbound.map((o) => [berta, o.env])
  while (q.length) {                              // Probe → Mapping → Gegenseite, bis der Draht schweigt
    const [to, env] = q.shift()
    // host dispatch: continuity first, trust (incl. V2 re-issue and acks) second
    let rc = await CN.receiveContinuity(to, env, T0 + 305_000)
    if (!rc.handled) rc = await T.receiveTrustDoc(to, env, T0 + 305_000)
    assert.equal(rc.handled, true, 'wire handled by some receiver')
    if (rc.chained) chained = true
    for (const o of rc.outbound ?? []) q.push([to === berta ? anton : berta, o.env])
    if (rc.ack) q.push([to === berta ? anton : berta, rc.ack.env])
  }
  assert.equal(chained, true, '§6a: the re-encounter CHAINS instead of duplicating')
  // V2 (5.5): Antons Entscheidung überlebte die Kettung — die Pflicht ist
  // eingelöst (Neuausstellung lief im Kettungs-Outbound mit)
  const headKey = [...anton.contacts.entries()].find(([, c]) => !c.deactivated)[0]
  assert.ok(!anton.contacts.get(headKey).trustReissueDue, 'the 5.5 re-issue duty is discharged')
  assert.ok(anton.contacts.get(headKey).trustGiven, 'the decision belongs to the relationship')
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
  const outbound = await CN.buildProbe(anton, newKeyA, T0 + 10_500)
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
  const [s1, s2] = await Promise.all([T.buildStar(a, c, T0), T.buildStar(a, c, T0)])
  assert.notEqual(s1.salt, s2.salt, 'sequence reservation is synchronous — no double salt')
})

test('probe — departure kills the departed strand\'s grade, the member survives (review 17)', async () => {
  const p = I.createPerson('P')
  // zwei Beziehungen, gleiche self → EIN verschmolzener Eintrag
  p.contacts.set('k1', { relId: 'r1' })
  p.contacts.set('k2', { relId: 'r2' })
  T.promotionCommit(p, 'r1', 'self-X', 'k1', 0)
  T.promotionCommit(p, 'r2', 'self-X', 'k2', 0)
  const a = p.admission
  const e = a.byRel.get('r1')
  ;(e.grades ??= new Map()).set('k1', { grade: 'count', order: (a.seq += 1n) })
  e.grades.set('k2', { grade: 'blinded', order: (a.seq += 1n) })   // jünger — bestimmt die effektive Grade
  assert.equal(T.viewOf(p, 10 ** 12)[0].grade, 'blinded', 'vor dem Departure wirkt der jüngere Strang')
  T.departMember(p, 'r2', 10)
  assert.equal(T.viewOf(p, 10 ** 12)[0].grade, 'count', 'der Grade-Strang der gegangenen Beziehung stirbt mit ihr')
  assert.equal(e.status, 'admitted', 'der Member bleibt admittiert, solange eine Beziehung lebt')
})

test('probe — Kettung stellt die zuletzt AUSGESTELLTE Grade neu aus, beide Reihenfolgen (review 27/28)', async () => {
  const dispatch = async (to, env, when) => { let r = await CN.receiveContinuity(to, env, when); if (!r.handled) r = await T.receiveTrustDoc(to, env, when); return r }
  const chain = async (a, b, nkA, nkB, when) => {
    const q = []
    for (const o of await CN.buildProbe(a, nkA, when)) q.push([b, o.env])
    for (const o of await CN.buildProbe(b, nkB, when)) q.push([a, o.env])
    for (let n = 0; q.length && n < 100; n++) { const [to, env] = q.shift(); const r = await dispatch(to, env, when + 1000); const other = to === a ? b : a; for (const o of r.outbound ?? []) q.push([other, o.env]); if (r.ack) q.push([other, r.ack.env]) }
  }
  // Fall 1: die LETZTE Ausstellung liegt auf dem ALTEN Kopf (count nach
  // dem Trust-Akt des frischen) — count muss die Kettung überleben
  {
    const a = I.createPerson('A'), b = I.createPerson('B')
    const c1 = await I.ceremony(a, b, T0)
    await T.setTrust(a, c1.ctxB.anchor, T0 + 1000)
    const c2 = await I.ceremony(a, b, T0 + 2000)
    await T.setTrust(a, c2.ctxB.anchor, T0 + 3000)
    await T.setGrade(a, c1.ctxB.anchor, 'count', T0 + 4000)
    await chain(a, b, c2.ctxB.anchor, c2.ctxA.anchor, T0 + 5000)
    const head = a.contacts.get(c2.ctxB.anchor)
    assert.equal(head.gradeOutLast, 'count', 'die zuletzt ausgestellte Grade (alter Kopf) gewinnt')
    assert.ok(!head.trustReissueDue, 'die V2-Pflicht ist per quittierter Neuausstellung eingelöst')
    assert.equal(b.contacts.get(c2.ctxA.anchor).gradeIn, 'count', 'die Gegenseite hält die richtige Neuausstellung')
  }
  // Fall 2 (Gegenprobe): die LETZTE Ausstellung liegt auf dem FRISCHEN
  // Kopf — sie bleibt
  {
    const a = I.createPerson('A'), b = I.createPerson('B')
    const c1 = await I.ceremony(a, b, T0)
    await T.setTrust(a, c1.ctxB.anchor, T0 + 1000)
    await T.setGrade(a, c1.ctxB.anchor, 'count', T0 + 2000)
    const c2 = await I.ceremony(a, b, T0 + 3000)
    await T.setTrust(a, c2.ctxB.anchor, T0 + 4000)   // blinded, DANACH ausgestellt
    await chain(a, b, c2.ctxB.anchor, c2.ctxA.anchor, T0 + 5000)
    const head = a.contacts.get(c2.ctxB.anchor)
    assert.equal(head.gradeOutLast, 'blinded', 'die jüngere Ausstellung des frischen Kopfs bleibt')
    assert.equal(b.contacts.get(c2.ctxA.anchor).gradeIn, 'blinded', 'die Gegenseite hält die frische Entscheidung')
  }
})

test('probe — ceremony.enactment: Stufe 7 (malformed) vor Stufe 8 (validation-failed) (review 29/30)', async () => {
  const { unseal, seal } = await import('../dist/index.js')
  const a = I.createPerson('A'), b = I.createPerson('B')
  await I.ceremony(a, b, T0)
  const bKey = [...a.contacts.keys()][0], aKey = [...b.contacts.keys()][0]
  const pkt = await T.setTrust(a, bKey, T0 + 1000)
  const bCtx = b.contacts.get(aKey).channel.own
  const opened = await unseal(pkt.outbound[0].env, bCtx.x.priv)
  const d1 = { ...structuredClone(opened.document), id: globalThis.crypto.randomUUID(), payload: {}, ceremony: { enactment: 'uEiAFrei' } }
  const r1 = await T.receiveTrustDoc(b, await seal(d1, bCtx.keyAgreement), T0 + 2000)
  assert.ok(r1.error?.includes('malformed'), 'Schrott-Payload + enactment → Stufe 7 zuerst: ' + r1.error)
  const d2 = { ...structuredClone(opened.document), id: globalThis.crypto.randomUUID(), ceremony: { enactment: 'uEiAFrei' } }
  const r2 = await T.receiveTrustDoc(b, await seal(d2, bCtx.keyAgreement), T0 + 3000)
  assert.ok(r2.error?.includes('validation-failed'), 'valide Payload + enactment → Stufe 8: ' + r2.error)
  assert.equal(r2.ack, undefined, 'kein Ack, kein Effekt')
  assert.ok(!b.contacts.get(aKey).trustReceived, 'die Disclosure wurde NICHT übernommen')
  // MATRIX über die weiteren Typen (Review 31): grade über den
  // trust-Dispatcher, probe über den continuity-Dispatcher (dessen
  // Gate ist gemeinsam für probe UND continuity-mapping)
  const gradeDoc = (await unseal(pkt.outbound[1].env, bCtx.x.priv)).document
  const gs = { ...structuredClone(gradeDoc), id: globalThis.crypto.randomUUID(), payload: {}, ceremony: { enactment: 'uEiAFrei' } }
  const rgs = await T.receiveTrustDoc(b, await seal(gs, bCtx.keyAgreement), T0 + 4000)
  assert.ok(rgs.error?.includes('malformed'), 'grade Schrott → Stufe 7: ' + rgs.error)
  const gv = { ...structuredClone(gradeDoc), id: globalThis.crypto.randomUUID(), ceremony: { enactment: 'uEiAFrei' } }
  const rgv = await T.receiveTrustDoc(b, await seal(gv, bCtx.keyAgreement), T0 + 5000)
  assert.ok(rgv.error?.includes('validation-failed'), 'grade valide + enactment → Stufe 8: ' + rgv.error)
  // probe über den continuity-Dispatcher
  const fresh = await I.ceremony(a, b, T0 + 10_000)
  const probes = await CN.buildProbe(a, fresh.ctxB.anchor, T0 + 11_000)
  const bCtx2 = b.contacts.get(fresh.ctxA.anchor).channel.own
  const probeDoc = (await unseal(probes[0].env, bCtx2.x.priv)).document
  const pv = { ...structuredClone(probeDoc), id: globalThis.crypto.randomUUID(), ceremony: { enactment: 'uEiAFrei' } }
  const rpv = await CN.receiveContinuity(b, await seal(pv, bCtx2.keyAgreement), T0 + 12_000)
  assert.ok(rpv.error?.includes('validation-failed'), 'probe valide + enactment → Stufe 8: ' + rpv.error)
  const ps = { ...structuredClone(probeDoc), id: globalThis.crypto.randomUUID(), payload: {}, ceremony: { enactment: 'uEiAFrei' } }
  const rps = await CN.receiveContinuity(b, await seal(ps, bCtx2.keyAgreement), T0 + 13_000)
  assert.ok(rps.error?.includes('malformed'), 'probe Schrott → Stufe 7: ' + rps.error)
  // Stufe 7 schlägt auch dann zuerst, wenn der SCHEMA-WIDRIGE Payload
  // ein kalender-widriges body.issuedAt trägt (Review 32, MAJOR)
  const mcal = { ...structuredClone(opened.document), id: globalThis.crypto.randomUUID(), payload: { body: { type: 'anchor-mapping@2', issuedAt: '2025-02-29T12:00:00Z' } } }
  const rmcal = await T.receiveTrustDoc(b, await seal(mcal, bCtx.keyAgreement), T0 + 14_000)
  assert.ok(rmcal.error?.includes('malformed'), 'mapping: Schrott + Kalender-Datum → malformed: ' + rmcal.error)
  const gcal = { ...structuredClone(gradeDoc), id: globalThis.crypto.randomUUID(), payload: { body: { type: 'grade-declaration@1', issuedAt: '2025-02-29T12:00:00Z' } } }
  const rgcal = await T.receiveTrustDoc(b, await seal(gcal, bCtx.keyAgreement), T0 + 15_000)
  assert.ok(rgcal.error?.includes('malformed'), 'grade: Schrott + Kalender-Datum → malformed: ' + rgcal.error)
  const cmcal = { ...structuredClone(probeDoc), id: globalThis.crypto.randomUUID(), type: 'https://real-life.org/trust-tasks/continuity-mapping/0.1', payload: { body: { type: 'continuity-mapping@1', issuedAt: '2025-02-29T12:00:00Z' } } }
  const rcmcal = await CN.receiveContinuity(b, await seal(cmcal, bCtx2.keyAgreement), T0 + 16_000)
  assert.ok(rcmcal.error?.includes('malformed'), 'continuity-mapping: Schrott + Kalender-Datum → malformed: ' + rcmcal.error)
  // issuer-Bindung ist Stufe 8: falscher wohlgeformter issuer +
  // Schrott-Payload → ZUERST malformed; mit validem Payload → issuer
  const wrongIssSchrott = { ...structuredClone(opened.document), id: globalThis.crypto.randomUUID(), issuer: gradeDoc.recipient, payload: {} }
  const rwis = await T.receiveTrustDoc(b, await seal(wrongIssSchrott, bCtx.keyAgreement), T0 + 17_000)
  assert.ok(rwis.error?.includes('malformed'), 'falscher issuer + Schrott → Stufe 7 zuerst: ' + rwis.error)
  const wrongIssValide = { ...structuredClone(opened.document), id: globalThis.crypto.randomUUID(), issuer: gradeDoc.recipient }
  const rwiv = await T.receiveTrustDoc(b, await seal(wrongIssValide, bCtx.keyAgreement), T0 + 18_000)
  assert.ok(rwiv.error?.includes('issuer'), 'falscher issuer + valide → Stufe 8 issuer: ' + rwiv.error)
})

test('probe — merge nimmt das NUMERISCHE admittedAt-Minimum (review 22/23)', async () => {
  const p = I.createPerson('P')
  p.contacts.set('k1', { relId: 'r1' })
  p.contacts.set('k2', { relId: 'r2' })
  T.promotionCommit(p, 'r1', 'self-A', 'k1', 10)   // String-Sort machte 9 > 10
  T.promotionCommit(p, 'r2', 'self-B', 'k2', 9)
  const e = T.promotionCommit(p, 'r1', 'self-B', 'k1', 20)   // self-Korrektur → Weg-2-Merge (mergeEntries)
  assert.equal(e.admittedAt, 9, 'das frühere Fenster (numerisch) überlebt den Merge')
  const boundary = 9 + T.GRADE_WAIT
  assert.equal(T.viewOf(p, boundary).length, 0, 'am Grenzzeitpunkt noch maskiert (strictly afterwards)')
  assert.equal(T.viewOf(p, boundary + 1)[0]?.grade, 'count', 'unmittelbar danach fail-closed count')
})

test('probe — vergiftetes Salt: Empfänger schweigt, Sender löst mit höherem Salt ab (review 21/22/23, e2e)', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B')
  await I.ceremony(a, b, T0)
  const bKey = [...a.contacts.keys()][0]
  const aKeyAtB = [...b.contacts.keys()][0]
  await T.setTrust(a, bKey, T0 + 1000)
  const r1 = await T.reconcile(a, bKey, T0 + 2000)
  const cB = b.contacts.get(aKeyAtB)
  // ECHTER Konflikt VOR der Completion (Review 24, MAJOR): eine
  // dissentierende offene Assembly desselben Salts → threadId/count-
  // Konflikt beim ersten Chunk → das Salt ist vergiftet
  cB.asm = { salt: r1.salt, threadId: 'andere-thread-id', count: '999', chunks: new Map(), lastSeq: undefined }
  const conflict = await T.receiveTrustDoc(b, r1.envs[0], T0 + 3000)
  assert.ok(conflict.error?.includes('assembly conflict'), 'Konflikt erkannt: ' + conflict.error)
  assert.ok(cB.starPoison?.has(r1.salt), 'das Salt ist vergiftet')
  // jeder weitere Chunk dieser Lieferung: verworfen, NIE geackt
  const again = await T.receiveTrustDoc(b, r1.envs[0], T0 + 4000)
  assert.ok(again.error?.includes('vergiftet'), 'vergifteter Chunk verworfen: ' + again.error)
  assert.equal(again.ack, undefined, 'kein Ack für die vergiftete Lieferung')
  // Sender: nächster Delivery-Kontakt liefert höheres Salt; Empfänger committet DIESES
  const r2 = await T.reconcile(a, bKey, T0 + 5000)
  assert.ok(r2?.salt && BigInt(r2.salt) > BigInt(r1.salt), 'frisches, höheres Salt')
  const rStar = await T.receiveTrustDoc(b, r2.envs[0], T0 + 6000)
  assert.ok(rStar.star, 'der Empfänger committet die frische Zustellung')
  await T.receiveTrustDoc(a, rStar.ack.env, T0 + 7000)
  assert.ok(a.contacts.get(bKey).sub.baseline, 'Completion nur über den committeten Stand')
  assert.ok(!cB.starPoison?.has(r1.salt), 'das Gift ist am High-Water gepruned')
})

test('probe — Continuity-Mapping-Resend ist BYTE-IDENTISCH (review 23, Regressionsschutz)', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B')
  await I.ceremony(a, b, T0)
  const fresh = await I.ceremony(a, b, T0 + 1000)
  const nonRec = fresh.ctxA.anchor < fresh.ctxB.anchor ? b : a
  const key = nonRec === a ? fresh.ctxB.anchor : fresh.ctxA.anchor
  // Match-Report erzeugen (Probe der Gegenseite empfangen)
  const other = nonRec === a ? b : a
  const otherKey = other === a ? fresh.ctxB.anchor : fresh.ctxA.anchor
  for (const o of await CN.buildProbe(other, otherKey, T0 + 2000)) await CN.receiveContinuity(nonRec, o.env, T0 + 3000)
  const f1 = await CN.flushContinuity(nonRec, key, T0 + 4000)
  const f2 = await CN.flushContinuity(nonRec, key, T0 + 5000)
  const m1 = f1.outbound.filter((o) => o.kind.startsWith('continuity-mapping')).map((o) => JSON.stringify(o.env))
  const m2 = f2.outbound.filter((o) => o.kind.startsWith('continuity-mapping')).map((o) => JSON.stringify(o.env))
  if (m1.length && m2.length) assert.deepEqual(m2, m1, 'derselbe Envelope reist erneut — Byte für Byte')
  assert.ok(m1.length + m2.length > 0, 'ein Mapping wurde erzeugt/wiederholt')
})

test('probe — reconcile prägt an jedem Delivery-Kontakt ein frisches, höheres Salt (review 17/23)', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B')
  await I.ceremony(a, b, T0)
  const k = [...a.contacts.keys()][0]
  await T.setTrust(a, k, T0 + 1000)
  const c = a.contacts.get(k)
  const r1 = await T.reconcile(a, k, T0 + 2000)          // Salt 1 in flight (leere Sicht der Gegenseite? — eigene Sicht)
  assert.ok(r1?.salt, 'erste Zustellung produziert')
  // ein HÖHERES Salt mit ANDERER Sicht in flight simulieren: das
  // niedrigere Salt darf nie wiederholt werden — es kommt frisch und höher
  c.sub.inFlight.set('999', { view: [{ member: 'x', grade: 'count' }], pending: new Map([['d', { env: 'E' }]]), threadId: 't' })
  c.starSeqNext = '999'   // real stammt jedes in-flight-Salt aus dem monotonen Zähler
  const r2 = await T.reconcile(a, k, T0 + 3000)
  assert.notEqual(r2?.retry, r1.salt, 'das verdrängbare niedrige Salt wird nicht wiederholt')
  if (r2?.salt) assert.ok(BigInt(r2.salt) > 999n, 'eine frische Zustellung trägt ein höheres Salt')
})

test('probe — deactivation DURING buildStar: no artifact leaves the dead tuple (review 10)', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B')
  await I.ceremony(a, b, T0)
  const c = a.contacts.get([...a.contacts.keys()][0])
  const pending = T.buildStar(a, c, T0)
  queueMicrotask(() => { c.deactivated = true })   // die Kettung eines ANDEREN Kontakts, mitten in den MAC-Awaits
  assert.equal(await pending, null, 'deactivated tuples issue nothing — auch nicht aus einem laufenden Bau')
})

test('probe — review-7 edges: latch survives bad input, delivery order, flush semantics', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B')
  await I.ceremony(a, b, T0)
  const k = [...a.contacts.keys()][0]
  // a throwing argument must not wedge the one-way door (B-1)
  await assert.rejects(() => T.setTrust(a, k, NaN), undefined, 'NaN time throws')
  const ok = await T.setTrust(a, k, T0 + 1000)
  assert.ok(ok.env, 'the latch was released — the retry succeeds')
  // ordered delivery: two concurrent builds never share a salt (B-2);
  // the BASELINE no longer advances at production — completion is the
  // deniable ack (5.4 automaton), so after production it stays absent
  const c = a.contacts.get(k)
  const [s1, s2] = await Promise.all([T.buildStar(a, c, T0), T.buildStar(a, c, T0)])
  assert.ok(Number(s2.salt) > Number(s1.salt), 'the lock serializes production')
  assert.equal(c.sub?.baseline ?? null, null, 'no completion without an ack — the baseline stays absent')
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
  const hull = (payload) => ({ id: '7b1c9c1e-4d5a-4a4a-9d5e-0000000000b1', type: 'https://real-life.org/trust-tasks/continuity-probe/0.1', issuer: aKeyAtB, recipient: chan.own.anchor, threadId: '7b1c9c1e-4d5a-4a4a-9d5e-0000000000b2', issuedAt: '2026-08-29T12:00:00Z', payload })
  const kProbeDoc = { body: { type: 'continuity-probe@1', probe: 'NaN', seq: '1', last: true, blinded: [] }, proof: { mac: 'ux' } }
  // seal directly to Berta's channel context (the MAC will fail later than the form gate — the gate must win)
  const env = await (await import('../dist/index.js')).seal(hull(kProbeDoc), chan.own.keyAgreement)
  const r = await CN.receiveContinuity(berta, env, T0 + 1000)
  assert.equal(r.error, 'malformed probe', 'NaN sequence dies at the form gate')
  assert.ok(berta.contacts.get(aKeyAtB).probeSeqIn === undefined, 'probeSeqIn untouched')

  // ein star/0.1-Dokument mit formwidrigem Payload (non-int salt,
  // negativer count) stirbt am SCHEMA-Gate, nie im Zustand
  const own = berta.contacts.get(aKeyAtB).channel.own
  const starDoc = {
    id: '7b1c9c1e-4d5a-4a4a-9d5e-0000000000aa',
    type: 'https://real-life.org/trust-tasks/star/0.1',
    issuer: own.anchor, recipient: aKeyAtB,
    threadId: '7b1c9c1e-4d5a-4a4a-9d5e-0000000000ab',
    issuedAt: '2026-08-29T12:00:00Z',
    payload: { body: { type: 'star@1', salt: 'not-an-int', seq: '1', last: true, count: '-7', blinded: [] }, proof: { mac: 'u' + 'A'.repeat(43) } },
  }
  const C2 = await import('../dist/index.js')
  const env2 = await C2.seal(starDoc, anton.contacts.get(bKey).channel.own.keyAgreement)
  const r2 = await T.receiveTrustDoc(anton, env2, T0 + 2000)
  assert.equal(r2.error, 'malformed star', 'value forms are bound before storage (schema gate)')
  assert.ok(!anton.contacts.get(bKey).starReceived, 'starReceived untouched')
})

test('probe — review-10 gaps: chunk form, voucher form, welcome digest', async () => {
  const C2 = await import('../dist/index.js')
  const anton = I.createPerson('Anton'), berta = I.createPerson('Berta')
  await I.ceremony(anton, berta, T0)
  const aKeyAtB = [...berta.contacts.keys()][0]
  const chan = berta.contacts.get(aKeyAtB).channel

  // a MAC-clean probe with 0 entries is malformed — the chunk form is FIXED at 256
  const env = await C2.seal({ id: '7b1c9c1e-4d5a-4a4a-9d5e-0000000000c1', type: 'https://real-life.org/trust-tasks/continuity-probe/0.1', issuer: aKeyAtB, recipient: chan.own.anchor, threadId: '7b1c9c1e-4d5a-4a4a-9d5e-0000000000c2', issuedAt: '2026-08-29T12:00:00Z', payload: { body: { type: 'continuity-probe@1', probe: '1', seq: '1', last: true, blinded: [] }, proof: { mac: 'ux' } } }, chan.own.keyAgreement)
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

test('probe 0.29 — reconciliation: ack advances the baseline, no ack keeps the divergence', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B'), c = I.createPerson('C')
  await I.ceremony(a, b, T0)
  await I.ceremony(a, c, T0 + 1000)
  const bKey = [...a.contacts.keys()][0]
  // Zustell-Helfer: Doc hin, Ack zurück (Delivery 4.2)
  const roundtrip = async (from, to, env, when) => {
    const r = await T.receiveTrustDoc(to, env, when)
    assert.ok(r.handled && !r.error, 'doc handled')
    if (r.ack) await T.receiveTrustDoc(from, r.ack.env, when)
    return r
  }
  // B vertraut A → A admittiert B (Promotion + Grade in zwei Dokumenten)
  const dB = await T.setTrust(b, [...b.contacts.keys()][0], T0 + 10_000)
  for (const o of dB.outbound) await roundtrip(b, a, o.env, T0 + 11_000)
  // A vertraut B → Subskription; reconcile liefert den initialen Stern
  const dA = await T.setTrust(a, bKey, T0 + 12_000)
  for (const o of dA.outbound) await roundtrip(a, b, o.env, T0 + 13_000)
  const r1 = await T.reconcile(a, bKey, T0 + 14_000)
  assert.ok(r1 && r1.envs.length === 1, 'formation: absent baseline diverges by definition')
  const sub = a.contacts.get(bKey).sub
  assert.equal(sub.baseline, null, 'before the ack: absent')
  const rStar = await T.receiveTrustDoc(b, r1.envs[0], T0 + 15_000)
  assert.ok(rStar.star, 'star assembly completed')
  const rAck = await T.receiveTrustDoc(a, rStar.ack.env, T0 + 16_000)
  assert.equal(rAck.completed, r1.salt, 'completion(salt) — the deniable ack')
  assert.ok(sub.baseline, 'baseline holds the delivered view')
  assert.equal(await T.reconcile(a, bKey, T0 + 17_000), null, 'no divergence, no delivery (5.4)')
  // Bestand wächst: C vertraut A → Divergenz → Lieferung; ohne Ack
  // bleibt sie stehen — jeder weitere Kontakt liefert frisch und höher (5.4)
  const dC = await T.setTrust(c, [...c.contacts.keys()][0], T0 + 20_000)
  for (const o of dC.outbound) await roundtrip(c, a, o.env, T0 + 21_000)
  // der interne Sweep des Empfangs hat die Divergenz ggf. schon
  // produziert — reconcile prägt dann bereits das nächste höhere Salt
  const r2 = await T.reconcile(a, bKey, T0 + 22_000)
  assert.ok(r2?.salt, 'divergence → delivery owed')
  // 5.4 wörtlich (Review 23): JEDER weitere Delivery-Kontakt liefert
  // unter frischem, HÖHEREM Salt — kein Same-View-Retry; so überlebt
  // der Sender auch ein beim Empfänger vergiftetes Salt, ohne es zu
  // kennen (Salts sind ausdrücklich nicht dicht)
  const r3 = await T.reconcile(a, bKey, T0 + 23_000)
  assert.ok(r3.salt && !r3.retry, 'der nächste Delivery-Kontakt liefert unter frischem, höherem Salt (5.4)')
  assert.ok(BigInt(r3.salt) > BigInt(r2.salt), 'strikt höher')
  const rStar2 = await T.receiveTrustDoc(b, r3.envs[0], T0 + 24_000)
  await T.receiveTrustDoc(a, rStar2.ack.env, T0 + 25_000)
  assert.ok(sub.highWater >= 2n, 'automaton advanced')
  assert.equal(await T.reconcile(a, bKey, T0 + 26_000), null, 'converged again')
})

test('probe 0.29 — receiver monotonicity, duplicate re-ack, admission dedup', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B')
  await I.ceremony(a, b, T0)
  const bKey = [...a.contacts.keys()][0]
  const aKey = [...b.contacts.keys()][0]
  const d = await T.setTrust(a, bKey, T0 + 1000)
  const r1 = await T.receiveTrustDoc(b, d.outbound[0].env, T0 + 2000)
  assert.ok(r1.handled && !r1.error && r1.ack)
  // vor der Grade-Declaration ist die Admission PROVISORISCH maskiert
  // (5.4 grade-wait): nicht in der Sicht — und nach der Declaration blinded
  const self = (await T.communityContext(a)).anchor
  assert.equal(T.viewOf(b, T0 + 3000).length, 0, 'provisional admission is masked')
  assert.equal(T.viewOf(b, T0 + 3000 + 86_400_000).find((v) => v.member === self)?.grade, 'count', 'after grade-wait: fail-closed count')
  await T.receiveTrustDoc(b, d.outbound[1].env, T0 + 3500)
  assert.equal(T.viewOf(b, T0 + 4000).find((v) => v.member === self)?.grade, 'blinded', 'declaration lifts the mask to blinded')
  // byte-identische Redelivery → duplicate-known + BYTE-IDENTISCHER Re-Ack (4.2)
  const r1again = await T.receiveTrustDoc(b, d.outbound[0].env, T0 + 3000)
  assert.ok(r1again.duplicate, 'duplicate-known')
  assert.ok(r1again.ack, 'the stored ack is re-sent')
  // Admission: dieselbe self über eine zweite Beziehung = EIN Eintrag (Weg-2-Merge)
  T.promotionCommit(b, 'rel-zwei', self, 'kontakt-zwei', T0)
  assert.equal(T.viewOf(b, T0 + 4000).filter((v) => v.member === self).length, 1, 'one entry per member — strands are aliases')
  assert.equal(b.contacts.get(aKey).mapRevIn, '1', 'mapping revision tracked per tuple')
})

test('probe 0.29 — admission bound: pending, k−1 admit on departure and merge', async () => {
  const b = I.createPerson('B')
  b.admissionBound = 2n   // Mechanik-Test: der Spec-Bound ist unerreichbar, die Regel identisch
  T.promotionCommit(b, 'r1', 'self-1', 'k1', 0)
  T.promotionCommit(b, 'r2', 'self-2', 'k2', 0)
  const e3 = T.promotionCommit(b, 'r3', 'self-3', 'k3', 0)
  assert.equal(e3.status, 'pending', 'am Bound: deliverable-pending, triggert nichts')
  assert.equal(T.viewOf(b, 0).length, 0, 'frisch admittiert = provisorisch maskiert (grade-wait)')
  const v = T.viewOf(b, 86_400_001)
  assert.equal(v.length, 2, 'nach grade-wait: die admittierten als count')
  assert.ok(!v.some((x) => x.member === 'self-3'), 'deliverable-pending nie in der Sicht')
  // Departure räumt den Slot → der älteste Pending admittiert (k−1-Ordnung)
  T.departMember(b, 'r1', 10)
  assert.equal(e3.status, 'admitted', 'departure admits the next pending in commit order')
  // Weg-2-Merge zweier admitted → ein Slot frei → nichts mehr pending
  T.promotionCommit(b, 'r2', 'self-3', 'k2', 20)   // self-Korrektur auf fremde self = Merge
  const entries = new Set([...(b.admission.byRel.values())])
  assert.equal(entries.size, 1, 'merge: one entry, earliest position, aliases')
})

test('probe — späte Record-Probe nach verifizierter Wahl erzeugt KEINEN Match-Report; kein Endlos-Retry (6a.3, Gesamtsimulator 06.09.)', async () => {
  const a = I.createPerson('A'), b = I.createPerson('B')
  await I.ceremony(a, b, T0)
  const fresh = await I.ceremony(a, b, T0 + 1000)
  const rec = fresh.ctxA.anchor < fresh.ctxB.anchor ? a : b
  const nonRec = rec === a ? b : a
  const recKey = rec === a ? fresh.ctxB.anchor : fresh.ctxA.anchor       // recs Schlüssel für nonRec
  const nonRecKey = rec === a ? fresh.ctxA.anchor : fresh.ctxB.anchor    // nonRecs Schlüssel für rec
  const both = async (to, env, when) => { let r = await CN.receiveContinuity(to, env, when); if (!r.handled) r = await T.receiveTrustDoc(to, env, when); assert.ok(r.handled); return r }
  // 1. nonRec probt, rec wählt → Choice-Mapping → nonRec kettet + Alignment
  let recOut = []
  for (const o of await CN.buildProbe(nonRec, nonRecKey, T0 + 2000)) { const r = await both(rec, o.env, T0 + 3000); recOut.push(...(r.outbound ?? [])) }
  const choice = recOut.find((o) => o.kind.startsWith('continuity-mapping'))
  assert.ok(choice, 'rec wählt auf die Probe')
  const rn = await both(nonRec, choice.env, T0 + 4000)
  assert.equal(rn.chained, true, 'nonRec kettet auf die Record-Wahl')
  const align = (rn.outbound ?? []).find((o) => o.kind.startsWith('continuity-mapping'))
  assert.ok(align, 'nonRec stellt das Alignment aus')
  const ra = await both(rec, align.env, T0 + 5000)
  if (ra.ack) await both(nonRec, ra.ack.env, T0 + 5500)   // Alignment quittiert → Pflicht tot
  // 2. recs EIGENE Probe kommt spät (beide Seiten proben, 6a.4 „whichever probe was lost")
  let late = []
  for (const o of await CN.buildProbe(rec, recKey, T0 + 6000)) { const r = await both(nonRec, o.env, T0 + 7000); late.push(...(r.outbound ?? [])) }
  assert.equal(late.filter((o) => o.kind.startsWith('continuity-mapping')).length, 0, 'kein Match-Report nach verifizierter Record-Wahl (stale counter-claim MUST NOT be sent)')
  // 3. kein Flush sendet auf diesem Tupel noch ein Mapping — sonst Endlos-Retry
  for (const when of [T0 + 8000, T0 + 9000, T0 + 10_000]) {
    const f = await CN.flushContinuity(nonRec, nonRecKey, when)
    assert.equal((f.outbound ?? []).filter((o) => o.kind.startsWith('continuity-mapping')).length, 0, 'Flush ' + when + ': kein Mapping-Retry')
  }
})
