#!/usr/bin/env node
// clock-test — Baustein 8: laufen, springen, driften, Replay.
import * as K from './clock.mjs'

let pass = 0, fail = 0
const check = (c, m) => { if (c) { pass++; console.log(`  ok    ${m}`) } else { fail++; console.error(`  FAIL  ${m}`) } }
const T0 = Date.parse('2026-08-27T15:00:00Z')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── stehend + springend (das bisherige Netzwerk-Sim-Verhalten) ─────────
{
  const c = K.createClock({ start: T0 })
  check(K.now(c) === T0, 'angehalten: die Zeit steht, wo sie gesetzt wurde')
  await sleep(60)
  check(K.now(c) === T0, 'angehalten bleibt angehalten — reale Zeit vergeht folgenlos')
  K.jump(c, 5 * K.SECOND)
  check(K.now(c) === T0 + 5000, 'ein Akt schiebt die Zeit um seinen Betrag')
}

// ── laufend (Zeitraffer) ───────────────────────────────────────────────
{
  const c = K.createClock({ start: T0, rate: 600 }) // 10 Minuten pro Sekunde
  await sleep(120)
  const d = K.now(c) - T0
  check(d >= 600 * 100 && d <= 600 * 400, `laufend: ~${Math.round(d / 1000)} s Sim-Zeit in 120 ms real (Rate 600×)`)
  K.setRate(c, 0)
  const frozen = K.now(c)
  await sleep(60)
  check(K.now(c) === frozen, 'Rate 0: die Uhr friert genau dort ein, wo sie war')
  K.setRate(c, 1)
  K.jump(c, K.HOUR)
  check(K.now(c) >= frozen + K.HOUR, 'Sprung bei laufender Uhr: die Marke wandert mit, die Rate bleibt')
}

// ── Skew pro Gerät ─────────────────────────────────────────────────────
{
  const c = K.createClock({ start: T0 })
  K.setSkew(c, 'A', 3 * K.MINUTE)
  K.setSkew(c, 'B', -90 * K.SECOND)
  check(K.deviceNow(c, 'A') - K.deviceNow(c, 'B') === 4.5 * K.MINUTE, 'zwei Geräte lesen verschiedene Uhren (4,5 min auseinander)')
  check(K.deviceNow(c, 'C') === K.now(c), 'ein Gerät ohne gesetzten Skew liest die Weltzeit')
  // Alterung ist geräte-relativ: dasselbe Artefakt, zwei Urteile
  const issued = new Date(T0 - 4 * K.MINUTE).toISOString()
  check(K.agedOut(c, 'A', issued, 5 * K.MINUTE) === true, 'vorgehendes Gerät: 4 min altes Artefakt gilt ihm als abgelaufen (PT5M)')
  check(K.agedOut(c, 'B', issued, 5 * K.MINUTE) === false, 'nachgehendes Gerät: dasselbe Artefakt ist ihm noch frisch — Skew ist der Normalfall')
}

// ── Replay: deterministisch, egal was die Wanduhr tut ──────────────────
{
  const c = K.createClock({ start: T0, rate: 3600 })
  const log = [T0 + 1000, T0 + 2000, T0 + 3000]
  const seen = []
  for (const when of log) await K.at(c, when, async () => { await sleep(15); seen.push(K.now(c)) })
  check(JSON.stringify(seen) === JSON.stringify(log), 'Replay: während einer Aktion IST die Zeit die geloggte — auch bei 3600×')
  const after = K.now(c)
  await sleep(40)
  check(K.now(c) > after, 'nach dem Replay läuft die Uhr weiter wie zuvor')
  // zweiter Durchlauf ergibt dieselben Zeiten — das ist die Replay-Garantie
  const seen2 = []
  for (const when of log) await K.at(c, when, async () => { seen2.push(K.now(c)) })
  check(JSON.stringify(seen2) === JSON.stringify(log), 'zweiter Durchlauf: byte-gleiche Zeiten — keine stumme Divergenz')
}

// ── Abonnement ─────────────────────────────────────────────────────────
{
  const c = K.createClock({ start: T0 })
  let calls = 0
  const off = K.subscribe(c, () => calls++)
  K.jump(c, 1000); K.setSkew(c, 'A', 10); K.setRate(c, 1)
  check(calls === 3, 'die UI wird bei jeder sichtbaren Zeitänderung geweckt')
  off()
  K.jump(c, 1000)
  check(calls === 3, 'abbestellt ist abbestellt')
  K.stop(c)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) { console.error('clock: FAILED'); process.exit(1) }
console.log('clock: Baustein 8 hält — laufen, springen, driften, Replay.')
