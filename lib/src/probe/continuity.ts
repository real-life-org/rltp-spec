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
import { jcs, makeValidator } from '../core.js'
import { SCHEMAS } from '../schemas.js'
import * as C from './deps.js'
import type { Person } from './deps.js'
import { hmac, hmacU, reissueTrust, chainAdmission, withContactLock, withIssueLock } from './trust.js'
import { buildAck, ACK_TYPE } from './acks.js'

const say = (p: Person, m: string) => p.log.push(m)
const CHUNK = 256
const V = makeValidator(SCHEMAS)
const schemaOk = (file: string, data: any) => V.validate(data, SCHEMAS[file], SCHEMAS[file]).length === 0

// ── Schlüssel (Spec-Infostrings, richtungsgebunden) ─────────────────────
// k_p = HKDF(ECDH(newPairX_sender, newPairX_recipient),
//            'rltp/visibility/blind/probe/' + senderNewPair + '/' + recipientNewPair)
const kProbe = async (xPriv: CryptoKey, theirKa: string, senderAnchor: string, recipientAnchor: string) =>
  C.hkdf(await C.ecdh(xPriv, C.xRawOfMk(theirKa)!), 'rltp/visibility/blind/probe/' + senderAnchor + '/' + recipientAnchor)
const kMac = async (xPriv: CryptoKey, theirKa: string, info: string) =>
  C.hkdf(await C.ecdh(xPriv, C.xRawOfMk(theirKa)!), info)

// ── Schnappschuss-Helfer (Prior-Candidate-Set, Sicht des Halters) ───────
// wird von introduce.mjs BEI TUPEL-ERZEUGUNG aufgerufen: aktive Heads,
// das frische Tupel selbst ausgeschlossen; deaktivierte Glieder nie.
export const snapshotPriors = (p: Person) => ({
  own: [...p.contacts.values()].filter((c) => !c.deactivated && c.channel?.own).map((c) => c.channel.own.anchor),
  counterpart: [...p.contacts.entries()].filter(([, c]) => !c.deactivated).map(([k]) => k),
})

// ── continuity-probe@1: bauen ───────────────────────────────────────────
// Sequenzvergabe SYNCHRON (BigInt-String — 18 Stellen exakt), Bau je
// Kontakt serialisiert: zwei parallele buildProbe-Aufrufe teilen nie
// eine Sequenz, und der Wire-Wert ist der reservierte (Review 2, B-1)
const withContLock = withContactLock   // EIN Lock je Kontakt, geteilt mit trust (Review 4, B-1)
export async function buildProbe (p: Person, newKey: string, when: number, ent: any = {}) {
  const t = p.contacts.get(newKey)
  if (!t?.channel?.own || t.deactivated) return null   // deaktivierte Tupel stellen nichts aus (Review 8, B-2)
  return withContLock(t, async () => {
    if (t.deactivated) return null                     // Re-Check nach dem Lock-Erwerb
    // Sequenz nur GEPEEKT (Review 25): „assigning … and committing are
    // one step" — ein Bau-Fehler verbraucht nichts, auch am letzten
    // Wert entsteht nie falsche Erschöpfung; committet wird synchron
    // mit der Outbox (persisted atomically before send)
    const nextProbe = BigInt(t.probeSeqOut ?? '0') + 1n
    if (nextProbe > 10n ** 18n - 1n) throw new Error('scope exhausted — issues nothing further (2.1)')
    const probeSeq = String(nextProbe)
    const kp = await kProbe(t.channel.own.x.priv, t.channel.counterpartKa, t.channel.own.anchor, newKey)
    const entries = []
    // §6a: prior ist „nie das frische Tupel" — Hygiene am NUTZUNGSORT:
    // ein Host, der das Set nach der Tupel-Anlage (neu) schnappschießt,
    // darf keine Selbst-Kette provozieren können (Selbst-Match →
    // chainTuple(key, key) deaktivierte den eigenen Kopf)
    for (const a of t.priorCands?.own ?? []) if (a !== t.channel.own.anchor) entries.push(await hmacU(kp, a))
    // Polstern auf das nächste Vielfache von 256 (leerer Bestand → 1 Voll-Polster-Chunk);
    // KOLLISION → Neusampling (Review 6, MAJOR: „the padding value is
    // resampled") — ein injizierter ent.pad wird höchstens EINMAL
    // verwendet, Duplikate fallen auf frische Zufallswerte zurück
    const total = Math.max(CHUNK, Math.ceil(entries.length / CHUNK) * CHUNK)
    const used = new Set(entries)
    while (entries.length < total) {
      let v = 'u' + C.b64uOf(ent.pad ?? C.rand(32))
      while (used.has(v)) v = 'u' + C.b64uOf(C.rand(32))
      used.add(v)
      entries.push(v)
    }
    entries.sort()
    // Bau + Seal + Digest sind FEHLBAR und warten — vorbereiten, dann
    // Re-Check, dann Outbox-Schreibungen synchron (Review 9, B-3: ein
    // während der Awaits deaktiviertes Tupel stellt nichts aus)
    const preps = []
    const threadId = ent.threadId ?? globalThis.crypto.randomUUID()
    for (let i = 0; i * CHUNK < entries.length; i++) {
      const body = { type: 'continuity-probe@1', probe: probeSeq, seq: String(i + 1), last: (i + 1) * CHUNK >= entries.length, blinded: entries.slice(i * CHUNK, (i + 1) * CHUNK) }
      const artifact = { body, proof: { mac: await hmacU(kp, jcs(body)) } }
      const doc = { id: globalThis.crypto.randomUUID(), type: 'https://real-life.org/trust-tasks/continuity-probe/0.1', issuer: t.channel.own.anchor, recipient: newKey, threadId, issuedAt: C.iso(when), payload: artifact }
      const env = await C.seal(doc, t.channel.counterpartKa, ent)
      const digest = await C.digestDoc(doc)
      preps.push({ digest, env })
    }
    if (t.deactivated) return null   // Re-Check (B-3), danach kein await
    // COMMIT — Sequenz + Outbox in EINEM synchronen Zug (Review 25):
    // byte-identische Redelivery-Zuordnung fürs Ack-Matching (4.2;
    // erneut SENDEN tut ein Retry nie, §6a)
    t.probeSeqOut = probeSeq
    const outbound = []
    for (const { digest, env } of preps) {
      ;(t.outbox ??= new Map()).set(digest, { env, threadId, kind: 'continuity-probe' })
      outbound.push({ to: t, kind: 'continuity-probe/0.1 (geblendet, gepolstert, versiegelt)', env })
    }
    say(p, `Kontinuitäts-Probe an ${t.name}: ${t.priorCands?.own.length ?? 0} eigene Beziehungs-Anker, geblendet + gepolstert (${entries.length})`)
    return outbound
  })
}

