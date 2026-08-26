# RLTP — Real Life Trust Protocol

**Specifications, schemas, and test vectors** for a decentralized trust
protocol rooted in **encounters between people**: two humans meet,
recognize each other, and record that recognition as verifiable
credentials. Trust is anchored in real meetings rather than in a
certifying institution. Cryptography proves freshness and authorship;
only a human can witness a human.

Published by the [Real Life Organisation](https://real-life.org). The
protocol grew out of the deployed
[Web of Trust app](https://web-of-trust.de/), whose ceremony flows have
been exercised at festivals and community gatherings since 2026.

## Try it in your browser

Three views of the same protocol, no installation, everything running
locally in your tab — real Ed25519/X25519/AES-GCM, no mocked crypto:

- **[The app](https://rltp.real-life.org/simulator/network.html)** — the
  same app on three devices side by side: verify someone by QR (with the
  automatic offline two-way-scan fallback), introduce two contacts
  through a third person who is never needed again afterwards, give
  trust as a separate deliberate act, found groups and join them with
  candidacy and vouching. The wire panel shows every sealed envelope
  and the stage at which it was accepted — and lets you inject faults.
- **[The ceremony](https://rltp.real-life.org/simulator/index.html)** —
  one encounter under the microscope: two devices, one delivery
  channel, nine receive stages per envelope, clock skew and fault
  injection, and every artifact each device stores.
- **[The graph](https://rltp.real-life.org/simulator/graph.html)** — the
  same world seen from above: who can *prove* what about whom, told as
  eight chapters, switchable between the omniscient view and what any
  single person can actually see.

Everything a person sees in the app is a function of what their own
device holds. No identifier is correlatable across relationships:
every encounter mints fresh pairwise anchors, and a blinded continuity
probe re-recognizes an existing relationship afterwards — so meeting
the same person twice produces one contact, not two, without any
stable identifier travelling.

## What is in this repository

| Path | Content |
|---|---|
| [`spec/encounter-layer.md`](spec/encounter-layer.md) | **RLTP Encounter Layer** — how two people establish, record, and maintain mutual recognition: the one registered ceremony (`encounter-scan`, with a connected path and an offline path and free switching between them), contact cards, challenges, the own-challenge state model, the enactment binding, encounter credentials, edges |
| [`spec/delivery-contract.md`](spec/delivery-contract.md) | **RLTP Delivery Contract** — how documents travel: private Trust Task types (`encounter-bundle`, `delivery-ack`, `encounter-credential-delivery`), the sealed envelope, staged dispositions, delivery promises |
| [`spec/membership-tasks.md`](spec/membership-tasks.md) | **RLTP Membership Tasks** — how membership changes travel: invitation, explicit consent (`membership-invite`, `membership-accept`, `membership-evidence`), the `access-operation` carrier narrowed to the one operation that crosses the replica boundary — the admitting `member.add` delivered to its own subject — with the admission chain (provable invitation provenance), and the welcome seal |
| [`spec/access-layer.md`](spec/access-layer.md) | **RLTP Access Layer** — how a group holds shared authority over its membership, data, and itself: the authority log (a causally linked DAG whose genesis digest *is* the group's identity), policies as group-defined decision rules, epochs that make revocation real, chained quorum-signed authorization views toward services, and the enforcement port that keeps the replication/key-agreement substrate replaceable |
| [`spec/identity-layer.md`](spec/identity-layer.md) | **RLTP Identity Layer** — one root seed, every identity derived: the self context, per-relationship pair anchors, per-group member anchors, derived service identities; contexts never link without their holder's deliberate act |
| [`spec/replication-contract.md`](spec/replication-contract.md) | **RLTP Replication Contract** — the service contract behind the Access Layer's replication port: sixteen promises over individually signed, causally linked entries — attested convergence targets, one ingest admission for every road, immutable verdicts under merge-revisable canonicality dispositions, key-blind by construction; the substrate that moves the bytes stays outside the trusted computing base |
| [`spec/network-visibility.md`](spec/network-visibility.md) | **RLTP Network Visibility** — who may learn that an edge exists: visibility grades, stars, anchor mappings, introductions, and the audience discipline the other layers build on |
| [`spec/personhood-predicates.md`](spec/personhood-predicates.md) | **RLTP Personhood Predicates** — verifier-relative witnessing predicates over encounter credentials: what "a human vouched for a human" can and cannot prove |
| [`spec/succession.md`](spec/succession.md) | **RLTP Succession** (parked draft) — recovering a person's anchor by the act of several people when the seed is lost |
| [`schemas/`](schemas/) | Normative JSON Schemas for every wire artifact |
| [`contexts/`](contexts/) | The pinned RLTP JSON-LD context |
| [`vectors/`](vectors/) | Deterministic test vectors (seal, identity derivation, encounter cards, DTG credentials, visibility) — implementations MUST reproduce them byte-for-byte |
| [`conformance/`](conformance/) | Conformance runner — recomputes every cryptographic claim of the shipped vectors and validates every schema claim; negatives must fail at their declared stage |
| [`interop/ceremonies/`](interop/ceremonies/) | RLTP ceremonies expressed in the ToIP DTGWG ceremony-definition format |
| [`simulator/`](simulator/) | Interactive browser simulator of the full ceremony (both paths, fault injections) + a Node reference engine |
| [`scripts/validate.mjs`](scripts/validate.mjs) | Publication checks: schema compilation, vector recomputation, and conformance fixtures that MUST fail |

## Status

All documents are **Editor's Drafts**. They converge through an
adversarial process: each casting is reviewed by an independent
adversarial reviewer, every finding is triaged and answered, and the
document is fully **recast — never patched**. A layer counts as
converged when consecutive review rounds produce no blocker-level
findings.

**Converged:** Encounter 0.28 · Identity 0.12 · Access Layer 0.52 ·
Delivery Contract 0.22 · Membership Tasks 0.16 · Replication Contract
0.26 · Network Visibility 0.15 · Personhood Predicates 0.12.
Succession 0.2 is parked; the Data layer is not published here yet.

Two things are worth knowing about how this state was reached. The
Access Layer and the Replication Contract converged **jointly**, which
required a review the sequential process cannot perform: a *seam
round*, with both documents open at once, looking for defects at the
boundary between them. And every normative statement is meant to be
vector-testable — the [`conformance/`](conformance/) runner recomputes
every cryptographic claim of the shipped vectors, and negatives must
fail at their declared stage.

What the Access Layer settled on, in its own words: **there are no
admins** (privileged operations are gated by group-defined policy);
**the merge never decides membership** (every admission canonical at
its position is final); **revocation is honest** (a removal carries
its key-world transition atomically, and what rotation cannot
guarantee is stated rather than implied); and **the substrate is a
port** (replication and group key agreement are requirements on a
replaceable adapter).

## Alignment with the ToIP DTGWG

RLTP deliberately aligns with the emerging ToIP Decentralized Trust
Graph work where the two effort meet:

- **Vocabulary:** *ceremony* (definition) / *enactment* (run) / *step*
  follow DTGWG ADR 0001.
- **Co-derived enactment anchors:** the RLTP enactment binding is a
  concrete instantiation of the `coDerived` anchor of the Trust
  Ceremonies design; the DTGWG registry's
  [`mutual-attestation/0.1`](https://github.com/trustoverip/dtgwg-trust-tasks-tf/blob/main/ceremonies/mutual-attestation/0.1/ceremony.json)
  is the upstream expression of RLTP's mutual encounter.
- **Digests:** every digest is a multibase-encoded multihash over
  JCS (RFC 8785), format-identical to `digestMultibase` — emit `u`,
  accept `u`/`z` per W3C CID 1.0.
- **Proofs:** embedded `DataIntegrityProof` with `eddsa-jcs-2022` — no
  RDF processing, offline-verifiable.
- **Messages:** RLTP delivery documents are private Trust Task
  specifications (framework 0.4, §6.5).

Where RLTP differs, it differs deliberately and says why in the
specifications themselves: participant recognition rather than
third-party witness, stable anchors rather than pairwise identifiers,
and honestly stated correlation properties.

## Design principles (the short version)

- **Issuance counts, arrival does not.** Documents may travel for an
  unbounded time; validity is a function of signed issuance-time data.
- **Clock tolerance never rejects.** Real devices drift; every gate
  widens.
- **Validate, then consume.** Nothing consumes single-use material
  before the content fully validates.
- **Authenticity always has exactly one carrier.**
- **Every mechanism names its user action.** The protocol's total user
  actions are two: exchange cards, confirm recognition.

## License

[Creative Commons Attribution 4.0](LICENSE) (CC BY 4.0).

## Contact

Anton Tranelis · mail@antontranelis.de
