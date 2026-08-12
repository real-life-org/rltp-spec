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

## What is in this repository

| Path | Content |
|---|---|
| [`spec/encounter-layer.md`](spec/encounter-layer.md) | **RLTP Encounter Layer** — how two people establish, record, and maintain mutual recognition: the one registered ceremony (`encounter-scan`, with a connected path and an offline path and free switching between them), contact cards, challenges, the own-challenge state model, the enactment binding, encounter credentials, edges |
| [`spec/delivery-contract.md`](spec/delivery-contract.md) | **RLTP Delivery Contract** — how documents travel: private Trust Task types (`encounter-bundle`, `delivery-ack`, `encounter-credential-delivery`), the sealed envelope, staged dispositions, delivery promises |
| [`spec/membership-tasks.md`](spec/membership-tasks.md) | **RLTP Membership Tasks** — how membership changes travel: invitation, explicit consent (`membership-invite`, `membership-accept`, `membership-evidence`), the generic `access-operation` carrier with the admission chain (provable invitation provenance), and the welcome seal |
| [`spec/access-layer.md`](spec/access-layer.md) | **RLTP Access Layer** — how a group holds shared authority over its membership, data, and itself: the authority log (a causally linked DAG whose genesis digest *is* the group's identity), policies as group-defined decision rules, epochs that make revocation real, chained quorum-signed authorization views toward services, and the enforcement port that keeps the replication/key-agreement substrate replaceable |
| [`schemas/`](schemas/) | Normative JSON Schemas for every wire artifact |
| [`contexts/`](contexts/) | The pinned RLTP JSON-LD context |
| [`vectors/seal.json`](vectors/seal.json) | Deterministic seal test vector — implementations MUST reproduce it byte-for-byte |
| [`interop/ceremonies/`](interop/ceremonies/) | RLTP ceremonies expressed in the ToIP DTGWG ceremony-definition format |
| [`simulator/`](simulator/) | Interactive browser simulator of the full ceremony (both paths, fault injections) + a Node reference engine |
| [`scripts/validate.mjs`](scripts/validate.mjs) | Publication checks: schema compilation, vector recomputation, and conformance fixtures that MUST fail |

## Status

All four documents are **Editor's Drafts**, developed through an
adversarial convergence process: each casting is reviewed by an
independent adversarial reviewer, findings are triaged, and the
document is fully recast — never patched — until a review round
returns **no blocker-level findings**. All four have reached that
criterion: Encounter 0.19 · Delivery Contract 0.17 · Membership
Tasks 0.7 · **Access Layer 0.24**, each confirmed by a final round
with no findings.

The Access Layer's convergence took twenty-one review rounds
(22 blockers in its first ported casting, zero in the last two).
Notable in its final form: **there are no admins** — privileged
operations are gated by group-defined policy, and constitutional
power is structurally person-independent; **the merge never decides
membership** — every admission canonical at its position is final,
with a closed exception list; **revocation is honest** — a removal
carries its key-world transition atomically, and what rotation can
and cannot guarantee is stated rather than implied; and **the
substrate is a port** — replication, convergence, and group key
agreement are requirements on a replaceable adapter, with today's
deployed linear semantics as the reference adapter.

The Identity layer (the interim securing profile in Encounter §2.3
will move there) and the Data layer are in earlier stages and not
yet published here.

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
