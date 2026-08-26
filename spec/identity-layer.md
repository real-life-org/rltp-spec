# RLTP Identity Layer

**Real Life Trust Protocol — Layer 1: Identity**

- **Status:** Editor's Draft
- **Version:** 0.12.0-draft (twelfth casting: surgical — the pair
  class gains one registered occasion, the founding of a group;
  M-DID-loop finding B2, `design/mdid-joint-review1-2026-08.md`;
  nothing else changes)
- **Editors:** Anton Tranelis
- **Date:** 2026-08-23
- **Vocabulary namespace:** `https://real-life.org/rltp/v1`
- **Conformance profile:** `rltp-identity@0.12` (draft)
- **Supersedes:** version 0.11 (archived as
  `archive/identity-layer-0.11.md`) and versions 0.10–0.1,
  archived alongside it.
- **Supersedes on adoption:** `01-wot-identity/001-identitaet-und-schluesselableitung.md`
  and `003-did-resolution.md` (wot-spec v0.1, German). The planned
  device-delegation profile `01-wot-identity/004-device-key-delegation.md`
  is not superseded; it is referenced as prior work by Section 15.1.

## Abstract

This document specifies the Identity layer of the Real Life Trust
Protocol: how a person's cryptographic identity is rooted, derived, and
presented to every other layer.

A person keeps **one secret and one register**. The secret is a
mnemonic; from the seed it encodes, the person derives **one anchor
per context**: one for their personal community, one per group they
join, one per public persona they choose to maintain, and one service
identity per group toward infrastructure. The register is the list of
contexts — data, not secret — synchronized in the person's encrypted
state. Derivation is deterministic: secret plus register reconstructs
every key. And it is one-way: without the seed, two anchors of the
same person are unlinkable.

An anchor's outside face is a **self-certifying identifier**: a DID
that binds its own key material without any registry, resolver
infrastructure, or network access. This casting normatively specifies
the smallest self-certifying form, `did:key`, in which the identifier
is the key and the key history is empty — and states honestly that
the frozen consumers of this stack pin exactly that form today. The
extension to anchors with a verifiable key history — enabling
rotation, per-device keys, and recovery from key compromise — is a
named, deliberately open successor (Section 15).

What an anchor *means* — who may link it to a person or to another
anchor — is not decided here. Derivation determines how many anchors
exist; **disclosure determines what they mean**, and disclosure is
specified by the layers above. This document only guarantees that the
separation exists: anchors of one person share no derivable relation
visible to anyone who lacks the seed.

## Status of This Document

This is an **Editor's Draft** with no standing beyond its own
argument. It is developed through an adversarial convergence
process: every casting is reviewed in full by an independent
adversarial reviewer, findings are triaged in the design journal,
and the document is recast — never patched — until two consecutive
rounds return no blocker-level finding.

