# RLTP Network Visibility

**Real Life Trust Protocol — cross-cutting: Network Visibility**

- **Status:** Editor's Draft
- **Version:** 0.15.0-draft (fifteenth casting)
- **Editors:** Anton Tranelis
- **Date:** 2026-08-24
- **Vocabulary namespace:** `https://real-life.org/rltp/v1`
- **Conformance profile:** `rltp-visibility@0.15` (draft). Wire
  artifacts: `star@1` · `grade-declaration@1` · `anchor-mapping@2` ·
  `self-card@1` · `continuity-probe@1` · `continuity-mapping@1` ·
  `introduction-request@1` · `introduction-reply@1` ·
  `introduction-ack@1` · `introduction-voucher@1`.
- **Companions (pinned):** **Identity 0.11** (`pair/` registry §6.1 —
  REQUIRED; Identity has since moved to 0.12 by one added pair
  occasion, upward-compatible) · **Encounter 0.28** (fresh-always
  enactment, wire 0.25 — §6a here is the other half of its §4.4) ·
  Access and Membership were read-only at casting time (0.25/0.11);
  **their recast — the M-DID loop — has since landed** (Access
  0.30, Membership 0.16, Delivery 0.21), and Delivery's §4.4
  registry discharged the registration debt of 8.1, including the
  `ack-delay` publication path (`registry-declaration/0.1`).
- **Supersedes:** version 0.14 (archived as
  `archive/network-visibility-0.14.md`) and castings 0.13–0.1,
  archived alongside it.
- **Source material:** `design/visibility-publikumsprinzip-2026-08.md`
  · `design/mdid-bindung-2026-08.md` ·
  `design/visibility-review1/2-2026-08.md` ·
  `design/joint-pair-seam-review1…12-2026-08.md` (the round-12
  finding answered by this casting).

## Abstract

This document specifies who gets to see what about the edges of the
trust graph: which artifacts are provable to whom (the audience
principle), how knowledge about one's contacts may travel (the
star), how anchors of one person are linked for exactly one
addressee (anchor mapping), how one relationship persists across
fresh-anchor enactments (continuity), and how strangers become
contacts (the introduction act).

Its central commitment: **links between anchors are the protected
good.** Everything here is cryptographically authenticated, but only
artifacts whose purpose is presentation are transferably signed.
Everything else convinces exactly its addressee and no one further.

## Status of This Document

Fifteenth casting, answering joint round 12 — **the block's first
blocker-free round**: round 12 confirmed the act machine total
against every arrival permutation and returned a single major.
This casting is surgical (the precedent is Encounter 0.28): the
retention set now names the **accompanying card documents** of
the produced and accepted payloads — at least their verified card
anchors — because the `requesterPair`/`targetPair` comparisons of
8.2 and 8.5 consume them after acceptance, and the artifact list
is stated payload-honestly (a forward is a payload of
`introduction` and `card`, not a body of its own). Everything
else stands as cast in 0.14.

The key words MUST, MUST NOT, SHOULD, and MAY are to be interpreted
as described in BCP 14 (RFC 2119, RFC 8174) when, and only when,
they appear in all capitals.

## 1. Introduction (informative)

The founding incident: Hans has one contact, Peter. One trust act
of Peter's delivered three foreign self anchors to Hans as
"unknown" contacts — people who never met Hans and never chose him.

An anchor is a capability: a tag test key, a correlation point, a
recognition mark. Deniability of a relationship claim does not
protect the anchor itself — a data collector buys keys, not claims.
The rule this document enforces everywhere:

> **Whoever issues an anchor decides, per recipient, who gets to
> see it.** No holder of my anchor may forward it on my behalf.

Consequence, decided for the whole protocol: **there are exactly
two ways to gain a new contact — a real-life encounter (Encounter
0.26) or the introduction act (Section 8).** No artifact of this
document transports a **standing** anchor of a third party to
anyone. Fresh anchors created by their own issuers for a new
relationship are the rule working, not an exception to it.

## 2. Terminology

- **Anchor** — a context identifier of an identity (Identity 0.11
  §5, §6): the self context, or a `pair/…`, `group/…`, `persona/…`
  context.
- **Anchor classes (DTGWG-aligned naming):** **R-DID** =
  pair-context anchor (pairwise, no correlation) · **P-DID** =
  persona anchor (intentional correlation) · **S-DID** = the self
  anchor — the stable coordinate across a person's relationships,
  disclosed selectively per recipient (RLTP's extension to the
  DTGWG ladder) · **M-DID** names the *class* "per-community member
  identifier"; at this document's casting time membership still
  bound the S-DID — the M-DID direction of 9.4 has since been
  implemented by the Access/Membership recasts (the M-DID loop).
- **Promotion** — the trust act of a holder toward one of their
  contacts; the UI surface of promotion and of S-DID disclosure is
  the **Trust** act.
- **Star** — the artifact by which a sender lets one recipient
  relate the sender's contact set to the recipient's own (Section
  5).
- **Deliverable set** — for one recipient: the contacts who have
  promoted the sender, each under its effective grade (5.5).
- **Tuple** — the pair `(own pair anchor, counterpart pair anchor)`
  of one enactment or introduction. Fresh-always enactment creates
  a fresh tuple every time.
- **Relationship** — a holder-local chain of tuples with exactly
  one **active head** (6.4). Per-tuple state: star salts, probe
  sequences, grade revisions, mapping state. Chain-level facts:
  provenance, evidence accumulation, contact memory.
- **Record side** — of one fresh tuple: the party whose new pair
  anchor is lexicographically smaller (byte order of the `did:key`
  strings); deterministic, known to both the moment the tuple
  exists (6a.4).
- **Prior-candidate set** — of one fresh tuple, per party: the
  snapshot, taken when the fresh tuple was created, of the
  relationship heads then active — excluding the fresh tuple
  itself (6a.2, 6a.4).
- **Act** — one run of the introduction protocol, identified by
  its **act id alone** (8.1); `issuedAt` — carried by the act's
  request — is the act's lifetime datum, not an identity
  component. Per-role lifecycles and an absolute lifetime (8.1).
- **Resolver class** — of one *publication*: the set of parties
  able to make use of that publication (Section 4).
- **Audience class** — P, V, or D per Section 3, assigned per
  artifact, never per act.
- **DV** — designated-verifier: verifiable only with the
  addressee's secrets; the addressee could have forged it; third
  parties cannot even check it.

### 2.1 Common wire conventions (normative)

Every artifact is a JSON document `{ "body": { … }, "proof":
{ … } }`.

- **body** carries `type` (the versioned artifact name) and the
  fields its schema closes. **Unknown members anywhere MUST be
  rejected** — every schema is closed.
- **proof** carries exactly the members the type names: `mac`,
  `mac1` + `mac2`, or `proofValue`.
- **Canonical bytes** are `JCS(body)` (RFC 8785) — the body object
  only, never the envelope, never the proof.
- **Signatures** (`proofValue`) are **raw Ed25519 over the
  canonical bytes** (RFC 8032), encoded `z` + base58btc (65–89
  characters). Stated plainly: this is not a W3C Data Integrity
  suite; Encounter cards keep their own DI proofs — two artifact
  families, deliberately distinct.
- **MAC** is HMAC-SHA-256 over the canonical bytes; encoded `u` +
  43 unpadded base64url characters (44 characters in total).
