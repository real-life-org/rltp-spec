// introduce.mjs — the introduction act, PROBE for the §8 recast.
// DOM-free, deterministic-capable, on rltp-core + rltp-crypto.
//
// THE MODEL (Anton's cuts, 25.08. — supersedes converged §8@1's
// requester-initiated ferry):
//   1. MEDIATOR-INITIATED: only M can point at both parties (a requester
//      has no in-app handle for the target; the verbal wish lives in real
//      life). M opens a contact, taps "Vorstellen…", picks the other.
//   2. INDEPENDENT RELEASE (ceremony-parallel): both sides receive the
//      offer simultaneously; EACH consent releases that person's OWN
//      fresh card — one-sided outcomes stay first-class (◇), mutuality
//      arises when both have released (⇄).
//   3. RENDEZVOUS DROP, not ferry: the offers carry a per-act secret;
//      consenting devices deposit their sealed card at a derived topic
//      and fetch the counterpart's — THE MEDIATOR IS NEVER NEEDED AGAIN
//      after the initiating act (airplane-mode scenario). The drop is a
//      PORT (put/get by derived topic, opaque blobs, TTL); relay-topic /
//      DHT / iroh node / M's device are adapters below it.
//   4. The mediator VOUCHER binds the ACT, not the card (the drop model
//      makes card-digest vouchers impossible — M never sees the cards;
//      harvest finding for the recast). Each offer carries the voucher
//      FOR THE COUNTERPART, signed under M's channel anchor toward that
//      counterpart; the consenting side deposits it beside its card, so
//      the fetcher verifies "this introduction came from MY M".
//   Trust: M remains the authenticity anchor of the introduction either
//   way; the systemic control is the first real encounter (◇→✓,
//   continuity). Deniability/linkability hardening is RECAST WORK — this
//   probe signs plainly and says so.
import { jcs, makeValidator, tsec } from './rltp-core.mjs'
import * as C from './rltp-crypto.mjs'
import * as DV from './delivery.mjs'
import { snapshotPriors } from './continuity.mjs'

const te = new TextEncoder(), td = new TextDecoder()
const S = globalThis.crypto.subtle

// ── people ──────────────────────────────────────────────────────────────
export function createPerson (name, rootIkm) {
  return {
    name,
    rootIkm: rootIkm ?? C.rand(64),
    contexts: new Map(),   // anchor/keyAgreement -> pair ctx (fresh-always)
    contacts: new Map(),   // counterpart anchor -> { name, card, provenance, state, channel }
    inbox: [],             // received offers/invites awaiting the human
    groups: new Map(),     // genesisDigest -> group state (Stage C, groups.mjs)
    online: true,
    queue: [],             // actions deferred while offline (device ferry of ONESELF)
    log: [],
  }
}
const say = (p, m) => p.log.push(m)
export async function freshCtx (p, nonce) {
  const ctx = await C.pairContext(p.rootIkm, nonce ?? C.rand(32))
  p.contexts.set(ctx.anchor, ctx); p.contexts.set(ctx.keyAgreement, ctx)
  return ctx
}

// ── die Zeremonie in SCHRITTEN — die App-Choreografie (Encounter 5.2):
// Code zeigen → scannen → BEIDE bestätigen bewusst; erst dann entsteht
// das Enactment. Der gezeigte Anker ist immer frisch (4.4) und verrät
// nichts — wer ihn wirklich trifft, klärt hinterher die §6a-Probe.
export async function ceremonyShow (p, ent = {}) {
  const ctx = await freshCtx(p, ent.nonce)
  return { ctx, ch: C.challengeOf(ent.ch ?? C.rand(17)) }
}
export async function ceremonyComplete (a, sa, b, sb, when) {
  const ctxA = sa.ctx, ctxB = sb.ctx, chA = sa.ch, chB = sb.ch
  const bind = await C.binding(C.CEREMONY, chA, chB)
  const iso = C.iso(when)
  const cardA = await C.signCard(ctxA, C.cardBody(ctxA, { name: a.name, challenge: { value: chA, issuedAt: iso } }), iso)
  const cardB = await C.signCard(ctxB, C.cardBody(ctxB, { name: b.name, challenge: { value: chB, issuedAt: iso } }), iso)
  const credA = await C.issueCredential(ctxA, ctxB.anchor, C.CEREMONY, chB, bind, iso)
  const credB = await C.issueCredential(ctxB, ctxA.anchor, C.CEREMONY, chA, bind, iso)
  const priorsA = snapshotPriors(a), priorsB = snapshotPriors(b) // Schnappschuss VOR dem frischen Tupel (6a)
  a.contacts.set(ctxB.anchor, { name: b.name, card: cardB, credential: credA, provenance: 'ceremony', state: '✓', since: iso, channel: { own: ctxA, counterpartKa: cardB.keyAgreement }, priorCands: priorsA })
  b.contacts.set(ctxA.anchor, { name: a.name, card: cardA, credential: credB, provenance: 'ceremony', state: '✓', since: iso, channel: { own: ctxB, counterpartKa: cardA.keyAgreement }, priorCands: priorsB })
  say(a, `Zeremonie mit ${b.name}: ✓ verifiziert (frisches Tupel)`)
  say(b, `Zeremonie mit ${a.name}: ✓ verifiziert (frisches Tupel)`)
  return { ctxA, ctxB, bind }
}
// Test-Shortcut: beide Schritte in einem Zug (Vorgeschichte in Szenarien)
export async function ceremony (a, b, when, ent = {}) {
  return ceremonyComplete(a, await ceremonyShow(a, { nonce: ent.nonceA, ch: ent.chA }),
    b, await ceremonyShow(b, { nonce: ent.nonceB, ch: ent.chB }), when)
}

