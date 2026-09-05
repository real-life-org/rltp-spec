// GENERATED from lib/dist by scripts/build-simulator-lib.mjs — DO NOT EDIT.
// Source of truth: lib/src/*.ts. CI enforces freshness (--check).
// trust — der GRADUIERTE Vertrauensakt: seit dem Nachzug auf Visibility
// 0.29 + Delivery 0.79 baut dieses Modul die ECHTEN Wire-Artefakte
// (anchor-mapping@2 · grade-declaration@1 · star@1 mit 5.2a-Chunks),
// getragen von den registrierten Task-Dokumenten (Delivery §4.4:
// anchor-mapping/0.1 · grade-declaration/0.1 · star/0.1 — Payload = das
// Artefakt, Dokument proof-frei, ein Träger), quittiert mit dem
// deniablen delivery-ack (4.2-Klassenregel). Formen und Schlüssel sind
// byte-kompatibel zu vectors/visibility.json (vectors3.test.mjs rechnet
// sie unabhängig nach).
//
// Die Zustandsmaschinen sind die konvergierten:
//   · Admissionsschicht (Sektion 2): Promotion-Commit beim ERSTEN
//     verifizierten anchor-mapping@2 einer BEZIEHUNG (relId = die
//     Kette, der Idempotenzschlüssel); genau ein Eintrag je Beziehung,
//     self-Korrektur per höherer Revision in place; gleiche self auf
//     zweiter Beziehung = Weg-2-Merge (früheste Position überlebt,
//     Aliase); EINE totale Verifikations-Commit-Ordnung (a.seq).
//   · Rekonziliation (5.4): Sicht = {(member, grade)} der admittierten,
//     unmaskierten Mitglieder (Maske: 24h grade-wait ab Admission, fällt
//     mit verifizierter Declaration oder Ablauf → fail-closed count);
//     Baseline-Automat monoton über Ack-Completions, highWater überlebt
//     ⊥, kein Failure-Ereignis, nie Rollback.
//   · Byte-identische Redelivery (4.2): jede unquittierte Zustellung
//     wird als DASSELBE Dokument erneut gesendet (outbox hält die Envs);
//     der Empfänger re-ackt duplicate-known byte-identisch (ackStore).
import { jcs, makeValidator, sameDigest } from '../core.js';
import { SCHEMAS } from '../schemas.js';
import * as C from './deps.js';
import { buildAck, verifyAck, ACK_TYPE } from './acks.js';
const te = new TextEncoder();
const S = globalThis.crypto.subtle;
const TT = 'https://real-life.org/trust-tasks/';
const say = (p, m) => p.log.push(m);
const uuid = (ent) => ent ?? globalThis.crypto.randomUUID();
const V = makeValidator(SCHEMAS);
const schemaOk = (file, data) => V.validate(data, SCHEMAS[file], SCHEMAS[file]).length === 0;
export const GRADE_WAIT = 86_400_000; // 5.4: PT24H, in when-Millisekunden
export const ADMISSION_BOUND = 10n ** 18n - 1n; // Sektion 2 — unerreichbar, geführt für die Totalität
const CHUNK_MAX = 1024; // 5.2a: blinded[] je Chunk
// ── Primitiven ──────────────────────────────────────────────────────────
export async function hmac(keyBytes, msg) {
    const k = await S.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return C.b64uOf(new Uint8Array(await S.sign('HMAC', k, te.encode(msg))));
}
export const hmacU = async (keyBytes, msg) => 'u' + await hmac(keyBytes, msg);
export async function communityContext(p) {
    if (!p.selfCtx)
        p.selfCtx = await C.communityContext(p.rootIkm, p.communityGenesis);
    return p.selfCtx;
}
export const selfCard = async (p, whenIso) => {
    const s = await communityContext(p);
    return C.signCard(s, C.cardBody(s, { name: p.name }), whenIso);
};
// self-card@1 (§6.2): { body: {type, anchor, keyAgreement}, proof:
// {proofValue} } — ROHE Ed25519-Signatur über JCS(body), 'z'+base58
// (§2.1: bewusst KEINE DI-Suite; zwei Artefakt-Familien)
export async function selfCard1(p) {
    const s = await communityContext(p);
    const body = { type: 'self-card@1', anchor: s.anchor, keyAgreement: s.keyAgreement };
    const sig = new Uint8Array(await S.sign({ name: 'Ed25519' }, s.ed.priv, te.encode(jcs(body))));
    return { body, proof: { proofValue: 'z' + C.base58(sig) } };
}
const verifyRawSig = async (did, body, proofValue) => {
    try {
        if (typeof proofValue !== 'string' || proofValue[0] !== 'z')
            return false;
        const raw = C.edRawOfAnchor(did);
        const sig = C.fromBase58(proofValue.slice(1));
        if (!raw || !sig || sig.length !== 64)
            return false;
        const key = await S.importKey('raw', raw, { name: 'Ed25519' }, false, ['verify']);
        return await S.verify({ name: 'Ed25519' }, key, sig, te.encode(jcs(body)));
    }
    catch {
        return false;
    }
};
const chShared = (contact) => C.ecdh(contact.channel.own.x.priv, C.xRawOfMk(contact.channel.counterpartKa));
const relKey = async (contact, info) => C.hkdf(await chShared(contact), info);
// ── anchor-mapping@2 — die normative Wire-Form (§6.1–6.3) ──────────────
// body = { type, pair, self, to, card, revision, issuedAt } ·
// proof = { mac1 (Kanal-DH, info map1) · mac2 (selfX × pairX-Adressat,
// info map2) }, beide 'u'-MACs über JCS(body). Die Card reist IM Body.
// der reine BAU (fehlbar, mutiert nichts) — modul-lokal: nur Aufrufer,
// die den Issue-Lock halten und selbst committen (setTrust/
// reissueTrust), erreichen ihn mit vorreservierter Revision. Der
// explizite Revisionspfad ist NICHT mehr exportiert (Review 9, B-2:
// er umging Lock, Deaktivierungs-Check und Persistenz).
async function buildMappingArtifact(p, contact, counterpartAnchor, when, revision) {
    const s = await communityContext(p);
    const whenIso = C.iso(when);
    const card = await selfCard1(p);
    const body = { type: 'anchor-mapping@2', pair: contact.channel.own.anchor, self: s.anchor, to: counterpartAnchor, card, revision, issuedAt: whenIso };
    const msg = jcs(body);
    const theirKa = C.xRawOfMk(contact.channel.counterpartKa);
    return { body, proof: {
            mac1: await hmacU(await relKey(contact, 'rltp/visibility/mac/map1'), msg),
            mac2: await hmacU(await C.hkdf(await C.ecdh(s.x.priv, theirKa), 'rltp/visibility/mac/map2'), msg)
        } };
}
export async function makeMapping(p, counterpartAnchor, when) {
    const contact = p.contacts.get(counterpartAnchor);
    // Ausstellungs-Disziplin (Review 8/9): Peek → fehlbar bauen →
    // Zähler UND Body synchron committen (sentMapping = der persistierte
    // ausgestellte Body, §6.4: one step per scope), seriell je Kontakt;
    // ein deaktiviertes Tupel stellt nichts aus
    return withIssueLock(contact, async () => {
        if (contact.deactivated)
            throw new Error('tuple deactivated — issues nothing (§6.4)');
        const revision = peekRev(contact, 'mapRevOut');
        const m = await buildMappingArtifact(p, contact, counterpartAnchor, when, revision);
        if (contact.deactivated)
            throw new Error('tuple deactivated — issues nothing (§6.4)');
        contact.mapRevOut = revision;
        contact.sentMapping = m;
        return m;
    });
}
// Verifikation ist EMPFÄNGER-PRIVAT (§6.3, geschlossene Liste) — und
// die Liste wird IN IHRER REIHENFOLGE ausgewertet (Review 19, B-1:
// „all of the following hold, evaluated in this order"): 1 Schema ·
// 2 to · 3 pair · 4 Card verifiziert unter IHREM Anker · 5
// card.anchor == self · 6 k2 aus card.keyAgreement · 7 MACs.
// arrivalKey = das Ankunftstupel (Empfangspfad); standalone wählt
// body.pair (Schritt 3 dann trivial).
export async function verifyMapping(p, m, arrivalKey) {
    try {
        if (!schemaOk('visibility-anchor-mapping.schema.json', m))
            return false; // 1
        const b = m.body;
        if (!C.calOK(b.issuedAt))
            return false; // Kalender-Validität gehört zur Parse-Ebene (Review 12, B-3)
        const key = arrivalKey ?? b.pair;
        const entry = p.contacts.get(key);
        if (!entry?.channel?.own || entry.deactivated)
            return false;
        if (b.to !== entry.channel.own.anchor)
            return false; // 2
        if (b.pair !== key)
            return false; // 3 (Cross-Tupel-Bindung, Review 9)
        if (!(await verifyRawSig(b.card?.body?.anchor, b.card?.body, b.card?.proof?.proofValue)))
            return false; // 4: unter IHREM Anker
        if (b.card.body.anchor !== b.self)
            return false; // 5
        const msg = jcs(b);
        const k2 = await C.hkdf(await C.ecdh(entry.channel.own.x.priv, C.xRawOfMk(b.card.body.keyAgreement)), 'rltp/visibility/mac/map2'); // 6: k2 aus card.keyAgreement — VOR den MACs (Review 20, B-1)
        if ((await hmacU(await relKey(entry, 'rltp/visibility/mac/map1'), msg)) !== m.proof.mac1)
            return false; // 7 (mac1)
        if ((await hmacU(k2, msg)) !== m.proof.mac2)
            return false; // 7 (mac2)
        return true;
    }
    catch {
        return false;
    }
}
// Abstreitbarkeits-Demo: der Empfänger fabriziert ein identisch
// verifizierendes Mapping — ein Leak beweist Dritten nichts (Klasse V)
export async function forgeMapping(forger, victimCard, pairAnchor, when) {
    const entry = forger.contacts.get(pairAnchor);
    const whenIso = C.iso(when);
    const body = { type: 'anchor-mapping@2', pair: pairAnchor, self: victimCard.body.anchor, to: entry.channel.own.anchor, card: victimCard, revision: '1', issuedAt: whenIso };
    const msg = jcs(body);
    const k2 = await C.hkdf(await C.ecdh(entry.channel.own.x.priv, C.xRawOfMk(victimCard.body.keyAgreement)), 'rltp/visibility/mac/map2');
    return { body, proof: {
            mac1: await hmacU(await relKey(entry, 'rltp/visibility/mac/map1'), msg),
            mac2: await hmacU(k2, msg)
        } };
}
// ── die Admissionsschicht (Sektion 2) ───────────────────────────────────
const relIdOf = (p, contactKey) => {
    const c = p.contacts.get(contactKey);
    return c ? (c.relId ??= contactKey) : contactKey;
};
// Bound testbar: p.admissionBound (BigInt) überschreibt den
// unerreichbaren Spec-Bound — die MECHANIK (pending, k−1, Departure)
// ist dieselbe (Sektion 2, „the rule exists for totality")
const admission = (p) => (p.admission ??= { seq: 0n, byRel: new Map(), admitted: 0n });
const boundOf = (p) => p.admissionBound ?? ADMISSION_BOUND;
// grade-wait läuft nur ab, wenn ein Admissionszeitpunkt EXISTIERT
// (Review 5, MAJOR): jede Zustandsoperation verlangt eine endliche Uhr
const finite = (when) => {
    if (!Number.isFinite(when))
        throw new Error('admission requires a finite clock (5.4 grade-wait)');
    return when;
};
// Scope-Preflight (Review 5, B-5): prüft OHNE zu verbrauchen — ein Akt,
// der in einem erschöpften Scope ausstellen müsste, suspendiert atomar
const scopeOk = (cur) => BigInt(cur ?? '0') < ADMISSION_BOUND;
// EIN atomarer Merge zweier Einträge: früheste Position überlebt,
// Aliase lösen auf, Grade nach commitOrder; k admitted → k−1 Slots
// frei → die nächsten Pending admittieren (Set-Änderung via reconcile)
function mergeEntries(p, a, survivorIn, goneIn, when) {
    const survivor = goneIn.pos < survivorIn.pos ? goneIn : survivorIn;
    const gone = survivor === goneIn ? survivorIn : goneIn;
    for (const rid of gone.relIds) {
        survivor.relIds.add(rid);
        a.byRel.set(rid, survivor);
    }
    for (const ck of gone.rels)
        survivor.rels.add(ck);
    // Declarations bleiben je Herkunftstupel (B-2): höchste order je Tupel
    for (const [ck, g] of gone.grades ?? []) {
        const cur = survivor.grades?.get(ck);
        if (!cur || g.order > cur.order)
            (survivor.grades ??= new Map()).set(ck, g);
    }
    // NUMERISCHES Minimum (Review 22): admittedAt ist eine Zahl — der
    // Default-Sort verglich Strings (9 > 10) und konnte den grade-wait
    // des verschmolzenen Members fälschlich verlängern
    survivor.admittedAt = [survivor.admittedAt, gone.admittedAt].filter((x) => x !== undefined).sort((x, y) => x - y)[0];
    if (survivor.status === 'admitted' && gone.status === 'admitted') {
        a.admitted -= 1n;
        admitPending(p, a, when);
    }
    else if (gone.status === 'admitted') {
        survivor.status = 'admitted';
    }
    return survivor;
}
const admitPending = (p, a, when) => {
    // k−1-Nachrücken in Promotion-Commit-Ordnung (Sektion 2)
    while (a.admitted < boundOf(p)) {
        const next = [...new Set(a.byRel.values())].filter((x) => x.status === 'pending').sort((x, y) => x.pos < y.pos ? -1 : 1)[0];
        if (!next)
            break;
        next.status = 'admitted';
        next.admittedAt = when;
        a.admitted += 1n;
    }
};
/** Departure (Sektion 2): der Abgang EINER Beziehung entfernt nur
 *  ihren Alias — „the relationships themselves remain fully active"
 *  (Review 16, B-3): der verschmolzene Eintrag (und sein Slot) stirbt
 *  erst mit der LETZTEN Beziehung */
