#!/usr/bin/env node
// IUT bridge: the SIMULATOR is the implementation under test. Its engine
// runs a complete connected enactment live; every artifact it emits is then
// judged by the same conformance checks the vector runner uses — shipped
// schemas, W3C-true DI verification, binding recomputation, fresh-always
// anchor discipline. Stage-A acceptance of the simulator's 0.24 upgrade.
//
//   usage: node conformance/iut-simulator.mjs
import { SCHEMAS, validate, diVerify, digestU, jcs, hmacU, hkdf, verifyRaw, fromB58, XS, pubFromRaw } from './lib.mjs'
import crypto from 'node:crypto'
import * as V from '../simulator/visibility.mjs'
import {
  createPerson, displayCard, sentCard, issueCredential, binding, bundleDocument,
  credentialDeliveryDocument, seal, receiveEnvelope, noteIssued, noteSent,
  docDigest, CEREMONY, CARD_VERSION, CRED_FORMAT, xPubOfMk,
} from '../simulator/engine.mjs'

let pass = 0, fail = 0
const check = (c, m) => { if (c) { pass++; console.log(`  ok    ${m}`) } else { fail++; console.error(`  FAIL  ${m}`) } }
const schemaOK = (data, file, label) => {
  const s = SCHEMAS[file]; const errs = validate(data, s, s)
  check(errs.length === 0, `${label} valid against ${file}${errs.length ? ' — ' + errs[0] : ''}`)
}
const section = (t) => console.log(`\n── ${t}`)

let now = Date.parse('2026-08-25T10:00:00Z')
const anna = createPerson('Anna'), ben = createPerson('Ben')

section('live enactment (simulator engine, connected path)')
const displayed = displayCard(ben, now)
const s = sentCard(anna, displayed.anchor, displayed.challenge.value, now)
const bind = binding(CEREMONY, displayed.challenge.value, s.challenge.value)
anna.records.set(s.challenge.value, { ceremony: CEREMONY, counterparty: displayed.anchor, card: displayed, own: s.challenge, ownCtx: s.ctx, other: displayed.challenge, binding: bind, time: now })
anna.open.delete(s.challenge.value)
const cred = issueCredential(s.ctx, displayed.anchor, CEREMONY, displayed.challenge.value, bind, now)
const bundle = bundleDocument(anna, s.card, cred, bind, now)
noteIssued(anna, displayed.anchor, cred); noteSent(anna, bundle)
const rb = receiveEnvelope(ben, seal(bundle, displayed.keyAgreement, xPubOfMk(displayed.keyAgreement)), now + 3000)
check(rb.disposition === 'unique', 'bundle accepted at the recipient (record-creating)')
const counter = issueCredential(rb.record.ownCtx, s.ctx.anchor, CEREMONY, s.challenge.value, bind, now + 60_000)
const cdd = credentialDeliveryDocument(ben, counter, bundle.threadId, 'counter', now + 60_000)
const ra = receiveEnvelope(anna, seal(cdd, s.card.keyAgreement, xPubOfMk(s.card.keyAgreement)), now + 63_000)
check(ra.acceptance === 'accepted', 'counter-credential accepted at the scanner')

section('emitted artifacts against the shipped 0.25 schemas')
check(CEREMONY === 'encounter-scan@0.25' && CARD_VERSION === 'rltp-card/0.25' && CRED_FORMAT === 'rltp-encounter-credential/0.25', 'generation strings are the 0.25 wire (DTG adoption)')
schemaOK(displayed, 'contact-card-0.25.schema.json', 'displayed card')
schemaOK(s.card, 'contact-card-0.25.schema.json', 'sent card')
schemaOK(cred, 'encounter-credential-0.25.schema.json', 'credential')
schemaOK(counter, 'encounter-credential-0.25.schema.json', 'counter-credential')
schemaOK({ card: s.card, credential: cred }, 'payload-encounter-bundle.schema.json', 'bundle payload')
schemaOK({ credential: counter }, 'payload-encounter-credential-delivery.schema.json', 'credential-delivery payload')
schemaOK(rb.ack.payload, 'payload-delivery-ack.schema.json', 'ack payload')

