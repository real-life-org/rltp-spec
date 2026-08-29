// GENERATED from lib/dist by scripts/build-simulator-lib.mjs — DO NOT EDIT.
// Source of truth: lib/src/*.ts. CI enforces freshness (--check).
// probe/deps — the bridge the probe modules stand on.
//
// The probe modules were written against the simulator's flat
// rltp-crypto surface; the library cut that surface along the spec
// layers. This module reassembles it — so the probe bodies stay
// byte-comparable to their .mjs originals, and the layer cut stays
// clean for everyone else. When a probe module graduates, it trades
// this bridge for direct layer imports.
export * from '../crypto.js';
export * from '../identity.js';
export * from '../encounter.js';
import { seal as sealStrict } from '../delivery.js';
// bridge: the probe's wire documents are structurally typed interfaces,
// which TypeScript will not index-match against Json — the strict layer
// keeps its Json edge, the probe pays the cast HERE, once
export const seal = (document, recipientKeyAgreement, ent = {}) => sealStrict(document, recipientKeyAgreement, ent);
export { unseal } from '../delivery.js';
import { receive } from '../delivery.js';
/**
 * Every probe receiver enters through HERE (review 2, B-3): the probe
 * hint relieves the probe TRANSPORT FORMS of wire stability — never the
 * sealed envelope of its MUST checks. Runs the generic stages 1–4
 * against the person's contexts and completed-effect cache.
 */
export async function openEnvelope(p, env) {
    const r = await receive(env, (rkid) => p.contexts.get(rkid)?.x.priv, (p.deliveryCache ??= new Set()));
    if (r.disposition === 'duplicate-known')
        return { doc: r.document, digest: r.digest, duplicate: true };
    if (r.disposition !== 'unique')
        return { error: r.disposition };
    return { doc: r.document, digest: r.digest };
}
/**
 * The probe's form gate (review 2, M-3): a valid signature or MAC binds
 * whatever shape was signed — the FORM check is a separate, earlier gate.
 * Field spec: 'string' | 'number' | 'boolean' | 'object' | 'array'.
 */
export const shaped = (o, fields) => o !== null && typeof o === 'object' && !Array.isArray(o) && Object.entries(fields).every(([k, t]) => t === 'array' ? Array.isArray(o[k])
    : t === 'object' ? (o[k] !== null && typeof o[k] === 'object' && !Array.isArray(o[k]))
        : typeof o[k] === t);
/** Canonical decimal integer string: no leading zeros, >= 1, <= 18 digits — the form every sequence field carries. */
export const intStr = (v) => typeof v === 'string' && /^[1-9][0-9]{0,17}$/.test(v);
/** Whole-second ISO timestamp in calendar-valid form. */
export { calOK } from '../core.js';
/** The cache contract: ONLY a completed effect's digest goes in — a rejection stays repeatable. */
export const effectDone = (p, digest) => { if (digest)
    (p.deliveryCache ??= new Set()).add(digest); };
/**
 * The demo community's genesis digest — a PROBE FIXTURE, not protocol.
 * A real deployment derives its community anchor from its own genesis;
 * this constant exists so the probe world has one without ceremony.
 */
export const COMMUNITY_GENESIS = 'uEiDYLnFbXqm2cwuJWuk9yNzRmlzWDpCTH6yA_4aP_1z_RA';
