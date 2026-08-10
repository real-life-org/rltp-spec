// Adversarial regression: replays the Codex-review counterexamples against
// the FIXED engine — every attack must now fail, every control must pass.
import * as E from './engine.mjs';
import { createPublicKey } from 'node:crypto';

const X_SPKI = Buffer.from('302a300506032b656e032100', 'hex');
const xPub = (p) => createPublicKey({ key: Buffer.concat([X_SPKI, p.keys.xRaw]), format: 'der', type: 'spki' });
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
let now = Date.parse('2026-08-11T09:00:00Z');
let fails = 0;
const assert = (c, m) => { console.log((c ? '✓ ' : '✗ FAIL ') + m); if (!c) fails++; };

const alice = E.createPerson('Alice'), bob = E.createPerson('Bob'), mallory = E.createPerson('Mallory');

// F2 — proof under a foreign verificationMethod must not verify
const cardA = E.displayCard(alice, now);
const malloryCard = E.displayCard(mallory, now);
const forged = { ...cardA }; forged.proof = { ...malloryCard.proof };  // Mallory's proof, Alice's body/anchor
assert(E.diVerify(forged, forged.anchor) === false, 'F2: fremde verificationMethod ⇒ verify false');
assert(E.diVerify(cardA, cardA.anchor) === true, 'F2: legitime Card verifiziert weiterhin');

// build a real enactment Alice→Bob
const cardB = E.displayCard(bob, now);
const s = E.sentCard(alice, bob.anchor, cardB.challenge.value, now);
const bind = E.binding(E.CEREMONY, cardB.challenge.value, s.challenge.value);
alice.records.set(s.challenge.value, { ceremony: E.CEREMONY, counterparty: bob.anchor, card: cardB, own: s.challenge, other: cardB.challenge, binding: bind, time: now });
alice.open.delete(s.challenge.value);
const cred = E.issueCredential(alice, bob.anchor, E.CEREMONY, cardB.challenge.value, bind, now);
const bundle = E.bundleDocument(alice, s.card, cred, bind, now);
E.noteIssued(alice, bob.anchor, cred); E.noteSent(alice, bundle);

// F3 — forged ack from a third party (properly signed by Mallory) must be rejected
const malloryAck = E.ackDocument(mallory, bundle, now);         // issuer = Mallory, ref = bundle digest
const rForged = E.receiveEnvelope(alice, E.seal(malloryAck, alice.keyAgreement, xPub(alice)), now);
assert(String(rForged.disposition).startsWith('failed'), 'F3: fremd signiertes Ack abgelehnt (' + rForged.disposition + ')');
assert(alice.senderStatus.get(E.docDigest(bundle))?.status === 'accepted', 'F3: Sender-Status bleibt accepted');

// control — the real recipient's ack still delivers
const rb = E.receiveEnvelope(bob, E.seal(bundle, bob.keyAgreement, xPub(bob)), now + 1000);
assert(rb.disposition === 'unique', 'Kontrolle: echtes Bundle bei Bob unique');
const ra = E.receiveEnvelope(alice, E.seal(rb.ack, alice.keyAgreement, xPub(alice)), now + 2000);
assert(ra.disposition === 'unique' && alice.senderStatus.get(E.docDigest(bundle))?.status === 'delivered', 'F3: echtes Empfänger-Ack ⇒ delivered');

// F15 — an ack ref in z-multibase for the same multihash must still match
const uRef = E.docDigest(bundle);
const zRef = 'z' + E.base58(Buffer.from(uRef.slice(1), 'base64url'));
assert(E.sameDigest(uRef, zRef) === true, 'F15: u- und z-Darstellung desselben Multihash gelten gleich');
assert(E.sameDigest(uRef, uRef.slice(0, -2) + 'XX') === false, 'F15: abweichender Multihash gilt ungleich');

// F5 — a second, different credential for the same record/direction ⇒ ERR_CONFLICT
const cred2 = E.issueCredential(alice, bob.anchor, E.CEREMONY, cardB.challenge.value, bind, now + 60_000);
const rc = E.receiveEnvelope(bob, E.seal(E.credentialDeliveryDocument(alice, cred2, bundle.threadId, 'scan', now + 60_000), bob.keyAgreement, xPub(bob)), now + 60_000);
assert(rc.acceptance === 'ERR_CONFLICT', 'F5: abweichendes Zweit-Credential ⇒ ERR_CONFLICT (' + rc.acceptance + ')');

// F6 — two independent one-sided enactments must not read as mutual
const carol = E.createPerson('Carol'), dan = E.createPerson('Dan');
E.noteIssued(carol, dan.anchor, E.issueCredential(carol, dan.anchor, E.CEREMONY, 'c1', 'uE1', now)); // outgoing in E1
carol.records.set('c2', { ceremony: E.CEREMONY, counterparty: dan.anchor, card: {}, own: { value: 'c2', issuedAt: iso(now) }, other: {}, binding: 'uE2', time: now });
const danCred = E.issueCredential(dan, carol.anchor, E.CEREMONY, 'c2', 'uE2', now);                  // incoming in E2
assert(E.tryAccept(carol, danCred, now) === 'accepted', 'Kontrolle: Dans Credential (E2) akzeptiert');
assert(E.edgeState(carol, dan.anchor) !== 'mutual', 'F6: zwei einseitige Enactments ⇒ nicht mutual (ist ' + E.edgeState(carol, dan.anchor) + ')');
// and a genuine mutual (same binding both ways) still reads mutual
const ed = E.createPerson('Ed'), fay = E.createPerson('Fay');
E.noteIssued(ed, fay.anchor, E.issueCredential(ed, fay.anchor, E.CEREMONY, 'x', 'uSAME', now));
ed.records.set('y', { ceremony: E.CEREMONY, counterparty: fay.anchor, card: {}, own: { value: 'y', issuedAt: iso(now) }, other: {}, binding: 'uSAME', time: now });
E.tryAccept(ed, E.issueCredential(fay, ed.anchor, E.CEREMONY, 'y', 'uSAME', now), now);
assert(E.edgeState(ed, fay.anchor) === 'mutual', 'F6: gleiche Binding in beide Richtungen ⇒ mutual');

// F7 — malformed payloads rejected before any effect
const rGarbage = E.receiveEnvelope(bob, E.seal({ id: 'x', type: 'https://real-life.org/trust-tasks/encounter-bundle/0.1', issuer: alice.anchor, recipient: bob.anchor, threadId: 't', issuedAt: iso(now), payload: {} }, bob.keyAgreement, xPub(bob)), now);
assert(rGarbage.disposition === 'failed(malformed)', 'F7: Bundle ohne card/credential ⇒ failed(malformed) (' + rGarbage.disposition + ')');
const rExpires = E.receiveEnvelope(bob, E.seal({ id: 'x', type: 'https://real-life.org/trust-tasks/delivery-ack/0.1', issuer: alice.anchor, recipient: bob.anchor, threadId: 't', issuedAt: iso(now), expiresAt: iso(now + 1000), payload: { ref: uRef, meaning: 'received' } }, bob.keyAgreement, xPub(bob)), now);
assert(rExpires.disposition === 'failed(malformed)', 'F7: verbotenes expiresAt ⇒ failed(malformed) (' + rExpires.disposition + ')');

console.log(fails ? `\n${fails} FAILED` : '\nALLE ADVERSARIAL-CHECKS BESTANDEN');
process.exit(fails ? 1 : 0);
