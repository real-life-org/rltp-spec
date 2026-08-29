// groups.mjs — Stage C: groups over the introduced channel. PROBE.
// DOM-free, on rltp-core + rltp-crypto (+ the shipped schemas: the invite
// IS the DTG InvitationCredential of membership-invite/0.2, the accept IS
// membership-accept/0.2 — both schema-validated at issuance AND receipt).
//
// WHAT THIS PROBE EXERCISES (the converged Membership 0.16 / Access 0.30
// semantics, instantiated live):
//   founding      — the founder signs the genesis under a FOUNDING pair
//                   context (Access 3.4.1: group/<digest> cannot exist
//                   before the digest does); genesisDigest = multihash
//                   over the proof-free genesis; the founder then derives
//                   the member anchor group/<digest> and self-enrolls.
//   prelude       — the inviter cannot derive the invitee's member anchor;
//                   the invitee's app derives it from the genesisDigest
//                   (canonical-u before the label, Access 5.1) and answers
//                   over the EXISTING relationship channel (Membership 1.2).
//   invite        — a conformant DTG InvitationCredential in a delivery
//                   document WITHOUT a document proof (one carrier,
//                   Membership 2); invitee re-derives and compares
//                   (the prelude check, Membership 3.1).
//   accept        — consent, task-proved under the subject; ref = the
//                   CREDENTIAL digest (decoded-bytes equality).
//   admission     — the inviter runs the Access 5.3 pair-internal checks
//                   (path convention, time window incl. membership-skew,
//                   size budget, card enclosure profile) and updates the
//                   roster; a WELCOME (probe form) carries the roster to
//                   members over their channels.
// OUT OF PROBE SCOPE (named, not faked): the full access-operation
// envelope (oid/prev/epochs), welcome seal + keydist/epoch keys, vouch
// paths and candidacy surfacing, removal. That is the library's next
// growth ring — the checks here are the real ones, the transport forms
// marked @probe are not wire-normative.
import { jcs, makeValidator, toU, sameDigest, tsec, calOK } from '../core.js'
import * as C from './deps.js'
import type { Person } from './deps.js'
import { SCHEMAS } from '../schemas.js'

const V = makeValidator(SCHEMAS)
const validOr = (data: any, file: string) => { const s = SCHEMAS[file]; const errs = V.validate(data, s, s); if (errs.length) throw new Error(file + ': ' + errs[0]); return data }
const MEMBERSHIP_SKEW = 300 // PT5M (Membership §5)
const TT = 'https://real-life.org/trust-tasks/'
const CTX3 = ['https://www.w3.org/ns/credentials/v2', 'https://firstperson.network/credentials/dtg/v1', 'https://real-life.org/rltp/v1']
const say = (p: Person, m: string) => p.log.push(m)
const uuid = (ent?: any) => ent ?? globalThis.crypto.randomUUID()

// member anchor: canonical-u re-encoding BEFORE the label (Access 5.1)
export async function memberContext (p: Person, genesisDigest: string) {
  const label = 'group/' + toU(genesisDigest)
  const ctx = await C.labeledContext(p.rootIkm, label)
  p.contexts.set(ctx.anchor, ctx); p.contexts.set(ctx.keyAgreement, ctx)
  return ctx
}
const memberCard = async (ctx: any, name: string, whenIso: string) =>
  validOr(await C.signCard(ctx, C.cardBody(ctx, { name }), whenIso), 'contact-card.schema.json')

