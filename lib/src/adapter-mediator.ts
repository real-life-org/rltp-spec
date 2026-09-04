// RLTP transport adapter: VTI mediator.
//
// Profile: spec/adapter-vti-mediator.md v0.23 (twenty-third casting;
// round journals under design/adapter-review*). A
// transport adapter contract — NOT a carrier at the port.
//
// Structural rules (reviews 3+4):
//   · No port operation ever awaits the mediator — including
//     register: keylist synchronization is a recorded intent with a
//     tracked background task, retried by advance.
//   · No report is invented, and absence is ABSENT: before the first
//     honest report exists, status() returns null (§6.1 grants the
//     window; representing it as a queryable fourth value was
//     review-4 B2). has() distinguishes an unknown id.
//   · A retired instance mutates nothing and refuses everything
//     except reading its ack state.

import { sha } from './crypto.js'
import { carrierPrincipal, carrierScopedIdentity } from './carrier-identity.js'
import type { CarrierPrincipal, CarrierScopedIdentity } from './carrier-identity.js'

// ── Declared constants (profile §2) — promises of THIS casting ──────
export const DECLARED = {
  giveUpHorizonMs: 72 * 3_600_000,
  statusHorizonMs: 60_000,
  queueFloorCount: 64,
  queueFloorBytes: 1_048_576,
  maxQueueBytes: 16_777_216,
  duplicateWindowMs: 30 * 86_400_000,
} as const

// ── The injected wire ────────────────────────────────────────────────
export type WireErrorKind =
  | 'unreachable' | 'refused-retriable' | 'refused-admission' | 'oversize'

export class WireError extends Error {
  kind: WireErrorKind
  constructor (kind: WireErrorKind, message?: string) {
    super(message ?? kind)
    this.kind = kind
  }
}

export interface MediatorWire {
  authChallenge (did: string): Promise<{ challenge: string, sessionId: string }>
  authenticate (answer: { did: string, challenge: string, sessionId: string }): Promise<TokenSet>
  refresh (refreshToken: string): Promise<TokenSet>
  keylistUpdate (accessToken: string, rkids: string[]): Promise<void>
  deposit (accessToken: string, bytes: Uint8Array, egressDid: string): Promise<void>
  ackReceived (accessToken: string, queueIds: string[]): Promise<void>
  onDeliver (cb: (bytes: Uint8Array) => Promise<void>): void
  /** Optional truthful connectivity signal; absent means unknown. */
  offline? (): boolean
}

export interface TokenSet {
  accessToken: string
  accessExpiresAt: number
  refreshToken: string
  refreshExpiresAt: number
}

// ── Sender states (§6.1 — the closed sets, nothing else) ────────────
export type ReceiverRefusalCode =
  | 'malformedRequest' | 'unsupportedType' | 'proofRequired'
  | 'proofInvalid' | 'wrongRecipient' | 'identityMismatch'

const RECEIVER_REFUSAL_CODES: ReadonlySet<string> = new Set([
  'malformedRequest', 'unsupportedType', 'proofRequired',
  'proofInvalid', 'wrongRecipient', 'identityMismatch',
])

export type SubmissionState =
  | { state: 'awaiting-transport', reason: 'offline' | 'transport-unreachable' | 'carrier-refused-retriable' }
  | { state: 'accepted' }
  | { state: 'delivered', late: boolean }
  | { state: 'failed', reason: 'unroutable' | 'oversize' | 'expired-by-adapter-policy' }
  | { state: 'failed', reason: 'rejected-by-receiver', code: ReceiverRefusalCode }

export interface CollectedItem { bytes: Uint8Array, queueId: string }
export interface Collection { id: string, items: CollectedItem[] }

/** Ack state for the host to persist (profile §4). Invariant: every
 *  pending id names a concluded entry; violations are refused at
 *  construction (fail-closed). */
export interface AckState {
  concluded: Array<{ queueId: string, concludedAt: number }>
  pending: string[]
}

interface Submission {
  bytes: Uint8Array
  submittedAt: number
  attemptStartedAt: number | null
  lastKind: WireErrorKind | null
  st: SubmissionState | null   // null = no honest report exists yet
}

const hex = (b: Uint8Array): string =>
  Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')