// ── continuity-mapping@1: bauen ─────────────────────────────────────────
// prior = EIGENER alter pair-Anker · next = eigener neuer · to = neuer der
// Gegenseite; mac1 unter dem ALTEN Beziehungs-Schlüssel, mac2 unter dem
// NEUEN — nur derselbe Schlüssel-Inhaber kann beide (für die Adressatin
// fälschbar: Klasse V, abstreitbar).
// PREPARE (fehlbar: MACs, Seal, Digest — mutiert nichts) und COMMIT
// (synchron: Zähler + Outbox) getrennt (Review 12, B-2): die Record-
// Wahl kettet ATOMAR mit der Ausgabe ihres Mappings — beide Schritte
// liegen dann in EINEM synchronen Zug. Alle Aufrufer laufen unter dem
// Kontakt-Lock des Tupels (Handler + Flush), der die Revisionsvergabe
// serialisiert; buildMapping hält zusätzlich den Issue-Lock.
async function prepareContMapping (p: Person, newKey: string, oldKey: string, when: number, ent: any = {}, duty?: string) {
  const t = p.contacts.get(newKey), old = p.contacts.get(oldKey)
  if (t.deactivated) throw new Error('tuple deactivated — issues nothing (§6.4)')
  // 6.4/6a.4: Revision je (next, to) monoton — nur gepeekt, ein
  // Fehlschlag verbraucht nichts (§6.4: one step per scope)
  const nextRev = BigInt(t.contRevOut ?? '0') + 1n
  if (nextRev > 10n ** 18n - 1n) throw new Error('scope exhausted — issues nothing further (2.1)')
  const rev = String(nextRev)
  const body = { type: 'continuity-mapping@1', prior: old.channel.own.anchor, next: t.channel.own.anchor, to: newKey, revision: rev, issuedAt: C.iso(when) }
  const msg = jcs(body)
  const artifact = { body, proof: {
    mac1: await hmacU(await kMac(old.channel.own.x.priv, old.channel.counterpartKa, 'rltp/visibility/mac/cont1'), msg),
    mac2: await hmacU(await kMac(t.channel.own.x.priv, t.channel.counterpartKa, 'rltp/visibility/mac/cont2'), msg) } }
  const doc = { id: globalThis.crypto.randomUUID(), type: 'https://real-life.org/trust-tasks/continuity-mapping/0.1', issuer: t.channel.own.anchor, recipient: newKey, threadId: ent.threadId ?? globalThis.crypto.randomUUID(), issuedAt: C.iso(when), payload: artifact }
  const env = await C.seal(doc, t.channel.counterpartKa, ent)
  const digest = await C.digestDoc(doc)
  return { t, rev, env, digest, threadId: doc.threadId, duty, prior: old.channel.own.anchor }
}
const commitContMapping = (prep: any) => {
  prep.t.contRevOut = prep.rev
  ;(prep.t.outbox ??= new Map()).set(prep.digest, { env: prep.env, threadId: prep.threadId, kind: 'continuity-mapping', duty: prep.duty, prior: prep.prior })
  return { to: prep.t, kind: 'continuity-mapping/0.1 (mac1 alt · mac2 neu, versiegelt)', env: prep.env }
}
async function buildMapping (p: Person, newKey: string, oldKey: string, when: number, ent: any = {}, duty?: string) {
  const t = p.contacts.get(newKey)
  return withIssueLock(t, async () => {
    const prep = await prepareContMapping(p, newKey, oldKey, when, ent, duty)
    if (t.deactivated) throw new Error('tuple deactivated — issues nothing (§6.4)')  // Re-Check (B-2), danach kein await
    return commitContMapping(prep)
  })
}

