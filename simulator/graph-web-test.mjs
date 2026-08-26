#!/usr/bin/env node
// Assertions for the browser core (runs in node 20+ via globalThis.crypto).
// Covers the review-1 invariants (strict verification, deterministic
// replay, append-only publication, one-sided trust, delivered stars,
// executed tag crypto) and the DEFERRED ANCHOR DISCLOSURE probe after
// review 2: pairwise-only ceremony (no self artifact), pair cards,
// DV mappings (3DH-MAC) for self AND context linkages, blinded stars
// with purpose-separated keys.
import {
  createWorld, addPerson, encounter, createGroup, join, promote, setTrust,
  setTag, linkClusters, sharedGroups, rosterNames, rosterName,
  verifyEncounter, verifyMapping, forgeMapping, starMatch, starKey,
  verifyPairCard, verifyCtxMapping, makeCtxMapping,
  contactKey, contactEntry, self, persona, diVerify, jcs, xSharedHex,
} from './graph-web.mjs'

let failed = 0
const assert = (c, m) => { if (!c) { console.error(`✗ ${m}`); failed++ } else console.log(`✓ ${m}`) }
let now = Date.parse('2026-08-21T12:00:00Z')

const w = createWorld()
const me = await addPerson(w, 'Ich', '#3b82f6')
const peter = await addPerson(w, 'Peter', '#ef4444')
const sam = await addPerson(w, 'Sam', '#84cc16')

// ── deferred anchor disclosure: the ceremony is pairwise-only ───────────
const e1 = await encounter(w, me, peter, now)
const selfMe = (await self(me)).anchor
assert(e1.R.a.anchor !== selfMe && e1.S === undefined,
  'Zeremonie: NUR pairwise — kein self-signiertes Artefakt entsteht (Review-2 B1)')
assert(e1.R.a.anchor === (await persona(me, `pair/${e1.bind}`)).anchor,
  'pairwise Anker = pair/<binding>, aus der Wurzel abgeleitet (Register-faehig)')
const v1 = await verifyEncounter(e1)
assert(v1.ok && v1.okClaims, 'pairwise Credentials: Signaturen + Claims + Binding rekomputiert (WebCrypto)')
assert(contactEntry(me, 'Peter').selfAnchor === null, 'DEFERRED: nach der Zeremonie haelt Ich Peters self-Anker NICHT')
assert(contactKey(me, 'Peter') === e1.R.b.anchor, 'Kontakt-Schluessel = pairwise Anker des Gegenuebers')
// pair contact card: X key is BOUND to the pair anchor (review-2 M3)
{
  const card = contactEntry(me, 'Peter').theirCard
  assert(await verifyPairCard(card, e1.R.b.anchor), 'Pair-Card: keyAgreement unter dem pair-Anker signiert')
  const sub = JSON.parse(JSON.stringify(card)); sub.keyAgreement = 'ab'.repeat(32)
  assert(!(await verifyPairCard(sub, e1.R.b.anchor)), 'Schluessel-Substitution in der Pair-Card wird erkannt (Sig bricht)')
}

const e3 = await encounter(w, me, sam, now += 60_000)
assert(rosterNames(me, w).sort().join(',') === 'Peter,Sam', 'Roster = Peter + Sam')
assert((await encounter(w, me, peter, now + 999)) === null && [...me.contacts.values()].filter((c) => c.name === 'Peter').length === 1,
  'Duplikat-Zeremonie ist No-op — EINE Beziehung pro Paar, am Emitter erzwungen (F14 in den Kern gezogen)')

