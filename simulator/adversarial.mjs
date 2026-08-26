// Adversarial regression: replays the Codex-review counterexamples against
// the engine — every attack must fail, every control must pass. Updated for
// FRESH-ALWAYS pair contexts (0.24 wire): attackers sign correctly under
// their OWN fresh contexts; what stops them is binding, never formatting.
import * as E from './engine.mjs';

const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
let now = Date.parse('2026-08-11T09:00:00Z');
let fails = 0;
const assert = (c, m) => { console.log((c ? '✓ ' : '✗ FAIL ') + m); if (!c) fails++; };
const sendTo = (card) => [card.keyAgreement, E.xPubOfMk(card.keyAgreement)];

const alice = E.createPerson('Alice'), bob = E.createPerson('Bob'), mallory = E.createPerson('Mallory');

// F2 — proof under a foreign verificationMethod must not verify
const cardA = E.displayCard(alice, now);
const malloryCard = E.displayCard(mallory, now);
const forged = { ...cardA }; forged.proof = { ...malloryCard.proof };  // Mallory's proof, Alice's body/anchor
assert(E.diVerify(forged, forged.anchor) === false, 'F2: fremde verificationMethod ⇒ verify false');
assert(E.diVerify(cardA, cardA.anchor) === true, 'F2: legitime Card verifiziert weiterhin');

// build a real enactment Alice→Bob (fresh tuple: cardB.anchor ↔ s.ctx.anchor)
const cardB = E.displayCard(bob, now);
const s = E.sentCard(alice, cardB.anchor, cardB.challenge.value, now);
const bind = E.binding(E.CEREMONY, cardB.challenge.value, s.challenge.value);
alice.records.set(s.challenge.value, { ceremony: E.CEREMONY, counterparty: cardB.anchor, card: cardB, own: s.challenge, ownCtx: s.ctx, other: cardB.challenge, binding: bind, time: now });
alice.open.delete(s.challenge.value);
const cred = E.issueCredential(s.ctx, cardB.anchor, E.CEREMONY, cardB.challenge.value, bind, now);
const bundle = E.bundleDocument(alice, s.card, cred, bind, now);
E.noteIssued(alice, cardB.anchor, cred); E.noteSent(alice, bundle);

// F3 — forged ack from a third party (correctly signed under Mallory's OWN
// fresh context) must be rejected: the ack issuer is not the recipient
const mctx = E.freshPairContext(mallory);
const ackBody = { id: '99999999-0000-4000-8000-000000000001', type: 'https://real-life.org/trust-tasks/delivery-ack/0.1', issuer: mctx.anchor, recipient: bundle.issuer, threadId: bundle.threadId, issuedAt: iso(now), payload: { ref: E.docDigest(bundle), meaning: 'received' } };
const malloryAck = E.signDocument(mctx, ackBody, iso(now));
const rForged = E.receiveEnvelope(alice, E.seal(malloryAck, ...sendTo(s.card)), now);
assert(String(rForged.disposition).startsWith('failed'), 'F3: fremd signiertes Ack abgelehnt (' + rForged.disposition + ')');
assert(alice.senderStatus.get(E.docDigest(bundle))?.status === 'accepted', 'F3: Sender-Status bleibt accepted');

// control — the real recipient's ack still delivers
const rb = E.receiveEnvelope(bob, E.seal(bundle, ...sendTo(cardB)), now + 1000);
assert(rb.disposition === 'unique', 'Kontrolle: echtes Bundle bei Bob unique');
const ra = E.receiveEnvelope(alice, E.seal(rb.ack, ...sendTo(s.card)), now + 2000);
assert(ra.disposition === 'unique' && alice.senderStatus.get(E.docDigest(bundle))?.status === 'delivered', 'F3: echtes Empfänger-Ack ⇒ delivered');

// F15 — an ack ref in z-multibase for the same multihash must still match
const uRef = E.docDigest(bundle);
const zRef = 'z' + E.base58(Buffer.from(uRef.slice(1), 'base64url'));
assert(E.sameDigest(uRef, zRef) === true, 'F15: u- und z-Darstellung desselben Multihash gelten gleich');
assert(E.sameDigest(uRef, uRef.slice(0, -2) + 'XX') === false, 'F15: abweichender Multihash gilt ungleich');

// F5 — a second, different credential for the same record/direction ⇒ ERR_CONFLICT
const cred2 = E.issueCredential(s.ctx, cardB.anchor, E.CEREMONY, cardB.challenge.value, bind, now + 60_000);
const rc = E.receiveEnvelope(bob, E.seal(E.credentialDeliveryDocument(alice, cred2, bundle.threadId, 'scan', now + 60_000), ...sendTo(cardB)), now + 60_000);
assert(rc.acceptance === 'ERR_CONFLICT', 'F5: abweichendes Zweit-Credential ⇒ ERR_CONFLICT (' + rc.acceptance + ')');