// ── die Kette: neues Tupel wird Kopf, das alte deaktiviert ──────────────
// Visibility 0.29 §6.4: PER-TUPEL-ZUSTAND WANDERT NICHT — Grade,
// Stern-Salts, Baseline und empfangene Sterne sterben mit dem alten
// Kopf (der neue beginnt fail-closed; das Fenster schließen 5.5s
// Neuausstellung und das New-Head-Korollar von 5.4, nie eine
// Migration). KETTEN-Ebene wandert: Kontakt-Gedächtnis, Evidenz
// (✓ akkumuliert), das WISSEN um den offengelegten Anker (die
// Admissionsschicht hängt an der Beziehung), die eigene
// Vertrauens-ENTSCHEIDUNG (trustGiven) und die Pause.
function chainTuple (p: Person, newKey: string, oldKey: string, when: number) {
  const head = p.contacts.get(newKey), old = p.contacts.get(oldKey)
  if (!head || !old || head === old || old.deactivated) return false // idempotent; NIE Selbst-Kette (§6a)
  old.deactivated = true
  old.chainedInto = newKey
  head.chain = [...(old.chain ?? []), oldKey]
  if (old.state === '✓' || head.state === '✓') { head.state = '✓'; head.provenance = 'ceremony' }
  else if (old.state === '⇄' || head.state === '⇄') head.state = '⇄'
  head.since = [old.since, head.since].filter(Boolean).sort()[0]
  head.name = old.name // lokales Kontakt-Gedächtnis
  head.selfAnchor ??= old.selfAnchor      // Ketten-WISSEN: wer das ist (das Mapping selbst stirbt mit dem Tupel, §6.4)
  const oldRel = old.relId ?? oldKey
  // Admission (B-4): der neue Kopf löst über die überlebende Beziehung
  // auf; ein schon existierender Eintrag der frischen Beziehung
  // verschmilzt atomar (früheste Position, Aliase, k−1). Die
  // IDENTITÄT ist die des TATSÄCHLICH überlebenden Eintrags (Review
  // 36: „the merged relationship's identity is the surviving
  // entry's") — existiert nur der frische, bleibt DESSEN Identität;
  // existiert keiner, die des jüngsten Kopfs (Review 4, B-4)
  const survivor = chainAdmission(p, oldRel, newKey, newKey, when)
  // Ketten-Identität = die des Survivors NUR, wenn sie zu DIESER Kette
  // gehört (Review 36 + 37, B-1): die kanonische Identität eines
  // Weg-2-Merges gehört einer ANDEREN, weiterhin aktiven Beziehung —
  // Admission-Identität und Beziehungsstrang bleiben unterscheidbar,
  // der Abgang dieser Kette darf die andere nie mitreißen
  const sid = survivor?.id
  const sidInChain = sid !== undefined && (sid === oldRel || sid === newKey || (p.contacts.get(sid)?.relId ?? null) === oldRel)
  head.relId = sidInChain ? sid : (survivor ? oldRel : newKey)
  // die GANZE Kette identifiziert sich als DIESE Beziehung — auch der
  // alte Kopf (Review 36: der Abgang räumt sämtliche Ketten-Aliase)
  old.relId = head.relId
  head.trustGiven ??= old.trustGiven      // die Entscheidung gehört der Beziehung (V2)
  // 5.5: „MUST re-issue its most recently ISSUED grade" — der
  // Ordnungsstempel entscheidet, nie der zufällig frischere Kopf
  // (Review 27: setGrade auf dem alten Kopf NACH dem Trust-Akt des
  // frischen muss die Kettung überleben)
  if (old.gradeOutLast !== undefined && (head.gradeOutLast === undefined || (old.gradeOutOrder ?? 0n) > (head.gradeOutOrder ?? 0n))) {
    head.gradeOutLast = old.gradeOutLast
    head.gradeOutOrder = old.gradeOutOrder
  }
  // Pause ist chain-level und ÜBERLEBT die Kettung (Review 37, B-2):
  // der Zustand der Beziehung, auf die gekettet wird, gewinnt gegen
  // Vor-Kettungs-Akte des frischen Tupels
  head.trustPaused = old.trustPaused ?? head.trustPaused
  head.sharedGroups = [...new Set([...(old.sharedGroups ?? []), ...(head.sharedGroups ?? [])])]
  // NICHT migriert (per Tupel, stirbt mit dem alten Kopf):
  // trustReceived, starReceived, starInfo, starSaltIn, sentMapping,
  // sub (Baseline/inFlight), starSeqNext. Die 5.5-Neuausstellung ist
  // die stehende Pflicht des neuen Kopfs; ihr Producer ist
  // trust.reissueTrust via starRefreshAll.
  // die Pflicht entsteht, wenn eine DECLARATION ausgestellt war (5.5:
  // „a subject holding an issued declaration … MUST re-issue") — auch
  // ohne Trust-Akt (eigenständiges setGrade); Review 33, B-1
  if (head.trustGiven || head.gradeOutLast !== undefined) head.trustReissueDue = true
  say(p, `Kontinuität: ${head.name} wiedererkannt — neues Tupel an die Beziehung gekettet (${head.state}, ${head.chain.length + 1} Enactments)`)
  return true
}

// V2-Hook (5.5): direkt nach der Kettung wird die Neuausstellung
// versucht; ein Bau-Fehler lässt die Pflicht (trustReissueDue) stehen —
// ihr Producer ist starRefreshAll, nie eine Wiederzustellung.
async function v2Reissue (p: Person, newKey: string, when: number, ent: any, outbound: any[]): Promise<string | undefined> {
  const t = p.contacts.get(newKey)
  if (!t?.trustReissueDue) return undefined
  try {
    const r = await reissueTrust(p, newKey, when, ent)
    if (r) outbound.push(...r.outbound)
    return undefined
  } catch (e: any) { return String(e?.message ?? e) }
}

// ── Empfangs-Dispatch ───────────────────────────────────────────────────
const iAmRecord = (t: any, newKey: string) => t.channel.own.anchor < newKey // lexikographisch kleinerer NEUER Anker
const tupleOf = (p: Person, rkid: string) => {
  const ctx = p.contexts.get(rkid)
  if (!ctx) return null
  const e = [...p.contacts.entries()].find(([, c]) => c.channel?.own?.anchor === ctx.anchor)
  return e ? { key: e[0], t: e[1], ctx } : null
}

