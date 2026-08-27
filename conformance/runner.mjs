#!/usr/bin/env node
// RLTP conformance runner — executes the shipped vectors as a live test
// suite. Zero dependencies (node:crypto only), like scripts/validate.mjs.
//
// Division of labour:
//   scripts/validate.mjs   casting-time coherence (prose ↔ schemas ↔ archive)
//   conformance/runner.mjs vector conformance: every cryptographic claim of
//                          the vector files is recomputed from the documented
//                          inputs; every schema claim is validated against the
//                          shipped schemas; every negative must fail at its
//                          declared stage. An implementation under test can
//                          later reuse exactly these checks against its own
//                          output (the simulator is the first candidate).
//
//   usage: node conformance/runner.mjs
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0, fail = 0
const ok = (m) => { pass++; console.log(`  ok    ${m}`) }
const err = (m) => { fail++; console.error(`  FAIL  ${m}`) }
const check = (cond, m) => (cond ? ok(m) : err(m))
const section = (t) => console.log(`\n── ${t}`)
const J = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'))

import {
  b58, fromB58, jcs, sha, hkdf, hmacU, digestU, privX, pubFromRaw, xRawOfMk,
  pubRaw, didOf, mkOf, ecdhRaw, ecdh, verifyRaw, diVerify, SCHEMAS, validate, XS, privEd,
} from './lib.mjs'

const schemaOK = (data, file, label) => {
  const s = SCHEMAS[file]; const errs = validate(data, s, s)
  check(errs.length === 0, `${label} valid against ${file}${errs.length ? ' — ' + errs[0] : ''}`)
  return errs.length === 0
}
const schemaFails = (data, file, label) => {
  const s = SCHEMAS[file]; const errs = validate(data, s, s)
  check(errs.length > 0, `${label} rejected by ${file}`)
}

// ── suite 1: identity derivation oracle ──────────────────────────────────
section('identity-derivation.json — every derivation recomputes')
const ID = J('vectors/identity-derivation.json')
const IKM = Buffer.from(ID.rootIkm, 'hex')
for (const v of ID.vectors) {
  const edInfo = v.edInfo || 'rltp/anchor/ed/' + v.label
  const xInfo = v.xInfo || 'rltp/anchor/x/' + v.label
  const ed = hkdf(IKM, edInfo), x = hkdf(IKM, xInfo)
  check(ed.toString('hex') === v.edSeed && x.toString('hex') === v.xSeed, `${v.label}: seeds`)
  check(didOf(ed) === v.anchor && mkOf(x) === v.keyAgreement, `${v.label}: anchor + keyAgreement`)
  if (v.relationshipNonce) {
    const l = 'pair/u' + Buffer.concat([Buffer.from([0x12, 0x20]), sha(Buffer.from(v.relationshipNonce, 'hex'))]).toString('base64url')
    check(l === v.label, `${v.label}: label = multihash(nonce)`)
  }
}

// carrier-relationship identities (Identity 7a): Ed25519-only, two
// length-fixed digest inputs, one principal per (relationship × carrier).
if (ID.carrierRelationship) {
  const CR = ID.carrierRelationship
  const mh = (b) => 'u' + Buffer.concat([Buffer.from([0x12, 0x20]), sha(b)]).toString('base64url')
  const N = Buffer.from(CR.relationshipNonce, 'hex')
  check(N.length === 32, 'carrier-relationship: the relationship nonce is 32 bytes')
  check(mh(N) === CR.relationshipDigest, 'carrier-relationship: Dn = multihash of the 32 nonce bytes')
  const seen = new Set()
  for (const c of CR.cases) {
    const Dc = mh(Buffer.from(c.carrier, 'utf8'))
    const info = CR.prefix + Dc + CR.relationshipDigest
    check(Dc === c.carrierDigest, `carrier-relationship [${c.carrier}]: Dc = multihash of the UTF-8 carrier identifier`)
    check(Dc.length === 47 && CR.relationshipDigest.length === 47, `carrier-relationship [${c.carrier}]: both info parts are 47 characters (length-fixed, 7a.4)`)
    check(info === c.info, `carrier-relationship [${c.carrier}]: info = prefix || Dc || Dn`)
    const seed = hkdf(IKM, info)
    check(seed.toString('hex') === c.edSeed, `carrier-relationship [${c.carrier}]: seed`)
    check(didOf(seed) === c.principal, `carrier-relationship [${c.carrier}]: principal`)
    // 7a.1 — Ed25519-only: the vector asserts the ABSENCE of a key-agreement key
    check('keyAgreement' in c && c.keyAgreement === null,
      `carrier-relationship [${c.carrier}]: no key-agreement key is derived for this class (declared null, not merely omitted)`)
    seen.add(c.principal)
  }
  check('keyAgreement' in CR && CR.keyAgreement === null,
    'carrier-relationship: the class itself declares keyAgreement null — Ed25519-only, sealing stays at the rkid (7a.1)')
  check(seen.size === CR.cases.length, 'carrier-relationship: every case yields a distinct principal (byte-exactness, per-carrier separation)')

  // Identity 7a.2 — the ordered validation pipeline for C (no normalization step)
  const G = CR.identifierGrammar
  if (G) {
    const wellFormed = (s) => {
      for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i)
        if (c >= 0xd800 && c <= 0xdbff) { const n = s.charCodeAt(i + 1); if (!(n >= 0xdc00 && n <= 0xdfff)) return false; i++ }
        else if (c >= 0xdc00 && c <= 0xdfff) return false
      }
      return true
    }
    // 7a.2 step 4 runs against the SHIPPED Unicode 15.0 ranges, never the runtime's tables
    const parseRanges = (list) => list.map((r) => {
      const [a, b] = r.split('-')
      return [parseInt(a, 16), parseInt(b === undefined ? a : b, 16)]
    })
    const PIN = G.unicodePin
    const pinned = PIN ? [].concat(parseRanges(PIN.cc), parseRanges(PIN.cf), parseRanges(PIN.whiteSpace)) : null
    const inPinned = (cp) => pinned.some(([a, b]) => cp >= a && cp <= b)
    const validId = (s) => {
      if (typeof s !== 'string' || !wellFormed(s)) return false
      const b = Buffer.from(s, 'utf8')
      if (b.length < 1 || b.length > G.maxBytes) return false
      if (!pinned) return !/[\p{Cc}\p{Cf}\p{White_Space}]/u.test(s)
      for (const ch of s) if (inPinned(ch.codePointAt(0))) return false
      return true
    }
    // strict UTF-8 decode for byte inputs (7a.2 step 1): overlong, truncated, surrogate-encoded, out of range
    const decodeStrict = (buf) => {
      try { return new TextDecoder('utf-8', { fatal: true }).decode(buf) } catch { return null }
    }
    const principalOf = (s) => didOf(hkdf(IKM, CR.prefix + mh(Buffer.from(s, 'utf8')) + CR.relationshipDigest))
    for (const s of G.accepts) check(validId(s), `carrier identifier grammar accepts ${JSON.stringify(s)}`)
    for (const r of G.rejects) {
      const s = r.repeat ? r.repeat.char.repeat(r.repeat.count)
        : r.valueEscaped !== undefined ? JSON.parse('"' + r.valueEscaped + '"') : r.value
      check(!validId(s), `carrier identifier grammar rejects: ${r.reason}`)
    }
    const [nfcForm, nfdForm] = G.nfcPair
    check(nfcForm !== nfdForm && validId(nfcForm) && validId(nfdForm) && principalOf(nfcForm) !== principalOf(nfdForm),
      'carrier identifier: no normalization — NFC and NFD spellings are two carriers with two principals (7a.2)')

    if (PIN) {
      check(PIN.version === '15.0', 'carrier identifier: the shipped property pin declares Unicode 15.0')
      // the pin must be self-consistent and must be what the checks above used
      check(pinned.every(([a, b]) => a <= b && b <= 0x10ffff), 'carrier identifier: pinned ranges are well formed')
      check(inPinned(0x00ad) && inPinned(0x200d) && inPinned(0x0007) && inPinned(0x3000) && !inPinned(0x0041),
        'carrier identifier: the pinned set covers Cf (00AD, 200D), Cc (0007) and White_Space (3000) and not ordinary letters')
    }
    for (const r of G.rawByteRejects || []) {
      const buf = Buffer.from(r.bytesHex, 'hex')
      const s = decodeStrict(buf)
      check(s === null || !validId(s), `carrier identifier raw bytes rejected: ${r.reason}`)
    }
    for (const a of G.rawByteAccepts || []) {
      const s = decodeStrict(Buffer.from(a.bytesHex, 'hex'))
      check(s !== null && validId(s), `carrier identifier raw bytes accepted: ${a.reason}`)
    }
  }

  // m-1 (round 2): the relationship axis — same carrier, a second nonce
  const AX = CR.relationshipAxisCase
  if (AX) {
    const N2 = Buffer.from(AX.nonce, 'hex')
    check(N2.length === 32, 'carrier-relationship axis: the second relationship nonce is 32 bytes')
    check(mh(N2) === CR.secondRelationshipDigest, 'carrier-relationship axis: Dn of the second nonce')
    const info = CR.prefix + mh(Buffer.from(AX.carrier, 'utf8')) + CR.secondRelationshipDigest
    check(info === AX.info, 'carrier-relationship axis: info = prefix || Dc || Dn(second)')
    const seed = hkdf(IKM, info)
    check(seed.toString('hex') === AX.edSeed, 'carrier-relationship axis: seed')
    check(didOf(seed) === AX.principal, 'carrier-relationship axis: principal')
    check('keyAgreement' in AX && AX.keyAgreement === null,
      'carrier-relationship axis: no key-agreement key for this class either')
    const sameCarrierFirst = CR.cases.find((c) => c.carrier === AX.carrier)
    check(sameCarrierFirst && sameCarrierFirst.principal !== AX.principal,
      'carrier-relationship axis: ONE carrier, two relationship nonces yield two different principals (7a.3)')
  }

  // Identity 7a.3 — the {nonce, generation} convergence rule (rounds 2 and 4)
  const NC = CR.nonceConvergence
  if (NC) {
    // canonical = highest generation; ties by unsigned bytewise-smallest nonce
    const canonicalOf = (entries) => entries.slice().sort((a, b) =>
      (b.generation - a.generation) ||
      Buffer.compare(Buffer.from(a.nonce, 'hex'), Buffer.from(b.nonce, 'hex')))[0]
    const pAt = (hex) => didOf(hkdf(IKM, CR.prefix +
      mh(Buffer.from(NC.carrier, 'utf8')) + mh(Buffer.from(hex, 'hex'))))
    for (const c of NC.cases) {
      check(c.entries.every((e) => Buffer.from(e.nonce, 'hex').length === 32 && Number.isInteger(e.generation) && e.generation >= 1),
        `nonce convergence [${c.case}]: every entry is a 32-byte nonce with a generation >= 1`)
      const w = canonicalOf(c.entries)
      check(w.nonce === c.canonical.nonce && w.generation === c.canonical.generation,
        `nonce convergence [${c.case}]: the declared entry is canonical`)
      // order independence: every permutation of the entry set must agree
      const perms = (xs) => xs.length <= 1 ? [xs]
        : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((r) => [x, ...r]))
      check(perms(c.entries).every((order) => {
        const k = canonicalOf(order)
        return k.nonce === c.canonical.nonce && k.generation === c.canonical.generation
      }), `nonce convergence [${c.case}]: order-independent — every device reaches the same answer`)
      check(pAt(c.canonical.nonce) === c.canonicalPrincipal,
        `nonce convergence [${c.case}]: the canonical entry derives the declared principal`)
      const superseded = c.entries.filter((e) => e.nonce !== c.canonical.nonce || e.generation !== c.canonical.generation)
      check(superseded.length === c.entries.length - 1,
        `nonce convergence [${c.case}]: exactly one canonical entry, every other superseded`)
      check(superseded.every((e) => pAt(e.nonce) !== c.canonicalPrincipal) &&
        c.supersededPrincipals.every((sp) => sp !== c.canonicalPrincipal),
        `nonce convergence [${c.case}]: a superseded entry derives a DIFFERENT principal — an orphan at the carrier, never a collision`)
    }
    // round-6 M-1: generation has a closed, interoperable integer domain
    const GD = NC.generationDomain
    if (GD) {
      const MAXG = Number.MAX_SAFE_INTEGER
      check(GD.min === 1 && GD.max === MAXG,
        'generation domain: [1, 2^53-1] — the largest integer every JSON implementation represents exactly')
      const inDomain = (v) => Number.isSafeInteger(v) && v >= GD.min && v <= GD.max
      for (const v of GD.accepts) check(inDomain(v), `generation domain accepts ${v}`)
      for (const r of GD.rejects) {
        if (r.valueString !== undefined) {
          // canonical integer form: the round-trip must be byte-identical, which
          // rejects 01 / 1.0 / 1e3 — and 2^53(+1), which are simply out of range
          const parsed = Number(r.valueString)
          const canonical = Number.isSafeInteger(parsed) && String(parsed) === r.valueString
          check(!(canonical && inDomain(parsed)), `generation domain rejects ${r.valueString}: ${r.reason}`)
        } else {
          check(!inDomain(r.value), `generation domain rejects ${r.value}: ${r.reason}`)
        }
      }
      // the divergence the bound exists to forbid, made visible
      check(Number('9007199254740992') === Number('9007199254740993'),
        'generation domain: 2^53 and 2^53+1 ARE indistinguishable in IEEE-754 — which is why the domain stops below them')
      const BC = GD.boundaryCase
      const wB = canonicalOf(BC.entries)
      check(wB.nonce === BC.canonical.nonce && wB.generation === BC.canonical.generation,
        'generation domain [boundary]: a rotation at the top of the domain resolves by generation')
      check(Buffer.compare(Buffer.from(BC.canonical.nonce, 'hex'),
        Buffer.from(BC.entries.find((e) => e.nonce !== BC.canonical.nonce).nonce, 'hex')) > 0,
        'generation domain [boundary]: the winning nonce sorts HIGHER — a bytewise-only rule would have picked the other')
      check(pAt(BC.canonical.nonce) === BC.canonicalPrincipal,
        'generation domain [boundary]: the canonical entry derives the declared principal')
    }

    // The two properties bytewise-smallest alone could not deliver (round-4 B-3)
    const rot = NC.cases.find((c) => /rotation/i.test(c.case))
    check(rot && Buffer.compare(Buffer.from(rot.canonical.nonce, 'hex'),
      Buffer.from(rot.entries.find((e) => e.nonce !== rot.canonical.nonce).nonce, 'hex')) > 0,
      'nonce convergence: the rotation vector is a real counter-vector — the winning nonce sorts HIGHER, so bytewise-smallest alone would have undone the rotation')
    const back = NC.cases.find((c) => /re-appears/i.test(c.case))
    check(back && back.canonical.generation > Math.min(...back.entries.map((e) => e.generation)),
      'nonce convergence: a re-appearing older entry carries the lower generation and stays superseded — the REGISTER needs no tombstone (the carrier keeps its own, for released bindings)')
  }
}

