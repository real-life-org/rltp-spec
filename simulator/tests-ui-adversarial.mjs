// Adversarial checks INSIDE the browser build: reach into the live Component
// and prove the crypto blockers are closed against forged inputs.
import { chromium } from '@playwright/test';
const CHROME = process.env.CHROME_BIN || '/usr/bin/chromium'; // override with CHROME_BIN
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1480, height: 1100 } });
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 200)));
await page.goto('http://localhost:8199/index.html', { waitUntil: 'domcontentloaded' });
await page.getByText('Verify a person').first().waitFor({ timeout: 15000 });
await page.getByText('seal vector: reproduced byte-for-byte').waitFor({ timeout: 15000 });

const out = await page.evaluate(async () => {
  // find the live Component instance from any DC-rendered node
  const findInst = () => {
    const ok = (o) => o && typeof o.sign === 'function' && typeof o.verify === 'function' && o.dev && o.dev.A;
    const walk = (n) => {
      for (const k in n) if (k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')) {
        let f = n[k];
        while (f) {
          const sn = f.stateNode;
          if (sn && ok(sn.logic)) return sn.logic;
          if (ok(sn)) return sn;
          f = f.return;
        }
      }
      return null;
    };
    for (const el of document.querySelectorAll('*')) { const r = walk(el); if (r) return r; }
    return null;
  };
  const C = findInst();
  if (!C) return { error: 'no Component instance found' };
  const A = C.dev.A, B = C.dev.B;
  const r = {};

  // control: a genuine card verifies under its own (fresh pair) anchor
  const card = A.card;                                  // the displayed card, minted under A.displayCtx
  const body = { ...card }; delete body.proof;
  r.genuineVerifies = await C.verify(card.anchor, body, card.proof);

  // F2: the same proof presented under B's (fresh) anchor must NOT verify
  r.foreignAnchorRejected = (await C.verify(B.card.anchor, body, card.proof)) === false;

  // F2: a card claiming A's pair anchor but signed under B's context must NOT verify as A
  const bCard = B.card;
  const spoof = { ...bCard, anchor: card.anchor };
  const sbody = { ...spoof }; delete sbody.proof;
  r.spoofedAnchorRejected = (await C.verify(card.anchor, sbody, spoof.proof)) === false;

  // fresh-always: two displays of one device mint two different pair anchors
  const beforeAnchor = A.card.anchor;
  await C.newChallenge(A);
  r.freshAlways = A.card.anchor !== beforeAnchor;

  // F1: proof message is the two-hash construction (sha256(JCS(cfg))||sha256(JCS(doc)))
  const cfgNoPv = { ...card.proof }; delete cfgNoPv.proofValue;
  const msg = await C.proofMsg(cfgNoPv, body);
  r.twoHashLength = msg.length === 64; // 32 + 32, not the raw JCS byte length

  // F15: multihash u vs z equivalence
  const u = await C.mdigest({ hello: 'world' });
  const z = 'z' + C.b58(C.ub64u(u.slice(1)));
  r.zEqualsU = C.sameDigest(u, z) === true;
  r.differentUnequal = C.sameDigest(u, u.slice(0, -2) + 'AA') === false || u.endsWith('AA');

  // F14: honest — edOK true here means real Ed25519 (no stand-in path taken)
  r.edOK = C.edOK === true;

  // F16: the browser SCHEMA GATE (rltp-core validator, 5.6 step 1) —
  // a correctly signed but re-typed or context-less credential is
  // rejected AT THE GATE, and the gate is fail-closed
  r.validatorLoaded = !!window.RLTP && typeof window.RLTP.validate === 'function';
  {
    // mint a schema-valid credential in-page via the component's own
    // builders (the adversarial probe runs before any full enactment)
    const ctx = await C.mkCtx(C.dev.A);
    const ch1 = C.fresh(), ch2 = C.fresh();
    const bind = await C.binding(C.C1, ch1, ch2);
    const gBody = { '@context': ['https://www.w3.org/ns/credentials/v2', 'https://firstperson.network/credentials/dtg/v1', 'https://real-life.org/rltp/v1'],
      type: ['VerifiableCredential', 'DTGCredential', 'RelationshipCredential', 'EncounterCredential'],
      issuer: ctx.anchor, validFrom: C.iso(C.now(C.dev.A)),
      credentialSubject: { id: A.card.anchor, format: C.CREDF, ceremony: C.C1, challenge: ch2, enactmentBinding: bind, channel: 'in-person' } };
    const good = { ...gBody, proof: await C.sign(C.dev.A, ctx, gBody) };
    if (good) {
      const okGood = (await C.accept56(C.dev.B, good)); // wrong device: fails LATER (no record), but NOT at the schema gate
      r.goodPassesGate = okGood.code !== 'ERR_VERSION (schema)' && okGood.code !== 'ERR_VERSION (validator unavailable)';
      const retyped = JSON.parse(JSON.stringify(good));
      retyped.type = ['VerifiableCredential', 'DTGCredential', 'EndorsementCredential', 'AdmissionVouch'];
      r.retypedRejected = (await C.accept56(C.dev.B, retyped)).code === 'ERR_VERSION (schema)';
      const noCtx = JSON.parse(JSON.stringify(good));
      delete noCtx['@context']; delete noCtx.proof['@context'];
      r.noCtxRejected = (await C.accept56(C.dev.B, noCtx)).code === 'ERR_VERSION (schema)';
      const saved = window.RLTP; window.RLTP = null;
      r.failClosed = (await C.accept56(C.dev.B, good)).code === 'ERR_VERSION (validator unavailable)';
      window.RLTP = saved;
    } else { r.goodPassesGate = r.retypedRejected = r.noCtxRejected = r.failClosed = 'no issued credential in scenario state'; }
  }
  return r;
});

let fails = 0;
const check = (c, m) => { console.log((c ? '✓ ' : '✗ FAIL ') + m); if (!c) fails++; };
if (out.error) { console.log('SETUP FAIL:', out.error); process.exit(1); }
check(out.genuineVerifies, 'Kontrolle: echte Card verifiziert unter eigenem Anchor');
check(out.foreignAnchorRejected, 'F2: Proof unter fremdem Anchor (B) abgelehnt');
check(out.spoofedAnchorRejected, 'F2: Card mit A-Anchor aber B-Signatur abgelehnt');
check(out.twoHashLength, 'F1: Proof-Message ist 64 B (zwei SHA-256-Digests), kein Roh-JCS');
check(out.zEqualsU, 'F15: u- und z-Multihash gelten gleich');
check(out.edOK, 'F14: echtes Ed25519 aktiv (kein SHA-Stand-in serialisiert)');
check(out.freshAlways, 'F14+: fresh-always — zwei Displays, zwei verschiedene pair-Anker');
check(out.validatorLoaded, 'F16: rltp-core-Validator im Browser geladen');
check(out.goodPassesGate === true, 'F16: echtes Credential passiert das Schema-Gate (' + out.goodPassesGate + ')');
check(out.retypedRejected === true, 'F16: umgetyptes Credential → ERR_VERSION (schema) (' + out.retypedRejected + ')');
check(out.noCtxRejected === true, 'F16: Credential ohne @context → ERR_VERSION (schema) (' + out.noCtxRejected + ')');
check(out.failClosed === true, 'F16: Gate fail-closed ohne Validator (' + out.failClosed + ')');
console.log(fails ? `\n${fails} FAILED` : '\nALLE UI-ADVERSARIAL-CHECKS BESTANDEN');
await browser.close();
process.exit(fails ? 1 : 0);
