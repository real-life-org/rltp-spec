# RLTP Transport Adapter Profile: VTI Mediator

**Real Life Trust Protocol — Transport Adapter Profile (below the port line)**

- **Status:** Editor's Draft
- **Version:** 0.23.0-draft (twenty-third casting)
- **Status of This Document:** Editor's Draft, not yet converged.
  This profile changes normatively between castings and MUST NOT be
  relied upon for implementation or interoperability claims. Review
  and comment are welcome through the editors.
- **Editors:** Anton Tranelis

Target carrier: the VTI/Affinidi messaging mediator as released in
**VTI-Dogwood** (pins: `vti-didcomm-js` @ `1d110bf`,
`verifiable-trust-infrastructure` @ `e0f700b7`; protocol texts:
Coordinate Mediation 2.0 @ `d5909369`, Message Pickup 3.0 @
`9dfa409f`, TSP @ `ea01152` — `sources/pins/PINS.md`; TSP Rev 3 is
tracked and the wire binding targets its cipher suite posture, see
§7). Seam evidence:
`design/mediator-naht-bestandsaufnahme-2026-08.md`.

## 0. What this contract is, and is not

The mediator is a **foreign carrier**: it keeps its own contract
(mediation, pickup, delete-to-ack) and has never given the RLTP
port's promises — no proof-gated registration, no generations or
tombstones, no published constants, no wind-up. TSP Rev 3 says the
same of intermediaries in its own name: *"TSP provides no delivery
guarantee, and an intermediary that declines to relay a message
cannot be distinguished by the sender from one that has not yet
delivered it."*

This profile therefore does **not** present the §4.4/§5a carrier
port. It presents the **transport contract**: everything a holder
can rely on when its counterpart is reached through a carrier that
answers to its own protocol. Where a holder needs the full port,
the full port exists — the `Carrier` machine of this library — and
a service that fronts it to real tenants is a different profile
with real observers.

What this adapter owes, completely:

1. the **§6.1 sender contract** — the status trias, the closed
   pre-transport reports, the declared give-up, late-ack
   transitions, and the receiver refusal channel;
2. a **duplicate absorption** that composes with the receiver's
   §6.2 rule and never replaces it;
3. the **§5a.10 identity obligations** in full.

What it expressly does not owe, and no holder may read into it:
proof-bound registration, generation ordering, tombstone
consumption, orphan wind-up, published carrier constants beyond
those declared below. Those guarantees are obtainable only from an
RLTP carrier; a holder that requires them must not settle for a
foreign one.

## 1. Identities (§5a.10, unchanged from the second casting)

- `C` is the **mediator's DID**, exactly as configured (Identity
  §7a.2 — never a hop beyond it, never the URL it resolves to).
- The control principal (`carrierPrincipal(rootIkm, C, nonce)`)
  **never touches the wire.** Beside it the adapter derives, from
  the same root under the normative prefixes
  `rltp/v1/carrier-connection/ed25519/v1/` and
  `rltp/v1/carrier-egress/ed25519/v1/` (Identity §13 lists both),
  the **connection DID** (all mediator protocol traffic: auth,
  keylist, pickup, receipts) and the **egress identity** (presented
  on every deposit — §5a.10's sender-side identifier, one per
  relationship × carrier). Each is derivable from the root; none
  from any other. **The trio is derived by the adapter's factory
  itself** from one (root, `C`, `N`) — caller-supplied identities
  are refused at the door, so a mixed trio (identities from two
  relationships) cannot be built at all.
- Both wire identities carry §5a.10's three prohibitions — **not
  well-known**, **not person-wide**, **not reused outside this
  relationship** — and are retired with the principal, never
  reassigned. `from_prior` is **forbidden**; a new connection DID
  is a fresh mediation relationship, never a rotation statement.
