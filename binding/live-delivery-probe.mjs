#!/usr/bin/env node
// live-delivery-probe.mjs — the FULL delivery contract over the live
// mediator: a real sealed RLTP envelope (lib seal), the receiver's
// staged receive() verdict, a SIGNED delivery-ack/0.1 back, and the
// sender's §6.1 trias closing accepted → delivered. Unit 2 after the
// transport-only live probe.
//
// Network-gated: RLTP_LIVE_MEDIATOR=1.

import { MediatorCarrierAdapter } from "../lib/dist/adapter-mediator.js";
import { seal, receive } from "../lib/dist/delivery.js";
import {
  xFromSeed, mkOfX, edFromSeed, anchorOfEd, diSign, diVerify,
} from "../lib/dist/crypto.js";
import { jcs } from "../lib/dist/core.js";
import { createVtiWire } from "./vti-wire.mjs";

if (process.env.RLTP_LIVE_MEDIATOR !== "1") {
  console.log("live-delivery-probe: skipped (set RLTP_LIVE_MEDIATOR=1)");
  process.exit(0);
}

const MEDIATOR_DID = process.env.MEDIATOR_DID
  ?? "did:webvh:QmTS3a3H9Dk4ZMPAZ8jNWGeyPbuKrPbrPZcSbg8CJ6yynD:webvh.storm.ws:mediator";

const te = new TextEncoder();
const td = new TextDecoder();
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
const now = () => Date.now();
const iso = () => new Date().toISOString().replace(/\.\d+Z$/, "Z").replace("Z", ".000Z").replace(".000Z", "Z");
const uuid = () => crypto.randomUUID();
const say = (...a) => console.log(...a);
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };

say("── live delivery probe: seal → carry → receive → signed ack → delivered ──");
say(`  mediator (C): ${MEDIATOR_DID}`);

// ── party state: relationship root/nonce (adapter+wire), an rkid
// (X25519, the seal target), and a signing anchor (the ack issuer)
async function party() {
  const root = rand(32); const nonce = rand(32);
  const xSeed = rand(32);
  const x = await xFromSeed(xSeed);
  const rkid = mkOfX(x.pubRaw);
  const edSeed = rand(32);
  const ed = await edFromSeed(edSeed);
  const anchor = anchorOfEd(ed.pubRaw);
  return { root, nonce, x, rkid, ed, anchor, completed: new Set() };
}

const A = await party(); const B = await party();

const preB = await createVtiWire({ rootIkm: B.root, mediatorDid: MEDIATOR_DID, nonce: B.nonce, peerDid: "did:key:z6MkfLdHWkKPXwUKGV2W6PZs6cUpUYt1oSJ2VYk3XwZm3mNa", peerEgressDid: "did:key:z6MkfLdHWkKPXwUKGV2W6PZs6cUpUYt1oSJ2VYk3XwZm3mNa" });
const wireA = await createVtiWire({ rootIkm: A.root, mediatorDid: MEDIATOR_DID, nonce: A.nonce, peerDid: preB.connectionDid, peerEgressDid: preB.egressDid });
preB.close();
const wireB = await createVtiWire({ rootIkm: B.root, mediatorDid: MEDIATOR_DID, nonce: B.nonce, peerDid: wireA.connectionDid, peerEgressDid: wireA.egressDid });

const alice = await MediatorCarrierAdapter.create(A.root, MEDIATOR_DID, A.nonce, wireA);
const bob = await MediatorCarrierAdapter.create(B.root, MEDIATOR_DID, B.nonce, wireB);
alice.register([A.rkid], now()); bob.register([B.rkid], now());
await alice.settle(); await bob.settle();
say(`  ✓ both parties admitted; rkids: A ${A.rkid.slice(0, 12)}… B ${B.rkid.slice(0, 12)}…`);

const waitFor = async (pred, ms = 20000, step = 250) => {
  const t0 = Date.now();
  for (;;) { if (pred()) return true; if (Date.now() - t0 > ms) return false; await new Promise((r) => setTimeout(r, step)); }
};

