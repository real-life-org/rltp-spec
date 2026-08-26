#!/usr/bin/env node
// OPTIONAL deep check: JSON-LD 1.1 expansion of the three RLTP credential
// forms under [W3C VC v2, DTG v1 (local WD01 term stub — the published URL
// 404s, a recorded upstream nit), pinned RLTP context]. Guards the
// @propagate/protected-term repairs of the DTG conversion (rounds 3/6):
// every RLTP vocabulary term must survive expansion with a real IRI, and
// no protected-term error may occur.
//
// Requires the `jsonld` package and network access to www.w3.org — both
// unavailable in the zero-dep runner, so this check SKIPS (exit 0) when
// they are missing; pass --strict (or LD_EXPAND_STRICT=1) to turn a skip
// into exit 2, so CI-like usage cannot mistake breakage for success. The
// pinned context itself is guarded hermetically by conformance/runner.mjs
// (value pin).
//
//   usage: NODE_PATH=<dir with node_modules/jsonld> node conformance/ld-expand.mjs [--strict]
import { createRequire } from 'node:module'
import fs from 'node:fs'
import https from 'node:https'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const STRICT = process.argv.includes('--strict') || process.env.LD_EXPAND_STRICT === '1'
const skip = (msg) => { console.log(`ld-expand: ${STRICT ? 'SKIP (strict: treated as failure)' : 'SKIP'} — ${msg}`); process.exit(STRICT ? 2 : 0) }
let jsonld
try {
  jsonld = createRequire(import.meta.url)('jsonld')
} catch {
  try { jsonld = (await import('jsonld')).default } catch {
    skip('jsonld package not available (optional deep check)')
  }
}

const URLS = {
  vc: 'https://www.w3.org/ns/credentials/v2',
  dtg: 'https://firstperson.network/credentials/dtg/v1',
  rltp: 'https://real-life.org/rltp/v1',
}
const fetchJson = (url) => new Promise((resolve, reject) => https.get(url, { headers: { accept: 'application/ld+json, application/json' } }, (res) => {
  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return resolve(fetchJson(new URL(res.headers.location, url).href))
  let data = ''; res.on('data', (c) => data += c); res.on('end', () => res.statusCode === 200 ? resolve(JSON.parse(data)) : reject(new Error(`${url}: HTTP ${res.statusCode}`)))
}).on('error', reject))

const docs = new Map()
try {
  docs.set(URLS.vc, await fetchJson(URLS.vc))
} catch (e) {
  skip(`cannot fetch the W3C v2 context (${e.message})`)
}
docs.set(URLS.dtg, { '@context': { '@protected': true,
  DTGCredential: 'https://firstperson.network/credentials/dtg#DTGCredential',
  RelationshipCredential: 'https://firstperson.network/credentials/dtg#RelationshipCredential',
  InvitationCredential: 'https://firstperson.network/credentials/dtg#InvitationCredential',
  EndorsementCredential: 'https://firstperson.network/credentials/dtg#EndorsementCredential',
  taskContext: 'https://firstperson.network/credentials/dtg#taskContext',
} })
docs.set(URLS.rltp, JSON.parse(fs.readFileSync(join(ROOT, 'contexts/rltp-v1.jsonld'))))
const documentLoader = async (url) => {
  if (!docs.has(url)) throw new Error(`unmapped context ${url}`)
  return { contextUrl: null, documentUrl: url, document: docs.get(url) }
}

