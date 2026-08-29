// RLTP visibility layer — the executable relationship machinery on top of
// the ceremony engine. Implements, faithfully to Network Visibility 0.15:
//
//   6.4  relationships as holder-local chains of tuples, one active head,
//        the single chaining trigger, the generic revision rule
//   6a   continuity: the sequenced/padded/blinded probe over the SNAPSHOTTED
//        prior-candidate set (self-match excluded by construction), the
//        one-chooser machine (record side = lexicographically smaller new
//        pair anchor, choice frozen), alignment duty
//   6    anchor-mapping@2 (the Trust act: pair→self, double-DH MAC) and
//        self-card@1
//   5    the star (directional epochal blinding, count/blinded grades) and
//        grade-declaration@1
//
// The introduction act (§8) is Stage B2. Wiring into the ceremony flows is
// the driver's job (an app concern): after an enactment completes, the
// driver calls registerTuple() on each side.
import crypto from 'node:crypto'
import { jcs, digest, base58, fromBase58 } from './engine.mjs'

const hkdf = (ikm, info) => Buffer.from(crypto.hkdfSync('sha256', ikm, Buffer.alloc(0), Buffer.from(info, 'utf8'), 32))
const hmacU = (k, s) => 'u' + crypto.createHmac('sha256', k).update(Buffer.from(s, 'utf8')).digest('base64url')
const X_SPKI = Buffer.from('302a300506032b656e032100', 'hex')
const xPubOf = (mk) => crypto.createPublicKey({ key: Buffer.concat([X_SPKI, fromBase58(mk.slice(1)).subarray(2)]), format: 'der', type: 'spki' })
const ecdh = (xPriv, peerMk) => crypto.diffieHellman({ privateKey: xPriv, publicKey: xPubOf(peerMk) })
const relKey = (ownCtx, counterpartMk, info) => hkdf(ecdh(ownCtx.keys.x.privateKey, counterpartMk), info)

// ── community anchor (Identity 0.13 §5.1/§6.1, the S-DID cut) ───────────
// The disclosure anchor of the visibility layer is the person's COMMUNITY
// ANCHOR: an ORDINARY group-context derivation over their personal
// community's genesis digest — never the recovery context's fixed
// zero-input strings (`wot/identity/ed25519/v1` …), which carry no social
// surface. Same derivation as conformance/runner.mjs suite 4; the default
// genesis digest is the one from vectors/visibility.json (`self`), whose
// vector key name mirrors the frozen wire field spelling `self`.
export const COMMUNITY_GENESIS = 'uEiDYLnFbXqm2cwuJWuk9yNzRmlzWDpCTH6yA_4aP_1z_RA'
const ED_PKCS8 = Buffer.from('302e020100300506032b657004220420', 'hex')
const X_PKCS8 = Buffer.from('302e020100300506032b656e04220420', 'hex')
const priv = (seed, p8) => crypto.createPrivateKey({ key: Buffer.concat([p8, seed]), format: 'der', type: 'pkcs8' })
const rawPub = (k, len = 32) => { const s = crypto.createPublicKey(k).export({ format: 'der', type: 'spki' }); return s.subarray(s.length - len) }
export function communityIdentity (p) {
  if (p.__self) return p.__self
  const label = 'group/' + (p.communityGenesis || COMMUNITY_GENESIS)
  const edSeed = hkdf(p.rootIkm, 'rltp/anchor/ed/' + label)
  const xSeed = hkdf(p.rootIkm, 'rltp/anchor/x/' + label)
  const ed = priv(edSeed, ED_PKCS8), x = priv(xSeed, X_PKCS8)
  p.__self = {
    label,
    keys: { ed, x },
    anchor: 'did:key:z' + base58(Buffer.concat([Buffer.from([0xed, 1]), rawPub(ed)])),
    keyAgreement: 'z' + base58(Buffer.concat([Buffer.from([0xec, 1]), rawPub(x)])),
  }
  return p.__self
}

// ── relationships (6.4): holder-local chains, one active head ───────────
// registerTuple: called by the driver when an enactment completed on this
// side. Snapshots the prior-candidate set AT TUPLE CREATION (6a.2/6a.4):
// the active heads of all OTHER relationships — never the fresh tuple.
export function registerTuple (p, ownCtx, counterpartAnchor, counterpartMk, provenance = 'encounter') {
  p.relationships = p.relationships || []
  const snapshot = p.relationships
    .filter((r) => r.head)
    .map((r) => ({ rel: r, ownPriorAnchor: r.head.ownCtx.anchor, counterpartPriorAnchor: r.head.counterpartAnchor }))
  const tuple = { ownCtx, counterpartAnchor, counterpartMk, snapshot, probeSeq: 0, probeHighWater: 0 }
  const rel = { id: 'rel-' + (p.relationships.length + 1), tuples: [tuple], head: tuple, provenance, contMapState: new Map() }
  p.relationships.push(rel)
  return rel
}
export const isRecordSide = (tuple) => tuple.ownCtx.anchor < tuple.counterpartAnchor // byte order of did:key strings

