# RLTP Succession

**Real Life Trust Protocol — cross-cutting specification**

- **Status:** Editor's Draft
- **Version:** 0.2.0-draft (second casting)
- **Editors:** Anton Tranelis
- **Date:** 2026-08-10
- **Vocabulary namespace:** `https://real-life.org/rltp/v1`
- **Conformance profile:** `rltp-succession@0.2` (draft)
- **Position:** not a layer. Succession is an act performed *on* a
  person's anchor *by* several people, and its consequences reach every
  layer (see Section 1.2).

## Abstract

A person's anchor may change: deliberately, after compromise, or after
loss of the recovery secret. This document specifies how the relations
attached to that anchor survive the change — and how an anchor is
devalued when its key must no longer be trusted.

Authority to declare a succession rests with **guardians** the person
designated in advance — never with possession of a key, because the
holder of a stolen key can sign as readily as the rightful one, and the
rightful one cannot know whether their key was seen. A succession is
complete when enough designated guardians have witnessed, each by their
own human judgment, that the person at the new anchor is the person they
knew at the old one.

Every operation in this document is governed by one principle, the
**direction of operation**: operations that *transfer* authority require
witnessed evidence; operations that only *withdraw* authority may be
self-signed, because withdrawing is monotonically restricting and gains
an attacker nothing.

Succession asserts **human continuity**. It does not assert that the two
anchors share a key holder — that is precisely what cannot be shown when
a key is lost.

## Status of This Document

Second casting, and **parked**. It answers review round 1 (roots W1–W7
as they apply to this document), adds the anchor compromise
declaration, and makes succession evidence portable. Open issues:
Section 12.

It is parked deliberately, not abandoned. This casting was written
against the companion documents as they stood at the time, and it still
names them: it requires `rltp-encounter@0.2`. The stack has since moved
past that — the Encounter Layer, the Delivery Contract, the Membership
Tasks and the Access Layer have each converged through their own review
loops, and none of them depends on this document. Succession therefore
lags its companions by design rather than by oversight, and the version
this document names is the honest record of where it stopped.

Resuming it means a **re-cast against the converged companions**, not a
patch: the requirements this document places on an anchor, on evidence
portability, and on withdrawal have to be re-derived against the current
Encounter Layer before they can be reviewed again. Until that re-cast,
nothing here should be implemented.

## 1. Introduction (informative)

### 1.1 Why authority cannot rest on the key

The obvious design is to let the old key sign the new one. It is also
unsafe, and not marginally so.

An attacker who has seen a key can sign a succession with it. The
rightful holder can sign one too. The two are cryptographically
indistinguishable, and no in-band rule breaks the tie: first-seen
favours whoever acts fastest, which is the attacker who chose the
moment.

The deeper problem is that **key compromise leaves no trace**. A person
cannot know whether their key was copied, so they cannot know whether
self-succession is safe in their case. A mechanism whose safety depends
on knowledge the user cannot have is not a mechanism.

The protocol therefore places the authority where it can be exercised
knowingly: with people who can look at the person and decide.

> The key proves that you control the key. That you are you can only be
> witnessed by someone who knows you.

### 1.2 Why this is not a layer

Succession touches every part of the stack — the anchor changes
(Identity), edges must follow (Encounter), group memberships must follow
(Access) — and it is performed on one person by several. It sits across
the ordering rather than in it, alongside the other cross-cutting
concerns of this family.

It depends on Identity for the anchor and on Encounter for the enactment
form and for the pool from which guardians may be drawn. It deliberately
does **not** depend on Access: recovering an identity must work in the
simplest client, offline, without any authority substrate.

### 1.3 The direction of operation

Every artifact in this document either transfers authority or withdraws
it, and its authority rule follows from that direction:

| Operation | Direction | Authority required |
|---|---|---|
| Succession (2.2) | transfers, to the new anchor | *k* guardians |
| Guardian addition (4.2) | transfers, to the added guardian | anchor signature **+ maturation + no objection** |
| Guardian removal (4.2) | withdraws | anchor signature, immediate |
| Compromise declaration (Section 6) | withdraws | anchor signature, immediate |
| Objection (4.3) | withdraws (voids an addition) | one existing guardian |