// ── the rendezvous drop PORT: put/get by derived topic, opaque blobs ────
export function createDrop () {
  return {
    slots: new Map(),      // topic -> b64u blob
    log: [],               // { n, op, topic, by }
    put (topic, blob, by) { this.slots.set(topic, blob); this.log.push({ n: this.log.length, op: 'put', topic: topic.slice(0, 16) + '…', by }) },
    get (topic, by) { this.log.push({ n: this.log.length, op: 'get', topic: topic.slice(0, 16) + '…', by }); return this.slots.get(topic) ?? null },
  }
}
const dropTopic = async (secret, dir) => C.b64uOf(await C.hkdf(secret, 'rltp/introduce/topic/' + dir))
const dropKey = async (secret, dir) => S.importKey('raw', await C.hkdf(secret, 'rltp/introduce/key/' + dir), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
async function dropSeal (secret, dir, obj, nonce) {
  const n = nonce ?? C.rand(12)
  const ct = new Uint8Array(await S.encrypt({ name: 'AES-GCM', iv: n }, await dropKey(secret, dir), te.encode(jcs(obj))))
  return C.b64uOf(C.cat(n, ct))
}
async function dropOpen (secret, dir, blob) {
  try {
    const raw = C.fromB64u(blob)
    const pt = await S.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, 12) }, await dropKey(secret, dir), raw.subarray(12))
    return JSON.parse(td.decode(new Uint8Array(pt)))
  } catch { return null }
}

// ── 1. the mediator's ONE act: "Vorstellen…" ────────────────────────────
// Produces two sealed offers over the EXISTING channels. After this, the
// mediator's device is done — nothing below ever touches it again.
// Introducible are ✓ AND ⇄ contacts (Anton's cut, 24.08.) — but the offer
// carries the mediator's OWN provenance toward the peer (met | introduced,
// the vouch@2 vocabulary): the recipient decides informed, and a chain of
// introductions never washes amber to blue — reach spreads, verification
// does not. ◇ cannot mediate: no own channel context exists.
export async function introduce (m, anchorA, anchorB, when, ent = {}) {
  const A = m.contacts.get(anchorA), B = m.contacts.get(anchorB)
  if (!A || !B) throw new Error('mediator does not hold both contacts')
  if (!A.channel?.own || !B.channel?.own) throw new Error('introducing needs a mutual channel to BOTH (◇ cannot mediate)')
  const secret = ent.secret ?? C.rand(32)
  const act = await C.digestBytes(secret)          // act id: public handle, secret stays sealed
  const iso = C.iso(when)
  const provOf = (c) => c.provenance === 'ceremony' ? 'met' : 'introduced'
  const mk = async (mine, other, dir) => {
    // voucher FOR the counterpart, under M's channel anchor toward the counterpart;
    // it carries M's self-attested provenance toward the person it vouches for
    const voucher = await C.diSign(other.channel.own, { type: 'introduction-voucher@2', act, direction: dir, provenance: provOf(mine), issuedAt: iso }, iso)
    const offer = await C.diSign(mine.channel.own, {
      type: 'introduction-offer@2', act, direction: dir, issuedAt: iso,
      peer: { name: other.name, provenance: provOf(other) }, // M's LOCAL memory — words + honest basis, no anchors
      rendezvous: C.b64uOf(secret),
      voucherForCounterpart: voucher,
    }, iso)
    return C.seal(offer, mine.channel.counterpartKa, { ephSeed: ent.ephSeed, nonce: ent.sealNonce })
  }
  const envA = await mk(A, B, 'a')
  const envB = await mk(B, A, 'b')
  say(m, `Vorstellen: ${A.name} ⇠⇢ ${B.name} — zwei Angebote versiegelt, Akt ${act.slice(0, 12)}… · mein Gerät ist ab jetzt nicht mehr nötig`)
  return { act, offers: [{ to: anchorA, env: envA }, { to: anchorB, env: envB }] }
}

