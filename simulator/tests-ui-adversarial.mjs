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

  // control: a genuine card verifies under its own anchor
  const card = await C.mkCard(A, A.ch, null, null);
  const body = { ...card }; delete body.proof;
  r.genuineVerifies = await C.verify(A.anchor, body, card.proof);

  // F2: the same proof presented under B's anchor must NOT verify
  r.foreignAnchorRejected = (await C.verify(B.anchor, body, card.proof)) === false;

  // F2: a card claiming A's anchor but signed by B must NOT verify as A
  const bCard = await C.mkCard(B, B.ch, null, null);
  const spoof = { ...bCard, anchor: A.anchor };
  const sbody = { ...spoof }; delete sbody.proof;
  r.spoofedAnchorRejected = (await C.verify(A.anchor, sbody, spoof.proof)) === false;

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
console.log(fails ? `\n${fails} FAILED` : '\nALLE UI-ADVERSARIAL-CHECKS BESTANDEN');
await browser.close();
process.exit(fails ? 1 : 0);