// ── 6a.2 continuity-probe@1: sequenced, chunked (single chunk here — the
// sim stays under 256 relationships), padded, blinded ────────────────────
const probeKey = (senderCtx, senderAnchor, recipientAnchor, counterpartMk) =>
  hkdf(ecdh(senderCtx.keys.x.privateKey, counterpartMk), `rltp/visibility/blind/probe/${senderAnchor}/${recipientAnchor}`)
export function buildProbe (p, rel) {
  const t = rel.head
  t.probeSeq += 1 // fresh probe sequence per send, persisted before send
  const kp = probeKey(t.ownCtx, t.ownCtx.anchor, t.counterpartAnchor, t.counterpartMk)
  const entries = t.snapshot.map((s) => hmacU(kp, s.ownPriorAnchor)) // own anchors of the SNAPSHOT — the fresh tuple contributes nothing
  const pad = []
  while (entries.length + pad.length < 256) {
    const v = 'u' + crypto.randomBytes(32).toString('base64url').slice(0, 43)
    if (!entries.includes(v) && !pad.includes(v)) pad.push(v)
  }
  const blinded = [...entries, ...pad].sort()
  const body = { type: 'continuity-probe@1', probe: String(t.probeSeq), seq: '1', last: true, blinded }
  return { body, proof: { mac: hmacU(kp, jcs(body)) } }
}
// receiver: verify, then intersect with the OWN snapshot's counterpart anchors
export function receiveProbe (p, rel, probe) {
  const t = rel.head
  const kp = probeKey(t.ownCtx, t.counterpartAnchor, t.ownCtx.anchor, t.counterpartMk) // sender's direction: sender=counterpart
  if (Number(probe.body.probe) <= t.probeHighWater) return { error: 'probe not strictly greater' }
  if (probe.body.blinded.length !== 256 || new Set(probe.body.blinded).size !== 256) return { error: 'probe shape' }
  if (hmacU(kp, jcs(probe.body)) !== probe.proof.mac) return { error: 'probe mac' }
  t.probeHighWater = Number(probe.body.probe)
  const matches = t.snapshot.filter((s) => probe.body.blinded.includes(hmacU(kp, s.counterpartPriorAnchor)))
  return { matches } // zero matches = honestly a new contact
}

