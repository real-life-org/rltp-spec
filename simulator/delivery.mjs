// delivery.mjs — der Zustellkanal als Bibliotheksmodul (Baustein 7):
// die GENERISCHEN Empfangs-Stufen des Delivery Contract als sichtbare
// Inspektion, dazu Offline-Transit, Hold/Dup/Tamper/Lose-Faults und der
// completed-effect-Cache (duplicate-known, nie ein zweiter Effekt).
//
// Port aus der Zeremonie-Engine (index.html receive(), Stufen 1–4) in
// die modulare Welt: Stufe 1 Größenschranke VOR der Entschlüsselung ·
// Stufe 2 Envelope-Form (kanonisches base64url, epk 32 B, nonce 12 B,
// rkid bekannt) · Stufe 3 Entschlüsselung (X25519 + HKDF + AES-GCM-Tag) ·
// Stufe 4 Parse + Digest über die KANONISCHE Form + Duplikat-Cache.
// Die typ-spezifischen Stufen (Proofs, Bindungen, Effekte — „5–9")
// bleiben bei den App-Dispatchern (groups/trust/continuity/encounter):
// ihr Ergebnis wird als Abschluss-Stufe an derselben Inspektion notiert.
//
// Der Kanal ist DOM-frei und Welt-neutral — dieselbe Instanz trägt
// später den Gesamtsimulator.
import * as C from './rltp-crypto.mjs'

export function createChannel () {
  return {
    faults: { hold: false, dup: false, tamper: false, lose: false },
    held: [],                 // Zustellungen, die der hold-Fault parkt
    transit: new Map(),       // name -> [env] für Offline-Geräte
  }
}

const b64uLen = (s) => { try { return C.fromB64u(s).length } catch { return -1 } }
const canonical = (s) => { try { return typeof s === 'string' && C.b64uOf(C.fromB64u(s)) === s } catch { return false } }

// die generischen Stufen — reine Inspektion, konsumiert nichts
export async function inspect (toPerson, env) {
  const st = []
  const push = (label, ok) => { st.push({ label, ok }); return ok }
  // Stufe 1 kostet O(1): geschätzt aus der Stringlänge, VOR jedem
  // Decode — wie die Bibliothek (lib-Review 7 M-1, Parität)
  const ctEst = typeof env?.ciphertext === 'string' ? Math.floor(env.ciphertext.length * 3 / 4) : 0
  if (!push(`1 size bound: ciphertext − tag ≤ 65536 B (~${Math.max(0, ctEst - 16)} B)`, ctEst - 16 <= 65536)) return { st, disp: 'failed(oversize)' }
  const ctLen = b64uLen(env?.ciphertext ?? '')
  // GESCHLOSSENE Form wie die Bibliothek (lib-Review 6, M-1): exakt vier
  // Felder, Ciphertext ≥ 17 B (Tag + mindestens ein Byte)
  const closed = env !== null && typeof env === 'object' && !Array.isArray(env) && Object.keys(env).length === 4
  if (!push('2 envelope: closed form · base64url canonical · epk 32 B · nonce 12 B · ct ≥ 17 B · rkid known',
    closed && canonical(env.epk) && b64uLen(env.epk) === 32 && canonical(env.nonce) && b64uLen(env.nonce) === 12
    && canonical(env.ciphertext) && ctLen >= 17 && !!toPerson.contexts.get(env.rkid))) return { st, disp: 'failed(malformed)' }
  const ctx = toPerson.contexts.get(env.rkid)
  const open = await C.unseal(env, ctx.x.priv)
  if (!push('3 decryption · X25519 + HKDF(rltp/v1/seal) + AES-256-GCM tag', open.error !== 'decryption-failed' && open.error !== 'oversize')) return { st, disp: `failed(${open.error})` }
  if (open.error === 'malformed') { push('4 parse — invalid UTF-8 or not JSON', false); return { st, disp: 'failed(malformed)' } }
  const doc = open.document
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) { push('4 parse — not a JSON object', false); return { st, disp: 'failed(malformed)' } }
  let digest
  try { digest = await C.digestDoc(doc) } catch { push('4 parse — no canonical form', false); return { st, disp: 'failed(malformed)' } }
  push(`4 parse + digest ${digest.slice(0, 14)}… · completed-effect cache`, true)
  if ((toPerson.deliveryCache ??= new Set()).has(digest)) {
    st.push({ label: '  → duplicate-known · prior outcome applies, no second effect', ok: true })
    return { st, disp: 'duplicate-known', digest, doc }
  }
  return { st, disp: null, digest, doc }
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
    const raw = C.fromB64u(env.ciphertext)
    raw[Math.floor(raw.length / 2)] ^= 0x01
    env = { ...env, ciphertext: C.b64uOf(raw) } // ein gekipptes Bit — der AES-GCM-Tag muss es fangen
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

// jeder Empfänger tritt HIER ein (lib-Review 5 B-2, Parität zur
// Bibliothek): Stufen 1–4 + Cache-Lesung; effectDone schreibt den Cache
// nur für ABGESCHLOSSENE Effekte — Ablehnungen bleiben wiederholbar.
export async function openEnvelope (p, env) {
  const insp = await inspect(p, env)
  if (insp.disp === 'duplicate-known') return { duplicate: true, digest: insp.digest, doc: insp.doc }
  if (insp.disp) return { error: insp.disp }
  return { doc: insp.doc, digest: insp.digest }
}
export const effectDone = (p, digest) => { if (digest) (p.deliveryCache ??= new Set()).add(digest) }

// hold-Fault gelöst / Gerät wieder online: Geparktes nachliefern
export function drainHeld (ch) { return ch.held.splice(0) }
export function drainTransit (ch, name) {
  const q = ch.transit.get(name) ?? []
  ch.transit.set(name, [])
  return q
}
