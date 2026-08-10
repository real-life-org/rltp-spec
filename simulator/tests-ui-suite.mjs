// Full UI test suite for the RLTP Ceremony Simulator (browser build).
// Drives the real page in Chrome 145; one scenario per protocol claim.
import { chromium } from '@playwright/test';

const CHROME = process.env.CHROME_BIN || '/usr/bin/chromium'; // override with CHROME_BIN
const URL = 'http://localhost:8199/index.html';
const results = [];
let page;

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
page = await browser.newPage({ viewport: { width: 1480, height: 1100 } });
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 200)));

const T = (t) => page.getByText(t, { exact: false });
const btn = (n) => page.getByRole('button', { name: n, exact: true });
const scanA = async () => { await page.getByRole('button', { name: 'Scan code' }).first().click(); };
const confirmScreen = () => T("Is this the person in front of you?");
const armFault = async (label) => { await page.getByText(label, { exact: false }).first().click(); };
const reset = async () => {
  await btn('Reset both devices').click();
  await T('Nothing on the channel yet').waitFor({ timeout: 10000 });
  await page.waitForTimeout(400);
};
// badge count of a stored-group, per device (0 = left/Anna, 1 = right/Ben)
const badge = (title, dev) => page.evaluate(([t, d]) => {
  const bs = [...document.querySelectorAll('button')].filter(b => b.textContent.trim().startsWith(t));
  const b = bs[d]; if (!b) return null;
  const spans = b.querySelectorAll('span');
  return spans[spans.length - 1].textContent.trim();
}, [title, dev]);

async function happyToPrompt() {
  await scanA();
  await confirmScreen().waitFor({ timeout: 5000 });      // auto-capture, no click
  await btn('Confirm').first().click();
  await T('recognized you').waitFor({ timeout: 10000 });
}
async function promptToMutual() {
  await btn('Confirm').first().click();
  await T('You and Anna are connected!').waitFor({ timeout: 10000 });
  await T('You and Ben are connected!').waitFor({ timeout: 10000 });
}

async function run(name, fn) {
  try { await fn(); results.push([name, 'PASS', '']); console.log('PASS', name); }
  catch (e) {
    results.push([name, 'FAIL', e.message.split('\n')[0].slice(0, 140)]);
    console.log('FAIL', name, '—', e.message.split('\n')[0].slice(0, 140));
    try { await reset(); } catch (e2) { /* keep going */ }
  }
}

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await T('Verify a person').first().waitFor({ timeout: 15000 });
await T('seal vector: reproduced byte-for-byte').waitFor({ timeout: 15000 });
results.push(['boot: webcrypto + seal vector reproduced', 'PASS', '']);

await run('S1 happy path: auto-capture, mutual dialogs, state counts', async () => {
  await happyToPrompt();
  await promptToMutual();
  for (const [title, want] of [['Enactment records', '1'], ['Credentials issued', '1'], ['Credentials received', '1'], ['Consumed challenges', '1']]) {
    for (const d of [0, 1]) {
      const got = await badge(title, d);
      if (got !== want) throw new Error(`${title} device${d}: got ${got}, want ${want}`);
    }
  }
  for (const t of ['encounter-bundle/0.1', 'encounter-credential-delivery/0.1', 'delivery-ack/0.1']) {
    if (!(await T(t).first().isVisible())) throw new Error('missing envelope ' + t);
  }
  await reset();
});

await run('S2 one-sided: "Not now" leaves a legitimate one-way edge', async () => {
  await happyToPrompt();
  await btn('Not now').click();
  await T('Incoming only').waitFor({ timeout: 5000 });
  await T("Arrived on Ben's device").waitFor({ timeout: 8000 });   // A: delivered, not accepted
  if (await badge('Credentials issued', 1) !== '0') throw new Error('B issued although "Not now"');
  if (await badge('Credentials received', 1) !== '1') throw new Error('B should hold the incoming credential');
  await reset();
});

await run('S3 clock skew +7 min on scanner (observational)', async () => {
  await page.getByRole('button', { name: /clock ±0/ }).first().click();  // A -> +7m
  await happyToPrompt();
  await btn('Confirm').first().click();
  // observe: does the counter-credential survive the 5-min skew bound?
  const mutual = await T('You and Ben are connected!').waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  const stale = await T('ERR_STALE_ISSUANCE').first().isVisible().catch(() => false);
  results.push(['S3 observed', 'INFO', mutual ? 'mutual reached despite +7m' : (stale ? 'counter-credential rejected ERR_STALE_ISSUANCE' : 'no mutual, no visible stale error')]);
  await reset();
});

await run('S4 hold envelopes, then release', async () => {
  await armFault('Hold envelopes in the channel');
  await scanA();
  await confirmScreen().waitFor({ timeout: 5000 });
  await btn('Confirm').first().click();
  await T('held').first().waitFor({ timeout: 5000 });
  await armFault('Hold envelopes in the channel');               // release
  await T('recognized you').waitFor({ timeout: 10000 });
  await promptToMutual();
  await reset();
});