export function departMember(p, relId, when) {
    finite(when);
    const a = admission(p);
    const e = a.byRel.get(relId);
    if (!e)
        return;
    // die KETTE ist EINE Beziehung (Review 35): ihr Abgang entfernt auch
    // die Ketten-Aliase (byRel-Schlüssel, deren Kontakt sich als DIESE
    // Beziehung identifiziert — z. B. der frische Tupelschlüssel nach
    // einer Kettung mit vorbestehendem Eintrag); Aliase ANDERER
    // Beziehungen (Weg-2-Merge) bleiben
    for (const rid of [...e.relIds]) {
        if (rid === relId || (p.contacts.get(rid)?.relId ?? rid) === relId) {
            e.relIds.delete(rid);
            a.byRel.delete(rid);
        }
    }
    e.relIds.delete(relId);
    a.byRel.delete(relId);
    // der Grade-Strang der GEGANGENEN Beziehung stirbt mit ihr (Review
    // 17, B-1): „across the member's LIVE relationships' active heads" —
    // Kontaktschlüssel dieser Beziehung verlassen die effektive
    // Grade-Auswertung atomar mit dem Departure
    for (const ck of [...e.rels]) {
        const c = p.contacts.get(ck);
        if ((c?.relId ?? ck) === relId) {
            e.rels.delete(ck);
            e.grades?.delete(ck);
        }
    }
    if (e.relIds.size > 0)
        return; // Aliase bleiben, der Member bleibt admittiert
    if (e.status === 'admitted') {
        a.admitted -= 1n;
        admitPending(p, a, when);
    }
}
export function promotionCommit(p, relId, self, contactKey, when) {
    finite(when);
    const a = admission(p);
    let e = a.byRel.get(relId);
    if (e) {
        // spätere Verifikation derselben Beziehung: in place — auch eine
        // self-KORREKTUR per höherer Revision ändert nur den Inhalt, nie
        // Position oder Status (Sektion 2). Trifft die Korrektur die self
        // einer ANDEREN Beziehung, ist das der Weg-2-Merge
        if (e.self !== self) {
            const twin = [...a.byRel.values()].find((x) => x !== e && x.self === self);
            if (twin) {
                e.self = self;
                e = mergeEntries(p, a, e, twin, when);
            }
            else
                e.self = self;
        }
        e.rels.add(contactKey);
    }
    else {
        // gleiche self auf einer ANDEREN Beziehung = der Weg-2-Merge
        const twin = [...a.byRel.values()].find((x) => x.self === self);
        if (twin) {
            twin.relIds.add(relId);
            twin.rels.add(contactKey);
            a.byRel.set(relId, twin);
            e = twin;
        }
        else {
            // Admission ist TOTAL: unter dem Bound admitted (der Normalfall —
            // die Promotion selbst ist die Admission), am Bound
            // deliverable-pending (triggert nichts, rückt bei Abgang nach)
            const status = a.admitted < boundOf(p) ? 'admitted' : 'pending';
            if (status === 'admitted')
                a.admitted += 1n;
            e = { id: relId, pos: (a.seq += 1n), relIds: new Set([relId]), self, rels: new Set([contactKey]), status, admittedAt: status === 'admitted' ? when : undefined, grades: new Map() }; // id = kanonische Identität (Review 36)
            a.byRel.set(relId, e);
        }
    }
    return e;
}
/** Kettung (B-4): der neue Kopf löst über die überlebende Beziehung auf;
 *  hält die frische Beziehung schon einen EIGENEN Eintrag, verschmilzt
 *  er atomar mit dem der alten (früheste Position, Aliase, k−1) */