// ── suite 1b: the carrier proof and the rate state machine ───────────────
section('carrier-proof.json — Delivery §5a.3 signature input, §4.4 rate machine')
{
  const CP = J('vectors/carrier-proof.json')
  const strip = (o) => { const { sig, ...rest } = o; return rest }

  // §5a.3 — canonical, domain-separated signature input
  for (const [name, blk] of [['registration', CP.registration], ['collection', CP.collection]]) {
    check(blk.object.v === CP.v, `${name}: the domain tag is the v constant inside the signed object`)
    check(jcs(strip(blk.object)) === blk.jcs, `${name}: signature input is the JCS serialization with sig omitted`)
    check(verifyRaw(blk.object.principal, Buffer.from(blk.jcs, 'utf8'), blk.sig),
      `${name}: the signature verifies under the control principal`)
  }
  const R = CP.registration
  const chalLen = (s) => typeof s === 'string' && s.length === 43 && Buffer.from(s, 'base64url').length === 32 &&
    Buffer.from(s, 'base64url').toString('base64url') === s
  check(chalLen(R.object.principalChallenge) && chalLen(R.object.addressChallenge),
    'registration: both challenges are exactly 32 bytes in canonical unpadded base64url (43 characters)')
  check(R.object.purpose === 'register' && R.object.rkid && R.object.addressChallenge,
    'registration: purpose=register carries rkid and the address challenge')
  check(Number.isSafeInteger(R.object.generation) && R.object.generation >= 1,
    'registration: the proof carries the register generation, in Identity 7a.3\'s domain (round-11 B-4)')

  // §5a.3 — generation monotonicity across the port
  const GM = CP.generationMonotonicity
  if (GM) {
    const verdict = (g, p) =>
      g < GM.acceptedGeneration ? 'refused(stale-generation)'
        : g > GM.acceptedGeneration ? 'rebound'
          : p === GM.acceptedPrincipal ? 'registered(idempotent)' : 'refused(stale-generation)'
    for (const c of GM.cases) {
      check(verdict(c.generation, c.principal) === c.outcome,
        `generation monotonicity [${c.case}]: ${c.outcome}`)
      check(c.bindingMoves === (c.outcome === 'rebound'),
        `generation monotonicity [${c.case}]: the binding moves only on a strictly higher generation`)
    }
    // round-12 B-1: the composite the two state machines did not cover separately
    const TIE = GM.equalGenerationTie
    if (TIE) {
      check(TIE.carrierSeesNonces === false,
        'equal-generation tie: the carrier never sees the nonces — any value reconstructing their order would be a cross-carrier join key (Identity §7a.4)')
      let boundP = null, boundG = 0
      for (const st of TIE.steps) {
        if (st.registerOnly) {                       // the register converges; the carrier learns nothing
          check(st.boundPrincipal === boundP && st.boundGeneration === boundG,
            `equal-generation tie [${st.step}]: register convergence does not move the carrier's binding`)
          continue
        }
        const got = boundP === null ? 'registered'
          : st.generation > boundG ? 'rebound'
            : st.generation === boundG && st.principal === boundP ? 'registered(idempotent)'
              : 'refused(stale-generation)'
        check(got === st.outcome, `equal-generation tie [${st.step}]: ${st.outcome}`)
        if (got === 'registered' || got === 'rebound') { boundP = st.principal; boundG = st.generation }
        check(st.boundPrincipal === boundP && st.boundGeneration === boundG,
          `equal-generation tie [${st.step}]: binding is ${st.boundPrincipal === boundP ? 'as declared' : 'WRONG'}`)
      }
      const refusal = TIE.steps.find((st) => st.outcome === 'refused(stale-generation)')
      const heal = TIE.steps[TIE.steps.length - 1]
      check(refusal && heal.outcome === 'rebound' && heal.generation === refusal.generation + 1,
        'equal-generation tie: the refusal is a WAIT state — one rotation later the binding moves (round-12 B-1)')
      // round-13 B-2: the rotation must actually rotate — fresh nonce, newly DERIVED principal
      const N3 = Buffer.from(TIE.rotationNonce, 'hex')
      check(N3.length === 32 && TIE.rotationNonce !== TIE.registerCanonicalNonce &&
        TIE.rotationNonce !== TIE.registerSupersededNonce,
        'equal-generation tie: the rotation draws a FRESH nonce, not one of the two tie candidates (Identity §7a.3)')
      // local multihash helper: suite 1's is block-scoped
      const mh13 = (b) => 'u' + Buffer.concat([Buffer.from([0x12, 0x20]), sha(b)]).toString('base64url')
      const CRX = ID.carrierRelationship
      const dn3 = mh13(N3)
      check(dn3 === TIE.rotationDigest, 'equal-generation tie: Dn of the rotation nonce')
      const info3 = CRX.prefix + mh13(Buffer.from(TIE.carrier ?? 'did:web:carrier.example', 'utf8')) + dn3
      check(info3 === TIE.rotationInfo, 'equal-generation tie: info = prefix || Dc || Dn(rotation)')
      const seed3 = hkdf(IKM, info3)
      check(seed3.toString('hex') === TIE.rotationEdSeed, 'equal-generation tie: rotation seed')
      check(didOf(seed3) === TIE.rotationPrincipal && didOf(seed3) === heal.principal,
        'equal-generation tie: the healing step binds a principal DERIVED from the fresh nonce (round-13 B-2)')
      check(heal.principal !== TIE.steps[0].principal &&
        heal.principal !== TIE.steps.find((st) => st.registerOnly).principal,
        'equal-generation tie: a real rotation yields a principal different from BOTH tie candidates — the previous vector reused one, which was an impossible state sequence')
      check(Buffer.compare(Buffer.from(TIE.registerSupersededNonce, 'hex'),
        Buffer.from(TIE.registerCanonicalNonce, 'hex')) > 0,
        'equal-generation tie: the vector is the hard direction — the device that bound first holds the LARGER nonce, so the register overturns it')
      // round-13 B-1: the corner where rotation is unavailable
      const MAXTIE = TIE.tieAtTheMaximum
      if (MAXTIE) {
        check(MAXTIE.generation === Number.MAX_SAFE_INTEGER && MAXTIE.rotationAvailable === false,
          'tie at the maximum: no rotation is available there (Identity §7a.3 forbids generation + 1)')
        check(MAXTIE.bindingStands === true && MAXTIE.collectableByEveryDevice === true &&
          MAXTIE.boundPrincipalIsRegisterCanonical === false,
          'tie at the maximum: the binding stands and stays collectable although the bound principal is NOT the register-canonical one — because entries are superseded, never deleted (round-13 B-1)')
        check(MAXTIE.remainingLevers.length >= 2,
          'tie at the maximum: the remaining levers are named (a move to a different C; a new chain as a social event) rather than a re-addressing instruction the holder cannot follow')
      }
    }
    // round-12 B-2: the tombstone outlives the binding
    const REL = GM.releasedAndReRegistered
    if (REL) {
      let tomb = REL.highestEverAccepted
      for (const st of REL.steps) {
        if (st.generation === undefined) continue
        const got = st.generation > tomb ? 'registered' : 'refused(stale-generation)'
        check(got === st.outcome, `released-then-re-registered [${st.step}]: ${st.outcome}`)
        if (got === 'registered') tomb = st.generation
      }
      check(REL.steps.some((st) => st.bindingLive === false && st.outcome === 'refused(stale-generation)'),
        'binding tombstone: a superseded generation is refused even though the binding itself is gone — resurrection by patience is closed (round-12 B-2)')
      // round-14 B-1: the store is bounded, and the consequence of eviction is stated, not implied
      const EV = REL.evictionRule
      check(EV && EV.bound === 'max-binding-tombstones' && /oldest/.test(EV.evicts),
        'binding tombstone: the store is capacity-bounded and evicts the oldest by release time (round-14 B-1)')
      check(EV && /anti-resurrection guarantee ends/.test(EV.consequenceForEvictedRkid) &&
        /both/.test(EV.reachableBy) && /orphan-horizon/.test(EV.attackerCostPerTombstone),
        'binding tombstone: the eviction consequence is named with its preconditions — owner-only, and metered by a registration plus an orphan-horizon per tombstone')
      check(!/binding-tombstone-retention/.test(REL.residual) && !/destroy/.test(REL.residual),
        'binding tombstone: the shipped residual text no longer carries the withdrawn retention constant or the key-retention misreading (round-14 M-2)')
    }
    const restored = GM.cases.find((c) => /restored device/.test(c.case))
    check(restored && restored.outcome === 'refused(stale-generation)' && restored.bindingMoves === false,
      'generation monotonicity: a device restored from an older backup proves everything and still cannot roll the binding back — the register\'s succession holds across the port')
  }
  check(CP.collection.object.purpose === 'collect' &&
    CP.collection.object.rkid === undefined && CP.collection.object.addressChallenge === undefined,
    'collection: purpose=collect omits rkid and addressChallenge — absence is part of the signed bytes')
  check(CP.collection.jcs !== R.jcs && CP.collection.sig !== R.sig,
    'collection: a collection proof is byte-distinct from a registration proof (no cross-purpose replay)')
  for (const n of CP.negatives.cases) {
    check(jcs(n.object) === n.jcs, `transplant vector shape: ${n.case}`)
    check(n.jcs !== R.jcs, `transplant changes the signed bytes: ${n.case}`)
    check(!verifyRaw(n.object.principal, Buffer.from(n.jcs, 'utf8'), R.sig),
      `the registration signature does NOT verify after: ${n.case}`)
  }

  // §4.4 — the challenge CHARGE machine (rounds 7 and 8)
  const CC = CP.challengeChargeMachine
  if (CC) {
    const MAXO = CC.declaration['max-open-challenges']
    const LIFE = CC.lifetimeMs
    const replayCharges = (steps) => {
      let charges = []
      return steps.map((st) => {
        if (st.restart) { charges = new Array(MAXO).fill(LIFE); return { verdict: null, heldAfter: charges.length } }
        const e = Math.max(0, st.elapsedMs)
        charges = charges.map((c) => c - e).filter((c) => c > 0)
        if (charges.length >= MAXO) return { verdict: 'registration-refused(capacity)', heldAfter: charges.length }
        charges.push(LIFE)                       // taken at the budget check, before any key operation
        return { verdict: st.outcome ?? 'issued', heldAfter: charges.length }
      })
    }
    for (const [name, seq] of Object.entries(CC.sequences)) {
      const got = replayCharges(seq)
      check(got.every((g, i) => g.verdict === seq[i].verdict && g.heldAfter === seq[i].heldAfter),
        `challenge charge [${name}]: the declared sequence reproduces step for step (${seq.length} steps)`)
      check(seq.every((st) => st.heldAfter <= MAXO),
        `challenge charge [${name}]: never more than max-open-challenges charges are held`)
    }
    // round-7 B-1: completing an exchange must NOT refund the charge
    const ser = CC.sequences.serialCompletions
    const completedThenRefused = ser.findIndex((st) => st.verdict === 'registration-refused(capacity)')
    check(completedThenRefused >= 0 && ser.slice(0, completedThenRefused).every((st) => st.verdict === 'issued'),
      'challenge charge: completing max-open-challenges exchanges in sequence does NOT free the budget — the next request is refused (the counter-vector to serial recycling)')
    check(ser.some((st) => st.elapsedMs > 0 && st.verdict === 'issued'),
      'challenge charge: only the passage of challenge-lifetime returns a slot')
    // round-8 B-2: a restart cannot be a way to obtain issuance
    const rst = CC.sequences.acrossRestart
    const ri = rst.findIndex((st) => st.restart)
    check(ri > 0 && rst[ri].heldAfter === MAXO,
      'challenge charge: a restart resumes with the FULL budget held — strictly less capacity than before, never more')
    check(rst[ri + 1] && rst[ri + 1].verdict === 'registration-refused(capacity)',
      'challenge charge: restart-loop closed — the first request after a restart is refused, so restarting buys no issuance')
    check(rst[ri - 1].heldAfter < MAXO,
      'challenge charge: the restart really increased the held count (the attack it forecloses is a real one)')
  }

  // §4.4/§5a.5 — the reserve is PER BOUND ADDRESS (round-11 B-1)
  const RS9 = CC && CC.reserveAndStarvation
  if (RS9) {
    const MAXO2 = RS9.declaration['max-open-challenges']
    const LIFE2 = CC.lifetimeMs
    let pool = []              // unreserved charges (remaining ms)
    const perAddress = new Map()  // rkid -> remaining ms of its own charge
    const got = RS9.sequence.map((st) => {
      const e = Math.max(0, st.elapsedMs ?? 0)
      pool = pool.map((c) => c - e).filter((c) => c > 0)
      for (const [k, v] of [...perAddress]) { const r = v - e; if (r > 0) perAddress.set(k, r); else perAddress.delete(k) }
      // one charge per named rkid, whether reserved or from the pool
      if (perAddress.has(st.rkid)) return { verdict: 'registration-refused(capacity)', unreservedHeld: pool.length }
      if (st.bound) { perAddress.set(st.rkid, LIFE2); return { verdict: 'issued', unreservedHeld: pool.length } }
      if (pool.length >= MAXO2) return { verdict: 'registration-refused(capacity)', unreservedHeld: pool.length }
      pool.push(LIFE2); perAddress.set(st.rkid, LIFE2)
      return { verdict: 'issued', unreservedHeld: pool.length }
    })
    check(got.every((g, i) => g.verdict === RS9.sequence[i].verdict && g.unreservedHeld === RS9.sequence[i].unreservedHeld),
      `challenge reserve: the declared sequence reproduces step for step (${RS9.sequence.length} steps)`)
    // the residual is real for the pool …
    const afterLapse = RS9.sequence.findIndex((st) => (st.elapsedMs ?? 0) >= LIFE2)
    check(afterLapse > 0 && RS9.sequence[afterLapse].verdict === 'issued',
      'starvation residual: at the lapse the attacker re-takes the unreserved pool — the denial is NOT self-healing, and the vector says so')
    // … and reaches no bound address's own charge
    const poolFullAt = RS9.sequence.findIndex((st) => !st.bound && st.verdict === 'registration-refused(capacity)')
    const boundAfter = RS9.sequence.slice(poolFullAt).filter((st) => st.bound && st.verdict === 'issued')
    check(poolFullAt > 0 && boundAfter.length >= 2 &&
      new Set(boundAfter.map((st) => st.rkid)).size >= 2,
      'challenge reserve: with the unreserved pool exhausted, TWO different bound addresses still get their own reserved charge — reserves do not compete with each other (round-11 B-1)')
    const aHeld = RS9.sequence.filter((st) => st.rkid === 'rkid-A')
    check(aHeld.some((st) => st.verdict === 'registration-refused(capacity)') &&
      RS9.sequence.some((st) => st.rkid === 'rkid-B' && st.verdict === 'issued'),
      'challenge reserve: holding one address\'s charge reaches that address only — the promise is now the accounting, not an assumption about behaviour')
  }

  // §4.4 — the queue-floor accounting (round-11 B-2/B-3)
  const QF = CP.queueFloorAccounting
  if (QF) {
    const FLOOR = QF.declaration['queue-floor']
    const TOTAL = QF.declaration['max-total-bytes']
    const QUOTA = QF.declaration['max-queue-bytes']
    check(TOTAL >= QF.declaration['max-queues'] * FLOOR,
      'queue floor: max-total-bytes >= max-queues * queue-floor holds for the declared set')
    const committed = (live, closing) =>
      live.reduce((a, u) => a + Math.max(u, FLOOR), 0) + closing.reduce((a, u) => a + u, 0)
    for (const c of QF.cases) {
      const before = committed(c.live, c.closing)
      const after = committed(c.live.map((u, i) => i === c.queue ? u + c.size : u), c.closing)
      check(before === c.committedBefore && after === c.committedAfter,
        `queue floor [${c.case}]: committed ${before} -> ${after}`)
      const fits = after <= TOTAL && (c.live[c.queue] + c.size) <= QUOTA
      check((fits ? 'admitted' : 'refused(capacity)') === c.outcome,
        `queue floor [${c.case}]: ${c.outcome}`)
    }
    // the property that makes the floor a guarantee rather than a promise
    const belowFloor = QF.cases.find((c) => c.live[c.queue] + c.size <= FLOOR)
    check(belowFloor && belowFloor.committedBefore === belowFloor.committedAfter &&
      belowFloor.outcome === 'admitted',
      'queue floor: growth within a queue\'s floor does not move `committed` at all, so it can never be refused for global occupancy (round-11 B-2)')
    const closingCase = QF.cases.find((c) => c.closing.length > 0)
    check(closingCase && closingCase.committedAfter > closingCase.committedBefore,
      'queue floor: a closing queue contributes its bytes to `committed` — they cannot be handed out twice (round-11 B-3)')
  }

  // §5a.5 — `duplicate` is byte-exact over the sealed envelope (round-9 B-2)
  const DR = CP.duplicateRule
  if (DR) {
    const bytesOf = (env) => JSON.stringify([env.rkid, env.epk, env.nonce, env.ciphertext])
    for (const c of DR.cases) {
      const identical = bytesOf(c.first) === bytesOf(c.second)
      const expected = identical && !c.depositConcluded ? 'duplicate' : 'admitted'
      check(expected === c.outcome, `duplicate rule [${c.case}]: outcome is ${c.outcome}`)
      check(c.resourceCharged === 2,
        `duplicate rule [${c.case}]: the admission resource is charged for BOTH submissions — a replay is never free`)
      const expectedCopies = c.outcome === 'duplicate' ? 1 : (c.depositConcluded ? 1 : 2)
      check(c.storedCopies === expectedCopies,
        `duplicate rule [${c.case}]: ${c.storedCopies} stored cop${c.storedCopies === 1 ? 'y' : 'ies'} — a duplicate consumes no storage`)
    }
    const resealed = DR.cases.find((c) => /re-sealed/.test(c.case))
    check(resealed && resealed.outcome === 'admitted' &&
      resealed.first.epk !== resealed.second.epk && resealed.first.nonce !== resealed.second.nonce,
      'duplicate rule: re-sealing one document yields a fresh epk and nonce, so a key-blind carrier admits it — §6.2 absorbs the repetition at the receiver, on the document digest')
  }

  // §4.4 — `rate` is a token bucket in integer MICRO-tokens (round-4 B-4)
  const RS = CP.rateStateMachine
  const MAX = RS.declaration['admission-rate-max']
  const W = RS.windowMs
  const CAP = MAX * W
  check(RS.capacityMicro === CAP && RS.initialMicro === CAP, 'rate: a fresh queue starts with a full bucket, capacity max*windowMs')
  check(W % MAX !== 0, 'rate: the shipped configuration is deliberately NOT evenly divisible — the fault of the previous casting could not have shown up under PT1M/3')

  const replay = (steps) => {
    let micro = RS.initialMicro
    const seen = []
    for (const s of steps) {
      if (s.restart) { seen.push({ verdict: null, microAfter: micro }); continue }  // only micro persists
      micro = Math.min(CAP, micro + Math.max(0, s.elapsedMs) * MAX)
      const verdict = micro >= W ? 'admitted' : 'refused(admission-resource)'
      if (verdict === 'admitted') micro -= W                                        // a refusal subtracts nothing
      seen.push({ verdict, microAfter: micro })
    }
    return seen
  }
  const admits = (seq) => seq.filter((s) => s.verdict === 'admitted').length
  for (const [name, seq] of Object.entries(RS.sequences)) {
    const got = replay(seq)
    check(got.every((g, i) => g.verdict === seq[i].verdict && g.microAfter === seq[i].microAfter),
      `rate [${name}]: the declared sequence reproduces step for step (${seq.length} steps)`)
    check(seq.every((s) => s.microAfter >= 0 && s.microAfter <= CAP),
      `rate [${name}]: the bucket never leaves [0, max*windowMs] — no clock jump creates capacity`)
  }
  // The heart of B-4: capacity is a function of elapsed time, not of polling instants
  const polled = RS.sequences.polledAt334And667
  const together = RS.sequences.bothAt667
  check(polled && together && admits(polled) === admits(together),
    `rate: polling at 334 ms and 667 ms admits exactly as much as asking twice at 667 ms (${admits(polled)} admissions each) — no remainder is lost`)
  check(polled.some((s) => s.verdict.startsWith('refused')) && polled.some((s) => s.verdict === 'admitted'),
    'rate: the sequence exercises both outcomes')
  const zeroRefusals = polled.filter((s, i) => i > 0 && s.elapsedMs === 0 && s.verdict.startsWith('refused'))
  check(zeroRefusals.every((s, i) => {
    const idx = polled.indexOf(s)
    return polled[idx - 1].microAfter === s.microAfter
  }), 'rate: a refusal at zero elapsed time changes no state — a flood cannot deepen a queue\'s own penalty')
  // Restart: no elapsed credit crosses it, and the bucket never resumes fuller
  const rst = RS.sequences.acrossRestart
  const ri = rst.findIndex((s) => s.restart)
  check(ri > 0 && rst[ri].microAfter === rst[ri - 1].microAfter,
    'rate: a restart carries only `micro` — it neither refills nor resets to full')
  check(rst[ri + 1] && rst[ri + 1].elapsedMs === 0 && rst[ri + 1].verdict === 'refused(admission-resource)',
    'rate: no elapsed credit crosses the restart — the first request after it is judged on the persisted counter alone')
}

