#!/usr/bin/env node
// The ONE ceremony, executable: encounter-scan@0.25 with its connected and
// optical legs — under FRESH-ALWAYS pair contexts (Encounter 0.28 wire 0.25,
// spec 4.4): every enactment mints fresh pair anchors on both sides; the
// carrier switch (lost ack) stays WITHIN the one enactment. Run against the
// real engine.

import {
  createPerson, displayCard, sentCard, issueCredential, binding,
  bundleDocument, credentialDeliveryDocument, seal, receiveEnvelope,
  opticalInput, resolve, noteIssued, noteSent, edgeState,
  docDigest, PARAMS, CEREMONY, xPubOfMk,
} from './engine.mjs'

let now = Date.parse('2026-08-10T15:00:00Z')
const t = (label) => console.log(`\n─── ${label} ───`)
const assert = (cond, msg) => { if (!cond) { console.error(`✗ ASSERT: ${msg}`); process.exit(1) } console.log(`✓ ${msg}`) }
const sendTo = (card) => [card.keyAgreement, xPubOfMk(card.keyAgreement)]

// A scans B's displayed card and prepares the enactment (common trunk 1–3).
// C5 order: gate → RECORD → only then the credential (Encounter 5.5/7).
// fresh-always: the scanner's side of the tuple is s.ctx, minted here.
function scan(scanner, displayed, when) {
  const s = sentCard(scanner, displayed.anchor, displayed.challenge.value, when)
  const bind = binding(CEREMONY, displayed.challenge.value, s.challenge.value)
  scanner.records.set(s.challenge.value, { ceremony: CEREMONY, counterparty: displayed.anchor, card: displayed, own: s.challenge, ownCtx: s.ctx, other: displayed.challenge, binding: bind, time: when })
  scanner.open.delete(s.challenge.value)
  const cred = issueCredential(s.ctx, displayed.anchor, CEREMONY, displayed.challenge.value, bind, when)
  const bundle = bundleDocument(scanner, s.card, cred, bind, when)
  noteIssued(scanner, displayed.anchor, cred)
  noteSent(scanner, bundle)
  return { s, bind, cred, bundle }
}

const alice = createPerson('Alice')
const bob = createPerson('Bob')

// ════ Szenario 1: connected path (Netz da) ════
t('Szenario 1: encounter-scan, connected path — frische pair-Anker beidseitig')
const cardB = displayCard(bob, now)
const e1 = scan(alice, cardB, now)
assert(cardB.anchor !== e1.s.card.anchor, 'fresh-always: zwei frische, verschiedene pair-Anker')
const r1 = receiveEnvelope(bob, seal(e1.bundle, ...sendTo(cardB)), now += 5_000)
assert(r1.disposition === 'unique' && r1.via === 'record-creating', 'Bs Record + Accept + Ack in einer Transaktion (record-creating)')
receiveEnvelope(alice, seal(r1.ack, ...sendTo(e1.s.card)), now += 2_000)
assert(alice.senderStatus.get(docDigest(e1.bundle))?.status === 'delivered', 'A sieht delivered — Ladeanimation verschwindet')
const counter1 = issueCredential(r1.record.ownCtx, e1.s.ctx.anchor, CEREMONY, e1.s.challenge.value, e1.bind, now += 60_000)
noteIssued(bob, e1.s.ctx.anchor, counter1)
const r1c = receiveEnvelope(alice, seal(credentialDeliveryDocument(bob, counter1, e1.bundle.threadId, 'counter', now), ...sendTo(e1.s.card)), now += 3_000)
assert(r1c.acceptance === 'accepted', 'As Acceptance des Gegen-Credentials')
assert(edgeState(alice, cardB.anchor) === 'mutual' && edgeState(bob, e1.s.ctx.anchor) === 'mutual', 'beidseitig mutual (auf dem frischen Tupel)')

