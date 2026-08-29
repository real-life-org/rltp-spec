#!/usr/bin/env node
// trust-test — Stufe 2: Vertrauensakt (DV-Mapping), geblendeter Stern,
// Pause-Semantik, Abstreitbarkeit; dazu vouch@2 (Bürgschaft) über den
// Kanal. Integration introduce.mjs → trust.mjs → groups.mjs.
import * as I from './introduce.mjs'
import * as G from './groups.mjs'
import * as T from './trust.mjs'
import { sameDigest } from './rltp-core.mjs'
import * as C from './rltp-crypto.mjs'

let pass = 0, fail = 0
const check = (c, m) => { if (c) { pass++; console.log(`  ok    ${m}`) } else { fail++; console.error(`  FAIL  ${m}`) } }
const T0 = Date.parse('2026-08-27T10:00:00Z')

// Kanal-Zustellung: env → receiveTrustDoc, outbound rekursiv weiter
const byName = (world, name) => Object.values(world).find((p) => p?.name === name)
async function deliverTrust (world, to, env, when) {
  const r = await T.receiveTrustDoc(to, env, when)
  for (const out of r.outbound ?? []) await deliverTrust(world, byName(world, out.to.name), out.env, when)
  return r
}

// ── Dreieck aus echten Zeremonien: A–B, A–C, B–C ────────────────────────
const anton = I.createPerson('Anton'), berta = I.createPerson('Berta'), carla = I.createPerson('Carla')
const world = { anton, berta, carla }
await I.ceremony(anton, berta, T0)
await I.ceremony(anton, carla, T0 + 1000)
await I.ceremony(berta, carla, T0 + 2000)
const keyOf = (p, name) => [...p.contacts.entries()].find(([, c]) => c.name === name)[0]

// ── 1. der Vertrauensakt: einseitig, verifiziert, Einweg-Tür ────────────
{
  const pkt = await T.setTrust(anton, keyOf(anton, 'Berta'), T0 + 10_000)
  check(!pkt.error && pkt.env, 'Vertrauensakt Anton→Berta: Disclosure versiegelt auf dem Kanal')
  const r = await deliverTrust(world, berta, pkt.env, T0 + 11_000)
  const bA = berta.contacts.get(keyOf(berta, 'Anton'))
  check(r.disclosed && bA.selfAnchor === (await T.communityContext(anton)).anchor, 'Berta hält Antons stabilen Anker — Mapping VERIFIZIERT übernommen')
  check(bA.trustReceived && !bA.trustGiven, 'Richtung stimmt: ← vertraut dir, nichts zurückgegeben')
  check(anton.contacts.get(keyOf(anton, 'Berta')).trustGiven, 'Antons Journal: Einweg-Tür offen (trustGiven)')
  const again = await T.setTrust(anton, keyOf(anton, 'Berta'), T0 + 12_000)
  check(again.error === 'bereits geschenkt (Einweg-Tür)', 'zweiter Akt: abgewiesen — die Tür ist schon offen')
}

// ── 2. Kanal-Regel (Antons Entscheid 24.08.): ⇄ DARF, ◇ nicht ──────────
// Vertrauen ist eine Offenlegungs-Entscheidung, keine Verifikations-
// Behauptung — aber ohne eigene Freigabe (◇) existiert kein Kanal-Kontext.
{
  const drop = I.createDrop()
  const intro = await I.introduce(anton, keyOf(anton, 'Berta'), keyOf(anton, 'Carla'), T0 + 20_000)
  const rB = await I.receiveOffer(berta, intro.offers[0].env)
  const rC = await I.receiveOffer(carla, intro.offers[1].env)
  await I.consent(carla, rC.entry, drop, T0 + 21_000)   // nur Carla gibt frei
  await I.checkDrop(berta, rB.entry, drop)              // Berta empfängt passiv → ◇
  const oneKey = [...berta.contacts.entries()].find(([, c]) => c.state === '◇')[0]
  const blocked = await T.setTrust(berta, oneKey, T0 + 22_000)
  check(blocked.error?.includes('Kanal'), 'einseitig (◇): Vertrauensakt abgewiesen — kein eigener Kanal-Kontext')
  await I.consent(berta, rB.entry, drop, T0 + 23_000)   // jetzt freigeben → ⇄
  await I.checkDrop(carla, rC.entry, drop)
  const pkt = await T.setTrust(berta, oneKey, T0 + 24_000)
  check(!pkt.error && pkt.env, 'vorgestellt + beidseitig (⇄): Vertrauensakt ERLAUBT (Offenlegung ist meine Entscheidung)')
  const r = await deliverTrust(world, carla, pkt.env, T0 + 25_000)
  const cIntro = [...carla.contacts.values()].find((c) => c.provenance !== 'ceremony' && c.name === 'Berta')
  check(r.disclosed && cIntro.selfAnchor === (await T.communityContext(berta)).anchor, 'Mapping verifiziert auch über den VORGESTELLTEN Kanal — kein Zeremonie-Credential nötig')
}

