#!/usr/bin/env node
// The VTI-mediator transport adapter, twenty-third casting (round
// journals under design/adapter-review*). The wire double enforces
// the MEDIATOR's contract; the
// identity derivations are checked against the SHIPPED vector corpus
// (oracle bytes, not self-comparison).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MediatorCarrierAdapter, DECLARED, WireError, queueIdOf }
  from '../dist/adapter-mediator.js'
import { carrierPrincipal, carrierScopedIdentity }
  from '../dist/carrier-identity.js'

const te = new TextEncoder()
const MEDIATOR_DID = 'did:webvh:example:mediator'
const VEC = JSON.parse(readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'vectors', 'identity-derivation.json'), 'utf8'))

async function identities (ikm, nonce) {
  ikm ??= crypto.getRandomValues(new Uint8Array(32))
  nonce ??= crypto.getRandomValues(new Uint8Array(32))
  const p = await carrierPrincipal(ikm, MEDIATOR_DID, nonce)
  const conn = await carrierScopedIdentity(ikm, MEDIATOR_DID, nonce, 'connection')
  const egress = await carrierScopedIdentity(ikm, MEDIATOR_DID, nonce, 'egress')
  return { p, conn, egress }
}

async function adapter (wire, restored, restoredAt) {
  const ikm = crypto.getRandomValues(new Uint8Array(32))
  const nonce = crypto.getRandomValues(new Uint8Array(32))
  const a = await MediatorCarrierAdapter.create(ikm, MEDIATOR_DID, nonce, wire, restored, restoredAt)
  const { p, conn, egress } = await identities(ikm, nonce)
  return { a, p, conn, egress }
}

class WireDouble {
  constructor (now = () => 0) {
    this.now = now
    this.authCount = 0
    this.refreshCount = 0
    this.authDids = []
    this.deposited = []
    this.keylists = []
    this.queue = new Map()
    this.consumer = null
    this.depositFailure = null
    this.ackFailure = false
    this.accessTtlMs = 3600_000
    this.tokenSeq = 0
    this.isOffline = null
  }

  offline () { return this.isOffline === null ? undefined : this.isOffline }

  #tokens () {
    this.tokenSeq++
    return {
      accessToken: 'acc' + this.tokenSeq,
      accessExpiresAt: this.now() + this.accessTtlMs,
      refreshToken: 'ref' + this.tokenSeq,
      refreshExpiresAt: this.now() + 30 * 86_400_000,
    }
  }

  async authChallenge (did) {
    this.authCount++
    this.authDids.push(did)
    return { challenge: 'ch' + this.authCount, sessionId: 'sess' + this.authCount }
  }

  async authenticate ({ did, challenge }) {
    this.authDids.push(did)
    assert.equal(challenge, 'ch' + this.authCount)
    return this.#tokens()
  }

  async refresh (refreshToken) {
    this.refreshCount++
    assert.match(refreshToken, /^ref/)
    return this.#tokens()
  }

  async keylistUpdate (accessToken, rkids) { this.keylists.push([...rkids]) }

  async deposit (accessToken, bytes, egressDid) {
    if (this.depositFailure) throw new WireError(this.depositFailure)
    this.deposited.push({ bytes: bytes.slice(), egressDid })
  }

  async ackReceived (accessToken, queueIds) {
    if (this.ackFailure) throw new WireError('refused-retriable')
    for (const id of queueIds) this.queue.delete(id)
  }

  onDeliver (cb) { this.consumer = cb }

  async deliverFromPeer (bytes) {
    const id = await queueIdOf(bytes)
    this.queue.set(id, bytes.slice())
    await this.consumer(bytes)
    return id
  }

  async redeliverAll () {
    for (const bytes of [...this.queue.values()]) await this.consumer(bytes)
  }
}

// ── identity derivations against the SHIPPED oracle (R4-M7) ──────────
test('connection and egress derive byte-exactly to the vector corpus', async () => {
  const ikm = Uint8Array.from(VEC.rootIkm.match(/../g).map((b) => parseInt(b, 16)))
  const nonce = new Uint8Array(await crypto.subtle.digest('SHA-256',
    te.encode('rltp/vector/carrier-relationship/nonce-1')))
  const A = VEC.adapterScopedIdentities
  const conn = await carrierScopedIdentity(ikm, A.carrier, nonce, 'connection')
  const egress = await carrierScopedIdentity(ikm, A.carrier, nonce, 'egress')
  assert.equal(conn.did, A.connection.did)
  assert.equal(conn.info, A.connection.info)
  assert.equal(egress.did, A.egress.did)
  assert.equal(egress.info, A.egress.info)
  const p = await carrierPrincipal(ikm, A.carrier, nonce)
  assert.equal(p.principal, VEC.carrierRelationship.cases[0].principal)
  assert.equal(new Set([p.principal, conn.did, egress.did]).size, 3)
})

// ── identity discipline (§5a.10) ─────────────────────────────────────
test('the principal never touches the wire; deposits carry the egress identity', async () => {
  const wire = new WireDouble()
  const { a, p, conn, egress } = await adapter(wire)
  a.register(['rkid-1'], 0)
  a.submit(te.encode('x'), 1)
  await a.settle()
  for (const did of wire.authDids) assert.equal(did, conn.did)
  assert.equal(wire.deposited[0].egressDid, egress.did)
  for (const seen of [...wire.authDids, wire.deposited[0].egressDid]) {
    assert.notEqual(seen, p.principal)
  }
  assert.deepEqual(wire.keylists, [['rkid-1']])
  assert.equal(a.keylistSynced, true)
})

