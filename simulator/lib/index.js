// GENERATED from lib/dist by scripts/build-simulator-lib.mjs — DO NOT EDIT.
// Source of truth: lib/src/*.ts. CI enforces freshness (--check).
// @real-life/trust-protocol — the cryptographic core of RLTP.
//
// What this entry point IS: the wire-level primitives of the converged
// layers, reproducing the shipped test vectors byte for byte — the
// canonical form, the derivation of identity contexts under the closed
// label registry, the encounter wire builders, the sealed envelope and
// the generic receive chain.
//
// What it is NOT (yet): the layers' full state machines. Identity's
// recovery derivation, Encounter's ceremony record and acceptance
// machinery, Delivery's type-specific stages and residual bookkeeping
// live in the specification and its conformance fixtures, not here. A
// conformant implementation builds ON this module; importing it is not
// yet conformance. The README states per module which casting's wire
// forms it implements.
//
//   core              the form every artifact obeys
//   crypto            the primitives, and the Data Integrity proof
//   identity          context derivation under the closed registry (§6.1/§6.2)
//   encounter         the ceremony's wire forms: challenges, cards, credentials
//   delivery          the sealed envelope and the generic receive stages 1–4
//   carrier-identity  the carrier-relationship principal (Identity §7a)
//   carrier           the carrier side of the port (Delivery §4.4 + §5a)
//   holder            the holder side: proofs, verdicts, recovery (§5a, §9.3)
//   visibility        Network Visibility 0.29 on Delivery 0.79 — the trust
//                     act, the blinded star, §6a continuity, the deniable
//                     ack (namespaced: `visibility.trust`, `.continuity`,
//                     `.acks`; graduated from /probe on 04.09.2026)
//
// Specification, schemas and vectors: https://rltp.real-life.org
export * from './core.js';
export * from './crypto.js';
export * from './identity.js';
export * from './encounter.js';
export * from './delivery.js';
export * from './carrier-identity.js';
export * from './carrier.js';
export * from './holder.js';
export * as visibility from './visibility.js';
