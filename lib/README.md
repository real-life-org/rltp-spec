# @real-life/trust-protocol

**The Real Life Trust Protocol (RLTP), as running code.** Trust rooted in
encounters between people: two humans meet, recognize each other, and record
that recognition as verifiable credentials. Cryptography proves freshness and
authorship; only a human can witness a human.

This package is the **executable form of the specification** — it lives beside
the schemas and the test vectors it must reproduce byte-for-byte. Published by
the [Real Life Organisation](https://real-life.org) under CC BY 4.0.

- Specification, schemas and vectors: <https://rltp.real-life.org>
- Zero dependencies. WebCrypto only (Ed25519, X25519, HKDF, AES-256-GCM).
- Works in browsers, Node ≥ 20, Deno, Bun. No DOM, no storage, no network:
  the library computes and verifies, the host decides where bytes live.

## Install

```sh
npm i @real-life/trust-protocol
```

## The modules mirror the specification

Each module answers to one document, so a reader of the spec knows where to
look in the code:

| Module | Specification | What it carries |
|---|---|---|
| `core` | across all layers | The canonical form: JCS serialization, multibase encodings, digest equality over *decoded* bytes, whole-second timestamps, calendar validity — and the JSON-Schema subset validator the conformance runner uses. |
| `crypto` | — (primitives) | Hashes, HKDF, key pairs, did:key and multikey renderings, ECDH, and the eddsa-jcs-2022 Data Integrity proof every layer signs with. Answers *how*, never *what*. |
| `identity` | Identity Layer | One root seed, every context derived — community anchor, pair anchor per relationship, member anchor per group. Contexts never link without their holder's deliberate act. |
| `encounter` | Encounter Layer | The ceremony under fresh-always pair anchors: challenges, contact cards, the enactment binding both sides compute independently, encounter credentials. |
| `delivery` | Delivery Contract | The sealed envelope, and the receive chain in its declared order — size bound *before* decryption, envelope form, decryption, parse and digest over the canonical form, completed-effect cache. |
| `carrier-identity` | Identity §7a | The carrier-relationship principal: one Ed25519 control key per (relationship × carrier), derived so that no computable relation to the relationship's other principals or its `rkid` exists — which is why registration must *prove* the binding instead of computing it. |
| `carrier` | Delivery §4.4 + §5a | The carrier side of the port as one transport-agnostic state machine: the five guarantees, the proof rule, the total binding lifecycle (unbound → live → closing → released), the verdict sets in their normative evaluation orders, wind-up and binding tombstones. The clock is injected. |
| `holder` | Delivery §5a + Identity §9.3 | The holder's half: proof construction for all four purposes, the closed verdict set, and the two-exchange recovery flow for a lost carrier entry. |
| `visibility` | Network Visibility 0.29 on Delivery 0.79 | The trust act (`anchor-mapping@2` + `grade-declaration@1`), the blinded star (`star@1`, 5.2a chunks), the admission layer and the 5.4 reconciliation automaton, §6a continuity (probe + mapping — chains instead of duplicates), and the deniable `delivery-ack/0.1`. Namespaced: `visibility.trust`, `.continuity`, `.acks`. Graduated from `/probe` on 04.09.2026 after a 39-round conformance loop. |

Everything is re-exported from the package root; the table is a map, not an
import instruction.

```ts
import { labeledContext, signCard, seal, sameDigest } from '@real-life/trust-protocol'
```

## Two entry points

```ts
import { …, visibility } from '@real-life/trust-protocol'   // wire-normative core
const { trust, continuity, acks } = visibility                // Network Visibility, graduated
import { introduce, membership }
  from '@real-life/trust-protocol/probe'                     // draft — will change
```

The **`/probe` subpath is deliberate.** Its modules exercise the converged
*semantics* of their layers, but their transport shapes carry `@probe` and
are **not wire-normative**: mediated introductions over a rendezvous drop
and group membership (founding, VIC invite, admission, vouching). The
trust act, the blinded star, §6a continuity and the deniable ack **left
this subpath on 04.09.2026** — they are wire-normative now and live under
`visibility` at the package root. Experiment with the rest; do not treat its wire forms
as an interoperability target. A subpath import is a decision someone has
to make — nothing behind it can be reached by accident.

**The redelivery contract of probe receivers:** a receiver's inbound
effect is complete the moment it returns `handled: true` without `error` —
that delivery is cached and answers `duplicate-known` forever after.
Outbound work a receiver triggers (star refreshes, continuity mappings)
is built per recipient and never discards partial results; what failed is
named in `outboundError` / `outbound.failures`, and **redelivering the
inbound document is not the retry path** — re-invoking the producing call
(e.g. `trust.starRefreshAll`) is, and it is the host application's job.

## Versions

This package uses its own semver; the specification uses castings. Each
release states, per module, whose **wire forms** it implements — and what
it deliberately does not:

| Module (0.2.x) | Casting | Implemented | Not in this package |
|---|---|---|---|
| `identity` | Identity 0.50 | context derivation under the closed label registry (§6.1, unchanged since 0.13) with the ordered persona pipeline (§6.2, Unicode 15.0 pinned) | recovery derivation (§5.3), service identities (§7), the label register and its state |
| `carrier-identity` | Identity 0.51 (§7a) | the carrier-relationship principal derivation, identifier validation | the register's generation state (held by the holder's store) |
| `carrier` + `holder` | Delivery 0.79 (§4.4, §5a) + Identity 0.51 (§9.3) | the port state machine, proofs for all four purposes, verdicts, recovery | transport adapters and their policies (a carrier's budgets enter through hooks) |
| `encounter` | Encounter 0.29 — wire `0.25` (`rltp-card/0.25`, `encounter-scan@0.25`) | challenges, both card profiles, the enactment binding, encounter credentials | the ceremony state machine, acceptance rules, ack deadlines |
| `delivery` | Delivery 0.64 | the sealed envelope (§5) and the generic receive stages 1–4 | the type-specific stages, residual bookkeeping, transport adapters |
| `core`, `crypto` | cross-layer | canonical form, digest equality, timestamps, validator; primitives + `eddsa-jcs-2022` proof | — |
| `visibility` | Network Visibility 0.29 + Delivery 0.79 (§3, §4.2, §4.4) | the trust act (`anchor-mapping@2`, `grade-declaration@1`), `star@1` with 5.2a chunk assembly, the admission layer (Section 2), the 5.4 reconciliation automaton with completion via deniable acks, §6a continuity (`continuity-probe@1`, `continuity-mapping@1`, chaining), the registered task documents and `delivery-ack/0.1` with the 4.2 class rule; full §6.2 stage order on every receive path, peek→build→commit issuance on every producer | storage, transport adapters and their policies, the Encounter layer's ceremony flows (still `@probe`) |
| `/probe` | Network Visibility (introductions) · Membership Tasks + Access | mediated introductions, group membership — semantics of the running castings, transport shapes `@probe` | any wire-form stability whatsoever |

Persona-name validation is **pinned to Unicode 15.0** as Identity §6.2
requires: the repertoire ships with the package (`unicode15.ts`, ~5 kB of
ranges) and no platform Unicode data is consulted — the same name derives
the same anchor on every runtime, whatever ICU it carries.

## The contract: the vectors

A version that does not reproduce `vectors/` byte-for-byte is not a valid
version — the conformance runner checks every cryptographic claim, and every
negative case must fail at its declared stage. If you implement RLTP in
another language, those same vectors are how you check yourself; you do not
need this package to do it.

## License

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — specification and
reference implementation alike.
