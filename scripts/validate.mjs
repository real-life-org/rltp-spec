#!/usr/bin/env node
// Publication checks for the RLTP specification repository.
//
// JSON Schema settles the SHAPE of every wire artifact. This script settles
// what a schema cannot: that every schema compiles and cross-references
// resolve offline, that the shipped seal vector reproduces byte-for-byte
// from its deterministic inputs, and that the conformance fixtures which
// MUST fail actually fail.
//
// The fixture philosophy follows the ToIP DTGWG registry's
// validate-ceremonies.mjs: "a checker that has never been shown to fail is
// not evidence of anything."

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPrivateKey, createPublicKey, diffieHellman, hkdfSync, createCipheriv, createHash } from 'node:crypto'
import Ajv2020 from 'ajv/dist/2020.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let errors = 0
const err = (m) => { console.error(`  ERROR ${m}`); errors++ }
const ok = (m) => console.log(`  ok    ${m}`)

// ── 1. Every JSON artifact parses ────────────────────────────────────────
const jsonFiles = []
for (const dir of ['schemas', 'contexts', 'vectors', 'fixtures', 'interop/ceremonies']) {
  for (const f of readdirSync(join(ROOT, dir))) {
    if (f.endsWith('.json') || f.endsWith('.jsonld')) jsonFiles.push(join(dir, f))
  }
}
const parsed = {}
for (const f of jsonFiles) {
  try { parsed[f] = JSON.parse(readFileSync(join(ROOT, f), 'utf8')); ok(`parses: ${f}`) }
  catch (e) { err(`${f}: ${e.message}`) }
}

// ── 2. Every schema compiles; cross-references resolve OFFLINE ───────────
const ajv = new Ajv2020({ strict: false, allErrors: true, loadSchema: async (uri) => {
  throw new Error(`network resolution forbidden (offline rule): ${uri}`)
}})
const schemaFiles = Object.keys(parsed).filter((f) => f.startsWith('schemas/'))
for (const f of schemaFiles) ajv.addSchema(parsed[f])
const validators = {}
for (const f of schemaFiles) {
  try { validators[parsed[f].$id] = ajv.compile(parsed[f]); ok(`compiles: ${f}`) }
  catch (e) { err(`${f}: ${e.message}`) }
}

// ── 3. The seal vector reproduces byte-for-byte ──────────────────────────
const v = parsed['vectors/seal.json']
const b64u = (b) => Buffer.from(b).toString('base64url')
const pkcs8 = (raw) => Buffer.concat([Buffer.from('302e020100300506032b656e04220420', 'hex'), raw])
const jcs = (o) => Array.isArray(o) ? '[' + o.map(jcs).join(',') + ']'
  : (o && typeof o === 'object') ? '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + jcs(o[k])).join(',') + '}'
  : JSON.stringify(o)
try {
  const recipientPriv = createPrivateKey({ key: pkcs8(Buffer.from(v.inputs.recipientPrivateKeyRaw, 'base64url')), format: 'der', type: 'pkcs8' })
  const ephemeralPriv = createPrivateKey({ key: pkcs8(Buffer.from(v.inputs.ephemeralPrivateKeyRaw, 'base64url')), format: 'der', type: 'pkcs8' })
  const plaintext = Buffer.from(jcs(v.inputs.document), 'utf8')
  if (plaintext.toString('utf8') !== v.intermediate.plaintextJcs) throw new Error('JCS plaintext mismatch')
  const shared = diffieHellman({ privateKey: ephemeralPriv, publicKey: createPublicKey(recipientPriv) })
  if (shared.every((x) => x === 0)) throw new Error('all-zero shared secret')
  if (b64u(shared) !== v.intermediate.sharedSecret) throw new Error('shared secret mismatch')
  const key = Buffer.from(hkdfSync('sha256', shared, Buffer.alloc(0), 'rltp/v1/seal', 32))
  if (b64u(key) !== v.intermediate.aesKey) throw new Error('HKDF key mismatch')
  const c = createCipheriv('aes-256-gcm', key, Buffer.from(v.inputs.nonce, 'base64url'))
  const ct = Buffer.concat([c.update(plaintext), c.final(), c.getAuthTag()])
  if (b64u(ct) !== v.output.sealedEnvelope.ciphertext) throw new Error('ciphertext mismatch')
  const digest = 'u' + b64u(Buffer.concat([Buffer.from([0x12, 0x20]), createHash('sha256').update(plaintext).digest()]))
  if (digest !== v.output.documentDigest) throw new Error('document digest mismatch (multihash)')
  const mh = Buffer.from(v.output.documentDigest.slice(1), 'base64url')
  if (mh[0] !== 0x12 || mh[1] !== 0x20 || mh.length !== 34) throw new Error('digest is not sha2-256 multihash')
  ok('seal vector reproduces byte-for-byte (JCS, X25519, HKDF, AES-GCM, multihash digest)')
} catch (e) { err(`seal vector: ${e.message}`) }

// ── 4. Conformance fixtures: bases MUST pass, mutations MUST fail ────────
const fx = parsed['fixtures/invalid-examples.json']
const setPointer = (obj, ptr, val) => {
  const parts = ptr.split('/').slice(1).map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'))
  let o = obj
  for (const p of parts.slice(0, -1)) o = o[p]
  o[parts.at(-1)] = val
}
const delPointer = (obj, ptr) => {
  const parts = ptr.split('/').slice(1)
  let o = obj
  for (const p of parts.slice(0, -1)) o = o[p]
  delete o[parts.at(-1)]
}
for (const [name, base] of Object.entries(fx.bases)) {
  const validate = validators[base.schema]
  if (!validate) { err(`fixture base ${name}: unknown schema ${base.schema}`); continue }
  if (!validate(base.document)) err(`fixture base ${name} MUST pass its schema but fails: ${ajv.errorsText(validate.errors)}`)
  else ok(`fixture base passes: ${name}`)
}
for (const c of fx.cases) {
  const base = fx.bases[c.base]
  const validate = validators[base.schema]
  const doc = structuredClone(base.document)
  if (c.set) for (const [ptr, val] of Object.entries(c.set)) setPointer(doc, ptr, val)
  if (c.delete) for (const ptr of [].concat(c.delete)) delPointer(doc, ptr)
  if (validate(doc)) err(`fixture MUST fail but passes: ${c.name}`)
  else ok(`fixture fails as required: ${c.name}`)
}

console.log(errors ? `\n${errors} error(s).` : '\nAll publication checks passed.')
process.exit(errors ? 1 : 0)