const TT_PROBE = 'https://real-life.org/trust-tasks/continuity-probe/0.1'
const TT_MAP = 'https://real-life.org/trust-tasks/continuity-mapping/0.1'
export async function receiveContinuity (p: Person, env: any, when: number, ent: any = {}) {
  const opened = await C.openEnvelope(p, env)                 // Stufen 1–4, Cache-Lesung
  if (opened.error) return { handled: false }
  const hit = tupleOf(p, env.rkid)
  if (!hit) return { handled: false }
  if (opened.duplicate) {
    // 4.2: byte-identischer Re-Ack innerhalb der Retention
    const stored = hit.t.ackStore?.get(opened.digest)
    return { handled: true, duplicate: true, ack: stored ? { to: hit.t, kind: 'delivery-ack/0.1 (Re-Ack, byte-identisch)', env: stored } : undefined }
  }
  const doc = opened.doc
  if (doc?.type !== TT_PROBE && doc?.type !== TT_MAP) return { handled: false, doc }
  // Dokumentprofil (Delivery §3) + Artefakt-Schema (Stufen 5/7)
  if (!schemaOk('rltp-delivery-document.schema.json', doc) || doc.proof !== undefined) return { handled: true, error: 'malformed document' }
  // Stufe 5: recipient; die issuer-Bindung (Stufe 8) läuft NACH den
  // Payload-Schemata (Review 32)
  if (doc.recipient !== hit.t.channel.own.anchor) return { handled: true, error: 'outer binding (recipient)' }
  // Kalender-Validität des DOKUMENTS (Review 12, B-3); die PAYLOAD-
  // Kalenderprüfung sitzt NACH dem Artefakt-Schema (Review 31)
  if (!C.calOK(doc.issuedAt)) return { handled: true, error: 'calendar-invalid issuedAt' }
  if (doc.type === TT_PROBE && !schemaOk('visibility-continuity-probe.schema.json', doc.payload)) return { handled: true, error: 'malformed probe' }
  if (doc.type === TT_MAP && !schemaOk('visibility-continuity-mapping.schema.json', doc.payload)) return { handled: true, error: 'malformed mapping' }
  if (doc.type === TT_MAP && !C.calOK(doc.payload?.body?.issuedAt)) return { handled: true, error: 'calendar-invalid issuedAt' }  // Stufe 8, nach dem Schema (Review 31)
  if (doc.issuer !== hit.key) return { handled: true, error: 'outer binding (issuer, Stufe 8)' }
  // Profil-Regel (Review 29/30): Stufe 8 NACH dem Payload-Schema —
  // ein präsentes ceremony.enactment kann bei diesen Payloads nie
  // nachrechnen (kein umschlossenes Bindungsmaterial) →
  // failed(validation-failed); andere Framework-Member passieren (§4.11.1)
  if (doc.ceremony?.enactment !== undefined) return { handled: true, error: 'ceremony.enactment kann nicht nachrechnen (validation-failed)' }
  // GESAMTER Empfang unter dem Kontakt-Lock (B-1: kein Rollback durch
  // parallele Handler); der Ack entsteht IN den Handlern nach der
  // vollen Validierung (M-2), Commit hier atomar mit Cache+Store
  return withContLock(hit.t, async () => {
    // §6.4: ein deaktiviertes Tupel nimmt nichts mehr an (Review 5, B-1)
    if (hit.t.deactivated) return { handled: true, error: 'tuple deactivated' }
    // Stage-4-Reentry nach Lock-Wartezeit: ein inzwischen verarbeitetes
    // Duplikat erhält den gespeicherten Ack byte-identisch
    if ((p.deliveryCache ?? new Set()).has(opened.digest!)) {
      const stored = hit.t.ackStore?.get(opened.digest)
      return { handled: true, duplicate: true, ack: stored ? { to: hit.t, kind: 'delivery-ack/0.1 (Re-Ack, byte-identisch)', env: stored } : undefined }
    }
    const mkAck = () => buildAck(p, hit.t, opened.digest!, doc.threadId, when).then((a: any) => a.env)
    // Effekt + completed-effect cache + gespeicherter Ack committen in
    // EINEM synchronen Zug IM Handler (Review 6, B-5: „inside the
    // effect's transaction") — die Outbound-PRODUKTION (buildMapping,
    // V2) läuft danach; ihr Scheitern hinterlässt eine Pflicht, nie
    // einen halben Empfangs-Commit
    const commitAck = (ackEnv: any) => {
      C.effectDone(p, opened.digest)
      ;(hit.t.ackStore ??= new Map()).set(opened.digest, ackEnv)
      return { to: hit.t, kind: 'delivery-ack/0.1', env: ackEnv }
    }
    return doc.type === TT_PROBE
      ? handleProbe(p, hit, doc.payload, doc.threadId, when, ent, mkAck, commitAck)
      : handleMapping(p, hit, doc.payload, when, ent, mkAck, commitAck)
  })
}

