// Graph simulator core — the R/M/personal-community probe on top of the
// real protocol engine. Design: design/graph-simulator-design-2026-08.md.
//
// Decision 1: context anchors derived from ONE root seed via HKDF.
// Decision 2: encounters ALWAYS run under the `self` anchors (the personal
//   community); group membership under derived group anchors; the linkage
//   between a person's anchors travels only by DISCLOSURE to contacts.
// Decision 3: the personal community is a derived roster (the engine's
//   edges map), no log — with the `self` anchor as its future identity.
//
// Membership documents here are light signed statements [probe], NOT the
// Access/Membership specs. Everything else (ceremony, credentials,
// envelopes) is the real engine.

import {
  createPublicKey, createPrivateKey, hkdfSync, createHash, sign as edSign,
} from 'node:crypto'
import {
  displayCard, sentCard, issueCredential, binding, bundleDocument,
  credentialDeliveryDocument, seal, receiveEnvelope, opticalInput,
  noteIssued, noteSent, edgeState, diVerify, jcs, base58, CEREMONY,
} from './engine.mjs'

// ── deterministic persona derivation (Decision 1) ───────────────────────
const ED_PKCS8 = Buffer.from('302e020100300506032b657004220420', 'hex')
const X_PKCS8 = Buffer.from('302e020100300506032b656e04220420', 'hex')
const ED_SPKI = Buffer.from('302a300506032b6570032100', 'hex')
const X_SPKI = Buffer.from('302a300506032b656e032100', 'hex')
const rawPub = (pub, prefix) => pub.export({ format: 'der', type: 'spki' }).subarray(prefix.length)

function deriveKeys(root, label) {
  const seed = (info) => Buffer.from(hkdfSync('sha256', root, Buffer.alloc(0), info, 32))
  const edPriv = createPrivateKey({ key: Buffer.concat([ED_PKCS8, seed(`rltp/anchor/ed/${label}`)]), format: 'der', type: 'pkcs8' })
  const xPriv = createPrivateKey({ key: Buffer.concat([X_PKCS8, seed(`rltp/anchor/x/${label}`)]), format: 'der', type: 'pkcs8' })
  return { ed: { privateKey: edPriv, publicKey: createPublicKey(edPriv) }, x: { privateKey: xPriv, publicKey: createPublicKey(xPriv) } }
}

// persona: engine-person-shaped, deterministically derived from the root
export function persona(person, label) {
  let p = person.personas.get(label)
  if (p) return p
  const keys = deriveKeys(person.root, label)
  const edRaw = rawPub(keys.ed.publicKey, ED_SPKI)
  const xRaw = rawPub(keys.x.publicKey, X_SPKI)
  p = {
    name: `${person.name}@${label}`,
    anchor: 'did:key:z' + base58(Buffer.concat([Buffer.from([0xed, 0x01]), edRaw])),
    keyAgreement: 'z' + base58(Buffer.concat([Buffer.from([0xec, 0x01]), xRaw])),
    keys: { ...keys, edRaw, xRaw },
    displayedChallenge: null,
    open: new Map(), records: new Map(), edges: new Map(),
    effectCache: new Map(), senderStatus: new Map(), buffered: [], log: [],
  }
  person.personas.set(label, p)
  return p
}

export function createRoot(name, seed) {
  return {
    name,
    root: seed, // 32 bytes — stands in for the BIP39 seed
    personas: new Map(),
    // contacts: keyed by counterparty SELF anchor.
    // { name, friend, disclosed: Map(label -> anchor) } — what THEY told me.
    contacts: new Map(),
    friends: new Set(),          // self anchors I promoted to the inner ring
    memberships: new Map(),      // groupId -> { label, doc }
    discloseMode: 'encountered', // 'encountered' | 'friends'  (the one knob)
  }
}
export const self = (person) => persona(person, 'self')

// ── the encounter: ALWAYS under self anchors (Decision 2.1) ─────────────
const xPub = (p) => createPublicKey({ key: Buffer.concat([X_SPKI, p.keys.xRaw]), format: 'der', type: 'spki' })

export function encounter(A, B, now) {
  const a = self(A), b = self(B)
  // full connected path, faithful to scenario.mjs: scan → bundle → ack → counter
  const displayed = displayCard(b, now)
  const s = sentCard(a, b.anchor, displayed.challenge.value, now)
  const bind = binding(CEREMONY, displayed.challenge.value, s.challenge.value)
  a.records.set(s.challenge.value, { ceremony: CEREMONY, counterparty: b.anchor, card: displayed, own: s.challenge, other: displayed.challenge, binding: bind, time: now })
  a.open.delete(s.challenge.value)
  const cred = issueCredential(a, b.anchor, CEREMONY, displayed.challenge.value, bind, now)
  const bundle = bundleDocument(a, s.card, cred, bind, now)
  noteIssued(a, b.anchor, cred); noteSent(a, bundle)
  const r = receiveEnvelope(b, seal(bundle, b.keyAgreement, xPub(b)), now + 3_000)
  receiveEnvelope(a, seal(r.ack, a.keyAgreement, xPub(a)), now + 5_000)
  const counter = issueCredential(b, a.anchor, CEREMONY, s.challenge.value, bind, now + 8_000)
  noteIssued(b, a.anchor, counter)
  receiveEnvelope(a, seal(credentialDeliveryDocument(b, counter, bundle.threadId, 'counter', now + 8_000), a.keyAgreement, xPub(a)), now + 10_000)
  // mutual edge → each enters the other's personal community (roster).
  // Contact entries hold what the other DISCLOSES — starting with `self`.
  A.contacts.set(b.anchor, A.contacts.get(b.anchor) ?? { name: B.name, disclosed: new Map([['self', b.anchor]]) })
  B.contacts.set(a.anchor, B.contacts.get(a.anchor) ?? { name: A.name, disclosed: new Map([['self', a.anchor]]) })
  // encountered mode: existing memberships are disclosed to the new contact
  autoDisclose(A, B); autoDisclose(B, A)
  return { cred, counter, bind }
}

