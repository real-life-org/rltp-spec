// encounter — the Encounter Layer: how two people record that they met.
//
// The one registered ceremony (encounter-scan), the contact card each
// side displays, the challenge that makes an enactment fresh, the
// enactment binding both sides compute independently, and the encounter
// credential each issues about the other.
//
// The binding is what makes the pair an enactment rather than two
// unrelated claims: both sides derive it from the same two challenges,
// sorted, so neither can steer it.
import { digestDoc, diSign } from './crypto.js'
import type { Signer } from './crypto.js'
import { b64uOf, iso } from './core.js'
export { iso }

// ── wire builders (0.25 generation, DTG adoption) ───────────────────────
export const CEREMONY = 'encounter-scan@0.25'
export const CARD_VERSION = 'rltp-card/0.25'
export const CRED_FORMAT = 'rltp-encounter-credential/0.25'
export const binding = (ceremony: string, c1: string, c2: string): Promise<string> => digestDoc({ ceremony, challenges: [c1, c2].sort() })
export const challengeOf = (bytes17: Uint8Array): string => {
  // a producer never emits what every conformant receiver must reject:
  // the challenge is EXACTLY 17 random bytes (>= 128 bits, Encounter §5)
  if (!(bytes17 instanceof Uint8Array) || bytes17.length !== 17) throw new Error('challenge entropy must be exactly 17 bytes')
  return challengeOfUnchecked(bytes17)
}
const challengeOfUnchecked = (bytes17: Uint8Array): string => b64uOf(bytes17).slice(0, 22)

// cards carry no @context (the proof carries none either — W3C-true)
export const signCard = (ctx: Signer, body: CardBody, created: string) => diSign(ctx, body, created)

/** The challenge a displayed card carries: fresh value, whole-second issue time. */
export interface Challenge { value: string, issuedAt: string }

/**
 * The spec knows exactly two disjoint card profiles (Encounter §5):
 * a DISPLAYED card offers a challenge; a SENT card names its recipient
 * AND the challenge it answers — always both, never one (M-2, review 1:
 * the fields travel together or the card is neither profile).
 */
export type CardFields =
  | { name?: string, challenge?: Challenge, sentTo?: undefined, boundTo?: undefined }
  | { name?: string, challenge?: Challenge, sentTo: string, boundTo: string }

/** A card body as it goes under the signature. */
export interface CardBody {
  version: string
  anchor: string
  keyAgreement: string
  name?: string
  challenge?: Challenge
  sentTo?: string
  boundTo?: string
}

export function cardBody (ctx: { anchor: string, keyAgreement: string }, fields: CardFields = {}): CardBody {
  const { name, challenge, sentTo, boundTo } = fields as { name?: string, challenge?: Challenge, sentTo?: string, boundTo?: string }
  // runtime guard for JS callers the union cannot reach: the sent-card
  // profile is atomic — half of it is not a card of either profile
  if ((sentTo === undefined) !== (boundTo === undefined)) throw new Error('a sent card carries sentTo AND boundTo together (Encounter §5)')
  const b: CardBody = { version: CARD_VERSION, anchor: ctx.anchor, keyAgreement: ctx.keyAgreement }
  if (name !== undefined) b.name = name
  if (challenge !== undefined) b.challenge = challenge
  if (sentTo !== undefined) { b.sentTo = sentTo; b.boundTo = boundTo }
  return b
}
export async function issueCredential (
  ctx: Signer, subjectAnchor: string, ceremony: string,
  subjectChallenge: string, enactmentBinding: string, whenIso: string,
) {
  const body = {
    '@context': ['https://www.w3.org/ns/credentials/v2', 'https://firstperson.network/credentials/dtg/v1', 'https://real-life.org/rltp/v1'],
    type: ['VerifiableCredential', 'DTGCredential', 'RelationshipCredential', 'EncounterCredential'],
    issuer: ctx.anchor,
    validFrom: whenIso,
    credentialSubject: { id: subjectAnchor, format: CRED_FORMAT, ceremony, challenge: subjectChallenge, enactmentBinding },
  }
  return diSign(ctx, body, whenIso)
}

