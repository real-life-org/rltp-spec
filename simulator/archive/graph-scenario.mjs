#!/usr/bin/env node
// Executable probe for the graph model — the six assertions of
// design/graph-simulator-design-2026-08.md, run on REAL credentials.

import { randomBytes } from 'node:crypto'
import {
  createRoot, persona, self, encounter, makeFriends, createGroup,
  joinGroup, disclose, sharedGroups, linkableAnchors, roster,
  verifyEdgeCredentials, register, registry,
} from './graph.mjs'
import { edgeState } from './engine.mjs'

let now = Date.parse('2026-08-21T10:00:00Z')
const iso = () => new Date(now).toISOString().replace(/\.\d{3}Z$/, 'Z')
const t = (label) => console.log(`\n─── ${label} ───`)
let failed = 0
const assert = (cond, msg) => {
  if (!cond) { console.error(`✗ ASSERT: ${msg}`); failed++ } else console.log(`✓ ${msg}`)
}

// ════ world: Ich, Peter (3 gemeinsame Gruppen), Frida (Freundin), Sam (Fremder)
const seeds = { me: randomBytes(32), peter: randomBytes(32), frida: randomBytes(32), sam: randomBytes(32) }
const me = createRoot('Ich', seeds.me)
const peter = createRoot('Peter', seeds.peter)
const frida = createRoot('Frida', seeds.frida)
const sam = createRoot('Sam', seeds.sam)
for (const p of [me, peter, frida, sam]) register(p)

t('1 · Determinismus / Recovery: gleiche Wurzel ⇒ gleiche Anker')
const meAgain = createRoot('Ich (recovered)', seeds.me)
assert(self(me).anchor === self(meAgain).anchor, 'self-Anker aus Seed rekonstruierbar')
assert(persona(me, 'group/chor').anchor === persona(meAgain, 'group/chor').anchor, 'Gruppen-Anker aus Seed + Kontext-Label rekonstruierbar')
assert(self(me).anchor !== persona(me, 'group/chor').anchor, 'self- und Gruppen-Anker sind verschieden (unverknüpfbar ohne Wurzel)')
assert(self(me).anchor.startsWith('did:key:z6Mk'), 'Außenseite bleibt standardauflösbare did:key (Taillen-Constraint)')

t('2 · Kontextfreie Begegnung: läuft unter self-Ankern, echte Credentials')
encounter(me, peter, now); now += 60_000
encounter(me, frida, now); now += 60_000
encounter(peter, frida, now); now += 60_000
assert(edgeState(self(me), self(peter).anchor) === 'mutual', 'Ich↔Peter mutual (voller Zeremonie-Pfad)')
const checks = verifyEdgeCredentials(me)
assert(checks.length >= 3 && checks.every((c) => c.okSig), `alle ${checks.length} Kanten-Credentials diVerify-t`)
assert(checks.filter((c) => c.okBind).length >= 2, 'Bindings gegen eigene Records rekomputiert')

t('3 · Personal Community als abgeleitetes Roster (K = Kanten)')
assert(roster(me).length === 2, 'mein Roster: Peter + Frida (die Kante IST die Mitgliedschaft)')
assert(roster(sam).length === 0, 'Sam (nie begegnet) hat ein leeres Roster')

t('4 · Gruppen + Offenlegung im encountered-Modus: Graph über Kontexte')
const chor = createGroup('chor'), garten = createGroup('garten'), rat = createGroup('rat'), schach = createGroup('schach')
const groups = [chor, garten, rat, schach]
for (const g of [chor, garten, rat]) { joinGroup(me, g, iso()); joinGroup(peter, g, iso()) }
joinGroup(peter, schach, iso()) // Peter zusätzlich woanders, ich nicht
assert(sharedGroups(me, self(peter).anchor, groups).length === 3, 'mein Graph zeigt: Peter und ich in DREI gemeinsamen Gruppen — ohne Festlegung bei der Begegnung')
assert(!sharedGroups(me, self(peter).anchor, groups).includes('schach'), 'Peters vierte Gruppe (in der ich nicht bin) erscheint nicht als gemeinsam')
const known = linkableAnchors(me, peter)
assert(known.length === 5, `ich kann 5 Peter-Anker verbinden (self + 4 Gruppen — er hat alles offengelegt): ${known.length}`)

t('5 · Fremden-Test: ohne Begegnung keine Verknüpfung')
assert(linkableAnchors(sam, peter).length === 0, 'Sam kann KEINEN Peter-Anker verbinden (keine Begegnung, keine Offenlegung)')
assert(sharedGroups(sam, self(peter).anchor, groups).length === 0, 'Sam liest keine gemeinsamen Gruppen')
// Sam tritt sogar in den Chor ein — sieht Peters Gruppen-Anker im Roster,
// kann ihn aber nicht mit Peters self-Anker oder anderen Gruppen verbinden:
joinGroup(sam, chor, iso())
assert(chor.roster.has(persona(peter, 'group/chor').anchor), 'Sam sieht als Chor-Mitglied Peters Chor-Anker im Roster …')
assert(linkableAnchors(sam, peter).length === 0, '… kann ihn aber nicht als „Peter" verbinden — Anker bleiben kontextgetrennt')

t('6 · friends-Modus: der Regler in der zweiten Stellung')
const lena = createRoot('Lena', randomBytes(32)); register(lena)
lena.discloseMode = 'friends'
encounter(me, lena, now); now += 60_000
encounter(peter, lena, now); now += 60_000
joinGroup(lena, chor, iso()); joinGroup(lena, garten, iso())
assert(linkableAnchors(me, lena).length === 1, 'Lena (friends-Modus): ich als bloßer Begegneter sehe nur ihren self-Anker')
assert(sharedGroups(me, self(lena).anchor, groups).length === 0, 'ihre Gruppen bleiben für mich unverbunden')
makeFriends(lena, me)
assert(linkableAnchors(me, lena).length === 3, 'nach Beförderung zur Freundin: self + 2 Gruppen-Anker verbunden')
assert(sharedGroups(me, self(lena).anchor, groups).length === 2, 'jetzt zeigt mein Graph: Lena und ich in 2 gemeinsamen Gruppen')
assert(linkableAnchors(peter, lena).length === 1, 'Peter (nicht befördert) sieht weiterhin nur ihren self-Anker')

t('Ergebnis')
if (failed === 0) console.log('ALLE ASSERTIONS GRÜN — das Modell trägt auf echten Credentials.')
else { console.error(`${failed} Assertions rot.`); process.exit(1) }