export function makeFriends(A, B) {
  A.friends.add(self(B).anchor); B.friends.add(self(A).anchor)
  // promoting may unlock disclosure in friends mode
  autoDisclose(A, B); autoDisclose(B, A)
}

// ── groups: membership under derived anchors (Decision 2.2) ─────────────
export function createGroup(id) {
  return { id, roster: new Map() } // group anchor -> membership doc (member-known state [probe])
}

// probe signing (mirrors engine diSign, which is not exported)
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest()
function probeSign(p, body, created) {
  const cfg = { type: 'DataIntegrityProof', cryptosuite: 'eddsa-jcs-2022', created, verificationMethod: `${p.anchor}#${p.anchor.slice(8)}`, proofPurpose: 'assertionMethod' }
  const data = Buffer.concat([sha256(jcs(cfg)), sha256(jcs(body))])
  return { ...body, proof: { ...cfg, proofValue: 'z' + base58(edSign(null, data, p.keys.ed.privateKey)) } }
}

export function joinGroup(person, group, nowIso) {
  const label = `group/${group.id}`
  const p = persona(person, label)
  const body = { type: 'rltp-sim/membership@0', group: group.id, member: p.anchor, issuedAt: nowIso }
  const doc = probeSign(p, body, nowIso)
  group.roster.set(p.anchor, doc)
  person.memberships.set(group.id, { label, doc })
  // the knob (Decision 2.3): disclose the new anchor per mode
  for (const [selfAnchor] of person.contacts) {
    const contactPerson = registry.get(selfAnchor)
    if (contactPerson) autoDisclose(person, contactPerson)
  }
  return doc
}

// disclosure: person tells contact which anchors are theirs (the linkage)
export function disclose(person, contact, labels) {
  const entry = contact.contacts.get(self(person).anchor)
  if (!entry) return false // only contacts (people who met) receive mappings
  for (const label of labels) {
    const p = person.personas.get(label)
    if (p) entry.disclosed.set(label, p.anchor)
  }
  return true
}
function autoDisclose(person, contact) {
  const mode = person.discloseMode
  const allowed = mode === 'encountered' || person.friends.has(self(contact).anchor)
  if (!allowed) return
  disclose(person, contact, [...person.memberships.values()].map((m) => m.label))
}

// world registry so auto-disclosure can find contact persons (sim-only)
export const registry = new Map() // self anchor -> person
export function register(person) { registry.set(self(person).anchor, person) }

// ── viewer queries (what a graph can READ) ──────────────────────────────
// shared groups: viewer is a member (knows the roster [probe: member-known
// state]) AND the contact disclosed their anchor for that group.
export function sharedGroups(viewer, contactSelfAnchor, groups) {
  const entry = viewer.contacts.get(contactSelfAnchor)
  if (!entry) return []
  const out = []
  for (const g of groups) {
    if (!viewer.memberships.has(g.id)) continue
    const disclosedAnchor = entry.disclosed.get(`group/${g.id}`)
    if (disclosedAnchor && g.roster.has(disclosedAnchor)) out.push(g.id)
  }
  return out
}

// what can this viewer link about a target person? (Fremden-Test)
export function linkableAnchors(viewer, targetPerson) {
  const entry = viewer.contacts.get(self(targetPerson).anchor)
  return entry ? [...entry.disclosed.entries()] : []
}

// the personal community as derived roster (Decision 3): K = current edges
export function roster(person) {
  const s = self(person)
  return [...s.edges.keys()].filter((anchor) => {
    const st = edgeState(s, anchor)
    return st === 'mutual' || st === 'outgoing' || st === 'incoming'
  })
}

// verification: every edge credential is real — diVerify + recomputed binding
export function verifyEdgeCredentials(person) {
  const s = self(person)
  const results = []
  for (const [counterparty, edge] of s.edges) {
    for (const cred of [...(edge.issued ?? []), ...(edge.received ?? [])]) {
      const okSig = diVerify(cred, cred.issuer)
      const rec = [...s.records.values()].find((r) => r.binding === cred.credentialSubject.enactmentBinding)
      const okBind = rec
        ? binding(rec.ceremony, rec.own.value, rec.other.value) === cred.credentialSubject.enactmentBinding
        : false
      results.push({ counterparty, issuer: cred.issuer, okSig, okBind })
    }
  }
  return results
}
