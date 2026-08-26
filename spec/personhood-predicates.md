# RLTP Personhood Predicates

**Real Life Trust Protocol — verifier-relative witnessing predicates**

- **Status:** Editor's Draft
- **Version:** 0.12.0-draft (twelfth casting)
- **Editors:** Anton Tranelis
- **Date:** 2026-08-13
- **Vocabulary namespace:** `https://real-life.org/rltp/v1`
- **Conformance profile:** `rltp-predicates@0.12` (draft)
- **Position:** a consumer of the **RLTP Encounter Layer 0.22**
  (normative reference: credential form §7 incl. issuance time
  §7.2 and issuer copy §7.4, evidence direction and counting rule
  §4.2, enactment binding §5.4, participant-local acceptance §5.6,
  pair verification and its honesty §8, Sybil economics §13). P3
  additionally consumes group snapshots supplied by the verifier's
  **RLTP Access Layer** implementation (currently 0.25). This
  document defines **evaluation**, not transport: nothing here
  travels; the presented set reaches the verifier by any channel.
- **Supersedes:** versions 0.11 through 0.1 (archived as
  `archive/personhood-predicates-0.11.md`,
  `archive/personhood-predicates-0.10.md`,
  `archive/personhood-predicates-0.9.md`,
  `archive/personhood-predicates-0.8.md`,
  `archive/personhood-predicates-0.7.md`,
  `archive/personhood-predicates-0.6.md`,
  `archive/personhood-predicates-0.5.md`,
  `archive/personhood-predicates-0.4.md`,
  `archive/personhood-predicates-0.3.md`,
  `archive/personhood-predicates-0.2.md`, and
  `archive/personhood-predicates-0.1.md`).

## Abstract

This document defines how a verifier evaluates **recognition
assertions** — encounter credentials presented by a subject — into
three measures: how many of the asserting anchors the verifier
already knows (P1), which signed instants those assertions carry
(P2), and how many asserters a named group's own admission
discipline vouches for (P3). The **evaluator** is a deterministic,
clock-free, pure function from a defined input model to a defined
result model; the few obligations that inherently need verifier
state — issuing and consuming possession challenges — are defined
as verifier duties *around* the function, never inside it.

The name of this document names the **need** it serves — evidence
of personhood where no authority is in reach — not a claim any
predicate makes. No predicate here says *"this is a human,"* and
no predicate here proves *a meeting took place*: a credential in a
third party's hands is a **signed assertion of recognition**, and
its weight is exactly the weight of the key that signed it
(Encounter §8). Each measure says: **"from this verifier's
standpoint, with the roots it names, this anchor is asserted
thus."** Personhood evidence in RLTP is verifier-relative and
graph-rooted, where issuer-rooted systems make it absolute and
certificate-shaped. Both the strength and the limit of that choice
are stated in this document, in the same breath.

## Status of This Document

This is an **Editor's Draft** with no standing beyond its own
argument. It is developed through the same adversarial convergence
process as the other RLTP documents: every casting is reviewed in
full by an independent adversarial reviewer, findings are triaged,
and the document is recast — never patched — until a casting is
judged blocker-free and compatibly implementable. The companion
documents it builds on have met that criterion: the **RLTP
Encounter Layer 0.22**, the **RLTP Delivery Contract 0.17**, the
**RLTP Membership Tasks 0.11**, and the **RLTP Access Layer
0.25**.

This twelfth casting has been read by that process and is
**converged**: round twelve returned no finding at any level —
blocker, major, or minor — and closed with the reviewer's
explicit statement that nothing further stands in the way of
convergence and that the document is compatibly implementable.
Rounds one to eleven drew 7, 3, 3, 3, 3, 2, 2, 1, 2, 1, and 1
blocker-level findings; every conceptual answer has held since
round three, and the later rounds narrowed through
canonicalization and the possession profile. The ninth casting
attempted a context-binding upgrade to a present-counterparty
claim; review nine showed a verifier-stated value can be relayed
unchanged, so the tenth withdrew the upgrade rather than keeping
it unsound — possession establishes the holder claim and nothing
else, and the channel-binding profile a present-counterparty
verdict would need is Open Issue PP-6.

Known open questions are collected in Section 10. Feedback is
welcome via the issues of the publication repository
(github.com/real-life-org/rltp-spec).

## 1. Introduction (informative)

### 1.1 The two structural facts

Everything here follows from two properties of the RLTP encounter
graph:

**The graph is nowhere.** No global view, no directory, no
crawling. Every person holds their own edges; a verifier learns of
a subject's edges only because the subject **presents** them. This
is a presentation model, not a lookup model: disclosure is the
subject's controlled act, a verifier can anchor its judgment only
in roots it already holds, and every step beyond the first edge
would disclose edges of third parties who were never asked — the
hard boundary that decides which predicates can exist at all
(Section 7).

**Trust does not propagate.** No transitive computation, no
introducer model, no trust depth. An edge is one anchor's signed
recognition of another; what a *set* of edges means is decided by
the **verifier's policy**, never by the graph. This document
defines *measures*, not *thresholds*.

### 1.2 What a presented credential is — and is not

Inside an enactment, the Encounter layer's gates (records,
challenges, issuance windows) bind a credential to a live exchange
— for the two participants. **None of that travels.** A third
party holds no enactment record and cannot check one (Encounter
§5.6 is participant-local by design). What a third party can
verify is exactly this: *a key signed a recognition of this
subject, following the credential form*. Where the subject also
presents its own matching step credential of the same enactment,
the third party can run the Encounter §8 pair verification —
including **recomputing** the shared binding from both challenges
— and learn that *both keys signed reciprocally over one
recomputed descriptor* (the `reciprocal` quality, 4.1). That is
still not proof of a meeting: Encounter §8 states in as many words
that colluding key holders can manufacture a consistent pair. This
document therefore speaks of **assertions** throughout, and every
measure's strength reduces to the trustworthiness of the asserting
keys.