test('register never awaits the mediator; advance retries until the keylist lands (R4-B1)', async () => {
  const wire = new WireDouble()
  let release
  wire.keylistUpdate = () => new Promise((res) => { release = res })
  const { a } = await adapter(wire)
  a.register(['rk-a'], 0)              // returns synchronously despite the hang
  assert.equal(a.keylistSynced, false)
  while (!release) await new Promise((r) => setTimeout(r, 1))
  release()
  await a.settle()
  assert.equal(a.keylistSynced, true)

  const wire2 = new WireDouble()
  const real = wire2.keylistUpdate.bind(wire2)
  let fail = true
  wire2.keylistUpdate = async (t, r) => { if (fail) throw new WireError('refused-retriable'); return real(t, r) }
  const { a: a2 } = await adapter(wire2)
  a2.register(['rk-b'], 0)
  await a2.settle()
  assert.equal(a2.keylistSynced, false, 'first attempt failed')
  fail = false
  a2.advance(1)
  await a2.settle()
  assert.equal(a2.keylistSynced, true, 'advance retried the intent')
  assert.deepEqual(wire2.keylists, [['rk-b']])
})

test('the trio cannot be supplied — only derived: direct construction is refused (R7-B2)', async () => {
  const wire = new WireDouble()
  const { p, conn, egress } = await identities()
  // even a CORRECT trio is refused at the door: the coupling is the
  // factory's, and a caller who could supply identities could mix
  // relationships
  assert.throws(() => new MediatorCarrierAdapter(p, conn, egress, wire), /create/)
  assert.throws(() => new MediatorCarrierAdapter(Symbol('forged'), p, conn, egress, wire), /create/)
})

// ── auth: silent carrier policy ──────────────────────────────────────
test('JWT lifecycle is silent: one challenge, refresh on expiry, no port event', async () => {
  let t = 1_000_000
  const wire = new WireDouble(() => t)
  wire.accessTtlMs = 10_000
  const { a } = await adapter(wire)
  const id1 = a.submit(te.encode('one'), t)
  await a.settle()
  assert.deepEqual(a.status(id1), { state: 'accepted' })
  assert.equal(wire.authCount, 1)
  t += 20_000
  const id2 = a.submit(te.encode('two'), t)
  await a.settle()
  assert.deepEqual(a.status(id2), { state: 'accepted' })
  assert.equal(wire.authCount, 1)
  assert.equal(wire.refreshCount, 1)
  assert.equal(a.drainTransitions().length, 0)
})

// ── honest pre-transport reports (R4-B2) ─────────────────────────────
test('absence is absent: status() is null before the first honest report; has() knows the id', async () => {
  const wire = new WireDouble()
  let release
  wire.deposit = () => new Promise((res) => { release = res })
  const { a } = await adapter(wire)
  const id = a.submit(te.encode('x'), 0)
  assert.equal(a.status(id), null, 'no report exists yet — and none is invented')
  assert.equal(a.has(id), true)
  assert.equal(a.has('s999'), false)
  while (!release) await new Promise((r) => setTimeout(r, 1))
  release()
  await a.settle()
  assert.deepEqual(a.status(id), { state: 'accepted' })

  wire.isOffline = true
  const id2 = a.submit(te.encode('y'), 1)
  assert.deepEqual(a.status(id2), { state: 'awaiting-transport', reason: 'offline' })
  // R13-B1: the offline signal is re-consulted on every tick — a
  // knowingly offline wire never earns an invented unreachable
  a.advance(1 + DECLARED.statusHorizonMs)
  a.advance(DECLARED.giveUpHorizonMs)      // diff = horizon − 1: short of give-up
  assert.deepEqual(a.status(id2), { state: 'awaiting-transport', reason: 'offline' },
    'offline stays offline through every tick short of the give-up')
  wire.isOffline = false
  wire.deposit = async (t, b, e) => { wire.deposited.push({ bytes: b.slice(), egressDid: e }) }
  a.advance(DECLARED.giveUpHorizonMs)
  await a.settle()
  assert.deepEqual(a.status(id2), { state: 'accepted' }, 'back online: the attempt runs and lands')
})

test('an overdue attempt earns transport-unreachable — even over a stale earlier reason (R4-B3)', async () => {
  const wire = new WireDouble()
  wire.deposit = () => new Promise(() => {})
  const { a } = await adapter(wire)
  const id = a.submit(te.encode('x'), 0)
  a.advance(DECLARED.statusHorizonMs - 1)
  assert.equal(a.status(id), null, 'within the horizon no report is owed')
  a.advance(DECLARED.statusHorizonMs)
  assert.deepEqual(a.status(id), { state: 'awaiting-transport', reason: 'transport-unreachable' })

  // stale reason: one completed retriable refusal, then a hanging retry
  const wire2 = new WireDouble()
  const { a: a2 } = await adapter(wire2)
  wire2.depositFailure = 'refused-retriable'
  const id2 = a2.submit(te.encode('y'), 0)
  await a2.settle()
  assert.equal(a2.status(id2).reason, 'carrier-refused-retriable')
  wire2.depositFailure = null
  wire2.deposit = () => new Promise(() => {})
  a2.advance(1_000)                       // starts the hanging retry
  a2.advance(1_000 + DECLARED.statusHorizonMs)
  assert.deepEqual(a2.status(id2), { state: 'awaiting-transport', reason: 'transport-unreachable' },
    'the stale reason does not outlive the overdue attempt')
})