// ════ Szenario 2: Bundle kommt nicht durch → OPTISCHER LEG, EIN Enactment ════
t('Szenario 2: kein Ack → Carrier-Wechsel im SELBEN Enactment → später Bundle via Record')
const carol = createPerson('Carol')
const cardC = displayCard(carol, now)
const e2 = scan(alice, cardC, now)
now += PARAMS.ackWait + 1_000
assert(alice.senderStatus.get(docDigest(e2.bundle))?.status === 'accepted', 'A: kein Ack → optische Präsentation der Sent Card (kein neues Enactment)')
const o2 = opticalInput(carol, e2.s.card, now)
assert(o2.outcome === 'recorded', 'Carol: Record via optischem Scan — Enactment komplett')
assert(edgeState(carol, e2.s.ctx.anchor) === 'none', 'Carols Kante ist höchstens outgoing — mutual wird nie inferiert')
const o2again = opticalInput(carol, e2.s.card, now + 2_000)
assert(o2again.outcome === 'idempotent', 'Re-Scan → derselbe eine Record (idempotent)')
now += 2 * 3600_000
const r2 = receiveEnvelope(carol, seal(e2.bundle, ...sendTo(cardC)), now)
assert(r2.disposition === 'unique' && r2.via === 'record-aware', 'spätes Bundle via Record akzeptiert — nie consumed-challenge')
receiveEnvelope(alice, seal(r2.ack, ...sendTo(e2.s.card)), now += 2_000)
assert(alice.senderStatus.get(docDigest(e2.bundle))?.status === 'delivered', 'A: spätes Ack → delivered')
const counter2 = issueCredential(r2.record.ownCtx, e2.s.ctx.anchor, CEREMONY, e2.s.challenge.value, e2.bind, now += 30_000)
noteIssued(carol, e2.s.ctx.anchor, counter2)
const r2c = receiveEnvelope(alice, seal(credentialDeliveryDocument(carol, counter2, e2.bundle.threadId, 'counter', now), ...sendTo(e2.s.card)), now)
assert(r2c.acceptance === 'accepted', 'Gegen-Credential akzeptiert (Ausstellung zählt, Ankunft nie)')
assert(edgeState(alice, cardC.anchor) === 'mutual' && edgeState(carol, e2.s.ctx.anchor) === 'mutual', 'mutual — EIN Enactment, EINE Kante, kein E2')
assert(alice.records.size === 2 && carol.records.size === 1, 'genau ein Record pro Seite für Alice–Carol')

// ════ Szenario 3: gate-expired am optischen Leg → frisches Enactment ════
t('Szenario 3: Challenge gealtert → gate-expired → frisches Enactment')
const dave = createPerson('Dave')
const cardD = displayCard(dave, now)
const e3 = scan(alice, cardD, now)
now += PARAMS.challengeMaxAge + PARAMS.skew + 60_000
const o3 = opticalInput(dave, e3.s.card, now)
assert(o3.outcome === 'gate-expired', 'optischer Scan refused: gate-expired (Resolution: unknown, gelatcht)')
const backThen = now - PARAMS.challengeMaxAge - PARAMS.skew - 50_000
assert(resolve(dave, cardD.challenge.value, backThen).state === 'unknown', 'Rückwärts-Uhr: Wert bleibt unknown (monotoner Latch)')
const cardD2 = displayCard(dave, now)
const e3b = scan(alice, cardD2, now)
assert(cardD2.anchor !== cardD.anchor && e3b.s.ctx.anchor !== e3.s.ctx.anchor, 'fresh-always: das frische Enactment hat beidseitig FRISCHE Anker')
const r3 = receiveEnvelope(dave, seal(e3b.bundle, ...sendTo(cardD2)), now += 3_000)
assert(r3.disposition === 'unique', 'frisches Enactment läuft durch')
const counter3 = issueCredential(r3.record.ownCtx, e3b.s.ctx.anchor, CEREMONY, e3b.s.challenge.value, e3b.bind, now += 5_000)
noteIssued(dave, e3b.s.ctx.anchor, counter3)
receiveEnvelope(alice, seal(credentialDeliveryDocument(dave, counter3, e3b.bundle.threadId, 'counter', now), ...sendTo(e3b.s.card)), now)
assert(edgeState(alice, cardD2.anchor) === 'mutual', 'das zweite Enactment wird mutual (eigenes Tupel)')
assert(edgeState(alice, cardD.anchor) === 'outgoing', 'das verwaiste erste Tupel bleibt ehrlich einseitig — Ketten-Merge ist Stage B (Kontinuität, Visibility 6a)')
assert(alice.edges.size === 4, 'vier Tupel-Kanten (Bob, Carol, Dave×2) — Beziehungs-Merge folgt in Stage B')

// ════ Szenario 4: Vergiftungs-Versuch — Müll-Bundle verbrennt nichts ════
t('Szenario 4: Beobachter schickt Müll — validate, then consume')
const mallory = createPerson('Mallory')
const cardB2 = displayCard(bob, now)
const sM = sentCard(mallory, cardB2.anchor, cardB2.challenge.value, now)
const fakeBind = binding(CEREMONY, cardB2.challenge.value, sM.challenge.value)
const fakeCred = issueCredential(sM.ctx, cardB2.anchor, 'two-way-scan@0.9', cardB2.challenge.value, fakeBind, now) // falsches Label!
const rM = receiveEnvelope(bob, seal(bundleDocument(mallory, sM.card, fakeCred, fakeBind, now), ...sendTo(cardB2)), now)
assert(rM.disposition.startsWith('failed'), `Müll-Bundle abgelehnt: ${rM.disposition}`)
assert(resolve(bob, cardB2.challenge.value, now).state === 'open', 'Bs Challenge NICHT verbrannt — bleibt open, der echte Scanner kann noch')

console.log('\n════ Alle Szenarien bestanden — die EINE Zeremonie läuft unter fresh-always. ════')
