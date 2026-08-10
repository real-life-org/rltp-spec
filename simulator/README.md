# RLTP Ceremony Simulator

An interactive, browser-only implementation of the RLTP ceremony pair
(Encounter Layer 0.19 · Delivery Contract 0.17): two app instances,
one delivery channel, the complete protocol in WebCrypto (Ed25519,
X25519, HKDF, AES-256-GCM) — including a live byte-for-byte
reproduction of [`vectors/seal.json`](../vectors/seal.json) at boot.

**Run it here:** the repository's GitHub Pages deployment serves this
directory directly. Or locally:

```sh
cd simulator
python3 -m http.server 8199    # any static server works
# → http://localhost:8199/
```

The first load needs the network (React and a QR library via CDN);
the protocol cryptography itself runs locally in WebCrypto.

## What it shows

The one registered ceremony `encounter-scan@0.19` end to end:

- the **connected path** — bundle through the delivery service,
  staged receiver dispositions (stages 1–9), record-creating effect,
  proof-carrying arrival acknowledgement;
- the **offline path** — after `ack-wait`, the sent card itself is
  presented optically (carrier switch, never a ceremony switch); the
  late bundle lands via the enactment record (record-aware effect);
- the **own-challenge state model** — resolution over
  open / recorded / unknown with the monotone aging latch;
- honest edge state: outgoing / incoming / mutual, never inferred.

Fault injections are switchable in the UI: lost acknowledgement,
duplicate delivery, aged challenge, consumed challenge, tampered
credential, foreign ceremony label, held envelopes.

## Files

- `index.html` — the page: UI plus the full protocol logic
- `PhoneScreen.dc.html` — the device-screen component
- `support.js` — the component runtime
- `engine.mjs` + `scenario.mjs` — a Node reference engine with an
  executable scenario covering both paths, the fresh-enactment
  last resort, the backward-clock latch, and the poisoning defense:
  `node scenario.mjs`
