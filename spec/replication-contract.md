# RLTP Replication Contract

**Real Life Trust Protocol — service contract: Replication**

- **Status:** Editor's Draft, **converged** (joint review rounds 24
  and 25 blocker-free)
- **Version:** 0.26.0-draft (twenty-sixth casting — the
  **receipt cut**, the loop's fourth architectural cut, on the
  editor's decision 2026-08-26: the acceptance-receipt and
  generation-statement machinery is removed on the Access side
  (Access 0.52); this contract's receipt clauses (I9, Section 6,
  Section 11, Section 13) follow; the two-way acceptance anchor
  carries alone and the CAS commit stays)
- **Editors:** Anton Tranelis
- **Date:** 2026-08-26
- **Vocabulary namespace:** `https://real-life.org/rltp/v1`
- **Conformance profile:** `rltp-replication@0.26` (draft)
- **Companion pins:** Access Layer 0.52 (wire 0.24; registration
  artifact 0.26) · Identity Layer 0.12 · Delivery Contract 0.22 ·
  Membership Tasks 0.16 · Encounter Layer 0.28 (wire 0.25)
- **Supersedes:** 0.25 (archived,
  `spec/archive/replication-contract-0.25-redaktionsguss.md`;
  every earlier casting alongside)
- **Position:** not a layer. Replication is the service behind the
  port the Access Layer requires (Access §10); every layer may use
  it, none depends on its internals.

## Abstract

This document specifies how replicated group state travels between
the replicas of its members. The replication service converges
**individually signed, causally linked entries** — idempotently,
gaplessly relative to an attested target, never silently diverging
where evidence has met — and promises **convergence over entries,
never readability of content**. It is key-blind by construction:
no secret material crosses its port, no promise requires
plaintext, and the substrate that moves the bytes stands outside
the trusted computing base.

Two entry profiles travel through the port (3.4): the **authority
entries** of the Access Layer's operation envelope, and **content
entries** under this contract's signed public header — the
artifact-shaped authentication the previous generation's
channel-gated model lacked. The contract is sixteen promises
(I1–I16, Section 5), each stated with preconditions, outcomes from
one shared algebra (4.3), and a counter-vector. Around them: the
port line (Section 3), attested convergence targets with per-source
consistency chains (Section 4), sessions and the evidence session
(Section 6), one ingest admission for every road — immutable
verdicts below merge-revisable dispositions, and the rule that
**canonicality is never attested, only computed** (Section 7) —
the reader-state vocabulary (Section 8), adapter registration
(Section 9), and the candidate map (Section 10).

## Status of This Document

This is an **Editor's Draft** with no standing beyond its own
argument. Its requirements are the decision record of the
port-contract pair
(`design/portvertrags-paar-entscheide-2026-08.md`, Revision 2),
distilled from roughly 120 field issues of the deployed
previous-generation implementation; field provenance per promise
is collected in Appendix B.

The contract **converged on 2026-08-26** after twenty-five
adversarial review rounds — four against this document alone, then
twenty-one jointly with the Access Layer (castings 0.31–0.50) and
the Delivery Contract (0.22); rounds 24 and 25 were consecutive
blocker-free rounds, satisfying the convergence criterion. Every
finding and triage lives in
`design/replication-review1…25-2026-08.md`, including the loop's
three architectural cuts: the removal of replica-side attestation
chains (replica attestation is session-scoped, 4.1), the
withdrawal of witness-free freshness claims (acceptance is
anchored in the live session, Section 11), and the demotion of
acceptance receipts to link evidence. The twenty-fifth casting was
the editorial one (substance frozen at 0.24, text rewritten); this
twenty-sixth casting is the **receipt cut** (editor's decision,
2026-08-26): the demoted receipt and statement artifacts are
removed entirely on the Access side, and this contract's receipt
clauses follow — a post-convergence substance casting whose
adversarial confirmation is recorded in the design journal. The
repository's coherence gate and conformance runner are green
against it.

## 1. Introduction (informative)

### 1.1 Essence

- **Services read no foreign truth. They are shown it, attested —
  or they do not need it.** Authorization truth reaches a service
  as a presented view (Access §7.3); completeness truth reaches a
  replica as an attested target (Section 4). Nothing is ever read
  live out of another party's replicated state.
- **Convergence is promised; readability is never promised.** The
  port moves sealed payloads and verifies structure, signatures,
  and causality. Whether a converged entry can be *read* is a
  higher layer's statement, against key material this contract
  never touches (Section 8).
- **Verdicts are artifact-shaped, never door-shaped.** The
  previous generation authenticated the *channel* (a capability
  gate at one relay); this contract authenticates the *artifact*:
  every entry individually signed, every admission field
  identity-bound. Where every road is legal — sync, delivery
  effect, import, recovery — only the artifact can carry the
  verdict; the price of that determinism is stated in Section 11.
- **Evidence flows; effect is gated.** Replication transports
  every accepted entry — divergence evidence included — to
  currently authorized counterparties. Admission and disposition
  gate effect, never the travel of proof: a group that has forked
  learns it everywhere, instead of splitting into replicas that
  know and replicas that never will.
- **Key-blind by construction** (I6). The payoff is architectural:
  relay operators, meshes, and cloud stores move sealed bytes
  without being trusted with anything; the trusted computing base
  shrinks to the enforcement adapter on the members' devices
  (Access §9.1).
- **One admission, every road** (I14) — no privileged side door,
  so no carrier ever reads types in self-defense.
- **The recovery channel is the replication channel.** A late or
  recovered replica converges from the log (I1) and rebinds by
  stable group identity (I15); nobody retains delivered mail for
  unknown future replicas, and no separate recovery service
  exists.
- **Idempotency is byte-artifact idempotency, honestly bounded.**
  Entry identity is a deterministic function of signed bytes per
  profile (3.4); `duplicate` can never mask divergent content —
  and the contract does not pretend the converse: re-sealing the
  same plaintext is a new artifact; semantic deduplication is a
  layer-above concern.

### 1.2 The two conformance classes

- A **replica** is the entry store on a member's device, below the
  enforcement adapter (Access §9). It runs the full ingest
  admission (P1, the epoch gate, P2), applies entries causally,
  and forwards only what it has durably admitted.
- A **service** is a durable, key-blind party — relay, broker,
  storage host — registered by the group under Access §7.3 (the
  `relay` role). It authorizes entry reads and writes only against
  presented views — and only the session principal, never an
  entry's writer (7.4) — and judges storage, never validity.

Adapters — bindings of substrates and transports to this port —
sit below the line and appear only through their registration
(Section 9).

### 1.3 Honest thinness: the five doors

"Thin" does not mean mechanism-free. Five doors are fixed, and
named rather than denied:

1. entries are **individually signed and causally linked** (Access
   §9.1 for authority entries; 3.4.2 for content entries);
2. enforcement operations and their epoch transitions are **atomic
   commits** with replica eviction (I4, Access §9.3);
3. authorization toward services is **view-shaped** (I7, Access
   §7.3) — chained, quorum-signed, epoch-monotone;
4. enforcement concurrency is **fail-closed** (I16, Access §3.6) —
   no winner-picking anywhere;
5. every completeness claim rides the **target-control overlay**
   (Section 4) — an adapter may reuse any data-plane sync
   (have/need, Bloom filters, gossip), carried *in addition*; an
   exchange without it is legal and yields pages, never
   convergence (4.4).

Everything below the doors is open: transport, topology, storage,
encoding, batching, CRDT or log, push or pull. Section 10 maps the
candidates against exactly these doors.

## 2. Conventions and Terminology

BCP 14 [RFC2119] [RFC8174] key words apply when, and only when,
they appear in all capitals. The **interim securing profile** of
Encounter 2.3 applies where this contract signs or hashes (Ed25519
raw signatures over JCS, SHA-256 multihash, multibase `u`
emission, RFC3339-UTC-`Z` timestamps).

**Group identity** — the genesis digest of Access §3.2; the only
group name this contract uses, never derived from key material
(I15).

**Entry** — the unit of replication, in one of two profiles (3.4):
an **authority entry** (the operation envelope of Access §3.3) or
a **content entry** (a signed public header plus sealed payload).
**Entry id** — the profile's identity: the operation id for
authority entries; the digest of the signature-less header for
content entries. **Parents** — the entry ids an entry causally
depends on; **closure** — an entry with every ancestor reachable
through parents (`closure(F)` for a frontier F: the union over its
heads). **Frontier** — a set of entry ids no other held entry of
the same scope has as parent; scopes `stored` and `admitted` are
attestable, `canonical` is local only (4.2). **Session** — one
authenticated exchange between a replica and a source (Section 6).
**Source** — the counterparty a replica converges from: a service
or another replica. **Page** — a source-delimited batch within a
session. **Run** — one identified attempt at a declared goal
(catch-up, repair, rebind), with exactly one terminal outcome from
the algebra of 4.3. **Convergence target** — the attested artifact
of 4.1. **Chain restart** — the group-authorized restart of a
*service* source's target chain after honest state loss (4.1);
replica sources have no chains, and their in-session sequence is
never called one. **Admission verdict** — the immutable per-entry
result of Section 7. **Canonicality disposition** — the
merge-revisable per-entry disposition
`canonical | forked | removed-disposed` (total order
`forked ≻ removed-disposed ≻ canonical`), computed, never
attested. **Ack receipt** — optional recoverable acknowledgement
evidence (I15). **Reader state** — the above-the-line readability
vocabulary of Section 8.

| Term | Fragment |
|---|---|
| Entry | `#Entry` |
| Content header | `#ContentHeader` |
| Frontier | `#Frontier` |
| Convergence target | `#ConvergenceTarget` |
| Chain restart | `#ChainRestart` |
| Outcome algebra | `#OutcomeAlgebra` |
| Ingest admission | `#IngestAdmission` |
| Admission verdict | `#AdmissionVerdict` |
| Canonicality disposition | `#CanonicalityDisposition` |
| Run | `#Run` |
| Ack receipt | `#AckReceipt` |
| Reader state | `#ReaderState` |

## 3. The Port Line

### 3.1 What the port knows

The port metadata of an entry is **closed** and is exactly what
its profile signs (3.4): group identity, entry id, parent ids,
profile (`authority` | `content`), the content header's `epoch`
and `writer` where the profile is `content`, size, and arrival
session. A conformant implementation MUST NOT require further
metadata for any promise, and a registration MUST NOT extend this
set with fields whose values require plaintext to produce. Every
field except size and session is identity-bound — covered by the
entry's signature and, signature bytes themselves excepted
(3.4.2), by its id — so the same signed content can never be
presented with different metadata.

### 3.2 What the port never knows

No persons, no devices, no document types, no group membership of
its own reading, no keys, no payload plaintext. Normatively:

- no promise may be implemented by reading replicated state that
  belongs to another party's authority — membership truth reaches
  a service only as a presented view (I7), never by inspection;
- the port performs **no unsealing and no derivation of secret
  material**, and **private keys MUST NOT cross the port in either
  direction** (I6); public-key operations — verifying signatures,
  computing ids, comparing digests — are duties, not violations;
- **no carrier reads payload types**: type dispatch is the
  receiving replica's admission (Section 7) and Delivery's
  receiver pipeline (Delivery §6.2), never transport self-defense.

### 3.3 Where the keys live instead

