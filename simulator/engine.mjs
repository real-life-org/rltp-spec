// RLTP protocol engine — the executable core of the simulator.
//
// Implements, faithfully to the published specs (Encounter 0.19, Delivery
// Contract 0.17): JCS, multihash digests (emit u, accept u/z), did:key and
// Multikey encoding, eddsa-jcs-2022 proofs, the enactment binding, the
// sealed envelope, contact cards (displayed/sent, with boundTo), the ONE
// ceremony encounter-scan with its connected and optical legs, the
// own-challenge state model (open/recorded/unknown) with the monotone
// aging latch and precedence resolution, the delivery task documents, the
// receiver's staged dispositions with resolution-selected effects,
// Encounter acceptance, and the per-anchor-pair edge state (merge rule).
//
// Node crypto only; the browser build swaps this provider for @noble/*.

import {
  generateKeyPairSync, createPrivateKey, createPublicKey, diffieHellman,
  hkdfSync, createCipheriv, createDecipheriv, createHash, randomBytes,
  sign as edSign, verify as edVerify,
} from 'node:crypto'

// ── encoding ────────────────────────────────────────────────────────────
export const b64u = (b) => Buffer.from(b).toString('base64url')
export const fromB64u = (s) => Buffer.from(s, 'base64url')
const ALPH = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
export function base58(buf) {
  let n = BigInt('0x' + (Buffer.from(buf).toString('hex') || '0'))
  let out = ''
  while (n > 0n) { out = ALPH[Number(n % 58n)] + out; n /= 58n }
  for (const b of buf) { if (b === 0) out = '1' + out; else break }
  return out
}
export const jcs = (o) => Array.isArray(o) ? '[' + o.map(jcs).join(',') + ']'
  : (o && typeof o === 'object') ? '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + jcs(o[k])).join(',') + '}'
  : JSON.stringify(o)

// multihash digest per Encounter 2.3: emit u(base64url) over 0x12 0x20 + sha256
export const digest = (input) => 'u' + b64u(Buffer.concat([
  Buffer.from([0x12, 0x20]),
  createHash('sha256').update(typeof input === 'string' ? Buffer.from(input, 'utf8') : input).digest(),
]))
export const docDigest = (doc) => digest(jcs(doc))

// ── identity (interim securing profile, Encounter 2.3) ──────────────────
const ED_SPKI = Buffer.from('302a300506032b6570032100', 'hex')
const X_SPKI = Buffer.from('302a300506032b656e032100', 'hex')
const rawPub = (pub, prefix) => pub.export({ format: 'der', type: 'spki' }).subarray(prefix.length)

export function createPerson(name) {
  const ed = generateKeyPairSync('ed25519')
  const x = generateKeyPairSync('x25519')
  const edRaw = rawPub(ed.publicKey, ED_SPKI)
  const xRaw = rawPub(x.publicKey, X_SPKI)
  const anchor = 'did:key:z' + base58(Buffer.concat([Buffer.from([0xed, 0x01]), edRaw]))
  const keyAgreement = 'z' + base58(Buffer.concat([Buffer.from([0xec, 0x01]), xRaw]))
  return {
    name, anchor, keyAgreement,
    keys: { ed, x, edRaw, xRaw },
    displayedChallenge: null,
    open: new Map(),           // ownChallenge value -> { issuedAt, aged } (state model 5.3; aged = the one-way latch)
    records: new Map(),        // ownChallenge -> enactment record
    edges: new Map(),          // counterpartyAnchor -> { issued:[], received:[] }  (merge rule: one edge per pair)
    effectCache: new Map(),    // docDigest -> { disposition, storedAck }
    senderStatus: new Map(),   // docDigest -> 'accepted' | 'delivered' | 'failed'
    log: [],
  }
}
const say = (p, msg) => { p.log.push(msg) }

// ── contact cards (Encounter 6, 5.3) ────────────────────────────────────
export function freshChallenge(now) {
  return { value: b64u(randomBytes(17)).slice(0, 22), issuedAt: iso(now) }
}
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')

export const CEREMONY = 'encounter-scan@0.19'
export const CARD_VERSION = 'rltp-card/0.19'
export const CRED_FORMAT = 'rltp-encounter-credential/0.19'

