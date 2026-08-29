#!/usr/bin/env node
// The carrier port, driven by the SHIPPED vector corpus — plus the
// adversarial suites the first port review demanded: operation ORDER is
// measured (crypto counted, not assumed), races are run, expiry needs no
// tick, and fail-closed is proven by omission, not by flags.
//
// The vector ships the control principal's Ed25519 seed, so this suite
// SIGNS real proofs for arbitrary queues instead of bypassing the proof
// rule — the library has no bypass, which is itself the property.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Carrier, verifyProofShape, canonicalGenerationSpelling, validateDeclaration, PROOF_V }
  from '../dist/carrier.js'
import { carrierPrincipal, CARRIER_INFO_PREFIX, validCarrierIdentifier }
  from '../dist/carrier-identity.js'
import { jcs } from '../dist/core.js'
import { base58, edFromSeed, b64uOf } from '../dist/crypto.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const J = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'))
const CP = J('vectors/carrier-proof.json')
const ID = J('vectors/identity-derivation.json')
const hex = (s) => Uint8Array.from(Buffer.from(s, 'hex'))
const te = new TextEncoder()
const S = globalThis.crypto.subtle

const DAY = 86_400_000
const DECL = {
  carrier: 'did:web:carrier.example',
  orphanHorizonMs: 7 * DAY, giveUpHorizonMs: 1 * DAY, challengeLifetimeMs: 5_000,
  queueFloorBytes: 65_536, maxQueueBytes: 1_048_576, maxBindingTombstones: 3,
  statusHorizonMs: 5_000,
}
const RKID = CP.keys.rkid

// ── a real signer: the vector's control principal ───────────────────────
const KEY = await edFromSeed(hex(CP.keys.principalSeed))
const chalBytes = (n) => { const b = new Uint8Array(32); b[0] = n & 0xff; b[1] = n >> 8; return b }
const ADDR = b64uOf(new Uint8Array(32).fill(0xaa))

async function signProof (fields) {
  const p = { v: PROOF_V, type: 'carrier-registration-proof', carrier: DECL.carrier,
    principal: CP.keys.principal, ...fields }
  const sig = new Uint8Array(await S.sign({ name: 'Ed25519' }, KEY.priv, te.encode(jcs(p))))
  return { ...p, sig: 'z' + base58(sig) }
}
let seq = 100
async function mkRegister (c, { rkid, generation, now, purpose = 'register' }) {
  const ch = c.issueChallenge(now, rkid, () => ({ entropy: chalBytes(seq++), addressValue: ADDR }))
  return signProof({ purpose, rkid, generation, principalChallenge: ch, addressChallenge: ADDR })
}
const regOpts = (now, generation) => ({ now, rawGeneration: String(generation) })
async function mkSession (c, { rkid, now, purpose = 'collect' }) {
  const ch = c.issueChallenge(now, rkid, () => ({ entropy: chalBytes(seq++) }))
  return signProof({ purpose, rkid, principalChallenge: ch })
}
const envBytes = (rkid, fill = 1, ctLen = 24) => te.encode(JSON.stringify({
  rkid, epk: b64uOf(new Uint8Array(32).fill(fill)),
  nonce: b64uOf(new Uint8Array(12).fill(fill)),
  ciphertext: b64uOf(new Uint8Array(ctLen).fill(fill)),
}))
async function registered (c, rkid, generation, now) {
  const r = await c.register(await mkRegister(c, { rkid, generation, now }), regOpts(now, generation))
  assert.equal(r.verdict, 'registered')
  return r
}

// count asymmetric verifications — the order rules are about WORK
let verifies = 0
const realVerify = S.verify.bind(S)
S.verify = (...args) => { verifies++; return realVerify(...args) }

// ── Identity §7a: derivation + grammar, vector-driven ───────────────────
test('carrier-identity: §7a.4 reproduces every shipped case, Ed25519-only', async () => {
  const CR = ID.carrierRelationship
  const ikm = hex(ID.rootIkm); const N = hex(CR.relationshipNonce)
  assert.equal(CARRIER_INFO_PREFIX, CR.prefix)
  const seen = new Set()
  for (const c of CR.cases) {
    const got = await carrierPrincipal(ikm, c.carrier, N)
    assert.equal(got.info, c.info, `${c.carrier}: info = prefix || Dc || Dn`)
    assert.equal(got.principal, c.principal, `${c.carrier}: principal`)
    assert.equal(got.keyAgreement, null)
    seen.add(got.principal)
  }
  assert.equal(seen.size, CR.cases.length, 'per-carrier separation')
})

