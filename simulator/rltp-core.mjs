// rltp-core — the shared form layer of the RLTP reference implementation.
//
// THE SEED OF THE LIBRARY: one implementation of the canonical form rules
// (JCS subset, multibase encodings, digest equality over decoded bytes,
// timestamp normalization) and THE JSON-Schema subset validator — used by
// the conformance suite (conformance/lib.mjs delegates here), by the node
// engine (simulator/engine.mjs via lib), and by the browser simulators
// (index.html + the coming three-phone pages, with schemas from the
// generated bundle simulator/rltp-schemas.mjs).
//
// Predicates exist ONCE (the review-loop lesson): weakening a rule here
// fails the conformance runner's self-tests, not silently a UI.
//
// Dependency-free, environment-free (no node:*, no DOM, no WebCrypto):
// everything in this module is synchronous pure JS. The crypto layer
// (Ed25519/X25519/HKDF/AES via WebCrypto) is the next extraction step and
// will live beside this file, following simulator/graph-web.mjs.

// ── JCS (RFC 8785 subset for the ASCII I-JSON forms this stack ships) ──
export const jcs = (o) => {
  if (o === undefined) throw new Error('jcs: undefined is not serializable')
  // RFC 8785: eine Lone Surrogate ist kein Unicode-String — Fehler statt
  // Kanonisierung (lib-Review 3, B-1; identisch geerbt)
  if (typeof o === 'string' && !o.isWellFormed()) throw new Error('jcs: lone surrogate')
  if (typeof o === 'number' && !Number.isFinite(o)) throw new Error('jcs: non-finite number')
  // Sparse Arrays kollidieren auf einen Digest ([empty] und [] wären
  // gleich) — verwerfen statt still kanonisieren (lib-Review 4, B-3)
  if (Array.isArray(o)) {
    for (let i = 0; i < o.length; i++) if (!(i in o)) throw new Error('jcs: sparse array')
    // Nicht-Index-Eigenschaften und Symbol-Schlüssel würden still
    // verworfen und mit dem nackten Array kollidieren (lib-Review 6, B-2)
    if (Object.getOwnPropertyNames(o).length !== o.length + 1 /* 'length' selbst */ || Object.getOwnPropertySymbols(o).length > 0) throw new Error('jcs: array with extra own properties')
  }
  return Array.isArray(o) ? '[' + o.map(jcs).join(',') + ']'
    : (o && typeof o === 'object')
      ? (plainOr(o)) && '{' + Object.keys(o).sort().map((k) => {
        if (o[k] === undefined) throw new Error('jcs: undefined property ' + k)
        if (!k.isWellFormed()) throw new Error('jcs: lone surrogate in key')
        return JSON.stringify(k) + ':' + jcs(o[k])
      }).join(',') + '}'
      : term(o)
}
// Symbol/Funktion stringifizieren zu undefined — Fehler am Rand statt
// leerer Digest-Eingabe (lib-Review 1 M-4 / Review 5 B-4, Parität)
// nur ECHTE JSON-Objekte: Date/Map/Instanzen kollidierten mit {}
// (lib-Review 5, B-3; Parität)
const plainOr = (o) => {
  const proto = Object.getPrototypeOf(o)
  if (proto !== null && proto !== Object.prototype) throw new Error('jcs: not a plain JSON object')
  // Symbol-Schlüssel würden still verworfen (lib-Review 6, B-2)
  if (Object.getOwnPropertySymbols(o).length > 0) throw new Error('jcs: object with symbol keys')
  if (Object.getOwnPropertyNames(o).length !== Object.keys(o).length) throw new Error('jcs: object with non-enumerable own properties')
  return true
}
const term = (o) => {
  const s = JSON.stringify(o)
  if (typeof s !== 'string') throw new Error('jcs: value is not JSON-representable')
  return s
}

