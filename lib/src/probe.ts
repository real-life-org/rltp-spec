// @real-life/trust-protocol/probe — the layers still being cast.
//
// ┌──────────────────────────────────────────────────────────────────┐
// │  NOT WIRE-NORMATIVE. These forms are probes: they exercise the   │
// │  converged semantics of their layer, but their transport shapes  │
// │  carry @probe and WILL change. Experiment with them; do not      │
// │  ship them as if they were the standard, and do not treat their  │
// │  wire forms as an interoperability target.                       │
// └──────────────────────────────────────────────────────────────────┘
//
// The separation is structural on purpose: a subpath import is a
// decision someone has to make, not a name they can reach by accident.
//
// The modules map onto two specifications:
//
//   Network Visibility   introduce (mediated introductions over a
//                        rendezvous drop) · trust (the explicit trust
//                        act: anchor-mapping@2, the blinded star,
//                        pause) · continuity (§6a: probe + mapping —
//                        re-recognizing a relationship after a fresh
//                        enactment, chains instead of duplicates)
//   Membership + Access  membership (founding, prelude, VIC invite,
//                        consent, admission, welcome, vouch@2)
//
// Everything operates on the probe WORLD: a Person (deps.js) holding
// contexts, contacts, groups — DOM-free and storage-free, so the same
// code drives tests, simulators and future adapters.
//
// When a layer converges, its module graduates to the main entry point
// and this file loses a line. That is the intended direction of travel.

export type { Person } from './probe/deps.js'
// the LIVE schema bundle (deep-frozen): it tracks the running castings
// and therefore belongs to the probe surface, not the pinned root —
// the root promises Identity 0.50 / Encounter 0.29 / Delivery 0.64,
// this bundle moves with the repository (review 4, M-1)
export { SCHEMAS } from './schemas.js'
export { COMMUNITY_GENESIS } from './probe/deps.js'
export * as introduce from './probe/introduce.js'
export * as trust from './probe/trust.js'
export * as continuity from './probe/continuity.js'
export * as membership from './probe/membership.js'
