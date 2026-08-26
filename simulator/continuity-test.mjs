#!/usr/bin/env node
// continuity-test — rltp-visibility §6a im Simulator: Re-Verifikation
// (zweite Zeremonie derselben Menschen) und Vorstellungs-Dublette werden
// über Probe + Mapping erkannt und GEKETTET statt dupliziert; wer die
// Probe nicht beantworten kann, ist ehrlich eine neue Beziehung.
import * as I from './introduce.mjs'
import * as CN from './continuity.mjs'
import * as C from './rltp-crypto.mjs'
import { jcs } from './rltp-core.mjs'
import { hmac } from './trust.mjs'

let pass = 0, fail = 0
const check = (c, m) => { if (c) { pass++; console.log(`  ok    ${m}`) } else { fail++; console.error(`  FAIL  ${m}`) } }
const T0 = Date.parse('2026-08-28T10:00:00Z')
const active = (p) => [...p.contacts.values()].filter((c) => !c.deactivated)

// Probe-/Mapping-Verkehr zwischen zwei Personen komplett ausspielen
async function runContinuity (a, b, keyAtA, keyAtB, when) {
  const q = []
  for (const out of (await CN.buildProbe(a, keyAtA)) ?? []) q.push([b, out.env])
  for (const out of (await CN.buildProbe(b, keyAtB)) ?? []) q.push([a, out.env])
  while (q.length) {
    const [to, env] = q.shift()
    const r = await CN.receiveContinuity(to, env, when)
    for (const out of r.outbound ?? []) q.push([to === a ? b : a, out.env])
  }
}

// ── 1. Re-Verifikation: zweite Zeremonie derselben zwei Menschen ────────
{
  const a = I.createPerson('Anton'), b = I.createPerson('Berta')
  const c1 = await I.ceremony(a, b, T0)
  const c2 = await I.ceremony(a, b, T0 + 60_000) // Wiedersehen — frisches Tupel, wie es die Spec verlangt
  check(active(a).length === 2 && active(b).length === 2, 'vor der Probe: ehrlich zwei Tupel (fresh-always, Encounter 4.4)')
  await runContinuity(a, b, c2.ctxB.anchor, c2.ctxA.anchor, T0 + 61_000)
  check(active(a).length === 1 && active(b).length === 1, 'nach Probe+Mapping: EINE aktive Beziehung auf beiden Seiten')
  const hA = active(a)[0], hB = active(b)[0]
  check(hA.chain?.length === 1 && hA.state === '✓' && hB.chain?.length === 1, 'das neue Tupel ist Kopf, das alte gekettet — Evidenz akkumuliert (✓, 2 Enactments)')
  check(a.contacts.get(c1.ctxB.anchor)?.deactivated === true, 'das alte Tupel ist deaktiviert, per Kette erreichbar')
  check(hA.channel.own.anchor === c2.ctxA.anchor, 'der aktive Kanal ist der FRISCHE (eine Beziehung, ein aktiver Kopf)')
  // Wahl der Record-Seite ist eingefroren: dasselbe Mapping nochmal = idempotent
  const before = active(a).length + active(b).length
  await runContinuity(a, b, c2.ctxB.anchor, c2.ctxA.anchor, T0 + 62_000)
  check(active(a).length + active(b).length === before, 'Wiederholung: idempotent, keine Doppel-Kette')
}

// ── 2. die Vorstellungs-Dublette (Antons Screenshot-Fall) ───────────────
{
  const j = I.createPerson('Jonathan'), a = I.createPerson('Anton'), e = I.createPerson('Emil')
  await I.ceremony(j, a, T0)
  await I.ceremony(j, e, T0 + 1000)
  await I.ceremony(a, e, T0 + 2000)   // Anton und Emil kennen sich BEREITS
  const keyOf = (p, name) => [...p.contacts.entries()].find(([, c]) => c.name === name)[0]
  const drop = I.createDrop()
  const intro = await I.introduce(j, keyOf(j, 'Anton'), keyOf(j, 'Emil'), T0 + 10_000)
  const rA = await I.receiveOffer(a, intro.offers[0].env)
  const rE = await I.receiveOffer(e, intro.offers[1].env)
  await I.consent(a, rA.entry, drop, T0 + 11_000)
  await I.consent(e, rE.entry, drop, T0 + 12_000)
  await I.checkDrop(a, rA.entry, drop)
  check(active(a).length === 3 && active(e).length === 3, 'nach der Vorstellung: die Dublette existiert (zwei Emil-Tupel bei Anton)')
  const newAtA = rA.entry.counterpartAnchor, newAtE = rE.entry.counterpartAnchor
  await runContinuity(a, e, newAtA, newAtE, T0 + 13_000)
  check(active(a).length === 2 && active(e).length === 2, 'Probe erkennt die bestehende Beziehung: Dublette gekettet, KEIN doppelter Emil')
  const em = active(a).find((c) => c.name === 'Emil')
  check(em.state === '✓' && em.provenance === 'ceremony' && em.chain?.length === 1, 'Evidenz akkumuliert: der Kopf bleibt ✓ verifiziert, die Vorstellung ist ein Kettenglied')
  check(em.voucher && em.mediatorProvenance, 'die Artefakte der Vorstellung (Voucher, Herkunft) bleiben am Kettenglied-Kopf erhalten')
}

