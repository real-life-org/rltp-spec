// GENERATED from lib/dist by scripts/build-simulator-lib.mjs — DO NOT EDIT.
// Source of truth: lib/src/*.ts. CI enforces freshness (--check).
// identity — the Identity Layer: one root seed, every context derived.
//
// A person holds ONE secret. Everything else is derived from it through
// the ordinary rltp/anchor family: the community anchor that carries the
// stable social identity, a pair anchor per relationship, a member
// anchor per group, public personas. No two contexts link to each other
// unless their holder deliberately discloses the link.
//
// The label registry is CLOSED (Identity §6.1, unchanged since 0.13):
// exactly three label forms derive, and this API rejects every other
// string before any key derivation — fail closed, no repair. `self`,
// `recovery`, `carrier` and `device/…` are not labels; recovery and the
// carrier-relationship identity have their own fixed derivations outside
// this registry and are deliberately NOT part of this module yet.
//
// Fresh-always (Encounter §4.4): a ceremony mints a pair context whose
// label digests the NONCE BYTES, so nothing correlatable is displayed —
// not even to someone who scanned the same person yesterday.
import { toU } from './core.js';
import { hkdf, edFromSeed, xFromSeed, anchorOfEd, mkOfX, digestBytes } from './crypto.js';
import { allowed15, WHITE_SPACE_15 } from './unicode15.js';
// ── the closed registry (Identity §6.1) ─────────────────────────────────
// A digest component is the ONE canonical u rendering of a sha2-256
// multihash: 47 characters, no padding, no non-zero trailing bits, no z.
const digestComponent = (d) => d.length === 47 && d[0] === 'u' && toU(d) === d;
// §6.2 — the ordered persona-name pipeline. NFC is the one permitted
// normalization (applied, not rejected); every later check runs on the
// NFC result — and every Unicode property is evaluated against the
// PINNED 15.0 data in unicode15.ts, never the platform's tables (review
// 2, B-1: Node 22 ships Unicode 16 — a post-15.0 code point must not
// derive an anchor on one runtime and be rejected on another).
const personaName = (raw) => {
    if (!raw.isWellFormed())
        return null; // no lone surrogates
    const name = raw.normalize('NFC'); // NFC of 15.0-assigned code points is version-stable by Unicode's guarantee
    const cps = [...name];
    if (cps.length < 1 || cps.length > 64)
        return null;
    if (new TextEncoder().encode(name).length > 256)
        return null;
    if (name.includes('/'))
        return null; // labels have exactly the components the registry shows
    for (const c of cps)
        if (!allowed15(c.codePointAt(0)))
            return null; // assigned in 15.0, no Cc/Cf
    if (WHITE_SPACE_15.has(cps[0].codePointAt(0)) || WHITE_SPACE_15.has(cps[cps.length - 1].codePointAt(0)))
        return null;
    return name;
};
/**
 * The canonical form of a registry label, or null for everything the
 * closed registry rejects. Personas come back NFC-normalized — for them
 * the canonical label may differ from the input; label equality IS
 * anchor identity, so derivation always uses the canonical form.
 */
export function canonicalLabel(label) {
    if (typeof label !== 'string')
        return null;
    if (label.startsWith('group/'))
        return digestComponent(label.slice(6)) ? label : null;
    if (label.startsWith('pair/'))
        return digestComponent(label.slice(5)) ? label : null;
    if (label.startsWith('persona/')) {
        const name = personaName(label.slice(8));
        return name === null ? null : 'persona/' + name;
    }
    return null; // self, recovery, carrier, device/…, and every unknown form: fail closed
}
export async function labeledContext(rootIkm, label) {
    const canonical = canonicalLabel(label);
    if (canonical === null)
        throw new Error(`not a label of the closed registry (Identity §6.1): ${JSON.stringify(label)}`);
    const ed = await edFromSeed(await hkdf(rootIkm, 'rltp/anchor/ed/' + canonical));
    const x = await xFromSeed(await hkdf(rootIkm, 'rltp/anchor/x/' + canonical));
    return { label: canonical, ed, x, anchor: anchorOfEd(ed.pubRaw), keyAgreement: mkOfX(x.pubRaw) };
}
// fresh-always (Encounter §4.4): label = pair/<multihash over the NONCE
// BYTES>. The nonce is the holder's own, fresh, and exactly 32 bytes —
// a shorter one weakens the label to below its specified entropy (B-2).
export async function pairContext(rootIkm, nonce) {
    if (!(nonce instanceof Uint8Array) || nonce.length !== 32)
        throw new Error('pair nonce must be exactly 32 bytes (Identity §6.1)');
    return labeledContext(rootIkm, 'pair/' + await digestBytes(nonce));
}
/** The community anchor: an ordinary group context over the community's genesis digest. */
export const communityContext = (rootIkm, genesisDigest) => labeledContext(rootIkm, 'group/' + genesisDigest);