Where the Access Layer put them: in the enforcement adapter as
named trusted computing base (Access §9.1, P4) and in the pull
path `key-delivery/0.1` (Access §10.1). Epoch transitions commit
key material **by digest** (Access §7.1); the sealed envelopes
travel as delivery documents, separately repairable under the key
service duty (Access §5.3). Delivery transports no authority
disposition — but it does transport that disposition's
digest-bound, separately repairable key material. The replication
port sees neither; it replicates the transition entry like any
other entry.

### 3.4 The two entry profiles

#### 3.4.1 Authority entries

The operation envelope of Access §3.3, transported with its
**signature input unmodified** (Access §9.1). Port metadata
derives from the envelope; the entry id is the **operation id**
(computed over the proof-less signature input).

**Identity and proof are separate.** The `proof` field is the
deliberate exception to immutability (Access §9.1): a **mutable
evidence accumulator**, maintained per Access §3.3's canonical
merge. Normatively:

- on **every** arrival — first or repeat — the arriving proof
  evidence merges into the held accumulator *before* any verdict
  is read or recomputed; deduplication by operation id suppresses
  re-application of *effect*, never the merge;
- an operation whose held proof does not yet satisfy its rule is
  not terminally invalid: it is held as incomplete evidence
  (verdict `missing-closure`, 7.1 — the same held, healable class
  as an absent parent), recomputed on every merge; two
  individually insufficient proof variants MUST become valid when
  their union satisfies the rule;
- terminal `invalid` is reserved for defects no evidence can heal:
  malformed envelope, failing signature bytes, an ancestry rule
  violation (Access §§3.4, 5.3).

#### 3.4.2 Content entries

A **public signed header** plus a **sealed payload**:

```
header = {
  "v":             "rltp-replication-content/0.26",
  "group":         <genesis digest, canonical u form (Access §3.2)>,
  "parents":       [ <entry id>, … ],
  "epoch":         <integer>,
  "writer":        <the writer's member identity for this group
                    (Access §5.1 — the per-group member anchor)>,
  "payloadDigest": <multibase multihash over the sealed payload
                    bytes>,
  "sig":           <signature under writer over JCS(header) with
                    sig omitted>
}
```

- **Identity:** the entry id is the multibase multihash over the
  UTF-8 bytes of `JCS(header with sig omitted)` — the
  **signature-less** header. Signature bytes are excluded from
  identity for the reason Access §3.2 excludes them from every
  identity: a signer can produce many valid signatures over one
  input, and an id covering them would let one author mint
  unbounded ids for identical content. `sig` authenticates exactly
  the id input; it never contributes to it. Two arrivals of one
  header under different valid signatures are one entry
  (`duplicate`; the first verifying signature suffices — nothing
  about the entry depends on which). Via `payloadDigest` the id is
  transitively bound to the sealed payload bytes; via the header
  it binds group, parents, epoch, and writer — no metadata
  equivocation is representable. **Idempotency scope, stated
  honestly:** this is byte-artifact identity; re-sealing the same
  plaintext yields a new entry, and the port neither detects nor
  promises semantic equality (I6 forbids it the means).
- **Writer:** the per-group member anchor that already exists in
  the stack (Access §5.1) — no new identity class. The signature
  MUST verify under it. The `writer` field is judged **only by
  replicas** (7.1 step 4); it is never a service's concern (7.4) —
  a service cannot know it (the member↔service-identity mapping is
  deliberately inside the encrypted log), and an authorized
  replicator forwards entries signed by others as a matter of
  course.
- **Epoch binding:** `epoch` MUST equal the epoch materialized at
  the entry's causal position — the newest transition in its
  ancestry closure. A mismatch is `invalid`.
- **Writer membership:** the writer MUST be a member of the state
  materialized from the entry's ancestry closure (pending exits
  included until their discharging transition, Access §5.4);
  a non-member writer at position is `invalid`.
- **Payload:** opaque sealed bytes, never interpreted by the port;
  the sealing construction is Layer-4/Access coordination terrain
  (RO-7) — the port's duties bind only header and digest.
- **Size:** bounded by the registered size bound (Section 9);
  oversize is refused at shape (7.1 step 1).

This profile is the port's transport form of content, deliberately
semantics-free: what a payload means, and how Layer 4 composes
documents from entries, lies outside — shaped so that neither
question can ever require a port change (RO-7).

## 4. Targets, Frontiers, and Outcomes

### 4.1 The attested convergence target

Every completeness statement of this contract is relative to an
**attested convergence target** — never to silence, never to local
shape, never to "the log" as an unbounded whole.

```
target = {
  "v":             "rltp-replication-target/0.26",
  "genesisDigest": <group identity>,
  "source":        <canonical source identity (Section 6)>,
  "session":       <session identifier>,
  "seq":           <integer ≥ 1: this source's attestation
                    sequence, strictly increasing by 1 within a
                    chain>,
  "chain":         <SERVICE sources only: the chain identity —
                    absent iff seq = 1 (a chain's identity IS its
                    seq-1 target's signature-input digest);
                    REQUIRED for seq > 1, equal to that digest.
                    Absent for replica sources: their attestation
                    is session-scoped (below)>,
  "frontier":      { "scope": "stored" | "admitted",
                     "heads": [ <entry id>, …, sorted by unsigned
                                bytewise order ] },
  "prev":          <digest of this source's previous target (its
                    signature input), or null iff seq = 1>,
  "keyRotation":   <SERVICE sources only; absent, or { "newKey":
                    <successor attestation public key>,
                    "crossSig": <signature under the CURRENT
                    attestation key over the UTF-8 JCS bytes of
                    { "v": "rltp-replication-keyrotation/0.26",
                      "genesisDigest", "source", "seq", "prev",
                      "newKey" } — domain-separated and
                    chain-bound; a bare-key signature is not a
                    rotation> } — the next target verifies under
                    newKey; the chain continues>,
  "registrationCore": <SERVICE sources only, REQUIRED there: the
                    current registration generation's
                    registrationCoreDigest (Access §7.3) — binds
                    every target to the generation that authorizes
                    its attestation key>,
  "restart":       <SERVICE sources only; absent, or — only with
                    seq = 1 and a fresh group re-registration —
                    { "lastKnown": <digest of the last retained
                       own target's signature input, or null> }>,
  "sig":           <signature over JCS with sig omitted, under the
                    source's attestation key>
}
```

**Attestation rule.** The signature input is canonical as given;
the attestation key MUST be cryptographically bound to the source
identity of Section 6 — for a **service** source additionally
stable across sessions, so cross-session equivocation is provable
(a replica source's key is its member identity, and its
attestation is session-scoped: no cross-session duty exists or is
claimed). Wire encodings are adapter-named (Section 9); the
fields, the signature input, and the bindings are normative
regardless.

**Scope honesty — canonicality is never attested.** A key-blind
service attests `stored` — it cannot judge admission and MUST NOT
claim it. A replica source attests `admitted`. No source attests
`canonical`: canonicality is a merge-revisable local disposition
(7.1, I16), and attesting it would be falsified by the next
arriving sibling. Both attestable scopes are grow-only, so the
consistency duty below is satisfiable forever. A consumer judges
`reached` against what the scope can promise: a `stored` frontier
may contain entries that fail admission — that outcome is
`unadmissible(set)`, never equivocation (4.3).

**The consistency chain (service sources).** Within a chain, `seq`
increases by exactly 1 per attestation and `prev` links the
predecessor; a source MUST only attest extensions
(`closure(heads_n) ⊇ closure(heads_{n−1})`) on its own attested
scope. **Chain durability is a service duty:** chain state (last
seq and digest) lives within the same durability boundary as the
attested entries (I9) — losing one means losing both. **Key
rotation is in-chain, never a restart:** the current key
cross-signs the successor inside a chained target (`keyRotation`),
and the chain continues under the new key; a claimed rotation
without the cross-signature is not a rotation — **no
self-assertion ever changes a verification root**. A source that
lost its current key has lost chain continuity and takes the
state-loss path.

**State loss ends continuity — only the group restores it (the
SERVICE rule).** This whole paragraph binds service sources only —
the asymmetry is honest and structural: a service's verification
root is a bindable key that can be lost or rotated, so only the
group can restore it, while replica sources have no chain state to
lose (below). A service source cannot shed attestation duties by
declaring loss (the
Certificate-Transparency doctrine: an append-only log does not
drop its obligations by self-declared reset). Without its chain
state a source MUST stop issuing targets; toward consumers the
observable state is `target-chain-unavailable` (4.3 — deliberately
claiming only what a consumer can see: no **class-valid** target
was obtainable — valid under its source class's continuity rule:
chain-valid for a service; signature-, session-, and
in-session-sequence-valid for a replica — whether by partition,
withholding, or loss); unattested pages stay legal (4.4). Target
issuance resumes **only through a fresh group registration**
(Access §7.3 — since Access 0.31 a first-class act: the
generation-g+1 registration with `previousRegistration` digest,
quorum-bound `authorizationRoot`, and fresh `attestationKey`,
artifact 0.26); the first post-rebind target carries `seq = 1` and
the `restart` marker. Supersession is thereby **evidence, not
inference**: a held generation-g+1 registration proves the old
chain's standing ended; targets verify only under the current
generation's attestation key — which also heals a **stolen**
attestation key (the group rebinds; the thief's chain keeps
evidence value and loses standing; the window until the rebind is
a named residual, Section 11). Consumers judge ack evidence (I15)
against old and new chains together. A re-registration does not
launder equivocation: the old chain's artifacts remain evidence,
and a source "restarting" while demonstrably continuing its old
chain elsewhere has equivocated.

**Replica sources carry no chains — their attestation is
session-scoped, and that is the architecture, not a gap:** several
replicas of one member authenticate under the same member identity
(no per-replica identity exists in this stack), so a cross-session
chain would have no bearer and would convict two honest devices of
one member as "equivocators" — the honest-parallelism class the
field taught us never to criminalize. A replica target binds
`(source, session, seq within the session, frontier)`: within one
session seq is strictly increasing, and supersession and
equivocation are judged exactly as for services; **across sessions
a replica claims nothing, and no consumer may derive a
cross-session consistency claim from replica targets** —
`reached(F)` verdicts are per-target and stand as ever. Durable,
chain-bound, generation-rebindable attestation is deliberately the
**registered service source's** job — that is what the
registration machinery exists for; a member device MAY register as
a service, thereby accepting the full service rule set. Generation
outcomes exist for service sources only.

**Equivocation, split by source class.** Service: two live chains
without an intervening re-registration, or two distinct targets
claiming one `(source, group, chain, seq)`. Replica: exactly two
distinct targets of one `(source, group, session, seq)` or an
in-session regression — **never** two targets from different
sessions (two honest devices of one member).

**What the chain gives — and what it does not.** Where two
artifacts of one source meet — in one replica, or between replicas
that compare — equivocation is **provable** from the artifacts
alone, and the proof transports; replicas MAY exchange held
targets of a shared source at any time, by digest, no trust
required (a closure-regression proof additionally requires holding
the regressed entries). What the chain does **not** give is
guaranteed detection: comparison is opportunistic, and mandatory
witness or gossip duties are deliberately deferred (RO-8).

**Supersession and no-vacuum.** A later target of the same chain
(or session) supersedes an earlier one without retroactively
invalidating any verdict — `reached(F)` remains true for `F`
forever; the world has merely moved on. Absence of a target
licenses no completeness claim of any strength.

