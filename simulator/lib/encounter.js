// GENERATED from lib/dist by scripts/build-simulator-lib.mjs — DO NOT EDIT.
// Source of truth: lib/src/*.ts. CI enforces freshness (--check).
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
import { digestDoc, diSign } from './crypto.js';
import { b64uOf, iso } from './core.js';
export { iso };
// ── wire builders (0.25 generation, DTG adoption) ───────────────────────
export const CEREMONY = 'encounter-scan@0.25';
export const CARD_VERSION = 'rltp-card/0.25';
export const CRED_FORMAT = 'rltp-encounter-credential/0.25';
export const binding = (ceremony, c1, c2) => digestDoc({ ceremony, challenges: [c1, c2].sort() });
export const challengeOf = (bytes17) => {
    // a producer never emits what every conformant receiver must reject:
    // the challenge is EXACTLY 17 random bytes (>= 128 bits, Encounter §5)
    if (!(bytes17 instanceof Uint8Array) || bytes17.length !== 17)
        throw new Error('challenge entropy must be exactly 17 bytes');
    return challengeOfUnchecked(bytes17);
};
const challengeOfUnchecked = (bytes17) => b64uOf(bytes17).slice(0, 22);
// cards carry no @context (the proof carries none either — W3C-true)
export const signCard = (ctx, body, created) => diSign(ctx, body, created);
export function cardBody(ctx, fields = {}) {
    const { name, challenge, sentTo, boundTo } = fields;
    // runtime guard for JS callers the union cannot reach: the sent-card
    // profile is atomic — half of it is not a card of either profile
    if ((sentTo === undefined) !== (boundTo === undefined))
        throw new Error('a sent card carries sentTo AND boundTo together (Encounter §5)');
    const b = { version: CARD_VERSION, anchor: ctx.anchor, keyAgreement: ctx.keyAgreement };
    if (name !== undefined)
        b.name = name;
    if (challenge !== undefined)
        b.challenge = challenge;
    if (sentTo !== undefined) {
        b.sentTo = sentTo;
        b.boundTo = boundTo;
    }
    return b;
}
export async function issueCredential(ctx, subjectAnchor, ceremony, subjectChallenge, enactmentBinding, whenIso) {
    const body = {
        '@context': ['https://www.w3.org/ns/credentials/v2', 'https://firstperson.network/credentials/dtg/v1', 'https://real-life.org/rltp/v1'],
        type: ['VerifiableCredential', 'DTGCredential', 'RelationshipCredential', 'EncounterCredential'],
        issuer: ctx.anchor,
        validFrom: whenIso,
        credentialSubject: { id: subjectAnchor, format: CRED_FORMAT, ceremony, challenge: subjectChallenge, enactmentBinding },
    };
    return diSign(ctx, body, whenIso);
}