// ── sender contract (§6.1) ───────────────────────────────────────────
test('transport failure reports, retries on advance, recovers', async () => {
  const wire = new WireDouble()
  const { a } = await adapter(wire)
  wire.depositFailure = 'unreachable'
  const id = a.submit(te.encode('x'), 0)
  await a.settle()
  assert.deepEqual(a.status(id), { state: 'awaiting-transport', reason: 'transport-unreachable' })
  wire.depositFailure = 'refused-retriable'
  a.advance(1_000); await a.settle()
  assert.deepEqual(a.status(id), { state: 'awaiting-transport', reason: 'carrier-refused-retriable' })
  wire.depositFailure = null
  a.advance(2_000); await a.settle()
  assert.deepEqual(a.status(id), { state: 'accepted' })
})

test('give-up binds awaiting AND accepted; late ack transitions, surfaced', async () => {
  const wire = new WireDouble()
  const { a } = await adapter(wire)
  wire.depositFailure = 'unreachable'
  const idA = a.submit(te.encode('a'), 0)
  await a.settle()
  wire.depositFailure = null
  const idB = a.submit(te.encode('b'), 0)
  await a.settle()
  assert.equal(a.status(idB).state, 'accepted')
  wire.depositFailure = 'unreachable'
  a.advance(DECLARED.giveUpHorizonMs - 1); await a.settle()
  assert.equal(a.status(idA).state, 'awaiting-transport')
  a.advance(DECLARED.giveUpHorizonMs); await a.settle()
  assert.deepEqual(a.status(idA), { state: 'failed', reason: 'expired-by-adapter-policy' })
  assert.deepEqual(a.status(idB), { state: 'failed', reason: 'expired-by-adapter-policy' })
  a.acknowledged(idB)
  assert.deepEqual(a.status(idB), { state: 'delivered', late: true })
  assert.deepEqual(a.drainTransitions(), [{ id: idB, to: 'delivered' }])
})

test('unroutable only for a COMPLETED admission refusal with no attempt in flight (R4-B3)', async () => {
  const wire = new WireDouble()
  const { a } = await adapter(wire)
  wire.depositFailure = 'refused-admission'
  const x = a.submit(te.encode('x'), 0)
  await a.settle()
  a.advance(DECLARED.giveUpHorizonMs)
  assert.deepEqual(a.status(x), { state: 'failed', reason: 'unroutable' })

  // admission once, then a hanging retry whose outcome is unknown
  const wire2 = new WireDouble()
  const { a: a2 } = await adapter(wire2)
  wire2.depositFailure = 'refused-admission'
  const y = a2.submit(te.encode('y'), 0)
  await a2.settle()
  wire2.depositFailure = null
  wire2.deposit = () => new Promise(() => {})
  a2.advance(1_000)                       // hanging retry in flight
  a2.advance(DECLARED.giveUpHorizonMs)
  assert.deepEqual(a2.status(y), { state: 'failed', reason: 'expired-by-adapter-policy' },
    'no unroutable verdict while an outcome is unknown')

  // pure overload never becomes unroutable
  const wire3 = new WireDouble()
  const { a: a3 } = await adapter(wire3)
  wire3.depositFailure = 'refused-retriable'
  const z = a3.submit(te.encode('z'), 0)
  await a3.settle()
  a3.advance(DECLARED.giveUpHorizonMs)
  assert.deepEqual(a3.status(z), { state: 'failed', reason: 'expired-by-adapter-policy' })
})

test('a hanging deposit cannot block give-up: one serial advance applies the horizon', async () => {
  const wire = new WireDouble()
  wire.deposit = () => new Promise(() => {})
  const { a } = await adapter(wire)
  const id = a.submit(te.encode('r'), 0)
  a.advance(DECLARED.giveUpHorizonMs)
  assert.equal(a.status(id).state, 'failed')
})

test('receiver refusal acts on live submissions only; terminal states stand', async () => {
  const wire = new WireDouble()
  const { a } = await adapter(wire)
  const id = a.submit(te.encode('x'), 0)
  await a.settle()
  a.receiverRefused(id, 'proofInvalid')
  assert.deepEqual(a.status(id), { state: 'failed', reason: 'rejected-by-receiver', code: 'proofInvalid' })
  a.acknowledged(id)
  assert.equal(a.status(id).state, 'delivered')
  a.receiverRefused(id, 'proofInvalid')
  assert.equal(a.status(id).state, 'delivered')

  const idGone = a.submit(te.encode('g'), 1)
  await a.settle()
  a.advance(1 + DECLARED.giveUpHorizonMs)
  a.receiverRefused(idGone, 'unsupportedType')
  assert.equal(a.status(idGone).reason, 'expired-by-adapter-policy')
})

// ── receiver: delete-to-ack, three registers ─────────────────────────
test('collect/conclude: only the conclude releases the mediator copy; conclude never blocks', async () => {
  const wire = new WireDouble()
  const { a } = await adapter(wire)
  const qid = await wire.deliverFromPeer(te.encode('hello'))
  const c = a.collect(0)
  assert.equal(c.items[0].queueId, qid)
  assert.equal(wire.queue.size, 1)
  let release
  const realAck = wire.ackReceived.bind(wire)
  wire.ackReceived = async (t, ids) => {
    await new Promise((res) => { release = res })
    return realAck(t, ids)
  }
  a.conclude(c, 1)
  assert.equal(a.ackState().pending.length, 1)
  while (!release) await new Promise((r) => setTimeout(r, 1))
  release()
  await a.settle()
  assert.equal(wire.queue.size, 0)
  assert.equal(a.ackState().pending.length, 0)
})

