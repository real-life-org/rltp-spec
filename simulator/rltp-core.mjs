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
  if (typeof o === 'number' && !Number.isFinite(o)) throw new Error('jcs: non-finite number')
  return Array.isArray(o) ? '[' + o.map(jcs).join(',') + ']'
    : (o && typeof o === 'object')
      ? '{' + Object.keys(o).sort().map((k) => {
        if (o[k] === undefined) throw new Error('jcs: undefined property ' + k)
        return JSON.stringify(k) + ':' + jcs(o[k])
      }).join(',') + '}'
      : JSON.stringify(o)
}

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
  if (v[0] === 'u') bytes = fromB64u(v.slice(1))
  else if (v[0] === 'z') {
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
      if (schema.minLength != null && data.length < schema.minLength) E('minLength')
      if (schema.maxLength != null && data.length > schema.maxLength) E('maxLength')
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
      for (const r of schema.required || []) if (!(r in data)) E(`missing required ${r}`)
      for (const [k, deps] of Object.entries(schema.dependentRequired || {})) if (k in data) for (const d of deps) if (!(d in data)) E(`dependentRequired ${k}→${d}`)
      if (schema.propertyNames) for (const k of keys) errs.push(...validate(k, schema.propertyNames, root, `${path}.<name:${k}>`))
      for (const k of keys) {
        if (schema.properties && k in schema.properties) errs.push(...validate(data[k], schema.properties[k], root, `${path}.${k}`))
        else if (schema.additionalProperties === false) E(`additionalProperty ${k}`)
        else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') errs.push(...validate(data[k], schema.additionalProperties, root, `${path}.${k}`))
      }
    }
    for (const sub of schema.allOf || []) errs.push(...validate(data, sub, root, path))
    return errs
  }
  return { validate, resolveRef, SCHEMAS, BYID }
}
