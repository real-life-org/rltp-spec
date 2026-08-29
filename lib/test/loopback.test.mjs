#!/usr/bin/env node
// Loopback: both halves of the port against each other, in memory, with
// a stub clock — the whole §5a story once through, with REAL crypto on
// every hop: the carrier seals its address challenge to the rkid with
// the Section-5 envelope, the holder opens it with the pair context's
// key-agreement half, signs with the derived control principal, and the
// state machine answers from the closed verdict set.
//
// This is the completion of "Port in Code": after this file, an adapter
// binds transports to an exchange that already runs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Carrier } from '../dist/carrier.js'
import { holderContext, registrationProof, sessionProof, recoverCarrierEntry } from '../dist/holder.js'
import { seal, unseal } from '../dist/delivery.js'
import { xFromSeed, mkOfX, rand, b64uOf } from '../dist/crypto.js'

const DAY = 86_400_000
const DECL = {
  carrier: 'did:web:loopback.example',
  orphanHorizonMs: 7 * DAY, giveUpHorizonMs: 1 * DAY, challengeLifetimeMs: 5_000,
  queueFloorBytes: 65_536, maxQueueBytes: 1_048_576, maxBindingTombstones: 8,
  statusHorizonMs: 5_000,
}
const IKM = new Uint8Array(64).map((_, i) => i + 1)
const NONCE = new Uint8Array(32).fill(3)

// the relationship's pair context: the key-agreement half IS the rkid
const PAIR = await xFromSeed(new Uint8Array(32).fill(9))
const RKID = mkOfX(PAIR.pubRaw)

/** the carrier's side of one challenge exchange: draw both values, seal
 * the address challenge to the rkid (Section 5 — only the holder of the
 * pair context can open it), remember the principal challenge. */
async function challengeExchange (carrier, now) {
  // the VALUE is the carrier's and the carrier remembers it — the proof
  // must return exactly it (fail-closed, port-review B-2); the sealing
  // is the transport act
  let addressValue
  const principalChallenge = carrier.issueChallenge(now, RKID, () => {
    addressValue = b64uOf(rand(32))
    return { entropy: rand(32), addressValue }
  })
  const envelope = await seal({ challenge: addressValue }, RKID)
  return { principalChallenge, envelope, addressValue }
}
/** the holder's side: open the sealed challenge with the pair context */
async function openAddressChallenge (envelope) {
  const opened = await unseal(envelope, PAIR.priv)
  assert.equal(opened.error, undefined, 'the holder can open what was sealed to its rkid')
  return opened.document.challenge
}

test('loopback: register → submit → collect → conclude, both halves real', async () => {
  const carrier = new Carrier(DECL)
  const holder = await holderContext(IKM, DECL.carrier, NONCE, RKID, 1)

  // registration: both possession proofs, end to end
  const ch = await challengeExchange(carrier, 0)
  const opened = await openAddressChallenge(ch.envelope)
  assert.equal(opened, ch.addressValue, 'decryption IS the possession proof')
  const reg = await carrier.register(
    await registrationProof(holder, 'register', ch.principalChallenge, opened),
    { now: 0, rawGeneration: '1' })
  assert.equal(reg.verdict, 'registered')

  // a sender submits sealed bytes (key-blind for the carrier)
  const payload = await seal({ hello: 'world' }, RKID)
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  assert.equal((await carrier.submit(RKID, bytes, { now: 10 })).verdict, 'admitted')

  // collection: session proof, fresh challenge, deposits handed over
  const ch2 = await challengeExchange(carrier, 20)
  const col = await carrier.collect(
    await sessionProof(holder, 'collect', ch2.principalChallenge), { now: 20 })
  assert.equal(col.verdict, 'served')
  assert.equal(col.deposits.length, 1)

  // the holder decrypts what the carrier could not read
  const delivered = JSON.parse(new TextDecoder().decode(col.deposits[0].bytes))
  const openedDoc = await unseal(delivered, PAIR.priv)
  assert.deepEqual(openedDoc.document, { hello: 'world' }, 'end-to-end: sealed at the sender, opened at the holder')

  // conclusion ends the carrier's duty for exactly that deposit
  const ch3 = await challengeExchange(carrier, 30)
  const con = await carrier.conclude(
    await sessionProof(holder, 'conclude', ch3.principalChallenge), col.deposits[0].digest, { now: 30 })
  assert.equal(con.verdict, 'served')
  assert.equal(carrier.bindingOf(RKID).deposits, 0, 'nothing admitted ends silently — and this one ended properly')
})

