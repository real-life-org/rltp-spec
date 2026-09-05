// GENERATED from lib/dist by scripts/build-simulator-lib.mjs — DO NOT EDIT.
// Source of truth: lib/src/*.ts. CI enforces freshness (--check).
// encounter — the ceremony's TRANSMISSION on the normative forms:
// Encounter 0.29 (wire 0.25: rltp-card/0.25 · encounter-scan@0.25)
// carried by Delivery 0.79 — encounter-bundle/0.1 (§4.1),
// encounter-credential-delivery/0.1 (§4.3), acknowledged with the
// SIGNED delivery-ack/0.1 (§4.2/4.4 class rule: signature-class payloads
// get an eddsa-jcs-2022 ack; only DV payloads get the deniable MAC form).
// The Encounter-Nachzug (design/encounter-nachzug-plan-2026-09.md)
// replaces the host's `encounter-verify@probe` with this module.
//
// The machine (Encounter 5.3–5.8, in the probe WORLD of a Person):
//   · own-challenge STATE MODEL (5.3): issuance → open; record creation
//     → recorded (atomic, in-lock); aging latch → unknown (set-only,
//     whole-second normalized, LOCK-FREE). resolve() is total and by
//     precedence.
//   · the ENACTMENT RECORD (5.5), keyed by the own challenge, unique and
//     idempotent; the record IS the contact tuple; the record key is one
//     lock namespace for bundles, the optical leg, the scanner's own
//     record and the counter-step.
//   · ONE COMMIT DISCIPLINE for every effect (design/encounter-review11-
//     halt-2026-09.md, Option 1): `effect()` runs, under the lock set,
//       prepare  — async, FALLIBLE, no mutation (checks, tuple, ack);
//       verify   — SYNCHRONOUS re-check of EVERY state-dependent
//                  condition (cache, authoritative resolution, thread
//                  freshness, counterpart/card identity, uniqueness);
//       commit   — SYNCHRONOUS, no await (record/tuple/buffer + accepted
//                  digest + cache + retained ack).
//     Nothing read before an await ever decides a commit; a state that
//     moved makes verify say `retry` — the waiter rule of 6.2, re-entering
//     at stage 4 — or names the disposition. `p.__beforeVerify` is a test
//     hook that perturbs state between prepare and verify.
//   · receiveEncounter: the §6.2 stage order — profile + recipient (5) →
//     payload schema (7) → the pre-lock checks of 4.1 IN ORDER (8) → the
//     lock set {digest, record key} (9, bundles) / {digest} (deliveries).
//   · encounter-credential-delivery (4.3): the effect is BUFFERING; the
//     ack is sent at buffering; Encounter acceptance (5.6) runs
//     separately (own record-key section) and is never signaled (7.4).
//   · digest equality is over decoded multihash bytes (2.3: sameDigest).
//   · "delivered" is the sender's status ONLY on a valid ack (6.1) —
//     trust.receiveAckInner marks bundleAcked / counterAcked.
import { jcs, makeValidator, sameDigest } from '../core.js';
import { SCHEMAS } from '../schemas.js';
import * as C from './deps.js';
import { snapshotPriors } from './continuity.js';
import { buildAck } from './acks.js';
const say = (p, m) => p.log.push(m);
const V = makeValidator(SCHEMAS);
const schemaOk = (file, data) => V.validate(data, SCHEMAS[file], SCHEMAS[file]).length === 0;
const TT = 'https://real-life.org/trust-tasks/';
export const BUNDLE_TYPE = TT + 'encounter-bundle/0.1';
export const DELIVERY_TYPE = TT + 'encounter-credential-delivery/0.1';
// Encounter §9 operational constants (ms)
export const CHALLENGE_MAX_AGE = 5 * 60_000; // PT5M
export const ISSUANCE_WINDOW = 24 * 3_600_000; // PT24H
export const SKEW_TOLERANCE = 5 * 60_000; // PT5M
const sec = (ms) => Math.floor(ms / 1000); // 2.3: whole seconds
// producer-side profile discipline (Delivery 3 / Encounter 6): UUID v4 ids and
// threads, a display name inside the card schema's bound (200 characters)
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuidOk = (v) => typeof v === 'string' && UUID_V4.test(v);
const displayName = (p) => String(p.name ?? '').slice(0, 200);
const secIso = (iso) => Math.floor(Date.parse(iso) / 1000);
// ── 5.3 the own-challenge state model ───────────────────────────────────
// p.challenges: value → { tCh (ms), ctxAnchor, aged? } — every issued
// value is RETAINED until recorded or aged (retention is mandatory).
// p.records: own challenge value → record (5.5); the record's contact
// tuple lives in p.contacts under the counterparty anchor.
const chal = (p) => (p.challenges ??= new Map());
const recs = (p) => (p.records ??= new Map());
/** total resolution by precedence: recorded → open → unknown; the one
 *  write is the aging latch (set-only, whole-second boundary, lock-free) */
export function resolve(p, value, now) {
    if (recs(p).has(value))
        return 'recorded';
    const c = chal(p).get(value);
    if (!c || c.aged)
        return 'unknown';
    if (sec(now) > sec(c.tCh) + (CHALLENGE_MAX_AGE + SKEW_TOLERANCE) / 1000) {
        c.aged = true;
        return 'unknown';
    } // latch
    return 'open';
}
const futureOk = (tCh, now) => sec(tCh) <= sec(now) + SKEW_TOLERANCE / 1000; // 5.5 explicit future check
// the producer's mirror of 5.6 step 6: may a credential binding a challenge issued at tChMs still be issued now?
const issuanceOpen = (tChMs, now) => { const skew = SKEW_TOLERANCE / 1000; return sec(now) >= sec(tChMs) - skew && sec(now) <= sec(tChMs) + (CHALLENGE_MAX_AGE + ISSUANCE_WINDOW) / 1000 + skew; };
const lockState = (p) => (p.lockSet ??= { held: new Set(), waiters: [] });
const release = (L, keys) => { for (const k of keys)
    L.held.delete(k); const w = L.waiters; L.waiters = []; for (const r of w)
    r(); };
