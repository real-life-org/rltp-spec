// Graph simulator — browser core (WebCrypto). DOM-free, node-testable.
// Mirrors the decisions of design/graph-simulator-design-2026-08.md and the
// archived node probe (simulator/archive/graph.mjs), but issues credentials via crypto.subtle so the UI
// (graph.html) runs real cryptography in the browser.
//
// There are no "levels" anymore: the old anchor-policy ladder (pairwise /
// +groups / +personal communities) is resolved by deferred disclosure —
// every ceremony is pairwise, and what used to be "level 3" is now a
// per-relationship property: the promotion state. Cameras (omniscient /
// outside / person) remain the epistemic axis.
//
// DEFERRED ANCHOR DISCLOSURE (probe for the visibility layer):
//   The ceremony is pairwise-only: both parties derive a relationship
//   anchor pair/<binding> from their roots (register-friendly, replayable)
//   and issue the encounter credentials under those — and NOTHING else:
//   no self-signed artifact exists at ceremony time (review-2 B1). The
//   stable self anchor travels later, per relationship, one-sidedly, as
//   a DESIGNATED-VERIFIER mapping (3DH-MAC, see makeMapping) delivered
//   by the trust act; the recipient verifies before accepting.
//
// Review-1 invariants (design/graph-simulator-review1-2026-08.md):
//   - deterministic replay: all encounter entropy is caller-suppliable
//   - published documents are append-only (membership docs, tag artifacts,
//     personas): turning something off stops future publication only —
//     and a delivered self anchor is irreversible knowledge
//   - viewers hold artifacts: names/colors are local contact memory taken
//     at encounter time; shared stars exist only as DELIVERED snapshots
//   - verification is strict: proof schema, issuer binding, and all
//     normative claims are checked, binding recomputed from the
//     credential-embedded challenges

const te = new TextEncoder()

// ── encoding ────────────────────────────────────────────────────────────
export const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const ALPH = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
export function base58(bytes) {
  let n = 0n
  for (const b of bytes) n = n * 256n + BigInt(b)
  let out = ''
  while (n > 0n) { out = ALPH[Number(n % 58n)] + out; n /= 58n }
  for (const b of bytes) { if (b === 0) out = '1' + out; else break }
  return out
}
export function fromBase58(s) {
  let n = 0n
  for (const c of s) {
    const i = ALPH.indexOf(c)
    if (i < 0) throw new Error('invalid base58')
    n = n * 58n + BigInt(i)
  }
  const out = []
  while (n > 0n) { out.unshift(Number(n % 256n)); n /= 256n }
  for (const c of s) { if (c === '1') out.unshift(0); else break }
  return new Uint8Array(out)
}
// JCS for the ASCII I-JSON subset this probe produces (sorted keys,
// undefined/non-finite rejected). NOT a full RFC 8785 validator — lone
// surrogates etc. are out of scope [probe boundary]; MAC inputs here are
// closed ASCII schemas only.
export const jcs = (o) => {
  if (o === undefined) throw new Error('jcs: undefined is not serializable')
  if (typeof o === 'number' && !Number.isFinite(o)) throw new Error('jcs: non-finite number')
  return Array.isArray(o) ? '[' + o.map(jcs).join(',') + ']'
    : (o && typeof o === 'object')
      ? '{' + Object.keys(o).sort().map((k) => {
        if (o[k] === undefined) throw new Error('jcs: undefined property ' + k)
        return JSON.stringify(k) + ':' + jcs(o[k])
      }).join(',') + '}'
      : JSON.stringify(o)
}
const sha = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(s)))
export async function digestMB(s) {
  const h = await sha(s)
  const mh = new Uint8Array(34); mh[0] = 0x12; mh[1] = 0x20; mh.set(h, 2)
  return 'u' + b64u(mh)
}
export async function hmac(keyStr, msgStr) {
  const k = await crypto.subtle.importKey('raw', te.encode(keyStr), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64u(await crypto.subtle.sign('HMAC', k, te.encode(msgStr)))
}
export const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
const rand = (n) => crypto.getRandomValues(new Uint8Array(n))
export const freshChallenge = () => b64u(rand(17)).slice(0, 22)
export const bytesHex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
export const hexBytes = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)))

// ── keys ────────────────────────────────────────────────────────────────
const ED_PKCS8 = Uint8Array.from([0x30,0x2e,0x02,0x01,0x00,0x30,0x05,0x06,0x03,0x2b,0x65,0x70,0x04,0x22,0x04,0x20])
const cat = (a, b) => { const o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o }
const fromB64uStr = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

async function edFromSeed(seed) {
  const priv = await crypto.subtle.importKey('pkcs8', cat(ED_PKCS8, seed), { name: 'Ed25519' }, true, ['sign'])
  const jwk = await crypto.subtle.exportKey('jwk', priv)
  return { priv, pubRaw: fromB64uStr(jwk.x) }
}
const anchorOf = (pubRaw) => 'did:key:z' + base58(cat(Uint8Array.from([0xed, 0x01]), pubRaw))

