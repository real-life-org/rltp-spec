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
    senderStatus: new Map(),   // docDigest -> { status, recipient, threadId } — what an ack must match
    buffered: [],              // credential-delivery effect: durable buffer, acceptance runs separately
    log: [],
  }
}
const say = (p, msg) => { p.log.push(msg) }
// sender-side bookkeeping: remember whom a document went to, so a later
// ack can be required to come exactly from that recipient (Contract 4.2)
export function noteSent(p, doc) {
  p.senderStatus.set(docDigest(doc), { status: 'accepted', recipient: doc.recipient, threadId: doc.threadId })
}

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
// The proof binds to the ANCHOR THE DOCUMENT CLAIMS (card.anchor,
// credential.issuer, ack.issuer) — never to whatever verificationMethod
// happens to name. Callers MUST pass that expected anchor.
export function diVerify(doc, expectedAnchor) {
  if (!expectedAnchor) return false
  const { proof, ...body } = doc
  if (!proof || !proof.proofValue || !proof.verificationMethod) return false
  if (proof.verificationMethod !== `${expectedAnchor}#${expectedAnchor.slice(8)}`) return false
  const mk = fromBase58(expectedAnchor.slice('did:key:z'.length))
  if (mk[0] !== 0xed || mk[1] !== 0x01 || mk.length !== 34) return false
  const pub = createPublicKey({ key: Buffer.concat([ED_SPKI, mk.subarray(2)]), format: 'der', type: 'spki' })
  const { proofValue, ...cfg } = proof
  const data = Buffer.concat([sha(jcs(cfg)), sha(jcs(body))])
  return edVerify(null, data, pub, fromBase58(proofValue.slice(1)))
}
// multihash comparison: emit u, accept u AND z (Encounter 2.3) — normalize
// both to bytes; unknown base or wrong multihash header compares unequal
export function sameDigest(a, b) {
  const norm = (s) => {
    if (typeof s !== 'string' || s.length < 2) return null
    const bytes = s[0] === 'u' ? fromB64u(s.slice(1)) : s[0] === 'z' ? fromBase58(s.slice(1)) : null
    if (!bytes || bytes.length !== 34 || bytes[0] !== 0x12 || bytes[1] !== 0x20) return null
    return bytes.toString('hex')
  }
  const na = norm(a), nb = norm(b)
  return na !== null && na === nb
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
  const nonce = fromB64u(env.nonce), epkRaw = fromB64u(env.epk), raw = fromB64u(env.ciphertext)
  if (nonce.length !== 12 || epkRaw.length !== 32 || raw.length < 16) return { error: 'malformed' }
  if (raw.length - 16 > 65536) return { error: 'oversize' }          // size bound BEFORE decryption
  const epk = createPublicKey({ key: Buffer.concat([X_SPKI, epkRaw]), format: 'der', type: 'spki' })
  const shared = diffieHellman({ privateKey: p.keys.x.privateKey, publicKey: epk })
  if (shared.every((b) => b === 0)) return { error: 'decryption-failed' } // receive-side all-zero check
  const key = Buffer.from(hkdfSync('sha256', shared, Buffer.alloc(0), 'rltp/v1/seal', 32))
  let plaintext
  try {
    const d = createDecipheriv('aes-256-gcm', key, nonce)
    d.setAuthTag(raw.subarray(raw.length - 16))
    plaintext = Buffer.concat([d.update(raw.subarray(0, raw.length - 16)), d.final()]).toString('utf8')
  } catch { return { error: 'decryption-failed' } }                  // tag/key failure
  try { return { document: JSON.parse(plaintext) } }
  catch { return { error: 'malformed' } }                            // parse failure is NOT a crypto failure
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
  // document profile (Contract 3): required members, no expiresAt, sane payload
  if (!doc || typeof doc !== 'object' || !doc.id || !doc.type || !doc.issuer || !doc.recipient
    || !doc.threadId || !doc.issuedAt || Number.isNaN(Date.parse(doc.issuedAt))
    || 'expiresAt' in doc || !doc.payload || typeof doc.payload !== 'object')
    return dispose(p, doc, 'failed(malformed)')
  if (doc.recipient !== p.anchor) return dispose(p, doc, 'failed(wrong-recipient)')
  if (doc.type === 'https://real-life.org/trust-tasks/encounter-bundle/0.1') {
    if (!doc.payload.card || !doc.payload.credential) return dispose(p, doc, 'failed(malformed)')
    return receiveBundle(p, doc, dd, now)
  }
  if (doc.type === 'https://real-life.org/trust-tasks/encounter-credential-delivery/0.1') {
    if (!doc.payload.credential) return dispose(p, doc, 'failed(malformed)')
    return receiveCredentialDelivery(p, doc, dd, now)
  }
  if (doc.type === 'https://real-life.org/trust-tasks/delivery-ack/0.1') {
    if (doc.payload.meaning !== 'received' || !doc.payload.ref) return dispose(p, doc, 'failed(malformed)')
    return receiveAck(p, doc, now)
  }
  return dispose(p, doc, 'failed(unknown-type)')
}
const dispose = (p, doc, disposition) => { say(p, `↳ ${disposition}`); return { disposition, doc } }