export function displayCard(p, now) {
  p.displayedChallenge = freshChallenge(now)
  // mandatory retention: rotation changes what is DISPLAYED, never what is retained
  p.open.set(p.displayedChallenge.value, { issuedAt: p.displayedChallenge.issuedAt, aged: false })
  return signCard(p, { version: CARD_VERSION, anchor: p.anchor, keyAgreement: p.keyAgreement, name: p.name, challenge: p.displayedChallenge })
}
export function sentCard(p, recipientAnchor, boundTo, now) {
  const challenge = freshChallenge(now)
  p.open.set(challenge.value, { issuedAt: challenge.issuedAt, aged: false })
  return { card: signCard(p, { version: CARD_VERSION, anchor: p.anchor, keyAgreement: p.keyAgreement, name: p.name, challenge, sentTo: recipientAnchor, boundTo }), challenge }
}

// ── challenge resolution (Encounter 5.3) — total, precedence, one write ─
// recorded > open > unknown; the aging latch is the one write resolution
// performs: monotone (set-only), so it is safe wherever the observation
// happens, and an aged value never resolves open again.
export function resolve(p, value, now) {
  const record = p.records.get(value)
  if (record) return { state: 'recorded', record }
  const o = p.open.get(value)
  if (o && !o.aged) {
    if (now > Date.parse(o.issuedAt) + PARAMS.challengeMaxAge + PARAMS.skew) { o.aged = true; return { state: 'unknown' } }
    return { state: 'open', issuedAt: o.issuedAt }
  }
  return { state: 'unknown' }
}

// ── eddsa-jcs-2022 (DI): sign sha256(jcs(proofCfg)) || sha256(jcs(doc)) ─
function diSign(p, doc, created) {
  const cfg = { type: 'DataIntegrityProof', cryptosuite: 'eddsa-jcs-2022', created, verificationMethod: `${p.anchor}#${p.anchor.slice(8)}`, proofPurpose: 'assertionMethod' }
  const data = Buffer.concat([sha(jcs(cfg)), sha(jcs(doc))])
  const sig = edSign(null, data, p.keys.ed.privateKey)
  return { ...cfg, proofValue: 'z' + base58(sig) }
}
const sha = (s) => createHash('sha256').update(s, 'utf8').digest()
export function diVerify(doc) {
  const { proof, ...body } = doc
  const anchor = proof.verificationMethod.split('#')[0]
  const mk = fromBase58(anchor.slice('did:key:z'.length))
  if (mk[0] !== 0xed || mk[1] !== 0x01 || mk.length !== 34) return false
  const pub = createPublicKey({ key: Buffer.concat([ED_SPKI, mk.subarray(2)]), format: 'der', type: 'spki' })
  const { proofValue, ...cfg } = proof
  const data = Buffer.concat([sha(jcs(cfg)), sha(jcs(body))])
  return edVerify(null, data, pub, fromBase58(proofValue.slice(1)))
}
export function fromBase58(s) {
  let n = 0n
  for (const c of s) n = n * 58n + BigInt(ALPH.indexOf(c))
  let hex = n.toString(16); if (hex.length % 2) hex = '0' + hex
  let buf = Buffer.from(hex, 'hex')
  let zeros = 0; for (const c of s) { if (c === '1') zeros++; else break }
  return Buffer.concat([Buffer.alloc(zeros), buf])
}
const signCard = (p, body) => ({ ...body, proof: diSign(p, body, body.challenge?.issuedAt ?? iso(Date.now())) })

// ── enactment binding (Encounter 5.4) ───────────────────────────────────
export const binding = (ceremony, c1, c2) => digest(jcs({ ceremony, challenges: [c1, c2].sort() }))

// ── encounter credential (Encounter 7) ──────────────────────────────────
export function issueCredential(p, subjectAnchor, ceremony, subjectChallenge, enactmentBinding, now) {
  const body = {
    '@context': ['https://www.w3.org/ns/credentials/v2', 'https://real-life.org/rltp/v1'],
    type: ['VerifiableCredential', 'EncounterCredential'],
    issuer: p.anchor,
    validFrom: iso(now),
    credentialSubject: { id: subjectAnchor, format: CRED_FORMAT, ceremony, challenge: subjectChallenge, enactmentBinding },
  }
  return { ...body, proof: diSign(p, body, iso(now)) }
}

