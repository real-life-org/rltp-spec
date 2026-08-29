// GENERATED from lib/dist by scripts/build-simulator-lib.mjs — DO NOT EDIT.
// Source of truth: lib/src/*.ts. CI enforces freshness (--check).
// trust.mjs — Stufe 2 des Redesigns: der EXPLIZITE VERTRAUENSAKT
// (aufgeschobene Anker-Offenlegung), der geblendete Stern und die
// Pause-Semantik. PROBE, DOM-frei, auf rltp-core + rltp-crypto.
//
// DAS MODELL (portiert aus graph-web.mjs auf den WebCrypto-Stack):
//   Vertrauensakt = EINSEITIGE Offenlegungsentscheidung. A liefert an B:
//     1. das kreuz-MAC-te anchor-mapping pair→self (Designated Verifier:
//        BEIDE MACs könnte auch B selbst berechnen — ein geleaktes
//        Mapping beweist Dritten NICHTS; forgeMapping demonstriert das),
//     2. die eigene Self-Card (stabiler Anker + keyAgreement),
//     3. den geblendeten Stern-Schnappschuss.
//   B VERIFIZIERT das Mapping mit den eigenen Geheimnissen, bevor die
//   Verknüpfung akzeptiert wird. Pausieren stoppt nur KÜNFTIGE
//   Lieferungen — Geliefertes bleibt (Einweg-Tür, irreversibles Wissen).
//
//   Stern (Publikums-Prinzip, Klasse D): der Sender leitet NIE rohe
//   Dritt-Anker weiter. Jeder gehaltene Self-Anker reist als
//   HMAC(k, anchor) unter dem Beziehungs-Schlüssel k; der Empfänger kann
//   nur Anker testen, die er selbst legitim hält („gemeinsame Kontakte"),
//   und sonst nichts. Epochales Blenden: salt = monotone Sequenznummer
//   pro Beziehung; Listen SORTIERT (Lieferreihenfolge leakt nichts).
//   Ehrlicher Rest: 1-Bit-Orakel über gehaltene Anker + die Zählung.
import { jcs } from '../core.js';
import * as C from './deps.js';
const te = new TextEncoder();
const S = globalThis.crypto.subtle;
const TT = 'https://real-life.org/trust-tasks/';
const say = (p, m) => p.log.push(m);
const uuid = (ent) => ent ?? globalThis.crypto.randomUUID();
// ── Primitiven ──────────────────────────────────────────────────────────
export async function hmac(keyBytes, msg) {
    const k = await S.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return C.b64uOf(new Uint8Array(await S.sign('HMAC', k, te.encode(msg))));
}
// der stabile soziale Anker = COMMUNITY-ANKER (Identity 0.13, S-DID-Schnitt):
// gewöhnlicher Gruppen-Kontext über die Genesis der persönlichen Community —
// nie mehr die zero-input-Recovery-Strings
export async function communityContext(p) {
    if (!p.selfCtx)
        p.selfCtx = await C.communityContext(p.rootIkm, p.communityGenesis);
    return p.selfCtx;
}
export const selfCard = async (p, whenIso) => {
    const s = await communityContext(p);
    return C.signCard(s, C.cardBody(s, { name: p.name }), whenIso);
};
// Beziehungs-Schlüssel: X25519 zwischen den pair-Kontexten des Kanals
const chShared = (contact) => C.ecdh(contact.channel.own.x.priv, C.xRawOfMk(contact.channel.counterpartKa));
const relKey = async (contact, info) => C.hkdf(await chShared(contact), info);
// ── anchor-mapping@2 (Designated Verifier, Doppel-MAC) ──────────────────
// mac1: Kanal-DH (pairA × pairB) · mac2: selfA × pairB — der Empfänger
// rechnet mac2 mit SEINEM pair-Privkey gegen die Self-Card nach. Beide
// Schlüssel kann auch der Empfänger allein ableiten: Abstreitbarkeit.
const mappingBody = (pairAnchor, selfAnchor, toPairAnchor, whenIso) => ({ type: 'anchor-mapping@2', pair: pairAnchor, self: selfAnchor, to: toPairAnchor, issuedAt: whenIso });
export async function makeMapping(p, counterpartAnchor, when) {
    const contact = p.contacts.get(counterpartAnchor);
    const s = await communityContext(p);
    const whenIso = C.iso(when);
    const card = await selfCard(p, whenIso);
    const body = mappingBody(contact.channel.own.anchor, s.anchor, counterpartAnchor, whenIso);
    const msg = jcs(body);
    const theirKa = C.xRawOfMk(contact.channel.counterpartKa);
    return { body, card,
        mac1: await hmac(await relKey(contact, 'rltp/trust/mac/map1'), msg),
        mac2: await hmac(await C.hkdf(await C.ecdh(s.x.priv, theirKa), 'rltp/trust/mac/map2'), msg) };
}
// Verifikation ist EMPFÄNGER-PRIVAT: sie BRAUCHT die eigenen Geheimnisse
// (das ist der Punkt — ein Dritter kann nicht einmal die Gültigkeit prüfen)
export async function verifyMapping(p, m) {
    try {
        const b = m?.body;
        if (!b || b.type !== 'anchor-mapping@2')
            return false;
        const entry = p.contacts.get(b.pair);
        if (!entry?.channel?.own)
            return false;
        if (b.to !== entry.channel.own.anchor)
            return false;
        const card = m.card;
        if (card?.anchor !== b.self || !(await C.diVerify(card, b.self)))
            return false;
        const msg = jcs(b);
        if ((await hmac(await relKey(entry, 'rltp/trust/mac/map1'), msg)) !== m.mac1)
            return false;
        const k2 = await C.hkdf(await C.ecdh(entry.channel.own.x.priv, C.xRawOfMk(card.keyAgreement)), 'rltp/trust/mac/map2');
        if ((await hmac(k2, msg)) !== m.mac2)
            return false;
        return true;
    }
    catch {
        return false;
    }
}
// die Abstreitbarkeits-Demo: der EMPFÄNGER fabriziert ein Mapping, das
// einen beliebigen pair-Anker an ein beliebiges Self bindet, dessen Card
// er hält — es verifiziert identisch. Genau darum überzeugt ein
// geleaktes Mapping niemanden.
export async function forgeMapping(forger, victimCard, pairAnchor, when) {
    const entry = forger.contacts.get(pairAnchor);
    const whenIso = C.iso(when);
    const body = mappingBody(pairAnchor, victimCard.anchor, entry.channel.own.anchor, whenIso);
    const msg = jcs(body);
    const k2 = await C.hkdf(await C.ecdh(entry.channel.own.x.priv, C.xRawOfMk(victimCard.keyAgreement)), 'rltp/trust/mac/map2');
    return { body, card: victimCard,
        mac1: await hmac(await relKey(entry, 'rltp/trust/mac/map1'), msg),
        mac2: await hmac(k2, msg) };
}
// ── der geblendete Stern ────────────────────────────────────────────────
// Sequenz-Reservierung: SYNCHRON vor jedem await, damit zwei
// nebenläufige Aufrufe nie denselben Salt ziehen (Review 6, B-1).
// Ein bei Fehlschlag verbrannter Salt ist erlaubt — die Sequenz ist
// strikt monoton, nicht lückenlos.
const reserveStarSeq = (contact) => {
    contact.starSeqNext = Math.max(contact.starSeqNext ?? 0, contact.starSeq ?? 0) + 1;
    return contact.starSeqNext;
};
const commitStar = (contact, seq, snap) => {
    // das Journal hält NUR den High-Water-Stern: ein verspätet fertig
    // gewordener kleinerer Salt rollt sentStar nicht zurück (Review 7, B-2)
    if (seq > (contact.starSeq ?? 0)) {
        contact.starSeq = seq;
        contact.sentStar = snap;
    }
};
// Produktion pro Kontakt SERIALISIERT: die Reservierung macht Salts
// eindeutig, erst die Kette macht ihre AUSLIEFERUNG streng steigend —
// der Empfänger verwirft normativ jeden nicht strikt größeren Salt
const withStarLock = (contact, fn) => {
    const run = (contact.starLock ?? Promise.resolve()).then(fn, fn);
    contact.starLock = run.catch(() => { });
    return run;
};
// reine Berechnung — mutiert NICHTS; Sequenz kommt aus reserveStarSeq
async function buildStarPure(p, contact, seq) {
    const salt = String(seq);
    const k = await relKey(contact, 'rltp/trust/blind/star/' + salt);
    const blinded = [];
    let count = 0;
    for (const e of p.contacts.values()) {
        if (!e.selfAnchor)
            continue;
        count++;
        blinded.push(await hmac(k, e.selfAnchor));
    }
    blinded.sort();
    return { salt, count, blinded };
}
export function buildStar(p, contact) {
    return withStarLock(contact, async () => {
        const seq = reserveStarSeq(contact);
        const snap = await buildStarPure(p, contact, seq);
        commitStar(contact, seq, snap); // Sender-Journal: was ich hier zuletzt geliefert habe
        return snap;
    });
}
// Empfängerseite: denselben Lieferschlüssel nachrechnen, EINEN Anker testen
export async function starMatch(p, entry, snap, anchor) {
    const k = await relKey(entry, 'rltp/trust/blind/star/' + snap.salt);
    return snap.blinded.includes(await hmac(k, anchor));
}
// Cache für die synchrone UI: pro Kontakt { count, knownNames } aus dem
// empfangenen Schnappschuss gegen die EIGENEN gehaltenen Self-Anker.
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
        entry.starInfo = { count: entry.starReceived.count, knownNames: known.sort() };
    }
}
// ── der Vertrauensakt ───────────────────────────────────────────────────
// Erlaubt für ✓ (Zeremonie) UND ⇄ (vorgestellt, beidseitig) — Vertrauen
// ist eine OFFENLEGUNGS-Entscheidung, keine Verifikations-Behauptung
// (Antons Entscheid 24.08.); die UI benennt bei ⇄ ehrlich die
// Vermittler-Abhängigkeit. Gesperrt bleibt ◇: einseitig hast du nichts
// freigegeben — es existiert kein eigener Kanal-Kontext für das Mapping.
// Einweg-Tür: trustGiven bleibt; Pausieren stoppt nur das Abo.
export async function setTrust(p, counterpartAnchor, when, ent = {}) {
    const contact = p.contacts.get(counterpartAnchor);
    if (!contact)
        return { error: 'kein Kontakt' };
    if (!contact.channel?.own)
        return { error: 'kein eigener Kanal — einseitig (◇) hast du nichts freigegeben' };
    if (contact.trustGiven)
        return { error: 'bereits geschenkt (Einweg-Tür)' };
    // In-flight-Latch (Review 6, B-1): der Latch fällt SYNCHRON — zwei
    // nebenläufige Aufrufe können die offene Tür nicht beide bestehen
    if (contact.trustPending)
        return { error: 'bereits unterwegs (Einweg-Tür)' };
    contact.trustPending = true;
    try {
        // ALLES Fehlbare — auch die Zeitform (when=NaN wirft) — liegt im
        // try, dessen finally den Latch räumt (Review 7, B-1)
        const whenIso = C.iso(when);
        // die Tür schließt erst, wenn die Disclosure WIRKLICH existiert
        // (Review 5, B-5): alles Fehlbare läuft vor den Journal-Mutationen
        const mapping = await makeMapping(p, counterpartAnchor, when);
        // Stern-Abschnitt unter dem Kontakt-Lock: Reservierung, Bau, Siegel
        // und Commit in EINEM geordneten Zug (Review 7, B-2)
        const { env, star, seq } = await withStarLock(contact, async () => {
            const seq = reserveStarSeq(contact);
            const star = await buildStarPure(p, contact, seq);
            const body = {
                id: uuid(ent.id), type: TT + 'trust-disclosure@probe',
                issuer: contact.channel.own.anchor, recipient: counterpartAnchor,
                issuedAt: whenIso, payload: { mapping, star },
            };
            const doc = await C.diSign(contact.channel.own, body, whenIso);
            const env = await C.seal(doc, contact.channel.counterpartKa, ent);
            commitStar(contact, seq, star);
            return { env, star, seq };
        });
        contact.trustGiven = whenIso;
        contact.sentMapping = mapping; // Sender-Journal: die geöffnete Einweg-Tür
        say(p, `Vertrauen geschenkt an ${contact.name}: stabiler Anker offengelegt (DV-Mapping) + Kontakt-Updates aktiv`);
        return { to: contact, env };
    }
    finally {
        contact.trustPending = false;
    }
}
export function setTrustPaused(p, counterpartAnchor, paused) {
    const contact = p.contacts.get(counterpartAnchor);
    if (!contact?.trustGiven)
        return;
    contact.trustPaused = !!paused;
    say(p, paused ? `Kontakt-Updates an ${contact.name} pausiert (Geliefertes bleibt)` : `Kontakt-Updates an ${contact.name} wieder aktiv`);
}
// Bestand geändert (neuer Self-Anker gehalten) → Stern überall auffrischen,
// wo ich vertraue und nicht pausiert habe. Ohne das frieren Sterne in der
// Toggle-Reihenfolge ein (Antons Erstlauf-Befund im Graph-Simulator).
/**
 * Refresh every deliverable star. Per-recipient resilience (review 5,
 * M-1): a failure for ONE recipient never discards the stars already
 * built for others — the result carries the sealed outbound plus a
 * named failure list. THE CONTRACT: the caller (host application) owns
 * redelivery of failed refreshes, e.g. by calling this again; a failed
 * refresh is a SEND problem, never grounds to redeliver the inbound
 * document (its effect is complete and cached).
 */