// ── founding ────────────────────────────────────────────────────────────
export async function foundGroup (p: Person, label: string, when: number, ent: any = {}) {
  const iso = C.iso(when)
  const founding = await C.pairContext(p.rootIkm, ent.foundingNonce ?? C.rand(32)) // pair class: the founding occasion
  const groupDid = C.anchorOfEd((await C.edFromSeed(ent.groupSeed ?? C.rand(32))).pubRaw) // group address (probe mint; Identity work)
  const genesisBody = { type: 'group-genesis@probe', group: groupDid, label, founder: founding.anchor, issuedAt: iso }
  const genesis = await C.diSign(founding, genesisBody, iso)
  const genesisDigest = await C.digestDoc(genesisBody) // proof-free signature input (Access 3.2)
  const my = await memberContext(p, genesisDigest)
  const card = await memberCard(my, p.name, iso)
  const g: any = {
    label, groupDid, genesisDigest, genesis, myMemberCtx: my, role: 'founder',
    vouchThreshold: ent.vouchThreshold ?? 1, // Bürgschaftsschwelle (Gruppenregel; UI zeigt sie nur > 1)
    vouchesReceived: new Map(),              // Bürgschaften FÜR MICH (issuer -> vouch@2)
    myVouches: new Map(),                    // Bürgschaften VON MIR (candidate -> vouch@2)
    roster: new Map([[my.anchor, { name: p.name, card, addedAt: iso, founder: true }]]),
    threads: new Map(), // invitee member anchor -> { threadId, invite } (open invitations)
  }
  p.groups.set(genesisDigest, g)
  say(p, `Gruppe „${label}" gegründet — Genesis unter Gründungs-pair-Anker, Member-Anker ${my.anchor.slice(0, 20)}… abgeleitet`)
  return g
}

// ── transport helper: sealed doc over an existing relationship channel ──
async function sendDoc (p: Person, contact: any, doc: any, ent: any = {}) {
  return { to: contact, env: await C.seal(doc, contact.channel.counterpartKa, ent) }
}
const channelCtxOf = (p: Person, doc: any) => p.contexts.get(doc.recipient) ?? null
const contactByAnchor = (p: Person, anchor: string) => p.contacts.get(anchor) ?? null
const contactOfIssuer = (p: Person, issuer: string) => p.contacts.get(issuer) ?? null

// ── prelude (Membership 1.2/3.1: the invitee supplies the member anchor) ─
export async function preludeRequest (p: Person, contactAnchor: string, genesisDigest: string, when: number, ent: any = {}) {
  const contact = contactByAnchor(p, contactAnchor)
  const g = p.groups.get(genesisDigest)
  const body = {
    id: uuid(ent.id), type: TT + 'membership-prelude-request@probe',
    issuer: contact.channel.own.anchor, recipient: contactAnchor,
    threadId: uuid(ent.threadId), issuedAt: C.iso(when),
    payload: { genesisDigest, group: g.groupDid, label: g.label },
  }
  const doc = await C.diSign(contact.channel.own, body, C.iso(when))
  say(p, `Prelude an ${contact.name}: genesisDigest der Gruppe „${g.label}" über den Beziehungs-Kanal`)
  return sendDoc(p, contact, doc, ent)
}

