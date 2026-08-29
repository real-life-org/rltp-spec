// delivery.mjs — der Zustellkanal der Werkbank. Seit Faden 3
// (29.08.2026) urteilt hier NUR die Bibliothek: die generischen
// Empfangs-Stufen 1–4 sind lib/src/delivery.ts receive() (→
// ./lib/delivery.js, eingefroren via scripts/build-simulator-lib.mjs,
// CI-frischegeprüft); openEnvelope/effectDone sind Re-Exporte der
// Probe-Brücke. Sim-eigen bleibt die WERKBANK-Ebene: der beobachtbare
// Kanal mit Offline-Transit und Hold/Dup/Tamper/Lose-Faults, und die
// Inspektion, die die Stufen der Bibliothek als aufklappbare Zeilen
// ausgibt, ohne selbst zu urteilen.
//
// Bekannte, benannte Kostenstelle (lib-Review 6, M-1): eine Zustellung
// durchläuft receive() zweimal — einmal in deliver() (Kanal-Anzeige),
// einmal im Typ-Dispatch des Empfängers (openEnvelope). Das ist der
// Preis der Beobachtbarkeit; der completed-effect-Cache macht es
// semantisch folgenlos.
import { receive } from './lib/delivery.js'
import { fromB64u, b64uOf } from './lib/crypto.js'

export { openEnvelope, effectDone } from './lib/probe/deps.js'

export function createChannel () {
  return {
    faults: { hold: false, dup: false, tamper: false, lose: false },
    held: [],                 // Zustellungen, die der hold-Fault parkt
    transit: new Map(),       // name -> [env] für Offline-Geräte
  }
}

// die generischen Stufen — reine Inspektion, konsumiert nichts (der
// Cache wird nur GELESEN; geschrieben wird er von deliver()/effectDone)
export async function inspect (toPerson, env) {
  const r = await receive(env,
    (rkid) => toPerson.contexts.get(rkid)?.x.priv,
    (toPerson.deliveryCache ??= new Set()))
  const st = r.stages.map((s) => ({ label: `${s.stage} ${s.label}`, ok: s.ok }))
  if (r.disposition === 'duplicate-known') {
    st.push({ label: '  → duplicate-known · prior outcome applies, no second effect', ok: true })
    return { st, disp: 'duplicate-known', digest: r.digest, doc: r.document }
  }
  if (r.disposition !== 'unique') return { st, disp: r.disposition }
  return { st, disp: null, digest: r.digest, doc: r.document }
}

// eine Zustellung: Faults → Transit → Stufen → App-Dispatch → Cache.
// dispatch(env) ist die typ-spezifische Kette des Aufrufers; ihr Ergebnis
// ({handled, error?}) wird als Abschluss-Stufe notiert.
// Rückgabe: { arrived, disp, stages } — arrived = Ankunft auf dem Gerät
// (Ack-Semantik: Ankunft, nie Annahme).
export async function deliver (ch, toPerson, env, dispatch, opts = {}) {
  if (ch.faults.lose && !opts.replay) {
    return { arrived: false, disp: 'lost (fault) — the channel gives no sign; only the missing ack tells', stages: [] }
  }
  if (ch.faults.tamper && !opts.replay) {
    const raw = fromB64u(env.ciphertext)
    raw[Math.floor(raw.length / 2)] ^= 0x01
    env = { ...env, ciphertext: b64uOf(raw) } // ein gekipptes Bit — der AES-GCM-Tag muss es fangen
  }
  if (ch.faults.hold && !opts.replay) {
    ch.held.push({ toName: toPerson.name, env, kind: opts.kind })
    return { arrived: false, disp: 'held (fault) — parked on the channel', stages: [] }
  }
  if (!toPerson.online) {
    const q = ch.transit.get(toPerson.name) ?? []
    q.push(env)
    ch.transit.set(toPerson.name, q)
    return { arrived: false, disp: 'transit — device offline, delivery time is unbounded', stages: [] }
  }
  const insp = await inspect(toPerson, env)
  if (insp.disp) return { arrived: insp.disp === 'duplicate-known', disp: insp.disp, stages: insp.st }
  const r = (await dispatch(env)) ?? {}
  insp.st.push({ label: `5 dispatch → ${r.error ? 'rejected: ' + r.error : r.handled === false ? 'no handler took it' : 'effect applied'}`, ok: !r.error })
  // nur ABGESCHLOSSENE Effekte wandern in den Cache (Ablehnungen sind
  // wiederholbar — der Contract cached Effekte, keine Fehlversuche)
  if (!r.error) toPerson.deliveryCache.add(insp.digest)
  return { arrived: true, disp: r.error ? `failed(${r.error})` : 'unique', stages: insp.st, result: r }
}

// hold-Fault gelöst / Gerät wieder online: Geparktes nachliefern
export function drainHeld (ch) { return ch.held.splice(0) }
export function drainTransit (ch, name) {
  const q = ch.transit.get(name) ?? []
  ch.transit.set(name, [])
  return q
}