export async function starRefreshAll(p, when, ent = {}) {
    const outbound = [];
    const failures = [];
    for (const [anchor, contact] of p.contacts) {
        if (!contact.trustGiven || contact.trustPaused)
            continue;
        try {
            const env = await withStarLock(contact, async () => {
                const seq = reserveStarSeq(contact);
                const star = await buildStarPure(p, contact, seq);
                const whenIso = C.iso(when);
                const body = {
                    id: uuid(), type: TT + 'trust-star@probe',
                    issuer: contact.channel.own.anchor, recipient: anchor,
                    issuedAt: whenIso, payload: { star },
                };
                const sealed = await C.seal(await C.diSign(contact.channel.own, body, whenIso), contact.channel.counterpartKa, ent);
                commitStar(contact, seq, star);
                return sealed;
            });
            outbound.push({ to: contact, env });
        }
        catch (e) {
            failures.push({ to: contact.name ?? anchor, error: String(e?.message ?? e) });
        }
    }
    return Object.assign(outbound, { failures });
}
// ── Empfangs-Dispatch (Form wie groups.receiveDoc) ──────────────────────
export async function receiveTrustDoc(p, env, when, ent = {}) {
    const opened = await C.openEnvelope(p, env); // Stufen 1–4, Cache-Lesung
    if (opened.duplicate)
        return { handled: true, duplicate: true };
    if (opened.error)
        return { handled: false };
    const r = await receiveTrustDocInner(p, env, opened.doc, when, ent);
    if (r?.handled && !r.error)
        C.effectDone(p, opened.digest);
    return r;
}
async function receiveTrustDocInner(p, env, doc, when, ent = {}) {
    const ctx = p.contexts.get(env.rkid);
    if (!ctx)
        return { handled: false };
    if (typeof doc?.type !== 'string' || !doc.type.startsWith(TT + 'trust-'))
        return { handled: false, doc };
    // form BEFORE fields (M-3): issuer, proof and payload as used below
    // form BEFORE fields (M-3, verschärft in Runde 3): jeder Typ verlangt
    // SEIN Payload — star@probe ohne star ist formwidrig, nicht ein Throw
    const kind = doc.type.slice((TT + 'trust-').length);
    const starOk = C.shaped(doc.payload ?? {}, { star: 'object' }) && C.shaped(doc.payload.star, { salt: 'string', count: 'number', blinded: 'array' })
        && C.intStr(doc.payload.star.salt) && Number.isInteger(doc.payload.star.count) && doc.payload.star.count >= 0
        && doc.payload.star.count === doc.payload.star.blinded.length
        && doc.payload.star.blinded.every((b) => typeof b === 'string');
    const mappingOk = C.shaped(doc.payload ?? {}, { mapping: 'object' }) && C.shaped(doc.payload.mapping, { mac1: 'string', mac2: 'string', card: 'object' });
    if (!C.shaped(doc, { issuer: 'string', proof: 'object', payload: 'object' })
        || (kind === 'disclosure@probe' && !(mappingOk && starOk))
        || (kind === 'star@probe' && !starOk))
        return { handled: true, error: 'malformed' };
    const fromEntry = [...p.contacts.entries()].find(([, c]) => c.channel?.own?.anchor === ctx.anchor);
    if (!fromEntry)
        return { handled: true, error: 'kein Kanal' };
    const [fromKey, from] = fromEntry;
    if (doc.issuer !== fromKey || !(await C.diVerify(doc, doc.issuer)))
        return { handled: true, error: 'trust doc proof' };
    switch (doc.type.slice((TT + 'trust-').length)) {
        case 'disclosure@probe': {
            const m = doc.payload?.mapping;
            if (!(await verifyMapping(p, m))) {
                say(p, `Mapping von ${from.name} verifiziert NICHT — verworfen`);
                return { handled: true, error: 'mapping' };
            }
            from.selfAnchor = m.body.self;
            from.mapping = m;
            from.trustReceived = doc.issuedAt;
            from.starReceived = doc.payload.star;
            await refreshStarInfo(p);
            say(p, `${from.name} vertraut dir: stabiler Anker geprüft übernommen (nur für dich beweisend)`);
            // mein Bestand wuchs → mein lieferbarer Stern auch: auffrischen.
            // Der INBOUND-Effekt ist hier komplett und bleibt cached;
            // starRefreshAll ist pro Empfänger resilient — Teilergebnisse
            // gehen nie verloren, Fehlschläge stehen benannt in failures und
            // gehören dem HOST (Nachliefer-Vertrag, Review 5 M-1)
            const outbound = await starRefreshAll(p, when, ent);
            const outboundError = outbound.failures.length ? outbound.failures.map((f) => `${f.to}: ${f.error}`).join(' · ') : undefined;
            return { handled: true, disclosed: m.body.self, fromName: from.name, outbound: [...outbound], outboundError };
        }
        case 'star@probe': {
            from.starReceived = doc.payload.star;
            await refreshStarInfo(p);
            say(p, `Kontakt-Update von ${from.name}: ${doc.payload.star.count} Kontakte (geblendet)`);
            return { handled: true, star: true };
        }
    }
    return { handled: false, doc };
}
