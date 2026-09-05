// GENERATED from lib/dist by scripts/build-simulator-lib.mjs — DO NOT EDIT.
// Source of truth: lib/src/*.ts. CI enforces freshness (--check).
// acks — the delivery acknowledgement (Delivery 4.2/4.4, the
// acknowledgement CLASS rule) for the probe world. The ack DOCUMENT is
// the real, registered wire form (`delivery-ack/0.1`) in the form the
// acknowledged payload's class selects: a SIGNED ack (eddsa-jcs-2022
// under the issuer anchor) for signature-class payloads (the Encounter
// forms), the DENIABLE MAC ack for designated-verifier payloads (the
// Visibility forms). The MAC key regime is the normative one —
// byte-compatible with vectors/delivery-ack.json and
// lib/test/vectors4.test.mjs: one channel-keyed derivation for every
// DV-type ack, never the payload's internal MAC structure.
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
import { jcs, makeValidator } from '../core.js';
import { SCHEMAS } from '../schemas.js';
import * as C from './deps.js';
const te = new TextEncoder();
const S = globalThis.crypto.subtle;
export const ACK_TYPE = 'https://real-life.org/trust-tasks/delivery-ack/0.1';
const V = makeValidator(SCHEMAS);
const schemaOk = (file, data) => V.validate(data, SCHEMAS[file], SCHEMAS[file]).length === 0;
const hmacU = async (key, msg) => {
    const k = await S.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return 'u' + C.b64uOf(new Uint8Array(await S.sign('HMAC', k, te.encode(msg))));
};
const contactKeyOf = (p, contact) => {
    for (const [k, c] of p.contacts)
        if (c === contact)
            return k;
    return undefined;
};
/** the channel ack key — Section 5's derivation discipline, 4.2's info */
export async function ackKey(ownCtx, counterpartKa, issuerAnchor, recipientAnchor) {
    const shared = await C.ecdh(ownCtx.x.priv, C.xRawOfMk(counterpartKa));
    if (shared.every((b) => b === 0))
        throw new Error('all-zero X25519 output');
    return C.hkdf(shared, 'rltp/v1/delivery/mac/ack/' + issuerAnchor + '/' + recipientAnchor);
}
/**
 * Build the sealed deniable ack for a document received on `contact`'s
 * channel. `refDigest` is the acknowledged document's digest (the same
 * digest the completed-effect cache keys on); `threadId` is the acked
 * document's thread — the ack continues it (4.2).
 */
export async function buildAck(p, contact, refDigest, threadId, when, ent = {}) {
    const own = contact.channel.own;
    const doc = {
        id: ent.ackId ?? globalThis.crypto.randomUUID(),
        type: ACK_TYPE,
        issuer: own.anchor, // = the acked document's recipient (4.2)
        // the recipient is the counterparty anchor; `ent.recipient` names it
        // when the tuple is not yet inserted (a record-creating effect builds
        // its ack BEFORE the one synchronous commit, Delivery 4.1)
        recipient: ent.recipient ?? contactKeyOf(p, contact),
        threadId,
        issuedAt: C.iso(when),
        payload: { ref: refDigest, meaning: 'received' },
    };
    // the acknowledgement CLASS rule (4.2/4.4): a payload whose authenticity
    // is a TRANSFERABLE SIGNATURE (the Encounter forms: card + credential
    // under DataIntegrityProof) is acknowledged with eddsa-jcs-2022 under
    // the ack's issuer anchor — an attestation; a DESIGNATED-VERIFIER
    // payload with the deniable channel-keyed MAC. `ent.cls` selects.
    if (ent.cls === 'signature') {
        const document = await C.diSign(own, doc, doc.issuedAt);
        return { to: contact, kind: 'delivery-ack/0.1 (signiert, eddsa-jcs-2022 unter dem Issuer-Anker)', env: await C.seal(document, contact.channel.counterpartKa, ent) };
    }
    const k = await ackKey(own, contact.channel.counterpartKa, doc.issuer, doc.recipient);
    const document = { ...doc, proof: { mac: await hmacU(k, jcs(doc)) } };
    return { to: contact, kind: 'delivery-ack/0.1 (deniabel, MAC unter dem Kanal-Ack-Key)', env: await C.seal(document, contact.channel.counterpartKa, ent) };
}
/**
 * Verify a received deniable ack (4.2 consistency): MAC-form proof only,
 * MAC under the arrival tuple's ack key, issuer = our counterpart on
 * that tuple, recipient = our own pair anchor. Returns { ref, threadId }
 * or null — the caller matches ref against what it actually sent.
 */