async function hkdf(root, info) {
  const k = await crypto.subtle.importKey('raw', root, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: te.encode(info) }, k, 256))
}

// persona derived from the person's root (Decision 1).
// EVERY context derives through the ordinary rltp/anchor family (Identity
// 0.13 §5.1) — the S-DID cut removed the fused "self" context whose keys
// came zero-input from the historic recovery strings. The stable social
// anchor is now the COMMUNITY ANCHOR: an ordinary group context over the
// person's personal-community genesis digest (§6.1), derived exactly like
// conformance/runner.mjs suite 4 and simulator/visibility.mjs.
// pair/<binding> is the relationship anchor of deferred disclosure: the
// label is the ceremony's enactmentBinding, so it is recomputable from
// the held credentials (backup stays "root seed + register").
export const COMMUNITY_GENESIS = 'uEiDYLnFbXqm2cwuJWuk9yNzRmlzWDpCTH6yA_4aP_1z_RA'
export const communityLabel = (person) => `group/${person?.communityGenesis || COMMUNITY_GENESIS}`
export async function persona(person, label) {
  let p = person.personas.get(label)
  if (p) return p
  const seed = await hkdf(person.root, `rltp/anchor/ed/${label}`)
  const { priv, pubRaw } = await edFromSeed(seed)
  p = { label, owner: person.name, anchor: anchorOf(pubRaw), priv, pubRaw, seed }
  person.personas.set(label, p)
  return p
}
// the person's community anchor — the disclosure anchor of the visibility
// layer. The disclosure-map KEY stays spelled 'self', mirroring the frozen
// wire field name; the DERIVATION is an ordinary group context.
export const communityIdentity = (person) => persona(person, communityLabel(person))

// per-relationship X25519 chain (Identity §5.2 family: rltp/anchor/x/…):
// both sides derive their pair-context X key from their roots; the ECDH
// shared secret is the relationship key k — the blinding key of the star
// and the root of every deniable MAC on this relationship.
// X25519 runs entirely in WebCrypto (RFC 7748 vector asserted in tests).
const X_PKCS8 = Uint8Array.from([0x30,0x2e,0x02,0x01,0x00,0x30,0x05,0x06,0x03,0x2b,0x65,0x6e,0x04,0x22,0x04,0x20])
const pairXSeed = (person, bind) => hkdf(person.root, `rltp/anchor/x/pair/${bind}`)
async function xPrivOf(seed) {
  return crypto.subtle.importKey('pkcs8', cat(X_PKCS8, seed), { name: 'X25519' }, true, ['deriveBits'])
}
export async function xPubHexOf(seed) {
  const jwk = await crypto.subtle.exportKey('jwk', await xPrivOf(seed))
  return bytesHex(fromB64uStr(jwk.x))
}
export async function xSharedHex(seed, theirPubHex) {
  const pub = await crypto.subtle.importKey('raw', hexBytes(theirPubHex), { name: 'X25519' }, false, [])
  return bytesHex(new Uint8Array(await crypto.subtle.deriveBits({ name: 'X25519', public: pub }, await xPrivOf(seed), 256)))
}
export async function pairXPubHex(person, bind) { return xPubHexOf(await pairXSeed(person, bind)) }
// every ECDH output passes through HKDF with a purpose label (review-2
// m7: domain separation — star blinding and the two mapping MACs never
// share a key even though they share the same DH pair)
async function derivedKey(mySeed, theirXHex, label) {
  return bytesHex(await hkdf(hexBytes(await xSharedHex(mySeed, theirXHex)), label))
}
export async function relKey(person, bind, theirXHex, label) {
  return derivedKey(await pairXSeed(person, bind), theirXHex, label)
}
// the community anchor's X25519 half — the ordinary rltp/anchor/x family
// over the same group label (Identity 0.13 §5.1/§5.2), never the historic
// recovery string
const selfXSeed = (person) => hkdf(person.root, `rltp/anchor/x/${communityLabel(person)}`)
// the self card binds the two halves of ONE identity: self Ed anchor ↔
// self keyAgreement key. Its Ed signature is transferable — harmless: it
// links no context to another, it only makes the identity's own X key
// authentic (the substrate of deniable self-control proofs below).
export async function selfCard(person, when) {
  if (!person.selfCard) {
    const s = await communityIdentity(person)
    const body = { type: 'rltp-sim/self-card@0', self: s.anchor, keyAgreement: await xPubHexOf(await selfXSeed(person)) }
    person.selfCard = await diSign(s, body, iso(when))
  }
  return person.selfCard
}