section('negative reception: the engine REJECTS non-conformant credentials (5.6 step 1)')
{
  const { tryAccept } = await import('../simulator/engine.mjs')
  const retyped = { ...counter, type: ['VerifiableCredential', 'DTGCredential', 'EndorsementCredential', 'AdmissionVouch'] }
  check(tryAccept(anna, retyped, now + 70_000) === 'ERR_VERSION', 're-typed credential (vouch types) → ERR_VERSION at the schema gate')
  const { '@context': _, ...noCtx } = counter
  check(tryAccept(anna, noCtx, now + 70_000) === 'ERR_VERSION', 'credential without @context → ERR_VERSION at the schema gate')
  const cdd2 = credentialDeliveryDocument(ben, retyped, bundle.threadId, 'counter', now + 70_000)
  const rr = receiveEnvelope(anna, seal(cdd2, s.card.keyAgreement, xPubOfMk(s.card.keyAgreement)), now + 72_000)
  check(rr.disposition === 'failed(validation-failed: credential schema)', `full envelope path rejects the re-typed credential before any effect (${rr.disposition})`)
  const wrongRcpt = credentialDeliveryDocument(ben, counter, bundle.threadId, 'counter', now + 74_000)
  wrongRcpt.recipient = ben.contexts.keys().next().value // outer recipient ≠ credentialSubject.id
  const rw = receiveEnvelope(anna, seal(wrongRcpt, s.card.keyAgreement, xPubOfMk(s.card.keyAgreement)), now + 75_000)
  check(rw.disposition.startsWith('failed('), `outer recipient ≠ subject → rejected (${rw.disposition})`)
}

section('W3C-true DI verification of everything the simulator signed')
for (const [label, doc, anchor] of [
  ['displayed card', displayed, displayed.anchor],
  ['sent card', s.card, s.card.anchor],
  ['credential', cred, cred.issuer],
  ['counter-credential', counter, counter.issuer],
  ['delivery ack', rb.ack, rb.ack.issuer],
]) {
  const r = diVerify(doc, anchor)
  check(r.ok, `${label}: DI proof verifies (embedded proof only)`)
}
check(jcs(cred.proof['@context']) === jcs(cred['@context']), 'credential proof carries the W3C @context copy')
check(!('@context' in displayed.proof), 'card proof carries no @context (document has none)')

section('binding + fresh-always discipline')
check(digestU({ ceremony: CEREMONY, challenges: [displayed.challenge.value, s.challenge.value].sort() }) === cred.credentialSubject.enactmentBinding, 'enactmentBinding recomputes per Encounter 5.4')
check(cred.credentialSubject.id === displayed.anchor && counter.credentialSubject.id === s.ctx.anchor, 'credentials name exactly the two fresh pair anchors')
const displayed2 = displayCard(ben, now + 90_000)
const s2 = sentCard(anna, displayed2.anchor, displayed2.challenge.value, now + 90_000)
check(displayed2.anchor !== displayed.anchor && s2.ctx.anchor !== s.ctx.anchor, 'fresh-always: a second enactment mints four fresh anchors')
check(new Set([displayed.anchor, s.ctx.anchor, displayed2.anchor, s2.ctx.anchor]).size === 4, 'no anchor reuse across enactments')

