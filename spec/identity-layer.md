# RLTP Identity Layer

**Real Life Trust Protocol — Layer 1: Identity**

- **Status:** Editor's Draft
- **Version:** 0.28.0-draft (twenty-eighth casting — the companion
  to Delivery 0.37 for the **fourteenth** adversarial joint round
  (triage in `design/traeger-review14-2026-08.md`). No finding of
  that round landed in this layer: both blockers are
  carrier-interface matters — the unbounded accumulation of
  binding tombstones, and the missing external version pin for the
  TSP adapter obligations — and both majors are stale text on the
  delivery side. 7a is unchanged. This casting carries the
  companion pin, and one sentence in 7a.3 follows the carrier-side
  correction: the tombstone it names is bounded by capacity, not
  kept without limit. No wire byte changes)
- **Previous version:** 0.27.0-draft (twenty-seventh casting — the answer,
  jointly with Delivery 0.36, to the **thirteenth** adversarial
  joint round (triage in `design/traeger-review13-2026-08.md`).
  Two of its findings reach this layer, and both are **retractions
  of reasoning rather than changes of rule**. The previous casting
  called the register's equal-generation tie *impossible* to
  reproduce outside this register; the argument was wrong — a
  carrier-scoped order-preserving map exists trivially — so the
  categorical claim is withdrawn and what stands is the rule and
  its real reason: no such value travels in any artifact of this
  stack, because none is designed (Delivery §12, DO-7). And 7a.3's
  promise that the entry at the maximum "keeps working
  indefinitely" was, at the delivery side, contradicted by an exit
  that sent a tie there to re-addressing; the promise is right and
  is now shown to be right — **entries are superseded, never
  deleted**, so even where the bound principal is not the
  canonical one, every device retains its entry, derives its
  principal, and collects. No wire byte changes)
- **Earlier castings:** 0.26.0-draft (twenty-sixth casting — the companion
  to Delivery 0.35 for the twelfth adversarial joint round (triage
  in `design/traeger-review12-2026-08.md`). Both of its blockers
  are **compositional** — each state machine correct, the pair not
  — and both are answered on the delivery side. 7a.3's rules are
  unchanged; what this casting adds is the sentence that keeps
  them from being read past their reach. The register's
  equal-generation tie is settled **here**, by nonce bytes, and a
  carrier cannot reproduce that ordering — not by omission but by
  necessity, since any value that would let it is order-preserving
  in the nonce and therefore identical at every carrier of that
  relationship, which is the cross-carrier join 7a.4 exists to
  deny. And "entries are superseded, never deleted" is a rule
  about *this register*, whose carrier-side counterpart is
  deliberately different: a carrier releases and keeps a tiny
  binding tombstone instead. No wire byte changes)
- **Earlier castings:** 0.25.0-draft (twenty-fifth casting — the answer to
  the **eleventh** adversarial joint round (triage in
  `design/traeger-review11-2026-08.md`), jointly with Delivery
  0.34. One of its five blockers reaches this layer, and it is
  about the **reach** of a rule rather than its content: 7a.3's
  `{nonce, generation}` ordering decides which entry a *register*
  treats as canonical, and 0.22 said a returning old entry is
  therefore "superseded on every device" — true of the register,
  and not true of anything outside it. A device restored from an
  older state copy still holds the root IKM, the older nonce and
  the relationship's `rkid` private key, so it can prove
  everything a carrier asks and roll a binding **back**. The
  ordering was local and had to travel: 7a.3 now requires the
  canonical entry's `generation` to be **carried in the carrier
  registration proof**, where Delivery 0.37 §5a.3 binds only on a
  strictly higher one. No wire byte changes)
- **Earlier castings:** 0.24.0-draft (twenty-fourth casting — the companion
  to Delivery 0.33 for the tenth adversarial joint round (triage
  in `design/traeger-review10-2026-08.md`). Its two blockers were
  both carrier-interface findings and 7a is unchanged by them. The
  round's **major** lands here, though, and it is about proof
  rather than rule: 7a.1 has always said this class derives **no
  key-agreement key**, and Section 16 announced that the vector
  covers it — but the vector merely omitted the field and the
  runner never looked. The carrier-relationship vectors now
  declare `keyAgreement: null` explicitly, per case and for the
  class, and the runner asserts the **absence** rather than the
  document asserting it alone. No wire byte changes)
- **Earlier castings:** 0.23.0-draft (twenty-third casting — the companion
  to Delivery 0.32 for the ninth adversarial joint round (triage
  in `design/traeger-review9-2026-08.md`). Stated plainly: **no
  finding of that round landed in this layer.** Both blockers were
  carrier-interface findings — a protection claim Delivery made
  about its own registration budget, and the missing byte-exact
  condition behind its `duplicate` outcome — and 7a is unchanged.
  This casting carries the companion pin. No wire byte changes)
- **Earlier castings:** 0.22.0-draft (twenty-second casting — the answer to
  the **eighth** adversarial joint round (triage in
  `design/traeger-review8-2026-08.md`), jointly with Delivery
  0.31. It corrects the terminal rule the previous casting
  introduced. 0.21 answered the closed domain's last value by
  telling a holder to "re-address" through a fresh pair context —
  **which is not a move a holder can make**: under fresh-always
  enactment a pair context comes from a ceremony or an
  introduction act, and `rltp-visibility` §6a's continuity probe
  then **chains a recognized re-encounter back to the existing
  relationship**, so a new chain is what happens when a
  counterpart is *not* recognized, never a state a party can
  elect. 7a.3 now states the terminal rule as the small thing it
  is: the entry at the maximum **stays canonical and keeps
  working indefinitely**, only the convenience of further rotation
  ends, the lever that remains is 7a.2's move to a different
  configured carrier string, and a genuinely new relationship
  chain is named as a **social event of the companions**, never as
  an instruction this document issues. Labelled honestly as a
  theoretical closure. No wire byte changes)
- **Earlier castings:** 0.21.0-draft (twenty-first casting — the
  answer to the **seventh** adversarial joint round (triage in
  `design/traeger-review7-2026-08.md`), jointly with Delivery
  0.30: it named the terminal exit at `2^53 − 1`, in a form 0.22
  had to correct — see above)
- **Earlier castings:** 0.20.0-draft (twentieth casting — the answer to the
  **sixth** adversarial joint round (triage in
  `design/traeger-review6-2026-08.md`), jointly with Delivery
  0.29. One finding lands here, and it is the kind that only shows
  up when someone runs the numbers: `generation` decides which
  nonce — and therefore which principal — is canonical, and it was
  specified as "an integer ≥ 1" with no upper end and no
  representation. Past `2^53` a double-based runtime cannot
  distinguish two successive generations and reads a rotation as a
  tie, while an arbitrary-precision one reads a clear succession —
  the same register, two canonical principals. 7a.3 now closes the
  domain at exactly `[1, 2^53 − 1]`, fixes the canonical integer
  encoding, and requires an out-of-domain entry to be **rejected
  rather than clamped**; Section 16 carries the boundary vector,
  including the two values that are provably indistinguishable.
  No wire byte changes)
- **Earlier castings:** 0.19.0-draft (nineteenth casting — the companion to
  Delivery 0.28 for the fifth adversarial joint round (triage in
  `design/traeger-review5-2026-08.md`). One finding touches this
  layer and it touches it as a **seam**, not as a rule: 7a.2 lets
  a proxy, a federation member or a key rotation leave `C` — and
  therefore the principal — unchanged, while a neighbouring
  protocol may identify the *direct hop* by something that changes
  underneath it. That is not a defect of this derivation and 7a.2
  is unchanged; what was missing is the sentence saying whose
  problem it is, so 7a.2 now states that a hop-level identifier of
  a neighbouring protocol is **adapter-local** and never enters
  any derivation here, and Delivery 0.37 §5a.10 carries the
  lifecycle. Otherwise this casting carries the pin and two
  present-tense pin corrections. No wire byte changes)
- **Earlier castings:** 0.18.0-draft (eighteenth casting — the answer to the
  **fourth** adversarial joint round (triage in
  `design/traeger-review4-2026-08.md`), jointly with Delivery
  0.27. One blocker landed here and it is a real one: 7a.3's
  convergence rule could settle a **race** between two devices but
  could not express an **intention** — a holder deliberately
  rotating a carrier nonce drew a fresh random value that replaced
  the old one only if it happened to sort lower, so rotation
  succeeded about half the time and was otherwise silently undone,
  and a superseded entry returning from a partition heal or a
  backup restore dragged the register back. The register entry is
  therefore now **`{nonce, generation}`**: canonical = highest
  generation, ties settled by the bytewise rule as before, so
  rotation wins by construction while concurrent first writes are
  still decided the old way. Entries are **superseded, never
  deleted**, which is what makes a returning old entry harmless
  without inventing a tombstone. Only the `nonce` enters the
  derivation; the generation is register semantics alone, and no
  wire byte changes)
- **Earlier castings:** 0.17.0-draft (seventeenth casting — the **companion
  casting** to Delivery 0.26, the answer to the third adversarial
  joint round (triage in `design/traeger-review3-2026-08.md`).
  Stated plainly, because a version number should not imply more
  than it carries: **no finding of that round landed in this
  layer.** All four blockers and the minor were carrier-interface
  findings, and 7a is unchanged. This casting carries the
  companion pin and the one consequence the delivery-side
  two-phase wind-up has for this layer's recovery story — 9.3 now
  says what it means for a person who comes back late: a holder
  who recovers a state copy after the orphan horizon has passed
  can still present the proofs, and the binding returns to
  service. No wire byte changes)
