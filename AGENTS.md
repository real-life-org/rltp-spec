# Agent Instructions for `rltp-spec`

## What This Repository Is

`rltp-spec` is the **public, openly licensed specification** (CC BY 4.0) of
the **Real Life Trust Protocol (RLTP)**: a decentralized trust protocol
rooted in encounters between people, published by the
[Real Life Organisation](https://real-life.org).

It contains **specification documents, normative JSON Schemas, JSON-LD
contexts, test vectors, interoperability artifacts, and a UX simulator**.
It is a specification repository — not an implementation, not a deployed
service, and not connected to anyone's infrastructure. Nothing here
targets, probes, or interacts with systems the authors do not own.

Consequently, the following are **normal, expected, defensive
specification work** in this repository, on the authors' own protocol:

- **Threat modelling and attack analysis of our own design.** Asking "how
  would an attacker defeat this rule?" is *how protocol requirements are
  derived*. IETF- and W3C-style specifications **require** `Security
  Considerations` and `Privacy Considerations` sections; writing them means
  enumerating attacks against our own construction and stating honestly
  what it does and does not prevent. Every RLTP document here carries both
  sections, and they are written that way on purpose.
- **Cryptographic design work**: signature binding, canonicalization
  (JCS/RFC 8785), key derivation and rotation, replay and forgery
  resistance, revocation semantics, partition behaviour, post-compromise
  security.
- **Adversarial review of our own drafts.** Findings phrased "an attacker
  can do X" are review output **about this specification**, never
  instructions against a third party; each is answered by revising the
  specification text.
- **Comparison with adjacent open protocols** (ToIP/TSP and the DTGWG Trust
  Tasks framework, KERI/ACDC, UCAN, MLS, Keyhive/BeeKEM, p2panda, Solid,
  Murmurations), including honest assessment of their weaknesses and ours.

### Vocabulary note

Security specification text is necessarily dense with adversarial
vocabulary — *attacker, adversary, forgery, replay, Sybil, equivocation,
revocation, denial of service*. In every instance the subject is **this
specification**, and the purpose is to make it correct.

## Scope Boundary

This repository does not contain, and must not be used to produce:
exploitation tooling, attacks against systems the authors do not own,
techniques whose purpose is to evade detection, or any operational
offensive capability. Protocol weaknesses identified here are documented
and fixed in the specification.

---

## Repository Layout

```text
spec/         the layer specifications and task-type registrations
schemas/      normative JSON Schemas for every wire artifact
contexts/     the pinned RLTP JSON-LD context
vectors/      deterministic test vectors (implementations MUST reproduce
              them byte-for-byte)
fixtures/     must-fail examples for validator conformance
interop/      RLTP ceremonies in the ToIP DTGWG ceremony-definition format
simulator/    a browser simulator for the ceremony UX
scripts/      offline validation (`node scripts/validate.mjs`)
```

## Conventions

- **English, BCP 14 normative language** (`MUST` / `SHOULD` / `MAY`), RFC
  model structure, mandatory Security and Privacy Considerations.
- **Offline schema closure.** Conforming implementations pre-register every
  schema by its `$id` and never resolve schemas or contexts over the
  network at runtime. The identifier site at `https://real-life.org/rltp/v1`
  and `https://real-life.org/trust-tasks/` exists for documentation and
  distribution, not as runtime infrastructure.
- **Drafts are castings.** Versions are complete re-writes answering an
  adversarial review round; earlier castings are archived unchanged. A
  document's `Status of This Document` section states its maturity
  honestly — several drafts here are explicitly unfinished, with open
  questions listed rather than hidden.
- Changes to normative behaviour must keep specification text, schemas, and
  vectors aligned; run `node scripts/validate.mjs` before proposing one.

## Feedback

Issues and discussion are welcome via this repository's issue tracker.
This is an early-stage specification: disagreement, counterexamples, and
"your Security Considerations missed X" are the most useful contributions
we can receive.