test('carrier-identity: §7a.2 runs the SHIPPED grammar vector — bytes, Cf, White_Space and all', async () => {
  const G = ID.carrierRelationship.identifierGrammar
  for (const v of G.accepts) assert.equal(validCarrierIdentifier(v), true, `accept ${JSON.stringify(v)}`)
  for (const r of G.rejects) {
    const v = r.value !== undefined ? r.value
      : r.valueEscaped !== undefined ? JSON.parse(`"${r.valueEscaped.replaceAll('\\\\', '\\')}"`)
        : r.repeat ? r.repeat.char.repeat(r.repeat.count) : undefined
    assert.notEqual(v, undefined, `reject vector without a constructible value: ${r.reason}`)
    assert.equal(validCarrierIdentifier(v), false, `reject: ${r.reason}`)
  }
  // the PINNED sets, enumerated — the pin is executed, not narrated.
  // Entries are hex ranges ("0600-0605") or single points ("00AD").
  const range = (e) => e.split('-').map((h) => parseInt(h, 16))
  const eachEnd = (list, label) => {
    for (const e of list ?? []) {
      const [a0, b0 = a0] = range(e)
      for (const cp of new Set([a0, b0])) {
        assert.equal(validCarrierIdentifier('x' + String.fromCodePoint(cp) + 'x'), false,
          `${label} U+${cp.toString(16)} rejects (pinned 15.0 set)`)
      }
    }
  }
  eachEnd(G.unicodePin?.cc, 'Cc')
  eachEnd(G.unicodePin?.cf, 'Cf')
  eachEnd(G.unicodePin?.whiteSpace, 'White_Space')
  assert.equal(validCarrierIdentifier('a b'), false, 'NBSP is White_Space')
  assert.equal(validCarrierIdentifier('a​b'), false, 'zero-width space')
  assert.equal(validCarrierIdentifier('x'.repeat(1024)), true, '1024 UTF-8 bytes is the shipped maximum')
  assert.equal(validCarrierIdentifier('ä'.repeat(513)), false, '1026 UTF-8 bytes — the bound is BYTES, not UTF-16 length')
  const ikm = hex(ID.rootIkm); const N = hex(ID.carrierRelationship.relationshipNonce)
  const a = await carrierPrincipal(ikm, 'did:web:carrier.example', N)
  const b = await carrierPrincipal(ikm, 'did:web:Carrier.example', N)
  assert.notEqual(a.principal, b.principal, 'byte-exactness: a case variant is a different carrier')
})

// ── §5a.3: shipped proofs, negatives, aliases, spelling, closed set ─────
test('proof: registration, collection, conclusion verify; transplants fail', async () => {
  for (const name of ['registration', 'collection', 'conclusion']) {
    const blk = CP[name]
    assert.equal(await verifyProofShape({ ...blk.object, sig: blk.sig }, blk.object.carrier), null, name)
  }
  for (const neg of CP.negatives.cases) {
    const r = await verifyProofShape({ ...neg.object, sig: neg.sig },
      neg.object.carrier === 'did:web:carrier.example' ? neg.object.carrier : 'did:web:carrier.example')
    assert.notEqual(r, null, `negative [${neg.case}] must not verify`)
  }
})

test('proof: encoding aliases die at the decoded check; an EXTRA field is not this artifact', async () => {
  const base = { ...CP.registration.object, sig: CP.registration.sig }
  for (const c of CP.encodingAcceptanceSurface.cases) {
    const r = await verifyProofShape({ ...base, [c.field]: c.value }, base.carrier)
    assert.equal(r, 'refused(malformed)', `alias on ${c.field}`)
  }
  const extra = await verifyProofShape({ ...base, note: 'x' }, base.carrier)
  assert.equal(extra, 'refused(malformed)', 'the wire format is closed (port-review M-4)')
})

test('generation spelling: the received bytes decide, and the carrier REQUIRES them', async () => {
  for (const r of CP.generationSpelling.rejects) {
    assert.equal(canonicalGenerationSpelling(r.lexeme), false, `reject ${r.lexeme}`)
  }
  for (const a of CP.generationSpelling.accepts) assert.equal(canonicalGenerationSpelling(a), true)
  const c = new Carrier(DECL)
  const p = await mkRegister(c, { rkid: RKID, generation: 1, now: 0 })
  const r = await c.register(p, { now: 0 })
  assert.equal(r.verdict, 'refused(malformed)', 'rawGeneration is REQUIRED — optional was fail-open')
})

// ── guarantee 1: the declaration binds, out-of-domain rejects ───────────
test('declaration: §11 domains enforced at construction and revision', () => {
  assert.equal(validateDeclaration(DECL).length, 0)
  assert.throws(() => new Carrier({ ...DECL, orphanHorizonMs: 10_000 }), /orphanHorizonMs/)
  assert.throws(() => new Carrier({ ...DECL, challengeLifetimeMs: 500 }), /challengeLifetimeMs/)
  assert.throws(() => new Carrier({ ...DECL, queueFloorBytes: 64 }), /queueFloorBytes/)
  assert.throws(() => new Carrier({ ...DECL, giveUpHorizonMs: 8 * DAY }), /orphan-horizon < give-up-horizon/)
  const c = new Carrier(DECL)
  assert.throws(() => c.reviseDeclaration({ maxBindingTombstones: 0 }), /maxBindingTombstones/)
})