// ── promotion: trust delivers the DV mapping (3DH-MAC, class V) ─────────
{
  await setTrust(w, peter, me, true, now + 1000) // Peters einseitiger Akt
  const entry = contactEntry(me, 'Peter')
  const peterSelf = (await self(peter)).anchor
  assert(entry.selfAnchor === peterSelf, 'Promotion: Ich haelt jetzt Peters self-Anker')
  assert(await verifyMapping(me, entry.mapping),
    'DV-Zuordnung (3DH-MAC, reines WebCrypto): Adressat verifiziert mit eigenen Geheimnissen')
  assert(!entry.mapping.body.proof && entry.mapping.mac1 && entry.mapping.mac2,
    'keine uebertragbare Signatur am Verknuepfungs-Body — nur MACs')
  assert(await diVerify(entry.mapping.card, peterSelf),
    'self-Karte: Ed↔X-Bindung DERSELBEN Identitaet, uebertragbar aber harmlos')
  assert(!(await verifyMapping(sam, entry.mapping)),
    'Dritte koennen die Zuordnung nicht einmal PRUEFEN (Verifikation braucht Adressaten-Geheimnisse)')
  assert(contactEntry(peter, 'Ich').selfAnchor === null, 'Einseitigkeit: Peter haelt meinen self-Anker weiterhin NICHT')
  // tamper: claiming a foreign self anchor breaks card binding and MACs
  const t = JSON.parse(JSON.stringify(entry.mapping))
  t.body.self = (await self(sam)).anchor
  assert(!(await verifyMapping(me, t)), 'Tampering: fremder self-Anker in der Zuordnung wird abgelehnt')
  // DENIABILITY: the recipient fabricates a LIE — "Peters self belongs to
  // Sams pair anchor" — using Peters genuine card, and it verifies
  // identically. A leaked mapping is indistinguishable from an invention.
  const fake = await forgeMapping(me, entry.mapping.card, contactKey(me, 'Sam'), now + 2000)
  assert(await verifyMapping(me, fake),
    'ABSTREITBARKEIT: Adressat fabriziert beliebige Verknuepfung, verifiziert identisch — Leak beweist Dritten nichts')
  await setTrust(w, peter, me, false)
  assert(contactEntry(me, 'Peter').selfAnchor === peterSelf,
    'Trust aus: der zugestellte self-Anker bleibt (irreversibles Wissen)')
}

// ── tampering matrix (F4/F6): every manipulation must fail ──────────────
{
  const clone = (o) => JSON.parse(JSON.stringify(o))
  const t1 = clone(e1); t1.R.cred.credentialSubject.challenge = 'unrelated'
  assert(!(await verifyEncounter(t1)).ok, 'Tampering: falsche Challenge wird abgelehnt (Sig bricht)')
  const t2 = { ...e1, R: { ...e1.R } }
  const cs = clone(e1.R.cred); cs.credentialSubject = { ...cs.credentialSubject, challenge: 'forged-challenge-value' }
  t2.R = { ...e1.R, cred: { ...e1.R.cred, credentialSubject: cs.credentialSubject } }
  assert(!(await verifyEncounter(t2)).okClaims, 'Tampering: Claims-Pruefung erkennt fremde Challenge')
  const d = clone(e1.R.cred)
  d.proof.cryptosuite = 'totally-not-eddsa'
  assert(!(await diVerify(d, e1.R.a.anchor)), 'diVerify: falsche cryptosuite abgelehnt')
  const d2 = clone(e1.R.cred); d2.proof.proofValue = 'x' + d2.proof.proofValue.slice(1)
  assert(!(await diVerify(d2, e1.R.a.anchor)), 'diVerify: falscher Multibase-Praefix abgelehnt')
  const d3 = clone(e1.R.cred); d3.issuer = 'did:key:z6MkVictimVictimVictim'
  assert(!(await diVerify(d3, e1.R.a.anchor)), 'diVerify: Issuer-Spoofing abgelehnt (issuer an Anker gebunden)')
  const d4 = clone(e1.R.cred); d4.proof.type = 'NotADataIntegrityProof'
  assert(!(await diVerify(d4, e1.R.a.anchor)), 'diVerify: falscher Proof-Typ abgelehnt')
  const d5 = clone(e1.R.cred); d5['@context'] = ['https://evil.example/ctx']
  assert(!(await diVerify(d5, e1.R.a.anchor)), 'diVerify: @context-Tampering abgelehnt (Kontext im Proof gebunden)')
}

// ── deterministic replay (F7): same seeds + entropy => identical bytes ──
{
  const seedA = new Uint8Array(32).fill(7), seedB = new Uint8Array(32).fill(9)
  const mk = async () => {
    const w2 = createWorld()
    const a = await addPerson(w2, 'A', '#000', seedA.slice())
    const b = await addPerson(w2, 'B', '#111', seedB.slice())
    return { w2, a, b }
  }
  const x = await mk(), y = await mk()
  const e = await encounter(x.w2, x.a, x.b, now)
  const f = await encounter(y.w2, y.a, y.b, now, JSON.parse(JSON.stringify(e.ent)))
  assert(jcs(e.R.cred) === jcs(f.R.cred) && jcs(e.R.counter) === jcs(f.R.counter)
    && e.R.a.anchor === f.R.a.anchor && e.R.bind === f.R.bind,
    'Replay: gleiche Seeds + Entropie ⇒ bytegleiche Dokumente, gleiche pair-Anker, gleiche Bindings')
  // the promotion is deterministic too (mapping derives from roots + bind)
  await setTrust(x.w2, x.a, x.b, true, now + 500)
  await setTrust(y.w2, y.a, y.b, true, now + 500)
  assert(jcs(contactEntry(x.b, 'A').mapping) === jcs(contactEntry(y.b, 'A').mapping),
    'Replay: auch die DV-Zuordnung ist bytegleich reproduzierbar (deterministische Nonces)')
}