- **Digests** — every digest of this document (`cardDigest`,
  `requestDigest`, and any digest equality it names) — are
  **sha2-256 multihashes**: the two prefix bytes `0x12 0x20`
  followed by the 32 SHA-256 bytes, encoded `u` + 46 unpadded
  base64url characters (47 characters in total). The preimage is
  the JCS of the digested document: for artifacts of this document
  that is the canonical bytes of the **body**; for an **embedded
  Encounter card** — which is a closed root document with its own
  DI proof, not a `{body, proof}` envelope — it is the **complete
  card document, including its `proof`**. The digest binds the
  **canonical** document (JCS), never the incidental transport
  serialization; the card's validity is checked by Encounter's
  own DI rules (8.2), never by the digest. No other digest suite
  exists in this profile.
- **KDF** is HKDF-SHA-256, salt empty, output 32 bytes,
  exact-ASCII info strings.
- **ECDH** is X25519 over Identity §5.2 key-agreement keys; an
  all-zero shared secret MUST be rejected before key derivation.
- **Anchor bytes** are the UTF-8 bytes of the anchor's `did:key`
  string.
- **Timestamps** (`issuedAt`) are UTC RFC 3339 `Z` form, at most
  three fractional digits. The schema pattern enforces calendar
  value ranges — month `01`–`12`, day bounded per month (no `31`
  in a 30-day month, no `30` or `31` in February), hour `00`–`23`,
  minute and second `00`–`59` — with **one named remainder:
  `02-29` is admitted in every year**; leap-year arithmetic does
  not belong in a pattern. A producer MUST emit a calendar-valid
  RFC 3339 date; a verifier MUST reject a date its RFC 3339 parser
  refuses — the schema admits exactly the named remainder beyond
  the RFC set, nothing more. A leap second is not representable
  and MUST NOT be emitted. **Time comparisons of this document**
  (act lifetime and ack windows, 8.1/8.4) truncate every operand,
  including `now`, to whole seconds toward the past, and every
  tolerance widens acceptance — this document's own rule, stated
  here because Encounter §2.3's comparison rule explicitly does
  not reach into companions' own windows.
- **Integers on the wire** (`salt`, `seq`, `probe`, `revision`,
  `count`) are JSON strings: base-10, no leading zeros, no sign,
  no exponent, **at most 18 digits** (domain 0 … 10¹⁸−1; `salt`,
  `seq`, `probe`, `revision` ≥ 1; `count` ≥ 0). The schema pattern
  enforces the full domain — schema and prose admit the same set.
- **Multibase canonicality:** every `u…`/`z…` value MUST re-encode
  byte-identically; a value whose canonical re-encoding differs is
  malformed. Equality of MACs, act ids, and digests is byte
  equality of canonical encodings.
- A consumer MUST reject any `type` it does not implement —
  explicitly including `anchor-mapping@1` and every unknown
  version. There is no version negotiation.

## 3. The audience principle (normative)

For every artifact, two questions decide its cryptographic form:
**(F1)** whom must the statement convince for its purpose to be
fulfilled? **(F2)** must the recipient be able to pass it on?
Provability MUST be the smallest set the purpose demands. The
default is deniable (DV); a transferable signature is the exception
that carries the burden of justification.

- **Class P (presentable).** Statements about myself whose purpose
  is showing: persona profile (audience: everyone), membership
  document (audience: roster readers), the self card and the
  contact card (audience: the parties I hand them to — addressing
  material). Transferably signed. Only class-P artifacts are called
  **credentials** or cards.
- **Class V (links).** Every statement that **connects two contexts
  of one person**: the anchor mapping, the continuity mapping,
  group mappings, the introduction voucher. Always DV; a
  cross-context link MUST NOT exist anywhere as a transferable
  proof. **Boundary, stated precisely:** a key binding *within* one
  context (the self card — Ed and X key of the same context) is not
  a link; it is class P with the possession residue Section 11
  names.
- **Class D (statements about third parties).** Stars, continuity
  probes, and introduction requests. The proof axis is not enough,
  because the knowledge itself harms (the collector argument);
  class D therefore adds content grading/blinding (Sections 5, 6a).

Authentication and audience are orthogonal: every artifact travels
end-to-end encrypted and channel-authenticated.

## 4. The publication-space rule (normative)

Principle (register no. 2), total and decidable:

1. **Scope.** The rule governs class-V and class-D artifacts and
   every publication of a standing artifact into a shared context.
   **Class-P artifacts are exempt by class**: their audience is
   declared by their purpose (a persona surface is deliberately
   unbounded; a card is handed, not published), and handing them is
   an issuance act under Section 3, not a publication under this
   rule.
2. **Candidate spaces**, closed list, with member sets: a **group
   space** (members: the group's current members per
   Access/Membership at the snapshot) · a **pair channel** (members:
   the two relationship parties) · a **persona surface** (members:
   unbounded — admissible only for class P).
3. **Snapshot.** The resolver class of a publication is evaluated
   at publication time. Later growth obliges nothing (register
   no. 5); later shrinkage is the space's own epoch/rekey business
   (Access), never the artifact's.
4. **Choice.** The publisher MUST choose a candidate space that
   contains the resolver class and is minimal by member-set
   inclusion among candidates that do. Where several incomparable
   minimal spaces exist, the publisher MAY choose any one; each
   further space is a fresh publication decision.
5. **Transport is not publication.** A delivered artifact is
   governed by its addressee binding, not by this rule.

Applied: a group member's self-anchor tag is published into the
group space — its resolver class (co-members holding that anchor)
lies within the group at publication time. World publication of
that tag is a violation.

## 5. The star (normative)

### 5.1 Standing contents: count or blinded — nothing else

A star carries, per affected contact, one of exactly two standing
forms:

- **Count** — inclusion only in the aggregate number. No anchor or
  intersection leak; cardinality and delivery metadata remain
  (Section 11). Freely claimable, therefore zero credibility.
- **Blinded** — the anchor travels as `HMAC(k, anchor bytes)` under
  the delivery key of 5.2.

A raw third-party anchor MUST NOT appear in any star. There is no
standing "show" grade: disclosure of an anchor to a stranger
happens only as the introduction act (Section 8). An implementation
that emits raw third-party anchors in a star is nonconformant.
`count` is the number of **all** deliverable contacts (count-graded
and blinded-graded together); the assembled union of `blinded[]` is
the blinded-graded subset, so `|union| ≤ count` is the consistency
rule (5.2a). Duplicate entries MUST NOT be emitted; the union is
globally sorted (5.2a).

### 5.2 star@1 — directional epochal blinding

Body: `{ "type": "star@1", "salt": <int-string>, "seq":
<int-string>, "last": <boolean>, "count": <int-string>, "blinded":
[ <mac encoding> … ] }`. Proof: `mac` under `k` — the same key
blinds and authenticates; the artifact stays recipient-forgeable by
construction.

- `salt` is the delivery sequence of this relationship
  **direction**: starting at 1, strictly increasing, persisted
  **atomically before** send. After state loss, a sender without a
  recovered high-water mark from its synchronized state MUST NOT
  resume delivery under the old tuple — the subscription re-forms
  on the relationship's next tuple (6.4), never by guessing.
- The recipient MUST persist, atomically and per tuple, the highest
  **completed** salt, and MUST reject any delivery whose `salt` is
  not strictly greater.
- **Directional key:** `k = HKDF(ikm = X25519(pairX_sender,
  pairX_recipient), info = "rltp/visibility/blind/star/" ||
  senderPairAnchor || "/" || recipientPairAnchor || "/" || salt)`
  with both anchors as anchor bytes and `salt` in its wire string
  form. The two directions of one relationship never share a key.

Properties, with their honest limits:

- **Intersection only:** the recipient can test entries against
  anchors it legitimately holds; no new anchor reaches it.