// ── DataIntegrity eddsa-jcs-2022 ────────────────────────────────────────
// Proof config carries the document's @context (W3C vc-di-eddsa, create
// proof step 2) so context tampering breaks the signature.
async function diSign(p, body, created) {
  const cfg = {
    ...(body['@context'] !== undefined ? { '@context': body['@context'] } : {}),
    type: 'DataIntegrityProof', cryptosuite: 'eddsa-jcs-2022', created,
    verificationMethod: `${p.anchor}#${p.anchor.slice(8)}`, proofPurpose: 'assertionMethod',
  }
  const data = cat(await sha(jcs(cfg)), await sha(jcs(body)))
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, p.priv, data))
  return { ...body, proof: { ...cfg, proofValue: 'z' + base58(sig) } }
}
export async function diVerify(doc, expectedAnchor) {
  try {
    const { proof, ...body } = doc
    if (!proof || proof.type !== 'DataIntegrityProof') return false
    if (proof.cryptosuite !== 'eddsa-jcs-2022') return false
    if (proof.proofPurpose !== 'assertionMethod') return false
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(proof.created ?? '')) return false
    if (typeof proof.proofValue !== 'string' || proof.proofValue[0] !== 'z') return false
    if (proof.verificationMethod !== `${expectedAnchor}#${expectedAnchor.slice(8)}`) return false
    if (body['@context'] !== undefined && jcs(proof['@context']) !== jcs(body['@context'])) return false
    if (body.issuer !== undefined && body.issuer !== expectedAnchor) return false
    const mk = fromBase58(expectedAnchor.slice('did:key:z'.length))
    if (mk[0] !== 0xed || mk[1] !== 0x01 || mk.length !== 34) return false
    const sig = fromBase58(proof.proofValue.slice(1))
    if (sig.length !== 64) return false
    const pub = await crypto.subtle.importKey('raw', mk.slice(2), { name: 'Ed25519' }, false, ['verify'])
    const { proofValue, ...cfg } = proof
    const data = cat(await sha(jcs(cfg)), await sha(jcs(body)))
    return await crypto.subtle.verify({ name: 'Ed25519' }, pub, sig, data)
  } catch { return false }
}

// ── encounter credentials (Encounter 7, browser twin) ───────────────────
export const CEREMONY = 'encounter-scan@0.25'
export const CRED_FORMAT = 'rltp-encounter-credential/0.25'
export const binding = (ceremony, c1, c2) => digestMB(jcs({ ceremony, challenges: [c1, c2].sort() }))

async function issueCred(p, subjectAnchor, subjectChallenge, bind, when) {
  const body = {
    '@context': ['https://www.w3.org/ns/credentials/v2', 'https://firstperson.network/credentials/dtg/v1', 'https://real-life.org/rltp/v1'],
    type: ['VerifiableCredential', 'DTGCredential', 'RelationshipCredential', 'EncounterCredential'],
    issuer: p.anchor, validFrom: iso(when),
    credentialSubject: { id: subjectAnchor, format: CRED_FORMAT, ceremony: CEREMONY, challenge: subjectChallenge, enactmentBinding: bind },
  }
  return diSign(p, body, iso(when))
}

// ── world ───────────────────────────────────────────────────────────────
// the world holds PERSONS (each a bundle of held artifacts + local
// state), published spaces (groups/personas/tags) and a sequence
// counter. There is NO separate encounter registry: the god view is the
// SUPERPOSITION of the individual graphs (allEncounters).
export function createWorld() {
  return { persons: new Map(), groups: new Map(), personas: [], transport: [], seq: 0 }
}
// TRANSPORT LOG: every delivery and publication passes through here —
// what you see is what would be ON THE WIRE (in reality E2E-encrypted
// to the addressee; the simulator shows the plaintext as inspector).
// Deterministic: no timestamps, sequence order only.
function logPacket(world, from, to, kind, payload) {
  world.transport.push({ n: world.transport.length, from, to, kind, payload })
}
export async function addPerson(world, name, color, seed) {
  const person = {
    name, color, root: seed ?? rand(32), personas: new Map(),
    contacts: new Map(),      // counterpart PAIR anchor -> { name, color, selfAnchor,
                              //   mapping, disclosed: Map(label->anchor) }
                              // name+color are LOCAL CONTACT MEMORY taken at encounter
                              // time (F8); selfAnchor is null until the counterpart
                              // PROMOTES this relationship (deferred disclosure)
    friends: new Set(),       // contact KEYS (pair anchors) I promoted — my one-sided acts
    memberships: new Map(), mode: 'encountered',
    tags: new Set(),          // groupIds whose tag is CURRENTLY published (artifacts stay, F10)
    publishedTags: new Map(), // groupId -> tag value (for the wallet)
    starsReceived: new Map(), // from-self-anchor -> { edges: [peer self anchors] } — DELIVERED (F2)
  }
  world.persons.set(name, person)
  await communityIdentity(person) // exists from the start (it is the person, pre-any-group)
  return person
}