- **Earlier castings:** 0.16.0-draft (sixteenth casting — the answer to the
  **second** adversarial joint round (triage in
  `design/traeger-review2-2026-08.md`), jointly with Delivery
  0.25. Two blockers, one major and one minor landed here, all of
  them about the **lifecycle** of the derivation's inputs rather
  than the derivation: 7a.3 now decides the **multi-device nonce
  race** — two partitioned devices may honestly create two nonces
  for one relationship, and the register converges by a rule
  either device can evaluate alone (**bytewise-smallest wins**),
  because a rule that called honest parallel devices faulty is the
  mistake this stack has already paid for once; 9.3 states which
  of the two losses takes the **pair contexts** with it and
  therefore where a delivery rebind can exist at all; the Unicode
  15.0 pin of 7a.2 is **shipped as enumerated data** instead of
  being left to the runtime's tables, alongside raw-byte
  rejection vectors; and the vector set gains the relationship
  axis (same carrier, two nonces). No wire byte changes)
- **Earlier castings:** 0.15.0-draft (fifteenth casting — the answer
  to the first adversarial joint round against the
  carrier cut (triage in `design/traeger-review1-2026-08.md`),
  jointly with Delivery 0.24: `C` gained a
  **complete, ordered byte grammar** (7a.2), and the
  non-ambiguity argument of 7a.4 was **corrected to what it
  actually proves** — length fixing removes parse ambiguity, while
  distinctness of digest pairs rests on SHA-256 collision
  resistance, with a fail-closed rule if that assumption is ever
  observed to break)
- **Editors:** Anton Tranelis
- **Date:** 2026-08-27
- **Vocabulary namespace:** `https://real-life.org/rltp/v1`
- **Conformance profile:** `rltp-identity@0.28` (draft)
- **Supersedes:** version 0.27 (archived as
  `archive/identity-layer-0.27.md`) and versions 0.26–0.1,
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
per context**: one per group they join — their personal community
among them — one per relationship, one per public persona they
choose to maintain, and one service identity per group toward
infrastructure; plus two registry-external derivations with no
social surface at all: the **recovery context** (5.3), the entry
point to the person's own encrypted state, and one
**carrier-relationship identity** per (relationship × carrier)
(7a), the principal under which the person registers and collects
that one relationship's deliveries at that one carrier — so that
relationships do not converge into a person at whoever carries
them. The register is the list of
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

The thirteenth casting was the **S-DID cut** (editor's decision,
26.08.2026): the fused "self anchor" — social surface plus
zero-input recovery root, a class of our own beside the DTGWG
R/M/P — was dissolved into the registry-external **recovery
context** with no social surface of its own (5.3) and the
**community anchor**, an ordinary M-DID of the person's personal
community; the S-DID class is withdrawn. Decomposition and
decision record: `design/sdid-auftrennung-zerlegung-2026-08.md`.

The fourteenth casting was the **carrier cut**, cast jointly with
**Delivery 0.23** against the decomposition
`design/traeger-beziehungsidentitaet-zerlegung-2026-08.md`
(editor's decisions E1–E9, 27.08.2026). It answers a promise the
Delivery Contract had been making into a void: its Privacy
Considerations claimed that "derived service identities bound what
a transport learns", while Section 7 defines those identities
**per group** only and knows no identity for a delivery
relationship at all. Section 7a closes that gap with a second
registry-external derived class, the **carrier-relationship
identity** — one control principal per (relationship × carrier),
with which a person registers addresses and collects deliveries at
one carrier for one relationship, and which is by construction
unjoinable to the `rkid` it registers. The layer's contribution is
the derivation and its recovery semantics (9.3); what a carrier
may ask of a principal, and the role separation that keeps the
recovery root out of delivery, is cast in the Delivery Contract's
§5a.

The fifteenth casting answered the **first** adversarial joint round
against that cut (7 blockers, 4 majors; triage in
`design/traeger-review1-2026-08.md`), jointly with **Delivery
0.24**. Two of the findings landed in this layer, and both are
about the derivation's *edges* rather than its shape: the carrier
controller identifier had a comparison rule but no grammar — no
statement of which inputs are admissible at all — so two
implementations could disagree about an ill-formed string and
derive two principals from one configured carrier (7a.2 now
carries an ordered validation pipeline, deliberately without the
NFC step that 6.2 has); and the info-string argument claimed
injectivity where it had only shown unambiguous parsing (7a.4 now
separates the two, names SHA-256 collision resistance as what the
remaining half rests on, and fails closed if a collision is ever
observed). The construction, the register entry, and the recovery
semantics were unchanged.

The sixteenth casting answered the **second** round (6 blockers, 1
major, 1 minor; triage in `design/traeger-review2-2026-08.md`),
jointly with **Delivery 0.25**. Where the first round found the
*derivation's edges*, this one found its **lifecycle** — what
happens to `N` over time, across devices, and across a loss — and
two of its findings are the kind that only appear when a
construction is read against the profile it actually runs in:

- **The nonce race (7a.3).** "Generated fresh when the
  relationship first uses any carrier" is a register write, and
  this is a shared-seed **multi-device** profile whose
  synchronizing storage contract is expressly still unwritten
  (6.3). Two partitioned devices can therefore both write, both
  honestly. The casting resolves it the only way that does not
  punish honest behaviour — a **deterministic convergence rule**
  over the register entries themselves (bytewise-smallest wins),
  with the superseded principals ending as ordinary orphans and
  the addresses rebound where they survived. "One nonce per
  relationship" is restated as what it is: a property the register
  **converges on**, not a precondition a device can guarantee
  alone.
- **Which loss takes the addresses (9.3).** The delivery side had
  built a recovery branch on a surviving `rkid`, forgetting that
  an `rkid`'s private half is a **pair context's** key: a total
  register loss takes it too, and a counterpart holds only the
  public value. 9.3 now says which loss leaves a way back, and the
  Delivery casting of that round withdrew the branch that did not.

The seventeenth casting was a companion casting, and said so
rather than dressing itself up: the third adversarial joint round
(4 blockers, 1 minor; triage in
`design/traeger-review3-2026-08.md`) landed **entirely** on the
carrier interface, and Section 7a is unchanged by it. What this
casting carried was the pin to **Delivery 0.26** and one
consequence worth stating where a person will look for it: the
delivery side's orphan ageing is now a two-phase wind-up, so 9.3
can say plainly that **coming back late is not fatal** — a holder
who recovers a state copy after the horizon can still present the
proofs and resume.

**This eighteenth casting answers the fourth round**, and unlike
the seventeenth it carries a finding of its own. The convergence
rule of 7a.3 was written for a **race** — two devices creating a
first entry at the same time, where no intent distinguishes them —
and it was then also asked to carry a **rotation**, which is the
opposite situation: there, one entry is meant to replace another.
Bytewise-smallest cannot say that. A holder rotating a carrier
nonce drew a fresh random value that won only if it happened to
sort lower, and an old entry returning from a partition heal or an
older backup pulled the register back to the superseded principal.
The entry therefore carries a **generation** now, the same
instrument Access §7.3 uses for the same purpose: canonical is the
highest generation, ties fall back to the bytewise rule, so a
rotation wins by construction and a concurrent first write is
still settled the way it was. And entries are **superseded rather
than deleted** — which is precisely what makes a returning old
entry harmless, since it arrives carrying a lower generation and
is superseded on every device by the same rule, with no tombstone
to invent and no resurrection to patch.


The nineteenth casting was again mostly a companion, and the
one thing it adds is a sentence rather than a rule. The fifth
round found that a neighbouring protocol may identify its direct
hop by something that changes while `C` does not — a TSP
intermediary VID under a stable configured carrier string — and
asked which of the two gives. Neither: the derivation is right to
ignore it, because a principal that moved when an unconfigured
hop moved would be tracking the network rather than the holder's
configuration, and that is exactly the property 7a.2 exists to
have. What was missing was the sentence saying so, and saying
whose problem the consequence is. 7a.2 now carries it; the
lifecycle it implies is Delivery 0.37 §5a.10.

Beside them, the Unicode 15.0 pin of 7a.2 is **shipped as data**
rather than delegated to the runtime's property tables (a pin
every implementation reads from its own ICU is not a pin), the
strict-UTF-8 step is stated for byte inputs with raw-byte
rejection vectors, and Section 16 gains the missing **relationship
axis** — same carrier, two nonces, two principals.

The companions above this layer: the **RLTP Encounter Layer 0.29**
(fresh always; 0.22 was the last converged Encounter), the
**RLTP Delivery Contract 0.37** (jointly cast),
**RLTP Membership Tasks 0.16**, **RLTP Access Layer 0.53**, and
**RLTP Network Visibility 0.16**; two
cross-document debts against Delivery and Access are recorded in
Section 7. *RLTP Succession* (0.2, parked) operates on the anchors
this document defines. It is cast against the requirements list of
the layer's decomposition (I-list Revision 3); Appendix B maps
every requirement to its section. Parts of the design are executed
by the graph simulator with real WebCrypto credentials — including
the Section 5.3 recovery rule and digest-form group labels against
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
Contract seals envelopes **to** that material, and presents the
**carrier-relationship identities** of Section 7a to the carriers
that hold its queues. Membership and Access
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
  identity: one group (their personal community among them), one
  relationship, one public persona.
- **Label**: the canonical string naming a context in the derivation
  (Section 6).