### 4.2 Frontiers: two attestable, one local

- `stored` — heads over everything held, verdicts unknown (the
  only scope a service can compute); grow-only.
- `admitted` — heads over entries with verdict `accepted`,
  dispositions irrelevant (forked entries are admitted evidence);
  grow-only. **The admitted closure is the transport plane:** sync
  plans (I11) and repair run over it, which is what makes fork
  evidence flow (I16).
- `canonical` — a local, never-attested frontier: heads over
  entries `accepted` and disposed `canonical`. It exists for
  surfaces and effect-gating (7.1 step 6), shrinks when a fork is
  detected, and is nobody's promise to anybody.

Every promise names the scope it binds; an attestation names its
scope; an implementation MUST NOT substitute one scope for
another.

### 4.3 The outcome algebra

One algebra serves every goal (catch-up I1, repair I12, rebind
I15). It is a **tagged sum**: common variants any run can produce,
plus goal-specific variants; a goal produces exactly its listed
variants, nothing else.

**Common variants:**

- `denied` — authorization refused (I7);
- `source-equivocation(evidence)` — the source provably
  equivocated (4.1); fail-closed toward this source, evidence
  retained and transportable;
- `unadmissible(set)` — the source delivered the named entries,
  but they fail admission; attributable to the writers, never the
  source (expected against `stored`-scope sources);
- `missing(set)` — the run terminated (by requester decision or
  declared horizon) with the named entry ids still absent;
- `unresolved(set)` — the horizon ended with the named entries
  **held but unhealed** (`missing-closure`: absent parents or
  insufficient proof) — distinct from `missing` (absent) and from
  `unadmissible` (terminally invalid); the held evidence stays,
  healable as ever;
- `source-ended-before(goal)` — the source ended the session
  before the goal was served;
- `target-chain-unavailable` — only for target-requiring goals
  (catch-up, rebind; never repair): the run ended without
  obtaining a class-valid target from this source (partition,
  withholding, and state loss deliberately indistinguishable; a
  held superseding registration additionally *proves* the old
  chain's standing ended, 4.1);
- `aborted(reason)` — locally ended; `reason` from the adapter's
  registered closed reason set (transport failure included).

**Goal successes:** catch-up `reached(F)` · repair
`repaired(set)` · rebind `rebound-and-reached`.
**Rebind-specific** (I15): `source-auth-failed` ·
`entry-not-in-closure` · `conflicting-sources`.

**Precedence (normative, total).** Two steps. **Step 1 — success
test:** a run terminates in its goal's success variant iff its
goal set is fully achieved (catch-up: the target closure admitted;
repair: the named set admitted; rebind: rediscovered sources
reached and, where evidence was presented, the evidence check
passed) **and** no failure condition of step 2 holds *within the
goal set*. **Scope rule:** source- and chain-level conditions —
`source-equivocation`, `target-chain-unavailable`, `denied` — are
**always run-global**: they concern the run's source or target and
are never "outside the goal set"; only entry-level conditions
scope to the goal set — an unadmissible or unhealed *extra* entry
the source volunteered, or a fault after achievement, never
displaces success (it stays a per-entry verdict and, where
evidence-grade, retained evidence).
**Step 2 — failure order:** otherwise the first applicable of
`source-equivocation` ≻ `denied` ≻ `unadmissible` ≻
`conflicting-sources` ≻ `entry-not-in-closure` ≻ `missing` ≻
`source-ended-before` ≻ `unresolved` ≻ `target-chain-unavailable`
≻ `aborted`. Disambiguations: `target-chain-unavailable` is the
run-global pre-emptive outcome whenever no class-valid target ever
defined the run's goal closure (entry-level outcomes apply only
against a defined goal set); `source-ended-before` applies only
when the source ended the session before serving the goal; a run
the requester ends, or that exhausts its horizon, with the source
still available, terminates `missing`; `aborted` applies only when
nothing above it holds — a local transport fault concurrent with
proven equivocation terminates `source-equivocation`.

**Retryable states and evidence-driven termination** (samplable
per I8, never terminal, never silent): `awaiting-source` (source
unreachable; retry scheduled or offered) · `awaiting-evidence`
(held incomplete evidence, 7.1). A retryable state ends the moment
higher-grade evidence decides the run: proven equivocation
terminates an `awaiting-source` run immediately — waiting never
outranks proof.

### 4.4 The unattested exchange profile

An exchange without attested targets — plain gossip, opportunistic
peer sync, a data-plane protocol on its own — is **legal**. It
yields pages and admitted entries; **it declares no goal, is no
run, and produces no outcome of 4.3 at all** (local exchange
failures are an implementation surface). The distinction to 4.3's
pre-emptive outcome is the declared goal: `target-chain-
unavailable` exists exactly for the goals whose definition
requires a target — catch-up and rebind — when the run requests
one and never obtains a class-valid one; repair needs no target
and never produces it. This is the honest home of classical
local-first sync engines below the target-control overlay (door
5).

## 5. The Sixteen Promises

Each promise: the normative statement, its conformance class,
preconditions, outcomes (from 4.3 where the promise is a goal),
and at least one **counter-vector**. Field provenance: Appendix B.

### 5.1 I1 — Catch-up

**Promise.** A replica that appears late — a new device, a
recovery, a long-offline peer — converges against an attested
target from the log itself. No party retains delivered mail for
unknown future replicas, and no catch-up promise rests on retained
delivery documents.

**Class.** Replica (consumer); source duty on both (serve the
closure of what you attested, to authorized requesters, per I7).

**Preconditions.** An authenticated session; an attested target.

**Outcomes.** `reached(F)` plus the common variants, under 4.3's
precedence. Both source classes can satisfy this promise: a
replica's in-session target grounds `reached` exactly as a service
chain does.

**Counter-vector.** Source S serves a closed page up to head H and
ends the session; no target was presented. Conformant: a delivered
page and **no** catch-up outcome (4.4). Reporting `reached` on
this trace is nonconformant — "from the log" is not a completeness
bound; the target is.

### 5.2 I2 — Causal application

**Promise.** No epoch-N content is applied, forwarded, or exposed
to a reader before the epoch-N transition is canonically applied.
In the DAG model this is causality, not a special rule: an epoch-N
entry causally descends from the epoch-N transition (3.4.2),
admission requires the closure (I14), and application follows
causal order under the deterministic ready-set evaluation of 7.2.

**Class.** Replica. **Preconditions.** Admission per Section 7.

**Outcomes.** An entry is applied at a position where its full
closure is applied, or held `missing-closure` — never applied
ahead of its causal past.

**Counter-vector.** A page contains `[E, T]` in wire order, where
content entry E depends on transition T. Conformant: the page
evaluates as one ready-set, T then E (or E held `missing-closure`
only if T is genuinely absent). Nonconformant: applying or
surfacing E before T on any evaluation order, or a side buffer
releasing E without re-entering admission.

### 5.3 I3 — Run/outcome pairing

**Promise.** Every run reaches **exactly one** terminal outcome —
under overlap, error, and crash-and-restart. Normative trigger:
**every catch-up, repair, or rebind performed through the port
creates a run record** — there is no unreported mode. A record
carries a fresh run id, the goal, its run key, its target (where
one exists), its current state, and its terminal outcome. The run
key is `(goal, group, source)`; for rebind, `source` is the
`sourceSetDigest` — the multihash over the sorted set of the run's
discovered source identities. Overlapping runs terminate
independently; a crashed run is terminated `aborted(crash)` by its
successor's recovery, never silently absorbed. Records are
retained at least until superseded by a later run of the same key
**and** at least the adapter's declared minimum retention.

**Class.** Both. **Preconditions.** None — the trigger is the
operation itself. **Outcomes.** The algebra of 4.3.

**Counter-vector.** Two catch-up runs against different sources
overlap; the first completes `reached(F₁)`, the second crashes.
After restart the run records show both terminals (`reached(F₁)`,
`aborted(crash)`); one combined outcome, a run without record, or
a started run without outcome after restart is nonconformant.

### 5.4 I4 — Commit-before-forward and replica eviction

**Promise.** What Access P2 requires (Access §9.3), as three
separable assertions — with the division of labor named: the
**store** carries artifact atomicity, the **enforcement adapter**
carries the key world, P2 binds their composition:

