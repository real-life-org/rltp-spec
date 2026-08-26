# RLTP Access Layer

**Real Life Trust Protocol — Layer 3: Access**

- **Status:** Editor's Draft
- **Version:** 0.52.0-draft (fifty-second casting — the
  **receipt cut**, the loop's fourth architectural cut, on the
  editor's decision 2026-08-26: the acceptance-receipt and
  generation-statement machinery — demoted by the freeze
  withdrawal to evidence that confers no standing — is removed;
  the two-way acceptance anchor (7.3) carries alone, the CAS
  acceptance commit stays, and the no-target window is a named
  residual)
- **Editors:** Anton Tranelis
- **Date:** 2026-08-26
- **Vocabulary namespace:** `https://real-life.org/rltp/v1`
- **Conformance profile:** `rltp-access@0.52` (draft). Wire
  versions are unchanged: the `0.24` family,
  `service-registration/0.26`, and the session-plane evidence
  forms `…/1` (3.6); the vouch (`vouch@2`, 5.3) is a W3C VC in
  DTG form and carries no `v` constant. The service-acceptance
  forms `…/2` are withdrawn never-instantiated (Section 11).
  Section 11 is the compatibility statement; no shipped wire
  byte changes.
- **Position:** Layer 3 of RLTP, above the Encounter Layer 0.28
  (wire 0.25) and
  the Identity layer (0.12), carried by the Delivery Contract
  (0.22, jointly cast in this loop) where operations or keys must
  reach parties outside the replica; the Membership Tasks (0.16,
  jointly cast) register the task types that transport this
  layer's admission documents and are a normative companion.
- **Supersedes:** 0.51 (archived,
  `archive/access-layer-0.51-redaktionsguss.md`; every earlier
  casting alongside); version 0.3.0-draft (wot-spec
  `rltp/access-layer.md`, archived there with its reviews); on
  adoption, the group/membership portions of wot-spec
  `03-wot-sync/005-gruppen.md`.

## Abstract

This document specifies the Access layer of the Real Life Trust
Protocol (RLTP): how a **group** of people holds shared authority
over its membership, its data, and itself. Its spine is the
**authority log** — a causally linked DAG of individually signed
operations rooted in a single-founder genesis whose digest **is**
the group's identity. Group state is a deterministic
materialization of this log; **policies** are group-defined
decision rules gating privileged operations; **epochs** are the
enforcement periods that make revocation real — prospectively — in
an end-to-end-encrypted, local-first setting; services follow the
log through chained, quorum-signed **authorization views**.

The machinery that replicates the log, converges branches, agrees
and rotates keys, and opens history is an **enforcement substrate**
behind a normative **port** of four requirements (Section 9). The
constitution is this layer's own; the substrate is replaceable, and
a linear interim adapter satisfies the port with the semantics
deployed today.

Two things are deliberately deferred, not designed badly: grantable
capabilities for non-members (the exercise mechanism must exist
first — OI-12) and group-issued credentials (the credential profile
must exist first — OI-13). This casting specifies only what it can
make sound.

Access is deliberately separate from trust: the Encounter layer
records that people met and recognized each other; the Access layer
governs what a collective grants, and how it takes it back.
Encounter credentials are immutable and never revoked; access is
revocable by construction. That difference is why the layers exist.

## Status of This Document