// the three credential forms from the shipped vectors, PLUS synthetic
// full-vocabulary variants that exercise EVERY term of the pinned context
// (optional card members included) — so a dropped or corrupted term
// definition cannot hide behind a fixture that never uses it
const V = JSON.parse(fs.readFileSync(join(ROOT, 'vectors/dtg-credentials.json')))
const EC = JSON.parse(fs.readFileSync(join(ROOT, 'vectors/encounter-cards.json')))
const encounterFull = JSON.parse(JSON.stringify(EC.credential))
encounterFull.credentialSubject.channel = 'nearby'
encounterFull.credentialSubject.commitment = { suite: 'sample@1', value: 'z1' }
const inviteFull = JSON.parse(JSON.stringify(V.invite.payload.invite))
Object.assign(inviteFull.credentialSubject.card, { sentTo: inviteFull.credentialSubject.id, boundTo: 'A'.repeat(22), deliveryHints: ['hint'], challenge: { value: 'C'.repeat(22), issuedAt: '2026-08-25T12:00:00Z' }, name: 'Card Name' })
const forms = {
  encounter: EC.credential,
  encounterFull,
  vouch: V.vouch.u,
  invite: V.invite.payload.invite,
  inviteFull,
}
// RLTP vocabulary IRIs that MUST survive expansion, per form — the *Full
// forms together cover every term the pinned context defines
const MUST = {
  encounter: ['#credentialFormat', '#Ceremony', '#EnactmentBinding'],
  encounterFull: ['#credentialFormat', '#Ceremony', '#EnactmentBinding', '#channel', '#commitment', '#commitmentSuite', '#commitmentValue', '#Challenge'],
  vouch: ['#endorsement', '#genesisDigest', '#acceptDigest', '#provenance'],
  invite: ['#group', '#genesisDigest', '#displayNote', '#contactCard', '#cardVersion', '#anchor', '#keyAgreement', 'schema.org/name', 'security#proof'],
  inviteFull: ['#group', '#genesisDigest', '#displayNote', '#contactCard', '#cardVersion', '#anchor', '#keyAgreement', '#sentTo', '#boundTo', '#deliveryHints', '#challengeValue', '#challengeIssuedAt', 'schema.org/name', 'security#proof'],
}
// completeness gate: EVERY term IRI the pinned context defines — any
// namespace, any absolute-IRI scheme — must be one of the EXACTLY
// enumerated covered IRIs; adding any context term without a fixture
// fails here (exact equality, no substring bypass)
const collectIris = (node, out = new Set()) => {
  if (typeof node === 'string') { if (/^[a-z][a-z0-9+.-]*:/i.test(node)) out.add(node) }
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) { if (k !== '@version') collectIris(v, out) }
  return out
}
const ctxIris = [...collectIris(docs.get(URLS.rltp))]
// normalize MUST entries to full IRIs — coverage AND the expansion check
// below both compare full IRIs by exact set membership (no substrings)
const FULL = { 'schema.org/name': 'https://schema.org/name', 'security#proof': 'https://w3id.org/security#proof', 'security#challenge': 'https://w3id.org/security#challenge' }
const fullIri = (m) => m.startsWith('#') ? 'https://real-life.org/rltp/v1' + m : (FULL[m] ?? m)
// the exact @type IRIs each form MUST expand to — a re-mapped credential
// type (e.g. EncounterCredential @id pointed at MembershipInvite) fails here
const W3C_VC = 'https://www.w3.org/2018/credentials#VerifiableCredential'
const DTG = 'https://firstperson.network/credentials/dtg#'
const RLTP = 'https://real-life.org/rltp/v1#'
const MUST_TYPES = {
  encounter: [W3C_VC, DTG + 'DTGCredential', DTG + 'RelationshipCredential', RLTP + 'EncounterCredential'],
  encounterFull: [W3C_VC, DTG + 'DTGCredential', DTG + 'RelationshipCredential', RLTP + 'EncounterCredential'],
  vouch: [W3C_VC, DTG + 'DTGCredential', DTG + 'EndorsementCredential', RLTP + 'AdmissionVouch'],
  invite: [W3C_VC, DTG + 'DTGCredential', DTG + 'InvitationCredential', RLTP + 'MembershipInvite'],
  inviteFull: [W3C_VC, DTG + 'DTGCredential', DTG + 'InvitationCredential', RLTP + 'MembershipInvite'],
}
const covered = new Set([...Object.values(MUST).flat().map(fullIri), ...Object.values(MUST_TYPES).flat()])
const uncovered = ctxIris.filter((i) => !covered.has(i))
if (uncovered.length) { console.error(`  FAIL  vocabulary coverage: context defines terms no fixture exercises: ${uncovered.join(', ')}`); process.exit(1) }
console.log('  ok    vocabulary coverage: every pinned term IRI (all schemes, exact match) is exercised by a fixture')
// collect the EXACT expanded IRIs: every property key and every @type
// value of every node — a corrupted mapping (e.g. #commitment →
// #commitmentSuite) yields a different member and fails set membership
const collectExpanded = (node, out = new Set()) => {
  if (Array.isArray(node)) { for (const n of node) collectExpanded(n, out) }
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === '@type') { for (const t of [].concat(v)) out.add(t) }
      else if (/^[a-z][a-z0-9+.-]*:/i.test(k)) out.add(k)
      collectExpanded(v, out)
    }
  }
  return out
}
let fail = 0
for (const [name, doc] of Object.entries(forms)) {
  try {
    const expanded = await jsonld.expand(doc, { documentLoader })
    const got = collectExpanded(expanded)
    const missing = [...MUST[name].map(fullIri), ...MUST_TYPES[name]].filter((iri) => !got.has(iri))
    if (missing.length) { fail++; console.error(`  FAIL  ${name}: expanded but MISSING exact IRIs: ${missing.join(', ')}`) } else console.log(`  ok    ${name}: every expected property AND type IRI appears verbatim`)
  } catch (e) {
    fail++
    console.error(`  FAIL  ${name}: ${e.message}${e.details?.term ? ` (term: ${e.details.term})` : ''}`)
  }
}
if (fail) { console.error('ld-expand: FAILED'); process.exit(1) }
console.log('ld-expand: all three credential forms expand with full vocabulary.')