// ── suite 2: seal vector reproduces byte-for-byte ────────────────────────
section('seal.json — Delivery §5 construction reproduces')
{
  const S = J('vectors/seal.json'); const inp = S.inputs; const out = S.output
  const ptx = jcs(inp.document)
  check(ptx === S.intermediate.plaintextJcs, 'plaintext JCS matches')
  const ephSeed = Buffer.from(inp.ephemeralPrivateKeyRaw, 'base64url')
  const ss = ecdhRaw(ephSeed, Buffer.from(inp.recipientPublicKeyRaw, 'base64url'))
  if (S.intermediate.sharedSecret) check(ss.toString('base64url') === S.intermediate.sharedSecret, 'shared secret matches')
  const key = hkdf(ss, 'rltp/v1/seal')
  const iv = Buffer.from(inp.nonce, 'base64url')
  const c = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([c.update(Buffer.from(ptx, 'utf8')), c.final(), c.getAuthTag()])
  check(ct.toString('base64url') === out.sealedEnvelope.ciphertext, 'ciphertext || tag reproduces byte-for-byte')
  check('z' + b58(Buffer.concat([Buffer.from([0xec, 1]), Buffer.from(inp.recipientPublicKeyRaw, 'base64url')])) === inp.rkid, 'rkid encodes the recipient key')
  const epkRaw = pubRaw(privX(ephSeed))
  check(epkRaw.toString('base64url') === out.sealedEnvelope.epk, 'epk matches the ephemeral public key')
  if (out.documentDigest) check(digestU(inp.document) === out.documentDigest, 'document digest matches')
}