async function handleProbe (p: Person, { key, t }: any, artifact: any, threadId: string, when: number, ent: any, mkAck: () => Promise<any>, commitAck: (env: any) => any) {
  // Schema lief im Dispatch; hier die wertgebundenen Reste (M-3)
  const doc = artifact.body
  if (!C.intStr(doc.probe) || !C.intStr(doc.seq)   // NaN in probeSeqIn wäre Replay-Zustandskorruption (Review 9, P-B1)
    || doc.blinded.length !== 256)                 // die Chunkform ist FEST: genau 256 Einträge (Review 10, P-B1-Rest)
    return { handled: true, error: 'malformed probe' }
  // Senderseitiger k_p, aus Empfängersicht nachgerechnet (Richtung!)
  const kp = await kProbe(t.channel.own.x.priv, t.channel.counterpartKa, key, t.channel.own.anchor)
  if ((await hmacU(kp, jcs(doc))) !== artifact.proof.mac) return { handled: true, error: 'probe mac' }
  if (BigInt(doc.probe) <= BigInt(t.probeSeqIn ?? '0')) return { handled: true, error: 'probe replay (nicht streng größer)' }
  // VERGIFTETE Probe (Review 21): nach einem Assembly-Konflikt wird
  // KEIN weiterer Chunk dieser Lieferung quittiert — sonst
  // kombinieren früh geackte, verlorene Pufferwirkungen mit späteren
  // Acks zu einer falschen Completion (§6a.2 übernimmt die
  // 5.2a-Konfliktregeln in kind)
  if (t.probePoison?.has(doc.probe)) return { handled: true, error: 'probe vergiftet (assembly conflict)' }
  // Re-Check nach den MAC-Awaits (Review 6, B-1): die Assembly ist
  // Tupel-Zustand und nimmt nach einer Deaktivierung nichts mehr auf
  if (t.deactivated) return { handled: true, error: 'tuple deactivated' }
  // Chunk-Sammlung pro (Tupel, probe): LÜCKEN PUFFERN (Ankunftsreihen-
  // folge irrelevant, 5.2a in kind), nur eine STRIKT HÖHERE probe
  // verdrängt die offene, eine niedrigere wird verworfen; threadId-
  // Dissens verwirft; seq-Konflikt (andere Bytes) verwirft (byte-
  // identische Wiederholung fängt duplicate-known auf Envelope-Ebene).
  // Entscheidungen auf LOCALS (Review 6, B-1) — GESCHRIEBEN wird erst
  // nach Ack-Bau und letztem Re-Check, synchron mit dem Commit
  const cur = t.probeAsm
  const displaced = cur && BigInt(doc.probe) > BigInt(cur.probe)
  if (cur && !displaced && BigInt(doc.probe) < BigInt(cur.probe)) return { handled: true, error: 'below open probe assembly' }
  const a = (!cur || displaced) ? { probe: doc.probe, threadId, chunks: new Map(), lastSeq: undefined as string | undefined } : cur
  if (threadId !== a.threadId) { t.probeAsm = null; (t.probePoison ??= new Set()).add(doc.probe); return { handled: true, error: 'probe assembly conflict (threadId)' } }
  const seq = BigInt(doc.seq)
  if (a.chunks.has(doc.seq)) { t.probeAsm = null; (t.probePoison ??= new Set()).add(doc.probe); return { handled: true, error: 'probe assembly conflict (seq)' } }
  if (doc.last && a.lastSeq !== undefined) { t.probeAsm = null; (t.probePoison ??= new Set()).add(doc.probe); return { handled: true, error: 'probe assembly conflict (two last)' } }
  const candLast = doc.last ? doc.seq : a.lastSeq
  if (candLast !== undefined && seq > BigInt(candLast)) { t.probeAsm = null; (t.probePoison ??= new Set()).add(doc.probe); return { handled: true, error: 'seq beyond last' } }
  // auch BEREITS GEPUFFERTE Chunks oberhalb von last verwerfen die
  // Assembly (Review 16, B-1 — 5.2a in kind, Ankunftsreihenfolge egal)
  if (candLast !== undefined) for (const s of a.chunks.keys()) if (BigInt(s) > BigInt(candLast)) { t.probeAsm = null; (t.probePoison ??= new Set()).add(doc.probe); return { handled: true, error: 'seq beyond last (gepuffert)' } }
  // Komplettierung VOR dem Puffern vorhersagen (Review 5, B-4 — die
  // Star-Struktur gespiegelt): jeder NICHT-komplettierende Chunk (auch
  // ein früh eintreffender last:true) wird nach den Per-Chunk-Gates
  // quittiert und gepuffert; NUR der KOMPLETTIERENDE wartet auf die
  // Union-Validierung (M-2) — Ankunftsreihenfolge ist irrelevant (5.2a)
  const complete = candLast !== undefined && (() => {
    for (let i = 1n; i <= BigInt(candLast); i++) if (String(i) !== doc.seq && !a.chunks.has(String(i))) return false
    return true
  })()
  if (!complete) {
    const __ackEnv = await mkAck()
    if (t.deactivated) return { handled: true, error: 'tuple deactivated' }  // Re-Check (B-1), danach kein await
    t.probeAsm = a                               // Übernahme JETZT — synchron mit Puffern + Commit (B-5)
    if (doc.last) a.lastSeq = doc.seq
    a.chunks.set(doc.seq, doc.blinded)
    return { handled: true, partial: true, ack: commitAck(__ackEnv) }
  }
  // Union aus Puffer + aktuellem Chunk OHNE Mutation; globale
  // Sortierung + Duplikatfreiheit (§6a.2)
  const union: string[] = []
  for (let i = 1n; i <= BigInt(candLast!); i++) union.push(...(String(i) === doc.seq ? doc.blinded : a.chunks.get(String(i))))
  if (!union.every((x, i, arr) => i === 0 || arr[i - 1] < x)) { t.probeAsm = null; (t.probePoison ??= new Set()).add(doc.probe); return { handled: true, error: 'probe assembly invalid (order/duplicates)' } }
  // Schnitt gegen die GEGENSEITEN-Anker des eigenen Prior-Candidate-Sets
  // — reine Rechnung, VOR dem Ack-Bau, damit zwischen Re-Check und
  // Übernahme kein await mehr liegt (Review 5, B-1)
  const matches = []
  for (const cp of t.priorCands?.counterpart ?? []) {
    if (cp === key) continue   // §6a: das frische Tupel selbst ist NIE ein prior (Selbst-Ketten-Schutz)
    if (union.includes(await hmacU(kp, cp))) matches.push(cp)
  }
  const __ackEnv = await mkAck()   // JETZT ist alles validiert (M-2)
  if (t.deactivated) return { handled: true, error: 'tuple deactivated' }  // Re-Check (B-1), danach kein await bis zum Commit
  // Übernahme + Cache + Ack in EINEM synchronen Zug (B-5); die
  // Kettenwahl mutiert ebenfalls synchron — erst DANACH die fehlbare
  // Outbound-Produktion (ihr Scheitern hinterlässt eine Pflicht)
  t.probeAsm = null
  if (BigInt(doc.probe) > BigInt(t.probeSeqIn ?? '0')) t.probeSeqIn = doc.probe  // monoton (B-1)
  if (t.probePoison) for (const ps of t.probePoison) if (BigInt(ps) <= BigInt(t.probeSeqIn)) t.probePoison.delete(ps)  // Gift unterhalb des High-Water ist gegenstandslos
  const ack = commitAck(__ackEnv)
  if (!matches.length) { say(p, `Probe von ${t.name}: kein Match — ehrlich eine neue Beziehung`); return { handled: true, matches: 0, ack } }
  const outbound = []
  let chained = false
  let outboundError
  if (iAmRecord(t, key)) {
    // Record-Seite: einmal wählen, endgültig — „the record side chains
    // atomically with issuing its choice" (Review 12, B-2): erst das
    // Wahl-Mapping FEHLBAR vorbereiten, dann Wahl + Kette + Ausgabe in
    // EINEM synchronen Zug; scheitert die Vorbereitung, wird NICHT
    // gekettet und die volle Wahl-Pflicht bleibt stehen (Flush holt sie
    // atomar nach)
    if (!t.contChosen) {
      // Wahl frei — hier: der erste LEBENDE, KETTBARE Match (Review 19,
      // B-4: ein von einem konkurrierenden Tupel verbrauchter erster
      // Match blockiert die weiteren gültigen nicht; reichste Historie
      // wäre App-Sache). Kette ZUERST (Review 13, B-1): „chains
      // atomically with issuing its choice" heißt beides oder keins.
      for (const choice of matches) {
        if (p.contacts.get(choice)?.deactivated) continue   // toter prior → nächster Match
        let prep: any
        try { prep = await prepareContMapping(p, key, choice, when, ent) }
        catch (err: any) {
          // die Pflicht trägt ALLE Matches (Review 20, B-3): wird der
          // erste vor dem Flush unkettbar, versucht der Flush die
          // übrigen lebenden Kandidaten
          t.contMappingDue = { prior: choice, kind: 'choice', alts: matches.filter((x) => x !== choice) }
          outboundError = String(err?.message ?? err)
          break
        }
        if (t.deactivated || t.contChosen) break
        chained = chainTuple(p, key, choice, when)
        if (!chained) continue                              // Rennen verloren → nächster lebender Match
        t.contChosen = choice
        if (t.contMappingDue?.kind === 'choice') delete t.contMappingDue   // die alte Bau-Pflicht ist ERFÜLLT (Review 14, B-2)
        outbound.push(commitContMapping(prep))
        const v2Err = await v2Reissue(p, key, when, ent, outbound)
        if (v2Err) outboundError = outboundError ? outboundError + ' · ' + v2Err : v2Err
        break
      }
    }
  } else {
    // Nicht-Record: Match-Report (löst NIE eine Kette aus)
    if (!t.contReported) {
      t.contReported = matches[0]
      try { outbound.push(await buildMapping(p, key, matches[0], when, ent)) }
      catch (err: any) { t.contMappingDue = { prior: matches[0], kind: 'report' }; outboundError = String(err?.message ?? err) }
    }
  }
  return { handled: true, matches: matches.length, chained, name: chained ? t.name : undefined, outbound, outboundError, ack }
}

