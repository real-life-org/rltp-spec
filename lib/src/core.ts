// core — the form layer: the canonical rules every RLTP artifact obeys.
//
// One implementation of the canonical form (JCS subset, multibase
// encodings, digest equality over DECODED bytes, timestamp
// normalization) and the JSON-Schema subset validator. The conformance
// runner, the reference engine and every simulator delegate here.
//
// Predicates exist ONCE — that is the point. Weakening a rule here fails
// the conformance runner's self-tests rather than silently changing what
// some user interface accepts.
//
// Dependency-free and environment-free: no node:*, no DOM, no WebCrypto.
// Everything here is synchronous and pure.

// ── JCS (RFC 8785 subset for the ASCII I-JSON forms this stack ships) ──
export type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

/** RFC 8785 subset for the ASCII I-JSON forms this stack ships. */
export const jcs = (o: unknown): string => {
  if (o === undefined) throw new Error('jcs: undefined is not serializable')
  // RFC 8785 operates on Unicode strings — a lone surrogate is not one,
  // and a conformant implementation MUST error rather than canonicalize
  // it (review 3, B-1: divergent digests between implementations)
  if (typeof o === 'string' && !(o as unknown as { isWellFormed(): boolean }).isWellFormed()) throw new Error('jcs: lone surrogate')
  if (typeof o === 'number' && !Number.isFinite(o)) throw new Error('jcs: non-finite number')
  if (Array.isArray(o)) {
    // a sparse array is not a JSON value: map() skips holes and join()
    // erases them, so [empty] and [] would COLLIDE on one digest
    // (review 4, B-3) — reject instead of silently canonicalizing
    for (let i = 0; i < o.length; i++) if (!(i in o)) throw new Error('jcs: sparse array')
    // non-index own properties (arr.x = 1) and symbol keys would be
    // silently DROPPED and collide with the bare array (review 6, B-2)
    if (Object.getOwnPropertyNames(o).length !== o.length + 1 /* 'length' itself */ || Object.getOwnPropertySymbols(o).length > 0) throw new Error('jcs: array with extra own properties')
    return '[' + o.map(jcs).join(',') + ']'
  }
  if (o && typeof o === 'object') {
    // only PLAIN objects are JSON values: a Date, Map or class instance
    // would serialize by its enumerable keys alone and collide with {}
    // (review 5, B-3) — reject at the edge of the digest domain
    const proto = Object.getPrototypeOf(o)
    if (proto !== null && proto !== Object.prototype) throw new Error('jcs: not a plain JSON object')
    // symbol-keyed own properties would be silently dropped — the object
    // would collide with its symbol-free twin (review 6, B-2)
    if (Object.getOwnPropertySymbols(o).length > 0) throw new Error('jcs: object with symbol keys')
    // non-enumerable own properties are invisible to Object.keys and
    // would collide with the bare twin (review 7, B-4)
    if (Object.getOwnPropertyNames(o).length !== Object.keys(o).length) throw new Error('jcs: object with non-enumerable own properties')
    const rec = o as Record<string, unknown>
    return '{' + Object.keys(rec).sort().map((k) => {
      if (rec[k] === undefined) throw new Error('jcs: undefined property ' + k)
      if (!(k as unknown as { isWellFormed(): boolean }).isWellFormed()) throw new Error('jcs: lone surrogate in key')
      return JSON.stringify(k) + ':' + jcs(rec[k])
    }).join(',') + '}'
  }
  const s = JSON.stringify(o)
  // M-4 (review 1): symbols and functions stringify to undefined — the
  // invariant "jcs returns a string" is enforced at the API edge, not
  // silently violated downstream in a digest.
  if (typeof s !== 'string') throw new Error('jcs: value is not JSON-representable')
  return s
}