// ── suite 3: encounter cards (eddsa-jcs-2022, W3C-true) ──────────────────
section('encounter-cards.json — cards, credential, binding, negatives')
const EC = J('vectors/encounter-cards.json')
for (const [name, card] of Object.entries(EC.cards)) {
  schemaOK(card, 'contact-card-0.25.schema.json', `card ${name}`)
  schemaOK(card, 'contact-card.schema.json', `card ${name} (mobile)`)
  const r = diVerify(card, card.anchor)
  check(r.ok, `card ${name}: DI proof verifies (W3C, embedded proof only)`)
  check(!('@context' in card.proof), `card ${name}: proof carries no @context (document has none)`)
}
{
  const cred = EC.credential
  schemaOK(cred, 'encounter-credential-0.25.schema.json', 'credential')
  schemaOK(cred, 'encounter-credential.schema.json', 'credential (mobile)')
  check(jcs(cred.proof['@context']) === jcs(cred['@context']), 'credential proof carries the @context copy')
  check(diVerify(cred, cred.issuer).ok, 'credential: DI proof verifies (W3C)')
  const binding = digestU({ ceremony: 'encounter-scan@0.25', challenges: [EC.fixtures.challengeA, EC.fixtures.challengeB].sort() })
  check(binding === cred.credentialSubject.enactmentBinding, 'enactmentBinding recomputes per Encounter 5.4')
}
for (const n of EC.negative) {
  const a = n.artifact
  if (n.name === 'card-mutated-after-signing') {
    const sOK = validate(a, SCHEMAS['contact-card-0.25.schema.json'], SCHEMAS['contact-card-0.25.schema.json']).length === 0
    const r = diVerify(a, a.anchor)
    check(sOK && r.stage === 'crypto' && !r.ok, `${n.name}: schema PASS, binding PASS, DI FAILS exclusively`)
  } else if (n.name === 'verification-method-foreign-anchor') {
    const sOK = validate(a, SCHEMAS['contact-card-0.25.schema.json'], SCHEMAS['contact-card-0.25.schema.json']).length === 0
    const r = diVerify(a, a.anchor)
    check(sOK && r.stage === 'binding', `${n.name}: schema PASS, Layer-1 binding FAILS before crypto`)
  } else if (n.name === 'sent-card-missing-boundTo') {
    schemaFails(a, 'contact-card-0.25.schema.json', n.name)
  } else err(`unknown negative ${n.name}`)
}