await run('S5 recipient offline: outbox, then delivery on reconnect', async () => {
  await page.getByRole('button', { name: 'online' }).nth(1).click();   // B offline
  await scanA();
  await confirmScreen().waitFor({ timeout: 5000 });
  await btn('Confirm').first().click();
  await T('held').first().waitFor({ timeout: 5000 });
  await page.getByRole('button', { name: 'offline', exact: true }).click();  // B back online
  await T('recognized you').waitFor({ timeout: 10000 });
  await reset();
});

await run('S6 duplicate delivery: duplicate-known + byte-identical re-ack', async () => {
  await armFault('Deliver the bundle twice');
  await happyToPrompt();
  await T('duplicate-known').first().waitFor({ timeout: 8000 });
  await T('stored ack re-sent byte-identical').waitFor({ timeout: 8000 });
  await promptToMutual();
  await reset();
});

await run('S7 tampered credential: failed(validation-failed)', async () => {
  await armFault('Alter credential after signing');
  await scanA();
  await confirmScreen().waitFor({ timeout: 5000 });
  await btn('Confirm').first().click();
  await T('credential altered after signing (fault)').waitFor({ timeout: 8000 });
  await T('encounter-bundle/0.1 → failed(validation-failed)').waitFor({ timeout: 8000 });
  await reset();
});

await run('S8 legacy ceremony label: failed(validation-failed)', async () => {
  await armFault('Label credential two-way-scan@0.9');
  await scanA();
  await confirmScreen().waitFor({ timeout: 5000 });
  await btn('Confirm').first().click();
  await T('encounter-bundle/0.1 → failed(validation-failed)').waitFor({ timeout: 8000 });
  await reset();
});

await run('S9 consumed challenge: failed(consumed-challenge)', async () => {
  await armFault('Challenge already in a record');
  await scanA();
  await confirmScreen().waitFor({ timeout: 5000 });
  await btn('Confirm').first().click();
  await T('failed(consumed-challenge)').first().waitFor({ timeout: 8000 });
  await reset();
});

await run('S10 backdated challenge: aged, latched, validation-failed', async () => {
  await armFault('Backdate displayed challenge 12 min');
  await scanA();
  await confirmScreen().waitFor({ timeout: 5000 });
  await btn('Confirm').first().click();
  await T('backdated 12 min (fault)').waitFor({ timeout: 8000 });
  await T('encounter-bundle/0.1 → failed(validation-failed)').waitFor({ timeout: 8000 });
  await reset();
});

await run('S11 lost ack: optical continuation of the SAME enactment', async () => {
  await armFault('Lose the delivery-ack');
  await happyToPrompt();
  await T('delivery-ack dropped (fault)').waitFor({ timeout: 8000 });
  // B steps aside so its ready screen can scan later
  await btn('Not now').click();
  await T('Incoming only').waitFor({ timeout: 5000 });
  await btn('Back').first().click();
  // A: ack-wait (12 s) elapses -> sent card becomes a QR
  await T('Show this code to Ben').waitFor({ timeout: 16000 });
  // B scans it: same enactment, record already exists (idempotent)
  await page.getByRole('button', { name: 'Scan code' }).nth(0).click(); // B is the only ready device now
  await T('the one record already exists (idempotent)').waitFor({ timeout: 8000 });
  await promptToMutual();
  await reset();
});

await run('S12 cancel scanner: no traffic, clean return', async () => {
  await scanA();
  await btn('Cancel').click();                       // before the 2.5 s auto-capture
  await page.getByRole('button', { name: 'Scan code' }).first().waitFor({ timeout: 4000 });
  await page.waitForTimeout(2600);                   // auto-capture must NOT fire late
  if (!(await T('Nothing on the channel yet').isVisible())) throw new Error('traffic appeared after cancel');
  if (await confirmScreen().isVisible()) throw new Error('stale auto-capture fired after cancel');
});

await run('S13 reset hygiene: everything back to zero', async () => {
  await happyToPrompt();
  await promptToMutual();
  await reset();
  for (const title of ['Enactment records', 'Credentials issued', 'Credentials received', 'Consumed challenges']) {
    for (const d of [0, 1]) {
      const got = await badge(title, d);
      if (got !== '0') throw new Error(`${title} device${d} not reset: ${got}`);
    }
  }
});

console.log('\n===== RESULTS =====');
for (const [n, s, note] of results) console.log(s.padEnd(5), n, note ? '— ' + note : '');
const fails = results.filter(r => r[1] === 'FAIL').length;
console.log(`\n${results.length} checks, ${fails} failed`);
await browser.close();
process.exit(fails ? 1 : 0);