// ── 6a.4 continuity-mapping@1: one chooser, one final choice, one trigger ─
export function issueContinuityMapping (p, rel, chosen) {
  const t = rel.head
  const prior = chosen.rel.head // still the active head at enactment snapshot time
  const body = {
    type: 'continuity-mapping@1',
    prior: prior.ownCtx.anchor, next: t.ownCtx.anchor, to: t.counterpartAnchor,
    revision: '1', issuedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  }
  const mac1 = hmacU(relKey(prior.ownCtx, prior.counterpartMk, 'rltp/visibility/mac/cont1'), jcs(body))
  const mac2 = hmacU(relKey(t.ownCtx, t.counterpartMk, 'rltp/visibility/mac/cont2'), jcs(body))
  const mapping = { body, proof: { mac1, mac2 } }
  if (isRecordSide(t)) chainTuple(p, chosen.rel, rel) // the record side chains ATOMICALLY with issuing (6a.4 — the only trigger)
  return mapping
}
// chain append (6.4): fresh tuple joins the chosen relationship; the fresh
// single-tuple relationship dissolves; old head deactivates; per-tuple
// state starts fail-closed; provenance/evidence are chain facts.
function chainTuple (p, chosenRel, freshRel) {
  const fresh = freshRel.head
  chosenRel.tuples.push(fresh)
  chosenRel.head = fresh
  if (freshRel.provenance === 'encounter' && chosenRel.provenance === 'introduction') chosenRel.provenance = 'encounter' // 8.6: upgrade, never downward
  p.relationships = p.relationships.filter((r) => r !== freshRel)
}
// verification (6a.4, in order) — no probe-match precondition
export function receiveContinuityMapping (p, rel, mapping) {
  const t = rel.head
  const b = mapping.body
  if (b.type !== 'continuity-mapping@1') return { error: 'type' }                                   // 1
  if (b.to !== t.ownCtx.anchor) return { error: 'to != own new anchor' }                            // 2
  if (b.next !== t.counterpartAnchor) return { error: 'next != counterpart new anchor' }            // 3
  const cand = t.snapshot.find((s) => s.counterpartPriorAnchor === b.prior)                          // 4: prior ∈ snapshot
  if (!cand) return { error: 'prior not in the prior-candidate set' }
  const prior = cand.rel.tuples.find((x) => x.counterpartAnchor === b.prior) || cand.rel.head
  const mac1 = hmacU(relKey(prior.ownCtx, prior.counterpartMk, 'rltp/visibility/mac/cont1'), jcs(b)) // 5
  const mac2 = hmacU(relKey(t.ownCtx, t.counterpartMk, 'rltp/visibility/mac/cont2'), jcs(b))
  if (mac1 !== mapping.proof.mac1 || mac2 !== mapping.proof.mac2) return { error: 'mac' }
  // 6: generic revision rule with the record-freeze (6.4) — scope (next, to) per sender
  const scope = b.next + '|' + b.to
  const held = rel.contMapState.get(scope)
  const fromRecordSide = b.next < b.to // the SENDER's new anchor is b.next
  if (held) {
    if (fromRecordSide && held.prior !== b.prior) return { error: 'record-side equivocation (frozen choice)' }
    if (held.revision === b.revision && jcs(held.body) === jcs(b)) return { idempotent: true }
    if (held.revision === b.revision) return { error: 'equivocation' }
    if (Number(b.revision) < Number(held.revision)) return { error: 'lower revision' }
  }
  rel.contMapState.set(scope, { prior: b.prior, revision: b.revision, body: b })
  if (fromRecordSide) {
    // the non-record side chains ONLY here (the single trigger), then owes alignment
    chainTuple(p, cand.rel, rel)
    const alignBody = {
      type: 'continuity-mapping@1',
      prior: prior.ownCtx.anchor, next: t.ownCtx.anchor, to: t.counterpartAnchor,
      revision: '1', issuedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    }
    const alignment = { body: alignBody, proof: {
      mac1: hmacU(relKey(prior.ownCtx, prior.counterpartMk, 'rltp/visibility/mac/cont1'), jcs(alignBody)),
      mac2: hmacU(relKey(t.ownCtx, t.counterpartMk, 'rltp/visibility/mac/cont2'), jcs(alignBody)),
    } }
    return { chained: cand.rel, alignment }
  }
  return { matchReport: true } // a mapping FROM the non-record side never chains (6a.4)
}

// ── 6 anchor-mapping@2 — the Trust act (pair→self, double-DH, DV) ────────
export function selfCard (p) {
  const self = communityIdentity(p)
  const body = { type: 'self-card@1', anchor: self.anchor, keyAgreement: self.keyAgreement }
  const sig = crypto.sign(null, Buffer.from(jcs(body), 'utf8'), self.keys.ed)
  return { body, proof: { proofValue: 'z' + base58(sig) } }
}
export function issueAnchorMapping (p, rel) {
  const self = communityIdentity(p)
  const t = rel.head
  const body = {
    type: 'anchor-mapping@2', pair: t.ownCtx.anchor, self: self.anchor, to: t.counterpartAnchor,
    card: selfCard(p), revision: '1', issuedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  }
  const mac1 = hmacU(relKey(t.ownCtx, t.counterpartMk, 'rltp/visibility/mac/map1'), jcs(body))
  const mac2 = hmacU(hkdf(ecdh(self.keys.x, t.counterpartMk), 'rltp/visibility/mac/map2'), jcs(body))
  rel.disclosedSelf = true
  return { body, proof: { mac1, mac2 } }
}
// 6.3 — the closed condition list, in order
export function receiveAnchorMapping (p, rel, m) {
  const t = rel.head
  const b = m.body
  if (b.type !== 'anchor-mapping@2') return { error: 'type' }                                       // 1
  if (b.to !== t.ownCtx.anchor) return { error: 'to != own active pair anchor' }                    // 2
  if (b.pair !== t.counterpartAnchor) return { error: 'pair != counterpart anchor' }                // 3
  const cb = b.card.body
  const pub = crypto.createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), fromBase58(cb.anchor.slice('did:key:z'.length)).subarray(2)]), format: 'der', type: 'spki' })
  const sig = fromBase58(b.card.proof.proofValue.slice(1))
  if (sig.length !== 64) return { error: 'card proof' } // exactly 64 bytes, no padding repair (Encounter 2.3)
  if (!crypto.verify(null, Buffer.from(jcs(cb), 'utf8'), pub, sig)) return { error: 'card proof' }  // 4
  if (cb.anchor !== b.self) return { error: 'card.anchor != self' }                                 // 5
  const mac1 = hmacU(relKey(t.ownCtx, t.counterpartMk, 'rltp/visibility/mac/map1'), jcs(b))         // 6+7
  const mac2 = hmacU(hkdf(ecdh(t.ownCtx.keys.x.privateKey, cb.keyAgreement), 'rltp/visibility/mac/map2'), jcs(b))
  if (mac1 !== m.proof.mac1 || mac2 !== m.proof.mac2) return { error: 'mac' }
  rel.counterpartSelf = b.self                                                                       // holder-local: 6a.1 convergence net input
  // Community-anchor convergence net (6a.1 step 2): merge any other relationship whose
  // counterpart disclosed the same self — a holder-local act, no wire artifact
  const twin = p.relationships.find((r) => r !== rel && r.counterpartSelf === b.self)
  if (twin) { rel.tuples.push(...twin.tuples); p.relationships = p.relationships.filter((r) => r !== twin) }
  return { self: b.self }
}

