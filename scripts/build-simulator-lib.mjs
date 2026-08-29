#!/usr/bin/env node
// Freezes lib/dist/**/*.js into simulator/lib/ — the committed, buildless
// emission of the library that the simulators and scripts/validate.mjs
// import. lib/src/ stays the single source of truth; this copy exists so
// the HTML simulators keep working without a TypeScript build step and
// validate.mjs stays zero-dependency.
//
// Freshness is enforced in CI (validate.yml, library job) via --check:
// after building lib, a drifted copy fails the job. This REPLACES the
// former suite-parity gate (scripts/probe-equivalence.mjs) with something
// strictly stronger: byte identity of the code instead of suite-pinned
// behavioral parity.
//
//   usage: node scripts/build-simulator-lib.mjs           (regenerate)
//          node scripts/build-simulator-lib.mjs --check   (CI freshness)
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'lib/dist')
const DST = join(ROOT, 'simulator/lib')
const HEADER = '// GENERATED from lib/dist by scripts/build-simulator-lib.mjs — DO NOT EDIT.\n// Source of truth: lib/src/*.ts. CI enforces freshness (--check).\n'

const jsFiles = (dir) => {
  const out = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...jsFiles(p))
    else if (e.endsWith('.js')) out.push(p)
  }
  return out
}

// deterministic transform: header + dist content minus source-map pointer
const emit = (p) => HEADER + readFileSync(p, 'utf8').replace(/^\/\/# sourceMappingURL=.*\n?/m, '')

if (!existsSync(SRC)) {
  console.error('lib/dist fehlt — erst bauen: cd lib && npm ci && npm run build')
  process.exit(1)
}
const files = jsFiles(SRC).sort()
const check = process.argv.includes('--check')

if (check) {
  let drift = 0
  const expected = new Map(files.map((p) => [relative(SRC, p), emit(p)]))
  const actual = existsSync(DST) ? jsFiles(DST).map((p) => relative(DST, p)).sort() : []
  for (const [rel, want] of expected) {
    const dst = join(DST, rel)
    if (!existsSync(dst)) { console.error(`  FEHLT  simulator/lib/${rel}`); drift++ }
    else if (readFileSync(dst, 'utf8') !== want) { console.error(`  DRIFT  simulator/lib/${rel}`); drift++ }
  }
  for (const rel of actual) if (!expected.has(rel)) { console.error(`  WAISE  simulator/lib/${rel} (nicht in lib/dist)`); drift++ }
  if (drift) { console.error(`${drift} Datei(en) driften — re-run: node scripts/build-simulator-lib.mjs`); process.exit(1) }
  console.log(`simulator/lib/ ist frisch (${files.length} Dateien, byte-identisch zu lib/dist)`)
} else {
  rmSync(DST, { recursive: true, force: true })
  for (const p of files) {
    const rel = relative(SRC, p)
    mkdirSync(dirname(join(DST, rel)), { recursive: true })
    writeFileSync(join(DST, rel), emit(p))
  }
  console.log(`simulator/lib/: ${files.length} Dateien aus lib/dist eingefroren`)
}