// ── r1–r3 order: refused requests cost no crypto; consume-first ─────────
test('order: r1/r2 refusals perform ZERO verifications; consume happens before verify', async () => {
  // the gate now sits INSIDE the challenge entry (guarantee 3 by
  // construction): a drained shared gate refuses BEFORE entropy is drawn
  const c = new Carrier(DECL, { admitNew: () => false })
  let drawn = 0
  const refused = c.issueChallenge(0, RKID, () => { drawn++; return { entropy: chalBytes(seq++), addressValue: ADDR } })
  assert.equal(refused, null, 'the gated entry refuses retriably')
  assert.equal(drawn, 0, 'no entropy was drawn for a refused request — guarantee 3 structurally')
  // and a proof carrying a never-issued challenge dies at r3 without crypto? No —
  // it dies AT r2 for new bindings; with an open gate it costs one verify:
  verifies = 0
  const c1 = new Carrier(DECL)
  const orphanProof = await signProof({ purpose: 'register', rkid: RKID, generation: 1,
    principalChallenge: b64uOf(chalBytes(seq++)), addressChallenge: ADDR })
  assert.equal((await c1.register(orphanProof, regOpts(0, 1))).verdict, 'refused(possession-failed)')
  assert.equal(verifies, 0, 'an unissued challenge is consumed-nothing and buys no verification')

  const c2 = new Carrier(DECL)
  const bad = { ...await mkRegister(c2, { rkid: RKID, generation: 1, now: 0 }), sig: 'z' + base58(new Uint8Array(64).fill(7)) }
  verifies = 0
  assert.equal((await c2.register(bad, regOpts(0, 1))).verdict, 'refused(possession-failed)')
  assert.equal(verifies, 1, 'the failed attempt spent exactly one verification')
  verifies = 0
  const replay = await c2.register(bad, regOpts(0, 1))
  assert.equal(replay.verdict, 'refused(possession-failed)')
  assert.equal(verifies, 0, 'a consumed challenge buys NO further verification — consume-first is measured, not asserted')
})

test('challenge: expiry needs no tick; a challenge is bound to its rkid — ALWAYS', async () => {
  const c = new Carrier(DECL)
  const p = await mkRegister(c, { rkid: RKID, generation: 1, now: 0 })
  const late = await c.register(p, { now: DECL.challengeLifetimeMs + 1, rawGeneration: '1' })
  assert.equal(late.verdict, 'refused(possession-failed)', 'expired at the operation\'s own now — no tick required')

  const c2 = new Carrier(DECL)
  const ch = c2.issueChallenge(0, CP.keys.otherRkid, () => ({ entropy: chalBytes(seq++), addressValue: ADDR }))
  const transplanted = await signProof({ purpose: 'register', rkid: RKID, generation: 1,
    principalChallenge: ch, addressChallenge: ADDR })
  assert.equal((await c2.register(transplanted, regOpts(1, 1))).verdict, 'refused(possession-failed)',
    'a challenge issued for one rkid does not authorize another — the binding is unconditional (R3 B-1)')
})

test('address possession is fail-closed: the carrier compares the value IT sealed', async () => {
  const c = new Carrier(DECL)
  const ch = c.issueChallenge(0, RKID, () => ({ entropy: chalBytes(seq++), addressValue: ADDR }))
  const wrong = await signProof({ purpose: 'register', rkid: RKID, generation: 1,
    principalChallenge: ch, addressChallenge: b64uOf(new Uint8Array(32).fill(0xbb)) })
  assert.equal((await c.register(wrong, regOpts(1, 1))).verdict, 'refused(possession-failed)',
    'a wrong opened value fails — no flag can wave it through')
})

// ── purpose × dispatch (port-review B-3) ────────────────────────────────
test('purpose binds the operation: a conclude proof cannot collect, and vice versa', async () => {
  const c = new Carrier(DECL)
  await registered(c, RKID, 1, 0)
  await c.submit(RKID, envBytes(RKID), { now: 1 })
  const concludeProof = await mkSession(c, { rkid: RKID, now: 2, purpose: 'conclude' })
  assert.equal((await c.collect(concludeProof, { now: 2 })).verdict, 'refused(malformed)')
  const collectProof = await mkSession(c, { rkid: RKID, now: 3, purpose: 'collect' })
  assert.equal((await c.conclude(collectProof, 'x', { now: 3 })).verdict, 'refused(malformed)')
  assert.equal(c.bindingOf(RKID).deposits, 1, 'nothing was collected or concluded by the wrong purpose')
})

