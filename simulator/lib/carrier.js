// GENERATED from lib/dist by scripts/build-simulator-lib.mjs — DO NOT EDIT.
// Source of truth: lib/src/*.ts. CI enforces freshness (--check).
// carrier — Delivery §4.4 + §5a: the carrier side of the port, as one
// transport-agnostic state machine.
//
// What this module is: the executable form of the five guarantees, the
// proof rule of §5a.3, the total binding lifecycle (unbound → live →
// closing → released), the verdict sets with their normative evaluation
// orders (s1–s6, r1–r5), the wind-up whose deadline IS the release, and
// the binding tombstones with their normative eviction order.
//
// What it deliberately is NOT: a resource manager. A carrier's own
// budgets are policy (the 0.65 scope re-cast) and enter through hooks —
// and the CALL GRAPH enforces the guarantees: a request naming a held
// binding never invokes the shared gate (guarantee 4), a below-floor
// submission never reaches the cross-queue hooks (guarantee 5). What no
// library can prevent is a policy wiring two hooks to one counter; such
// a policy is a nonconformant carrier, and the port-review triage says
// so out loud rather than claiming otherwise.
//
// Linearization (§4.4 atomicity): every public operation does its
// asynchronous work (crypto) FIRST and then commits in one synchronous
// block that re-reads state — the commit is the linearization point, no
// await crosses it, and time-driven transitions are applied from the
// operation's own `now` before it reads anything (so a late tick cannot
// lend a released queue an afterlife).
//
// The clock is injected. Nothing here reads Date.now().
import { jcs } from './core.js';
import { b64uOf, fromB64u, base58, fromBase58, sha } from './crypto.js';
import { validCarrierIdentifier } from './carrier-identity.js';
const S = globalThis.crypto.subtle;
const te = new TextEncoder();
const DAY = 86_400_000;
const DOMAINS = [
    ['orphanHorizonMs', 7 * DAY, 365 * DAY],
    ['giveUpHorizonMs', 1 * DAY, 90 * DAY],
    ['challengeLifetimeMs', 5_000, 300_000],
    ['statusHorizonMs', 5_000, 300_000],
    ['maxQueueBytes', 1_048_576, 1_073_741_824],
    ['maxBindingTombstones', 1, Number.MAX_SAFE_INTEGER],
];
/** §11: an out-of-domain declaration REJECTS — it never half-applies. */
export function validateDeclaration(d) {
    const errs = [];
    if (!validCarrierIdentifier(d.carrier))
        errs.push('carrier identifier violates Identity 7a.2');
    for (const [k, lo, hi] of DOMAINS) {
        const v = d[k];
        if (!Number.isSafeInteger(v) || v < lo || v > hi)
            errs.push(`${k} outside [${lo}, ${hi}]`);
    }
    if (!Number.isSafeInteger(d.queueFloorBytes) ||
        d.queueFloorBytes < 65_536 || d.queueFloorBytes > d.maxQueueBytes) {
        errs.push('queueFloorBytes outside [65536, maxQueueBytes]');
    }
    if (d.orphanHorizonMs < d.giveUpHorizonMs)
        errs.push('orphan-horizon < give-up-horizon');
    return errs;
}
// the role key of the registry declaration — a role URI and never a
// document type (round-44 B-1)
export const CARRIER_ROLE_URI = 'https://real-life.org/trust-tasks/delivery-carrier/0.1';
export const PROOF_V = 'rltp-carrier-proof/0.3';
const REGISTRATION_FIELDS = new Set(['v', 'type', 'purpose', 'carrier', 'principal', 'rkid',
    'generation', 'principalChallenge', 'addressChallenge', 'sig']);
const SESSION_FIELDS = new Set(['v', 'type', 'purpose', 'carrier', 'principal', 'rkid',
    'principalChallenge', 'sig']);
