// rltp-core.mjs — SHIM: seit Faden 3 (29.08.2026) ist die Bibliothek die
// einzige Quelle der Formschicht (lib/src/core.ts → ./lib/core.js,
// eingefroren via scripts/build-simulator-lib.mjs, CI-frischegeprüft).
// intStr/shaped leben in der Bibliothek auf der Probe-Brücke (deps.ts);
// die alte flache Fläche dieses Moduls führte sie hier.
// Historie und Kommentare: git log -- simulator/rltp-core.mjs
export * from './lib/core.js'
export { intStr, shaped } from './lib/probe/deps.js'