A self-signed withdrawing operation is safe even when the key is stolen:
a thief who signs it only restricts the anchor further, which harms the
thief's own position as much as anyone's. A self-signed transferring
operation is exactly what a thief needs, and is therefore never
sufficient on its own.

### 1.4 Recognition is not designation

Having met someone makes them a contact. It does not make them a
guardian. In this protocol an encounter credential says "this person is
real and I met them" and nothing more — a contact list therefore
contains people met once in passing.

Guardianship is a **grant**: deliberate, made in advance, purpose-bound
to this one operation. It is not a trust score, is not transitive, and
says nothing about the guardian's standing.

The user actions of this document are exactly three (1.3 of the
Encounter layer applies): name guardians once, meet *k* friends in the
worst case, and — only when adding a guardian later — the existing
circle is informed. Everything else is machine work.

## 2. Conventions and Terminology

### 2.1 Requirement language

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
"SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and
"OPTIONAL" in this document are to be interpreted as described in
BCP 14 [RFC2119] [RFC8174] when, and only when, they appear in all
capitals, as shown here.

### 2.2 Terms

Permanent identifiers are `https://real-life.org/rltp/v1#<Fragment>`.

**Guardian** — a person deliberately designated to witness the
designator's succession.

**Guardian declaration** — the signed artifact carrying a person's
guardian entries and the threshold *k* (Section 3).

**Guardian entry** — a blinded commitment to one guardian's anchor
within a declaration (3.2).

**Succession request** — the artifact, signed by the new anchor, that
names the succeeded anchor and opens a succession (5.1).

**Succession credential** — the credential in which one guardian records
that the person at the new anchor is the person they knew at the old
one (5.2).

**Succession relation** — the immutable, verifiable relation X→Y
constituted by a complete succession (Section 7).

**Compromise declaration** — the self-signed artifact devaluing an
anchor from now on (Section 6).

**Objection** — a guardian's artifact voiding a pending guardian
addition (4.3).

| Term | Fragment | | Term | Fragment |
|---|---|---|---|---|
| Guardian | `#Guardian` | | Succession credential | `#SuccessionCredential` |
| Guardian declaration | `#GuardianDeclaration` | | Succession relation | `#SuccessionRelation` |
| Guardian entry | `#GuardianEntry` | | Compromise declaration | `#CompromiseDeclaration` |
| Succession request | `#SuccessionRequest` | | Objection | `#Objection` |

Referenced: **Anchor**, **Ceremony**, **Enactment**, **Edge**,
**Encounter credential** *(Encounter layer)*; **recovery seed**
*(Identity layer)*. The interim securing profile of Encounter 2.3
applies to every artifact here.

## 3. The Guardian Declaration

### 3.1 Designation

A person designates guardians by issuing a **guardian declaration**,
signed by their anchor. Each guardian receives a copy together with the
salt of their own entry (3.2).

- A declaration MUST state the threshold *k* explicitly, with `k ≥ 2`,
  and MUST carry at least *k* entries. A threshold of one would restore
  the single point of failure this document exists to remove.
- Because the declaration is signed while the key is available, it
  remains verifiable **after that key is lost**. This is what makes
  recovery possible at all.
- A declaration MUST carry: a format version; a **sequence number**,
  monotonically increasing per anchor; its **issuance time**; *k*; and
  its guardian entries. It has **no expiry**, deliberately: an expiring
  declaration whose key is lost could never be renewed, and expiry would
  destroy the recovery it exists to enable.
- Guardians SHOULD be drawn from the designator's mutual edges;
  implementations SHOULD propose candidates from that set and MUST
  require an explicit act to designate.

### 3.2 Guardian entries are blinded