// F6 — two independent one-sided enactments must not read as mutual.
// Under fresh-always they cannot even share a tuple: each enactment has its
// own pair anchors, so the two edges are distinct BY CONSTRUCTION.
const carol = E.createPerson('Carol'), dan = E.createPerson('Dan');
const carolE1 = E.freshPairContext(carol), danE1 = E.freshPairContext(dan);
const carolE2 = E.freshPairContext(carol), danE2 = E.freshPairContext(dan);
const ch1 = 'A'.repeat(22), ch2 = 'B'.repeat(22); // schema-valid challenge values
const b1 = E.binding(E.CEREMONY, ch1, 'C'.repeat(22)), b2 = E.binding(E.CEREMONY, ch2, 'D'.repeat(22));
E.noteIssued(carol, danE1.anchor, E.issueCredential(carolE1, danE1.anchor, E.CEREMONY, ch1, b1, now)); // outgoing in E1
carol.records.set(ch2, { ceremony: E.CEREMONY, counterparty: danE2.anchor, card: {}, own: { value: ch2, issuedAt: iso(now) }, ownCtx: carolE2, other: {}, binding: b2, time: now });
const danCred = E.issueCredential(danE2, carolE2.anchor, E.CEREMONY, ch2, b2, now);                    // incoming in E2
assert(E.tryAccept(carol, danCred, now) === 'accepted', 'Kontrolle: Dans Credential (E2) akzeptiert');
assert(E.edgeState(carol, danE1.anchor) !== 'mutual' && E.edgeState(carol, danE2.anchor) !== 'mutual', 'F6: zwei einseitige Enactments ⇒ nie mutual (fresh-always trennt die Tupel strukturell)');
// and a genuine mutual (same binding both ways, ONE tuple) still reads mutual
const ed = E.createPerson('Ed'), fay = E.createPerson('Fay');
const edCtx = E.freshPairContext(ed), fayCtx = E.freshPairContext(fay);
const chX = 'X'.repeat(22), chY = 'Y'.repeat(22);
const bSame = E.binding(E.CEREMONY, chX, chY); // one enactment, one binding, both directions
E.noteIssued(ed, fayCtx.anchor, E.issueCredential(edCtx, fayCtx.anchor, E.CEREMONY, chX, bSame, now));
ed.records.set(chY, { ceremony: E.CEREMONY, counterparty: fayCtx.anchor, card: {}, own: { value: chY, issuedAt: iso(now) }, ownCtx: edCtx, other: {}, binding: bSame, time: now });
E.tryAccept(ed, E.issueCredential(fayCtx, edCtx.anchor, E.CEREMONY, chY, bSame, now), now);
assert(E.edgeState(ed, fayCtx.anchor) === 'mutual', 'F6: gleiche Binding in beide Richtungen auf EINEM Tupel ⇒ mutual');

// F7 — malformed payloads rejected before any effect
const rGarbage = E.receiveEnvelope(bob, E.seal({ id: 'x', type: 'https://real-life.org/trust-tasks/encounter-bundle/0.1', issuer: s.ctx.anchor, recipient: cardB.anchor, threadId: 't', issuedAt: iso(now), payload: {} }, ...sendTo(cardB)), now);
assert(rGarbage.disposition === 'failed(malformed)', 'F7: Bundle ohne card/credential ⇒ failed(malformed) (' + rGarbage.disposition + ')');
const rExpires = E.receiveEnvelope(bob, E.seal({ id: 'x', type: 'https://real-life.org/trust-tasks/delivery-ack/0.1', issuer: s.ctx.anchor, recipient: cardB.anchor, threadId: 't', issuedAt: iso(now), expiresAt: iso(now + 1000), payload: { ref: uRef, meaning: 'received' } }, ...sendTo(cardB)), now);
assert(rExpires.disposition === 'failed(malformed)', 'F7: verbotenes expiresAt ⇒ failed(malformed) (' + rExpires.disposition + ')');

// F14 (fresh-always addition) — the enacting anchors are PAIR anchors:
// two enactments of the same person never share an anchor
const cardA2 = E.displayCard(alice, now);
assert(cardA.anchor !== cardA2.anchor, 'F14+: fresh-always — zwei Displays, zwei verschiedene pair-Anker');

console.log(fails ? `\n${fails} FAILED` : '\nALLE ADVERSARIAL-CHECKS BESTANDEN');
process.exit(fails ? 1 : 0);