// the first contact entry matching a name — names are local contact
// memory, and the simulator keeps person names unique
export function contactKey(viewer, name) {
  for (const [k, e] of viewer.contacts) if (e.name === name) return k
  return null
}
export function contactEntry(viewer, name) {
  const k = contactKey(viewer, name)
  return k ? viewer.contacts.get(k) : null
}
function personByAnchor(world, anchor) {
  for (const p of world.persons.values())
    for (const q of p.personas.values()) if (q.anchor === anchor) return p
  return null
}
// star snapshot DELIVERY (F2) — BLINDED (audience principle, class D):
// the sender never forwards raw third-party anchors. Each held self
// anchor travels as HMAC(k, anchor) under the per-relationship key k
// (X25519 between the pair contexts). The recipient can test anchors
// they already legitimately hold ("common acquaintances") and nothing
// else; different recipients get incomparable lists (collusion breaks).
// The honest residual: a one-bit membership oracle over anchors the
// recipient holds or will ever hold. Count still leaks (list length).
// EPOCHAL blinding (review-2 M6, salt fixed in review 3): every delivery
// carries a salt = per-relationship MONOTONE sequence number (replayable
// from the action order, collision-free by construction — review-3 M2:
// String(when) could repeat and re-open longitudinal linking). Opaque
// entries are therefore UNLINKABLE across snapshots; the honest residual
// stays: anchors learned later can be tested against any KEPT snapshot —
// delivered knowledge is irreversible. Lists are SORTED so delivery
// order cannot leak encounter order.
async function deliverStar(world, from, to) {
  const entry = contactEntry(from, to.name)
  if (!entry) return
  entry.starSeq = (entry.starSeq ?? 0) + 1
  const salt = String(entry.starSeq)
  const k = await relKey(from, entry.bind, entry.theirX, 'rltp-sim/blind/star/' + salt)
  let count = 0
  const blinded = []
  for (const e of from.contacts.values()) {
    if (!e.selfAnchor) continue
    count++
    blinded.push(await hmac(k, e.selfAnchor))
  }
  blinded.sort()
  const snap = { salt, count, blinded }
  entry.sentStar = snap // sender-side journal: what I last delivered here
  logPacket(world, from.name, to.name, 'star (blinded)', snap)
  to.starsReceived.set((await communityIdentity(from)).anchor, snap)
}
// recipient side: recompute the delivery key and test one anchor
export async function starKey(viewer, senderName, salt) {
  const entry = contactEntry(viewer, senderName)
  return entry ? relKey(viewer, entry.bind, entry.theirX, 'rltp-sim/blind/star/' + salt) : null
}
export async function starMatch(viewer, senderName, snap, anchor) {
  const k = await starKey(viewer, senderName, snap.salt)
  return !!k && snap.blinded.includes(await hmac(k, anchor))
}
// NOTE (review 3): the graded star ladder (count/intersect/introduce)
// is a documented SPEC OPTION (visibility note §2), not simulated —
// Anton collapsed the UX to the one trust question, and an
// unauthenticated setGrade probe modeled the mechanism wrongly
// (review-3 B1). If it returns, the grade travels as an addressee-bound
// DV policy artifact with a monotone revision.