// construction capability: only create() holds it
const KEY = Symbol('MediatorCarrierAdapter.create')

// ── The adapter ──────────────────────────────────────────────────────
export class MediatorCarrierAdapter {
  // JS-hard identity fields: TS `readonly` is a compile-time promise
  // only, and §8 claims runtime unforgeability — so the values live
  // in true privates behind getters (R8-B1)
  #principal: string
  #connectionDid: string
  #egressDid: string
  get principal (): string { return this.#principal }
  get connectionDid (): string { return this.#connectionDid }
  get egressDid (): string { return this.#egressDid }
  #wire: MediatorWire
  #tokens: TokenSet | null = null
  #clock = Number.NEGATIVE_INFINITY
  #closed = false

  #subs = new Map<string, Submission>()
  #inflight = new Set<Promise<void>>()
  #nextId = 1

  #desiredRkids: string[] | null = null
  #keylistSynced = false
  #keylistSyncing = false

  #inbox: CollectedItem[] = []
  #inboxBytes = 0
  #inboxDigests = new Set<string>()
  #outstanding = new Map<string, Map<string, CollectedItem>>()
  #outstandingBytes = 0
  #concluded = new Map<string, number>()
  #pendingAcks = new Set<string>()
  #flightAcks = new Set<string>()   // ids inside the in-flight flush snapshot
  #flushing = false
  #nextColId = 1

  #transitions: Array<{ id: string, to: 'delivered' }> = []

  /** The only way to build an adapter: the trio is DERIVED here from
   *  one root, one carrier, one nonce — so principal, connection DID
   *  and egress identity cannot come from different relationships
   *  (R7-B2: the coupling is enforced by construction, not by
   *  inspecting caller-supplied identities). */
  static async create (
    rootIkm: Uint8Array, carrier: string, nonce: Uint8Array,
    wire: MediatorWire, restored?: AckState, restoredAt?: number,
  ): Promise<MediatorCarrierAdapter> {
    // ONE tuple, snapshotted at entry: a caller mutating its buffers
    // between the three awaited derivations must not be able to mix
    // identities from two tuples (R8-B2)
    const ikm = rootIkm.slice()
    const n = nonce.slice()
    const principal = await carrierPrincipal(ikm, carrier, n)
    const connection = await carrierScopedIdentity(ikm, carrier, n, 'connection')
    const egress = await carrierScopedIdentity(ikm, carrier, n, 'egress')
    return new MediatorCarrierAdapter(KEY, principal, connection, egress, wire, restored, restoredAt)
  }

  constructor (
    key: symbol,
    principal: CarrierPrincipal,
    connection: CarrierScopedIdentity,
    egress: CarrierScopedIdentity,
    wire: MediatorWire,
    restored?: AckState,
    restoredAt?: number,
  ) {
    if (key !== KEY) {
      throw new Error('use MediatorCarrierAdapter.create — the identity trio must be derived, not supplied (5a.10)')
    }
    if (connection.scope !== 'connection' || egress.scope !== 'egress') {
      throw new Error('scoped identities passed in the wrong roles')
    }
    const three = new Set([principal.principal, connection.did, egress.did])
    if (three.size !== 3) {
      throw new Error('principal, connection DID and egress identity must be pairwise distinct (5a.10)')
    }
    this.#principal = principal.principal
    this.#connectionDid = connection.did
    this.#egressDid = egress.did
    this.#wire = wire
    if (restored) {
      // The restore instant anchors the duplicate-window: an expired,
      // debt-free entry is dropped HERE, not at the first advance —
      // otherwise a redelivery arriving before any port call would be
      // absorbed beyond the declared window (review-4 B4).
      if (typeof restoredAt !== 'number' || !Number.isFinite(restoredAt)) {
        throw new Error('restoring ack state requires a finite restoredAt instant')
      }
      this.#now(restoredAt)
      const pending = new Set(restored.pending)
      const known = new Set(restored.concluded.map((c) => c.queueId))
      for (const id of pending) {
        if (!known.has(id)) {
          throw new Error('ack snapshot violates its invariant: pending intent without a concluded entry')
        }
      }
      for (const { queueId, concludedAt } of restored.concluded) {
        if (!Number.isFinite(concludedAt) || concludedAt > restoredAt) {
          // a conclusion "from the future" would stretch the window
          // past its declared span (R5-B4) — fail closed
          throw new Error('ack snapshot: conclusion instant is non-finite or after restoredAt')
        }
        // the window beats everything (round-14 B): an expired entry
        // falls at the restore instant, owed or not — a phantom debt
        // from an ack that landed just before a close can never
        // outlive the window and delete a fresh copy (R14-B2)
        if (restoredAt - concludedAt >= DECLARED.duplicateWindowMs) continue
        this.#concluded.set(queueId, concludedAt)
        if (pending.has(queueId)) this.#pendingAcks.add(queueId)
      }
    }
    this.#wire.onDeliver(async (raw) => {
      if (this.#closed) return
      const bytes = raw.slice()
      const queueId = hex(await sha(bytes))
      if (this.#closed) return
      // Absorption is WINDOW-checked at the moment it happens
      // (R11-B1), and the window beats everything (round-14 B):
      // beyond it, entry AND any leftover intent fall, and the frame
      // is a new item — so no acknowledgement, owed or phantom, can
      // ever delete the only fresh copy.
      const concludedAt = this.#concluded.get(queueId)
      if (concludedAt !== undefined) {
        if (this.#flightAcks.has(queueId) ||
            this.#clock - concludedAt < DECLARED.duplicateWindowMs) {
          // inside the window — or deferred: an id inside an
          // in-flight flush keeps absorbing until that flush ends,
          // because its irrecallable ack may still land (R15-B1)
          this.#pendingAcks.add(queueId)
          return
        }
        this.#concluded.delete(queueId)
        this.#pendingAcks.delete(queueId)
      }
      if (this.#inboxDigests.has(queueId)) return
      for (const col of this.#outstanding.values()) if (col.has(queueId)) return
      const held = this.#inboxBytes + this.#outstandingBytes
      const underFloor = this.#inbox.length < DECLARED.queueFloorCount &&
        held + bytes.length <= DECLARED.queueFloorBytes
      const underCap = held + bytes.length <= DECLARED.maxQueueBytes
      if (!underFloor && !underCap) return
      this.#inbox.push({ bytes, queueId })
      this.#inboxBytes += bytes.length
      this.#inboxDigests.add(queueId)
    })
  }

  #now (raw: number): number {
    if (!Number.isFinite(raw)) throw new Error('non-finite time')
    if (raw > this.#clock) this.#clock = raw
    return this.#clock
  }

  #open (): void { if (this.#closed) throw new Error('retired (5a.10 lifecycle)') }

  #track (p: Promise<void>): void {
    const t = p.catch(() => {})
    this.#inflight.add(t)
    void t.finally(() => this.#inflight.delete(t))
  }

  // ── auth: silent carrier policy ─────────────────────────────────
  // Single-flight: concurrent callers share one handshake — the ATM
  // challenge/response is a session, and two interleaved sessions
  // under one connection DID would answer each other's challenges.
  #authing: Promise<string> | null = null

  #ensureAuth (now: number): Promise<string> {
    if (this.#tokens && now < this.#tokens.accessExpiresAt) return Promise.resolve(this.#tokens.accessToken)
    if (this.#authing) return this.#authing
    const run = (async (): Promise<string> => {
      if (this.#tokens && now < this.#tokens.refreshExpiresAt) {
        this.#tokens = await this.#wire.refresh(this.#tokens.refreshToken)
        return this.#tokens.accessToken
      }
      const { challenge, sessionId } = await this.#wire.authChallenge(this.#connectionDid)
      if (this.#closed) throw new Error('retired')   // nothing new starts, not even the answer (R6-B1)
      this.#tokens = await this.#wire.authenticate({ did: this.#connectionDid, challenge, sessionId })
      return this.#tokens.accessToken
    })()
    this.#authing = run.finally(() => { this.#authing = null })
    return this.#authing
  }

  // ── transport registration (profile §3 — NOT §5a.3) ─────────────
  /** Records the desired keylist and returns; synchronization runs
   *  as a tracked background task and advance retries it until it
   *  lands (review-4 B1). */
  register (rkids: string[], rawNow: number): void {
    this.#open()
    const now = this.#now(rawNow)
    this.#desiredRkids = [...rkids]
    this.#keylistSynced = false
    this.#startKeylistSync(now)
  }

  get keylistSynced (): boolean {
    this.#open()
    return this.#keylistSynced
  }

  #startKeylistSync (now: number): void {
    if (this.#keylistSyncing || this.#keylistSynced || this.#desiredRkids === null) return
    this.#keylistSyncing = true
    const wanted = [...this.#desiredRkids]
    this.#track((async () => {
      try {
        const token = await this.#ensureAuth(now)
        if (this.#closed) return
        await this.#wire.keylistUpdate(token, wanted)
        // land only if the desire has not moved meanwhile
        if (!this.#closed && this.#desiredRkids !== null &&
            wanted.join(' ') === this.#desiredRkids.join(' ')) {
          this.#keylistSynced = true
        }
      } catch {
        // intent survives; advance retries
      } finally {
        this.#keylistSyncing = false
      }
    })())
  }

  // ── sender side ─────────────────────────────────────────────────
  /** Returns the submission id synchronously. Before the first
   *  honest report exists, status() returns null — §6.1's own
   *  pre-report window, represented as absence, not as a value. */
  submit (envelopeBytes: Uint8Array, rawNow: number): string {
    this.#open()
    const now = this.#now(rawNow)
    const id = 's' + this.#nextId++
    const knownOffline = this.#wire.offline?.() === true
    const sub: Submission = {
      bytes: envelopeBytes.slice(),
      submittedAt: now,
      attemptStartedAt: null,
      lastKind: null,
      st: null,
    }
    this.#subs.set(id, sub)
    if (!knownOffline) this.#startAttempt(sub, now)
    return id
  }

  has (id: string): boolean {
    this.#open()
    return this.#subs.has(id)
  }

  #startAttempt (sub: Submission, now: number): void {
    if (sub.attemptStartedAt !== null) return
    sub.attemptStartedAt = now
    this.#track(this.#trySend(sub, now).finally(() => { sub.attemptStartedAt = null }))
  }

  async #trySend (sub: Submission, now: number): Promise<void> {
    if (sub.st !== null && sub.st.state !== 'awaiting-transport') return
    let next: SubmissionState
    try {
      const token = await this.#ensureAuth(now)
      if (this.#closed) return   // retirement between auth and deposit: nothing new starts (R5-B2)
      await this.#wire.deposit(token, sub.bytes, this.#egressDid)
      sub.lastKind = null
      next = { state: 'accepted' }
    } catch (e) {
      const kind: WireErrorKind = e instanceof WireError ? e.kind : 'unreachable'
      sub.lastKind = kind
      next = kind === 'oversize'
        ? { state: 'failed', reason: 'oversize' }
        : {
            state: 'awaiting-transport',
            reason: kind === 'unreachable' ? 'transport-unreachable' : 'carrier-refused-retriable',
          }
    }
    if (this.#closed) return
    // An interim report (including a horizon-corrected one) never
    // outranks the attempt's real outcome; only a TERMINAL state —
    // a give-up, a refusal, a delivery — stands (R5-B1). Without
    // this, an accepted deposit would stay reported unreachable and
    // be sent a second time.
    if (sub.st === null || sub.st.state === 'awaiting-transport') sub.st = next
  }

  /** Host teardown aid, NOT a port operation (profile §6): awaits
   *  the in-flight background tasks so a host can drain before
   *  persisting ackState. On a hanging wire it waits as long as the
   *  wire does — a host bounds it externally (Promise.race) exactly
   *  because this library holds no clock of its own. */
  async settle (): Promise<void> {
    while (this.#inflight.size > 0) await Promise.all([...this.#inflight])
  }

  /** The §6.1 report, or null while none exists yet (has()
   *  distinguishes an unknown id). status is a PORT: after close it
   *  refuses like every other port operation (R5-B3).
   *
   *  The pre-transport report is an HONEST SNAPSHOT, derived at the
   *  moment of observation by one precedence order (Option B of the
   *  round-14 halt) — never a stored patchwork:
   *    (a) the wire knows itself offline      → offline
   *    (b) an attempt is overdue              → transport-unreachable
   *    (c) the last completed attempt's kind  → its report
   *    (d) otherwise                          → no report yet (null)
   *  Terminal states and `accepted` are stored and stand. */
  status (id: string): SubmissionState | null {
    this.#open()
    const sub = this.#subs.get(id)
    if (!sub) return null
    if (sub.st !== null && sub.st.state !== 'awaiting-transport') return sub.st
    if (this.#wire.offline?.() === true) {
      return { state: 'awaiting-transport', reason: 'offline' }
    }
    if (sub.attemptStartedAt !== null &&
        this.#clock - sub.attemptStartedAt >= DECLARED.statusHorizonMs) {
      return { state: 'awaiting-transport', reason: 'transport-unreachable' }
    }
    return sub.st
  }

  acknowledged (id: string): void {
    if (this.#closed) return
    const sub = this.#subs.get(id)
    if (!sub) return
    if (sub.st?.state === 'delivered') return   // idempotent: a duplicate ack never rewrites `late` (R9-M4)
    const late = sub.st?.state === 'failed'
    sub.st = { state: 'delivered', late }
    if (late) this.#transitions.push({ id, to: 'delivered' })
  }

  /** Refusals act on live submissions only (§6.1 knows exactly one
   *  late correction — the valid ack). The code set is closed and
   *  TERMINAL: retryable counterpart conditions (unavailable,
   *  internalError) are transport outcomes, never receiver verdicts
   *  — they have no entry here, and an unknown code is refused
   *  fail-closed rather than minted into a verdict (R6-B2). */
  receiverRefused (id: string, code: ReceiverRefusalCode): void {
    if (this.#closed) return
    if (!RECEIVER_REFUSAL_CODES.has(code)) {
      throw new Error('not a terminal receiver refusal code — retryable conditions are transport outcomes')
    }
    const sub = this.#subs.get(id)
    if (!sub) return
    // A VALIDATED refusal is itself the proof of receipt — the
    // mediator can have accepted and forwarded while our deposit
    // promise is still unresolved, so the report-less phase is a
    // legitimate moment for it (R9-B2, reversing the R8-B3
    // overcorrection). Only terminal states stand against it.
    if (sub.st !== null && sub.st.state !== 'awaiting-transport' && sub.st.state !== 'accepted') return
    sub.st = { state: 'failed', reason: 'rejected-by-receiver', code }
  }

  drainTransitions (): Array<{ id: string, to: 'delivered' }> {
    this.#open()
    return this.#transitions.splice(0)
  }

  // ── receiver side ───────────────────────────────────────────────
  collect (rawNow: number): Collection {
    this.#open()
    this.#now(rawNow)
    if (this.#inbox.length === 0) return { id: 'c-empty', items: [] }
    const items = this.#inbox.splice(0)
    this.#outstandingBytes += this.#inboxBytes
    this.#inboxBytes = 0
    this.#inboxDigests.clear()
    const id = 'c' + this.#nextColId++
    this.#outstanding.set(id, new Map(items.map((i) => [i.queueId, i])))
    return { id, items: items.map((i) => ({ ...i })) }
  }

  conclude (collection: { id: string }, rawNow: number): void {
    this.#open()
    const now = this.#now(rawNow)
    const col = this.#outstanding.get(collection.id)
    if (!col) return
    this.#outstanding.delete(collection.id)
    for (const item of col.values()) {
      this.#outstandingBytes -= item.bytes.length
      this.#concluded.set(item.queueId, now)
      this.#pendingAcks.add(item.queueId)
    }
    this.#startFlush(now)
  }

  ackState (): AckState {
    return {
      concluded: [...this.#concluded].map(([queueId, concludedAt]) => ({ queueId, concludedAt })),
      pending: [...this.#pendingAcks],
    }
  }

  #startFlush (now: number): void {
    if (this.#flushing || this.#pendingAcks.size === 0) return
    this.#flushing = true
    const snapshot = new Set(this.#pendingAcks)
    this.#track(this.#flushAcks(now, [...snapshot]).finally(() => {
      this.#flushing = false
      // lost-wake-up guard (review-4 M6): intents that arrived while
      // this flush ran get their own flush now — but only newcomers,
      // so a failing wire waits for the next advance instead of
      // spinning
      if (!this.#closed) {
        for (const id of this.#pendingAcks) {
          if (!snapshot.has(id)) { this.#startFlush(this.#clock); break }
        }
      }
    }))
  }

  async #flushAcks (now: number, ids: string[]): Promise<void> {
    try {
      const token = await this.#ensureAuth(now)
      if (this.#closed) return
      // Only NOW does anything become irrecallable (R16-B1): the
      // stay of expiry begins at the wire call itself, never at the
      // snapshot — a hanging auth extends no window. And "live" is
      // WINDOW-live (R17-B1): an entry whose window already closed —
      // even if no prune has swept it yet — is never sent.
      const live = ids.filter((id) => {
        const at = this.#concluded.get(id)
        return at !== undefined && this.#clock - at < DECLARED.duplicateWindowMs
      })
      if (live.length === 0) return
      for (const id of live) this.#flightAcks.add(id)
      try {
        await this.#wire.ackReceived(token, live)
        if (!this.#closed) for (const id of live) this.#pendingAcks.delete(id)
      } finally {
        for (const id of live) this.#flightAcks.delete(id)
        // deferred window sweep: entries whose window closed while
        // the ack flew fall now — intent, entry and absorption
        // together (R15-B1). Never on a retired instance: after
        // close, ackState() is the host's final-persist surface and
        // a late-returning wire mutates nothing (R17-B2).
        if (!this.#closed) {
          for (const id of live) {
            const at = this.#concluded.get(id)
            if (at !== undefined && this.#clock - at >= DECLARED.duplicateWindowMs) {
              this.#concluded.delete(id)
              this.#pendingAcks.delete(id)
            }
          }
        }
      }
    } catch {
      // intent survives; the next advance starts a fresh flush
    }
  }

  // ── the adapter clock — never awaits the mediator ───────────────
  advance (rawNow: number): void {
    this.#open()
    const now = this.#now(rawNow)
    for (const sub of this.#subs.values()) {
      const live = sub.st === null || sub.st.state === 'awaiting-transport' || sub.st.state === 'accepted'
      if (!live) continue
      if (now - sub.submittedAt >= DECLARED.giveUpHorizonMs) {
        // unroutable only when the LAST COMPLETED attempt was an
        // admission refusal and no attempt is in flight whose outcome
        // is unknown (review-4 B3)
        // the give-up verdict applies the SAME precedence as every
        // observation (R17-B3): a wire that knows itself offline at
        // the horizon outranks any stored refusal class — unroutable
        // needs a completed admission refusal, no unknown outcome in
        // flight, AND no offline signal standing over it
        sub.st = {
          state: 'failed',
          reason: sub.lastKind === 'refused-admission' && sub.attemptStartedAt === null &&
              this.#wire.offline?.() !== true
            ? 'unroutable'
            : 'expired-by-adapter-policy',
        }
        continue
      }
      if (sub.st !== null && sub.st.state === 'accepted') continue
      // reports are DERIVED at observation (see status()); the clock
      // only decides here whether to start an attempt — and never
      // against a wire that knows itself offline
      if (this.#wire.offline?.() === true) continue
      if (sub.attemptStartedAt === null) this.#startAttempt(sub, now)
    }
    // THE WINDOW BEATS EVERYTHING (Option B of the round-14 halt):
    // an ack intent is retried until the window closes; then intent
    // and absorption fall together. There is no ageless debt whose
    // truth the adapter would have to know — the receiver's §6.2
    // absorption owns everything beyond the window.
    for (const [digest, at] of this.#concluded) {
      if (now - at >= DECLARED.duplicateWindowMs && !this.#flightAcks.has(digest)) {
        this.#concluded.delete(digest)
        this.#pendingAcks.delete(digest)
      }
    }
    this.#startKeylistSync(now)
    this.#startFlush(now)
  }

  /** §5a.10 lifecycle boundary: after close, every state port is
   *  inert — port operations refuse, inbound reports (acknowledged,
   *  receiverRefused) are no-ops, late wire resolutions mutate
   *  nothing. Only ackState() stays readable for the host's final
   *  persist. */
  close (): void { this.#closed = true }

  get closed (): boolean { return this.#closed }
}

export const queueIdOf = async (bytes: Uint8Array): Promise<string> => hex(await sha(bytes))