### 1.3 Relation to issuer-rooted personhood

Issuer-rooted systems bind a boolean to a person: an accredited
issuer certifies humanity, governance ensures it happens once.
That serves strangers — anyone can check the boolean — and it
stands or falls with accreditation and global uniqueness, which
are hard open problems. The predicates here claim no uniqueness
and need no issuer. They serve **acquaintances**: a verifier that
already holds roots — its own encounter history, a group it
belongs to — learns something real about a subject asserted by
them. A verifier with no roots learns nothing, correctly. Most
real trust decisions are taken among acquaintances; that is the
ground this document stands on, and its honest boundary.

## 2. Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL
NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED",
"MAY", and "OPTIONAL" are to be interpreted as described in BCP 14
[RFC2119] [RFC8174] when, and only when, they appear in all
capitals.

The **interim securing profile** of Encounter §2.3 applies to
every document evaluated here. Timestamps compare as instants
(RFC3339 UTC, per that profile); this document never derives
durations. **Credential digest** — the multibase multihash over
`JCS(document)` per Encounter §2.2; the equivalence under which
documents are counted here; where this document uses one, it is
normalized to its canonical `u` form. **Local digest rule** — the
digests this document itself constructs (`snapshotId`, the K
digest, `presentedSet`) are, uniformly: the SHA-256 multihash
(`0x12 0x20` followed by the 32 digest bytes) over the UTF-8
bytes of the JCS serialization of the named value, encoded
multibase `u` (base64url, no padding). The rule takes a JSON
*value* and performs the JCS serialization itself; callers hand
it the value, never a pre-serialized string — digesting
`JCS(JCS(value))` is non-conformant. Encounter §2.3 governs
evaluated documents; this rule governs the evaluator's own
constructions — stated separately so neither is stretched.
**Canonical base64url** — wherever this document requires a
base64url value, it means, in full (the Delivery §6.2 rule): the
RFC 4648 base64url alphabet only, no padding character, the
stated length, **zero trailing bits** in the final character, and
round-trip identity `encode(decode(v)) == v`. Any value failing
one of these is not that value in another spelling; it is
non-canonical, and the section defining the value says what
non-canonical means there.

**Subject** — the anchor whose assertions are being evaluated.
**Verifier** — the party evaluating; **evaluator** — the pure
function of Sections 3–5, which the verifier runs. **Asserter** —
the issuer of an encounter credential about the subject.
**Incoming candidate** — a presented document issued *by* an
asserter *about* the subject; the only kind that forms edges
(Encounter §4.2). **Outgoing candidate** — a presented document
issued *by the subject* about an asserter; serves only the
`reciprocal` quality (4.1), never forms an edge. **Presented
set** — the input collection of documents (3.1); deliberately not
named "presentation" — the Access layer's `encounter-presentation`
is a different, operation-bound artifact. **Known-anchor set
(K)** — the set of anchors the verifier already associates with
people it has reason to treat as distinct; its curation is the
verifier's responsibility and P1/P2's entire root (Section 8).
**Group input** — per requested group, either a snapshot (3.3) or
a declared unavailability (5.3). **Edge record** — the
per-asserter unit every measure is computed from (4.1).
**Measure** — a deterministic value over edge records.
**Non-result** — a named outcome from the closed set of 5.3.

## 3. The Input Model (normative, abstract)

The evaluator is a pure function of the following input; no other
information may influence any result field.

### 3.1 The presented set

A finite collection of candidate documents. A candidate that does
not parse as JSON or is not JCS-canonicalizable is excluded with
reason `malformed` before anything else — digesting and size
measurement need canonical bytes, so this is necessarily the first
gate — after one bound that precedes even it: the **raw-size
gate**, a plain length and count check needing neither parser nor
hash. A candidate whose raw input exceeds **8192 bytes**, a
total of the candidates' raw byte lengths exceeding **4 MiB**,
or more than **4096 candidate occurrences before any
deduplication**, yields the whole-evaluation non-result
`input-too-large` before anything is parsed, hashed, or
classified — so no input, however malformed or however
duplicated, makes the evaluator touch unbounded bytes or
unbounded entries. All three bounds are computed over the
candidates themselves — how the collection travelled (its
transport envelope, framing, whitespace) never enters the pure
function; bounding the envelope is the transport adapter's duty,
outside this document's model. Within that gate, malformed candidates
have an identity too: they are deduplicated by SHA-256 over their
**raw input bytes**, so a duplicated malformed input yields one
exclusion, and every count in the result is deterministic over
the whole input. The surviving candidates are counted and
deduplicated by **credential digest** (documents with equal
digest are one document, whatever their serialization). The two
identity spaces never mix, and the **distinct presented count**
is exactly their sum: the number of distinct malformed raw-byte
identities plus the number of distinct credential digests —
`[M, M, V]` with equal malformed bytes presents two distinct
units. Bounds: a distinct presented count above **1024** (that
sum, exactly) yields the whole-evaluation non-result
`input-too-large`; a single document exceeding
**2048 bytes** in its JCS serialization (the Encounter credential
cap) is excluded individually with reason `oversize` and never
fails the evaluation.

### 3.2 Parameters

The subject anchor; the known-anchor set K (possibly empty; bound
into results by digest, 5.2); the **requested groups** (possibly
empty) — a duplicate-free set **identified by `genesisDigest`**
in its canonical `u` form, because the genesis digest *is* the
group identity (Access §3.2): a group DID is an address under
which sibling geneses may coexist, and MUST NOT serve as the
identity here — each with its group input (3.3); optionally a
possession input (3.4) together with the challenge and audience
the verifier issued and stated for it.

**Domain precondition:** parameters — the subject anchor, every K
entry, every requested-group identity, every group input, and the
possession parameters (challenge, audience) — MUST be
syntactically well-formed per their definitions before the
evaluator is invoked; a call with malformed parameters is a
caller error outside the function's domain, not an evaluation
outcome. *Documents* and the *possession input* (3.4) come from
the counterparty: they face the hostile boundary, and they answer
with `malformed` (3.1) and `failed` (3.4) respectively — never
with a caller error.

