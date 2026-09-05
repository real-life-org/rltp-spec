// GENERATED from lib/dist by scripts/build-simulator-lib.mjs — DO NOT EDIT.
// Source of truth: lib/src/*.ts. CI enforces freshness (--check).
// @real-life/trust-protocol — ceremony: the GRADUATED transmission of the
// Encounter ceremony on the normative forms.
//
// Graduated 05.09.2026 after a 25-round adversarial conformance loop
// (design/encounter-nachzug-konvergenz-2026-09.md): this module implements
// the one registered ceremony `encounter-scan@0.25` (Encounter 0.29, wire
// 0.25) carried by the Delivery Contract 0.79 —
//
//   encounter-bundle/0.1                 the scanner's sent card + step
//                                        credential (Delivery 4.1)
//   encounter-credential-delivery/0.1    the counter-step in the bundle's
//                                        thread (Delivery 4.3)
//   delivery-ack/0.1 (signed class)      arrival, never acceptance (4.2)
//
// The machine: the own-challenge state model with its lock-free aging
// latch (5.3), the enactment record as the one serialization point (5.5),
// the eight-step acceptance (5.6), connected and offline path of 5.8 with
// free switching, and ONE commit discipline for every effect —
// prepare (async, no mutation) → verify (sync, under the 6.2 lock set) →
// commit (sync). `delivered` is the sender's status only on a valid ack.
//
// The module operates on the probe WORLD (a `Person`); the host owns
// storage and transport and carries the duties listed in the handoff
// (atomic writes, resume before flush, UI correlation).
//
//   show · scan · counter · captureSentCard · receiveEncounter ·
//   resumeEncounter · flushEncounter · resolve · constants
export * from './probe/encounter.js';