1. **Commit:** an enforcement operation and its epoch transition
   are one committable artifact in the replica's store — no
   observable state in which the authority claim holds without the
   transition or the reverse. (The committed key world is the
   adapter's P2 duty; this store never holds key material.)
2. **Forward gate:** a replica forwards an entry only after its
   own durable (I9) admission — commit-before-forward. Forwarding
   of admitted entries is evidence transport and includes
   forked-disposed entries (I16); what requires canonicality is
   *effect* (7.1 step 6).
3. **Eviction:** replica-side, once a removal is **canonically**
   committed, the forwarding gate stops serving the removed
   member's replicas; service-side, eviction is enacted by the
   next presented view (I7). In the forked state there is no
   canonical commit and no eviction on either sibling's claim
   (I16).

**Class.** Replica (1, 2); both (3). **Preconditions.** Admission
of the enforcement artifact.

**Outcomes.** For any crash point: after restart the whole
artifact is durably applied or none of it; no counterparty ever
received an entry its sender had not durably admitted.

**Counter-vector.** A replica applies a removal, crashes before
the transition's commit, restarts, and serves pre-removal
descendants to the removed member's replica. Conformant: the
artifact is atomic — after restart both halves hold (the gate
blocks) or neither does (nothing claims the removal happened). An
implementation observable in the half-state is nonconformant.

### 5.5 I5 — The convergence predicate, three-staged

**Promise.** Convergence is a three-stage predicate over entries,
always relative to an attested target and always naming its
frontier scope:

1. **locally read** — admitted into the local store;
2. **page delivered** — a source-delimited page arrived complete;
3. **gaplessly converged** — `reached(F)`: the target frontier's
   closure admitted, no gaps.

Readability is **never** a stage and MUST NOT be inferred from any
stage (Section 8); neither is canonicality — stage 3 is a
statement about the admitted closure; what is canonical within it
is the local disposition. Later targets supersede without
retro-invalidation (4.1).

**Class.** Replica. **Preconditions.** Stages 2–3 require page
delimiters, respectively the target. **Outcomes.** The three
stages as samplable state, each relative to
`(source, session, frontier)`.

**Counter-vector.** A replica holds a contiguous chain to head H,
sees network silence, and reports "fully synchronized" without a
target — the field's false `complete: true`, nonconformant.
Equally nonconformant: deriving "readable" from stage 3, or
treating a `stored`-scope attestation as an `admitted` one.

### 5.6 I6 — Key-blindness

**Promise.** No unsealing, no derivation of **secret** material;
private keys never cross the port in either direction; no promise
requires payload plaintext. Public material is untouched:
verifying signatures, computing ids, comparing commitments and
digests are port duties.

**Class.** Both, and every adapter. **Preconditions.** None — an
unconditional prohibition.

**Outcomes.** An **audit criterion** of the conformance class
(Section 13), deliberately excluded from I8's samplable set. Its
checkable core: no API of a conformant port accepts or returns
private key material, and no port metadata field requires
plaintext to produce.

**Counter-vector.** An adapter that "optimizes" catch-up by
unsealing entries to deduplicate semantically, or a sync request
carrying a content key so the service can filter — nonconformant
by construction, whatever the runtime behavior; the vector class
is an audit finding, not a trace.

### 5.7 I7 — Authorization only against the presented view

**Promise.** A service authorizes **entry reads and writes**
exclusively against the presented authorization view, under the
**complete** duty set of Access §7.3, incorporated by reference:
registration with exact-byte service identity, seq/prevView chain
verification, quorum-intersection signatures, epoch monotonicity,
the freshness window on both ends, challenge-based possession
proof under derived identities, and the divergence obligations
(never a winner-picker; the evidence contract; the anchor
ratchet). What it authorizes is the **session principal**
(Section 6) — never an entry's writer. An expired or inconsistent
view is **fail-closed for entry reads AND writes** — while the
control plane stays open exactly as Access §7.3 obligation 5
commands: valid view presentations — ordinary, divergent, and
reconciliation — MUST go on being admitted even while the service
is fail-closed for entries, or divergence could never heal.
Between replicas, authorization derives from each side's own
materialized membership at its current head (P1), fail-closed
under the forked state.

**Class.** Service (view path); replica (peer path).
**Preconditions.** Registration; respectively an authenticated
member identity.

**Outcomes.** Per request: `authorized` · `denied(no-standing)` ·
`fail-closed(stale-view)` · `fail-closed(divergence)` ·
`fail-closed(forked)` (**peer path only** — a blind service never
produces it, 7.4) — a closed set; verdicts carry no information
beyond themselves.

**Counter-vector.** A member removed in epoch N+1 requests a full
catch-up read while the service's newest view (epoch N) is past
`validUntil` — serving it because "reads are harmless" is
nonconformant. The mirror: refusing a valid reconciliation view
"because fail-closed" is equally nonconformant (obligation 5).

### 5.8 I8 — State, not edge

**Promise.** The promised conditions are exposed as **idempotently
samplable state**, and the set is enumerated: per-target
convergence stages (I5), per-entry admission verdicts,
dispositions, and entry states with their per-arrival projection
(I14), run records and the retryable states (I3, 4.3), durability
states (I9), the forked condition and its materialization surfaces
(I16), continuity state of held source chains (4.1), and — where a
consumer surfaces readability — the reader states of Section 8.
(I6 is excluded by design: an audit criterion.) Every sampled
value is **evidence-determined and stable absent new evidence** —
a function of held evidence, never of having observed a
transition; re-sampling without new evidence never changes the
answer. Transitions are closed per field: verdicts only
`missing-closure → accepted | invalid`; dispositions
`canonical → forked` on sibling admission,
`forked → removed-disposed | canonical` only through
reconciliation (RO-1, re-evaluated against the reconciled DAG),
`removed-disposed → forked` when an enclosing fork arises, and
`canonical ↔ removed-disposed` exactly per Access §3.6's rule-(c)
evaluation point and d′ fixpoint; run states `running →` one
terminal; durability `written → durable → offered`. Events MAY
exist in addition; no promise is discharged by an event alone. A
consumer that missed every event still reads the truth, after
restart included.

**Class.** Both. **Preconditions.** None. **Outcomes.** The named
query surface itself.

**Counter-vector.** `reached(F)` signaled once on a callback; a
consumer attaching later (or after restart) finds no sampling
surface returning it and re-triggers a full catch-up. Any design
in which sampling and event disagree, in which the truth is only
in the event, or in which a sampled field transitions outside its
closed set, is nonconformant.

### 5.9 I9 — Transaction-bound durability

**Promise.** Three states, never conflated: **written** (inside an
open local transaction), **durable** (that transaction committed
to the registered durable store), **offered** (made available
beyond the replica). Every durability gate binds to the **concrete
transaction** it gates — never a global flush flag, a timer, or an
unrelated commit. Transitions: written → durable → offered; a
crash rolls back to the last durable state, and nothing reported
`durable` is ever lost by a later crash. A SERVICE source's
target-chain state lives inside this same boundary (4.1), the
atomic acceptance commit of Access §7.3 included. Replica sources
hold no chain state.

**Class.** Both. **Preconditions.** The registration names the
durable store and its crash model. **Outcomes.** The three states
per entry or page (I13), samplable.

**Counter-vector.** `durable` reported when the write buffer
reaches the storage engine but before its transaction commits; a
crash loses the entry while a counterparty already advanced its
frontier accounting — the field's acked-but-lost class,
nonconformant.

### 5.10 I10 — Local truth never replicates

**Promise.** Local by contract — never written into replicated
state, in any encoding, by any party:

1. reader states and readability verdicts (Section 8);
2. convergence verdicts, targets, and run records (session- and
   source-relative);
3. transport and delivery status, retry and scheduling state;
4. local store namespaces, device-scoped identifiers, anything
   scoped to one installation;
5. admission verdicts and dispositions — a verdict travels as
   recomputation under P1 (every replica re-judges identically),
   never as data;
6. the local clock and any arrival-time observation (a replica MAY
   hold and surface arrival-time knowledge locally — "arrived
   after the removal was known here", Section 11 — never replicate
   it, never let it touch a verdict).

**Class.** Replica. **Preconditions.** None. **Outcomes.**
Structural: no admitted entry carries state of these classes.

**Counter-vector.** Replicating "device X has read up to seq N"
into group state to drive another device's UI — a second,
conformant implementation does not, and the two now disagree about
replicated content on identical input. The field's device-table
coupling class.

### 5.11 I11 — Retry authority lives in the durable log

**Promise.** The durable log **is** the send-truth. The send set
toward a counterparty is a defined DAG operation:
`closure(admitted frontier_local) ∖ closure(F_counterparty)` — on
the **admitted** scope: forked- and removed-disposed entries are
included, because divergence and disposition evidence must reach
every replica (I16; commit-before-forward gates
forwarding-as-authority, never the travel of proof, Access
§3.6/§5.3). **Bounded by the evidence authorization of Access
§3.6:** the peers entitled to evidence are the members of the
maximal unforked prefix's materialization (equivalently, under an
undisputed removal: the current members) — the forked state can
never starve its own cure, and the evidence session of Section 6
makes the path executable. A member canonically removed within
that prefix stays excluded: to a removed peer nothing causally new
travels after the removal, evidence included (I4).
`F_counterparty` is, for a service, the newest attested target
held from it — and for a **replica** counterparty **only a target
of the currently authenticated session**: a target from another
session of the same member identity is never this device's
possession (devices share the identity; D₁'s attestation must
never shrink what D₂ is sent), and absent a current-session target
the send set is the full admitted closure. The send set is
recomputed from the durable store at any time — never maintained
as a generic outbox of queued send-intents; after any crash it is
recomputed, not replayed. Effect-gating is the receiver's
admission and disposition, never the sender's filter.

**Class.** Replica (sender). **Preconditions.** I9 durability; a
held counterparty target (absent one: full closure, convergence by
dedup).

**Outcomes.** After crash-and-restart with a counterparty at F:
the send set equals the defined difference — nothing doubled
beyond idempotency, nothing dropped, no orphaned queue intent, no
fork side withheld.

**Counter-vector.** Replica A admits sibling T₂ after attesting
heads containing T₁; peer B holds only T₁ — excluding T₂ from the
send set "because forked" leaves B permanently ignorant,
nonconformant. Equally nonconformant: the queue-as-authority
design of the field's outbox loop (queue survives a store
rollback, or dies while the store kept the entry — endless resend
or silent drop).

### 5.12 I12 — Gap repair, addressed and terminating

**Promise.** On detecting a missing dependency — a parent id
referenced by a held entry that no held entry bears — the replica
issues a **repair request**: addressed to an authenticated source,
carrying evidence (the referencing entry ids — checkable,
distinguishable from a fishing read), and **terminating**: each
run ends, within the adapter's declared `repair-horizon`, in
exactly one outcome of 4.3. Repair is re-runnable; an unreachable
source yields `awaiting-source` (samplable, never silent). A
source MUST answer a checkable repair request for entries it holds
and the requester is authorized to read (I7).

**Class.** Replica (requester); source duty on both (responder).
**Preconditions.** A named missing set; an authenticated source.
**Outcomes.** `repaired(set)` plus the common variants under 4.3's
precedence; `awaiting-source` between runs.

**Counter-vector.** Waiting unbounded and unreported for the
substrate to gossip the entry by chance — no run record, no
outcome, no samplable state — nonconformant; as are an
evidence-less request and a run unterminated past
`repair-horizon`.

### 5.13 I13 — The scale ceiling

**Promise.** Required cost is bounded per **page**, not per entry:
a conformant port interface MUST NOT require more than one durable
transaction per page (I9 at page granularity), nor more than one
request/response exchange per page beyond transport framing, nor
any per-entry round trip. Frontier comparison is per session.
Per-entry duties (ids, signatures, dedup, verdicts) remain per
entry but MAY run in batch. An implementation MAY be internally
stricter; the ceiling binds what the **contract and its interfaces
demand**, so the contract stays implementable at field scale.

**Class.** Both. **Preconditions.** Page semantics per the
registration. **Outcomes.** I9's states at page granularity;
per-entry verdicts regardless of batching.

**Counter-vector.** A registration whose port interface admits
entries only one-durable-transaction-each, or whose catch-up
forces one request per entry — the *interface* demands
super-ceiling cost, nonconformant. (An internally per-entry
implementation behind page-shaped interfaces is conformant. The
field's 8 990-key-import cold start is the neighboring lesson
**above** the line: key import is reader-side work outside this
port per I6 — noted so nobody relocates that cost into the port to
"fix" it.)

### 5.14 I14 — All-ingress admission