/** acquire the whole set at once if free (synchronous); else null */
const tryAcquire = (p, keys) => {
    const L = lockState(p);
    if (keys.some((k) => L.held.has(k)))
        return null;
    for (const k of keys)
        L.held.add(k);
    return L;
};
const awaitRelease = (p) => new Promise((res) => lockState(p).waiters.push(res));
/** producer-side critical section (own actions, no stage evaluation): wait, then run */
async function withLockSet(p, keys, fn) {
    let L = tryAcquire(p, keys);
    while (!L) {
        await awaitRelease(p);
        L = tryAcquire(p, keys);
    }
    try {
        return await fn();
    }
    finally {
        release(L, keys);
    }
}
async function effect(p, keys, e, fail) {
    for (;;) {
        const pr = await e.prepare(); // stages 4–8, holding nothing
        if (pr.error !== undefined)
            return fail(pr.error);
        if (pr.done !== undefined)
            return pr.done;
        // stage 9: the lock set, acquired ATOMICALLY and only if free — a
        // waiter holds nothing and, when the way is free, does NOT resume:
        // it re-enters at stage 4 (prepare again, 6.2)
        const L = tryAcquire(p, keys);
        if (!L) {
            await awaitRelease(p);
            continue;
        }
        try {
            const hook = p.__beforeVerify;
            if (typeof hook === 'function')
                hook();
            // ── from here to the end of commit: NO await ──
            const v = e.verify(pr.prep);
            if (v === 'retry')
                continue; // the state moved: re-enter at stage 4
            if (v !== null)
                return fail(v);
            return e.commit(pr.prep);
        }
        finally {
            release(L, keys);
        }
    }
}
const failed = (err) => ({ handled: true, error: err });
// ── cards (Encounter 6): schema-valid, decoded keys, proof under the anchor
const CARD_SCHEMA = 'contact-card-0.25.schema.json';
async function cardOk(card) {
    if (!schemaOk(CARD_SCHEMA, card))
        return 'card fails contact-card-0.25 schema';
    if (card.version !== C.CARD_VERSION)
        return 'card version unknown';
    if (!card.challenge)
        return 'card without challenge (enactment use requires one)';
    if (!C.calOK(card.challenge.issuedAt) || !C.calOK(card.proof?.created))
        return 'card: calendar-invalid timestamp';
    if (!C.xRawOfMk(card.keyAgreement) || !C.edRawOfAnchor(card.anchor))
        return 'card keyAgreement does not decode (x25519-pub + 32 bytes, 2.3)';
    if (!(await C.diVerify(card, card.anchor)))
        return 'card proof';
    return null;
}
// ── show: a displayed card (5.3 displayed challenge) ─────────────────────
export async function show(p, when, ent = {}) {
    const ctx = await C.pairContext(p.rootIkm, ent.nonce ?? C.rand(32));
    if (p.contexts.has(ctx.anchor))
        return { error: 'validation-failed (pair anchor already used — fresh-always, 4.4)' };
    const ch = C.challengeOf(ent.ch ?? C.rand(17));
    const iso = C.iso(when);
    // single use + monotone latch (5.3): a value that is recorded, still
    // held open, or aged is NEVER re-issued
    if (recs(p).has(ch) || chal(p).has(ch))
        return { error: 'validation-failed (challenge value already issued)' };
    p.contexts.set(ctx.anchor, ctx);
    p.contexts.set(ctx.keyAgreement, ctx);
    chal(p).set(ch, { tCh: when, ctxAnchor: ctx.anchor }); // enters as OPEN
    const card = await C.signCard(ctx, C.cardBody(ctx, { name: displayName(p), challenge: { value: ch, issuedAt: iso } }), iso);
    return { ctx, ch, card, tCh: when };
}
// ── the record (5.5): build (pure) + one SYNCHRONOUS commit ─────────────
// Encounter 4.2: the edge's direction is DERIVED from what exists — issued
// (own credential) and received (counterparty credential accepted); a
// record alone has no direction yet ('◇': met, recorded)
const edgeState = (t) => t.credential && t.credentialIn ? '✓' : t.credential ? '→' : t.credentialIn ? '←' : '◇';
function buildTuple(p, ownCtx, peerCard, ownValue, peerValue, bind, when, extra = {}) {
    const tuple = {
        name: peerCard.name, card: peerCard, provenance: 'ceremony', since: C.iso(when),
        channel: { own: ownCtx, counterpartKa: peerCard.keyAgreement }, priorCands: [],
        ownChallenge: ownValue, peerChallenge: peerValue, bind, ...extra.tuple,
    };
    tuple.state = edgeState(tuple);
    return tuple;
}
function commitRecord(p, tuple, when) {
    tuple.priorCands = snapshotPriors(p); // BEFORE the fresh tuple (6a)
    const c = chal(p).get(tuple.ownChallenge);
    p.contacts.set(tuple.card.anchor, tuple);
    recs(p).set(tuple.ownChallenge, { ceremony: C.CEREMONY, counterpart: tuple.card.anchor, card: tuple.card, ownValue: tuple.ownChallenge, peerValue: tuple.peerChallenge, tCh: c?.tCh ?? when, bind: tuple.bind, at: when, ctxAnchor: tuple.channel.own.anchor, accepted: {} });
    chal(p).delete(tuple.ownChallenge); // open → recorded
    return tuple;
}
// ── outbox / threads / acks ─────────────────────────────────────────────
const outboxOf = (t) => (t.outbox ??= new Map());
// a thread-opening document carries a FRESH threadId (Delivery 3 / 4.1) —
// fresh means: used by no bundle thread, no reserved inbound thread, no
// outbox entry of this person (a re-issued bundle for the same enactment
// opens a fresh thread too; 4.1 "Thread freshness under re-issue")
const threadInUse = (p, id) => {
    for (const t of p.contacts.values()) {
        if (t.bundleThread === id || t.inThreads?.has(id))
            return true;
        for (const o of (t.outbox ?? new Map()).values())
            if (o.threadId === id)
                return true;
    }
    return false;
};
async function issueDoc(p, tuple, type, payload, when, threadId, kind, ent = {}, ceremony, onCommit) {
    const doc = { id: ent.id ?? globalThis.crypto.randomUUID(), type, issuer: tuple.channel.own.anchor, recipient: tuple.card.anchor, threadId, issuedAt: C.iso(when), payload };
    if (ceremony)
        doc.ceremony = ceremony;
    // the outer document validates against the profile BEFORE anything is committed (a malformed document would be refused at stage 5 by every receiver)
    if (!uuidOk(doc.id) || !uuidOk(threadId) || !schemaOk('rltp-delivery-document.schema.json', doc))
        throw new Error('document profile violated (id/threadId UUID v4, schema)');
    const env = await C.seal(doc, tuple.channel.counterpartKa, ent.envNonce ? { nonce: ent.envNonce } : {}); // fallible — nothing persisted yet
    const digest = await C.digestDoc(doc);
    outboxOf(tuple).set(digest, { env: structuredClone(env), threadId, kind }); // COMMIT — the store's own copy …
    onCommit?.(); // … and the duty flag falls in the SAME synchronous span
    return { to: tuple, kind: kind + '/0.1', env, threadId, digest };
}
// Encounter payloads carry transferable signatures → the ack is the
// SIGNED form (4.2/4.4 acknowledgement class rule)
const mkAck = (p, tuple, digest, threadId, when, recipient) => buildAck(p, tuple, digest, threadId, when, { cls: 'signature', ...(recipient ? { recipient } : {}) }).then((a) => a.env);
// the retained ack is the store's OWN copy — the host's handle can never
// alter what a redelivery re-sends (4.2 byte-identical)
// the retained ack shares the completed-effect cache's LIFETIME (4.2), not
// the tuple's: p.ackRetained keeps digest → { env, to } so a redelivery after
// the relation was deleted still re-sends exactly the stored document
const retained = (p) => (p.ackRetained ??= new Map());
const commitAck = (p, tuple, digest, ackEnv) => {
    C.effectDone(p, digest);
    const copy = structuredClone(ackEnv);
    (tuple.ackStore ??= new Map()).set(digest, copy);
    retained(p).set(digest, { env: copy, to: tuple });
    return { to: tuple, kind: 'delivery-ack/0.1', env: ackEnv };
};
const dupResult = (p, digest, anchor) => {
    const r = retained(p).get(digest);
    const to = p.contacts.get(anchor) ?? r?.to;
    return { handled: true, duplicate: true, ack: r ? { to, kind: 'delivery-ack/0.1 (Re-Ack, byte-identisch)', env: structuredClone(r.env) } : undefined };
};
const cached = (p, digest) => (p.deliveryCache ?? new Set()).has(digest);
// ── scan: the scanner's step (5.8 trunk 2–3) → encounter-bundle/0.1 ──────
// A generates a FRESH pair context (4.4 fresh-always) and a FRESH
// challenge c_A created now (5.3: never the display challenge). Under the
// record key: prepare = the binding; verify = single use of the own
// value, pair-anchor freshness, thread freshness, future check; commit =
// the value enters `open`, resolves AUTHORITATIVELY in the same span, the
// RECORD (5.5, before issuing). Credential, sent card and bundle follow.
export async function scan(p, peerCardIn, when, ent = {}) {
    const peerCard = structuredClone(peerCardIn); // SNAPSHOT before the first await: verified = recorded
    const ce = await cardOk(peerCard);
    if (ce)
        return { error: `displayed card invalid (${ce})` };
    if (peerCard.sentTo !== undefined || peerCard.boundTo !== undefined)
        return { error: 'a displayed card carries neither sentTo nor boundTo' };
    const ctx = await C.pairContext(p.rootIkm, ent.nonce ?? C.rand(32));
    if (p.contexts.has(ctx.anchor))
        return { error: 'validation-failed (pair anchor already used — fresh-always, 4.4)' };
    let ownValue = C.challengeOf(ent.ch ?? C.rand(17));
    while (!ent.ch && ownValue === peerCard.challenge.value)
        ownValue = C.challengeOf(C.rand(17));
    if (ownValue === peerCard.challenge.value)
        return { error: 'validation-failed (c_A equals the displayed challenge — never reused in a sent card, 5.3)' };
    const peerValue = peerCard.challenge.value;
    // 5.3 single use, from the scanner's side too: a displayed value already
    // present in one of OUR records never enters a second enactment (a double
    // scan of one code would otherwise overwrite the anchor pair's tuple) —
    // decided in verify, under a lock key for THIS display (anchor + value),
    // so parallel scans of one code linearize
    const alreadyScanned = () => { for (const r of recs(p).values())
        if (r.peerValue === peerValue && r.counterpart === peerCard.anchor)
            return true; return false; };
    if (alreadyScanned())
        return { error: 'validation-failed (this code was already scanned — its challenge is in a record, 5.3)' };
    const displayKey = 'display:' + peerCard.anchor + ':' + peerValue;
    const threadId = ent.threadId ?? globalThis.crypto.randomUUID();
    if (!uuidOk(threadId) || (ent.id !== undefined && !uuidOk(ent.id)))
        return { error: 'validation-failed (id/threadId must be UUID v4 — Delivery 3)' }; // before the record gate
    const iso = C.iso(when);
    const recorded = await effect(p, [ownValue, displayKey], {
        prepare: async () => ({ prep: { bind: await C.binding(C.CEREMONY, ownValue, peerValue) } }),
        verify: () => {
            if (alreadyScanned())
                return 'validation-failed (this code was already scanned — its challenge is in a record, 5.3)';
            if (recs(p).has(ownValue) || chal(p).has(ownValue))
                return 'validation-failed (own challenge value already in use)'; // single use (5.3/5.5)
            if (p.contexts.has(ctx.anchor))
                return 'validation-failed (pair anchor already used — fresh-always, 4.4)';
            if (threadInUse(p, threadId))
                return 'validation-failed (threadId not fresh — a bundle opens its exchange, 4.1)';
            if (!futureOk(when, when))
                return 'gate-future';
            return null;
        },
        commit: ({ bind }) => {
            p.contexts.set(ctx.anchor, ctx);
            p.contexts.set(ctx.keyAgreement, ctx);
            chal(p).set(ownValue, { tCh: when, ctxAnchor: ctx.anchor }); // enters as OPEN, t_ch = now …
            if (resolve(p, ownValue, when) !== 'open') {
                chal(p).delete(ownValue);
                return { error: 'validation-failed (own challenge does not resolve open)' };
            } // … resolved AUTHORITATIVELY in the same span
            // 5.5: the record BEFORE issuing — `bundlePending` marks the issuance
            // still owed (credential · sent card · bundle), resumable via resumeEncounter
            const tuple = commitRecord(p, buildTuple(p, ctx, peerCard, ownValue, peerValue, bind, when, { tuple: { bundleThread: threadId, bundlePending: true, tChOwn: when } }), when);
            return { tuple };
        },
    }, (err) => ({ error: err }));
    if (recorded.error)
        return recorded;
    const out = await withLockSet(p, [ownValue], () => completeScan(p, recorded.tuple, when, ent));
    if (!out)
        return { error: 'stale-issuance (issuance window closed before the credential could be issued)' };
    return { ...out, ctx };
}
// the scanner's owed issuance after the record (idempotent, resumable):
// credential → sent card → bundle into the outbox. Each piece that exists
// is kept; only the missing ones are produced. Errors propagate — the
// record stands and `bundlePending` keeps the duty visible to the resume.
async function completeScan(p, tuple, when, ent = {}) {
    const ctx = tuple.channel.own, rec = recs(p).get(tuple.ownChallenge);
    const tCh = tuple.tChOwn ?? when;
    // the credential carries its ACTUAL issuance time (7.2) — a resume long
    // after the record must not backdate; the issuance window (5.6 step 6)
    // is anchored at the SUBJECT's challenge — the one the credential binds
    // (c_B, whose t_ch the receiver's record holds) — not at our own c_A;
    // outside it no encounter credential is issued any more: the record
    // stands, the duty lapses honestly
    const now = C.iso(when);
    if (!tuple.credential) {
        if (!issuanceOpen(Date.parse(tuple.card.challenge.issuedAt), when)) {
            delete tuple.bundlePending;
            tuple.bundleLapsed = 'stale-issuance';
            say(p, `${tuple.name}: Ausstellung nach dem Issuance-Window — kein Credential mehr (Record bleibt)`);
            return null;
        }
        const cred = await C.issueCredential(ctx, tuple.card.anchor, C.CEREMONY, tuple.peerChallenge, tuple.bind, now);
        const d = await C.digestDoc(cred);
        if (!tuple.credential) {
            tuple.credential = cred;
            rec.accepted.out = d;
            tuple.state = edgeState(tuple);
        }
    }
    if (!tuple.sentCard) {
        // the sent challenge keeps ITS issuance time (t_ch); the card proof is dated now
        const sc = await C.signCard(ctx, C.cardBody(ctx, { name: displayName(p), challenge: { value: tuple.ownChallenge, issuedAt: C.iso(tCh) }, sentTo: tuple.card.anchor, boundTo: tuple.peerChallenge }), now);
        tuple.sentCard ??= sc;
    }
    const existing = [...outboxOf(tuple).entries()].find(([, o]) => o.kind === 'encounter-bundle');
    if (existing) {
        delete tuple.bundlePending;
        return { to: tuple, kind: 'encounter-bundle/0.1', env: structuredClone(existing[1].env), threadId: existing[1].threadId, digest: existing[0], sentCard: tuple.sentCard, credential: tuple.credential };
    }
    say(p, `${tuple.name} verifiziert — Credential unterwegs (Ankunft ≠ Annahme)`);
    const out = await issueDoc(p, tuple, BUNDLE_TYPE, { card: tuple.sentCard, credential: tuple.credential }, when, tuple.bundleThread, 'encounter-bundle', ent, undefined, () => { delete tuple.bundlePending; });
    return { ...out, sentCard: tuple.sentCard, credential: tuple.credential };
}
/**
 * Resume owed issuance after a failure between record and outbox (the
 * scanner's bundle, the deferred counter-step document). Idempotent; the
 * host calls it before flushEncounter. Returns the documents produced now.
 */
