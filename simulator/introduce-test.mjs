#!/usr/bin/env node
// introduce-test — the Jonathan/Anton/Emil script as executable assertions.
// Proves the probe's four claims: mediator-initiated, independent release,
// airplane-mode mediator (drop port, no ferry), one-sidedness first-class.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeValidator } from './rltp-core.mjs'
import * as I from './introduce.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCHEMAS = {}
for (const f of ['contact-card-0.25.schema.json', 'contact-card.schema.json']) SCHEMAS[f] = JSON.parse(readFileSync(join(ROOT, 'schemas', f), 'utf8'))
const V = makeValidator(SCHEMAS)

let pass = 0, fail = 0
const check = (c, m) => { if (c) { pass++; console.log(`  ok    ${m}`) } else { fail++; console.error(`  FAIL  ${m}`) } }
const T0 = Date.parse('2026-08-25T15:00:00Z')

// ── setup: Anton kennt Jonathan und Emil (echte Zeremonien) ─────────────
const anton = I.createPerson('Anton'), jonathan = I.createPerson('Jonathan'), emil = I.createPerson('Emil')
const cJ = await I.ceremony(anton, jonathan, T0)
const cE = await I.ceremony(anton, emil, T0 + 1000)
check(anton.contacts.size === 2 && jonathan.contacts.size === 1 && emil.contacts.size === 1, 'Setup: Anton hält beide, die beiden halten nur Anton')
check(![...jonathan.contacts.keys()].some((a) => emil.contexts.has(a)), 'Jonathan hält KEINEN Anker von Emil (nicht verbunden)')

// ── Antons EIN Akt, dann Flugmodus ──────────────────────────────────────
const drop = I.createDrop()
const { act, offers } = await I.introduce(anton, cJ.ctxB.anchor, cE.ctxB.anchor, T0 + 5000)
await I.setOnline(anton, false, drop)
check(anton.online === false, 'Anton ist im Flugmodus')

// Angebote kommen an (über die bestehenden Kanäle, Anton schon offline —
// sie waren beim Akt bereits versiegelt unterwegs)
const rJ = await I.receiveOffer(jonathan, offers[0].env) // offers[0] ist an Jonathan adressiert (erste Auswahl im Akt)
const rE = await I.receiveOffer(emil, offers[1].env)
check(!rJ.error && rJ.entry.offer.peer.name === 'Emil', 'Jonathan: "Anton möchte dich mit Emil verbinden"')
check(!rE.error && rE.entry.offer.peer.name === 'Jonathan', 'Emil: "Anton möchte dich mit Jonathan verbinden"')
check(rJ.entry.offer.rendezvous === rE.entry.offer.rendezvous && rJ.entry.offer.act === act, 'beide Angebote tragen dasselbe Akt-Geheimnis')

// ── unabhängige Freigabe: erst Jonathan (einseitig), dann Emil ──────────
const consJ = await I.consent(jonathan, rJ.entry, drop, T0 + 60_000)
check(consJ.mutual === false, 'Jonathan freigegeben: ◇ gesendet — noch einseitig, niemand wartet auf niemanden')
check(V.validate(await cardOf('a'), SCHEMAS['contact-card-0.25.schema.json'], SCHEMAS['contact-card-0.25.schema.json']).length === 0, 'die deponierte Karte ist schema-valide (0.25 displayed form)')
async function cardOf (dir) { // Testhilfe: liest den Drop mit dem Akt-Geheimnis (wie eine Partei)
  const secret = Uint8Array.from(Buffer.from(rJ.entry.offer.rendezvous, 'base64url'))
  const { jcs } = await import('./rltp-core.mjs')
  const C = await import('./rltp-crypto.mjs')
  const topic = C.b64uOf(await C.hkdf(secret, 'rltp/introduce/topic/' + dir))
  const blob = drop.slots.get(topic)
  const raw = Uint8Array.from(Buffer.from(blob, 'base64url'))
  const key = await globalThis.crypto.subtle.importKey('raw', await C.hkdf(secret, 'rltp/introduce/key/' + dir), { name: 'AES-GCM' }, false, ['decrypt'])
  const pt = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, 12) }, key, raw.subarray(12))
  return JSON.parse(new TextDecoder().decode(new Uint8Array(pt))).card
}

// PASSIVER EMPFANG (Modell C): Emils nächster Sync holt Jonathans Karte,
// OBWOHL Emil noch gar nicht entschieden hat — wie eine geteilte Nummer
const passive = await I.checkDrop(emil, rE.entry, drop)
check(passive.mutual === false, 'Emil (unentschieden) hält Jonathans Karte nach Sync — einseitig ◇')
const ecPre = [...emil.contacts.values()].find((c) => c.provenance.startsWith('introduced via'))
check(ecPre?.state === '◇' && ecPre?.name === 'Jonathan', 'Kontaktliste zeigt Jonathan ◇ VOR Emils Entscheidung (UI = Daten)')