// ── 3. Stern + gemeinsame Kontakte (geblendet, empfänger-privat) ────────
{
  // Bestand aufbauen: B→A, C→A, C→B, B→C — dann hält A: B.self + C.self
  // und Carla hält B.self (nur dadurch kann sie den Match rechnen)
  for (const [from, toName, t] of [[berta, 'Anton', 30], [carla, 'Anton', 31], [carla, 'Berta', 32], [berta, 'Carla', 33]]) {
    const pkt = await T.setTrust(from, keyOf(from, toName), T0 + t * 1000)
    await deliverTrust(world, byName(world, toName), pkt.env, T0 + t * 1000 + 500)
  }
  // A→C: Antons Stern an Carla enthält (geblendet) B.self und C.self
  const pkt = await T.setTrust(anton, keyOf(anton, 'Carla'), T0 + 40_000)
  await deliverTrust(world, carla, pkt.env, T0 + 41_000)
  const cA = carla.contacts.get(keyOf(carla, 'Anton'))
  check(cA.starReceived?.count === 2, 'Carla sieht: Anton hält 2 offengelegte Kontakte (Zählung ehrlich)')
  check(cA.starInfo?.knownNames?.length === 1 && cA.starInfo.knownNames[0] === 'Berta', 'gemeinsamer Kontakt erkannt: Berta (nur weil Carla B.self LEGITIM hält)')
  check(!cA.starReceived.blinded.includes((await T.communityContext(berta)).anchor), 'kein roher Dritt-Anker im Schnappschuss — alles geblendet')
  // Stern-Refresh beim Bestandswachstum: Bertas Stern an Anton wuchs, als
  // Carla ihr B… nein: als Anton Berta.self schon hielt — prüfe Refresh-Kette:
  const aB = anton.contacts.get(keyOf(anton, 'Berta'))
  check(aB.starReceived && anton.contacts.get(keyOf(anton, 'Carla')).starReceived, 'Anton hält Sterne beider — Refresh-Kette hat geliefert')
  check(aB.starInfo.knownNames.includes('Carla'), 'Antons Sicht auf Berta: „Ihr kennt beide Carla"')
}

// ── 4. Abstreitbarkeit: der Empfänger fälscht identisch verifizierend ───
{
  // Berta (Empfängerin) fabriziert: Antons pair-Anker ↦ CARLAS Self
  const victimCard = carla.contacts.get(keyOf(carla, 'Anton')) && await T.selfCard(carla, C.iso(T0 + 50_000))
  // Berta hält Carlas Self-Card via Disclosure C→B
  const bC = berta.contacts.get(keyOf(berta, 'Carla'))
  const forged = await T.forgeMapping(berta, bC.mapping.card, keyOf(berta, 'Anton'), T0 + 51_000)
  check(await T.verifyMapping(berta, forged), 'FORGE verifiziert identisch — ein geleaktes Mapping beweist Dritten nichts')
  // aber Manipulation am echten stirbt
  const real = berta.contacts.get(keyOf(berta, 'Anton')).mapping
  const tampered = { ...real, body: { ...real.body, self: (await T.communityContext(berta)).anchor } }
  check(!(await T.verifyMapping(berta, tampered)), 'manipulierter body: MAC-Prüfung schlägt fehl')
}

// ── 5. Pause: Abo stoppt, Geliefertes bleibt ────────────────────────────
{
  T.setTrustPaused(anton, keyOf(anton, 'Berta'), true)
  const before = anton.contacts.get(keyOf(anton, 'Berta')).sentStar.salt
  const out = await T.starRefreshAll(anton, T0 + 60_000)
  check(out.every((o) => o.to.name !== 'Berta'), 'pausiert: kein neuer Stern an Berta im Refresh')
  check(anton.contacts.get(keyOf(anton, 'Berta')).sentStar.salt === before, 'Sender-Journal unverändert — Geliefertes bleibt, Neues stoppt')
  T.setTrustPaused(anton, keyOf(anton, 'Berta'), false)
  const out2 = await T.starRefreshAll(anton, T0 + 61_000)
  check(out2.some((o) => o.to.name === 'Berta'), 'reaktiviert: Stern fließt wieder')
}