- **Label register**: the holder's list of used labels — data
  required for recovery, held inside the synchronized encrypted
  state. It carries no special mode: the recovery context is not a
  label (Section 5.3). The register additionally holds **entries
  that are not labels**: the relationship nonce of each pair label
  (6.1) and the carrier-relationship entries of Section 7a, each a
  distinct entry type that no derivation API ever accepts as a
  label.
- **Anchor**: the DID a person presents toward one context. Evidence
  accumulates on anchors.
- **Anchor key pair**: the Ed25519 assertion key pair of an anchor.
- **Key agreement key**: the X25519 key pair derived alongside each
  anchor for sealing (Section 5.2).
- **Recovery context**: the registry-external fixed derivation of
  Section 5.3 — the holder's zero-input entry point to their own
  encrypted state. **In its recovery role it is not an anchor**:
  that role carries no social surface, appears in no social
  artifact, and is presented only to the holder's own storage
  services. For a **native** recovery context (created under this
  casting or later) the role is the whole object — it is not an
  anchor at all. The historic recovery context of a **migrated**
  identity is additionally a legacy anchor: it exercises, but
  never extends, the social surface it already carries, and
  historic artifacts naming it stay verifiable forever (5.3,
  Section 10). Its primacy is a property of the derivation, not of
  the person.
- **Community anchor**: the anchor of the person's personal
  community — an **ordinary group-context anchor** (M-DID) over the
  personal community's genesis digest, serving, where its holder so
  chooses, as their private cross-relationship coordinate,
  disclosed selectively per recipient through the visibility layer.
  Ceremonies enact under fresh **pair** anchors (fresh always); no
  standing anchor appears on the ceremony wire.
- **Anchor classes, DTGWG-aligned naming** (informative): in prose
  this family calls pair-context anchors **R-DIDs**, group-context
  anchors **M-DIDs**, and persona anchors **P-DIDs** — the DTGWG
  classification, adopted without additions. (Castings up to 0.12
  named a fourth class of our own, the "self anchor" **S-DID** —
  a fusion of social surface and recovery root. The class is
  **withdrawn**: the fusion is dissolved into the recovery context
  and the community anchor above; the design journal records the
  analysis.) The registry labels above are the normative spelling;
  the class names are how we speak.
- **Service identity**: the derived pseudonym a person presents to
  infrastructure for one group (Section 7).
- **Carrier**: a party that holds delivery queues for other
  people — the Delivery Contract's adapter side, below its port
  line. A carrier is schlüsselblind: it sees addresses, sizes, and
  timing, never content.
- **Carrier controller identifier**: the canonical, byte-exact
  string by which a holder configures one carrier (7a.2). It is a
  configured string, never a resolution result.
- **Carrier-relationship identity** (the **control principal**):
  the derived Ed25519 pseudonym a person presents to **one**
  carrier for **one** relationship (Section 7a) — register-borne,
  never zero-input derivable, and named in no social artifact.
- **Holder**: the person controlling the mnemonic.

## 3. Creation, hierarchy, and human actions (normative)

### 3.1 Self-creation (A1)

An identity exists because someone brings it into existence — by
generating entropy, nothing more. No issuer, no registry, no domain,
and no service participates in creation or is a condition of
existence. An implementation MUST NOT require any online interaction
to create an identity or to derive any key.

### 3.2 The hierarchy

The hierarchy of `rltp-identity@0.28` has two levels:

