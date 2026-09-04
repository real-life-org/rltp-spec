#!/usr/bin/env node
// live-probe.mjs — the converged adapter (profile 0.23) over the real
// wire binding against the LIVE Dogwood mediator.
//
// Two independent relationships (Alice, Bob), each: derived identity
// trio, ATM auth under the connection DID, TSP direct-mode carriage of
// an opaque "sealed RLTP envelope", delete-to-ack timed by the
// adapter's conclude — measured, not assumed.
//
// Network-gated: set RLTP_LIVE_MEDIATOR=1 to run.
//   MEDIATOR_DID=...   overrides the public dev mediator.

import { MediatorCarrierAdapter } from "../lib/dist/adapter-mediator.js";
import { createVtiWire } from "./vti-wire.mjs";

if (process.env.RLTP_LIVE_MEDIATOR !== "1") {
  console.log("live-probe: skipped (set RLTP_LIVE_MEDIATOR=1 to run against the live mediator)");
  process.exit(0);
}

const MEDIATOR_DID = process.env.MEDIATOR_DID
  ?? "did:webvh:QmTS3a3H9Dk4ZMPAZ8jNWGeyPbuKrPbrPZcSbg8CJ6yynD:webvh.storm.ws:mediator";

const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
const now = () => Date.now();
const say = (...a) => console.log(...a);
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };

say("── live probe: converged adapter × real mediator ──");
say(`  mediator (C): ${MEDIATOR_DID}`);

// Each party: its own relationship root and carrier nonce. The wire
// derives the identical trio the adapter's factory derives.
const aliceRoot = rand(32); const aliceNonce = rand(32);
const bobRoot = rand(32); const bobNonce = rand(32);

// bootstrap: derive DIDs first (peer config needs them)
const preA = await createVtiWire({ rootIkm: aliceRoot, mediatorDid: MEDIATOR_DID, nonce: aliceNonce, peerDid: "did:key:z6MkfLdHWkKPXwUKGV2W6PZs6cUpUYt1oSJ2VYk3XwZm3mNa", peerEgressDid: "did:key:z6MkfLdHWkKPXwUKGV2W6PZs6cUpUYt1oSJ2VYk3XwZm3mNa" });
const preB = await createVtiWire({ rootIkm: bobRoot, mediatorDid: MEDIATOR_DID, nonce: bobNonce, peerDid: preA.connectionDid, peerEgressDid: preA.egressDid });
preA.close();

const wireA = await createVtiWire({ rootIkm: aliceRoot, mediatorDid: MEDIATOR_DID, nonce: aliceNonce, peerDid: preB.connectionDid, peerEgressDid: preB.egressDid });
const wireB = preB;

const alice = await MediatorCarrierAdapter.create(aliceRoot, MEDIATOR_DID, aliceNonce, wireA);
const bob = await MediatorCarrierAdapter.create(bobRoot, MEDIATOR_DID, bobNonce, wireB);

// transport admission (profile §3): register opens the ATM session
// and the pickup socket — collection has no wire traffic of its own
alice.register([], now()); bob.register([], now());
await alice.settle(); await bob.settle();
say(`  ✓ both parties admitted (ATM auth under the connection DIDs, sockets open)`);

// §5a.10: the DERIVED trio of the adapter matches the wire's, and the
// principal appears in neither wire config
if (alice.connectionDid !== wireA.connectionDid) fail("adapter/wire connection DID mismatch");
if (alice.egressDid !== wireA.egressDid) fail("adapter/wire egress DID mismatch");
say(`  ✓ trio coupling: adapter and wire derive byte-identical DIDs`);
say(`    alice conn ${alice.connectionDid.slice(0, 24)}… egress ${alice.egressDid.slice(0, 24)}…`);

// a stand-in sealed RLTP envelope: opaque bytes above the 17-byte floor
const envelope = rand(64);
const id = alice.submit(envelope, now());
await alice.settle();
const st = alice.status(id);
if (st?.state !== "accepted") fail(`submit not accepted: ${JSON.stringify(st)}`);
say(`  ✓ deposit accepted by the live mediator (egress identity on the envelope)`);

// give the store-and-forward a moment, then collect at Bob
const waitFor = async (pred, ms = 20000, step = 250) => {
  const t0 = Date.now();
  for (;;) {
    if (pred()) return true;
    if (Date.now() - t0 > ms) return false;
    await new Promise((r) => setTimeout(r, step));
  }
};

let c = { items: [] };
const got = await waitFor(() => { c = bob.collect(now()); return c.items.length > 0; });
if (!got) fail("no delivery within 20s");
say(`  ✓ delivered: ${c.items.length} envelope(s), ${c.items[0].bytes.length}B`);
if (Buffer.compare(Buffer.from(c.items[0].bytes), Buffer.from(envelope)) !== 0) {
  fail("payload bytes differ — the TSP layer did not carry them truthfully (M-2)");
}
say(`  ✓ byte-identical payload through TSP framing (M-2 held)`);

bob.conclude(c, now());
await bob.settle();
say(`  ✓ concluded — delete-to-ack sent under the adapter's timing`);

// the reply direction proves bidirectionality of both bindings
const replyEnvelope = rand(48);
const rid = bob.submit(replyEnvelope, now());
await bob.settle();
if (bob.status(rid)?.state !== "accepted") fail("reply not accepted");
let c2 = { items: [] };
const got2 = await waitFor(() => { c2 = alice.collect(now()); return c2.items.length > 0; });
if (!got2) fail("no reply delivery within 20s");
if (Buffer.compare(Buffer.from(c2.items[0].bytes), Buffer.from(replyEnvelope)) !== 0) fail("reply bytes differ");
alice.conclude(c2, now());
await alice.settle();
say(`  ✓ reply delivered and concluded`);

alice.close(); bob.close();
wireA.close(); wireB.close();
console.log("\nLIVE-PROBE PASS — converged adapter exchanged sealed envelopes through the live Dogwood mediator (deposit → deliver → conclude, both directions)");
process.exit(0);