async function handleMapping (p: Person, { key, t }: any, artifact: any, when: number, ent: any, mkAck: () => Promise<any>, commitAck: (env: any) => any) {
  if (!C.shaped(artifact ?? {}, { body: 'object', proof: 'object' })
    || !C.shaped(artifact.body, { prior: 'string', next: 'string', to: 'string' })
    || typeof artifact.proof.mac1 !== 'string' || typeof artifact.proof.mac2 !== 'string') return { handled: true, error: 'malformed mapping' }
  const body = artifact.body
  const { mac1, mac2 } = artifact.proof
  const fail = (why: string) => { say(p, `Kontinuitäts-Mapping verworfen: ${why}`); return { handled: true, error: why } }
  if (body.to !== t.channel.own.anchor) return fail('to ≠ eigener neuer Anker')
  if (body.next !== key) return fail('next ≠ neuer Anker der Gegenseite')
  // prior MUSS im Schnappschuss liegen (nie das frische Tupel, nie tiefere Kettenglieder)
  if (body.prior === key) return fail('prior = frisches Tupel (§6a)')   // Selbst-Ketten-Schutz, auch bei vergiftetem Schnappschuss
  if (!(t.priorCands?.counterpart ?? []).includes(body.prior)) return fail('prior nicht im Prior-Candidate-Set')
  const old = p.contacts.get(body.prior)
  if (!old?.channel?.own) return fail('alte Beziehung ohne eigenen Kontext')
  const msg = jcs(body)
  if ((await hmacU(await kMac(old.channel.own.x.priv, old.channel.counterpartKa, 'rltp/visibility/mac/cont1'), msg)) !== mac1) return fail('mac1 (alter Beziehungs-Schlüssel)')
  if ((await hmacU(await kMac(t.channel.own.x.priv, t.channel.counterpartKa, 'rltp/visibility/mac/cont2'), msg)) !== mac2) return fail('mac2 (neuer Beziehungs-Schlüssel)')
  // 6.4, die GENERISCHE Revisionsregel im (next, to)-Scope (Review 11,
  // B-2): höher ersetzt · gleich + JCS-identischer Body = idempotenter
  // Repeat (No-op, geackt) · gleich + anderer Body = Äquivokation ·
  // niedriger = reject. Der Revisionsstand rückt erst NACH allen
  // Ablehnungsgründen vor (Record-Freeze gilt whatever its revision)
  if (BigInt(body.revision) === BigInt(t.contRevIn ?? '0')) {
    if (t.contBodyIn && msg === t.contBodyIn) {
      const __ackEnv = await mkAck()
      if (t.deactivated) return fail('tuple deactivated')
      return { handled: true, idempotent: true, ack: commitAck(__ackEnv) }
    }
    return fail('Äquivokation — gleiche Revision, anderer Body')
  }
  if (BigInt(body.revision) < BigInt(t.contRevIn ?? '0')) return fail('mapping revision (niedriger)')
  const senderIsRecord = key < t.channel.own.anchor
  // Record-Freeze VOR Ack und Revisionsstand (B-3): ein verworfenes
  // Dokument konsumiert weder Revision noch Krypto
  if (senderIsRecord && t.contRecordPrior && t.contRecordPrior !== body.prior) return fail('Äquivokation — Record-Wahl ist eingefroren')
  // §6a.4/6.4: „On verification of a record-side mapping, chain" —
  // wurde der genannte alte Kopf von einem KONKURRIERENDEN Tupel
  // gekettet, ist die Kette hier nicht möglich: ablehnen statt
  // Freeze + Ack + Alignment ohne Kette (Review 14, B-3). ABER: „a
  // head deactivated by THIS VERY chaining remains a valid prior for
  // this tuple" (Review 15) — eine höhere Revision derselben
  // eingefrorenen Wahl wird per 6.4 normal verarbeitet
  const priorTaken = () => old.deactivated && old.chainedInto !== key
  if (senderIsRecord && priorTaken()) return fail('prior von konkurrierendem Tupel gekettet (§6.4) — nicht kettbar')
  const __ackEnv = await mkAck()               // alle Gates bestanden — VOR der Mutation
  if (t.deactivated) return fail('tuple deactivated')  // Re-Check (B-1), danach kein await bis zum Commit
  if (senderIsRecord && priorTaken()) return fail('prior von konkurrierendem Tupel gekettet (§6.4) — nicht kettbar')  // Re-Check (B-3)
  // Effekt (Revision, Freeze, Kette) + Cache + Ack in EINEM synchronen
  // Zug (Review 6, B-5/B-1); die fehlbare Outbound-Produktion läuft
  // DANACH — ihr Scheitern hinterlässt die Pflicht (contMappingDue),
  // nie einen halben Commit
  t.contRevIn = body.revision
  t.contBodyIn = msg                       // für den Idempotenz-Vergleich (Review 11, B-2)
  const outbound: any[] = []
  let chainedNow = false                   // das ECHTE Kettenergebnis (Review 14, B-3), nie eine Ableitung
  const done = (extra: any = {}) => ({ handled: true, chained: chainedNow, name: t.name, outbound, ack, ...extra })
  let ack: any
  if (senderIsRecord) {
    t.contRecordPrior = body.prior
    // nach den Re-Checks garantiert kettbar ODER schon in GENAU dieses
    // Tupel gekettet (Re-Verifikation derselben Wahl, Review 15)
    chainedNow = chainTuple(p, key, body.prior, when) || old.chainedInto === key
    // „the non-record side's match-report duty … dies on verifying the
    // record side's mapping on that tuple" (Review 11, B-3): der alte
    // Match-Report wird retired — nie mehr gesendet (stale
    // counter-claim MUST NOT be sent), sein Ack-Ref bleibt erhalten
    for (const o of (t.outbox ?? new Map()).values()) if (o.kind === 'continuity-mapping' && o.duty !== 'align') o.retired = true
    if (t.contMappingDue?.kind === 'report') delete t.contMappingDue
    ack = commitAck(__ackEnv)
    if (!t.contAligned) {
      // ein noch UNQUITTIERTES Alignment wird byte-identisch erneut
      // gesendet (Review 16, B-2: „is resent — same revision,
      // idempotent by 6.4") — eine höhere Record-Revision derselben
      // Wahl prägt NIE eine zweite Alignment-Revision für dieselbe
      // offene Pflicht
      const pending = [...(t.outbox ?? new Map()).values()].find((o: any) => o.kind === 'continuity-mapping' && o.duty === 'align' && !o.retired)
      if (pending) outbound.push({ to: t, kind: 'continuity-mapping/0.1 (Retry, byte-identisch)', env: pending.env })
      else {
        // Produktion registriert in der Outbox; die Pflicht stirbt erst
        // mit dem QUITTIERTEN Dokument (Ack-Pfad setzt contAligned)
        try { outbound.push(await buildMapping(p, key, body.prior, when, ent, 'align')); if (t.contMappingDue?.prior === body.prior) delete t.contMappingDue }
        catch (err: any) { t.contMappingDue = { prior: body.prior, kind: 'align' }; return done({ outboundError: String(err?.message ?? err) }) }
      }
    }
    const v2Err = await v2Reissue(p, key, when, ent, outbound)
    if (v2Err) return done({ outboundError: v2Err })
  } else {
    // Match-Report der Nicht-Record-Seite: darf die Wahl INFORMIEREN,
    // kettet nie selbst. Die Record-Wahl darauf kettet ATOMAR mit der
    // Ausgabe ihres Mappings (Review 12, B-2): erst vorbereiten, dann
    // Wahl + Kette + Ausgabe synchron; Fehlschlag → volle Wahl-Pflicht
    if (iAmRecord(t, key) && !t.contChosen) {
      ack = commitAck(__ackEnv)   // der EMPFANGS-Effekt (Revision) committet unabhängig von der Wahl
      let prep: any
      try { prep = await prepareContMapping(p, key, body.prior, when, ent) }
      catch (err: any) { t.contMappingDue = { prior: body.prior, kind: 'choice' }; return done({ outboundError: String(err?.message ?? err) }) }
      if (t.deactivated || t.contChosen) return done()
      // Kette ZUERST (Review 13, B-1): scheitert sie, keine Wahl, keine Ausgabe
      chainedNow = chainTuple(p, key, body.prior, when)
      if (chainedNow) {
        t.contChosen = body.prior
        if (t.contMappingDue?.kind === 'choice') delete t.contMappingDue   // die alte Bau-Pflicht ist ERFÜLLT (Review 14, B-2)
        outbound.push(commitContMapping(prep))
        const v2Err = await v2Reissue(p, key, when, ent, outbound)
        if (v2Err) return done({ outboundError: v2Err })
      }
    } else {
      // NUR das Gegen-Mapping AUF DER GEWÄHLTEN Beziehung ist die
      // ALIGNMENT-Antwort (Review 14, B-1): body.prior = der eigene
      // alte Anker des Senders = unser Kontaktschlüssel der gewählten
      // alten Beziehung (t.contChosen). Ein Match-Report für eine
      // ANDERE gemeinsame Altbeziehung beantwortet die Wahl NICHT —
      // erst die echte Antwort beendet die Resend-Pflicht (retiren,
      // Ack-Ref bleibt; Review 13, B-2)
      if (t.contChosen && body.prior === t.contChosen) for (const o of (t.outbox ?? new Map()).values()) if (o.kind === 'continuity-mapping') o.retired = true
      ack = commitAck(__ackEnv)
    }
  }
  return done()
}