// ── receive dispatch: every membership doc travels the channel sealed ───
// Returns { handled, outbound?: [{to, env}], prompt?: entry }.
export async function receiveDoc (p: Person, env: any, when: number, ent: any = {}) {
  const opened = await C.openEnvelope(p, env)                 // Stufen 1–4, Cache-Lesung
  if (opened.duplicate) return { handled: true, duplicate: true }
  if (opened.error) return { handled: false }
  const r = await receiveDocInner(p, env, opened.doc, when, ent)
  if (r?.handled && !(r as any).error) C.effectDone(p, opened.digest)
  return r
}
async function receiveDocInner (p: Person, env: any, doc: any, when: number, ent: any = {}) {
  const ctx = channelCtxOf(p, { recipient: env.rkid }) ?? p.contexts.get(env.rkid)
  if (!ctx) return { handled: false }
  if (typeof doc?.type !== 'string' || !doc.type.startsWith(TT + 'membership-')) return { handled: false, doc }
  // the sender is identified by the CHANNEL the envelope arrived on (rkid
  // names our own pair context of exactly one relationship) — membership
  // documents carry MEMBER anchors as issuer, which no contact key holds
  const from = [...p.contacts.values()].find((c) => c.channel?.own?.anchor === ctx.anchor) ?? contactOfIssuer(p, doc.issuer)
  switch (doc.type.slice((TT + 'membership-').length)) {
    case 'prelude-request@probe': {
      // form BEFORE fields (review 3, M-3): a valid signature binds
      // whatever was signed — payload.genesisDigest earns its type here
      if (!C.shaped(doc, { issuer: 'string', threadId: 'string', payload: 'object', proof: 'object' })
        || !C.shaped(doc.payload, { genesisDigest: 'string', group: 'string', label: 'string' })) return { handled: true, error: 'malformed prelude' }
      if (!from || !(await C.diVerify(doc, doc.issuer))) return { handled: true, error: 'prelude proof' }
      let my
      try { my = await memberContext(p, doc.payload.genesisDigest) } catch { return { handled: true, error: 'genesisDigest not canonical' } }
      const body = {
        id: uuid(), type: TT + 'membership-prelude-reply@probe',
        issuer: from.channel.own.anchor, recipient: doc.issuer,
        threadId: doc.threadId, issuedAt: C.iso(when),
        payload: { genesisDigest: doc.payload.genesisDigest, memberAnchor: my.anchor },
      }
      const reply = await C.diSign(from.channel.own, body, C.iso(when))
      say(p, `Prelude von ${from.name}: Member-Anker für „${doc.payload.label}" abgeleitet und geantwortet`)
      return { handled: true, outbound: [await sendDoc(p, from, reply, ent)] }
    }
    case 'prelude-reply@probe': {
      if (!C.shaped(doc, { issuer: 'string', threadId: 'string', payload: 'object', proof: 'object' })
        || !C.shaped(doc.payload, { genesisDigest: 'string', memberAnchor: 'string' })
        || C.edRawOfAnchor(doc.payload.memberAnchor) === null) return { handled: true, error: 'malformed prelude-reply' }
      if (!from || !(await C.diVerify(doc, doc.issuer))) return { handled: true, error: 'prelude-reply proof' }
      const g = [...p.groups.values()].find((g) => g.genesisDigest === doc.payload.genesisDigest)
      if (!g) return { handled: true, error: 'unknown group' }
      // Log erst NACH dem gelungenen Bau; ein Schema-Throw aus
      // buildInvite verlässt die Empfangs-Promise nie (Review 9, P-B2)
      let inv
      try { inv = await buildInvite(p, g, from, doc.payload.memberAnchor, when, doc.threadId, ent) }
      catch (e: any) { return { handled: true, error: 'invite build: ' + String(e?.message ?? e) } }
      say(p, `${from.name}s Member-Anker erhalten — Einladung wird ausgestellt`)
      return { handled: true, outbound: [inv] }
    }
    case 'invite/0.2': return handleInvite(p, doc, from, when)
    case 'accept/0.2': return handleAccept(p, doc, from, when, ent)
    case 'welcome@probe': return handleWelcome(p, doc, from)
    case 'vouch/0.1': return handleVouch(p, doc, from)
  }
  return { handled: false, doc }
}

// ── the invite: a conformant DTG InvitationCredential (one carrier) ─────
export async function buildInvite (p: Person, g: any, contact: any, inviteeMemberAnchor: string, when: number, threadId: string, ent: any = {}) {
  const iso = C.iso(when), until = C.iso(when + 24 * 3600 * 1000)
  const inviterCard = await memberCard(g.myMemberCtx, p.name, iso)
  const credBody = {
    '@context': CTX3,
    type: ['VerifiableCredential', 'DTGCredential', 'InvitationCredential', 'MembershipInvite'],
    issuer: g.myMemberCtx.anchor,
    credentialSubject: { id: inviteeMemberAnchor, group: g.groupDid, genesisDigest: g.genesisDigest, card: inviterCard, name: g.label },
    validFrom: iso, validUntil: until, taskContext: threadId,
  }
  const invite = await C.diSign(g.myMemberCtx, credBody, iso)
  validOr({ invite }, 'payload-membership-invite.schema.json')
  const doc = { // document-level proof ABSENT: the credential is the one carrier (Membership 2)
    id: uuid(ent.docId), type: TT + 'membership-invite/0.2',
    issuer: g.myMemberCtx.anchor, recipient: inviteeMemberAnchor,
    threadId, issuedAt: iso, payload: { invite },
  }
  validOr(doc, 'rltp-delivery-document.schema.json')
  g.threads.set(inviteeMemberAnchor, { threadId, invite, contactAnchor: [...p.contacts.entries()].find(([, c]) => c === contact)![0] })
  say(p, `Einladung (InvitationCredential) an ${contact.name} — Thread ${threadId.slice(0, 8)}…`)
  return sendDoc(p, contact, doc, ent)
}