test('a conclusion during a hanging flush gets its own flush when the first ends (R4-M6)', async () => {
  const wire = new WireDouble()
  const { a } = await adapter(wire)
  const realAck = wire.ackReceived.bind(wire)
  let release
  let calls = 0
  wire.ackReceived = async (t, ids) => {
    calls++
    if (calls === 1) await new Promise((res) => { release = res })
    return realAck(t, ids)
  }
  await wire.deliverFromPeer(te.encode('one'))
  const c1 = a.collect(0)
  a.conclude(c1, 1)                      // flush 1 hangs
  await wire.deliverFromPeer(te.encode('two'))
  const c2 = a.collect(2)
  a.conclude(c2, 3)                      // newcomer while flush 1 hangs
  while (!release) await new Promise((r) => setTimeout(r, 1))
  release()
  await a.settle()
  assert.equal(calls, 2, 'the newcomer got its own flush without waiting for an advance')
  assert.equal(wire.queue.size, 0)
  assert.equal(a.ackState().pending.length, 0)
})

test('redelivery of buffered or outstanding frames is ignored and never acked', async () => {
  const wire = new WireDouble()
  const { a } = await adapter(wire)
  await wire.deliverFromPeer(te.encode('m1'))
  await wire.redeliverAll()
  a.advance(1); await a.settle()
  assert.equal(wire.queue.size, 1)
  const c = a.collect(2)
  assert.equal(c.items.length, 1)
  await wire.redeliverAll()
  a.advance(3); await a.settle()
  assert.equal(wire.queue.size, 1)
  a.conclude(c, 4); await a.settle()
  assert.equal(wire.queue.size, 0)
})

test('lost ack: re-acked from the concluded register, never re-dispatched; advance retries', async () => {
  const wire = new WireDouble()
  const { a } = await adapter(wire)
  await wire.deliverFromPeer(te.encode('m2'))
  const c = a.collect(0)
  wire.ackFailure = true
  a.conclude(c, 1); await a.settle()
  assert.equal(wire.queue.size, 1)
  await wire.redeliverAll()
  assert.equal(a.collect(2).items.length, 0)
  wire.ackFailure = false
  a.advance(3); await a.settle()
  assert.equal(wire.queue.size, 0)
})

test('the window beats everything: intent and absorption fall together at its end (R14-B)', async () => {
  const wire = new WireDouble()
  const { a } = await adapter(wire)
  await wire.deliverFromPeer(te.encode('owed'))
  const c = a.collect(0)
  wire.ackFailure = true
  a.conclude(c, 1); await a.settle()
  a.advance(DECLARED.duplicateWindowMs); await a.settle()   // diff = window − 1: inside
  assert.equal(a.ackState().pending.length, 1, 'inside the window the intent is retried')
  await wire.redeliverAll()
  assert.equal(a.collect(DECLARED.duplicateWindowMs).items.length, 0, 'and absorption stands')
  a.advance(1 + DECLARED.duplicateWindowMs); await a.settle()
  assert.equal(a.ackState().pending.length, 0, 'at the window end the intent falls')
  assert.equal(a.ackState().concluded.length, 0, 'together with the entry')
  await wire.redeliverAll()
  const c2 = a.collect(2 + DECLARED.duplicateWindowMs)
  assert.equal(c2.items.length, 1, 'beyond the window the redelivery is a new item for §6.2')
  wire.ackFailure = false
  a.conclude(c2, 3 + DECLARED.duplicateWindowMs)
  await a.settle()
  assert.equal(wire.queue.size, 0)
})

test('a byte-identical arrival beyond the window is a NEW item — absorbed never, acked never (R11-B1)', async () => {
  const wire = new WireDouble()
  const { a } = await adapter(wire)
  const bytes = te.encode('reissue')
  await wire.deliverFromPeer(bytes)
  const c = a.collect(0)
  a.conclude(c, 1); await a.settle()
  assert.equal(wire.queue.size, 0, 'ack landed')
  a.advance(2)                                     // clock well inside the window
  await wire.deliverFromPeer(bytes)                // same bytes again, inside window
  assert.equal(a.collect(3).items.length, 0, 'inside the window: absorbed')
  await a.settle()
  a.advance(4 + DECLARED.duplicateWindowMs)        // move the clock past the window
  const qid = await wire.deliverFromPeer(bytes)    // same bytes again, beyond window
  const c2 = a.collect(5 + DECLARED.duplicateWindowMs)
  assert.equal(c2.items.length, 1, 'beyond the window: a new item reaches the holder')
  assert.ok(wire.queue.has(qid), 'and nothing acked it away beforehand')
  a.conclude(c2, 6 + DECLARED.duplicateWindowMs); await a.settle()
  assert.equal(wire.queue.size, 0)
})

test('restore: an expired entry is dropped AT construction — owed or not, the window beats it (R4-B4/R14-B)', async () => {
  const wire = new WireDouble()
  const { a } = await adapter(wire)
  const bytes = te.encode('old')
  await wire.deliverFromPeer(bytes)
  const c = a.collect(0)
  a.conclude(c, 1); await a.settle()      // ack landed: concluded, no debt
  const persisted = a.ackState()
  assert.equal(persisted.pending.length, 0)

  // restart far beyond the window: the entry must NOT absorb anew
  const { a: a2 } = await adapter(wire, persisted, 1 + DECLARED.duplicateWindowMs)
  wire.onDeliver(wire.consumer)
  await wire.deliverFromPeer(bytes)       // the same bytes reappear
  assert.equal(a2.collect(2 + DECLARED.duplicateWindowMs).items.length, 1,
    'beyond the declared window the item reaches the holder (whose §6.2 rule owns it now)')

  // a PHANTOM debt (ack landed just before a close, pending survived
  // in the snapshot) can never outlive the window: beyond it the
  // entry falls, owed or not, and the fresh copy reaches the holder
  // instead of being acked away (R14-B2)
  await assert.rejects(
    adapter(new WireDouble(), { concluded: [], pending: ['deadbeef'] }, 0),
    /invariant/,
  )
  const wire3 = new WireDouble()
  const { a: a3 } = await adapter(wire3,
    { concluded: [{ queueId: await queueIdOf(bytes), concludedAt: 0 }], pending: [await queueIdOf(bytes)] },
    5 * DECLARED.duplicateWindowMs)
  wire3.onDeliver(wire3.consumer)
  const qid3 = await wire3.deliverFromPeer(bytes)
  const c3 = a3.collect(5 * DECLARED.duplicateWindowMs + 1)
  assert.equal(c3.items.length, 1, 'the window beats the phantom debt: a new item for the holder')
  assert.ok(wire3.queue.has(qid3), 'and nothing acked the fresh copy away')
})