// ── 2. receiving the offer (each side, independently) ───────────────────
export async function receiveOffer (p, env) {
  const opened = await DV.openEnvelope(p, env)                // Stufen 1–4, Cache-Lesung (lib-Parität)
  if (opened.duplicate) return { duplicate: true }
  if (opened.error) return { error: opened.error }
  const r = await receiveOfferInner(p, env, opened.doc)
  if (!r.error) DV.effectDone(p, opened.digest)
  return r
}
async function receiveOfferInner (p, env, offer) {
  const from = [...p.contacts.entries()].find(([anchor, c]) => c.channel && offer.proof?.verificationMethod?.startsWith(anchor))
  if (!from) return { error: 'offer not from a held contact' }
  if (!(await C.diVerify(offer, from[0]))) return { error: 'offer proof fails' }
  const entry = { offer, mediator: from[1].name, mediatorAnchor: from[0], decided: false }
  p.inbox.push(entry)
  say(p, `${from[1].name} möchte dich mit ${offer.peer.name} verbinden`)
  return { entry }
}

// ── 3. consent: release the OWN card — independent of the other side.
// Releasing and receiving are SEPARATE (ceremony-parallel): consent only
// controls the own card; the counterpart's card arrives via sync
// (checkDrop) whether or not this side ever consents.
export async function consent (p, entry, drop, when, ent = {}) {
  if (!p.online) { p.queue.push(() => consent(p, entry, drop, when, ent)); say(p, 'offline — Freigabe wartet auf Netz'); return { queued: true } }
  const { offer } = entry
  const secret = C.fromB64u(offer.rendezvous)
  const myDir = offer.direction
  const ctx = await freshCtx(p, ent.nonce)
  const iso = C.iso(when)
  const card = await C.signCard(ctx, C.cardBody(ctx, { name: p.name, challenge: { value: C.challengeOf(ent.ch ?? C.rand(17)), issuedAt: iso } }), iso)
  drop.put(await dropTopic(secret, myDir), await dropSeal(secret, myDir, { card, voucher: offer.voucherForCounterpart }, ent.dropNonce), p.name)
  entry.decided = true
  entry.released = true
  entry.ownCtx = ctx
  entry.ownCard = card
  say(p, `Verbinden mit ${offer.peer.name}: eigene Karte freigegeben (◇ gesendet)`)
  // if the counterpart's card is already held, the relationship is mutual now
  if (entry.counterpartAnchor) {
    const c = p.contacts.get(entry.counterpartAnchor)
    if (c) { c.state = '⇄'; c.channel.own = ctx; say(p, `⇄ verbunden mit ${c.name} — beide Karten liegen vor`) }
  }
  const fetched = await checkDrop(p, entry, drop)
  return { ctx, mutual: !!(entry.released && entry.counterpartAnchor) }
}

// ── 4. sync: fetch the counterpart's card — PASSIVE receipt, independent
// of the own decision (like a shared contact arriving; ignoring the offer
// never blocks what the other side chose to release) ────────────────────
export async function checkDrop (p, entry, drop) {
  if (!p.online || entry.done) return null
  const { offer } = entry
  const secret = C.fromB64u(offer.rendezvous)
  const otherDir = offer.direction === 'a' ? 'b' : 'a'
  const blob = drop.get(await dropTopic(secret, otherDir), p.name)
  if (!blob) return { mutual: false }
  const pkg = await dropOpen(secret, otherDir, blob)
  if (!pkg) { say(p, 'Drop-Blob unlesbar (falsches Geheimnis?)'); return { error: 'undecryptable' } }
  // the counterpart card: schema + DI; the voucher: signed by MY mediator
  if (!(await C.diVerify(pkg.card, pkg.card.anchor))) { say(p, 'Karte verifiziert nicht'); return { error: 'card' } }
  if (!(await C.diVerify(pkg.voucher, entry.mediatorAnchor)) || pkg.voucher.act !== offer.act) { say(p, 'Voucher verifiziert nicht unter meinem Vermittler'); return { error: 'voucher' } }
  entry.done = true
  entry.counterpartAnchor = pkg.card.anchor
  const mutual = !!entry.released
  const priors = snapshotPriors(p) // Schnappschuss VOR dem frischen Tupel (6a)
  p.contacts.set(pkg.card.anchor, {
    name: pkg.card.name, card: pkg.card, provenance: `introduced via ${entry.mediator}`, since: entry.offer.issuedAt,
    mediatorProvenance: entry.offer.peer.provenance ?? 'met', priorCands: priors,
    state: mutual ? '⇄' : '◇', channel: { own: entry.ownCtx ?? null, counterpartKa: pkg.card.keyAgreement },
    voucher: pkg.voucher,
  })
  say(p, mutual ? `⇄ verbunden mit ${pkg.card.name} — via ${entry.mediator} (Voucher geprüft)` : `◇ ${pkg.card.name} erhalten — vorgestellt via ${entry.mediator} (einseitig; du hast nichts freigegeben)`)
  return { mutual, card: pkg.card }
}

// ── device lifecycle ────────────────────────────────────────────────────
export async function setOnline (p, online, drop) {
  p.online = online
  say(p, online ? 'online' : 'offline (Flugmodus)')
  if (online) {
    const q = p.queue.splice(0)
    for (const fn of q) await fn()
    for (const e of p.inbox) if (!e.kind) await checkDrop(p, e, drop) // nur Vorstellungs-Angebote haben einen Drop
  }
}
