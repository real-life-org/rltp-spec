#!/usr/bin/env node
// SUITE-PARITY GATE (named precisely after review 4, M-4): runs the four
// simulator test suites twice — once against the simulator originals
// (baseline: are the suites themselves green?) and once, import paths
// rewritten, against the built library. Passing means every behavior the
// suites PIN holds identically on both sides — including every negative
// path they exercise. It does NOT prove full behavioral equivalence:
// divergence on paths no suite executes stays invisible (two such cases
// were found by review, not by this gate). The plan that retires this
// limitation is the simulator importing the library as its single
// source; until then, cross-cutting fixes are applied to BOTH sides and
// this gate keeps the suites' view of them in lockstep.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LIB = join(ROOT, 'lib/dist')
const MAP = {
  "'./rltp-core.mjs'": `'${LIB}/core.js'`,
  "'./rltp-crypto.mjs'": `'${LIB}/probe/deps.js'`, // the bridge IS the old flat surface
  "'./introduce.mjs'": `'${LIB}/probe/introduce.js'`,
  "'./trust.mjs'": `'${LIB}/probe/trust.js'`,
  "'./groups.mjs'": `'${LIB}/probe/membership.js'`,
  "'./continuity.mjs'": `'${LIB}/probe/continuity.js'`,
  "'./rltp-schemas.mjs'": `'${LIB}/schemas.js'`,
}
const dir = mkdtempSync(join(tmpdir(), 'rltp-probe-eq-'))
const SUITES = ['introduce-test.mjs', 'trust-test.mjs', 'groups-test.mjs', 'continuity-test.mjs']
let failed = 0
const run = (f, label) => {
  try { execFileSync(process.execPath, [f], { stdio: 'pipe' }); console.log(`  ok    ${label}`); return true }
  catch (e) { failed++; console.error(`  FAIL  ${label}:\n${e.stdout}\n${e.stderr}`); return false }
}
// baseline: the suites against the simulator originals
for (const t of SUITES) run(join(ROOT, 'simulator', t), `${t} against simulator (baseline)`)
// parity: the same suites, imports rewritten, against the built library
for (const t of SUITES) {
  let s = readFileSync(join(ROOT, 'simulator', t), 'utf8')
  for (const [old, neu] of Object.entries(MAP)) s = s.replaceAll(old, neu)
  s = s.replace("const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')", `const ROOT = '${ROOT}'`)
  const f = join(dir, t)
  writeFileSync(f, s)
  run(f, `${t} against lib/dist`)
}
if (failed) { console.error(`${failed} run(s) failed — suite parity does NOT hold.`); process.exit(1) }
console.log('suite parity: all four suites pass on both sides — every suite-pinned behavior is identical.')