test('online→offline during a hanging attempt: the derived report says offline, never silence (R14-B1)', async () => {
  const wire = new WireDouble()
  wire.deposit = () => new Promise(() => {})   // hangs forever
  const { a } = await adapter(wire)
  const id = a.submit(te.encode('x'), 0)      // started online
  wire.isOffline = true                        // connectivity drops mid-attempt
  a.advance(DECLARED.statusHorizonMs)          // exactly at the horizon
  assert.deepEqual(a.status(id), { state: 'awaiting-transport', reason: 'offline' },
    'the snapshot precedence answers offline — no silent cell, no invented unreachable')
  wire.isOffline = null                        // signal gone: precedence falls through
  assert.deepEqual(a.status(id), { state: 'awaiting-transport', reason: 'transport-unreachable' },
    'without the offline signal the overdue attempt reports honestly')
})

test('restoring without a finite restoredAt is refused', async () => {
  await assert.rejects(adapter(new WireDouble(), { concluded: [], pending: [] }), /restoredAt/)
})

test('max-queue-bytes counts buffered AND outstanding together', async () => {
  const wire = new WireDouble()
  const { a } = await adapter(wire)
  const mk = (fill) => { const b = new Uint8Array(6 * 1_048_576); b[0] = fill; return b }
  await wire.deliverFromPeer(mk(1)); a.collect(0)
  await wire.deliverFromPeer(mk(2)); a.collect(1)
  const qid3 = await wire.deliverFromPeer(mk(3))
  assert.equal(a.collect(2).items.length, 0)
  assert.ok(wire.queue.has(qid3))
})

test('empty collections create no register entry; floor guarantee holds', async () => {
  const wire = new WireDouble()
  const { a } = await adapter(wire)
  for (let i = 0; i < 50; i++) a.conclude(a.collect(i), i)
  for (let i = 0; i < DECLARED.queueFloorCount; i++) {
    await wire.deliverFromPeer(te.encode('f' + i))
  }
  const c = a.collect(100)
  assert.equal(c.items.length, DECLARED.queueFloorCount)
  a.conclude(c, 101); await a.settle()
  assert.equal(wire.queue.size, 0)
})

test('a hanging AUTH extends no window: beyond it the arrival is new and no ack was ever sent (R16-B1)', async () => {
  const wire = new WireDouble()
  const { a } = await adapter(wire)
  const bytes = te.encode('authhang')
  await wire.deliverFromPeer(bytes)
  const c = a.collect(0)
  let releaseAuth
  const realChallenge = wire.authChallenge.bind(wire)
  wire.authChallenge = async (did) => {
    await new Promise((res) => { releaseAuth = res })
    return realChallenge(did)
  }
  wire.tokenSeq = 0; a.conclude(c, 1)            // flush starts, auth hangs
  let acks = 0
  const realAck = wire.ackReceived.bind(wire)
  wire.ackReceived = async (t, ids) => { acks++; return realAck(t, ids) }
  a.advance(1 + DECLARED.duplicateWindowMs)       // window closes under the hanging auth
  await wire.redeliverAll()
  const c2 = a.collect(2 + DECLARED.duplicateWindowMs)
  assert.equal(c2.items.length, 1, 'beyond the window the arrival is a NEW item — no auth-stretched stay')
  while (!releaseAuth) await new Promise((r) => setTimeout(r, 1))
  releaseAuth()
  await a.settle()
  assert.equal(acks, 0, 'the fallen intent was never sent — nothing acked the fresh copy away')
  assert.ok(wire.queue.size >= 1, 'the mediator copy survives for the new collection')
})

test('the stay covers only an ack ON the wire: expiry and absorption defer to its return (R15-B1)', async () => {
  const wire = new WireDouble()
  const { a } = await adapter(wire)
  const bytes = te.encode('ackfly')
  await wire.deliverFromPeer(bytes)
  const c = a.collect(0)
  let releaseAck
  const realAck = wire.ackReceived.bind(wire)
  wire.ackReceived = async (t, ids) => {
    await new Promise((res) => { releaseAck = res })
    return realAck(t, ids)
  }
  a.conclude(c, 1)
  while (!releaseAck) await new Promise((r) => setTimeout(r, 1))   // the ack IS on the wire
  a.advance(1 + DECLARED.duplicateWindowMs)       // window closes under the flying ack
  assert.equal(a.ackState().concluded.length, 1, 'expiry is stayed while the ack flies')
  await wire.redeliverAll()
  assert.equal(a.collect(2 + DECLARED.duplicateWindowMs).items.length, 0,
    'absorption is stayed too — the irrecallable ack cannot delete an unabsorbed copy')
  releaseAck()
  await a.settle()
  assert.equal(a.ackState().concluded.length, 0, 'the account settles the moment the call returns')
  assert.equal(a.ackState().pending.length, 0)
})