// ── groups, append-only membership (F10), executed tags (F11) ───────────
const chor = await createGroup(w, 'chor', 'Choir')
const rat = await createGroup(w, 'rat', 'Council')
await join(w, me, chor, now); await join(w, peter, chor, now)
await join(w, me, rat, now); await join(w, peter, rat, now)
assert((await sharedGroups(me, contactKey(me, 'Peter'), w)).length === 2,
  'encountered-Modus: 2 gemeinsame Gruppen via zugestellte Zuordnungen sichtbar')

// ── context mappings are DV artifacts (review-2 B2) ─────────────────────
{
  const entry = contactEntry(me, 'Peter')
  const label = `group/${chor.genesisDigest}`
  const m = entry.ctxMappings.get(label)
  assert(!!m && await verifyCtxMapping(me, m), 'Kontext-Mapping: DV-Artefakt (Kontext-Karte + 2 MACs), vom Adressaten verifiziert')
  const t = JSON.parse(JSON.stringify(m)); t.body.anchor = (await persona(me, label)).anchor
  assert(!(await verifyCtxMapping(me, t)), 'Kontext-Mapping: fremder Roster-Anker wird abgelehnt (Karte+MACs brechen)')
  assert(!(await verifyCtxMapping(sam, m)), 'Kontext-Mapping: Dritte koennen nicht einmal pruefen (Adressaten-gebunden)')
  const sw = JSON.parse(JSON.stringify(m)); const tmp = sw.mac1; sw.mac1 = sw.mac2; sw.mac2 = tmp
  assert(!(await verifyCtxMapping(me, sw)), 'Domain-Trennung: vertauschte MACs werden abgelehnt')
}

{
  const pAnchor = (await persona(peter, `group/${chor.genesisDigest}`)).anchor
  await join(w, peter, chor, now += 1000, 'Peter')   // named
  await join(w, peter, chor, now += 1000)            // anonymous again
  const entry = chor.roster.get(pAnchor)
  assert(entry.docs.length === 3, 'Membership append-only: alle ausgestellten Dokumente bleiben')
  assert(rosterName(entry) === 'Peter', 'einmal benannt = fuer Digest-Halter benannt (publish is forever)')
}

{
  // tags: executed HMAC — under deferred disclosure a tag resolves ONLY
  // against contacts who PROMOTED you (their self anchor is the HMAC input)
  const lena = await addPerson(w, 'Lena', '#ec4899'); lena.mode = 'friends'
  await encounter(w, me, lena, now += 60_000)
  await join(w, lena, chor, now)
  assert((await sharedGroups(me, contactKey(me, 'Lena'), w)).length === 0, 'friends-Modus: nichts verbunden vor Tag/Befoerderung')
  await setTag(w, lena, 'chor', true)
  assert((await sharedGroups(me, contactKey(me, 'Lena'), w)).length === 0,
    'DEFERRED: Tag unaufloesbar ohne Lenas self-Anker — die Zeremonie hat ihn nicht geliefert')
  await setTrust(w, lena, me, true, now + 1000)
  // isolate the TAG path: strip the group mappings the friends-mode
  // promotion auto-disclosed, so only the HMAC recomputation can match
  for (const [l] of [...contactEntry(me, 'Lena').disclosed]) if (l.startsWith('group/')) contactEntry(me, 'Lena').disclosed.delete(l)
  assert((await sharedGroups(me, contactKey(me, 'Lena'), w)).join() === 'chor',
    'Tag (echtes HMAC): nach Befoerderung erkennt der Co-Mitglied-Kontakt die Mitgliedschaft')
  assert((await sharedGroups(sam, (await self(lena)).anchor, w)).length === 0, 'Nicht-Kontakt erkennt nichts (kein self-Anker zugestellt)')
  await setTag(w, lena, 'chor', false)
  assert((await sharedGroups(me, contactKey(me, 'Lena'), w)).join() === 'chor', 'Tag aus: Artefakt bleibt erkennbar (publish is forever)')
}