// ── linearization (port-review B-4) ─────────────────────────────────────
test('race: two concurrent registrations linearize — never two registered', async () => {
  const c = new Carrier(DECL)
  const p1 = await mkRegister(c, { rkid: RKID, generation: 1, now: 0 })
  const p2 = await mkRegister(c, { rkid: RKID, generation: 2, now: 0, purpose: 'rebind' })
  const [r1, r2] = await Promise.all([
    c.register(p1, regOpts(0, 1)), c.register(p2, regOpts(0, 2)),
  ])
  assert.notDeepEqual([r1.verdict, r2.verdict], ['registered', 'registered'],
    'not linearizable: both saw unbound')
  assert.equal(c.bindingOf(RKID).generation, 2,
    'the higher generation survives every serial order — the lower one never overwrites it')
})

test('race: a submission racing the deadline never lands in a released queue', async () => {
  const c = new Carrier(DECL)
  await registered(c, RKID, 1, 0)
  const deadline = DECL.orphanHorizonMs + DECL.giveUpHorizonMs
  const r = await c.submit(RKID, envBytes(RKID), { now: deadline })
  assert.equal(r.verdict, 'refused(no-such-queue)',
    'advance() runs from the operation\'s own now — no write into an ended binding')
  assert.equal(c.stateOf(RKID), 'released')
})

// ── time (port-review B-5): normative instants, not tick instants ───────
test('time: transitions fire at their normative instants even under a late tick', async () => {
  const c = new Carrier(DECL)
  await registered(c, RKID, 1, 0)
  c.tick(DECL.orphanHorizonMs + DECL.giveUpHorizonMs + 20_000)
  assert.equal(c.stateOf(RKID), 'released',
    'released at lastCollection + orphan + give-up — not at whenever tick ran')
})

test('time: a deposit in a LIVE queue is given up at its own horizon', async () => {
  const given = []
  const c = new Carrier(DECL, {}, { onGiveUp: (r, d) => given.push(d) })
  await registered(c, RKID, 1, 0)
  await c.submit(RKID, envBytes(RKID), { now: 1 })
  c.tick(1 + DECL.giveUpHorizonMs)
  assert.equal(c.bindingOf(RKID).deposits, 0, 'give-up-horizon is enforced for live queues too')
  assert.equal(given.length, 1)
})

// ── the wind-up story on the new API ────────────────────────────────────
test('wind-up: closing admits, deadline releases, return voids, fresh deadline later', async () => {
  const c = new Carrier(DECL)
  await registered(c, RKID, 1, 0)
  c.tick(DECL.orphanHorizonMs)
  assert.equal(c.stateOf(RKID), 'closing')
  const deadline = c.bindingOf(RKID).deadline
  assert.equal(deadline, DECL.orphanHorizonMs + DECL.giveUpHorizonMs)
  assert.equal((await c.submit(RKID, envBytes(RKID), { now: deadline - 1000 })).verdict, 'admitted')

  const t1 = deadline - 500
  const back = await c.register(await mkRegister(c, { rkid: RKID, generation: 1, now: t1 }), regOpts(t1, 1))
  assert.equal(back.verdict, 'registered(idempotent)')
  assert.equal(c.stateOf(RKID), 'live')
  assert.equal(c.bindingOf(RKID).deadline, undefined, 'void, not paused')
  c.tick(t1 + DECL.orphanHorizonMs)
  assert.equal(c.bindingOf(RKID).deadline, t1 + DECL.orphanHorizonMs + DECL.giveUpHorizonMs, 'a FRESH deadline')
})

// ── generation ordering + disclosure + tombstones ───────────────────────
test('generation: disclosure, disclosed+1 rebind, rollback closed', async () => {
  const c = new Carrier(DECL)
  await registered(c, RKID, 4, 0)
  const other = await edFromSeed(hex('11'.repeat(32)))
  const otherDid = 'did:key:z' + base58(Uint8Array.from([0xed, 0x01, ...other.pubRaw]))
  const mkOther = async (purpose, generation, now) => {
    const ch = c.issueChallenge(now, RKID, () => ({ entropy: chalBytes(seq++), addressValue: ADDR }))
    const p = { v: PROOF_V, type: 'carrier-registration-proof', purpose, carrier: DECL.carrier,
      principal: otherDid, rkid: RKID, generation, principalChallenge: ch, addressChallenge: ADDR }
    const sig = new Uint8Array(await S.sign({ name: 'Ed25519' }, other.priv, te.encode(jcs(p))))
    return { ...p, sig: 'z' + base58(sig) }
  }
  const r1 = await c.register(await mkOther('register', 1, 1), regOpts(1, 1))
  assert.equal(r1.verdict, 'refused(stale-generation)')
  assert.equal(r1.heldGeneration, 4)
  const r2 = await c.register(await mkOther('rebind', 5, 2), regOpts(2, 5))
  assert.equal(r2.verdict, 'rebound')
  const r3 = await c.register(await mkRegister(c, { rkid: RKID, generation: 4, now: 3, purpose: 'rebind' }), regOpts(3, 4))
  assert.equal(r3.verdict, 'refused(stale-generation)')
  assert.equal(r3.heldGeneration, 5, 'the restored backup cannot roll back — and still gets the disclosure')
})