test('the live filter is WINDOW-live: an unswept expired id never reaches the wire (R17-B1)', async () => {
  const wire = new WireDouble()
  const { a } = await adapter(wire)
  const oldBytes = te.encode('old-item')
  await wire.deliverFromPeer(oldBytes)
  const c1 = a.collect(0)
  wire.ackFailure = true
  a.conclude(c1, 1); await a.settle()          // old intent, ack lost
  wire.ackFailure = false
  // move the clock to the window edge WITHOUT advance (no prune runs)
  const fresh = te.encode('fresh-item')
  await wire.deliverFromPeer(fresh)
  const c2 = a.collect(1 + DECLARED.duplicateWindowMs)
  let acked = []
  const realAck = wire.ackReceived.bind(wire)
  wire.ackReceived = async (t, ids) => { acked.push(...ids); return realAck(t, ids) }
  a.conclude(c2, 1 + DECLARED.duplicateWindowMs)  // new flush at the edge
  await a.settle()
  const oldId = await queueIdOf(oldBytes)
  assert.ok(!acked.includes(oldId), 'the expired-but-unswept id was never sent')
  assert.ok(acked.includes(await queueIdOf(fresh)), 'the live id was')
})

test('give-up precedence: a standing offline signal blocks the unroutable verdict (R17-B3)', async () => {
  const wire = new WireDouble()
  const { a } = await adapter(wire)
  wire.depositFailure = 'refused-admission'
  const id = a.submit(te.encode('x'), 0)
  await a.settle()
  wire.isOffline = true                         // wire drops before the horizon
  a.advance(DECLARED.giveUpHorizonMs)
  assert.deepEqual(a.status(id), { state: 'failed', reason: 'expired-by-adapter-policy' },
    'offline at the horizon outranks the stored admission class')
})

test('a late-returning ack sweeps nothing on a retired instance (R17-B2)', async () => {
  const wire = new WireDouble()
  const { a } = await adapter(wire)
  await wire.deliverFromPeer(te.encode('m'))
  const c = a.collect(0)
  let releaseAck
  const realAck = wire.ackReceived.bind(wire)
  wire.ackReceived = async (t, ids) => {
    await new Promise((res) => { releaseAck = res })
    return realAck(t, ids)
  }
  a.conclude(c, 1)
  while (!releaseAck) await new Promise((r) => setTimeout(r, 1))
  a.advance(1 + DECLARED.duplicateWindowMs)     // window closes under the flying ack
  a.close()
  const before = a.ackState()
  releaseAck()
  await a.settle()
  assert.deepEqual(a.ackState(), before,
    'the final-persist surface is byte-stable across the late return')
})

// ── lifecycle (R4-B5) ────────────────────────────────────────────────
test('close(): every state port is inert — including acknowledged and receiverRefused', async () => {
  const wire = new WireDouble()
  let release
  wire.deposit = () => new Promise((res) => { release = res })
  const { a } = await adapter(wire)
  const id = a.submit(te.encode('x'), 0)
  while (!release) await new Promise((r) => setTimeout(r, 1))
  a.close()
  release()
  await a.settle()
  // status is a port: a retired instance refuses instead of answering
  // with reports whose horizons it no longer drives (R5-B3)
  assert.throws(() => a.status(id), /retired/)
  assert.throws(() => a.has(id), /retired/)
  a.acknowledged(id)                       // inbound reports: no-ops
  a.receiverRefused(id, 'proofInvalid')
  assert.throws(() => a.drainTransitions(), /retired/)
  assert.throws(() => a.keylistSynced, /retired/)
  assert.throws(() => a.submit(te.encode('y'), 1), /retired/)
  assert.throws(() => a.collect(1), /retired/)
  assert.throws(() => a.advance(1), /retired/)
  assert.throws(() => a.register(['rk'], 1), /retired/)
  assert.deepEqual(a.ackState(), { concluded: [], pending: [] })
})

test('a late success outranks the interim horizon report — accepted, sent once (R5-B1)', async () => {
  const wire = new WireDouble()
  let release
  const realDeposit = wire.deposit.bind(wire)
  wire.deposit = async (t, b, e) => {
    await new Promise((res) => { release = res })
    return realDeposit(t, b, e)
  }
  const { a } = await adapter(wire)
  const id = a.submit(te.encode('slow'), 0)
  a.advance(DECLARED.statusHorizonMs)
  assert.deepEqual(a.status(id), { state: 'awaiting-transport', reason: 'transport-unreachable' })
  while (!release) await new Promise((r) => setTimeout(r, 1))
  release()
  await a.settle()
  assert.deepEqual(a.status(id), { state: 'accepted' }, 'the real outcome displaces the interim report')
  a.advance(DECLARED.statusHorizonMs + 1)
  await a.settle()
  assert.equal(wire.deposited.length, 1, 'and the bytes were sent exactly once')
})

test('close during the auth handshake: neither authenticate nor deposit starts afterwards (R5-B2/R6-B1)', async () => {
  const wire = new WireDouble()
  let releaseAuth
  const realChallenge = wire.authChallenge.bind(wire)
  wire.authChallenge = async (did) => {
    await new Promise((res) => { releaseAuth = res })
    return realChallenge(did)
  }
  let authenticateCalls = 0
  const realAuth = wire.authenticate.bind(wire)
  wire.authenticate = async (ans) => { authenticateCalls++; return realAuth(ans) }
  const { a } = await adapter(wire)
  a.submit(te.encode('x'), 0)
  while (!releaseAuth) await new Promise((r) => setTimeout(r, 1))
  a.close()
  releaseAuth()
  await a.settle()
  assert.equal(authenticateCalls, 0, 'not even the challenge answer starts on a retired instance')
  assert.equal(wire.deposited.length, 0)
})

