// continuity.mjs — rltp-visibility §6a im Simulator: continuity-probe@1 +
// continuity-mapping@1. „Kontinuität wird NACH der Zeremonie aufgelöst,
// nie in ihr" (Encounter 4.4): jedes Enactment UND jede Vorstellung prägt
// ein frisches Tupel; ob es ein Wiedersehen war, klärt die Probe über den
// frischen Kanal — automatisch, ohne Dialog, ohne Namen.
//
// Die Probe ist das dritte Mitglied EINER Familie (Stern, Mapping, Probe:
// geblendete Werte unter Beziehungs-Schlüsseln): die EIGENEN bisherigen
// pair-Anker reisen als HMAC unter k_p (DH des NEUEN Kanals), gepolstert
// auf Vielfache von 256, sortiert, sequenziert. Nur wer eine der
// Beziehungen wirklich hält, kann matchen; ein leerer Bestand sendet
// trotzdem (sonst leakte die Abwesenheit die Kardinalität „null").
//
// Die Maschine (6a.4): EIN Wähler (Record-Seite = lexikographisch
// kleinerer neuer pair-Anker), EINE endgültige Wahl (eingefroren,
// Abweichung = Äquivokation), EIN Auslöser (Record-Seite kettet atomar
// mit ihrer Wahl; die Gegenseite NUR auf deren verifiziertes Mapping —
// ihr eigenes ist ein Match-Report). Kette: neues Tupel wird Kopf, das
// alte deaktiviert; Evidenz akkumuliert AUF DER BEZIEHUNG (✓ bleibt ✓),
// für Dritte unsichtbar. Wer die Probe nicht beantworten kann, IST
// protokollisch eine neue Beziehung (Identity 9.3).
import { jcs } from './rltp-core.mjs'
import * as C from './rltp-crypto.mjs'
import * as DV from './delivery.mjs'
import { hmac } from './trust.mjs'

const say = (p, m) => p.log.push(m)
const CHUNK = 256

// ── Schlüssel (Spec-Infostrings, richtungsgebunden) ─────────────────────
// k_p = HKDF(ECDH(newPairX_sender, newPairX_recipient),
//            'rltp/visibility/blind/probe/' + senderNewPair + '/' + recipientNewPair)
const kProbe = async (xPriv, theirKa, senderAnchor, recipientAnchor) =>
  C.hkdf(await C.ecdh(xPriv, C.xRawOfMk(theirKa)), 'rltp/visibility/blind/probe/' + senderAnchor + '/' + recipientAnchor)
const kMac = async (xPriv, theirKa, info) =>
  C.hkdf(await C.ecdh(xPriv, C.xRawOfMk(theirKa)), info)

// ── Schnappschuss-Helfer (Prior-Candidate-Set, Sicht des Halters) ───────
// wird von introduce.mjs BEI TUPEL-ERZEUGUNG aufgerufen: aktive Heads,
// das frische Tupel selbst ausgeschlossen; deaktivierte Glieder nie.
export const snapshotPriors = (p) => ({
  own: [...p.contacts.values()].filter((c) => !c.deactivated && c.channel?.own).map((c) => c.channel.own.anchor),
  counterpart: [...p.contacts.entries()].filter(([, c]) => !c.deactivated).map(([k]) => k),
})

// ── continuity-probe@1: bauen ───────────────────────────────────────────
export async function buildProbe (p, newKey, ent = {}) {
  const t = p.contacts.get(newKey)
  if (!t?.channel?.own) return null
  t.probeSeqOut = (t.probeSeqOut ?? 0) + 1
  const kp = await kProbe(t.channel.own.x.priv, t.channel.counterpartKa, t.channel.own.anchor, newKey)
  const entries = []
  for (const a of t.priorCands?.own ?? []) entries.push(await hmac(kp, a))
  // Polstern auf das nächste Vielfache von 256 (leerer Bestand → 1 Voll-Polster-Chunk)
  const total = Math.max(CHUNK, Math.ceil(entries.length / CHUNK) * CHUNK)
  while (entries.length < total) entries.push(C.b64uOf(ent.pad ?? C.rand(32)))
  entries.sort()
  const outbound = []
  for (let i = 0; i * CHUNK < entries.length; i++) {
    const body = { type: 'continuity-probe@1', probe: String(t.probeSeqOut), seq: String(i + 1), last: (i + 1) * CHUNK >= entries.length, blinded: entries.slice(i * CHUNK, (i + 1) * CHUNK) }
    outbound.push({ to: t, kind: 'continuity-probe@1 (geblendet, gepolstert, versiegelt)', env: await C.seal({ ...body, mac: await hmac(kp, jcs(body)) }, t.channel.counterpartKa, ent) })
  }
  say(p, `Kontinuitäts-Probe an ${t.name}: ${t.priorCands?.own.length ?? 0} eigene Beziehungs-Anker, geblendet + gepolstert (${entries.length})`)
  return outbound
}