test('tombstone: eviction order with a REAL same-instant tie, revision trim, consumption', async () => {
  const store = CP.generationMonotonicity.releasedAndReRegistered.evictionRule.store
  const evicted = []
  const c = new Carrier({ ...DECL, maxBindingTombstones: store.max }, {}, { onEvict: (k) => evicted.push(k) })
  const bySweep = new Map()
  for (const e of store.entries) bySweep.set(e.releaseSweep, [...(bySweep.get(e.releaseSweep) ?? []), e])
  let t = 0
  for (const sweep of [...bySweep.keys()].sort()) {
    for (const e of bySweep.get(sweep)) await registered(c, e.rkid, 2, t)
    // one tick past both deadlines: same-sweep bindings share the same
    // normative release instant, so the tie-break genuinely decides
    t += DECL.orphanHorizonMs + DECL.giveUpHorizonMs
    c.tick(t)
    t += 1
  }
  assert.equal(c.tombstoneLabels().length, 3)
  const low = await c.register(await mkRegister(c, { rkid: store.entries[0].rkid, generation: 2, now: t }), regOpts(t, 2))
  assert.equal(low.verdict, 'refused(stale-generation)')
  assert.equal(low.heldGeneration, 2, 'resurrection by patience is closed')

  c.reviseDeclaration({ maxBindingTombstones: 1 })
  const byLabel = new Map(store.entries.map((e) => [e.label, e.rkid]))
  assert.deepEqual(evicted, store.orderedFullLabels.slice(0, 2).map((l) => byLabel.get(l)),
    'the trim evicts in the normative order — longest-released first, same-instant tie by rkid bytes')

  const survivor = byLabel.get(store.orderedFullLabels[2])
  const hi = await c.register(await mkRegister(c, { rkid: survivor, generation: 3, now: t + 1 }), regOpts(t + 1, 3))
  assert.equal(hi.verdict, 'registered')
  assert.equal(c.tombstoneOf(survivor), null, 'consumed')
})

// ── the five guarantees, structurally where possible ────────────────────
test('guarantee 4: the shared gate is NEVER invoked for a held binding — the call graph proves it', async () => {
  let sharedCalls = 0
  const c = new Carrier(DECL, { admitNew: () => { sharedCalls++; return true } })
  await registered(c, RKID, 1, 0)
  const before = sharedCalls
  await c.collect(await mkSession(c, { rkid: RKID, now: 1 }), { now: 1 })
  await c.register(await mkRegister(c, { rkid: RKID, generation: 2, now: 2, purpose: 'rebind' }), regOpts(2, 2))
  assert.equal(sharedCalls, before, 'held-binding requests never touch admitNew — guarantee 4 as call graph')
})

test('guarantee 5: below the floor only the queue\'s own meter refuses; DO-6 stays honest', async () => {
  const c = new Carrier(DECL, { hasCapacity: () => false })
  await registered(c, RKID, 1, 0)
  assert.equal((await c.submit(RKID, envBytes(RKID), { now: 1 })).verdict, 'admitted',
    'global occupancy is unreachable below the floor')
  const c2 = new Carrier(DECL, { meterQueue: () => false })
  await registered(c2, RKID, 1, 0)
  assert.equal((await c2.submit(RKID, envBytes(RKID), { now: 1 })).verdict, 'refused(admission-resource)',
    'the queue\'s own budget refuses even below the floor — whoever spends it holds the address')
})

// ── s1–s6: envelopes, duplicates byte-exact and CHARGED, immunity ───────
test('s2: a submission must be a Section-5 envelope naming THIS queue', async () => {
  const c = new Carrier(DECL)
  await registered(c, RKID, 1, 0)
  assert.equal((await c.submit(RKID, new Uint8Array([1]), { now: 1 })).verdict, 'refused(bounds)',
    'raw bytes are not an envelope')
  assert.equal((await c.submit(RKID, envBytes(CP.keys.otherRkid), { now: 2 })).verdict, 'refused(bounds)',
    'an envelope for another rkid does not enter this queue')
  assert.equal((await c.submit(RKID, envBytes(RKID), { now: 3 })).verdict, 'admitted')
})

test('s3: duplicates are byte-exact, CHARGE the meter, and the store is immune to caller mutation', async () => {
  let metered = 0
  const c = new Carrier(DECL, { meterQueue: () => { metered++; return true } })
  await registered(c, RKID, 1, 0)
  const bytes = envBytes(RKID, 5)
  assert.equal((await c.submit(RKID, bytes, { now: 1 })).verdict, 'admitted')
  assert.equal((await c.submit(RKID, bytes.slice(), { now: 2 })).verdict, 'duplicate')
  assert.equal(metered, 2, 'a duplicate consumes admission work exactly like an admitted submission (§5a.5)')

  bytes[bytes.length - 1] = 0x21                        // caller mutates its buffer
  const col = await c.collect(await mkSession(c, { rkid: RKID, now: 3 }), { now: 3 })
  assert.notEqual(col.deposits[0].bytes[bytes.length - 1], 0x21, 'the store holds a COPY — byte durability (M-6)')
})