export function chainAdmission(p, survivingRelId, freshRelId, newContactKey, when) {
    finite(when);
    const a = admission(p);
    const oldE = a.byRel.get(survivingRelId);
    const freshE = a.byRel.get(freshRelId);
    let e = oldE;
    if (oldE && freshE && oldE !== freshE)
        e = mergeEntries(p, a, oldE, freshE, when);
    else if (!oldE && freshE) {
        e = freshE;
        freshE.relIds.add(survivingRelId);
        a.byRel.set(survivingRelId, freshE);
    }
    if (e) {
        e.relIds.add(freshRelId);
        a.byRel.set(freshRelId, e);
        e.rels.add(newContactKey);
    }
    return e;
}
// Declarations je HERKUNFTSTUPEL (Review 5, B-2): §6.4 — „a deactivated
// head's declarations are dead with their tuple". order = dieselbe
// totale Verifikations-Commit-Ordnung wie die Promotions.
// order stammt aus dem Moment der VERIFIKATION (Review 6, B-2): eine
// vor dem Mapping verifizierte Declaration trägt ihren Stempel schon
// und erhält beim späteren Commit KEINEN neuen — sonst schlüge sie
// nach einem Merge eine echt später verifizierte Declaration
const declCommit = (p, relId, grade, contactKey, order) => {
    const e = admission(p).byRel.get(relId);
    if (e)
        (e.grades ??= new Map()).set(contactKey, { grade, order: order ?? (admission(p).seq += 1n) });
    return e;
};
// die effektive Grade beim LESEN über die aktiven Köpfe berechnet —
// Deaktivierung tötet die Declaration ohne Migrations- oder Aufräumlogik
const effectiveGrade = (p, e) => {
    let best = null;
    for (const [ck, g] of e.grades ?? []) {
        const c = p.contacts.get(ck);
        if (!c || c.deactivated)
            continue;
        if (!best || g.order > best.order)
            best = g;
    }
    return best;
};
/**
 * Die Rekonziliations-Sicht (5.4): {(member, grade)} der admittierten,
 * unmaskierten Mitglieder. Maske: keine verifizierte Declaration UND
 * grade-wait (24h ab Admission) offen → nicht in der Sicht; nach
 * Ablauf fail-closed 'count'.
 */
export function viewOf(p, when) {
    const seen = new Set();
    const out = [];
    for (const e of admission(p).byRel.values()) {
        if (seen.has(e))
            continue;
        seen.add(e);
        if (e.status !== 'admitted')
            continue; // deliverable-pending triggert nichts (Sektion 2)
        const g = effectiveGrade(p, e); // nur AKTIVE Köpfe zählen (B-2)
        if (g)
            out.push({ member: e.self, grade: g.grade });
        // Grenzzeitpunkt: „the window elapses only strictly afterwards" —
        // bei exakter Gleichheit bleibt maskiert (Review 11, B-4)
        else if (e.admittedAt === undefined || when <= e.admittedAt + GRADE_WAIT)
            continue; // provisorisch maskiert (B-3)
        else
            out.push({ member: e.self, grade: 'count' });
    }
    return out.sort((x, y) => x.member < y.member ? -1 : x.member > y.member ? 1 : 0);
}
// ── star@1 — die normative Wire-Form (5.2/5.2a) ────────────────────────
const kStar = (contact, counterpartAnchor, salt) => relKey(contact, `rltp/visibility/blind/star/${contact.channel.own.anchor}/${counterpartAnchor}/${salt}`);
const kStarIn = (contact, counterpartAnchor, salt) => relKey(contact, `rltp/visibility/blind/star/${counterpartAnchor}/${contact.channel.own.anchor}/${salt}`);
// reine Berechnung: die 5.2a-Chunk-Serie einer Zustellung — count zählt
// ALLE Mitglieder der Sicht, blinded[] nur die blinded-graded Teilmenge
async function buildStarChunks(contact, counterpartAnchor, salt, view) {
    const k = await kStar(contact, counterpartAnchor, salt);
    const blinded = [];
    for (const v of view)
        if (v.grade === 'blinded')
            blinded.push(await hmacU(k, v.member));
    blinded.sort();
    const count = String(view.length);
    const n = Math.max(1, Math.ceil(blinded.length / CHUNK_MAX));
    const chunks = [];
    for (let i = 0; i < n; i++) {
        const body = { type: 'star@1', salt, seq: String(i + 1), last: i === n - 1, count, blinded: blinded.slice(i * CHUNK_MAX, (i + 1) * CHUNK_MAX) };
        chunks.push({ body, proof: { mac: await hmacU(k, jcs(body)) } });
    }
    return chunks;
}
export async function buildStar(p, contact, when) {
    if (contact.deactivated)
        return null; // deaktivierte Tupel stellen nichts aus (Review 9, B-3)
    return withStarLock(contact, async () => {
        if (contact.deactivated)
            return null; // Re-Check nach dem Lock-Erwerb
        const salt = peekStarSeq(contact); // nur gepeekt (Review 25)
        const key = [...p.contacts.entries()].find(([, c]) => c === contact)?.[0];
        // dieselbe Commit-Revalidierung wie reconcile (Review 26): wanderte
        // die Sicht während der MAC-Awaits, wird mit der aktuellen neu
        // gebaut — „every delivery carries the set current at its
        // production commit"
        for (;;) {
            const view = viewOf(p, when);
            const chunks = await buildStarChunks(contact, key, salt, view);
            if (contact.deactivated)
                return null; // Re-Check nach den MAC-Awaits (Review 10) — danach kein await
            if (!sameView(view, viewOf(p, when)))
                continue;
            contact.starSeqNext = salt; // COMMIT synchron mit der Ausgabe
            return chunks[0].body;
        }
    });
}
// Empfängerseite: denselben Lieferschlüssel nachrechnen, EINEN Anker testen
export async function starMatch(p, entry, snap, anchor) {
    const key = [...p.contacts.entries()].find(([, c]) => c === entry)?.[0];
    const k = await kStarIn(entry, key, snap.salt);
    return snap.blinded.includes(await hmacU(k, anchor));
}
export async function refreshStarInfo(p) {
    for (const [key, entry] of p.contacts) {
        if (!entry.starReceived || !entry.channel?.own)
            continue;
        const known = [];
        const seen = new Set();
        for (const [k2, e] of p.contacts) {
            if (k2 === key || !e.selfAnchor || seen.has(e.selfAnchor))
                continue;
            seen.add(e.selfAnchor);
            if (await starMatch(p, entry, entry.starReceived, e.selfAnchor))
                known.push(e.name);
        }
        entry.starInfo = { count: entry.starReceived.count, knownNames: known.sort() }; // count bleibt String — 18 Stellen exakt
    }
}
// ── grade-declaration@1 (5.5) ──────────────────────────────────────────
const kGrade = (subjectCtx, holderKa, subjectAnchor, holderAnchor) => C.ecdh(subjectCtx.x.priv, C.xRawOfMk(holderKa)).then((sh) => C.hkdf(sh, `rltp/visibility/mac/grade/${subjectAnchor}/${holderAnchor}`));
// revision IMMER vorreserviert (gepeekt) vom Aufrufer, der den
// Issue-Lock hält und den Zähler synchron committet (Review 8, B-1:
// kein Defaultpfad, der vor fehlbarer Arbeit verbraucht)
async function buildGradeDecl(p, counterpartAnchor, grade, when, revision) {
    const contact = p.contacts.get(counterpartAnchor);
    const body = { type: 'grade-declaration@1', subject: contact.channel.own.anchor, holder: counterpartAnchor, grade, revision, issuedAt: C.iso(when) };
    const k = await kGrade(contact.channel.own, contact.channel.counterpartKa, body.subject, body.holder);
    return { body, proof: { mac: await hmacU(k, jcs(body)) } };
}
// ── Dokumente, Outbox, byte-identische Redelivery (Delivery §3/4.2/4.4) ─
// Payload = das Artefakt selbst; das Dokument trägt KEINEN Proof (die
// Artefakt-MACs sind der eine Träger). threadId frisch je Zustellung;
// Chunks eines Salts teilen sie. Die outbox hält jede unquittierte
// Zustellung als DENSELBEN Env — Redelivery ist byte-identisch (4.2).
const outboxOf = (contact) => (contact.outbox ??= new Map());
async function sendDoc(p, counterpartAnchor, slug, payload, when, threadId, meta = {}, ent = {}) {
    const contact = p.contacts.get(counterpartAnchor);
    const doc = {
        id: uuid(ent.id), type: TT + slug + '/0.1',
        issuer: contact.channel.own.anchor, recipient: counterpartAnchor,
        threadId, issuedAt: C.iso(when), payload,
    };
    const env = await C.seal(doc, contact.channel.counterpartKa, ent);
    const digest = await C.digestDoc(doc);
    outboxOf(contact).set(digest, { env, threadId, kind: slug, ...meta });
    return { to: contact, kind: slug + '/0.1', env };
}
// ── die Ausstellungs-Disziplin (Review 7, B-1/B-2) ─────────────────────
// „Assigning a revision and persisting the issued body are one step per
// scope" (§6.4): je Kontakt serialisiert EIN Issue-Lock alle
// Revisions-Producer; die Revision wird nur GEPEEKT, alles Fehlbare
// (Bau, Seal, Digest) läuft davor, und Zähler + Outbox + Zustand
// committen in EINEM synchronen Zug am Ende — ein Fehlschlag
// verbraucht NICHTS, und gradeOutLast folgt der Ausstellungsordnung.
export const withIssueLock = (contact, fn) => {
    const run = (contact.issueLock ?? Promise.resolve()).then(fn, fn);
    contact.issueLock = run.catch(() => { });
    return run;
};
export const peekRev = (contact, field) => {
    const next = BigInt(contact[field] ?? '0') + 1n;
    if (next > ADMISSION_BOUND)
        throw new Error('scope exhausted — issues nothing further (2.1)');
    return String(next);
};
// prepare (fehlbar: Seal + Digest) / commit (synchron: Outbox-Eintrag)
async function prepareDoc(p, counterpartAnchor, slug, payload, when, threadId, meta = {}, ent = {}) {
    const contact = p.contacts.get(counterpartAnchor);
    const doc = {
        id: uuid(ent.id), type: TT + slug + '/0.1',
        issuer: contact.channel.own.anchor, recipient: counterpartAnchor,
        threadId, issuedAt: C.iso(when), payload,
    };
    const env = await C.seal(doc, contact.channel.counterpartKa, ent);
    const digest = await C.digestDoc(doc);
    return { contact, digest, entry: { env, threadId, kind: slug, ...meta }, out: { to: contact, kind: slug + '/0.1', env } };
}
const commitDoc = (prep) => { outboxOf(prep.contact).set(prep.digest, prep.entry); return prep.out; };
// Salt nur GEPEEKT (Review 25): strikt monoton, nie dicht (5.2) —
// aber „taking the set snapshot, assigning the salt, and committing
// are one step": ein Bau-Fehler verbraucht nichts, auch am letzten
// Wert entsteht nie falsche Erschöpfung. Der Aufrufer committet
// synchron mit der Persistenz (unter dem Star-Lock serialisiert).
const peekStarSeq = (contact) => {
    const next = BigInt(contact.starSeqNext ?? '0') + 1n;
    if (next > ADMISSION_BOUND)
        throw new Error('scope exhausted — issues nothing further (2.1)');
    return String(next);
};
// EIN Lock je Kontakt für Produktion UND Empfang, geteilt mit dem
// Continuity-Pfad (Review 4, B-1/B-2: Trust- und Continuity-Effekte
// desselben Kontakts serialisieren gemeinsam; Reentry-Checks im Lock)
export const withContactLock = (contact, fn) => {
    const run = (contact.contLock ?? Promise.resolve()).then(fn, fn);
    contact.contLock = run.catch(() => { });
    return run;
};
const withStarLock = withContactLock;
// der Baseline-Automat (5.4, totale Tabelle): completion(salt), sobald
// JEDER Chunk-Digest des Salts quittiert ist
const subOf = (contact) => (contact.sub ??= { highWater: 0n, baseline: null, inFlight: new Map() });
const sameView = (a, b) => a.length === b.length && a.every((x, i) => x.member === b[i].member && x.grade === b[i].grade);
/**
 * reconcile (5.4 — die eine Regel): divergiert die Sicht von der
 * Baseline (⊥ = divergent, das New-Head-Korollar), und ist nicht
 * pausiert, wird der AKTUELLE Stand geliefert — an JEDEM weiteren
 * Delivery-Kontakt unter frischem, höherem Salt (5.4 wörtlich,
 * Review 23; Salts sind ausdrücklich nicht dicht). Es gibt keinen
 * Same-View-Retry; die 4.4-Byte-Identität ist eine Formvorschrift
 * für Chunk-Retries, keine Anordnung.
 */
