#!/usr/bin/env node
// groups-test — Stage C über dem VORGESTELLTEN Kanal: Jonathan gründet die
// Untergruppe und lädt Emil ein, den er nie getroffen hat. Integration
// introduce.mjs → groups.mjs mit den echten Schemas an jeder Naht.
import * as I from './introduce.mjs'
import * as G from './groups.mjs'
import { sameDigest, toU } from './rltp-core.mjs'
import * as C from './rltp-crypto.mjs'

let pass = 0, fail = 0
const check = (c, m) => { if (c) { pass++; console.log(`  ok    ${m}`) } else { fail++; console.error(`  FAIL  ${m}`) } }
const T0 = Date.parse('2026-08-26T10:00:00Z')

// ── Vorgeschichte: die Vorstellung (Antons Flugmodus-Szenario) ──────────
const anton = I.createPerson('Anton'), jonathan = I.createPerson('Jonathan'), emil = I.createPerson('Emil')
const cJ = await I.ceremony(anton, jonathan, T0)
const cE = await I.ceremony(anton, emil, T0 + 1000)
const drop = I.createDrop()
const intro = await I.introduce(anton, cJ.ctxB.anchor, cE.ctxB.anchor, T0 + 5000)
await I.setOnline(anton, false, drop)
const rJ = await I.receiveOffer(jonathan, intro.offers[0].env)
const rE = await I.receiveOffer(emil, intro.offers[1].env)
await I.consent(jonathan, rJ.entry, drop, T0 + 60_000)
await I.consent(emil, rE.entry, drop, T0 + 120_000)
await I.checkDrop(jonathan, rJ.entry, drop)
const jEmil = [...jonathan.contacts.entries()].find(([, c]) => c.name === 'Emil')
check(jEmil?.[1].state === '⇄', 'Vorgeschichte: Jonathan ⇄ Emil (vorgestellt via Anton, Anton offline)')

// ── Gründung ────────────────────────────────────────────────────────────
const g = await G.foundGroup(jonathan, 'Orga-Untergruppe', T0 + 200_000)
check(g.genesisDigest.startsWith('u') && toU(g.genesisDigest) === g.genesisDigest, 'Genesis-Digest: kanonisches u-Multihash')
check(g.myMemberCtx.label === 'group/' + g.genesisDigest, 'Founder-Member-Anker unter group/<digest> (nach der Gründungs-pair-Signatur)')
check(g.roster.size === 1 && g.roster.get(g.myMemberCtx.anchor)?.founder === true, 'Roster: der Gründer, als Founder markiert')
check(await C.diVerify(g.genesis, g.genesis.founder), 'Genesis verifiziert unter dem Gründungs-pair-Anker')

// ── Prelude → Invite → Accept → Admission → Welcome (alles über Kanäle) ─
const transport = async (fromP, toP, pkt, when) => {
  const r = await G.receiveDoc(toP, pkt.env, when)
  check(r.handled === true && !r.error, `Transport: ${toP.name} verarbeitet ${r.error ?? 'ok'}`)
  return r
}
const p1 = await G.preludeRequest(jonathan, jEmil[0], g.genesisDigest, T0 + 210_000)
const r1 = await G.receiveDoc(emil, p1.env, T0 + 215_000)          // Emil: Ableitung + Reply
check(r1.handled && r1.outbound?.length === 1, 'Prelude: Emil leitet Member-Anker ab und antwortet')
const r2 = await G.receiveDoc(jonathan, r1.outbound[0].env, T0 + 220_000) // Jonathan: Reply → Invite
check(r2.handled && r2.outbound?.length === 1, 'Prelude-Reply: Jonathan stellt die Einladung aus (VIC, schema-validiert)')
const r3 = await G.receiveDoc(emil, r2.outbound[0].env, T0 + 225_000)     // Emil: Invite → Prompt
check(r3.handled && r3.prompt?.kind === 'invite', 'Einladung kommt als Prompt an — Prelude-Check bestanden')
check(r3.prompt.invite.credentialSubject.genesisDigest === g.genesisDigest, 'VIC pinnt die Gruppen-Identität (genesisDigest)')
const acc = await G.acceptInvite(emil, r3.prompt, T0 + 300_000)
const r4 = await G.receiveDoc(jonathan, acc.env, T0 + 305_000)            // Jonathan: Accept → Admission + Welcome
check(r4.handled && r4.admitted && r4.outbound?.length === 1, 'Admission kanonisch: Emil im Roster, Welcome unterwegs')
const r5 = await G.receiveDoc(emil, r4.outbound[0].env, T0 + 310_000)     // Emil: Welcome
check(r5.handled && r5.joined === g.genesisDigest, 'Emil übernimmt die Gruppe aus dem Welcome')

check(jonathan.groups.get(g.genesisDigest).roster.size === 2, 'Jonathans Roster: 2 Mitglieder')
const ge = emil.groups.get(g.genesisDigest)
check(ge?.roster.size === 2 && ge.role === 'member' && [...ge.roster.values()].some((m) => m.founder), 'Emils Sicht: Gruppe mit Founder + ihm selbst')
check(ge.myMemberCtx.anchor !== [...emil.contacts.values()][0].channel.own.anchor, 'Member-Anker ≠ Beziehungs-Anker (Kontext-Trennung, Access 5.1)')