- **No veracity.** The star is a **claim by the sender**: the
  sender knows `k` and can omit, fabricate, or equivocate entries
  per recipient. A hit proves that both parties **hold** the
  anchor — nothing about any relationship of the sender.
  Fabricating a hit itself requires holding the target's anchor,
  which is already a capability. Consumers MUST NOT treat a star as
  evidence of the sender's relationships.
- **Collusion:** values under different `k` are not comparable;
  unknown anchors are not extractable or linkable across
  recipients. NOT prevented: colluders pooling *known* anchors and
  keys can enrich retained snapshots by dictionary test.
- **Deniability is free:** a MAC under a shared key.
- **Longitudinal tracking** of opaque entries dies with unique
  directional salts — normative on both sides. Residue: anchors
  learned later remain testable against retained snapshots
  (construction-independent).

### 5.2a Chunking (normative)

One delivery MAY span several chunks under one `salt`: `seq` runs
1…n, exactly one chunk carries `last: true`. Rules:

- A chunk MUST stay within the Delivery Contract's 65 536-byte
  plaintext limit; `blinded[]` per chunk is capped at 1024 entries
  (measured: a maximal 1024-entry chunk serializes to 48 328 bytes
  JCS). There is **no bound on total contacts**.
- **Global order:** the sender sorts the full entry union once,
  lexicographically, and slices it into chunks in order.
- `count` MUST be identical in every chunk of one delivery.
- The recipient assembles per (tuple, salt). A repeated `seq` that
  is **byte-identical** to the held chunk is ignored (delivery
  retries are normal); a repeated `seq` with different bytes
  rejects the delivery. More than one `last`, differing `count`
  values, missing `seq` after `last`, entries out of order across
  the union, duplicates across chunks, or `|union| > count` reject
  the delivery.
- **One open assembly per tuple:** a chunk with a higher `salt`
  discards any incomplete older assembly. Only a **completed**
  delivery advances the accepted salt; assembly retention follows
  the Delivery Contract's retention rules. Withholding `last`
  starves that delivery and occupies the single assembly slot until
  a newer salt arrives — nothing else.

### 5.3 The star MUST NOT be signed

A transferable signature would make "these values are this
person's circle" provable to third parties once `k` leaks.
Forgeability is a requirement, not a defect. Credibility beyond the
addressee, if ever needed, is a DV-ZK predicate (9.3), never a
signature.

### 5.4 Subscription — delivery on set change only

A sender MUST deliver a new star when and only when the deliverable
set for that recipient changes: a new promotion of the sender, an
effective-grade change, a departure. A new encounter that does not
change the deliverable set MUST NOT trigger delivery — the event
itself is metadata the subscription must not broadcast. Pausing
stops future deliveries; delivered snapshots remain (revocation of
distribution, not of possession).

**Transition atomicity:** when a promotion creates a new
deliverable contact, the sender MUST deliver exactly one star for
that change: after the contact's grade declaration is verified, or
after the declaration window `grade-wait = PT24H` elapses (then
under the fail-closed grade). No interim delivery under a
provisional grade.

### 5.5 grade-declaration@1 — DV, fail-closed, threat model stated

The count/blinded choice belongs to the affected contact and
travels as a DV artifact to the holder.

Body: `{ "type": "grade-declaration@1", "subject": <affected pair
anchor toward the holder>, "holder": <holder's pair anchor toward
the subject>, "grade": "count" | "blinded", "revision":
<int-string>, "issuedAt": <timestamp> }`. Proof: `mac` under
`k = HKDF(ECDH(pairX_subject, pairX_holder),
"rltp/visibility/mac/grade/" || subjectPairAnchor || "/" ||
holderPairAnchor)`.

- Revision scope and rules per 6.4 (generic rule).
- **Effective grade:** the grade of the highest verified revision;
  absent any verified declaration — none received, MAC failure,
  unknown version — **count**.
- **Threat model, stated honestly (this is DV):** the holder is the
  designated verifier and can compute every MAC — the declaration
  does not and cannot constrain a malicious holder. What it
  provides: third parties cannot fabricate or verify declarations,
  and an honest holder cannot be confused about the subject's
  choice by transport tampering (fail-closed default plus the
  equivocation rule). Against a malicious holder the protection is
  structural: the star travels only to the holder's own recipients
  and carries no veracity (5.2). Suppression: withholding a newer
  revision keeps the older verified state active (initially count).

The default experience remains one human question: the **Trust**
act issues `grade: "blinded"` — the spec offers the granularity,
the default UX collapses it (register no. 3).

## 6. Anchor mapping (normative)

### 6.1 Purpose and construction

`anchor-mapping@2` links a pair anchor to the self anchor of the
same person for exactly one addressee — a **double-DH MAC
construction in the Signal pattern**, entirely in WebCrypto.

Body: `{ "type": "anchor-mapping@2", "pair": <sender's pair anchor
in this relationship>, "self": <sender's S-DID>, "to": <addressee's
pair anchor in this relationship>, "card": <self-card@1 document,
6.2>, "revision": <int-string>, "issuedAt": <timestamp> }`.

Proof: `mac1` under `k1 = HKDF(ECDH(pairX_sender, pairX_addressee),
"rltp/visibility/mac/map1")` and `mac2` under `k2 =
HKDF(ECDH(selfX_sender, pairX_addressee),
"rltp/visibility/mac/map2")`, both over the canonical bytes.

### 6.2 self-card@1 — binding, not link; residue named

`{ "body": { "type": "self-card@1", "anchor": <S-DID>,
"keyAgreement": <X25519 multikey> }, "proof": { "proofValue":
… } }` — signed raw-Ed25519 under `anchor` per 2.1. It binds the
Ed25519 and X25519 keys of the **same self context**; it links no
two contexts (class boundary, Section 3) — but it is **not
harmless**: it carries the stable anchor and authentic addressing
material. After disclosure, the addressee can pass it on; rule §1
governs issuance, not possession (Section 11).

### 6.3 Verification — the closed condition list

The addressee MUST accept an anchor mapping only if **all** of the
following hold, evaluated in this order; the unclaimability
property exists only as their sum:

1. envelope and schema valid, `type` implemented (2.1);
2. `body.to` equals the addressee's **own active pair anchor** of
   the relationship the mapping arrived on;
3. `body.pair` equals the **counterpart's pair anchor** of that
   same tuple, as held from the ceremony or introduction;
4. `card` verifies as `self-card@1` under **its own** `anchor`;
5. `card.anchor == body.self` — the card is the claimed self, not
   merely *a* valid card;
6. `k2` is derived from **`card.keyAgreement`** — the key the card
   binds, never a key claimed elsewhere;
7. both ECDH outputs are non-zero; both MACs verify;
8. `revision` per 6.4.

With 2–7 in place: foreign self anchors are unclaimable (the card
is unsignable, `k2` uncomputable), the addressee can still forge
the whole artifact (deniability preserved), and third parties can
verify nothing.

## 6.4 Tuples, chains, revisions — the relationship lifecycle (normative)

**State is per tuple.** Star salts, probe sequences, grade
revisions, and mapping state are indexed by tuple. An artifact
addressed to a pair anchor that is not the active head of any
current relationship MUST be rejected — with exactly two
exceptions: **(a)** continuity verification evaluates `prior`
against the fresh tuple's **snapshotted prior-candidate set**
(6a.4) — a bounded read of tuples that were active heads when the
fresh tuple was created, never of deeper chain history; and
**(b)** artifacts of an introduction act pinned to a tuple before
its deactivation remain verifiable under the pinned keys within
the act's bounded lifetime (8.1); the pin freezes keys, not state,
and dies per the 8.1 pin rules.