// one encounter — the ceremony is PAIRWISE ONLY. Both parties derive
// pair/<binding> anchors from their roots and issue the credentials under
// those; nothing correlatable leaves the dancefloor, and NO self-signed
// artifact is created (review-2 B1: the model says the ceremony does not
// produce it — so the simulator must not either).
// All entropy is in `ent` (generated here if absent) so replay from an
// action log reproduces byte-identical documents (F7).
async function materialize(a, b, when, [cA, cB]) {
  const bind = await binding(CEREMONY, cB, cA)
  return { a, b, challenges: { a: cA, b: cB }, bind,
    cred: await issueCred(a, b.anchor, cB, bind, when),
    counter: await issueCred(b, a.anchor, cA, bind, when + 8_000) }
}
// pair contact card: binds the pair anchor to its X25519 keyAgreement
// key, SIGNED under the pair anchor (review-2 M3: a raw X pub could be
// substituted — the card makes key substitution detectable)
async function pairCard(person, bind, when) {
  const p = await persona(person, `pair/${bind}`)
  const body = { type: 'rltp-sim/pair-card@0', anchor: p.anchor, keyAgreement: await pairXPubHex(person, bind) }
  return diSign(p, body, iso(when))
}
export async function verifyPairCard(card, pairAnchor) {
  return card?.type === 'rltp-sim/pair-card@0' && card.anchor === pairAnchor
    && typeof card.keyAgreement === 'string' && await diVerify(card, pairAnchor)
}
export async function encounter(world, A, B, when, ent) {
  // ONE relationship per pair (review-1 F14), enforced at the EMITTER:
  // UI paths guarded this, but chapter setups and log replay could slip
  // past and duplicate contact entries. A repeat encounter is a no-op.
  if (contactEntry(A, B.name) || contactEntry(B, A.name)) return null
  ent ??= { R: [freshChallenge(), freshChallenge()] }
  const bind = await binding(CEREMONY, ent.R[0], ent.R[1])
  const pA = await persona(A, `pair/${bind}`)
  const pB = await persona(B, `pair/${bind}`)
  const e = {
    id: `e${world.seq++}`, when, aName: A.name, bName: B.name, ent, bind,
    R: await materialize(pA, pB, when, ent.R),
  }
  // the ceremony also exchanges pair CONTACT CARDS (anchor ↔ keyAgreement,
  // signed under the pair anchor) — each side VERIFIES before storing
  const cardA = await pairCard(A, bind, when), cardB = await pairCard(B, bind, when)
  if (!(await verifyPairCard(cardB, pB.anchor)) || !(await verifyPairCard(cardA, pA.anchor)))
    throw new Error('ceremony aborted: pair card failed verification')
  // each side HOLDS the ceremony record (credentials + card) in its
  // contact entry — the entry IS the folded artifact state; nothing else
  // remembers this meeting
  A.contacts.set(pB.anchor, A.contacts.get(pB.anchor)
    ?? { name: B.name, color: B.color, bind, enc: e, theirX: cardB.keyAgreement, theirCard: cardB, selfAnchor: null, mapping: null, idShared: false, disclosed: new Map([['pair', pB.anchor]]), ctxMappings: new Map() })
  B.contacts.set(pA.anchor, B.contacts.get(pA.anchor)
    ?? { name: A.name, color: A.color, bind, enc: e, theirX: cardA.keyAgreement, theirCard: cardA, selfAnchor: null, mapping: null, idShared: false, disclosed: new Map([['pair', pA.anchor]]), ctxMappings: new Map() })
  logPacket(world, A.name, B.name, 'encounter-credential + pair-card', { credential: e.R.cred, card: cardA })
  logPacket(world, B.name, A.name, 'encounter-credential + pair-card', { credential: e.R.counter, card: cardB })
  await autoDisclose(world, A, B); await autoDisclose(world, B, A)
  // continuous star delivery to everyone who already receives my star (F2)
  for (const key of A.friends) { const f = personByAnchor(world, key); if (f) await deliverStar(world, A, f) }
  for (const key of B.friends) { const f = personByAnchor(world, key); if (f) await deliverStar(world, B, f) }
  return e
}

export async function createGroup(world, id, label) {
  const genesisDigest = await digestMB(jcs({ type: 'rltp-sim/group-genesis@0', id, label }))
  const g = { id, label, genesisDigest, roster: new Map(), tagArtifacts: [] } // group anchor -> { doc: latest, docs: [ALL issued — append-only] }
  world.groups.set(id, g)
  return g
}
export async function join(world, person, group, when, displayName) {
  // group labels carry the genesis DIGEST, never the display id (Identity §6.1)
  const p = await persona(person, `group/${group.genesisDigest}`)
  const body = { type: 'rltp-sim/membership@0', group: group.id, member: p.anchor, issuedAt: iso(when) }
  if (displayName) body.name = displayName
  const doc = await diSign(p, body, iso(when))
  logPacket(world, person.name, `group: ${group.label}`, 'membership@0 (publish)', doc)
  const entry = group.roster.get(p.anchor) ?? { docs: [] }
  entry.docs.push(doc); entry.doc = doc            // append-only history (F10)
  group.roster.set(p.anchor, entry)
  const m = person.memberships.get(group.id) ?? { label: `group/${group.genesisDigest}`, docs: [] }
  m.docs.push(doc); m.doc = doc
  person.memberships.set(group.id, m)
  for (const [, centry] of person.contacts) {
    const contact = world.persons.get(centry.name)
    if (contact) await autoDisclose(world, person, contact)
  }
  return doc
}
// once published, a named doc names the anchor forever (F10)
export const rosterName = (entry) => entry?.docs?.find((d) => d.name)?.name