// ── suite 4: visibility vectors — every MAC, signature, digest ───────────
section('visibility.json — full recomputation from the oracle')
const V = J('vectors/visibility.json')
const P = {}
for (const [k, v] of Object.entries(V.parties)) {
  const label = 'pair/u' + Buffer.concat([Buffer.from([0x12, 0x20]), sha(Buffer.from(v.relationshipNonce, 'hex'))]).toString('base64url')
  const ed = hkdf(IKM, 'rltp/anchor/ed/' + label), x = hkdf(IKM, 'rltp/anchor/x/' + label)
  P[k] = { ed, x, did: didOf(ed), mk: mkOf(x) }
  check(label === v.label && P[k].did === v.anchor && P[k].mk === v.keyAgreement, `party ${k}: derivation`)
}
// the community anchor is an ORDINARY group-context derivation (Identity
// 0.13, the S-DID cut) — never the recovery context's fixed strings
const selfEd = hkdf(IKM, 'rltp/anchor/ed/' + V.self.label), selfX = hkdf(IKM, 'rltp/anchor/x/' + V.self.label)
check(V.self.label.startsWith('group/') && didOf(selfEd) === V.self.anchor && mkOf(selfX) === V.self.keyAgreement, 'community anchor: ordinary group-context derivation')
const A = V.artifacts
const macCheck = (label, body, mac, privSeed, peerMk, info) =>
  check(hmacU(hkdf(ecdh(privSeed, peerMk), info), jcs(body)) === mac, label)
{
  const kStar = hkdf(ecdh(P.A.x, P.B.mk), `rltp/visibility/blind/star/${P.A.did}/${P.B.did}/1`)
  check(hmacU(kStar, jcs(A.star.body)) === A.star.proof.mac, 'star: mac')
  check(A.star.body.blinded.includes(hmacU(kStar, V.self.anchor)), 'star: blinded entry = HMAC(k, self anchor)')
  macCheck('grade: mac', A.gradeDeclaration.body, A.gradeDeclaration.proof.mac, P.B.x, P.A.mk, `rltp/visibility/mac/grade/${P.B.did}/${P.A.did}`)
  check(verifyRaw(V.self.anchor, Buffer.from(jcs(A.selfCard.body), 'utf8'), A.selfCard.proof.proofValue), 'self-card: raw Ed25519 signature')
  macCheck('anchor-mapping: mac1', A.anchorMapping.body, A.anchorMapping.proof.mac1, P.A.x, P.B.mk, 'rltp/visibility/mac/map1')
  check(hmacU(hkdf(ecdhRaw(selfX, xRawOfMk(P.B.mk)), 'rltp/visibility/mac/map2'), jcs(A.anchorMapping.body)) === A.anchorMapping.proof.mac2, 'anchor-mapping: mac2 (self key)')
  const kp = hkdf(ecdh(P.A2.x, P.B2.mk), `rltp/visibility/blind/probe/${P.A2.did}/${P.B2.did}`)
  const pb = A.continuityProbe.body
  check(hmacU(kp, jcs(pb)) === A.continuityProbe.proof.mac, 'probe: mac')
  check(pb.blinded.length === 256 && new Set(pb.blinded).size === 256, 'probe: 256 unique entries')
  check(jcs(pb.blinded) === jcs([...pb.blinded].sort()), 'probe: globally sorted')
  check(pb.blinded.includes(hmacU(kp, P.A.did)), 'probe: contains the real prior entry')
  macCheck('continuity-mapping: mac1 (prior key)', A.continuityMapping.body, A.continuityMapping.proof.mac1, P.A.x, P.B.mk, 'rltp/visibility/mac/cont1')
  macCheck('continuity-mapping: mac2 (new key)', A.continuityMapping.body, A.continuityMapping.proof.mac2, P.A2.x, P.B2.mk, 'rltp/visibility/mac/cont2')
  macCheck('continuity-mapping reverse: mac1', A.continuityMappingReverse.body, A.continuityMappingReverse.proof.mac1, P.B.x, P.A.mk, 'rltp/visibility/mac/cont1')
  macCheck('continuity-mapping reverse: mac2', A.continuityMappingReverse.body, A.continuityMappingReverse.proof.mac2, P.B2.x, P.A2.mk, 'rltp/visibility/mac/cont2')
  check(verifyRaw(P.R_T.did, Buffer.from(jcs(A.introductionRequest.body), 'utf8'), A.introductionRequest.proof.proofValue), 'introduction-request: signature')
  check(verifyRaw(P.T_I.did, Buffer.from(jcs(A.introductionReply.body), 'utf8'), A.introductionReply.proof.proofValue), 'introduction-reply: signature')
  macCheck('introduction-ack: mac (pinned channel)', A.introductionAck.body, A.introductionAck.proof.mac, P.M_R.x, P.R_M.mk, 'rltp/visibility/mac/ack')
  macCheck('voucher→requester: mac', A.introductionVoucherToRequester.body, A.introductionVoucherToRequester.proof.mac, P.M_R.x, P.R_M.mk, 'rltp/visibility/mac/voucher')
  macCheck('voucher→target: mac', A.introductionVoucherToTarget.body, A.introductionVoucherToTarget.proof.mac, P.M_T.x, P.T_M.mk, 'rltp/visibility/mac/voucher')
  check(A.introductionRequest.body.cardDigest === digestU(V.introductionCards.requester), 'cardDigest = digest of the COMPLETE requester card (incl. proof)')
  check(A.introductionReply.body.cardDigest === digestU(V.introductionCards.target), 'reply cardDigest = digest of the complete target card')
  check(A.introductionReply.body.requestDigest === digestU(A.introductionRequest.body), 'requestDigest = digest of the request body')
  check(diVerify(V.introductionCards.requester, V.introductionCards.requester.anchor).ok, 'requester card: DI proof (real card)')
  check(diVerify(V.introductionCards.target, V.introductionCards.target.anchor).ok, 'target card: DI proof (real card)')
}
schemaOK(V.artifacts.star, 'visibility-star.schema.json', 'star')
schemaOK(V.artifacts.anchorMapping, 'visibility-anchor-mapping.schema.json', 'anchor-mapping')
schemaOK(V.artifacts.continuityProbe, 'visibility-continuity-probe.schema.json', 'probe')
schemaOK(V.artifacts.introductionRequest, 'visibility-introduction-request.schema.json', 'request')
schemaOK(V.payloads.introductionRequest, 'visibility-payload-introduction-request.schema.json', 'payload request')
schemaOK(V.payloads.introductionForward, 'visibility-payload-introduction-forward.schema.json', 'payload forward')
schemaOK(V.payloads.introductionReply, 'visibility-payload-introduction-reply.schema.json', 'payload reply')
for (const n of V.negative) {
  const a = n.artifact
  if (n.name === 'mapping-foreign-self') {
    check(a.body.card.body.anchor !== a.body.self, `${n.name}: step 5 (card.anchor != self) is the failing check`)
    macCheck(`${n.name}: MACs over the MUTATED body verify (steps 1–4 pass)`, a.body, a.proof.mac1, P.A.x, P.B.mk, 'rltp/visibility/mac/map1')
  } else if (n.name === 'probe-shape-255') schemaFails(a, 'visibility-continuity-probe.schema.json', n.name)
  else if (n.name === 'reply-wrong-request-digest') {
    check(verifyRaw(P.T_I.did, Buffer.from(jcs(a.body), 'utf8'), a.proof.proofValue), `${n.name}: signature over mutated body PASSES`)
    check(a.body.requestDigest !== digestU(A.introductionRequest.body), `${n.name}: requestDigest comparison FAILS`)
  } else if (n.name === 'legacy-version') check(a.body.type === 'anchor-mapping@1', `${n.name}: unimplemented type (2.1 rejection before crypto)`)
  else if (n.name === 'star-salt-replay') check(jcs(a) === jcs(A.star), `${n.name}: byte-identical to the accepted star (state fixture)`)
  else err(`unknown negative ${n.name}`)
}