async function handleInvite (p: Person, doc: any, from: any, when: number) {
  if (!from) return { handled: true, error: 'invite not from a held contact' }
  const inv = doc.payload?.invite
  try { validOr(doc.payload, 'payload-membership-invite.schema.json'); validOr(doc, 'rltp-delivery-document.schema.json') } catch (e: any) { say(p, 'Einladung schema-ungültig: ' + e.message); return { handled: true, error: 'schema' } }
  if ('proof' in doc) { say(p, 'Einladung trägt Dokument-Proof — one carrier verletzt'); return { handled: true, error: 'one-carrier' } }
  if (!(await C.diVerify(inv, inv.issuer))) return { handled: true, error: 'credential proof' }
  if (inv.issuer !== doc.issuer || inv.credentialSubject.id !== doc.recipient || inv.taskContext !== doc.threadId) return { handled: true, error: 'document bindings' }
  if (inv.credentialSubject.card.anchor !== inv.issuer || !(await C.diVerify(inv.credentialSubject.card, inv.issuer))) return { handled: true, error: 'card ownership' }
  const cardOK = !('sentTo' in inv.credentialSubject.card) && !('boundTo' in inv.credentialSubject.card) && !('deliveryHints' in inv.credentialSubject.card)
  if (!cardOK) return { handled: true, error: 'card enclosure profile' }
  if (![inv.validFrom, inv.validUntil, inv.proof.created].every(calOK) || tsec(inv.validUntil) < tsec(inv.validFrom)) return { handled: true, error: 'validity' }
  // THE PRELUDE CHECK (Membership 3.1): my own derivation from the
  // genesisDigest must equal credentialSubject.id — a substituted anchor
  // dies here, whatever the prelude's path was
  const my = await memberContext(p, inv.credentialSubject.genesisDigest)
  if (my.anchor !== inv.credentialSubject.id) { say(p, 'Prelude-Check FEHLGESCHLAGEN: Einladung nennt nicht meine Ableitung'); return { handled: true, error: 'prelude mismatch' } }
  const entry = { kind: 'invite', doc, invite: inv, from: from.name, fromAnchor: doc.issuer, fromContact: from, myMemberCtx: my, decided: false }
  p.inbox.push(entry)
  say(p, `${from.name} lädt dich in „${inv.credentialSubject.name ?? 'eine Gruppe'}" ein (Einladung geprüft, Prelude-Check bestanden)`)
  return { handled: true, prompt: entry }
}

// ── the accept: consent, task-proved, credential-digest ref ─────────────
export async function acceptInvite (p: Person, entry: any, when: number, ent: any = {}) {
  const inv = entry.invite
  const iso = C.iso(when)
  const card = await memberCard(entry.myMemberCtx, p.name, iso)
  const payload = { accept: {
    group: inv.credentialSubject.group, subject: entry.myMemberCtx.anchor,
    ref: await C.digestDoc(inv),            // the invitation identity: JCS over the COMPLETE credential incl. proof
    card, candidacy: ent.candidacy ?? false,
  } }
  validOr(payload, 'payload-membership-accept.schema.json')
  const body = {
    id: uuid(ent.docId), type: TT + 'membership-accept/0.2',
    issuer: entry.myMemberCtx.anchor, recipient: inv.issuer,
    threadId: inv.taskContext, issuedAt: iso, payload,
  }
  const doc = await C.diSign(entry.myMemberCtx, body, iso)  // task proof under the subject (Membership 2)
  validOr(doc, 'rltp-delivery-document.schema.json')
  entry.decided = true; entry.accepted = true
  say(p, `Beitritt zu „${inv.credentialSubject.name}" erklärt (Accept, ref = Credential-Digest)`)
  return sendDoc(p, entry.fromContact, doc, ent)
}