// ── one-sided trust + BLINDED stars (F2/F9 + audience class D) ──────────
{
  const anna = await addPerson(w, 'Anna', '#3b82f6')
  const bert = await addPerson(w, 'Bert', '#8b5cf6')
  const carl = await addPerson(w, 'Carl', '#14b8a6')
  await encounter(w, anna, bert, now += 60_000)
  await encounter(w, bert, carl, now += 60_000)
  const carlSelf = (await self(carl)).anchor
  await setTrust(w, carl, bert, true, now + 1000)  // Carl promotes Bert — Bert HOLDS Carls self
  await setTrust(w, bert, anna, true, now + 2000)  // Bert's one-sided act toward Anna
  assert(!anna.friends.has(contactKey(anna, 'Bert')), 'Einseitigkeit: Berts Akt aendert Annas Trust nicht')
  const snap = anna.starsReceived.get((await self(bert)).anchor)
  assert(!!snap && snap.count === 1, 'Stern-Zustellung: Anna HAELT Berts Schnappschuss (1 Eintrag)')
  assert(!snap.blinded.includes(carlSelf), 'VERBLINDET: kein roher Anker in der Fracht')
  assert(!(await starMatch(anna, 'Bert', snap, (await self(sam)).anchor)), 'kein Match gegen falsche Kandidaten')
  // god-check: the entry IS Carl, blinded under the Bert↔Anna key
  assert(await starMatch(anna, 'Bert', snap, carlSelf),
    'Schnittmengen-Test: haette Anna Carls Anker legitim, wuerde sie ihn erkennen')
  assert(!anna.starsReceived.has(carlSelf), 'keine Zustellung ohne Trust: Carls Stern liegt nicht bei Anna')
  await encounter(w, bert, sam, now += 60_000)
  assert(anna.starsReceived.get((await self(bert)).anchor).count === 1,
    'Dritt-Schutz: Sam (unbefoerdert) erscheint NICHT in Berts zugestelltem Stern')
  const snapOld = JSON.parse(JSON.stringify(anna.starsReceived.get((await self(bert)).anchor)))
  await setTrust(w, sam, bert, true, now + 1000)
  const snap2 = anna.starsReceived.get((await self(bert)).anchor)
  assert(snap2.count === 2 && await starMatch(anna, 'Bert', snap2, (await self(sam)).anchor),
    'laufende Zustellung: Sams Befoerderung von Bert erreicht Anna SOFORT (verblindet)')
  // EPOCHAL keys (review-2 M6): opaque entries are unlinkable across snapshots
  assert(snap2.salt !== snapOld.salt && !snap2.blinded.includes(snapOld.blinded[0]),
    'EPOCHAL: gleicher Dritt-Anker verblindet in jedem Schnappschuss anders — kein Laengsschnitt-Tracking')
  // the documented residual, EXECUTED: kept snapshots stay testable forever
  assert(await starMatch(anna, 'Bert', snapOld, carlSelf),
    'RESIDUUM: ein AUFBEWAHRTER alter Schnappschuss bleibt gegen spaeter gelernte Anker testbar')
  assert([...snap2.blinded].sort().join() === snap2.blinded.join(),
    'SORTIERT: die Zustell-Reihenfolge leckt keine Encounter-Reihenfolge')
  // collusion breaks: the same third anchor blinds differently per recipient
  await encounter(w, bert, me, now += 60_000)
  await setTrust(w, bert, me, true, now + 2000)
  const snapMe = me.starsReceived.get((await self(bert)).anchor)
  assert(snapMe && snapMe.blinded.every((v) => !snap2.blinded.includes(v)),
    'KOLLUSION BRICHT: Annas und meine Berts-Sterne sind unvergleichbar (verschiedene k)')
  assert((await starKey(anna, 'Bert', snap2.salt)) !== (await starKey(me, 'Bert', snapMe.salt)),
    'verschiedene Beziehungs-Schluessel (auch bei gleichem Salt-Wert verschieden)')
  await setTrust(w, bert, anna, false)
  assert(anna.starsReceived.has((await self(bert)).anchor), 'Trust aus: bereits Zugestelltes bleibt (Irreversibilitaet)')
  assert(!JSON.stringify(anna.starsReceived.get((await self(bert)).anchor)).includes(carlSelf),
    'VERBLINDET: der GESAMTE serialisierte Stern enthaelt keinen rohen Dritt-Anker')
  const frozen = JSON.stringify(anna.starsReceived.get((await self(bert)).anchor))
  await encounter(w, bert, peter, now += 60_000)
  assert(JSON.stringify(anna.starsReceived.get((await self(bert)).anchor)) === frozen,
    'Pause wirkt: Berts neue Encounter erreichen Anna NICHT mehr (Subskription gestoppt)')
}

