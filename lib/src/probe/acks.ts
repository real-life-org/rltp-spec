// acks — the deniable delivery acknowledgement (Delivery 4.2/4.4, the
// acknowledgement class rule) for the probe world. The ack DOCUMENT is
// the real, registered wire form (`delivery-ack/0.1`), and the key
// regime is the normative one — byte-compatible with
// vectors/delivery-ack.json and lib/test/vectors4.test.mjs: one
// channel-keyed derivation for every DV-type ack, never the payload's
// internal MAC structure.
//
//   k = HKDF-SHA-256(ikm = X25519(pairX_issuer, pairX_recipient),
//                    salt = empty, info = "rltp/v1/delivery/mac/ack/"
//                    || issuerPairAnchor || "/" || recipientPairAnchor,
//                    32 bytes; all-zero shared secret rejected)
//   proof = { mac: HMAC-SHA-256 over JCS(document without proof) }
//
// Deniable by construction: either relationship party can compute the
// MAC — for DV payloads the ack is evidence to the sender alone, never
// an attestation toward anyone else (4.2).
import { jcs, makeValidator } from '../core.js'
import { SCHEMAS } from '../schemas.js'
import * as C from './deps.js'
import type { Person } from './deps.js'

const te = new TextEncoder()
const S = globalThis.crypto.subtle
export const ACK_TYPE = 'https://real-life.org/trust-tasks/delivery-ack/0.1'

const V = makeValidator(SCHEMAS)
const schemaOk = (file: string, data: any) => V.validate(data, SCHEMAS[file], SCHEMAS[file]).length === 0
const hmacU = async (key: Uint8Array, msg: string) => {
  const k = await S.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return 'u' + C.b64uOf(new Uint8Array(await S.sign('HMAC', k, te.encode(msg))))
}
const contactKeyOf = (p: Person, contact: any) => {
  for (const [k, c] of p.contacts) if (c === contact) return k
  return undefined
}

/** the channel ack key — Section 5's derivation discipline, 4.2's info */
export async function ackKey (ownCtx: any, counterpartKa: string, issuerAnchor: string, recipientAnchor: string) {
  const shared = await C.ecdh(ownCtx.x.priv, C.xRawOfMk(counterpartKa)!)
  if (shared.every((b: number) => b === 0)) throw new Error('all-zero X25519 output')
  return C.hkdf(shared, 'rltp/v1/delivery/mac/ack/' + issuerAnchor + '/' + recipientAnchor)
}

/**
 * Build the sealed deniable ack for a document received on `contact`'s
 * channel. `refDigest` is the acknowledged document's digest (the same
 * digest the completed-effect cache keys on); `threadId` is the acked
 * document's thread — the ack continues it (4.2).
 */
export async function buildAck (p: Person, contact: any, refDigest: string, threadId: string, when: number, ent: any = {}) {
  const own = contact.channel.own
  const doc = {
    id: ent.ackId ?? globalThis.crypto.randomUUID(),
    type: ACK_TYPE,
    issuer: own.anchor,                       // = the acked document's recipient (4.2)
    recipient: contactKeyOf(p, contact),
    threadId,
    issuedAt: C.iso(when),
    payload: { ref: refDigest, meaning: 'received' },
  }
  const k = await ackKey(own, contact.channel.counterpartKa, doc.issuer, doc.recipient!)
  const document = { ...doc, proof: { mac: await hmacU(k, jcs(doc)) } }
  return { to: contact, kind: 'delivery-ack/0.1 (deniabel, MAC unter dem Kanal-Ack-Key)', env: await C.seal(document, contact.channel.counterpartKa, ent) }
}

/**
 * Verify a received deniable ack (4.2 consistency): MAC-form proof only,
 * MAC under the arrival tuple's ack key, issuer = our counterpart on
 * that tuple, recipient = our own pair anchor. Returns { ref, threadId }
 * or null — the caller matches ref against what it actually sent.
 */
export async function verifyAck (p: Person, contact: any, doc: any): Promise<{ ref: string, threadId: string } | null> {
  try {
    if (doc?.type !== ACK_TYPE) return null
    // STUFENORDNUNG (Review 33, B-2): erst das DOKUMENTPROFIL + der
    // recipient (Stufe 5), dann das Payload-Schema (Stufe 7), dann die
    // Typ-Konsistenzregeln (Stufe 8), der MAC zuletzt
    // — Stufe 5: Dokument-Schema, geschlossene Form, Proof-Form,
    //   Kalender, recipient = eigener Anker
    if (!schemaOk('rltp-delivery-document.schema.json', doc)) return null
    if (!C.shaped(doc, { id: 'string', issuer: 'string', recipient: 'string', threadId: 'string', issuedAt: 'string', payload: 'object', proof: 'object' })) return null
    // geschlossene Form + das OPTIONALE ceremony-Feld (Review 19, B-2:
    // „ceremony — OPTIONAL, and entirely unconstrained"); der MAC läuft
    // über JCS(Dokument ohne proof) und deckt es mit ab
    if (Object.keys(doc).some((k) => !['id', 'type', 'issuer', 'recipient', 'threadId', 'issuedAt', 'payload', 'proof', 'ceremony'].includes(k))) return null
    if (Object.keys(doc.proof).length !== 1) return null
    // class rule: the MAC form and nothing else — a signature-form or
    // hybrid proof for a DV payload is invalid (4.2/4.4)
    if (typeof doc.proof.mac !== 'string' || doc.proof.proofValue !== undefined) return null
    if (!C.calOK(doc.issuedAt)) return null   // Kalender-Validität (Review 12, B-3)
    if (doc.recipient !== contact.channel.own.anchor) return null
    // — Stufe 7: Payload-Schema
    if (!schemaOk('payload-delivery-ack.schema.json', doc.payload)) return null
    // — Stufe 8: enactment-Profilregel (Review 20, B-2: ein Ack
    //   umschließt kein Bindungsmaterial), issuer-Bindung, meaning
    if (doc.ceremony?.enactment !== undefined) return null
    if (doc.issuer !== contactKeyOf(p, contact)) return null
    if (!C.shaped(doc.payload, { ref: 'string', meaning: 'string' }) || doc.payload.meaning !== 'received') return null
    const { proof, ...rest } = doc
    const k = await ackKey(contact.channel.own, contact.channel.counterpartKa, doc.issuer, doc.recipient)
    if ((await hmacU(k, jcs(rest))) !== proof.mac) return null
    return { ref: doc.payload.ref, threadId: doc.threadId }
  } catch { return null }
}