export async function reconcile(p, counterpartAnchor, when, ent = {}) {
    const contact = p.contacts.get(counterpartAnchor);
    if (!contact || contact.deactivated || !contact.trustGiven || contact.trustPaused)
        return null;
    return withStarLock(contact, async () => {
        // Re-Check nach dem Lock-Erwerb (Review 9 B-3 / Review 11 B-1):
        // auch die Pause — „while paused, the delivery duty is suppressed"
        if (contact.deactivated || contact.trustPaused)
            return null;
        let view = viewOf(p, when);
        const s = subOf(contact);
        if (s.baseline && sameView(s.baseline, view))
            return null;
        // überholte In-Flight-Salts (≤ highWater) sind tot: der Empfänger
        // MUSS sie ablehnen — purgen, nie wiederverwenden (Review 2, B-7)
        for (const [salt, f] of [...s.inFlight]) {
            if (BigInt(salt) <= s.highWater) {
                for (const d of f.pending.keys())
                    outboxOf(contact).delete(d);
                s.inFlight.delete(salt);
            }
        }
        // KEIN Same-View-Retry (Review 23, B-1): 5.4 wörtlich — „a
        // delivery whose chunks are never all acknowledged … simply never
        // completes … and the next available delivery contact ships the
        // current view under a fresh, higher salt." Die 4.4-Byte-
        // Identitäts-Regel ist eine FORMVORSCHRIFT für den Fall eines
        // Chunk-Retries, keine Anordnung eines solchen — jeder weitere
        // Delivery-Kontakt prägt frisch und höher (Salts sind ausdrücklich
        // nicht dicht). So löst der Sender auch ein beim Empfänger
        // vergiftetes in-flight-Salt ab, ohne je vom Gift zu wissen; alte
        // Ack-Referenzen bleiben bis zur Completion-Purge sicher stehen.
        const salt = peekStarSeq(contact); // nur gepeekt (Review 25) — committet synchron mit Outbox + inFlight
        const threadId = ent.threadId ?? globalThis.crypto.randomUUID();
        // „taking the set snapshot, assigning the salt, and committing are
        // one step" (Review 9, B-4): der Bau ist fehlbar und wartet — am
        // Commit wird die Sicht SYNCHRON neu verglichen; wanderte sie
        // während des Baus (Promotion/Declaration eines ANDEREN Kontakts),
        // wird mit der aktuellen Sicht neu gebaut, unter demselben Salt
        // (nichts wurde persistiert). Jede Zustellung trägt so den Stand
        // ihres Production-Commits.
        for (;;) {
            const chunks = await buildStarChunks(contact, counterpartAnchor, salt, view);
            const preps = [];
            for (const chunk of chunks)
                preps.push(await prepareDoc(p, counterpartAnchor, 'star', chunk, when, threadId, { salt }, ent));
            // Re-Check (Review 9 B-3 / Review 11 B-1), danach kein await:
            // eine während des Baus gesetzte Pause supprimiert die Zustellung
            if (contact.deactivated || contact.trustPaused)
                return null;
            const now = viewOf(p, when);
            if (!sameView(view, now)) {
                view = now;
                if (s.baseline && sameView(s.baseline, view))
                    return null; // konvergiert während des Baus → Schweigen
                continue;
            }
            // COMMIT — ein synchroner Zug: Salt + Outbox + inFlight + Sicht
            contact.starSeqNext = salt;
            const pending = new Map();
            const envs = [];
            for (const prep of preps) {
                const out = commitDoc(prep);
                pending.set(prep.digest, { env: out.env });
                envs.push(out.env);
            }
            s.inFlight.set(salt, { view, pending, threadId });
            return { to: contact, kind: 'star/0.1', envs, salt };
        }
    });
}
// die eigene Grade-ENTSCHEIDUNG trägt einen Ausstellungs-Ordnungsstempel
// (Review 27): beim Chaining gewinnt die ZULETZT AUSGESTELLTE („MUST
// re-issue its most recently issued grade"), nie die des zufällig
// frischeren Kopfs
export const stampGradeOut = (p, contact, grade) => {
    contact.gradeOutLast = grade;
    contact.gradeOutOrder = (p.gradeIssueSeq = (p.gradeIssueSeq ?? 0n) + 1n);
};
// ── der Vertrauensakt (register no. 3: EIN menschlicher Akt) ────────────
// setTrust stellt aus: anchor-mapping@2 (Offenlegung) + grade-
// declaration@1 'blinded' (die Wahl) — zwei registrierte Dokumente.
// Der Stern folgt über reconcile (5.4: die Promotion der Gegenseite
// erzeugt dort die Divergenz; hier entsteht nur die eigene Sicht).
export async function setTrust(p, counterpartAnchor, when, ent = {}) {
    const contact = p.contacts.get(counterpartAnchor);
    if (!contact)
        return { error: 'kein Kontakt' };
    if (!contact.channel?.own)
        return { error: 'kein eigener Kanal — einseitig (◇) hast du nichts freigegeben' };
    // GANZER Akt unter dem Issue-Lock (Review 7, B-1/B-2): Revisionen
    // werden nur gepeekt, alles Fehlbare läuft davor, Zähler + Outbox +
    // Zustand committen synchron am Ende — ein Seal-Fehler verbraucht
    // NICHTS, und kein Producer schiebt sich zwischen Peek und Commit
    return withIssueLock(contact, async () => {
        // ein deaktiviertes Tupel stellt nichts aus (Review 8, B-2 —
        // §6.4/„a chain append is atomic with the deactivation"): geprüft
        // nach dem Lock-Erwerb UND synchron vor dem Commit
        if (contact.deactivated)
            return { error: 'tuple deactivated — Kopf der Beziehung ist gewandert' };
        if (contact.trustGiven)
            return { error: 'bereits geschenkt (Einweg-Tür)' };
        if (contact.trustPending)
            return { error: 'bereits unterwegs (Einweg-Tür)' }; // Latch (Review 6, B-1)
        if (!scopeOk(contact.mapRevOut) || !scopeOk(contact.gradeRevOut))
            return { error: 'scope exhausted — act suspended (2.1)' };
        contact.trustPending = true;
        try {
            const mapRev = peekRev(contact, 'mapRevOut');
            const gradeRev = peekRev(contact, 'gradeRevOut');
            const whenIso = C.iso(when);
            const mapping = await buildMappingArtifact(p, contact, counterpartAnchor, when, mapRev);
            const grade = await buildGradeDecl(p, counterpartAnchor, 'blinded', when, gradeRev);
            const prepM = await prepareDoc(p, counterpartAnchor, 'anchor-mapping', mapping, when, uuid(ent.threadId), {}, ent);
            const prepG = await prepareDoc(p, counterpartAnchor, 'grade-declaration', grade, when, uuid(), {}, ent);
            if (contact.deactivated)
                return { error: 'tuple deactivated — Kopf der Beziehung ist gewandert' }; // Re-Check (B-2), danach kein await
            // COMMIT — ein synchroner Zug (§6.4: assigning + persisting = one step)
            contact.mapRevOut = mapRev;
            contact.gradeRevOut = gradeRev;
            const outbound = [commitDoc(prepM), commitDoc(prepG)];
            contact.trustGiven = whenIso;
            stampGradeOut(p, contact, 'blinded'); // die zuletzt ausgestellte Entscheidung (für V2), mit Ordnungsstempel
            contact.sentMapping = mapping;
            say(p, `Vertrauen geschenkt an ${contact.name}: Anker offengelegt (anchor-mapping@2) + Grade 'blinded' erklärt`);
            return { to: contact, outbound, env: outbound[0].env };
        }
        finally {
            contact.trustPending = false;
        }
    });
}
/**
 * setGrade (5.5): die spätere Grade-Entscheidung des Subjekts — auch
 * 'count' (die Wahl gehört dem Kontakt; register no. 3 kollabiert sie
 * nur im Default-UX). Producer der Declaration, Revision monoton.
 */