function receiveBundle(p, doc, dd, now) {
  const { card, credential } = doc.payload
  // Contract 4.1 outer/inner consistency + pre-lock checks — validate, then consume:
  if (!diVerify(card, card.anchor)) return dispose(p, doc, 'failed(validation-failed: card proof)')
  if (!diVerify(credential, credential.issuer)) return dispose(p, doc, 'failed(validation-failed: credential proof)')
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
  if (!diVerify(card, card.anchor)) return { outcome: 'refused', reason: 'card proof' }
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
  const cred = doc.payload.credential
  // stage 8 here is schema + outer/inner consistency ONLY — the delivery
  // effect (durable buffer + ack) must not depend on credential acceptance
  if (doc.issuer !== cred.issuer) return dispose(p, doc, 'failed(validation-failed: issuer mismatch)')
  if (cred.credentialSubject?.id !== p.anchor) return dispose(p, doc, 'failed(validation-failed: not about me)')
  if (doc.ceremony && doc.ceremony.enactment && doc.ceremony.enactment !== cred.credentialSubject.enactmentBinding)
    return dispose(p, doc, 'failed(validation-failed: ceremony member lies)')
  p.buffered.push(cred)                       // the delivery effect: durable buffer
  const ack = ackDocument(p, doc, now)
  p.effectCache.set(dd, { disposition: 'unique', storedAck: ack })
  const result = tryAccept(p, cred, now)      // Encounter 5.6 runs separately, never signalled back
  say(p, `credential-delivery gepuffert (Acceptance separat: ${result}), Ack eingereiht`)
  return { disposition: 'unique', ack, doc, acceptance: result }
}

function receiveAck(p, doc, now) {
  if (!diVerify(doc, doc.issuer)) return dispose(p, doc, 'failed(validation-failed: ack proof)')
  // accept u AND z refs: compare multihashes semantically, not as strings
  let key, entry
  for (const [k, v] of p.senderStatus) { if (sameDigest(k, doc.payload.ref)) { key = k; entry = v; break } }
  if (!entry) return dispose(p, doc, 'failed(validation-failed: unknown ref)')
  // an ack is an attestation OF THE RECIPIENT: issuer must be exactly the
  // anchor the referenced document was sent to, on the same thread
  if (doc.issuer !== entry.recipient) return dispose(p, doc, 'failed(validation-failed: ack issuer is not the recipient)')
  if (doc.recipient !== p.anchor || doc.threadId !== entry.threadId) return dispose(p, doc, 'failed(validation-failed: ack outer mismatch)')
  entry.status = 'delivered'
  p.senderStatus.set(key, entry)
  // terminal document (Contract 4.2): cache entry, but NO ack-of-ack —
  // a stage-4 duplicate is duplicate-known with nothing to re-send
  p.effectCache.set(docDigest(doc), { disposition: 'unique', storedAck: null })
  say(p, 'delivered ✓ (authenticated ack from the recipient)')
  return { disposition: 'unique', doc }
}

// ── Encounter acceptance (5.6) ──────────────────────────────────────────
export function tryAccept(p, credential, now) {
  if (credential.credentialSubject?.format !== CRED_FORMAT) return 'ERR_VERSION'
  if (!diVerify(credential, credential.issuer)) return 'ERR_SIG'
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
  const dd = docDigest(credential)
  const sameEnactment = edge.received.filter((c) => c.credentialSubject.enactmentBinding === record.binding)
  if (sameEnactment.some((c) => docDigest(c) === dd)) return 'idempotent'
  // Encounter 5.6 step 8: one credential per record and direction — any
  // DIFFERENT credential for the same enactment is a conflict, not a second accept
  if (sameEnactment.length) return 'ERR_CONFLICT'
  edge.received.push(credential) // merge rule: one edge per anchor pair, however many enactments
  p.edges.set(record.counterparty, edge)
  return 'accepted'
}
export function noteIssued(p, counterpartyAnchor, credential) {
  const edge = p.edges.get(counterpartyAnchor) ?? { issued: [], received: [] }
  edge.issued.push(credential)
  p.edges.set(counterpartyAnchor, edge)
}
// mutual is a property of ONE enactment (Encounter 4.2): both directions
// must exist under the SAME enactment binding — two independent one-sided
// enactments still merge into one edge, but never into "mutual"
export const edgeState = (p, other) => {
  const e = p.edges.get(other)
  if (!e) return 'none'
  const mutual = e.issued.some((i) => e.received.some((r) =>
    r.credentialSubject.enactmentBinding === i.credentialSubject.enactmentBinding))
  if (mutual) return 'mutual'
  if (e.issued.length) return 'outgoing'
  return e.received.length ? 'incoming' : 'none'
}