A declaration does not list guardian anchors in plaintext. Each entry is
`SHA-256(JCS({"anchor": <guardian anchor>, "salt": <s>}))`, multibase-
encoded, with a fresh random salt `s` per entry per declaration. The
designator gives each guardian their own `(entry, salt)` pair with their
copy.

Consequences: the declaration reveals the **number** of guardians and
*k*, but no identities. A guardian proves membership by disclosing their
anchor and salt, which recomputes their entry — and reveals nothing
about the other entries. The privacy promise of Section 11 is a property
of this construction, not an aspiration.

### 3.3 Data model

| Property | Type | Card. | Content |
|---|---|---|---|
| `version` | string | 1 | declaration format version |
| `anchor` | anchor | 1 | the designator |
| `sequence` | integer | 1 | monotonic per anchor |
| `issuedAt` | datetime | 1 | issuance time |
| `k` | integer | 1 | threshold, ≥ 2 |
| `entries[]` | multibase | k..n | blinded guardian entries (3.2) |
| `addedEntries[]` | multibase | 0..n | subset of `entries[]` first appearing in this sequence (4.2) |
| proof | JWS | 1 | signature by `anchor` |

## 4. Changing the Circle

### 4.1 By declaration only

The circle is changed by issuing a new declaration with a higher
sequence number, signed by the anchor. This is possible only while the
key is available — a person who has lost their key cannot change their
circle, only use it. Entries absent from the new declaration are
**removed**; entries listed in `addedEntries[]` are **added**; carrying
an entry forward re-salts it (fresh salt, same anchor) without changing
its status.

Implementations MUST notify the previously named guardians they can
reach of any declaration change. Notification is best-effort and carries
no security weight; the rules below do not depend on it.

### 4.2 Direction: removal is immediate, addition matures

**Removal** withdraws authority. A declaration removing entries is
effective for those removals at its issuance time. No consent, window,
or witness is required.

**Addition** transfers authority — it is the one thing a key thief needs
from this document. An added entry is **immature** until
`addition-maturation` (Section 9) has elapsed after the declaration's
issuance time. A succession credential from a guardian whose entry is
immature at the credential's issuance time MUST NOT count toward
completeness (5.3). Maturity is checked entirely from signed times and
is verifiable by any third party.

*Rationale (informative):* the maturation gate bounds what a stolen key
alone can achieve. A thief can issue a declaration naming their own
guardians, but cannot complete a succession over it for
`addition-maturation` — time in which the rightful holder can issue a
compromise declaration (Section 6) and run a succession with the
existing, mature circle. The gate costs the honest user nothing but
patience they spend anyway: guardianship is designated in advance by
design.

### 4.3 Objection

Any guardian whose entry is mature in the currently applicable
declaration MAY issue an **objection** against a later declaration's
additions, referencing that declaration's digest, within the maturation
window. A verifier holding a valid objection MUST treat all
`addedEntries[]` of the referenced declaration as void. A subsequent
declaration MAY re-add them, opening a fresh maturation window.

An objection withdraws (it voids a pending transfer), so one guardian
suffices and no quorum is needed. A malicious objector can delay
additions; the designator's remedy is to remove them — removal is
immediate — and re-add the intended guardian.

### 4.4 Equivocation

Two distinct declarations from the same anchor with the same sequence
number are **equivocation**. Verifiers holding both MUST exclude both
from evaluation and apply the highest non-equivocating sequence.
Equivocation SHOULD be surfaced to the user as a compromise signal.

### 4.5 Stale views

Propagation is eventual. A removed guardian remains effective toward
verifiers still holding only the older declaration; sequence numbers
bound the window but do not close it (OI-1). Guardians MUST forward a
superseding declaration to the other guardians they know of, when they
learn of them through a succession.

## 5. The Succession

### 5.1 The succession request

A succession begins with a **succession request**: an artifact signed by
the **new** anchor Y, carrying a format version, the succeeded anchor X,
the new anchor Y, its issuance time, and a unique request identifier.
The request is how guardians and verifiers learn which transition is
meant; every succession credential binds its digest, which is what makes
*k* credentials provably parts of **one** succession rather than a
correlated tuple.