### 3.3 Group inputs (for P3)

For each requested group, the verifier's Access implementation
supplies exactly one of:

- a **snapshot**: `{ genesisDigest, epoch, heads,
  currencyRoster }` — the **preimage, not a precomputed label**,
  with every field normalized: `genesisDigest` in its canonical
  `u` form and **byte-equal to the requested group identity**
  (3.2) it answers — a mismatch is a caller error outside the
  domain, never a snapshot of "the same group by another
  genesis"; `epoch` the **canonical decimal string** of the
  non-negative integer epoch of the state these heads materialize
  — a JSON string, no leading zeros (`"0"` for zero), no sign:
  JCS-stable at any magnitude, so the snapshot domain is total
  over every epoch Access can reach and no I-JSON number limit
  is smuggled in; `heads` the **complete, duplicate-free** DAG head
  operation id list of a valid Access materialization, sorted by
  unsigned bytewise comparison of the complete `oid:` string's
  ASCII bytes (exactly the Access §3.5 order). The **evaluator
  itself computes** `snapshotId` by applying the local digest
  rule (§2) **to the JSON object**
  `{ "genesisDigest": …, "epoch": …, "heads": […] }` — the object
  itself, never a pre-serialized string of it (§2). The id is
  thereby mechanically bound to its normalized preimage: two
  replicas holding the same DAG produce the same preimage bytes
  and the same id. `currencyRoster` is the policy currency
  (pending exits excluded) of that materialization, as a set of
  anchors. **The fidelity of every preimage field — genesisDigest,
  epoch, heads — and of the roster to the actual materialization
  is the supplying Access implementation's obligation**, named
  here and not verifiable in-evaluator: the Access layer defines
  no externally checkable snapshot artifact, so this binding is
  trust in the verifier's own replica — which is P3's root (4.4);
- or a **declared unavailability**, one of `group-unknown` ·
  `group-unreadable` · `group-forked` · `group-terminal`, which
  the evaluator carries verbatim into the result (5.3), under the
  same requested-group `genesisDigest`.

This makes P3 total: every requested group yields either a measure
or a named non-result, and nothing else.

### 3.4 The possession input (profile)

Predicates evaluate evidence about an **anchor**. Whether the
subject anchor's *key holder* signed this request is a separate
proof — that, and only that, is what this profile can add.
**This profile MUST NOT bind any evaluator or verifier output —
`released(proven)` included — to the submitting party, transport
peer, session, or present counterparty.** **What the proof establishes, exactly:** the
holder of the subject anchor's key signed *this* fresh,
verifier-specific request. **What it does not establish:** which
transport peer delivered it — a live relay (a party forwarding
the verifier's challenge to the real holder and returning the
holder's signature as its own) is indistinguishable at this
layer, and no verifier-supplied co-signed value changes that,
because the relaying party knows every value its own session
carries. Deriving the *submitting party's* identity from a
`proven` is therefore non-conformant, always: a
present-counterparty verdict requires channel-bound
authentication that this profile deliberately does not define —
the channel-binding profile it would take (both endpoints
deriving the binding independently from non-exported channel
state, signers rejecting request-supplied values) is Open Issue
PP-6, not a feature this transport-independent evaluator can
carry honestly.

**The possession input**, when present, is exactly
`{ "signature": … }`: a **canonical base64url string (§2) of
exactly 86 characters, decoding to exactly 64 bytes** — an
Ed25519 signature, nothing else. It is counterparty data at the
hostile boundary: a value of any other length, alphabet, or
spelling — padded, hex, raw bytes, or an 86-character string
with non-zero trailing bits — yields possession status `failed`,
deterministically and before any decoding (length and alphabet
are checkable first, the trailing-bit rule during decode) —
never a caller error.
The evaluator **reconstructs the signed object entirely from its
other inputs** — the profile constant, the verifier-supplied
challenge and audience, the subject anchor, and the presented-set
digest it computes itself (below); the submitting party supplies
no part of the signed object, only the signature over it — and
signing is the subject-key holder's act, whoever submits.

**Verifier duties (stateful, outside the evaluator):** generate a
**challenge** of at least 128 bits of entropy, fresh per
evaluation, never reused. On the wire and in the signed object,
the challenge is a **canonical base64url string (§2)** whose
decoded length is at least 16 and at most 64 bytes; the
**audience** is the **verifier's own anchor** (MUST — an audience
namespace without uniqueness would weaken the gate, §8), carried
as a string. Challenge and audience are verifier-side
parameters (3.2): a non-canonical or malformed one is a **caller
error**, and the evaluator is never invoked with it.

**Challenge lifecycle (bounded, verify-then-consume):** each
challenge moves through `issued → consumed` or
`issued → expired`, nothing else. The verifier evaluates
tentatively — the evaluator is pure, so this commits nothing —
and **releases a `proven` only through an atomic
compare-and-swap `issued → consumed`** at a single serialization
point. A lost swap — the challenge already consumed or expired,
or never issued by this verifier — yields the named verifier
outcome **`challenge-not-outstanding`**. The verifier's release
algebra is closed, two-valued, and **total over the evaluator's
codomain** `EvaluationResult | input-too-large`: the verifier
publishes either **`released(output)`** — the evaluator's output,
exactly as produced, `input-too-large` included — or
**`challenge-not-outstanding`**. There is exactly **one check
point**: the outstanding state is consulted only when releasing
a tentative `proven`, through the swap; **every other evaluator
output is released without touching challenge state** — an
invalid signature against an already-consumed challenge is
`released(possession: failed)`, never `challenge-not-outstanding`.
On a lost swap the tentative result is **discarded and never
published**: not a fourth possession status, not an evaluator
non-result (5.2 and 5.3 are untouched), but the verifier
declining to release. A `failed` evaluation consumes **nothing**:
a junk signature cannot burn an outstanding challenge, and the
holder's subsequent valid proof still lands. Of two concurrent
valid presentations, at most one wins the swap; the other gets
`challenge-not-outstanding`. The verifier MUST bound both the
number and the lifetime of outstanding challenges
(`issued → expired`); that the bounds exist is normative, their
values are deployment policy. Expired, consumed, and
never-issued challenges answer uniformly —
`challenge-not-outstanding` — so the outcome does not disclose
which.

