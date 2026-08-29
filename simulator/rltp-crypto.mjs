// rltp-crypto.mjs — SHIM: seit Faden 3 (29.08.2026) ist die Bibliothek
// die einzige Quelle. Die alte flache Kryptofläche wird von der Brücke
// lib/src/probe/deps.ts wieder zusammengesetzt (→ ./lib/probe/deps.js,
// eingefroren via scripts/build-simulator-lib.mjs, CI-frischegeprüft).
// Historie und Kommentare: git log -- simulator/rltp-crypto.mjs
export * from './lib/probe/deps.js'