export async function setGrade(p, counterpartAnchor, grade, when, ent = {}) {
    const contact = p.contacts.get(counterpartAnchor);
    if (!contact?.channel?.own || contact.deactivated)
        return { error: 'kein aktiver Kanal' };
    return withIssueLock(contact, async () => {
        // Re-Check nach dem Lock-Erwerb (Review 8, B-2): eine Kettung
        // während der Wartezeit deaktiviert dieses Tupel — es stellt nichts
        // mehr aus, gradeOutLast des neuen Kopfs bleibt die Wahrheit
        if (contact.deactivated)
            return { error: 'tuple deactivated — Kopf der Beziehung ist gewandert' };
        const gradeRev = peekRev(contact, 'gradeRevOut'); // wirft bei Erschöpfung, verbraucht nichts (B-1)
        const g = await buildGradeDecl(p, counterpartAnchor, grade, when, gradeRev);
        const prep = await prepareDoc(p, counterpartAnchor, 'grade-declaration', g, when, uuid(), {}, ent);
        if (contact.deactivated)
            return { error: 'tuple deactivated — Kopf der Beziehung ist gewandert' }; // Re-Check (B-2), danach kein await
        // COMMIT — ein synchroner Zug (Review 7, B-1)
        contact.gradeRevOut = gradeRev;
        const out = commitDoc(prep);
        stampGradeOut(p, contact, grade);
        say(p, `Grade '${grade}' erklärt an ${contact.name}`);
        return { to: contact, outbound: [out] };
    });
}
// Pause (5.4): initial unpaused, EINZIGE Transition ist dieser Akt;
// Unpause re-evaluiert die Divergenz (Producer: starRefreshAll)
export function setTrustPaused(p, counterpartAnchor, paused) {
    const contact = p.contacts.get(counterpartAnchor);
    if (!contact?.trustGiven)
        return;
    contact.trustPaused = !!paused;
    say(p, paused ? `Kontakt-Updates an ${contact.name} pausiert (Geliefertes bleibt)` : `Kontakt-Updates an ${contact.name} wieder aktiv`);
}
/**
 * V2 (5.5): auf dem neuen Kopf stellt das Subjekt seinen zuletzt
 * ausgestellten Grade neu aus — Revision startet im neuen Tupel-Scope,
 * keine Nutzerfrage; das Mapping reist als MAY (6a.4) mit. Die Pause
 * supprimiert dies NICHT (5.5 kennt keine Pause-Ausnahme — sie
 * supprimiert nur die Stern-Delivery); die Pflicht (trustReissueDue)
 * stirbt erst mit der QUITTIERTEN Zustellung der Declaration.
 */
export async function reissueTrust(p, counterpartAnchor, when, ent = {}) {
    const contact = p.contacts.get(counterpartAnchor);
    // Gate: eine AUSGESTELLTE Declaration ODER der Trust-Akt trägt die
    // Pflicht (Review 33, B-1) — nie nur trustGiven
    if (!contact?.channel?.own || contact.deactivated || (!contact.trustGiven && contact.gradeOutLast === undefined))
        return null;
    // KEINE Pause-Suppression (Review 12, B-4): 5.4 supprimiert die
    // DELIVERY-Pflicht (Stern); die Register-5-Neuausstellung läuft
    // „on the next available delivery contact" ohne Pause-Ausnahme (5.5)
    if (contact.reissuePending)
        return null; // Single-Flight
    contact.reissuePending = true;
    try {
        return await withIssueLock(contact, async () => {
            if (contact.deactivated)
                return null; // Re-Check nach dem Lock-Erwerb (Review 8, B-2)
            // unquittierte Neuausstellung → byte-identischer Retry
            for (const [digest, o] of outboxOf(contact))
                if (o.kind === 'grade-declaration' && o.v2) {
                    return { to: contact, outbound: [{ to: contact, kind: 'grade-declaration/0.1 (Retry, byte-identisch)', env: o.env }] };
                }
            // die MUST-Grade hängt NIE am MAY-Mapping (Review 5, B-5): Grade-
            // Scope erschöpft → Pflicht suspendiert (2.1, trustReissueDue
            // bleibt); Revisionen nur gepeekt, Commit synchron (Review 7, B-1)
            if (!scopeOk(contact.gradeRevOut))
                return null;
            const gradeRev = peekRev(contact, 'gradeRevOut');
            const grade = await buildGradeDecl(p, counterpartAnchor, contact.gradeOutLast ?? 'blinded', when, gradeRev);
            const prepG = await prepareDoc(p, counterpartAnchor, 'grade-declaration', grade, when, uuid(), { v2: true }, ent);
            let prepM, mapping, mapRev;
            if (contact.trustGiven && scopeOk(contact.mapRevOut)) { // das MAY-Mapping gehört zum TRUST-Akt (6a.4)
                try {
                    mapRev = peekRev(contact, 'mapRevOut');
                    mapping = await buildMappingArtifact(p, contact, counterpartAnchor, when, mapRev);
                    prepM = await prepareDoc(p, counterpartAnchor, 'anchor-mapping', mapping, when, uuid(), {}, ent);
                }
                catch {
                    prepM = undefined; /* MAY (6a.4) — ein Mapping-Fehler suspendiert nur das Mapping, verbraucht nichts */
                }
            }
            if (contact.deactivated)
                return null; // Re-Check (B-2), danach kein await
            // COMMIT — ein synchroner Zug (§6.4)
            contact.gradeRevOut = gradeRev;
            stampGradeOut(p, contact, grade.body.grade); // die Neuausstellung IST eine Ausstellung (Review 27)
            const outbound = [commitDoc(prepG)];
            if (prepM) {
                contact.mapRevOut = mapRev;
                outbound.push(commitDoc(prepM));
                contact.sentMapping = mapping;
            }
            say(p, `Vertrauen auf dem neuen Kopf neu ausgestellt an ${contact.name} (5.5 — ohne neue Nutzerfrage)`);
            return { to: contact, outbound };
        });
    }
    finally {
        contact.reissuePending = false;
    }
}
/**
 * Der Producer-Sweep (Host-Vertrag): erst die V2-Pflichten, dann die
 * 5.4-Rekonziliation je Empfänger. Idempotent, per-recipient resilient,
 * Retries byte-identisch.
 */