const consE = await I.consent(emil, rE.entry, drop, T0 + 120_000)
check(consE.mutual === true, 'Emil freigegeben: jetzt ⇄ bei Emil (◇ wurde hochgestuft)')
const lateJ = await I.checkDrop(jonathan, rJ.entry, drop)
check(lateJ.mutual === true, 'Jonathans nächster Sync holt Emils Karte — ⇄ bei Jonathan')

// ── die Kernaussagen ────────────────────────────────────────────────────
check(anton.online === false, 'Anton war die GANZE Zeit im Flugmodus')
check(drop.log.every((e) => e.by !== 'Anton'), 'der Drop hat NIE einen Zugriff von Anton gesehen (kein Fähren-Schritt)')
const jc = [...jonathan.contacts.values()].find((c) => c.provenance.startsWith('introduced via'))
const ec = [...emil.contacts.values()].find((c) => c.provenance.startsWith('introduced via'))
check(jc?.name === 'Emil' && jc?.state === '⇄' && jc?.provenance === 'introduced via Anton', 'Jonathan hält Emil: ⇄ vorgestellt via Anton')
check(ec?.name === 'Jonathan' && ec?.state === '⇄', 'Emil hält Jonathan: ⇄')
check(jc.voucher && jc.voucher.act === act, 'der Mediator-Voucher (Akt-gebunden) liegt beim Kontakt — die Evidenz hinter ◇/⇄')
// die neuen Anker sind FRISCH: in keiner bisherigen Beziehung gesehen
check(!anton.contacts.has(jc.card.anchor) && !anton.contacts.has(ec.card.anchor), 'die gekreuzten Anker sind frisch — Anton kennt sie nicht (Anker-Regel: nichts wurde transferiert)')
// ab hier könnte Jonathan den Prelude für seine neue Gruppe fahren (Stage C)
check(!!jc.channel.counterpartKa && !!jc.channel.own, 'der Kanal für Prelude → Invite → Accept steht (Stage-C-Anschluss)')

// ── Negative ────────────────────────────────────────────────────────────
{
  // fremdes Geheimnis: Blob unlesbar
  const fake = JSON.parse(JSON.stringify(rE.entry)); fake.offer = { ...fake.offer, rendezvous: Buffer.from(new Uint8Array(32).fill(9)).toString('base64url') }
  fake.decided = true; fake.done = false; fake.ownCtx = consE.ctx
  const r = await I.checkDrop(emil, fake, drop)
  check(r?.mutual === false || r?.error === 'undecryptable', 'falsches Rendezvous-Geheimnis: nichts lesbar')
  // Ignorieren blockiert den Empfang NICHT (irreversibles Wissen, ehrlich):
  const ign = I.createPerson('Ida'), rel = I.createPerson('Rolf'), med2 = I.createPerson('Mia')
  const y1 = await I.ceremony(med2, ign, T0), y2 = await I.ceremony(med2, rel, T0)
  const d3 = I.createDrop()
  const i3 = await I.introduce(med2, y2.ctxB.anchor, y1.ctxB.anchor, T0 + 20_000)
  const rRel = await I.receiveOffer(rel, i3.offers[0].env)
  const rIgn = await I.receiveOffer(ign, i3.offers[1].env)
  rIgn.entry.decided = true; rIgn.entry.ignored = true          // Ida ignoriert
  await I.consent(rel, rRel.entry, d3, T0 + 30_000)             // Rolf gibt frei
  const got = await I.checkDrop(ign, rIgn.entry, d3)            // Idas Sync
  check(got.mutual === false && [...ign.contacts.values()].some((c) => c.name === 'Rolf' && c.state === '◇'), 'Ignorieren: Ida hält Rolfs Karte trotzdem (◇) — ihre eigene Karte bleibt bei ihr')
  check(![...rel.contacts.values()].some((c) => c.name === 'Ida'), 'Rolf hält NICHTS von Ida (sie hat nie freigegeben)')
  // Offline-Konsens wird gequeued und beim Online-Gehen ausgeführt
  const anna = I.createPerson('Anna'), bert = I.createPerson('Bert'), max = I.createPerson('Max')
  const x1 = await I.ceremony(max, anna, T0), x2 = await I.ceremony(max, bert, T0)
  const d2 = I.createDrop()
  const intro2 = await I.introduce(max, x1.ctxB.anchor, x2.ctxB.anchor, T0 + 9000)
  const ra = await I.receiveOffer(anna, intro2.offers[0].env)
  await I.setOnline(anna, false, d2)
  const qa = await I.consent(anna, ra.entry, d2, T0 + 10_000)
  check(qa.queued === true && d2.log.length === 0, 'offline: Freigabe wird gequeued, nichts erreicht den Drop')
  await I.setOnline(anna, true, d2)
  check(d2.log.some((e) => e.op === 'put' && e.by === 'Anna'), 'online: die gequeuete Freigabe wird nachgeholt')
}

