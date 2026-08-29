// clock.mjs — die Simulations-Uhr (Baustein 8): EINE Zeit für alle
// Simulatoren, die vier Dinge zugleich kann.
//
//   LAUFEN    — mit einstellbarer Rate (1× … 3600×), damit Alterungen
//               echt werden: Challenge-Rotation bei PT5M, Ack-Fristen,
//               validUntil-Fenster. Ohne laufende Zeit sind das tote
//               Konstanten im Code.
//   SPRINGEN  — jeder Akt schiebt die Zeit um seinen Betrag weiter
//               (der Netzwerk-Sim tut das seit jeher mit +5 s), damit
//               ein Szenario ohne Warten durchgespielt werden kann.
//   DRIFTEN   — Skew PRO GERÄT (Port aus dem Zeremonie-Sim): jedes
//               Gerät liest eine andere Uhr, und die Toleranzfenster
//               des Delivery Contract müssen das aushalten. Skew ist
//               kein Fehler, sondern der Normalfall echter Geräte.
//   REPLAY    — deterministisch: im Replay-Modus liefert now() exakt
//               den geloggten Zeitpunkt statt der laufenden Zeit. Ein
//               Action-Log muss zur selben Welt führen wie beim ersten
//               Lauf — sonst divergiert die Wiedergabe stumm (der
//               graph.html-Befund vom 26.08.).
//
// DOM-frei; die UI abonniert per subscribe() und rendert selbst.
export const SECOND = 1000, MINUTE = 60 * SECOND, HOUR = 60 * MINUTE

export function createClock ({ start, rate = 0 } = {}) {
  const base = typeof start === 'number' ? start : Date.parse('2026-08-27T15:00:00Z')
  const c = {
    simBase: base,        // Sim-Zeit am letzten Ratenwechsel/Sprung
    wallBase: null,       // reale Zeit an derselben Marke (null = angehalten)
    rate,                 // 0 = angehalten; 1 = Echtzeit; 60 = eine Minute pro Sekunde
    skew: new Map(),      // deviceId -> Offset in ms
    pinned: null,         // Replay: die Zeit ist festgenagelt
    subs: new Set(),
    timer: null,
  }
  if (rate > 0) c.wallBase = Date.now()
  return c
}

const wall = () => Date.now()

// die Weltzeit: gepinnt (Replay) · laufend (Rate > 0) · stehend
export function now (c) {
  if (c.pinned !== null) return c.pinned
  if (c.rate > 0 && c.wallBase !== null) return c.simBase + (wall() - c.wallBase) * c.rate
  return c.simBase
}
// die Zeit, die EIN GERÄT liest — mit seinem eigenen Drift
export const deviceNow = (c, deviceId) => now(c) + (c.skew.get(deviceId) ?? 0)
export const skewOf = (c, deviceId) => c.skew.get(deviceId) ?? 0
export function setSkew (c, deviceId, ms) { c.skew.set(deviceId, ms); notify(c) }

// ein Akt schiebt die Zeit weiter (auch bei laufender Uhr korrekt:
// die Marke wandert mit, die Rate bleibt)
export function jump (c, ms) {
  c.simBase = now(c) + ms
  if (c.rate > 0) c.wallBase = wall()
  notify(c)
  return now(c)
}
export function setRate (c, rate) {
  c.simBase = now(c)          // erst die bisherige Zeit einfrieren …
  c.rate = rate               // … dann die neue Rate ab hier laufen lassen
  c.wallBase = rate > 0 ? wall() : null
  notify(c)
}

// ── Replay: die Zeit kommt aus dem Log, nicht von der Wanduhr ──────────
export function pin (c, when) { c.pinned = when; notify(c) }
export function unpin (c, resumeAt) {
  c.pinned = null
  if (typeof resumeAt === 'number') c.simBase = resumeAt
  if (c.rate > 0) c.wallBase = wall()
  notify(c)
}
// eine Aktion deterministisch wiedergeben: während fn() läuft, IST die
// Zeit `when` — egal ob die Uhr sonst läuft
export async function at (c, when, fn) {
  const before = c.pinned
  pin(c, when)
  try { return await fn() } finally { c.pinned = before; if (before === null) unpin(c, Math.max(now(c), when)) }
}

// ── Abonnement: die UI rendert, wenn die Zeit sich sichtbar bewegt ─────
export function subscribe (c, fn) { c.subs.add(fn); return () => c.subs.delete(fn) }
function notify (c) { for (const fn of c.subs) fn(now(c)) }
// bei laufender Uhr regelmäßig wecken (die UI braucht Takt, das Modell nicht)
export function start (c, everyMs = 500) {
  stop(c)
  c.timer = setInterval(() => { if (c.rate > 0) notify(c) }, everyMs)
  return c
}
export function stop (c) { if (c.timer) { clearInterval(c.timer); c.timer = null } }

// ── Alterung: der eine Ausdruck, den alle Fristen teilen ───────────────
// „ist X aus Sicht dieses Geräts älter als die Frist?" — Skew inklusive,
// damit ein driftendes Gerät nicht fälschlich zu früh altert
export const agedOut = (c, deviceId, sinceIso, maxAgeMs) =>
  deviceNow(c, deviceId) > Date.parse(sinceIso) + maxAgeMs