**Promise.** Every ingress into replicated state — network sync,
delivery-document effect, local import, snapshot, recovery —
passes the **same** ingest admission (Section 7) before any effect
or forwarding. There is no privileged road. Input forms are closed
(7.3): full entries with closure, or a registered verifiable
snapshot profile (**none is registered in this casting** —
snapshot ingest is inadmissible today). The **admission verdict**
set is closed and immutable per entry:
`accepted | missing-closure | invalid` — `invalid` terminal,
`missing-closure` provisional and healable (absent parents or
insufficient proof, 3.4.1). `duplicate` is **not** an entry
verdict but an arrival result; re-arrival never re-judges or
re-effects a held entry (idempotency, with the authority-profile
proof-merge duty). Above the verdicts sits the merge-revisable
**disposition** `canonical | forked | removed-disposed` (7.1 step
5, I16). **Effect requires `accepted` AND `canonical`; forwarding
requires `accepted`** (evidence flows, I11/I16). Two surfaces,
never conflated: the **arrival result** — per arrival —
`new(→ its verdict) | duplicate | proof-merged` (disjoint:
`proof-merged` iff the accumulator strictly grew), and the **entry
state** — per entry, evidence-determined (I8) —
`missing-closure | invalid | accepted∧canonical | accepted∧forked
| accepted∧removed-disposed`. The decision record's five-outcome
surface is preserved as the **normative per-arrival projection**
`report(arrival) = invalid | missing-closure | duplicate | forked
| removed-disposed | accepted` — the arrival answer ("what did
this ingest do"; the disposition folded in for accepted entries at
that moment), while the entry state is the samplable truth ("what
is this entry now").

**Class.** Replica (full admission); service (blind admission,
7.4). **Preconditions.** Per ingress type, Section 7.
**Outcomes.** Verdicts, dispositions, projection — per entry,
samplable.

**Counter-vector.** A registered delivery task type's "defined
effect" writes an attached artifact directly into the store
because the document passed Delivery's §6.2 pipeline. Conformant:
the artifact enters admission like any synced entry — an epoch
forgery falls `invalid` at 3.4.2's binding; a causally pre-removal
content entry of a removed member is **admissible by design and
the residual is named** (Section 11), never silently effected
outside admission. The direct write itself is the nonconformance —
the reopened generation-gate bypass this promise exists to close.

### 5.15 I15 — Rebinding after local loss

**Promise.** After loss of local state — store wipe, namespace
loss, device migration — a replica rebinds to durable sources
through the **stable group identity alone**: the genesis digest,
never a local namespace, never a device-scoped identifier, never
an identity derived from key material. Four concerns, separated,
each with its own failure: stable identity (what), discovery
(where — the adapter-registered mechanism; a rebind run's source
set is the sources discovered and authenticated in that run, keyed
`sourceSetDigest`, I3), source authentication (Section 6), and the
target (4.1). A local namespace MUST NOT determine the
reachability of previously acknowledged entries. Loss detection is
**evidence-bound**: `entry-not-in-closure` binds exactly when
**ack-receipt evidence** is presented — a recoverable artifact
(store fragment, another device's records, a retained receipt)
naming previously acknowledged entry ids; persistence and recovery
are adapter-declared (RO-6). Presented evidence E is judged as
`E ∈ closure(F)` against each authenticated source's target.
**Without evidence, absence is undetectable and the contract says
so**: the rebind may honestly end `rebound-and-reached` — it MUST
NOT fabricate a loss claim it cannot ground, and equally MUST NOT
report "nothing was lost", only "everything attested was reached".

**Class.** Replica (rebinding); service (durable source presenting
a target on rebind). **Preconditions.** Held or recovered group
and member identity; discovery; optionally ack evidence.

**Outcomes.** `rebound-and-reached` · `source-auth-failed` ·
`entry-not-in-closure` (evidence-bound, surfaced, never silently
accepted) · `conflicting-sources` (authenticated sources present
irreconcilable targets — surfaced; resolution is union catch-up
where closures merge, the forked state where siblings conflict,
`source-equivocation` where one source signed both) — plus the
common variants.

**Counter-vector.** R holds ack receipts naming E; S₁ and S₂ both
authenticate; only S₂'s closure contains E. Rebinding to S₁ (last
known), reporting success, never judging the evidence against S₂ —
or reporting `entry-not-in-closure` while E sits in S₂'s unfetched
closure — nonconformant. Without evidence the same trace
conformantly ends `rebound-and-reached`; claiming loss from
nothing is equally nonconformant. The field's orphaned-acked-log
class.

### 5.16 I16 — Enforcement concurrency is forked, nothing else

**Promise.** Two **fully admitted** transitions (`accepted`, 7.1
steps 1–4 complete) of the same predecessor epoch, not causally
ordered, put the group in the **forked state** of Access §3.6,
adopted verbatim: *no operation building on either sibling is
canonical* — a fail-closed verdict pending reconciliation, not a
selection. **The trigger is exactly this, nothing weaker:** a
structural sibling still `missing-closure` triggers nothing (an
implementation MAY hold a local, non-authoritative fork suspicion;
it grants and denies nothing). Canonicality is **merge-revisable
by construction**: a sole-sibling transition (`accepted`, disposed
`canonical`) is re-disposed `forked` the moment its sibling is
admitted — verdicts never change, dispositions do (I14) — and the
local canonical frontier shrinks to the siblings' common ancestry.
From the fork's visibility: **no new effect on either sibling or
any descendant, all authorization answers fail-closed, no eviction
on either sibling's claim (I4), no canonicality claim toward
anybody — while the entries keep replicating as evidence to the
evidence-authorized peers** (I11; eviction is never bypassed), so
every entitled replica reaches the same fail-closed state instead
of a silent split. Services follow with bounded delay through view
freshness and view divergence, not fork detection of their own
(7.4; Access §3.6 says the same — the window is a named residual
bounded by `stalenessBound`, capped in Section 9).

**The forked materialization (normative — what fail-closed
presents).** Access is precise and this contract transcribes it:
effects already taken at their position are never revised by a
merge (Access §3.5), and forked is a materialization outcome in
which no side is current authority and the merged key world is
undefined (Access §3.6). A replica in the forked state:

1. answers every current-authority query fail-closed — neither
   sibling's effects are presented as current;
2. keeps the **maximal unforked prefix** queryable as the last
   canonical state — defined over the whole DAG, not per sibling
   pair: the materialization of the maximal causally closed
   sub-DAG of accepted entries containing no member of any
   enforcement-sibling pair and no descendant of one.
   Deterministic in the held DAG; concurrent additive entries on
   the prefix stay inside it (Access's additive ∥ enforcement rule
   stands); nested and late-arriving forks simply shrink it;
3. **retains, never reverts, never presents** effects already
   taken from a now-forked branch — queryable as branch-bound
   evidence ("taken under T₁, now forked"), never as state;
4. holds key material already produced as knowledge (nothing can
   be unlearned) and derives **nothing new** on either branch —
   the merged key world is undefined and stays so;
5. surfaces the condition (I8); consumers of this port (Layer 4
   included) MUST present branch-bound effects as historical
   evidence, never current content.

Bytes and effects from before the fork's visibility are history —
not unsendable, not unmakeable; the promise is that every
conformant replica re-judges identically, converges on this same
materialization, and takes no new effect from its own detection
onward. Winner selection does not exist in this contract and MAY
only arrive together with Access OI-1; a future reconciliation is
a signed join entry (RO-1). **Liveness residual:** once two
enforcement siblings exist, this contract promises no resumption;
until OI-1, conformant enforcement is single-partition per group —
a binding registration precondition (`concurrencyScope`,
Section 9). **Fork-spam residual, named and priced:** every
admitted sibling is a fully valid enforcement operation by an
authorized member — accepted evidence, store-permanent, mintable
in quantity; the cost falls on the attacker's own group, the
artifacts are attributable, and the answer is social (removal,
dissolution), never mechanical suppression.

**Class.** Replica (application and effect); the service side is
Access §7.3 obligation 5, via I7. **Preconditions.** Two fully
admitted sibling transitions in the held DAG. **Outcomes.** The
forked state, samplable; per entry the disposition and projection
`forked`; exit only by reconciliation (RO-1).

**Counter-vector.** T₁ arrives alone (`accepted`, `canonical`);
descendant D₁ is conformantly applied and forwarded; T₂ arrives
later and is admitted. Conformant: T₁, T₂, D₁ now disposed
`forked`; no further effect; authorization fail-closed; **T₂
appears in the send set** toward peers lacking it; T₁'s samplable
disposition changed while its verdict did not. Nonconformant:
picking the smaller operation id and continuing effect;
withholding T₂ "because forked"; disposing `forked` on a
`missing-closure` structural sibling; or pleading that D₁ "was
already forwarded" — the promise binds from detection, not
retroactively.

## 6. Sessions and Source Authentication

A session is one authenticated exchange — the precondition of
every completeness artifact (Section 4) and every authorization
verdict (I7):

- **Replica ↔ service:** the service authorizes the replica by
  challenge-based proof of possession of a derived identity listed
  in the current accepted view (Access §7.3) — the **session
  principal**, the only thing a service ever authorizes (7.4); the
  replica authenticates the service against the exact-byte service
  identity of the group's registration. Personal anchors are never
  presented to a service (Identity §7).
- **Replica ↔ replica:** mutual proof of possession of member
  identities, each side judging against its own materialized
  membership at its current head (P1), fail-closed under the
  forked state — with one executable exception, incorporated from
  Access §3.6: the **evidence session**, authenticated by the
  **canonical prefix claim**. The companion's unified evidence
  field set (Access §3.6) is the only claim form — no field list
  is repeated here; the claimed-prefix computation (conflict DAG,
  verifier-enforced completeness, accepted-entries sub-DAG form)
  is likewise incorporated without repetition. Claim, request, and
  needed closure verify as **one atomic handshake bundle** with no
  session standing before the whole bundle verifies (normative
  counter-vector: B holds P → T₁ removing A; A holds P → {T₁,T₂}
  and claims P for root T₂; B accepts and receives T₂ — under the
  disputed removal the maximal claimable prefix is exactly P, A is
  a member of its materialization, and the acceptance is how the
  fork evidence reaches B). The session carries exactly one
  request type with the **total response function**
  `evidenceResponse(root)` (Access §3.6): disputed transition →
  both siblings; disposed operation → operation plus its disposing
  removal; target digest → **branched by source class** — for a
  service chain, the chain to `lastKnownTargetDigest` with the
  closed `unknown-baseline`/restart variants, the per-generation
  registration preimages with their view closures (cursor:
  `lastKnownAuthorizationViewDigest`), and the acceptance evidence
  per Access §7.3 (the successor chain into the session-attested
  generation is the anchor); for a replica target, only the
  current in-session span under the total baseline partition
  (null → full span; same-session ancestor → span to it;
  everything else, same-session non-ancestors included →
  `foreign-session-baseline | non-ancestor-baseline` with the full
  root-session span) — no generation, no restart, no rotation. In
  every authority variant the closure is the union over ALL
  returned artifacts' authority ancestor closures. The session
  serves nothing outside that function and confers no authority
  standing, no general content read or write, no eviction effect.

**The attestation key.** Every source that issues targets holds
one, and the session authentication MUST bind it: for a replica
source it is (or is verifiably held by) the authenticated member
identity; for a service, **the group's registration binds it**
(Access §7.3: the `attestationKey` field of the 0.26 artifact,
generation-chained) — verifiable by every member, stable across
sessions by the chain rule of 4.1. A service whose attestation key
is not so bound cannot issue targets, only unattested pages (4.4).
The initial binding is established at registration; every later
change is **in-chain and cross-signed** (`keyRotation`, 4.1) — the
registration binding plus the cross-signature chain is the entire
verification story, and no out-of-band assertion (adapter
configuration included) ever substitutes for either. A source that
lost its current key takes the state-loss path (re-registration).
Session identifiers MUST be fresh per session; targets and page
delimiters bind to their session; a source MUST NOT reuse a
session's attestations in another session (a service chain spans
sessions; the artifacts never do, and a replica's attestation is
session-scoped altogether).

## 7. Ingest Admission

### 7.1 One admission, stated once

Admission is the single evaluation between "bytes arrived" and
"entry exists in replicated state". Per entry, in order:

1. **Shape:** profile form valid (3.4); the profile's signature
   verifies (content: header signature under `writer`; authority:
   envelope signature per Access §3.3); the id recomputes under
   the profile's rule; size within bound. Failure: `invalid`
   (terminal).
2. **Dedup and proof merge:** an already-held id produces no
   second effect; for authority entries the arriving proof merges
   into the held accumulator **first**, on every arrival (3.4.1),
   and held verdicts recompute after the merge. The arrival result
   is disjoint by definition: `proof-merged` iff the accumulator
   strictly grew, else `duplicate`. Only completed admissions
   count as held; previously rejected bytes re-evaluate in full.
3. **Closure:** every parent admitted or admissible within the
   same evaluation (7.2); otherwise `missing-closure` — held,
   provisional, healable (repair per I12; `awaiting-evidence`);
   never effect, never forwarding. Insufficient proof holds in the
   same class (3.4.1).