// ── Ketten-Vorstellung (Antons Entscheid 24.08.): ⇄ darf vermitteln, ────
// die Offerte trägt die Herkunft des Vermittlers sichtbar; ◇ kann nicht.
{
  const m = I.createPerson('Mira'), u = I.createPerson('Udo'), v = I.createPerson('Vera'), w = I.createPerson('Wim')
  const c1 = await I.ceremony(m, u, T0), c2 = await I.ceremony(m, v, T0 + 1000)
  await I.ceremony(u, w, T0 + 2000) // Udo kennt Wim echt — nur fürs Setup unten
  const d = I.createDrop()
  // Runde 1: Mira stellt Udo⇠⇢Vera vor (beide met)
  const i1 = await I.introduce(m, c1.ctxB.anchor, c2.ctxB.anchor, T0 + 10_000)
  const rU = await I.receiveOffer(u, i1.offers[0].env)
  check(rU.entry.offer.peer.provenance === 'met', 'Offerte trägt Herkunft: „met" — Mira hat Vera selbst getroffen')
  const rV = await I.receiveOffer(v, i1.offers[1].env)
  await I.consent(u, rU.entry, d, T0 + 11_000)
  await I.consent(v, rV.entry, d, T0 + 12_000)
  await I.checkDrop(u, rU.entry, d)
  // Runde 2: Udo stellt Wim⇠⇢Vera vor — Vera kennt er nur VORGESTELLT
  const veraKey = [...u.contacts.entries()].find(([, c]) => c.name === 'Vera')[0]
  const wimKey = [...u.contacts.entries()].find(([, c]) => c.name === 'Wim')[0]
  const i2 = await I.introduce(u, wimKey, veraKey, T0 + 20_000)
  const rW = await I.receiveOffer(w, i2.offers[0].env)
  check(rW.entry.offer.peer.provenance === 'introduced', 'Ketten-Offerte an Wim: „Udo hat Vera selbst nur vorgestellt bekommen" — sichtbar')
  const rV2 = await I.receiveOffer(v, i2.offers[1].env)
  check(rV2.entry.offer.peer.provenance === 'met', 'Gegenrichtung ehrlich: Wim kennt Udo echt (met)')
  // der Voucher in VERAS Offerte bürgt für VERA — er reist mit ihrer Karte
  // zu Wim und trägt Udos Herkunft ZU VERA (introduced)
  check(rV2.entry.offer.voucherForCounterpart.provenance === 'introduced', 'auch der Akt-Voucher trägt die selbst-attestierte Herkunft (vouch@2-Vokabular)')
  await I.consent(w, rW.entry, d, T0 + 21_000)
  await I.consent(v, rV2.entry, d, T0 + 22_000)
  const gotW = await I.checkDrop(w, rW.entry, d)
  check(gotW.mutual && [...w.contacts.values()].some((c) => c.name === 'Vera' && c.state === '⇄' && c.mediatorProvenance === 'introduced'), 'Kette steht: Wim ⇄ Vera, Herkunft des Vermittlers am Kontakt festgehalten — amber wäscht nie zu blau')
  // ◇ kann NICHT vermitteln: Vera hält Xara nur einseitig
  const x = I.createPerson('Xara'), m2 = I.createPerson('Mona')
  const z1 = await I.ceremony(m2, v, T0 + 30_000), z2 = await I.ceremony(m2, x, T0 + 31_000)
  const d2 = I.createDrop()
  const i3 = await I.introduce(m2, z1.ctxB.anchor, z2.ctxB.anchor, T0 + 32_000)
  const rV3 = await I.receiveOffer(v, i3.offers[0].env)
  const rX = await I.receiveOffer(x, i3.offers[1].env)
  await I.consent(x, rX.entry, d2, T0 + 33_000)      // nur Xara gibt frei
  await I.checkDrop(v, rV3.entry, d2)                 // Vera hält Xara ◇
  const xKey = [...v.contacts.entries()].find(([, c]) => c.state === '◇')[0]
  const someKey = [...v.contacts.entries()].find(([, c]) => c.provenance === 'ceremony')[0]
  let threw = false
  try { await I.introduce(v, xKey, someKey, T0 + 34_000) } catch (e) { threw = /mutual channel/.test(e.message) }
  check(threw, '◇ kann nicht vermitteln: kein beidseitiger Kanal — Vorstellung wirft')
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) { console.error('introduce: FAILED'); process.exit(1) }
console.log('introduce: das Jonathan/Anton/Emil-Szenario hält — Vermittler im Flugmodus.')