export async function verifyAck(p, contact, doc, cls = 'dv') {
    try {
        if (doc?.type !== ACK_TYPE)
            return null;
        // STUFENORDNUNG (Review 33, B-2): erst das DOKUMENTPROFIL + der
        // recipient (Stufe 5), dann das Payload-Schema (Stufe 7), dann die
        // Typ-Konsistenzregeln (Stufe 8), der MAC zuletzt
        // — Stufe 5: Dokument-Schema, geschlossene Form, Proof-Form,
        //   Kalender, recipient = eigener Anker
        if (!schemaOk('rltp-delivery-document.schema.json', doc))
            return null;
        if (!C.shaped(doc, { id: 'string', issuer: 'string', recipient: 'string', threadId: 'string', issuedAt: 'string', payload: 'object', proof: 'object' }))
            return null;
        // geschlossene Form + das OPTIONALE ceremony-Feld (Review 19, B-2:
        // „ceremony — OPTIONAL, and entirely unconstrained"); der MAC läuft
        // über JCS(Dokument ohne proof) und deckt es mit ab
        if (Object.keys(doc).some((k) => !['id', 'type', 'issuer', 'recipient', 'threadId', 'issuedAt', 'payload', 'proof', 'ceremony'].includes(k)))
            return null;
        // — Stufe 7 VOR Stufe 8: das Payload-Schema zuerst
        if (!schemaOk('payload-delivery-ack.schema.json', doc.payload))
            return null;
        // class rule (4.2/4.4, Stufe 8): EXACTLY the form the acknowledged
        // payload's class selects — signature-class payload → SIGNED ack,
        // designated-verifier payload → MAC ack. Every other combination
        // (MAC on a signature-class payload, signature on a DV payload, a
        // hybrid proof) is invalid
        if (cls === 'signature') {
            if (doc.proof.mac !== undefined || doc.proof.type !== 'DataIntegrityProof' || doc.proof.cryptosuite !== 'eddsa-jcs-2022')
                return null;
            if (!C.calOK(doc.proof.created))
                return null;
        }
        else {
            if (Object.keys(doc.proof).length !== 1)
                return null;
            if (typeof doc.proof.mac !== 'string' || doc.proof.proofValue !== undefined)
                return null;
        }
        if (!C.calOK(doc.issuedAt))
            return null; // Kalender-Validität (Review 12, B-3)
        if (doc.recipient !== contact.channel.own.anchor)
            return null;
        // — Stufe 8: enactment-Profilregel (Review 20, B-2: ein Ack
        //   umschließt kein Bindungsmaterial), issuer-Bindung, meaning
        if (doc.ceremony?.enactment !== undefined)
            return null;
        if (doc.issuer !== contactKeyOf(p, contact))
            return null;
        if (!C.shaped(doc.payload, { ref: 'string', meaning: 'string' }) || doc.payload.meaning !== 'received')
            return null;
        if (cls === 'signature') {
            // the attestation: verifies under the ack's issuer anchor (= the
            // acked document's recipient, our counterpart on the tuple)
            if (!(await C.diVerify(doc, doc.issuer)))
                return null;
            return { ref: doc.payload.ref, threadId: doc.threadId };
        }
        const { proof, ...rest } = doc;
        const k = await ackKey(contact.channel.own, contact.channel.counterpartKa, doc.issuer, doc.recipient);
        if ((await hmacU(k, jcs(rest))) !== proof.mac)
            return null;
        return { ref: doc.payload.ref, threadId: doc.threadId };
    }
    catch {
        return null;
    }
}