**The signed object (checked inside the evaluator):** the
subject-key holder signs, with the subject anchor (Ed25519), the
UTF-8 bytes of the JCS serialization of

```
{ "profile": "rltp-predicates@0.12",
  "challenge": <the verifier's challenge, base64url no padding>,
  "audience": <the verifier's anchor as stated in its need>,
  "subject": <the subject anchor>,
  "presentedSet": <per the local digest rule (§2), over the
                   array of the presented set's credential
                   digests — the canonicalizable documents,
                   deliberately: malformed bycatch has no
                   credential digest and does not alter this
                   binding — each in its canonical `u` form,
                   sorted by unsigned bytewise comparison of the
                   `u`-string's ASCII bytes> }
```

The signed message is, exactly: the ASCII bytes of the domain
separator **`rltp/v1/possession`**, then a single `0x00` byte,
then the UTF-8 bytes of the JCS serialization of the object above
— fixed framing, so no object byte can be confused with the
separator. **The check is a single signature verification — no
field comparison exists anywhere in it:** the evaluator builds
this object from its own inputs (the profile constant, the
verifier's challenge and audience, the subject anchor, the
presented-set digest it computed), frames it, and verifies the
submitted signature over exactly those bytes with the
subject anchor's key. A signature made over any differing
preimage — another challenge, another audience, another subject,
another presented set, other framing — simply fails that one
verification: `failed`. There are no counterparty-supplied
challenge, audience, or subject fields to compare, and no
equality semantics beyond the bytes signed. Result states:
`proven` / `not-attempted` / `failed` (5.2).

**Scope, honestly:** the presented-set binding ties a proof to
one disclosed set of *credentials* — adding non-canonicalizable
junk to the input does not disturb it, and this document says so
rather than claiming a byte-exact input binding; the challenge ties it to one evaluation of
one verifier *provided the verifier honors its duties above* —
the evaluator is pure and answers for the bytes it is given, so
**a `proven` is a usable result only inside the verifier
conformance class** (exactly-once consumption, §11); a
verifier accepting a challenge it did not issue is non-conformant,
and audience binding rests on anchor uniqueness — which is why
the audience MUST be the verifier's own anchor. Conflating possession
with assertion evidence is the classic mistake this section exists
to prevent.

### 3.5 Admission of candidate documents

Each distinct document is classified independently by **one
executable sequence**; the first failing step names the exclusion
reason, and the closed set has exactly four members:

1. `malformed` — does not parse or is not JCS-canonicalizable
   (3.1; the first *classification* — only the raw-size gate of
   3.1, a whole-evaluation bound and not a classification,
   precedes it);
2. `oversize` — exceeds 2048 bytes in JCS (3.1);
3. `invalid-document` — fails Encounter §7 validation (schema,
   proof under the issuer's anchor, decoded keys, pinned
   context);
4. `unrelated` — the now schema-valid document fits neither lane:
   **incoming candidate** (credential subject = the evaluated
   subject, issuer ≠ subject) nor **outgoing candidate** (issuer
   = the evaluated subject, credential subject ≠ subject). Lane
   determination runs after validation, on a document guaranteed
   to carry both fields — never before, where they may not exist.
   A self-credential (issuer = credential subject = subject) fits
   neither lane and lands here, deliberately.

There are no other reasons; in particular,
this profile evaluates **raw anchors only** — applying succession
resolution and still claiming this profile is non-conformant
(PP-5).

Documents surviving admission are **admitted** (in their lane);
the rest are **excluded** with their reason. Exclusions MUST NOT
fail the evaluation, and an invalid document never affects the
standing of other documents from the same asserter (independent
classification — no slot poisoning). A presented set claims *at
least*, Section 6.

## 4. Edges and Measures

### 4.1 The edge model

From the admitted incoming candidates, the evaluator builds **one
edge record per distinct asserter anchor**:

```
edge := { asserter, instants, reciprocal, documents }
```

- `asserter` — the issuer anchor;
- `instants` — the list of `validFrom` values of that asserter's
  admitted incoming documents, carried verbatim as their RFC3339
  strings and sorted **chronologically by instant value, ties
  broken by unsigned bytewise comparison of the verbatim string**
  (two representations of one instant order deterministically).
  `validFrom` is the credential's **issuance time** (Encounter
  §7.2) — an instant an assertion was signed, nothing about when
  an edge "began"; every admitted document contributes its
  instant, none is discarded;
- `reciprocal` — existentially quantified over both sides:
  `true` iff **some** admitted incoming document of this edge and
  **some** admitted outgoing candidate about this asserter form a
  pair for which the **full Encounter §8 pair verification**
  succeeds — one passing pair suffices, however many other
  incoming documents fail to pair:
  both proofs, reciprocal anchors, each subject's challenge
  binding, and the shared enactment binding **recomputed per
  Encounter §5.4 from the two documents' challenges** — equality
  of two carried binding values is NOT sufficient, precisely
  because a copied value proves nothing;
- `documents` — the credential digests collapsed into this edge.

Edges are a set keyed by asserter: deterministic for any input
order and any duplication. **All credential-derived evidence
factors through the edge set** — this is Encounter §4.2's rule,
*counts edges, never credentials or enactments*, made structural
— **and each measure then takes its named verifier-side inputs:
P1 and P2 additionally take K; P3 additionally takes the
requested group's snapshot and its currency roster.** The same
edge set under a different K or roster is a different
evaluation with different values — nothing may be cached or
reused across those inputs.