// ── port-review-2: the counter-runs, executed ───────────────────────────
test('R2 B-1: a challenge issued WITHOUT a sealed address value cannot register', async () => {
  const c = new Carrier(DECL)
  const ch = c.issueChallenge(0, RKID, () => ({ entropy: chalBytes(seq++) }))   // no addressValue
  const p = await signProof({ purpose: 'register', rkid: RKID, generation: 1,
    principalChallenge: ch, addressChallenge: ADDR })
  assert.equal((await c.register(p, regOpts(1, 1))).verdict, 'refused(possession-failed)',
    'omission is not possession — fail-closed with no flag to forget')
})

test('R2 B-2: a session proof at register() is refused before any state moves', async () => {
  const c = new Carrier(DECL)
  const collectProof = await mkSession(c, { rkid: RKID, now: 0, purpose: 'collect' })
  const r = await c.register(collectProof, { now: 0, rawGeneration: '1' })
  assert.equal(r.verdict, 'refused(malformed)')
  assert.equal(c.stateOf(RKID), 'unbound', 'no binding with generation undefined was ever created')
})

test('R2 M-1: normative time is monotone — an older now cannot rewind a commit', async () => {
  const c = new Carrier(DECL)
  await registered(c, RKID, 1, 1000)
  const back = await c.register(await mkRegister(c, { rkid: RKID, generation: 2, now: 500, purpose: 'rebind' }),
    regOpts(500, 2))
  assert.equal(back.verdict, 'rebound')
  // if the rebind had written lastCollectionAt = 500, closing would begin
  // at 500 + orphan; monotone time says 1000 + orphan
  c.tick(500 + DECL.orphanHorizonMs)
  assert.equal(c.stateOf(RKID), 'live', 'the stale now did not rewind the collection instant')
  c.tick(1000 + DECL.orphanHorizonMs)
  assert.equal(c.stateOf(RKID), 'closing')
})

test('R2 M-2: concluding is not collecting — the orphan timer runs on', async () => {
  const c = new Carrier(DECL)
  await registered(c, RKID, 1, 0)
  // conclusions right before the horizon must NOT reset it
  const p = await mkSession(c, { rkid: RKID, now: DECL.orphanHorizonMs - 10, purpose: 'conclude' })
  assert.equal((await c.conclude(p, 'no-such-digest', { now: DECL.orphanHorizonMs - 10 })).verdict, 'served')
  c.tick(DECL.orphanHorizonMs)
  assert.equal(c.stateOf(RKID), 'closing', 'a never-collected queue winds up, conclusions or not')
})

test('R2 M-3: mutating the passed declaration changes nothing', async () => {
  const d = { ...DECL }
  const c = new Carrier(d)
  d.maxBindingTombstones = 0
  d.orphanHorizonMs = -1
  assert.equal(c.decl.maxBindingTombstones, DECL.maxBindingTombstones, 'the carrier holds a validated copy')
  assert.equal(c.decl.orphanHorizonMs, DECL.orphanHorizonMs)
})

test('R2 M-4: no hashing for an unknown queue or an oversize blob', async () => {
  const c = new Carrier(DECL)
  // an unknown rkid refuses at s1 — sha over the blob would be wasted
  // work an unauthenticated party could force; we assert the verdict and
  // rely on the s1-first structure (the sync block precedes the hash)
  const big = new Uint8Array(DECL.maxQueueBytes + 1)
  assert.equal((await c.submit(CP.keys.otherRkid, big, { now: 0 })).verdict, 'refused(no-such-queue)')
  await registered(c, RKID, 1, 0)
  assert.equal((await c.submit(RKID, big, { now: 1 })).verdict, 'refused(bounds)')
})

test('R2 M-5: a tag-only ciphertext is an empty plaintext and refuses', async () => {
  const c = new Carrier(DECL)
  await registered(c, RKID, 1, 0)
  assert.equal((await c.submit(RKID, envBytes(RKID, 1, 16), { now: 1 })).verdict, 'refused(bounds)',
    '16 bytes is exactly the GCM tag — §5 forbids the empty plaintext')
})

test('R2 M-7: the floor is the boundary — within it admits against a dead carrier, past it refuses', async () => {
  const c = new Carrier(DECL, { hasCapacity: () => false })
  await registered(c, RKID, 1, 0)
  // fill close under the floor (b64 granularity makes the exact byte
  // unreachable; the boundary property is: occupancy ≤ floor admits
  // whatever the global state, occupancy > floor may refuse)
  const filler = envBytes(RKID, 2, 40_000)             // ~53.5k total, under the floor
  assert.equal((await c.submit(RKID, filler, { now: 1 })).verdict, 'admitted',
    'within the floor: admitted although hasCapacity is dead')
  const crossing = envBytes(RKID, 3, 40_000)           // pushes occupancy past the floor
  assert.equal((await c.submit(RKID, crossing, { now: 2 })).verdict, 'refused(capacity)',
    'past the floor: the global refusal is honest — the declared constant is the boundary')
})