// ── suite 4a: member-mapping@1 — the Access 5.5 crossing of the group boundary ──
section('member-mapping.json — both MACs, the card signature, card.anchor == self')
{
  const MM = J('vectors/member-mapping.json')
  const mh = (s) => 'u' + Buffer.concat([Buffer.from([0x12, 0x20]), sha(Buffer.from(s, 'utf8'))]).toString('base64url')
  const ctx = (label) => { const ed = hkdf(IKM, 'rltp/anchor/ed/' + label), x = hkdf(IKM, 'rltp/anchor/x/' + label); return { ed, x, did: didOf(ed), mk: mkOf(x) } }
  // the two member anchors and the community anchor are ORDINARY group-context
  // derivations (Identity 6.1) — no fixed label, no fixed genesis (5.3's
  // prohibition 1); the community anchor is the one of vectors/visibility.json
  for (const [k, p] of Object.entries(MM.parties)) {
    const d = ctx(p.label)
    check(p.label.startsWith('group/') && d.did === p.anchor && d.mk === p.keyAgreement, `member-mapping party ${k}: ordinary group-context derivation`)
  }
  check(MM.parties.community.anchor === V.self.anchor && MM.parties.community.label === V.self.label, 'member-mapping: community anchor is the one of visibility.json')
  for (const [dg, pre] of Object.entries(MM.group.genesisDigestPreimages)) check(mh(pre) === dg, `member-mapping: sample genesis digest reproduces from its preimage (${pre})`)
  for (const [o, pre] of Object.entries(MM.opRefs.preimages)) check('oid:' + sha(Buffer.from(pre, 'utf8')).toString('base64url') === o, `member-mapping: placeholder oid reproduces from its preimage (${pre})`)

  const S = ctx(MM.parties.sender.label), T = ctx(MM.parties.addressee.label), C = ctx(MM.parties.community.label)
  const mm1 = (body) => hmacU(hkdf(ecdh(S.x, T.mk), 'rltp/access/mac/member-map1'), jcs(body))
  const mm2 = (body) => hmacU(hkdf(ecdhRaw(C.x, xRawOfMk(T.mk)), 'rltp/access/mac/member-map2'), jcs(body))
  const b = MM.artifact.body
  check(b.member === MM.parties.sender.anchor && b.to === MM.parties.addressee.anchor, 'member-mapping: member/to are the two member anchors')
  check(b.self === MM.parties.community.anchor, 'member-mapping: `self` (frozen spelling) is the community anchor')
  check(mm1(b) === MM.artifact.proof.mac1, 'member-mapping: mac1 (member-X × member-X)')
  check(mm2(b) === MM.artifact.proof.mac2, 'member-mapping: mac2 (community-X × addressee member-X)')
  check(mm1(b) !== mm2(b), 'member-mapping: the two MACs are under different keys')
  check(verifyRaw(b.card.body.anchor, Buffer.from(jcs(b.card.body), 'utf8'), b.card.proof.proofValue), 'member-mapping: card verifies as self-card@1 under its own anchor')
  check(b.card.body.anchor === b.self, 'member-mapping: step 4 — card.anchor == self')
  check(b.card.body.keyAgreement === MM.parties.community.keyAgreement, 'member-mapping: the card carries the community key-agreement key')
  check(jcs(b.card) === jcs(V.artifacts.selfCard), 'member-mapping: the enclosed card is byte-identical to the visibility.json self-card')
  schemaOK(MM.artifact, 'member-mapping.schema.json', 'member-mapping')
  for (const n of MM.negative) {
    const a = n.artifact
    if (n.name === 'member-mapping-foreign-self') {
      check(mm1(a.body) === a.proof.mac1 && mm2(a.body) === a.proof.mac2, `${n.name}: both MACs over the MUTATED body verify (step 6 passes)`)
      check(a.body.card.body.anchor !== a.body.self, `${n.name}: step 4 (card.anchor != self) is the failing check — a foreign community anchor stays unclaimable`)
    } else err(`unknown member-mapping negative ${n.name}`)
  }
}