**Chaining has exactly one trigger, defined in 6a.4 and nowhere
else.** This section only states the append mechanics: a chain
append is atomic with the deactivation of the prior head and MUST
be persisted before acted upon; **processing the same chaining
event more than once MUST be idempotent — a double append of the
same tuple onto the same chain is one append.** Deactivated tuples
accept no new artifacts (exceptions above). Per-tuple state does
not migrate: grade and star begin fail-closed on the new tuple;
provenance and evidence are chain facts and carry over (8.6).

**Reset.** A party that cannot answer the continuity probe is,
protocol-wise, a new relationship (Identity §9.3: re-created, not
recovered). Old mappings die with their tuples and cannot be
re-attached.

**The generic revision rule** for every revisioned type (grade
declaration, anchor mapping, continuity mapping), within its
scope: a higher revision wins; an equal revision with
JCS-identical body is idempotent (a repeat, ignored — which is
also what makes resends harmless); an equal revision with a
different body is an **equivocation error** — reject and keep
current state; a lower revision is rejected. Scopes: grade per
(subject, holder) tuple · anchor mapping per (pair, to) — `self`
is content, correctable by higher revision · continuity mapping
per (next, to) per sender — `prior` is content, and **for the
record side it is frozen**: a record-side mapping whose `prior`
differs from that side's first verified mapping for the same
(next, to) is an equivocation error **whatever its revision**
(6a.4); the non-record side may re-issue with a higher revision to
align.

## 6a. Continuity (normative — the other half of Encounter §4.4)

Fresh-always enactment means every ceremony creates a fresh tuple.
Whether it was a **re-encounter** is resolved here, after the
ceremony — automatically, with no user dialog and no
pre-selection.

### 6a.1 The ladder (normative order)

1. **The probe (6a.2–6a.4) is the normative core** — the default
   path, run on every enactment. It recognizes via shared pair
   history, before and independent of any disclosure decision.
2. **The S-DID convergence net:** where continuity did not
   complete, a later verified `anchor-mapping@2` whose `self`
   equals the `self` held on another relationship merges the two
   chains — a holder-local act of the addressee, no wire artifact.
3. **The manual fallback:** the human merges contact entries
   locally (the data-loss case; contact memory is local anyway).

An implementation MUST support 1 and 2; 3 is a UI concern, named
for honesty.

### 6a.2 continuity-probe@1 — sequenced, chunked, padded, blinded

Sent by either party (SHOULD by both) after enactment completion.
Body: `{ "type": "continuity-probe@1", "probe": <int-string>,
"seq": <int-string>, "last": <boolean>, "blinded": [ exactly 256
entries ] }`; proof: `mac` under `k_p`.

- `probe` is the probe sequence of this tuple direction — the
  exact analogue of the star's `salt`, on both sides: starting at
  1, strictly increasing, persisted atomically before send; the
  recipient MUST persist, atomically and per tuple, the highest
  **completed** probe and MUST reject any delivery whose `probe`
  is not strictly greater. A **resend is always a fresh `probe`
  sequence with freshly sampled padding** — a sender never
  reproduces old chunks.
- `k_p = HKDF(X25519(newPairX_sender, newPairX_recipient),
  "rltp/visibility/blind/probe/" || senderNewPair || "/" ||
  recipientNewPair)`.
- **Entries come from the prior-candidate set and from nowhere
  else:** `HMAC(k_p, ownPriorPairAnchor bytes)` for the sender's
  **own** pair anchors of its prior-candidate set (Section 2) —
  the relationship heads active when the fresh tuple was created,
  **excluding the fresh tuple itself**. The fresh tuple MUST NOT
  contribute an entry (a self-entry would make every probe match
  trivially against its own enactment); deactivated links are
  reachable through their chain's head and MUST NOT be probed.
- **Global padding and order:** the sender pads the full entry set
  with random 32-byte values encoded like MACs up to the next
  multiple of 256, sorts the padded union lexicographically once,
  and slices it into 256-entry chunks in order (`seq` 1…n, exactly
  one `last`), using the **minimal** number of chunks —
  pure-padding chunks beyond the minimum MUST NOT be sent. On the
  (cryptographically negligible) collision of a padding value with
  any other value, the padding value is resampled. **A sender with
  an empty prior-candidate set MUST still send one all-padding
  probe** — otherwise the absence of a probe would leak the
  cardinality "zero".
- Chunk assembly per (tuple, probe) follows the 5.2a rules with
  `probe` in the salt role (byte-identical repeats ignored,
  conflicts reject, one open assembly per tuple, higher `probe`
  discards an open older assembly).
- The recipient computes `HMAC(k_p, counterpartAnchor)` for each
  counterpart anchor of **its own prior-candidate set** of this
  fresh tuple and intersects with the assembled union. Matches
  identify shared prior relationships; zero matches identifies a
  new contact. Cardinality is quantized to the minimal chunk count
  toward a matched counterpart and hidden entirely from strangers.

### 6a.3 Carrier, the offline path, and the resend duties

Probe and mapping travel as sealed deliveries **on the same
channel as the enactment bundle**; their task registration shares
the introduction tasks' registration debt (8.1). On the
**optical** enactment path (no delivery service), the probe is
**pending**: until it runs, the tuple is honestly an unchained
relationship. The standing duties, all MUST, all "on next
available delivery contact of that tuple":

- a pending probe is sent (fresh sequence);
- an unanswered probe situation is retried (fresh sequence);
- a continuity mapping that has not been answered by the
  counterpart's aligned mapping is resent (same revision —
  idempotent by 6.4);
- the alignment duty of 6a.4 is discharged.

A one-sided chain is therefore a legal transitional state, never a
terminal one while contact exists; without further contact, two
honestly unchained relationships remain — which is the truthful
description of that situation.

### 6a.4 continuity-mapping@1 — one chooser, one trigger

Body: `{ "type": "continuity-mapping@1", "prior": <own prior pair
anchor>, "next": <own new pair anchor>, "to": <counterpart's new
pair anchor>, "revision": <int-string>, "issuedAt": <timestamp> }`;
`mac1` under the **prior** relationship key
(`HKDF(ECDH(priorPairX_sender, priorPairX_addressee),
"rltp/visibility/mac/cont1")`), `mac2` under the **new**
relationship key (`…/cont2`).

**The machine — one chooser, one final choice, one trigger:**

- **The record side chooses once, finally.** Its first verified
  continuity mapping for a given (next, to) is its choice forever
  (6.4: a differing later `prior` from the record side is an
  equivocation error whatever its revision). The record side
  chooses freely among its matches — the app may prefer the chain
  with the richer history; it never needs to re-align, so its
  choice may and MUST freeze. Choice-flapping is structurally
  invalid.
- **Chaining is triggered only as follows — this paragraph is the
  protocol's only chaining trigger (6.4 refers here).** The record
  side chains atomically with issuing its choice. The non-record
  side chains **only** on verifying the record side's mapping. A
  mapping received *from* the non-record side is a **match
  report**: it tells the record side "I recognize these prior
  relationships" and MAY inform its choice — it MUST NOT cause
  chaining on any side.