export async function resumeEncounter(p, when) {
    const outbound = [];
    for (const [anchor, t] of [...p.contacts]) {
        if (!t.ownChallenge)
            continue;
        // only STANDING duties survive deactivation: an owed bundle (record
        // stands, 5.8 step 3) and an owed counter document (5.8 step 4)
        if (t.deactivated && !(t.credential && t.counterDocPending) && !t.bundlePending)
            continue;
        try {
            if (t.bundlePending) {
                const o = await withLockSet(p, [t.ownChallenge], async () => t.bundlePending ? completeScan(p, t, when) : null);
                if (o?.env)
                    outbound.push({ to: t, kind: o.kind + ' (resumed)', env: o.env, sentCard: o.sentCard, threadId: o.threadId, peerAnchor: t.card.anchor });
            }
            if (t.counterDocPending && t.bundleThread) {
                const o = await counterEffect(p, anchor, when, {}, [t.ownChallenge]);
                if (o?.env)
                    outbound.push({ to: t, kind: o.kind + ' (resumed)', env: o.env });
            }
        }
        catch (err) {
            say(p, `resume: ${t.name}: ${String(err?.message ?? err)} — bleibt ausstehend`);
        }
    }
    return { outbound };
}
// ── counter: the counter-step (5.8 trunk 4) → encounter-credential-delivery/0.1
// Issues (and commits) our step credential binding c_peer at once; the
// DELIVERY DOCUMENT carries step "counter" + enactment and the BUNDLE's
// threadId (4.3) — when the record arose on the optical leg and the
// bundle has not arrived yet, the document is deferred
// (`counterDocPending`) and issued the moment the bundle lands. No
// optical carrier exists for the counter-step (5.8 step 4; 5.3).
export async function counter(p, peerAnchor, when, ent = {}) {
    if (ent.id !== undefined && !uuidOk(ent.id))
        return { error: 'validation-failed (id must be UUID v4 — Delivery 3)' };
    const t0 = p.contacts.get(peerAnchor);
    if (!t0?.ownChallenge)
        return { error: 'no enactment record for this contact' };
    // a NEW issuance needs an active tuple; MATERIALIZING an already issued,
    // pending credential is a standing duty that deactivation never cancels
    if (t0.deactivated && !(t0.credential && t0.counterDocPending))
        return { error: 'no enactment record for this contact' };
    return counterEffect(p, peerAnchor, when, ent, [t0.ownChallenge]);
}
// the counter-step's body; `keys` = [] when the caller already holds the record key
async function counterEffect(p, peerAnchor, when, ent, keys) {
    // the WHOLE step (credential commit + document issue) under the record
    // key: a concurrent caller sees the finished state, never the gap
    return withLockSet(p, keys, () => counterBody(p, peerAnchor, when, ent));
}
async function counterBody(p, peerAnchor, when, ent) {
    const issued = await effect(p, [], {
        prepare: async () => {
            const t = p.contacts.get(peerAnchor);
            if (!t?.ownChallenge || !recs(p).has(t.ownChallenge))
                return { error: 'no enactment record for this contact' };
            if (t.credential && !t.counterDocPending)
                return { error: 'counter-step already issued' };
            if (t.credential)
                return { prep: { t, cred: t.credential, fresh: false } }; // materialization — allowed even when deactivated
            if (t.deactivated)
                return { error: 'no enactment record for this contact' }; // no NEW issuance on a deactivated tuple
            // §9 issuance-window, anchored at the SUBJECT's challenge (c_A, the one
            // this credential binds — its t_ch is the sent card's challenge time):
            // past it, no counter credential is issued (it could never be accepted)
            if (!issuanceOpen(Date.parse(t.card.challenge.issuedAt), when))
                return { error: 'stale-issuance (issuance window closed — no counter-step any more)' };
            const cred = await C.issueCredential(t.channel.own, peerAnchor, C.CEREMONY, t.peerChallenge, t.bind, C.iso(when));
            return { prep: { t, cred, d: await C.digestDoc(cred), fresh: true } };
        },
        verify: ({ t, fresh }) => {
            if (!recs(p).has(t.ownChallenge))
                return 'no enactment record for this contact';
            if (fresh && t.deactivated)
                return 'no enactment record for this contact';
            if (fresh && t.credential)
                return 'counter-step already issued'; // a concurrent issue won
            return null;
        },
        commit: ({ t, cred, d, fresh }) => {
            if (fresh) {
                t.credential = cred;
                recs(p).get(t.ownChallenge).accepted.out = d;
                t.counterDocPending = true;
                t.state = edgeState(t);
            }
            return { t };
        },
    }, (err) => ({ error: err }));
    if (issued.error)
        return issued;
    const t = issued.t;
    if (!t.bundleThread) {
        say(p, `Gegenschritt an ${t.name} ausgestellt — das Zustelldokument wartet auf den Bundle-Thread (4.3: step "counter")`);
        return { deferred: true, credential: t.credential, to: t };
    }
    // a crash after the outbox write but before the flag fell: the document exists — take it, never a second one
    const existing = [...outboxOf(t).entries()].find(([, o]) => o.kind === 'encounter-credential-delivery' && o.threadId === t.bundleThread);
    if (existing) {
        delete t.counterDocPending;
        return { to: t, kind: 'encounter-credential-delivery/0.1', env: structuredClone(existing[1].env), threadId: existing[1].threadId, digest: existing[0], credential: t.credential };
    }
    const out = await issueDoc(p, t, DELIVERY_TYPE, { credential: t.credential }, when, t.bundleThread, 'encounter-credential-delivery', ent, { step: 'counter', enactment: t.bind }, () => { delete t.counterDocPending; });
    say(p, `Gegenschritt an ${t.name} ausgestellt (counter)`);
    return { ...out, credential: t.credential };
}
// ── the optical leg (5.8): the SENT CARD as ceremony-level input ─────────
export async function captureSentCard(p, cardIn, when) {
    const card = structuredClone(cardIn); // SNAPSHOT before the first await (TOCTOU): verified = recorded
    const ce = await cardOk(card);
    if (ce)
        return { error: `sent card invalid (${ce})` };
    if (typeof card.sentTo !== 'string' || typeof card.boundTo !== 'string')
        return { error: 'not a sent card' };
    if (card.challenge.value === card.boundTo)
        return { error: 'validation-failed (sent challenge equals the displayed challenge — 5.3)' };
    const ctx = p.contexts.get(card.sentTo);
    if (!ctx || ctx.anchor !== card.sentTo)
        return { error: 'sentTo ≠ own anchor' };
    // the 5.5 taxonomy for a bound challenge that resolves `recorded`
    const recordedTaxonomy = () => {
        const r = recs(p).get(card.boundTo);
        if (r.ctxAnchor !== ctx.anchor)
            return 'validation-failed (challenge bound to another anchor)';
        if (r.counterpart !== card.anchor)
            return 'consumed-challenge';
        if (jcs(r.card) !== jcs(card))
            return 'validation-failed (card differs from record)';
        return { handled: true, idempotent: true, to: card.anchor };
    };
    return effect(p, [card.boundTo], {
        // prepare is pure: the binding only — EVERY decision (unknown → gate-
        // expired · recorded → the 5.5 taxonomy · open → record) is produced at
        // the serialization point, inside the lock (5.5)
        prepare: async () => ({ prep: { bind: await C.binding(C.CEREMONY, card.boundTo, card.challenge.value), idem: false } }),
        verify: (q) => {
            const st = resolve(p, card.boundTo, when); // AUTHORITATIVE, same synchronous span as the commit
            if (st === 'unknown')
                return 'gate-expired';
            if (st === 'recorded') {
                const r = recordedTaxonomy();
                if (typeof r === 'string')
                    return r;
                q.idem = true;
                return null;
            }
            if (chal(p).get(card.boundTo).ctxAnchor !== ctx.anchor)
                return 'validation-failed (challenge bound to another anchor)'; // 4.4: sentTo = the anchor that displayed c_B
            if (!futureOk(chal(p).get(card.boundTo).tCh, when))
                return 'gate-future';
            return null;
        },
        commit: ({ bind, idem }) => {
            if (idem)
                return { handled: true, idempotent: true, to: card.anchor }; // JCS-identical card on the existing record: no-op
            const tuple = commitRecord(p, buildTuple(p, ctx, card, card.boundTo, card.challenge.value, bind, when, { tuple: { credentialPending: true } }), when);
            say(p, `${card.name}'s sent card captured optically — same encounter, the confirmation follows over the network`);
            return { handled: true, recorded: true, to: card.anchor, name: tuple.name }; // the record itself is never handed out
        },
    }, (err) => ({ error: err }));
}
// ── receive: encounter-bundle / encounter-credential-delivery ────────────
export async function receiveEncounter(p, env, when, ent = {}) {
    const opened = await C.openEnvelope(p, env); // stages 1–4
    if (opened.error)
        return { handled: false };
    const ctx = p.contexts.get(env.rkid);
    if (!ctx)
        return { handled: false };
    const doc = opened.doc;
    if (doc?.type !== BUNDLE_TYPE && doc?.type !== DELIVERY_TYPE)
        return { handled: false, doc };
    if (opened.duplicate)
        return reAck(p, opened.digest);
    // stage 5: document profile (schema) + recipient = own anchor
    if (!schemaOk('rltp-delivery-document.schema.json', doc) || doc.proof !== undefined)
        return { handled: true, error: 'malformed document' };
    if (doc.recipient !== ctx.anchor)
        return { handled: true, error: 'wrong-recipient' }; // 6.2 stage 5 disposition
    return doc.type === BUNDLE_TYPE ? receiveBundle(p, ctx, doc, opened.digest, when, ent) : receiveDelivery(p, ctx, doc, opened.digest, when, ent);
}
// 4.2 / 6.2 stage 4: duplicate-known → the STORED ack, byte-identical (a copy)
function reAck(p, digest) {
    const r = retained(p).get(digest);
    if (r)
        return { handled: true, duplicate: true, ack: { to: r.to, kind: 'delivery-ack/0.1 (Re-Ack, byte-identisch)', env: structuredClone(r.env) } };
    for (const t of p.contacts.values()) {
        const stored = t.ackStore?.get(digest);
        if (stored)
            return { handled: true, duplicate: true, ack: { to: t, kind: 'delivery-ack/0.1 (Re-Ack, byte-identisch)', env: structuredClone(stored) } };
    }
    return { handled: true, duplicate: true };
}
// ── the credential checks, in normative order ───────────────────────────
// 5.6 step 1 — FORMAT: schema, format, ceremony AND version KNOWN
// (registered: encounter-scan@0.25 only), calendar-valid timestamps,
// digest parsed as a multihash, keys decode (2.3) — else ERR_VERSION
function credFormat(cred, ceremonyHere = true) {
    if (!schemaOk('encounter-credential-0.25.schema.json', cred) || cred.credentialSubject?.format !== C.CRED_FORMAT)
        return 'ERR_VERSION';
    // 5.6 step 1 knows the ceremony here; Delivery 4.1 places the ceremony
    // equality at its step 5 (after card proof, credential proof, addressee)
    if (ceremonyHere && cred.credentialSubject.ceremony !== C.CEREMONY)
        return 'ERR_VERSION';
    if (!C.calOK(cred.validFrom) || !C.calOK(cred.proof?.created))
        return 'ERR_VERSION';
    if (!sameDigest(cred.credentialSubject.enactmentBinding, cred.credentialSubject.enactmentBinding))
        return 'ERR_VERSION';
    if (!C.edRawOfAnchor(cred.issuer) || !C.edRawOfAnchor(cred.credentialSubject.id))
        return 'ERR_VERSION';
    const vm = String(cred.proof?.verificationMethod ?? ''), hash = vm.indexOf('#');
    if (hash < 0 || !C.edRawOfAnchor(vm.slice(0, hash)) || !C.edRawOfAnchor('did:key:' + vm.slice(hash + 1)))
        return 'ERR_VERSION';
    return null;
}
// steps 1–3: format · signature · addressee
async function credHead(cred, ctx, ceremonyHere = true) {
    const f = credFormat(cred, ceremonyHere);
    if (f)
        return f;
    if (!(await C.diVerify(cred, cred.issuer)))
        return 'ERR_SIG';
    if (cred.credentialSubject.id !== ctx.anchor)
        return 'ERR_ADDRESSEE';
    return null;
}
// step 6: the issuance window, whole seconds, inclusive, skew widens
function windowOk(cred, tChMs) {
    const tCh = sec(tChMs), vf = secIso(cred.validFrom), cr = secIso(cred.proof.created), skew = SKEW_TOLERANCE / 1000;
    const lo = tCh - skew, hi = tCh + (CHALLENGE_MAX_AGE + ISSUANCE_WINDOW) / 1000 + skew;
    return !(vf < lo || vf > hi || cr < lo || cr > hi || cr < vf - skew);
}
// steps 4–7 against a record (SYNCHRONOUS — usable inside verify). `order`:
//   'credential' — 5.6: record · ceremony · WINDOW · BINDING
//   'bundle'     — Delivery 4.1 pre-lock: record · ceremony · BINDING · WINDOW
function acceptTail(cred, rec, order) {
    if (!rec || rec.counterpart !== cred.issuer)
        return 'ERR_NO_RECORD';
    if (cred.credentialSubject.ceremony !== rec.ceremony)
        return 'ERR_CEREMONY';
    const bindOk = sameDigest(cred.credentialSubject.enactmentBinding, rec.bind);
    if (order === 'bundle' && !bindOk)
        return 'ERR_BINDING';
    if (!windowOk(cred, rec.tCh))
        return 'ERR_STALE_ISSUANCE';
    if (!bindOk)
        return 'ERR_BINDING';
    return null;
}
const disposition = (e) => e === 'ERR_STALE_ISSUANCE' ? 'stale-issuance' : `validation-failed (${e})`;
// ── bundles ─────────────────────────────────────────────────────────────
// stages 7–8 for a bundle (stage 5 ran in receiveEncounter): the pre-lock
// checks of 4.1 IN ORDER. The only state read is the resolution (which
// latches) and thread freshness — both re-checked synchronously in verify.
// the ORIGINAL bundle re-evaluated after cache/ack retention (4.2: "a bundle
// whose enactment record still exists lands in the record-aware effect") is
// the same document, not a new one on a used thread
// … the same holds for every re-issued bundle that landed record-aware on
// its own fresh thread: the record keeps thread → document digest
const sameOpeningBundle = (p, anchor, threadId, digest) => {
    const t = p.contacts.get(anchor);
    if (!t)
        return false;
    if (t.bundleThread === threadId)
        return sameDigest(t.bundleDigest, digest);
    const d = t.inThreadDigests?.get(threadId);
    return d !== undefined && sameDigest(d, digest);
};
async function bundleChecks(p, ctx, doc, digest, when) {
    const pl = doc.payload;
    if (!schemaOk('payload-encounter-bundle.schema.json', pl))
        return { error: 'malformed bundle' }; // stage 7
    const { card, credential } = pl;
    // (1) profile/structure: calendars, outer/inner equalities, card version, keys decode, thread fresh, credential FORMAT
    if (!C.calOK(doc.issuedAt) || !C.calOK(card.challenge?.issuedAt) || !C.calOK(card.proof?.created))
        return { error: 'calendar-invalid issuedAt' };
    if (doc.issuer !== card.anchor || card.anchor !== credential.issuer)
        return { error: 'outer binding (issuer = card.anchor = credential.issuer)' };
    if (credential.credentialSubject?.id !== doc.recipient)
        return { error: 'outer binding (recipient = subject)' };
    if (card.sentTo !== doc.recipient || card.boundTo !== credential.credentialSubject.challenge)
        return { error: 'sent card binding (sentTo/boundTo)' };
    if (card.challenge.value === card.boundTo)
        return { error: 'validation-failed (sent challenge equals the displayed challenge — 5.3)' };
    if (doc.ceremony?.enactment !== undefined && !sameDigest(doc.ceremony.enactment, credential.credentialSubject.enactmentBinding))
        return { error: 'ceremony.enactment recomputes not (validation-failed)' };
    if (card.version !== C.CARD_VERSION || !card.challenge)
        return { error: 'validation-failed (card version/challenge)' };
    if (!C.xRawOfMk(card.keyAgreement) || !C.edRawOfAnchor(card.anchor))
        return { error: 'validation-failed (card keys do not decode)' };
    if (threadInUse(p, doc.threadId) && !sameOpeningBundle(p, card.anchor, doc.threadId, digest))
        return { error: 'validation-failed (threadId not fresh — a bundle opens its exchange)' };
    const f = credFormat(credential, false);
    if (f)
        return { error: disposition(f) };
    // (2) card proof · (3) credential proof · (4) addressee
    if (!(await C.diVerify(card, card.anchor)))
        return { error: 'card proof' };
    const h = await credHead(credential, ctx, false);
    if (h)
        return { error: disposition(h) };
    // (5) provisional RESOLUTION first (it latches an aged held value) → an
    //     `unknown` ends the pre-lock checks and goes to the lock; otherwise
    //     ceremony → binding · (6) window
    const own = credential.credentialSubject.challenge;
    const bind = await C.binding(C.CEREMONY, own, card.challenge.value);
    const st = resolve(p, own, when);
    if (st !== 'unknown') {
        if (credential.credentialSubject.ceremony !== C.CEREMONY)
            return { error: 'validation-failed (ceremony)' };
        // the bound challenge belongs to THIS pair context (4.4: the enacting
        // anchor is the one that displayed it — never another local anchor)
        if (ctxOfChallenge(p, own, st) !== ctx.anchor)
            return { error: 'validation-failed (challenge bound to another anchor)' };
        // checks 5–6 with t_ch from the resolution — for a recorded value TOO,
        // whatever its counterparty (consumed-challenge is a stage-9 verdict;
        // 4.1: "only after 1–6 pass does evaluation reach the final stage")
        const tCh = st === 'recorded' ? recs(p).get(own).tCh : chal(p).get(own).tCh;
        if (!sameDigest(credential.credentialSubject.enactmentBinding, bind))
            return { error: 'validation-failed (ERR_BINDING)' };
        if (!windowOk(credential, tCh))
            return { error: 'stale-issuance' };
    }
    return { own, bind, card, credential, st };
}
const ctxOfChallenge = (p, value, st) => st === 'recorded' ? recs(p).get(value)?.ctxAnchor : chal(p).get(value)?.ctxAnchor;
async function receiveBundle(p, ctx, doc, digest, when, ent) {
    const pre = await bundleChecks(p, ctx, doc, digest, when);
    if (pre.error)
        return failed(pre.error);
    const { own, card } = pre;
    // stage 9 under the LOCK SET {digest, record key}
    const res = await effect(p, [digest, own], {
        prepare: async () => {
            if (cached(p, digest))
                return { done: dupResult(p, digest, card.anchor) };
            const r = await bundleChecks(p, ctx, doc, digest, when); // re-entry at stage 4: every check under the state found
            if (r.error)
                return { error: r.error };
            const credDigest = await C.digestDoc(r.credential);
            if (r.st === 'unknown')
                return { prep: { ...r, credDigest, mode: 'unknown' } };
            if (r.st === 'open') {
                const tuple = buildTuple(p, ctx, card, own, card.challenge.value, r.bind, when, { tuple: { credentialIn: r.credential, bundleThread: doc.threadId } });
                const ackEnv = await mkAck(p, tuple, digest, doc.threadId, when, card.anchor);
                return { prep: { ...r, credDigest, mode: 'open', tuple, ackEnv } };
            }
            // recorded: the ack can only be built if OUR tuple exists; the verdict
            // (consumed-challenge / record-aware / moved) is verify's, under the lock
            const tuple = p.contacts.get(card.anchor);
            const ackEnv = tuple ? await mkAck(p, tuple, digest, doc.threadId, when) : undefined;
            return { prep: { ...r, credDigest, mode: 'recorded', tuple, ackEnv } };
        },
        verify: (q) => {
            if (cached(p, digest))
                return 'retry'; // a concurrent identical document committed → duplicate-known
            const st = resolve(p, own, when); // AUTHORITATIVE — same synchronous span as the commit
            if (st === 'unknown')
                return 'validation-failed (challenge unknown)';
            if (st !== q.mode)
                return 'retry'; // the state moved: re-enter at stage 4
            if (ctxOfChallenge(p, own, st) !== ctx.anchor)
                return 'validation-failed (challenge bound to another anchor)';
            if (threadInUse(p, doc.threadId) && !sameOpeningBundle(p, card.anchor, doc.threadId, digest))
                return 'validation-failed (threadId not fresh — a bundle opens its exchange)';
            if (st === 'open') {
                if (!futureOk(chal(p).get(own).tCh, when))
                    return 'gate-future';
                const e = acceptTail(q.credential, { counterpart: card.anchor, ceremony: C.CEREMONY, tCh: chal(p).get(own).tCh, bind: q.bind }, 'bundle');
                return e ? disposition(e) : null;
            }
            // recorded → the record decides
            const rec = recs(p).get(own);
            if (rec.counterpart !== card.anchor)
                return 'consumed-challenge';
            if (jcs(rec.card) !== jcs(card))
                return 'validation-failed (card differs from record)';
            const e = acceptTail(q.credential, rec, 'bundle');
            if (e)
                return disposition(e);
            if (rec.accepted.in && !sameDigest(rec.accepted.in, q.credDigest))
                return 'validation-failed (ERR_CONFLICT)';
            if (!q.tuple || !q.ackEnv || p.contacts.get(card.anchor) !== q.tuple)
                return 'retry'; // tuple moved since prepare: re-enter
            return null;
        },
        commit: (q) => {
            if (q.mode === 'open') {
                // record-creating effect: record + tuple + accepted credential + cache + retained ack
                commitRecord(p, q.tuple, when);
                q.tuple.bundleDigest = digest; // the bundle that opened this exchange (retention-independent identity)
                recs(p).get(own).accepted.in = q.credDigest;
                const ack = commitAck(p, q.tuple, digest, q.ackEnv);
                say(p, `${card.name} verified you — arrival, not acceptance: you decide`);
                return { handled: true, recorded: true, prompt: { peerAnchor: card.anchor, from: card.name }, ack };
            }
            // record-aware effect: credential accepted, no gate, no second record;
            // the record keeps the thread of the bundle that committed first
            const rec = recs(p).get(own), tuple = q.tuple;
            rec.accepted.in = q.credDigest;
            tuple.credentialIn = q.credential;
            tuple.bundleThread ??= doc.threadId;
            tuple.bundleDigest ??= digest;
            if (tuple.bundleThread !== doc.threadId) {
                (tuple.inThreads ??= new Set()).add(doc.threadId);
                (tuple.inThreadDigests ??= new Map()).set(doc.threadId, digest);
            } // a re-issue's fresh thread is used now (4.1) — and remembered with its document
            delete tuple.credentialPending;
            tuple.state = edgeState(tuple);
            carryToHead(p, tuple);
            const ack = commitAck(p, tuple, digest, q.ackEnv);
            say(p, `${card.name} — Credential angekommen (Record stand bereits, optischer Leg)`);
            return { handled: true, accepted: true, mutual: tuple.state === '✓', from: card.name, peerAnchor: card.anchor, ack, counterPending: !!tuple.counterDocPending };
        },
    }, failed);
    // a counter-step issued on the optical leg waited for this thread (4.3)
    if (res?.counterPending) {
        delete res.counterPending;
        try {
            res.counterOut = await counterEffect(p, card.anchor, when, {}, [own]);
        }
        catch (err) {
            say(p, `Gegenschritt-Dokument: ${String(err?.message ?? err)} — bleibt ausstehend`);
        }
    }
    else if (res)
        delete res.counterPending;
    return res;
}
// ── credential deliveries (4.3) ─────────────────────────────────────────
// stage 7 + the 4.3 outer/inner consistency (MUST, before any effect) — a
// violation is validation-failed and earns NO ack. SYNCHRONOUS, so it is
// the verify step as well.
function deliveryChecks(p, ctx, doc) {
    const pl = doc.payload;
    if (!schemaOk('payload-encounter-credential-delivery.schema.json', pl))
        return { error: 'malformed credential delivery' };
    const cred = pl.credential;
    if (!C.calOK(doc.issuedAt))
        return { error: 'calendar-invalid issuedAt' };
    if (doc.issuer !== cred.issuer)
        return { error: 'outer binding (issuer = credential.issuer)' };
    if (cred.credentialSubject?.id !== doc.recipient)
        return { error: 'outer binding (recipient = subject)' };
    if (doc.ceremony?.enactment !== undefined && !sameDigest(doc.ceremony.enactment, cred.credentialSubject.enactmentBinding))
        return { error: 'ceremony.enactment recomputes not (validation-failed)' };
    // the relationship channel to the issuer — the ack's only legitimate
    // path; a DEACTIVATED (chained-away) tuple still takes a late credential
    // (Encounter 4.2: accepted against that enactment's record, harmlessly)
    const tuple = p.contacts.get(cred.issuer);
    if (!tuple?.channel?.own || tuple.channel.own.anchor !== ctx.anchor)
        return { error: 'validation-failed (no relationship channel to the issuer)' };
    // 4.3 thread rule: step "counter" = the bundle's threadId; step
    // "deliver" = a fresh thread; the step set is closed
    // Delivery §3: the ceremony member is "entirely unconstrained" — an
    // unknown `step` passes through unrejected; 4.3 gives MEANING to
    // "counter" and "deliver" only, and the thread rule binds those two
    const step = doc.ceremony?.step;
    const isBundleThread = tuple.bundleThread !== undefined && doc.threadId === tuple.bundleThread;
    if (step === 'counter' && !isBundleThread)
        return { error: 'validation-failed (counter-step outside the bundle thread)' };
    if (step === 'deliver' && isBundleThread)
        return { error: 'validation-failed (standalone delivery inside the bundle thread)' };
    if (!isBundleThread && threadInUse(p, doc.threadId))
        return { error: 'validation-failed (threadId not fresh)' };
    return { cred, tuple, isBundleThread };
}
// 4.3: effect = durable BUFFERING; the ack is sent at buffering (lock set
// = the document digest alone); acceptance (5.6) runs SEPARATELY in its
// own record-key section and is never signaled (7.4).
async function receiveDelivery(p, ctx, doc, digest, when, ent) {
    const pre = deliveryChecks(p, ctx, doc);
    if (pre.error)
        return failed(pre.error);
    const buffered = await effect(p, [digest], {
        prepare: async () => {
            if (cached(p, digest))
                return { done: dupResult(p, digest, pre.cred.issuer) };
            const r = deliveryChecks(p, ctx, doc);
            if (r.error)
                return { error: r.error };
            return { prep: { ...r, credDigest: await C.digestDoc(r.cred), ackEnv: await mkAck(p, r.tuple, digest, doc.threadId, when) } };
        },
        verify: (q) => {
            if (cached(p, digest))
                return 'retry';
            const r = deliveryChecks(p, ctx, doc); // synchronous — every consistency + thread condition again
            if (r.error)
                return r.error;
            if (r.tuple !== q.tuple)
                return 'retry';
            return null;
        },
        commit: (q) => {
            // buffer + thread reservation + completed-effect cache + retained ack
            ;
            (q.tuple.buffered ??= new Map()).set(q.credDigest, q.cred);
            if (!q.isBundleThread)
                (q.tuple.inThreads ??= new Set()).add(doc.threadId);
            const ack = commitAck(p, q.tuple, digest, q.ackEnv);
            return { handled: true, buffered: true, ack, cred: q.cred, tuple: q.tuple, credDigest: q.credDigest };
        },
    }, failed);
    if (!buffered.buffered)
        return buffered;
    const { cred, tuple, credDigest, ack } = buffered;
    // the ack is available to the host NOW (4.3: sent at buffering); Encounter
    // acceptance runs separately — `acceptance` resolves with its local outcome
    // (never signaled to the issuer, 7.4)
    const acceptance = withLockSet(p, [cred.credentialSubject.challenge], () => acceptBuffered(p, tuple, cred, credDigest, ctx, when))
        .then((verdict) => ({ accepted: verdict === null, verdict, mutual: tuple.state === '✓' }));
    return { handled: true, buffered: true, from: tuple.name, peerAnchor: cred.issuer, ack, acceptance };
}
async function acceptBuffered(p, tuple, cred, credDigest, ctx, when) {
    // 5.6 IN ORDER: format · signature · addressee FIRST (steps 1–3, no
    // state touched); then — in ONE synchronous span — step 4 via 5.3
    // RESOLUTION (latching), steps 5–8 and the commit
    let e = await credHead(cred, ctx);
    const own = cred.credentialSubject.challenge;
    // ── no await from here ──
    const rec = !e && resolve(p, own, when) === 'recorded' ? recs(p).get(own) : undefined;
    if (!e)
        e = acceptTail(cred, rec, 'credential');
    if (!e && rec.accepted.in && !sameDigest(rec.accepted.in, credDigest))
        e = 'ERR_CONFLICT'; // step 8
    tuple.buffered.delete(credDigest); // evaluated — the buffer held it until now
    if (e) {
        say(p, `${tuple.name} — gepuffertes Credential nicht angenommen (${e}); der Aussteller erfährt davon nichts`);
        return e;
    }
    rec.accepted.in = credDigest;
    tuple.credentialIn = cred;
    delete tuple.credentialPending;
    tuple.state = edgeState(tuple);
    carryToHead(p, tuple);
    say(p, `${tuple.name} — Credential angekommen${tuple.state === '✓' ? ', ihr seid beidseitig verifiziert ✓' : ' (einseitig)'}`);
    return null;
}
// one edge per relationship (4.2): mutuality reached on a chained-away link
// is carried by the chain's active head (the continuity rule) — same for
// both carriers of the credential (bundle and credential delivery)
function carryToHead(p, tuple) {
    if (!tuple.deactivated || tuple.state !== '✓')
        return;
    const head = p.contacts.get(tuple.chainedInto);
    if (head && !head.deactivated) {
        head.state = '✓';
        head.provenance = 'ceremony';
    }
}
// ── the host's producing call: byte-identical redelivery of unacked docs (4.2)
export function flushEncounter(p) {
    const outbound = [];
    for (const t of p.contacts.values())
        for (const o of (t.outbox ?? new Map()).values()) {
            if ((o.kind === 'encounter-bundle' || o.kind === 'encounter-credential-delivery') && !o.acked)
                outbound.push({ to: t, kind: o.kind + '/0.1 (Retry, byte-identisch)', env: structuredClone(o.env) }); // the store keeps its own copy
        }
    return { outbound };
}