test('retryable counterpart conditions are refused by the terminal refusal channel (R6-B2)', async () => {
  const wire = new WireDouble()
  const { a } = await adapter(wire)
  const id = a.submit(te.encode('x'), 0)
  await a.settle()
  assert.throws(() => a.receiverRefused(id, 'unavailable'), /transport outcomes/)
  assert.throws(() => a.receiverRefused(id, 'internalError'), /transport outcomes/)
  assert.deepEqual(a.status(id), { state: 'accepted' }, 'no verdict was minted')
})

test('a conclusion instant after restoredAt is refused (R5-B4)', async () => {
  await assert.rejects(
    adapter(new WireDouble(), { concluded: [{ queueId: 'aa', concludedAt: 100 }], pending: [] }, 50),
    /after restoredAt/,
  )
})

test('runtime identity fields are unwritable; the create tuple is snapshotted at entry (R8-B1/B2)', async () => {
  const wire = new WireDouble()
  const { a, conn, egress } = await adapter(wire)
  assert.throws(() => { a.connectionDid = 'did:key:zForged' }, TypeError)
  assert.throws(() => { a.egressDid = 'did:key:zForged' }, TypeError)
  assert.equal(a.connectionDid, conn.did)
  assert.equal(a.egressDid, egress.did)

  const ikm = new Uint8Array(32).fill(7)
  const nonce = new Uint8Array(32).fill(9)
  const pending = MediatorCarrierAdapter.create(ikm, MEDIATOR_DID, nonce, new WireDouble())
  ikm.fill(1); nonce.fill(2)             // mutate while the factory awaits
  const b = await pending
  const clean = await identities(new Uint8Array(32).fill(7), new Uint8Array(32).fill(9))
  assert.equal(b.principal, clean.p.principal, 'the tuple was read once, at entry')
  assert.equal(b.connectionDid, clean.conn.did)
  assert.equal(b.egressDid, clean.egress.did)
})

test('a validated refusal during the report-less phase survives the deposit resolution (R9-B2)', async () => {
  const wire = new WireDouble()
  let release
  const realDeposit = wire.deposit.bind(wire)
  wire.deposit = async (t, b, e) => {
    await new Promise((res) => { release = res })
    return realDeposit(t, b, e)
  }
  const { a } = await adapter(wire)
  const id = a.submit(te.encode('x'), 0)
  assert.equal(a.status(id), null)
  // establish the claimed causal order: the deposit call has actually
  // reached the mediator (its hang point) BEFORE the counterpart's
  // validated refusal arrives (R10-N4)
  while (!release) await new Promise((r) => setTimeout(r, 1))
  a.receiverRefused(id, 'proofInvalid')
  assert.deepEqual(a.status(id), { state: 'failed', reason: 'rejected-by-receiver', code: 'proofInvalid' })
  while (!release) await new Promise((r) => setTimeout(r, 1))
  release()
  await a.settle()
  assert.deepEqual(a.status(id), { state: 'failed', reason: 'rejected-by-receiver', code: 'proofInvalid' },
    'the late accepted never displaces the real terminal verdict')
})

test('getter overrides never reach the wire; duplicate acks never rewrite late (R9-B1/M4)', async () => {
  const wire = new WireDouble()
  const { a, conn, egress } = await adapter(wire)
  Object.defineProperty(a, 'connectionDid', { value: 'did:key:zForged', configurable: true })
  Object.defineProperty(a, 'egressDid', { value: a.principal, configurable: true })
  a.submit(te.encode('x'), 0)
  await a.settle()
  for (const did of wire.authDids) assert.equal(did, conn.did, 'the wire saw the real connection DID')
  assert.equal(wire.deposited[0].egressDid, egress.did, 'and the real egress identity — never the principal')

  const wire2 = new WireDouble()
  wire2.depositFailure = 'unreachable'
  const { a: a2 } = await adapter(wire2)
  const id = a2.submit(te.encode('y'), 0)
  await a2.settle()
  a2.advance(DECLARED.giveUpHorizonMs)
  a2.acknowledged(id)
  assert.deepEqual(a2.status(id), { state: 'delivered', late: true })
  a2.acknowledged(id)
  assert.deepEqual(a2.status(id), { state: 'delivered', late: true }, 'idempotent: late stays true')
})

test('teardown edge: a stray ack consumes one copy; later copies land (priced in §6.1 coin, R19/R20)', async () => {
  const wire = new WireDouble()
  const { a } = await adapter(wire)
  const bytes = te.encode('retrans')
  await wire.deliverFromPeer(bytes)
  const c = a.collect(0)
  let releaseAck
  const realAck = wire.ackReceived.bind(wire)
  wire.ackReceived = async (t, ids) => {
    await new Promise((res) => { releaseAck = res })
    return realAck(t, ids)
  }
  a.conclude(c, 1)
  while (!releaseAck) await new Promise((r) => setTimeout(r, 1))
  a.close()                                        // ack still flying at teardown
  // successor far beyond the window: expired entry falls at restore
  const { a: a2 } = await adapter(wire, a.ackState(), 2 * DECLARED.duplicateWindowMs)
  wire.ackReceived = realAck                       // successor's own acks work normally
  wire.onDeliver(wire.consumer)
  const qid = await queueIdOf(bytes)
  wire.queue.set(qid, bytes.slice())               // sender retransmits: queued at the mediator
  releaseAck()                                     // the stray ack lands ONCE and deletes that copy
  await a.settle()
  assert.equal(wire.queue.size, 0, 'one transmission lost — like any single transport loss')
  await wire.deliverFromPeer(bytes)                // a later application resubmission
  const c2 = a2.collect(1 + 2 * DECLARED.duplicateWindowMs)
  assert.equal(c2.items.length, 1, 'a later copy meets no stray ack and reaches the successor')
})

