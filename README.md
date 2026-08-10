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
| [`schemas/`](schemas/) | Normative JSON Schemas for every wire artifact |
| [`contexts/`](contexts/) | The pinned RLTP JSON-LD context |
| [`vectors/seal.json`](vectors/seal.json) | Deterministic seal test vector — implementations MUST reproduce it byte-for-byte |
| [`interop/ceremonies/`](interop/ceremonies/) | RLTP ceremonies expressed in the ToIP DTGWG ceremony-definition format |
| [`scripts/validate.mjs`](scripts/validate.mjs) | Publication checks: schema compilation, vector recomputation, and conformance fixtures that MUST fail |

## Status

Both documents are **Editor's Drafts**, developed through an
adversarial convergence process: each casting is reviewed by an
independent adversarial reviewer, findings are triaged, and the
document is fully recast — never patched — until a casting pair is
judged **blocker-free and compatibly implementable**. The current pair
(Encounter 0.19 · Delivery Contract 0.17) has reached that criterion —
its final review round returned no findings. Notable in this pair: the
two earlier ceremonies are unified into one with a connected and an
offline path; a formally complete own-challenge state model
(open / recorded / unknown) with a monotone aging latch makes every
acceptance branch deterministic under challenge rotation, races,
restarts, and backward-moving clocks; and sent cards carry `boundTo`
so the optical receiver always knows which of its own challenges an
enactment answers.

The Identity layer (the interim securing profile in Encounter §2.3 will
move there), the Access layer, and the Data layer are in earlier stages
and not yet published here.

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