// ── admission: the Access 5.3 pair-internal checks, then roster + welcome ─
async function handleAccept (p: Person, doc: any, from: any, when: number, ent: any = {}) {
  const g = [...p.groups.values()].find((g) => g.threads.has(doc.issuer))
  if (!g) return { handled: true, error: 'no open invitation for this subject' }
  const th = g.threads.get(doc.issuer)
  const inv = th.invite, acc = doc.payload?.accept
  const fail = async (why: string) => { say(p, `Admission abgelehnt: ${why}`); return { handled: true, error: why } }
  try { validOr(doc.payload, 'payload-membership-accept.schema.json'); validOr(doc, 'rltp-delivery-document.schema.json') } catch { return fail('schema') }
  if (!(await C.diVerify(doc, doc.issuer))) return fail('accept task proof')
  if (!sameDigest(acc.ref, await C.digestDoc(inv))) return fail('ref ≠ credential digest')           // decoded-bytes equality
  if (acc.subject !== inv.credentialSubject.id || acc.subject !== doc.issuer) return fail('subject binding')
  if (acc.group !== inv.credentialSubject.group || !sameDigest(inv.credentialSubject.genesisDigest, g.genesisDigest)) return fail('group binding')
  if (doc.threadId !== inv.taskContext) return fail('thread binding')
  if (acc.card.anchor !== acc.subject || !(await C.diVerify(acc.card, acc.subject))) return fail('card ownership')
  if (('sentTo' in acc.card) || ('boundTo' in acc.card) || ('deliveryHints' in acc.card)) return fail('card enclosure profile')
  if (![doc.issuedAt, doc.proof.created].every(calOK)) return fail('calendar validity')
  if (tsec(doc.issuedAt) > tsec(inv.validUntil) + MEMBERSHIP_SKEW * 1000 || tsec(doc.proof.created) > tsec(inv.validUntil) + MEMBERSHIP_SKEW * 1000) return fail('accept after validUntil + membership-skew')
  if (Buffer_(jcs(doc)) > 16384 || Buffer_(jcs({ invite: inv })) > 16384) return fail('size budget')
  if (!g.roster.has(inv.issuer)) return fail('inviter not a member')
  if (g.roster.has(acc.subject)) { say(p, 'Same-Subject-Admission: idempotent'); return { handled: true, idempotent: true } }
  // ATOMICITY (review 3, B-2): every await that can fail — digest,
  // signing, sealing — happens BEFORE the first state mutation. If the
  // welcome cannot be built, the roster has not grown, the thread still
  // stands, and the SAME delivery can be retried cleanly.
  const newEntry = { name: acc.card.name, card: acc.card, addedAt: C.iso(when), candidacy: acc.candidacy === true,
    acceptDigest: await C.digestDoc(doc), contactAnchor: th.contactAnchor }
  const contact = contactByAnchor(p, th.contactAnchor)
  const rosterAfter = [...g.roster.entries(), [acc.subject, newEntry] as const]
  const wBody = {
    id: uuid(), type: TT + 'membership-welcome@probe',
    issuer: g.myMemberCtx.anchor, recipient: acc.subject,
    threadId: doc.threadId, issuedAt: C.iso(when),
    payload: { genesisDigest: g.genesisDigest, group: g.groupDid, label: g.label, genesis: g.genesis, vouchThreshold: g.vouchThreshold ?? 1,
      roster: rosterAfter.map(([anchor, m]: any) => ({ anchor, name: m.name, addedAt: m.addedAt, founder: !!m.founder, candidacy: !!m.candidacy, acceptDigest: m.acceptDigest ?? null })) },
  }
  const welcome = await sendDoc(p, contact, await C.diSign(g.myMemberCtx, wBody, C.iso(when)), ent)
  // — from here on, synchronous only —
  g.roster.set(acc.subject, newEntry)
  { const c = contactByAnchor(p, th.contactAnchor); if (c) (c.sharedGroups ??= []).push(g.genesisDigest) } // der Inviter WEISS, wer beigetreten ist
  g.threads.delete(doc.issuer)
  say(p, `${acc.card.name} ist Mitglied von „${g.label}" — Admission kanonisch, Consent konsumiert`)
  return { handled: true, admitted: acc.subject, outbound: [welcome] }
}
const Buffer_ = (s: any) => new TextEncoder().encode(s).length