// ── continuity-mapping@1: bauen ─────────────────────────────────────────
// prior = EIGENER alter pair-Anker · next = eigener neuer · to = neuer der
// Gegenseite; mac1 unter dem ALTEN Beziehungs-Schlüssel, mac2 unter dem
// NEUEN — nur derselbe Schlüssel-Inhaber kann beide (für die Adressatin
// fälschbar: Klasse V, abstreitbar).
async function buildMapping (p, newKey, oldKey, when, ent = {}) {
  const t = p.contacts.get(newKey), old = p.contacts.get(oldKey)
  const body = { type: 'continuity-mapping@1', prior: old.channel.own.anchor, next: t.channel.own.anchor, to: newKey, revision: '1', issuedAt: C.iso(when) }
  const msg = jcs(body)
  const doc = { ...body,
    mac1: await hmac(await kMac(old.channel.own.x.priv, old.channel.counterpartKa, 'rltp/visibility/mac/cont1'), msg),
    mac2: await hmac(await kMac(t.channel.own.x.priv, t.channel.counterpartKa, 'rltp/visibility/mac/cont2'), msg) }
  return { to: t, kind: 'continuity-mapping@1 (mac1 alt · mac2 neu, versiegelt)', env: await C.seal(doc, t.channel.counterpartKa, ent) }
}

// ── die Kette: neues Tupel wird Kopf, das alte deaktiviert ──────────────
// Tupel-Ebene bleibt (Stern-Salts, Probe-Sequenzen); KETTEN-Ebene wandert:
// Kontakt-Gedächtnis, Evidenz (✓ akkumuliert), Offenlegungen, Gruppen.
function chainTuple (p, newKey, oldKey) {
  const head = p.contacts.get(newKey), old = p.contacts.get(oldKey)
  if (!head || !old || old.deactivated) return false // idempotent
  old.deactivated = true
  old.chainedInto = newKey
  head.chain = [...(old.chain ?? []), oldKey]
  if (old.state === '✓' || head.state === '✓') { head.state = '✓'; head.provenance = 'ceremony' }
  else if (old.state === '⇄' || head.state === '⇄') head.state = '⇄'
  head.since = [old.since, head.since].filter(Boolean).sort()[0]
  head.name = old.name // lokales Kontakt-Gedächtnis
  head.selfAnchor ??= old.selfAnchor; head.mapping ??= old.mapping
  head.trustGiven ??= old.trustGiven; head.trustReceived ??= old.trustReceived
  head.trustPaused ??= old.trustPaused; head.sentMapping ??= old.sentMapping
  head.starReceived ??= old.starReceived; head.starInfo ??= old.starInfo
  head.sharedGroups = [...new Set([...(old.sharedGroups ?? []), ...(head.sharedGroups ?? [])])]
  say(p, `Kontinuität: ${head.name} wiedererkannt — neues Tupel an die Beziehung gekettet (${head.state}, ${head.chain.length + 1} Enactments)`)
  return true
}

// ── Empfangs-Dispatch ───────────────────────────────────────────────────
const iAmRecord = (t, newKey) => t.channel.own.anchor < newKey // lexikographisch kleinerer NEUER Anker
const tupleOf = (p, rkid) => {
  const ctx = p.contexts.get(rkid)
  if (!ctx) return null
  const e = [...p.contacts.entries()].find(([, c]) => c.channel?.own?.anchor === ctx.anchor)
  return e ? { key: e[0], t: e[1], ctx } : null
}

export async function receiveContinuity (p, env, when, ent = {}) {
  const opened = await DV.openEnvelope(p, env)                // Stufen 1–4, Cache-Lesung (lib-Parität)
  if (opened.duplicate) return { handled: true, duplicate: true }
  if (opened.error) return { handled: false }
  const r = await receiveContinuityInner(p, env, opened.doc, when, ent)
  if (r?.handled && !r.error) DV.effectDone(p, opened.digest)
  return r
}
async function receiveContinuityInner (p, env, doc, when, ent = {}) {
  const hit = tupleOf(p, env.rkid)
  if (!hit) return { handled: false }
  if (doc?.type === 'continuity-probe@1') return handleProbe(p, hit, doc, when, ent)
  if (doc?.type === 'continuity-mapping@1') return handleMapping(p, hit, doc, when, ent)
  return { handled: false, doc }
}