The request transfers nothing by itself — anyone can generate an anchor
and request succession from any X. Its digest is a correlation point
among the succession credentials by design: they are meant to be
presented together (11).

### 5.2 The succession enactment

Succession is performed as an encounter enactment between the person at
their new anchor and each participating guardian:

1. The person presents the succession request; request and enactment
   give the guardian the occasion.
2. The guardian verifies, **by their own human judgment**, that this is
   the person they knew at X. The protocol does not constrain the
   judgment; it records it.
3. The guardian issues a **succession credential**:

| Property | Type | Card. | Content |
|---|---|---|---|
| `issuer` | anchor | 1 | the guardian |
| `credentialSubject.id` | anchor | 1 | Y, the new anchor |
| `predecessor` | anchor | 1 | X, the succeeded anchor |
| `requestDigest` | multibase | 1 | digest of the succession request (5.1) |
| `declarationSequence` | integer | 1 | sequence of the declaration the guardian acts under |
| `guardianEntry` | object | 1 | `{anchor, salt}` disclosing the issuer's entry (3.2) |
| `validFrom` | datetime | 1 | issuance time |
| proof | JWS | 1 | signature by the guardian's anchor |

The credential is issued **to Y** (receiver principle); Y collects and
presents them. The enactment binding of the Encounter layer applies
between guardian and Y as for any enactment, and gives the guardian
their local assurance of freshness; it is deliberately **not** part of
third-party verification, which rests on the portable fields above.

### 5.3 Completeness

A succession X→Y is **complete** when a verifier holds:

- the succession request for X→Y;
- the guardian declaration for X that is applicable under Section 4
  (highest non-equivocating sequence known to the verifier, minus
  entries voided by objection or by a compromise pin, Section 6);
- *k* valid succession credentials whose `requestDigest` matches, whose
  disclosed entries recompute against distinct entries of that
  declaration, and whose entries are **mature** at each credential's
  `validFrom` (4.2).

A signature by the old key MUST NOT constitute or contribute to
authority for a succession (1.1). Implementations MUST NOT offer a
succession path that does not require *k* guardians.

### 5.4 Verification algorithm

Given a request, a declaration set, and credentials, a verifier MUST
evaluate, in order, rejecting with the named error:

1. request well-formed, version known, self-signature by Y valid — else
   `ERR_REQUEST`;
2. declaration set reduced per 4.4/4.5/Section 6 to one applicable
   declaration — else `ERR_DECLARATION`;
3. each credential: signature valid — `ERR_SIG`; `requestDigest` matches
   — `ERR_REQUEST_BINDING`; disclosed entry recomputes and is contained
   in the applicable declaration — `ERR_NOT_GUARDIAN`; entry mature at
   `validFrom` — `ERR_IMMATURE`; entry not voided by objection —
   `ERR_OBJECTED`;
4. credentials counted over **distinct** entries; count ≥ *k* — else
   `ERR_INCOMPLETE`.

Each error state is a distinct conformance vector.

## 6. The Compromise Declaration

A person who must assume their key has been seen — or a thief, to no
advantage — MAY issue a **compromise declaration**, signed by the
anchor's own key: a format version, the anchor, its issuance time, and a
**sequence pin**: the highest guardian-declaration sequence the signer
acknowledges as their own.

On verifying a compromise declaration for X, a party MUST, from the
moment of verification:

- cease accepting new artifacts signed by X's key, **except** further
  compromise declarations and nothing else;
- treat guardian declarations for X with sequence **greater than the
  pin** as void for succession evaluation;
- expect and surface a pending succession of X.

Where competing compromise declarations pin different sequences, **the
lowest pin wins**: more withdrawal is the safe direction. A thief
pinning low can revert the applicable declaration to an earlier one of
the rightful holder's own circles — an inconvenience, not a transfer.