4. **Validity — position-local only:** authority entries: the P1
   *validity* evaluation (Access §§3.4, 5.3) under the
   materialized state of the ancestry closure, nothing wider.
   Content entries: the epoch binding and
   writer-membership-at-position checks of 3.4.2. Irreparable
   failure: `invalid`. Success: `accepted` (immutable). Validity
   is never skipped or deferred for disposition reasons —
   dispositions are computed over fully judged entries only.
5. **Disposition — the whole-DAG judgment:**
   `canonical | forked | removed-disposed` — the mapping of
   Access's canonicality and materialization outcomes (§§3.5, 3.6,
   the removal disposition over concurrent authorship included)
   over the **entire held DAG of accepted entries**, recomputed on
   merge: an accepted transition with an accepted,
   non-causally-ordered sibling of the same predecessor epoch, and
   every accepted descendant of either, is `forked`; an accepted
   operation in the transitive removal-disposition set of Access
   §3.6 (the a/b/c/d′ closure) is `removed-disposed`; everything
   else `canonical`. **The order is total —
   `forked ≻ removed-disposed ≻ canonical`** — and transitions are
   closed under it (I8; healing recomputes the d′ fixpoint, so
   downstream operations heal with their cause). **Access §9.2's
   raw-state equal-verdict rule binds steps 4 and 5 together:** a
   replica ingesting raw substrate state reaches the same verdicts
   *and* dispositions as one fed through any API — neither step
   alone is the Access judgment.
6. **Effect:** only `accepted` ∧ `canonical`, atomically where the
   entry is an enforcement artifact (I4). Forwarding: every
   `accepted` entry (evidence transport, I11).

**Precedence.** Terminal beats provisional: a trace establishing
`invalid` yields `invalid` whatever else holds. Verdicts are
immutable once assigned — except the healing path
`missing-closure → accepted | invalid` — and are **recomputation,
never data** (I10): every conformant replica reaches the same
verdicts and dispositions for the same held evidence, over any
arrival order and any ingress road.

**Storage classes and their bounds.** Three classes, separated:

- **Accepted entries are the durable store** — never evicted by
  any bound of this contract, forked-disposed entries included
  (they are the group's divergence evidence, I16).
- **Held pre-accepted evidence** (`missing-closure`) is bounded
  **per source partition** (registered byte and count bounds per
  `(group, source)`) **and by a per-group total across all
  partitions**. **Charge rule (deterministic, per retention
  instance):** a held entry is charged to the source of its first
  delivery of the current retention instance, once; later arrivals
  of the same id add no charge (their proof still merges).
  Eviction ends the instance and its charge; a re-delivery opens a
  new instance charged to *its* first deliverer — one rule, no
  provenance tombstones. Within a partition at its bound: further
  held intake from that source is refused (retriable), except that
  intake MAY proceed by evicting held entries of the **same
  partition**, largest-first, ties by unsigned bytewise entry-id
  order. **The repair reserve, itself bounded:** entries referenced
  by an active repair run are exempt from eviction — at most one
  protected run per entry within the rolling
  `repair-reserve-window`, the reserve as a whole capped by its
  registered byte and count bounds; an entry whose protection is
  exhausted is ordinarily evictable until the window rolls. **At
  the group total the rule is refusal, never foreign eviction:**
  further held intake is refused (retriable) regardless of the
  delivering source's own headroom; no entry of another source's
  partition is ever evicted for it. What the partitions give,
  honestly: **isolation holds below the group total**; at the
  total, sources displace one another's *intake* (never held
  evidence) — a named residual, as are self-partition starvation
  and reserve exhaustion (Section 11). Evicted held entries are
  re-fetchable via repair once their closure heals.
- **Targets and equivocation evidence** are small signed
  artifacts, retained per 4.1; run records per I3.

### 7.2 Page evaluation

A page evaluates as one **deterministic, causality-respecting
ready-set evaluation**: repeatedly admit every entry whose parents
are satisfied by held state or already-admitted entries of the
same page, in topological order (ties by unsigned bytewise
entry-id order), to a fixpoint; the remainder is judged per 7.1
step 3. Wire order within a page carries no meaning; two
conformant implementations reach identical verdicts for any
permutation of one page.

### 7.3 Ingress forms

| Ingress | Admissible input form |
|---|---|
| Network sync (session) | full entries with closure per page |
| Delivery-document effect | the enclosed artifact as full entries with closure — through this admission, never a direct write (I14) |
| Local import / tooling | full entries with closure |
| Recovery / rebind | full entries with closure (I15 governs the source) |
| Snapshot | a **registered verifiable snapshot profile** — the registry is empty in this casting; snapshot ingest is inadmissible (RO-2) |

A future snapshot profile MUST preserve P1's equal-verdict rule —
validity **and canonicality** — over snapshot input; that is the
registration bar, and why the registry ships empty rather than
half-open. **Seam state:** the Delivery-side mirror rule is
carried by the pinned Delivery 0.22 (§4.4: a registered type's
defined effect MUST NOT write replicated state directly;
replicated effects pass exclusively through this admission) — the
seam is closed on both sides; the remaining adapter-declaration
addendum points (decision record §5.2) are scheduled follow-on
work and do not touch this rule.

### 7.4 The service-side (blind) admission

A service cannot evaluate validity and never needs to. Its
admission: **session principal** authorized per the current view
(I7 — the entry's `writer` is never examined: the service cannot
know it, and authorized replicators forward foreign-signed entries
as a matter of course); shape and size bounds (3.1); dedup by
entry id; **quota** (Section 9: per-group and per-principal byte
and entry quotas, mandatory registration fields with normative
floors). Its verdict set:

`stored | duplicate | denied(no-standing) | refused(bounds) |
refused(quota) | evidence-saturated |
fail-closed(stale-view | divergence)`

Quota refusal is deterministic (registered constants; headroom a
function of held state). `evidence-saturated` is the storage
analogue of Access §7.3's saturation: at the registered per-group
bound the service refuses further group intake, retriable,
evicting nothing — a service never silently drops what it attested
(4.1). **The saturation residual, stated honestly:** a quota
filled by a later-removed principal has **no in-contract
reclamation** — the stored entries were attested and stay; the
consequence is displacement of future legitimate writes at this
service ("retriable" then means: retriable elsewhere). The
recovery paths are outside the contract and named: the group
re-registers at a fresh service (trust-on-first-use again), or the
operator acts outside the contract; verifiable compaction is
deferred (RO-4). The control plane stays open throughout (I7).

**The fork and the blind service, honestly.** `forked` does not
appear in this set, because a blind service **cannot detect an
authority fork** — sibling transitions are entry bytes whose
validity it is forbidden to judge; that is the point of
key-blindness. What closes the service is named: a forked group
cannot issue a fresh canonical view, so the freshness window ends
its authorization at the current view's `validUntil` at the latest
(Access §7.3 obligation 3), and where the split produces divergent
views, obligation 5 fires. **The window between a replica-visible
fork and the view's expiry is a named residual, bounded by the
registered `stalenessBound`** (≤ P30D, Section 9). Stated fully,
the window buys an already-authorized principal: download of held
old ciphertext (readable only with keys already held — knowledge
honesty, Access §7.2), ingress of historically positioned
old-epoch content (the permanent-amplification residual,
Section 11), and service-quota occupation — never a verdict, never
a new epoch, never standing beyond `validUntil`. A service verdict
is a storage verdict, **never** a validity claim: poison stored by
an authorized principal is caught by every replica's admission,
reflected as `unadmissible(set)` against the service's
`stored`-scope targets, and standing itself is revoked by the next
view (I4 eviction). This two-sided cut is the structural successor
of the previous generation's carrier-side type whitelist
(Section 11).

## 8. Above the Line: Reader States

Whether an admitted entry is *readable* is not this contract's
promise — but the vocabulary is fixed here, in **observable**
terms, so "converged" can never silently impersonate "readable"
and no surface claims knowledge it cannot have:

- `readable` — key material at hand; content opens.
- `blocked-by-key(repair-pending)` — material not at hand, and a
  live claim exists: the key service duty (Access §5.3) or an open
  `key-delivery` exchange (Access §10.1 — whose requests never
  pend server-side: the state is the *claimant's*, between its own
  attempts). A waiting state with a named claim, never an error.
- `repair-exhausted(policy | deadline)` — the claim was exercised
  to its declared bound without yielding material; re-entry into
  `repair-pending` is legal whenever the world changes.
- `declared-history-narrowed` — an authorized `historyNarrow`
  (Access §7.1) covers the span: closed by declaration, not by
  damage.
- `lineage-damage(unrepaired)` — a skipped, void, or failing
  lineage step covers the span and no repair entry has landed;
  repairing is a duty of every member holding both keys (Access
  §7.1), and non-publication proves neither absence nor malice —
  which is exactly why this state is named by the observable (the
  damaged step), never the unobservable: a surface MUST NOT claim
  "no holder exists", only "no repair has landed".

**Surface rule (normative for conformant consumers of this
port):** any surface showing convergence MUST show the convergence
frontier (I5) and the readability frontier as **two** statements;
deriving one from the other, in either direction, is
nonconformant. Authority state is never dark (Access §3.1) — at
most content is, at most until repaired.

## 9. Adapter Registration

An adapter binds a substrate and transport to this port. Its
registration names, at minimum:

- the **substrate** and the conformance classes it serves;
- the **concurrencyScope** — `single-partition` is the only
  registrable enforcement value in this version (I16; Access
  §3.6/§9.6);
- the **entry-id rule** confirmation per profile (3.4);
- the **session** mechanism, its authentication binding, and — for
  services — the **attestation-key binding** (Section 6);
- the **target and page encodings** — how targets, restarts, and
  page delimiters travel (4.1);
- the **discovery mechanism** for rebinding, and whether **ack
  receipts** are persisted and recoverable (I15, RO-6);
- the **durable store** boundary and crash model that I9 binds to
  (service-source target-chain state included; replica sources
  hold none);
- the **quotas and bounds** (7.1, 7.4), including the
  **service-wide capacity**: `maxGroups` and a global byte bound
  satisfying `global bound ≥ Σ (registered floor of every accepted
  group)` — the floor is thereby **logically reserved** (ordinary
  admission for one group never consumes another accepted group's
  unreached floor), and a registration that would break the
  inequality is refused with the closed outcome
  `registration-refused(capacity)` (floor ≠ quota: the floor is
  what capacity must reserve, the quota where refusal begins; no
  physical preallocation demanded);
- the declared constants: `repair-horizon` (I12),
  `repair-reserve-window` (7.1), run-record minimum retention
  (I3), and the closed `aborted` reason set (4.3);
- the **snapshot profile**, where one exists (none in this casting
  — RO-2).

**Constant domains (normative).** Every registered constant and
quota takes a value from a closed domain — type, unit, range —
with these floors, so no registration can hollow a promise while
claiming not to "weaken" it: entry size bound ≥ 65 536 bytes and
finite; per-group service quota ≥ 256 × the entry size bound;
per-principal service quota ≥ 16 × the entry size bound;
held-evidence partition bound ≥ 16 entries and ≥ 16 × the entry
size bound; per-group held total ≥ 4 × the partition bound;
repair-reserve byte/count bounds ≥ one partition bound;
`repair-horizon` a finite duration in [PT10S, P30D];
`repair-reserve-window` a finite duration in [PT1M, P7D];
run-record minimum retention ≥ PT1H; `maxGroups` ≥ 1 and finite.
**And one cap on an Access-side value:** a service adapter under
this contract MUST NOT accept a registration whose
`stalenessBound` exceeds **P30D** — the blind-service fork window
(7.4) is exactly as long as this bound, so the replication profile
caps what it will amplify. Registered values are deployment-local;
two deployments with different values are different profiles, not
a divergence.