test('R2 M-7: precedence — s5 (queue-saturated) beats s6 (capacity); r4 beats r5', async () => {
  // BOTH conditions true at once — the queue crosses max-queue-bytes
  // while global capacity is drained: the queue-own bound answers
  let capacity = true
  const c = new Carrier(DECL, { hasCapacity: () => capacity })
  await registered(c, RKID, 1, 0)
  const chunk = envBytes(RKID, 1, 600_000)             // ~800k, admitted while capacity lives
  assert.equal((await c.submit(RKID, chunk, { now: 1 })).verdict, 'admitted')
  capacity = false
  const overflow = envBytes(RKID, 2, 400_000)          // occupancy → ~1.33M > max-queue-bytes
  assert.equal((await c.submit(RKID, overflow, { now: 2 })).verdict, 'refused(queue-saturated)',
    's5 before s6 — with both conditions true, the most specific names the verdict')

  // r4 before r5: a NEW binding at a full carrier refuses capacity even
  // when the state table would also have something to say (tombstone)
  const c2 = new Carrier(DECL, { hasBindingRoom: () => false })
  const p = await mkRegister(c2, { rkid: RKID, generation: 1, now: 0 })
  assert.equal((await c2.register(p, regOpts(0, 1))).verdict, 'registration-refused(capacity)',
    'r4 answers before the state table is consulted')
})


// ── port-review-3: the remaining counter-runs ───────────────────────────
test('R3 B-2: the carrier identifier is not revisable — a different C is a different carrier', async () => {
  const c = new Carrier(DECL)
  assert.throws(() => c.reviseDeclaration({ carrier: 'did:web:new.example' }), /not revisable/)
})

test('R3 M-1: the declaration enforces the SAME identifier domain as the derivation', () => {
  assert.throws(() => new Carrier({ ...DECL, carrier: 'did:web:bad carrier' }), /7a\.2/,
    'a C the holder could never derive from is not a carrier declaration')
})

test('R3 M-2: a stale now cannot shorten the published challenge lifetime', async () => {
  const c = new Carrier(DECL)
  await registered(c, RKID, 1, 1000)                       // clock high-water: 1000
  const ch = c.issueChallenge(500, RKID, () => ({ entropy: chalBytes(seq++), addressValue: ADDR }))
  const p = await signProof({ purpose: 'rebind', rkid: RKID, generation: 2,
    principalChallenge: ch, addressChallenge: ADDR })
  // published lifetime from the MONOTONE clock: valid until 1000 + 5000
  const r = await c.register(p, { now: 1000 + DECL.challengeLifetimeMs - 1, rawGeneration: '2' })
  assert.equal(r.verdict, 'rebound', 'the declaration binds: never stricter than published (guarantee 1)')
})

test('R3 M-4a: no-hashing is MEASURED — the digest count is zero on s1/s2 refusals', async () => {
  const realDigest = S.digest.bind(S)
  let digests = 0
  S.digest = (...a) => { digests++; return realDigest(...a) }
  try {
    const c = new Carrier(DECL)
    const big = new Uint8Array(DECL.maxQueueBytes + 1)
    digests = 0
    await c.submit(CP.keys.otherRkid, big, { now: 0 })
    assert.equal(digests, 0, 's1 refusal hashed nothing')
    await registered(c, RKID, 1, 0)
    digests = 0
    await c.submit(RKID, big, { now: 1 })
    assert.equal(digests, 0, 's2 refusal hashed nothing')
  } finally { S.digest = realDigest }
})

test('R3 M-4b: r4 beats r5 with a REAL tombstone overlap — capacity × stale-generation', async () => {
  let room = true
  const c = new Carrier(DECL, { hasBindingRoom: () => room })
  await registered(c, RKID, 2, 0)
  c.tick(DECL.orphanHorizonMs + DECL.giveUpHorizonMs)      // released, tombstone t=2
  assert.equal(c.stateOf(RKID), 'released')
  room = false
  // g′ ≤ t: r5 would say stale-generation — but r4 answers first, and
  // the refusal is the retriable one, not the terminal-looking one
  const late = DECL.orphanHorizonMs + DECL.giveUpHorizonMs + 1
  const p = await mkRegister(c, { rkid: RKID, generation: 1, now: late })
  const r = await c.register(p, regOpts(late, 1))
  assert.equal(r.verdict, 'registration-refused(capacity)',
    'both conditions true: the evaluation order names capacity (r4), never stale (r5)')
})

