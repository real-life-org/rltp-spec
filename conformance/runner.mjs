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
const selfEd = hkdf(IKM, 'wot/identity/ed25519/v1'), selfX = hkdf(IKM, 'wot/encryption/x25519/v1')
check(didOf(selfEd) === V.self.anchor && mkOf(selfX) === V.self.keyAgreement, 'self: derivation')
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

// ── result ───────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`)
if (fail) { console.error('conformance: FAILED'); process.exit(1) }
console.log('conformance: all vector claims reproduce.')
