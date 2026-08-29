// GENERATED from lib/dist by scripts/build-simulator-lib.mjs — DO NOT EDIT.
// Source of truth: lib/src/*.ts. CI enforces freshness (--check).
// carrier-identity — Identity §7a: the carrier-relationship identity class.
//
// One control principal per (relationship × carrier), Ed25519-only. The
// derivation shares no computable relation with the relationship's other
// principals or with its `rkid` — that absence is the privacy property
// the whole class exists for (§7a.5), and it is why registration must
// PROVE the binding instead of computing it (Delivery §5a.3).
//
// info = "rltp/v1/carrier-relationship/ed25519/v1/" || Dc || Dn
// where Dc = multihash(sha2-256, UTF-8 of the configured carrier
// identifier C) and Dn = multihash(sha2-256, 32-byte carrier nonce N),
// each rendered as 'u' + base64url — exactly 47 characters, so the two
// parts are length-fixed and no concatenation ambiguity exists (§7a.4).
//
// NO key-agreement key is derived for this class: sealing stays at the
// `rkid` (§7a.1), and a carrier that never holds a decryption key can
// never be asked to use one.
import { b64uOf, cat } from './crypto.js';
import { sha, hkdf, edFromSeed, anchorOfEd } from './crypto.js';
import { WHITE_SPACE_15 } from './unicode15.js';
const te = new TextEncoder();
export const CARRIER_INFO_PREFIX = 'rltp/v1/carrier-relationship/ed25519/v1/';
// multihash(sha2-256) in base64url — the digest form Identity §7a.4 fixes
const mh = async (bytes) => 'u' + b64uOf(cat(Uint8Array.from([0x12, 0x20]), await sha(bytes)));
// Identity §7a.2 — the ordered validation pipeline for C, fail closed
// and NO normalization (the deliberate difference to §6.2): valid
// Unicode scalar values only (unpaired surrogates never repaired),
// 1..1024 UTF-8 BYTES, and no Cc, Cf or White_Space code point anywhere.
//
// The category tables are PINNED to Unicode 15.0 (port-review-2 M-6):
// evaluating against the platform's \p{...} data would let the same
// identifier derive a principal on one runtime and be rejected on
// another the moment a Unicode revision moves a code point — the exact
// defect the persona repertoire (unicode15.ts) already closed for §6.2.
// Cc is the stable C0/C1 block; Cf is the 170-code-point Unicode-15.0
// set, enumerated below; White_Space is unicode15.ts's pinned set.
const CC_15 = (cp) => cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f);
const CF_15_RANGES = [
    [0x00ad, 0x00ad], [0x0600, 0x0605], [0x061c, 0x061c], [0x06dd, 0x06dd],
    [0x070f, 0x070f], [0x0890, 0x0891], [0x08e2, 0x08e2], [0x180e, 0x180e],
    [0x200b, 0x200f], [0x202a, 0x202e], [0x2060, 0x2064], [0x2066, 0x206f],
    [0xfeff, 0xfeff], [0xfff9, 0xfffb], [0x110bd, 0x110bd], [0x110cd, 0x110cd],
    [0x13430, 0x1343f], [0x1bca0, 0x1bca3], [0x1d173, 0x1d17a],
    [0xe0001, 0xe0001], [0xe0020, 0xe007f],
];
const CF_15 = (cp) => CF_15_RANGES.some(([a, b]) => cp >= a && cp <= b);
export function validCarrierIdentifier(c) {
    if (typeof c !== 'string' || c.length === 0)
        return false;
    // scalar values: an unpaired surrogate is not a Unicode string
    for (let i = 0; i < c.length; i++) {
        const u = c.charCodeAt(i);
        if (u >= 0xdc00 && u <= 0xdfff)
            return false; // lone low
        if (u >= 0xd800 && u <= 0xdbff) {
            const nxt = c.charCodeAt(i + 1);
            if (!(nxt >= 0xdc00 && nxt <= 0xdfff))
                return false; // lone high
            i++;
        }
    }
    const bytes = new TextEncoder().encode(c);
    if (bytes.length < 1 || bytes.length > 1024)
        return false;
    for (const ch of c) {
        const cp = ch.codePointAt(0);
        if (CC_15(cp) || CF_15(cp) || WHITE_SPACE_15.has(cp))
            return false;
    }
    return true;
}
// Identity §7a.4 — derive the control principal for one relationship at
// one carrier. `carrier` is C exactly as configured (byte-exact), `nonce`
// is the relationship's 32-byte carrier nonce N from the register (§7a.3).
export async function carrierPrincipal(rootIkm, carrier, nonce) {
    if (!validCarrierIdentifier(carrier))
        throw new Error('invalid carrier identifier (7a.2)');
    if (nonce.length !== 32)
        throw new Error('carrier nonce must be 32 bytes (7a.3)');
    const info = CARRIER_INFO_PREFIX + await mh(te.encode(carrier)) + await mh(nonce);
    const seed = await hkdf(rootIkm, info);
    const key = await edFromSeed(seed);
    return { principal: anchorOfEd(key.pubRaw), key, info, keyAgreement: null };
}
