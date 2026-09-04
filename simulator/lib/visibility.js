// GENERATED from lib/dist by scripts/build-simulator-lib.mjs — DO NOT EDIT.
// Source of truth: lib/src/*.ts. CI enforces freshness (--check).
// @real-life/trust-protocol — visibility: the GRADUATED Network
// Visibility layer.
//
// Graduated 04.09.2026 after a 39-round adversarial conformance loop
// (design/probe-nachzug-konvergenz-2026-09.md): these modules implement
// the NORMATIVE wire forms of Network Visibility 0.29 carried by the
// Delivery Contract 0.79 —
//
//   trust        the explicit trust act (anchor-mapping@2 · grade-
//                declaration@1), the blinded star (star@1 with 5.2a
//                chunks), the admission layer (Section 2), the 5.4
//                reconciliation automaton, issuance discipline
//   continuity   §6a: continuity-probe@1 / continuity-mapping@1 — the
//                re-recognition of a relationship after a fresh
//                enactment; chains instead of duplicates
//   acks         the deniable delivery-ack/0.1 under the channel ack
//                key (Delivery 4.2 class rule)
//
// Wire forms and keys are byte-compatible with vectors/visibility.json
// and vectors/delivery-ack.json. The modules operate on the probe WORLD
// (a `Person` holding contexts, contacts, groups — DOM-free and storage-
// free); the host decides where bytes live.
//
// Not in this module: transport adapters and their policies, storage,
// the Encounter layer's ceremony flows (those remain `@probe`).
export { COMMUNITY_GENESIS } from './probe/deps.js';
export * as trust from './probe/trust.js';
export * as continuity from './probe/continuity.js';
export * as acks from './probe/acks.js';