- One mediation relationship per principal; keylists
  principal-local; every status, pickup and receipt operation
  scoped to one principal's connection; Live Mode per relationship
  (MUST), one socket per principal by default (5a.7 spacing
  declares any multiplexing).

## 2. Declared constants (decision g1-a, revised under Option B)

Five constants with transport meaning, every one enforced in the
implementation. They are promises of **this casting**: a revision
is a new casting of profile and code together — there is no
runtime revision machinery, and this profile claims none:

| Constant | Value | Enforced by |
|---|---|---|
| `give-up-horizon` | 72 h | every submission not confirmed delivered — `accepted` included — fails at the horizon; `unroutable` only for the persistent admission-refusal class — never overload, never an outcome in flight, and never over a standing offline signal (the give-up verdict applies the same precedence as every observation) |
| `status-horizon` | 60 s | `submit` returns synchronously. The pre-transport report is an **honest snapshot, derived at each observation** by one precedence order — (a) the wire knows itself offline → `offline`; (b) an attempt is overdue past the horizon → `transport-unreachable`; (c) otherwise the last completed attempt's report; (d) otherwise honestly **no report yet** (absence answered as null, never a fourth value beside §6.1's closed set). One order, every observation point — no stored patchwork, no cell a connectivity change can leave silent. No attempt is ever started against a knowingly offline wire |
| `queue-floor` | 64 envelopes **and** 1 MiB | below both bounds an inbound frame is always buffered |
| `max-queue-bytes` | 16 MiB | buffered **and** collected-but-unconcluded bytes together; above it a frame is not buffered and **not acknowledged** — the mediator keeps its copy and re-covers |
| `duplicate-window` | 30 days | a concluded digest is absorbed for the window, measured from conclusion — and **the window beats everything**: at its end, entry, absorption and any unpaid ack intent fall together |

Withdrawn from the second casting, with reasons on the record:
`challenge-lifetime` (the adapter has no wall-clock source of its
own; a bound it cannot measure is a promise it cannot keep — the
ATM challenge's freshness is the mediator's own concern),
`max-binding-tombstones` and `orphan-horizon` (binding machinery of
the carrier port this contract does not present).

The honest limit, as before: these bind the **adapter**. Where the
mediator is stricter (an unpublished TTL, an ACL change, a quota),
the holder sees only the port's own forms — never a
mediator-shaped error.

## 3. Operation mapping

| Adapter operation | Mediator wire | Notes |
|---|---|---|
| `register(rkids)` | ATM auth (challenge → authcrypt `atm/1.0/authenticate` → access+refresh JWT) under the connection DID; keylist update for this principal's `rkid`s | transport admission and routing registration only — expressly **not** §5a.3 registration; no generation, no proof toward this adapter. `register` records the desired keylist and returns; synchronization is a tracked background task retried by `advance` (the no-await rule covers every port operation). The auth handshake is **single-flight**: concurrent operations share one challenge/response session |
| `submit` | `POST /inbound` / WS frame; sealed RLTP envelope under the egress identity | returns the submission id **synchronously**; the transport attempt runs behind it. TSP framing is the wire binding's duty, including §5a.10's peer-change rule (only the binding sees the peer) |
| `collect` | live delivery / `delivery-request`; mediator fetches with `DoNotDelete` | redelivery before ack is re-cover, not a new item |
| `conclude` | `messages-received` over the digest set of the collection (decision 3) | infallible at the port; see §4 |
| `advance` | adapter clock only | give-up, retries, ack flushing, duplicate-window pruning |

Delete-to-ack order is **hand off → await → ack** (Dogwood,
`vti-didcomm-js` `29b92cc`), kept with three receiver registers:
buffered, outstanding, concluded. Only a **concluded** digest is
ever (re-)acknowledged; a redelivery of a buffered or outstanding
frame is ignored without acknowledgement. Collections carry an
adapter-issued id; conclusion uses the adapter's authoritative
digest set, and an empty collection creates no register entry.

