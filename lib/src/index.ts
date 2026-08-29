// @real-life/trust-protocol — the cryptographic core of RLTP.
//
// What this entry point IS: the wire-level primitives of the converged
// layers, reproducing the shipped test vectors byte for byte — the
// canonical form, the derivation of identity contexts under the closed
// label registry, the encounter wire builders, the sealed envelope and
// the generic receive chain.
//
// What it is NOT (yet): the layers' state machines. Identity's recovery
// and carrier derivations, Encounter's ceremony record and acceptance
// machinery, Delivery's type-specific stages and residual bookkeeping
// live in the specification and its conformance fixtures, not here. A
// conformant implementation builds ON this module; importing it is not
// yet conformance. The README states per module which casting's wire
// forms it implements.
//
//   core       the form every artifact obeys
//   crypto     the primitives, and the Data Integrity proof
//   identity   context derivation under the closed registry (§6.1/§6.2)
//   encounter  the ceremony's wire forms: challenges, cards, credentials
//   delivery   the sealed envelope and the generic receive stages 1–4
//
// Specification, schemas and vectors: https://rltp.real-life.org

export * from './core.js'
export * from './crypto.js'
export * from './identity.js'
export * from './encounter.js'
export * from './delivery.js'