**What `reciprocal` is, honestly:** pair verification proves that
*both keys signed reciprocally over one recomputed descriptor*.
Two colluding keys manufacture that trivially (Encounter §8). The
one thing it excludes is a **unilateral** assertion the subject
never countersigned — a reciprocity and consent marker, not
stronger evidence of a meeting. **No measure uses it**; consumers
MAY filter edges on it, and a consumer requiring `reciprocal` is
requiring the subject's own countersignature, nothing more. It
carries no strength order, and Section 6's floor statement is
about measures, which it does not touch.

### 4.2 P1 — Known-asserter count

> **P1(K)** = |{ edges e : e.asserter ∈ K }|

*"n of the anchors asserting this subject, I already know."*
Distinctness is **anchor**-distinctness and nothing more: one
person holding several anchors in K counts once per anchor
(Section 8). Anchors outside K contribute nothing — anchors are
free to create, assertions among unknown anchors are free to
manufacture; what is expensive is an assertion signed by a
**specific, known key** (Encounter §13). P1's root is K, entirely.

### 4.3 P2 — Signed instants

> **P2(K)** = { (e.asserter, e.instants) : e.asserter ∈ K }

*"the assertions I can anchor carry these signed instants."* P2
returns **per-edge instants, never ages** — evaluation is
clock-free; turning instants into durations, and deciding what a
temporal pattern is worth, is the consumer's act with the
consumer's clock and policy.