// context mappings (group anchors) are class-V linkages too (review-2
// B2): each disclosed label→anchor travels as a DV artifact — a context
// card (context Ed anchor ↔ context X key, signed under the context
// anchor; self-internal, harmless) plus two purpose-separated MACs:
// mac1 under the relationship key (the ceremony channel), mac2 under
// ECDH(contextX_sender, pairX_recipient) (control of the context anchor —
// nobody can claim a foreign roster anchor). The recipient VERIFIES
// before storing; deniable throughout (the recipient could compute both
// MACs). Cards and mappings carry no timestamp — fully deterministic.
const ctxXSeed = (person, label) => hkdf(person.root, `rltp/anchor/x/${label}`)
async function ctxCard(person, label) {
  const p = await persona(person, label)
  const body = { type: 'rltp-sim/context-card@0', anchor: p.anchor, keyAgreement: await xPubHexOf(await ctxXSeed(person, label)) }
  return diSign(p, body, iso(0)) // fixed epoch: cards are timeless, replay-stable
}
export async function makeCtxMapping(person, entry, label) {
  const p = await persona(person, label)
  const myPair = await persona(person, `pair/${entry.bind}`)
  const card = await ctxCard(person, label)
  const body = { type: 'rltp-sim/context-mapping@0', label, anchor: p.anchor, pair: myPair.anchor, to: contactKey(person, entry.name) }
  const msg = jcs(body)
  return { body, card,
    mac1: await hmac(await relKey(person, entry.bind, entry.theirX, 'rltp-sim/mac/ctx1'), msg),
    mac2: await hmac(await derivedKey(await ctxXSeed(person, label), entry.theirX, 'rltp-sim/mac/ctx2'), msg) }
}
export async function verifyCtxMapping(recipient, m) {
  try {
    const b = m?.body
    if (!b || b.type !== 'rltp-sim/context-mapping@0') return false
    const entry = recipient.contacts.get(b.pair)
    if (!entry) return false
    if (b.to !== (await persona(recipient, `pair/${entry.bind}`)).anchor) return false
    const card = m.card
    if (card?.type !== 'rltp-sim/context-card@0' || card.anchor !== b.anchor) return false
    if (!(await diVerify(card, b.anchor))) return false
    const msg = jcs(b)
    if ((await hmac(await relKey(recipient, entry.bind, entry.theirX, 'rltp-sim/mac/ctx1'), msg)) !== m.mac1) return false
    if ((await hmac(await derivedKey(await pairXSeed(recipient, entry.bind), card.keyAgreement, 'rltp-sim/mac/ctx2'), msg)) !== m.mac2) return false
    return true
  } catch { return false }
}
export async function disclose(world, person, contact, labels) {
  const entry = contactEntry(contact, person.name) // recipient-side state
  const mine = contactEntry(person, contact.name)  // sender-side relationship
  if (!entry || !mine) return false
  for (const label of labels) {
    const p = person.personas.get(label)
    if (!p) continue
    const m = await makeCtxMapping(person, mine, label)
    if (!entry.ctxMappings.has(label)) logPacket(world, person.name, contact.name, 'context-mapping@0 (DV)', m)
    if (await verifyCtxMapping(contact, m)) {
      entry.disclosed.set(label, p.anchor)
      entry.ctxMappings.set(label, m)
      ;(mine.sentCtx ??= new Map()).set(label, m) // sender-side journal
    }
  }
  return true
}
async function autoDisclose(world, person, contact) {
  const allowed = person.mode === 'encountered' || person.friends.has(contactKey(person, contact.name))
  if (!allowed) return
  await disclose(world, person, contact, [...person.memberships.values()].map((m) => m.label))
}

// B' membership tags — EXECUTED (F11): tag = HMAC-SHA256(genesisDigest,
// self-anchor). Only digest-knowers (co-members) can recompute and thus
// recognize; the published artifact does not name the group. Artifacts are
// append-only: off stops publication, published tags stay recognizable.
// Under deferred disclosure a tag resolves ONLY against contacts who have
// promoted you — without their self anchor there is nothing to recompute.
// [probe boundary: membership behind a tag is not itself proven — a
// digest-knower could publish a tag without being a member.]
export async function setTag(world, person, groupId, on) {
  if (!on) { person.tags.delete(groupId); return } // artifacts stay — publish is forever
  const g = world.groups.get(groupId)
  if (!g) return
  person.tags.add(groupId)
  const anchor = (await communityIdentity(person)).anchor
  const tag = await hmac(g.genesisDigest, anchor)
  person.publishedTags.set(groupId, tag)
  // the tag lives in the GROUP's space, not the world (Anton's catch):
  // its resolution audience is co-members anyway — publishing wider only
  // leaked existence metadata to strangers
  if (!g.tagArtifacts.some((t) => t.anchor === anchor && t.tag === tag)) {
    logPacket(world, person.name, `group: ${g.label}`, 'membership-tag@0 (publish)', { anchor, tag })
    g.tagArtifacts.push({ type: 'rltp-sim/membership-tag@0', anchor, tag })
  }
}

// public persona (FPP: P-DID): a derived anchor whose audience is EVERYONE.
// Publishing is append-only — turning it off stops publishing, it does not
// unpublish: world.personas keeps every published profile forever.
export async function setPublic(world, person, displayName, when, on) {
  if (!on) { if (person.publicPersona) person.publicPersona.active = false; return }
  if (person.publicPersona?.name === displayName) { person.publicPersona.active = true; return }
  const p = await persona(person, `persona/${displayName}`)
  const body = { type: 'rltp-sim/persona-profile@0', name: displayName, anchor: p.anchor, issuedAt: iso(when) }
  const doc = await diSign(p, body, iso(when))
  person.publicPersona = { label: p.label, name: displayName, doc, active: true }
  logPacket(world, person.name, '🌐 world', 'persona-profile@0 (publish)', doc)
  world.personas.push({ owner: person.name, name: displayName, anchor: p.anchor, doc })
}