async function handleWelcome (p: Person, doc: any, from: any) {
  // form BEFORE fields (M-3): the roster travels as data and becomes
  // this person's map — every entry earns its shape before adoption
  if (!C.shaped(doc, { issuer: 'string', recipient: 'string', payload: 'object', proof: 'object' })
    || !C.shaped(doc.payload, { genesisDigest: 'string', group: 'string', label: 'string', roster: 'array' })
    || !doc.payload.roster.every((m: any) => C.shaped(m, { anchor: 'string', name: 'string', addedAt: 'string' }))) return { handled: true, error: 'malformed welcome' }
  if (toU(doc.payload.genesisDigest) !== doc.payload.genesisDigest) return { handled: true, error: 'malformed welcome (genesisDigest)' }
  if (!(await C.diVerify(doc, doc.issuer))) return { handled: true, error: 'welcome proof' }
  const gd = doc.payload.genesisDigest
  let my
  try { my = await memberContext(p, gd) } catch { return { handled: true, error: 'genesisDigest not canonical' } }
  if (doc.recipient !== my.anchor) return { handled: true, error: 'welcome not for my member anchor' }
  const g: any = {
    label: doc.payload.label, groupDid: doc.payload.group, genesisDigest: gd,
    genesis: doc.payload.genesis, myMemberCtx: my, role: 'member',
    vouchThreshold: doc.payload.vouchThreshold ?? 1,
    vouchesReceived: new Map(), myVouches: new Map(),
    roster: new Map(doc.payload.roster.map((m: any) => [m.anchor, m])),
    threads: new Map(),
  }
  g.myAcceptDigest = g.roster.get(my.anchor)?.acceptDigest ?? null
  p.groups.set(gd, g)
  if (from) (from.sharedGroups ??= []).push(gd)  // der Invitee WEISS, wer ihn eingeladen hat
  say(p, `Willkommen in „${g.label}" — Roster mit ${g.roster.size} Mitgliedern übernommen`)
  return { handled: true, joined: gd }
}