async function handleProbe (p, { key, t }, doc, when, ent) {
  // Senderseitiger k_p, aus Empfängersicht nachgerechnet (Richtung!)
  const kp = await kProbe(t.channel.own.x.priv, t.channel.counterpartKa, key, t.channel.own.anchor)
  const { mac, ...body } = doc
  if ((await hmac(kp, jcs(body))) !== mac) return { handled: true, error: 'probe mac' }
  if (Number(doc.probe) <= (t.probeSeqIn ?? 0)) return { handled: true, error: 'probe replay (nicht streng größer)' }
  // Chunk-Sammlung pro (Tupel, probe); höhere probe verwirft die offene
  if (t.probeAsm?.probe !== doc.probe) t.probeAsm = { probe: doc.probe, blinded: [] }
  t.probeAsm.blinded.push(...doc.blinded)
  if (!doc.last) return { handled: true, partial: true }
  // NUR LESEN — probeAsm und probeSeqIn werden erst konsumiert, wenn
  // alles Fehlbare (der Mapping-Bau unten) hinter uns liegt: sonst
  // schneidet ein transienter Seal-Fehler die Beziehung dauerhaft von
  // der Kettung ab, weil der Retry als Replay gilt (Review 5, B-1)
  const union = t.probeAsm.blinded
  const consume = () => { t.probeAsm = null; t.probeSeqIn = Number(doc.probe) }
  // Schnitt gegen die GEGENSEITEN-Anker des eigenen Prior-Candidate-Sets
  const matches = []
  for (const cp of t.priorCands?.counterpart ?? []) {
    if (union.includes(await hmac(kp, cp))) matches.push(cp)
  }
  if (!matches.length) { consume(); say(p, `Probe von ${t.name}: kein Match — ehrlich eine neue Beziehung`); return { handled: true, matches: 0 } }
  const outbound = []
  let chained = false
  if (iAmRecord(t, key)) {
    // Record-Seite: einmal wählen, endgültig; Mapping VOR der Wahl bauen
    // (lib-Review 4/B-2, Parität): scheitert es, ist nichts gewählt
    if (!t.contChosen) {
      const choice = matches[0] // Wahl frei — hier: erster Match (reichste Historie wäre App-Sache)
      const mapping = await buildMapping(p, key, choice, when, ent)
      consume()
      t.contChosen = choice
      chained = chainTuple(p, key, choice)
      outbound.push(mapping)
    } else consume()
  } else {
    // Nicht-Record: Match-Report (löst NIE eine Kette aus)
    if (!t.contReported) {
      const mapping = await buildMapping(p, key, matches[0], when, ent)
      consume()
      t.contReported = matches[0]
      outbound.push(mapping)
    } else consume()
  }
  return { handled: true, matches: matches.length, chained, name: chained ? t.name : undefined, outbound }
}

async function handleMapping (p, { key, t }, doc, when, ent) {
  const { mac1, mac2, ...body } = doc
  const fail = (why) => { say(p, `Kontinuitäts-Mapping verworfen: ${why}`); return { handled: true, error: why } }
  if (body.to !== t.channel.own.anchor) return fail('to ≠ eigener neuer Anker')
  if (body.next !== key) return fail('next ≠ neuer Anker der Gegenseite')
  // prior MUSS im Schnappschuss liegen (nie das frische Tupel, nie tiefere Kettenglieder)
  if (!(t.priorCands?.counterpart ?? []).includes(body.prior)) return fail('prior nicht im Prior-Candidate-Set')
  const old = p.contacts.get(body.prior)
  if (!old?.channel?.own) return fail('alte Beziehung ohne eigenen Kontext')
  const msg = jcs(body)
  if ((await hmac(await kMac(old.channel.own.x.priv, old.channel.counterpartKa, 'rltp/visibility/mac/cont1'), msg)) !== mac1) return fail('mac1 (alter Beziehungs-Schlüssel)')
  if ((await hmac(await kMac(t.channel.own.x.priv, t.channel.counterpartKa, 'rltp/visibility/mac/cont2'), msg)) !== mac2) return fail('mac2 (neuer Beziehungs-Schlüssel)')
  const senderIsRecord = key < t.channel.own.anchor
  const outbound = []
  if (senderIsRecord) {
    // Record-Freeze: abweichendes prior derselben (next,to) = Äquivokation
    if (t.contRecordPrior && t.contRecordPrior !== body.prior) return fail('Äquivokation — Record-Wahl ist eingefroren')
    const needAlign = !t.contAligned
    const mapping = needAlign ? await buildMapping(p, key, body.prior, when, ent) : null
    t.contRecordPrior = body.prior
    chainTuple(p, key, body.prior)
    if (needAlign && mapping) { t.contAligned = true; outbound.push(mapping) }
  } else {
    // Match-Report der Nicht-Record-Seite: darf die Wahl INFORMIEREN, kettet nie
    if (iAmRecord(t, key) && !t.contChosen) {
      const mapping = await buildMapping(p, key, body.prior, when, ent)
      t.contChosen = body.prior
      chainTuple(p, key, body.prior)
      outbound.push(mapping)
    }
  }
  return { handled: true, chained: p.contacts.get(body.prior)?.deactivated === true, name: t.name, outbound }
}