section('Stage B: visibility artifacts emitted live (schemas + MACs)')
{
  const p1 = anna, p2 = ben
  // wire the completed enactment into the relationship layer (driver duty)
  const relA = V.registerTuple(p1, s.ctx, displayed.anchor, displayed.keyAgreement)
  const relB = V.registerTuple(p2, rb.record.ownCtx, s.card.anchor, s.card.keyAgreement)
  // second enactment + continuity
  const d2 = displayCard(p2, now + 120_000)
  const s2 = sentCard(p1, d2.anchor, d2.challenge.value, now + 120_000)
  const relA2 = V.registerTuple(p1, s2.ctx, d2.anchor, d2.keyAgreement)
  const relB2 = V.registerTuple(p2, p2.open.get(d2.challenge.value).ctx, s2.card.anchor, s2.card.keyAgreement)
  const probe = V.buildProbe(p1, relA2)
  schemaOK(probe, 'visibility-continuity-probe.schema.json', 'live probe')
  // independent k_p recomputation: ECDH of the fresh tuple's X keys
  const ecdhK = (xPrivKeyObj, mk) => crypto.diffieHellman({ privateKey: xPrivKeyObj, publicKey: pubFromRaw(fromB58(mk.slice(1)).subarray(2), XS) })
  // self-match exclusion, checked cryptographically: HMAC(k_p, own fresh anchor) must NOT be an entry
  const kp = hkdf(ecdhK(s2.ctx.keys.x.privateKey, d2.keyAgreement), `rltp/visibility/blind/probe/${s2.ctx.anchor}/${d2.anchor}`)
  check(!probe.body.blinded.includes(hmacU(kp, s2.ctx.anchor)), 'probe excludes the fresh tuple (self-match impossible by construction)')
  check(probe.body.blinded.includes(hmacU(kp, s.ctx.anchor)), 'probe carries the snapshotted prior head (HMAC recomputed)')
  const rp = V.receiveProbe(p2, relB2, probe)
  check(!rp.error && rp.matches.length === 1, 'receiver matches exactly the shared prior relationship')
  const rp2 = V.receiveProbe(p1, relA2, V.buildProbe(p2, relB2))
  check(!rp2.error && rp2.matches.length === 1, 'counter-probe matches too (both loss directions covered)')
  // the ONE chooser: the record side issues from ITS OWN matches (6a.4)
  const aRec = V.isRecordSide(relA2.head)
  let m, sender, receiver, nonRel
  if (aRec) { m = V.issueContinuityMapping(p1, relA2, rp2.matches[0]); sender = p1; receiver = p2; nonRel = relB2 }
  else { m = V.issueContinuityMapping(p2, relB2, rp.matches[0]); sender = p2; receiver = p1; nonRel = relA2 }
  schemaOK(m, 'visibility-continuity-mapping.schema.json', 'live continuity mapping')
  const rm = V.receiveContinuityMapping(receiver, nonRel, m)
  check(!!rm.chained, 'record-side mapping verifies and chains at the receiver')
  check(receiver.relationships.length === 1 && sender.relationships.length === 1, 'both sides hold ONE relationship after continuity')
  // trust act + star
  const relRcv = receiver.relationships[0], relSnd = sender.relationships[0]
  const am = V.issueAnchorMapping(sender, relSnd)
  schemaOK(am, 'visibility-anchor-mapping.schema.json', 'live anchor mapping')
  schemaOK(am.body.card, 'visibility-self-card.schema.json', 'live self card')
  check(verifyRaw(am.body.card.body.anchor, Buffer.from(jcs(am.body.card.body), 'utf8'), am.body.card.proof.proofValue), 'self card raw signature recomputes')
  const ram = V.receiveAnchorMapping(receiver, relRcv, am)
  check(!!ram.self, 'anchor mapping passes the closed 6.3 list at the receiver')
  const grade = V.issueGrade(sender, relSnd, 'blinded')
  schemaOK(grade, 'visibility-grade-declaration.schema.json', 'live grade declaration')
  const star = V.buildStar(sender, relSnd)
  schemaOK(star, 'visibility-star.schema.json', 'live star')
  // star MAC independently recomputed under the directional key
  const th = relSnd.head
  const kStar = hkdf(ecdhK(th.ownCtx.keys.x.privateKey, th.counterpartMk), `rltp/visibility/blind/star/${th.ownCtx.anchor}/${th.counterpartAnchor}/${star.body.salt}`)
  check(hmacU(kStar, jcs(star.body)) === star.proof.mac, 'star MAC recomputes under the directional key')
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) { console.error('IUT simulator: FAILED'); process.exit(1) }
console.log('IUT simulator: the engine emits conformant 0.25 artifacts.')