test('loopback: the §9.3 recovery — lost carrier entry, two exchanges, disclosed generation', async () => {
  const carrier = new Carrier(DECL)
  // the ORIGINAL device registered at generation 4
  const holder4 = await holderContext(IKM, DECL.carrier, NONCE, RKID, 4)
  const ch = await challengeExchange(carrier, 0)
  await carrier.register(
    await registrationProof(holder4, 'register', ch.principalChallenge, await openAddressChallenge(ch.envelope)),
    { now: 0, rawGeneration: '4' })

  // the holder loses the carrier entry: fresh N → a principal the
  // carrier does not know, at a generation it cannot know
  // each generation has its own nonce: rotations are REGISTER events,
  // and the principal derives from the nonce (port-review B-6)
  const nonceAt = (g) => new Uint8Array(32).fill(0x70 + g)
  const rotations = []
  const recovered = await holderContext(IKM, DECL.carrier, nonceAt(1), RKID, 1)
  const result = await recoverCarrierEntry(
    recovered,
    async (g) => { rotations.push(g); return holderContext(IKM, DECL.carrier, nonceAt(g), RKID, g) },
    (proof, rawGeneration) => carrier.register(proof, { now: 100, rawGeneration }),
    async () => {
      const c = await challengeExchange(carrier, 100)
      return { principalChallenge: c.principalChallenge, openedAddressChallenge: await openAddressChallenge(c.envelope) }
    })
  assert.equal(result.outcome, 'bound')
  assert.equal(result.steps.length, 2, 'two CARRIER exchanges — the rotations are local')
  assert.equal(result.steps[0].verdict, 'refused(stale-generation)')
  assert.equal(result.steps[1].generation, 5, 'disclosed + 1')
  assert.deepEqual(rotations, [5], 'the register rotated to the disclosed successor with a FRESH nonce')
  const g5 = await holderContext(IKM, DECL.carrier, nonceAt(5), RKID, 5)
  assert.equal(carrier.bindingOf(RKID).principal, g5.identity.principal,
    'the bound principal is DERIVED from the generation-5 nonce — not the generation-1 identity relabelled')
})

test('loopback: wind-up in time — closing admits, the deadline releases, the tombstone refuses the past', async () => {
  const carrier = new Carrier(DECL)
  const holder = await holderContext(IKM, DECL.carrier, NONCE, RKID, 2)
  const ch = await challengeExchange(carrier, 0)
  await carrier.register(
    await registrationProof(holder, 'register', ch.principalChallenge, await openAddressChallenge(ch.envelope)),
    { now: 0, rawGeneration: '2' })

  carrier.tick(DECL.orphanHorizonMs)                       // nobody collected
  assert.equal(carrier.stateOf(RKID), 'closing')
  const sealed = await seal({ late: true }, RKID)
  assert.equal((await carrier.submit(RKID, new TextEncoder().encode(JSON.stringify(sealed)), { now: DECL.orphanHorizonMs + 1 })).verdict,
    'admitted', 'a closing queue admits — indistinguishable from live at the port')

  carrier.tick(DECL.orphanHorizonMs + DECL.giveUpHorizonMs)
  assert.equal(carrier.stateOf(RKID), 'released')

  // an old backup at generation 2 proves everything and still cannot return
  const after = DECL.orphanHorizonMs + DECL.giveUpHorizonMs + 1
  const ch2 = await challengeExchange(carrier, after)
  const old = await carrier.register(
    await registrationProof(holder, 'register', ch2.principalChallenge, await openAddressChallenge(ch2.envelope)),
    { now: after, rawGeneration: '2' })
  assert.equal(old.verdict, 'refused(stale-generation)')
  assert.equal(old.heldGeneration, 2, 'the tombstone outlives the binding, and the refusal still discloses')
})