// the pair→self mapping — DESIGNATED VERIFIER via the 3DH/MAC pattern
// (audience principle, class V: linkages must never exist as
// transferable proof). 100% WebCrypto, the same construction Signal
// uses for deniable authentication:
//   card:  self Ed anchor ↔ self X key, Ed-signed (self-internal, §above)
//   mac1 = HMAC(k1, body), k1 = ECDH(pairX_sender, pairX_recipient)
//          — "the person from the ceremony says this"
//   mac2 = HMAC(k2, body), k2 = ECDH(selfX_sender, pairX_recipient)
//          — "the self identity consents": only the holder of the self X
//          key (or the recipient!) can compute k2, and the card binds
//          that X key to the claimed self anchor. Nobody can claim a
//          foreign self anchor: they cannot sign its card, and they
//          cannot compute its k2.
// The recipient verifies with their own secrets and is fully convinced
// (they know they computed neither MAC). Anyone else holds MACs that
// EITHER side could have computed — and cannot even check them without
// the recipient's private keys. A leaked mapping proves nothing.
async function mappingBody(pairAnchor, selfAnchor, toPairAnchor, when) {
  return { type: 'rltp-sim/anchor-mapping@2', pair: pairAnchor, self: selfAnchor, to: toPairAnchor, issuedAt: iso(when) }
}
export async function makeMapping(A, entry, toPairAnchor, when) {
  const pMine = await persona(A, `pair/${entry.bind}`)
  const card = await selfCard(A, when)
  const body = await mappingBody(pMine.anchor, (await communityIdentity(A)).anchor, toPairAnchor, when)
  const msg = jcs(body)
  return { body, card,
    mac1: await hmac(await relKey(A, entry.bind, entry.theirX, 'rltp-sim/mac/map1'), msg),
    mac2: await hmac(await derivedKey(await selfXSeed(A), entry.theirX, 'rltp-sim/mac/map2'), msg) }
}
// verification is recipient-private: it REQUIRES the recipient's secrets
// (that is the point — a third party cannot even check validity)
export async function verifyMapping(recipient, m) {
  try {
    const b = m?.body
    if (!b || b.type !== 'rltp-sim/anchor-mapping@2') return false
    const entry = recipient.contacts.get(b.pair)
    if (!entry) return false
    if (b.to !== (await persona(recipient, `pair/${entry.bind}`)).anchor) return false
    const card = m.card
    if (card?.type !== 'rltp-sim/self-card@0' || card.self !== b.self) return false
    if (!(await diVerify(card, b.self))) return false
    const msg = jcs(b)
    if ((await hmac(await relKey(recipient, entry.bind, entry.theirX, 'rltp-sim/mac/map1'), msg)) !== m.mac1) return false
    if ((await hmac(await derivedKey(await pairXSeed(recipient, entry.bind), card.keyAgreement, 'rltp-sim/mac/map2'), msg)) !== m.mac2) return false
    return true
  } catch { return false }
}
// the deniability demo: the RECIPIENT fabricates a mapping binding any
// pair anchor they know to any self whose card they hold — it verifies
// identically, which is exactly why a leaked mapping convinces nobody
export async function forgeMapping(forger, victimCard, pairAnchor, when) {
  const entry = forger.contacts.get(pairAnchor)
  const myPair = await persona(forger, `pair/${entry.bind}`)
  const body = await mappingBody(pairAnchor, victimCard.self, myPair.anchor, when)
  const msg = jcs(body)
  return { body, card: victimCard,
    mac1: await hmac(await relKey(forger, entry.bind, entry.theirX, 'rltp-sim/mac/map1'), msg),
    mac2: await hmac(await derivedKey(await pairXSeed(forger, entry.bind), victimCard.keyAgreement, 'rltp-sim/mac/map2'), msg) }
}