A compromise declaration withdraws and transfers nothing (1.3). It does
**not** revoke encounter credentials previously issued by X — those are
testimonies about their moment (Encounter 7.3) — and it does not itself
effect a succession.

**Residual, stated plainly:** artifacts the thief signed *before*
parties verify the declaration, and artifacts with backdated issuance
times, are not distinguishable in-band from honest pre-compromise
artifacts. A compromise declaration acts from now on, never
retroactively. Theft leaves a permanent residue; this document bounds
it, it cannot erase it.

## 7. The Succession Relation: Nothing Is Rewritten

A complete succession constitutes an immutable, portable **succession
relation** X→Y — the request plus the *k* credentials plus the
applicable declaration. Nothing else changes:

- **Credentials are not rewritten.** Credentials issued to or by X
  continue to name X, permanently. A credential for X arriving after
  the succession is accepted under the Encounter layer's rules
  unchanged — it attaches to X.
- **Anchor resolution is computed.** `resolve(A)` follows verified
  succession relations from A to the terminal anchor and is evaluated
  at read time by whoever consumes an edge. Implementations MUST verify
  every hop (5.4) independently, MUST reject cycles, and MUST treat a
  hop that verifies as ambiguous (two complete successions of one
  anchor to different targets, OI-5) as **unresolved** — a Layer-3
  predicate over an unresolved anchor is not satisfied.
- **Presentation follows resolution.** Implementations SHOULD present X
  and Y as one person once the relation is verified, and SHOULD surface
  the change rather than applying it silently — an anchor change is a
  socially significant event.

## 8. What Succession Does Not Do

- It does not transfer credentials; the historical record stands
  (Section 7).
- It does not assert a shared key holder. In the loss case there is no
  cryptographic link between the anchors, and the specification claims
  none.
- It does not repair Access-layer memberships by itself. A group
  learning of a succession must decide, under its own policy, whether
  to admit Y in place of X (OI-3).
- It does not prove that the person was not coerced.

## 9. Time Parameters

| Parameter | Default | Meaning |
|---|---|---|
| `addition-maturation` | P30D | delay before an added guardian entry counts (4.2); also the objection window (4.3) |
| `skew-tolerance` | PT5M | clock-skew allowance on every comparison |

The Encounter layer's parameters (its Section 9) govern the succession
enactments. Declarations and compromise declarations do not expire
(3.1, 6). All comparisons use signed times; no rule references arrival
time. `addition-maturation` MAY be raised by deployment profiles;
lowering it below P7D voids the rationale of 4.2 and is NOT RECOMMENDED.

## 10. Security Considerations

- **Guardian collusion is the threat this design accepts.** *k*
  colluding guardians can move a person's identity. This is the price of
  removing self-succession, and it is bounded by the fact that only
  people the person deliberately chose, at least `addition-maturation`
  ago, can do it. Implementations SHOULD encourage *n* meaningfully
  larger than *k*, and SHOULD notify the designator's contacts when a
  succession is followed.
- **The stolen-key walkthrough.** A thief holding X's key can: sign
  ordinary artifacts (until a compromise declaration lands); issue
  declarations (additions immature for `addition-maturation`, removals
  immediate); issue a compromise declaration (self-harming); pin low
  (reverts to an older honest circle). The thief cannot: complete a
  succession over their own additions before maturation; prevent the
  rightful holder's succession under the pinned honest declaration;
  or forge succession credentials from mature guardians. The bound this
  yields: **a stolen key alone cannot transfer the anchor in less than
  `addition-maturation`**, and the defence within that window is one
  self-signed artifact plus *k* meetings.
- **Circle-stripping.** A thief's declaration removing the honest
  guardians is effective on its face (removal is immediate). The
  compromise declaration's pin voids it, restoring the honest circle;
  until the pin propagates, verifiers with the thief's declaration
  reject honest successions — a denial of service, not a transfer, and
  it ends with the pin.
- **Stale declarations.** A withdrawn guardian remains effective toward
  parties holding an older declaration (4.5). Sequence numbers bound
  the window but do not close it (OI-1).
