import { WebSocket } from "ws";
import { authenticateToMediator, MediatorSession, multibase, didKey } from "@openvtc/vti-didcomm-js";
import { pack, unpack } from "@openvtc/vti-tsp-js";
import { ed25519, x25519 } from "@noble/curves/ed25519.js";
const MEDIATOR_DID = "did:webvh:QmTS3a3H9Dk4ZMPAZ8jNWGeyPbuKrPbrPZcSbg8CJ6yynD:webvh.storm.ws:mediator";
const mint = () => {
  const edSecret = ed25519.utils.randomSecretKey ? ed25519.utils.randomSecretKey() : ed25519.utils.randomPrivateKey();
  const edPublic = ed25519.getPublicKey(edSecret);
  const xSecret = ed25519.utils.toMontgomerySecret(edSecret);
  const xPublic = x25519.getPublicKey(xSecret);
  const did = `did:key:${multibase.encodeMultikey(multibase.MULTICODEC.ED25519_PUB, edPublic)}`;
  const doc = didKey.resolve(did).didDocument;
  const kid = doc.keyAgreement?.[0]?.id ?? doc.keyAgreement?.[0];
  return { did, kid, edSecret, xSecret, xPublic };
};
const keysOf = (did) => {
  const doc = didKey.resolve(did).didDocument;
  const agreementId = doc.keyAgreement?.[0]?.id ?? doc.keyAgreement?.[0];
  const ms = doc.verificationMethod ?? [];
  const ag = ms.find((v) => v.id === agreementId); const sg = ms.find((v) => v.id !== agreementId);
  return { signPub: multibase.decodeMultikey(sg.publicKeyMultibase).key, encPub: multibase.decodeMultikey(ag.publicKeyMultibase).key };
};
async function attach(id) {
  const auth = await authenticateToMediator({ mediatorDid: MEDIATOR_DID, clientDid: id.did, clientX25519Private: id.xSecret, clientX25519Public: id.xPublic });
  const inbox = [];
  const s = new MediatorSession({ mediator: auth.mediator, mediatorJwt: auth.accessToken,
    client: { did: id.did, kid: id.kid, privateKey: id.xSecret, publicKey: id.xPublic },
    WebSocketImpl: WebSocket, onTspFrame: (b) => inbox.push(b), onError: () => {} });
  await s.connect();
  return { s, inbox };
}
const A = mint(), B = mint(), E = mint();   // E = separate egress identity, NOT authenticated
const a = await attach(A), b = await attach(B);
const wait = async (arr, ms) => { const t0 = Date.now(); while (arr.length === 0 && Date.now() - t0 < ms) await new Promise(r => setTimeout(r, 200)); return arr.length > 0; };

// case 1: sender = socket DID (ref-04 style)
const p1 = await pack(new TextEncoder().encode("case1"), A.did, B.did, { senderSigningKey: A.edSecret, senderEncryptionKey: A.xSecret, receiverEncryptionKey: keysOf(B.did).encPub });
a.s.sendBinary(p1.bytes);
console.log("case1 sender=socketDID delivered:", await wait(b.inbox, 10000));

// case 2: sender = foreign egress DID on A's socket
b.inbox.length = 0;
const p2 = await pack(new TextEncoder().encode("case2"), E.did, B.did, { senderSigningKey: E.edSecret, senderEncryptionKey: E.xSecret, receiverEncryptionKey: keysOf(B.did).encPub });
a.s.sendBinary(p2.bytes);
console.log("case2 sender=egressDID  delivered:", await wait(b.inbox, 10000));
a.s.close(); b.s.close();
process.exit(0);