**This document defines no strength order for P2** — deliberately.
More input is more *information* (Section 6's monotonicity), but
an earlier instant is not automatically more *strength*: a single
backdated entry is exactly what a compromised K-key would produce
(Section 8), so "older is stronger" would reward precisely the
forgery. The robust consumption pattern, stated informatively: a
consumer requiring *m distinct edges* whose instants precede *T*
demands *m* independent keys' histories, which no single stolen
key satisfies. P2 over asserters outside K MUST NOT be computed —
unknown keys' instants attest nothing.

### 4.4 P3 — Contextual assertion

> **P3(G)** = |{ edges e : e.asserter ∈ currencyRoster(G) }|

*"n anchors this group's own admission discipline vouches for have
signed recognition assertions about this subject."* The roster is
the snapshot's policy currency (3.3). **P3's root is not K — it is
G's gatekeeping and the verifier's own replica**: trusting P3
means trusting the group's admission policy and the integrity of
the Access implementation that supplied the roster. That the
verifier can obtain a roster at all means it has, or once had,
access to that group state (membership is member-only state,
Access §3.1/§13) — P3 proves nothing about the verifier's
*current* membership: a removed member may still hold an old
snapshot, and its P3 is correct for exactly that named snapshot.

P3 is the **sibling** of the Access layer's registered
`encounter(count)` rule (Access §4.2), not the same predicate: the
Access rule is evaluated at an operation's causal position during
admission decisions; P3 at a verifier-named snapshot for the
verifier's own purposes. Two verifiers holding different replicas
may compute different P3 — inherent to local-first, and made
comparable: the evaluator-computed `snapshotId` (3.3) names each
evaluation's claimed materialization, and equal snapshotIds mean
the same named DAG. Whether the supplied roster truly is that
materialization's currency is the Access integration's obligation
(3.3) — the id binds the claim, the replica carries the trust.

### 4.5 Composition

Measures MAY be combined by the consumer in any way; this document
defines no composition algebra and no thresholds. Groups wanting
predicate thresholds *as group policy* would need new registered
requirement types in the Access layer's open rule set — a future
registration, not a present capability.

## 5. The Result Model (normative, abstract)

### 5.1 No wire format, one data model

Interoperability happens at the credential level; a result is a
local value. This document defines no serialization for results —
but it defines their **abstract content**, because a result whose
meaning cannot be reconstructed is not evidence of anything.

### 5.2 Result content

An evaluation result contains, at minimum: the profile version
(`rltp-predicates@0.12`) · the subject anchor · the **K digest**
(per the local digest rule of §2, over the array of K anchor
strings sorted by unsigned bytewise comparison of their ASCII
bytes — binding which K produced these numbers without embedding
it) · the edge records of 4.1 (asserter, instants, reciprocal,
document digests) · the counts: the distinct presented count
(the exact two-namespace sum of 3.1), admitted documents per
lane, and excluded documents per closed reason · P1 and P2 for the given K · per requested group, keyed
by its **`genesisDigest`** (the group identity, 3.2, present in
the entry): the computed `snapshotId` and P3, or its declared
unavailability · the
possession status: `proven` / `not-attempted` / `failed` — where
`proven` carries weight only under the verifier class's atomic
challenge lifecycle (3.4): the pure evaluator re-run on the same
bytes returns `proven` again, and it is the consumed challenge,
not the evaluator, that makes replay unusable. A `proven` means
the holder claim of 3.4 and nothing more — it binds the subject
*anchor*, never the party that submitted the proof; there is no
stronger possession class in this profile (PP-6).
Timestamps appear as instants; **no age, duration, or "now" may
appear anywhere in a result.**

A result **contains graph knowledge** — the subject and its
asserters — and Section 9's retention duty therefore applies to
results exactly as to presented documents.

### 5.3 Non-results (closed set)

`input-too-large` (3.1, whole evaluation) · per requested group,
carried from the group input: `group-unknown` ·
`group-unreadable` · `group-forked` · `group-terminal`. A
non-result is distinct from every measure value; in particular,
**`group-unreadable` is not `P3 = 0`**, and implementations MUST
preserve the distinction in their result types.

## 6. What No Predicate Establishes

Presenting any of the following as established is non-conformant.

- **No predicate establishes personhood, and none establishes
  that a meeting took place.** A credential in third-party hands
  is a signed recognition assertion (§1.2); a `reciprocal` edge is
  two consistent reciprocal signatures (Encounter §8). The
  protocol proves key control and signing; humans witness humans.
- **Every measure is a floor over what was presented, bounded by
  what was signed.** The *subject* can withhold, never invent:
  hiding documents can lower measures, and no subject-side input
  raises any **measure** beyond what asserting keys signed (the
  `reciprocal` flag is subject-side and is not a measure, 4.1).
  Whether *asserters* signed truthfully is exactly the trust
  P1/P2 place in K's keys and P3 places in G — issuer-side
  fabrication is not prevented, it is priced (Section 8).
- **Monotonicity is information-monotonicity — of the measures,
  between successful evaluations.** For any two inputs both
  inside every whole-evaluation bound (3.1), adding admitted
  input never shrinks **the measures**: P1 and P3 are
  non-decreasing, and every P2 instant list only gains entries;
  removing input never adds. The order covers P1, P2, and P3 and
  nothing else — possession is deliberately outside it (an added
  document changes the presented-set digest, so a previously
  valid proof fails: correct behaviour, not a violation), as are
  `reciprocal`, every count, and the remaining result fields.
  Crossing a bound replaces the whole result with
  `input-too-large` (3.1) — a non-result, outside the order. For P1/P3 more is stronger; **for P2 this document
  defines no strength order** (4.3) — more entries is more
  information, and its interpretation is policy.
- **No global uniqueness.** One person may hold several anchors,
  each independently asserted — true on the subject side and
  equally on the asserter side (Section 8). These predicates
  measure assertion of *an anchor*, not enumeration of *persons*.
- **A verifier without roots learns nothing.** Empty K yields
  P1 = 0 and an empty P2; no obtainable roster yields P3
  non-results. Correct, and the honest boundary: these predicates
  serve acquaintances and contexts, not strangers.
- **No predicate — possession included — establishes which
  transport peer delivered anything.** A `proven` binds the
  subject anchor (3.4); reading it as authenticating the present
  counterparty is non-conformant without the channel-bound
  authentication this profile does not define (PP-6).
- **Nothing propagates.** An asserted asserter confers nothing
  transitively. There is no depth parameter anywhere in this
  document, deliberately.

## 7. Excluded Predicates (named non-goals)

- **P4 — Asserter independence** ("n asserters not densely
  connected among themselves") is the real collusion measure and
  requires edges *among the asserters* — third-party data the
  subject cannot rightfully present and a verifier can only
  approximate from its own prior knowledge. A future revision MAY
  define P4 as an explicitly approximate, verifier-local measure;
  this version does not, rather than define it badly.
- **P5 — Path distance** is excluded, not deferred: a predicate
  whose evaluation disclosed the social graph of non-parties is
  structurally at odds with the presentation model (§1.1).
- **Zero-knowledge presentation** ("n of my asserters lie in S,
  without revealing which") is the genuine minimal-disclosure
  direction for P1/P3 and belongs to the Encounter layer's OI-5
  presentation work. Named as a direction, not implied as a
  feature.

## 8. Security Considerations

- **Each predicate's root, named:** P1 and P2 root **entirely in
  K's keys**; P3 roots **entirely in G's admission discipline and
  the verifier's replica integrity** (roster fidelity, 3.3). No
  statement in this document may be read as K protecting P3 or G
  protecting P1.
- **K is anchor-distinct, never person-distinct.** One person
  entering K under several anchors counts once per anchor in P1
  and contributes several instant lists to P2. K curation (one
  anchor per person, provenance per entry) is the verifier's
  security work; implementations MUST make K's provenance
  inspectable and MUST NOT merge anchors into K from
  unauthenticated sources. K poisoning defeats P1/P2 before any
  machinery here runs.
- **The Sybil economics are inherited, not improved:** free
  anchors, free assertions among them; expensive assertions from
  **specific known keys** (Encounter §13). A K-anchor asserting
  falsely is a known key lying — possible, and exactly the trust
  being spent.
- **Key compromise beats collusion-talk.** False or backdated
  assertions require a K-anchor's *key*, not its owner's consent;
  signatures do not distinguish owner from thief, there is no
  transparency log, and multiple credentials per issuer are legal.
  Drawn consequences: P2 carries **all** instants and defines no
  strength order, so a consumer can demand *m* independent keys'
  histories (4.3) — one stolen key satisfies one edge, never *m*;
  asserter-anchor compromise is a first-class threat, not only
  subject compromise; and stale evidence about a long-lived anchor
  means both established history *and* a longer compromise window
  — consumers weigh both.
- **Raw anchors only.** This profile does not consult succession
  state (3.5). A person's anchor change therefore splits their
  assertions across anchors until a future succession-aware
  profile (PP-5) defines resolution with person-slot collapsing.
  Stated honestly, per side: across one *subject's* split
  anchors, evidence fragments — under-counting; on the *asserter*
  side, K is anchor-distinct (above), so one natural person
  holding several K-anchors counts several times — deliberate in
  the raw-anchor model, and a consumer reading P1 as a person
  count is making exactly the mistake Section 6 forbids. PP-5's
  person-slot collapsing is what would change both.
- **Possession replay, scoped.** The 3.4 object is single-
  challenge, audience-bound, presented-set-bound, and
  domain-separated. Within conformant verifiers — each issuing
  its own challenges and releasing `proven` only through the
  atomic verify-then-consume swap (3.4) — a captured or
  concurrently re-presented proof is useless, and a junk
  signature burns nothing. **The relay residual, named:**
  exactly-once is all the lifecycle gives — a live relay
  delivering the true holder's fresh signature through another
  party's session is indistinguishable here, and a
  verifier-supplied co-signed value cannot change that (the
  relaying session's endpoint knows that value and forwards it).
  This is why 3.4 scopes the claim to "the key holder signed
  this request" and defers any present-counterparty binding to
  the PP-6 channel-binding profile. **Residual, named:** challenge
  issuance holds verifier state; an unauthenticated party
  requesting challenges and never redeeming them spends the
  verifier's outstanding-challenge budget. The 3.4 bounds
  (count, lifetime) cap the exposure; sizing them, and rate
  limits on issuance, are deployment policy. This is a
  denial-of-service surface, never a predicate-integrity one.
  The residual is named in 3.4: a verifier that accepts foreign
  challenges, or an audience namespace without uniqueness, weakens
  its own gate and only its own.
- **Presented sets are not secrets, and holding one is not
  standing.** Possession establishes only the holder claim (3.4)
  and grants the submitting party no standing and no authority;
  what holding a foreign presented set or result confers is
  knowledge — a privacy consequence, treated in Section 9.

## 9. Privacy Considerations

- **What a presented credential actually discloses — in full.** A
  complete encounter credential reveals its asserter and subject
  anchors, `validFrom`, ceremony identifier, the subject's
  challenge, the enactment binding, any channel hint, and the
  proof with its metadata (`proof.created` among it). Bindings and
  challenges are correlatable with counterpart credentials
  obtained elsewhere. Consumers learn substantially more than the
  measures; this document does not pretend otherwise.
- **Disclosure within this flow is the subject's act** — scoped
  claim: the asserter of every credential also holds a copy
  (Encounter §7.4) and may disclose it independently; nothing here
  restrains issuers. Within the evaluation flow, the subject
  chooses what to present.
- **Stated need first.** A consumer MUST state, before receiving
  any credential: which measures it needs, the K digest it will
  evaluate against, and **which groups** it will request P3 for.
  Evaluating P3 against groups not stated beforehand is
  non-conformant. (Against a malicious verifier this is a
  conformance line, not a shield; the protection is that the
  subject hands over less, guided by the stated need.)
- **Interactive narrowing (RECOMMENDED).** A K digest does not
  tell the subject which of its asserters count (K's contents are
  rightly not disclosed), so minimal presentation needs a flow
  that makes it possible: the subject first offers its **asserter
  anchor list** — anchors only, no credentials, no instants; the
  consumer answers which of them it can anchor (in K, or in a
  stated group's roster); the subject then presents credentials
  for exactly those. The subject discloses its asserter list one
  step earlier, and its credentials — with their instants,
  bindings, and correlatable content — only where they count.
- **P3 discloses context proximity.** Computing P3(G) tells the
  verifier the subject is asserted by G-members — proximity to G.
  Multiple requested groups compose into a profile; the
  stated-need rule makes that composition visible to the subject
  before disclosure.
- **Verifiers accumulate graphs — and results are graphs.** Every
  evaluation enriches the verifier's picture of who asserts whom,
  and a stored result (5.2) preserves the subject-asserter
  relation even after presented documents are deleted.
  Implementations SHOULD NOT persist presented documents **or
  results** beyond the evaluation's need without the subject's
  consent.

## 10. Open Issues

- **PP-2 The K interchange question.** Communities will want to
  share known-anchor sets ("our roster as a K you can adopt") — a
  trust decision with real attack surface (Section 8), related to
  the Access membrane (Access OI-13).
- **PP-3 P4 as approximate measure**, once field experience
  exists.
- **PP-4 Report wire form.** If two independent consumers emerge,
  a minimal serialization of the 5.2 model may be worth freezing.
- **PP-5 Succession-resolved evaluation.** A future profile that
  consults succession state: its inputs, contested-succession
  handling, and person-slot collapsing (one person, several
  anchors, one edge slot). Until it exists, this profile is raw-
  anchor only and says so (3.5, §8).
- **PP-6 Channel-binding profile.** What a present-counterparty
  possession claim would take: verifier and signer as endpoints
  of one authenticated channel, both deriving the binding value
  independently, with a fixed label, from non-exported channel
  state, and signers rejecting any binding value supplied in the
  signature request. Until it exists, possession is the holder
  claim only (3.4, §6, §8).
- *(PP-1, the possession profile, was resolved into §3.4 by the
  second casting; the third bound it to the presented set and
  separated verifier duties from the evaluator; the ninth cast a
  co-signed context value for this purpose and the tenth removed
  it — review nine showed a stated value can be relayed
  unchanged, so the upgrade was withdrawn rather than kept
  unsound.)*

## 11. Conformance

- **Profile** `rltp-predicates@0.12`; normatively references
  `rltp-encounter@0.22` (credential form, evidence direction,
  enactment binding, pair verification); P3 additionally requires
  group inputs per 3.3.
- **Classes:** *predicate evaluator* — the clock-free pure
  function from the input model (Section 3) to the result model
  (Section 5) — and *verifier* — an evaluator plus the stateful
  duties of 3.4 (challenge issue, uniqueness, bounded lifecycle,
  the total two-valued release algebra) and the stated-need flow
  of Section 9.
- **Vector plan:**
  - input bounds and order: an unparseable or non-canonicalizable
    candidate → `malformed`, first and without affecting others;
    the same malformed bytes presented twice → one exclusion
    (raw-byte identity); `[M, M, V]` with equal malformed bytes
    → a distinct presented count of exactly 2 (two namespaces,
    one sum); a possession proof over the
    canonicalizable subset stays `proven` when malformed bycatch
    is added to the input;
    1025 distinct documents → `input-too-large` before
    validation; a single candidate over 8192 raw bytes, the
    candidates' raw lengths summing over 4 MiB, or more than
    4096 candidate occurrences before deduplication (e.g. a
    million empty candidates) → `input-too-large` before parsing
    or hashing anything (raw-size gate); the same candidate set
    yields the same verdict however the collection travelled
    (envelope bytes never counted); a single document over
    2048 bytes in JCS (but within the raw gate) → excluded
    `oversize`, evaluation proceeds; the same document presented
    in two serializations with one credential digest → one
    document in every count; a document that is both invalid and
    lane-less → `invalid-document` (validation precedes lane,
    single executable order);
  - lanes and admission: incoming and outgoing candidates
    classified by issuer/subject relation; a document about a
    third party → `unrelated`; Encounter-invalid →
    `invalid-document` without failing the evaluation; an invalid
    and a valid document from one asserter → the valid one forms
    the edge (no slot poisoning); every closed reason exercised
    and no reason outside the closed set ever produced;
  - edges: one edge per asserter; `instants` = all admitted
    incoming documents' `validFrom` values, sorted; outgoing
    candidates never form edges;
  - reciprocal: full §8 pair verification required — an outgoing
    candidate carrying a **copied binding value** whose
    recomputation from the two documents' challenges fails does
    NOT set `reciprocal`; a genuine pair does; existential
    quantification: incoming `i1` pairing with `o` while `i2`
    does not → `reciprocal = true` (one passing pair suffices);
    reciprocal touches no measure;
  - P1: inside/outside K; empty K → 0; anchor-distinctness (two
    anchors, one person, both in K → both count); the same edge
    set under a different K yields different P1/P2, and under a
    different roster different P3 — nothing keyed by edge set
    alone (4.1);
  - P2: per-edge instant lists for K-edges only; instants only —
    a result containing any age or "now" fails; empty
    intersection → empty P2, not an error;
  - P3: evaluated against the supplied `currencyRoster` — a
    pending exit's assertion does not count; the evaluator
    computes `snapshotId` from the supplied normalized preimage
    (genesisDigest in `u` form, duplicate-free heads in the
    Access §3.5 byte order, §2 local digest rule applied to the
    object) and two implementations given the same DAG produce
    the same id; an implementation digesting the pre-serialized
    JCS string instead of the object (double JCS) produces a
    mismatching id and fails the vector; `epoch` is the canonical
    decimal string — an epoch beyond 2^53 round-trips exactly,
    and `"07"`, `"+7"`, or a JSON-number epoch is a caller error;
    a `z`-form genesisDigest,
    a duplicated head, or a snapshot whose `genesisDigest`
    differs from the requested group identity is a caller error
    outside the domain (3.2), not a second valid id; a sibling
    genesis under the same group DID never answers for the
    requested one (identity is the digest, never the DID); each
    declared unavailability carried into the result under its
    requested `genesisDigest` and distinct from 0 in the result
    type;
  - possession, two boundaries, kept apart: **caller side** — a
    non-canonical verifier challenge (padded, hex, non-zero
    trailing bits) or malformed audience is a caller error, and
    no vector maps it to any possession status; **counterparty
    side** — a valid input → `proven`; absent → `not-attempted`;
    the input is `{ "signature": <86-char canonical base64url> }`
    and nothing else: raw-byte, hex, multibase, padded, 85- or
    87-char values → `failed` before decoding, and an 86-char
    string differing only in its final character's trailing bits
    → `failed` while its canonical spelling of the same 64 bytes
    → `proven` (the pair is a mandatory vector); a signature made
    over a differing preimage — another challenge, audience,
    subject, or presented set — → `failed` by signature
    verification alone, no field comparison; the vectors carry
    the **exact signed bytes** (separator, `0x00`, JCS object) so
    two wallet implementations produce bytewise identical
    messages — the evaluator reconstructs them from its own
    inputs, taking only the signature from the counterparty;
    verifier class: a `failed` evaluation leaves its challenge
    outstanding and a subsequent valid proof → `proven` (junk
    burns nothing); a valid proof re-presented after its
    challenge is consumed → `challenge-not-outstanding`; an
    **invalid** signature against a consumed challenge →
    `released(possession: failed)`, never
    `challenge-not-outstanding` (the single check point);
    `input-too-large` → `released(input-too-large)`; two
    concurrent valid presentations yield at most one released
    `proven`, and the loser's tentative result is discarded,
    never published; an expired challenge answers
    `challenge-not-outstanding`, indistinguishable from consumed;
    the relay shape: the true holder's valid signature submitted
    by another party → `released(proven)`, and the vector's
    documentation states this binds the subject anchor, never
    the submitter (3.4, §6), and confers no authorization on the
    submitting party — a conformant consumer granting the
    submitter anything on its basis fails the vector; the
    presented-set digest is canonicalization-stable — inner
    digests normalized to `u` form and byte-sorted, outer digest
    per the §2 local rule (SHA-256 multihash, `u` multibase), so
    subject and verifier derive one digest from one set whatever
    the presented serializations; every possession status —
    `released(proven)` in the relay shape included — yields a
    counterparty verdict reported as **unbound** (3.4, §6: no
    output of this profile binds the submitting party);
  - result binding: K digest recomputes from the byte-sorted K
    anchors; edge document digests present; instants
    chronologically sorted with the bytewise tie-break;
  - monotonicity (information order of the measures, between
    successful evaluations): for inputs inside every
    whole-evaluation bound, adding an admitted document never
    lowers P1/P3 and never removes a P2 entry; removing one
    never raises P1/P3 and never adds one; the order covers the
    measures only — the same addition flips a previously valid
    possession proof to `failed` (presented-set digest changed),
    which the vector asserts as correct; adding a valid 1025th
    document is not a monotonicity case — it is
    `input-too-large` (§6);
  - determinism: permuting input order and duplicating documents
    changes no result field.
- Every normative statement is vector-testable or explicitly
  marked as consumer policy.

## References

[RFC2119] · [RFC8174] BCP 14 · **RLTP Encounter Layer 0.22**
(credential form §7, issuance time §7.2, issuer copy §7.4,
evidence direction and counting rule §4.2, enactment binding
§5.4, participant-local acceptance §5.6, pair verification and
honesty §8, Sybil economics §13) · **RLTP Access Layer 0.25**
(materialized state and currency §3–§4, membership privacy
§3.1/§13, `encounter(count)` rule §4.2) · RLTP Succession draft
(anchor resolution, future PP-5) · W3C Verifiable Credentials
Data Model 2.0