// ── sealed envelope (Contract 5) ────────────────────────────────────────
export function seal(document, recipientKeyAgreement, recipientXPub) {
  const eph = generateKeyPairSync('x25519')
  const shared = diffieHellman({ privateKey: eph.privateKey, publicKey: recipientXPub })
  if (shared.every((b) => b === 0)) throw new Error('all-zero shared secret')
  const key = Buffer.from(hkdfSync('sha256', shared, Buffer.alloc(0), 'rltp/v1/seal', 32))
  const nonce = randomBytes(12)
  const plaintext = Buffer.from(jcs(document), 'utf8')
  if (plaintext.length > 65536) throw new Error('oversize')
  const c = createCipheriv('aes-256-gcm', key, nonce)
  const ct = Buffer.concat([c.update(plaintext), c.final(), c.getAuthTag()])
  return { rkid: recipientKeyAgreement, epk: b64u(rawPub(eph.publicKey, X_SPKI)), nonce: b64u(nonce), ciphertext: b64u(ct) }
}
export function unseal(env, p) {
  if (env.rkid !== p.keyAgreement) return { error: 'malformed (unknown rkid)' }
  const epk = createPublicKey({ key: Buffer.concat([X_SPKI, fromB64u(env.epk)]), format: 'der', type: 'spki' })
  const shared = diffieHellman({ privateKey: p.keys.x.privateKey, publicKey: epk })
  const key = Buffer.from(hkdfSync('sha256', shared, Buffer.alloc(0), 'rltp/v1/seal', 32))
  const raw = fromB64u(env.ciphertext)
  const d = createDecipheriv('aes-256-gcm', key, fromB64u(env.nonce))
  d.setAuthTag(raw.subarray(raw.length - 16))
  try { return { document: JSON.parse(Buffer.concat([d.update(raw.subarray(0, raw.length - 16)), d.final()]).toString('utf8')) } }
  catch { return { error: 'decryption-failed' } }
}