// ── 1: Alice seals a REAL delivery document to Bob's rkid ──────────
const doc = {
  id: uuid(),
  type: "https://real-life.org/trust-tasks/encounter-bundle/0.1",
  issuer: A.anchor, recipient: B.anchor,
  threadId: uuid(), issuedAt: iso(),
  payload: { note: "live delivery probe", n: 1 },
};
const envelope = await seal(doc, B.rkid);
const envBytes = te.encode(jcs(envelope));
say(`  ✓ sealed with the lib (AES-256-GCM to B's rkid): ${envBytes.length}B`);

const sid = alice.submit(envBytes, now());
await alice.settle();
if (alice.status(sid)?.state !== "accepted") fail("submit not accepted");
say(`  ✓ accepted — §6.1 trias entered`);

// ── 2: Bob collects and runs the staged receive() ─────────────────
let c = { items: [] };
if (!(await waitFor(() => { c = bob.collect(now()); return c.items.length > 0; }))) fail("no delivery in 20s");
const gotEnv = JSON.parse(td.decode(c.items[0].bytes));
const verdict = await receive(gotEnv, (rkid) => (rkid === B.rkid ? B.x.priv : undefined), B.completed);
if (verdict.disposition !== "unique") fail(`receive verdict: ${verdict.disposition}`);
if (verdict.document.payload.note !== "live delivery probe") fail("document mismatch");
B.completed.add(verdict.digest);
bob.conclude(c, now()); await bob.settle();
say(`  ✓ received: disposition=${verdict.disposition}, digest ${verdict.digest.slice(0, 16)}… — concluded`);

// ── 3: Bob signs a delivery-ack/0.1 and seals it back ─────────────
const ackDoc = await diSign(
  { anchor: B.anchor, ed: { priv: B.ed.priv } },
  {
    id: uuid(),
    type: "https://real-life.org/trust-tasks/delivery-ack/0.1",
    issuer: B.anchor, recipient: A.anchor,
    threadId: doc.threadId, issuedAt: iso(),
    payload: { ref: verdict.digest, meaning: "received" },
  },
  iso(),
);
const ackEnv = await seal(ackDoc, A.rkid);
const rid = bob.submit(te.encode(jcs(ackEnv)), now());
await bob.settle();
if (bob.status(rid)?.state !== "accepted") fail("ack submit not accepted");
say(`  ✓ delivery-ack signed (eddsa-jcs-2022 under B's anchor) and sealed back`);

// ── 4: Alice receives the ack, validates it, closes the trias ─────
let c2 = { items: [] };
if (!(await waitFor(() => { c2 = alice.collect(now()); return c2.items.length > 0; }))) fail("no ack delivery in 20s");
const ackGot = JSON.parse(td.decode(c2.items[0].bytes));
const ackVerdict = await receive(ackGot, (rkid) => (rkid === A.rkid ? A.x.priv : undefined), A.completed);
if (ackVerdict.disposition !== "unique") fail(`ack receive: ${ackVerdict.disposition}`);
const ack = ackVerdict.document;
if (ack.type !== "https://real-life.org/trust-tasks/delivery-ack/0.1") fail("not a delivery-ack");
if (!(await diVerify(ack, B.anchor))) fail("ack proof invalid");
if (ack.payload.ref !== verdict.digest) fail("ack references a different document");
if (ack.threadId !== doc.threadId) fail("ack thread mismatch");
A.completed.add(ackVerdict.digest);
alice.conclude(c2, now()); await alice.settle();
say(`  ✓ ack validated: proof under B's anchor, ref matches, thread bound`);

alice.acknowledged(sid);
const finalSt = alice.status(sid);
if (finalSt?.state !== "delivered" || finalSt.late !== false) fail(`trias did not close: ${JSON.stringify(finalSt)}`);
say(`  ✓ §6.1 trias closed: accepted → delivered (in time, not late)`);

alice.close(); bob.close(); wireA.close(); wireB.close();
console.log("\nLIVE-DELIVERY-PROBE PASS — the full delivery contract ran over the live mediator: lib-sealed envelope, staged receive() verdict, signed delivery-ack/0.1, sender trias closed as delivered");
process.exit(0);