Casting 0.6 was read by that process and **converged**: rounds 4
and 5 returned no blocker-level finding. Casting 0.7 redeemed the
`pair/` label reservation that 0.6's Section 15.3 held open — the
visibility layer took the decision that section delegated to it
(`design/mdid-bindung-2026-08.md`) — and its confirmation round
(round 6, `design/identity-review6-2026-08.md`) found the redemption
sound in construction and vectors but not in bookkeeping: 1 blocker,
4 major. Castings 0.8 and 0.9 answered rounds 6 and 7; joint round 2
(S-B4) then caught 0.9 describing Encounter 0.23 semantics hours
before 0.24 changed them — the chronology trap this journal had
already named. Casting 0.10 was the pair-block **sweep**: the
pair rows now carry fresh-always (one context per
relationship-creation act; the relationship is the holder-local
chain, visibility layer's §6a). Standing process rule, learned
twice: this document's pair rows change only in the block-end
sweep, never mid-block; casting 0.11 finished that sweep (two
stale version references). A confirmation round runs jointly with
the block. The round-by-round record lives in the design journal
(`design/identity-review1…7-2026-08.md`), not here.

The companions above this layer: the **RLTP Encounter Layer 0.28**
(fresh always — in its joint convergence loop with
the visibility layer; 0.22 was the last converged Encounter), the
converged **RLTP Delivery Contract 0.22**, **RLTP Membership Tasks
0.16** and **RLTP Access Layer 0.52**; two
cross-document debts against Delivery and Access are recorded in
Section 7. *RLTP Succession* (0.2, parked) operates on the anchors
this document defines. It is cast against the requirements list of
the layer's decomposition (I-list Revision 3); Appendix B maps
every requirement to its section. Parts of the design are executed
by the graph simulator with real WebCrypto credentials — including
the Section 5.3 self rule and digest-form group labels against
fixed expected-anchor oracles; X25519 derivation and label
rejection remain pending probes.

This layer defines **no wire artifact**. Its normative surface is
the derivation scheme, the label registry, the anchor form, and the
rules it imposes on consuming layers; its test vectors are
derivation vectors (Section 16). The document will keep changing as
implementation experience accumulates; open questions are collected
in Section 15.

## 1. Introduction (informative)

### 1.1 Essence

> A person is one mnemonic. Everything a person *is* toward a
> context — their personal community, a group, the public — is an
> anchor derived from its seed: reconstructible by its holder,
> unlinkable for everyone else, and resolvable by anyone as a plain
> DID.

Three consequences shape this document:

1. **One secret, one register.** The mnemonic is the only *secret* a
   person must keep. The *register* of contexts (which groups, which
   personas) is data: it must exist for recovery, but it carries no
   authority and lives in the person's synchronized encrypted state
   like any other holding. Nothing else exists — no keystore, no
   per-context enrollment secret.
2. **Separation by construction, meaning by disclosure.** Contexts
   are separated cryptographically, not by policy: linking two
   anchors requires either the seed or an act of disclosure by the
   holder. The disclosure acts themselves — to a contact, to a group,
   to everyone — belong to the layers above; this document guarantees
   only that there is something to disclose.
3. **The waist is narrow — and today it is `did:key`.** To every
   consumer, an anchor is an opaque, standard-resolvable DID, and
   nothing on the wire reveals how it was derived. In the 0.x stack
   the frozen consumers additionally pin the concrete form (Section
   8.3); the waist rule is the discipline that keeps a future form's
   cost contained, not a claim that no cost exists.

### 1.2 The derivation is private

The derivation scheme of this document is a **convention of the
holder**, not a claim on the wire. No verifier ever checks that an
anchor was HKDF-derived; no credential ever names a label. This has
two consequences worth stating plainly. First, migration is a
derivation rule, not a data migration: a pre-existing identity keeps
its anchor because that anchor *is* one of this document's
derivations (Section 10). Second, proving that two anchors share a
seed is an *act* — a future disclosure primitive — not a property a
third party could ever compute (Section 15.3).

### 1.3 Position in the stack

The Encounter Layer issues credentials **between anchors** and
carries key-agreement material in its **contact card**. The Delivery
Contract seals envelopes **to** that material. Membership and Access
admit **anchors** to groups, and Access consumes the **service
identities** of Section 7. Succession replaces **an anchor** while
preserving its relations. All of them consume this document through
three rules: an anchor is an opaque resolvable DID (Section 8.3),
verification material is bound to the anchor and available offline
(Section 8.4), and key material exists per context exactly as
Sections 5–7 derive it.

## 2. Terminology

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be
interpreted as described in BCP 14 (RFC 2119, RFC 8174) when, and only
when, they appear in all capitals.

- **Mnemonic**: the person's single master secret, a BIP-39 word
  sequence (Section 4).
- **Root IKM**: the 64-byte BIP-39 seed derived from the mnemonic;
  the input keying material of every derivation in this document.
- **Context**: a social surface toward which a person acts under one
  identity: their personal community, one group, one public persona.
- **Label**: the canonical string naming a context in the derivation
  (Section 6).
- **Label register**: the holder's list of used labels — data
  required for recovery, held inside the synchronized encrypted
  state. It carries no self mode: the self context is not a label
  (Section 5.3).
- **Anchor**: the DID a person presents toward one context. Evidence
  accumulates on anchors.
- **Anchor key pair**: the Ed25519 assertion key pair of an anchor.
- **Key agreement key**: the X25519 key pair derived alongside each
  anchor for sealing (Section 5.2).
- **Self anchor**: the anchor of the person's personal community,
  derived by the fixed rule of Section 5.3 — the same rule for
  created and migrated identities. Since the Encounter pair castings,
  ceremonies enact under fresh **pair** anchors (fresh always); the self anchor
  never appears on the ceremony wire and is disclosed per recipient
  through the visibility layer.
- **Anchor classes, DTGWG-aligned naming** (informative): in prose
  this family calls pair-context anchors **R-DIDs**, group-context
  anchors **M-DIDs**, persona anchors **P-DIDs**, and the self
  anchor **S-DID** — the DTGWG classification plus one class of our
  own. The registry labels above are the normative spelling; the
  class names are how we speak.
- **Service identity**: the derived pseudonym a person presents to
  infrastructure for one group (Section 7).
- **Holder**: the person controlling the mnemonic.

## 3. Creation, hierarchy, and human actions (normative)

### 3.1 Self-creation (A1)

An identity exists because someone brings it into existence — by
generating entropy, nothing more. No issuer, no registry, no domain,
and no service participates in creation or is a condition of
existence. An implementation MUST NOT require any online interaction
to create an identity or to derive any key.

### 3.2 The hierarchy

The hierarchy of `rltp-identity@0.12` has two levels:

```text
mnemonic → root IKM (64-byte BIP-39 seed; cold in principle)
 └── per context: anchor key pair (Ed25519) + key agreement key (X25519)
 └── per group:   service identity (Ed25519), Access contract
```

- The root IKM MUST NOT be used directly as a signing or agreement
  key.
- Anchor key pairs MUST NOT be reused across contexts: one label,
  one key pair. Deriving two labels to the same key material is
  computationally infeasible under Section 5 (accidental collision
  probability ≈ 2⁻²⁵⁶ per pair); an implementation that nevertheless
  detects a collision MUST fail closed rather than proceed with a
  shared key. Presenting one anchor under two contexts is a
  disclosure decision of the holder, not a key-reuse mechanism.
- A third level — per-device operational keys authorized by an
  anchor — is **not part of this profile**. In `rltp-identity@0.12`,
  a device that acts for a person holds the mnemonic or root IKM
  (the shared-seed model). Section 15.1 names the successor and the
  constraint any successor MUST honor.

### 3.3 Human actions (A8)

Every mechanism of this document that a human triggers MUST be
presentable as the everyday action of this table; mechanisms listed
as *automatic* MUST NOT require a user decision. A profile that
introduces a second long-term secret MUST state that cost where the
profile is defined.

| Mechanism | Everyday action | Visible consequence | Required warning |
|---|---|---|---|
| Create identity (3.1, 4) | "Write down your recovery words" (12 or 24 generated; all valid BIP-39 lengths import) | the person exists; contacts can be made | the words are the only secret; losing them is final (9.2) |
| Full recovery (9.3) | "Enter your words on the new device" — synced state reachable | the self anchor returns immediately; every context returns as the register loads | none |
| Partial recovery (9.3) | "Enter your words" — synced state gone | the self anchor and its relations return; group and persona contexts do **not** enumerate; **pair contexts do not return at all** | MUST say: without your synced data, only your personal community returns by itself; group and persona contexts return as counterparts re-supply them; **relationship (pair) contexts cannot be re-supplied — those relationships are re-created, not recovered** (9.3) |
| Join a group (6.1) | joining itself — no key step | the group appears | none (label handling is automatic) |
| Create a public persona (6.1) | "Create public profile" | publicly findable under the chosen name | publishing is forever — stopping does not unpublish (visibility layer) |
| Report loss or compromise (8.2, C1) | today: "meet your people again" — relations are re-witnessed by re-encounter (the B1 grade; B2 remains none); guardian succession is a **parked future function**, not offered | new edges accumulate on the new identity | a new identity is a new identity; nothing transfers by itself |
| Service identities (7) | *automatic* | none visible | none |
| Adopt a legacy identity (10) | "Enter your words" (same gesture as recovery) | the existing identity continues, unchanged | none |

## 4. The mnemonic and the root IKM (normative)

- The master secret is a **BIP-39 mnemonic**. Implementations MUST
  use the English wordlist and MUST NOT localize it: recovery
  phrases are exchanged and typed across implementations, and a
  single wordlist is what makes them portable.
- **Generation** produces twelve or twenty-four words. **Import**
  (recovery input) MUST accept every valid BIP-39 length — 12, 15,
  18, 21, or 24 words — so that no valid phrase is ever refused at
  the door.
- Twelve words encode 128 bits of entropy; this is the security
  floor of the native profile and Section 13 states it as such
  (twenty-four words encode 256 bits); the derivation below is
  unchanged by length.
- The **root IKM** is the 64-byte BIP-39 seed of the mnemonic:
  PBKDF2-HMAC-SHA-512 over the NFKD-normalized mnemonic with salt
  `"mnemonic" || passphrase` and 2048 iterations, per BIP-39. In the
  native profile the passphrase MUST be empty. A profile that uses a
  non-empty passphrase introduces a second long-term secret and
  MUST state that cost (3.3).
- The mnemonic SHOULD be treated as recovery material: stored
  coldly, entered rarely. This casting's device model (3.2) forces
  operational presence of the root IKM on acting devices; Section
  15.1 exists to lift that.
- Implementations MUST NOT derive anything from the root IKM except
  through Sections 5 and 7, and MUST NOT transmit the mnemonic, the
  root IKM, any derived seed, or any private key off the device that
  holds it, except as user-initiated recovery input on another
  device of the same person.

## 5. Context derivation (normative)

### 5.1 The two seeds (labeled contexts)

For a labeled context — `group/…`, `persona/…`, or `pair/…` — with
canonical label `L` (Section 6):

```text
edSeed(L) = HKDF-SHA-256(ikm = root IKM, salt = empty, info = "rltp/anchor/ed/" || L, length = 32)
xSeed(L)  = HKDF-SHA-256(ikm = root IKM, salt = empty, info = "rltp/anchor/x/"  || L, length = 32)
```

- `edSeed(L)` is the Ed25519 private-key seed of the anchor
  (Section 8).
- `xSeed(L)` is the X25519 secret of the context's key agreement
  key (Section 5.2).
- The salt MUST be empty. The info strings MUST be exactly the
  ASCII prefixes above followed by the label bytes. The prefixes are
  the domain separation between signing and key-agreement material;
  implementations MUST NOT derive both from one info string, and
  MUST NOT add further key types under these prefixes — a future key
  type gets a future prefix through a new casting. (The two fixed
  prefixes differ before the label begins and UTF-8 is injective, so
  no choice of label can collide the two purposes or make two
  distinct labels concatenate to one info string.)
- Derivation MUST be deterministic: the same mnemonic and label
  produce the same seeds on every conforming implementation.
  Section 16 gives vectors, anchored in a public BIP-39 test
  mnemonic.

Derivation is lazy by nature: a context's keys exist the moment its
label is first derived, and re-derive identically forever after.
There is no registration step and no state beyond the label register.

### 5.2 Key agreement material, end to end

`xSeed(L)` is the 32-byte X25519 secret of the context, interpreted
per RFC 7748 (clamping is applied by the X25519 function itself; the
stored seed is the raw HKDF output):

- The public key is `X25519(xSeed, 9)` (the base point), 32 bytes.
- Its interchange form is the **multikey**: `z` followed by the
  base58btc encoding of `0xec 0x01 || public-key` (the `z6LS…`
  form).
- Its **place** is the `keyAgreement` field of the Encounter Layer's
  contact card, exactly as the frozen contact-card schema requires;
  the card as a whole is signed under the anchor, which is what
  binds the agreement key to the anchor (Section 8.4). The Delivery
  Contract's `rkid` designates this key when sealing to the context.

A conforming implementation MUST produce, for every context it
derives, the anchor and the multikey of this section such that a
counterpart holding only the contact card can seal to it per the
Delivery Contract with no further information.

### 5.3 The self context — one fixed derivation for everyone

The self context does **not** derive through Section 5.1. For every
identity — created under this document or migrated from wot-spec
v0.1 — the self seeds are:

```text
edSeed(self) = HKDF-SHA-256(ikm = root IKM, salt = empty, info = "wot/identity/ed25519/v1", length = 32)
xSeed(self)  = HKDF-SHA-256(ikm = root IKM, salt = empty, info = "wot/encryption/x25519/v1", length = 32)
```

These are the historic info strings of the deployed generation, and
that is the point: **one rule, no mode.** There is nothing for the
label register to record about the self context, no adoption state,
and no ambiguity after total loss — the mnemonic alone determines
the self anchor, deterministically, for every identity that ever
existed under either generation. The naming asymmetry against
Section 5.1's `rltp/` prefixes is the visible cost, carried
knowingly: continuity of every deployed identity is worth an
irregular string. The two info **byte sequences are immutable**: a
future casting may introduce a symbolic alias that resolves to
exactly these UTF-8 bytes, and may do nothing else — an alias that
resolved to different bytes would recreate the very ambiguity this
section removes.

Key-agreement interchange and placement for the self context follow
Section 5.2 unchanged.

## 6. Context labels (normative)

### 6.1 The closed registry

The registry of `rltp-identity@0.12` is **closed**: exactly the
following label forms are derivable, and a derivation API presented
with any other string MUST reject it before any key derivation
(fail closed, no normalization repair beyond Section 6.2). A closed
registry is what makes the label register portable: two conforming
implementations accept exactly the same labels.

| Label form | Context | Notes |
|---|---|---|
| `group/<digest>` | one group | `<digest>` is the group's genesis digest exactly as issued by the Membership Tasks: `u` followed by the **canonical unpadded** base64url encoding of a `sha2-256` multihash — bytes `0x12 0x20` followed by exactly 32 digest bytes (47 characters in total). Implementations MUST validate the multihash structure, MUST reject padding, non-zero trailing bits, or any encoding whose canonical re-encoding differs from the input, and MUST NOT accept a display name |
| `persona/<name>` | one public persona | `<name>` per Section 6.2; a person MAY hold several personas |
| `pair/<digest>` | one relationship-creation act (an encounter, an introduction, or the founding of a group) | `<digest>` uses **exactly the group digest encoding** (`u` + canonical unpadded base64url of a `sha2-256` multihash, 47 characters, same validation MUSTs), computed over a **32-byte relationship nonce** the holder generates fresh from a cryptographically secure source at relationship creation. Each side of a relationship derives its **own** pair context from its **own** nonce; nonces are never coordinated. The nonce itself is recorded in the label register alongside the label; it never travels — counterparts hold the resulting anchor, not the nonce |

The digest of a pair label is the `sha2-256` multihash **of the
32 nonce bytes themselves**, encoded exactly like a group digest.
A pair context is derived at exactly one occasion: one
relationship-creation act — an encounter enactment (Encounter §4.4,
**fresh always**: every enactment derives a fresh pair context,
re-encounters included), an introduction act, or **the founding of
a group** (Access §3.4.1: the founder's standing relationship with
the group it creates — the one member anchor that cannot be a
`group/<digest>` context, because that digest does not exist
before the genesis it identifies; this context lives for the
duration of the founder's membership). The **relationship**
is a holder-local chain of such contexts with one active head,
maintained by the visibility layer's continuity machinery
(`rltp-visibility` §6a); this document only guarantees derivation
and recovery semantics per context. Which artifacts carry pair anchors, and how a pair
anchor may later be linked to any other anchor of the same holder,
is the visibility layer's contract (`rltp-visibility`), not this
document's; this document guarantees only the derivation and its
recovery semantics (Section 9.3). Encounter (fresh always, currently 0.26) enacts every ceremony under a fresh
pair anchor (its §4.4); the joint convergence loop with the
visibility layer is running.

The string `self` is **not a label**: the self context has its own
fixed derivation (Section 5.3), and a derivation API presented with
`self` — or with `device/…`, the prefix still **reserved** for the
successor of Section 15.1 — MUST reject it like any unknown label. Service identities are NOT labels of this registry either;
they derive per Section 7.

### 6.2 Name grammar and canonicalization

`<name>` in `persona/<name>` is constrained byte-precisely, because
two byte-different labels derive two different anchors — label
equality *is* anchor identity:

The validation **pipeline is normative and ordered** — every check
runs on the same intermediate, so two implementations cannot
disagree by checking at different stages:

1. The input MUST be a valid sequence of Unicode scalar values
   (well-formed UTF-8; no surrogates).
2. Apply NFC. This is the one permitted normalization; an
   implementation MUST apply it itself rather than reject
   unnormalized input.
3. **All** further checks run on the NFC result, and **every
   Unicode property in this section is evaluated against Unicode
   15.0 data** — assignment, `General_Category`, and `White_Space`
   alike, regardless of the implementation's platform data (the
   categories, unlike NFC, carry no cross-version stability
   guarantee, so the pin must cover them too): 1 to 64 code points;
   at most 256 UTF-8 bytes; no `/` (labels have exactly the
   components the registry shows); no code point of categories Cc
   (control) or Cf (format); no unassigned code point; no leading
   or trailing code point with the `White_Space` property.
   (Interior spaces are permitted — Section 16 carries
   `persona/An na` as an acceptance vector.)
4. The NFC result is the canonical label; derivation uses its bytes.

Comparison after NFC is **byte equality**; names are
**case-sensitive** (`persona/Anna` and `persona/anna` are two
personas — Section 16 carries the pair). Pinning the repertoire to
Unicode 15.0 assignments is what makes the derivable set identical
across implementations and platform ICU versions; and by Unicode's
**normalization stability guarantee**, NFC of code points assigned
in 15.0 never changes in later versions — so both the accepted set
and every accepted label's derivation are version-stable.
- The name inside the label is the persona's identity for
  derivation only; changing the public display name without
  intending a new identity requires keeping the label stable.
  Implementations SHOULD therefore store the label separately from
  the display name.

### 6.3 The label register is sensitive

Labels never appear on the protocol wire. They are nevertheless
**sensitive data**: a `group/<digest>` label reveals membership to
anyone who can map the digest, `persona/<name>` reveals the chosen
persona, and the register as a whole is a map of the person's
contexts. Therefore:

- The label register MUST be held **only inside the holder's
  synchronized encrypted state** — the same storage that protects
  every other holding. This document deliberately derives no
  storage key (Section 4 confines the root IKM to Sections 5 and
  7) and does not specify that storage's encryption; honestly: the
  storage contract is a **named, still unwritten external
  prerequisite** (the future Replication/Vault casting), which
  today's implementations satisfy in fact with their end-to-end
  encrypted vault, not by a referenceable specification. The
  register MUST NOT exist in plaintext at rest outside that state.
- Implementations MUST NOT embed labels in identifiers, filenames,
  telemetry, or any metadata that leaves the device.
- Section 14 records the leakage consequences.

## 7. Derived service identities (A7, normative)

For infrastructure interactions a person MUST use a **derived
service identity** and MUST NOT present any personal anchor — the
self anchor of Section 5.3 and every anchor of Section 6 — to a
service. This document adopts the Access Layer's frozen contract
verbatim as the stack-wide rule:

```text
serviceSeed(g) = HKDF-SHA-256(ikm = root IKM, salt = empty, info = "rltp/v1/service-identity/" || <canonical genesis digest of g>, length = 32)
```

- The service identity is the Ed25519 `did:key` of `serviceSeed(g)`
  — deterministic, per group, re-derivable after total device loss.
- **The digest input is normalized to the canonical form.** Before
  derivation, an implementation MUST decode the genesis digest
  (accepting the `u`- and `z`-multibase encodings the Access
  schemas allow), validate its multihash structure (Section 6.1),
  and re-encode it into the canonical `u`-multibase form; the info
  string is built from that canonical form only. The info string
  is a byte concatenation, and two encodings of one digest would
  otherwise derive two different service identities for one group
  — Section 16 carries the equality vector (`z`-form input, same
  service identity).
- Service identities are **Ed25519-only: they sign and
  authenticate.** Sealed delivery *to* a service identity is **not
  a capability of the 0.x stack** — no flow of the converged
  companions seals to a service (key delivery seals to member
  cards), and this document deliberately derives no service
  key-agreement material: a key that no artifact distributes and
  no rule binds would be surface without a contract. If a future
  flow needs it, Section 15.4 sketches the design it must bring.
- The binding member ↔ service identity lives inside the group's
  encrypted log per Access §5.2; it is not this document's concern.
- Granularity is **per group** (the genesis digest is the scope).
  A future casting may add non-group scopes only together with the
  Access Layer, in one move.
- Section 16 carries the seam vector: root IKM plus canonical
  genesis digest MUST produce the same service identity under this
  document and under Access §5.2, byte-exactly.

**Cross-document debts recorded here** (the companions are
converged; debts are discharged at their next castings, never by
patching):

- *Against the Delivery Contract:* **discharged (Delivery 0.22,
  26.08.2026)** — its §5 now expressly excludes the derived
  service identity as an `rkid` source (Ed25519-only, no
  sealing-to-service in the 0.x stack).
- *Against the Access Layer:* **discharged (Access 0.45+,
  26.08.2026)** — its §5.2 incorporates this document's §§4/7
  byte-exactly (root IKM, empty salt, info string, L = 32,
  canonical `u` digest) and names Identity as governing on any
  divergence.

## 8. Anchors (normative)

### 8.1 Self-certification

An anchor is a **self-certifying identifier**: it binds its own key
material by construction, without any registry, blockchain, domain,
or resolver service. In this profile the binding is maximal and the
history minimal — the identifier *is* the key:

```text
anchor = did:key:z<base58btc(0xed01 || ed25519-public-key)>
```

as specified by the did:key method and the multikey encoding.

### 8.2 Consequences of the empty history

`did:key` anchors cannot rotate: there is no place where a key event
could live. This casting accepts that limitation deliberately
(Section 15.2 records why, and what lifts it):

- Compromise of an anchor's private key is compromise of the anchor.
  There is no in-band recovery; recovery of the *relations* attached
  to a compromised or lost anchor is the subject of *RLTP
  Succession*.
- Verification of any signature by an anchor is offline and
  instantaneous: resolve the key from the identifier, verify. No
  history means nothing to fetch and nothing to be out of date
  about.

### 8.3 The waist rule — stated honestly

Consuming layers and foreign verifiers MUST treat an anchor as an
**opaque, standard-resolvable DID**: no assumption about derivation,
no comparison other than exact string equality, resolution only
through the DID method.

At the same time, the frozen 0.x consumers pin the concrete form —
and the pinned surface is wide, not narrow. The Ed25519 `did:key`
pattern is required today by twelve frozen schema files:
`access-operation-envelope`, `access-registration`,
`authorization-view`, `contact-card`, `encounter-credential`,
`payload-access-operation`, `payload-key-delivery`,
`payload-membership-accept`, `payload-membership-invite`,
`payload-removal-notice`, `rltp-delivery-document`, and `welcome` —
plus the Access Layer's interim-profile prose, and by every
schema file a later casting adds that pins the same pattern (at
this writing: the versioned `contact-card-0.25` and
`encounter-credential-0.25` copies, `access-vouch`,
`member-mapping`, and the Visibility artifact schemas) — the
count grows with the stack, and the coordinated-recast duty
covers the complete evolving set. (The sealed-envelope
schema pins only the X25519 `z6LS` multikey and is not part of this
surface.) Therefore, honestly: **in the 0.x stack the waist is
`did:key`-bound, and a future anchor form is a coordinated recast
across every pin of that complete set — the frozen twelve and
every later addition alike.** The waist rule's value is
what it confines: the recast touches identifier *patterns* and this
document, while credential semantics, membership semantics, and
delivery semantics do not change. A future casting SHOULD introduce
a shared anchor `$def` referenced by all schemas, so that the
surface becomes one place.

### 8.4 First contact and the anchor–key binding rule (A2, A3)

- **Offline first contact (A2).** All verification material of a
  context — the assertion key and the key agreement multikey — MUST
  be available to the counterpart at first contact without any
  online resolution. In the native profile the `did:key` anchor *is*
  the assertion key, and the **contact card** (Encounter Layer) is
  the native carrier of the key agreement multikey. No resolver
  service may ever be a precondition of meeting someone.
- **Anchor–key binding (A3).** Every profile MUST define an
  offline-checkable rule that binds verification material to the
  anchor — by containment (`did:key`: the key is the anchor), or by
  a signature under the anchor (the contact card binds the
  agreement key this way), or by a method-defined, self-contained
  binding that travels with the material. An artifact that names an
  anchor but verifies only under material not bound to that anchor
  is **invalid**, and verifiers MUST reject it. Consuming layers
  restate this rule for their artifacts; it originates here.
- **Control proof.** Control of an anchor is proven by signature
  under its assertion key. Artifacts across this stack are secured
  with Data Integrity `eddsa-jcs-2022` (the stack-wide securing
  decision); this document imposes only that the proof's
  verification method MUST resolve from the anchor per A3.

### 8.5 Stability is a chosen position (A9)

Anchors are stable **per person per context**; a pair context's
"context" is one relationship-creation act — the relationship is
the holder-local chain over them. The decomposition's original
exclusion — pairwise anchors as evidence carriers make asserters
unrecognizable to third parties — is, as of the Encounter pair
casting, **the chosen property, not a defect**: encounter
credentials accumulate on pair anchors precisely so that a
collector of leaked evidence cannot attribute it (the
collector-blind regime; Encounter §8). Recognition happens where it
belongs — per addressee, through the visibility layer's disclosure
acts, never on the artifact itself. The price of stability
(correlatability of everything one anchor ever signed, for whoever
links it once) is accepted knowingly per context and is restated
where it is paid (Sections 13, 14); for pair anchors that blast
radius is one chain link (one enactment tuple); the relationship as
a whole is connected only by the holder-local continuity facts of
the visibility layer.

## 9. Recovery (normative)

### 9.1 Without custodians (A4)

Recovery MUST NOT require any service, cloud custody, or third
party. The mnemonic in the holder's own keeping, together with the
label register from the holder's own synchronized state, is
sufficient to recover all key material on a fresh device.

### 9.2 The two loss cases (A5)

- **Device loss with the mnemonic intact** is the recovered case:
  re-derive per Sections 5, 7, and 10; restore data state — the
  label register among it — from the holder's synchronized encrypted
  storage.
- **Loss of the mnemonic is cryptographically final.** No mechanism
  in this document or above it restores a lost mnemonic. The
  protocol's designed answer is **social succession** (*RLTP
  Succession*): a **new identity** whose continuity with the old
  one is witnessed by people — but that document is **parked**, and
  until its re-cast the only available path is re-encounter (the
  B1 grade of Section 11; B2 remains none). Whenever succession is offered,
  implementations MUST present it as a new identity with witnessed
  continuity, never as recovery. Its re-cast must additionally
  solve the **anchor fan-out**: succession 0.2 operates on one
  anchor, while a root compromise affects the self, every group,
  and every persona anchor of the person at once.