This is an **Editor's Draft**, the fifty-second casting of this
layer — the **receipt cut** (editor's decision, 2026-08-26): the
acceptance-receipt and generation-statement machinery of castings
0.47–0.50, demoted by the freeze withdrawal to evidence that
confers no standing, is removed entirely. The two-way acceptance
anchor (7.3: the live session, or the `previousRegistration`
chain into a session-attested generation) carries alone; the CAS
acceptance commit stays; the no-target window is a named
residual. A post-convergence substance casting — its adversarial
confirmation is recorded in the design journal. The fifty-first
casting was the editorial one: substance frozen at the converged
0.50, genealogy moved to the design journal, sections 3.6 and 7.3
re-paragraphed.

The layer is converged, three loops deep. Its own adversarial
loop (castings 0.4–0.25) met the convergence criterion — two
consecutive blocker-free review rounds — and held it through the
Membership seam. The **M-DID loop** (castings 0.26–0.30: the
per-group member anchor, `member-mapping@1`, the `vouch@2` DTG
adoption) converged on 2026-08-25 jointly with Encounter 0.28 and
Membership Tasks 0.16. The **replication-seam loop** (castings
0.31–0.50, jointly with the Replication Contract and the Delivery
Contract) converged on 2026-08-26: joint rounds 24 and 25 were
blocker-free. Every named residual (Section 15; the TOFU and
re-registration classes, the cooperation and darkness residuals,
the consent-staleness window) stands confirmed as an honestly
bounded design limit rather than an open defect. The
round-by-round record — findings, triage, and the genealogy of
every casting — lives in the design journal
(`design/access-review*.md`, `design/mdid-joint-review*.md`,
`design/replication-review*.md`).

Feedback is welcome via the issues of the publication repository
(github.com/real-life-org/rltp-spec).

## 1. Introduction (informative)

### 1.1 Essence

Five consequences follow from making the log the sole authority,
and they are the layer:

1. **There are no admins.** Privileged operations are gated by the
   group's own policy — a decision rule stated as data. A single
   founder-admin is the `k = 1` special case, not the model.
2. **Authority is a log, not a key.** The genesis digest is the
   group's identity; the DID is its address. No key held by anyone
   confers standing authority; the genesis key signs once and may
   be destroyed. Every authorization decision is a deterministic
   reading of signed operations.
3. **Revocation is an epoch, honestly stated.** Removing someone
   cannot un-teach them what they read; it can and must stop them
   prospectively. Every operation that removes or narrows authority
   in a continuing group carries a key-world transition,
   atomically; leaving obligates one; dissolution ends the group
   itself.
4. **Services follow the log.** No service keeps its own registry
   of who belongs; infrastructure learns authorization state
   through chained, quorum-signed views — epoch-monotone,
   freshness-bounded, fail-closed — and is never asked to decide
   anything.
5. **The substrate is a port.** Replication, convergence mechanics,
   group key agreement, and history opening are requirements on an
   adapter, not designs of this layer. The adapter is thereby also
   named honestly for what it is: part of the trusted computing
   base for confidentiality, with its obligations stated (9.1).

### 1.2 Position and scope

The Identity layer supplies anchors and key recovery; the anchor
a member acts under is a per-group context anchor (5.1).
The Encounter layer supplies immutable evidence that people met —
consumable here as policy inputs (4.2). The Delivery Contract
carries documents to parties the replica cannot reach; the
Membership Tasks define how invitation, consent, and welcome
travel; this layer defines what makes an admission — or any other
operation — canonical, and registers two further task types of
its own: `key-delivery/0.1` (10.1), by which transition keys,
re-welcomes, and key repairs travel, and `removal-notice/0.1`
(10.2), by which a removed member is told.

Out of scope by decision, tracked as open issues: capability
grants to non-members and their service-side exercise (OI-12);
group-issued outward credentials (OI-13).

### 1.3 Principles inherited

- **Issuance counts, arrival never** (Encounter 1.3): an
  operation's validity is a function of its signatures and its
  causal position, never of arrival time. No rule in Sections 3–8
  consults a clock.
- **Authenticity has exactly one carrier, one direction**
  (Delivery 1.1, Membership §4): the operation envelope carries its
  signatures and encloses or digest-commits everything it vouches
  for; nothing an operation commits to ever points back at the
  operation's id — that would be an unconstructible hash fixed
  point, and this layer's own key artifacts obey the rule (7.1).
- **The log is canonical; a task is a feeder** (Membership 1.2):
  effects follow materialization, never delivery.

## 2. Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
"SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY",
and "OPTIONAL" are to be interpreted as described in BCP 14
[RFC2119] [RFC8174] when, and only when, they appear in all
capitals.

The **interim securing profile** of Encounter 2.3 applies: JCS
[RFC8785] is the canonical serialization; digests are multibase
multihash over JCS bytes unless a rule names other input bytes;
signatures are Ed25519 under `did:key` anchors unless a registered
profile states otherwise.

**Group** — a collective actor with members, a policy, an
authority log, and documents. Its **identity** is the digest of its
genesis operation; its **address** is its group DID (3.2).
**Member anchor (M-DID)** — the per-group context anchor under
which one member acts in one group (5.1); the DTGWG class name
M-DID names it throughout. **Self anchor (S-DID)** — a person's
stable cross-relationship coordinate (Identity §5); it appears in
no artifact of this layer except inside `member-mapping@1` (5.5).
**Authority log** — the append-only operation DAG rooted in the
genesis operation; the sole source of authorization state; its
content is readable by members only, always (3.1). **Operation** —
a signed, causally anchored envelope (3.3). **Materialization** —
the deterministic derivation of group state from the log (3.5,
3.6); an operation is **canonical** when materialization at its
causal position accepts it and no rule of 3.6 suppresses or
displaces it. **Forked state** — the distinguished, fail-closed
materialization outcome produced by sibling epochs (3.6).
**Policy** — group-defined data stating, per rule key, which proof
satisfies the group's decision rule (Section 4). **Epoch** — a
numbered period of the group's key world; enforcement takes effect
as epoch transitions (Section 7); term aligned with MLS [RFC9420].
**Retained members** — the normatively computed recipient set of a
transition's key distribution (7.1). **Pending exit** — the state
of a member whose `member.leave` has merged but whose discharging
transition has not (5.4). **Epoch-key lineage** — the chain of
per-transition entries by which the previous epoch's content key is
readable under the next epoch's key (7.1). **Authorization view** —
the chained, quorum-signed object by which a service learns a
group's epoch and authorized service identities (7.3). **Implicit
capability** — the read/write standing every member holds by
membership alone (Section 6). **Replica boundary** — the set of
parties holding (and entitled to hold) the group's replicated log
at a given materialized state (Membership §2). **Enforcement
substrate** — the machinery satisfying the port of Section 9;
**adapter** — a registered binding of one substrate to that port.
**Key service duty** — the standing obligation of members to
(re)deliver verifiable current-epoch key material to a party the
materialized state entitles to it (5.3, 7.1, 10.1).

| Term | Fragment | | Term | Fragment |
|---|---|---|---|---|
| Group | `#Group` | | Epoch | `#Epoch` |
| Authority log | `#AuthorityLog` | | Epoch-key lineage | `#EpochKeyLineage` |
| Operation | `#Operation` | | Authorization view | `#AuthorizationView` |
| Materialized state | `#MaterializedState` | | Privileged operation | `#PrivilegedOperation` |
| Forked state | `#ForkedState` | | Visibility mode | `#VisibilityMode` |
| Member | `#Member` | | Implicit capability | `#ImplicitCapability` |
| Retained members | `#RetainedMembers` | | Enforcement substrate | `#EnforcementSubstrate` |
| Pending exit | `#PendingExit` | | Adapter | `#Adapter` |
| Policy | `#Policy` | | Key service duty | `#KeyServiceDuty` |
| Policy proof | `#PolicyProof` | | | |

## 3. The Authority Log

### 3.1 One log, one truth

- A group MUST have exactly one authority log. All authorization
  decisions MUST be derived from its materialized state and from
  nothing else — never from document content, replication
  metadata, or service state.
- The log replicates through the substrate (Section 9) as
  encrypted state **readable by members only — in every visibility
  mode**. `open` visibility opens document content, never the
  authority log (Section 8).
- **The log's confidentiality boundary is the replica, never the
  epoch.** Epoch content keys gate *content* (documents, lineage
  plaintext); they never gate the authority operations themselves,
  which every replica holder reads regardless of which epoch keys
  they hold — 7.1 already depends on this (the log stays readable
  to members of the old epoch), and it is what makes a recovery
  rotation out of a key-void epoch constructible: authority state
  is always materializable, only content can be dark (7.1).

### 3.2 Group identity: the genesis digest

- A group's **identity is the multibase multihash digest over its
  genesis operation's signature input** — the JCS serialization
  with `id` empty and `proof` omitted (3.3). These are the same
  hash bytes the genesis `id` encodes in `oid:` form; the identity
  is their multibase multihash encoding, so existing
  `genesisDigest` fields keep their format. Excluding the proof is
  what makes the identity unique: signatures are malleable (one
  signer can produce many valid signature bytes over one message),
  so no proof bytes may enter an identity. Every artifact that
  binds to a group —
  membership invites (`genesisDigest`, Membership 3.1),
  authorization views (7.3), key deliveries, replica state — is
  keyed by it. **Whenever this document turns the genesis digest
  into cryptographic or canonical bytes** — the `group/<digest>`
  label (5.1), the epoch-secret HKDF info (9.5), the
  key-distribution and lineage AADs (7.1) — **the canonical `u`
  rendering of the validated digest is the form that enters the
  bytes**: a `z`-carried digest (Encounter 2.3 obliges acceptance)
  is re-encoded first, for that construction only, and the signed
  artifact is never rewritten. Stateful keying — slots, windows,
  throttles, registration and view maps — applies Encounter 2.3's
  decoded-bytes digest equality: a string-backed index MUST
  canonicalize to `u` before indexing, or two renderings of one
  group would split state that is one. u/z cross-implementation
  vectors for the epoch-secret derivation and both AADs ship in
  `vectors/dtg-credentials.json` (recomputed by the conformance
  runner: same subkey and byte-identical AADs from either
  rendering; raw `z` bytes shown to diverge). The **group DID** in the envelope is the group's
  address: the key that self-certifies the genesis (3.4.1) and then
  retires; the root secret MAY be destroyed.
- Two distinct genesis operations under one DID are therefore not a
  conflict to resolve but **two distinct groups sharing an
  address**. An implementation MUST scope all group state by
  genesis digest; an invitee bootstraps against the digest their
  own invite pinned (Membership 3.3) and can never be steered into
  a sibling genesis. A founder who mints several geneses under one
  DID has founded several groups; no rule of this document lets
  them merge, and nothing any of them does binds another.
- **"All group state" includes the operational state, and this
  document keys it accordingly.** The scoping rule is not about
  replicated log state alone: every **slot, window and throttle**
  defined here — the provisional bootstrap candidate and its
  `provisional-window` (10.1), the key-service duty slot and its
  deadline (5.3, 10.1), and the service-side presentation rate
  limit (7.3) — is keyed by **`genesisDigest`**, never by the
  group DID, and every operative sentence naming such a set says
  so. Otherwise the isolation this section promises would hold for
  the log and leak through the operational layer: two sibling
  geneses sharing a DID, with one invitee or one requester in
  common, would displace each other's candidates, consume each
  other's deadlines, and starve each other's rate budgets — one
  group affecting the liveness of a group it is defined not to
  bind. The keying is stated here once and referenced where it
  binds.
- A newcomer verifies a group by: genesis digest → genesis
  validation → operation DAG → materialized state. There is no
  other bootstrap; the log **is** the genesis chain.
- **Genesis is single-founder.** The initial membership is exactly
  one anchor — the founder, who creates the group key, signs the
  genesis with it, and countersigns as themselves. Everyone else,
  co-founders included, joins through the ordinary admission chain
  (5.3). No one can be claimed into a group they never consented
  to: every membership except the founder's rests on a signed
  accept, and the founder's rests on their own countersignature.

### 3.3 The operation envelope

Every operation is one envelope (shown as JSON; JCS is the
canonical serialization):

```json
{
  "v": "rltp-access/0.24",
  "op": "member.remove",
  "group": "did:key:z6Mk…group",
  "epoch": 7,
  "policyVersion": 3,
  "prev": ["oid:…", "oid:…"],
  "body": { …operation-specific, Section 4.5… },
  "crit": ["…extension fields that MUST be understood…"],
  "id": "oid:…",
  "author": "did:key:z6Mk…member",
  "proof": {
    "mechanism": "signature-set",
    "signatures": [ { "signer": "did:key:…", "sig": "…" } ]
  }
}
```

- **`id` (self-addressing):** the digest of the JCS serialization
  of the envelope with `id` set to the empty string and `proof`
  omitted, encoded as `oid:` + base64url(SHA-256), unpadded. Every
  signature in `proof` is over exactly that same serialization.
  The `id` is therefore bound by every signature, and the envelope
  binds operation type, full content, group, epoch,
  `policyVersion`, and causal predecessors — an operation is not
  valid anywhere else, at any other position, or under any other
  policy.
- **Canonical proof form.** `proof.signatures` MUST be sorted by
  `signer` under unsigned bytewise comparison of the DID string;
  an unsorted proof is invalid. (Hygiene, not identity: no
  identity or digest in this layer is ever computed over proof
  bytes — 3.2.)
- **Proof variants merge canonically.** `proof` is outside the
  `id`. Encountering several envelopes with the same `id` and
  different valid proofs (independently collected evidence), a
  replica MUST hold exactly one **merged proof**. The merged
  proof is, normatively, a **pair of sets**: a signature set and
  a vouch set. It is built entry-wise, and **entry to the
  merge is position-bounded on both sides**: a signature enters
  only if its signer is one of the operation's **eligible
  signers** (3.4.2) — the members of the state materialized from
  the operation's ancestors, pending exits included, plus the
  operation's `body.subject` where it has one, plus, for the
  genesis only, the group DID key and the founder's anchor. The
  eligible set is a superset of every signer any validity path
  of the operation can count — the policy currency, the
  self-authorized author, every §5.4 pending-exit exception, and
  the genesis pair — while staying Sybil-bounded: membership of
  the ancestor state is not mintable. A vouch enters only
  if it is
  admissible per 4.3 — it validates as `vouch@2` (5.3), its
  `subject` equals the operation's `body.subject`, its `accept`
  digest matches the enclosed admission's accept,
  its **voucher is in the ancestor-position policy currency**
  (only rules read vouches, and rules read the currency),
  and
  the operation's rule key can carry a vouch rule at
  all (any other operation admits no vouch). Within those
  bounds: per signer, the first valid signature seen; per
  voucher, the first admissible vouch seen. Nothing outside
  the bounds ever occupies an entry — a Sybil signer or voucher
  merges nothing however many valid bytes it signs (anchors are
  freely mintable; currency membership is not), and a variant
  cannot poison an issuer's slot with evidence that proves
  nothing about this operation. Later arrivals for an
  already-covered signer or issuer are ignored — no replacement
  churn of any kind; entries sorted per the canonical form. A
  merged proof carries no authoritative single `mechanism`: the
  label is derived, in exactly one way everywhere —
  `signature-set` when the vouch set is empty;
  `encounter-presentation` when the vouch set is non-empty
  and the signer set is exactly the operation's subject;
  `composite` otherwise — and nothing normative reads
  it. **What
  converges — and all that evaluation ever reads — is the signer
  and voucher *sets***: any valid signature is equivalent evidence
  of its signer, any admissible vouch of its voucher's edge,
  so replicas whose proof bytes differ still
  reach identical verdicts, and no digest or identity in this
  layer is ever computed over proof bytes (3.2). Because only
  subject- and accept-bound vouches enter, the merge
  dominates every variant (superset of each variant's
  currency signers and
  admissible voucher edges — the only entries evaluation ever
  counts) — so whatever any valid variant
  proved, the merge proves: replicas that collected different
  evidence still reach identical verdicts. And it is bounded
  by one entry per eligible signer and per currency voucher —
  never more than the membership plus one. **The merge is an
  accumulator, not a wire artifact:** the wire caps of the
  shipped schemas (8192, sized at twice the admission bound —
  3.6) bound one serialized artifact, never the accumulated
  evidence, and a substrate MAY convey evidence for one `id`
  across several transmissions (proof merging is a replica
  conformance duty — 9.1). While membership stays at or below
  the wire ceiling — every state outside the degraded state of
  3.6 — a canonical merge re-serializes schema-conformantly in
  one artifact. Application of an operation MUST
  be idempotent by `id`.
- **`prev`:** the op-ids of the DAG heads known to the author at
  authoring time. The genesis operation has `prev: []` and is the
  only such operation.
- **`epoch` / `policyVersion`:** MUST equal the epoch and policy
  version of the state materialized from the operation's
  ancestors. An operation whose ancestors do not produce that pair
  is invalid — this, not wall-clock time, is the replay and race
  gate. (What a merge can and cannot change about conferred
  effects is 3.6's closed exception list.)
- **No clock in validity:** no rule in Sections 3–8 makes validity
  or epoch effect depend on a verifier's wall clock. Two honest
  verifiers holding the same operations MUST reach the same
  verdict at any time. Wall-clock claims exist only at the service
  boundary (7.3), as signed fields with declared skew bounds.
- **`crit`:** extension fields whose semantics restrict authority.
  A verifier encountering an unknown field listed in `crit` MUST
  reject the envelope; unknown fields not listed in `crit` MUST be
  ignored. The shipped transcription schema accordingly passes
  unknown envelope-level fields through; rejection on unknown
  restrictive content is the `crit` mechanism's job, never the
  schema's. Fields defined in this document are never listed in
  `crit`.

### 3.4 Operation validity

#### 3.4.1 Genesis validation

The genesis operation has no ancestors and is validated by its own
complete procedure. It is valid iff:

1. its envelope parses, `op` is `"group.genesis"`, and its `id`
   recomputes;
2. `prev` is `[]`, `epoch` is `0`, `policyVersion` is `1`;
3. `proof.mechanism` is `signature-set` with exactly two
   signatures over the envelope serialization, **by two distinct
   keys**: one by the key of the DID in `group`
   (self-certification) and one by the founder's anchor (consent —
   no one founds a group over someone else's name). The group DID
   MUST differ from the founder's anchor;
4. its body contains: `members` — exactly one anchor, the founder;
   `card` — the founder's contact card in the displayed form of
   Encounter §6 (proof verifying under its `anchor`, which MUST
   equal the founder; neither `sentTo` nor `boundTo`) — its
   key-agreement key is what later transitions seal the founder's
   key envelopes to, exactly as an accept's card serves admitted
   members; `policy` — structurally valid and satisfiable against
   the founder-only membership per 4.4; `visibility` — the initial
   mode (Section 8); `adapter` — the registered adapter id
   (Section 9); `contentKeyCommitment` — the epoch-0 commitment
   per 7.1's commitment rule, the key produced locally by the
   founder through the adapter (9.5; no distribution exists or is
   needed at genesis); `serviceIdentity` — the founder's derived
   service identity (5.2), seeding the view quorum (7.3);
5. `author` is the founder.

**The founder's anchor class (5.1):** the founder's anchor MUST be
a fresh dedicated context anchor minted for this founding act and
used in no other context — Identity §6's nonce-based pair class,
a founding being a relationship-creation act. The joiner's
`group/<genesis digest>` context cannot exist before the genesis
digest does, so the founder's per-group anchor comes from the
nonce-based register row instead: the same scoping property, a
different register row, stated rather than hidden.

Within one group (one genesis digest), the genesis is by
construction the only operation with empty `prev`; any other
operation with empty `prev` belongs to a different group (3.2).

#### 3.4.2 General validation

A non-genesis operation is valid iff, in order:

1. its envelope parses and its `id` recomputes;
2. all `prev` references resolve to valid operations of the same
   group;
3. with *S* the state materialized from its ancestors: `epoch` and
   `policyVersion` equal those of *S*;
4. its policy proof satisfies the applicable rule (or rules, 4.1)
   of *S*'s policy against *S*'s **policy currency** — the members
   of *S* excluding pending exits (5.4) — with a closed exception
   list, identical here and in 5.4: `member.leave`
   and `service-identity.announce` are self-authorized;
   a leave-discharging `epoch.rotate` (5.4) and the last-member
   and drained `group.dissolve` paths (5.4) are valid with any
   single entitled signature, non-overridably; and for exactly
   the three ending-or-repairing operations a pending exit may
   author — the discharge, the drained dissolve, and
   `lineage.repair` (5.4) — the rule evaluates against **the
   members of *S* including pending exits** instead of the
   currency, so the same gate that permits their authorship
   accepts their signatures. (Terminology, used by 3.3's proof
   merge: an operation's **eligible signers** at its position
   are the members of *S* including pending exits, plus its
   `body.subject` where it has one; the genesis, which has no
   ancestors, has exactly the group DID key and the founder's
   anchor — 3.4.1.);
5. its body passes operation-specific validation (Sections 4–8),
   including post-state validation at its declared position
   (anti-deadlock 4.4; retained-set coverage 7.1; no narrowing
   without transition 7.1).

Validity is judged at the operation's declared position — against
the operation's ancestor closure and nothing else. Whether a
valid operation *takes effect* in a merged materialization is
governed by 3.6's outcome rules, whose exceptions to
merge-finality form a closed, named set.

### 3.5 Materialization

- Materialization MUST be deterministic, and its order is a
  defined linearization, not a pairwise rule: **repeatedly, among
  the not-yet-folded operations all of whose ancestors have been
  folded (the ready set), fold the one with the smallest `id`**
  under unsigned bytewise
  comparison of the complete `oid:` string's ASCII bytes — no
  locale, no decoding. This ready-set rule is a total,
  causality-respecting linearization of any DAG (a pairwise
  "concurrent operations in id order" is not: causality between
  A and C plus id comparisons against a third concurrent B can
  demand a cycle; the ready-set rule cannot). "Fold position"
  everywhere in this document means position in exactly this
  linearization.
- The fold applies each operation's effect subject to 3.6; an
  operation caught by one of 3.6's named outcome rules remains
  *valid* but confers no effect in that materialization.
  Canonicality — including terminality (5.4) — is a property of
  the **full materialization at hand**, deterministically and
  identically on every replica holding the same DAG; what a
  later-merged concurrent branch can change is exhaustively
  3.6's exception list: it can force the forked state, let a
  canonical dissolve prevail, let an authorized enforcement
  operation prevail over a concurrent additive claim about its
  own subject (the enforcement-prevails matrix pairings —
  `member.add` ∥ `member.remove` and `member.leave` ∥
  `member.remove` of one subject), or revise a
  terminality-by-emptiness verdict (5.4) —
  nothing else, and in particular no merge revises the effect of
  an operation that took it at its position. (Same-subject
  admission concurrency is deliberately **not** on this list:
  it is idempotent and voids nothing — 5.3.)
- Materialization has three possible outcomes: a group state, the
  **terminal** state (5.4), or the **forked state** (3.6). All
  three are deterministic functions of the DAG.
- **Signals versus canonical state:** operations travelling as
  messages (signals, including trust tasks) MUST NOT change
  materialized state on receipt; they MAY create durable pending
  records and provisional UX only if valid against local state;
  the merged log decides. Signal disposition MUST be a
  deterministic function of `(operation, local state, existing
  pending state)`.

### 3.6 Concurrency: the conflict matrix

Operations divide into **additive** operations (no epoch effect),
**enforcement** operations (they carry an epoch transition, 4.5),
and **terminal** operations (`group.dissolve`, including the
last-member leave — 5.4). Class rules govern merges of concurrent
branches; the matrix fixes the defined pairings; unlisted additive
pairings merge by union. (The design principle behind every rule —
where authority is contested, materialize the lesser authority —
is informative; the rules themselves are exhaustive and explicit.)

**Class rules.**

1. *additive ∥ additive:* both take effect. Set-valued state
   merges by union; a contested scalar field takes the value
   folded last under 3.5's order.
2. *additive ∥ enforcement:* both take effect; where they conflict
   about authority, the enforcement side prevails. The merge
   creates remediation duties (below).
3. *enforcement ∥ enforcement:* sibling epochs. Their merged key
   world is undefined in this version (OI-1); their merged
   **materialization outcome is defined**: the group enters the
   **forked state** — a distinguished, deterministic outcome in
   which no operation building on either sibling is canonical, all
   authorization answers are fail-closed, and the condition MUST
   be surfaced. Replicas reach this state by admitting both
   siblings — which is why sibling evidence MUST keep travelling
   (the evidence-transport rule, 5.3); **services** — which cannot
   judge authority entries — reach their own fail-closed state
   through the view machinery alone: the freshness bound and the
   divergence obligations of 7.3 (obligations 3 and 5; a forked
   group cannot issue a fresh canonical view, so the service
   closes at the current view's expiry at the latest). The forked state
   ends only by reconciliation (OI-1); until OI-1 is resolved,
   conformant operation is single-partition per group for
   enforcement operations — the linear interim adapter's scope
   (9.6). A malicious authorized member can force the forked
   state; that is denial of service by an insider against their
   own group, fail-closed and attributable, never an authority
   gain.
4. *terminal ∥ enforcement:* forked state (a dissolution carries
   the group's end, an enforcement operation a new epoch; they are
   sibling claims about the key world's future).
   *terminal ∥ additive:* both are judged at their positions; the
   merged state is terminal — except that a `member.add` canonical
   at its position keeps the group alive as stated in 5.4's
   emptiness rule when the terminal outcome arose from emptiness
   rather than from `group.dissolve`. A canonical `group.dissolve`
   always prevails: concurrent additive operations confer nothing.

**Matrix of defined pairings.**

| Concurrent pairing | Merge rule |
|---|---|
| `member.add` ∥ `member.add`, same subject (same or different accepts) | idempotent — the subject is a member through every candidate; every candidate consumes the accept it encloses; no candidate is voided and none is distinguished (5.3) |
| `member.add` ∥ additive op, different subjects | union |
| `member.add` of X ∥ `member.remove` of X | the removal prevails; X is not a member of the merged state; the admission's accept **is** consumed (content-bound, 5.3) — the consent was honored, then X was removed; re-admission needs fresh consent |
| `member.add` ∥ epoch transition (any) | the subject is a member of the merged state but lacks post-transition keys → **re-welcome duty** |
| `policy.change` ∥ any enforcement operation (another `policy.change` included) | sibling epochs → forked state (class rule 3) — a policy change is a constitutional claim, and concurrent constitutional claims are never raced |
| `member.leave` ∥ epoch transition | the leave merges; it is discharged iff the transition's ancestry contains it (7.1); an undischarged merged leave keeps its obligation |
| `member.leave` ∥ `member.remove`, same subject | the subject is gone either way; the removal's transition governs |
| `member.leave` ∥ `member.leave` (different subjects) | both merge; obligations per 5.4; emptiness per 5.4 |
| `service-identity.announce` ∥ anything additive | union; per-anchor scalar (the announced key) takes the value folded last; first-bound-wins across anchors per 5.2 |

**The removal disposition over concurrent authorship.** A canonical `member.remove` disposes as
**non-canonical** — a whole-DAG disposition of the enforcement-
prevails family, computed like the forked state over the merged
materialization, never a revision of position-local validity or
proof evaluation (3.5 stands untouched):

- (a) every concurrent additive operation whose `author` is the
  removed subject;
- (b) every concurrent admission whose consumed accept encloses an
  invite the removed subject issued;
- (c) every concurrent additive operation whose proof does not
  satisfy its rule without the removed subject's signatures — as
  this disposition, not as a proof shortfall: at its position the
  proof was sufficient, and stays so on the record;
- (d) **the closure is transitive over the puppet chain:**
  removed-disposed further are — recursively — every admission
  whose consumed accept encloses an invite issued by a subject
  whose own admission is removed-disposed, and every additive
  operation whose `author` is such a subject (Mallory→X→Y→… ends
  here — MLS-inspired: a commit that removes a member kills their
  open proposals; the transitive, already-materialized chain is
  RLTP's own additional duty). For each
  disposed admission the same-subject consequences apply (the
  subject is not a member of the merged state; the accept is
  consumed as in the `member.add ∥ member.remove` pairing). This
  is a whole-DAG disposition recomputed on merge — nothing is
  re-validated, so no suppression cascade returns.

**Rule (c)'s evaluation point (decidable):** (c) is evaluated
against the policy version in force at the operation's position
and the operation's **current canonically merged proof
accumulator**, re-evaluated on every accumulator change; what is
set aside is exactly the removed subject's signatures and proof
material. The transitions `removed-disposed ↔ canonical` are
therefore closed and deterministic: a later third-party signature
that satisfies the position's policy without the removed subject
heals the operation to `canonical`; a removal admitted later can
dispose it again.

**The total disposition order.** Where classifications overlap —
an operation that is both a fork-sibling descendant and in the
removal set — the disposition is total and ordered:
**`forked` ≻ `removed-disposed` ≻ `canonical`**. Transitions are
closed under the order: `removed-disposed → forked` when an
enclosing fork arises; `forked → removed-disposed | canonical`
when a reconciliation (OI-1) resolves the fork, re-evaluated
against the reconciled DAG; `removed-disposed ↔ canonical` per
rule (c) above. **d′ as a fixpoint (decidable, terminating — the formal
operator):** for a canonical removal R, define F_R over two
disjoint domains — the set D of **admission operation-ids** and
the set E of **other additive operation-ids**. Seed: the
admissions of (b) into D, the operations of (a)/(c) into E. Step:
an admission op-id enters D iff its consumed accept encloses an
invite whose issuer is **admission-orphaned in D** — every
admission op-id that legitimizes that issuer's membership already
lies in D; an additive op-id enters E iff its author is
admission-orphaned in D. **Genesis is its own legitimization
root and is never disposable by d′** — a founder is never
admission-orphaned, so founder-issued invites never enter through
this step (a founder is reached only by an explicit removal, rule
(a)–(c)). The removal-disposition set is **one least fixpoint of the
global operator F whose seed is the union of the seeds of all
canonical removals** — never a union of per-removal fixpoints
(two removals may each dispose one of an issuer's admissions;
only the joint fixpoint orphans them). `Legitimizes` is causally
bound: the admissions that count for an issuer at an artifact
are exactly those carrying the issuer's membership **at that
artifact's causal position** — a later re-admission never heals
an earlier puppet act. F is monotone on the finite powerset of
held operation-ids (its step only ever adds ids), so the least
fixpoint exists and the computation terminates on a finite held
DAG; a healing under rule (c) re-runs it, so downstream
operations heal with their cause, deterministically. **Re-welcome under
disposition:** the re-welcome duty (below) binds only for
`accepted ∧ canonical` admissions whose subject is a member of
the final materialization; a `removed-disposed` admission
disposes its open re-welcome duty and any derived pending exit
non-effectingly — keys already delivered before the disposition
are the honest knowledge residual (7.2). This outcome is
MLS-inspired (a commit that removes a member kills their open
proposals), not MLS-identical: RLTP additionally disposes an
already-materialized admission chain and its duties, which MLS
never has to. **The atomic send-point recheck (all key-bearing
duties):** production, the final entitlement recheck, and the
handoff to the irreversible send adapter are serialized under one
**materialization-generation token** — a value that changes
monotonically with **every authorization-relevant change of the
helper's materialization**: canonical application, any
disposition change (fork detection and removal disposition
included), membership change, epoch change, and terminality —
never only canonical application (a whole-DAG redisposition with
no new application still invalidates in-flight material). The helper
verifies, at production: the recipient is a current member of the
token's snapshot, the admission that entitles them is
`canonical`, and no membership-ending operation lies in that
snapshot's ancestry for them; the produced material is bound to
exactly that snapshot's epoch. At the handoff to the send
adapter the helper re-reads the token **atomically with the
handoff** (compare-and-handoff — no window between the read and
the irreversible send): **changed → the material is discarded and
the slot re-evaluated against the new generation** — a snapshot
is never re-used across the race the token exists to close. A membership-ending operation disposes every open
re-welcome duty and key-service slot for its subject
non-effectingly — a slot is never discharged *to* a former member
(the MLS lesson: no welcome is issued from a commit the group has
not accepted). Entitlement checked only at request receipt is
checked too early; the recheck at the send point is the normative
one.

The rationale is the MLS doctrine — a commit that removes a member
kills their open proposals — and the concrete attack it closes is
the back-dated admission: without this rule a removed member could
position a `member.add` of a puppet before their own removal and
regain post-removal epoch access through the re-welcome duty.
Deterministic and arrival-time-free by construction; under the
interim single-partition scope (9.6) the situation cannot arise,
so this rule's first live use is a precondition of OI-1.

**Evidence transport (the fork's reach).** Entries that are
admitted but not canonically applicable — sibling transitions of
the forked state and their descendants, and operations under the
removal disposition above — **continue to replicate as
non-effecting evidence**, under its own **evidence
authorization** — defined so the forked state cannot starve its
own cure: the peers entitled to evidence are **the members of the
maximal unforked prefix's materialization** (3.6's forked-state
prefix; equivalently, under an undisputed removal: the current
members). A member canonically removed within that prefix stays
excluded — to a removed peer nothing causally new travels after
the removal, evidence included (5.3) — while the fork's
fail-closed answers govern authority, reads, and writes, **never**
the evidence plane; without this separation, fork evidence could
reach nobody exactly when everybody needs it.

**The evidence
session (executable, bilateral):** two replicas MAY establish a
session authenticated by the ordinary challenge-possession
mechanism — judged, for exactly this session class, against a
**presented prefix claim** instead of the (fail-closed) current
head: the initiator presents the **canonical prefix claim**
(`rltp-access-evidence-claim/1` — signed over exactly the one
unified evidence field set below; no other claim form exists). The claimed prefix
is computed over the **conflict DAG**: the union of the ancestor
closures of the evidence root **and of every conflict artifact of
the exchange** — for a disputed transition, both siblings; for a
disposed operation, the operation and its disposing removal; for
a target root, `closure(the target's frontier heads)` (a target
is no authority entry; its domain is its attested closure).
**Completeness is verifier-enforced, never initiator-chosen** (a
merge base is computed from the repository, not from the
requester's selection), and the enforcement is a closed wire
step: a verifier holding conflict artifacts the claim's set
misses answers — before any standing — with the fourth closed
artifact, **`rltp-access-evidence-supplement/1`** (the unified
field set below; its `body`: the complete verifier-side conflict
set and the `snapshotDigest`). **The snapshot is a projection,
not the whole DAG:** for authority roots, `snapshotDigest` = the
multihash over the JCS array of the sorted operation-ids of the
**conflict-relevant projection** — every enforcement sibling and
disposition cause the verifier holds for the named root,
together with their authority ancestor closures; for target
roots, the same construction, typed: targets are projected by
the digest of their **sig-less target signature input**,
registrations **exclusively by their `registrationCoreDigest`**
(never the sig-bearing input — one registration must never yield
two projection identities). A
change outside the projection never supersedes a turn. The initiator
then issues exactly **one** fresh claim over the union; a
supplement or claim against a changed projection yields
`superseded-snapshot`.

**The session result algebra is closed and four-valued:**
`standing-granted | invalid-bundle |
superseded-snapshot (retriable) | evidence-saturated` —
`unknown-baseline` and `missing-registration-core` are **response
variants inside a response body**, never session results (a
session containing them still ends in one of the four) — an
exchange carries **at most 16 parts and 4096 artifacts in
total**; past the cap it ends `evidence-saturated`, and any
retry is a **new transcript**. A bundle whose conflict set is incomplete relative to
the answering verifier's snapshot is **invalid as a whole** — an
initiator cannot regain standing by omitting the branch that
defeats it, and invented "siblings" convict themselves at
admission (only valid enforcement artifacts count).

Over that DAG the claimed prefix MUST be — word for word the
forked-materialization form — **the maximal causally closed
sub-DAG of accepted entries containing no member of any
enforcement-sibling pair of the full conflict DAG and no
descendant of such a member** (the pairs are judged over the
whole conflict DAG, never over the candidate sub-DAG — a lone
branch tip is not "pair-free"): for P → {T₁, T₂}
exactly P results, never a branch tip (a root's own closure
cannot see its sibling — that is why the conflict DAG, not the
root closure, is the domain). Root, the **complete** conflict artifact set (after
verifier-side supplementation the exchange re-runs on the union —
both sides converge on one set), and the resulting prefix
frontier are bound in one digest inside the claim. An older prefix never suffices: under an
undisputed removal the conflict DAG contains the removal, so a
removed member is no member of any claimable prefix for any later
root (the time-machine stays closed), while for a genuinely
disputed sibling the prefix ends below the fork and the
counter-vector stands (B holds P → T₁ removing A, A holds
P → {T₁, T₂} and claims P for root T₂; B accepts and receives
T₂).

**The
handshake is one atomic bundle:** claim, evidence request, and
whatever claim closure the verifier lacks travel together and are
verified as a whole; **no session standing of any kind exists
before the whole bundle verifies** — a verifier missing closure
verifies it from the bundle, never grants first and checks
later.

The session carries exactly one request type, the
**evidence request**, with a **total response function**
`evidenceResponse(root)`: for a disputed transition — both
siblings; for a disposed operation — the operation and the
removal that disposes it; for a target digest —
**branched by source class, each with its own scope** (a replica
target attests `admitted` scope and has neither chain nor
generation: its response is the current in-session span, root
and baseline of the same session, the baseline partition total: `null` →
the full root-session span back to seq 1; a known same-session
**ancestor** of the root → the span down to it; everything else —
a foreign or unknown session, and equally a known same-session
**non-ancestor** — the named variant
`foreign-session-baseline | non-ancestor-baseline`, answered
with the full root-session span; a service target
attests `stored` scope); for a service chain the target chain
from the named target back to `lastKnownTargetDigest` (`digest | null`; null → back to the
chain's `seq = 1`; a non-ancestor or foreign-generation digest →
the closed error variant `unknown-baseline`, answered with the
full chain of the current generation; a chain restart inside the
span → the chain back to the restart marker, which carries its
own continuity statement) — **and, for a service chain, the full registration artifact of
every generation a returned target commits to** — deduplicated,
ordered by `registrationGeneration`, **each g+1 registration
accompanied by its authorization-root view plus the recursive
view-dependency closure down to evidence the verifier already
verified holds (7.3 — standing requires the verifier's own
session anchor and the `previousRegistration` chain into it;
without that anchor the bundle is `invalid-bundle`)** (a held skeleton entry, the anchor, or the
seq-0 root — a sole-tip artifact alone suffices only where its
parent chain is already held verified; without the closure,
effective `m` and signer membership are uncheckable and the
registration is no verification root). A service MUST retain, or
reproducibly serve, this closure for as long as it holds targets
of the generation; where it conformantly cannot, the closed
variant is `missing-registration-authorization-evidence` — never
a silently unverifiable root. This class is part of the response
closure inventory and counts against its bounds (a digest is a commitment,
not a verification root, and historical targets verify against
*their* generation, not the serving one; "current" governs
serving standing only). Each received registration MUST match
the returned targets' core digests and signature chain; a
response that cannot supply a committed generation is the closed
outcome `missing-registration-core` — which is why a service
MUST retain the full registration artifact of every generation
whose targets it still holds (7.3). In every authority variant the
response closure is **the union of the authority ancestor
closures of every returned artifact** — the sibling and the
disposing removal bring their own branch-specific authority
chains (a verifier cannot accept a conflict artifact whose
authorization path it cannot check).

**The four artifacts are
closed and versioned** — `rltp-access-evidence-claim/1`,
`rltp-access-evidence-request/1`,
`rltp-access-evidence-response/1`,
`rltp-access-evidence-supplement/1` — and share **one and only
one** signature
input form — every earlier or shorter claim form is withdrawn —
the JCS serialization of `{ "v", "genesisDigest",
"session", "challenge", "initiator", "responder", "rootKind":
"transition" | "disposition" | "target", "evidenceRoot",
"prefixFrontier", "body" }` with `sig` omitted, signed by the
issuing side's session principal (`initiator` and `responder`
are both always present and bound in all four — the supplement
included, same issuer rules; the claim's
`body` carries the complete conflict-set digest and — where a
supplement preceded — the supplement's snapshot digest, the
request's the variant parameters — for targets
`lastKnownTargetDigest: digest | null` and, where registration
closures are expected, the view cursor
`lastKnownAuthorizationViewDigest: digest | null` (total: a held
ancestor view → only the missing suffix is served; unknown or
non-ancestor → the closed variant `unknown-view-cursor`, answered
with the closure from the seq-0 root or the last shared anchor) —
and the response's the artifact-list digest; the `conflict-supplement` uses the same
form with its own `rootKind`-bound `body`).

**The transcript
profile (total):** a bundle carries at most 256 artifacts (the
closureBound pattern of 7.3); a longer exchange continues under
one transcript of parts numbered **1..n**: every part envelope
is `{ "v": "rltp-access-evidence-part/1", "transcriptId",
"part", "prevPartDigest" (null iff part = 1), "artifacts",
"final" (true on the last part only), "count" (the total number
of parts, final part only), "transcriptDigest" (final part
only), "sig" }`. **`partDigest`** = the multihash over the JCS
serialization of the part envelope with `sig` omitted **and —
on the final part — `transcriptDigest` omitted** (the named
exception that avoids hash recursion); `transcriptDigest` = the
multihash over the JCS array of all part digests in order
1..n; the signature covers the full envelope,
`transcriptDigest` included. **No standing of any kind exists
until the final part's transcript digest verifies over the
complete sequence** — truncation, reordering, duplication, and
a false final all leave the exchange standing-less (vectors,
§14).

**Closure progress is monotone across transcripts:** view
artifacts fully verified inside a transcript are admitted into
the verifier's ordinary view-evidence DAG (obligation 5, under
its own quotas and compaction) whatever the transcript's outcome
— evidence *standing* is withheld, view *knowledge* is never
discarded, so each retry roots in a farther verified anchor and
an over-cap closure shrinks monotonically instead of saturating
forever (the shallow-deepening rule).

These are session-plane forms, normative as JCS
field sets; their schema shipment follows the first adapter
registration (the Replication RO-3 pattern), and Section 11
names them as the profile's session-plane forms. Nothing outside
`evidenceResponse(root)` is ever served — no unqualified frontier difference, no authority
standing, no general content read or write, no eviction effect.
The ordinary current-head session rule stands for everything
else.
Every receiver runs its own admission and reaches the same
disposition, and nothing about the transport asserts canonicality
or triggers effect. This is what
commit-before-forward (5.3) does **not** restrict — it gates
forwarding-as-authority, not the travel of proof; without this
rule the forked state could never reach the replicas that need to
fail closed, and divergence would be silent (the replication
contract's send set runs on exactly this admitted closure).

**Post-merge validation.** After folding concurrent branches the
materializer MUST validate the merged state:

- *Retained-set coverage:* every transition's `keyDist` recipient
  set equals its computed retained set (7.1) — checked at
  validity; re-checked here because merges change nothing about it
  (the retained set is computed at the operation's position, which
  is merge-invariant).
- *Over-capacity tolerance — admission is merge-final:*
  admission rule 0's group bound (5.3) is position-local and
  therefore not merge-stable on its own: two admissions of
  different subjects, each valid at 4095 members, union to 4097.
  This document does **not** repair that at the merge — not with
  an arbitration, not with a cap. Capacity is not a
  who-question, and **every**
  merge rule that decides which valid admission takes effect —
  displacement, a queue, a lapse, or a fold-order cap — inherits the same two defects: it hands an
  envelope-grinding rival influence over *who* belongs in any
  mixed (honest plus Sybil) flood, and it makes canonicality of
  a delivered admission revisable by later merges, which both
  retracts conformantly delivered welcomes and contradicts the
  merge-invariance this section claims for the retained set.
  Therefore, normatively: **every admission canonical at its
  position is a member of every merged materialization
  containing it — finally; no merge rule suppresses, displaces,
  defers, or revises an admission.** The bound has exactly one
  mechanism, and it is position-local: rule 0's freeze — at
  every position showing ≥ 4096 members, no further admission
  is valid; departures shrink the group back under the bound.
  A merged materialization MAY therefore exceed the 4096
  admission bound; the wire caps of the shipped schemas are
  sized at **8192 — twice the admission bound** — as
  denial-of-service ceilings, not group bounds, so
  membership-scaled artifacts (proofs, `keyDist`, view
  identities) stay schema-valid under every honest overshoot.
  **Beyond the wire ceiling lies a named degraded state, not a
  mechanism:** if coordinated concurrent floods drive a merged
  membership past 8192, membership itself is untouched, but
  operations whose artifacts must scale with membership — a
  transition whose computed retained set exceeds 8192 cannot
  emit a schema-valid `keyDist` — are unconstructible and fail
  closed at construction. What never fails: `member.leave` and
  `group.dissolve` (empty bodies), and additive operations
  whose artifacts do not scale with membership. Recovery is by
  attrition, not by suppression: leaves shrink the next
  discharging transition's retained set, and the moment it is
  ≤ 8192 the group rotates, removes, and issues views again.
  The attack that reaches this state is priced and named
  (OI-14): *n* × 4095 requires *n* disjoint partitions each
  flooding to the freeze before any merge; every admission
  carries its inviter's signature, so the flood is attributable
  inside the group; and until OI-1 resolves, conformant
  operation is single-partition for enforcement anyway (9.6) —
  under the linear adapter's total order, overshoot is bounded
  by concurrency width. The residual is stated rather than
  mechanized because every mechanism examined was worse than
  the state it prevented.

**Merge-finality (no suppression cascade).** A suppression
cascade that re-validates descendants of operations a merge has
rendered ineffective is itself a merge rule that revises
membership — an admission valid under a same-base `policy.change`
that lost an id-grindable fold race would be revoked after its
welcome was conformantly delivered, the exact two-evaluations
defect this section rejects for capacity. This document removes
the cascade's **causes** instead of scoping it: `policy.change` is an enforcement operation (4.5),
so a concurrent constitutional claim is a sibling epoch —
forked state, never a raced loser — and the post-merge
anti-deadlock reversal is gone with it. One shrinkage channel
remains and is named rather than reversed: a **concurrent
`member.leave`** (additive) removes its author from the policy
currency at once (5.4), so a `policy.change` satisfiable at its
position can merge into a state where it is unsatisfiable —
the group is then constitutionally stuck above emptiness, the
OI-10 residual, surfaced, with leaves and dissolution always
open; no retroactive reversal exists, because a retroactive
reversal is a cascade seed (4.4). With no rule that renders an
ancestor
retroactively ineffective, there is nothing to cascade:
**validity and effect are functions of the operation's ancestor
closure, and no merge revises them.** The exceptions are
exactly the named outcome rules of this section — the forked
state (nothing on either sibling is canonical: a fail-closed
verdict pending OI-1, not a selection), the terminal prevail
rule (an ending, not a re-decision), and the
enforcement-prevails matrix pairings (`member.add` ∥
`member.remove` and `member.leave` ∥ `member.remove` of one
subject: an **authorized removal** prevailing over a concurrent
additive claim about the same subject is the enforcement class
doing its job on a genuine member of its ancestry, never a
tie-break — the parked-remove construction lands here,
as an ordinary removal, because same-subject admission
concurrency voids nothing, 5.3) — plus 5.4's
terminality-by-emptiness verdict, which is a property of the
whole materialization by construction. None of them re-decides
who belongs by arbitration. And nothing is left to park an
operation under: a
permissive policy that could lose no longer exists — a
concurrent rival policy forces the forked state instead of
silently taking the permissive one's place — and an admission
that shares its subject with a concurrent one keeps its effect,
so its descendants stand on ground the merge confirms.

**Remediation duties** obligate members, never services:

- *Re-welcome:* on merging a branch in which a member was admitted
  concurrently with an epoch transition, any member holding the
  current epoch keys MUST deliver them to the affected member via
  `key-delivery` (10.1) as soon as the merge is materialized.
- *View refresh:* on merging authorization changes from another
  branch, a member of the view quorum MUST issue a fresh
  authorization view (7.3), so no service acts on a narrower or
  wider set than the merged log's.

## 4. Policy

### 4.1 The policy object, rule keys, and the defaults

```json
{
  "policyVersion": 3,
  "rules": {
    "member.remove":  { "type": "threshold", "k": 2 },
    "policy.change":  { "type": "strongest" }
  }
}
```

- Every group has a policy from genesis. `policyVersion` MUST
  increase by exactly 1 with every effective `policy.change`.
- **Rule keys.** A policy maps **rule keys** to rules. Most rule
  keys are operation types; one is an **aspect key**:
  `history.narrow`, evaluated *in addition to* the operation's own
  rule when a transition omits lineage (7.1) — the operation's
  proof MUST satisfy both rules. Registered rule keys and their
  defaults:

| Rule key | Default rule |
|---|---|
| `member.add` | `any-member` |
| `member.remove` | `strongest` |
| `epoch.rotate` | `any-member` (hygiene must stay cheap; the leave discharge additionally bypasses policy, 5.4) |
| `policy.change` | `strongest` |
| `visibility.change` | `strongest` |
| `history.expose` | `strongest` |
| `history.narrow` (aspect) | `strongest` |
| `lineage.repair` | `any-member` |
| `document.attach` | `any-member` |
| `document.detach` | `strongest` |
| `group.dissolve` (collective path) | `strongest` |

  `member.leave` and `service-identity.announce` are
  self-authorized (author's signature; not policy-gated, not
  overridable); the leave-discharging rotation and the last-member
  dissolve are non-overridable single-signature paths (3.4.2,
  5.4). A future registered rule key MUST register its default
  with its definition (Section 11). An operation type with no
  registration is invalid as a proof subject — there is nothing to
  default to.

### 4.2 Requirement types

Four types are defined; the set is open (Section 11); unknown
types are unsatisfiable (degradation direction, Section 11).

- **`any-member`** — one signature of any identity in the policy
  currency (3.4.2); semantically `threshold` with `k: 1`.
- **`actors`** — `{ "type": "actors", "actors": [did…], "k": n }`:
  signatures of `k` distinct listed identities in the policy
  currency. `actors` MUST be non-empty and duplicate-free;
  `1 ≤ k ≤ |actors|`.
- **`threshold`** — `{ "type": "threshold", "k": n }`: signatures
  of `k` distinct identities in the policy currency, `k ≥ 1`,
  evaluated at the operation's declared position.
- **`vouch`** — `{ "type": "vouch", "count": n }` with `n` an
  integer, `1 ≤ n ≤ 16` (the transported variant proof's
  credential cap, 5.3 — a rule demanding more vouches than any
  admission can carry is structurally invalid, 4.4): satisfied
  when the operation's **subject** presents vouches from `n`
  distinct identities in the policy currency. A vouch counts iff the
  subject presents a `vouch@2` artifact (5.3 — a conformant **DTG
  EndorsementCredential**) **issued by that
  member about the subject** — the deliberate human act "I vouch
  for this admission", made cryptographic; it is deliberately not
  an Encounter credential, whose issuer and subject are fresh
  pair anchors by construction (Encounter §4.4) and can never
  meet this rule. Proof form: `encounter-presentation` (4.3 — the
  wire constant keeps its registered 0.24 spelling; a naming
  residue carried honestly, since no verification step branches
  on the label). Verifiers MUST evaluate presented vouches only;
  no registry resolution.
  **Subject-bound:** a vouch rule (also inside a composition)
  is assignable only to rule keys whose operations have a defined
  subject distinct from the proof's signers — in this catalog,
  exactly `member.add`. A `policy.change` introducing a vouch
  rule elsewhere is structurally invalid (4.4).
  *(A cryptographic encounter grounding of the vouch — proving
  a real met edge without naming pair anchors — is the
  zero-knowledge future of the forward-compatibility rule; it
  enters as a mechanism registration, never a recast.
  Minimal-disclosure presentation: OI-5.)*

Rules MAY be composed: `{ "type": "all", "of": [rule…] }` and
`{ "type": "any", "of": [rule…] }` with the obvious semantics;
composition depth MUST NOT exceed 4, and **`of` MUST be
non-empty** — a composition over the empty set is structurally
invalid (4.4): an empty `all` would be the universal
requirement satisfied by anything at zero cost — an admission
gate no member ever consented to lowering — and an empty `any`
is unsatisfiable with an undefined cost maximum; neither is a
rule.

### 4.3 Policy proofs

**Evaluation reads sets, never labels.** A proof's material is
two sets — the **signer set** (from `proof.signatures`, each
signature over the envelope serialization, 3.3) and the
**admissible vouch set** (from `proof.credentials` — the wire
member keeps its 0.24 name; it carries `vouch@2` artifacts) — and
rule satisfaction is a function of these sets alone (4.4's proof
space is exactly this pair). A vouch is **admissible** iff it
validates as `vouch@2` (5.3) — its DataIntegrityProof verifies
under `issuer` (W3C DI-EDDSA, the Encounter-2.3 profile), `issuer`
is of the policy currency at the operation's
declared position, `credentialSubject.id` equals the operation's
`body.subject`, `credentialSubject.endorsement.accept` equals the
document digest of the
operation's enclosed `admission.accept` (the intent binding —
5.3; digest equality over decoded multihash bytes, Encounter
2.3), and `credentialSubject.endorsement.genesisDigest` is this
group's identity
(3.2) — **and** the operation's rule key can carry a vouch rule
at all (4.2's subject binding — in this catalog exactly
`member.add`; a `member.remove` also has a `body.subject`, but
its rules can never contain a vouch rule, so no vouch is
admissible on it). Inadmissible vouches are ignored for
satisfaction and never merge (3.3). The component checks per rule
type:

- for signature components: signer qualification under the
  applicable rule at the operation's declared position,
  signature validity, distinctness, arity;
- for vouch components: admissibility as above, voucher
  distinctness, count — plus the **subject's own signature over
  the envelope** in the signer set, which is what binds the
  immutable vouches to exactly this operation (no freshness is
  claimed or needed).

**`mechanism` is a shape descriptor, not an input.** On the wire
each envelope's proof declares the shape it carries —
`signature-set` (signatures only), `encounter-presentation`
(the vouch set plus the subject's envelope signature), `composite`
(both, for composed rules) — and the shipped schema checks
shape-consistency (a `signature-set` proof carries no
`credentials`). No verification step branches on the label; a
proof whose *sets* satisfy the applicable rule satisfies it
under any consistent label. A replica's **merged proof** (3.3)
is exactly the pair of sets; when re-serializing an envelope for
transport, the replica emits the merged material under the
derived label of 3.3 (one derivation, everywhere) — always
schema-consistent by construction. Future mechanisms (e.g. a
FROST threshold signature, OI-2) register new shape descriptors
satisfying the same contract: material in, sets out — a
zero-knowledge membership or linkage proof of the DTGWG line
enters the same way, as a registration, never a recast (the
forward-compatibility rule of the M-DID loop).

### 4.4 The policy algebra

**The proof space.** A **proof situation** over an evaluation
state *S* is a pair *(A, P)*: *A* a set of signers, *P* a
presentation — a set of (voucher, vouch) edges about the
operation's subject (empty where the operation has none). All
satisfaction sets live in this one product space:

- `Sat(any-member)` = { (A, P) : A contains ≥ 1 of the policy
  currency }
- `Sat(threshold k)` = { (A, P) : A contains ≥ k distinct of the
  policy currency }
- `Sat(actors A₀, k)` = { (A, P) : A contains ≥ k distinct of the
  policy currency listed in A₀ }
- `Sat(vouch n)` = { (A, P) : P proves vouches from ≥ n distinct
  of the policy currency, and A contains the subject }
- `Sat(all[…])` = intersection; `Sat(any[…])` = union — ordinary
  set operations, well-defined because every set is a set of
  pairs.

**Strength order.** *R₁ ≥ R₂ iff Sat(R₁, S) ⊆ Sat(R₂, S).*
Verifiers MUST compute the order from satisfaction sets — by
enumeration over the finite signer and edge universe of *S* or a
provably equivalent symbolic procedure. Syntactic shortcuts are
not conformant: they are unsound. Two consequences any conformant
procedure reproduces (and the vector suite tests):
`actors({a,b}, 2) ≥ actors({a}, 1)`, and
`all[actors({a},1), actors({b},1)] ≥ threshold(2)` where a, b are
in the policy currency. For an operation without a subject, every
vouch set is empty, hence maximal under ⊆ — one more reason
vouch rules are subject-bound (4.2).

**`strongest`** is a meta-rule valid only inside a policy. Its
resolution, per operation: (1) discard **all** meta-rules from the
policy's rule set — `strongest` never ranges over itself or
another meta-rule; (2) discard rules not assignable to the
operation (subject-binding, 4.2); (3) `strongest` denotes
`all[ the maximal elements of the remainder under ≥ at the
evaluation state ]`, incomparable maxima all included. A policy
MUST contain at least one concrete (non-meta) rule; resolution
against an empty remainder is structurally invalid.

**Validation.** At genesis and every `policy.change`, the new
policy MUST be structurally valid (arities per 4.2, depth ≤ 4,
compositions non-empty per 4.2,
subject-binding respected, `strongest` resolvable, **and the
transport-budget cost bound on the `member.add` rule key**,
which is **aggregate — it closes under composition**, because
per-leaf caps do not: sixty-three individually capped
components conjoined still demand thousands of signatures.
Define, recursively, the **satisfaction cost** of a rule as a
pair (signatures, credentials): `any-member` → (1, 0);
`threshold k` → (k, 0); `actors A, k` → (k, 0);
`vouch n` → (1, n) (the subject's envelope signature plus
n vouches); `all[…]` → the componentwise **sum**;
`any[…]` → the componentwise **maximum** — deliberately not the
minimum, which round 14 refuted: a cheap branch's minimum says
nothing in a state where only the expensive branch is
satisfiable, so the cost pair it produced could be unreachable.
The maximum is equivalent to requiring every `any` branch to
respect the cap itself, and it makes the bound a theorem
provable by induction: **every satisfying proof contains a
satisfying variant whose entry counts are at most `cost(R)`**
(an `any` is satisfied through at least one branch, whose
extracted variant costs at most that branch's cost ≤ the
maximum; an `all` is satisfied by per-component selections
whose union costs at most the sum; over-counting from shared
signers is conservative, never permissive). The rule assigned
to `member.add` — as a whole, after meta-resolution, not per
leaf — MUST satisfy `cost ≤ (64, 16)`. The reason is a hard companion bound: an
admission's proof must cross the Delivery carrier inside its
64 KiB plaintext budget when a boundary-crossing admission is
enclosed for the invitee's bootstrap — 5.3, Membership §2 —
whereas every other rule key's proofs live and die in the
replica and carry no such cap) and
**satisfiable**: every rule, after meta-resolution, against the
post-operation policy currency — `threshold(k)` requires
`k ≤ |currency|`, `actors(A,k)` requires `|A ∩ currency| ≥ k`,
`vouch(n)` requires `n ≤ |currency|` excluding a candidate
subject — **and, for the rule assigned to (or resolving under
`strongest` for) the `policy.change` rule key, two constitution
guards: (1) it MUST NOT contain an `actors` component, at any
depth — identity-pinned constitutional power is structurally
invalid, because it is un-amendable by construction after
natural growth and departure (round 17 B3: a founder-pinned
rule minted at singleton genesis left every later member unable
to ever amend once the founder left — and no position-local
margin can catch a pinning whose fragility only appears as the
group grows); and (2) where the currency is plural, the
one-leave margin: it MUST
remain satisfiable against the currency minus any single
member.** A constitution demanding unanimity of a plural
currency is thereby structurally invalid — it is the exact
shape with zero shrink margin, where one concurrent leave locks
the constitution for good (round 16 M3); the margin absorbs
any single racing departure, position-locally and checkably,
and the `actors` ban makes constitutional power
person-independent from genesis on.
An enforcement operation whose post-state makes
`policy.change` unsatisfiable is invalid (anti-deadlock; the
leave-discharging rotation is exempt — it must never be
blockable, and emptiness is terminal anyway, 5.4). The check is
position-local and final: no post-merge reversal exists —
concurrent *enforcement* shrinkage against a `policy.change` is
a sibling-epoch shape and forks fail closed (3.6), while
**several** concurrent `member.leave`s (additive, each author
leaving the
currency at once, 5.4) can still strand a satisfiable
`policy.change`
in an unsatisfiable merged state beyond the margin: that is the
constitutional
lock of OI-10, named there and below, surfaced, never reversed
retroactively (a retroactive reversal is a cascade seed). If
shrinkage renders *other*
rules unsatisfiable, the affected operations are blocked (fail
closed) until the policy is changed — which anti-deadlock keeps
possible. Groups SHOULD prefer `threshold` over `actors` where
shrinkage is expected *(shrink-robust forms: OI-10)*.

### 4.5 Privileged operations (catalog and body profiles)

| Operation | Class | Epoch effect | Body (normative profile; closed) |
|---|---|---|---|
| `group.genesis` | — (root) | creates epoch 0 | 3.4.1: `members`, `card`, `policy`, `visibility`, `adapter`, `contentKeyCommitment`, `serviceIdentity` |
| `member.add` | additive | none | `subject`, `admission` (5.3) |
| `member.remove` | enforcement | **transition, atomic** | `subject` (MUST be a member at the declared position), `transition` (7.1) |
| `member.leave` | additive¹ / terminal² | obligates next transition | empty; the subject is the author (5.4) |
| `epoch.rotate` | enforcement | **transition, atomic** | `transition` |
| `policy.change` | enforcement | **transition, atomic** | `policy` (the complete new object, 4.1), `transition` (7.1) — a constitutional change is an authority change; carrying the transition is what removed the same-base race and, with it, the cascade (3.6) |
| `visibility.change` | enforcement | **transition, atomic** | `mode`, `transition` (Section 8) |
| `history.expose` | additive | none | `fromEpoch`, `toEpoch` (optional), `keys` (Section 8) |
| `lineage.repair` | additive | none | `epoch`, `opens`, `ct` (7.1: re-publication or gap-bridging of a lineage entry, verifiable against commitments) |
| `document.attach` | additive | none | `document` (identifier), `dataPolicy` (Layer-4 disposition declaration) |
| `document.detach` | enforcement | **transition, atomic** | `document`, `transition` |
| `group.dissolve` | terminal | terminal | empty (three paths, 5.4) |
| `service-identity.announce` | additive | none | `serviceIdentity` (5.2); self-authorized |

¹ `member.leave` cannot carry a transition (the leaver must not
know post-leave keys); it obligates one (5.4).
² a leave at a position of sole membership is the last-member
dissolve — terminal class (5.4).

Every registered operation MUST declare its class, epoch effect,
rule key default (4.1), and closed body profile; the shipped
transcription schema carries the body profiles, closed
(`member.leave` and `group.dissolve` bodies are empty and the
schema enforces emptiness). Operations marked *transition, atomic*
carry the transition **in the same envelope**: claim and ability
change together or not at all — the atomicity the port enforces
(9.3). The class assignment upholds the epoch invariant of 7.1.

## 5. Members

### 5.1 Identity

Members are anchors — and **a member's anchor is a per-group
context anchor (its M-DID), never a cross-group coordinate**. The
native profile is `did:key` with mnemonic recovery; device-level
signing is an Identity-layer concern. Normative is the **scoping
property**: a member anchor MUST be an anchor created for exactly
this group and MUST NOT be used in any other context, group, or
relationship. Two register rows of Identity §6 supply it: a
**joiner** derives the `group/<genesis digest>` context — the
invite carries the genesis digest (Membership §3.1), so the anchor
exists before admission. **The digest-to-label transition is
canonical:** a received genesis digest may arrive in either
accepted encoding (Encounter 2.3, `u`/`z`); before forming the
`group/<digest>` label, the validated digest MUST be re-encoded to
its canonical `u` form **for the derivation only** — Identity §6
accepts exactly that form, and the same multihash yields the same
member anchor whichever rendering carried it. The signed artifact
is never rewritten (the comparison-versus-bytes separation of
Encounter 2.3, applied to derivation). This is the member-anchor
counterpart of the service-identity rule, which already
canonicalizes its digest the same way (Identity §7); the **founder**, for whom that context
cannot exist before the genesis digest does, mints a fresh
dedicated context of the nonce-based pair class for the founding
act (3.4.1). The member's **self anchor (S-DID)** appears in no
artifact of this layer except inside `member-mapping@1` (5.5):
joining discloses a group-scoped identifier to the roster, never
the coordinate that links a person across groups — crossing that
boundary is the deliberate act of 5.5. *(Method agnosticism and
identity scoping: OI-7; the DTGWG-aligned class names R/M/P/S-DID
follow the network-visibility layer §2.)*

### 5.2 Derived service identities

- For every service interaction an actor MUST use a **derived
  service identity** and MUST NOT present its main anchor to a
  service. The native derivation is **Identity §7's, incorporated
  byte-exactly, never paraphrased**: an Ed25519 key from
  HKDF-SHA-256(IKM = the root IKM of Identity §4 (the 64-byte
  BIP-39 seed), salt = empty, info = the UTF-8 bytes of
  `rltp/v1/service-identity/` followed by the genesis digest in
  canonical `u` form (3.2), L = 32) — deterministic, per-group,
  re-derivable after total device loss (nothing authority-bearing
  lives only on a device); any divergence between this sentence
  and Identity §§4/7 is a defect here, and Identity governs.
- The binding member ↔ derived identity lives **inside the
  encrypted log**: the founder's identity in the genesis body,
  every other member's via `service-identity.announce` — additive,
  self-authorized, body `{ "serviceIdentity": "did:key:…" }`,
  authored by the member it binds. Its author MUST be a member at
  the declared position; a derived identity already bound to a
  different anchor in the operation's ancestry cannot be bound
  again — **first binding wins**, later conflicting announcements
  are not canonical. A member MUST announce before participating
  in the view quorum (7.3); implementations SHOULD announce
  immediately upon admission. **A replacement announcement (a
  member changing their own identity) takes effect at the first
  canonical epoch transition whose ancestry contains it, never
  within the running epoch** — the ancestry binding makes the
  effective set deterministic under concurrency (a transition
  merged concurrently with the announcement does not carry it;
  the next one does), the view identity set of one epoch stays
  strictly grow-only (7.3), and an identity rotation after key
  compromise rides the `epoch.rotate` that such a compromise
  warrants anyway. Toward
  services the derived identities appear bare; the mapping to
  anchors never leaves the log. *(A future unification of this
  derivation with the Identity registry's label classes is
  recorded as a debt — deliberately not taken while Identity 0.11
  is converged; the derivation above is self-contained and
  deployed nowhere.)*

### 5.3 Admission and removal

**Admission is consent-bound.** This section owns, normatively,
the `member.add` body profile and materialization rules that
Membership Tasks 0.7 §3.3 defined and marked for adoption (its
MO-5); the document shapes (invite, accept, welcome seal) remain
defined there.

An admitting `member.add`'s body carries:

- `subject` — the admitted **member anchor** (the subject's
  `group/<genesis digest>` context, 5.1);
- `admission` — the full consent evidence:
  `{ "invite": <complete membership-invite document>,
     "accept": <complete membership-accept document>,
     "welcome": <digest of the welcome plaintext> }`.

Enclosing the complete signed documents — not digests — is what
makes admission verifiable without private knowledge: every
replica holds the evidence, any authorized member can complete an
admission, and invitation provenance is read from the enclosed
invite's signature, never from an assertable field. Where an
admission itself must travel to the subject for bootstrap
(Membership §3.3's boundary crossing), the enclosed operation
carries a **transported variant proof** — never the replica's
merged proof — defined as a checkable property of the artifact,
not by a minimality order or a chooser: the proof MUST satisfy
the applicable rule at the admission's position **and** carry at
most **64 signatures** and at most **16 credentials**, each
credential at most **2048 bytes** in JCS serialization (an
acceptance cap of this layer; capping the fields at the source —
`proofValue`, `proof.created` precision — is recorded as a debt
toward the Encounter layer, §15). Any proof with these
properties is conformant; that one exists whenever the rule is
satisfiable is what 4.4's aggregate cost bound guarantees.
**Fit is a sender duty, not a theorem:** Membership's normative
maxima (16 384-byte invite and accept, a 16 384-byte welcome
plaintext whose seal is larger still) can in the worst case
consume the carrier budget on their own, so this document states
the arithmetic honestly in Section 12 — nominal constructions
carry the full-cap proof with margin; adversarially maximized
documents do not — and inherits Membership §2's rule that the
sender MUST verify the complete serialized task against the
Delivery plaintext limit before sending. Where the full
boundary-crossing admission does not fit, **the guaranteed
bootstrap path is the self-contained (re-)welcome** (10.1 —
verified against the invitee's own accept, always within budget);
the admission evidence reaches the subject through replication
after bootstrap. No legitimate admission is thereby
undeliverable; the enclosed form is an optimization, never the
only path.
The replica-side merge (3.3) is storage semantics, not a wire
form. **And the boundary rule in full: no transition-carrying
envelope ever crosses the replica boundary** — a `keyDist` scaled
to the retained set cannot fit any carrier budget and nothing
outside the replica is entitled to it; what outside parties need
travels in purpose-built compact artifacts (key material via
`key-delivery`, 10.1; the removal notice as the compact profile
of 10.2).

**The vouch (`vouch@2`) and the candidacy — the vouch path's
flow:** where the `member.add` rule contains a vouch component,
its inputs are **DTG EndorsementCredentials** (WD01) with this
layer's `AdmissionVouch` endorsement vocabulary — the community-
defined structure WD01 delegates to us. A vouch is one closed VC:

`{ "@context": ["https://www.w3.org/ns/credentials/v2",
"https://firstperson.network/credentials/dtg/v1",
"https://real-life.org/rltp/v1"], "type": ["VerifiableCredential",
"DTGCredential", "EndorsementCredential", "AdmissionVouch"],
"issuer": <the vouching member's anchor>, "validFrom":
<RFC 3339 UTC Z>, "credentialSubject": { "id": <the candidate's
member anchor>, "endorsement": { "type": "AdmissionVouch",
"genesisDigest": <the group's identity, 3.2>, "accept": <document
digest of the membership-accept this vouch supports — the
voucher's intent is bound to exactly one consented candidacy, so
a later re-admission of the same anchor needs fresh consent AND
fresh vouches; no standing vouch exists>, "provenance": "met" |
"introduced" } }, "proof": <DataIntegrityProof eddsa-jcs-2022
under `issuer`, incl. the mandatory proof-`@context` copy —
Encounter 2.3's profile> }`

`AdmissionVouch` is the WD01 non-authoritative hint type beside
the concrete `EndorsementCredential` subtype (the PHC pattern);
`validUntil` is absent — the accept binding, not a clock, ends a
vouch's usability (schema `schemas/access-vouch.schema.json`;
admissibility is 4.3's). `provenance` is **self-asserted by the voucher** — an
honest input to the humans a policy puts in charge, never a
verified claim: the verified chain fact stays holder-local
(Visibility §8.6). Vouches are issued **about the candidate's
member anchor** — a disclosure the candidate consents to in
asking for the vouch — so the log learns the member anchor and
nothing else; they travel to whoever assembles the admission over
existing channels (the evidence relay of Membership §3.4 MAY
carry them alongside the pair), and enclosed vouches count
against the transported variant proof's caps (5.3: within the 16
per admission, at most 2048 bytes JCS each). *(Naming seam,
recorded: a vouch is the narrowest case of the architecture
map's identified attestation surface — fixed semantics, one
audience, this group's log; when the presentable attestation
layer is designed, `vouch@2` can be re-told as its profile. It
is deliberately usable before that layer exists.)* The flow — a
*trust ceremony* in the DTGWG sense — inverts the roster lookup:
the candidate never needs to know who is a member. The inviter
surfaces the **candidacy** (the consent pair and the candidate's
display profile at its member anchor) into the group space as
Layer-4 content (Membership §3.4's evidence made visible;
authority remains solely this section's materialization), and
members act on it themselves: vouch over an existing relationship
channel, meet first and then vouch, or introduce the candidate to
further members (Visibility §8). A group wanting a non-vouch
fallback writes it into its policy as `any[vouch(n), …]` — a
constitutional option, deliberately not the default.

**Materialization accepts an admitting `member.add` only if, at
its causal position:**

0. `subject` is **not** a member of the state materialized from
   the operation's ancestors, and the resulting membership does
   not exceed **4096 members — this profile's registered group
   bound** (the wire caps of every membership-scaled artifact:
   proofs, `keyDist`, view identities; larger groups need a
   future profile — OI-14). This check is position-local; a
   *merged* materialization tolerates a transient overshoot
   under 3.6's over-capacity rule — everyone admitted at a valid
   position is a member, further admissions freeze until the
   group shrinks below the bound. (Re-admission after a discharged
   exit needs a fresh admission; whether an *older unconsumed*
   accept may serve it is bounded by rule 3 — consent staleness is
   capped by the invite's validity window, and this document says
   so rather than pretending causal ordering against wall-clock
   documents, 12);
1. both enclosed documents validate against their schemas and
   their proofs verify — the invite credential's
   DataIntegrityProof under its `issuer`, the
   accept under `accept.subject`. *Path convention for rules 1–4
   (Membership 3.4): `invite` names the enclosed invite
   **credential** — the `payload.invite` of the enclosed invite
   document — and the enclosing delivery document is always named
   explicitly; `accept` names the enclosed accept document's
   payload object. The invite document's own `id`, `issuedAt`, and
   `ceremony` are unauthenticated wrapper metadata and carry no
   authority (Membership Section 2; a present `ceremony.enactment`
   must still recompute, Delivery §3 — validity, not authority)*;
2. all cross-bindings hold: `accept.ref` = the **credential
   digest** of the
   enclosed invite (the multibase multihash over the JCS of the
   complete `payload.invite` including its proof — Membership
   Section 2: consent binds to the credential, so byte-different
   wrappers around the same credential are one invitation; digest
   equality over decoded multihash bytes, Encounter 2.3);
   `accept.subject` =
   `invite.credentialSubject.id` =
   `body.subject`; `accept.group` =
   `invite.credentialSubject.group` =
   `operation.group` and the invite's `genesisDigest` = this
   group's genesis digest (3.2); the invite credential's `issuer`
   = the enclosing
   invite document's `issuer`; card ownership per Membership
   3.1/3.2; the
   enclosed invite document's `recipient` =
   `invite.credentialSubject.id`; the enclosed
   accept's `recipient` = the invite's `issuer`; both enclosed
   documents share the enclosed invite document's `threadId` (= the
   invite's
   `taskContext`); `invite.validUntil` ≥
   the invite's `validFrom`;
3. the time window holds: the enclosed accept document's
   `issuedAt` and its
   `proof.created` ≤ `invite.validUntil` + `membership-skew` (an
   honest-clock bound; the effective gate on stale consent is the
   human admission decision);
4. the invite's `issuer` is authorized to invite at the
   operation's
   causal position, per the applicable `member.add` rule;
5. **consumption and arbitration, merge-stable.** *Causal step —
   same accept only:* a
   candidate whose `prev` closure already contains a rule-passing
   admission of the same accept digest
   is non-canonical outright — a causally later replay of a
   consumed consent can never displace its ancestor. The clause
   deliberately does **not** extend to the same subject: rule 0
   already rejects admitting a standing member, and a
   re-admission after an ended membership — which necessarily
   carries the old admission in its closure — is legitimate
   exactly when it encloses fresh consent (round 17 B1: a
   same-subject clause here banned every genuine re-admission
   for life). *Concurrency step — idempotent, voiding
   nothing, distinguishing nothing:* mutually concurrent
   admission candidates **of the
   same subject** (whatever their accepts) all confer the same
   thing — membership of the subject; membership is the union,
   and **no candidate loses its effect** (round 15 showed why
   this matters: a rule that voided the "losing" admission left
   its valid descendants — a `member.remove` judged against a
   state containing it — parked under a voided ancestor, exactly
   the cascade shape this document abolished). And no candidate
   is distinguished either: round 16 showed that a "canonical
   basis" chosen by smallest id was one more artifact a merge
   could move — grindable through unsigned envelope variance,
   shifting accept consumption and invalidating key requests as
   smaller ids arrived. Therefore: **every canonical admission
   consumes the accept it encloses** — consumption is
   content-bound and follows from the candidate's own
   canonicality, which is merge-final, so no accept ever
   becomes free again under any merge (concurrent candidates
   enclosing different accepts consume them all; a re-admission
   after an ended membership always needs fresh consent within
   rule 3's window); and **entitlement rests on any canonical
   admission of the anchor** — a key request may name whichever
   one the requester holds (5.3, 10.1), so no merge can
   invalidate a request by reshuffling a distinguished
   operation. There is nothing left to win.
   The bootstrap effect is served by any rule-passing
   candidate's welcome; nothing ever invalidates a delivered
   welcome.

A `member.add` failing any of these is not canonical, whatever its
signatures.

**The key service duty (no admission hostage, no key hostage).** A
canonical admission entitles its subject — and
every retained
member of a canonical transition (7.1) — to key material that
verifies against the log's commitments, independently of what the
operation's author actually delivered. The claim travels as an
**authenticated key request**: a `key-delivery` document of kind
`request` (10.1) — signed by the claiming anchor, naming the
operation (`oid:`) it claims under, carrying a contact card in
the displayed form whose proof verifies under that same anchor (a
seal needs a *live* key, not a fresh one — Membership §2's rule;
no freshness is claimed or needed). The requester MAY address any
member whose card it holds — the enclosed cards of the log's
admissions are address material, and members MUST retain the
key-agreement private key of their enclosed admission card (the
founder: the genesis card) for as long as they are members. On
receiving a request, a member holding the current epoch keys MUST
first evaluate **entitlement at its own current materialized
state**: the requesting anchor is a member there, and the named
operation is **a canonical admission of that anchor — or, for
the founder, the genesis** (any of them serves — no admission is
distinguished, 5.3) whose
membership has not since ended — a
request from an anchor whose membership has been overtaken by
a removal or a discharged exit MUST be refused; a former member's
old admission entitles them to nothing now. If entitled: produce
fresh material through the adapter (9.5) at the current position
and answer with the matching kind (10.1): `re-welcome` toward a
not-yet-bootstrapped admission subject, **`refresh`** toward any
current member — the founder included — whose transition envelope
failed or vanished, both sealed to the request's card. The
signature gate makes the duty non-triggerable by third parties;
and the duty's shape is **one outstanding answer, rate-served —
not a once-per-anything dedupe** (rounds 17–19 showed that
every dedupe key tried — operation, card, epoch — either left a
multiplier one party controlled or disenfranchised a legitimate
repeat: a lost card, a displaced delivery). Normatively, as a
**slot with a fixed deadline**: each helper keeps one slot per
(`genesisDigest`, requester anchor) — the group's **identity**,
never its DID, so sibling geneses under one address never share a
slot (3.2). A valid authenticated request fills
an empty slot and **starts the deadline**; a request processed
while the slot is full **replaces its content** — request and
card, in the helper's local processing order, which is all
"newest" ever means — **and never touches the deadline** (round
20 M1: a resettable deadline let a helper stay silent forever
against a requester who kept re-asking). The helper MUST
discharge the slot — one answer, sealed to the card the slot
then holds — as soon as its own rate limit allows, **at latest
within `key-request-interval` of the deadline's start**;
discharge empties the slot, and the next request starts a fresh
deadline. The
rate limit is thereby part of the duty — a floor of one answer
per interval, as an equation over the slot — never a substitute
for it. What an abusive
requester can extract is therefore bounded by rate (one forced
answer per interval per genesis digest), carries no accumulating
state (one slot per requester in that group), and stays gated by
entitlement and
the signature; what an honest member is guaranteed is a fresh
answer to their newest request within the interval — whatever
happened to cards, clones, or earlier deliveries. What
the recipient verifies — and what makes garbage deliveries
harmless — is 10.1's commitment check: material is adopted only if
it verifies against the epoch's `contentKeyCommitment` chain in
the log. Consuming an accept without delivering a usable welcome,
or committing a transition with undecryptable envelopes, therefore
delays key possession; it cannot revoke entitlement — it is
attributable misbehavior of the operation's author, and where an
author's garbage distribution walls off an epoch entirely, the
recovery rotation of 7.1 reopens the group without them —
**in a fork-free log**: an insider who additionally mints a
sibling transition forces the forked state (3.6), which is
fail-closed and attributable, never an authority gain — but exit
from it awaits OI-1's reconciliation, and this document says so
rather than promising otherwise (12, OI-1). The duty has one
proactive arm: a member holding both keys of a skipped or
failing lineage step MUST publish the `lineage.repair` entry
upon materializing the defect (7.1) — repair is owed to the
group, not merely available to it.

**Removal.** `member.remove`'s body names the subject — who MUST
be a member at the declared position — **and carries the epoch
transition** (7.1). On merging a removal that materialization
accepts as a new canonical transition — never on delivery —
implementations MUST apply removal hygiene: stop write attempts
after durably preserving unsent local work, invalidate runtime
authority immediately (no privileged operation may race a
removal), and SHOULD wipe group key material once the removal is
canonical, subject to the unique-data boundary (Section 12).
**Replica eviction is part of the same enforcement boundary — for
every way membership ends, with local responsibility:** each
replica's adapter MUST apply eviction no later than **its own
canonical application** of the membership-ending operation — the
removal transition, the leave-discharging transition, or the
terminal state (where replication of the group ends for all
peers; local holdings follow the Layer-4 `dataPolicy`). Where the
substrate itself commits the operation, eviction is part of that
commit (9.3); where a replica merges a remotely authored one, the
duty binds at the merge — no replica can act on a commit it has
not yet seen, and none may forward to the evicted peer after it
has. Authority operations after that commit MUST NOT be
replicated to them. And so that a lagging replica cannot leak
around its own lag: **commit-before-forward** — a replica MUST
NOT forward an operation it has not itself canonically applied.
(**Scope, precisely:** this gates forwarding as authority — the
ordinary replication of canonically applied operations. It does
not gate the **evidence transport** of 3.6: admitted entries that
cannot be canonically applied — fork siblings, their descendants,
operations under the removal disposition — travel as non-effecting
evidence exactly so that every replica reaches the same
fail-closed judgment; a replica MUST NOT withhold them from the
evidence-authorized peers of 3.6 — the membership of the maximal
unforked prefix — and the eviction rule above is untouched: to the
removed peer, nothing, evidence included.)
Application is ancestor-first (7.1), so a batch containing a
removal and its descendants is materialized — eviction included —
before any of those descendants moves on; the window in which a
replica still serves the removed peer by its old state can
therefore never carry operations that causally postdate the
removal. "A member's peers" are the replication
endpoints authenticated by that member's identities — anchor and
derived identities; the device-to-anchor binding underneath is
Identity-layer property (§15). What was replicated before remains
held — knowledge honesty, 7.2 — but "member-only in every mode"
(3.1) is thereby a port obligation, not a hope. The removal
notice travelling to the removed member is the
`removal-notice/0.1` task registered by this layer (10.2) —
never the operation envelope itself (5.3's boundary rule).
Membership's `access-operation/0.1` no longer carries a full
`member.remove` envelope: as of Membership 0.9 that carrier is
narrowed to the admitting `member.add` bootstrap, and the removal
notice is this task (10.2) — the supersession is complete, not
pending.

### 5.4 Leave, pending exit, and dissolve

- `member.leave` is always valid with exactly the author's own
  signature, independent of policy. **Its authority effect takes
  place at the discharging transition:** the leaver holds the
  epoch keys either way, so this layer does not pretend otherwise.
  Between merge and discharge the leaver is in **pending exit**:
  still a member for key purposes (they can read; they remain
  listed in authorization views until the discharging transition —
  7.3; they appear in no further `keyDist`), but **excluded from
  the policy currency** (3.4.2) — a pending exit can neither
  author nor co-sign privileged operations, count toward
  thresholds, nor invite. Exactly three acts remain open to a
  pending exit, each because it ends or repairs rather than
  exercises authority: the discharge, the drained dissolve
  (both this section), and **`lineage.repair`** (7.1 — its
  entries are byte-verifiable against the commitment chain, so
  authoring one asserts nothing; without this exception the
  repair duty could bind a key holder the currency exclusion
  forbids to act, a MUST against a MUST NOT). The discharge: an
  `epoch.rotate` whose
  ancestry contains an undischarged leave is valid with a single
  signature of **any member of the state at its declared
  position — pending exits included** (this is the one privileged
  operation a pending exit may author or sign), **bypassing the
  `epoch.rotate` policy rule** (non-overridable, like the leave
  itself; it is also exempt from anti-deadlock, 4.4). This holds
  in a key-void too: the discharge out of a void uses the
  recovery form of the lineage (7.1), which is a bridge, not a
  narrowing, and needs no further gate — and a discharger who
  holds no prior epoch key at all (admitted into the void,
  nothing to bridge with) declares `lineageVoid` (7.1), equally
  ungated — **a leave can never be
  blocked, by anyone, in any key-world state, by any
  key-possession shape.**
  Implementations MUST issue the discharging rotation
  as soon as they merge a leave and MUST surface the pending
  window (prospective-only exposure).
- **The drain rule.** A group in which **every member is a
  pending exit** has nobody left to rotate
  *for*: no next key world exists to transition into, so the
  ending is not a rotation at all — it is the **drained path of
  `group.dissolve`** (5.4 below): terminal class, empty body, no
  transition, valid with a single signature of **one of the
  pending exits themselves** (the one operation class a pending
  exit may author; it ends the pending state rather than
  exercising authority within it). The condition is exact: one
  member who has *not* left needs no shortcut — their discharge
  rotation retains a non-empty set ({themselves} at least), after
  which the ordinary last-member paths stand open — so the
  drained path never hands an active member single-signature
  terminal power over a collective rule.
  Concurrent leaves therefore drain to termination through one
  ordinary terminal operation by any of the leavers. And one
  honest boundary instead of a false equivalence: if every
  member leaves and then no one ever authors that operation, the
  group is **dormant, not terminal** — all members are pending
  exits, no authoritative change can occur except a finalization
  any of them
  can sign at any time (verifiable `lineage.repair` entries
  remain possible — they repair, they do not decide); nothing is
  blocked, something is simply
  unfinished, and implementations MUST surface the all-pending
  state as exactly that.
- A leave is **discharged** exactly when a canonical transition
  whose ancestry contains it excludes the leaver (7.1's retained
  set does this by construction). Discharge ends membership.
- **Last-member leave is dissolution — revisably.** A
  `member.leave` at a position whose membership is exactly the
  author is the last-member `group.dissolve` (terminal class; no
  transition exists to discharge it, and none is needed — there
  is no next epoch). Like emptiness, this terminality is a
  verdict of the materialization at hand: if a concurrent
  canonical `member.add` merges, the group is not sole-membered
  after all — the leave reverts to an ordinary leave (pending
  exit; the rotation obligation falls to the merged membership,
  the newcomer included), deterministically and identically on
  every replica.
- **Emptiness is terminal, evaluated on the whole
  materialization.** If the full materialization's membership is
  empty, the state is terminal. A concurrent branch can change
  that verdict: a `member.add` canonical at its position (its
  ancestors still showed a member) keeps the group alive — the
  merged membership is non-empty, the newcomer inherits the open
  duties (their own re-welcome among them, 3.6), and terminality —
  like every canonicality verdict — was revisable until the DAG
  was stable (3.5). A canonical `group.dissolve` is different:
  it is an *operation*, it prevails over concurrent additive
  branches (3.6 class rule 4), and it is not revived.
- `group.dissolve` has three paths: **last-member** (when the
  materialized membership at the declared position contains
  exactly the author, the author's own signature suffices),
  **drained** (when every member of the declared position is a
  pending exit and the author is one of them, a single signature
  suffices, non-overridably — the drain rule above), and
  **collective** (valid under its rule, default `strongest`).
  Dissolution is terminal: no further operations are valid, and
  concurrent operations confer nothing. Capabilities end with the
  group — the terminal state is the exception to the transition
  requirement, stated as such in 7.1: there is no next epoch to
  transition into. Former members retain the last key world as
  knowledge (7.2's honesty applies); services treat a terminal
  view per 7.3. Disposition of documents follows the Layer-4
  `dataPolicy` declared at attach time.

### 5.5 `member-mapping@1` — the deliberate crossing of the group boundary

Joining under a member anchor makes co-membership pseudonymous;
this artifact is the **one** way the pseudonym is lifted — per
co-member, deniably. It follows the network-visibility layer's
class-V discipline (its §3: a link between two contexts of one
person is designated-verifier, never transferable) and its §6
construction, with the anchor classes swapped.

Body: `{ "type": "member-mapping@1", "member": <the sender's own
member anchor in this group>, "memberOp": <oid: of a canonical
admission of `member` — or the genesis, where `member` is the
founder>, "self": <the sender's S-DID>, "to": <the addressee's
member anchor in the same group>, "toOp": <oid: of a canonical
admission of `to` — or the genesis>, "card": <a self-card@1 per
Visibility §6.2>, "revision": <int-string>, "issuedAt":
<timestamp> }`, wire conventions per Visibility §2.1. The two
`oid:` references make the key choice deterministic: several
canonical admissions of one anchor may enclose different cards
(5.3 distinguishes none), so the mapping **names** the admission
whose card supplies each side's key-agreement key.
Proof: `mac1` under `HKDF(ECDH(memberX_sender, memberX_addressee),
"rltp/access/mac/member-map1")` and `mac2` under
`HKDF(ECDH(selfX_sender, memberX_addressee),
"rltp/access/mac/member-map2")`, both over the canonical body
bytes. The key-agreement keys are exactly those of the cards
enclosed in the operations `memberOp` and `toOp` name (the
genesis card for a founder side).

The addressee MUST accept only if, in order: (1) envelope and
schema valid, `type` implemented; (2) `to` equals the addressee's
own member anchor of this group, and `toOp` names a canonical
admission whose subject is `to` — or the genesis whose
`body.members[0]` is `to` — and whose enclosed card is the
addressee's own; (3) `memberOp` names a canonical admission whose subject is
`member` — or the genesis, **whose `body.members[0]` is
`member`** — in this group's log, **and `member`
is a current member of the addressee's materialized state** (a
former member's mapping offer is refused, exactly as their key
requests are, 5.3); (4) the card verifies as `self-card@1` under
its own anchor and `card.anchor == self`; (5) `mac1`'s keys are
the key-agreement keys of the cards named by `memberOp` and
`toOp`, and `mac2`'s addressee-side key is the `toOp` card's;
(6) both ECDH outputs are non-zero and both MACs verify;
(7) `revision` per the generic revision rule of Visibility §6.4,
**scoped per (member, to)** — the scope this document registers
for its own revisioned type (higher wins; equal and
JCS-identical idempotent; equal and different an equivocation
error; lower rejected). With
these in place, foreign self anchors are unclaimable, the
addressee can forge the whole artifact (deniability preserved),
and third parties — co-members included — can verify nothing.

**Carrier and audience:** the mapping travels on the **existing
relationship channel** between discloser and addressee — the
trust act presupposes one — registered as a Delivery task
(Delivery §4); it MUST NOT be published into the group space: a
group-space carrier would leak the disclosure edge itself as
group-visible metadata. The UI surface is the **Trust** act. On
verification, the addressee merges holder-locally per Visibility
§6a.1's convergence net — roster entry and contact become one
person locally; nothing changes on any wire.

**Mechanism registration (forward compatibility):** the proof
above is the `dv-double-dh` mechanism — the first registered
mechanism of this artifact class. Future mechanisms — a
zero-knowledge linkage proof of the DTGWG line foremost — enter
as new registrations under a new version of this type, under the
same acceptance contract (material in, verified link out), never
as a recast of the consumers. Schema:
`schemas/member-mapping.schema.json`
(`rltp-access-member-mapping/0.24` — the one new shape this
casting adds to the 0.24 family).

## 6. Actions and the Implicit Capability

Three actions are defined — **`relay`**, **`read`**, **`write`** —
an open set; unknown actions confer nothing. **There is no `admin`
action**: privileged operations are policy-gated, never
capability-gated; collective authority is not delegable.

Every member holds, by membership alone, the **implicit
capability**: read and write over the whole group, rooted in the
operation that made them a member, ending at the epoch transition
that excludes them (discharged leave, removal, dissolution).
Toward services, members exercise read and write under their
derived identities as listed in the authorization views (7.3).
**`relay`** is not a member capability: it is the role of the
group's chosen infrastructure itself — storing and forwarding
ciphertext without reading it (can't-be-evil) — conferred on a
service by the group's registration at that service (7.3) and
ending with the registration.

In this version the implicit capability is the only member
capability: **grantable, narrowable capabilities — in particular
for non-members — are deferred to OI-12**, because a capability
without a sound exercise mechanism toward services is a promise
this layer could not keep. Nothing in this document may be read as
licensing an ad-hoc grant mechanism; a group that needs to share
content with a non-member today admits them, or waits for OI-12.

## 7. Epochs

### 7.1 Transitions and the epoch-key lineage

An epoch transition is carried **inside** the operation that
requires it (4.5). First, its recipient set is defined:

**The retained set** of a transition-carrying operation at its
declared position is computed, not asserted: the members of the
state materialized from the operation's ancestors, **minus** the
operation's `subject` where the operation is a `member.remove`,
**minus** every member whose undischarged `member.leave` lies in
the operation's ancestry. A transition thereby **discharges every
pending leave it causally knows of** — that is the only way
membership shrinks at a rotation, and it is why a rotation can
never be abused to expel anyone else: `keyDist`'s recipient set
MUST equal exactly the computed retained set — no omission, no
stranger, no duplicates — or the operation is invalid. A
transition whose computed retained set is **empty** is invalid
outright: there is no next member to hold a next key world, and
the defined ending for that situation is the drained dissolve
path (5.4), not a rotation into nobody.

The body section `transition` contains:

- `newEpoch` = epoch + 1;
- `contentKeyCommitment`: the commitment to the new epoch's
  content key. **Commitment rule (all epochs, genesis included):**
  the multibase multihash over the **raw key bytes** (for
  `linear/0.1`: the 32 content-key bytes), not over any JSON or
  base64url form. **Freshness rule:** the new content key MUST be
  freshly generated by a cryptographically secure random source,
  independent of and distinct from every prior epoch key of the
  group — and the log enforces the checkable core of that: **a
  transition whose `contentKeyCommitment` equals any earlier
  epoch's commitment in the same group is invalid.** Without
  this, a rotator could re-commit the old key and rotation would
  revoke nothing (7.2's guarantees rest here); fresh generation
  beyond the equality check is a P4 audit criterion (9.5);
- `keyDist`: the per-retained-member key distribution — an array
  of `{ "recipient": <anchor>, "envelope": <digest of the sealed
  key envelope> }`, one entry per retained member. The sealed
  envelope is the construction of Delivery §5 **with three
  deliberate differences, in the manner in which the welcome seal
  makes its own** (Membership §4): (1) HKDF info
  **`rltp/v1/keydist`**; (2) non-empty AAD — **the UTF-8 bytes of
  the JCS serialization of**
  `{ "genesis": <the group identity string, canonical `u` — 3.2>,
  "newEpoch": <integer>,
  "recipient": <anchor DID string> }`; (3) the plaintext is not a
  delivery document but the **keydist object**
  `{ "v": "rltp-access-keydist/0.24", "adapter": "<registered id>",
  "epoch": <newEpoch>,
  "keys": { …per the adapter registration, as in 9.5… } }`,
  JCS-serialized. It is sealed to the recipient's current
  key-agreement key (the card of their accept, the founder's
  genesis card, or the freshest card a key request carried — 5.3)
  and travels via `key-delivery` (10.1). **One carrier, one
  direction:** the operation commits to the envelopes by digest;
  no envelope or its AAD contains the operation `id` — the id
  covers the digests, so a back-pointer would be an
  unconstructible hash fixed point (1.3). Replay across
  operations is idle: a sealed envelope is bound to group, epoch,
  and recipient, and which envelope is *this* transition's is
  exactly what the committed digest says;
- `lineage`: an object `{ "opens": <epoch number>, "ct": … }` —
  the content key of epoch `opens`, AEAD-encrypted under the new
  epoch's content key with AAD = the UTF-8 bytes of the JCS
  serialization of `{ "genesis": <the group identity string,
  canonical `u` — 3.2>,
  "newEpoch": <integer>, "opens": <integer> }`, **the ciphertext
  embedded** (one key — small; embedding removes any availability
  question). **Present by default, with `opens` = the previous
  epoch.** Two deviations exist:
  - `opens` earlier than the previous epoch is the **recovery
    form** — the exit from an epoch whose key distribution was
    garbage (a **key-void**: no member beyond its author ever
    received a usable key there). `opens` names the most recent
    epoch whose content key the rotating author holds; `ct` is
    that key, so the bridge is only constructible by someone who
    actually holds it. **The recovery form is a bridge, not a
    narrowing act, and is therefore gated only by the
    operation's own rule.** The reasoning rests on one honest
    theorem, stated here once for every lineage form:
    **reachable history across a lineage step is exactly as
    durable as the set of members holding that step's keys.** A
    lineage entry — original, bridging, or repairing — is
    constructible only by a key holder; no rule can conjure a
    key nobody entitled still has. The claim about the recovery
    form is deliberately one-directional: **a declared skip
    grants no darkening power that the default form does not
    already grant** — whatever a skip closes, a garbage `ct` in
    a default-form transition closes for exactly the same key
    holders to repair. The forms are not identical (a skip is
    visible to every log reader at once, a garbage `ct` only to
    a key recipient on first decryption; a valid bridge proves
    possession of the `opens` key, garbage proves nothing) — the
    skip is the *more* honest wire form, public and surfaced,
    and — unlike `historyNarrow`
    below, which is the *authorized*, duty-free closure — it is
    never a legitimization. Therefore, normatively: a skipped
    span — the epochs `(opens, newEpoch−1]` — MUST be surfaced,
    as skipped and, once repaired, as repaired; **repairing it
    is a duty, not an option** — a member holding both keys of a
    skipped or failing lineage step MUST publish the
    `lineage.repair` entry (additive, default `any-member`,
    byte-verifiable against the commitment chain) upon
    materializing the skip, as part of the key service duty
    (5.3). The duty binds conformant implementations; its breach
    is not always provable from outside (non-publication proves
    neither possession nor malice — a holder may be gone), so
    the duty is an obligation, not a guarantee. And the residual
    is stated rather than argued away:
    where no member holds both keys of a step — every holder of
    the span key removed, departed, or withholding — that span's
    content is factually dark, under this form and every other.
    That loss is real: content a member wrote in such an epoch
    was group content in the replica, and it is what darkness
    costs. This is the same honesty class as the
    all-members-withhold-keys residual of Section 12;
    authority state in the span was never dark (3.1) — at most
    content is, and at most until repaired;
  - absence of `lineage` altogether is the **narrowing act**,
    gated by the aspect rule `history.narrow` (4.1): the
    operation's proof MUST satisfy it in addition to the
    operation's own rule;
  - **`lineageVoid: true`** is the fourth state, valid **only on
    a leave-discharging `epoch.rotate`** (5.4): the discharger
    declares that they hold no prior epoch key at all — a member
    admitted into a key-void has exactly nothing to bridge
    *with*, and the discharge must never be blockable (5.4), not
    even by its author's own keylessness. It is not a
    legitimized narrowing (`history.narrow` does not gate it and
    does not excuse it): the unbridged step is surfaced as
    damage, it stands under the repair duty of every member who
    does hold the keys, and the durability theorem above says
    honestly what happens if none remains. A discharge with
    `lineageVoid` where the author verifiably could bridge is
    attributable misbehavior with a repairable effect — the same
    class as a garbage `ct`.
    A transition with none of `lineage`,
    an authorized `historyNarrow`, a registered non-native
    `lineageForm` (9.4), or — on a discharge only —
    `lineageVoid` is invalid.
  Members verify a lineage entry on first decryption (does it
  yield the key matching epoch `opens`'s commitment?); a failing
  entry is attributable misbehavior of the transition's author
  and is repairable by **`lineage.repair`** (additive; rule key
  registered, default `any-member`; any member holding both keys
  publishes body `{ "epoch": <the transition's newEpoch>,
  "opens": <epoch it opens>, "ct": … }` under the same AAD rule;
  verified identically; the first canonical verifying entry per
  `(epoch, opens)` counts).

The transition envelope MUST NOT contain plaintext secret material
of the new epoch: the log remains readable to members of the old
epoch — including the subject of a removal — so anything they must
not learn travels only inside the per-recipient sealed envelopes.
Members MUST apply transitions in ancestry order; on a gap, buffer
and recover material through the adapter or a key request (5.3).

**The lineage discharges Membership's MO-6:** a member holding the
current epoch key unlocks the readable history from the replica,
epoch by epoch, exactly as far back as unbroken lineage entries
reach. History never burdens the welcome; nothing can be withheld
from a new member that is not equally withheld from the replica.
Across a narrowed span, a bootstrap yields current-epoch access
plus whatever unbroken lineage reaches, and MUST surface the
narrowed span as such. An adapter MAY realize the lineage
invariant in another form (9.4) — the invariant, not the encoding,
is normative.

**The epoch invariant (grow-only).** Within one epoch of a
continuing group, the authorized set only grows: every operation
that removes or narrows standing authority carries an epoch
transition (4.5); a leave takes authority effect only at its
discharging transition (5.4; the pending exit's loss of *policy*
standing is not key-world authority and is log-visible to every
verifier); the terminal state ends the group rather than narrowing
it (5.4). Normatively: **an operation whose effect removes or
narrows standing authority in a continuing group without carrying
an epoch transition is invalid.** Consequence: a service view of
an epoch is a subset of every later view of the same epoch —
acting on a slightly stale view of the current epoch never grants
what the log revoked (7.3).

### 7.2 What rotation guarantees

Rotation yields **prospective confidentiality** (new-epoch content
is unreadable to non-members of that epoch) and **post-compromise
security** (compromise of pre-rotation material does not extend
into post-rotation epochs). It does not and cannot revoke
knowledge: keys and plaintext already held remain held.
Implementations MUST NOT present removal as erasure.

### 7.3 Authorization views

Services learn a group's authorization state only through
**authorization views** — chained, quorum-signed, epoch-monotone:

```json
{ "v": "rltp-access-view/0.24", "type": "authorization-view",
  "group": "did:key:z6Mk…group",
  "genesisDigest": "…the group's identity (3.2)…",
  "seq": 12,
  "epoch": 8,
  "identities": ["did:key:…derived…", "…"],
  "m": null,
  "terminal": false,
  "prevView": "…digest of the seq-11 view's signature input…",
  "issuedAt": "2026-08-11T12:00:00Z",
  "validUntil": "2026-08-11T18:00:00Z",
  "sigs": [ { "signer": "did:key:…derived…", "sig": "…" } ]
}
```

- **Format and chaining.** The signature input is the JCS
  serialization with `sigs` omitted; `prevView` chains to the
  previous view; `genesisDigest` names the group (its identity,
  3.2). `seq` increases by exactly 1; `epoch` is non-decreasing.
  `identities` is the set of announced derived service identities
  of the **members** at the view's position (5.2) — pending exits
  included until their discharging transition, so within one
  epoch the set only grows, and read/write standing toward
  services ends exactly where the capability ends (5.4, 7.1). It
  is what the service authorizes `read`/`write` requests against,
  by proof of possession (a signature over a service-issued
  challenge). `m`, when non-null, replaces the quorum size from
  the next view on and MUST satisfy `1 ≤ m ≤ |identities|` of
  this view — a quorum of zero does not exist, and a view
  claiming one is invalid.
  `terminal: true` announces dissolution. `issuedAt`/`validUntil`
  are the quorum's signed freshness claim — the only wall-clock
  statement in this layer, evaluated by the service against its
  own clock within a declared skew bound.
- **Quorum.** Views are signed by `m` distinct identities that
  appear in **both** the previous accepted view's `identities` and
  the new view's `identities` (`m` starts as registered; the
  genesis `serviceIdentity` seeds seq 0, so the registered `m`
  MUST be 1 initially and grow via the `m` field as identities
  accrue). The intersection rule means a quorum can never remove
  itself and hand the chain to nobody in the same step; a view
  that would shrink `identities` below the chained quorum
  requirement is unacceptable — the group lowers `m` in a
  **preceding** view first (`m` timing, below) — and a service
  MUST reject a view violating
  `1 ≤ m_effective ≤ |identities|`. RECOMMENDED: raise
  `m` to ≥ 2 as soon as the group has two announced identities — a
  singleton quorum is a singleton point of misstatement. **Stated
  residual:** a group that legitimately removes its *entire* view
  quorum at once cannot continue any chain those identities
  anchored — the binding at every such service is lost, the group
  re-registers (trust-on-first-use again), and the service fails
  closed in between. Removing in steps, or lowering `m` first,
  avoids this; the spec prefers a stated self-DoS over a
  service-side escape hatch that something other than the chain
  could invoke.
- **Registration (bootstrap).** At first contact a group
  presents a **registration** — a versioned wire artifact
  (`schemas/access-registration.schema.json`):
  `{ "v": "rltp-access-registration/0.26",
  "type": "service-registration", "group", "genesisDigest",
  "identity", "service", "m": 1, "stalenessBound",
  "terminalRetention", "divergenceQuota",
  "attestationKey", "registrationGeneration",
  "previousRegistration", "authorizationRoot", "sig" }`. Four
  fields carry the generation machinery: `attestationKey` is
  the service's **target-attestation key** (the key under which
  this service signs convergence targets, Replication Contract §4
  — the group binds it here so no out-of-band assertion ever
  substitutes); `registrationGeneration` is an integer ≥ 1;
  `previousRegistration` is the superseded registration's
  **`registrationCoreDigest`** (its identity for every chain
  purpose — defined under the generation rule below), or null iff
  the generation is 1; `authorizationRoot` is the signature-input
  digest of the sole-tip view this registration was authorized
  against (null iff the generation is 1) — **bound inside the
  registrationCoreDigest and the quorum's signed input**, so the
  root a quorum authorized against can never be substituted (the
  signed object binds its checkpoint — the CT rule). `identity` is the seq-0 derived
  service identity: `sig` MUST verify under it over the JCS
  serialization with `sig` omitted, and the seq-0 view MUST be
  signed by exactly it — the chain's root signer is a named
  field, not an inference. `service` names the one service this
  registration is for, and its comparison rule is **exact byte
  equality of the UTF-8 string — no normalization of any kind**:
  no case folding, no percent-decoding, no default-port or
  trailing-slash equivalence, no alias or DID resolution. A
  service MUST be configured with exactly one canonical
  identifier string (RECOMMENDED: a service DID or an absolute
  `https` URI) and MUST reject a registration whose `service` is
  not byte-identical to it; a deployment reachable under several
  names chooses one canonical string and advertises exactly that
  one. Two strings that differ in any byte name two services —
  so two services never parse one registration into two
  behaviors, which is what §13's "a service the group chose"
  requires; a registration captured in transit cannot be
  replayed to bind the group at a different service. Durations
  use the profile subset below; the
  quota is an integer in **[16, 4096]**. A value outside its
  range, a missing field, or a failing
  signature makes the registration invalid.

  **Generations and
  the service rebind:** a service's registration
  state is a chain of generations. Generation 1 is the TOFU
  bootstrap and is self-signed as above. Every registration with
  `registrationGeneration` = g+1 MUST additionally carry
  `authorization`: signatures by the **effective quorum of the
  sole tip of the service's held view chain** (obligation 5(d)'s
  value; signers ∈ that view's `identities`) — while the view DAG
  holds more than one tip, a g+1 presentation waits, retriable,
  until a reconciliation view (obligation 5) restores the sole
  tip: no winner is ever picked for a rebind.

  **The impossibility
  exit (closed, exactly quantified):** reconciliation is
  unconstructible iff `|⋂ identities(tips)| <
  max effectiveM(tips)` (obligation 5(d) values over the held
  tips). That condition alone never ends anything irreversibly —
  later view extensions can restore the cut, and momentary local
  absence of views proves nothing. The binding ends only through
  a **quorum-authorized abandon**: a g+1 registration carrying
  the OPTIONAL **`abandon` block** (generation > 1 only)
  `{ "abandonedRoot": <the signature-input digest of the last
  pre-divergence sole-tip view (the same digest form the view
  skeleton holds)>, "abandonedTipsDigest": <the multihash over
  the UTF-8 bytes of the JCS array of the abandoned tips'
  signature-input digest strings, sorted by unsigned bytewise
  order> }` — the block
  is part of the registration core (and therefore of the
  `registrationCoreDigest` and the quorum's signed input), and
  its `authorization` is signed by the effective quorum of that
  named pre-divergence root. **Only a registration whose core
  contains the abandon block ends a divergence irreversibly; an
  ordinary g+1 rebind signed beforehand is byte-distinct and is
  never reinterpreted as an abandon.** Root and tip set MUST
  verify exactly against the service's held view DAG;
  **concurrent distinct abandons of one generation are a
  registration equivocation** (fail-closed, both retained — the
  named abandon counter-vector). The tombstone then
  freezes the named root and a further g+1 presentation verifies
  against exactly it. Where that quorum can
  no longer sign, the honest outcome is a **new service
  identifier** — waiting forever is not an outcome, and neither
  is a service-local irreversible verdict (the same residual
  class as whole-quorum removal). The quorum signs,
  domain-separated, the **complete unsigned registration** — the
  JCS serialization of the artifact with `sig` and
  `authorization` omitted, `authorizationRoot` **included** — so
  every security parameter (`stalenessBound`,
  `terminalRetention`, `divergenceQuota`, `m` included) and the
  authorization root itself are quorum-bound; the verifier's
  closure check runs against exactly the named root, and a
  registration whose closure proves a *different* root is
  invalid; the identity of a
  registration is its **`registrationCoreDigest`** = the multihash
  over `JCS(registration with sig AND authorization omitted)` —
  one digest for every purpose: generation identity, equivocation
  judgment, `previousRegistration` linkage, and the tombstone.
  Two artifacts of one generation whose core digests differ are a
  **registration equivocation**: fail-closed, both retained as
  evidence; proof bytes never create chain identity (signers are
  distinct and sorted by unsigned bytewise order, a semantic
  conformance check with vectors). The service verifies against its own
  held view chain before superseding — the named
  `authorizationRoot` MUST be its current sole tip — so a
  stranger who merely knows the prior digest can never re-root
  the chain.

  **Standing needs acceptance evidence — and acceptance is
  anchored in the present** (the CT freeze lesson: "newest" is not
  a locally verifiable property, and no checkpoint a presenter
  selects can prove its own maximality — witness rules, RO-8 of
  the Replication Contract, are the only road to more): toward any
  third party, a g+1 generation is a verification root only with
  evidence the service accepted it, and a generation's acceptance
  is provable exactly two ways — **(a) the live session** with the
  exact-byte service, which attests the current generation, and
  **(b) the successor chain into it**: every generation bound by
  the `previousRegistration` core chain into a session-attested
  generation is thereby proven accepted (the chain into the
  present is the independent anchor). For the newest generation
  there is no way but (a). Standing for any service-target root
  exists only through the verifier's **own** exact-byte service
  session, a generation attested inside it, and the full
  `previousRegistration` chain from the root's generation into
  that anchor — absent the anchor, **every** bundle is
  `invalid-bundle`. **No acceptance artifact exists** — no
  receipt, no statement: no artifact could prove its own
  acceptance (the CT/MLS rule), and none is needed where the
  chain into the present is the anchor.

  **The acceptance commit is a linearizable compare-and-swap**
  (the `update-ref` rule): registration acceptance, tombstone
  advance, and the new target chain's initial state are **one
  durable service commit**, and the expected prior generation,
  `previousCore`, tombstone status, and sole tip MUST still hold
  inside the commit, or nothing advances — two concurrently
  pre-validated candidates yield one acceptance, never two
  (parallel-acceptance vector, §14).

  **The no-target window, named:** between the acceptance of g+1
  and its first issued target, no artifact outside the service
  proves the acceptance; a service SHOULD issue the first target
  of a new generation promptly upon acceptance — from then on
  the g+1 targets themselves (signed under the new key,
  `registrationCore`-bound) are the transportable acceptance
  evidence. A substituted never-accepted generation has no
  successor binding and no session attestation, however valid
  its closure looks (the view chain itself continues unbroken —
  **only generation 1 has a seq-0 view; a g+1
  registration restarts only the target chain**). A registration with
  `registrationGeneration` = g+1 and `previousRegistration` =
  the digest of the accepted generation-g registration, so
  authorized, **supersedes** it — this is the group-authorized act that
  re-binds a service whose attestation-key continuity ended
  (state loss, key compromise, key loss; Replication Contract
  §4.1): it carries the fresh `attestationKey`, and the target
  chain it roots is a new chain whose standing begins here. A
  registration whose generation is not exactly one above the
  accepted one, or whose `previousRegistration` digest does not
  match, is rejected; generations never decrease.

  **The generation tombstone
  (durable, tiny):** per `(genesisDigest, service)` the service
  retains — through every discard, the terminal grace discard
  included — the highest accepted generation, its digest, and its
  status (`active | superseded | terminal`), **plus the last
  authorization root**: the digest skeleton of the last sole-tip
  view (its `identities`, effective `m`, and signature-input
  digest) — the material a post-discard g+1 verification needs.
  After a terminal discard, generation 1 is never TOFU-eligible
  again for that pair — a return happens only as g+1 under quorum
  authorization against the retained root; a tombstone without a
  root closes the pair permanently (a fresh start requires a new
  service identifier).
  **A replayed old registration therefore cannot re-open a
  superseded generation or its keys** — and after a rebind, targets under
  the superseded attestation key retain evidence value
  (equivocation proofs included) but no serving standing.
  (Replay at the *same* service after a terminal discard rebinds
  only the group's own true chain, which the replayer cannot
  extend — the TOFU residual already stated.)

  **Profile durations:**
  `stalenessBound` is **whole days only, `P1D` through `P30D`** —
  the joint profile cap with the Replication Contract, one
  validity boundary on both sides of the port, enforced by the
  schema exactly as stated. `terminalRetention` uses exactly the
  day/time subset of ISO-8601 — `P<d>D`, optionally with
  `T<h>H<m>M<s>S` components in descending order, at least one
  component, each value 1–3 digits, no years, months, or weeks —
  and arithmetic is fixed-length (`1D` = 86 400 s): every
  conformant service computes the same seconds from the same
  string. It is followed by
  the seq-0 view — which is accepted
  iff its `seq` is 0, its `prevView` is null (the only view where
  it may be), and it is signed by the registration's identity;
  from seq 1 on the ordinary quorum rule applies with `m` as
  chained. The service binds genesisDigest → chain
  (trust-on-first-use at the service boundary, Section 12) and
  persists `stalenessBound`, `terminalRetention` (the terminal
  grace window of obligation 5; RECOMMENDED default `P30D`), and
  `divergenceQuota` (the full-artifact evidence bound of
  obligation 5; RECOMMENDED default 64).

  **`m` timing, exactly:** the quorum
  size that an ordinary view *n* must satisfy is **the effective
  quorum size of its parent** (obligation 5(d) defines that value
  recursively for every view, reconciliations included); a view
  that shrinks
  `identities` below that requirement cannot repair itself — the
  group lowers `m` in a preceding view first. The
  registration is also what confers the **`relay`** role on the
  service itself (Section 6) — the service stores and forwards
  this group's ciphertext; the role ends with deregistration or a
  terminal view.
- **Service obligations** (all five MUST):
  1. **Authenticated:** accept only `seq + 1` with matching
     `prevView`, matching `genesisDigest`, non-decreasing
     `epoch`, valid quorum signatures per the intersection rule,
     `issuedAt ≤ validUntil ≤ issuedAt + stalenessBound`, **and**
     `issuedAt` no further than the declared skew bound past the
     service's own clock — both window ends are checked, so
     neither a year-9999 `validUntil` nor a future-dated
     `issuedAt` extends a view's life. Unauthenticated assertions
     of authorization are never accepted.
  2. **Epoch-monotone — and that is the rollback protection:**
     epochs never decrease across the chain. Within one epoch the
     authorized set only grows (7.1), so replaying an older view
     of the same epoch can only *shrink* what the service accepts
     — denial, never authority; and a view of a superseded epoch
     is rejected by monotonicity. (Log heads are not part of the
     view: a service cannot read the log, so nothing is claimed
     that a service cannot check.)
  3. **Freshness-bounded:** when the newest accepted view's
     `validUntil` lies beyond the skew bound in the past, fail
     closed for epoch-sensitive decisions until a fresh view
     arrives.
  4. **Fail-closed:** on a `seq` gap, a `prevView` mismatch, an
     unknown group, or any inconsistency: rejection, never a
     lookup or a guess.
  5. **Never a winner-picker:** on two individually valid views
     with the same `(genesisDigest, seq)`, or any divergence from
     one `prevView` — including sibling epochs, and including a
     disputed `terminal` — enter a persistent fail-closed state
     for the group, durably retaining the artifacts as evidence.
     While fail-closed the service holds **the DAG of every view
     it has accepted or retained** (each view names its parents:
     `prevView`, singular or array), and it MUST go on admitting
     valid views into that DAG — an ordinary view whose parent is
     held, a divergent view opening a new branch, a
     reconciliation view joining branches — **bounded below by
     the anchor, as a ratchet:** a presented view whose ancestry
     does not pass through the service's anchor is rejected
     outright, never admitted as divergence evidence. **The
     anchor is the last single-tip view the chain has built
     beyond** — not the live head: it advances by exactly one
     deterministic rule, *on accepting a view whose parent is
     the current sole tip T, the anchor becomes T* (at
     registration it is the seq-0 view). A view the service has
     accepted but not yet built beyond is therefore always
     still contestable: a sibling of the live head — of a false
     terminal view included — forks at or above the anchor and
     enters as ordinary divergence evidence, so obligation 5's
     fail-closed duty and the terminal grace window keep their
     force (ratcheting on the live head
     itself would silently discard exactly that evidence).
     What the chain has converged on **and built beyond** is
     decided for this service — the chain analogue of epoch
     monotonicity — and the ratchet keeps a fabricated branch
     forking **below** the anchor out of the machine entirely.
     (A fork **at** the anchor is legal — that is exactly the
     contestability above — and what prevents an expelled
     quorum from winning such a contest is not the ratchet but
     the reconciliation quorum's continuity cut, rule (d)
     below: whoever a contested branch expels cannot sign the
     join.) The residual
     is stated: services that accepted different sides of a
     pre-convergence equivocation before converging have
     ratcheted apart, and the disadvantaged binding ends in
     re-registration (trust-on-first-use again) — the same
     residual class as whole-quorum removal and an undisputed
     false terminal. An honest quorum never equivocates; the
     ratchet prices only equivocation. All admission runs
     under one **evidence
     contract: the service persists bounded accepted evidence —
     the bound enforced, not derived; everything beyond it is
     presenter-supplied, verified by digest linkage to what is
     held, and bounded per presentation.** Its parts:
     (i) *Persisted state, hard-bounded.* Never discarded: the
     **anchor** (as defined above — the last single-tip view
     the chain has built beyond) and the current tips. Full view artifacts are bounded by the registered
     `divergenceQuota`; a full artifact MAY be dropped once its
     view is no longer a tip. Linkage survives as the **digest
     skeleton** — per accepted view its signature-input digest,
     its parent digests, and its `seq` — and a skeleton entry's
     meaning is defined: it is the service's durable record
     that it once fully verified and accepted exactly that
     view. The skeleton is hard-bounded at **8 ×
     `divergenceQuota` entries**. Linear runs (one parent, one
     child) MAY be compressed to their endpoints at any time;
     at the bound the service MUST **compact**: discard
     interior skeleton entries — never the anchor, never a
     tip — compressed runs first, then whole reconciled
     fork-join regions. Compaction forfeits only the
     readmission shortcut of (ii), never safety: a compacted
     view, when needed again, is re-presented and re-verified
     in full like a never-seen view under (iii). The storage
     bound therefore holds in **every** DAG shape by
     construction — quota-many full artifacts plus 8 × quota
     skeleton entries; a flood of cheap linear spam collapses
     to run endpoints, and a ladder of repeated
     fork-and-reconcile against a held-open tip fills the
     skeleton budget and is compacted, instead of growing an
     uncompressible branching record without limit.
     (ii) *Digest readmission.* A presented full artifact whose
     signature-input digest matches a held skeleton entry is
     evidence again without re-verification (that happened at
     first acceptance); its fields — `identities`, `m`,
     `epoch` — are thereby available to check a newly presented
     child or sibling against the quorum intersection rule, so
     late arrivals need no historical state the service did not
     keep. A view segment presented to span a compressed run
     verifies by digest chaining against the run's endpoints.
     Where compaction has removed the entry, readmission is
     unavailable and the view re-enters through (iii), at full
     verification cost.
     (iii) *Recursive dependency closure, bounded per
     presentation.* Any presentation — ordinary, divergent, or
     reconciliation — MUST be acceptable when accompanied by
     the ancestor views the service needs, down to digest
     linkage with something it holds (skeleton or full); every
     chain roots in the seq-0 view or the anchor, which are
     always retained, so a never-seen branch verifies
     recursively from held evidence. **A presentation carries
     at most `closureBound` = 256 views — a profile constant —
     and a larger bundle is rejected retriable.** A longer
     never-seen chain enters **incrementally**: each
     presentation roots in evidence held or admitted through an
     earlier presentation, and each newly verified view is
     admitted into the DAG as skeleton (consuming budget —
     compaction pressure per (i) included). A presentation
     missing its closure within the bound is rejected
     retriable; a bundle is judged as a whole. Per-presentation
     verification work is thereby bounded by `closureBound`
     times the schema-capped view size — a protocol bound, not
     a presenter's promise. What is deliberately **not** a
     protocol bound is the number of presentations: that is the
     presenter's own spent effort per exchange, and services
     SHOULD rate-limit presentations per **`genesisDigest`** and
     presenter — never per group DID, under which a sibling
     genesis is a different group whose presenters MUST NOT share
     the budget (3.2) —
     the cost class is the one this obligation already concedes
     to any misbehaving quorum, now priced per exchange instead
     of unpriced.
     (iv) *Saturation — one acceptance rule, judged on the
     atomic bundle, with mandatory eviction.* First the
     eviction rule that makes retention deterministic instead
     of optional: **at the quota, a service MUST drop non-tip
     full artifacts (their skeleton entries remain) to admit
     otherwise-acceptable evidence — smallest `seq` first, ties
     broken by the unsigned bytewise order of the
     signature-input digest** (fully deterministic in the held
     DAG) —
     so quota headroom is a deterministic function of the held
     DAG, never of a local retention choice (a MAY here would let
     two honest services diverge on the same evidence). Then the rule: a presentation — a single
     view or a bundle of views with a reconciliation, judged
     **as an atomic whole** — is accepted iff every named
     parent is held or supplied within the bundle, and either
     the service (after mandatory eviction) has quota headroom
     for the bundle's full artifacts, or **applying the whole
     bundle strictly reduces the derived tip count** (a locally
     checkable condition: derive the tips before and after).
     Otherwise it waits, retriable. At the quota with no
     headroom the service is **evidence-saturated** and rejects
     further tip-increasing presentations (retriable). The
     tip-reduction clause is the exemption's whole
     justification: reconciliation is exempt from saturation
     because it shrinks the divergence, so a "reconciliation"
     that does not shrink it — spam of ever-new
     joins over long-since-joined historical parents — has no
     claim to the exemption. And the exit is guaranteed in
     every shape, the disjoint one included: a join of a
     service's own current tips is always tip-reducing and
     always admitted; the joined tips become non-tips and are
     evicted under quota pressure, which frees headroom; a
     branch this service has never seen then enters below the
     quota (incrementally per (iii)); the global join lands as
     tip-reducing. Two services saturated on disjoint evidence
     therefore converge through exactly this sequence — local
     joins, eviction, cross-admission, global join — and the
     permanent-divergence construction is closed by the
     eviction MUST. Because parents and closure travel in the
     bundle (within (iii)'s bound, incrementally where longer),
     the exit is independent of what the flood's arrival order
     left standing; the transient overshoot of an atomic
     acceptance is bounded by the **bundle size — `closureBound`
     (256), not the parent cap** (a tip-reducing
     bundle may stage a full never-seen closure), a service
     provisions staging for exactly that bound per presentation,
     and the overshoot is reclaimed on acceptance.
     The quota bounds what an insider quorum's view spam can
     cost a service (a single legitimate `m = 1` signer could
     otherwise mint unbounded valid siblings and conformance
     would mean unbounded storage); what such spam still buys is
     the fail-closed state this obligation already grants any
     misbehaving quorum, now at bounded cost — and `m ≥ 2`
     (RECOMMENDED above) makes it a conspiracy. **The divergence tips are not a stateful
     register but a derived quantity: the maximal elements of the
     held DAG** — every held view that is not an ancestor of
     another held view. Deriving the tips from the DAG is what
     makes the machine convergent: DAG union is commutative, so
     two services holding the same views hold the same tips,
     whatever order the views arrived in — crossing
     reconciliations included (two reconciliations sharing a
     named parent leave both standing as tips; the shared parent
     is an ancestor of each and simply stops being maximal). The
     state is cleared only by **reconciliation
     views**. A reconciliation view (a) names two or more
     divergent views in `prevView` (array form); (b) names, in a
     `predecessor` field, the digest of one accepted view that
     is an ancestor of every named parent and whose `seq` is at
     least the `seq` of the service's anchor — **an ancestor
     floor, deliberately not a maximality requirement**:
     "maximal among the common ancestors" is a non-existence
     claim that no bounded evidence can check, and demanding it
     is what would force unbounded skeleton retention. In its
     place stand the floor and the overt choice: which
     qualifying ancestor serves is the issuing quorum's choice,
     made in the open and covered by its signatures, never
     derived by a verifier (a covert tie-break over malleable
     fields would be grindable). **Under the admission ratchet
     the floor is always satisfiable:** every admitted view
     descends from the anchor, so the anchor itself is a common
     ancestor of any held tip set and qualifies — no divergence
     this machine can hold lacks a qualifying predecessor, and
     no fixed bound ever makes one permanent. **The predecessor
     is an ancestry witness and nothing more** — neither the
     quorum size nor the signer set of a
     reconciliation is drawn from it (both come from the named
     parents, rule (d) below). Ancestry of the predecessor is
     checked against held skeleton plus presenter-supplied
     digest-chained segments, per the evidence contract;
     (c) carries `seq` = 1 + the maximum
     `seq` over the **named** parents and `epoch` ≥ the maximum
     epoch over the **named** parents — named, not locally
     current: every requirement is a function of what the view
     itself names, so its acceptability does not depend on which
     tips a particular service happens to hold; (d) is signed by
     **`m` distinct identities, where `m` is the maximum of the
     effective quorum sizes over the named parents.** The
     **effective quorum size** of a view is defined recursively,
     over the whole DAG rather than along a single chain (a
     reconciliation carrying `m: null` has several incomparable
     parent chains, so "the latest non-null `m` on its chain"
     would name nothing): it is the view's own `m` where
     that is non-null; otherwise, for a reconciliation view, the
     **maximum** of the effective sizes of its named parents;
     otherwise the effective size of its single parent. The
     recursion terminates — the seq-0 view's size is the
     registration's `m`, which is always non-null — and every
     view has exactly one value, computable from the artifacts
     the presenter supplies. The maximum is fail-closed-directed
     throughout: the strictest of the contested regimes governs.
     Each signer
     present in **the `identities` of
     every named parent** and in the reconciliation view's own
     `identities` — the uncontested continuity cut, and the rule
     that makes a takeover impossible: drawing the quorum from
     the historical `predecessor` alone would let an expelled
     quorum fork at the anchor and join its own
     fork over the very view that removed it; under the
     intersection rule a signer excluded by **any** named parent
     can never sign the join, so whoever a contested branch
     expels cannot ratify the contest. Parents' identity lists
     are read from their full artifacts (tips carry them;
     ancestor parents re-enter via digest readmission or full
     re-presentation, per the evidence contract). Where the
     intersection holds fewer than `m` identities, no
     reconciliation is constructible and the binding ends in
     re-registration — and the scope of that outcome is exact: within one epoch the identity set of one
     log is grow-only, and replacements bind at transitions, so
     two divergent views can list diverging identity sets only
     if the quorum equivocated (→ the binding was forfeit by
     design) or the log itself holds sibling epochs (→ the
     group is already fail-closed at the log level, OI-1's
     boundary — the service state mirrors it). No honest
     single-lane operation (9.6) ever starves the cut: denial,
     attributable, never a takeover
     (the residual class this section prefers throughout);
     and (e) is accepted
     iff the service holds every named parent **somewhere in its
     DAG** — as a tip or as an ancestor, no distinction — on a
     named parent it does not hold, rejection as always
     (fail-closed, obligation 4), retriable after that view has
     been presented to it; on acceptance the view joins the DAG
     and the tips re-derive. The fail-closed state ends exactly
     when the derived tip set has one element — no fixed
     array bound ever makes a divergence permanent (the one
     stated exception is the empty continuity cut of (d), which
     ends in re-registration by design). For this
     derivation the service retains ancestry **as digest
     skeleton within the evidence contract's hard bounds** —
     the anchor is never pruned, the `predecessor` check needs
     no view older than the last convergence, ancestry
     questions over compressed or compacted spans are answered
     by presenter-supplied segments and, where necessary, full
     re-verification per the contract; full
     artifacts follow the quota rule. Two
     honest
     statements about scope: acceptance is deterministic **in the
     service's evidence** — services holding different view sets
     converge when the views themselves reach them, an eventual
     guarantee, not an instant global one; and responsibility for
     the reconciliation's content lies in the group's log,
     attributably — never at a service.
     A `terminal: true` view is
     itself final only as the chain is: a falsely terminal view is
     a divergence like any other (the group's next honest view
     contradicts it), handled by exactly this rule — a malicious
     quorum member can force the fail-closed state, not a
     permanent grave. **A terminal view carries its predecessor's
     `identities` unchanged, as the attesting set** — capabilities
     ended with the group, so the listing authorizes nothing; it
     exists so the quorum and intersection checks remain
     evaluable. **Terminal grace:** on accepting a terminal view
     the service does NOT discard the group binding at once: for
     the registered `terminalRetention` window — **measured from
     the service's own acceptance of the terminal view**, the
     one point every service can determine locally — it keeps the
     binding in a state equivalent to fail-closed (every
     authorization denied, the `relay` role ended) but
     chain-continuable — a valid view contradicting the terminal
     one within the window is a divergence like any other and
     enters exactly this rule's machinery. Only after the window
     passes undisputed is the binding discarded. Denial is the
     terminal state's whole effect anyway, so the grace window
     costs nothing in authority; what it buys is that a malicious
     quorum's false terminal view is recoverable evidence, not an
     irreversible deregistration. The residual stands stated: a
     false terminal view left undisputed past the window ends the
     binding, and the group re-registers (trust-on-first-use
     again) — symmetric with the whole-quorum-removal residual
     above.

- **What this buys, honestly.** The view check is freshness,
  rollback protection, and identity listing by pseudonymous
  quorum — **not** policy enforcement, which lives in the log. A
  colluding quorum can, within the staleness bound the group
  itself declared: keep a removed identity listed, omit a member
  (denial), or list an identity the log never announced. The last
  is bounded by end-to-end encryption — a listed stranger obtains
  ciphertext access and write standing at the service, never keys
  or plaintext — and all three are **attributable inside the
  group**: views are signed and chained, and any member can
  compare them against the log. `m ≥ 2` (RECOMMENDED above) makes
  every misstatement a conspiracy rather than an accident. An
  adapter MAY replace the wire format with an equivalent mechanism
  iff it preserves all five obligations and this exposure bound;
  the replacement is part of the adapter registration (9.1).

## 8. Visibility Modes

- Default `private`: reading requires membership (epoch key
  material). The authority log is member-only in every mode (3.1).
- `open`: **document content** from epoch `E` onward is
  world-readable; write remains membership-bound; moderation is
  policy. Mechanically: the content keys from `E` onward are
  published through the group's open content channel — the
  adapter MUST expose attached documents' ciphertext plus the
  published keys to non-members in `open` mode; the authority
  log, the admission evidence, and the membership stay sealed.
- `visibility.change` (atomic transition) constraints: the stated
  `E` MUST equal the transition's `newEpoch` — a visibility change
  can only ever open from its own new epoch onward. Closing takes
  effect from `newEpoch`; what was world-readable remains so
  factually, and implementations MUST NOT suggest otherwise.
- **`history.expose {fromEpoch, toEpoch?, keys}`** is the sole
  way to expose anything earlier (default rule `strongest`). It
  is valid only where the materialized visibility at its
  declared position is `open`, with `fromEpoch` earlier than the
  opening epoch `E`; `toEpoch`, when present, MUST satisfy
  `fromEpoch < toEpoch ≤ E` and defaults to `E`; `keys` MUST
  contain exactly the content keys of the epochs
  `[fromEpoch, toEpoch)`, verified at materialization against
  the epochs' commitments (7.1's commitment rule makes this a
  byte check). One operation covers at most 4096 epochs — the
  schema's wire cap; a longer history is exposed by several
  operations with adjacent ranges (round 15 M4: without the
  segmented form, a group past 4096 epochs could not construct
  the artifact its own rule demands). Within the replica, merging the operation is the
  disclosure. Toward the world, merging it creates an immediate,
  non-discretionary **publication duty**: members MUST publish
  the disclosed keys through the same open content channel as
  current keys; the log entry is the group's attributable record
  that it did so. No other mechanism may publish historical keys.
- Concurrency: as enforcement operations, visibility changes fall
  under 3.6's sibling-epoch rule; a removal and an opening on
  concurrent branches cannot silently combine.

## 9. The Enforcement Port

This layer's constitution (Sections 3–8) is enforced by a
substrate: the machinery that replicates the log, converges
branches, agrees group keys, rotates them, and opens history. The
substrate is bound through a **port** of four requirements. An
**adapter** is a registered binding of one substrate to this port;
a registration names the substrate, its concurrency scope, its
lineage form (9.4), its `material` key schema and commitment
encoding (9.5, 7.1), and its authorization-view mechanism where it
replaces 7.3's wire format.

### 9.1 What the port presupposes — and what the adapter is

A substrate is admissible only if it provides: individually signed
operations in a causal DAG; deterministic materialization with a
deterministic concurrency tie-break; idempotent application by
operation id; and transport of this layer's envelope (3.3) with
its **signature input unmodified** — the envelope stays the sole
authority carrier, and a substrate that re-signs, re-wraps, or
re-orders the signed content is not admissible. The `proof` field
is the deliberate exception: it is a mutable evidence
accumulator, and replicas MUST maintain it per 3.3's canonical
merge — merging proofs is a conformance duty, not a modification
of authority content (nothing signed, no digest, and no identity
ever covers proof bytes).

**The adapter is trusted computing base, named as such.** An
adapter handles key material; no port requirement can make a
malicious key-handler safe. Therefore, normatively: an adapter
MUST NOT disclose key material, welcome material, lineage
plaintext, or document plaintext to any party other than those
this layer names as entitled (retained members per the computed
retained set, admission subjects, the world for `open`-mode
content and exposed history) — and the §13 privacy floor is part
of the adapter conformance class (Section 14). These obligations
are audit criteria against an adapter's implementation, not
properties a vector suite can fully establish; the port's
contribution is that the trust boundary is explicit, small, and
auditable instead of diffused through an application.

### 9.2 P1 — Policy injection

The substrate's materialization MUST evaluate this layer's
validity and canonicality rules (3.4, 3.6 including its outcome
rules, 5.3): an operation this layer rejects MUST
NOT take effect in any replica's materialization, and a replica
ingesting raw substrate state MUST reach the same verdicts as one
fed through any API. A substrate whose materialization cannot be
extended with profile rules — or that enforces them only in a
local wrapper other replicas can bypass — does not satisfy P1.

### 9.3 P2 — Atomic enforcement

An enforcement operation and its epoch transition are **one
committable artifact**: no observable state in which the authority
claim has taken effect but the key world has not transitioned, or
the reverse. Lazy rekeying that leaves a removed member's key
world intact until some later write does not satisfy P2; neither
does replication that keeps serving a removed member's peers
after the removal commit — **replica eviction is part of the
enforcement artifact**, and forwarding is gated on the
forwarder's own prior canonical application
(commit-before-forward, 5.3 — whose scope note applies: the
non-effecting evidence transport of 3.6 is not forwarding in this
sense and is never gated on canonical application). (P2
atomizes the *committed* key world; that a malicious author can
commit envelopes only he can't be decrypted is a delivery failure
with a normative repair — the key service duty, 5.3 — not an
atomicity gap: the claim and the committed transition still stand
or fall together.)

### 9.4 P3 — History opening

Invariant: **current-epoch key + replica ⇒ readable history
exactly as far as the log's unbroken lineage reaches** (7.1).
Admissible forms include the native epoch-key lineage (the
embedded per-transition AEAD entry of 7.1) and causal encryption
(each content block carrying predecessor pointers and keys),
provided the narrowing gate of 7.1 (`historyNarrow`, separately
gated by the aspect rule) is representable. A non-native form is
declared per transition by `lineageForm: "<adapter id>"` in place
of the native `lineage` entry — an adapter never fakes a native
field, and the transcription schema admits exactly one of the
four states (`lineage` / `historyNarrow` / `lineageForm` /
`lineageVoid`, the last on discharges only — 7.1). Whatever the
form:
history material MUST live in the replica, never in the welcome —
the welcome carries the current epoch only and is bounded by
Membership's plaintext budget. A substrate whose only history
channel is welcome-time bulk key transfer does not satisfy P3.

### 9.5 P4 — Key-world production

The adapter MUST produce, at genesis, at each transition, and for
each admission or authenticated key request at a given
materialized position, the key material this layer commits to: the
epoch content key behind `contentKeyCommitment` (7.1's commitment
rule), the sealed `keyDist` envelopes (7.1), and the welcome
`material`:

```json
{ "v": "rltp-access-material/0.24", "adapter": "linear/0.1",
  "epoch": 7, "keys": { …per the adapter registration… } }
```

The same `keys` object, under `rltp-access-keydist/0.24`, is the
keydist plaintext of 7.1; both shapes ship as
`schemas/access-material.schema.json`.

The binding fields (`v`, `adapter`, `epoch`) are owned by this
layer; `keys` is owned and **closed** by the adapter registration.
Welcome material MUST be re-derivable at any later materialized
position of the same epoch (the key service duty depends on it,
5.3), MUST carry the current epoch only, and MUST fit the welcome
plaintext budget (Membership §4). This object is the `material`
Membership §4 carries. **The MO-4 pin:** this
schema plus the per-adapter `keys` registration is the `material`
pin, adopted by Membership 0.9 (its §4 validates the welcome
`material` against this schema); no implicit-capability blind
exists — the implicit capability follows from membership itself.

### 9.6 Adapter #1: `linear/0.1` (normative)

The reference adapter binds the port to a totally ordered log:
enforcement operations form a single lane (no sibling epochs by
construction — the honest embodiment of 3.6's scope), additive
operations may interleave. It evaluates this layer's rules
natively (P1), commits an enforcement operation and its transition
as one artifact in the total order (P2), records the 7.1 lineage
entries (P3), and produces key material (P4) with the closed
schema:

```json
"keys": {
  "contentKey": "…base64url, 32 bytes…"
}
```

`contentKey` is the epoch's AES-256 content key — its commitment
is the multihash over its raw 32 bytes (7.1); it MUST be freshly
generated per epoch (7.1's freshness rule; fresh CSPRNG
generation is a P4 audit criterion). Exactly this one property,
no others. **Everything else is a domain-separated derivation,
never a transported secret:** the adapter's per-epoch working key
is `HKDF-SHA256(salt = empty, IKM = the raw content-key bytes,
info = the UTF-8 bytes of "rltp/v1/epoch-secret/" followed by the
genesis digest string in canonical `u` form (3.2), L = 32)`. It is a *subkey* of the content
key, honestly so: it adds domain separation, not independent
secrecy — in `open` mode, epochs whose content key is published
have no adapter-internal secrets either, which is consistent
(their content is world-readable anyway). The one commitment
check of 10.1 thereby authenticates the entire consensus-relevant
key material; a helper cannot deliver a correct content key with
a poisoned side secret, because there is no side secret to
deliver. The adapter uses 7.3's view wire
format unchanged. It is intentionally modest: no
partition tolerance for enforcement, which 3.6 requires of every
conformant implementation until OI-1 resolves — the adapter's
scope and the layer's are the same.

### 9.7 Candidate adapters (informative)

Two existing substrates were mapped against this port in design
(2026-08): **p2panda-auth/encryption** satisfies P1 through its
replaceable resolver and P2 through its space-membership commit;
its welcome-time full-secret-bundle history model must relocate to
the replica for P3, and its browser story is open. **Keyhive** is
the P3 exemplar — causal encryption is the cleanest existing form
of the history invariant — but today lacks a policy-injection
point (P1) and performs removal rekeying lazily (P2). Neither is a
conformant adapter today; both port gaps are concrete, scoped
contribution targets, and the port is shaped so that either could
become an adapter without changing this layer.

## 10. Service Ports and the Key-Delivery Task Type

This layer requires, and does not define:

- **Delivery port:** authenticated end-to-end-encrypted delivery
  to derived identities with durable buffering and explicit
  disposition — satisfied by the Delivery Contract (0.22), whose
  task types for this layer are the Membership Tasks (0.16,
  jointly cast) plus the
  type registered below.
- **Replication port:** convergent replication of the encrypted
  authority log and documents; deterministic merge; offline
  operation; no reachable central service required — satisfied
  through the enforcement adapter (Section 9).
- **Publication port** (open visibility only): world-readable
  publication of attached documents' ciphertext and the published
  content keys (Section 8), addressed by the group's genesis
  digest, idempotent per artifact, requiring no reader identity.
  The mechanism is named in the adapter registration; a group
  using `private` visibility never needs this port. Members
  discharge the publication duties of Section 8 through it.

Services themselves are bound by 7.3. No vocabulary of any
concrete service appears in this layer's model beyond the view
object of 7.3; any service satisfying a port contract is
substitutable.

### 10.1 `key-delivery/0.1`

The task type by which epoch key material reaches a specific
party — and by which it is claimed: transition key envelopes to
retained members, welcomes and re-welcomes to admitted subjects,
refresh material to current members under the key service duty,
and the authenticated request itself. Registered here; document
profile, sealed envelope, dispositions, and acknowledgement rules
per the Delivery Contract §§3–6.

- `payload`: `keyDelivery` object with:
  - `group` — the group DID; `genesisDigest` — the group's
    identity (3.2);
  - `epoch` — the epoch the material belongs to (for `request`:
    the requester's best knowledge, informative);
  - `op` — the `oid:` of the operation this document serves (the
    transition for `keydist`; the canonical admission for
    `re-welcome`; any canonical admission of the recipient for
    `refresh`; the
    operation the claim rests on for `request`);
  - `kind` — `"keydist"`, `"re-welcome"`, `"refresh"`, or
    `"request"`;
  - `sealed` — REQUIRED for the three material kinds, absent for
    `request`; shape per `sealed-envelope.schema.json`: for
    `keydist` the key envelope whose digest the named
    transition's `keyDist` carries for this recipient (7.1's seal
    profile); for `re-welcome` a welcome seal per Membership §4,
    built from fresh P4 material at the sender's current
    position, sealed to the accept's card or to the card of the
    request it answers (5.3); for `refresh` a seal per 7.1's
    keydist profile — same HKDF info, AAD with the requester as
    recipient and the sender's current epoch as `newEpoch` —
    whose plaintext is a fresh keydist object from P4 at the
    sender's current position, sealed to the request's card (the
    committed-digest rule of `keydist` does not apply: the
    authenticity carrier is the commitment check at adoption);
  - `card` — REQUIRED for `request`, absent otherwise: the
    requester's contact card in the displayed form, its proof
    verifying under the requester's anchor (live key, no
    freshness claim — 5.3).
- `proof`: for the material kinds **absent** — authenticity is
  content-bound: for `keydist`, the named transition commits this
  envelope's digest, AAD-bound to group, epoch, and recipient;
  for `re-welcome` and `refresh`, the **material is adopted only
  if it verifies against the log** (below). For `request` the
  proof is **REQUIRED**, verifying under the document `issuer`,
  which MUST equal the claiming anchor and the enclosed card's
  anchor — the signature gate of the key service duty (5.3).
- **Consistency (MUST, before any effect):** payload schema
  valid; `genesisDigest` matches the recipient's state for that
  group (or, for a bootstrapping invitee, their own invite's
  digest); for `keydist`: the recipient's anchor appears in the
  named operation's `keyDist` with exactly this sealed envelope's
  digest, and `epoch` = that transition's `newEpoch`; for
  `re-welcome` and `refresh`: the named operation is a canonical
  admission whose subject is the document `recipient` — or, for
  the founder, **the genesis**, whose body's founder is the
  recipient (any canonical admission of that anchor serves — none
  is distinguished, 5.3) — **and, where the recipient already
  holds a materialized state, the recipient is a current member
  of it** (a former member adopts nothing on this path; only the
  expressly provisional bootstrap below stands apart),
  and — checked by the recipient at adoption — `epoch` = the
  unsealed material's `epoch` = the current epoch of the
  recipient's materialized (or freshly bootstrapped) state, whose
  `contentKeyCommitment` the unsealed content key MUST match; for
  `request`: proof and card as above. A violation is
  `failed(validation-failed)`, no acknowledgement.
- **Effect of `request`:** the receiver evaluates entitlement at
  its current materialized state (5.3) and, where it holds the
  current keys and the requester is entitled, MUST answer with
  the matching material kind (`re-welcome` or `refresh`, 5.3).
  The response duty is **the slot of 5.3**: one slot per
  (`genesisDigest`, requester anchor); a request fills an empty
  slot and starts
  its deadline; a later request replaces the slot's content
  (request and card) and never the deadline; the receiver MUST
  discharge the slot at latest within
  **`key-request-interval` (default PT1H)** of the deadline's
  start — per genesis digest, so one group's throttle never
  starves another's, sibling geneses under one DID included
  (3.2) — and discharge empties the slot. No dedupe key
  exists: not the operation (admission
  clones must not multiply the duty), not the card (a lost card
  is exactly the legitimate repeat this shape serves — the
  answer seals to the card the slot holds at discharge), not
  the epoch
  (material is produced fresh at the receiver's current position
  anyway; a request after a rotation is simply the newest
  request). A byte-identical re-send is `duplicate-known` at the
  Contract's stage 4, so a repeat always travels as a new
  document. An unentitled
  request is `failed(validation-failed)`. **A request never
  pends:** a receiver that cannot resolve the named group or
  operation against its own state disposes it
  `failed(validation-failed)` immediately — the requester retries
  later; the pending mechanics below exist for material a lagging
  recipient will grow into, never for demands on the receiver.
- **Defined effect (material kinds):** durable buffering;
  unsealing, the commitment check above, and application are the
  recipient's local acts against their replica. Idempotent by
  document digest; material for the same `(op, recipient)` is
  applied at most once per successfully verified content.
- **Dependency (material kinds only):** `group-state` — a
  recipient that cannot yet resolve the named operation disposes
  `incomplete(missing: group-state)` under the same pending
  mechanics as Membership §3.3 (keyed by document digest,
  retention `bootstrap-retention`, redelivery idempotent) — except
  the re-welcome answering a bootstrap, which is self-contained
  against the invitee's own accept exactly like the welcome it
  replaces (Membership §3.3 case 1).
- **Bootstrap semantics of the re-welcome (the case-1
  inheritance, exactly):** a bootstrapping invitee cannot check
  canonicality or commitments before holding the log — neither
  could they for the original welcome, and the re-welcome
  inherits the welcome's own trust sequence rather than
  pretending a stronger one. Before adoption the invitee checks
  what case 1 checks: the seal opens under the key-agreement key
  of **their own accept's card**, the payload's `group` and
  `genesisDigest` equal **the pin of their own invite** (3.2),
  and the unsealed material is well-formed for the named
  adapter. Adoption is thereby **provisional**, and the
  provisional lifecycle is closed on all four sides (rounds 16
  M1, 17 B4/M5/M6, 18 B2, 19 B1). *Serialization and the
  window*: at
  most **one active
  provisional candidate per (`genesisDigest`, invitee)** — the
  invitee's own invite pin, which they have held since the
  invite and which no sender can move (3.2, Membership 3.1), so
  a sibling genesis under the same DID neither displaces this
  candidate nor consumes its window — and **the
  window belongs to that pair, not to the candidate** — the
  first provisionally valid bootstrap document (welcome or
  re-welcome) opens one `provisional-window`, and a candidate
  change never extends it (round 18 B2: a per-candidate window
  let an attacker multiply the delay by the number of
  fabricated candidates). Further provisionally valid
  candidates arriving while the window is open are **not
  adopted**, and at most **one** is buffered: a newly arriving
  candidate replaces the buffered one iff its document digest
  is smaller under unsigned bytewise order — a deterministic,
  constant-space rule. **A displaced candidate's defined effect
  is exactly the durable record of its document digest and
  disposition** (`unique`; on re-send `duplicate-known` — the
  Contract's completed-effect cache), **with the candidate
  material itself discarded — explicitly not the durable
  buffering that other material kinds declare** (round 20 M3:
  stating both would make retention diverge between
  implementations). The discard
  is harmless, because **the buffer is an optimization, never
  the carrier of the liveness guarantee** (round 19 B1: any
  one-slot rule can be gamed into displacing the honest
  candidate, so no guarantee may depend on which candidate
  survives the slot; the guarantee rests on the request path,
  below). If the active candidate fails, the buffered one is
  **checked immediately** — a failure presupposes the log
  (below), so no window mechanics apply to the successor. The
  total cost of any number of
  fabricated candidates stays one window, not one per
  candidate. *What the active candidate's provisional state
  is*, exhaustively: the
  unsealed material and every key derived from it, replicated
  group data, the derived service identity for this group, and
  pending key requests and their Delivery-level
  completed-effect records (document digests and dispositions —
  never a duty dedupe, which does not exist, 5.3). *What it may
  do*: replicate, scoped by the
  pinned digest, toward first materialization — and nothing
  outward: no published writes, no
  `service-identity.announce`, no service registration or view
  participation before first materialization succeeds — and
  implementations MUST NOT offer the provisional space for
  user authoring (an unverified group is not a writing
  surface); should user-authored content exist nonetheless, it
  is **unique data under Section 12's boundary and survives
  every wipe**, exactly as removal hygiene preserves unsent
  work (5.3). *How it
  ends*, one of two ways. **Either the checks of this section
  bind at first materialization** — three conditions, each a
  MUST, and the bootstrap succeeds only if all three hold at
  that one materialized state:
  (i) the named admission materializes as **canonical with the
  invitee as subject**;
  (ii) the invitee is a **member of that materialized state** —
  not merely the subject of a historically canonical admission
  whose membership has since ended by a canonical removal, by a
  discharged exit, or in the terminal state (5.3, 5.4);
  (iii) the **unsealed content key matches the current epoch's
  `contentKeyCommitment`**.
  Condition (ii) is not a new rule of this layer but this gate
  finally carrying 5.3's: eviction binds on the canonical
  removal and "member-only in every mode" (3.1) leaves no
  bootstrap open to someone the log has already removed. Without
  it the gate was satisfiable by a subject admitted in epoch N
  and removed in epoch N+1 — the admission stays canonical for
  ever, it is history — to whom a malicious remaining member
  hands a re-welcome whose material is honestly derived, and
  therefore commitment-correct, for the epoch current after the
  removal: canonicality and commitment both pass, and a removed
  member re-enters. The Membership Tasks companion §3.3 requires the
  condition **at this gate**, and this is where it binds; a
  bootstrap that fails on (ii) fails exactly like a failure on
  (i) or (iii) — that candidate's provisional state is wiped,
  the failure is surfaced, and the buffered candidate is checked
  at once (below). **Or the window closes**: if
  first materialization has not succeeded within
  **`provisional-window`** (a constant of this layer,
  RECOMMENDED default P30D, measured from the **first
  candidate's adoption for this (`genesisDigest`, invitee)
  pair** (3.2) —
  deliberately not Membership's
  `bootstrap-retention`, which is a *minimum pending-document
  retention*, the opposite duty), the
  attempt has failed. **The provisional phase ends at log
  arrival, whichever way the first materialization goes:** a
  failed membership or commitment check presupposes the log is
  present, and
  from that moment every held candidate — and every candidate
  arriving later — is **immediately** checkable against the
  commitments; window mechanics and buffer order stop mattering.
  On a failed candidate the invitee MUST
  **wipe that candidate's provisional state as listed** (unique
  data excepted, above), surface
  the failure (fail-closed, late), and check the buffered
  candidate at once. When everything held has failed — or the
  window closes with no log arrival — everything provisional is
  wiped and the invitee requests afresh from the
  still-held invite and accept via an authenticated key
  request, **on which the response duty of 5.3 binds as a
  rate-served MUST**. The liveness guarantee, stated as the
  chain it is, each link named (round 20 M2): once the log
  reaches the invitee, every held candidate is checkable at
  once — if one verifies, the bootstrap is done; otherwise a
  reachable helper holding the current keys **owes the answer
  within `key-request-interval` of the request filling its
  slot**, and the bootstrap succeeds when that answer has been
  **delivered and verified** — the delivery leg's latency is
  the Contract's and is not time-bounded (its durable buffering
  is the honest residual here, named, not hidden behind an "at
  once"). The guarantee is
  independent of arrival order, buffer displacement, and how
  many fabricated documents accompanied the honest one. Before
  the log arrives no one can verify anything, so what a
  malicious
  sender can cost is bounded delay and bounded storage inside
  one window, never a false membership, never an unbounded
  hold, never a partial teardown, never lost user data. The
  sender of record is
  attributable through the delivery chain. (This fallback is
  named in Membership §3.3 — where the full boundary-crossing
  admission cannot fit the carrier, the re-welcome travels
  instead and case-1 semantics apply; the Membership 0.8-era
  debt to name it is discharged as of Membership 0.9, §15.)

### 10.2 `removal-notice/0.1`

The task type by which a removed member is told of their
removal — registered here, like `key-delivery/0.1`, with its
document profile, dispositions, and acknowledgement rules per
the Delivery Contract §§3–6, so that a conformant carrier exists
under the current companions (Membership 0.9's
`access-operation/0.1` no longer carries a full `member.remove`
envelope — 5.3's boundary rule; the removal notice is this type).
The payload is the compact
notice object; its schema ships as
`schemas/payload-removal-notice.schema.json` with `$id` equal to
the Trust-Tasks type URI
`https://real-life.org/trust-tasks/removal-notice/0.1`, exactly
as `key-delivery/0.1` registers its payload — an offline
validator resolves the payload schema by type URI (Delivery §3),
so the type is dispatchable today, not `unknown-type`:

```json
{ "v": "rltp-access-removal-notice/0.24",
  "type": "removal-notice",
  "group": "did:key:z6Mk…group",
  "genesisDigest": "…the group's identity (3.2)…",
  "op": "oid:…the member.remove operation…",
  "subject": "did:key:z6Mk…removed",
  "epoch": 8,
  "author": "did:key:z6Mk…remover",
  "sig": "…author's signature over the JCS serialization with
          sig omitted…" }
```

- `op` names the `member.remove`; `subject` is the removed
  anchor; `epoch` is the removal transition's `newEpoch`;
  `author` is the operation's author. `sig` MUST verify under
  `author`. **Proof declaration (explicit, as for 10.1's
  material kinds):** the carrying document's `proof` is
  **absent** — authenticity is content-bound in the payload's
  own `sig` — and the document `issuer` MUST equal `author`; a
  document violating either is `failed(validation-failed)`.
- **Consistency (MUST, before any effect):** payload schema
  valid; `sig` verifies; `genesisDigest` matches a group of the
  recipient's last-held state; `author` was a member there;
  `subject` is the recipient. A violation is
  `failed(validation-failed)`, no acknowledgement.
- **The notice is a surfaced claim with no mandatory state
  effect — that is its entire defined effect.** A verified
  notice MUST be surfaced to the person and SHOULD trigger a
  verification attempt (replication / a key request). It MUST
  NOT by itself suspend writing, wipe material, or alter any
  authorization state: round 14 showed that any mandatory
  effect turns every present or former member's signature into
  a policy-free denial lever, because the one thing a notice
  cannot carry is proof that the named operation exists.
  Enforcement never needed the notice — and it never needs the
  removed member's cooperation at all: the security of a
  removal is carried entirely by the **other** parties — replica
  eviction at every peer (5.3) and the rotated epoch at every
  service (7.3) — so a removed member who ignores everything
  can write locally forever and it propagates nowhere.
  Victim-side write hygiene has exactly **one binding event:
  the member's own canonical application of the removal** (the
  one log-grounded truth their replica can establish). A peer's
  refusal to serve is — like the notice — a *signal* that
  SHOULD trigger verification, never a binding event: round 15
  showed that a bare refusal authenticates only the refusing
  peer, not a canonical removal, so binding hygiene to it would
  re-open the policy-free denial lever this section closed. A
  false notice
  is therefore a signed, surfaced, attributable lie with no
  mechanical effect — the verification attempt it prompts
  reveals the truth in either direction.
- Idempotent by document digest **within the Contract's
  completed-effect retention**: disposition **`unique`** on
  first surfacing, `duplicate-known` on redelivery — exactly
  Delivery §6's closed set (round 16 M2: this layer invents no
  disposition). Beyond that retention the Contract legitimately
  re-evaluates a redelivered document as fresh (its §6) — so
  the durable dedupe is the recipient's own, **by `op`**: an
  implementation MUST NOT re-alert a removal it has already
  surfaced, however often the document returns (round 17 M7 —
  application idempotence, not an authority question). A notice
  for a group the recipient never held is
  `failed(validation-failed)` — it never pends.

## 11. Evolvability

- Every wire artifact carries its version (`rltp-access/0.24`,
  `rltp-access-view/0.24`, `rltp-access-material/0.24`,
  `rltp-access-keydist/0.24`,
  `rltp-access-registration/0.26`,
  `rltp-access-removal-notice/0.24`,
  `rltp-access-member-mapping/0.24`,
  `key-delivery/0.1`); the vouch (`vouch@2`, 5.3) is a W3C VC in
  DTG form and carries no `v` constant — its version lives in the
  `AdmissionVouch` hint type and this profile's schema.
- **Wire version and profile version are distinct, and this
  casting moves only one of them.** A wire version advances when a
  wire shape changes; the profile version advances with every
  casting of this document. Profile `rltp-access@0.52` therefore
  produces and accepts exactly the `…/0.24` wire forms above — with the named exceptions `service-registration/0.26` (7.3) and the four session-plane evidence forms `rltp-access-evidence-claim/1` · `…-request/1` · `…-response/1` · `…-supplement/1` plus the part envelope `…-evidence-part/1` (3.6, normative as JCS field sets, schemas with the first adapter registration): the
  M-DID castings changed which anchor class fills the member
  fields — values and verdicts, never shapes — and added two new
  shapes (`member-mapping@1` in the 0.24 family, 5.5; the vouch as
  a DTG-formed VC without a family constant, 5.3);
  additionally, **one registered policy rule-type string is
  renamed** (`encounter` → `vouch`, 4.2) — a policy-body value in
  group-internal logs, of which no deployed instance exists; the
  mechanism constant `encounter-presentation` keeps its 0.24
  spelling as a named residue. No existing serialized byte of any
  artifact moved. **The service-acceptance forms**
  (`rltp-access-acceptance-receipt`,
  `rltp-access-generation-statement`; interim `/1`, then `/2`)
  **are withdrawn never-instantiated** — no schema ever shipped
  and no instance existed; under this profile they are neither
  produced nor interpreted (the acceptance anchor needs no
  artifact, 7.3). **This paragraph is
  the compatibility statement the Membership Tasks companion's §10
  asks for.**
  That profile pins this layer twice, in prose and through the `v`
  constants of the Access schemas it transcribes under mobile
  `$id`s, and states that an Access wire bump would break its
  fixtures hard and require a Membership recast. No such bump
  occurs here: the transcribed Access schemas are byte-unchanged.
  The Membership companion itself moved in this joint loop —
  `membership-accept/0.2` adds the required `candidacy` field, a
  Membership-side type bump carried by its own casting (0.15),
  not by any Access wire change — and its section references into
  this document hold — 10.1's gate acquired the
  condition the Membership companion's §3.3 already required
  there, so the
  two documents agree more closely at 0.25 than they did at 0.24.
  A group pinning a minimum profile version in policy (below) may
  pin 0.25 to require the current-member gate.
- Extension is additive: new operations (with class, epoch
  effect, default rule key, closed body profile — 4.5),
  requirement types, actions, proof mechanisms, visibility modes,
  and adapters register new identifiers; existing identifiers are
  never re-interpreted.
- **Degradation direction:** unknown constructs degrade toward
  *less* authority — unknown requirement type → unsatisfiable;
  unknown action → nothing; unknown operation → invalid as proof
  subject; unknown critical field → reject; unknown non-critical
  envelope field → ignore (the transcription schema passes them;
  3.3; operation *bodies* are closed per profile — a new body
  field is a new operation version). Hard rejection is reserved
  for cryptographic invalidity and `crit` violations.
- Renames only via alias table; key-derivation info strings
  (`rltp/v1/keydist`, `rltp/v1/service-identity/…`,
  `rltp/v1/welcome`) are never renamed. A group MAY pin a minimum
  profile version in policy.

## 12. Security Considerations

- **Fail-closed evaluation.** Authorization defaults to deny. A
  verifier without current materialized state MUST NOT authorize
  privileged operations against a stale one; epoch and
  policyVersion binding make stale proofs invalid rather than
  dangerous. An operation can never ride a policy that "lost" a
  race, because policy races no longer exist: `policy.change` is
  an enforcement operation, so concurrent constitutional claims
  are sibling epochs and fail closed (3.6) — the cascade that
  used to police the losers, and with it the merge-time
  revocation of admissions round 14 exposed, is gone at the
  root.
- **Identity is the digest — including the operational state.**
  Group state, invitations, views,
  and key AADs bind the genesis digest (3.2), so a founder
  equivocating geneses under one DID creates parallel groups, not
  parallel truths about one group; nobody can be moved between
  them without failing a digest check they themselves hold. The
  same keying covers every slot, window and throttle this layer
  defines (3.2, 5.3, 7.3, 10.1), which closes the remaining lever
  of that equivocation: keyed by the shared DID, one genesis could
  displace the other's bootstrap candidate, consume its answer
  deadline, or exhaust its rate budget — an availability attack on
  a group by a group that binds nothing in it. Keyed by digest,
  the two are as independent operationally as they are in the log.
- **A bootstrap is judged against the living state, not the
  archive.** The first-materialization gate (10.1) requires
  current membership alongside canonicality and the epoch
  commitment. An admission is history and stays canonical after
  the removal that ended it, and material derived honestly at the
  current position is commitment-correct for anyone; only the
  membership condition separates a legitimate late bootstrap from
  a removed member re-entering on a re-welcome minted by a
  malicious insider. This is 5.3's eviction rule and 3.1's
  "member-only in every mode" reaching the one gate that had
  stated its inputs incompletely.
- **The log is the perimeter, extended through the port.**
  Everything reduces to operation validity and the deterministic
  merge; implementations MUST NOT introduce side channels of
  authority. P1 (9.2) extends the perimeter through the substrate;
  the adapter's confidentiality obligations (9.1) name the
  remaining trust honestly: a malicious adapter implementation can
  exfiltrate keys — the port makes that surface explicit and
  auditable, it does not abolish it.
- **Consent is verifiable by everyone who must judge it.** The
  admitting operation encloses the signed invite and accept
  (5.3); a malicious authorized member cannot make a consentless
  admission canonical; the consumable rule caps one admission per
  accept, consumption is content-bound and merge-final (every
  canonical admission consumes the accept it encloses; no merge
  frees one — 5.3), and rule 0 bars re-admitting a standing
  member. Genesis
  claims no one: the founder countersigns, everyone else accepts.
  **Admission cloning is bounded and attributable:** an
  authorized inviter can mint several concurrent admissions of
  one subject (idempotent, 5.3); what that buys is log growth —
  capped per admission by Membership's size budget and signed by
  the inviter every time — and nothing else: the key-service
  duty carries no dedupe key at all — one outstanding,
  rate-served answer per requester (5.3, 10.1) —
  membership
  and `keyDist` count the subject once, and every usable card is
  the subject's own. **Consent staleness is wall-clock-bounded,
  stated:** an
  unconsumed accept can serve a (re-)admission only within
  `validUntil + membership-skew` of its invite (5.3 rule 3);
  inside that window a re-admission the subject no longer wants is
  possible in principle and is surfaced by the subject's own
  client (it knows its exits) — the bound is the invite validity
  the inviter chose, not a pretended causal order over wall-clock
  documents.
- **No key hostage.** The key service duty (5.3) detaches key
  possession from the goodwill of any single operation author:
  entitlement follows the log, material is re-derivable (P4),
  requests are authenticated (signed by the entitled anchor, a
  live-keyed card enclosed), the duty serves the **newest**
  request as a rate-served MUST — so a lost card, a displaced
  delivery, or any other legitimate repeat always earns a fresh
  answer within `key-request-interval`, and no dedupe rule ever
  converts a helper's silence into conformance (5.3, 10.1) —
  and adopted material must verify
  against the
  log's commitments (10.1) — so withheld welcomes, garbage
  envelopes, and broken lineage entries (repairable via
  `lineage.repair`) are delays and attributable misbehavior, never
  revocations of entitlement. Two residuals, stated: history
  whose every key holder is removed, departed, or withholding
  stays dark — 7.1's durability theorem names the one case where
  a delay hardens into loss; and a group whose *every* member
  withholds
  keys has factually expelled the victim without an operation —
  visible to the victim, deliberate, and equivalent to the group
  refusing to interact; no protocol makes people cooperate.
- **Honest revocation, honest leave.** 7.2 states exactly what
  rotation buys; UX MUST NOT present removal as retroactive
  erasure. A leave takes key-world effect at its discharging
  transition (5.4); in the pending window the leaver reads (they
  hold keys — pretending otherwise would be fiction) but has no
  policy standing in the log (excluded from the currency:
  authoring, co-signing, inviting) — while toward services they
  stay listed and view-signature-capable until discharge (7.3 is
  authoritative there: a service can check nothing else, and the
  in-epoch grow-only argument requires it) — and the discharge is
  a non-overridable single-signature act that no policy and no
  key-world state can block (a discharge out of a key-void uses
  the recovery form of the lineage, which **bridges** history; a
  discharger holding no prior key at all declares
  `lineageVoid` — an **unbridged** step, surfaced as damage and
  standing under the key holders' repair duty, never a narrowing
  act and never a legitimization — 5.4, 7.1). Concurrent leaves drain to
  terminality through the drained dissolve path (5.4: any of the
  leavers ends the group with a single signature); a
  falsely "instant" leave semantics was rejected as unsound, not
  as undesirable.
- **Terminal honesty.** Dissolution and drained groups end
  without a next key world; former members keep the last epoch as
  knowledge; services fail closed on a terminal or disputed view
  (7.3). Nothing retroactive is claimed.
- **Merge remediation windows.** A member admitted concurrently
  with a transition has a keyless window until re-welcome (3.6) —
  an availability gap, never an authority gap; implementations
  MUST discharge the duty eagerly and surface the pending state.
- **Capacity is never a merge decision.** Every admission
  canonical at its position is final (3.6); the only capacity
  mechanism is the position-local freeze of rule 0. Beyond the
  8192 wire ceiling the group is degraded, not re-decided:
  membership-scaled artifacts are unconstructible (fail-closed
  at construction), leaves and dissolution remain available, and
  recovery is by attrition (3.6, OI-14). Driving a group there
  requires coordinated multi-partition flooding, is attributable
  through the inviter signature every admission carries, and is
  bounded in conformant deployments by the single-partition
  enforcement scope (9.6) until OI-1 resolves.
- **The transport budget, arithmetically honest.** The
  transported-variant caps bound the proof at ≈ 44.5 KiB worst
  case: 64 envelope signatures ≈ 200 bytes each serialized
  (12.5 KiB) plus 16 credentials at ≤ 2048 bytes JCS (32 KiB).
  Membership's normative maxima bound the documents at 16 384
  bytes each for invite and accept and 16 384 bytes for the
  welcome plaintext, whose seal (base64url plus AEAD overhead)
  reaches ≈ 22.5 KiB. **Nominal constructions** — documents of
  a few KiB, a small welcome — therefore carry even the
  full-cap proof against the Delivery Contract's 65 536-byte
  plaintext budget with margin; **adversarially maximized
  documents do not**, and this document says so instead of
  claiming a universal fit: the sender MUST verify the complete
  serialized task against the plaintext limit before sending
  (Membership §2's own rule), and where the enclosed form does
  not fit, the always-fitting self-contained (re-)welcome
  (10.1, ≤ ~22.5 KiB sealed) is the guaranteed bootstrap path
  (5.3). The cost bound is aggregate over the composed rule
  (4.4 — `any` maximum, `all` sum, closed under composition),
  the per-credential cap is enforced at this layer's acceptance
  (5.3), and no transition-carrying envelope ever needs the
  carrier at all (5.3's boundary rule; the removal notice is
  10.2's registered task).
- **Service exposure, bounded and stated.** Within the declared
  staleness bound — itself enforced at view acceptance
  (`validUntil ≤ issuedAt + stalenessBound`, 7.3) — a colluding
  view quorum can delay removal effects, deny a member, or list a
  stranger; end-to-end encryption caps the stranger at ciphertext
  and write-spam, epoch monotonicity plus in-epoch grow-only caps
  rollback at denial, and every misstatement is signed, chained,
  and comparable against the log inside the group. `m ≥ 2` turns
  accidents into conspiracies. Registration is trust-on-first-use:
  an attacker registering a fake chain first can deny service,
  never read or forge.
- **Lineage is a disclosure surface; only its omission is a
  legitimized closure.** Each lineage entry
  extends what one current key unlocks; that is its purpose.
  Omission is a separately gated act (`history.narrow` aspect
  rule), never a transition author's private choice, and never an
  adapter's accident (P3). Narrowed spans are irreversible except
  through `history.expose` — deliberate, logged, carrying its
  disclosure in its body, byte-verifiable against the commitment
  chain. The recovery form is the deliberate opposite: it
  *bridges over* a key-void, under 7.1's honest theorem —
  reachable history is exactly as durable as the membership of
  its key holders. A falsely declared void is re-opened by the
  key holders' repair **duty**; where no member holds a step's
  keys, that span is dark under every form, the recovery form
  included — stated as the residual it is, not gated by an
  electorate that could hold a leave hostage (7.1, 5.4).
- **Deadlock by shrinkage.** Anti-deadlock (4.4) blocks removals
  that would kill the constitution; leaves cannot be blocked, but
  the discharge path is policy-exempt and a fully drained group
  is terminal (5.4), not locked. A group can still become
  constitutionally stuck above emptiness (only leaves remain);
  stated, surfaced, shrink-robust forms are OI-10.
- **Teardown.** Runtime authority (cached views, derived keys,
  open handles) MUST be invalidated on removal and identity
  switch; stale runtime generations must not act.
- **Unique data at removal.** Wiping MUST NOT destroy the only
  copy of data the group is entitled to retain, and MUST NOT
  retain what the removed member is entitled to withdraw; the
  Layer-4 `dataPolicy` governs; the boundary MUST be explicit.
- **Time gates.** The only wall-clock checks in this layer sit at
  the service boundary (7.3) and in the consent-staleness bound
  (5.3 rule 3, honest-clock), each against a declared skew bound.
  Log validity never consults a clock.

- **Member-anchor scoping and the mapping's deniability:** a
  member anchor reused across groups voids its own pseudonymity —
  5.1's scoping rule is normative, not advice. A leaked
  `member-mapping@1` proves nothing to third parties (class V:
  the addressee could have forged it), so a cross-group link
  exists as knowledge, never as transferable evidence; and the
  vouching credential's subject is the member anchor, so the log
  never carries the coordinate that would join a person across
  groups.

## 13. Privacy Considerations

- **Toward services:** a service sees derived pseudonymous
  identities, epoch numbers, view sequence numbers, and the
  genesis digest — never main anchors, the membership mapping,
  policy, admission evidence, or the invitation graph. **This is
  a floor on adapters and part of their conformance class:** an
  adapter MUST NOT expose membership, policy, or the invitation
  graph in plaintext to non-members or infrastructure.
  (Informative: both candidate substrates of 9.7 currently sit
  below this floor — plaintext control messages in one, a
  plaintext authorization graph at sync providers in the other;
  the floor is a required contribution, not an aspiration.)
- **Stated residue:** the view's `identities` list reveals to a
  service the cardinality and churn of the group's **announced
  service-identity set** — members who have announced, pending
  exits included until discharge; not admitted-but-unannounced
  members, and never the anchor mapping. This is the price of
  removing the commitment machinery (OI-12 tracks hiding
  schemes); view cadence reveals *that* authorization changes,
  not what changed. Both are addressee-directed toward a service
  the group chose. After a terminal view the service retains the
  last identity list for the `terminalRetention` window (7.3) —
  a bounded, registered prolongation of the same residue, ending
  with the binding's discard.
- **Inside the group:** admissions are individually attributable
  (internal accountability), encrypted to members (external
  invisibility). The permanence cost of admission enclosure —
  both cards, both proofs, forever in the log — is stated in
  Membership §8 and capped by its size budget — and it now prices
  in **group-scoped identifiers, not cross-group coordinates**:
  the M5 correlation surface of the visibility review (roster
  readers and colluding insiders joining a person across groups)
  is removed **as a default**: without the person's own
  `member-mapping@1` disclosures, no cryptographic join key
  exists anywhere. After voluntary disclosures toward members of
  several groups, those members can join her as **knowledge** —
  class V denies them the transferable proof, never the knowledge
  (Section 12); disclosure is and remains a per-recipient
  decision of the person. Residue, stated honestly: display
  profiles, behavior, and timing can still identify a person
  socially — this layer removes the cryptographic join key, not
  human recognizability.
- **Vouch presentations** disclose to the group that specific
  members vouch for the subject — bounded, deliberate,
  group-directed disclosure by each voucher; the subject's wider
  graph stays undisclosed (OI-5 minimizes further).
- **Open mode opens content, never the log** (3.1, 8):
  membership, admission evidence, and policy stay sealed in every
  visibility mode. Its retroactive form, `history.expose`, is a
  separate, deliberate, logged act whose body is the disclosure
  itself.

## 14. Conformance

- **Normative schemas (shipped, offline closure):**
  `schemas/access-operation-envelope.schema.json` ·
  `schemas/payload-key-delivery.schema.json` ·
  `schemas/access-material.schema.json` ·
  `schemas/authorization-view.schema.json` ·
  `schemas/access-registration.schema.json` ·
  `schemas/payload-removal-notice.schema.json` ·
  `schemas/member-mapping.schema.json` ·
  `schemas/access-vouch.schema.json` — plus, by
  reference,
  Membership's document schemas, `sealed-envelope.schema.json`,
  and `contact-card.schema.json`.
- **Profile** `rltp-access@0.52`, whose wire forms remain those of
  `0.24` (Section 11 — two new shapes, one renamed policy-body
  value, no changed shape);
  normatively references the **Membership Tasks (0.16) and
  Delivery Contract (0.22) of the current joint state** (document
  shapes, welcome seal, admission transport; document profile,
  sealed envelope, dispositions — their profile strings are
  pinned on their side, M2-style); where Encounter artifacts are
  consumed (cards), `rltp-encounter@0.28` (wire 0.25).
- **Classes:** *member agent* (log, materialization including
  conflict matrix, merge-finality outcome rules, retained-set
  computation, and
  admission rules; policy evaluation; transitions; duties;
  hygiene) · *policy verifier* (3.4/Section 4 evaluation only) ·
  *adapter* (Section 9: P1–P4, 9.1 including confidentiality
  obligations and the §13 floor) · *service* (7.3 obligations
  only).
- **Vector plan:**
  - **abandon equivocation:** two validly quorum-signed but
    distinct abandon cores for one `(genesisDigest, service,
    generation)` → both retained, no supersession,
    registration equivocation, fail-closed (7.3);
  - **evidence transcript (positive):** a two-part and an n-part
    exchange (n ≤ 16, parts 1..n, `prevPartDigest` null at 1,
    `count` and `transcriptDigest` on the final part only) →
    standing after the final verification, not before;
  - **evidence transcript (negative):** truncation (final part
    withheld) · part reordering · part duplication · a false
    `final` with wrong `transcriptDigest` → each leaves the
    exchange standing-less; integer domains: `part` ∈ [1, 16],
    artifacts per exchange ≤ 4096 (3.6);
  - **freeze honesty (mandatory):** a truncated chain prefix,
    however internally consistent, confers nothing — acceptance
    follows only from the live session or the successor chain
    into it; outside both, `invalid-bundle` (7.3);
  - **parallel acceptance (CAS):** two concurrently pre-validated
    R(g+1)/R′(g+1) → exactly one commits, the other fails the
    expected-old comparison (7.3);
  - **acceptance-commit atomicity (mandatory):** crash before
    the atomic acceptance commit → nothing advances anywhere;
    crash after → registration, tombstone, and chain state all
    reproduce (7.3);
  - **service root in a peer session:** presented in any session
    not directly bound to the exact-byte service itself → never
    `standing-granted`; `invalid-bundle` (3.6/7.3);
  - **acceptance anchoring (mandatory):** a candidate generation
    whose only "acceptance" evidence is signed under its own
    `attestationKey` → no standing (self-signed acceptance is
    void); any evidence set **without** the verifier's own
    session anchor → `invalid-bundle`; the positive case is
    exactly: direct exact-byte service session + session-attested
    end generation + full `previousRegistration` chain → standing;
    a stolen old attestation key never revives superseded
    standing (7.3);
  - **root substitution (mandatory):** an old quorum signer
    forges a g+1 registration against a superseded weaker view;
    with `authorizationRoot` quorum-bound the closure check runs
    against the named root, the service's sole-tip rule rejects
    it live, and toward third parties it fails the acceptance
    evidence — never a verification root (7.3);
  - **transcript progress:** an over-cap closure saturates, the
    verified views persist in the view DAG, the retry completes
    from the farther anchor (3.6);
  - **historical registration roots:** a fresh verifier receives
    a g-generation target chain with registrations and their
    recursive view-dependency closures → verifiable to the seq-0
    root; after permissible compaction the service serves the
    closure reproducibly or answers
    `missing-registration-authorization-evidence` — never an
    unrooted sole tip as a "root" (3.6);
  - **replica baseline partition:** root T5, baseline T7 of the
    same session (known, non-ancestor) → `non-ancestor-baseline`,
    full root-session span (3.6);
  - **evidence session end-to-end:** claim with incomplete
    conflict set → supplement (projection-bound) → one fresh
    union claim → `standing-granted`; a projection-relevant
    change between turns → `superseded-snapshot`; an irrelevant
    additive admission → no supersession; past 16 parts/4096
    artifacts → `evidence-saturated`; a service chain spanning
    two registration generations → both preimages served,
    historical targets verify against their own generation; a
    missing committed generation → response variant
    `missing-registration-core` (3.6);
  - genesis: valid single-founder incl. card; `op` ≠
    `group.genesis`, missing/duplicate-key countersignature,
    group DID = founder anchor, missing card or foreign card
    anchor, multi-member body → each rejected; policy
    satisfiability against one member; commitment = multihash
    over raw key bytes;
  - identity-by-digest: two geneses under one DID → two groups;
    an invitee's bootstrap against their pinned digest rejects
    the sibling; views and key deliveries scope by digest;
  - envelope: id recomputation; cross-group/cross-epoch/
    cross-position replay rejection; `crit` handling; unknown
    envelope fields pass the shipped schema, unknown body fields
    fail the closed profile; duplicate-id envelopes →
    canonical proof merge (union of signers and issuers,
    first-valid entry per signer/voucher; the signer and issuer
    **sets** identical across arrival orders — signature bytes
    may differ and nothing reads them; merge dominates every
    variant; bounded by one entry per signer and issuer) with
    effects applied once per `id`;
  - materialization: determinism incl. concurrent folds; one
    vector per matrix row incl. terminal∥enforcement → forked and
    terminal∥additive rules; forked state fail-closed and
    surfaced; emptiness terminal on the full materialization and
    revived by a concurrent canonical add; a canonical dissolve
    not revived; policy.change concurrent with any enforcement
    operation (another policy.change included) → forked state,
    nothing on either sibling canonical; an admission valid at
    its position under an ancestral policy.change is a member of
    every non-forked merged materialization containing it (the
    round-14 B1 shape now yields the forked state, never a
    revoked admission); anti-deadlock position-local with the
    discharge exemption, no post-merge reversal exists;
  - admission: rule 0; each cross-binding of rules 1–4 violated →
    not canonical (incl. genesis-digest binding); causal replay of
    a consumed accept → non-canonical outright (same-accept only:
    a re-admission after an ended membership, carrying the old
    admission in its closure but a fresh accept, IS canonical —
    5.3);
    concurrent same-subject admissions → idempotent membership,
    identical on every replica; every candidate consumes its
    enclosed accept (a late-merged smaller id changes neither
    consumption nor any request's validity — nothing is
    distinguished); no candidate's
    effect voided, a descendant of any candidate keeps
    its verdict; an accept consumed by any canonical admission
    never serves a later admission (re-admission after an ended
    membership needs fresh consent);
    post-expiry accept rejected (consent-staleness bound);
  - key service duty: authenticated request (signature,
    live-keyed card) honored; unsigned or third-party request →
    no duty;
    re-derived material verifies against commitments; garbage
    material fails the 10.1 commitment check and is not adopted;
  - policy: rule keys incl. `history.narrow` aspect (both rules
    evaluated on one proof); product-space order to depth 4 incl.
    the two counterexamples; subject-binding rejection;
    `strongest` meta-resolution; satisfiability against policy
    currency (pending exits excluded); pending exit cannot
    author/co-sign/invite in the log yet remains view-listed and
    view-signature-capable until discharge (7.3); discharge
    rotation valid on a single signature against a restrictive
    `epoch.rotate` policy;
  - transitions: retained set computed (remove subject excluded;
    ancestry leaves discharged; rotation cannot exclude others —
    coverage mismatch → invalid; duplicates → invalid);
    no-plaintext-secret check; keydist AAD (genesis digest,
    newEpoch, recipient) — constructibility (no id in AAD) and
    cross-transition replay inertness; lineage in exactly one
    of its four exclusive states — embedded `lineage` (verified
    against the opened epoch's commitment), authorized
    `historyNarrow`, registered `lineageForm`, or `lineageVoid`
    on a discharge only (7.1, 9.4); `lineage.repair` accepted
    when verifying, first canonical repair counts;
  - leave/dissolve: pending exit excluded from the policy
    currency while remaining view-listed and
    view-signature-capable until discharge (7.3 — the one
    consistent statement, tested in both places); discharge by
    ancestry-containing transition, authorable by any member of
    its position, a pending exit included;
    last-member leave = terminal; concurrent leaves → drained
    dissolve path (single signature of any leaver, empty body,
    no transition, terminal);
    `member.remove` of a non-member → invalid;
  - views (7.3): registration; seq/prevView chain; epoch
    monotonicity as rollback protection (older-epoch view
    rejected; same-epoch older view only shrinks); freshness
    window enforced at acceptance (`validUntil` beyond
    `issuedAt + stalenessBound` → rejected); `m` change rule and
    `m ≤ |identities|`; gap/divergence → persistent fail-closed
    across restart; disputed terminal → fail-closed, cleared by
    a reconciliation view naming the divergent tips under its
    explicit `predecessor`;
  - key-delivery: keydist digest+epoch match against the named
    transition; re-welcome recipient = admission subject;
    the three-condition first-materialization gate (canonicality,
    **current membership**, commitment — 10.1); genesis-digest
    binding; unknown op →
    pending mechanics; bootstrap re-welcome self-contained;
    idempotency;
  - port: P1 raw-ingestion equivalence; P2 no observable
    claim-without-transition state; P3 history readable exactly
    to the unbroken-lineage bound; P4 material schema-valid,
    re-derivable, current-epoch-only, within budget;
    `linear/0.1` keys schema closed (extra property → invalid);
  - visibility: `E = newEpoch` constraint; `history.expose`
    byte-verification against commitments, open-mode-only
    validity, range check; publication through the publication
    port idempotent per artifact;
  - *(round-3 additions)* canonical proof form: unsorted
    signatures → invalid; genesis digest byte-stable under any
    proof presentation; digest fields accept `u` and `z`
    encodings; lineage `{opens, ct}`: default opens = previous
    epoch; recovery form with skipped span surfaced; false void
    bridged by `lineage.repair` (registered rule key); AAD bytes
    = JCS of the named objects, cross-implementation seal/unseal
    vectors for keydist and lineage; keydist plaintext =
    `rltp-access-keydist/0.24`; `lineageForm` third state accepted
    for a registered non-native adapter, rejected for the native
    one; views: `m = 0` invalid, signer-intersection rule,
    future-dated `issuedAt` rejected, pending exit still listed
    until discharge; key request: proof + card required, one
    outstanding rate-served answer per (`genesisDigest`,
    requester),
    unentitled (removed) requester refused at the helper's
    current state; re-welcome
    epoch equalities; last-member leave revived by a concurrent
    canonical admission;
  - *(round-4 additions)* group identity computed over the
    proof-free signature input — proof variants (same signer, new
    signature bytes) change nothing; proof-variant union: a
    variant satisfying the applicable rule keeps the
    operation effective on every replica holding it; recovery
    `opens` valid under the operation's own rule (a bridge, 7.1 —
    only the *absence* of lineage is `history.narrow`-gated);
    replacement `service-identity.announce` effective
    only at the next transition (in-epoch view sets strictly
    grow-only); stepwise reconciliation over more than eight
    divergent tips; seq-0 acceptance rule; `m`-timing (a shrink
    below the chained quorum requirement is unacceptable without
    a preceding `m`-lowering view); `refresh` toward a retained
    member and toward the founder — sealed to the request card,
    adopted only on commitment match; a `request` naming unknown
    state fails immediately and never pends; `ct` below the
    80-character minimum schema-rejected;
  - *(round-5 additions)* proof merge replaces variant retention:
    storage bounded by one entry per signer/voucher, the evaluated
    sets identical across arrival orders, evaluation
    over the merged signer set; replica eviction in the removal commit
    (post-removal operations unreachable to the evicted peer —
    port vector P2); epochSecret derived from contentKey (a
    poisoned side secret is unconstructible; refresh material
    fully authenticated by the commitment check); replacement
    announcement effective at the first transition containing it
    in its ancestry (concurrent transition does not carry it);
    duty as one
    outstanding answer (a request after a rotation is simply
    the newest request and re-earns material); rate limiting per
    genesis digest; reconciliation
    state machine (seq, epoch, tip replacement, quorum source)
    stepwise to one tip;
  - *(round-6 additions)* vouch merge per voucher (one per
    issuer; an issuer minting many credentials gains nothing);
    merged mechanism label derived, nothing normative reads it
    (3.3); caps at the wire ceilings (8192, 3.6); commitment
    equality across epochs → transition invalid (key reuse dead);
    first-valid-wins per signer (a pre-computed descending
    signature series causes no re-propagation); reconciliation
    predecessor checkable incl. diverged reconciliation views,
    ordinary views
    extend their tip during fail-closed; eviction at every
    membership end (removal / discharge / terminal); epoch-secret
    derivation bytes exact; the duty slot identical in 5.3 and
    10.1 (one slot per (`genesisDigest`, requester), replacement
    swaps content never the deadline, discharge within the
    interval);
  - *(round-7 additions)* pure encounter proof keeps its derived
    `encounter-presentation` label through the merge (never
    falsely `composite`); first-valid per issuer (no
    digest-smallest replacement); terminal view
    carries the predecessor's identities as attesting set and is
    constructible; 4097th admission invalid at its position
    (serial case of the profile group
    bound); eviction bound at each replica's own canonical
    application; cross-group / sibling key-reuse as P4 audit
    vector;
  - *(round-8 additions)* proof merge admissibility: a
    cryptographically valid credential about a different subject
    never enters the merge and never occupies its issuer's entry
    (slot poisoning dead; the later subject-bound credential of
    the same issuer merges); merged proof evaluated as the pair
    of sets whatever the variants' labels; schema rejects
    `credentials` under `mechanism: signature-set`; recovery
    bridge: `opens = 0` valid (bridges to the genesis epoch's
    key), constructible only by a holder of `opens`'s key,
    skipped span surfaced, discharge-out-of-void on a single
    signature; explicit `predecessor` field checked
    (non-ancestor or sub-anchor seq → invalid; a non-maximal
    common ancestor at or above the anchor → accepted, the
    overt quorum choice); terminal grace:
    contradicting view within `terminalRetention` → ordinary
    divergence machinery, binding kept; past the window →
    binding discarded, re-registration; commit-before-forward:
    batch with removal + descendants at a lagging replica →
    nothing causally past the removal ever forwarded to the
    removed peer, transitive third-replica forwarding included;
    keydist plaintext version current end-to-end
    (schema description included);
  - *(round-9 additions)* lineage durability theorem: a false
    skip whose span keys are held by remaining members is
    re-opened by the repair **duty**; the disjoint-holder shapes
    (span
    key holders all removed, departed, or the void author alone)
    → span dark under the recovery form AND under a garbage-`ct`
    default form alike — the skip adds no darkening power,
    no false repair promise; vouch admissibility exact:
    `subject` = `body.subject` and `accept` = the enclosed
    admission's accept digest compared, and a
    vouch on a rule key that cannot carry a vouch rule
    (`member.remove`) inadmissible even with matching subject;
    proof evaluation label-free (same sets under different
    labels → same verdict; merged emission always
    schema-consistent); drained dissolve path: all members
    pending exits on merged branches → a pending exit's
    single-signed
    `group.dissolve` (drained path) valid, terminal, schema-valid
    with empty body and no transition;
    crossing reconciliations (Rxy/Ryz over shared parent Y) →
    identical derived tip sets on every service holding the same
    views, any arrival order; tips = maximal elements of the
    held DAG; ancestry-closure retention back to the last
    single-tip state, pruning beyond it; `terminalRetention`
    measured from local acceptance;
  - *(round-10 additions)* fold linearization: the ready-set
    smallest-id rule on the A→C, B-concurrent,
    id(C)<id(B)<id(A) shape → one defined order (B, A, C) on
    every replica (the pairwise rule has no consistent order
    there); proof-merge position bound: a flood of valid
    signatures by non-currency Sybil signers and subject-correct
    credentials by non-currency Sybil issuers merges zero
    entries; merged proof re-serializes within the wire
    cap at full currency plus subject; drained dissolve narrowed: an
    active (non-leaving) author cannot use the drained path
    even when all others are pending exits (their discharge
    retains {author} instead), and all-pending with no authored
    dissolve = dormant, surfaced, any leaver finalizes later;
    pending exit authors `lineage.repair` validly (the third
    exception, at the validity gate AND the merge);
    label derivation single-form:
    pure vouch merge (credentials + subject-only signer) →
    `encounter-presentation`, credentials-empty →
    `signature-set`, else `composite`, identical from 3.3 and
    4.3;
  - *(round-11 additions)* over-capacity: two admissions
    concurrent at 4095 → merged membership 4097, both members,
    all artifacts (proofs, `keyDist`, view identities)
    schema-valid under the 8192 caps, every further admission
    invalid at its ≥ 4096 position until departures shrink the
    group; no arbitration vector exists because no arbitration
    exists; eligible-signer merge: a discharge proven by two
    different pending exits' variants merges both signatures and
    re-serializes schema-validly; a genesis proof merges exactly
    its two required signatures; Sybil signatures outside the
    member set merge nothing on any operation; `lineageVoid`:
    valid only on a discharge, ungated, surfaced as unbridged,
    repairable by key holders, invalid on every other
    transition; a keyless discharger (admitted into a void, void
    author departed) discharges validly with `lineageVoid`;
    registration artifact: schema-valid
    registration accepted, quota outside [16, 4096] rejected,
    bad signature rejected, missing field rejected;
  - *(round-12 additions)* evidence contract: a late sibling of
    a skeletonized parent verifies when presented with the
    parent's full artifact (digest readmission supplies
    identities/m/epoch), and is rejected retriable without it;
    a never-seen branch presented with its dependency closure
    down to held evidence verifies recursively; a linear run of
    a million spam views compresses to its endpoints and a
    spanning segment re-verifies by digest chaining;
    registration binding: `sig` verifies under the named
    `identity`, seq-0 view signed by exactly that identity, a
    registration naming service A rejected at service B;
    duration subset: `P30D`, `PT6H` accepted; `P1M`, `P1Y1W`,
    mixed ascending forms, and 4+-digit components rejected;
    fixed-seconds arithmetic vectors;
  - *(round-13 additions)* admission merge-finality: three
    branches admitting 4095 each from one shared state → merged
    membership 12 286 (the founder plus 3 × 4095 disjoint
    admitted subjects — start state: one member),
    **every** position-canonical admission a
    member in every merged materialization, no suppression, no
    re-ordering, retained-set computation merge-invariant (the
    two-evaluations shape of review 13's B2 yields one verdict);
    over-ceiling degradation: at a merged membership > 8192 a
    transition whose retained set exceeds 8192 is
    unconstructible (schema-invalid `keyDist`) and fails closed
    at construction, `member.leave` and `group.dissolve` remain
    constructible, and after leaves shrink the retained set to
    ≤ 8192 the discharging rotation succeeds; aggregate cost
    bound: `all[actors(A1,64), …, actors(A63,64)]` on
    `member.add` is structurally invalid (componentwise sum
    4032 > 64) while each leaf alone passes; cost of
    `strongest` computed after meta-resolution; transported
    variant: an enclosed admission proof with ≤ 64 signatures
    and ≤ 16 credentials each ≤ 2048 bytes JCS satisfies and,
    with nominal documents, fits the 64 KiB budget (the §12
    arithmetic as a vector); a
    proof over the caps or a credential over the byte cap →
    not a conformant boundary artifact however valid in the
    replica; boundary rule: a transition-carrying envelope as
    boundary payload → non-conformant; skeleton budget: the two-tip
    fork-and-reconcile ladder fills 8 × quota and triggers
    mandatory compaction — persistent state stays within quota
    full artifacts + 8 × quota skeleton entries in every DAG
    shape, anchor and tips never compacted; a compacted view
    re-enters by full re-verification (readmission shortcut
    gone, verdict unchanged); closure bound: a bundle of more
    than 256 views rejected retriable, the same chain admitted
    incrementally across presentations rooting in
    previously admitted evidence; predecessor floor: a
    predecessor below the service's anchor seq rejected, a
    non-maximal but ≥-anchor common ancestor accepted (overt
    quorum choice), ancestry checked via presenter-supplied
    segments; service identifier: byte-identical `service`
    accepted; case-, port-, or slash-variant strings rejected
    (no normalization);
  - *(round-14 additions)* cost `any` = maximum:
    `any[threshold(65), vouch(17)]` on `member.add` →
    structurally invalid (the round-14 counterexample; the
    minimum would have passed an unreachable pair); every
    branch of a valid `any` independently within the caps;
    extraction vector — from any satisfying proof of a valid
    `member.add` rule, a satisfying variant within (64, 16)
    exists (induction shapes to depth 4, shared signers
    over-counted conservatively); `policy.change` as
    enforcement: body requires `policy` **and** `transition`
    (schema); two concurrent `policy.change`s → forked state;
    `policy.change` concurrent with `member.remove` or
    `epoch.rotate` → forked state; the round-14 B1 shape
    (admission under policy Q, concurrent rival policy R) →
    forked state, the admission never revoked, no cascade
    exists to run; anti-deadlock at the operation's position
    only; fit as sender duty: an enclosed admission whose
    serialized task exceeds the plaintext limit is
    non-conformant at the sender, and the same admission's
    subject bootstraps conformantly via the self-contained
    re-welcome (10.1) with the admission arriving by
    replication; removal notice as registered task: document
    `issuer` = notice `author`, consistency checks, disposition
    `unique` on first surfacing and `duplicate-known` on
    redelivery; a verified notice changes no
    authorization state and suspends nothing (a notice naming a
    fabricated `op` is surfaced, attributed, and mechanically
    inert — the round-14 B5 lever is gone); write hygiene binds
    only to the member's own canonical application (a peer
    refusal is a signal, never a binding event);
    anchor ratchet: a view whose ancestry does not
    pass the service's anchor → rejected outright (the
    round-14 B6 sub-anchor fork never enters; a fabricated
    ancient branch signed by a long-expelled quorum never
    enters); predecessor always satisfiable — the anchor
    qualifies for every held tip set; ratcheted-apart services
    (pre-convergence equivocation) → stated residual,
    re-registration; saturation exemption tip-reducing only:
    at the quota, a reconciliation over long-joined non-tip
    parents (round-14 B7 spam) → rejected retriable, tips and
    storage stay within quota bounds; a reconciliation naming
    the current tips → accepted, count strictly falls; below
    the quota reconciliation views count against it; crossing
    reconciliations at a saturated service → second waits,
    final join naming both → accepted; view schema and
    conformance wording carry the floor rule, not maximality
    (round-14 M1);
  - *(round-15 additions)* empty composition: `all[]` and
    `any[]` (at any depth) → structurally invalid policy;
    parked-remove shape: Add-X-A ∥ (Add-X-B → Remove-X-B) —
    X is a member through both adds (idempotent, nothing
    distinguished), Remove-X-B stands as an
    ordinary authorized removal via the enforcement-prevails
    row, one verdict on every replica, no voided ancestor
    anywhere; anchor advancement: accepting a view whose
    parent is the sole tip advances the anchor to that parent —
    a sibling of the live head (equal seq) enters as
    divergence and forces fail-closed; a sibling of a
    just-accepted false terminal view enters within the grace
    window (the round-15 B3 shapes); a sibling of a
    built-beyond view is rejected (ratchet); bootstrap
    re-welcome: case-1 pre-checks (accept-card seal, invite
    pin, well-formed material), provisional adoption,
    canonicality + current membership + commitment checked at
    first
    materialization, failure → provisional state discarded and
    surfaced; notice payload dispatch: schema `$id` = type URI
    `…/trust-tasks/removal-notice/0.1`, document proof absent,
    issuer = author, violations `failed(validation-failed)`;
    policy.change ∥ member.leave: merged state may make the
    new policy unsatisfiable → constitutional lock, surfaced,
    leaves and dissolution open (OI-10 instance, no
    retroactive reversal); saturation acceptance: below quota a
    non-reducing reconciliation is admitted and counts, at
    quota only tip-reducing ones, headroom freed by dropping
    non-tip artifacts changes admission (deterministic in
    evidence + retention state); segmented `history.expose`:
    `toEpoch` present and ≤ E, adjacent ranges compose, a
    5000-epoch history exposed in two operations, range over
    4096 → schema-invalid;
  - *(round-16 additions)* content-bound consumption: two
    concurrent admissions of X with accepts α and β → both
    canonical, both accepts consumed, on every replica in every
    arrival order; a **causally** later admission enclosing α
    or β →
    non-canonical (no accept ever frees — the round-16
    re-admission-without-consent shape is unconstructible;
    a merely later-*received* concurrent candidate with its own
    accept stays canonical per 5.3); a
    key request naming either admission honored, and a
    late-merged smaller-id candidate changes no request's
    validity (nothing is distinguished — the grind buys
    nothing); reconciliation continuity cut: a join of [V, F]
    where V's identities exclude Q → no signature of Q counts
    toward `m`, the round-16 takeover join is unacceptable at
    every service; empty cut (parents with disjoint identity
    lists) → no reconciliation constructible, binding ends in
    re-registration; mandatory eviction: at the quota, a local
    tip-join makes its parents non-tips and the service MUST
    evict their full artifacts (smallest seq first) to admit
    new evidence — two services saturated on disjoint tip sets
    converge via local joins → eviction → cross-admission →
    global join (the round-16 permanent-divergence shape
    terminates); bundle judged atomically: foreign parents plus
    their join in one bundle accepted where the net tip delta
    is negative; provisional bootstrap lifecycle: the state
    list wiped completely on failure, no outward effect
    (publish/announce/register) before first materialization,
    `provisional-window` expiry → failed bootstrap, wipe,
    retry from invite+accept; notice dispositions `unique` /
    `duplicate-known` end-to-end against a Delivery-conformant
    adapter; one-leave margin: a `policy.change` assigning
    `policy.change` a `threshold(|currency|)` with plural
    currency → structurally invalid; `threshold(|currency|−1)`
    → valid, and a single concurrent leave leaves the
    constitution amendable;
  - *(round-17 additions)* re-admission restored: X removed,
    then admitted again with fresh accept β — canonical despite
    the old admission in the closure (the causal step is
    same-accept only); replay of the consumed α → non-canonical;
    add∥remove concurrency consumes the admission's accept (the
    matrix row), so the same α cannot serve a post-removal
    re-admission; reconciliation `m` = max of the named
    parents' effective quorum sizes (parents raised m to 3 →
    one common insider cannot join; predecessor's stale m=1
    grants nothing); constitution guards: an `actors` component
    in (or resolving into) the `policy.change` rule →
    structurally invalid at genesis and at every policy.change
    (the round-17 genesis-growth-departure shape cannot be
    minted); bootstrap serialization: malicious commitment-bad
    re-welcome adopted first, honest one buffered → the active
    candidate's failure presupposes the log, the buffered
    honest one is checked immediately and succeeds — no second
    window exists or is needed; user
    drafts in a provisional space survive every wipe
    (unique-data boundary);
    eviction tie: equal seq across branches → digest byte
    order decides, identical retention on identical DAGs;
    bundle staging bounded by closureBound (256), not the
    parent cap; notice re-surfacing suppressed by `op` at the
    application across Contract-retention expiry;
  - *(round-18 additions)* effective quorum size recursive: a
    reconciliation R over parents with effective m = 2 and 3,
    carrying `m: null` → effective(R) = 3 on every service, and
    a child of R with two signatures is rejected everywhere (the
    round-18 B1 divergence is unconstructible); a chain of
    `m: null` views inherits its parent's value down to the
    registration's non-null `m`; bootstrap window pinned to the
    pair: N fabricated re-welcomes plus one honest one → total
    delay bounded by ONE `provisional-window`, at most one
    alternate buffered; window expiry with no log arrival →
    complete wipe and retry from invite+accept;
  - *(round-19 additions)* bootstrap liveness anchored on the
    request path: the honest candidate displaced from the
    one-slot buffer by digest-ground fabrications → the invitee
    still bootstraps — held candidates fail against the
    commitments (log present), the fresh authenticated request
    earns a rate-served MUST answer within
    `key-request-interval`; a displaced candidate is
    acknowledged `unique` and its re-send `duplicate-known`;
    duty in final form: at most one outstanding answer per
    (`genesisDigest`, requester), the newest request replaces an
    older
    outstanding one (no queue), discharge at latest within the
    interval; card loss mid-epoch: request with the
    replacement card → MUST answer sealed to it within the
    interval (the round-19 hostage shape is unconstructible);
    N requests in one interval → one forced answer, no
    accumulated obligations; §14's capacity vector states its
    start state explicitly (founder + 3 × 4095 = 12 286);
  - *(round-20 additions)* duty slot exactness: requests at
    t=0 and t=59 min → one answer no later than t=60 min
    (replacement never resets the deadline — the silent-forever
    helper of round 20 M1 is non-conformant), sealed to the
    card held at discharge; discharge empties the slot and the
    next request starts a fresh deadline; two devices of one
    anchor replacing each other's slot content = an identity
    residual, not an escalation; bootstrap guarantee as a
    chain: log arrival → held candidates checked at once; none
    verifies → request → answer owed within the interval →
    success on delivery + verification, with the delivery
    leg's latency unbounded and stated; displaced candidate:
    durable record of digest + disposition, material
    discarded, no durable buffering — retention identical
    across implementations; failed active candidate → buffered
    one checked immediately, no window mechanics;
  - *(twenty-fifth-casting additions — the joint-seam round)*
    **current-member gate (B3):** X admitted canonically in
    epoch N, canonically removed in epoch N+1, then handed a
    re-welcome naming that admission whose material is honestly
    derived — and therefore commitment-correct — for the epoch
    current after the removal → at first materialization the
    admission is canonical with X as subject and the commitment
    matches, and the **bootstrap MUST fail** on condition (ii),
    because X is not a member of that materialized state (10.1;
    the Access-side judgment of Membership 0.11 §10's
    removed-subject re-welcome vector — one input, one verdict
    across both documents); a suite in which canonicality plus
    commitment alone completes the bootstrap is the regression
    check. Counter-vectors that MUST still succeed: the same
    shapes where the removal is **not** in the materialized state
    the invitee reaches (the bootstrap completes, and the removal
    takes effect on merge under 5.3's eviction — never a
    retroactive bootstrap failure), and a **re-admission** after
    the removal with fresh consent (X is a member again, and the
    re-welcome for the current epoch verifies). Failure on (ii) is
    handled exactly like failure on (i) or (iii): that candidate's
    provisional state wiped, surfaced, buffered candidate checked
    at once;
    **digest isolation (B4):** two geneses G₁ and G₂ under **one**
    group DID (3.2), exercised with one party in common —
    *candidate slot and window*: the same invitee holding invites
    into both bootstraps both, each with its own active
    provisional candidate and its own `provisional-window`;
    neither candidate displaces the other, and G₁'s window
    expiring wipes nothing of G₂'s; *key-service slot*: the same
    requester's authenticated requests into both fill two slots
    with two independent deadlines, and discharging G₁'s neither
    empties nor extends G₂'s; *rate limit*: G₁'s
    `key-request-interval` budget, and a service's presentation
    rate limit for G₁ (7.3), never throttle G₂; *completed
    effect*: dispositions and displaced-candidate records are held
    per digest, so a `duplicate-known` in G₁ never suppresses a
    first surfacing in G₂. Every one of these keyed by group DID
    instead is the regression check — the sibling-genesis
    interference 3.2 forbids.
- Every normative statement is vector-testable or explicitly
  state-dependent — the state-dependent set is named: signal
  dispositions, remediation and key service duties (helper
  reachability included), teardown, and the adapter
  confidentiality audit criteria of 9.1 — exercised with
  controlled state and clock.

- **Vector plan, M-DID-loop additions:**
  member-mapping@1 positive (both MACs against the cards named by
  `memberOp`/`toOp`, founder side via genesis) · foreign-self
  negative (card.anchor ≠ self → step 4) · wrong-group negative
  (`to` not the addressee's member anchor → step 2) · `memberOp`
  naming a non-admission or foreign admission → step 3 · `member`
  no longer a current member → step 3 · two admissions with
  different cards: mapping verifies only under the named one
  (determinism vector) · revision equivocation per (member, to) →
  step 7 · a member anchor appearing in a second group's log →
  scoping-rule vector (nonconformant at issuance) · **vouch@2
  positive** (sig under voucher, currency at position, subject =
  body.subject, genesisDigest binding) · vouch by a non-member →
  inadmissible · vouch about a different subject → inadmissible ·
  an Encounter credential presented in the vouch slot →
  inadmissible under 4.3 (its subject is a pair anchor) · vouch
  self-vouch (voucher = subject) → inadmissible (currency
  excludes a candidate subject, 4.4) · duplicate vouchers →
  counted once (distinctness) · founder `refresh` via genesis
  (M8) → entitled and served · founder anchor equal to any
  `group/<digest>` context of the same genesis → genesis invalid
  (3.4.1) · candidacy carrier: authority never from Layer-4
  content (a member.add citing only the candidacy surface fails
  materialization).

## 15. Open Issues

- **OI-1 Sibling-epoch merge** — now explicitly also the
  boundary of the recovery guarantee: an insider can pair a
  garbage distribution with a sibling transition and force the
  forked state, so the exit from a key-void is guaranteed only in
  a fork-free log until OI-1 resolves. Causal epoch DAG with conflict
  keys (the BeeKEM direction) versus deterministic winner plus
  re-rotation. The forked state (3.6) and the view divergence
  handling (7.3) are its boundary and hook; the port keeps the
  resolution adapter-shaped.
- **OI-2 Threshold proofs (FROST).** Collapses policy proofs and
  view quorums to single group signatures; DKG/resharing on
  membership change; external indistinguishability.
- **OI-3 Group identifier migration** (legacy UUID spaces →
  genesis digests; alias discipline).
- **OI-5 Encounter-presentation minimal disclosure.**
- **OI-7 Member-identity model** — **settled by the M-DID loop:**
  per-group member identity (5.1), the founding occasion
  registered in Identity 0.12, and the verifiable link is
  `member-mapping@1` (5.5) — designated-verifier by design.
  Method agnosticism beyond `did:key` remains open.
- **OI-10 Shrink-robust policy forms** (relative thresholds;
  recovery from constitutional lock above emptiness).
- **OI-12 Grantable capabilities and their exercise.** Grants,
  attenuation, revocation of grants, non-member read/relay
  exercise toward services, and identity-set hiding schemes (the
  withdrawn 0.3 commitment/token machinery is the ancestor
  design). Blocked on a sound exercise mechanism; nothing in 0.12
  licenses an interim one.
- **OI-13 The membrane.** Group-issued outward credentials
  (membership credentials, personhood projection) need a closed
  credential profile — body, group-signature mechanism after
  root-key destruction, claims discipline — before a
  `credential.issue` operation returns to the catalog.
- **OI-14 Large groups — and the over-ceiling residual.** This
  profile bounds admission at 4096 members (5.3) and sizes every
  membership-scaled wire cap at 8192 — twice the bound — so
  merged overshoot stays schema-valid. Membership beyond the
  ceiling is not prevented by any merge mechanism (3.6: every
  mechanism examined — displacement, deferral, a fold-order
  cap — was rejected as a grindable, revisable who-decision);
  it is a named degraded state: unconstructible
  membership-scaled artifacts, recovery by attrition, the
  attack priced and attributable. Groups that genuinely need
  more than 4096 members need a successor profile with chunked
  or accumulator-based artifacts (the same succinct-membership
  direction the withdrawn commitment machinery gestured at,
  OI-12); until it exists, the bound, the ceiling, and the
  degraded state between them are the honest, enforced limit
  rather than an unstated assumption.
- *(Cross-document debts — **discharged in Membership 0.9**
  (see that document's §9); retained here as the record of what
  Access 0.24 owed its companion at casting time: adopt the
  MO-4 material pin and update its §4/welcome-schema prose — 9.5;
  align its "identified by its group DID" terminology and its
  per-group keying — pending stores, evidence authorization —
  with the genesis-digest identity of 3.2, whose value is
  computed over the proof-free signature input (its §3.1
  "multihash of the genesis operation" needs that scope); adopt
  admission rule 0 and the same-subject arbitration set of 5.3
  (its §3.3 arbitrates same-accept candidates only) and the
  `genesisDigest` cross-binding of rule 2; update its Access
  references from draft 0.3 and its service pointer from Access
  §10 to §7.3; align its §1.2 flow wording ("fresh card") with
  the live-key rule of its own §2; add the transport-budget
  vector — a boundary-crossing admission with a transported
  variant proof at the caps of 5.3, nominal enclosed documents,
  and the welcome fits its §2 plaintext budget, and the
  maximized-document shape falls back to the self-contained
  re-welcome path (5.3) — **and name that fallback in its §3.3**
  (where the full boundary-crossing admission cannot fit the
  carrier, the re-welcome travels instead and case-1 semantics
  apply, 10.1); **retire §3.3 case 2** — the removal
  notice travels as this layer's registered `removal-notice/0.1`
  task (10.2), and `access-operation/0.1` stops carrying
  transition-bearing envelopes (5.3's boundary rule; its payload
  schema tightens the enclosed proof to 64 signatures /
  16 credentials for the admission case). (No admission-state
  change is
  owed: under 3.6's merge-finality rule, "membership stands upon
  a canonical admission" holds literally.) **Tracked for
  Encounter 0.20:** `maxLength` on the credential proof's
  `proofValue` and a precision bound on `proof.created`, so the
  2048-byte transported-credential cap of 5.3 is guaranteed at
  the source instead of enforced only at this layer's
  acceptance. Until then this layer
  requires of its own implementers: key all group state by
  genesis digest. Resolved elsewhere: delivery envelope by the
  Delivery Contract (0.22); policy-proof transport and
  leave/dissolve notices are Membership MO-2 and MO-3.)*

## References

[RFC2119] · [RFC8174] BCP 14 · [RFC8785] JCS · [RFC9420] MLS
(epoch terminology) · **RLTP Encounter Layer 0.28**, wire 0.25 (securing
profile 2.3, contact card §6, credentials §7, evidence direction
§4.2) · **RLTP Delivery Contract** and **RLTP Membership Tasks**
(the companions of this loop's joint casting: document profile,
sealed envelope, dispositions; document shapes §3, welcome seal
§4, timing §5) · **RLTP Network Visibility 0.15** (§2.1 wire
conventions, §3 audience classes, §6 mapping construction, §6a
convergence net, §8 introduction act) · W3C
Verifiable Credentials Data Model 2.0 · Keyhive / BeeKEM design
documents (causal encryption; ePrint 2026/1434) · p2panda-auth
documentation (resolver model)