- **Alignment duty (MUST).** On verifying the record side's
  mapping, the non-record side MUST send its own mapping naming
  its prior anchor on the record-chosen relationship (a higher
  revision where an unaligned match report exists — the re-issue
  changes its outbound claim, never its local graph, which follows
  the record side's mapping).

**Verification** of a received continuity mapping, in order —
**a prior own probe match is NOT a precondition** (this is what
keeps both loss directions terminating):

1. envelope and schema valid, `type` implemented (2.1);
2. `to` == own new pair anchor of the fresh tuple the mapping
   arrived on;
3. `next` == the counterpart's new pair anchor of that tuple;
4. `prior` is a member of the receiver's **prior-candidate set**
   of this fresh tuple (Section 2): a counterpart pair anchor of a
   relationship head that was active when the fresh tuple was
   created — **never an anchor of the fresh tuple itself, and
   never a deeper chain position** (6.4 exception (a); holding it
   is the evidence, no probe match required). The snapshot is what
   keeps the alignment flow valid: both sides evaluate against the
   heads as they stood at enactment, so a head deactivated *by
   this very chaining* remains a valid `prior` for this tuple;
5. both ECDH outputs non-zero; `mac1` verifies under the prior
   relationship key, `mac2` under the new — only the same **key
   controller** can compute both (a stolen, still-active old
   device is a key controller: Identity §11 grades takeover
   resistance under operational key possession as *none*;
   succession, not this artifact, is the remedy);
6. `revision` per 6.4 (including the record-freeze rule).

The addressee can forge the whole artifact (class V, deniable);
third parties cannot verify. On verification of a **record-side**
mapping, chain per 6.4 and discharge the alignment duty. After a
verified match, a party MAY re-send its existing
`anchor-mapping@2` (self disclosure) on the new tuple without a
fresh user decision: the addressee already holds the self anchor —
re-delivery to the same holder, register no. 5.

**Termination:** matching requires only that **some** probe
arrived — the record side can match against the non-record side's
probe (or its match report) and choose, whichever probe was lost;
the 6a.3 duties guarantee progress in both loss directions. With
one chooser, one final choice, and one trigger, every flow ends
with both sides chained to the record-chosen relationship, or
honestly unchained pending transport.

### 6a.5 What this buys (informative)

The probe is the third member of one family — star, mapping, probe
are all blinded values under relationship keys. UX: a re-encounter
shows "re-verified" a round-trip after the scan, with no dialog; a
data-loss counterpart cannot answer and is honestly a new
relationship; a wrong scanner learns nothing.

## 7. Relational counts (normative principle, artifact unwritten)

Anchors are free; a Sybil swarm issues itself arbitrary
self-evidence. The scarce resource is the **boundary edge** into
the honest graph. Count and personhood statements MUST be anchored
relationally — "≥ N, of which k inside the verifier's trust
horizon" — never absolutely; the blinded star supplies the
verifier-side test instrument. Global per-everyone scores are
either forgeable or central; both are rejected. **The proof
artifact is deliberately unwritten** (it needs 9.2's substrate);
until it exists, relational counts are a design constraint on
consuming layers, marked state-dependent in Section 12.

## 8. The introduction act (normative)

Principle: **the mediator transfers messages, never standing
anchors.** The fresh pair anchors of the act are issued by their
own owners for the new relationship — issuance, not forwarding.

### 8.1 Precondition, carrier, pins, and the per-role lifecycle

**Precondition (normative):** the requester and the mediator, and
the target and the mediator, each already share a pair
relationship — the mediator is a *contact* of both. **The
relationship anchors never appear in any act body**: each leg
rides its delivery channel, and that transport tuple is the
binding — known to both ends of the channel, shown to no one else.

**Carrier:** five sealed Delivery tasks (payload schemas
`schemas/visibility-payload-*.schema.json`, enumerated in the
References): `introduction-request` (requester → mediator:
`{ introduction, card }`, receiver checks `cardDigest` == the 2.1
digest of the card document) · `introduction-forward` (mediator →
target: the byte-identical `introduction` and `card`; the target
verifies the request signature under the card's anchor, the
digest, the card itself under Encounter's DI rules
(`rltp-card/0.25`), and — over its own channel to the mediator —
that `target` designates itself; consent is the target's local
act) · `introduction-reply` (target → mediator → requester:
`{ introduction, card }`, same digest rule, forwarded unchanged;
the mediator's and the requester's acceptance lists are 8.2) ·
`introduction-ack` (mediator → requester, 8.4) ·
`introduction-voucher` (mediator → each side: `{ voucher }` — the
side's voucher of 8.5, sent before the mediator enters
`completed`). **Registration debt, stated honestly:** these task
names — and the continuity tasks of 6a.3 — live in the Delivery
Contract's registry; registering them is part of the declared
Delivery re-pin recast (Encounter §12). Until that lands, the
carrier is specified but unconsumable.

**Act identity (normative):** an act is identified by its **act
id alone** — 32 fresh random bytes, minted by the requester per
act; a requester MUST NOT reuse an act id (256-bit randomness
makes collision negligible; deliberate reuse is nonconformance).
`issuedAt`, taken from the act's request, is the act's lifetime
datum, not an identity component. Within the retention window, a
request carrying a held act id with **different** canonical bytes
is an equivocation and is rejected (duplicate rule below) — there
are never two acts under one id.

**The acceptance window (both directions):** at every role's
arrival of any act artifact, the role MUST reject unless **both**
bounds hold, evaluated per 2.1's truncation rule with the fixed
profile parameters `act-expiry = PT72H` and `act-skew = PT5M`,
both bounds inclusive, every tolerance widening acceptance:

- `issuedAt ≤ now + act-skew` — the future bound: a future-dated
  `issuedAt` cannot start an act's lifetime later than its
  arrival;
- `now ≤ issuedAt + act-expiry + act-skew` — the absolute
  lifetime: no artifact of an act may be produced or accepted
  after it.

**Boundary serialization (normative):** per act, artifacts
arriving at a given instant are processed **before** any
time-driven transition of that same instant (2.1's truncation
makes instants whole seconds); every time-driven transition — the
requester's `failed`, any `expired`, the pending-voucher discard
(8.5) — fires at the first whole second **strictly after** its
bound. Acceptance bounds are inclusive, expiry is strictly after:
a boundary-second arrival always wins against a same-second
expiry, and no same-second race exists.

**The mediator's processing cutoffs (normative):** production
bounds use no tolerance — the tolerance belongs to acceptance.
The mediator MUST NOT move a request into `received` unless its
ack remains producible inside the lifetime: `now + ack-delay ≤
issuedAt + act-expiry` (2.1 comparison; `ack-delay` is the
mediator's own declared constant, 8.4, so the check is stateless
from the request bytes). And it MUST NOT accept a reply unless
forwarding and voucher production remain inside the lifetime:
`now ≤ issuedAt + act-expiry` at reply arrival — forward and
vouchers follow immediately, there is no declared delay to
reserve. A request arriving later is rejected like a window
failure: without ack, at step 2 of the mediator checks; a reply
arriving later is dropped silently and the act runs into
`expired`. This is what keeps every production duty and the
production bound from ever being simultaneously unsatisfiable.

The window is stateless: a replayed request outside it is rejected
from its own bytes, so duplicate-act state is needed only inside
the window — bounded. **Duplicate detection and retention
(normative, per role):** within the window each role MUST retain,
until the absolute lifetime, per held act: **the canonical bytes
of every act artifact and payload it produced or accepted** — the
request, the reply, the ack value (8.4), sent vouchers, and, for
payloads (request, forward, reply), **the accompanying card
documents, at least as their verified card anchors** — exactly
what the byte-equality decisions of this section, the acceptance
lists of 8.2, and the `requesterPair`/`targetPair` matching of
8.5 consume after acceptance (a forward is the byte-identical
request payload of `introduction` and `card`, not a body of its
own); the **pin identities**; and — the requester — any **pending
voucher** (8.5). This state is bounded per act and discarded at
the absolute lifetime.
Duplicates follow the 6.4 idempotency pattern, per role —
**byte-identical** meaning equality of the canonical body bytes,
`JCS(body)`:

- the **mediator**, on a request whose act id is held:
  **before ack production** (the single production event at
  `t_received + ack-delay`, 8.4), a byte-identical duplicate is
  **absorbed** into the pending production — it MUST NOT
  reschedule, advance, or duplicate that production; the one
  produced value answers every arrival up to that point. **After
  production**, byte-identical MUST re-deliver the retained ack
  value (a retransmission, not a second ack — 8.4). Different
  bytes MUST be rejected at any time;
- the **mediator**, on a repeated reply: before `completed`, a
  byte-identical repeat is **absorbed** into the single
  processing event — forward and vouchers happen once; after
  `completed`, byte-identical is ignored. Different bytes are
  rejected at any time;
- the **target**, on a repeated forward, the **requester**, on a
  repeated reply, and **either side**, on a repeated voucher:
  byte-identical is ignored; different bytes are rejected.

**Pins:** the requester pins the act to its requester↔mediator
tuple **at send** (its active head then); the mediator pins to
the arrival tuple **at arrival**, and to its mediator↔target
tuple at forward; the target pins at forward arrival. Every act
artifact uses the pinned tuples' keys. **Pin lifetime is split by
direction:** for **producing** act artifacts, a role's pin dies
with its terminal state or the absolute lifetime, whichever is
first — retransmission of an already-produced value is delivery,
not production; for **accepting**, the pin lives to the absolute
lifetime — after a terminal state a role is **accept-only**: it
produces nothing further under the act, but the act's remaining
inbound artifacts addressed to it (notably the voucher, 8.5)
verify under the pinned keys until the window closes. After the
absolute lifetime, act artifacts under the pinned keys MUST be
rejected and act state SHOULD be discarded (the window bound
keeps rejection possible without it).

**Per-role lifecycles (normative; there is deliberately no global
act state — a distributed act has none):**

- **Requester:** `sent` → `acked` (ack verified) → `completed`
  (reply accepted per 8.2) — **and directly `sent` →
  `completed`**: delivery guarantees no order between ack and
  reply, so an accepted reply completes the act from `sent` or
  `acked`; an ack arriving after completion is **absorbed**
  (verified against the pinned tuple, then discarded — neither a
  conformance failure nor a late ack of a failed act). · →
  `failed` (in `sent`, without an accepted reply: ack timeout per
  8.4; in `acked`: reply timeout `act-expiry`) · → `expired`
  (absolute). A late reply of a `failed` act MUST be ignored —
  the retry converges as a new act.
- **Mediator:** `received` (channel and form checks passed —
  including the ack cutoff — pin set, **ack duty bound**) →
  `forwarded` (target resolved, forward sent) → `completed` —
  **gated on all three production duties: the ack has been
  produced (8.4), the reply has been forwarded, and both vouchers
  have been sent (8.5)**; the order among the three is free, but
  no production duty may remain open at `completed` — this is
  what keeps the terminal rule and the ack schedule from ever
  conflicting when a fast reply arrives before `t_received +
  ack-delay`. · → `rejected` (form checks failed — where the
  arrival channel was inactive, no ack key exists and the drop is
  artifact-free, the one honest unacknowledged case) · →
  `expired` (absolute — including the act whose target never
  resolved: that act stays in `received`, acked and silent, until
  the window closes).
- **Target:** `received` → `consented` (reply sent) · `refused`
  (local, silent — refusal privacy) · → `expired`.

Terminal states end **producing**, never accepting (pin rule
above): `consented` is terminal for the target's production, and
the target still accepts its voucher within the window.

Divergence between roles is possible and named — a transport
adversary can hold the mediator at `completed` and the requester
at `failed`; neither is nonconformant (8.4's verdict rule), and
the requester's retry as a **new act** converges the outcome.

**Mediator checks (normative, in order — the ack duty binds
before target resolution):**

1. arrival on an active relationship channel — pin set; else the
   drop is artifact-free (no ack key exists);
2. schema, digest, signature, acceptance window **including the
   ack cutoff** — failure rejects without ack (a malformed body
   authenticates no act; a request too late to ack is
   window-expired for this mediator);
3. **on passing 1–2 the act enters `received` and the ack duty is
   bound (8.4)** — before, and independent of, target resolution;
4. target resolution serves **forwarding only** and is silent:
   success forwards the byte-identical payload on the active
   mediator↔target channel; failure — unknown designator,
   unresolvable, no active mediator↔target channel — produces
   **ack plus silence**, indistinguishable at the requester from a
   refusing target. Whether the mediator *has* a given contact is
   not testable through this act.

### 8.2 Artifacts

`introduction-request@1` body: `{ type, act: <32-byte random,
u-base64url 43 chars>, issuedAt: <timestamp>, target: <opaque
designator, 8.3>, cardDigest: <2.1 digest of the card document>,
profile: <closed object: displayName ≤ 64, note ≤ 256> }`,
`proofValue` under the fresh card's anchor (raw Ed25519, 2.1). The
body names **no mediator anchor and no existing relationship**.

`introduction-reply@1` body: `{ type, act, requestDigest: <2.1
digest of the request body>, requesterPair: <the card anchor from
step 1>, cardDigest: <2.1 digest of the target's fresh card
document> }`, signed under the target's fresh card anchor.
`requestDigest` binds the reply to exactly one request — reply
splicing across requests breaks the signature.

**Reply acceptance at the mediator (normative, in order):**

1. envelope and schema valid, `type` implemented (2.1);
2. arrival on the act's **pinned mediator↔target tuple** (8.1);
3. the act is held in `forwarded`, the acceptance window holds,
   and the reply cutoff holds (8.1);
4. `cardDigest` equals the 2.1 digest of the accompanying card
   document, and the reply signature verifies under that card's
   anchor;
5. `requestDigest` equals the retained request bytes' digest
   (8.1);
6. `requesterPair` equals the card anchor of the act's request;
7. the accompanying card verifies under **Encounter's own DI
   rules** (`rltp-card/0.25`) — the expensive check last; positive
   material in `vectors/encounter-cards.json`.

Only then does the mediator forward the byte-identical payload and
produce the vouchers (8.5); a repeat is handled by the 8.1
duplicate rule.

**Reply acceptance at the requester (normative, in order):**

1. envelope and schema valid, `type` implemented (2.1);
2. `act` is a held act of this requester and the acceptance
   window holds (8.1);
3. `cardDigest` equals the 2.1 digest of the accompanying card
   document, and the reply signature verifies under that card's
   anchor;
4. `requestDigest` equals the retained request bytes' digest
   (8.1) — a mismatch rejects: the reply answers some other
   request;
5. `requesterPair` equals the card anchor of the act's own
   request;
6. the accompanying card verifies under **Encounter's own DI
   rules** (`rltp-card/0.25`) — last, as at the mediator.

An accepted reply completes the act (8.1 — from `sent` or
`acked`) and triggers re-evaluation of a pending voucher (8.5).

### 8.3 The target designator

`target` is an opaque string, `u`-base64url, **at most 343
characters** (≤ 256 payload bytes), minted in the mediator's own
namespace. Requirements: stable per (mediator, target) at least
for the act's lifetime; resolvable by the mediator to a
deliverable party; verifiable by the **target**, over its own
channel to the mediator, as designating itself before consenting.
It carries no global meaning and MUST NOT be built from any
anchor.

### 8.4 introduction-ack@1 — one value, one production event, total verdict

Body `{ type, act }` — no other member exists in the schema.
Proof: `mac` under `k = HKDF(ECDH(pairX_mediator,
pairX_requester), "rltp/visibility/mac/ack")` — the keys of the
act's **pinned** requester↔mediator tuple (8.1). The mediator
produces exactly **one ack value** per act that reached
`received`, in exactly **one production event at `t_received +
ack-delay`** — the mediator's own clock, `t_received` being the
moment the act entered `received`; `ack-delay` is a fixed
parameter published in the mediator's task registration entry,
not adaptive — **identically for existing, refusing, unknown, and
unreachable targets**: the ack **duty binds** before, and never
depends on, target resolution (8.1); the production event follows
its own schedule and may in time follow a fast resolution — which
is why `completed` is gated on it (8.1). **Retransmission of the
byte-identical ack value — on delivery retry or on a duplicate
request (8.1) — is idempotent and is not a second ack**; a
duplicate arriving before the production event is absorbed into
it (8.1). A second, *differing* ack value, or a malformed one, is
a mediator conformance failure. The requester verifies MAC
(pinned tuple) and act id; an ack of a completed act is absorbed
(8.1).

**The verdict rule is total and honest about divided state:** the
requester measures on its **own clock from its own send**: with
no verified ack and no accepted reply by `t_sent + ack-delay +
act-skew` (2.1 comparison; boundary serialization per 8.1 — the
transition fires strictly after the bound, arrivals at the bound
win), the act moves to `failed` — terminal: a retry MUST be a
**new act** (fresh act id, fresh `issuedAt`, fresh request), and
a late ack — or a late reply — of the failed act MUST be ignored.
Transport delay can fail the requester early; that is expressly
safe under this rule: both parties remain individually correct,
and the retry converges them. Missing acks are a mediator
conformance failure only where the request demonstrably arrived
on a channel active *at the mediator*.

### 8.5 The voucher — carried, produced before `completed`, bound to the held act

`introduction-voucher@1` body `{ type, act, requesterPair,
targetPair }`; two artifacts, one per side, `mac` under
`HKDF(ECDH(pairX_mediator, pairX_side),
"rltp/visibility/mac/voucher")`, where the keys are those of the
act's **pinned** channel tuple with that side (8.1).

**Production and carrier (normative):** both vouchers are produced
by the mediator and sent — each as an `introduction-voucher` task
on the act's pinned channel with that side (8.1) — **before the
mediator enters `completed`**: `completed` is gated on the reply
forward, both voucher sends, and the ack production event (8.1).
Delivery retries of the sent voucher are retransmission, not
production, and a repeated voucher at the recipient follows the
8.1 duplicate rule (byte-identical ignored, differing rejected).

**Acceptance:** a recipient MUST accept a voucher only if it holds
the act locally, within the act's absolute lifetime —
**role-terminal states do not end acceptance** (the accept-only
pin rule, 8.1: the target in `consented` and the requester in
`completed` still accept their vouchers) — and
`requesterPair`/`targetPair` match its held request/reply
artifacts of that act. **A voucher arriving before the reply is
not lost:** where the act is held but the reply is not yet
accepted, the voucher MUST be retained as **pending** — bounded
state: at most one per side per act, within the window, part of
the 8.1 retention — and re-evaluated when a reply is accepted
(8.2); at the first whole second strictly after the absolute
lifetime (boundary serialization, 8.1) an unmatched pending
voucher is discarded. With these rules, **all six arrival orders
of ack, reply, and voucher that complete within the act's window
and before a requester timeout end in the same state**; where a
reply arrives only after the requester's `failed`, the outcome is
the named role divergence (8.1), converged by the retry. A valid
MAC over unheld values is not a voucher of anything.

### 8.6 Provenance (normative)

Every relationship carries a local attribute `provenance ∈
{ "encounter", "introduction" }` — a chain fact (6.4). An
introduction sets `introduction`; the first completed enactment
chained onto the relationship upgrades it to `encounter` — exactly
then, never downward. UI wording ("◇ verified via <mediator>" /
"⇄ verified") is informative; the attribute and its transition are
normative.

### 8.7 What the binding buys — and what it cannot

Signatures over act-bound bodies remove card substitution and act
splicing: a mediator cannot swap cards between acts or splice
half-relationships — any altered body breaks a signature whose key
it does not hold. What remains, stated honestly: a mediator can
still **be** an endpoint — fabricate an act in which it plays the
target, or run two acts posing as each side. There is no
cryptographic remedy without a prior relationship; it is why a
mediated relationship carries the weaker provenance, upgradeable
only by a real encounter. Refusal privacy holds at the protocol
surface (uniform ack), not against a talkative mediator; timing
below `ack-delay` resolution remains. UX invariant (one-way-door
rule): acceptance is a button plus sheet, never a toggle; three
devices, three decisions, each at the right party.

## 9. Documented options and open points

### 9.1 Grade ladder beyond two — withdrawn surface

A finer per-recipient ladder was tried in UX and withdrawn
(22.08.); the two-grade declaration of 5.5 is the specified
surface. Reintroduction would extend the `grade` enum in a new
version, nothing structural.

### 9.2 The encounter-credential flank — seam pre-wired with suites

Encounter (0.26) carries `commitment: { suite, value }` with an
initially empty suite registry and a producer emission gate;
assigning meaning is registration in that registry — its own loop.
This document only reserves its consumer role.

### 9.3 Feasibility map for predicates (informative, early 2026)

DV mapping = double-DH MAC (Section 6) · DV-ZK counting predicates
= Sigma-OR (@noble/curves, no audited library) · selective
disclosure / counting = BBS+ (W3C bbs-2023 draft) · general SNARKs
only if predicates outgrow counting and subsets.

### 9.4 M-DID binding of membership — confirmed direction, open semantics

Decision (23.08., `design/mdid-bindung-2026-08.md`): the target
picture is membership bound to the group-context anchor (a true
M-DID), with the S-DID as the private cross-relationship
coordinate disclosed per co-member via the Section 6 pattern
(group→self); the UI surface of that disclosure is the **Trust**
act. Current reality (review finding M5): roster *readers* and
colluding insiders of different groups can correlate S-DID-bound
members across groups, and admission artifacts replicate stable
anchors into group logs permanently. Technically the star is
anchor-agnostic (finding M6). The open questions are semantic:
which anchor class counts as a "contact"; how group-specific hits
on the same person deduplicate without rebuilding the linkability
the change removes; when an M-DID may bind to a relationship. The
change is the Access/Membership recast — a **membership
proof-model** change, not a pin rename (joint finding S-B2) — its
own loop after this document converges.

### 9.5 Standing disclosure (from the architecture map)

Normatively capturing the standing disclosure of one's own edges
to one's own network remains open; until then it is deliberate app
policy ("unrevocable in possession, revocable in distribution,
deniable in derivation").

## 10. Security Considerations

- **Anchor harvesting via stars** — countered structurally: no
  standing raw grade exists (5.1); harvesting apps are
  nonconformant by artifact shape.
- **Grade forgery** — third parties cannot forge or verify
  (relationship-key DV); the malicious holder is outside what DV
  can constrain and is handled structurally (5.5); suppression
  keeps the last verified state, initially count.
- **Salt/probe rollback, reuse, equivocation** — atomic
  persistence both sides, strictly-greater acceptance, directional
  keys; a restoring sender without a high-water mark re-forms on
  the next tuple instead of guessing (5.2, 6a.2).
- **Sender equivocation / fabricated stars** — not preventable and
  normatively de-fanged: stars carry no veracity (5.2).
- **Chunk games** — partial deliveries never advance the accepted
  sequence; byte-identical retries are ignored; one assembly slot
  per tuple bounds recipient state (5.2a).
- **Mapping mis-binding** — closed by the 6.3 condition list; the
  unclaimability claim is defined as the sum of those checks.
- **Mapping downgrade / replay / reset** — version exact-match
  (2.1), tuple-scoped state, generic revision rule with the
  record-freeze (6.4).
- **Probe abuse** — a stranger cannot test candidate anchors:
  entries are HMACs of the *sender's own* anchors under a key
  bound to this fresh tuple; replay into another tuple fails
  (`k_p` binds both new anchors); fixed 256-entry chunks quantize
  cardinality; padding is indistinguishable without a matching
  held anchor. **Self-matching is excluded by construction**: the
  fresh tuple contributes no probe entry and is no valid `prior`
  (6a.2, 6a.4) — a probe can only ever prove *shared prior*
  history, never its own enactment.
- **Continuity choice-flapping** — structurally invalid: the
  record side's choice freezes at first verified issue (6.4,
  6a.4).
- **Continuity hijack by key theft** — a stolen, still-active old
  device is a *key controller* and can continue a chain (6a.4);
  Identity §11 grades this as *none* under operational key
  possession. **The exposure window, stated per phase:** probe
  entries and `prior` candidates are drawn from heads **active at
  enactment** (the snapshotted prior-candidate set) — a stolen
  tuple that has been superseded as head before the enactment is
  worthless for continuity; artifacts of an act already pinned to
  a stolen tuple remain valid within that act's acceptance window,
  bounded by `issuedAt + act-expiry + act-skew` (8.1). Succession
  — not this artifact — is the remedy.
- **Act replay, future-dating, and id reuse** — the acceptance
  window is bounded in both directions (8.1): outside it,
  rejection is stateless; a future `issuedAt` beyond `act-skew`
  is rejected at every role. Inside the window, duplicate
  handling runs on the retained per-role artifact bytes — with
  pre-production duplicates absorbed into the single production
  event, and a held act id under different bytes rejected as
  equivocation: there are never two acts under one id (8.1).
  Late acks and late replies of failed acts are ignored (8.4);
  boundary seconds are serialized (8.1).
- **Target-existence oracle** — removed by ordering: the ack duty
  binds before target resolution, and resolution failure is ack
  plus silence, indistinguishable from a refusing target (8.1,
  8.4). Whether a mediator has a given contact is not testable by
  a requester holding a designator.
- **Introduction MITM** — card-digest binding plus `requestDigest`
  remove substitution and splicing (the ordered acceptance lists,
  8.2, including the card's own DI verification); the
  mediator-as-endpoint residue is irreducible and carried in
  provenance (8.6, 8.7).
- **Sybil self-evidence** — relational anchoring mandatory
  (Section 7); the verifier's own holdings are ground truth.

## 11. Privacy Considerations

- **The one-bit oracle is the feature.** A star recipient can test
  every anchor it legitimately holds — including future ones —
  against retained snapshots: offline, unthrottled, forever.
  Remedies: the count grade (fail-closed initial), pausing
  (distribution, not possession — register no. 5).
- **Counts and deliveries are metadata.** Cardinality, churn, and
  delivery timing leak; 5.4 restricts delivery events to actual
  set changes so encounters as such are not broadcast; probe
  chunking quantizes contact cardinality to 256er steps toward a
  matched counterpart and hides it entirely from strangers.
- **Possession residue of the self card** (6.2): after disclosure,
  the card is transferable addressing material; §1 is issuance
  control, not recall.
- **Membership correlation at true size** (9.4): roster readers
  and colluding insiders, permanent log replication — the standing
  motivation of the M-DID direction.
- **What a matched counterpart learns** (6a): "we share this prior
  relationship" — exactly the fact being established, per the
  consent embodied in completing the ceremony together.
- **Refusal privacy** holds at the protocol surface (8.4, 8.7), no
  further; the target's `refused` state is deliberately silent —
  and an unresolvable target is indistinguishable from a refusing
  one (8.1), so the mediator's contact list is not probed through
  acts.
- **Third parties** cannot even verify class-V artifacts —
  stronger than deniability alone.

## 12. Conformance

A conformant implementation:

1. emits no raw third-party anchor in any artifact of this
   document (5.1, 8.1) — vector-testable;
2. produces and verifies `star@1` per 5.2/5.2a (directional keys,
   salt and chunk discipline both sides) and never signs it (5.3)
   — vector-testable (`vectors/visibility.json`);
3. delivers exactly on deliverable-set change with transition
   atomicity (5.4) — state-dependent;
4. enforces grade declarations per 5.5 and the generic revision
   rule of 6.4 — vector-testable;
5. verifies `anchor-mapping@2` by the complete 6.3 list —
   vector-testable including the mis-binding negative;
6. emits sequenced, globally-sorted, padded probes drawn from the
   snapshotted prior-candidate set (never the fresh tuple) and
   runs the 6a.4 machine (one chooser, frozen choice, the single
   6a.4 trigger, alignment duty, prior-candidate verification, no
   probe-match precondition) — vector-testable (probe shape,
   mapping MACs), state-dependent (chain atomicity, snapshot
   discipline, 6a.3 duties);
7. runs the introduction carrier per 8.1–8.5 including the
   precondition, act-id uniqueness, the two-sided acceptance
   window with both mediator cutoffs and boundary serialization,
   pins with the accept-only rule, per-role lifecycles with the
   ack duty bound before resolution, the direct `sent →
   completed` transition, and `completed` gated on all three
   mediator production duties, both ordered reply-acceptance
   lists including the card's DI verification, per-role duplicate
   handling on retained artifact bytes including pre-production
   and pre-completion absorption, the pending voucher, and the
   single pinned ack value with named clocks and the total
   verdict rule — vector-testable (bindings, ack MAC, stateless
   window rejection), state-dependent (ack uniformity, resolution
   silence, role states);
8. maintains `provenance` per 8.6 — state-dependent;
9. publishes per Section 4 — state-dependent (snapshot rule);
10. treats stars, counts, and probes as non-evidence (5.2, 7) —
    state-dependent consumer rule.

## References

- Identity Layer 0.11 — `spec/identity-layer.md` (§5.2, §6.1,
  §9.3, §11).
- Encounter Layer 0.28 (wire 0.25) — `spec/encounter-layer.md`
  (fresh-always §4.4, commitment §7.2, versioned schemas).
- **Vector debt discharged:** `vectors/visibility.json` now ships
  **payload-level positive vectors** with real Encounter contact
  cards (eddsa-jcs-2022 DI proofs, `rltp-card/0.25`; the card
  vectors themselves live in `vectors/encounter-cards.json`, from
  the same key oracle and relationship nonces). The card digests
  follow the 2.1 preimage rule (the complete card document as
  transported), and the DI steps of the 8.2 lists are exercised by
  the same material.
- RFC 8785 (JCS) · RFC 2104 (HMAC) · RFC 5869 (HKDF) · RFC 7748
  (X25519) · RFC 8032 (Ed25519) · BCP 14.
- Schemas (normative, one file per artifact):
  `schemas/visibility-star.schema.json` ·
  `schemas/visibility-grade-declaration.schema.json` ·
  `schemas/visibility-self-card.schema.json` ·
  `schemas/visibility-anchor-mapping.schema.json` ·
  `schemas/visibility-continuity-probe.schema.json` ·
  `schemas/visibility-continuity-mapping.schema.json` ·
  `schemas/visibility-introduction-request.schema.json` ·
  `schemas/visibility-introduction-reply.schema.json` ·
  `schemas/visibility-introduction-ack.schema.json` ·
  `schemas/visibility-introduction-voucher.schema.json`; payload
  schemas:
  `schemas/visibility-payload-introduction-request.schema.json` ·
  `schemas/visibility-payload-introduction-forward.schema.json` ·
  `schemas/visibility-payload-introduction-reply.schema.json` ·
  `schemas/visibility-payload-introduction-ack.schema.json` ·
  `schemas/visibility-payload-introduction-voucher.schema.json`.
  Vectors: `vectors/visibility.json`.
- Design sources and triages as listed in the header.