// ONE-SIDED trust (F9) = THE DISCLOSURE DECISION of deferred anchor
// disclosure. A's act promotes the pairwise relationship by delivering:
//   1. the cross-signed mapping pair→self (A's stable anchor, verifiable
//      against the ceremony credential B already holds),
//   2. A's group anchor mappings (per A's mode),
//   3. A's star snapshot.
// The recipient VERIFIES the mapping before accepting the linkage.
// Turning trust off stops FUTURE deliveries; everything delivered stays —
// including the stable anchor: promotion is irreversible knowledge.
export async function setTrust(world, A, B, on, when) {
  const key = contactKey(A, B.name)
  if (!key) return // no verified relationship — nothing to promote
  if (!on) { A.friends.delete(key); return } // pauses the SUBSCRIPTION only — the disclosure below is irreversible
  A.friends.add(key)
  const myEntry = A.contacts.get(key)
  if (myEntry) myEntry.idShared = true // my own record: I disclosed my stable ID here — a one-way door
  const e = myEntry.enc
  if (!e) return
  const t0 = when ?? e.when + 60_000
  const sMine = await communityIdentity(A)
  const mapping = await makeMapping(A, myEntry, key, t0)
  myEntry.sentMapping = mapping // sender-side journal: the one-way door I opened
  logPacket(world, A.name, B.name, 'anchor-mapping@2 (DV)', mapping)
  const entry = B.contacts.get(mapping.body.pair)
  if (entry && await verifyMapping(B, mapping)) {
    entry.selfAnchor = sMine.anchor
    entry.mapping = mapping
    entry.disclosed.set('self', sMine.anchor)
  }
  await autoDisclose(world, A, B)
  await deliverStar(world, A, B)
  // A's promotion changed B's HOLDINGS (B now holds A's self anchor), so
  // B's deliverable star grew — refresh it for everyone B already trusts.
  // Without this, stars freeze at toggle order (Anton's first-run finding).
  for (const key of B.friends) { const f = personByAnchor(world, key); if (f) await deliverStar(world, B, f) }
}
export async function promote(world, A, B, when) { // mutual = two one-sided acts
  await setTrust(world, A, B, true, when); await setTrust(world, B, A, true, when)
}

// ── viewer queries ──────────────────────────────────────────────────────
// what the viewer can LINK about others: contact clusters {name, anchors}
export function linkClusters(viewer) {
  const out = []
  for (const [key, entry] of viewer.contacts)
    out.push({ name: entry.name, color: entry.color, key, selfAnchor: entry.selfAnchor,
      mapping: entry.mapping, anchors: new Map(entry.disclosed) })
  return out
}
// groups whose roster the viewer knows (member-known state [probe])
export function knownGroups(viewer, world) {
  return [...world.groups.values()].filter((g) => viewer.memberships.has(g.id))
}
// shared groups via disclosed mapping OR via recomputed tag artifact (B').
// `key` is a contact key (pair anchor); a self anchor is accepted as a
// fallback lookup for promoted contacts.
export async function sharedGroups(viewer, key, world) {
  const entry = viewer.contacts.get(key)
    ?? [...viewer.contacts.values()].find((e) => e.selfAnchor === key)
  if (!entry) return []
  const out = []
  for (const g of knownGroups(viewer, world)) {
    const a = entry.disclosed.get(`group/${g.genesisDigest}`)
    if (a && g.roster.has(a)) { out.push(g.id); continue }
    if (!entry.selfAnchor) continue // tag path needs the promoted self anchor
    const expect = await hmac(g.genesisDigest, entry.selfAnchor)
    if (g.tagArtifacts.some((t) => t.anchor === entry.selfAnchor && t.tag === expect)) out.push(g.id)
  }
  return out
}
// the viewer's own encounters — read from the HELD contact entries
// (each entry carries its ceremony record), never from a world registry
export function ownEncounters(viewer) {
  return [...viewer.contacts.values()].map((c) => c.enc).filter(Boolean).sort((a, b) => a.when - b.when)
}
export function rosterNames(viewer) { // personal community = derived roster
  return [...new Set([...viewer.contacts.values()].map((c) => c.name))]
}
// GOD VIEW = SUPERPOSITION: the union of every person's held encounter
// records, deduplicated. There is no separate world truth.
export function allEncounters(world) {
  const seen = new Map()
  for (const p of world.persons.values())
    for (const c of p.contacts.values())
      if (c.enc && !seen.has(c.enc.id)) seen.set(c.enc.id, c.enc)
  return [...seen.values()].sort((a, b) => a.when - b.when)
}
// full verification of one materialization (F4): signatures, ALL normative
// claims, and the binding recomputed from the credential-embedded challenges
export async function verifyEncounter(e) {
  const m = e.R // the ceremony's ONLY materialization (pairwise)
  const okSigA = await diVerify(m.cred, m.a.anchor)
  const okSigB = await diVerify(m.counter, m.b.anchor)
  const cs = m.cred.credentialSubject ?? {}, xs = m.counter.credentialSubject ?? {}
  const okClaims =
    m.cred.issuer === m.a.anchor && cs.id === m.b.anchor &&
    m.counter.issuer === m.b.anchor && xs.id === m.a.anchor &&
    cs.ceremony === CEREMONY && xs.ceremony === CEREMONY &&
    cs.format === CRED_FORMAT && xs.format === CRED_FORMAT &&
    cs.challenge === m.challenges.b && xs.challenge === m.challenges.a
  let okBind = false
  try {
    okBind = (await binding(CEREMONY, cs.challenge, xs.challenge)) === m.bind
      && cs.enactmentBinding === m.bind && xs.enactmentBinding === m.bind
  } catch { okBind = false }
  const ok = okSigA && okSigB && okBind && okClaims
  return { okSigA, okSigB, okBind, okClaims, ok }
}