// ── multibase encodings ─────────────────────────────────────────────────
export const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
export function base58 (bytes: Uint8Array): string {
  let n = 0n
  for (const b of bytes) n = n * 256n + BigInt(b)
  let out = ''
  while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n }
  for (const b of bytes) { if (b === 0) out = '1' + out; else break }
  return out
}
export function fromBase58 (s: string): Uint8Array | null {
  let n = 0n
  for (const c of s) {
    const i = B58.indexOf(c)
    if (i < 0) return null
    n = n * 58n + BigInt(i)
  }
  const out: number[] = []
  while (n > 0n) { out.unshift(Number(n % 256n)); n /= 256n }
  for (const c of s) { if (c === '1') out.unshift(0); else break }
  return new Uint8Array(out)
}
export const b64uOf = (bytes: Uint8Array): string => {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  const btoaFn: (x: string) => string = typeof btoa === 'function'
    ? btoa
    : (x) => (globalThis as any).Buffer.from(x, 'binary').toString('base64')
  return btoaFn(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export const fromB64u = (s: string): Uint8Array => {
  const atobFn: (x: string) => string = typeof atob === 'function'
    ? atob
    : (x) => (globalThis as any).Buffer.from(x, 'base64').toString('binary')
  const bin = atobFn(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

// ── digest equality over decoded multihash bytes (Encounter 2.3) ────────
// toU: strict multibase bridge — prefix, sha2-256 multihash header and
// length, AND canonical-form round-trip; returns the canonical u rendering
// or null. A u input is checked for header/length too.
export const toU = (v: unknown): string | null => {
  if (typeof v !== 'string' || v.length < 2) return null
  let bytes: Uint8Array | null
  if (v[0] === 'u') {
    try { bytes = fromB64u(v.slice(1)) } catch { return null }
    // canonical base64url only — padding or non-zero trailing bits make a
    // DIFFERENT string decode to the same bytes, and equality is decided
    // over bytes; without this check 16 spellings of one digest verify
    // (B-1, review 1; the shipped reject vectors demand exactly this).
    if (bytes && 'u' + b64uOf(bytes) !== v) return null
  } else if (v[0] === 'z') {
    bytes = fromBase58(v.slice(1))
    if (bytes && 'z' + base58(bytes) !== v) return null // canonical base58btc only
  } else return null
  if (!bytes || bytes.length !== 34 || bytes[0] !== 0x12 || bytes[1] !== 0x20) return null
  return 'u' + b64uOf(bytes)
}
export const sameDigest = (a: unknown, b: unknown): boolean => { const na = toU(a); return na !== null && na === toU(b) }

/** Whole-second ISO rendering — the timestamp form every artifact carries. */
export const iso = (ms: number): string => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')

// ── timestamps (Encounter 2.3) ──────────────────────────────────────────
// tsec: whole-second truncation of EVERY comparison operand (incl. now).
export const tsec = (v: string | number): number => Math.floor((typeof v === 'number' ? v : Date.parse(v)) / 1000) * 1000
// calOK: calendar-valid round-trip AND the ≤3-fractional-digit cap —
// Date.parse silently normalizes impossible dates, so demand the round-trip.
export const calOK = (t: unknown): boolean => {
  if (typeof t !== 'string') return false
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?Z$/.test(t)) return false
  const d = new Date(t)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 19) === t.slice(0, 19)
}

// ── THE JSON-Schema subset validator (exactly the keywords we ship) ─────
// makeValidator(schemaMap): schemaMap is { filename → parsed schema }.
// Returns { validate, resolveRef, SCHEMAS, BYID } bound to that map.
export type Schema = boolean | { [k: string]: any }
export type SchemaMap = Record<string, Schema>
export interface Validator {
  validate: (data: unknown, schema: Schema, root: Schema, path?: string) => string[]
  resolveRef: (ref: string, root: Schema) => { node: Schema, root: Schema }
  SCHEMAS: SchemaMap
  BYID: SchemaMap
}

/** Builds a validator bound to one schema map ({ filename → parsed schema }). */
export function makeValidator (SCHEMAS: SchemaMap): Validator {
  const BYID: SchemaMap = {}
  for (const s of Object.values(SCHEMAS)) if (typeof s === 'object' && s.$id) BYID[s.$id] = s
  const walk = (node: any, parts: string[]): any => { let n = node; for (const p of parts) n = n[p]; return n }
  const resolveRef = (ref: string, root: Schema) => {
    if (ref.startsWith('#')) return { node: walk(root, ref.slice(2).split('/')), root }
    const [base, frag] = ref.split('#')
    const target = SCHEMAS[base!] || BYID[base!]
    if (!target) throw new Error('unresolvable $ref ' + ref)
    if (!frag) return { node: target, root: target }
    return { node: walk(target, frag.slice(1).split('/')), root: target }
  }
  function validate (data: unknown, schema: Schema, root: Schema, path = '$'): string[] {
    const errs: string[] = []
    const E = (m: string) => errs.push(`${path}: ${m}`)
    if (schema === false) { E('schema false'); return errs }
    if (schema === true || schema == null) return errs
    if (schema.$ref) { const { node, root: r } = resolveRef(schema.$ref, root); return validate(data, node, r, path) }
    const anyData = data as any
    if (schema.const !== undefined && jcs(data) !== jcs(schema.const)) E('const mismatch')
    if (schema.enum && !schema.enum.some((v: unknown) => jcs(v) === jcs(data))) E('enum mismatch')
    if (schema.type) {
      const t = Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data
      const want: string[] = ([] as string[]).concat(schema.type)
      const okT = want.some((w) => w === t || (w === 'integer' && t === 'number' && Number.isInteger(data)))
      if (!okT) { E(`type ${t} != ${schema.type}`); return errs }
    }
    if (typeof data === 'string') {
      if (schema.pattern && !new RegExp(schema.pattern).test(data)) E('pattern')
      // JSON Schema misst Stringlänge in CODEPUNKTEN, nicht UTF-16-
      // Einheiten (Review 4, M-2: 101 Emoji sind 101 Zeichen, nicht 202)
      const cpLen = (schema.minLength != null || schema.maxLength != null) ? [...data].length : 0
      if (schema.minLength != null && cpLen < schema.minLength) E('minLength')
      if (schema.maxLength != null && cpLen > schema.maxLength) E('maxLength')
    }
    if (Array.isArray(data)) {
      if (schema.minItems != null && data.length < schema.minItems) E('minItems')
      if (schema.maxItems != null && data.length > schema.maxItems) E('maxItems')
      if (schema.uniqueItems && new Set(data.map(jcs)).size !== data.length) E('uniqueItems')
      if (schema.prefixItems) {
        schema.prefixItems.forEach((ps: Schema, i: number) => { if (i < data.length) errs.push(...validate(data[i], ps, root, `${path}[${i}]`)) })
        if (schema.items === false && data.length > schema.prefixItems.length) E('items false beyond prefixItems')
      } else if (schema.items !== undefined && schema.items !== true) {
        data.forEach((d: unknown, i: number) => errs.push(...validate(d, schema.items, root, `${path}[${i}]`)))
      }
      if (schema.contains && !data.some((d: unknown) => validate(d, schema.contains, root, path).length === 0)) E('contains unmatched')
    }
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const keys = Object.keys(anyData)
      if (schema.minProperties != null && keys.length < schema.minProperties) E('minProperties')
      if (schema.maxProperties != null && keys.length > schema.maxProperties) E('maxProperties')
      for (const r of schema.required || []) if (!Object.hasOwn(anyData, r)) E(`missing required ${r}`)
      for (const [k, deps] of Object.entries(schema.dependentRequired || {} as Record<string, string[]>)) {
        if (Object.hasOwn(anyData, k)) for (const d of deps as string[]) if (!Object.hasOwn(anyData, d)) E(`dependentRequired ${k}→${d}`)
      }
      if (schema.propertyNames) for (const k of keys) errs.push(...validate(k, schema.propertyNames, root, `${path}.<name:${k}>`))
      for (const k of keys) {
        if (schema.properties && Object.hasOwn(schema.properties, k)) errs.push(...validate(anyData[k], schema.properties[k], root, `${path}.${k}`))
        else if (schema.additionalProperties === false) E(`additionalProperty ${k}`)
        else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') errs.push(...validate(anyData[k], schema.additionalProperties, root, `${path}.${k}`))
      }
    }
    if (typeof data === 'number') {
      if (schema.minimum != null && data < schema.minimum) E('minimum')
      if (schema.maximum != null && data > schema.maximum) E('maximum')
      if (schema.exclusiveMinimum != null && data <= schema.exclusiveMinimum) E('exclusiveMinimum')
      if (schema.exclusiveMaximum != null && data >= schema.exclusiveMaximum) E('exclusiveMaximum')
      if (schema.multipleOf != null && (data / schema.multipleOf) % 1 !== 0) E('multipleOf')
    }
    if (schema.anyOf && !schema.anyOf.some((s2: Schema) => validate(data, s2, root, path).length === 0)) E('anyOf unmatched')
    if (schema.oneOf) { const n = schema.oneOf.filter((s2: Schema) => validate(data, s2, root, path).length === 0).length; if (n !== 1) E(`oneOf matched ${n}`) }
    if (schema.not !== undefined && validate(data, schema.not, root, path).length === 0) E('not matched')
    if (schema.if !== undefined) {
      const hit = validate(data, schema.if, root, path).length === 0
      if (hit && schema.then !== undefined) errs.push(...validate(data, schema.then, root, path))
      if (!hit && schema.else !== undefined) errs.push(...validate(data, schema.else, root, path))
    }
    for (const sub of (schema.allOf || []) as Schema[]) errs.push(...validate(data, sub, root, path))
    return errs
  }
  return { validate, resolveRef, SCHEMAS, BYID }
}
