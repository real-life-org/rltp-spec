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

All documents are **Editor's Drafts**, developed through an
adversarial convergence process: each casting is reviewed by an
independent adversarial reviewer, findings are triaged, and the
document is fully recast — never patched — until the convergence
criterion (consecutive review rounds without blocker-level
findings) is met. Current converged state: **Encounter 0.28** ·
**Identity 0.12** · **Access Layer 0.52** · **Delivery Contract
0.22** · **Membership Tasks 0.16** · **Replication Contract 0.26**
· Network Visibility 0.15 · Personhood Predicates 0.12
(Succession 0.2 is parked). The Access Layer and the Replication
Contract converged jointly on 2026-08-26 after twenty-five
adversarial rounds, followed by editorial castings and the
receipt cut, each adversarially confirmed.

The Access Layer's convergence took twenty-two review rounds
(22 blockers in its first ported casting, zero in the last two).
Between the last two came a review the sequential process cannot
perform: a **joint seam round**, with the Access Layer and the
Membership Tasks open at the same time and looking for defects at
the boundary between them. Each document answered its own side in
a new casting, and the confirmation round that followed found no
blocker-, major-, or minor-level defects in either direction — the
Access ⇄ Membership seam is closed.

The Encounter Layer's last three castings discharged a debt the
Access Layer had recorded against it: the size cap Access enforces
when it accepts an encounter credential was checked there, but not
guaranteed where the credential is made. Discharging it took more
than the debt note described — the note named two unbounded fields
and there were four — and review then found what the debt had only
hidden: fractional seconds were semantically undefined, so two
conforming implementations could reach different verdicts on
identical input at an aging latch, a future gate, or an issuance
window. Whole-second comparison is now a rule of that document
rather than an assumption about it.

None of that changed a wire form, which is why the Encounter Layer
is at casting 0.22 while its artifacts still carry 0.19: these
castings narrow which values an artifact may hold and fix the
granularity at which it is compared, so a 0.19 artifact is still a
0.22 artifact. The document states what a 0.19 receiver may decide
differently, and by how little.

Notable in that layer's final form: **there are no admins** —
privileged operations are gated by group-defined policy, and
constitutional power is structurally person-independent; **the
merge never decides membership** — every admission canonical at
its position is final, with a closed exception list; **revocation
is honest** — a removal carries its key-world transition
atomically, and what rotation can and cannot guarantee is stated
rather than implied; and **the substrate is a port** —
replication, convergence, and group key agreement are requirements
on a replaceable adapter, with today's deployed linear semantics
as the reference adapter.

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
