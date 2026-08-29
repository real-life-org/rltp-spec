# RLTP Ceremony Simulator

An interactive, browser-only implementation of the RLTP ceremony pair
(Encounter Layer 0.28, wire 0.25 (DTG-typed credentials) · Delivery Contract 0.21) under
**fresh-always pair anchors**: two app instances, one delivery
channel, the complete protocol in WebCrypto (Ed25519, X25519, HKDF,
AES-256-GCM) — including a live byte-for-byte reproduction of
[`vectors/seal.json`](../vectors/seal.json) at boot. The Node engine
(`engine.mjs`) additionally models the Identity §6 seed derivation
and is checked by `conformance/iut-simulator.mjs`.

**Run it here:** the repository's GitHub Pages deployment serves this
directory directly. Or locally:

```sh
cd simulator
python3 -m http.server 8199    # any static server works
# → http://localhost:8199/
```

**Single source of truth:** the protocol modules here are one-line
shims onto `lib/` — the committed, buildless freeze of the library's
compiled output (`lib/dist`). Never edit `simulator/lib/` or the shims;
change `lib/src/*.ts`, then refresh the freeze:

```sh
cd lib && npm ci && npm run build && cd ..
node scripts/build-simulator-lib.mjs      # re-freeze simulator/lib/
node scripts/build-simulator-lib.mjs --check   # what CI enforces
```

Simulator-only code (the observable channel with its faults, the clock,
the UI) stays real code in this directory.

**Headless test suites in the agent sandbox** (`tests-ui-*.mjs`;
`adversarial.mjs` needs plain node only): ESM needs a resolvable
`@playwright/test`, and the sandbox has no `/usr/bin/chromium` —

```sh
ln -sfn ../../node_modules/.pnpm/node_modules simulator/node_modules
export CHROME_BIN=~/.var/app/com.vscodium.codium/cache/ms-playwright/chromium-1208/chrome-linux64/chrome
(cd simulator && python3 -m http.server 8199 &) && node simulator/tests-ui-suite.mjs
```

The first load needs the network (React and a QR library via CDN);
the protocol cryptography itself runs locally in WebCrypto.

## What it shows

The one registered ceremony `encounter-scan@0.25` end to end:

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
- `adversarial.mjs` — engine regression that replays forged inputs
  (foreign-anchor proof, third-party ack, second conflicting
  credential, cross-enactment mutual, malformed payloads) and asserts
  every attack fails: `node adversarial.mjs`

## Tests

- **Engine (Node):** `node scenario.mjs` and `node adversarial.mjs`.
- **Browser (Playwright + Chrome ≥137 for Ed25519 WebCrypto):** serve
  the directory (`python3 -m http.server 8199`), then, with
  `CHROME_BIN` pointing at a suitable Chrome, run:
  - `node tests-ui-suite.mjs` — 13 end-to-end scenarios (happy path,
    one-sided, skew, hold/offline, duplicate, tamper, legacy label,
    consumed, backdate, lost-ack optical leg, cancel, reset);
  - `node tests-ui-borrow-scan.mjs` — the borrowed-QR case (a device
    mid-dialog briefly returns to its code so the other can scan it);
  - `node tests-ui-adversarial.mjs` — in-page crypto checks: proofs
    reject a foreign or spoofed anchor, the proof message is the
    two-hash `eddsa-jcs-2022` construction, `u`/`z` multihashes match.