A registration MUST NOT weaken any promise of Section 5; where a
substrate cannot carry a promise, the adapter carries it above the
substrate or the substrate is not admissible (Access §9.1 names
the floor). Every adapter carries the target-control overlay of
Section 4 in addition to whatever data-plane sync it reuses (door
5).

## 10. Candidate Substrates (informative; per component, sources as of 2026-08)

The honesty companion of 1.3, judged against the five doors (D1
signed causal DAG · D2 atomic enforcement · D3 view-shaped
authorization · D4 fail-closed concurrency · D5 target-control
overlay) plus bounds/saturation (B): **native** — the component
carries it; **adapter** — an adapter above it must; **excluded** —
a current property contradicts the door.

| Candidate (component, state) | D1 | D2 | D3 | D4 | D5 | B | Notes |
|---|---|---|---|---|---|---|---|
| `linear/0.1` (Access §9.6, normative reference) | native | native | native | native (single-lane: no siblings by construction) | native | native | the interim scope until OI-1 |
| **p2panda** (core + auth + encryption, 2025 releases) | native (append-only logs, causal refs) | adapter (RLTP enforcement artifact + commit) | adapter | adapter (needs the pinned RLTP resolver — a *replaceable* resolver is the hook, not the satisfaction: different resolvers reach different verdicts) | adapter | adapter | auth/encryption components (PCS/FS-capable) sit above this port in the TCB per deployment cut; browser story open |
| **Keyhive/BeeKEM** (Ink & Switch notebook, 2025) | native | **excluded today** — RLTP authority-claim+transition atomicity absent (removal *does* blank leaf+path; the gap is P2-shaped commits, not "lazy removal") | adapter | adapter (P1 injection point missing) | adapter | adapter | both gaps are concrete contribution targets |
| **SECSYNC** (repo state, 2025) | adapter (its snapshots/updates need the entry profiles) | **excluded today** for the authority log — snapshot-centric ingest meets an empty snapshot registry (RO-2) | adapter (authorization optional/external; server can exclude undetected) | adapter | adapter | adapter | native gaps honest: key distribution/rotation out of scope |
| **NextGraph** (docs, 2025) | port-dependent: internal broker sees commit headers (DAG servable); external protocol strips them (closures unservable on that cut) | adapter | adapter (thick: view ↔ own repo/permission/quorum model) | adapter | adapter | adapter | verifier decrypts → TCB adapter, correctly; an adapter must name which NextGraph port it binds |
| **Automerge / classical local-first sync** | adapter | n/a (data plane only) | adapter | n/a | **the defining case of door 5**: have/need + Bloom sync run below the overlay; without it = the unattested profile (4.4), pages, never `reached` | adapter | session auth, targets, chain: all overlay duty |

None is a conformant adapter today; the named gaps are concrete,
scoped contribution targets, and the port is shaped so each could
become an adapter without changing this contract.

## 11. Security Considerations

- **What removal cuts — and the two named residuals.** A removal
  cuts, structurally: **standing at services** (the next view no
  longer lists the removed member — reads and writes fail-closed,
  I7/I4); **every future epoch** (the key world, Access §7.1/§7.2);
  and nothing anonymously (every entry signed and attributable).
  **Content residual:** a causally pre-removal content entry
  remains admissible forever, and a removed member holding
  pre-removal keys can construct such entries after the fact —
  byte-indistinguishable from honest offline writes arriving late
  (the wot#232 family is the field proof that honest late arrivals
  are real and must not be lost). **The determinism theorem behind
  it:** any admission rule that varies with arrival time relative
  to local state violates P1's raw-state equal-verdict requirement
  (Access §9.2). The residual is bounded in *authority* — no
  post-removal epoch, no service standing, full attributability; a
  replica MAY surface "arrived here after the removal" as local
  knowledge (I10) — and **not bounded in storage**, and that is
  stated (the SSB lesson): a former member can mint unboundedly
  many historically positioned content entries, each valid at its
  position, each `accepted`, each store-permanent. Priced (old
  epochs only, fully attributable, colluder- or import-dependent
  for ingress) and unmechanized in 0.x: any cut would need an
  authoritatively bound per-writer frontier (RO-9).
  **Authority entries:** the same retro-positioning applied to an
  *additive authority operation* — a removed member back-dating a
  `member.add` of a puppet — is closed by Access §3.6's removal
  disposition over concurrent authorship (the transitive a/b/c/d′
  closure; the MLS doctrine: a commit that removes a member kills
  their open proposals), discharged into the companion in this
  loop. Under `concurrencyScope = single-partition` — the only
  registrable enforcement scope — the attack cannot arise at all:
  in the total order the back-dated operation sits *after* the
  removal and is `invalid` at its position.
  The previous generation closed this whole door with a carrier
  type whitelist — and paid with carrier extensibility, a shared
  capability secret, and no attributability; its gate also only
  ever guarded one road. This contract closes artifact-shaped what
  is closable and names what is not.
- **TOCTOU on authorization.** A service acting on live-read
  foreign truth was the field's stale-authorization class. Views
  are presented, chained, freshness-bounded, fail-closed in both
  directions (I7); within one epoch the authorized set only grows
  (Access §7.1), so a slightly stale view never grants what the
  log revoked.
- **Source equivocation is provable — detection is opportunistic,
  and that is stated.** The per-source chain turns a split-view
  into signed artifacts that convict their signer wherever they
  meet. **A source cannot reset its way out:** key rotation is
  in-chain and cross-signed; state loss ends target issuance until
  the group itself re-registers the service — a self-declared
  restart authorizes nothing (the CT doctrine); a stolen
  attestation key is healed by the group's rebind, and the window
  until it is a named residual (4.1). What this version does not
  promise is *guaranteed* meeting: witness/gossip duties are
  deferred (RO-8), and until then "never silently diverging" holds
  where evidence flows — not against a source that perfectly
  partitions its consumers forever.
- **Acceptance is anchored in the present.** A service
  generation's acceptance is provable in exactly two ways: the
  live session with the exact-byte service, or the
  `previousRegistration` successor chain into a session-attested
  generation (Access §7.3) — "newest" is not a locally verifiable
  property (the transparency-log freeze lesson; witness rules,
  RO-8, are the only road to more). No acceptance artifact
  exists: none could prove its own acceptance, and none is
  needed where the chain into the present is the anchor. The
  acceptance commit itself is a linearizable compare-and-swap
  (Access §7.3, I9), and the window between an acceptance and
  the new generation's first target is named there.
- **Insider fork is denial of service, never authority gain** —
  fail-closed, attributable, surfaced, its evidence reaching every
  entitled replica (I11), so the group fails closed together.
  Winner-picking anywhere — including "just locally, just for
  liveness" — converts that DoS into potential authority theft and
  is forbidden. The liveness price and the fork-spam residual are
  stated in I16.
- **Amplification and exhaustion are bounded by named constants —
  and the permanent-saturation residual is named.** Authorized
  floods meet per-principal and per-group quotas with
  deterministic refusal (7.4); held-evidence floods meet
  per-source partitions with a repair reserve (7.1) — isolation
  below the group total; at the total, intake displacement;
  self-partition starvation, total-bound displacement, and
  post-removal quota occupation are named residuals; view-path
  work is bounded by Access §7.3's evidence contract. A service
  under attack fails toward refusal of storage, never toward
  serving unauthorized reads, never toward silent eviction of
  attested data.
- **Dark spans are stated, not argued away.** Where no repair for
  a damaged lineage step has landed, Section 8 forces surfaces to
  say exactly that — and forbids the unprovable stronger claim.
- **Replay and duplication are the normal case**, converged by
  per-profile idempotency (7.1 step 2) — the proof accumulator
  explicitly exempted from suppression (3.4.1), so dedup can never
  starve a quorum, and signature bytes excluded from identity
  (3.4.2), so a signer cannot mint id multiplicity.
- **The port stands outside the TCB** (3.3): nothing in this
  contract makes a substrate operator safe to trust with keys,
  because nothing ever hands them any.

## 12. Privacy Considerations

- **What a service sees:** the group's genesis digest, derived
  service identities from presented views (never personal anchors
  — Identity §7), and the content-entry header (3.4.2): per-group
  writer identities, epochs, parent-graph shape, sizes, timing.
  The price of artifact-shaped verdicts, bounded by identity
  discipline: the writer identity is the per-group member anchor
  of Access §5.1, correlatable within the group's service
  relationship, not across groups; the service cannot join writers
  to session principals beyond observing sessions (the mapping
  stays inside the encrypted log). The previous generation's relay
  saw more with less protection (account DID, device ids, doc ids,
  sequence numbers — unsigned). Never seen: payload plaintext,
  document types, reader behavior.
- **Traffic analysis is not hidden.** DAG shape and timing
  correlate activity; this contract does not claim otherwise. What
  bounds the exposure is identity discipline, not the absence of
  observers; the carrier-relationship identity of the Delivery
  side is its own coordinated work.
- **Local truth stays local by contract** (I10): reader states,
  run records, retry state, arrival-time observations, and device
  identifiers never enter replicated state and are exposed to no
  counterparty, service or peer.

## 13. Conformance

- **Profile** `rltp-replication@0.26`; companion pins per the
  header.
- **Classes:** *replica* (Sections 3–9 in full) · *service*
  (Sections 3, 4, 6, 7.4, and I1/I3/I6/I7/I8/I9/I12/I13/I15 in
  their service roles). Adapters conform through their
  registration (Section 9). I6 and the TCB boundary are audit
  criteria; everything else is trace-testable.
- **No shipped schemas in this casting.** The two canonical
  signature inputs this contract defines (the content header
  3.4.2, the target 4.1) are normative as JCS field sets; wire
  encodings are adapter-registered. Schema and vector shipment
  become due with the first adapter registration (RO-3).