// ── die Bürgschaft (Task membership-vouch/0.1, Artefakt vouch@2) ────────
// ein konformes DTG EndorsementCredential ──────────────────────────────
// (AdmissionVouch, Access 4.2/4.3): genesisDigest bindet die Gruppe,
// accept bindet die KONSENTIERTE Kandidatur (keine stehende Bürgschaft),
// provenance ist selbst-attestiert (met | introduced). Signiert unter dem
// MEMBER-Anker des Bürgen; schema-validiert bei Ausstellung UND Empfang.
// Transport (probe): über den Beziehungs-Kanal zum KANDIDATEN — nur wer
// einen Kanal zum Kandidaten hält, kann liefern (per-device-Wissen,
// nichts wird erfunden); der Kandidat sammelt und zählt gegen die
// Schwelle. Gruppenweite Sichtbarkeit der Zählung = Access-Envelope-Ring.
export async function vouchFor (p: Person, genesisDigest: string, candidateAnchor: string, provenance: any, when: number, ent: any = {}) {
  const g = p.groups.get(genesisDigest)
  const m = g?.roster.get(candidateAnchor)
  if (!g || !m) return { error: 'unbekannter Kandidat' }
  if (!m.candidacy) return { error: 'keine sichtbare Kandidatur (Opt-in fehlt)' }
  if (!m.acceptDigest) return { error: 'kein accept-Bezug — Bürgschaft wäre stehend' }
  if (!m.contactAnchor || !p.contacts.get(m.contactAnchor)) return { error: 'kein Kanal zum Kandidaten' }
  if (g.myVouches.has(candidateAnchor)) return { error: 'bereits gebürgt' }
  const iso = C.iso(when)
  const cred = await C.diSign(g.myMemberCtx, {
    '@context': CTX3,
    type: ['VerifiableCredential', 'DTGCredential', 'EndorsementCredential', 'AdmissionVouch'],
    issuer: g.myMemberCtx.anchor,
    validFrom: iso,
    credentialSubject: { id: candidateAnchor, endorsement: {
      type: 'AdmissionVouch', genesisDigest: toU(g.genesisDigest), accept: toU(m.acceptDigest), provenance } },
  }, iso)
  validOr(cred, 'access-vouch.schema.json')
  g.myVouches.set(candidateAnchor, cred)
  const contact = p.contacts.get(m.contactAnchor)
  const doc = {
    id: uuid(ent.docId), type: TT + 'membership-vouch/0.1',
    issuer: g.myMemberCtx.anchor, recipient: candidateAnchor,
    threadId: uuid(ent.threadId), issuedAt: iso, payload: { vouch: cred },
  }
  say(p, `Bürgschaft für ${m.name} in „${g.label}" ausgestellt (${provenance}, accept-gebunden)`)
  return sendDoc(p, contact, await C.diSign(g.myMemberCtx, doc, iso), ent)
}

// Kandidatenseite: jede Prüfung an ihrem Punkt, dann zählen
async function handleVouch (p: Person, doc: any, from: any) {
  const cred = doc.payload?.vouch
  const g = [...p.groups.values()].find((g) => cred && sameDigest(cred.credentialSubject?.endorsement?.genesisDigest ?? '', g.genesisDigest))
  const fail = (why: string) => { say(p, `Bürgschaft verworfen: ${why}`); return { handled: true, error: why } }
  if (!g) return fail('unbekannte Gruppe')
  try { validOr(cred, 'access-vouch.schema.json') } catch { return fail('schema') }
  if (!(await C.diVerify(cred, cred.issuer)) || !(await C.diVerify(doc, doc.issuer))) return fail('proof')
  if (cred.issuer !== doc.issuer) return fail('issuer binding')
  if (!g.roster.has(cred.issuer)) return fail('Bürge ist kein Mitglied')
  if (cred.credentialSubject.id !== g.myMemberCtx.anchor) return fail('nicht für mich')
  if (!g.myAcceptDigest || !sameDigest(cred.credentialSubject.endorsement.accept, g.myAcceptDigest)) return fail('accept-Bindung')
  if (g.vouchesReceived.has(cred.issuer)) { say(p, 'Bürgschaft doppelt — idempotent'); return { handled: true, idempotent: true } }
  g.vouchesReceived.set(cred.issuer, cred)
  const n = g.vouchesReceived.size, need = g.vouchThreshold ?? 1
  if (n >= need) {
    const me = g.roster.get(g.myMemberCtx.anchor)
    if (me) me.candidacy = false
    g.candidacyFulfilled = true
    say(p, `Bürgschaft von ${g.roster.get(cred.issuer)?.name ?? '?'} — Schwelle erreicht (${n}/${need}), Kandidatur erfüllt`)
  } else {
    say(p, `Bürgschaft von ${g.roster.get(cred.issuer)?.name ?? '?'} erhalten (${n}/${need})`)
  }
  return { handled: true, vouched: cred.issuer, fulfilled: n >= need }
}