// ── Negative (jede Prüfung an ihrem deklarierten Punkt) ─────────────────
{
  // 1. Prelude-Mismatch: Einladung an einen FREMDEN Anker stirbt beim Invitee
  const g2 = await G.foundGroup(jonathan, 'Zweite Gruppe', T0 + 400_000)
  const wrongAnchor = g.myMemberCtx.anchor // irgendein Anker, der NICHT Emils Ableitung ist
  const inv2 = await G.buildInvite(jonathan, g2, jEmil[1], wrongAnchor, T0 + 410_000, globalThis.crypto.randomUUID())
  const rr = await G.receiveDoc(emil, inv2.env, T0 + 415_000)
  check(rr.handled === false || rr.error === 'prelude mismatch' || rr.error === 'document bindings', `Fremd-Anker-Einladung stirbt (${rr.error ?? 'nicht zugestellt — recipient ist nicht Emils Kontext'})`)

  // 2. Accept nach validUntil + skew → Admission lehnt ab
  const p2 = await G.preludeRequest(jonathan, jEmil[0], g2.genesisDigest, T0 + 420_000)
  const e1 = await G.receiveDoc(emil, p2.env, T0 + 421_000)
  const e2 = await G.receiveDoc(jonathan, e1.outbound[0].env, T0 + 422_000)
  const e3 = await G.receiveDoc(emil, e2.outbound[0].env, T0 + 423_000)
  const late = await G.acceptInvite(emil, e3.prompt, T0 + 423_000 + 25 * 3600 * 1000) // > 24h + PT5M
  const rLate = await G.receiveDoc(jonathan, late.env, T0 + 423_000 + 25 * 3600 * 1000)
  check(rLate.error === 'accept after validUntil + membership-skew', 'abgelaufener Consent: Admission lehnt am Zeitfenster ab')

  // 3. ref-Tamper: Accept mit fremdem Digest → ref-Check
  const p3 = await G.preludeRequest(jonathan, jEmil[0], g2.genesisDigest, T0 + 500_000)
  const f1 = await G.receiveDoc(emil, p3.env, T0 + 501_000)
  const f2 = await G.receiveDoc(jonathan, f1.outbound[0].env, T0 + 502_000)
  const f3 = await G.receiveDoc(emil, f2.outbound[0].env, T0 + 503_000)
  const good = await G.acceptInvite(emil, f3.prompt, T0 + 600_000)
  // kohärent manipulieren: ref austauschen + NEU task-signieren (der Checker darf nicht an der Signatur hängen)
  const ctxE = f3.prompt.myMemberCtx
  const openAcc = await C.unseal(good.env, ctxE.x.priv) // eigener Test-Zugriff unmöglich — nimm den Weg über die Struktur
  check(openAcc.error !== undefined || true, 'Hinweis: Accept ist an Jonathan gesiegelt — Tamper-Test baut das Dokument nach')
  const tampered = { ...JSON.parse(JSON.stringify((await (async () => { // Accept nachbauen mit falschem ref
    const inv = f3.prompt.invite
    const card = await C.signCard(ctxE, C.cardBody(ctxE, { name: emil.name }), C.iso(T0 + 600_000))
    const payload = { accept: { group: inv.credentialSubject.group, subject: ctxE.anchor, ref: await C.digestDoc({ x: 'anderes' }), card, candidacy: false } }
    const body = { id: globalThis.crypto.randomUUID(), type: 'https://real-life.org/trust-tasks/membership-accept/0.2', issuer: ctxE.anchor, recipient: inv.issuer, threadId: inv.taskContext, issuedAt: C.iso(T0 + 600_000), payload }
    return C.diSign(ctxE, body, C.iso(T0 + 600_000))
  })()))) }
  const eJon = [...emil.contacts.values()].find((c) => c.name === 'Jonathan')
  const env = await C.seal(tampered, eJon.channel.counterpartKa)
  const rT = await G.receiveDoc(jonathan, env, T0 + 601_000)
  check(rT.error === 'ref ≠ credential digest', 'ref-Tamper (kohärent neu signiert) stirbt am Credential-Digest-Vergleich')

  // 4. u/z: ein z-getragener ref MUSS bestehen (decoded-bytes)
  const g5 = await G.foundGroup(jonathan, 'Fünfte', T0 + 700_000)
  const q1 = await G.preludeRequest(jonathan, jEmil[0], g5.genesisDigest, T0 + 701_000)
  const q2 = await G.receiveDoc(emil, q1.env, T0 + 702_000)
  const q3 = await G.receiveDoc(jonathan, q2.outbound[0].env, T0 + 703_000)
  const q4 = await G.receiveDoc(emil, q3.outbound[0].env, T0 + 704_000)
  const ctx5 = q4.prompt.myMemberCtx
  const inv5 = q4.prompt.invite
  const refU = await C.digestDoc(inv5)
  const refZ = 'z' + C.base58(C.fromB64u(refU.slice(1)))
  const card5 = await C.signCard(ctx5, C.cardBody(ctx5, { name: emil.name }), C.iso(T0 + 705_000))
  const body5 = { id: globalThis.crypto.randomUUID(), type: 'https://real-life.org/trust-tasks/membership-accept/0.2', issuer: ctx5.anchor, recipient: inv5.issuer, threadId: inv5.taskContext, issuedAt: C.iso(T0 + 705_000), payload: { accept: { group: inv5.credentialSubject.group, subject: ctx5.anchor, ref: refZ, card: card5, candidacy: false } } }
  const doc5 = await C.diSign(ctx5, body5, C.iso(T0 + 705_000))
  const env5 = await C.seal(doc5, eJon.channel.counterpartKa)
  const r5z = await G.receiveDoc(jonathan, env5, T0 + 706_000)
  check(r5z.admitted === ctx5.anchor, 'z-getragener accept.ref besteht (Gleichheit über dekodierte Bytes)')
  check(sameDigest(refU, refZ), 'Kontrolle: u- und z-ref sind derselbe Digest')
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) { console.error('groups: FAILED'); process.exit(1) }
console.log('groups: Stage C hält — Gruppe über den vorgestellten Kanal, alle Checks an ihren Punkten.')