## 4. Acknowledgement intent and durability

`conclude` records the digest set as **ack intent** and returns —
it never awaits the mediator; the flush runs as a tracked
background task and every `advance` starts a fresh one for what
has not landed. No wire error, and no hanging wire, ever reaches
the holder through `conclude`. An intent is retried for the length of
the duplicate-window and no longer: at the window's end intent,
entry and absorption fall together (the rule of §2, restated here
where the flush lives).

The intent's durability is the **host's store**: the adapter
exposes its ack state (concluded digests with conclusion instants,
pending intents) for the host to persist, and accepts it back at
construction. The snapshot invariant — every pending intent names
a concluded entry — is enforced **fail-closed**: an inconsistent
snapshot is refused at construction, never silently trimmed. A
restore names its instant; a concluded entry older than the
duplicate-window is dropped **at the restore instant**, owed or
not, and a conclusion instant **after** the restore instant is
refused outright (it would stretch the window past its declared
span). **The window beats everything** — at absorption, at the
prune, at the restore: an ack intent is retried until the window
closes, then intent and absorption fall together; there is no
ageless debt whose truth the adapter would have to know, and a
phantom debt (an ack that in fact landed just before a close) can
never outlive the window and delete a fresh copy. A byte-identical
arrival beyond the window is a new item — always, without
exception; what this can produce in the worst case (one duplicate
delivery after a lost ack, a restart and thirty days) is owned by
the receiver's §6.2 absorption, which the Delivery Contract
requires regardless. One boundary precision: a wire call cannot be
recalled, so **the window closes for an id no earlier than the end
of an acknowledgement call already carrying it on the wire** — the
stay of expiry begins at the wire call itself, never earlier (a
hanging authentication extends no window; ids whose entry already
fell are not sent at all), it covers absorption too (so the
irrecallable ack can never delete a copy the holder has not
absorbed), and the account is settled the moment the call returns.

**The teardown edge, priced honestly.** An acknowledgement still
flying at `close()` cannot be carried by the snapshot; a restored
successor retries a persisted intent until it lands or the window
closes. Two regimes, both closed:

- **Inside the window, a deletion by any of these calls is
  port-equivalent to the declared absorption.** A deleted copy is
  byte-identical to a digest whose entry is still concluded and
  whose window is still open — had it been delivered instead, this
  profile's own duplicate rule (§2) would have absorbed it without
  surfacing it. The holder observes the same thing either way: the
  copy does not appear. Retried acknowledgements therefore add no
  loss beyond what the window already declares, however many times
  a lost response makes them retry.
- **Beyond the window, no intent survives to be retried** — intent,
  entry and absorption fell together — so the only calls that can
  still land are those a teardown left irrecallably flying: **at
  most one call per teardown that abandoned a flying
  acknowledgement**. One such call carries the finite batch of
  digests that were pending at that teardown — state, not traffic —
  and deletes **at most one copy per digest it carries**, each
  landing once. The number of calls is bounded by the host's own
  succession behaviour, the reach of each call by the state it was
  sealed with, and a host that drains with `settle()` before
  succession leaves none. Each deleted copy is priced identically: the affected
  submission never becomes `delivered` and fails honestly at the
  sender's declared give-up horizon, exactly as after any transport
  loss following acceptance, and resubmission after a failure is
  the application's documented recourse. This profile invents no
  sender retransmission machinery §6.1 does not define; it prices
  the edge in §6.1's own coin.

A host that wants the tidier shutdown still has `settle()` (§6) to
drain before succession.
 A conclusion arriving while a flush is
running receives its own flush when that one ends; a failing wire
waits for the next `advance` instead of spinning. A
host that persists nothing re-receives concluded items after a
restart and owes their absorption to §6.2 — stated here as the
honest boundary, exactly as the library's byte boundary already
carries M-2.

## 5. Sender states and refusal mapping

