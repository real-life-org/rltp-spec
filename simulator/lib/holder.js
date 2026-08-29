// GENERATED from lib/dist by scripts/build-simulator-lib.mjs — DO NOT EDIT.
// Source of truth: lib/src/*.ts. CI enforces freshness (--check).
// holder — the holder's side of the carrier port (Delivery §5a, the
// client half): proof construction for all four purposes, the recovery
// flow of Identity §9.3, and verdict handling.
//
// The holder never guesses what the carrier holds. It derives its
// principal (carrier-identity), asks for challenges, signs proofs whose
// bytes are fixed by §5a.3, and reads exactly the closed verdict set —
// including the one disclosure the protocol makes: a
// `refused(stale-generation)` carries the generation to exceed, which is
// what makes "carrier entry lost, pair context held" replaceable in two
// exchanges instead of never.
import { jcs } from './core.js';
import { base58 } from './crypto.js';
import { carrierPrincipal } from './carrier-identity.js';
import { PROOF_V } from './carrier.js';
const S = globalThis.crypto.subtle;
const te = new TextEncoder();
/** derive-and-wrap: one holder context per (relationship × carrier) */
export async function holderContext(rootIkm, carrier, nonce, rkid, generation) {
    return { carrier, identity: await carrierPrincipal(rootIkm, carrier, nonce), rkid, generation };
}
async function sign(ctx, fields) {
    const p = {
        v: PROOF_V, type: 'carrier-registration-proof',
        carrier: ctx.carrier, principal: ctx.identity.principal, rkid: ctx.rkid,
        ...fields,
    };
    const sig = new Uint8Array(await S.sign({ name: 'Ed25519' }, ctx.identity.key.priv, te.encode(jcs(p))));
    return { ...p, sig: 'z' + base58(sig) };
}
/** register/rebind proof: both succession fields present (§5a.3).
 * `openedAddressChallenge` is the value the holder decrypted from the
 * carrier's sealed challenge — possession of the rkid's private key. */
export function registrationProof(ctx, purpose, principalChallenge, openedAddressChallenge, generation = ctx.generation) {
    return sign(ctx, { purpose, generation, principalChallenge, addressChallenge: openedAddressChallenge });
}
/** collect/conclude proof: session-scoped, neither succession field —
 * their ABSENCE is part of the signed bytes (§5a.3). */
export function sessionProof(ctx, purpose, principalChallenge) {
    return sign(ctx, { purpose, principalChallenge });
}
// ── the recovery flow (Identity §9.3, executable) ───────────────────────
// After losing the carrier entry alone (pair context held), the holder
// knows neither the old principal nor the generation to exceed. The flow
// is: attempt at generation 1; on the disclosing refusal, ROTATE THE
// REGISTER to disclosed + 1 — Identity §7a.3: each rotation is a fresh
// nonce N at generation g+1, and the principal is DERIVED from the new
// nonce; a proof that named a higher generation over an old nonce would
// claim a register state that does not exist (port-review B-6). Only the
// number of carrier exchanges stays two; the rotations are local.
export const GENERATION_MAX = Number.MAX_SAFE_INTEGER; // 2^53 − 1 (Identity §7a.3)
/** One recovery run. `rotateTo(g)` performs the LOCAL register rotations
 * up to generation g — fresh nonce, re-derived principal — and returns
 * the holder context of the new canonical entry (Identity §7a.3).
 * `exchange` is the transport; `challenges` draws a fresh pair per
 * attempt. `maxCapacityRetries` bounds only this run: the protocol
 * promises order, never time (round-46 B-2). At the generation maximum
 * no rotation exists and the address is not re-registrable at this
 * carrier (Identity §7a.3) — the outcome is `terminal`, and the lever is
 * §7a.2's move to a different configured carrier string. */
export async function recoverCarrierEntry(initial, rotateTo, exchange, challenges, maxCapacityRetries = 3) {
    const steps = [];
    let ctx = initial;
    let purpose = 'register';
    for (let attempt = 1; attempt <= 2 + maxCapacityRetries; attempt++) {
        const ch = await challenges();
        const proof = await registrationProof(ctx, purpose, ch.principalChallenge, ch.openedAddressChallenge);
        const v = await exchange(proof, String(ctx.generation));
        steps.push({ attempt, generation: ctx.generation, verdict: v.verdict });
        switch (v.verdict) {
            case 'registered':
            case 'rebound':
            case 'registered(idempotent)':
                return { outcome: 'bound', finalGeneration: ctx.generation, steps };
            case 'refused(stale-generation)': {
                const held = v.heldGeneration;
                if (held >= GENERATION_MAX)
                    return { outcome: 'terminal', steps };
                ctx = await rotateTo(held + 1); // real rotations, fresh nonce
                purpose = 'rebind';
                break;
            }
            case 'registration-refused(capacity)':
            case 'refused(admission-resource)':
                break;
            default:
                return { outcome: 'failed', steps };
        }
    }
    return { outcome: 'waiting', steps };
}