// ── delivery documents (Contract 3/4) ───────────────────────────────────
const uuid = () => { const b = randomBytes(16); b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80; const h = b.toString('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}` }

export function bundleDocument(p, card, credential, enactmentBinding, now) {
  return {
    id: uuid(), type: 'https://real-life.org/trust-tasks/encounter-bundle/0.1',
    issuer: p.anchor, recipient: credential.credentialSubject.id,
    threadId: uuid(), ceremony: { enactment: enactmentBinding, step: 'scan' },
    issuedAt: iso(now), payload: { card, credential },
  }
}
export function ackDocument(p, forDoc, now) {
  const body = {
    id: uuid(), type: 'https://real-life.org/trust-tasks/delivery-ack/0.1',
    issuer: p.anchor, recipient: forDoc.issuer, threadId: forDoc.threadId,
    issuedAt: iso(now), payload: { ref: docDigest(forDoc), meaning: 'received' },
  }
  return { ...body, proof: diSign(p, body, iso(now)) }
}
export function credentialDeliveryDocument(p, credential, threadId, step, now) {
  return {
    id: uuid(), type: 'https://real-life.org/trust-tasks/encounter-credential-delivery/0.1',
    issuer: p.anchor, recipient: credential.credentialSubject.id,
    threadId: threadId ?? uuid(), ceremony: { enactment: credential.credentialSubject.enactmentBinding, step },
    issuedAt: iso(now), payload: { credential },
  }
}

// ── time parameters (Encounter 9 / Contract 7) ──────────────────────────
export const PARAMS = { challengeMaxAge: 5 * 60_000, issuanceWindow: 24 * 3600_000, skew: 5 * 60_000, ackWait: 30_000 }

// ── receiver: staged dispositions (Contract 6.2) + Encounter gates ──────
export function receiveEnvelope(p, env, now) {
  const un = unseal(env, p)
  if (un.error) return dispose(p, null, `failed(${un.error})`)
  const doc = un.document
  const dd = docDigest(doc)
  if (p.effectCache.has(dd)) { // stage 4: duplicate-known, mandatory identical re-ack
    const prior = p.effectCache.get(dd)
    return { disposition: 'duplicate-known', ack: prior.storedAck ?? null, doc }
  }
  if (doc.recipient !== p.anchor) return dispose(p, doc, 'failed(wrong-recipient)')
  if (doc.type === 'https://real-life.org/trust-tasks/encounter-bundle/0.1') return receiveBundle(p, doc, dd, now)
  if (doc.type === 'https://real-life.org/trust-tasks/encounter-credential-delivery/0.1') return receiveCredentialDelivery(p, doc, dd, now)
  if (doc.type === 'https://real-life.org/trust-tasks/delivery-ack/0.1') return receiveAck(p, doc, now)
  return dispose(p, doc, 'failed(unknown-type)')
}
const dispose = (p, doc, disposition) => { say(p, `↳ ${disposition}`); return { disposition, doc } }

function receiveBundle(p, doc, dd, now) {
  const { card, credential } = doc.payload
  // Contract 4.1 outer/inner consistency + pre-lock checks — validate, then consume:
  if (!diVerify(card)) return dispose(p, doc, 'failed(validation-failed: card proof)')
  if (!diVerify(credential)) return dispose(p, doc, 'failed(validation-failed: credential proof)')
  if (doc.issuer !== card.anchor || doc.issuer !== credential.issuer) return dispose(p, doc, 'failed(validation-failed: issuer mismatch)')
  if (credential.credentialSubject.id !== p.anchor) return dispose(p, doc, 'failed(validation-failed: not about me)')
  if (card.sentTo !== p.anchor) return dispose(p, doc, 'failed(validation-failed: sentTo)')
  if (card.boundTo !== credential.credentialSubject.challenge) return dispose(p, doc, 'failed(validation-failed: boundTo mismatch)')
  if (credential.credentialSubject.ceremony !== CEREMONY) return dispose(p, doc, 'failed(validation-failed: ceremony label)')
  // pre-lock resolution (provisional; latches on observation) — the sim is
  // single-threaded, so the in-lock authoritative resolution coincides:
  const res = resolve(p, credential.credentialSubject.challenge, now)
  if (res.state === 'unknown')
    return dispose(p, doc, 'failed(validation-failed: challenge resolves unknown)')

  if (res.state === 'recorded') {
    // ── record-aware effect: the record decides ──
    const record = res.record
    if (record.counterparty !== doc.issuer) return dispose(p, doc, 'failed(consumed-challenge)')
    if (jcs(record.card) !== jcs(card)) return dispose(p, doc, 'failed(validation-failed: card differs from record)')
    const acc = tryAccept(p, credential, now) // full Encounter 5.6, incl. uniqueness
    if (acc !== 'accepted' && acc !== 'idempotent')
      return dispose(p, doc, acc === 'ERR_STALE_ISSUANCE' ? 'failed(stale-issuance)' : `failed(validation-failed: ${acc})`)
    const ack = ackDocument(p, doc, now)
    p.effectCache.set(dd, { disposition: 'unique', storedAck: ack })
    say(p, `bundle via record angenommen (record-aware, ${acc}), Ack eingereiht`)
    return { disposition: 'unique', ack, doc, record, via: 'record-aware' }
  }

  // ── record-creating effect (resolution: open) ──
  const t_ch = Date.parse(res.issuedAt)
  const expect = binding(CEREMONY, credential.credentialSubject.challenge, card.challenge.value)
  if (credential.credentialSubject.enactmentBinding !== expect) return dispose(p, doc, 'failed(validation-failed: binding)')
  if (doc.ceremony && doc.ceremony.enactment !== expect) return dispose(p, doc, 'failed(validation-failed: ceremony member lies)')
  const vf = Date.parse(credential.validFrom), pc = Date.parse(credential.proof.created)
  const lo = t_ch - PARAMS.skew, hi = t_ch + PARAMS.challengeMaxAge + PARAMS.issuanceWindow + PARAMS.skew
  if (vf < lo || vf > hi || pc < lo || pc > hi || pc < vf - PARAMS.skew) return dispose(p, doc, 'failed(stale-issuance)')
  if (t_ch > now + PARAMS.skew) return dispose(p, doc, 'failed(gate-future)') // expiry side is structural (resolution)
  const own = { value: credential.credentialSubject.challenge, issuedAt: res.issuedAt }
  const record = { ceremony: CEREMONY, counterparty: card.anchor, card, own, other: card.challenge, binding: expect, time: now }
  p.records.set(own.value, record)          // open → recorded: atomic supersession
  p.open.delete(own.value)
  if (p.displayedChallenge?.value === own.value) p.displayedChallenge = null
  acceptCredential(p, credential, record)   // pre-validated: cannot fail
  const ack = ackDocument(p, doc, now)
  p.effectCache.set(dd, { disposition: 'unique', storedAck: ack })
  say(p, `bundle von ${card.name ?? card.anchor.slice(0, 20)} aufgezeichnet, Ack eingereiht`)
  return { disposition: 'unique', ack, doc, record, via: 'record-creating' }
}

// ── the optical leg (Encounter 5.8): a ceremony-level input, never a
// delivery of the bundle. Carries the sent card only; boundTo selects the
// receiver's own challenge under the resolution rule. ──────────────────
export function opticalInput(p, card, now) {
  if (!diVerify(card)) return { outcome: 'refused', reason: 'card proof' }
  if (card.version !== CARD_VERSION) return { outcome: 'refused', reason: 'version' }
  if (card.sentTo !== p.anchor) return { outcome: 'refused', reason: 'sentTo' }
  if (!card.boundTo) return { outcome: 'refused', reason: 'boundTo missing' }
  const res = resolve(p, card.boundTo, now)
  if (res.state === 'unknown') { say(p, 'optischer Scan: gate-expired → frisches Enactment nötig'); return { outcome: 'gate-expired' } }
  if (res.state === 'recorded') {
    const r = res.record
    if (jcs(r.card) === jcs(card)) return { outcome: 'idempotent', record: r }
    if (r.counterparty !== card.anchor) return { outcome: 'refused', reason: 'challenge consumed by another enactment' }
    return { outcome: 'refused', reason: 'same counterparty, different material' }
  }
  const t_ch = Date.parse(res.issuedAt)
  if (t_ch > now + PARAMS.skew) return { outcome: 'gate-future' }
  const own = { value: card.boundTo, issuedAt: res.issuedAt }
  const record = { ceremony: CEREMONY, counterparty: card.anchor, card, own, other: card.challenge, binding: binding(CEREMONY, own.value, card.challenge.value), time: now }
  p.records.set(own.value, record)
  p.open.delete(own.value)
  if (p.displayedChallenge?.value === own.value) p.displayedChallenge = null
  say(p, `optischer Scan von ${card.name ?? card.anchor.slice(0, 20)}: Record erzeugt — Enactment komplett (outgoing at most)`)
  return { outcome: 'recorded', record }
}

function receiveCredentialDelivery(p, doc, dd, now) {
  if (doc.issuer !== doc.payload.credential.issuer) return dispose(p, doc, 'failed(validation-failed: issuer mismatch)')
  if (doc.payload.credential.credentialSubject.id !== p.anchor) return dispose(p, doc, 'failed(validation-failed: not about me)')
  const ack = ackDocument(p, doc, now)
  p.effectCache.set(dd, { disposition: 'unique', storedAck: ack })
  const result = tryAccept(p, doc.payload.credential, now)
  say(p, `credential-delivery gepuffert (${result}), Ack eingereiht`)
  return { disposition: 'unique', ack, doc, acceptance: result }
}

function receiveAck(p, doc, now) {
  if (!diVerify(doc)) return dispose(p, doc, 'failed(validation-failed: ack proof)')
  const st = p.senderStatus.get(doc.payload.ref)
  if (st === undefined) return dispose(p, doc, 'failed(validation-failed: unknown ref)')
  p.senderStatus.set(doc.payload.ref, 'delivered')
  // terminal document (Contract 4.2): cache entry, but NO ack-of-ack —
  // a stage-4 duplicate is duplicate-known with nothing to re-send
  p.effectCache.set(docDigest(doc), { disposition: 'unique', storedAck: null })
  say(p, `delivered ✓ (${st === 'failed' ? 'late ack, failed→delivered' : 'ack'})`)
  return { disposition: 'unique', doc }
}

// ── Encounter acceptance (5.6) ──────────────────────────────────────────
export function tryAccept(p, credential, now) {
  if (!diVerify(credential)) return 'ERR_SIG'
  if (credential.credentialSubject.id !== p.anchor) return 'ERR_ADDRESSEE'
  const record = p.records.get(credential.credentialSubject.challenge)
  if (!record) return 'ERR_NO_RECORD'
  if (record.counterparty !== credential.issuer) return 'ERR_NO_RECORD'
  if (credential.credentialSubject.ceremony !== record.ceremony) return 'ERR_CEREMONY'
  const t_ch = Date.parse(record.own.issuedAt)
  const vf = Date.parse(credential.validFrom), pc = Date.parse(credential.proof.created)
  const lo = t_ch - PARAMS.skew, hi = t_ch + PARAMS.challengeMaxAge + PARAMS.issuanceWindow + PARAMS.skew
  if (vf < lo || vf > hi || pc < lo || pc > hi || pc < vf - PARAMS.skew) return 'ERR_STALE_ISSUANCE'
  if (credential.credentialSubject.enactmentBinding !== record.binding) return 'ERR_BINDING'
  return acceptCredential(p, credential, record)
}
function acceptCredential(p, credential, record) {
  const edge = p.edges.get(record.counterparty) ?? { issued: [], received: [] }
  if (edge.received.some((c) => docDigest(c) === docDigest(credential))) return 'idempotent'
  edge.received.push(credential) // merge rule: one edge per anchor pair, however many enactments
  p.edges.set(record.counterparty, edge)
  return 'accepted'
}
export function noteIssued(p, counterpartyAnchor, credential) {
  const edge = p.edges.get(counterpartyAnchor) ?? { issued: [], received: [] }
  edge.issued.push(credential)
  p.edges.set(counterpartyAnchor, edge)
}
export const edgeState = (p, other) => {
  const e = p.edges.get(other)
  if (!e) return 'none'
  if (e.issued.length && e.received.length) return 'mutual'
  return e.issued.length ? 'outgoing' : 'incoming'
}