// ── 6. vouch@2: die Bürgschaft, accept-gebunden, über den Kanal ─────────
{
  const g = await G.foundGroup(berta, 'Bürgschafts-Kreis', T0 + 70_000, { vouchThreshold: 1 })
  const p1 = await G.preludeRequest(berta, keyOf(berta, 'Carla'), g.genesisDigest, T0 + 71_000)
  const r1 = await G.receiveDoc(carla, p1.env, T0 + 72_000)
  const r2 = await G.receiveDoc(berta, r1.outbound[0].env, T0 + 73_000)
  const r3 = await G.receiveDoc(carla, r2.outbound[0].env, T0 + 74_000)
  const acc = await G.acceptInvite(carla, r3.prompt, T0 + 75_000, { candidacy: true })
  const r4 = await G.receiveDoc(berta, acc.env, T0 + 76_000)
  await G.receiveDoc(carla, r4.outbound[0].env, T0 + 77_000)
  const gB = berta.groups.get(g.genesisDigest), gC = carla.groups.get(g.genesisDigest)
  const candAnchor = gC.myMemberCtx.anchor
  check(gB.roster.get(candAnchor)?.candidacy === true && gB.roster.get(candAnchor)?.acceptDigest, 'Kandidatur sichtbar, accept-Digest im Roster (kein stehendes Bürgen möglich)')
  const v = await G.vouchFor(berta, g.genesisDigest, candAnchor, 'met', T0 + 80_000)
  check(v.env, 'Bürgschaft ausgestellt: konformes AdmissionVouch (schema-validiert), versiegelt zum Kandidaten')
  const rv = await G.receiveDoc(carla, v.env, T0 + 81_000)
  check(rv.vouched && rv.fulfilled, 'Kandidat prüft (Roster, accept-Bindung, Proofs) und zählt: Schwelle 1 erreicht')
  check(gC.roster.get(candAnchor).candidacy === false && gC.candidacyFulfilled, 'Kandidatur erfüllt — Badge fällt auf der Kandidatenseite')
  const again = await G.vouchFor(berta, g.genesisDigest, candAnchor, 'met', T0 + 82_000)
  check(again.error === 'bereits gebürgt', 'Doppel-Bürgschaft: abgewiesen beim Bürgen')
  // Negative: accept-Bindung — kohärent neu signierte Bürgschaft mit fremdem accept stirbt
  const cred = gB.myVouches.get(candAnchor)
  const evil = await C.diSign(gB.myMemberCtx, { ...structuredClone((({ proof, ...r }) => r)(cred)),
    credentialSubject: { id: candAnchor, endorsement: { ...cred.credentialSubject.endorsement, accept: await C.digestDoc({ x: 'anders' }) } } }, C.iso(T0 + 83_000))
  const evilDoc = await C.diSign(gB.myMemberCtx, { id: globalThis.crypto.randomUUID(), type: 'https://real-life.org/trust-tasks/membership-vouch/0.1',
    issuer: gB.myMemberCtx.anchor, recipient: candAnchor, threadId: globalThis.crypto.randomUUID(), issuedAt: C.iso(T0 + 83_000), payload: { vouch: evil } }, C.iso(T0 + 83_000))
  const bCarla = berta.contacts.get(keyOf(berta, 'Carla'))
  const rEvil = await G.receiveDoc(carla, await C.seal(evilDoc, bCarla.channel.counterpartKa), T0 + 84_000)
  check(rEvil.error === 'accept-Bindung', 'fremder accept-Digest (kohärent signiert): stirbt an der accept-Bindung')
  // Negative: Nicht-Mitglied bürgt — Anton ist kein Mitglied, hat aber einen Kanal zu Carla
  const outsider = await C.pairContext(anton.rootIkm, C.rand(32))
  const oCred = await C.diSign(outsider, { ...structuredClone((({ proof, ...r }) => r)(cred)), issuer: outsider.anchor }, C.iso(T0 + 85_000))
  const oDoc = await C.diSign(outsider, { id: globalThis.crypto.randomUUID(), type: 'https://real-life.org/trust-tasks/membership-vouch/0.1',
    issuer: outsider.anchor, recipient: candAnchor, threadId: globalThis.crypto.randomUUID(), issuedAt: C.iso(T0 + 85_000), payload: { vouch: oCred } }, C.iso(T0 + 85_000))
  const aCarla = anton.contacts.get(keyOf(anton, 'Carla'))
  const rOut = await G.receiveDoc(carla, await C.seal(oDoc, aCarla.channel.counterpartKa), T0 + 86_000)
  check(rOut.error === 'Bürge ist kein Mitglied', 'Nicht-Mitglied mit gültigem Kanal: stirbt am Roster-Check')
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) { console.error('trust: FAILED'); process.exit(1) }
console.log('trust: Stufe 2 hält — Vertrauensakt, Stern und Bürgschaft mit allen Checks an ihren Punkten.')