// determinism of derived anchors
const me2 = { name: 'Ich2', root: me.root, personas: new Map() }
assert((await self(me2)).anchor === (await self(me)).anchor, 'Determinismus: gleiche Wurzel, gleicher Anker')
assert((await persona(me2, `group/${chor.genesisDigest}`)).anchor === (await persona(me, `group/${chor.genesisDigest}`)).anchor, 'Determinismus: Gruppen-Anker')

// spec ORACLE (review-4 note): fixed root, fixed expected anchors —
// a consistently wrong info string can no longer stay green
{
  const oracle = { name: 'Orakel', root: new Uint8Array(32).fill(0x11), personas: new Map() }
  assert((await self(oracle)).anchor === 'did:key:z6MkvTXs17eCnQds2bb2XbeE3STkhXFQXCjXBAZ2gf2vX1fx',
    'Orakel: self via wot/identity/ed25519/v1 trifft den festen Erwartungs-Anker')
  const g = 'group/uEiDYLnFbXqm2cwuJWuk9yNzRmlzWDpCTH6yA_4aP_1z_RA'
  assert((await persona(oracle, g)).anchor === 'did:key:z6MkkEyP3KrJtLP3gvGGBhCPHrLLCsurqjHEJm84AWacmwYV',
    'Orakel: Digest-Gruppen-Label trifft den festen Erwartungs-Anker')
  // RFC 7748 §5.2 vector through the WebCrypto X25519 path
  const hx = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)))
  assert(await xSharedHex(hx('a546e36bf0527c9d3b16154b82465edd62144c0ac1fc5a18506a2244ba449ac4'),
    'e6db6867583030db3594c1a424b15f7c726624ec26b3353b10a903a6d0ab1c4c')
    === 'c3da55379de9c6908e94ea4df28d084f32eccf03491c71f754b4075577a28552',
    'Orakel: WebCrypto-X25519 trifft den RFC-7748-Testvektor')
}

// camera noninterference primitive: no cluster without an encounter,
// no anchors beyond what the contact disclosed to Sam
assert(!linkClusters(sam).some((c) => c.name === 'Lena'), 'Noninterference: Sam verknuepft nie begegnete Personen nicht')
assert(linkClusters(sam).every((c) => [...c.anchors.keys()].every((l) =>
  l === 'self' || l === 'pair'
  || [...w.groups.values()].some((g) => `group/${g.genesisDigest}` === l && w.persons.get(c.name)?.memberships.has(g.id)))),
  'Noninterference: Sams Cluster enthalten nur offengelegte Kontexte')

// ── transport log: every delivery/publication is a logged packet ────────
assert(w.transport.length > 20
  && w.transport.some((p) => p.kind.startsWith('encounter-credential'))
  && w.transport.some((p) => p.kind.startsWith('anchor-mapping'))
  && w.transport.some((p) => p.kind.startsWith('context-mapping'))
  && w.transport.some((p) => p.kind.startsWith('star'))
  && w.transport.some((p) => p.kind.includes('publish')),
  'Transport-Log: Zeremonie, Zuordnung, Kontext-Mapping, Stern und Publikationen erscheinen als Pakete')
assert(w.transport.every((p, i) => p.n === i && typeof p.from === 'string' && typeof p.to === 'string' && p.payload !== undefined),
  'Transport-Log: lueckenlose Sequenz, adressiert, mit Fracht')

// ── DTG-Form: die ausgestellten Credentials sind schema-valide gegen das
// shipped 0.25-Schema (rltp-core-Validator + generiertes Bundle — dieselbe
// Prüfung, die Zeremonie-Simulator und Runner fahren)
{
  const { makeValidator } = await import('./rltp-core.mjs')
  const { SCHEMAS } = await import('./rltp-schemas.mjs')
  const V = makeValidator(SCHEMAS)
  const sch = V.SCHEMAS['encounter-credential-0.25.schema.json']
  const anyCred = w.transport.find((p) => p.kind.startsWith('encounter-credential'))?.payload?.credential
  assert(!!anyCred && V.validate(anyCred, sch, sch).length === 0,
    'DTG-Form: transportiertes EncounterCredential validiert gegen encounter-credential-0.25.schema.json')
  assert(anyCred['@context'].length === 3 && anyCred.type.length === 4 && anyCred.type.includes('DTGCredential') && anyCred.type.includes('RelationshipCredential'),
    'DTG-Form: drei gepinnte Kontexte, vier Typen (Dual-Typing)')
}

if (failed) { console.error(`${failed} rot`); process.exit(1) }
console.log('Browser-Kern: alle Assertions grün.')