// canonical decimal spelling, checked on the RECEIVED bytes (§5a.3):
// `1.0` and `1e0` parse and JCS-canonicalize to `1`, so the signature
// verifies over them — only the lexical check catches the spelling.
export const canonicalGenerationSpelling = (raw) => /^[1-9][0-9]*$/.test(raw) && Number.isSafeInteger(Number(raw));
const canonicalB64u32 = (s) => {
    if (typeof s !== 'string' || s.length !== 43)
        return false;
    try {
        const b = fromB64u(s);
        return b.length === 32 && b64uOf(b) === s;
    }
    catch {
        return false;
    }
};
// decode-and-check: schema validity is not acceptance (§11)
const decodedEd = (did) => {
    if (typeof did !== 'string' || !did.startsWith('did:key:z'))
        return null;
    const b = fromBase58(did.slice('did:key:z'.length));
    return b && b.length === 34 && b[0] === 0xed && b[1] === 0x01 ? b.subarray(2) : null;
};
const decodedX = (mk) => {
    if (typeof mk !== 'string' || mk[0] !== 'z')
        return null;
    const b = fromBase58(mk.slice(1));
    return b && b.length === 34 && b[0] === 0xec && b[1] === 0x01 ? b.subarray(2) : null;
};
const cmpRkidBytes = (a, b) => {
    const ka = decodedX(a);
    const kb = decodedX(b);
    if (!ka || !kb)
        return a < b ? -1 : 1;
    for (let i = 0; i < 32; i++)
        if (ka[i] !== kb[i])
            return ka[i] - kb[i];
    return 0;
};
const decodedSig = (zsig) => {
    if (typeof zsig !== 'string' || zsig[0] !== 'z')
        return null;
    const b = fromBase58(zsig.slice(1));
    if (!b || b.length !== 64)
        return null;
    return 'z' + base58(b) === zsig ? b : null;
};
/** r1, the SYNTACTIC half only — no cryptography happens here, so a
 * request refused at r1 or r2 has cost the carrier no key operation
 * (guarantee 3). `rawGeneration` is REQUIRED for register/rebind: a
 * parsed number cannot carry its own spelling, and an adapter that
 * cannot supply the received bytes cannot claim the check (round-44
 * M-4 of the port review: optional was fail-open). */
export function checkProofShape(p, expectedCarrier, rawGeneration) {
    if (typeof p !== 'object' || p === null)
        return 'refused(malformed)';
    if (p.v !== PROOF_V || p.type !== 'carrier-registration-proof')
        return 'refused(malformed)';
    if (!['register', 'rebind', 'collect', 'conclude'].includes(p.purpose))
        return 'refused(malformed)';
    if (p.carrier !== expectedCarrier)
        return 'refused(malformed)';
    const sessionScoped = p.purpose === 'collect' || p.purpose === 'conclude';
    // the wire format is CLOSED: an extra field is not this artifact
    const allowed = sessionScoped ? SESSION_FIELDS : REGISTRATION_FIELDS;
    for (const k of Object.keys(p))
        if (!allowed.has(k))
            return 'refused(malformed)';
    if (!decodedEd(p.principal) || !decodedX(p.rkid) || !decodedSig(p.sig))
        return 'refused(malformed)';
    if (!canonicalB64u32(p.principalChallenge))
        return 'refused(malformed)';
    if (sessionScoped) {
        if (p.generation !== undefined || p.addressChallenge !== undefined)
            return 'refused(malformed)';
    }
    else {
        if (!Number.isSafeInteger(p.generation) || p.generation < 1)
            return 'refused(malformed)';
        if (rawGeneration === undefined || !canonicalGenerationSpelling(rawGeneration) ||
            Number(rawGeneration) !== p.generation)
            return 'refused(malformed)';
        if (!canonicalB64u32(p.addressChallenge))
            return 'refused(malformed)';
    }
    return null;
}
/** the asymmetric half of r3 — called only past r1, r2 and the challenge
 * consumption, so one challenge buys at most one verification. */