### 9.3 What the mnemonic restores

The mnemonic reconstructs **key material, not state**.
Implementations MUST make this distinction, and user interfaces
SHOULD state it plainly:

Restored by the mnemonic alone: every anchor key pair, key agreement
key, and service identity — **for every label the holder can name**.

NOT restored by the mnemonic — this is data state, held and
synchronized by the layers above:

- the **label register** (which groups, which personas). Without
  it, the holder knows how to derive but not what to derive.
  Implementations MUST persist the label register in the holder's
  synchronized encrypted state (6.3), and recovery UIs MUST treat
  "mnemonic present, register lost" as **partial recovery** (3.3):
  the self context is always recoverable — its derivation needs no
  register entry (5.3) — and labels re-learnable from counterparts
  (a group re-supplying its digest, a persona's own publication)
  return as they are re-learned; the rest is not enumerable.
  Partial recovery is deterministic: there is exactly one self
  candidate, never a choice. **Pair labels are the honest limit of
  re-learning:** the relationship nonce exists nowhere but in the
  holder's register — a counterpart holds the derived anchor, not
  the label. With the register lost, a pair anchor is
  unrecoverable-but-replaceable: the relationship is re-created —
  by a new encounter (Encounter §4.4, fresh always) or a new introduction act —
  and whatever standing the old pair anchor carried follows the
  visibility layer's disclosure rules, not a re-derivation.
- received credentials, contact memory, received disclosures and
  delivered snapshots, membership documents, and every other
  holding.

A conforming implementation MUST be able to re-derive all key
material from (mnemonic, label register) alone, with no keystore.

## 10. Migration (normative)

A pre-existing Web of Trust identity (wot-spec v0.1) consists of one
Ed25519 `did:key` and one X25519 key, both derived from the person's
BIP-39 mnemonic with the historic info strings. Under this casting,
**migration is the identity operation: there is nothing to do.**

- The migrated person's root IKM is the same 64-byte BIP-39 seed
  (Section 4) — the historic derivation already used it.
- The self context of *every* identity derives with exactly the
  historic info strings (Section 5.3). The migrated person's
  existing anchor therefore *is* their self anchor under this
  document, byte-identical: all edges, memberships, and logs remain
  attached, nothing any consumer observes changes, and no register
  entry, mode, or adoption step exists.
- New contexts of a migrated person MUST use Section 5.1
  derivation. Existing group memberships of the one-context world
  remain attached to the self anchor — they were made under it and
  membership documents are immutable; groups joined after adoption
  use `group/<digest>` anchors. Both states are legitimate and
  permanent; the visibility layer decides what linking between them
  is disclosed, exactly as for any two contexts.
- Section 16's self vector *is* the migration vector: mnemonic →
  the historic derivation → the anchor a deployed identity already
  has.

## 11. Profile properties — the graded table (normative honesty)

The decomposition grades every identity profile on four functional
properties (B1–B4). Which grade a group requires is that group's
policy, not this protocol's. The native profile of this casting
(BIP-39 · HKDF labels · Ed25519/X25519 · `did:key` ·
`eddsa-jcs-2022`) grades as follows, and implementations claiming
`rltp-identity@0.12` claim exactly these grades — no better:

| Property | Grades (best → weakest) | **Native profile 0.11** |
|---|---|---|
| **B1** Edge survival across key change | native (identifier stable across key events) · compensated (edge succession, C1) · re-encounter | **re-encounter.** C1 (*RLTP Succession*) is parked; until its re-cast, edges survive an anchor change only by being witnessed anew |
| **B2** Takeover resistance under operational key possession | pre-separated successor anchor · witnessed succession quorum (C1) · none | **none.** Operational possession of an anchor key is control of the anchor. A first-mover race would also grade as *none*; this profile does not pretend otherwise |
| **B3** Time-fixed authorization checkability | trivial (one key, never changed) · history travels along · per-signature delegation proof (C2) | **trivial — and strong.** Precisely because `did:key` never rotates, "was this key authorized then" has an unconditional answer |
| **B4a** Devices sign independently without the root | delegation proofs (C2) · shared seed | **shared seed** |
| **B4b** Device revocation is cryptographically effective | effective (requires a mutable locus: log, card update, or group substrate) · cosmetic | **cosmetic.** Whoever extracts the root IKM can act as any device; removal is bookkeeping, not cryptography |

This table is the honest core of the casting: the native profile is
**deliberately weak where it is weak**, with every gap named and its
compensation either parked (C1) or planned (C2, Section 15.1). A
future profile (Section 15.2) enters by publishing its own row of
this table.

## 12. Conformance

The profile `rltp-identity@0.12` is claimed by an implementation
that:

1. creates identities per Section 3.1, presents human actions per
   3.3, and implements the mnemonic/root-IKM contract of Section 4,
2. derives contexts per Section 5 (both seeds, and the key
   agreement chain of 5.2 through to the contact-card multikey),
3. enforces the closed registry and grammar of Section 6 with
   rejection before derivation, and stores the label register per
   6.3,
4. derives service identities per Section 7,
5. produces anchors per 8.1, obeys the waist rule of 8.3 toward
   foreign anchors, and enforces the binding rule of 8.4,
6. implements recovery per Section 9 (including the A5 presentation
   rule and the partial-recovery rule) and migration per Section 10,
7. claims the property grades of Section 11 as stated, and no
   better,
8. reproduces the vectors of Section 16 bit-exactly, including the
   rejection vectors.

## 13. Security Considerations

- **The mnemonic is a single point of failure by design.** One
  secret reconstructs every context — and its compromise is
  **retroactive**. Precisely: an attacker with the root IKM alone
  derives the self anchor with certainty and can *confirm* any
  labeled anchor whose label they know or guess (group digests
  circulate among members; persona names are public); an attacker
  with root IKM **and** the label register links every context of
  the person, past and future, with certainty. The unlinkability of
  Section 14 is exactly as strong as the secrecy of the seed and
  the register together. This is the accepted price of the
  one-secret property; the mitigations are cold storage (Section 4)
  and, until Section 15.1 lands, the honest statement that every
  acting device is fully trusted.
- **No forward secrecy against seed compromise.** `xSeed` is static
  and deterministically re-derivable. An attacker who records
  sealed envelopes and later obtains the root IKM (or a context's
  `xSeed`) decrypts the recorded traffic of that context
  retroactively. The Delivery Contract's sealing provides
  confidentiality against everyone *except* a future holder of this
  material; implementations and threat-model documentation MUST NOT
  claim forward secrecy for it.
- **128-bit floor.** The native profile's twelve words carry 128
  bits of entropy. That is the profile's security level against
  seed-guessing, stated here so that no other number is implied by
  the 256-bit HKDF outputs downstream.
- **No rotation (8.2).** An attacker with an anchor's private key is
  that anchor, indefinitely. Containment is social, not
  cryptographic — and today it is rebuilding, not containment:
  re-encounter accumulates new edges on a new identity, while the
  old anchor remains cryptographically uncontrolled and its
  standing relations are neither devalued nor transferred; that
  devaluation is exactly what the parked succession re-cast must
  bring (including the anchor fan-out a root compromise requires).
  Implementations SHOULD make anchor compromise a first-class user
  flow, not an error state.
- **Domain separation.** The derivation families in force are:
  `rltp/anchor/ed/` and `rltp/anchor/x/` (labeled contexts, 5.1),
  the two fixed self strings `wot/identity/ed25519/v1` and
  `wot/encryption/x25519/v1` (5.3), and
  `rltp/v1/service-identity/` (7). Their literal prefixes are
  pairwise distinct before any variable part begins (the fixed
  self strings contain no variable part at all), so no label or
  digest choice can collide two families; Section 5.1's argument
  records why no input can collide two labels within a family
  either.
- **Label collision as attack surface.** If an attacker can
  influence a label (a group's genesis digest is
  adversary-influenced input), they still cannot influence the
  derived key beyond selecting *which* fresh key the holder derives
  — HKDF's security does not depend on honest info strings. The
  registry's digest validation (6.1) exists for identity stability
  and seam correctness, not for key security.
- **The derivation's privacy is not secrecy of the scheme.** The
  scheme is public; what protects unlinkability is the seed's
  entropy. Anyone may hypothesize that two anchors share a seed;
  nobody can check it without the seed (HKDF is a PRF; outputs are
  computationally independent without the key).

## 14. Privacy Considerations

- **Unlinkability holds until disclosed — or stolen.** Two anchors
  of one person are unlinkable to any party lacking the seed —
  including co-members, verifiers, and any collector of leaked
  artifacts. Every *legitimate* reduction of that separation is an
  act of the holder, specified by the layers above; theft of the
  seed reduces it without any act (Section 13, first
  consideration).
- **A disclosed linkage is retroactive and permanent.** Because
  anchors are stable, whoever learns a linkage learns it for the
  anchor's whole past and future. The visibility layer must carry
  this warning; this document notes it because stability is a
  property chosen *here*.
- **The label register is a map of the person's life.** Its leakage
  reveals group memberships (digest labels), chosen personas, and
  service relations in one artifact — which is why 6.3 requires
  encrypted-state-only storage and forbids labels in outbound metadata.
- **The human layer correlates past the cryptography.** A display
  name reused across contexts, or a persona named after the holder,
  links anchors socially with no key material involved. The
  registry cannot prevent this; Section 6.2's separation of label
  and display name at least keeps renaming cheap.
- **Services of one group see one pseudonym — by design.** The
  service identity is per *group*, not per *service*: two services
  serving the same group see the same stable pseudonymous anchor
  and can correlate their interactions with it. Different groups
  remain separated. This is the chosen trade — per-service
  granularity would multiply the derivation and binding surface —
  and it is stated here so nobody mistakes the pseudonym for
  per-service unlinkability.
- **Structure is a fingerprint.** Even fully anonymous anchors form
  a graph whose shape can be matched against outside knowledge.
  That residual risk is inherent to stable identifiers and is
  assessed in the trust-model documentation; it is one of the
  motivations for the `pair/` contexts (Sections 6.1, 15.3).
- **The derivation is a confession held in escrow — and the register
  is the key to it.** Between independently generated keys there is
  no mathematical link; between derived contexts there is — the
  derivation function itself, permanent and unpublished. Whoever
  obtains **the seed together with the label register** can
  retroactively **prove** control of every recorded context: under
  coercion or seizure, unlinkability collapses not into suspicion
  but into evidence — of key control, not of any human act. The seed
  *alone* proves less: the self context and any label the holder can
  be made to name or the attacker can guess — group digests and
  persona names are guessable from context, while **pair labels are
  high-entropy and enumerable from nothing but the register**
  (6.1). This is one more reason the register is the layer's most
  sensitive artifact (6.3). "The derivation is private" (1.2) is the
  mitigation, not the cure; the trade is accepted because for this
  document's audience, loss is the common catastrophe and seizure
  the rare one, and a single recoverable seed defeats loss. The
  wallet-of-independent-keys alternative and its converse costs are
  compared in `fpp-mapping/docs/ableitung-vs-wallet.md`.

## 15. Open Issues

### 15.1 Device keys and the delegation ladder

The shared-seed model of Section 3.2 is the honest floor, not the
goal. The successor is a three-rung ladder, of which substantial
prior work exists as `wot-device-delegation@0.1` (planned draft,
wot-spec `01-wot-identity/004`):

1. **Shared seed** (this casting): devices are root holders;
   removal of a device is not expressible.
2. **Delegation bindings** (prior work, to be re-cast into RLTP
   forms): per-device key pairs authorized by an anchor through a
   signed binding with capabilities and validity window; revocation
   is best-effort, and a compromised device key can backdate
   signatures — the prior draft names this honestly.
3. **Verifiable history** (15.2): device enrollment and revocation
   as key events; strong temporal verification.

Any successor MUST honor the **context-scoping rule**: a device key
authorized for one anchor MUST NOT be reused under another anchor of
the same person — a shared device key is a cryptographically
provable cross-context linker, defeating Section 14's first
guarantee. The expected construction mirrors Section 5 on a
per-device root (`device/` prefix, reserved).

### 15.2 Verifiable key history (the SCID extension)

`did:key` is the smallest self-certifying identifier: identifier =
key, history = empty. The named successor keeps the anchor
self-certifying and adds an append-only, self-signed key event log
(pre-rotation commitments, device events, witnesses optional), in
the KERI family of constructions — enabling rotation and cold roots
without any domain or registry, with the history travelling
alongside credentials like any other artifact.

The event-log **format is deliberately not chosen in this casting**:
the nearest neighboring implementation (the DTGWG "P2P Trust
Stack", which independently chose SCID-based verifiable history over
domain-bound methods) is not yet published, and freezing a format
before comparison would guarantee divergence at the exact point
where convergence is cheap. Two integration paths are kept open:
attaching a history to existing `did:key` anchors (genesis key signs
event 1; known duplicity window before the first rotation), or a
digest-form anchor as a new form under 8.3 with succession linkage
from the old anchor. Either path is a coordinated recast of the
consumers' pinned patterns (8.3, honest form).

### 15.3 Root proofs — and the redeemed pair reservation

**Root proofs** (proving on demand that two anchors share a seed —
interactively, or designated-verifier so that leaked proofs
convince nobody) remain anticipated but unspecified.

The **`pair/` derivation** this section formerly reserved is
redeemed as of casting 0.7 (Section 6.1): the visibility layer
took the decision this document delegated to it
(`design/mdid-bindung-2026-08.md`; the pair rules live in
`rltp-visibility` §§1, 6 and 8 — per-recipient linkage instead of
standing credentials, the collector-blind regime). The Encounter
profile question this section used to hold open is answered:
**the Encounter pair castings enact every ceremony under a fresh pair anchor**
(its §4.4); the joint convergence loop of Encounter and Visibility
is running, and the remaining coordinated debt (Delivery/Access/
Membership pins and the membership proof model) is tracked in
Encounter §12 and `rltp-visibility` §9.4.

### 15.4 Sealing to services — the design a future flow must bring

If a flow ever needs sealed delivery *to* a service identity, the
missing piece is not a derivation but a **distribution contract**:
a service key-agreement key (derived per-group like Section 7's
seed, under its own future info string), published as a **service
key attestation** — signed under the service's Ed25519 identity,
carried where the service identity itself is announced (Access
§5.2's `service-identity.announce` is the natural place), with a
retention/rotation rule and an end-to-end seal vector. Delivery's
`rkid` would then designate that attested multikey. None of this
exists in 0.x, deliberately (Section 7): the derivation without
the contract was surface without meaning, and the contract is a
coordinated Identity/Access/Delivery casting.

### 15.5 Remaining vector debt

Two rejection families remain deliberately with the consuming
layers: X25519 low-order/all-zero shared-secret rejection is part
of the Delivery Contract's sealing validation, and non-canonical
multikey *parsing* is part of the Encounter Layer's card
validation. The mnemonic checksum rejection belongs to this
document and is in the vector set (Section 16). Worthwhile
additions for the next vector-set revision: a 24-word end-to-end
vector; the Section 6.2 boundary vectors (64/65 code points,
256/257 UTF-8 bytes, measured after NFC, including a name that is
over-long before NFC and legal after); the NFC pair extended with
its `xSeed` and multikey; and the register-protection round-trip
once the vault layer's storage contract is referenced from a
casting of its own. (The former `z`-digest rejection entry is
superseded by Section 7's normalization contract and its equality
vector; the `self` rejection formerly listed here is already in
the vector set.)

## 16. Test Vectors

`vectors/identity-derivation.json`. All values derive from the
public BIP-39 test mnemonic

```text
abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
```

with empty passphrase, English wordlist. Root IKM (the 64-byte
BIP-39 seed, independently verifiable against public BIP-39
vectors):

```text
5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4
```

Genesis-digest sample (a valid `u`-multibase sha2-256 multihash):
`uEiDYLnFbXqm2cwuJWuk9yNzRmlzWDpCTH6yA_4aP_1z_RA`.

| Context | info (ed) | anchor | keyAgreement |
|---|---|---|---|
| self (5.3 — also the migration vector) | `wot/identity/ed25519/v1` | `did:key:z6Mko3ZEjKJWQAM5nDXKoZ9jErvvxbWbYgS8KJXYpC5Hbu8a` | `z6LSqA7sbKGK3WVHP9SBcmv9ikp19iDNb1P5Q315kRPQrcTV` |
| `group/uEiDYLnFbXqm2cwuJWuk9yNzRmlzWDpCTH6yA_4aP_1z_RA` | `rltp/anchor/ed/<label>` | `did:key:z6Mkp252PiZp5e3EzakYaFCbWuJjpCiVfkr2ZffkqyEVAE2t` | `z6LSfGq1jMrqQ3jmQFB1pJrsKvVQhgQxRFtdkpdBYSn6Lum6` |
| `persona/Anna` | `rltp/anchor/ed/<label>` | `did:key:z6MkkfafvRtofcUe2qRjeN5wWF3pbJ8cX3wM8hPrNc5m6eQi` | `z6LSmJ5NXLqcbrro1dQ3XGmf5D1foCq5PUtRDbNj7GKPjipA` |
| `persona/anna` (case pair to the above) | `rltp/anchor/ed/<label>` | distinct — full values in the file | in the file |
| `persona/An na` (interior space accepted) | `rltp/anchor/ed/<label>` | in the file | in the file |

Further vectors in the file:

- **Service seam:** info
  `rltp/v1/service-identity/<genesis-digest sample>` → the service
  anchor (Ed25519-only, Section 7); MUST equal the Access §5.2
  derivation byte-exactly. **Equality vector:** the same digest in
  `z`-multibase (`zQmctXr3tRbmrD5JGXvfdimQkJ9tKvJQ7VrtyGGdEvsEVu5`)
  normalizes to the `u`-form and MUST yield the same service
  identity.
- **NFC pair:** two distinct real input strings —
  `persona/Café` (composed) and `persona/Café`
  (decomposed) — normalize to the same canonical label and derive
  the same seed; the file carries both inputs verbatim, the
  normalized label, and the shared seed and anchor.
- **Mnemonic rejection:** twelve times `abandon` (invalid BIP-39
  checksum) MUST be rejected at input.
- **Rejection labels:** `self` presented as a label (5.3); empty
  label; `persona/` and `group/` (empty component); `persona/a/b`
  (slash in name); the 0.1 group string
  `group/uEiBHZWZvbmRlZC1ncm91cC1kaWdlc3QtZXhhbXBsZQ` (declared
  sha2-256 multihash carrying 29 of 32 digest bytes);
  non-canonical trailing bits (`…RB`); padding present; wrong
  multibase prefix case; `pair/x` (malformed digest — the prefix is
  registry substance as of 0.7) and `device/x` (reserved);
  whitespace-only name; leading whitespace; Cc and Cf code points
  in a name.

A conforming implementation MUST reproduce all derivation values
bit-exactly and MUST reject every rejection input before
derivation.

## References (normative)

| Reference | Pinned to |
|---|---|
| BCP 14 | RFC 2119 + RFC 8174 (Section 2) |
| BIP-39 | Bitcoin BIP-0039 (mnemonic + PBKDF2-HMAC-SHA-512 seed), English wordlist |
| HKDF | RFC 5869, with SHA-256 |
| X25519 | RFC 7748 |
| Ed25519 | RFC 8032 |
| `did:key` | W3C CCG did:key Method v0.9. **RLTP uses only the Ed25519 resolution of the anchor.** The method's optional X25519 key *derived from* the Ed25519 key is NOT used: RLTP's key-agreement key is independently HKDF-derived (Sections 5.2, 5.3) and carried by the signed contact card — a verifier MUST take it from the card, never from a resolver's derived DID document key |
| Multibase / Multikey | W3C Controlled Identifiers v1.0 Multikey + IETF draft-multiformats-multibase: `u` (base64url unpadded), `z` (base58btc); multicodec registry entries `0xed01` (Ed25519 pub), `0xec01` (X25519 pub); multihash `0x12 0x20` (sha2-256) |
| Data Integrity | W3C Data Integrity EdDSA Cryptosuites v1.0 (vc-di-eddsa), cryptosuite `eddsa-jcs-2022` (via the consuming layers' securing decision) |
| Unicode | Unicode 15.0 data for assignment, `General_Category`, `White_Space`; NFC per UAX #15 |

## Appendix A. Relation to prior wot-spec documents (informative)

`wot-identity@0.1` (German) specified one identity key and one
encryption key derived from the full BIP-39 seed with the
`wot/identity/ed25519/v1` and `wot/encryption/x25519/v1` info
strings, the did:key form, and resolution. This document generalizes
it without moving it: the same seed remains the root IKM, the
historic derivation *is* the self context for every identity
(Section 5.3), and derivation gains the label dimension for every
further context. A deployed identity is already conformant to this
document's self rule without any migration step — which is the
migration argument in one sentence.

## Appendix B. Requirements coverage (informative)

Cast against `design/identitaets-schicht-2026-08.md`, I-list
Revision 3:

| Requirement | Where |
|---|---|
| A1 self-creation | 3.1 |
| A2 offline first contact | 8.4 |
| A3 anchor–key binding | 8.4 |
| A4 recovery without custodians | 9.1 |
| A5 honesty about the second loss case | 9.2 |
| A6 separated key purposes | 5.1/5.3 (ed/x domain separation) |
| A7 derived service identities | 7 (Ed25519-only, canonical digest, Access seam vector, Delivery/Access debts) |
| A8 operability without cryptography knowledge | 3.3 (normative table) |
| A9 anchor stability as chosen position | 8.5 |
| B1–B4 graded properties | 11 (native profile row) |
| C1 edge succession | 11 (B1/B2), status parked, *RLTP Succession* |
| C2 delegation proofs | 15.1 (ladder rung 2, prior work wot-spec 004) |
| IO-1/IO-4 continuity, device model | 15.1, 15.2 |
| IO-3 member identity scoping | 6.1 (`group/<digest>`) |
| IO-5 migration burden | 10 (dissolved by 5.3 — migration is the identity operation) |
| IO-6 grade requirements as group policy | 11 (preamble) |