test('R3 m-1: a byte-identical re-presentation AFTER conclusion is a new submission', async () => {
  const c = new Carrier(DECL)
  await registered(c, RKID, 1, 0)
  const bytes = envBytes(RKID, 6)
  await c.submit(RKID, bytes, { now: 1 })
  const col = await c.collect(await mkSession(c, { rkid: RKID, now: 2 }), { now: 2 })
  await c.conclude(await mkSession(c, { rkid: RKID, now: 3, purpose: 'conclude' }), col.deposits[0].digest, { now: 3 })
  assert.equal((await c.submit(RKID, bytes.slice(), { now: 4 })).verdict, 'admitted',
    'the comparison value lives exactly as long as the deposit (§5a.5)')
})

test('R3 m-1: recovery per held state — closing and unbound, with a capacity retry', async () => {
  // closing: the return meets the same generation question
  const c = new Carrier(DECL)
  await registered(c, RKID, 3, 0)
  c.tick(DECL.orphanHorizonMs)                              // closing
  const t = DECL.orphanHorizonMs + 100
  const back = await c.register(await mkRegister(c, { rkid: RKID, generation: 4, now: t, purpose: 'rebind' }), regOpts(t, 4))
  assert.equal(back.verdict, 'rebound', 'two exchanges from closing — same as live')
  // unbound after eviction: ONE exchange
  const c2 = new Carrier({ ...DECL, maxBindingTombstones: 1 }, {})
  await registered(c2, RKID, 5, 0)
  await registered(c2, CP.keys.otherRkid, 1, 1)
  c2.tick(1 + DECL.orphanHorizonMs + DECL.giveUpHorizonMs)  // both release; bound 1 → one evicted
  const survivorCount = c2.tombstoneLabels().length
  assert.equal(survivorCount, 1)
  const gone = [RKID, CP.keys.otherRkid].find((k) => c2.stateOf(k) === 'unbound')
  const t2 = 2 + DECL.orphanHorizonMs + DECL.giveUpHorizonMs
  const one = await c2.register(await mkRegister(c2, { rkid: gone, generation: 1, now: t2 }), regOpts(t2, 1))
  assert.equal(one.verdict, 'registered', 'an evicted tombstone leaves no record to exceed — one exchange')
})


// ── port-review-4: the TOCTOU family, executed ──────────────────────────
test('R4 B-1: mutating the proof during verification changes nothing — the snapshot commits', async () => {
  const c = new Carrier(DECL)
  const proof = await mkRegister(c, { rkid: RKID, generation: 1, now: 0 })
  const pending = c.register(proof, regOpts(0, 1))
  proof.rkid = CP.keys.otherRkid                          // attacker mutates mid-verify
  proof.generation = 999
  const r = await pending
  assert.equal(r.verdict, 'registered')
  assert.equal(c.stateOf(RKID), 'live', 'the VERIFIED rkid was bound')
  assert.equal(c.stateOf(CP.keys.otherRkid), 'unbound', 'the mutated rkid was not')
  assert.equal(c.bindingOf(RKID).generation, 1, 'the verified generation was committed')
})

test('R4 B-2: a late tick releases in NORMATIVE order — the older release evicts first', async () => {
  const evicted = []
  const c = new Carrier({ ...DECL, maxBindingTombstones: 1 }, {}, { onEvict: (k) => evicted.push(k) })
  // A collected later → releases LATER; B never collected → releases earlier.
  // Registration order (Map order) is A then B — the trap of visit order.
  await registered(c, RKID, 1, 0)
  await registered(c, CP.keys.otherRkid, 1, 0)
  await c.collect(await mkSession(c, { rkid: RKID, now: 100 }), { now: 100 })
  const lateTick = 100 + DECL.orphanHorizonMs + DECL.giveUpHorizonMs
  c.tick(lateTick)                                        // both deadlines passed
  assert.deepEqual(evicted, [CP.keys.otherRkid],
    'B released first normatively (never collected), so B is the older tombstone and evicts — Map order does not decide')
  assert.equal(c.stateOf(RKID), 'released', 'the younger release survives at bound 1')
})

test('R4 M-1: bytes mutated during the hash are not the stored deposit', async () => {
  const c = new Carrier(DECL)
  await registered(c, RKID, 1, 0)
  const bytes = envBytes(RKID, 7)
  const pending = c.submit(RKID, bytes, { now: 1 })
  bytes[bytes.length - 1] = 0x5a                          // mutate mid-hash
  assert.equal((await pending).verdict, 'admitted')
  const col = await c.collect(await mkSession(c, { rkid: RKID, now: 2 }), { now: 2 })
  assert.notEqual(col.deposits[0].bytes[bytes.length - 1], 0x5a,
    'the entry snapshot is what was hashed and stored — digest and bytes agree')
})

test('R4 M-3: non-finite time is refused, and the clock survives', async () => {
  const c = new Carrier(DECL)
  assert.throws(() => c.tick(NaN), /finite/)
  assert.throws(() => c.tick(Infinity), /finite/)
  assert.throws(() => c.tick(-5), /finite|negative/)
  await registered(c, RKID, 1, 0)                          // the carrier still works
  assert.equal(c.stateOf(RKID), 'live')
})