// ── suite 5: dtg-credentials.json — VIC/VEC forms, u/z equivalence, genesis-to-bytes ──
section('dtg-credentials.json — DTG forms, u/z equivalence, canonical-u constructions')
{
  const D = J('vectors/dtg-credentials.json')
  // strict multibase bridge: prefix, decode, multihash header/length, AND
  // canonical-form round-trip — a mutated prefix or non-canonical rendering fails
  const toU = (z) => {
    if (typeof z !== 'string' || z[0] !== 'z') return null
    const b = fromB58(z.slice(1))
    if (!b || b.length !== 34 || b[0] !== 0x12 || b[1] !== 0x20) return null
    if ('z' + b58(b) !== z) return null // canonical base58btc only
    return 'u' + b.toString('base64url')
  }
  const uBytes = (u) => (typeof u === 'string' && u[0] === 'u') ? Buffer.from(u.slice(1), 'base64url') : null

  // u/z: same decoded multihash bytes
  const uz = D.uzEquivalence
  check(toU(uz.genesisDigest.z) === uz.genesisDigest.u, 'genesisDigest: canonical z decodes to the same multihash as u')
  check(toU(uz.acceptDigest.z) === uz.acceptDigest.u, 'acceptDigest: canonical z decodes to the same multihash as u')
  check(toU('x' + uz.genesisDigest.z.slice(1)) === null && toU(uz.genesisDigest.u) === null, 'the bridge rejects wrong prefixes (self-test)')
  check(toU(uz.notEqual.z) === uz.notEqual.u && uz.notEqual.u !== uz.genesisDigest.u, 'a DIFFERENT multihash stays distinguishable across encodings')

  // every derivation claim of the file recomputes (nothing vector-vs-itself)
  const md = D.memberAnchorDerivation
  check(md.label === 'group/' + uz.genesisDigest.u && md.edInfo === 'rltp/anchor/ed/' + md.label && md.xInfo === 'rltp/anchor/x/' + md.label, 'label + info strings use the canonical u rendering')
  check(uz.genesisDigest.multihashHex === uBytes(uz.genesisDigest.u).toString('hex'), 'multihashHex matches the decoded u bytes')
  check(didOf(hkdf(IKM, md.edInfo)) === md.expectedInviteeAnchor && md.expectedInviteeAnchor === D.parties.inviteeCandidate.anchor, 'invitee member anchor recomputes from the oracle IKM (parties entry included)')
  check(mkOf(hkdf(IKM, md.xInfo)) === D.parties.inviteeCandidate.keyAgreement, 'invitee keyAgreement recomputes from the oracle IKM')
  check(md.fromZ.canonicalized === uz.genesisDigest.u && md.fromZ.sameAnchor === true, 'fromZ fixture is internally consistent')
  check(didOf(hkdf(IKM, 'rltp/anchor/ed/group/' + toU(md.fromZ.carried))) === md.expectedInviteeAnchor, 'a z-carried genesisDigest derives the SAME anchor after canonical-u re-encoding')
  // second party + group DID: the documented vector-only constructions reproduce
  const IKM2 = Buffer.from(crypto.hkdfSync('sha256', IKM, Buffer.alloc(0), Buffer.from('rltp/vector/second-party-root-ikm', 'utf8'), 64))
  check(didOf(hkdf(IKM2, md.edInfo)) === D.parties.inviterVoucher.anchor, 'inviter/voucher anchor recomputes from the documented second-party IKM')
  check(mkOf(hkdf(IKM2, md.xInfo)) === D.parties.inviterVoucher.keyAgreement, 'inviter keyAgreement recomputes')
  check(didOf(hkdf(IKM, 'rltp/vector/group-did-sample')) === D.parties.groupDid, 'group DID sample recomputes')

  // invite: schema, DI proof incl. @context copy, credential digest = invitation identity
  const inv = D.invite.payload.invite
  schemaOK(D.invite.payload, 'payload-membership-invite.schema.json', 'invite payload (VIC)')
  schemaOK(inv.credentialSubject.card, 'contact-card.schema.json', "inviter card inside the invite")
  check(diVerify(inv, inv.issuer).ok, 'invite credential DI proof verifies under its issuer')
  check(jcs(inv.proof['@context']) === jcs(inv['@context']), 'invite proof carries the @context copy')
  check(diVerify(inv.credentialSubject.card, inv.issuer).ok, 'inviter card proof verifies; card.anchor = invite issuer')
  check(inv.credentialSubject.card.anchor === inv.issuer, 'card ownership binding (Membership 3.1)')
  check(digestU(inv) === D.invite.credentialDigest, 'invitation identity = digest over the COMPLETE credential incl. proof (Membership 2)')
  const tsec = (t) => Math.floor(Date.parse(t) / 1000)
  // calendar validity is a parse-time check (schema descriptions; the
  // syntactic patterns admit day 31 in every month) — Date.parse silently
  // NORMALIZES impossible dates, so demand a round-trip
  const calOK = (t) => { const d = new Date(t); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 19) === t.slice(0, 19) && /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?Z$/.test(t) }
  check(tsec(inv.validUntil) >= tsec(inv.validFrom), 'invite validUntil ≥ validFrom (Membership 3.1, whole-second comparison)')
  // cross-field bindings: signed material is tied BACK to the party and
  // digest oracles — a coherently re-signed detachment fails here
  check(inv.credentialSubject.id === D.parties.inviteeCandidate.anchor, 'invite subject = the invitee party anchor')
  check(inv.credentialSubject.group === D.parties.groupDid, 'invite group = the group DID')
  check(inv.issuer === D.parties.inviterVoucher.anchor && inv.credentialSubject.card.anchor === D.parties.inviterVoucher.anchor, 'invite issuer and card anchor = the inviter party')
  check(inv.credentialSubject.card.keyAgreement === D.parties.inviterVoucher.keyAgreement, 'invite card keyAgreement = the inviter party')
  check(inv.credentialSubject.genesisDigest === uz.genesisDigest.u, 'invite genesisDigest = the uz oracle')
  // accept fixture: the COMPLETE consent document that binds the
  // invitation identity — and whose document digest the vouches bind
  const accDoc = D.accept.document
  const acc = accDoc.payload
  const eqDigest = (a, b) => (a[0] === 'u' ? a : toU(a)) === (b[0] === 'u' ? b : toU(b)) && (a[0] === 'u' ? a : toU(a)) !== null
  schemaOK(accDoc, 'rltp-delivery-document.schema.json', 'accept document (delivery profile)')
  schemaOK(acc, 'payload-membership-accept.schema.json', 'accept payload')
  check(accDoc.type === 'https://real-life.org/trust-tasks/membership-accept/0.2', 'accept document type is the registered 0.2 task type')
  check(diVerify(accDoc, accDoc.issuer).ok && accDoc.issuer === acc.accept.subject, 'accept task proof verifies under the subject (Membership 2)')
  check(accDoc.issuer === D.parties.inviteeCandidate.anchor && accDoc.recipient === D.parties.inviterVoucher.anchor, 'accept document issuer/recipient = the party oracle')
  check(accDoc.threadId === inv.taskContext, 'accept travels on the invite thread (taskContext binding)')
  check(eqDigest(acc.accept.ref, D.invite.credentialDigest), 'accept.ref = the invite credential digest (decoded-bytes equality, Membership 3.2)')
  check(acc.accept.subject === D.parties.inviteeCandidate.anchor && acc.accept.group === D.parties.groupDid, 'accept subject/group = the party oracle')
  check(diVerify(acc.accept.card, acc.accept.subject).ok && acc.accept.card.anchor === acc.accept.subject, 'accept card is subject-owned and verifies')
  check(acc.accept.card.keyAgreement === D.parties.inviteeCandidate.keyAgreement, 'accept card keyAgreement = the invitee party oracle')
  const MEMBERSHIP_SKEW = 300 // PT5M, Membership section 5
  check(tsec(accDoc.issuedAt) <= tsec(inv.validUntil) + MEMBERSHIP_SKEW && tsec(accDoc.proof.created) <= tsec(inv.validUntil) + MEMBERSHIP_SKEW, 'accept issuedAt and proof.created ≤ invite validUntil + membership-skew (Membership 3.2)')
  // Membership card profile (section 2): enclosed cards carry no
  // enactment or transport members — the generic card schema permits
  // them, Membership forbids them
  for (const [card, label] of [[inv.credentialSubject.card, 'invite card'], [acc.accept.card, 'accept card']])
    check(!('sentTo' in card) && !('boundTo' in card) && !('deliveryHints' in card), `${label}: no sentTo/boundTo/deliveryHints (Membership enclosure profile)`)
  // the COMPLETE invite delivery document: one carrier, document bindings.
  // sizeOK and bindOK are THE predicates — fixture checks and self-tests
  // share them, so predicate drift is structurally impossible
  const invDoc = D.invite.document
  const sizeOK = (doc) => Buffer.byteLength(jcs(doc), 'utf8') <= 16384
  const bindOK = (d) => !('proof' in d) && d.issuer === inv.issuer && d.recipient === inv.credentialSubject.id && d.threadId === inv.taskContext
  schemaOK(invDoc, 'rltp-delivery-document.schema.json', 'invite document (delivery profile)')
  check(invDoc.type === 'https://real-life.org/trust-tasks/membership-invite/0.2', 'invite document type is the registered 0.2 task type')
  check(jcs(invDoc.payload) === jcs(D.invite.payload), 'invite document wraps exactly the payload fixture')
  check(bindOK(invDoc), 'invite document: no document proof, issuer/recipient/threadId bound to the credential (Membership 2, 3.1)')
  // Membership section 2 size budget: 16 384 bytes JCS per COMPLETE document
  check(sizeOK(accDoc), 'accept document ≤ 16384 JCS bytes (Membership 2)')
  check(sizeOK(invDoc), 'invite document ≤ 16384 JCS bytes (Membership 2)')
  // every timestamp of the chain is calendar-valid (round-trip, not just pattern)
  const stamps = [
    ['invite validFrom', inv.validFrom], ['invite validUntil', inv.validUntil], ['invite proof.created', inv.proof.created],
    ['invite card proof.created', inv.credentialSubject.card.proof.created],
    ['invite document issuedAt', invDoc.issuedAt],
    ['accept issuedAt', accDoc.issuedAt], ['accept proof.created', accDoc.proof.created],
    ['accept card proof.created', acc.accept.card.proof.created],
    ['vouch(u) validFrom', D.vouch.u.validFrom], ['vouch(u) proof.created', D.vouch.u.proof.created],
    ['vouch(z) validFrom', D.vouch.z.validFrom], ['vouch(z) proof.created', D.vouch.z.proof.created],
  ]
  check(stamps.every(([, t]) => calOK(t)), 'every timestamp of the chain is calendar-valid (round-trip: ' + (stamps.find(([, t]) => !calOK(t))?.[0] ?? 'all pass') + ')')

  // ── checker self-tests: the round-7 counterexamples, preserved as
  // executable material — weakening any of these predicates fails HERE,
  // not silently against fixtures that never exercise the boundary ──
  // (1) signature canonicity: deterministic search for an Ed25519
  // signature whose canonical base58btc begins 'z1' (leading zero byte;
  // Ed25519 is deterministic, so this always finds the same one)
  {
    const seed = hkdf(IKM, 'rltp/vector/selftest-signer')
    const did = didOf(seed)
    let zsig = null, msg = null
    for (let i = 0; i < 4096 && !zsig; i++) {
      const m = Buffer.from('selftest-' + i, 'utf8')
      const sg = crypto.sign(null, m, privEd(seed))
      if (sg[0] === 0x00) { zsig = 'z' + b58(sg); msg = m }
    }
    check(zsig !== null && zsig.startsWith('z1'), 'self-test: found the deterministic leading-zero signature')
    check(verifyRaw(did, msg, zsig) === true, 'self-test: a canonical z1… signature VERIFIES (no over-rejection)')
    check(verifyRaw(did, msg, 'z' + zsig.slice(2)) === false, 'self-test: stripping the canonical leading 1 (63 bytes) is REJECTED')
  }
  // (2) size predicate at the EXACT normative boundary: pad the shipped
  // document to precisely 16384 (last valid) and 16385 (first invalid)
  // bytes — a moved threshold in the SHARED predicate fails here
  const base = Buffer.byteLength(jcs({ ...invDoc, ceremony: { pad: '' } }), 'utf8')
  const at = (n) => ({ ...invDoc, ceremony: { pad: 'x'.repeat(n - base) } })
  check(Buffer.byteLength(jcs(at(16384)), 'utf8') === 16384 && sizeOK(at(16384)), 'self-test: exactly 16384 bytes is the last VALID size')
  check(Buffer.byteLength(jcs(at(16385)), 'utf8') === 16385 && !sizeOK(at(16385)), 'self-test: exactly 16385 bytes is the first INVALID size')
  // (3) document bindings: each mutation flips the SHARED predicate
  check(!bindOK({ ...invDoc, proof: {} }) && !bindOK({ ...invDoc, issuer: invDoc.recipient }) && !bindOK({ ...invDoc, recipient: invDoc.issuer }) && !bindOK({ ...invDoc, threadId: '00000000-0000-4000-8000-000000000000' }), 'self-test: proof/issuer/recipient/threadId mutations each fail the binding predicate')
  // (4) timestamp predicate boundaries
  check(calOK('2026-08-25T12:06:00.123Z') && !calOK('2026-08-25T12:06:00.1234Z') && !calOK('2026-02-30T12:00:00Z') && calOK('2028-02-29T12:00:00Z') && !calOK('2026-02-29T12:00:00Z'), 'self-test: fraction cap and calendar boundaries (three digits pass, four fail; leap day 2028 passes, 2026 fails)')

  // vouch: u and z variants, same binding over decoded bytes
  for (const [v, label] of [[D.vouch.u, 'vouch (u digests)'], [D.vouch.z, 'vouch (z digests)']]) {
    schemaOK(v, 'access-vouch.schema.json', label)
    check(diVerify(v, v.issuer).ok, `${label}: DI proof verifies`)
    check(jcs(v.proof['@context']) === jcs(v['@context']), `${label}: proof carries the @context copy`)
  }
  const eU = D.vouch.u.credentialSubject.endorsement, eZ = D.vouch.z.credentialSubject.endorsement
  check(toU(eZ.genesisDigest) === eU.genesisDigest && toU(eZ.accept) === eU.accept, 'both vouches bind the SAME group and accept (decoded-bytes equality)')
  check(eU.genesisDigest === uz.genesisDigest.u && eZ.genesisDigest === uz.genesisDigest.z, 'vouch genesis digests = the uz oracle (both renderings)')
  check(eU.accept === uz.acceptDigest.u && eZ.accept === uz.acceptDigest.z, 'vouch accept digests = the uz oracle (both renderings)')
  for (const v of [D.vouch.u, D.vouch.z]) {
    check(v.issuer === D.parties.inviterVoucher.anchor, 'vouch issuer = the voucher party')
    check(v.credentialSubject.id === D.parties.inviteeCandidate.anchor, 'vouch subject = the candidate party')
  }
  check(digestU(accDoc) === eU.accept && digestU(accDoc) === uz.acceptDigest.u, 'vouch accept digest = the DOCUMENT digest of the complete accept document (Access 4.3)')

  // genesis-to-bytes: canonical u enters info + AADs (Access 3.2), byte-identical from z
  const E = D.epochBytes
  const ck = Buffer.from(E.contentKeyHex, 'hex')
  check(E.epochSecretInfo === 'rltp/v1/epoch-secret/' + uz.genesisDigest.u, 'epoch-secret info uses canonical u')
  check(hkdf(ck, E.epochSecretInfo).toString('hex') === E.epochSubkeyHex, 'epoch subkey recomputes')
  check(hkdf(ck, 'rltp/v1/epoch-secret/' + toU(E.fromZ.carried)).toString('hex') === E.epochSubkeyHex, 'z-carried digest yields the SAME subkey after canonicalization')
  check(hkdf(ck, 'rltp/v1/epoch-secret/' + E.fromZ.carried).toString('hex') !== E.epochSubkeyHex, 'raw z bytes would diverge (the defect the rule closes)')
  check(jcs(E.keydistAad.object) === E.keydistAad.jcs && jcs(E.lineageAad.object) === E.lineageAad.jcs, 'both AAD serializations recompute')
  check(E.keydistAad.object.recipient === D.parties.inviteeCandidate.anchor && E.keydistAad.object.genesis === uz.genesisDigest.u && E.lineageAad.object.genesis === uz.genesisDigest.u, 'AAD objects are tied to the party and digest oracles')
  check(jcs({ ...E.keydistAad.object, genesis: toU(E.fromZ.carried) }) === E.keydistAad.jcs, 'keydist AAD from a z-carried digest is byte-identical after canonicalization')
  check(jcs({ ...E.lineageAad.object, genesis: toU(E.fromZ.carried) }) === E.lineageAad.jcs, 'lineage AAD from a z-carried digest is byte-identical after canonicalization')

  // negatives BOUND to their declared failure: (a) an error at the declared
  // path exists, (b) repairing exactly the declared defect yields ZERO
  // errors — the fixture is broken at that point and nowhere else
  const NEG = {
    'invite-two-contexts': { frag: '@context', repair: (a) => { a.invite['@context'] = inv['@context']; a.invite.proof['@context'] = inv['@context'] } },
    'invite-proof-without-context-copy': { frag: '.proof: missing required @context', repair: (a) => { a.invite.proof['@context'] = inv['@context'] } },
    'vouch-wrong-endorsement-type': { frag: 'endorsement.type', repair: (a) => { a.credentialSubject.endorsement.type = 'AdmissionVouch' } },
    'vouch-missing-accept': { frag: 'endorsement: missing required accept', repair: (a) => { a.credentialSubject.endorsement.accept = eU.accept } },
    'vouch-retyped-as-encounter': { frag: '$.type: contains unmatched', repair: (a) => { a.type = D.vouch.u.type } },
  }
  for (const n of D.negative) {
    const file = n.name.startsWith('invite') ? 'payload-membership-invite.schema.json' : 'access-vouch.schema.json'
    const sch = SCHEMAS[file]
    const spec = NEG[n.name]
    if (!spec) { err(`unknown negative ${n.name}`); continue }
    const errs = validate(n.artifact, sch, sch)
    check(errs.length > 0 && errs.some((e) => e.includes(spec.frag)), `${n.name}: fails AT the declared point (${spec.frag})`)
    const repaired = JSON.parse(JSON.stringify(n.artifact))
    spec.repair(repaired)
    check(validate(repaired, sch, sch).length === 0, `${n.name}: repairing exactly the declared defect makes it valid (broken nowhere else)`)
  }

  // pinned context: structural invariants of the JSON-LD repair (round 3/6 lessons)
  const CTX = J('contexts/rltp-v1.jsonld')['@context']
  for (const t of ['EncounterCredential', 'MembershipInvite', 'AdmissionVouch'])
    check(CTX[t]['@context']['@propagate'] === true, `context ${t}: @propagate true (type-scoped terms reach credentialSubject)`)
  check(CTX.EncounterCredential['@context'].challenge['@protected'] === false, 'context: challenge deliberately unprotected (DI proof scope may take over)')
  check(!('name' in CTX.MembershipInvite['@context']), 'context: name NOT redefined (inherited protected schema.org/name)')
  const card = CTX.MembershipInvite['@context'].card['@context']
  check(!!card.version && !!card.anchor && !!card.keyAgreement && !!card.challenge && !!card.proof, 'context: card sub-vocabulary complete')
  // the context is pinned BY VALUE (Encounter 2.3) — so is this check: any
  // semantic edit (a changed IRI, a dropped term) fails here and forces a
  // deliberate pin update alongside the edit
  check(digestU({ '@context': CTX }) === 'uEiAcUXifIYaRyCmLiB5Bt5OV0EMhRj07Xn3P5aJEgTmzGg', 'context file digest matches the pinned value (semantic corruption gate)')
}