```text
mnemonic → root IKM (64-byte BIP-39 seed; cold in principle)
 └── per context: anchor key pair (Ed25519) + key agreement key (X25519)
 └── per group:   service identity (Ed25519), Access contract
 └── per (relationship × carrier): carrier-relationship identity
                  (Ed25519), Delivery contract
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
  anchor — is **not part of this profile**. In `rltp-identity@0.28`,
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
| Full recovery (9.3) | "Enter your words on the new device" — synced state reachable | the recovery context locates and unlocks the state; every context — the personal community included — returns as the register loads | none |
| Partial recovery (9.3) | "Enter your words" — synced state gone | the recovery context reaches only storage, and no social anchor returns by itself; group and persona contexts — the personal community among them — return as counterparts re-supply their digests; **pair contexts do not return at all** | MUST say: without your synced data, nothing returns by itself; your people can re-supply your groups — your personal community included — and personas re-derive from their names; **relationship (pair) contexts cannot be re-supplied — those relationships are re-created, not recovered** (9.3), and their carrier registrations are made afresh under new principals (7a.3) |
| Join a group (6.1) | joining itself — no key step | the group appears | none (label handling is automatic) |
| Create a public persona (6.1) | "Create public profile" | publicly findable under the chosen name | publishing is forever — stopping does not unpublish (visibility layer) |
| Report loss or compromise (8.2, C1) | today: "meet your people again" — relations are re-witnessed by re-encounter (the B1 grade; B2 remains none); guardian succession is a **parked future function**, not offered | new edges accumulate on the new identity | a new identity is a new identity; nothing transfers by itself |
| Service identities (7) | *automatic* | none visible | none |
| Carrier-relationship identities (7a) | *automatic* — derived when a relationship first uses a carrier; **configuring the carrier** is the only human act, and it is an ordinary settings choice | none visible; the person's delivery relationships stay separate at that carrier | none for the derivation. A UI that offers to "move" a carrier MUST say that moving is a **new registration**, not a migration (7a.2) |
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

### 5.3 The recovery context — one fixed derivation, no new social surface

The recovery context does **not** derive through Section 5.1, and
**in its recovery role it is not an anchor**: in that role it is
the holder's zero-input entry point to their own encrypted state
and nothing else. For an identity created under this casting or
later the role is the whole object — the context is not an anchor
at all, in any role. For the **one** exception class, the historic
recovery context of a migrated identity, the same key is
**additionally** a legacy anchor that already carries social
surface (Section 10); the recovery role adds none to it, and
carries none of its own. A **native** recovery context (an
identity created under this casting or later) is presented only
to the holder's own storage services, never to a person, and
appears in **no** social artifact — no ceremony, no group
operation, no mapping, no card. For the **one** exception class —
the historic recovery context of a migrated identity — the
prohibition binds exactly the **acquisition of new social
surface**, never the exercise of surface already held: no new
ceremony, membership, relationship, mapping, card, or disclosure
is ever issued under it, while signing operations in groups whose
materialized membership already carries the historic anchor
remains conformant (Section 10 states the exact rules). The
social past of such an identity (edges, memberships, logs made
when it was the self anchor) remains valid and verifiable forever
(Section 10). A
derivation is all it is; its primacy is a property of the
derivation, not of the person.

For an identity **created under this casting or later**, the
recovery seeds are:

```text
edSeed(recovery) = HKDF-SHA-256(ikm = root IKM, salt = empty, info = "rltp/identity/recovery/v1", length = 32)
xSeed(recovery)  = HKDF-SHA-256(ikm = root IKM, salt = empty, info = "rltp/encryption/recovery/v1", length = 32)
```

For an identity **migrated from wot-spec v0.1 — or created under
any casting before 0.13** — the recovery seeds are the historic
strings of the deployed generation:

```text
edSeed(recovery) = HKDF-SHA-256(ikm = root IKM, salt = empty, info = "wot/identity/ed25519/v1", length = 32)
xSeed(recovery)  = HKDF-SHA-256(ikm = root IKM, salt = empty, info = "wot/encryption/x25519/v1", length = 32)
```

All four info **byte sequences are immutable**. There is nothing
for the label register to record about the recovery context and no
adoption state; after total loss a recovering holder derives
**both candidates** and locates state under whichever binds. The
probe is total and deterministic: **"binds" means a reachable
storage service holds sealed state registered to the candidate and
answers its possession challenge, and the fetched state decrypts
and verifies under the holder's keys — verification, not the
service's claim, is the bind** (a decoy bind whose state fails
decryption or verification is no bind). The probe's outcome set
is **closed and union-shaped**: each candidate independently
binds or does not; **every** verifying bind is recovered — state
is fetched and merged through the Replication Contract's
admission, never chosen between (an identity that verifies under
both rule sets recovers the union; recovery is never a
destructive choice) — and zero verifying binds is partial
recovery (9.3). Probe order is immaterial; the probe is socially
void (a storage lookup, not a recognition act), so the
two-generation split creates no ambiguity a person ever sees.
Discovery of the holder's storage services and the challenge
protocol are the storage contract's terrain — the **named, still
unwritten external prerequisite** of Section 6.3. This casting
fixes what this layer can fix: the contract's principal (the
recovery context), its outcome algebra (above), and the normative
chain seed → recovery context → sealed register → every context
(9.3). **The seed-plus-network totality claim is conditional on
that contract and stated as such**; today's implementations
satisfy it in fact with their deployed end-to-end encrypted
vault (6.3). From the decrypted register onward the chain is
fully specified here; above the register, rebind runs on the
Replication Contract's machinery (its I15). The historic bytes stay because the
deployed vaults are bound to them; the fresh `rltp/` strings end
the naming asymmetry the previous casting carried as a known cost.

**Two prohibitions guard the cut** (the fusion this section
replaces must not re-form):

1. The personal community is an **ordinary group**: its genesis
   MUST be an ordinary genesis and its anchor an ordinary
   `group/<genesis digest>` context (Section 6.1). No rule may
   make a social anchor derivable with no further input — a
   well-known fixed label or a fixed genesis construction would
   re-create the withdrawn fusion under a new name.
2. No protocol surface may ask any counterparty to verify a
   binding between the recovery context and any social anchor —
   the recovery root MUST NOT acquire a social surface, least of
   all during recovery. Social continuity after loss of **every**
   state copy is re-established by people (re-encounter; the
   parked succession function), never by a derivable coordinate.
   **What this prohibits is the acquisition of social surface,
   not the exercise of surface already held.** For an identity
   created under this casting the two are the same thing: its
   recovery context has no social past and never acquires one.
   For a **migrated** identity they are not (Section 10): the
   historic anchor already carries memberships and
   relationships, and continuing to act inside them is not the
   acquisition this prohibition names. Prospectively forbidden in
   both cases is every **new** binding and every **new**
   disclosure — a new membership, a new relationship, and any new
   mapping, card, or disclosure that names the recovery context.

The recovery context derives and encodes its X25519 key-agreement
key per Section 5.2's derivation and interchange rules — **but the
card-placement half of 5.2 does not apply to it**: no contact
card, mapping, or any social artifact is ever **newly issued**
carrying a recovery-context key (prohibition 2; historic
artifacts of migrated identities remain verifiable, Section 10).
**In the recovery role its keys meet exactly one counterparty
class, the holder's own storage services.** For a **native**
recovery context that is the only class they ever meet. For the
historic recovery context of a **migrated** identity the legacy
anchor role additionally meets the counterparties of the
attachments the key already holds — the co-members and
relationship parties of those existing groups and edges, and no
others; that set never grows, because acquiring a new attachment
is what prohibition 2 forbids (Section 10).

## 6. Context labels (normative)

### 6.1 The closed registry

The registry of `rltp-identity@0.28` is **closed**: exactly the
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
recovery semantics (Section 9.3). Encounter (fresh always, currently 0.29) enacts every ceremony under a fresh
pair anchor (its §4.4); the joint convergence loop with the
visibility layer is running.

The strings `self`, `recovery` and `carrier` — the last with or
without a further component — are **not labels**: the recovery
context has its own fixed derivation (Section 5.3) and the
carrier-relationship identity its own derivation outside this
registry (Section 7a), and a
derivation API presented with any of them — or with `device/…`, the
prefix still **reserved** for the successor of Section 15.1 — MUST
reject it like any unknown label. Service identities are NOT labels of this registry either;
they derive per Section 7. **The registry stays closed**: 7a adds a
derivation, never a label form, and the set of strings this table
accepts is unchanged from 0.13.

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
contexts. The **carrier-relationship entries** of 7a are the same
class and the more concentrated one: they name every carrier the
person uses and, per carrier, how many relationships it carries —
precisely the join the derivation of 7a exists to deny that carrier.
Therefore:

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
pseudonym** and MUST NOT present any personal anchor —
every anchor of Section 6, the community anchor included — to a
service. **Which** pseudonym is decided by what the interaction is
scoped to, and the two scopes are disjoint: an interaction on
behalf of **one group** uses the derived **service identity** of
this section; an interaction on behalf of **one delivery
relationship at one carrier** uses the **carrier-relationship
identity** of Section 7a. A service identity is never presented to
a carrier for delivery, and a carrier-relationship identity is
never presented in a group's service relationship. The one deliberate exception class is the **recovery
context** (5.3): in its recovery role it is itself
infrastructure-facing and is presented exactly to the holder's own
storage services, never elsewhere — for a **native** recovery
context that is its only presentation; the historic recovery
context of a **migrated** identity is additionally the legacy
anchor of the attachments it already holds and continues to appear
there (Section 10), which is not the presentation to a service
this section governs. This document adopts the Access Layer's frozen contract
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
  A future casting may add non-group scopes **to this derivation**
  only together with the Access Layer, in one move. Section 7a is
  not such a scope: it is a **separate derivation class** with its
  own prefix, its own inputs, and its own consuming contract
  (Delivery), and it leaves this section's info string, scope, and
  consumers untouched.
- Section 16 carries the seam vector: root IKM plus canonical
  genesis digest MUST produce the same service identity under this
  document and under Access §5.2, byte-exactly.

**Cross-document debts recorded here** (the companions are
converged; debts are discharged at their next castings, never by
patching):

- *Against the Delivery Contract:* **discharged (Delivery 0.22,
  26.08.2026; carried unchanged into Delivery 0.23–0.37)** — its §5
  expressly excludes the derived
  service identity as an `rkid` source (Ed25519-only, no
  sealing-to-service in the 0.x stack). Delivery 0.23–0.37 add the
  consuming contract of Section 7a and, with it, the second
  Delivery-side seam this layer now owns.
- *Against the Access Layer:* **discharged (Access 0.45+,
  26.08.2026)** — its §5.2 incorporates this document's §§4/7
  byte-exactly (root IKM, empty salt, info string, L = 32,
  canonical `u` digest) and names Identity as governing on any
  divergence.

## 7a. The carrier-relationship identity (normative)

### 7a.1 What it is, and the problem it answers

A **carrier** holds delivery queues for other people (Delivery
0.37 §5a). It is key-blind — it never reads a document — but it
sees who registers which addresses, and it sees who comes to
collect them. Section 7's service identity does not help here: it
is scoped to a **group**, and a delivery relationship is not a
group. Without a derivation of its own, the natural
implementation is the one the previous generation deployed: one
account per person, every address and every pickup under it. That
account *is* the person, and it hands the carrier the join for
free.

The goal is therefore not to hide from a carrier the relationship
it carries — the carrier of a relationship knows the relationship.
**The goal is that relationships do not converge into a person at
the carrier.** The instrument is one derived Ed25519 pseudonym,
the **control principal**, per (relationship × carrier):

```text
principal(C, N) = did:key of the Ed25519 key pair of carrierSeed(C, N)
```

The principal is what a holder registers under, queries under,
collects under, and concludes under, at that one carrier for that
one relationship. It is **Ed25519-only**: it signs and
authenticates, and it receives nothing — sealing stays at the
`rkid` of Section 5.2, and this section derives no key-agreement
material for exactly the reason Section 7 gives (a key no artifact
distributes and no rule binds would be surface without a
contract; the design a future flow would have to bring is 15.4's).

It is **registry-external**: no label of Section 6.1 names it, the
closed registry is unchanged, and — the point of the whole
construction — it is **not derivable with no further input**. A
zero-input derivable carrier identity would be a person-wide
constant, which is the account this section abolishes. That is the
sharp difference to the recovery context of 5.3, which MUST be
zero-input derivable because it is the entry to the person's own
storage before any register exists. Two derivations, two opposite
requirements; Delivery §5a.6 makes the consequence normative for
deployments where one process fills both roles.

### 7a.2 The carrier controller identifier (byte-exact)

`C` is the **canonical identifier string of the carrier**, as the
holder has configured it. Its comparison rule is **exact byte
equality of the UTF-8 string — no normalization of any kind**: no
case folding, no percent-decoding, no default-port or
trailing-slash equivalence, no alias, no DID resolution, and never
"the next hop". This is the rule Access §7.3 already imposes on
its `service` field, adopted here verbatim and for the same
reason: two strings that differ in any byte name two carriers.

- A holder MUST configure exactly one canonical string per carrier
  (RECOMMENDED: a DID or an absolute `https` URI) and MUST derive
  from that string's bytes only.
- A proxy, a mirror, or a federation member is the **same** carrier
  exactly when the holder configured the **same string** — and a
  different carrier otherwise. The identifier is a configuration
  fact of the holder, never a property discovered from the network.
- **Controller key rotation is without effect on the principal.**
  The input is the string, not the carrier's key material; a
  carrier that rotates every key it holds still faces the same
  principals.
- **A neighbouring protocol's hop identifier is adapter-local and
  enters nothing here.** A proxy, a federation member, a key
  rotation — and, at the transport below, the concrete peer a
  neighbouring protocol identifies its direct hop by (a ToIP/TSP
  intermediary VID, a DIDComm connection DID) — may all change
  while `C` does not, and therefore while the principal does not.
  That is the intended behaviour and not an oversight: the
  principal is the identity a **holder** presents to a carrier it
  **configured**, so it must not move when something the holder
  did not configure moves underneath it. The consequence for the
  adapter — a fresh hop identifier succeeding a retired one, with
  the principal and its registration unchanged — is **Delivery
  0.37 §5a.10**, and it belongs there because it is a fact about a
  neighbouring protocol's relationship, never about this
  derivation.
- **A move is a new registration, not a migration.** Changing the
  configured string derives different principals, and the holder
  registers afresh at the new string. This is the honest price of
  byte-exactness: the alternative — normalization or aliasing —
  is precisely the seam at which one carrier could make two
  configured names collide into one principal set, or two carriers
  could be told apart by nothing the holder controls.

**The grammar of `C`, byte-precisely.** Byte-exact comparison is
only half a rule: it says how two accepted strings are compared and
nothing about which strings are accepted at all. Without the second
half, one implementation rejects an ill-formed input, another
replaces it with U+FFFD, a third passes the raw bytes through — and
the three derive three different principals from what a holder
believes is one configured carrier. RFC 8259 §8.2 names exactly
this class of divergence for unpaired surrogates. `C` therefore has
the same kind of **ordered, normative validation pipeline** that a
persona name has in 6.2, minus the one step that would defeat the
purpose:

1. The configured input MUST be a valid sequence of **Unicode
   scalar values** — well-formed UTF-8, no surrogate code point
   (U+D800–U+DFFF) whether paired or unpaired, no over-long
   encoding, no truncated or stray continuation byte, no code
   point above U+10FFFF. An input that is not is **rejected**,
   never repaired: an implementation MUST NOT substitute U+FFFD,
   strip, or otherwise coerce it. **Where the input arrives as
   bytes** — a configuration file, an environment variable, a
   pasted value, a network response — this step is a **strict
   UTF-8 decode** performed on those bytes and MUST fail rather
   than produce a replacement character; where it arrives as a
   string in an environment whose strings are UTF-16 code-unit
   sequences, the same rule reads as: no unpaired surrogate. The
   two readings accept the same set, and Section 16 carries the
   raw-byte rejection vectors that make that testable rather than
   assumed.
2. **No normalization step exists.** This is the deliberate
   difference to 6.2, and the reason the pipeline is written out:
   6.2 applies NFC because a persona name is a human-chosen name;
   `C` is a machine identifier a holder configured, and the whole
   force of 7a.2 is that its bytes are taken as configured. Two
   inputs that differ only by normalization form are **two
   carriers**.
3. Length: at least 1 and at most **1024 UTF-8 bytes**. The empty
   string is not a carrier identifier, and the upper bound exists
   so that "canonical string" cannot become "unbounded blob"; a
   value outside the range is rejected.
4. No code point of category **Cc** (control) or **Cf** (format),
   and no `U+0009`–`U+000D`, `U+0020`, or other `White_Space` code
   point anywhere in the string — leading, trailing, or interior.
   An identifier that differs from another only by an invisible or
   whitespace code point is a configuration accident, not a second
   carrier, and the pipeline refuses to make it one. Unicode
   properties are evaluated against **Unicode 15.0** data, the
   same pin 6.2 carries and for the same reason.

   **The pin is shipped, not merely asserted.** A rule that says
   "Unicode 15.0" while every implementation reaches for its
   platform's property tables is a pin in name only — a runtime on
   a later Unicode version silently accepts or rejects a different
   set, which is precisely the derivable-set divergence the pin
   exists to prevent. `Cc` needs no table (it is `U+0000`–`U+001F`
   and `U+007F`–`U+009F`, fixed for all time) and `White_Space` is
   a short closed list, but **`Cf` grows between versions**.
   Section 16's vector file therefore carries the **enumerated
   Unicode 15.0 `Cf` and `White_Space` ranges** as data, and a
   conforming implementation MUST evaluate this step against those
   ranges rather than against whatever its runtime happens to
   ship. An implementation whose platform tables disagree with the
   shipped ranges is not thereby wrong about Unicode; it is wrong
   about **this profile**, and the shipped ranges govern.
5. The accepted input **is** the canonical string; derivation uses
   its UTF-8 bytes, unchanged, and comparison of two accepted
   strings is byte equality (the rule above).

Validation runs **before** any use: before storing the
configuration, before comparison, and before the UTF-8 bytes enter
`Dc` in 7a.4. A holder MUST NOT derive a principal from an input
that fails any step — there is no "derive anyway and see"; a failed
input has no principal. Implementations SHOULD surface the failing
step, because a configured carrier identifier is a thing a person
typed or pasted, and "invalid" without a reason is a support call.

### 7a.3 The relationship's carrier nonce, and its register entry

`N` is a **32-byte nonce of the relationship**, generated fresh
from a cryptographically secure source when the relationship first
uses any carrier, and recorded in the holder's label register as
its own entry type (Section 2, 6.3) — data, like every register
entry, never a secret in its own right and never on the wire. The
entry is a pair `{nonce, generation}`; only the `nonce` enters the
derivation of 7a.4, and the `generation` — an integer in the
closed domain `[1, 2^53 − 1]`, below — exists solely to make the
register's own convergence and rotation decidable.

- `N` MUST NOT be the pair-label relationship nonce of 6.1, MUST
  NOT be derived from it, and MUST NOT be derived from any anchor,
  `rkid`, contact card, or from `C`. It is a sibling of the pair
  nonce, not a function of it. A carrier is the one party that
  reliably sees both a principal and the `rkid`s it registers; any
  computable relation between the two would hand back exactly what
  the derivation withholds.
- **One nonce per relationship, across carriers.** The carrier
  identifier is what separates carriers (7a.4), so a relationship
  carried by three carriers needs one register entry, not three,
  and the three carriers see three principals with no computable
  relation between them.
- **The relationship, not the enactment.** Under fresh-always
  (Encounter §4.4) a relationship is the holder-local chain of pair
  contexts with one active head (`rltp-visibility` §6a); `N`
  belongs to that **chain** and survives a fresh pair context. A
  re-encounter therefore does not force a re-registration. Stated
  honestly: the carrier consequently sees one principal across the
  chain — that is one relationship at one carrier, which is what
  the carrier carries, and it is not a join across relationships.
- Loss and recovery follow 9.3; the carrier-side aging of the
  principals a lost register leaves behind is Delivery §5a.9.

**Two devices, one relationship, two fresh nonces — and why that
is not a fault (normative).** This profile is a **shared-seed
multi-device** model (3.2): every device of a person derives the
same keys and holds the same register, synchronized through the
person's encrypted state. The storage contract that synchronizes
it is a named, still unwritten external prerequisite (6.3), so it
offers no transaction across devices — and "generated fresh when
the relationship first uses **any** carrier" is a write that two
partitioned devices can perform at the same time, each perfectly
honestly, each producing a valid `N`. A rule that treated that as
an error would **criminalize honest parallel devices**, which is
the lesson this stack has already paid for once. It is treated as
what it is: an ordinary **register merge**, resolved by a rule
both devices can evaluate alone.

> **The register entry is `{nonce, generation}`, and the
> convergence rule (MUST) reads both.** A carrier-nonce entry
> carries its 32-byte `nonce` and an integer `generation` in the
> closed domain **`1 ≤ generation ≤ 2^53 − 1`** (9 007 199 254
> 740 991), written as a JSON integer with no sign, no leading
> zero, no fractional part and no exponent.
> Where a register holds more than one entry for one relationship,
> exactly one is **canonical**: the entry with the **highest
> `generation`**; among entries of equal generation, the one whose
> 32 nonce bytes are **smallest in unsigned bytewise order**.
> Every other entry for that relationship is **superseded**. Every
> device MUST apply this rule, and every device holding the same
> entry set reaches the same answer — no clock, no device
> identity, no coordination, and no last-writer.

**Why two fields and not one.** Bytewise-smallest alone answers
one question and silently fails the other. It settles a *race* —
two devices writing a first entry at the same time, where no
intent distinguishes them and any total order will do. It cannot
express an *intention*: a holder who deliberately rotates `N`
draws a fresh random value that replaces the old one only if it
happens to sort lower, so a rotation succeeds about half the time
and is otherwise silently undone — and a superseded entry
reappearing after a partition heal or a restore from backup would
drag the register back to the old principal. The generation is
what carries intent, and it is the same instrument Access §7.3
uses for exactly the same purpose.

- **Rotation is `generation + 1`.** A holder rotating a
  relationship's carrier nonce writes a fresh random `nonce` with
  a `generation` one higher than the highest it holds for that
  relationship. It wins by construction, whatever the bytes sort
  like.
- **At the top of the domain, rotation ends — and nothing else
  does (MUST).** A closed domain has a last value, and a rule
  that says "always one higher" owes an answer there: an entry at
  `2^53 − 1` cannot be rotated, because `2^53` is invalid and MUST
  be rejected rather than clamped. What follows is deliberately
  *small*, and a previous casting made it too large by instructing
  the holder to "re-address" through a fresh pair context — which
  **is not a move a holder can make**. Under fresh-always
  enactment a pair context arises only from a ceremony or an
  introduction act, and the continuity machinery then decides what
  it belongs to: `rltp-visibility` §6a runs its probe on **every**
  enactment and **chains a recognized re-encounter back to the
  existing relationship**, so "a new chain" is the outcome of
  *not* recognizing a counterpart, never a state a party who still
  recognizes them can elect. Instructing a holder to produce one
  was instructing them to do something the companions do not
  offer. The terminal rule is therefore stated as what it is:

  1. **The entry at the maximum stays canonical and keeps
     working — indefinitely.** Nothing expires, nothing degrades,
     no principal is lost. Rotation is a convenience of this
     register, not a condition of the relationship, and running
     out of it costs exactly that convenience. **This holds even
     where two entries tie at the maximum**, which is the one
     situation in which the canonical entry is *not* the one a
     carrier is bound to: because entries are **superseded, never
     deleted** (below), every device retains the bound entry and
     can derive its principal, so collection and conclusion
     continue unaffected. Canonicality decides which entry is
     authoritative for **new** derivations; it never meant that a
     superseded principal stops working where it is already bound.
     Delivery 0.37 §5a.3 carries the same sentence from the
     carrier's side.
  2. **Further rotation of `N` for this relationship chain is
     over.** A generation beyond the maximum is invalid on every
     device by 7a.3's domain, so no register can be brought into a
     state where devices disagree.
  3. **What a holder *can* still do, from here, without any
     companion's help:** change the configured carrier identifier
     (7a.2) — a **move is a new registration**, and it derives
     different principals at a different `C` without touching `N`
     at all. That is the register-level lever that remains, and it
     is a configuration act the holder owns outright.
  4. **A genuinely new relationship chain is a social event, not
     a register operation**, and this document neither commands
     nor simulates one: it arises where a fresh enactment's
     continuity probe finds no match, or through a new
     introduction act (Encounter §4.4, `rltp-visibility` §6a). If
     it happens, `N` belongs to the chain (above), so the new
     chain opens its own entry at `generation` 1 — as a
     consequence, not as an instruction.

  **Honestly labelled:** this is a *theoretical* closure. A
  relationship would have to rotate its carrier nonce every second
  for roughly a hundred million years to reach the maximum. The
  rule exists so that the domain has no undefined corner and no
  device can be pushed into an invalid one, not because anyone
  will ever stand in it — and that is exactly why it must not
  demand machinery the neighbours do not have.
- **Concurrent first writes are still decided by the bytes.** Two
  devices both writing generation 1 tie on generation, and the
  bytewise rule settles it — the race case is unchanged, which is
  why both halves of the rule are needed rather than either alone.
- **Two devices may rotate concurrently to the same generation.**
  That is a race again, at a higher generation, and it resolves
  the same way: equal generation, bytewise-smallest wins, the
  other is superseded. No rule is needed beyond the two already
  given.

**Why that domain, and why it is stated at all.** `generation`
decides which `N` — and therefore which principal — is canonical,
so two implementations that disagree about a number disagree about
an identity. "An integer ≥ 1" left both an upper end and a
representation open, and the two failures compound: at
`2^53` a runtime using IEEE-754 doubles cannot distinguish
`9007199254740992` from `9007199254740993`, so it reads a genuine
rotation as a tie and hands the decision to the nonce bytes, while
an implementation using arbitrary-precision integers reads the
same two entries as a clear succession. Same register, two
canonical principals. The bound is therefore set at exactly the
largest integer every JSON implementation represents exactly:
**no implementation needs arbitrary precision, and none may use it
to go further.** An entry whose generation lies outside the domain,
or whose encoding is not the canonical integer form above, is
**invalid** and MUST be rejected on arrival rather than clamped —
clamping would silently manufacture the tie the domain exists to
prevent. Section 16 carries the boundary vector.

The headroom is not a constraint in practice: a relationship would
have to rotate its carrier nonce every second for a hundred
million years to reach it. The domain exists to make disagreement
impossible, not to ration rotations.

**The tie is settled here, and this register carries no value
that would settle it elsewhere.** Where two entries share a
generation, the nonce bytes decide (above). A previous casting
called that decision *impossible* to reproduce outside this
register and gave an argument that does not hold — a
carrier-scoped order-preserving map exists trivially — so the
categorical claim is **withdrawn** here as it is in Delivery
0.36 §5a.3. What stands is the rule and its reason: **no value
derived from the nonce ordering travels in any artifact of this
stack**, because such a value would have to be authentically
bound to the derivation and analysed for what it discloses to a
party that already sees the principal and the address, and no such
construction is designed. A holder therefore MUST NOT place one in
a carrier proof, and a carrier cannot decide the tie. What happens instead is Delivery 0.37 §5a.3's: the
carrier refuses the equal-generation rebind, that refusal is a
**wait state**, and the canonical device resolves it with an
ordinary rotation to `generation + 1`, which both this register
and the carrier accept by the rules they already have.

**The ordering is local, so it must travel (MUST).** Everything
above decides which entry a *register* treats as canonical, on
each device, from the entries it holds. That is enough for the
register and **not** enough for anything outside it: a device
restored from an older state copy still holds the root IKM, the
older nonce, and the relationship's `rkid` private key, so it can
derive a superseded principal and prove everything a carrier asks
of it. Local ordering alone would let such a device roll a
carrier's binding **back**, and the newer device roll it forward
again, indefinitely. Therefore the generation does not stay
inside: **a holder MUST carry the canonical entry's `generation`
in the carrier registration proof** (Delivery 0.37 §5a.3), and a
carrier binds only on a strictly higher generation than the one it
last accepted. What this register supersedes, the carrier refuses
to resurrect — and the sentence in the bullet below ("superseded
on every device") is true of the register *because* the value
that decides it is the one that travels.

**Entries are superseded, never deleted (MUST)** — a rule about
*this register*, and one whose carrier-side counterpart is
deliberately different: a carrier releases a binding at the end of
its wind-up and keeps only a tiny **binding tombstone**
(`rkid` and the highest generation it ever accepted, Delivery
0.37 §5a.3) — which does not expire in time and is bounded only by
that contract's declared tombstone capacity — and which is what
stops a superseded generation from being re-installed after the
binding is gone. Here nothing is
released, so nothing needs a tombstone. A device MUST
retain a superseded entry rather than removing it, and MUST NOT
treat its reappearance as new information. This is what makes the
rule safe against the two ways a stale value comes back — a
partition healing and a restore from an older state copy — and it
is why no tombstone is needed: a returning old entry carries a
**lower generation** and is therefore superseded on arrival, by
the same rule, on every device. Deleting entries would reintroduce
exactly the resurrection problem tombstones exist to patch.

Three consequences, stated so that nobody has to derive them:

- **"One nonce per relationship" is a convergence property, not a
  precondition.** The rule says what the register settles on; it
  does not claim that a transient second entry cannot arise.
  Implementations MUST NOT reject or discard a second entry on
  arrival — it is evidence of a concurrent honest write or of a
  rotation, and discarding it before the rule runs makes two
  devices converge on two different answers.
- **A superseded nonce is not undone at the carriers.** Whatever
  was already registered under a principal derived from it stays
  registered: the holder re-registers the relationship's addresses
  under the canonical principal, and the superseded principals
  become **orphans** in the ordinary sense of Delivery §5a.9 —
  they age out on the carrier's published horizon under its
  two-phase wind-up, and everything admitted under them reaches
  its give-up conclusion first, so nothing is silently lost. Where
  the relationship's `rkid` is still held (and it is: neither a
  race nor a rotation costs a pair context), that re-registration
  is the **rebind** of Delivery §5a.3, which is exactly what
  rebind is for. This is unchanged by the generation: the
  generation decides *which* entry is canonical, never what a
  carrier already holds.
- **Bytewise-smallest as the tie-break, and why that and not
  another.** It is total over 32-byte values, needs nothing but
  the entries themselves, and is stable under re-evaluation. It is
  deliberately **not** "the earliest" (there is no trustworthy
  time across devices), **not** "the first synchronized" (that is
  the storage layer's arrival order, which differs per device),
  and **not** "the one whose principal is already registered"
  (which would make the register's convergence depend on what a
  carrier happens to hold).

### 7a.4 The derivation

```text
carrierSeed(C, N) = HKDF-SHA-256(ikm = root IKM, salt = empty,
                                 info = "rltp/v1/carrier-relationship/ed25519/v1/" || Dc || Dn,
                                 length = 32)