- **The bootstrap gap.** A person who has designated no guardians cannot
  be succeeded and must start over. Implementations SHOULD prompt for
  designation once a person holds enough mutual edges, and MUST NOT
  present an un-designated identity as recoverable.
- **The human judgment is the security boundary.** Everything
  cryptographic here only records a decision; the decision itself is
  made by a person deciding whether they recognise someone. Guidance to
  guardians matters more than any parameter in this document.
- **Coercion.** A person can be compelled to run a succession, or
  guardians compelled to witness one. The protocol has no defence and
  MUST NOT be presented as having one.

## 11. Privacy Considerations

- The **guardian set is blinded, not merely unpublished** (3.2). A
  declaration reveals *n* and *k*; a verified succession reveals exactly
  the *k* acting guardians, to exactly those who verify it. This is now
  a property of the entry construction.
- The **succession credentials of one succession are mutually
  correlatable** through `requestDigest` — by design, since they are
  presented as a set. A guardian who wishes not to appear in a given
  succession declines to issue; there is no hidden participation.
- A **succession is a visible event** to everyone holding an edge. This
  is intended — continuity is a social fact — but it means an anchor
  change cannot be kept private from one's contacts.
- Designation itself is private between designator and guardian and
  MUST NOT be published or made discoverable.

## 12. Conformance

- **Profile** `rltp-succession@0.2`; requires `rltp-encounter@0.2` and
  its interim securing profile.
- **Classes:** *participant* (declaration, request, enactment, issuance,
  following) · *verifier* (succession verification and resolution only).
- **Deliverables:** JSON Schemas for declaration, request, succession
  credential, compromise declaration, objection; vectors per the plan
  below.
- **Vector plan:** declaration validity including `k ≥ 2`, entry
  blinding, and sequence monotonicity · supersession and re-salting ·
  equivocation exclusion (4.4) · **maturation: rejection at
  `validFrom` < maturity, acceptance after** · objection voiding and
  re-adding · every error state of 5.4 · completeness at *k* over
  distinct entries and rejection at *k−1* or duplicate entries ·
  **rejection of a succession carrying only an old-key signature** ·
  compromise declaration: pin application, lowest-pin rule, post-
  verification rejection of new artifacts · resolution: chain X→Y→Z,
  cycle rejection, ambiguity → unresolved · late-arriving credential
  for X attaching to X.

## 13. Open Issues

- **OI-1 Withdrawal propagation.** Bounding the window in which a
  withdrawn guardian remains effective, without requiring connectivity.
- **OI-2 Succession propagation.** Conflicting or partial views across
  contacts; whether a superseded anchor should remain resolvable.
- **OI-3 Group memberships.** How an Access-layer group follows a
  succession of one of its members, and under whose policy.
- **OI-4 Guardian lifecycle.** Expiry of designations, behaviour when a
  guardian is themselves succeeded, and recovery when *k* guardians are
  unreachable.
- **OI-5 Competing successions.** Two complete successions of the same
  anchor to different targets, produced by disjoint guardian subsets;
  Section 7 defines the verifier behaviour (unresolved), not the social
  resolution.
- **OI-6 Maturation vs. urgent onboarding.** Whether a deployment
  profile can safely shorten `addition-maturation` for a first
  declaration, where no prior circle exists to protect.

## Appendix A (informative): relation to prior work

The guardian-vouching sketch in `wot-spec/research/identity-migration.md`
anticipated this document; that sketch also proposed a self-signed
migration path with "the first migration message wins" as the conflict
rule, which this specification rejects for the reasons in Section 1.1.
The 0.1 casting of this document lacked the compromise declaration, the
maturation gate, entry blinding, and the portable request binding; review
round 1 found the resulting authority chain broken at the declaration
(W1) and succession evidence non-portable (W2).

## References

[RFC2119] · [RFC8174] BCP 14 · [RFC8785] JCS · RLTP Encounter Layer 0.2
(including the interim securing profile) · RLTP Identity Layer (pending).