// ── suite: acceptance-anchoring.json — generations, anchor, CAS ─────────
section('acceptance-anchoring.json — registration generations, acceptance anchor, CAS commit')
{
  const A = J('vectors/acceptance-anchoring.json')
  const regs = A.registrations
  const coreOf = (reg) => { const { sig, authorization, ...core } = reg; return digestU(core) }
  const idSigOK = (reg) => { const { sig, ...toSign } = reg; return verifyRaw(reg.identity, Buffer.from(jcs(toSign), 'utf8'), sig) }
  const quorumOK = (reg) => {
    if (!reg.authorization) return true
    const { sig, authorization, ...unsigned } = reg
    const bytes = Buffer.from(jcs(unsigned), 'utf8')
    return reg.authorization.every((a) => verifyRaw(a.signer, bytes, a.sig))
  }

  // artifacts: schema + core digest + identity signature + quorum
  for (const [name, reg] of Object.entries(regs)) {
    schemaOK(reg, 'access-registration.schema.json', `registration ${name}`)
    check(coreOf(reg) === A.intermediate.coreDigests[name], `registration ${name}: registrationCoreDigest reproduces`)
    check(idSigOK(reg), `registration ${name}: identity signature verifies over JCS minus sig`)
    check(quorumOK(reg), `registration ${name}: quorum signatures verify over the complete unsigned registration`)
  }
  check(coreOf(regs.gen2) !== coreOf(regs.gen2twin), 'equivocation twin: same generation, distinct core digests')

  // the two-way acceptance anchor: standing iff the root core lies on the
  // previousRegistration chain from the session-attested generation
  const byCore = Object.fromEntries(Object.values(regs).map((r) => [coreOf(r), r]))
  const anchorVerdict = (rootCore, attestedCore) => {
    if (!attestedCore) return 'invalid-bundle'
    for (let c = attestedCore; c; c = byCore[c]?.previousRegistration ?? null) {
      if (c === rootCore) return 'standing'
      if (!byCore[c]) break
    }
    return 'invalid-bundle'
  }
  for (const c of A.anchorCases) {
    const root = A.intermediate.coreDigests[c.root]
    const attested = c.sessionAttested ? A.intermediate.coreDigests[c.sessionAttested] : null
    check(anchorVerdict(root, attested) === c.expect, `anchor: ${c.name} → ${c.expect}`)
    if (c.equivocationWith) {
      const twin = regs[c.equivocationWith], self = regs[c.root]
      check(self.registrationGeneration === twin.registrationGeneration && coreOf(self) !== coreOf(twin),
        `anchor: ${c.name} — equivocation evidence (one generation, two cores) detectable from the artifacts alone`)
    }
    if (c.extraArtifact === 'selfAcceptance') {
      const { sig, ...body } = A.selfAcceptance
      const selfSigned = verifyRaw('did:key:' + regs[c.root].attestationKey, Buffer.from(jcs(body), 'utf8'), sig)
      check(selfSigned, `anchor: ${c.name} — the self-signed artifact VERIFIES yet confers nothing (void by construction)`)
    }
  }

  // the CAS acceptance commit: expected-old re-checked inside the commit
  for (const c of A.casCases) {
    let state = { core: A.intermediate.coreDigests[c.state], generation: regs[c.state].registrationGeneration, status: 'active' }
    let durable = { ...state }
    const outcomes = []
    for (const [op, arg] of c.schedule) {
      if (op === 'precheck') {
        const cand = regs[arg]
        outcomes.push(cand.registrationGeneration === state.generation + 1 && cand.previousRegistration === state.core && state.status === 'active' ? 'ok' : 'refused-expected-old')
      } else if (op === 'commit') {
        const cand = regs[arg]
        if (cand.registrationGeneration === state.generation + 1 && cand.previousRegistration === state.core && state.status === 'active') {
          state = { core: coreOf(cand), generation: cand.registrationGeneration, status: 'active' }
          durable = { ...state } // one durable commit: tombstone + chain state together
          outcomes.push('accepted')
        } else outcomes.push('refused-expected-old')
      } else if (op === 'crash') { state = null; outcomes.push('crashed') }
      else if (op === 'recover') { state = { ...durable }; outcomes.push('recovered') }
    }
    const finalCore = A.intermediate.coreDigests[c.expect.finalState]
    check(jcs(outcomes) === jcs(c.expect.outcomes) && (state ?? durable).core === finalCore,
      `CAS: ${c.name} → [${c.expect.outcomes.join(', ')}], final ${c.expect.finalState}`)
  }

  // negatives — every mutation must fail at its declared stage
  for (const n of A.negative) {
    const doc = structuredClone(regs[n.registration])
    for (const [k, v] of Object.entries(n.set ?? {})) doc[k] = v
    for (const k of n.del ?? []) delete doc[k]
    if (n.mustFail === 'schema') schemaFails(doc, 'access-registration.schema.json', `negative: ${n.name}`)
    else if (n.mustFail === 'quorum-signature') check(!quorumOK(doc), `negative: ${n.name}`)
    else if (n.mustFail === 'identity-signature') check(!idSigOK(doc), `negative: ${n.name}`)
  }
}

// ── result ───────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`)
if (fail) { console.error('conformance: FAILED'); process.exit(1) }
console.log('conformance: all vector claims reproduce.')