```

where, with the **encoding of 6.1** (`u` followed by the canonical
unpadded base64url of a `sha2-256` multihash — bytes `0x12 0x20`
followed by exactly 32 digest bytes, **exactly 47 ASCII characters**
in every case):

- `Dc` is that encoding of `sha2-256` over the **UTF-8 bytes of
  `C`**, the carrier controller identifier of 7a.2;
- `Dn` is that encoding of `sha2-256` over the **32 raw bytes of
  `N`**, the carrier nonce of 7a.3 — the same construction 6.1
  applies to a pair nonce, over a different nonce.

The principal is the Ed25519 `did:key` of `carrierSeed(C, N)`
(Section 8.1). No X25519 key is derived (7a.1).

**Why this info string cannot be ambiguous** (the argument
Section 5.1 makes for labels, made here for two inputs):

1. The prefix `rltp/v1/carrier-relationship/ed25519/v1/` is a
   literal ASCII constant with no variable part, and it differs
   from every other derivation family of this document —
   `rltp/anchor/ed/`, `rltp/anchor/x/`, `rltp/v1/service-identity/`,
   and the four fixed recovery strings of 5.3 — **before any
   variable part begins** (Section 13 keeps the full list). No
   choice of `C` or `N` can reach another family.
2. Both variable parts are **length-fixed**: 47 characters each,
   from base64url's fixed alphabet, by construction of the
   encoding. The split point is therefore determined by position
   alone: every info string of this family parses back into
   **exactly one** pair `(Dc, Dn)`, and distinct digest pairs
   therefore always yield distinct info strings. Concatenating two
   *variable-length* strings would have been ambiguous — the
   classic failure this rule exists to exclude.

   **What that argument does and does not prove, stated exactly**,
   because the difference has been miscast before: length fixing
   removes **parse ambiguity**, not hash collisions. `Dc` and `Dn`
   are `sha2-256` digests, and SHA-256 is not injective; it is
   *collision-resistant*. The honest chain is therefore three
   links, not one: (i) the multihash encoding of 6.1 is injective
   over digest bytes (fixed prefix `0x12 0x20`, fixed 32-byte
   digest, canonical unpadded base64url — one encoding per digest,
   one digest per encoding); (ii) the concatenation is unambiguous
   by the positional argument above; (iii) two distinct inputs
   reaching one digest — a different `C` colliding on `Dc`, a
   different `N` colliding on `Dn` — is a **SHA-256 collision**,
   computationally infeasible under the assumption this whole
   document already rests on (Section 12), and not a property this
   construction adds or could add. So: **distinct pairs `(C, N)`
   yield distinct info strings except under a SHA-256 collision**,
   and an implementation that ever observes two distinct `(C, N)`
   pairs deriving one info string MUST treat it as such — fail
   closed, derive nothing, and surface it — rather than resolve
   the ambiguity in either direction.
3. Implementations MUST build the info string from the canonical
   47-character encodings and MUST NOT insert separators, lengths,
   or padding of their own: the bytes above are the whole contract,
   and a self-invented delimiter derives a different, non-conformant
   principal.
4. The **suite is in the prefix**. This derivation is Ed25519-only;
   a future signature suite, and any future key type for this
   class, gets a **future prefix** through a new casting — never a
   parameter inside this one.

Derivation is deterministic and lazy, exactly as in Section 5.1: a
principal exists the moment `(C, N)` is first derived and
re-derives identically forever after. Section 16 carries the
vector.

### 7a.5 Prohibitions

These are the section's normative core; each answers a way the
construction is defeated from the side.

1. **No computable relation to the addresses it registers.** No
   `rkid`, pair context, anchor, or card may be derived from a
   principal, and no principal may be derived from any of them
   (7a.3). The carrier is the one party that sees both.
2. **No zero-input derivability** (7a.1). An implementation MUST
   NOT substitute a fixed string, a person-wide constant, an
   anchor, or any value derivable without the register for `N`.
3. **The principal is never social.** No artifact a person sees
   names it: it appears in no card, no credential, no mapping, no
   group operation, and no disclosure — the same prohibition the
   recovery context carries (5.3), for the same reason. A protocol
   surface that asked a counterparty to verify a binding between a
   principal and any anchor would re-create the account this
   section abolishes.
4. **One principal, one relationship, one carrier.** An
   implementation MUST NOT present one principal to two carriers,
   MUST NOT present one principal for two relationships, and MUST
   NOT reuse the recovery context (5.3) or a service identity
   (Section 7) as a principal. What a carrier may and may not ask
   of a principal, and the role separation that keeps storage
   entry and delivery pickup apart in a process that is both, is
   Delivery 0.37 §5a.6.

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
  anchor, while a root compromise affects every context — recovery,
  and every persona anchor of the person at once.

### 9.3 What the mnemonic restores

The mnemonic reconstructs **key material, not state**.
Implementations MUST make this distinction, and user interfaces
SHOULD state it plainly:

Restored by the mnemonic alone: every anchor key pair, key agreement
key, and service identity — **for every label the holder can name**
— and every carrier-relationship principal (7a) for every pair
`(C, N)` the holder can name.

NOT restored by the mnemonic — this is data state, held and
synchronized by the layers above:

- the **label register** (which groups, which personas). Without
  it, the holder knows how to derive but not what to derive.
  Implementations MUST persist the label register in the holder's
  synchronized encrypted state (6.3), and recovery UIs MUST treat
  "mnemonic present, register lost" as **partial recovery** (3.3):
  the recovery context is always derivable — it needs no register
  entry (5.3) — and with any state copy it unlocks, the register
  and every context return; without one, labels are re-learnable
  from counterparts (a group re-supplying its digest — the
  personal community like any group — a persona's own publication)
  and return as they are re-learned; the rest is not enumerable.
  Partial recovery is deterministic: the recovery-context
  candidates are the two fixed rule sets of 5.3, never a holder's
  choice. **Pair labels are the honest limit of
  re-learning:** the relationship nonce exists nowhere but in the
  holder's register — a counterpart holds the derived anchor, not
  the label. With the register lost, a pair anchor is
  unrecoverable-but-replaceable: the relationship is re-created —
  by a new encounter (Encounter §4.4, fresh always) or a new introduction act —
  and whatever standing the old pair anchor carried follows the
  visibility layer's disclosure rules, not a re-derivation.
- the **carrier nonces** of 7a.3 and the configured carrier
  identifiers of 7a.2. Both are register and configuration, not
  key material, and both behave exactly like the pair nonces
  beside them: the recovery context of 5.3 is derivable without
  them, and with any state copy it unlocks, the register returns
  and every principal re-derives — including after a device loss,
  which is the ordinary case and needs no carrier interaction at
  all. **Without a state copy there is no re-learning path**: a
  carrier holds the principal, never the nonce, and a carrier that
  offered to hand a person "their" principals back would be
  answering the very question 7a.5 forbids anyone to ask. So the
  honest rule, symmetric to the pair labels: a lost carrier nonce
  is **unrecoverable-but-replaceable** — the holder generates a
  fresh `N` for that relationship, registers the relationship's
  `rkid`s afresh at each carrier under the new principals, and the
  old principals **become orphans at the carrier**, holding a queue
  nobody will ever collect. Because that surface would otherwise
  grow monotonically, a carrier MUST publish an aging rule for
  uncollected principals as a declared constant; that duty and its
  constant live in Delivery 0.37 §5a.9, not here. **What that rule
  is worth knowing here:** ageing is a two-phase wind-up, not a
  deletion at a deadline — the queue stops accepting new deposits,
  everything already admitted is concluded or given up, and only
  then are queue and binding released. For a person that has one
  practical consequence: **coming back late is not fatal.** A
  holder who recovers a state copy after the horizon has passed
  can still present the proofs, and the binding returns to normal
  service; what was already concluded stays concluded.

  **Which of the two losses happened decides whether the addresses
  survive, and that decides everything downstream** — the point is
  stated here because the delivery side depends on it and got it
  wrong once. The `rkid` of a relationship is the key-agreement key
  of a **pair context** (5.2), so its private half lives or dies
  with the pair nonce in the bullet above, not with the carrier
  nonce in this one:
  - **Carrier entries lost, pair contexts held** — the partial
    case, and the ordinary one: a nonce entry corrupted, a
    selective restore, a deliberate rotation of `N`. The addresses
    are intact and their private keys are held, so the holder can
    prove possession of them and re-registers under the new
    principals; Delivery §5a.3's **rebind** is exactly this path.
  - **The whole register lost with no state copy** — then the pair
    contexts are gone **too**, and with them every `rkid` private
    key. A counterpart's copy of an address is the **public**
    value; it re-derives nothing. There is therefore **no rebind
    after total register loss**: the relationship is re-created and
    re-addressed by the bullet above, the old queues are collected
    by nobody, and they end as orphans on the carrier's horizon
    with their contents given up first (Delivery §5a.8/§5a.9).
    Anything that promised a return path here would be promising a
    proof the holder cannot construct.
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
- The recovery context of every **pre-0.13** identity derives with
  exactly the historic info strings (Section 5.3). The migrated
  person's existing anchor therefore *is*, byte-identical, their
  recovery context under this document — its storage-entry role
  continues unchanged, and no register entry, mode, or adoption
  step exists. What ends is prospective and social: the historic
  anchor acquires no **new** social attachments; the person's
  personal community is founded (or continues) as an ordinary
  group, and the community anchor takes over the
  cross-relationship role via the visibility layer's disclosure
  acts.
- New contexts of a migrated person MUST use Section 5.1
  derivation. Existing edges, memberships, and logs of the
  one-context world remain attached to the historic anchor — they
  were made under it and the documents are immutable; groups
  joined after adoption use `group/<digest>` anchors. Both states
  are legitimate and permanent (for migrated identities the
  recovery context **has** a social past; for identities created
  under 0.13 it never does).
- Section 16's recovery vector *is* the migration vector: mnemonic →
  the historic derivation → the anchor a deployed identity already
  has.

**What "mute" means, exactly (normative).** Prospectively the
historic recovery context is **mute — it forms no new binding and
appears in no new disclosure. It is not silenced inside the
bindings it already has.** Three rules, in that order:

1. **Exercising existing attachments stays conformant.** A
   migrated person keeps signing operations in every group whose
   materialized membership already carries the historic anchor,
   and keeps acting in the relationships that anchor is already a
   party to. Access §5.1's scoping property governs the
   **derivation** of member anchors; it is not a re-admission
   requirement for an anchor a roster already holds. The historic
   anchor **is** the member anchor those groups admitted and
   stays a current member until an ordinary membership event ends
   that. Continuing an existing social surface is not acquiring
   one — prohibition 2 of 5.3, read exactly.
2. **Every new binding and every new disclosure is forbidden.**
   No new membership under the historic anchor, no new
   relationship under it, and no new mapping, card, or disclosure
   naming it: a `member-mapping@1` (Access §5.5), a
   `self-card@1` or `anchor-mapping@2` (`rltp-visibility` §6), or
   any other artifact whose fields name the historic recovery
   context is nonconformant from this casting on. Old artifacts
   naming it remain verifiable as history, forever.
3. **The prospective transition, named and unforced.** New
   memberships are entered under `group/<genesis digest>` member
   anchors (6.1), and the cross-relationship role moves to the
   community anchor — disclosed per co-member as
   `member-mapping@1` and per contact as `anchor-mapping@2`,
   always under the **new** anchors. **No re-joining is forced.**
   A legacy attachment MAY persist until its own group or its own
   relationship migrates to new anchors, and that migration is
   that group's or those two people's act — an ordinary
   membership event, an ordinary re-encounter or introduction —
   never a duty this document imposes with a deadline. What the
   visibility layer decides is linking among the person's
   **social** contexts, the community anchor included, exactly as
   for any two contexts; the historic recovery context is not
   among them.

## 11. Profile properties — the graded table (normative honesty)

The decomposition grades every identity profile on four functional
properties (B1–B4). Which grade a group requires is that group's
policy, not this protocol's. The native profile of this casting
(BIP-39 · HKDF labels · Ed25519/X25519 · `did:key` ·
`eddsa-jcs-2022`) grades as follows, and implementations claiming
`rltp-identity@0.28` claim exactly these grades — no better:

| Property | Grades (best → weakest) | **Native profile 0.28** |
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

The profile `rltp-identity@0.28` is claimed by an implementation
that:

1. creates identities per Section 3.1, presents human actions per
   3.3, and implements the mnemonic/root-IKM contract of Section 4,
2. derives contexts per Section 5 (both seeds, and the key
   agreement chain of 5.2 through to the contact-card multikey —
   for labeled contexts; the recovery context derives the same
   way but is never **newly** placed in a card — historic cards of
   migrated identities remain verifiable, 5.3, Section 10),
3. enforces the closed registry and grammar of Section 6 with
   rejection before derivation, and stores the label register per
   6.3,
4. derives service identities per Section 7, and
   carrier-relationship identities per Section 7a — including the
   byte-exactness rule of 7a.2, the nonce independence and
   per-relationship scope of 7a.3, the length-fixed info string of
   7a.4, and the four prohibitions of 7a.5,
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
  derives the recovery-context candidates with certainty — a
  storage-entry coordinate, not a social anchor — and can *confirm* any
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
  the fixed recovery strings (both generations, 5.3) such as `wot/identity/ed25519/v1` and
  `wot/encryption/x25519/v1` (5.3),
  `rltp/v1/service-identity/` (7), and
  `rltp/v1/carrier-relationship/ed25519/v1/` (7a). Their literal prefixes are
  pairwise distinct before any variable part begins (the fixed
  recovery strings contain no variable part at all), so no label or
  digest choice can collide two families; Section 5.1's argument
  records why no input can collide two labels within a family
  either, and 7a.4's why no pair of inputs can collide two
  principals within the carrier family — the one family with **two**
  variable parts, both length-fixed for exactly that reason.
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
- **A carrier of one relationship sees one pseudonym — by design,
  and that is the whole claim.** The carrier-relationship identity
  (7a) is per *(relationship × carrier)*: a carrier cannot join two
  of a person's relationships through the identities it is shown,
  and two carriers of the same relationship see two principals with
  no computable relation. What it does **not** claim: it does not
  hide the relationship from the carrier carrying it (the carrier
  of a relationship knows the relationship), and it does not touch
  the correlations that need no identity at all — timing, volume,
  the collection pattern of a device that serves many principals in
  one session, the network layer, or two carriers comparing notes.
  Delivery 0.37 §10 states those residuals where they are paid; the
  derivation closes the **list join**, not traffic analysis.
- **The register is where the carrier picture reassembles.** The
  carrier-relationship entries (6.3) hold, in one place, every
  carrier the person uses and every relationship each one carries —
  the join the derivation denies each carrier individually. Its
  leakage is the same class as the label register's leakage, and
  the same rule protects it.
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
  *alone* proves less: the recovery context and any label the holder can
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
| recovery, historic strings (5.3 — every pre-0.13 identity; also the migration vector) | `wot/identity/ed25519/v1` | `did:key:z6Mko3ZEjKJWQAM5nDXKoZ9jErvvxbWbYgS8KJXYpC5Hbu8a` | `z6LSqA7sbKGK3WVHP9SBcmv9ikp19iDNb1P5Q315kRPQrcTV` |
| recovery, `rltp/` strings (5.3 — identities created under 0.13+) | `rltp/identity/recovery/v1` | `did:key:z6MkroYXLjZhtyy74Y1Wg1vaW1zTBetwgaHS9xvcAKMxpHfj` | `z6LScSadCGjgAHFhaMs2MWa8kucJG1KheG3vqjaqnhbP4kBg` |
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
- **Carrier-relationship seam (7a), three executable cases** under
  one documented 32-byte carrier nonce
  (`4317e83f…35937b`, whose digest is
  `uEiARyBeBGoLeFlKIajBVjNixpsQkyp4HupNXzStv37vlvw`): the same
  relationship at `did:web:carrier.example` →
  `did:key:z6MksbsC5mWfC3yPwQCayCqtQFGFkxge8FBqdXYgbxxWMqPF`; at
  `did:web:other-carrier.example` → a **different** principal
  (one nonce, two carriers, no computable relation); and at
  `did:web:Carrier.example` → a **third** principal, because 7a.2
  compares bytes and folds no case. The file carries both digests
  and the full info string of each case; a conforming
  implementation MUST reproduce all three and MUST derive **no**
  key-agreement key for this class (7a.1). Both info parts are 47
  characters in every case — the length-fixedness of 7a.4 is
  checked, not assumed.
- **Carrier identifier grammar (7a.2), executable:**
  `carrierRelationship.identifierGrammar` carries the acceptance
  and rejection sets of the validation pipeline — accepted:
  ordinary DID and `https` forms, a case variant, and **both** the
  NFC and NFD spellings of one accented name; rejected: the empty
  string, leading, trailing and interior `White_Space`, a control
  character (Cc), a format character (Cf), a **lone surrogate**
  (carried as a JSON escape, because a value that is not encodable
  as UTF-8 is exactly the case at issue), and a 1025-byte input.
  One further check makes the *absence* of normalization
  executable rather than merely asserted: the NFC and NFD
  spellings are both valid, and they MUST derive **two different
  principals** — the case 6.2 decides the opposite way for persona
  names.
- **The Unicode 15.0 pin, shipped as data.**
  `identifierGrammar.unicodePin` carries the enumerated `Cc`, `Cf`,
  and `White_Space` ranges of 7a.2 step 4. It is there because a
  pin every implementation reads from its own ICU build is not a
  pin: the ranges govern, a conforming implementation evaluates
  step 4 against them, and the file records their provenance (two
  independent enumerations, Unicode 15.1 and 16.0 tables, agreeing
  range for range on both properties).
- **Raw-byte rejection vectors.** `identifierGrammar.rawByteRejects`
  gives step 1 something a string-level check cannot express:
  an overlong `C0 AF`, a truncated `E2 82`, a stray continuation
  `80`, a surrogate encoded as `ED A0 80`, a five-byte sequence,
  and a code point past U+10FFFF — each MUST fail a strict UTF-8
  decode, and none may be repaired into U+FFFD. One further case
  decodes cleanly and is rejected a step later (an embedded
  `U+0000`), which is what makes the ordering of the pipeline
  observable rather than incidental.
- **The relationship axis.** The three carrier cases above vary
  `C` and hold `N`; `relationshipAxisCase` does the opposite —
  **one** carrier, a second documented nonce
  (`rltp/vector/carrier-relationship/nonce-2`), a different
  principal. Without it the vector set proved only half of what
  7a.4 claims.
- **The `generation` domain (7a.3).**
  `nonceConvergence.generationDomain` carries the closed domain
  `[1, 2^53−1]`, its acceptance and rejection sets — including
  `2^53` and `2^53+1`, the two values a double-based runtime
  cannot tell apart, and the non-canonical encodings `01`, `1.0`,
  `1e3` — and a **boundary case**: a rotation at the very top of
  the domain, whose winning nonce deliberately sorts *higher*, so
  that the generation is what decides it. One check in the runner
  demonstrates the hazard rather than asserting it, by showing
  that the two out-of-domain values really are equal once parsed
  as doubles.
- **The nonce convergence rule (7a.3), four cases.**
  `nonceConvergence` carries register entries as `{nonce,
  generation}` and, for each case, the canonical entry, the
  principal it derives and the superseded ones: (1) **concurrent
  first writes** at the same generation, where the bytes decide;
  (2) a **deliberate rotation**, whose new nonce deliberately
  sorts *higher* — the counter-vector, because bytewise-smallest
  alone would have silently undone it; (3) the superseded entry
  **re-appearing** after a partition heal or a restore, which
  carries the lower generation and stays superseded, so no
  tombstone is needed; (4) **two concurrent rotations** to the
  same generation, a race again, settled by the bytes at that
  generation. Every case is evaluated over **all permutations** of
  its entry set and MUST give the same answer, and every
  superseded entry MUST derive a **different** principal — a
  superseded nonce leaves an orphan at the carrier, never a
  collision.
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
| Unicode | Unicode 15.0 data for assignment, `General_Category`, `White_Space`; NFC per UAX #15. For 7a.2 the pinned `Cf` and `White_Space` sets are **shipped as enumerated ranges** in `vectors/identity-derivation.json` and govern over any runtime's property tables |
| RLTP Delivery Contract | **0.37** (normative for the carrier-side consumption of 7a: §5a.3 registration proofs, §5a.8 conclusion, §5a.9 loss and orphans, §4.4 the carrier constants) |

## Appendix A. Relation to prior wot-spec documents (informative)

`wot-identity@0.1` (German) specified one identity key and one
encryption key derived from the full BIP-39 seed with the
`wot/identity/ed25519/v1` and `wot/encryption/x25519/v1` info
strings, the did:key form, and resolution. This document generalizes
it without moving it: the same seed remains the root IKM, the
historic derivation *is* the recovery context for every deployed
identity (Section 5.3), and derivation gains the label dimension
for every further context. A deployed identity is already
conformant to this document's recovery rule without any migration
step — which is the migration argument in one sentence.

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
| A7 derived service identities | 7 (Ed25519-only, canonical digest, Access seam vector, Delivery/Access debts) · **7a** (the carrier-relationship class: the second scope A7 needs, Delivery 0.37 §5a its consumer) |
| A8 operability without cryptography knowledge | 3.3 (normative table) |
| A9 anchor stability as chosen position | 8.5 |
| B1–B4 graded properties | 11 (native profile row) |
| C1 edge succession | 11 (B1/B2), status parked, *RLTP Succession* |
| C2 delegation proofs | 15.1 (ladder rung 2, prior work wot-spec 004) |
| IO-1/IO-4 continuity, device model | 15.1, 15.2 |
| IO-3 member identity scoping | 6.1 (`group/<digest>`) |
| IO-5 migration burden | 10 (dissolved by 5.3 — migration is the identity operation) |
| IO-6 grade requirements as group policy | 11 (preamble) |