test('within the window a retried ack deletes only what absorption would swallow anyway (R21)', async () => {
  const wire = new WireDouble()
  const ikm = crypto.getRandomValues(new Uint8Array(32))
  const nonce = crypto.getRandomValues(new Uint8Array(32))
  const a = await MediatorCarrierAdapter.create(ikm, MEDIATOR_DID, nonce, wire)
  const bytes = te.encode('equiv')
  await wire.deliverFromPeer(bytes)
  const c = a.collect(0)
  // acks reach the mediator (which deletes) but every RESPONSE is
  // lost — the ambivalent error edge: pending survives, retries run
  let ackCalls = 0
  const realAck = wire.ackReceived.bind(wire)
  wire.ackReceived = async (t, ids) => { ackCalls++; await realAck(t, ids); throw new WireError('unreachable') }
  a.conclude(c, 1); await a.settle()
  a.close()
  // the SAME (root, C, N): a genuine successor of this relationship
  const a2 = await MediatorCarrierAdapter.create(ikm, MEDIATOR_DID, nonce, wire, a.ackState(), 2)
  wire.onDeliver(wire.consumer)
  const qid = await queueIdOf(bytes)
  for (let i = 0; i < 3; i++) {
    wire.queue.set(qid, bytes.slice())     // a resubmitted byte-identical copy
    a2.advance(3 + i); await a2.settle()   // retry lands, deletes it, response lost again
    assert.equal(wire.queue.size, 0, 'deleted by the retried ack')
    // PORT-EQUIVALENCE: had the copy been DELIVERED instead, the
    // window absorption would have swallowed it just the same
    await wire.deliverFromPeer(bytes)
    assert.equal(a2.collect(3 + i).items.length, 0,
      'inside the window the copy never surfaces either way — deletion adds no loss')
    a2.conclude({ id: 'c-empty' }, 3 + i)
  }
  assert.ok(ackCalls >= 3, 'retries ran — and none of them changed what the holder observes')
  // beyond the window no intent survives: the account is closed
  a2.advance(4 + DECLARED.duplicateWindowMs); await a2.settle()
  assert.equal(a2.ackState().pending.length, 0)
  await wire.deliverFromPeer(bytes)
  const c3 = a2.collect(5 + DECLARED.duplicateWindowMs)
  assert.equal(c3.items.length, 1, 'beyond the window every copy lands — nothing is left to delete it')
  a2.conclude(c3, 6 + DECLARED.duplicateWindowMs)
  wire.ackReceived = realAck
  a2.advance(7 + DECLARED.duplicateWindowMs); await a2.settle()
})

test('one stray call, many digests: it deletes one copy per digest it was sealed with — no more (R24-N)', async () => {
  const wire = new WireDouble()
  const ikm = crypto.getRandomValues(new Uint8Array(32))
  const nonce = crypto.getRandomValues(new Uint8Array(32))
  const a = await MediatorCarrierAdapter.create(ikm, MEDIATOR_DID, nonce, wire)
  const bytesA = te.encode('digest-a')
  const bytesB = te.encode('digest-b')
  await wire.deliverFromPeer(bytesA)
  await wire.deliverFromPeer(bytesB)
  const c = a.collect(0)
  let releaseAck
  const realAck = wire.ackReceived.bind(wire)
  wire.ackReceived = async (t, ids) => {
    await new Promise((res) => { releaseAck = res })
    return realAck(t, ids)
  }
  a.conclude(c, 1)                                 // ONE flush, batching both digests
  while (!releaseAck) await new Promise((r) => setTimeout(r, 1))
  a.close()                                        // the stray flies with its sealed two-digest batch
  const a2 = await MediatorCarrierAdapter.create(ikm, MEDIATOR_DID, nonce, wire,
    a.ackState(), 2 * DECLARED.duplicateWindowMs)  // successor beyond the window: nothing survives
  wire.onDeliver(wire.consumer)
  const qa = await queueIdOf(bytesA)
  const qb = await queueIdOf(bytesB)
  wire.queue.set(qa, bytesA.slice())               // fresh post-window copies of BOTH digests
  wire.queue.set(qb, bytesB.slice())
  releaseAck()                                     // the stray lands once
  await a.settle()
  assert.equal(wire.queue.size, 0, 'one copy fell per sealed digest — the priced reach of one call')
  wire.ackReceived = realAck                       // the successor's own acks work normally
  await wire.deliverFromPeer(bytesA)               // the NEXT copies meet no stray
  await wire.deliverFromPeer(bytesB)
  const c2 = a2.collect(1 + 2 * DECLARED.duplicateWindowMs)
  assert.equal(c2.items.length, 2, 'beyond the sealed batch, every copy lands')
  a2.conclude(c2, 2 + 2 * DECLARED.duplicateWindowMs); await a2.settle()
})

// ── clock discipline ─────────────────────────────────────────────────
test('non-finite time throws; the clock is a high-water mark', async () => {
  const wire = new WireDouble()
  const { a } = await adapter(wire)
  assert.throws(() => a.submit(te.encode('z'), Number.NaN))
  const id = a.submit(te.encode('z'), 5_000)
  await a.settle()
  a.advance(1_000)
  assert.equal(a.status(id).state, 'accepted')
})
