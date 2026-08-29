#!/usr/bin/env node
// delivery-test — Baustein 7: die generischen Empfangs-Stufen (Contract),
// Duplikat-Cache, Faults (hold/dup/tamper/lose), Offline-Transit.
import * as I from './introduce.mjs'
import * as DV from './delivery.mjs'
import * as C from './rltp-crypto.mjs'

let pass = 0, fail = 0
const check = (c, m) => { if (c) { pass++; console.log(`  ok    ${m}`) } else { fail++; console.error(`  FAIL  ${m}`) } }
const T0 = Date.parse('2026-08-26T10:00:00Z')

const a = I.createPerson('Anton'), b = I.createPerson('Berta')
const cer = await I.ceremony(a, b, T0)
const bKa = [...a.contacts.values()][0].channel.counterpartKa
const mkEnv = async (payload) => C.seal({ id: globalThis.crypto.randomUUID(), type: 'probe/test', payload }, bKa)

let dispatched = 0
const dispatch = async () => { dispatched++; return { handled: true } }
const ch = DV.createChannel()

// ── glatter Durchlauf: fünf Stufen, alle grün ───────────────────────────
{
  const env = await mkEnv({ x: 1 })
  const r = await DV.deliver(ch, b, env, dispatch)
  check(r.arrived && r.disp === 'unique' && r.stages.length === 5 && r.stages.every((s) => s.ok), 'Zustellung: Stufen 1–4 + Dispatch, alle grün, disposition unique')
  check(dispatched === 1, 'der App-Dispatcher lief genau einmal')
  // Duplikat: derselbe Envelope nochmal — KEIN zweiter Effekt
  const r2 = await DV.deliver(ch, b, env, dispatch)
  check(r2.disp === 'duplicate-known' && dispatched === 1, 'duplicate-known: prior outcome applies — der Dispatcher lief NICHT erneut')
}

// ── Stufen-Negative ─────────────────────────────────────────────────────
{
  const env = await mkEnv({ x: 2 })
  const raw = C.fromB64u(env.ciphertext); raw[4] ^= 0x01
  const r = await DV.deliver(ch, b, { ...env, ciphertext: C.b64uOf(raw) }, dispatch)
  check(r.disp === 'failed(decryption-failed)' && !r.stages[2].ok && dispatched === 1, 'gekipptes Bit: der AES-GCM-Tag fängt es (Stufe 3), kein Dispatch')
  const r2 = await DV.deliver(ch, b, { ...env, epk: 'abc' }, dispatch)
  check(r2.disp === 'failed(malformed)' && dispatched === 1, 'kaputter epk: Stufe 2 (Envelope-Form) lehnt ab')
  const r3 = await DV.deliver(ch, b, { ...env, ciphertext: C.b64uOf(new Uint8Array(70000)) }, dispatch)
  check(r3.disp === 'failed(oversize)' && r3.stages.length === 1, 'Größenschranke VOR der Entschlüsselung (Stufe 1)')
  const rejecting = async () => ({ handled: true, error: 'proof' })
  const env4 = await mkEnv({ x: 4 })
  const r4 = await DV.deliver(ch, b, env4, rejecting)
  const r5 = await DV.deliver(ch, b, env4, dispatch)
  check(r4.disp === 'failed(proof)' && r5.disp === 'unique', 'Ablehnungen werden NICHT gecacht — der Contract cached Effekte, keine Fehlversuche')
}

// ── Faults ──────────────────────────────────────────────────────────────
{
  ch.faults.lose = true
  const r = await DV.deliver(ch, b, await mkEnv({ x: 5 }), dispatch)
  check(!r.arrived && r.disp.startsWith('lost'), 'lose: der Kanal gibt kein Zeichen — nur das fehlende Ack erzählt es')
  ch.faults.lose = false
  ch.faults.tamper = true
  const r2 = await DV.deliver(ch, b, await mkEnv({ x: 6 }), dispatch)
  check(r2.disp === 'failed(decryption-failed)', 'tamper: ein Bit kippt auf dem Kanal — Stufe 3 fängt es')
  ch.faults.tamper = false
  ch.faults.hold = true
  const env7 = await mkEnv({ x: 7 })
  const r3 = await DV.deliver(ch, b, env7, dispatch)
  check(!r3.arrived && ch.held.length === 1, 'hold: die Zustellung parkt auf dem Kanal')
  ch.faults.hold = false
  const before = dispatched
  for (const h of DV.drainHeld(ch)) await DV.deliver(ch, b, h.env, dispatch, { replay: true })
  check(dispatched === before + 1 && ch.held.length === 0, 'hold gelöst: Geparktes wird nachgeliefert, Effekt genau einmal')
}

// ── Offline-Transit ─────────────────────────────────────────────────────
{
  b.online = false
  const env = await mkEnv({ x: 8 })
  const r = await DV.deliver(ch, b, env, dispatch)
  check(!r.arrived && r.disp.startsWith('transit'), 'offline: Transit — Zustellzeit unbeschränkt, keine Ankunft')
  b.online = true
  const before = dispatched
  for (const e of DV.drainTransit(ch, b.name)) await DV.deliver(ch, b, e, dispatch)
  check(dispatched === before + 1, 'online: Transit fließt nach, Effekt genau einmal')
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) { console.error('delivery: FAILED'); process.exit(1) }
console.log('delivery: Baustein 7 hält — Stufen, Cache, Faults, Transit.')