export async function starRefreshAll(p, when, ent = {}) {
    const outbound = [];
    const failures = [];
    for (const [anchor, contact] of p.contacts) {
        if (contact.deactivated)
            continue;
        try {
            // die V2-Pflicht läuft AUCH pausiert (Review 12, B-4) und AUCH
            // ohne Trust-Akt (Review 33, B-1: eine ausgestellte Declaration
            // genügt); nur die Stern-Delivery braucht trustGiven
            if (contact.trustReissueDue) {
                const r = await reissueTrust(p, anchor, when, ent);
                if (r)
                    outbound.push(...r.outbound);
            }
            if (!contact.trustGiven || contact.trustPaused)
                continue;
            const r = await reconcile(p, anchor, when, ent);
            if (r)
                for (const env of r.envs)
                    outbound.push({ to: contact, kind: r.kind, env });
        }
        catch (e) {
            failures.push({ to: contact.name ?? anchor, error: String(e?.message ?? e) });
        }
    }
    return Object.assign(outbound, { failures });
}
// ── Empfang: registrierte Dokumente, Schema-validiert, atomar geackt ────
const asmOf = (contact) => contact.asm;
export async function receiveTrustDoc(p, env, when, ent = {}) {
    const opened = await C.openEnvelope(p, env);
    if (opened.error)
        return { handled: false };
    const ctx = p.contexts.get(env.rkid);
    const fromEntry = ctx && [...p.contacts.entries()].find(([, c]) => c.channel?.own?.anchor === ctx.anchor);
    if (!fromEntry)
        return { handled: false };
    const [fromKey, from] = fromEntry;
    const doc = opened.doc;
    if (opened.duplicate) {
        // 4.2: innerhalb der Retention wird EXAKT der gespeicherte Ack
        // byte-identisch erneut gesendet — nie ein neu erzeugter
        const stored = from.ackStore?.get(opened.digest);
        // der Store behält sein Exemplar — der Host bekommt eine Kopie (Encounter-Review 8, B-1)
        return { handled: true, duplicate: true, ack: stored ? { to: from, kind: 'delivery-ack/0.1 (Re-Ack, byte-identisch)', env: structuredClone(stored) } : undefined };
    }
    // Acks laufen durch dieselbe kritische Sektion (Delivery §6.2:
    // „stage 9 is a critical section whose lock set is the document
    // digest … it re-enters at stage 4"): der Verlierer zweier
    // gleichzeitiger identischer Acks sieht nach der Lock-Wartezeit den
    // completed-effect cache und meldet duplicate-known — nie
    // 'ack unknown ref' (Review 13, B-3)
    if (doc?.type === ACK_TYPE) {
        // deaktivierte Tupel nehmen keine NEUEN Acks für VISIBILITY-Dokumente
        // an (Review 37, B-3: „not the active head … MUST be rejected") —
        // ein Ack auf ein ENCOUNTER-Dokument bleibt gültig (Delivery 6.1:
        // „a late valid acknowledgement … transitions the status to
        // delivered"); die Unterscheidung fällt am referenzierten
        // Outbox-Eintrag in receiveAckInner (Encounter-Review 2, B-5)
        // Stufe 5 VOR dem Payload-Gate auch für Acks (Review 33, B-2), in
        // ihrer Ordnung: erst das DOKUMENTPROFIL (malformed), dann recipient =
        // eigener Anker (Empfänger-Prinzip) — Encounter-Review 8, B-2
        if (!schemaOk('rltp-delivery-document.schema.json', doc))
            return { handled: true, error: 'malformed document' };
        if (doc.recipient !== from.channel.own.anchor)
            return { handled: true, error: 'wrong-recipient' }; // 6.2 stage 5 disposition
        return withContactLock(from, async () => {
            if ((p.deliveryCache ?? new Set()).has(opened.digest))
                return { handled: true, duplicate: true };
            return receiveAckInner(p, fromKey, from, opened);
        });
    }
    if (typeof doc?.type !== 'string' || !doc.type.startsWith(TT))
        return { handled: false, doc };
    const slug = doc.type.slice(TT.length);
    if (!['anchor-mapping/0.1', 'grade-declaration/0.1', 'star/0.1'].includes(slug))
        return { handled: false, doc };
    // Dokumentprofil (Delivery §3): Schema-validiert, proof-frei, Bindungen
    if (!schemaOk('rltp-delivery-document.schema.json', doc))
        return { handled: true, error: 'malformed document' };
    if (doc.proof !== undefined)
        return { handled: true, error: 'document proof forbidden (one carrier)' };
    // Stufe 5: recipient = eigener Anker (Empfänger-Prinzip). Die
    // issuer-Bindung ist eine TYP-Konsistenzregel (Stufe 8) und läuft je
    // Zweig NACH dem Payload-Schema (Review 32)
    if (doc.recipient !== from.channel.own.anchor)
        return { handled: true, error: 'wrong-recipient' }; // 6.2 stage 5 disposition
    // Kalender-Validität des DOKUMENTS (Review 12, B-3): „a verifier
    // MUST reject a date its RFC 3339 parser refuses" — das Dokument-
    // Schema lief bereits; die PAYLOAD-Kalenderprüfung sitzt je Typ NACH
    // dem Payload-Schema (Review 31: Stufe 7 vor Stufe 8)
    if (!C.calOK(doc.issuedAt))
        return { handled: true, error: 'calendar-invalid issuedAt' };
    // Ack erst NACH der Payload-Validierung bauen (M-3: keine Krypto
    // für formwidrige Fracht), aber VOR jeder Zustandsmutation
    // (poisoning rule: ein Ack-Bau-Fehler konsumiert nichts); Effekt +
    // Cache + ackStore committen in EINEM synchronen Zug (4.2/§6.2)
    const mkAck = () => buildAck(p, from, opened.digest, doc.threadId, when).then((a) => a.env);
    const commit = (result, ackEnv) => {
        C.effectDone(p, opened.digest);
        (from.ackStore ??= new Map()).set(opened.digest, ackEnv);
        return { ...result, ack: { to: from, kind: 'delivery-ack/0.1', env: ackEnv } };
    };
    const r0 = await (async () => {
        switch (slug) {
            case 'anchor-mapping/0.1': {
                return withContactLock(from, async () => {
                    // Reentry (B-1/B-2): Kopf noch aktiv? Duplikat inzwischen? Revision noch frisch?
                    if (from.deactivated)
                        return { handled: true, error: 'tuple deactivated' };
                    if ((p.deliveryCache ?? new Set()).has(opened.digest)) {
                        const stored = from.ackStore?.get(opened.digest);
                        return { handled: true, duplicate: true, ack: stored ? { to: from, kind: 'delivery-ack/0.1 (Re-Ack, byte-identisch)', env: stored } : undefined };
                    }
                    const m = doc.payload;
                    // Stufe 7 zuerst: Payload-Schema → failed(malformed) (Review 30)
                    if (!schemaOk('visibility-anchor-mapping.schema.json', m))
                        return { handled: true, error: 'malformed mapping' };
                    if (doc.issuer !== fromKey)
                        return { handled: true, error: 'outer binding (issuer, Stufe 8)' };
                    if (!C.calOK(m.body.issuedAt))
                        return { handled: true, error: 'calendar-invalid issuedAt' }; // Stufe 8, nach dem Schema (Review 31)
                    if (doc.ceremony?.enactment !== undefined)
                        return { handled: true, error: 'ceremony.enactment kann nicht nachrechnen (validation-failed)' }; // Stufe 8 — NACH dem Payload-Schema (Review 30)
                    // §6.3 in Spec-REIHENFOLGE (Review 19, B-1), Tupel = Ankunftskanal
                    // (Review 9, B-1: Cross-Tupel-Bindung = Schritt 3 der Liste)
                    if (!(await verifyMapping(p, m, fromKey))) {
                        say(p, `Mapping von ${from.name} verifiziert NICHT — verworfen`);
                        return { handled: true, error: 'mapping' };
                    }
                    // 6.4, die GENERISCHE Revisionsregel (Review 11, B-2): höher
                    // ersetzt · gleich + JCS-identischer Body = idempotenter Repeat
                    // (No-op-Effekt, geackt — resends bleiben harmlos) · gleich +
                    // anderer Body = Äquivokation (reject, Zustand bleibt) ·
                    // niedriger = reject
                    if (BigInt(m.body.revision) === BigInt(from.mapRevIn ?? '0')) {
                        if (from.mapping && jcs(m.body) === jcs(from.mapping.body)) {
                            const ackEnv = await mkAck();
                            if (from.deactivated)
                                return { handled: true, error: 'tuple deactivated' };
                            return commit({ handled: true, idempotent: true }, ackEnv);
                        }
                        return { handled: true, error: 'equivocation (gleiche Revision, anderer Body)' };
                    }
                    if (BigInt(m.body.revision) < BigInt(from.mapRevIn ?? '0'))
                        return { handled: true, error: 'mapping revision (niedriger)' };
                    const ackEnv = await mkAck(); // fehlbar VOR jeder Mutation
                    // synchroner Re-Check nach dem LETZTEN await (Review 5, B-1): eine
                    // Kettung unter dem Lock eines ANDEREN Kontakts kann dieses Tupel
                    // während verify/mkAck deaktiviert haben — danach kein await mehr
                    if (from.deactivated)
                        return { handled: true, error: 'tuple deactivated' };
                    if (BigInt(m.body.revision) <= BigInt(from.mapRevIn ?? '0'))
                        return { handled: true, error: 'mapping revision (nicht strikt größer)' };
                    from.mapRevIn = m.body.revision;
                    from.selfAnchor = m.body.self;
                    from.mapping = m;
                    from.trustReceived = doc.issuedAt;
                    const e = promotionCommit(p, relIdOf(p, fromKey), m.body.self, fromKey, when);
                    e.admittedAt ??= when; // grade-wait ankert an der Admission (5.4)
                    // eine VOR dem Mapping verifizierte Declaration steht und wirkt
                    // bei der Admission sofort (Sektion 2 / 5.4)
                    if (from.gradeIn && !e.grades?.has(fromKey))
                        declCommit(p, relIdOf(p, fromKey), from.gradeIn, fromKey, from.gradeInOrder);
                    say(p, `${from.name} vertraut dir: stabiler Anker geprüft übernommen (nur für dich beweisend)`);
                    // der Producer-Sweep läuft NACH der Lock-Sektion (Reentranz!)
                    return commit({ handled: true, disclosed: m.body.self, fromName: from.name, __sweep: true }, ackEnv);
                });
            }
            case 'grade-declaration/0.1': {
                return withContactLock(from, async () => {
                    if (from.deactivated)
                        return { handled: true, error: 'tuple deactivated' };
                    if ((p.deliveryCache ?? new Set()).has(opened.digest)) {
                        const stored = from.ackStore?.get(opened.digest);
                        return { handled: true, duplicate: true, ack: stored ? { to: from, kind: 'delivery-ack/0.1 (Re-Ack, byte-identisch)', env: stored } : undefined };
                    }
                    const g = doc.payload;
                    if (!schemaOk('visibility-grade-declaration.schema.json', g))
                        return { handled: true, error: 'malformed grade' };
                    if (doc.issuer !== fromKey)
                        return { handled: true, error: 'outer binding (issuer, Stufe 8)' };
                    if (!C.calOK(g.body.issuedAt))
                        return { handled: true, error: 'calendar-invalid issuedAt' }; // Stufe 8, nach dem Schema (Review 31)
                    if (doc.ceremony?.enactment !== undefined)
                        return { handled: true, error: 'ceremony.enactment kann nicht nachrechnen (validation-failed)' }; // Stufe 8 — NACH dem Payload-Schema (Review 30)
                    if (g.body.subject !== fromKey || g.body.holder !== from.channel.own.anchor)
                        return { handled: true, error: 'grade binding' };
                    const k = await kGrade(from.channel.own, from.channel.counterpartKa, g.body.subject, g.body.holder);
                    if ((await hmacU(k, jcs(g.body))) !== g.proof.mac)
                        return { handled: true, error: 'grade mac' };
                    // 6.4, die GENERISCHE Revisionsregel (Review 11, B-2):
                    // dreiteilig — siehe Mapping-Pfad
                    if (BigInt(g.body.revision) === BigInt(from.gradeRevIn ?? '0')) {
                        if (from.gradeBodyIn && jcs(g.body) === from.gradeBodyIn) {
                            const ackEnv = await mkAck();
                            if (from.deactivated)
                                return { handled: true, error: 'tuple deactivated' };
                            return commit({ handled: true, idempotent: true }, ackEnv);
                        }
                        return { handled: true, error: 'equivocation (gleiche Revision, anderer Body)' };
                    }
                    if (BigInt(g.body.revision) < BigInt(from.gradeRevIn ?? '0'))
                        return { handled: true, error: 'grade revision (niedriger)' };
                    const ackEnv = await mkAck(); // fehlbar VOR jeder Mutation
                    if (from.deactivated)
                        return { handled: true, error: 'tuple deactivated' }; // Re-Check (B-1), danach kein await
                    if (BigInt(g.body.revision) <= BigInt(from.gradeRevIn ?? '0'))
                        return { handled: true, error: 'grade revision (nicht strikt größer)' };
                    from.gradeRevIn = g.body.revision;
                    from.gradeBodyIn = jcs(g.body); // für den Idempotenz-Vergleich (Review 11, B-2)
                    from.gradeIn = g.body.grade;
                    from.gradeInOrder = (admission(p).seq += 1n); // Verifikations-Commit-Ordnung JETZT (B-2)
                    if (from.selfAnchor)
                        declCommit(p, relIdOf(p, fromKey), g.body.grade, fromKey, from.gradeInOrder);
                    say(p, `${from.name} erklärt Grade '${g.body.grade}'`);
                    return commit({ handled: true, grade: g.body.grade, __sweep: true }, ackEnv);
                });
            }
            case 'star/0.1': {
                // Stage-9-Lockmenge in kind: konkurrierende Chunks derselben
                // Assembly serialisieren über den Kontakt-Lock (§4.4)
                return withStarLock(from, async () => {
                    if (from.deactivated)
                        return { handled: true, error: 'tuple deactivated' }; // §6.4 — auch der Star-Pfad (Review 5, B-1)
                    // Stage-4-Reentry nach Lock-Wartezeit (§6.2): ein inzwischen
                    // verarbeitetes Duplikat erhält den gespeicherten Ack byte-identisch
                    if ((p.deliveryCache ?? new Set()).has(opened.digest)) {
                        const stored = from.ackStore?.get(opened.digest);
                        return { handled: true, duplicate: true, ack: stored ? { to: from, kind: 'delivery-ack/0.1 (Re-Ack, byte-identisch)', env: stored } : undefined };
                    }
                    const chunk = doc.payload;
                    if (!schemaOk('visibility-star.schema.json', chunk))
                        return { handled: true, error: 'malformed star' };
                    if (doc.issuer !== fromKey)
                        return { handled: true, error: 'outer binding (issuer, Stufe 8)' };
                    if (doc.ceremony?.enactment !== undefined)
                        return { handled: true, error: 'ceremony.enactment kann nicht nachrechnen (validation-failed)' }; // Stufe 8 — NACH dem Payload-Schema (Review 30)
                    const b = chunk.body;
                    // Empfänger-Monotonie (5.2): nicht strikt größer als der
                    // completed High-Water → verworfen
                    if (BigInt(b.salt) <= BigInt(from.starSaltIn ?? '0'))
                        return { handled: true, error: 'star replay (nicht strikt größer)' };
                    // VERGIFTETER Salt (Review 21): nach einem Assembly-Konflikt
                    // wird KEIN weiterer Chunk dieser Lieferung quittiert — sonst
                    // kombinieren früh geackte, verlorene Pufferwirkungen mit
                    // späteren Acks zu einer falschen Completion („the delivery
                    // simply cannot complete until every seq is held")
                    if (from.starPoison?.has(b.salt))
                        return { handled: true, error: 'star salt vergiftet (assembly conflict)' };
                    const k = await kStarIn(from, fromKey, b.salt);
                    if ((await hmacU(k, jcs(b))) !== chunk.proof.mac)
                        return { handled: true, error: 'star mac' };
                    // Re-Check nach den MAC-Awaits (Review 6, B-1): ab hier wird bis
                    // zum jeweils nächsten await NUR NOCH LOKAL entschieden — die
                    // Assembly ist Tupel-Zustand und darf nach einer Deaktivierung
                    // keinen Chunk mehr aufnehmen („dies, atomically, with its
                    // tuple's deactivation")
                    if (from.deactivated)
                        return { handled: true, error: 'tuple deactivated' };
                    // 5.2a-Entscheidungen auf LOCALS (Review 6, B-1): höherer Salt
                    // verdrängt, niedrigerer wird verworfen, threadId-Dissens
                    // verwirft, Lücken puffern — GESCHRIEBEN wird erst nach Ack-Bau
                    // und letztem Re-Check, in einem synchronen Zug
                    const cur = asmOf(from);
                    const displaced = cur && BigInt(b.salt) > BigInt(cur.salt);
                    if (cur && !displaced && BigInt(b.salt) < BigInt(cur.salt))
                        return { handled: true, error: 'below open assembly' };
                    const a = (!cur || displaced) ? { salt: b.salt, threadId: doc.threadId, count: b.count, chunks: new Map(), lastSeq: undefined } : cur;
                    if (doc.threadId !== a.threadId || b.count !== a.count) {
                        from.asm = undefined;
                        (from.starPoison ??= new Set()).add(b.salt);
                        return { handled: true, error: 'assembly conflict (threadId/count)' };
                    }
                    const seq = b.seq;
                    if (a.chunks.has(seq)) {
                        from.asm = undefined;
                        (from.starPoison ??= new Set()).add(b.salt);
                        return { handled: true, error: 'assembly conflict (seq)' };
                    }
                    if (b.last && a.lastSeq !== undefined) {
                        from.asm = undefined;
                        (from.starPoison ??= new Set()).add(b.salt);
                        return { handled: true, error: 'assembly conflict (two last)' };
                    }
                    const candLast = b.last ? seq : a.lastSeq;
                    if (candLast !== undefined && BigInt(seq) > BigInt(candLast)) {
                        from.asm = undefined;
                        (from.starPoison ??= new Set()).add(b.salt);
                        return { handled: true, error: 'seq beyond last' };
                    }
                    // auch BEREITS GEPUFFERTE Chunks oberhalb von last verwerfen die
                    // Assembly (Review 16, B-1): „a seq greater than the held last
                    // chunk's … reject" gilt unabhängig von der Ankunftsreihenfolge
                    if (candLast !== undefined)
                        for (const s of a.chunks.keys())
                            if (BigInt(s) > BigInt(candLast)) {
                                from.asm = undefined;
                                (from.starPoison ??= new Set()).add(b.salt);
                                return { handled: true, error: 'seq beyond last (gepuffert)' };
                            }
                    let ackEnv;
                    const complete0 = candLast !== undefined && (() => { for (let i = 1n; i <= BigInt(candLast); i++)
                        if (String(i) !== seq && !a.chunks.has(String(i)))
                            return false; return true; })();
                    if (!complete0) {
                        ackEnv = await mkAck();
                        if (from.deactivated)
                            return { handled: true, error: 'tuple deactivated' }; // Re-Check (B-1), danach kein await
                        from.asm = a; // Übernahme JETZT — synchron mit dem Puffern
                        if (b.last)
                            a.lastSeq = seq;
                        a.chunks.set(seq, b);
                        return commit({ handled: true, partial: true }, ackEnv);
                    }
                    // der KOMPLETTIERENDE Chunk: Union aus Puffer + aktuellem Chunk
                    // OHNE Mutation berechnen und validieren, dann Ack + Re-Check,
                    // dann Übernahme + completed-salt + Cache + Ack in EINEM
                    // SYNCHRONEN Zug (§4.4); die UI-Auffrischung läuft NACH dem Commit
                    const union = [];
                    for (let i = 1n; i <= BigInt(candLast); i++)
                        union.push(...(String(i) === seq ? b : a.chunks.get(String(i))).blinded);
                    const sorted = [...union].every((x, i, arr) => i === 0 || arr[i - 1] < x);
                    if (!sorted || BigInt(union.length) > BigInt(a.count)) {
                        from.asm = undefined;
                        (from.starPoison ??= new Set()).add(a.salt);
                        return { handled: true, error: 'assembly invalid (order/|union|>count)' };
                    }
                    ackEnv = await mkAck(); // JETZT ist alles validiert (M-2), vor der Übernahme
                    if (from.deactivated)
                        return { handled: true, error: 'tuple deactivated' }; // Re-Check (B-1), danach kein await
                    from.asm = undefined;
                    from.starSaltIn = a.salt;
                    from.starReceived = { salt: a.salt, count: a.count, blinded: union };
                    if (from.starPoison)
                        for (const ps of from.starPoison)
                            if (BigInt(ps) <= BigInt(a.salt))
                                from.starPoison.delete(ps); // Gift unterhalb des High-Water ist gegenstandslos
                    const out = commit({ handled: true, star: true }, ackEnv);
                    await refreshStarInfo(p);
                    say(p, `Kontakt-Update von ${from.name}: ${a.count} Kontakte (geblendet: ${union.length})`);
                    return out;
                });
            }
        }
        return { handled: false, doc };
    })();
    // Effekt fertig, Lock frei — jetzt der Producer-Sweep (5.4), dessen
    // reconcile die Empfänger-Locks selbst nimmt
    if (r0?.__sweep) {
        delete r0.__sweep;
        const outbound = await starRefreshAll(p, when, ent);
        r0.outbound = [...outbound];
        if (outbound.failures.length)
            r0.outboundError = outbound.failures.map((f) => `${f.to}: ${f.error}`).join(' · ');
    }
    return r0;
}
// completion (5.4-Automat): jeder Chunk-Ack streicht seinen Digest;
// der letzte lässt den Automaten laufen
async function receiveAckInner(p, fromKey, from, opened) {
    // der referenzierte Outbox-Eintrag zuerst — seine KLASSE wählt die
    // Proof-Form des Acks (4.2/4.4: Encounter-Payloads tragen übertragbare
    // Signaturen → signierter Ack; Visibility-Payloads sind DV → MAC).
    // Digest-Gleichheit über die dekodierten Multihash-Bytes (Encounter
    // 2.3) — ein `z`-gerenderter ref trifft den `u`-Outbox-Schlüssel
    // Stufe 7 zuerst: das Payload-Schema (malformed) — VOR jeder Klassen-
    // oder Konsistenzregel der Stufe 8 (Encounter-Review 16, B-1)
    if (!schemaOk('payload-delivery-ack.schema.json', opened.doc?.payload))
        return { handled: true, error: 'malformed' };
    const ref0 = opened.doc.payload.ref;
    let refKey, o;
    for (const [k, e] of outboxOf(from))
        if (sameDigest(k, ref0)) {
            refKey = k;
            o = e;
            break;
        }
    if (!o)
        return { handled: true, error: 'ack unknown ref' }; // Stufe 8: ref trifft kein gesendetes Dokument — keine Klasse wählbar
    const ENCOUNTER_KIND = o.kind === 'encounter-bundle' || o.kind === 'encounter-credential-delivery';
    const v = await verifyAck(p, from, opened.doc, ENCOUNTER_KIND ? 'signature' : 'dv');
    if (!v)
        return { handled: true, error: 'ack invalid' };
    if (o.threadId !== v.threadId)
        return { handled: true, error: 'ack unknown ref' };
    if (from.deactivated && !ENCOUNTER_KIND)
        return { handled: true, error: 'tuple deactivated' }; // nach den Awaits (Review 37, B-3), danach kein await
    // ZWEI Pflicht-Ebenen (Review 19, B-3): der Delivery-Ack erledigt den
    // TRANSPORT — die Visibility-Pflicht eines choice/report-Mappings
    // („resent … until answered by the counterpart's aligned mapping")
    // lebt weiter: der Eintrag bleibt für byte-identische Resends, bis
    // die Alignment-Antwort ihn retired. Die ALIGNMENT-Pflicht selbst
    // stirbt mit dem Ack (completed delivery, §6a.3).
    if (o.kind === 'continuity-mapping' && o.duty !== 'align' && !o.retired)
        o.acked = true;
    else
        outboxOf(from).delete(refKey);
    C.effectDone(p, opened.digest);
    if (o.kind === 'star') {
        const s = subOf(from);
        const f = s.inFlight.get(o.salt);
        if (f) {
            f.pending.delete(refKey);
            if (f.pending.size === 0) {
                s.inFlight.delete(o.salt);
                if (BigInt(o.salt) > s.highWater) {
                    s.highWater = BigInt(o.salt);
                    s.baseline = f.view;
                }
                // Completion räumt alle niedrigeren In-Flights (tot beim Empfänger)
                for (const [salt2, f2] of [...s.inFlight])
                    if (BigInt(salt2) < s.highWater) {
                        for (const d of f2.pending.keys())
                            outboxOf(from).delete(d);
                        s.inFlight.delete(salt2);
                    }
                return { handled: true, completed: o.salt, advanced: true };
            }
            return { handled: true, partialAck: true };
        }
    }
    if (o.v2)
        delete from.trustReissueDue; // die V2-Pflicht stirbt mit der QUITTIERTEN Zustellung
    if (o.duty === 'align')
        from.contAligned = true; // 6a.3: Alignment-Pflicht stirbt mit der Completion
    // Encounter (Delivery 6.1): „delivered" ist der Sender-Status NUR auf
    // den gültigen Ack — der Host liest diese Marken, nie die Ankunft
    if (o.kind === 'encounter-bundle')
        from.bundleAcked = true;
    if (o.kind === 'encounter-credential-delivery')
        from.counterAcked = true;
    // the host correlates the ack with ITS active encounter (Encounter-Review 11, B-3):
    // the acked document's digest, thread and the counterpart anchor travel along
    return { handled: true, acked: o.kind, ref: refKey, threadId: o.threadId, peerAnchor: fromKey };
}
export async function receiveAck(p, env) {
    return receiveTrustDoc(p, env, 0);
}