// Das Form-Gate der Probe-Empfänger (lib-Review 2 M-3 / 6 M-2, Parität):
// eine gültige Signatur bindet, was signiert wurde — die FORM ist ein
// eigenes, früheres Gate. 'string' | 'number' | 'boolean' | 'object' | 'array'
export const shaped = (o, fields) =>
  o !== null && typeof o === 'object' && !Array.isArray(o) && Object.entries(fields).every(([k, t]) =>
    t === 'array' ? Array.isArray(o[k])
    : t === 'object' ? (o[k] !== null && typeof o[k] === 'object' && !Array.isArray(o[k]))
    : typeof o[k] === t)

// kanonischer Dezimal-Integer-String: keine führenden Nullen, >= 1,
// <= 18 Stellen — die Form jedes Sequenzfeldes (lib-Review 9, P-B1)
export const intStr = (v) => typeof v === 'string' && /^[1-9][0-9]{0,17}$/.test(v)

// ── multibase encodings ─────────────────────────────────────────────────
export const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
export function base58 (bytes) {
  let n = 0n
  for (const b of bytes) n = n * 256n + BigInt(b)
  let out = ''
  while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n }
  for (const b of bytes) { if (b === 0) out = '1' + out; else break }
  return out
}
export function fromBase58 (s) {
  let n = 0n
  for (const c of s) {
    const i = B58.indexOf(c)
    if (i < 0) return null
    n = n * 58n + BigInt(i)
  }
  const out = []
  while (n > 0n) { out.unshift(Number(n % 256n)); n /= 256n }
  for (const c of s) { if (c === '1') out.unshift(0); else break }
  return new Uint8Array(out)
}
export const b64uOf = (bytes) => {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  const btoaFn = typeof btoa === 'function' ? btoa : (x) => Buffer.from(x, 'binary').toString('base64')
  return btoaFn(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export const fromB64u = (s) => {
  const atobFn = typeof atob === 'function' ? atob : (x) => Buffer.from(x, 'base64').toString('binary')
  const bin = atobFn(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

// ── digest equality over decoded multihash bytes (Encounter 2.3) ────────
// toU: strict multibase bridge — prefix, sha2-256 multihash header and
// length, AND canonical-form round-trip; returns the canonical u rendering
// or null. A u input is checked for header/length too.
export const toU = (v) => {
  if (typeof v !== 'string' || v.length < 2) return null
  let bytes
  if (v[0] === 'u') {
    try { bytes = fromB64u(v.slice(1)) } catch { return null }
    // canonical base64url only — padding or non-zero trailing bits make a
    // DIFFERENT string decode to the same bytes (lib review 1, B-1; the
    // shipped reject vectors demand exactly this)
    if (bytes && 'u' + b64uOf(bytes) !== v) return null
  } else if (v[0] === 'z') {
    bytes = fromBase58(v.slice(1))
    if (bytes && 'z' + base58(bytes) !== v) return null // canonical base58btc only
  } else return null
  if (!bytes || bytes.length !== 34 || bytes[0] !== 0x12 || bytes[1] !== 0x20) return null
  return 'u' + b64uOf(bytes)
}
export const sameDigest = (a, b) => { const na = toU(a); return na !== null && na === toU(b) }

// ── timestamps (Encounter 2.3) ──────────────────────────────────────────
// tsec: whole-second truncation of EVERY comparison operand (incl. now).
export const tsec = (v) => Math.floor((typeof v === 'number' ? v : Date.parse(v)) / 1000) * 1000
// calOK: calendar-valid round-trip AND the ≤3-fractional-digit cap —
// Date.parse silently normalizes impossible dates, so demand the round-trip.
export const calOK = (t) => {
  if (typeof t !== 'string') return false
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?Z$/.test(t)) return false
  const d = new Date(t)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 19) === t.slice(0, 19)
}

// ── THE JSON-Schema subset validator (exactly the keywords we ship) ─────
// makeValidator(schemaMap): schemaMap is { filename → parsed schema }.
// Returns { validate, resolveRef, SCHEMAS, BYID } bound to that map.
export function makeValidator (SCHEMAS) {
  const BYID = {}
  for (const s of Object.values(SCHEMAS)) if (s.$id) BYID[s.$id] = s
  const resolveRef = (ref, root) => {
    if (ref.startsWith('#')) { let n = root; for (const p of ref.slice(2).split('/')) n = n[p]; return { node: n, root } }
    const [base, frag] = ref.split('#')
    const target = SCHEMAS[base] || BYID[base]
    if (!target) throw new Error('unresolvable $ref ' + ref)
    if (!frag) return { node: target, root: target }
    let n = target; for (const p of frag.slice(1).split('/')) n = n[p]
    return { node: n, root: target }
  }
  function validate (data, schema, root, path = '$') {
    const errs = []
    const E = (m) => errs.push(`${path}: ${m}`)
    if (schema === false) { E('schema false'); return errs }
    if (schema === true || schema == null) return errs
    if (schema.$ref) { const { node, root: r } = resolveRef(schema.$ref, root); return validate(data, node, r, path) }
    if (schema.const !== undefined && jcs(data) !== jcs(schema.const)) E('const mismatch')
    if (schema.enum && !schema.enum.some((v) => jcs(v) === jcs(data))) E('enum mismatch')
    if (schema.type) {
      const t = Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data
      const want = [].concat(schema.type)
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
        schema.prefixItems.forEach((ps, i) => { if (i < data.length) errs.push(...validate(data[i], ps, root, `${path}[${i}]`)) })
        if (schema.items === false && data.length > schema.prefixItems.length) E('items false beyond prefixItems')
      } else if (schema.items !== undefined && schema.items !== true) {
        data.forEach((d, i) => errs.push(...validate(d, schema.items, root, `${path}[${i}]`)))
      }
      if (schema.contains && !data.some((d) => validate(d, schema.contains, root, path).length === 0)) E('contains unmatched')
    }
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const keys = Object.keys(data)
      if (schema.minProperties != null && keys.length < schema.minProperties) E('minProperties')
      if (schema.maxProperties != null && keys.length > schema.maxProperties) E('maxProperties')
      for (const r of schema.required || []) if (!Object.hasOwn(data, r)) E(`missing required ${r}`)
      for (const [k, deps] of Object.entries(schema.dependentRequired || {})) if (Object.hasOwn(data, k)) for (const d of deps) if (!Object.hasOwn(data, d)) E(`dependentRequired ${k}→${d}`)
      if (schema.propertyNames) for (const k of keys) errs.push(...validate(k, schema.propertyNames, root, `${path}.<name:${k}>`))
      for (const k of keys) {
        if (schema.properties && Object.hasOwn(schema.properties, k)) errs.push(...validate(data[k], schema.properties[k], root, `${path}.${k}`))
        else if (schema.additionalProperties === false) E(`additionalProperty ${k}`)
        else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') errs.push(...validate(data[k], schema.additionalProperties, root, `${path}.${k}`))
      }
    }
    if (typeof data === 'number') {
      if (schema.minimum != null && data < schema.minimum) E('minimum')
      if (schema.maximum != null && data > schema.maximum) E('maximum')
      if (schema.exclusiveMinimum != null && data <= schema.exclusiveMinimum) E('exclusiveMinimum')
      if (schema.exclusiveMaximum != null && data >= schema.exclusiveMaximum) E('exclusiveMaximum')
      if (schema.multipleOf != null && (data / schema.multipleOf) % 1 !== 0) E('multipleOf')
    }
    if (schema.anyOf && !schema.anyOf.some((s2) => validate(data, s2, root, path).length === 0)) E('anyOf unmatched')
    if (schema.oneOf) { const n = schema.oneOf.filter((s2) => validate(data, s2, root, path).length === 0).length; if (n !== 1) E(`oneOf matched ${n}`) }
    if (schema.not !== undefined && validate(data, schema.not, root, path).length === 0) E('not matched')
    if (schema.if !== undefined) {
      const hit = validate(data, schema.if, root, path).length === 0
      if (hit && schema.then !== undefined) errs.push(...validate(data, schema.then, root, path))
      if (!hit && schema.else !== undefined) errs.push(...validate(data, schema.else, root, path))
    }
    for (const sub of schema.allOf || []) errs.push(...validate(data, sub, root, path))
    return errs
  }
  return { validate, resolveRef, SCHEMAS, BYID }
}