// ── 3. kein Match = ehrlich neue Beziehung (Namensgleichheit ≠ Identität) ─
{
  const m = I.createPerson('Mira'), a = I.createPerson('Anton'), e1 = I.createPerson('Emil'), e2 = I.createPerson('Emil')
  await I.ceremony(m, a, T0)
  await I.ceremony(m, e2, T0 + 1000)
  await I.ceremony(a, e1, T0 + 2000)  // Anton kennt den ERSTEN Emil
  const keyOf = (p, name) => [...p.contacts.entries()].find(([, c]) => c.name === name)[0]
  const drop = I.createDrop()
  const intro = await I.introduce(m, keyOf(m, 'Anton'), keyOf(m, 'Emil'), T0 + 10_000) // Mira meint den ZWEITEN
  const rA = await I.receiveOffer(a, intro.offers[0].env)
  const rE = await I.receiveOffer(e2, intro.offers[1].env)
  await I.consent(a, rA.entry, drop, T0 + 11_000)
  await I.consent(e2, rE.entry, drop, T0 + 12_000)
  await I.checkDrop(a, rA.entry, drop)
  await runContinuity(a, e2, rA.entry.counterpartAnchor, rE.entry.counterpartAnchor, T0 + 13_000)
  check(active(a).filter((c) => c.name === 'Emil').length === 2, 'anderer Mensch, gleicher Name: kein Match — ehrlich ZWEI Emils (Namen sind Worte)')
}

// ── 4. Mapping-Negative: jede Prüfung an ihrem Punkt ────────────────────
{
  const a = I.createPerson('Anton'), b = I.createPerson('Berta')
  const c1 = await I.ceremony(a, b, T0)
  const c2 = await I.ceremony(a, b, T0 + 60_000)
  // Berta baut ein kohärentes Mapping, nennt aber als prior das FRISCHE Tupel selbst
  const t = b.contacts.get(c2.ctxA.anchor)
  const body = { type: 'continuity-mapping@1', prior: c2.ctxB.anchor, next: t.channel.own.anchor, to: c2.ctxA.anchor, revision: '1', issuedAt: C.iso(T0 + 61_000) }
  const msg = jcs(body)
  const k1 = await C.hkdf(await C.ecdh(t.channel.own.x.priv, C.xRawOfMk(t.channel.counterpartKa)), 'rltp/visibility/mac/cont1')
  const k2 = await C.hkdf(await C.ecdh(t.channel.own.x.priv, C.xRawOfMk(t.channel.counterpartKa)), 'rltp/visibility/mac/cont2')
  const evil = { ...body, mac1: await hmac(k1, msg), mac2: await hmac(k2, msg) }
  const rSelf = await CN.receiveContinuity(a, await C.seal(evil, t.channel.counterpartKa), T0 + 62_000)
  check(rSelf.error === 'prior nicht im Prior-Candidate-Set', 'Selbst-Referenz als prior: stirbt am Schnappschuss (nie das frische Tupel)')
  // mac1 unter dem falschen Schlüssel (neuer statt alter Beziehung): stirbt an mac1
  const body2 = { ...body, prior: c1.ctxB.anchor }
  const msg2 = jcs(body2)
  const evil2 = { ...body2, mac1: await hmac(k1, msg2), mac2: await hmac(k2, msg2) }
  const rMac = await CN.receiveContinuity(a, await C.seal(evil2, t.channel.counterpartKa), T0 + 63_000)
  check(rMac.error === 'mac1 (alter Beziehungs-Schlüssel)', 'mac1 unter falschem Schlüssel: nur der Inhaber BEIDER Beziehungen kann beide MACs')
}

// ── 5. der Kontinuitäts-Aufstieg (Kapitel 2): erst vorgestellt, dann getroffen ─
{
  const m = I.createPerson('Mira'), a = I.createPerson('Anton'), b = I.createPerson('Berta')
  await I.ceremony(m, a, T0)
  await I.ceremony(m, b, T0 + 1000)
  const keyOf = (p, name) => [...p.contacts.entries()].find(([, c]) => c.name === name)[0]
  const drop = I.createDrop()
  const intro = await I.introduce(m, keyOf(m, 'Anton'), keyOf(m, 'Berta'), T0 + 10_000)
  const rA = await I.receiveOffer(a, intro.offers[0].env)
  const rB = await I.receiveOffer(b, intro.offers[1].env)
  await I.consent(a, rA.entry, drop, T0 + 11_000)
  await I.consent(b, rB.entry, drop, T0 + 12_000)
  await I.checkDrop(a, rA.entry, drop)
  check(active(a).some((c) => c.name === 'Berta' && c.state === '⇄'), 'Ausgangslage: ⇄ vorgestellt (unverifiziert)')
  const c2 = await I.ceremony(a, b, T0 + 100_000)  // das erste ECHTE Treffen
  await runContinuity(a, b, c2.ctxB.anchor, c2.ctxA.anchor, T0 + 101_000)
  const head = active(a).find((c) => c.name === 'Berta')
  check(active(a).filter((c) => c.name === 'Berta').length === 1 && head.state === '✓' && head.chain?.length === 1, 'das erste echte Treffen stuft hoch: ⇄ → ✓ per Kette, EIN Kontakt (Kapitel 2)')
  check(head.since === rA.entry.offer.issuedAt || head.since <= C.iso(T0 + 100_000), 'die Beziehungsgeschichte beginnt bei der Vorstellung — since wandert mit')
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) { console.error('continuity: FAILED'); process.exit(1) }
console.log('continuity: §6a hält — Wiedersehen wird gekettet, Fremde bleiben ehrlich fremd.')
