import { chromium } from '@playwright/test';
const CHROME = process.env.CHROME_BIN || '/usr/bin/chromium'; // override with CHROME_BIN
const OUT = '/tmp/claude-1000/-home-fritz-workspace-workspace/61309249-b4db-48b6-bb39-6de7ef3b8418/scratchpad';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1480, height: 1100 } });
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 200)));
const T = (t) => page.getByText(t, { exact: false });

await page.goto('http://localhost:8199/index.html', { waitUntil: 'domcontentloaded' });
await T('Verify a person').first().waitFor({ timeout: 15000 });

// 1) BEN scans first and stays in his confirm dialog
await page.getByRole('button', { name: 'Scan code' }).nth(1).click();
await T('Is this the person in front of you?').waitFor({ timeout: 5000 });
console.log('Ben is in his confirm dialog');

// 2) ANNA starts scanning while Ben is mid-dialog
await page.getByRole('button', { name: 'Scan code' }).first().click();
await page.waitForTimeout(700);
// during the scan, Ben must be back on his QR screen
const qrVisible = await T('Show your code, or scan theirs.').isVisible();
if (!qrVisible) { console.log('FAIL: Ben did not jump back to his QR'); process.exit(1); }
console.log('PASS: Ben jumped back to his displayed QR during the scan');
await page.screenshot({ path: OUT + '/borrow-during.png' });

// 3) after the capture both confirm dialogs must coexist (Ben restored)
await page.waitForTimeout(2400);
const dialogs = await page.getByText('Is this the person in front of you?').count();
if (dialogs !== 2) { console.log('FAIL: expected 2 confirm dialogs, got', dialogs); process.exit(1); }
console.log('PASS: Anna captured AND Ben is back in his confirm dialog');
await page.screenshot({ path: OUT + '/borrow-after.png' });

// 4) both confirm: two independent enactments (different bindings), so the
//    HONEST outcome is two prompts, NOT an immediate mutual (F6).
await page.getByRole('button', { name: 'Confirm', exact: true }).first().click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Confirm', exact: true }).first().click();
await T('recognized you').first().waitFor({ timeout: 10000 });
const earlyMutual = await T('are connected!').first().isVisible().catch(() => false);
if (earlyMutual) { console.log('FAIL: two separate enactments wrongly read as mutual'); process.exit(1); }
console.log('PASS: two separate scans stay two prompts, not a false mutual (F6)');

// 5) one side verifies back within its enactment → that enactment becomes mutual
await page.getByRole('button', { name: 'Confirm', exact: true }).first().click();
await T('are connected!').first().waitFor({ timeout: 10000 });
console.log('PASS: verifying back within one enactment reaches mutual');

await browser.close();