// ── 5 the star + grade-declaration@1 ─────────────────────────────────────
export function issueGrade (p, rel, grade) { // the affected contact's DV choice toward the holder
  const t = rel.head
  const body = { type: 'grade-declaration@1', subject: t.ownCtx.anchor, holder: t.counterpartAnchor, grade, revision: String((rel.gradeRev = (rel.gradeRev || 0) + 1)), issuedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') }
  const k = hkdf(ecdh(t.ownCtx.keys.x.privateKey, t.counterpartMk), `rltp/visibility/mac/grade/${t.ownCtx.anchor}/${t.counterpartAnchor}`)
  return { body, proof: { mac: hmacU(k, jcs(body)) } }
}
export function receiveGrade (p, rel, g) {
  const t = rel.head
  const k = hkdf(ecdh(t.ownCtx.keys.x.privateKey, t.counterpartMk), `rltp/visibility/mac/grade/${t.counterpartAnchor}/${t.ownCtx.anchor}`)
  if (hmacU(k, jcs(g.body)) !== g.proof.mac) return { error: 'mac' } // fail-closed: effective grade stays count
  rel.effectiveGrade = g.body.grade
  return { grade: g.body.grade }
}
// star toward ONE recipient relationship: the deliverable set are the OTHER
// relationships under their effective grade; blinded entries carry the
// disclosed SELF anchors (K1: recognition granted, never roster adjacency)
export function buildStar (p, rel) {
  const t = rel.head
  t.starSalt = (t.starSalt || 0) + 1 // directional, strictly increasing, persisted before send
  const k = hkdf(ecdh(t.ownCtx.keys.x.privateKey, t.counterpartMk), `rltp/visibility/blind/star/${t.ownCtx.anchor}/${t.counterpartAnchor}/${t.starSalt}`)
  const deliverable = p.relationships.filter((r) => r !== rel && r.counterpartSelf)
  const blinded = deliverable.filter((r) => r.effectiveGrade === 'blinded').map((r) => hmacU(k, r.counterpartSelf)).sort()
  const body = { type: 'star@1', salt: String(t.starSalt), seq: '1', last: true, count: String(deliverable.length), blinded }
  return { body, proof: { mac: hmacU(k, jcs(body)) } }
}
export function receiveStar (p, rel, star) {
  const t = rel.head
  const k = hkdf(ecdh(t.ownCtx.keys.x.privateKey, t.counterpartMk), `rltp/visibility/blind/star/${t.counterpartAnchor}/${t.ownCtx.anchor}/${star.body.salt}`)
  if (Number(star.body.salt) <= (t.starHighWater || 0)) return { error: 'salt not strictly greater' }
  if (hmacU(k, jcs(star.body)) !== star.proof.mac) return { error: 'mac' }
  t.starHighWater = Number(star.body.salt)
  // intersection only: test the anchors this holder legitimately holds
  const held = p.relationships.map((r) => r.counterpartSelf).filter(Boolean).concat([communityIdentity(p).anchor])
  const hits = held.filter((a) => star.body.blinded.includes(hmacU(k, a)))
  return { count: Number(star.body.count), hits } // a hit proves shared HOLDING, never a relationship (5.2)
}