async function verifySignature(p) {
    const pub = decodedEd(p.principal);
    const sig = decodedSig(p.sig);
    const { sig: _omit, ...signed } = p;
    const key = await S.importKey('raw', pub, { name: 'Ed25519' }, false, ['verify']);
    return S.verify({ name: 'Ed25519' }, key, sig, te.encode(jcs(signed)));
}
/** compatibility shim for the shape+signature question alone (tests,
 * tooling): stateless, no challenge semantics. */
export async function verifyProofShape(p, expectedCarrier, rawGeneration) {
    const sessionScoped = p?.purpose === 'collect' || p?.purpose === 'conclude';
    const raw = rawGeneration ?? (sessionScoped || p?.generation === undefined ? undefined : String(p.generation));
    const shape = checkProofShape(p, expectedCarrier, raw);
    if (shape)
        return shape;
    return await verifySignature(p) ? null : 'refused(possession-failed)';
}
// ── envelope shape for submissions (§5, s2) ─────────────────────────────
// A carrier is key-blind but not shape-blind: a submission is a Section-5
// envelope whose rkid names the queue it is submitted to.
const canonicalB64uAny = (s) => {
    if (typeof s !== 'string' || s.length === 0)
        return null;
    try {
        const b = fromB64u(s);
        return b64uOf(b) === s ? b : null;
    }
    catch {
        return null;
    }
};
export function checkEnvelopeBytes(bytes, rkid) {
    let doc;
    try {
        doc = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    }
    catch {
        return false;
    }
    if (typeof doc !== 'object' || doc === null)
        return false;
    const e = doc;
    if (Object.keys(e).length !== 4)
        return false;
    if (e.rkid !== rkid)
        return false;
    const epk = canonicalB64uAny(e.epk);
    const nonce = canonicalB64uAny(e.nonce);
    const ct = canonicalB64uAny(e.ciphertext);
    // > 16: exactly the GCM tag is an EMPTY plaintext, which §5 forbids
    return !!epk && epk.length === 32 && !!nonce && nonce.length === 12 && !!ct && ct.length > 16;
}
export class Carrier {
    #decl;
    /** the declaration as published — a copy; mutating it changes nothing
     * (port-review-2 M-3: the validated state must not be reachable from
     * outside the validated paths). */
    get decl() { return { ...this.#decl }; }
    policy;
    events;
    bindings = new Map();
    tombstones = new Map();
    releaseSeq = 0;
    challenges = new Map();
    // the carrier's clock high-water mark: async completions commit at the
    // NEWEST time the carrier has seen, never at their caller's stale now
    // (port-review-2 M-1) — normative time is monotone
    clock = 0;
    constructor(decl, policy = {}, events = {}) {
        const errs = validateDeclaration(decl);
        if (errs.length)
            throw new Error(`declaration rejects (§11): ${errs.join('; ')}`);
        this.#decl = { ...decl };
        this.policy = policy;
        this.events = events;
    }
    // ── time (§5a.9): transitions fire at their NORMATIVE instants ───────
    // A late tick applies them retroactively — the closing instant is
    // lastCollection + orphan-horizon and the deadline is that + give-up,
    // never "whenever tick happened to run" (port-review B-5). Every
    // public operation advances time to its own `now` before reading, so
    // the port never serves from a state the clock has already ended.
    advance(rawNow) {
        // fail-closed time (port-review-4 M-3): NaN would poison the
        // high-water mark forever, Infinity would fire every deadline at once
        if (!Number.isFinite(rawNow) || rawNow < 0)
            throw new Error('now must be a finite non-negative instant');
        this.clock = Math.max(this.clock, rawNow);
        const now = this.clock;
        for (const [rkid, b] of this.bindings) {
            if (b.state === 'live') {
                // give-up: a deposit's life ends at its own horizon (§5a.8 —
                // carrier-side storage release; the sender learns through its
                // adapter's ordinary path, never through a new verdict)
                for (const d of b.deposits.filter((d) => now >= d.lifeEndsAt))
                    this.events.onGiveUp?.(rkid, d.digest);
                b.deposits = b.deposits.filter((d) => now < d.lifeEndsAt);
                const closingAt = b.lastCollectionAt + this.#decl.orphanHorizonMs;
                if (now >= closingAt) {
                    b.state = 'closing';
                    b.deadline = closingAt + this.#decl.giveUpHorizonMs;
                    for (const d of b.deposits)
                        d.lifeEndsAt = Math.min(d.lifeEndsAt, b.deadline);
                }
            }
        }
        // releases due at this advance, ordered by their NORMATIVE instants
        // (port-review-4 B-2: visit order is Map order, and a late tick made
        // the younger release evict as if it were the older one)
        const due = [];
        for (const [rkid, b] of this.bindings) {
            if (b.state === 'closing' && now >= b.deadline)
                due.push({ rkid, b });
        }
        due.sort((x, y) => (x.b.deadline - y.b.deadline) || cmpRkidBytes(x.rkid, y.rkid));
        for (const { rkid, b } of due) {
            // the deadline IS the release — one transition (round-43 B-1)
            for (const d of b.deposits)
                this.events.onGiveUp?.(rkid, d.digest);
            this.bindings.delete(rkid);
            this.installTombstone(rkid, b.generation, b.deadline);
            this.events.onRelease?.(rkid, b.generation);
        }
        for (const [id, ch] of this.challenges)
            if (now >= ch.expiresAt)
                this.challenges.delete(id);
        this.pendingSeqInstant = null;
    }
    tick(now) { this.advance(now); }
    // ── challenges (§5a.3) ───────────────────────────────────────────────
    /** The gated challenge entry — guarantee 3 BY CONSTRUCTION
     * (port-review-3 M-3): the admission gate runs INSIDE, before any
     * entropy is drawn, so a refused request costs neither randomness nor
     * sealing. `draw` is invoked only past the gate; its `addressValue`
     * (for registration challenges) is the value the adapter will seal to
     * the rkid — the carrier remembers it and a proof must return exactly
     * it. Every challenge is BOUND to its rkid (port-review-3 B-1: a
     * null-rkid challenge disabled the address proof).
     * Returns null when the gate refuses — retriable, guarantee 2. */
    issueChallenge(now, rkid, draw) {
        this.advance(now);
        // syntax BEFORE policy and draw (port-review-5 B-1): a syntactically
        // impossible address buys neither a gate consultation nor a single
        // random byte — §5a.3's order is syntax → admission → randomness
        if (!decodedX(rkid))
            throw new Error('malformed rkid — refuse before any work (5a.3)');
        const held = this.bindings.has(rkid);
        const admitted = held ? (this.policy.admitHeld?.(rkid) ?? true) : (this.policy.admitNew?.() ?? true);
        if (!admitted)
            return null;
        const { entropy, addressValue } = draw();
        if (entropy.length !== 32)
            throw new Error('challenge entropy is 32 bytes');
        const value = b64uOf(entropy);
        this.challenges.set(value, {
            rkid, addressValue: addressValue ?? null,
            expiresAt: this.clock + this.#decl.challengeLifetimeMs, // M-2: the monotone clock, never a stale now
        });
        return value;
    }
    /** consume-first (§5a.3): the first attempt takes the challenge before
     * anything is verified; expiry and rkid binding are checked HERE, so a
     * stale or transplanted challenge dies without buying a verification. */
    consume(value, rkid, now) {
        const ch = this.challenges.get(value);
        this.challenges.delete(value);
        if (!ch || Math.max(now, this.clock) >= ch.expiresAt)
            return null;
        if (ch.rkid !== rkid)
            return null; // bound, always (B-1)
        return ch;
    }
    // ── registration / rebind: r1–r5 (§5a.3, rounds 43/44) ───────────────
    async register(proof, opts) {
        // SNAPSHOT at entry (port-review-4 B-1): the caller's object stays
        // the caller's — what was verified is what commits, whatever the
        // caller mutates while the crypto runs
        const p = { ...proof };
        this.advance(opts.now);
        // r1 — syntax and canonical encodings; no crypto has happened yet.
        // The PURPOSE binds the operation (port-review-2 B-2): a session
        // proof at register() is not this artifact, whatever it signs.
        if (p?.purpose !== 'register' && p?.purpose !== 'rebind')
            return { verdict: 'refused(malformed)' };
        if (checkProofShape(p, this.#decl.carrier, opts.rawGeneration))
            return { verdict: 'refused(malformed)' };
        const heldAtGate = this.bindings.has(p.rkid);
        // r2 — the carrier's own admission metering, subject to guarantee 4:
        // a held binding's request has its own gate (round-44 B-2)
        const admitted = heldAtGate ? (this.policy.admitHeld?.(p.rkid) ?? true) : (this.policy.admitNew?.() ?? true);
        if (!admitted)
            return { verdict: 'refused(admission-resource)', retriable: true };
        // r3 — consume, then verify: the challenge is taken by this attempt
        // before the response is verified, checked for expiry and rkid
        // binding at the same instant (port-review B-1/B-2)
        const ch = this.consume(p.principalChallenge, p.rkid, opts.now);
        if (!ch)
            return { verdict: 'refused(possession-failed)' };
        // fail-closed (port-review-2 B-1): a challenge issued WITHOUT a
        // sealed address value cannot prove address possession — it refuses,
        // it never waves through
        if (ch.addressValue === null || p.addressChallenge !== ch.addressValue) {
            return { verdict: 'refused(possession-failed)' };
        }
        if (!await verifySignature(p))
            return { verdict: 'refused(possession-failed)' };
        // ── the commit block: synchronous from here — the linearization
        // point of §4.4. State is RE-read; no await crosses this line.
        this.advance(opts.now);
        const held = this.bindings.get(p.rkid);
        // r2, re-established (port-review-3 B-3): the gate CLASS (held vs
        // new) may have changed while the crypto ran — a binding that
        // released mid-verify makes this a NEW-binding request, and it must
        // pass the gate a new binding passes, in this same sync block
        if ((held !== undefined) !== heldAtGate) {
            const readmit = held ? (this.policy.admitHeld?.(p.rkid) ?? true) : (this.policy.admitNew?.() ?? true);
            if (!readmit)
                return { verdict: 'refused(admission-resource)', retriable: true };
        }
        // r4 — capacity: only a transition that creates a binding consults it
        if (!held && !(this.policy.hasBindingRoom?.() ?? true)) {
            return { verdict: 'registration-refused(capacity)', retriable: true };
        }
        // r5 — the state table
        const g = p.generation;
        const tomb = this.tombstones.get(p.rkid);
        if (held) {
            if (g > held.generation) {
                held.generation = g;
                held.principal = p.principal;
                this.reopen(held, this.clock);
                return { verdict: 'rebound' };
            }
            if (g === held.generation && p.principal === held.principal) {
                this.reopen(held, this.clock);
                return { verdict: 'registered(idempotent)' };
            }
            return { verdict: 'refused(stale-generation)', heldGeneration: held.generation };
        }
        if (tomb) {
            if (g > tomb.generation) {
                this.tombstones.delete(p.rkid); // consumed
                this.bindings.set(p.rkid, this.freshBinding(g, p.principal, this.clock));
                return { verdict: 'registered' };
            }
            return { verdict: 'refused(stale-generation)', heldGeneration: tomb.generation };
        }
        this.bindings.set(p.rkid, this.freshBinding(g, p.principal, this.clock));
        return { verdict: 'registered' };
    }
    freshBinding(generation, principal, now) {
        return { state: 'live', generation, principal, deposits: [], lastCollectionAt: now };
    }
    reopen(b, now) {
        if (b.state === 'closing') {
            b.state = 'live';
            b.deadline = undefined;
            // the return ends the wind-up: deposits revert to their own
            // admission-dated horizons (§5a.9)
            for (const d of b.deposits)
                d.lifeEndsAt = d.admittedAt + this.#decl.giveUpHorizonMs;
        }
        b.lastCollectionAt = now;
    }
    // ── collection / conclusion (§5a.3/5a.7/5a.8) ────────────────────────
    // purpose is part of the signed bytes AND of the dispatch: a proof for
    // one operation is not a proof for the other (port-review B-3).
    async collect(proof, opts) {
        const p = { ...proof };
        const s = await this.session(p, 'collect', opts.now);
        if (s)
            return s;
        const b = this.bindings.get(p.rkid);
        if (!b || b.principal !== p.principal)
            return { verdict: 'refused(no-such-queue)' };
        b.lastCollectionAt = this.clock;
        return { verdict: 'served', deposits: b.deposits.map((d) => ({ bytes: d.bytes.slice(), digest: d.digest })) };
    }
    async conclude(proof, digest, opts) {
        const p = { ...proof };
        const s = await this.session(p, 'conclude', opts.now);
        if (s)
            return s;
        const b = this.bindings.get(p.rkid);
        if (!b || b.principal !== p.principal)
            return { verdict: 'refused(no-such-queue)' };
        b.deposits = b.deposits.filter((d) => d.digest !== digest);
        // deliberately NOT lastCollectionAt: orphan-expiry counts collections
        // (§5a.9), and a principal must not keep a never-collected queue out
        // of its wind-up by concluding (port-review-2 M-2)
        return { verdict: 'served' };
    }
    async session(proofArg, expected, now) {
        const p = { ...proofArg };
        this.advance(now);
        if (p.purpose !== expected)
            return { verdict: 'refused(malformed)' };
        if (checkProofShape(p, this.#decl.carrier))
            return { verdict: 'refused(malformed)' };
        const held = this.bindings.get(p.rkid);
        const admitted = held ? (this.policy.admitHeld?.(p.rkid) ?? true) : (this.policy.admitNew?.() ?? true);
        if (!admitted)
            return { verdict: 'refused(admission-resource)', retriable: true };
        const ch = this.consume(p.principalChallenge, p.rkid, now);
        if (!ch)
            return { verdict: 'refused(possession-failed)' };
        if (!await verifySignature(p))
            return { verdict: 'refused(possession-failed)' };
        // commit side re-reads (the caller checks binding + principal after
        // this returns null, synchronously)
        this.advance(now);
        if (!this.bindings.has(p.rkid))
            return { verdict: 'refused(no-such-queue)' };
        return null;
    }
    // ── submission: s1–s6 (§5a.5) ────────────────────────────────────────
    async submit(rkid, callerBytes, opts) {
        // SNAPSHOT at entry (port-review-4 M-1/M-2): the bytes are copied
        // before anything reads them, and the declaration is pinned for the
        // whole operation — a concurrent revision governs the NEXT
        // submission, never one already running
        const bytes = callerBytes.slice();
        const decl = this.#decl;
        this.advance(opts.now);
        // s1 — queue lookup FIRST: no hashing for an address the carrier
        // does not hold (port-review-2 M-4 — s3 work ran before s1/s2 and
        // let an unauthenticated blob buy a full SHA pass)
        if (!this.bindings.has(rkid))
            return { verdict: 'refused(no-such-queue)' };
        // s2 — shape and size: a Section-5 envelope naming this queue,
        // within declared bounds
        if (bytes.length > decl.maxQueueBytes || !checkEnvelopeBytes(bytes, rkid)) {
            return { verdict: 'refused(bounds)' };
        }
        // s3 needs the digest — hash now, then RE-read state (the await may
        // have crossed a deadline; the commit block below is synchronous)
        const digest = b64uOf(await sha(bytes));
        this.advance(opts.now);
        const b = this.bindings.get(rkid);
        if (!b)
            return { verdict: 'refused(no-such-queue)' };
        // s3 — byte-identity. The digest indexes; the BYTES decide (M-6).
        const same = b.deposits.find((d) => d.digest === digest &&
            d.bytes.length === bytes.length && d.bytes.every((x, i) => x === bytes[i]));
        if (same) {
            // §5a.5: a duplicate consumes admission work exactly like an
            // admitted submission — and stores nothing
            this.policy.meterQueue?.(rkid, bytes.length);
            return { verdict: 'duplicate' };
        }
        const occupancy = b.deposits.reduce((a, d) => a + d.bytes.length, 0) + bytes.length;
        const withinFloor = occupancy <= decl.queueFloorBytes;
        // s4 — the queue's own meter (below the floor: the only one, g5)
        if (!(this.policy.meterQueue?.(rkid, bytes.length) ?? true)) {
            return { verdict: 'refused(admission-resource)', retriable: true };
        }
        if (!withinFloor) {
            // s5 — the queue's own bound
            if (occupancy > decl.maxQueueBytes)
                return { verdict: 'refused(queue-saturated)', retriable: true };
            // s6 — global occupancy, unreachable below the floor
            if (!(this.policy.hasCapacity?.(bytes.length) ?? true)) {
                return { verdict: 'refused(capacity)', retriable: true };
            }
        }
        const lifeEndsAt = b.state === 'closing' && b.deadline !== undefined
            ? b.deadline // inherits the remaining time
            : this.clock + decl.giveUpHorizonMs;
        b.deposits.push({ bytes, digest, admittedAt: this.clock, lifeEndsAt });
        return { verdict: 'admitted' };
    }
    // ── tombstones (§5a.3): normative order, bookkeeping-free ────────────
    // Releases that fall on the SAME normative instant share one release
    // rank, so the bytewise tie-break genuinely decides between them
    // (port-review M-7) — the advance() loop batches them per call.
    pendingSeqInstant = null;
    installTombstone(rkid, generation, releasedAt) {
        if (this.pendingSeqInstant?.instant !== releasedAt) {
            this.pendingSeqInstant = { instant: releasedAt, seq: ++this.releaseSeq };
        }
        this.tombstones.set(rkid, { generation, releaseSeq: this.pendingSeqInstant.seq });
        this.trimTombstones(this.#decl.maxBindingTombstones);
    }
    trimTombstones(bound) {
        while (this.tombstones.size > bound) {
            const victim = [...this.tombstones.entries()].sort((a, b) => (a[1].releaseSeq - b[1].releaseSeq) || cmpRkidBytes(a[0], b[0]))[0][0];
            this.tombstones.delete(victim);
            this.events.onEvict?.(victim);
        }
    }
    /** guarantee 1: the declaration binds, and a revision is itself
     * validated; a lowered tombstone bound trims in the same step
     * (round-45 B-3 — standing state is not a running act). */
    reviseDeclaration(next) {
        // C is the carrier's IDENTITY, not an operational constant: every
        // principal is derived from it (Identity §7a.4), so "the same
        // carrier under a new C" is a contradiction — a new C is a new
        // carrier with no bindings (port-review-3 B-2)
        if (next.carrier !== undefined && next.carrier !== this.#decl.carrier) {
            throw new Error('the carrier identifier is not revisable — a different C is a different carrier (7a.4)');
        }
        const revised = { ...this.#decl, ...next };
        const errs = validateDeclaration(revised);
        if (errs.length)
            throw new Error(`revision rejects (§11): ${errs.join('; ')}`);
        this.#decl = revised;
        this.trimTombstones(revised.maxBindingTombstones);
    }
    // ── introspection (tests and adapters; not port surface) ─────────────
    stateOf(rkid) {
        const b = this.bindings.get(rkid);
        if (b)
            return b.state;
        return this.tombstones.has(rkid) ? 'released' : 'unbound';
    }
    tombstoneOf(rkid) { return this.tombstones.get(rkid)?.generation ?? null; }
    bindingOf(rkid) {
        const b = this.bindings.get(rkid);
        return b ? { generation: b.generation, principal: b.principal, deposits: b.deposits.length, deadline: b.deadline } : null;
    }
    tombstoneLabels() { return [...this.tombstones.keys()]; }
}