- **Trace-vector plan** (each vector is a trace plus required
  verdicts; the sixteen counter-vectors of Section 5 are the
  floor):
  - page-without-target → pages only, no completeness claim;
  - proof-merge convergence: two individually insufficient proof
    variants, either arrival order → held, valid after merge;
    dedup never suppresses the merge;
  - signature malleability: one header, two valid signatures →
    one entry id, `duplicate` on the second arrival;
  - content-header binding: same payload under two headers → two
    ids, independently judged; no metadata equivocation
    representable;
  - epoch forgery → `invalid`; non-member writer at position →
    `invalid`; pre-removal positioned content of a removed member
    → `accepted` (the named residual); retro-positioned authority
    operation under `single-partition` → `invalid` at its
    position;
  - out-of-order epoch content within a page, both permutations →
    identical verdicts;
  - overlapping runs, crash between them → two records, two
    terminals;
  - crash inside an enforcement artifact → atomic
    both-or-neither;
  - the three predicate stages per target and scope; supersession
    without retro-invalidation; `stored` never substitutes for
    `admitted`;
  - removed member's read and write against a stale view → both
    fail-closed; reconciliation view still admitted while
    fail-closed;
  - late-attaching consumer samples every promised condition,
    after restart included; every field honors its closed
    transition set;
  - durable-report crash-safety, target-chain state included;
  - replicated reader-state / run-record attempt → structurally
    rejected;
  - crash-and-restart send-set recomputation as admitted-closure
    difference, fork evidence included;
  - **D₁/D₂ (mandatory, both session orders):** device D₁ of a
    member attests F in session S₁; device D₂ of the same
    identity, without F, opens S₂ — the send set toward D₂ is the
    full admitted closure including any fork sibling; no S₁
    target is ever subtracted for D₂;
  - replica sessions: two sessions of one member's devices with
    different frontiers are NOT equivocation; equivocation is
    exactly two distinct targets of one
    `(source, group, session, seq)` or an in-session regression;
    the tuple `(source, group, chain, seq)` applies to services
    only;
  - positive class-valid catch-up: `reached(F)` against a service
    chain AND against a replica in-session target;
  - gap repair: evidence-carrying request; every outcome under
    precedence; unreachable source → `awaiting-source`; run
    unterminated past `repair-horizon` → nonconformant;
  - a port interface demanding per-entry durable transactions →
    nonconformant; page-granular commit satisfying I9;
  - delivery-effect ingress through admission; direct-write
    attempt caught; snapshot ingest refused;
  - arrival result vs entry state: first arrival → projection
    `accepted`; re-arrival → `duplicate`, state unchanged;
    proof-bearing re-arrival → `proof-merged`, state may heal;
  - rebind matrix: `(stable-id, source proof, target, ack
    evidence | none)` × all outcomes; evidence judged against
    `closure(F)`, not F; no fabricated loss claims; run key =
    `sourceSetDigest`;
  - sibling transitions, late arrival: dispositions revised,
    verdicts unchanged, effect stopped, **T₂ in the send set**,
    authorization fail-closed; a `missing-closure` structural
    sibling triggers nothing;
  - forked materialization: current-authority queries fail-closed,
    the unforked prefix queryable as last canonical state, branch
    effects queryable as evidence only, no new derivation on
    either branch — one defined state, not three implementations;
  - source equivocation: two signed targets of one chain-seq →
    fail-closed toward the source, evidence retained and
    transportable; equivocation proof arriving during
    `awaiting-source` → immediate terminal;
  - chain continuity (service sources): cross-signed `keyRotation`
    continues the chain; a claimed rotation without cross-sig is
    none; state loss → no further targets, runs end
    `target-chain-unavailable`, pages still legal; resumption only
    after group re-registration, ack evidence judged against both
    chains; periodic "state-loss resets" never regain standing by
    themselves;
  - service capacity: a registration beyond `maxGroups`/global
    bound → `registration-refused(capacity)`, never silent
    under-service;
  - precedence totality: goal achieved plus incidental extra
    unadmissible entries → success, extras stay per-entry
    verdicts; equivocation plus local abort in one step →
    `source-equivocation`; rebind with both conflict grounds →
    `conflicting-sources` ≻ `entry-not-in-closure`;
  - repair-reserve exhaustion: perpetually renewed runs cannot pin
    an entry past its window's one protected attempt; charge rule:
    the same id from a second source adds no partition charge
    while its proof still merges;
  - quota and saturation: deterministic `refused(quota)` /
    `evidence-saturated`, control plane open, nothing attested
    evicted; post-removal occupation → displacement surfaced;
  - held-evidence partitions: a flood from source A never evicts
    source B's held evidence; repair-reserve entries survive
    eviction pressure;
  - blind service: session principal authorized, writer never
    examined; foreign-signed entries by an authorized replicator →
    `stored`; authorized poison `stored` at the service, `invalid`
    at every replica, `unadmissible(set)` against its
    `stored`-scope targets.

  The evidence-session, acceptance, and CAS families (prefix
  claim/conflict DAG, supplement, transcript framing, acceptance
  anchoring, freeze honesty, parallel acceptance, crash edges)
  are specified with their vectors in Access §§3.6, 7.3, and 14
  and bind through Section 6. **Assurance boundary, stated:** the
  repository's executable conformance suite does not yet execute
  the CAS/anchoring/`invalid-bundle` families — they exist as
  textual vectors; executable coverage is named post-convergence
  work.

## 14. Open Issues and Coordination Debts

- **RO-1 — Fork reconciliation.** Exit from the forked state is
  Access OI-1 terrain; a reconciliation will be a signed join
  entry binding both sides (the Git lesson). Until then
  `single-partition` is the only registrable enforcement scope and
  I16 is forked-only.
- **RO-2 — Snapshot profiles.** The registry ships empty; the bar
  is P1's equal-verdict rule — validity **and canonicality** —
  over snapshot input.
- **RO-3 — Wire encodings and schemas.** The content header and
  the target are normative as canonical JCS field sets; wire
  encodings are adapter-named. First adapter registration ⇒
  shipped schemas and vectors become due; second independent
  adapter ⇒ a common normative encoding becomes a candidate.
- **RO-4 — Published service constants and compaction.** Registry
  publication of quotas/bounds (the Delivery §4.4 pattern) and verifiable
  compaction against the saturation residual: deferred to adapter
  evidence.
- **RO-5 — Key-regime neutrality.** The personal group's declared
  key regime (root-derived epochal / independent-keys) is Access
  and Identity terrain. This contract's only stake (I6, I15, 3.3):
  nothing at or below the port line assumes derivability of any
  key, and the stable group identity is never derived from key
  material — both regimes replicate identically.
- **RO-6 — Ack receipts.** Persistence and recovery are
  adapter-declared; a normalized receipt artifact is a candidate
  once adapter evidence exists.
- **RO-7 — The content payload seal.** The header profile is
  deliberately payload-opaque; the sealing construction (which
  epoch key, AAD binding to `{group, epoch, payloadDigest}`) is
  coordination terrain with Access §7.1/§9.5 and the future
  Layer 4 — named so the debt is visible, constrained here only by
  I6.
- **RO-8 — Witness rules.** Turning provable equivocation and
  freeze detection into *guaranteed detection* needs mandatory
  comparison duties (witnesses, gossip rounds, checkpoint
  cross-signing). Deferred until adapter evidence shows where
  comparison naturally rides.
- **RO-9 — Per-writer accountability.** An authoritatively bound
  per-writer sequence (the SSB lesson) would make writer
  equivocation visible and could bound the historical-minting
  residual (Section 11). Any such cut must itself be
  authority-bound (a removal-carried writer frontier) and is
  Access-coordinated candidate work, not a 0.x rule.

**Coordination debts (recorded decisions, owed elsewhere):**

1. **Discharged (Access 0.31–0.50, 26.08.2026):** the removal
   disposition over concurrent authorship, the evidence-transport
   rule, the service fail-closed wording, and the registration
   generation machinery (generations, tombstone, CAS acceptance;
   the interim receipts-as-link-evidence stage was later withdrawn
   by the receipt cut, Access 0.52) all landed in the companion; this
   contract pins the current Access casting and cites it. What
   remains Access-side is OI-1 itself (RO-1).
2. **Discharged (Delivery 0.22, 26.08.2026):** the §4.4
   direct-effect prohibition; the remaining adapter-declaration
   addendum points of the decision record §5.2 (give-up-horizon
   registry, conclusion duty, A5, deadline constant,
   machine-readable declaration) stay scheduled as Delivery-side
   follow-on work.
3. **Layer 4 / Access:** the content payload seal (RO-7) and the
   semantic composition of documents from entries.

## Appendix A (informative): mapping to the current implementation

| This contract | Today (Gen 2: Sync 001–003, wot-core) |
|---|---|
| I1/I15 catch-up + rebind | vault pull, seq-log recovery, migration re-anchor-on-connect fix |
| I5 three-stage predicate | `loaded`/`complete` heuristics (~200 lines, rls#274) — replaced by target-relative stages |
| Content entries (3.4.2) | unsigned Yjs updates `{docId, seq, ciphertext}` under channel auth — replaced by signed headers under artifact auth; seq → causal parents (the seq↔nonce coupling debt ends here) |
| Section 8 reader states | `classifyLogEntryKeyDisposition` — relocated above the line as `blocked-by-key(repair-pending)` + observable dark states |
| I2 + closure admission | `evaluateKeyRotationDisposition` (`future-buffer`/`apply`/`ignore-stale-or-duplicate`) — evaporates: causality + idempotency + gap handling |
| I7 presented views | `present-capability` control frame under the shared `spaceCapabilitySigningKey` — replaced by Access §7.3 views; the capability-seed bug family ends structurally |
| I14 all-ingress admission | relay type whitelist (VE-R2) + `devices`-table join in `isFullyDelivered` — both costs of the missing cut; the carrier becomes type-blind again |
| Targets (Section 4) | none — completeness was inferred from silence (rls#274); the attested chain and group-authorized restart are new |
| I11 log as send-truth | outbox resend loop class |
| I9 transaction-bound gates | acked-but-not-durable loss class |
| I16 forked | no counterpart (single relay total order) — `linear/0.1` is that honesty as an adapter |

## Appendix B (informative): field provenance of the promises

The full review-round provenance of every refinement — with the
attacks that forced it — is recorded in
`design/replication-review1…25-2026-08.md`.

| # | Field provenance |
|---|---|
| I1 | multi-device silent loss family (wot#232); decision seam 4 |
| I2 | two-channel rotation race (Sync 001/003 key-rotation inbox type); Access P2/§7.1 |
| I3 | unpaired sync-run reporting (wot#346) |
| I4 | Access P2/§5.3 commit-before-forward; decision seam 1 |
| I5 | false `complete: true` (rls#274); first-sync signal harvest (wot#343/#344) |
| I6 | key-export prohibition lesson (wot#306); decision seam 3 |
| I7 | stale-authorization TOCTOU (wot#289); capability-seed family (wot#234) |
| I8 | state-vs-edge gate lesson (wot#288, gate 3) |
| I9 | durability gate losses (wot#328, wot#193) |
| I10 | local/replicated coupling (wot#285); devices-table terminality |
| I11 | outbox loop (wot#236, wot#245, wot#249) |
| I12 | gap-repair gate (wot#288, gate 2) |
| I13 | cold-start scale measurement (wot#353: 8 990 `importKey`) |
| I14 | decision-pair B-6 + whitelist genealogy (Sync 003 §Relay-Whitelist) |
| I15 | acked-log orphan after migration (register §C) |
| I16 | decision-pair B-5/B-4; Access §3.6; the MLS comparison |

## References

[RFC2119] · [RFC8174] BCP 14 · [RFC8785] JCS · RLTP Access Layer
0.52, wire 0.24 (§§3.2–3.6, 5.1–5.4, 7.1–7.3, 9, 10) · RLTP
Identity Layer 0.12 (§§4, 7) · RLTP Delivery Contract 0.22 (§§4.4,
6) · RLTP Membership Tasks 0.16 · RLTP Encounter Layer 0.28, wire
0.25 (§2.3 interim securing profile) · Decision record:
`design/portvertrags-paar-entscheide-2026-08.md` (Revision 2);
casting reviews: `design/replication-review1…25-2026-08.md` · Sync
001/003 (superseded transport specs, Appendix A) · MLS: RFC 9420,
RFC 9750 (I16/liveness; the removed-proposals doctrine,
Section 11) · Certificate Transparency: RFC 6962, RFC 9162
(equivocation-evidence rationale and its limits, 4.1; the freeze
lesson, Section 11) · Candidate substrate documentation per
Section 10.
