#!/usr/bin/env node
// Generates lib/src/wire.ts — TypeScript wire-artifact types derived from
// schemas/*.json. schemas/ stays the single source of truth; the types are
// the STRUCTURAL PROJECTION of each schema: properties, requiredness,
// literals, tuples and unions. What a type system cannot express stays in
// the schemas and remains normative there — patterns, length bounds,
// if/then/else conditionals, `not`, `contains`, `dependentRequired`,
// uniqueItems. A value that satisfies the type is therefore NOT yet
// conformant; it merely has the right shape to be validated.
//
// scripts/validate.mjs enforces freshness (a drifted emission fails the
// coherence gate). Never edit the generated file: change schemas/ and
// re-run this script.
//
//   usage: node scripts/build-wire-types.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// filename → generated type name: contact-card-0.25 → ContactCard025
const typeName = (file) => file
  .replace(/\.schema\.json$/, '')
  .split(/[^A-Za-z0-9]+/)
  .filter(Boolean)
  .map((s) => s[0].toUpperCase() + s.slice(1))
  .join('')

// a $ref to a sibling schema file (relative or under the published base URL)
const siblingRef = (ref) => {
  const m = /([a-z0-9.-]+\.schema\.json)$/.exec(ref)
  return m ? m[1] : null
}

export function renderWireTypes (schemasDir) {
  const files = readdirSync(schemasDir).filter((f) => f.endsWith('.json')).sort()
  const docs = new Map(files.map((f) => [f, JSON.parse(readFileSync(join(schemasDir, f), 'utf8'))]))
  const names = new Map(files.map((f) => [f, typeName(f)]))
  const byId = new Map(files.filter((f) => docs.get(f).$id).map((f) => [docs.get(f).$id, f]))

  // one renderer per document so #/$defs/... resolves locally
  const renderDoc = (doc) => {
    const seen = new Set() // $defs cycle guard

    const render = (s, indent) => {
      const pad = '  '.repeat(indent)
      const padIn = '  '.repeat(indent + 1)
      if (s === true || s === undefined) return 'Json'
      if (s === false) return 'never'

      if (typeof s.$ref === 'string') {
        const sib = siblingRef(s.$ref)
        if (sib && names.has(sib)) return names.get(sib)
        if (byId.has(s.$ref)) return names.get(byId.get(s.$ref))
        const local = /^#\/\$defs\/(.+)$/.exec(s.$ref)
        if (local && doc.$defs && doc.$defs[local[1]] !== undefined) {
          if (seen.has(local[1])) return 'Json' // cycle: stay total
          seen.add(local[1])
          const out = render(doc.$defs[local[1]], indent)
          seen.delete(local[1])
          return out
        }
        throw new Error(`unresolvable $ref: ${s.$ref}`)
      }

      if (Array.isArray(s.enum)) return s.enum.map((v) => JSON.stringify(v)).join(' | ')
      if ('const' in s) return JSON.stringify(s.const)

      const or = s.oneOf || s.anyOf
      if (Array.isArray(or)) return or.map((b) => `(${render(b, indent)})`).join(' | ')

      // allOf: intersect the structural branches; conditional-only branches
      // (if/then/else, not, contains) contribute nothing a type can carry
      if (Array.isArray(s.allOf)) {
        const structural = s.allOf.filter((b) => b === true || b === false ||
          (typeof b === 'object' && (b.$ref || b.type || b.properties || b.enum || 'const' in b || b.oneOf || b.anyOf || b.prefixItems || b.items)))
        const base = { ...s }
        delete base.allOf
        const parts = [render(base, indent), ...structural.map((b) => render(b, indent))]
          .filter((p) => p !== 'Json')
        return parts.length ? parts.map((p) => `(${p})`).join(' & ') : 'Json'
      }

      switch (s.type) {
        case 'string': return 'string'
        case 'number': case 'integer': return 'number'
        case 'boolean': return 'boolean'
        case 'null': return 'null'
        case 'array': {
          if (Array.isArray(s.prefixItems)) {
            const head = s.prefixItems.map((p) => render(p, indent))
            if (s.items === false || s.items === undefined) return `[${head.join(', ')}]`
            return `[${head.join(', ')}, ...(${render(s.items, indent)})[]]`
          }
          const el = render(s.items, indent)
          return el.includes('|') || el.includes('&') ? `Array<${el}>` : `${el}[]`
        }
        case 'object': {
          const props = s.properties || {}
          const req = new Set(s.required || [])
          const keys = Object.keys(props)
          if (!keys.length) {
            if (s.additionalProperties && typeof s.additionalProperties === 'object') {
              return `{ [k: string]: ${render(s.additionalProperties, indent)} }`
            }
            return '{ [k: string]: Json }'
          }
          const lines = keys.map((k) => {
            const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k)
            return `${padIn}${key}${req.has(k) ? '' : '?'}: ${render(props[k], indent + 1)}`
          })
          return `{\n${lines.join('\n')}\n${pad}}`
        }
        default:
          if (s.properties) return render({ ...s, type: 'object' }, indent)
          return 'Json'
      }
    }
    return render(doc, 0)
  }

  const blocks = files.map((f) => {
    const doc = docs.get(f)
    const title = doc.title ? ` — ${JSON.stringify(doc.title).slice(1, -1)}` : ''
    return `/** schemas/${f}${title} */\nexport type ${names.get(f)} = ${renderDoc(doc)}\n`
  })

  return `// GENERATED by scripts/build-wire-types.mjs — DO NOT EDIT.
// Source of truth: schemas/*.json. scripts/validate.mjs enforces freshness.
//
// These are the STRUCTURAL PROJECTIONS of the wire schemas: shape,
// requiredness, literals, tuples, unions. Patterns, length bounds,
// if/then/else, \`not\`, \`contains\`, \`dependentRequired\` and uniqueItems
// are NOT expressible here and remain normative in the schemas alone —
// satisfying a type is necessary for conformance, never sufficient.
// Validate against SCHEMAS before treating any value as a wire artifact.
import type { Json } from './core.js'

${blocks.join('\n')}`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = renderWireTypes(join(ROOT, 'schemas'))
  writeFileSync(join(ROOT, 'lib/src/wire.ts'), out)
  console.log(`lib/src/wire.ts: ${readdirSync(join(ROOT, 'schemas')).filter((f) => f.endsWith('.json')).length} wire types generated`)
}