/**
 * The host's producing call for a mapping the receiver still owes
 * (review 6, B-3): a transient seal failure during probe/mapping
 * handling persists the obligation in contMappingDue; this call — not a
 * redelivery, which the freshness rule forbids — builds and returns it.
 */
export async function flushContinuity (p: Person, newKey: string, when: number, ent: any = {}) {
  const t = p.contacts.get(newKey)
  if (!t || t.deactivated) return { outbound: [] }   // Per-Tupel-Pflichten sterben mit dem Tupel (Review 8, B-2)
  // Retry-ENTSCHEIDUNG und Pflicht-Bau laufen unter dem Kontakt-Lock
  // (Review 12, B-1): der Empfang (der Reports retired) hält denselben
  // Lock — kein Fenster, in dem ein gestarteter Flush eine gerade
  // gestorbene Report-Pflicht doch noch ausstellt („a match report
  // flushed after the choice … MUST NOT be sent"). Nur der frische
  // Probe-Neubau läuft danach (buildProbe nimmt denselben Lock selbst).
  const r: any = await withContactLock(t, async () => {
    if (t.deactivated) return { outbound: [] }
    // unquittierte MAPPINGS: byte-identischer Retry (4.2), retired nie
    // (gestorbene Match-Report-Pflicht, Review 11, B-3). PROBEN nie
    // byte-identisch — §6a: „a resend is always a fresh probe sequence
    // with freshly sampled padding" (Review 5, B-3): stale Einträge
    // werden RETIRED (Ack-Ref bleibt, Review 6, B-3), EINE frische
    // Probe ersetzt sie (Bau nach der Lock-Sektion)
    const retries: any[] = [...(t.outbox ?? new Map()).values()]
      .filter((o: any) => o.kind === 'continuity-mapping' && !o.retired)
      .map((o: any) => ({ to: t, kind: o.kind + '/0.1 (Retry, byte-identisch)', env: o.env }))
    const staleProbes = [...(t.outbox ?? new Map()).values()].filter((o: any) => o.kind === 'continuity-probe' && !o.retired)
    let probeDue = false
    if (staleProbes.length) { for (const o of staleProbes) o.retired = true; probeDue = true }
    if (!t.contMappingDue) return { outbound: retries, probeDue }
    // Single-Flight (Review 7, B-3): zwei parallele Flushes liefern nie
    // zwei Mappings für EINE Pflicht
    if (t.contFlushPending) return { outbound: retries, pending: true, probeDue }
    t.contFlushPending = true
    try {
      const due = t.contMappingDue
      // eine Choice-Pflicht nach bereits GEFALLENER Wahl ist tot
      // (Review 14, B-2): der Direktpfad hat sie erfüllt oder ersetzt —
      // sie darf NIE in den generischen Bau fallen (der eine frische
      // Revision prägte statt der Same-Revision-Wiederholung)
      if (due.kind === 'choice' && t.contChosen) {
        if (t.contMappingDue === due) delete t.contMappingDue
        return { outbound: retries, probeDue }
      }
      if (due.kind === 'choice' && !t.contChosen) {
        // die nachgeholte RECORD-WAHL kettet atomar mit der Ausgabe
        // (Review 12, B-2) und ITERIERT alle bekannten Matches
        // (Review 20, B-3): erster lebender, kettbarer Kandidat
        // gewinnt; sind alle tot, stirbt die Pflicht ehrlich
        // ungekettet (spätere Probes wählen neu). Ein Bau-Fehler
        // wirft → der äußere catch hält die Pflicht am Leben.
        const cands = [...new Set([due.prior, ...(due.alts ?? [])])]
        for (const cand of cands) {
          if (p.contacts.get(cand)?.deactivated) continue
          const prep = await prepareContMapping(p, newKey, cand, when, ent)
          if (t.deactivated) return { outbound: retries, probeDue }
          if (t.contChosen) break
          if (!chainTuple(p, newKey, cand, when)) continue   // Rennen verloren → nächster Kandidat
          t.contChosen = cand
          retries.push(commitContMapping(prep))
          break
        }
        if (t.contMappingDue === due) delete t.contMappingDue
        return { outbound: retries, probeDue }
      }
      const mapping = await buildMapping(p, newKey, due.prior, when, ent, due.kind)
      // der Flush stellt GENAU den Zustand her, den der gelungene
      // Direktpfad hinterlassen hätte — kind-bewusst. Und er löscht NUR
      // die Pflicht, die er selbst gebaut hat: ist während des await
      // eine NEUERE an ihre Stelle getreten, bleibt sie stehen (Review
      // 8, B-3); aligned setzt erst der ACK — hier stirbt die BAU-Pflicht
      if (t.contMappingDue === due) delete t.contMappingDue
      return { outbound: [...retries, mapping], probeDue }
    } catch (err: any) {
      return { outbound: retries, probeDue, outboundError: String(err?.message ?? err) }
    } finally { t.contFlushPending = false }
  })
  if (r.probeDue) {
    try { r.outbound.push(...(await buildProbe(p, newKey, when, { ...ent, pad: undefined, threadId: undefined }) ?? [])) }
    catch (err: any) { r.outboundError = r.outboundError ? r.outboundError + ' · ' + String(err?.message ?? err) : String(err?.message ?? err) }
  }
  delete r.probeDue
  return r
}