Trias per §6.1 with the closed sets, unchanged. Additionally the
port carries the **receiver refusal channel** (review 2 B8): the
delivery layer, which alone can validate a counterpart's refusal,
reports it to the adapter and the submission fails as
`failed(rejected-by-receiver(<code>))` — for `trust-task-error/0.2`
counterparts the code is the registry code (`malformedRequest`,
`unsupportedType`, `proofRequired`, `proofInvalid`,
`wrongRecipient`, `identityMismatch`); `idConflict` is §6.2
absorption, never a failure; `unavailable`/`internalError`
(retryable) produce **no port transition at all** — they are
availability conditions of the counterpart's infrastructure, the
delivery layer simply retries under its own schedule, and a
submission that already entered the trias keeps its trias state
(§6.1: pre-transport reports end at trias entry — nothing moves
`accepted` back); `expired` has no port equivalent (recorded
divergence). A validated
refusal acts on every **non-terminal** state — the report-less
phase, awaiting, and accepted alike — because the validated
refusal is itself the proof that the counterpart received the
envelope (the mediator can accept and forward while the
depositor's own call is still unresolved), and the attempt's
later resolution never displaces it. Terminal states stand: §6.1
knows exactly one late correction of a terminal state — the valid
acknowledgement — and this profile adds no second. The refusal channel carries **terminal verdicts only**: `unavailable` and
`internalError` are availability conditions of the transport, not
receiver verdicts — they never enter `receiverRefused` (the
runtime refuses them fail-closed), and the submission simply
remains governed by the adapter clock like any other transport
outcome.

Transport conditions map as before: 401/403/ACL →
retriable, persistent → `failed(unroutable)` at the horizon; 413 →
`failed(oversize)`; upgrade drop/timeout/DNS →
`awaiting-transport(transport-unreachable)`; 429/5xx →
`awaiting-transport(carrier-refused-retriable)`;
`duplicate-channel` → re-establish, no port event; mediator
status/problem-report frames → consumed, never acked, never items.

## 6. Lifecycle coupling (§5a.10, applied)

Change of the direct carrier = change of `C` = new principal, new
adapter instance, new wire identities; the old ones are retired,
never re-pointed. Changes beyond the direct carrier change
nothing. A rebind is likewise a new instance. There is no wind-up
here to run: the adapter holds no bindings — what it holds at
teardown is its ack state (§4, the host persists it) and its
submissions. **A close with live submissions ends their
reporting** — a retired instance has no clock, so it does not
pretend to fail them at a horizon it no longer drives. What the
holder is owed then is the **host's**: surface the teardown, or
carry the undelivered envelopes into a successor instance whose
own clock and horizons govern their resubmission. This profile
refuses to promise more than a retired instance can keep. The
boundary is realized in code:
`close()` retires the instance — subsequent port operations
refuse, a late-resolving wire mutates nothing, and the ack state
remains readable for the host's final persist. Beside the port
stands one host teardown aid: `settle()` awaits the in-flight
background tasks so a host can drain before persisting its ack
state — it is not a port operation, it may wait as long as a
hanging wire does, and a host bounds it externally because this
library holds no clock. "Every state port"
includes the reads: `status`, `has`, `drainTransitions` and
`keylistSynced` refuse on a retired instance — a port that no longer drives its horizons
must not keep answering as if it did — and the inbound reports
(`acknowledged`, `receiverRefused`) are no-ops. The honest limit:
a wire call already in flight at close time cannot be recalled —
it may still land at the mediator; it merely cannot change
anything here, and nothing new starts after retirement (checked
between the auth handshake and every subsequent wire call).

## 7. Due at the wire binding

The concrete binding over `vti-didcomm-js` owes: TSP framing
toward **Rev 3's cipher posture** (HPKE-Base; HPKE-Auth is removed
in Rev 3 and the OpenVTC stack switches before its next event),
the peer-change rule (a changed direct TSP peer under an unchanged
`C` retires the outer VID and establishes a fresh one via Rev 3's
Referral field where available), the CESR demux discipline of
ref-04, and the M-2 duty (raw received bytes passed truthfully).

