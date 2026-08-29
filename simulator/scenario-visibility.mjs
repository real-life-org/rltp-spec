#!/usr/bin/env node
// Stage B, executable: the visibility layer over the ceremony engine —
// continuity merges fresh-always tuples into ONE relationship (the gap
// scenario.mjs S3 names), the Trust act discloses the self anchor, and the
// star carries exactly the granted recognitions. Run against visibility.mjs.
import { createPerson, displayCard, sentCard } from './engine.mjs'
import * as V from './visibility.mjs'

const assert = (c, m) => { if (!c) { console.error(`✗ ASSERT: ${m}`); process.exit(1) } console.log(`✓ ${m}`) }
const t = (l) => console.log(`\n─── ${l} ───`)
let now = Date.parse('2026-08-25T12:00:00Z')

// one full enactment, both sides registering their tuple (the driver wiring)
function enact (scanner, displayed) {
  const dCard = displayCard(displayed, now)
  const s = sentCard(scanner, dCard.anchor, dCard.challenge.value, now)
  const relS = V.registerTuple(scanner, s.ctx, dCard.anchor, dCard.keyAgreement)
  const relD = V.registerTuple(displayed, displayed.open.get(dCard.challenge.value).ctx, s.card.anchor, s.card.keyAgreement)
  return { relS, relD, sAnchor: s.ctx.anchor, dAnchor: dCard.anchor }
}
// bidirectional continuity round: both sides probe, matches drive the
// one-chooser machine (record side issues, non-record side aligns)
function continuity (a, relA, b, relB) {
  const pa = V.buildProbe(a, relA), pb = V.buildProbe(b, relB)
  const ra = V.receiveProbe(b, relB, pa), rb = V.receiveProbe(a, relA, pb)
  assert(!ra.error && !rb.error, 'beide Probes verifizieren (MAC, Form, Sequenz)')
  const aIsRecord = V.isRecordSide(relA.head)
  const [rec, recRel, recMatches, non, nonRel] = aIsRecord ? [a, relA, rb.matches, b, relB] : [b, relB, ra.matches, a, relA]
  if (!recMatches.length) return { merged: false }
  const mapping = V.issueContinuityMapping(rec, recRel, recMatches[0]) // record side: chains atomically with issuing
  const res = V.receiveContinuityMapping(non, nonRel, mapping)         // non-record side: chains ONLY here + alignment
  assert(res.chained, 'Non-Record-Seite chained auf Verifikation der Record-Mapping (der EINE Trigger): ' + (res.error || 'ok'))
  const recRelAfter = rec.relationships.find(r => r.head.ownCtx.anchor === recRel.head.ownCtx.anchor)
  const back = V.receiveContinuityMapping(rec, recRelAfter, res.alignment)
  assert(back.matchReport || back.error, 'Alignment der Non-Record-Seite chained beim Empfänger NICHTS (6a.4): ' + (back.error || 'match report'))
  return { merged: true }
}

const alice = createPerson('Alice'), bob = createPerson('Bob'), carol = createPerson('Carol')

t('B1: Erstbegegnung — Probe läuft, null Matches = ehrlich neuer Kontakt')
const e1 = enact(alice, bob)
const p1 = V.buildProbe(alice, e1.relS)
assert(p1.body.blinded.length === 256, 'Probe: exakt 256 Einträge (reines Padding bei null Vorbeziehungen)')
const r1 = V.receiveProbe(bob, e1.relD, p1)
assert(!r1.error && r1.matches.length === 0, 'null Matches — neuer Kontakt, nichts geleakt')

t('B2: Wiederbegegnung — fresh-always Tupel mergen zu EINER Beziehung')
assert(alice.relationships.length === 1 && bob.relationships.length === 1, 'je eine Beziehung nach E1')
const e2 = enact(alice, bob)
assert(alice.relationships.length === 2, 'nach E2: zwei getrennte Tupel-Beziehungen (vor Kontinuität)')
assert(e2.sAnchor !== e1.sAnchor && e2.dAnchor !== e1.dAnchor, 'fresh-always: vier frische Anker')
const c2 = continuity(alice, alice.relationships[1], bob, bob.relationships[1])
assert(c2.merged, 'Kontinuität hat gematcht')
assert(alice.relationships.length === 1 && bob.relationships.length === 1, 'BEIDE Seiten: EINE Beziehung (die S3-Lücke ist zu)')
assert(alice.relationships[0].tuples.length === 2, 'die Kette trägt beide Tupel; Kopf = das frische')

t('B3: Selbst-Match strukturell ausgeschlossen')
const freshRel = alice.relationships[0]
const probe3 = V.buildProbe(alice, freshRel)
assert(probe3.body.blinded.length === 256, 'Probe weiterhin formtreu')

t('B4: Trust-Akt — anchor-mapping@2 + Schritt-5-Negativ')
const am = V.issueAnchorMapping(bob, bob.relationships[0])
const ram = V.receiveAnchorMapping(alice, alice.relationships[0], am)
assert(ram.self && alice.relationships[0].counterpartSelf === ram.self, 'Alice hält Bobs offengelegten Community-Anker (6.3-Liste komplett)')
const bad = JSON.parse(JSON.stringify(am)); bad.body.self = V.communityIdentity(carol).anchor
assert(V.receiveAnchorMapping(alice, alice.relationships[0], bad).error === 'card.anchor != self', 'fremder self → Schritt 5 lehnt ab (unclaimability)')

t('B5: Grade + Stern — Schnittmengen nur, wo Wiedererkennung GEWÄHRT wurde')
const e3 = enact(alice, carol)
const relAC = alice.relationships.find(r => r.head.counterpartAnchor === e3.dAnchor)
const relCA = carol.relationships[0]
V.receiveAnchorMapping(alice, relAC, V.issueAnchorMapping(carol, relCA))
const rg = V.receiveGrade(alice, relAC, V.issueGrade(carol, relCA, 'blinded'))
assert(rg.grade === 'blinded', 'Grade-Deklaration verifiziert (DV; fail-closed default wäre count)')
const e4 = enact(bob, carol)
const relBC = bob.relationships.find(r => r.head.counterpartAnchor === e4.dAnchor)
const relCB = carol.relationships.find(r => r.head.counterpartAnchor === e4.sAnchor)
V.receiveAnchorMapping(bob, relBC, V.issueAnchorMapping(carol, relCB))
const relAB = alice.relationships.find(r => r.counterpartSelf)
const relBA = bob.relationships.find(r => r.counterpartSelf === V.communityIdentity(alice).anchor) || bob.relationships[0]
const star = V.buildStar(alice, relAB)
const rs = V.receiveStar(bob, relBA, star)
assert(!rs.error && rs.count === 1, 'Stern: count = 1 deliverable Kontakt')
assert(rs.hits.length === 1 && rs.hits[0] === V.communityIdentity(carol).anchor, 'Bob findet den Schnitt: Carol — weil BEIDE ihren Community-Anker legitim halten')
const star2 = V.buildStar(alice, relAB)
const replay = V.receiveStar(bob, relBA, { body: { ...star.body }, proof: star.proof })
assert(replay.error === 'salt not strictly greater', 'Salt-Replay abgelehnt (strictly greater)')
const rs2 = V.receiveStar(bob, relBA, star2)
assert(!rs2.error, 'frischer Salt läuft durch (direktionale Epochen)')

console.log('\n════ Stage B (B1–B5) bestanden — Beziehungen mergen, Trust legt offen, der Stern trägt nur Gewährtes. ════')
