#!/usr/bin/env node
// Generates vectors/delivery-ack.json — the executable vector for the
// deniable (MAC-form) delivery acknowledgement of the acknowledgement
// class rule (Delivery 4.2/4.4): ack key derivation, MAC preimage
// (JCS of the document WITHOUT `proof`), expected MAC, and the negative
// set review 12 demanded (tampered preimage, wrong direction, wrong
// key, missing proof). Deterministic: fixed seeds and nonces, no clock.
//
//   usage: node scripts/gen-delivery-ack-vector.mjs   (from repo root;
//          requires lib/dist — build the library first)
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const { pairContext } = await import(join(ROOT, 'lib/dist/identity.js'))
const { ecdh, hkdf, b64uOf, diSign } = await import(join(ROOT, 'lib/dist/crypto.js'))
const { jcs } = await import(join(ROOT, 'lib/dist/core.js'))

const fill = (n, v) => new Uint8Array(n).fill(v)
const A = await pairContext(fill(64, 7), fill(32, 3))   // ack issuer (the payload's recipient)
const B = await pairContext(fill(64, 9), fill(32, 5))   // ack recipient (the payload's sender)

const info = (from, to) => `rltp/v1/delivery/mac/ack/${from.anchor}/${to.anchor}`
const S = globalThis.crypto.subtle
const te = new TextEncoder()
const hmac = async (key, msg) => {
  const k = await S.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return 'u' + b64uOf(new Uint8Array(await S.sign('HMAC', k, te.encode(msg))))
}

// the ack document, proof-less form = the MAC preimage (4.2)
const doc = {
  id: '7b1c9c1e-4d5a-4a4a-9d5e-000000000001',
  type: 'https://real-life.org/trust-tasks/delivery-ack/0.1',
  issuer: A.anchor,
  recipient: B.anchor,
  threadId: '7b1c9c1e-4d5a-4a4a-9d5e-000000000002',
  issuedAt: '2026-08-31T12:00:00Z',
  payload: { ref: 'u' + 'EiAsRHapLbiwc6dHzsNFHzsBGvGzsBGvGzsBGvGzsBGvGz'.slice(0, 46), meaning: 'received' },
}
// well-formed multihash ref (sha2-256 of 32 fixed bytes) instead of the ad-hoc string
const { sha } = await import(join(ROOT, 'lib/dist/crypto.js'))
const cat2 = (a, b) => { const o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o }
doc.payload.ref = 'u' + b64uOf(cat2(Uint8Array.from([0x12, 0x20]), await sha(fill(32, 1))))

const sharedAB = await ecdh(A.x.priv, B.x.pubRaw)
const kAck = await hkdf(sharedAB, info(A, B), 32)
const preimage = jcs(doc)
const mac = await hmac(kAck, preimage)

// negatives
const tampered = { ...doc, issuedAt: '2026-08-31T12:00:01Z' }
const macTampered = await hmac(kAck, jcs(tampered))
const kWrongDirection = await hkdf(sharedAB, info(B, A), 32)
const macWrongDirection = await hmac(kWrongDirection, preimage)
const C = await pairContext(fill(64, 7), fill(32, 6))   // same root, different nonce → different tuple
const kWrongKey = await hkdf(await ecdh(C.x.priv, B.x.pubRaw), `rltp/v1/delivery/mac/ack/${C.anchor}/${B.anchor}`, 32)
const macWrongKey = await hmac(kWrongKey, preimage)
// class crossings (§11 ack class matrix): schema-valid, PROPERLY PROVED
// forms whose CLASS is wrong — a genuinely signed DI ack for a DV
// payload, and the genuine MAC ack re-declared for a signature payload
const diFormAck = await diSign(A, doc, doc.issuedAt)

const vector = {
  description: 'Deniable delivery-ack (Delivery 4.2/4.4 acknowledgement class rule): MAC preimage is JCS of the document without proof; key = HKDF-SHA-256(X25519(pairX_issuer, pairX_recipient), salt empty, info "rltp/v1/delivery/mac/ack/" || issuerPairAnchor || "/" || recipientPairAnchor, 32 bytes). Regenerate: node scripts/gen-delivery-ack-vector.mjs (deterministic).',
  inputs: {
    issuerRootIkm: 'fill(64, 0x07)', issuerPairNonce: 'fill(32, 0x03)',
    recipientRootIkm: 'fill(64, 0x09)', recipientPairNonce: 'fill(32, 0x05)',
    issuerPairAnchor: A.anchor, recipientPairAnchor: B.anchor,
    info: info(A, B),
    document: doc,
  },
  intermediate: { preimage },
  output: { proof: { mac } },
  negatives: [
    { name: 'tampered-preimage', note: 'issuedAt changed by one second — MAC over the held document MUST NOT verify', document: tampered, wrongMac: macTampered },
    { name: 'wrong-direction', note: 'info with the anchors swapped — a MAC under the reversed direction MUST NOT verify', wrongMac: macWrongDirection },
    { name: 'wrong-key', note: 'a different tuple of the same holder — its ack key MUST NOT verify this document', wrongMac: macWrongKey },
    { name: 'missing-proof', note: 'a delivery-ack without proof fails the document schema (if/then on the full type URI)' },
    { name: 'signature-form-for-dv-payload', note: 'class crossing: a VALIDLY SIGNED DataIntegrityProof ack acknowledging a designated-verifier payload — schema-valid, signature-valid, and rejected by the 4.2 class rule alone', document: diFormAck, acknowledgedType: 'https://real-life.org/trust-tasks/star/0.1', expected: 'failed(validation-failed)' },
    { name: 'hybrid-proof', note: 'a proof carrying every DataIntegrityProof field AND mac is schema-INVALID: both oneOf branches are closed (additionalProperties false) — an ack can never be both deniable and transferable', document: { ...doc }, proof: { ...diFormAck.proof, mac }, expected: 'failed(malformed)' },
    { name: 'mac-form-for-signature-payload', note: 'class crossing: the valid {mac}-form ack of this vector, acknowledging a transferably signed payload — schema-valid, MAC-valid, and rejected by the 4.2 class rule alone', document: { ...doc }, proof: { mac }, acknowledgedType: 'https://real-life.org/trust-tasks/encounter-credential-delivery/0.1', expected: 'failed(validation-failed)' },
  ],
  wrongKeyInputs: {
    foreignRootIkm: 'fill(64, 0x07)', foreignPairNonce: 'fill(32, 0x06)',
    foreignPairAnchor: C.anchor,
    info: `rltp/v1/delivery/mac/ack/${C.anchor}/${B.anchor}`,
  },
}
writeFileSync(join(ROOT, 'vectors/delivery-ack.json'), JSON.stringify(vector, null, 1) + '\n')
console.log('vectors/delivery-ack.json geschrieben; mac =', mac)