Of the §5a.10 vector debt (Delivery §11), this profile discharges
what is decidable **here**: the identity derivations are
deterministic and vector-tested (fixed inputs → byte-exact
principal, connection and egress DIDs, pairwise distinct,
prefix-separated), and the adapter obligations of this contract
are exercised against the wire double. What genuinely needs a
carrier **interface** — proof-gated registration vectors,
generation and tombstone cases — remains with the first
RLTP-carrier service, which is the first place it is decidable.

## 8. Security Considerations

- **Identity coupling is constructive.** The factory derives
  principal, connection DID and egress identity from one
  (root, `C`, `N`), snapshotted at entry; caller-supplied
  identities are refused. The wire paths read the private fields
  directly, so overriding the public getters changes what an
  external reader sees, never what reaches the wire. The honest
  scope: this holds within the language's integrity model — a
  party that can rewrite the adapter's code, its wire object, or
  the process memory is the host itself, and no in-process
  construction defends against its own host.
- **Mediator JWT theft.** The access/refresh tokens authorize use
  of the mediator as this principal's relay: a thief can deposit
  under the stolen session and drain queued frames to itself.
  They do NOT let the thief read envelope contents (E2E-sealed to
  the rkid) or forge delivery-acks (which need the counterpart's
  key). Tokens live in adapter memory only, are never persisted
  in `AckState`, and die with the instance; the residual risk is
  the host process's memory, as with every key this library
  holds.
- **Queue bounds are the DoS posture.** Defence is
  resource-shaped (§5a.4): the floor guarantees admission below
  the declared bounds, the cap refuses above them by *not
  acknowledging* — an attacker who fills the inbox delays
  delivery but deletes nothing, because the unacknowledged copy
  stays at the mediator.
- **The ack store is integrity-critical at the host.** A host
  store that fabricates `pending` entries can make the adapter
  acknowledge (delete) mediator copies it never handled;
  fail-closed restore limits this to entries the snapshot also
  declares concluded, and a host that cannot protect its store
  inherits exactly the §6.2 duty the profile names. The
  duplicate-window rules (the window beats everything; no future
  instants) bound what a corrupted clock can stretch.
- **Give-up produces failure, never silence.** Every declared
  bound ends in a §6.1 report; the teardown paragraph (§6)
  states the one case where reporting ends, and hands it to the
  host explicitly. There is no path on which an envelope is
  dropped without either a report or a mediator-retained copy.

## 9. Privacy Considerations

- **What the mediator learns.** The connection DID, the egress
  identity, the rkids on the keylist, timing, sizes and
  frequency — a correlation record inside one relationship,
  exactly the exposure TSP Rev 3's intermediary chapter
  describes. Both wire identities carry §5a.10's three
  prohibitions, so this record joins to nothing outside the
  relationship *through identifiers*; timing and volume
  correlation remain, as §10 of the Delivery Contract records,
  and this profile claims no unlinkability.
- **The principal never appears on the wire** — the mediator
  cannot see, and therefore cannot leak, the identifier under
  which port-level authority is exercised.
- **The ack store reveals traffic history.** `AckState` holds
  digests and instants of concluded deliveries — metadata about
  what arrived and when, not content. A host persisting it should
  protect it like the message store it accompanies.
- **Instance retirement is not principal retirement.** `close()`
  ends one instance's ports; the identities belong to the
  **relationship** (Identity §7a: `N` survives instances), so a
  successor instance over the same (root, `C`, `N`) resumes the
  same relationship under the same names — that is the §6
  successor path, not a revival by an outsider (the names are
  worthless without the root's keys). Retired **for good** they
  are only with the principal — on a rebind or a change of `C` —
  and then never reassigned.
