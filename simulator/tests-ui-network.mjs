// UI-Durchlauf des Netzwerk-Simulators (Redesign, UI englisch): Home-Posteingang →
// Vorstellen → Flugmodus → Gruppen/Bürgschaft → Vertrauensakt → Kontinuität →
// WoT-App-Flow (FAB, Scan-Flug, Vollbild-Prompt, Offline-Two-Way-Scan).
import { chromium } from '@playwright/test';
const CHROME = process.env.CHROME_BIN || '/usr/bin/chromium';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 200)));
await page.goto('http://localhost:8199/network.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__probe && window.__probe.ready);

let fails = 0;
const check = (c, m) => { console.log((c ? '✓ ' : '✗ FAIL ') + m); if (!c) fails++; };
const tab = (id, label) => page.locator(`#dev-${id} .pbtn`, { hasText: label }).click();

check(await page.evaluate(() => window.__probe.A.contacts.size === 2), 'Setup: Anton hält Jonathan und Emil (echte Zeremonien, ✓)');

// Home ist der Einstieg: KPI-Zeile aus den Gerätedaten, Posteingang leer
check((await page.locator('#dev-A .kpi .k').count()) === 3, 'Home-Tab ist Default: KPI-Zeile (Contacts · Groups · Open)');
check((await page.locator('#dev-A .sect', { hasText: 'Waiting for you' }).count()) === 0, 'Home: leerer Posteingang wird ausgeblendet');

// Vorstellen: Antons Phone → Contacts → Emil → Detail → Introduce… → Jonathan
await tab('A', 'Contacts');
await page.locator('#dev-A .prow', { hasText: 'Emil' }).click();
await page.locator('#dev-A .profact button', { hasText: 'Introduce…' }).waitFor();
check(true, 'Kontakt-Detail: „Introduce…"-Button ist da');
check((await page.locator('#dev-A .sect', { hasText: 'Shared groups' }).count()) === 0, 'Kontakt-Detail: leere Sektionen ausgeblendet');
await page.locator('#dev-A .profact button', { hasText: 'Introduce…' }).click();
await page.locator('#dev-A .phdlg .prow', { hasText: 'Jonathan' }).click();
await page.locator('#dev-A .phdlg-card', { hasText: 'to each other?' }).waitFor();
check(true, 'Einweg-Tür: Bestätigungs-Sheet IM Phone');
await page.locator('#dev-A .phdlg-btns button', { hasText: /^Introduce$/ }).click();
await page.waitForFunction(() => window.__probe.wire.length === 2);
check(true, 'Antons EIN Akt: zwei versiegelte Angebote auf dem Draht');

// Flugmodus über den Netz-Toggle
await page.locator('#dev-A .devctls .devbtn').first().click();
await page.waitForFunction(() => window.__probe.A.online === false);
check((await page.locator('#dev-A .phone-screen.off').count()) === 1, 'Anton im Flugmodus (Screen zeigt ✈ offline)');

// Jonathan: eingehende Vorstellung im HOME-Posteingang → Connect
await page.locator('#dev-J .incoming .iq', { hasText: 'connect you with Emil' }).waitFor();
check(true, 'Jonathan sieht die Vorstellung im Home-Posteingang („Waiting for you")');
await page.locator('#dev-J .incoming .yes').click();
await page.locator('#dev-J .sentrow', { hasText: 'waiting for the other side' }).waitFor();
check((await page.locator('#dev-J .sect', { hasText: 'Waiting for them' }).count()) === 1
  && (await page.locator('#dev-J .sect', { hasText: 'Waiting for you' }).count()) === 0, 'Richtungs-Ehrlichkeit: der Wartezustand steht unter „Waiting for them", nicht „for you"');

// PASSIVER EMPFANG über Emils eigenen Sync-Tick
await tab('E', 'Contacts');
await page.locator('#dev-E .prow', { hasText: 'Jonathan' }).waitFor({ timeout: 8000 });
check(await page.evaluate(() => [...window.__probe.E.contacts.values()].some(c => c.name === 'Jonathan' && c.state === '◇')), 'Emil hält Jonathans Karte ◇ VOR seiner Entscheidung (Sync-Tick)');
await tab('E', 'Home');
check((await page.locator('#dev-E .incoming .iq').count()) === 1, 'Emils Prompt ist dabei weiter offen — Empfangen ≠ Zustimmen');

// Emil: Connect → beidseitig ⇄
await page.locator('#dev-E .incoming .yes').click();
await page.waitForFunction(() => [...window.__probe.J.contacts.values()].some(c => c.state === '⇄')
  && [...window.__probe.E.contacts.values()].some(c => c.state === '⇄'));
check(true, 'beide halten einander: ⇄ vorgestellt via Anton');

check(await page.evaluate(() => window.__probe.A.online === false), 'Anton war die ganze Zeit offline');
check(await page.evaluate(() => window.__probe.drop.log.every(e => e.by !== 'Anton')), 'der Drop sah NIE einen Zugriff von Anton');
check(await page.evaluate(() => {
  const jc = [...window.__probe.J.contacts.values()].find(c => c.state === '⇄');
  return jc && jc.voucher && !window.__probe.A.contacts.has(jc.card.anchor);
}), 'Voucher liegt bei; die gekreuzten Anker sind frisch (Anton kennt sie nicht)');

// 🗂 Wallet in der App: Profile → „My data"
await page.locator('#dev-J .wcat button', { hasText: 'Introductions' }).click();
await page.locator('#dev-J .witem .wtitle', { hasText: 'voucher · about Emil' }).waitFor();
check(true, 'Artefakt-Panel unter dem Gerät: Introductions öffnet — Voucher über Emil mit JSON');
check((await page.locator('#dev-J .witem .wtitle', { hasText: 'released card · for Emil' }).count()) === 1, 'Wallet: die freigegebene eigene Karte liegt unter Sent');
await page.locator('#dev-J .wchip', { hasText: 'Sent' }).click();
check((await page.locator('#dev-J .witem .wtitle', { hasText: 'voucher' }).count()) === 0, 'Wallet-Filter Sent: empfangene Artefakte ausgeblendet');
await page.locator('#dev-J .wchip', { hasText: 'All' }).click();
check(true, 'Artefakt-Ebene liegt außerhalb des Geräts — kein Navigieren nötig');

// Kontakt-Detail des vorgestellten Kontakts: Meta-Zeile Rang 2 + Voucher
await tab('J', 'Contacts');
await page.locator('#dev-J .prow', { hasText: 'Emil' }).click();
await page.locator('#dev-J .pmeta', { hasText: 'introduced via Anton' }).waitFor();
check((await page.locator('#dev-J .pmeta', { hasText: 'not yet verified' }).count()) >= 1, 'Meta-Zeile Rang 2: Zustandserklärung mit Kontinuitäts-Pfad');
check((await page.locator('#dev-J .profmeta', { hasText: 'introduction-voucher@2' }).count()) === 1, 'Kontakt-Detail: Akt-Voucher sichtbar');
check((await page.locator('#dev-J .profact button', { hasText: 'Invite to group' }).count()) === 1, 'Kontakt-Detail: „Invite to group…"-Aktion vorhanden');

// ⇄ vorgestellt: Vertrauensakt erlaubt — Sheet nennt die Vermittler-Abhängigkeit
await page.locator('#dev-J .profact button.trust', { hasText: 'Trust…' }).click();
await page.locator('#dev-J .phdlg-card', { hasText: 'Not yet verified' }).waitFor();
check((await page.locator('#dev-J .phdlg-card', { hasText: 'introduced via Anton' }).count()) === 1, '⇄ vorgestellt: Akt erlaubt, Sheet benennt die Vermittler-Abhängigkeit');
await page.locator('#dev-J .phdlg-btns button', { hasText: 'Cancel' }).click();

// Badge-Grammatik
await page.locator('#dev-J .backbtn').click();
await tab('A', 'Contacts');
check((await page.locator('#dev-A .pbadge.mutual', { hasText: '⇄ verified' }).count()) === 2, 'Antons Zeremonie-Kontakte tragen das blaue ⇄-verified-Badge');
check((await page.locator('#dev-J .pbadge.byme', { hasText: '⇄ introduced' }).count()) === 1, 'Jonathans Emil trägt das amber ⇄-introduced-Badge');
check((await page.locator('#dev-J .pmeta', { hasText: 'first real meeting' }).count()) >= 1, 'Meta-Zeile benennt den Kontinuitäts-Pfad zu ✓');

// Tabs + Statusleiste
// Anton ist hier im Flugmodus: seine Zeile sagt das, statt den Namen zu
// überlagern — bei einem Online-Gerät steht dort der Inhaber
check((await page.locator('#dev-J .phone-status .st-owner').textContent()) === 'Jonathan'
  && (await page.locator('#dev-A .phone-status .st-owner').textContent()).includes('offline'),
  'Statusleiste oben rechts: Inhabername — offline ERSETZT ihn, statt ihn zu überlagern');
await tab('J', 'Profile');
await page.locator('#dev-J .profhead .pname', { hasText: 'Jonathan' }).waitFor();
check((await page.locator('#dev-J .sentrow', { hasText: 'root seed' }).count()) === 1, 'Profil-Tab: eigene Identität aus den Gerätedaten (Anker + Backup-Zeile)');
await tab('J', 'Groups');
check((await page.locator('#dev-J .pempty', { hasText: 'no groups yet' }).count()) === 1, 'Gruppen-Tab: ehrlich leer');
await tab('J', 'Contacts');
await page.locator('#dev-J .prow', { hasText: 'Emil' }).waitFor();
check(true, 'Kontakte-Tab: zurück zur Kontaktliste');

// ── Stage C: Jonathan gründet die Untergruppe und lädt Emil ein ─────────
await tab('J', 'Groups');
await page.locator('#dev-J .profact button', { hasText: 'Found a group' }).click();
await page.locator('#gname-J').fill('Orga-Untergruppe');
await page.locator('#dev-J .phdlg-btns button', { hasText: /^Found$/ }).click();
await page.locator('#dev-J .prow .pname2', { hasText: 'Orga-Untergruppe' }).waitFor();
check(await page.evaluate(() => window.__probe.J.groups.size === 1), 'Gründung: Genesis + Founder-Member-Anker, Gruppe im Tab');

await page.locator('#dev-J .prow', { hasText: 'Orga-Untergruppe' }).click();
await page.locator('#dev-J .profact button', { hasText: 'Invite a member' }).click();
await page.locator('#dev-J .phdlg .prow', { hasText: 'Emil' }).click();
// Prelude → Reply → Invite laufen automatisch über die Kanäle
await tab('E', 'Home');
await page.locator('#dev-E .incoming .iq', { hasText: 'invites you to "Orga-Untergruppe"' }).waitFor({ timeout: 8000 });
check(true, 'Emil sieht die geprüfte Einladung im Home-Posteingang (Prelude-Roundtrip automatisch)');

// Beitritts-Sheet: informierte Entscheidung + Kandidatur-Toggle
await page.locator('#dev-E .incoming .yes', { hasText: 'Join…' }).click();
await page.locator('#dev-E .phdlg-card', { hasText: 'Join "Orga-Untergruppe"?' }).waitFor();
check((await page.locator('#dev-E .phdlg-card', { hasText: 'permanently' }).count()) === 1, 'Beitritts-Sheet: Einweg-Tür benannt („permanently")');
check(await page.evaluate(() => document.getElementById('cand-E')?.checked === true), 'Kandidatur-Toggle: an per Default, abwählbar');
await page.locator('#dev-E .phdlg-btns button', { hasText: /^Join$/ }).click();
await page.waitForFunction(() => window.__probe.E.groups.size === 1
  && [...window.__probe.J.groups.values()][0].roster.size === 2);
check(true, 'Accept → Admission → Welcome: beide halten die Gruppe, Roster = 2');
check(await page.evaluate(() => {
  const g = [...window.__probe.J.groups.values()][0];
  return [...g.roster.values()].some(m => m.candidacy === true);
}), 'Kandidatur = echtes Protokollfeld: candidacy=true liegt in Jonathans Roster');

await tab('E', 'Groups');
await page.locator('#dev-E .prow', { hasText: 'Orga-Untergruppe' }).click();
await page.locator('#dev-E .prow .pname2', { hasText: 'Jonathan' }).waitFor();
check((await page.locator('#dev-E .pbadge.trustb', { hasText: 'founder' }).count()) >= 1, 'Emils Gruppen-Detail: Roster mit Founder-Badge');
check((await page.locator('#dev-E .pbadge.byme', { hasText: 'candidacy' }).count()) >= 1, 'Roster zeigt die Kandidatur (amber ⏳)');
check(await page.evaluate(() => {
  const g = [...window.__probe.E.groups.values()][0]
  const rel = [...window.__probe.E.contacts.values()].find(c => c.name === 'Jonathan')
  return g.myMemberCtx.anchor !== rel.channel.own.anchor
}), 'Member-Anker ≠ Beziehungs-Anker (Kontext-Trennung sichtbar in den Daten)');

// Gemeinsame Gruppen: aus den Admission-/Welcome-Daten, beidseitig
await tab('E', 'Contacts');
await page.locator('#dev-E .prow', { hasText: 'Jonathan' }).click();
await page.locator('#dev-E .sect', { hasText: 'Shared groups' }).waitFor();
check((await page.locator('#dev-E .prow', { hasText: 'Orga-Untergruppe' }).count()) === 1, 'Kontakt-Detail (Emil→Jonathan): gemeinsame Gruppe sichtbar');
check(await page.evaluate(() => {
  const jc = [...window.__probe.J.contacts.values()].find(c => c.name === 'Emil');
  return Array.isArray(jc.sharedGroups) && jc.sharedGroups.length === 1;
}), 'Und die Gegenseite: Jonathans Emil trägt dieselbe gemeinsame Gruppe');

// Wallet: Membership-Kategorie mit Genesis
await page.locator('#dev-J .wcat button', { hasText: 'Membership' }).click();
await page.locator('#dev-J .witem .wtitle', { hasText: 'genesis · Orga-Untergruppe' }).waitFor();
check(true, 'Wallet (Jonathan): Genesis unter Membership');
check(await page.evaluate(() => window.__probe.A.groups.size === 0), 'Anton (Vermittler) hält NICHTS von der Gruppe');

// ── Stufe 2: der explizite Vertrauensakt (Einweg-Tür, DV) ───────────────
await page.locator('#dev-A .devctls .devbtn').first().click(); // Anton zurück ans Netz
await page.waitForFunction(() => window.__probe.A.online === true);

await tab('A', 'Contacts');
await page.locator('#dev-A .prow', { hasText: 'Jonathan' }).click();
await page.locator('#dev-A .profact button.trust', { hasText: 'Trust…' }).waitFor();
check(true, 'Kontakt-Detail (✓): grüner „Trust…"-Button');
await page.locator('#dev-A .profact button.trust').click();
await page.locator('#dev-A .phdlg-card', { hasText: 'Trust Jonathan permanently?' }).waitFor();
check((await page.locator('#dev-A .phdlg-card', { hasText: 'one way' }).count()) === 1, 'Vertrauens-Sheet: Einweg-Tür + Abstreitbarkeit benannt');
await page.locator('#dev-A .phdlg-btns button', { hasText: /^Trust$/ }).click();
await page.locator('#dev-J .toast', { hasText: 'trusts you now' }).waitFor({ timeout: 6000 });
check(true, 'Toast-Konzept: passives Ereignis („Anton trusts you now") als Toast, keine Entscheidung nötig');
await page.waitForFunction(() => {
  const j = [...window.__probe.J.contacts.values()].find(c => c.name === 'Anton');
  return j && j.trustReceived && j.selfAnchor;
});
check(true, 'Jonathan hält Antons stabilen Anker — Mapping mit eigenen Geheimnissen VERIFIZIERT');
check((await page.locator('#dev-A .pbadge.trustb', { hasText: '→ you trust' }).count()) === 1, 'Antons Badge: → you trust (Richtung, einseitig)');
await tab('J', 'Contacts');
check((await page.locator('#dev-J .pbadge.trustb', { hasText: '← trusts you' }).count()) === 1, 'Jonathans Badge: ← trusts you (empfangen ≠ erwidert)');

// Jonathan erwidert → beidseitig + Sterne fließen
await page.locator('#dev-J .prow', { hasText: '⇄ verified' }).click(); // Antons Zeile
await page.locator('#dev-J .profact button.trust').click();
await page.locator('#dev-J .phdlg-btns button', { hasText: /^Trust$/ }).click();
await page.waitForFunction(() => {
  const a = [...window.__probe.A.contacts.values()].find(c => c.name === 'Jonathan');
  return a && a.trustGiven && a.trustReceived && a.starReceived;
});
check((await page.locator('#dev-A .pbadge.trustb', { hasText: '⇆ trust' }).count()) === 1, 'beidseitig: ⇆ trust — zwei einseitige Akte, keine Automatik');

// Gemeinsame Kontakte: ohne Match bleibt die Sektion ausgeblendet
check((await page.locator('#dev-A .sect', { hasText: 'Mutual contacts' }).count()) === 0, 'keine gemeinsamen prüfbar → Sektion ausgeblendet, nichts gefakt');
check(await page.evaluate(() => {
  const j = [...window.__probe.A.contacts.values()].find(c => c.name === 'Jonathan');
  return j.starInfo && Number(j.starInfo.count) === 1 && j.starInfo.knownNames.length === 0;
}), 'Stern-Daten ehrlich: 1 Kontakt geblendet erhalten, 0 legitim prüfbar');

// Einstellungen: Updates pausieren
await page.locator('#dev-A .sect', { hasText: 'Settings' }).waitFor();
await page.locator('#dev-A .plist .toggle').click();
await page.locator('#dev-A .pmeta', { hasText: 'paused — what was delivered stays' }).waitFor();
check(await page.evaluate(() => [...window.__probe.A.contacts.values()].find(c => c.name === 'Jonathan').trustPaused === true), 'Kontakt-Updates pausiert — Einweg-Tür bleibt offen, nur das Abo stoppt');

// ── Stufe 2: die Bürgschaft (vouch@2, accept-gebunden) ──────────────────
await tab('J', 'Groups');
await page.locator('#dev-J .prow', { hasText: 'Orga-Untergruppe' }).click();
await page.locator('#dev-J .sect', { hasText: 'Candidacies' }).waitFor();
check((await page.locator('#dev-J .pmeta', { hasText: 'your basis: introduced to you' }).count()) === 1, 'Bürgen-Zeile: Herkunft aus dem Kontaktzustand vorbelegt');
await page.locator('#dev-J button', { hasText: /^Vouch$/ }).click();
await page.waitForFunction(() => {
  const g = [...window.__probe.E.groups.values()][0];
  return g && g.candidacyFulfilled === true;
});
check(true, 'Kandidat prüft die Bürgschaft (Roster, accept-Bindung, Proofs) — Schwelle erreicht');
await page.locator('#dev-J .sentrow', { hasText: 'you vouched for Emil (introduced)' }).waitFor();
check(true, 'Bürgen-Journal mit selbst-attestierter Herkunft');
await tab('E', 'Groups');
await page.locator('#dev-E .prow', { hasText: 'Orga-Untergruppe' }).click();
await page.locator('#dev-E .prow .pname2', { hasText: 'Jonathan' }).waitFor();
check((await page.locator('#dev-E .pbadge.byme', { hasText: 'candidacy' }).count()) === 0, 'Kandidatur erfüllt — das Warte-Badge fällt');

// Wallet: Trust-Kategorie
await page.locator('#dev-J .wcat button', { hasText: 'Trust' }).click();
await page.locator('#dev-J .witem .wtitle', { hasText: 'anchor-mapping · from Anton' }).waitFor();
check((await page.locator('#dev-J .witem .wtitle', { hasText: 'contact update · from Anton' }).count()) === 1, 'Wallet Trust: Mapping (abstreitbar) + geblendeter Stern');

// ── Kontinuität (§6a): die Vorstellungs-Dublette wird GEKETTET ──────────
await tab('J', 'Contacts');
await page.locator('#dev-J .prow', { hasText: '⇄ introduced' }).click(); // Emils Zeile
await page.locator('#dev-J .profact button', { hasText: 'Introduce…' }).click();
await page.locator('#dev-J .phdlg .prow', { hasText: 'Anton' }).click();
await page.locator('#dev-J .phdlg-btns button', { hasText: /^Introduce$/ }).click();

// Antons Prompt trägt die Herkunft des Vermittlers
await tab('A', 'Home');
await page.locator('#dev-A .incoming .iq', { hasText: 'connect you with Emil' }).waitFor({ timeout: 8000 });
check((await page.locator('#dev-A .incoming .ih b', { hasText: 'only introduced to' }).count()) === 1, 'Ketten-Offerte: Herkunft des Vermittlers sichtbar');
await page.locator('#dev-A .incoming .yes').click();
await tab('E', 'Home');
await page.locator('#dev-E .incoming .iq', { hasText: 'connect you with Anton' }).waitFor({ timeout: 8000 });
await page.locator('#dev-E .incoming .yes').click();

await page.waitForFunction(() => {
  const act = (p) => [...p.contacts.values()].filter(c => !c.deactivated);
  const aE = act(window.__probe.A).find(c => c.name === 'Emil');
  const eA = act(window.__probe.E).find(c => c.name === 'Anton');
  return act(window.__probe.A).length === 2 && act(window.__probe.E).length === 2
    && aE?.chain?.length === 1 && eA?.chain?.length === 1 && aE.state === '✓';
}, { timeout: 15000 });
check(true, 'Probe + Mapping: Dublette gekettet — beide halten GENAU EINEN Kontakt füreinander');
await tab('A', 'Contacts');
check((await page.locator('#dev-A .prow .pname2', { hasText: 'Emil' }).count()) === 1, 'Antons Liste: ein Emil, ✓ bleibt ✓');
await page.locator('#dev-A .prow', { hasText: 'Emil' }).click();
await page.locator('#dev-A .profmeta', { hasText: 'continuity: 2 enactments' }).waitFor();
check(true, 'Kontakt-Detail: die Kette ist Beziehungsgeschichte');
check(await page.evaluate(() => window.__probe.wire.some(w => w.kind.startsWith('continuity-probe/0.1'))
  && window.__probe.wire.some(w => w.kind.startsWith('continuity-mapping/0.1'))), 'auf dem Draht: geblendete Probe + Doppel-MAC-Mapping, versiegelt');

// ── Der WoT-App-Flow: FAB → Connect-Screen → Scan-Flug → Vollbild-Prompt ─
// Negativ zuerst: scannen, wenn niemand einen Code zeigt
await page.locator('#dev-J .fab').click();
await page.locator('#dev-J .phone-screen', { hasText: 'Show your code or scan' }).waitFor();
check(true, 'FAB öffnet den Connect-Screen (Live-App-Layout): eigener Code + Scan');
await page.locator('#dev-J .phone-screen button', { hasText: 'Scan code' }).click();
await page.locator('#dev-J .phdlg-card', { hasText: 'No code in view' }).waitFor();
check(true, 'Scannen ohne gezeigten Code: ehrlicher Leerlauf');
await page.locator('#dev-J .phdlg-btns button', { hasText: 'Ok' }).click();

// Emil zeigt seinen Code, Jonathan scannt — das Phone fliegt und kehrt zurück
await page.locator('#dev-E .fab').click();
await page.locator('#dev-E .phone-screen', { hasText: 'Show your code or scan' }).waitFor();
await page.locator('#dev-J .phone-screen button', { hasText: 'Scan code' }).click();
await page.locator('#dev-J .phone-screen', { hasText: 'camera — carries no traffic' }).waitFor();
check(true, 'Scanner läuft: Durchguck-Sucher, Kamera erkennt automatisch');
await page.locator('#dev-J .phone-screen', { hasText: 'Are you standing in front of this person?' }).waitFor({ timeout: 10000 });
check((await page.locator('#dev-J .phone-screen', { hasText: 'Emil' }).count()) >= 1, 'nach dem Rückflug: die gescannte Person wird angezeigt');
await page.locator('#dev-J .phone-screen button', { hasText: /^Confirm$/ }).click();
await page.locator('#dev-J .phone-screen', { hasText: 'Arrived on' }).waitFor({ timeout: 8000 });
check(await page.evaluate(() => {
  const em = [...window.__probe.J.contacts.values()].filter(c => !c.deactivated).find(c => c.name === 'Emil' && c.state === '→');
  return !!em;
}), 'Jonathans Bestätigung: Credential ausgestellt + zugestellt — Zustand ehrlich → (einseitig)');

// Emil bekommt den VOLLBILD-Prompt (wie App + Zeremonie-Sim), keinen Toast
await page.locator('#dev-E .phone-screen', { hasText: 'Verify Jonathan back?' }).waitFor({ timeout: 8000 });
check((await page.locator('#dev-E .phone-screen', { hasText: 'Arrival is not acceptance' }).count()) === 1, 'Vollbild-Prompt beim Empfänger: „Verify Jonathan back?" — Ankunft ≠ Annahme');
await page.locator('#dev-E .phone-screen button', { hasText: /^Confirm$/ }).click();
await page.locator('#dev-J .cdlg', { hasText: 'You and Emil have now verified each other' }).waitFor({ timeout: 8000 });
check((await page.locator('#dev-J .cdlg .avpair .av').count()) === 2, 'Feier-Dialog MITTIG: beide Avatare + „verified each other" — nicht „friends"');
await page.waitForFunction(() => {
  const act = (p) => [...p.contacts.values()].filter(c => !c.deactivated);
  const em = act(window.__probe.J).find(c => c.name === 'Emil');
  const jo = act(window.__probe.E).find(c => c.name === 'Jonathan');
  return em?.state === '✓' && jo?.state === '✓' && em.chain?.length === 1 && act(window.__probe.J).length === 2;
}, { timeout: 15000 });
check(true, 'Kapitel 2 live: ⇄ vorgestellt → ✓ verifiziert, §6a-Probe kettet — EIN Emil');

// Der Vertrauensakt wird im Erfolgsmoment ANGEBOTEN, nie automatisch
await page.locator('#dev-J .cdlg button', { hasText: 'Trust…' }).click();
await page.locator('#dev-J .phdlg-card', { hasText: 'Trust Emil permanently?' }).waitFor();
check((await page.locator('#dev-J .phdlg-card', { hasText: 'Not yet verified' }).count()) === 0, 'Vertrauens-Sheet ohne Vermittler-Hinweis — jetzt verifiziert');
await page.locator('#dev-J .phdlg-btns button', { hasText: /^Trust$/ }).click();
await page.waitForFunction(() => {
  const eJ = [...window.__probe.E.contacts.values()].filter(c => !c.deactivated).find(c => c.name === 'Jonathan');
  return eJ && eJ.trustReceived && eJ.selfAnchor;
});
await page.locator('#dev-E .cdlg button', { hasText: 'Later' }).click(); // Emils Feier-Dialog: Later merkt nichts vor
await tab('E', 'Contacts');
check((await page.locator('#dev-E .pbadge.trustb', { hasText: '← trusts you' }).count()) === 1, 'und Emil sieht es: ← trusts you — der Kreis ist geschlossen');

// ── Offline: der automatische Two-Way-Scan (Re-Verifikation J ⇠⇢ A) ────
await page.locator('#dev-A .devctls .devbtn').first().click(); // Anton in den Flugmodus
await page.waitForFunction(() => window.__probe.A.online === false);
await page.locator('#dev-A .fab').click();            // Anton zeigt (optisch geht offline)
await page.locator('#dev-A .phone-screen', { hasText: 'Show your code or scan' }).waitFor();
await page.locator('#dev-J .fab').click();
await page.locator('#dev-J .phone-screen button', { hasText: 'Scan code' }).click();
await page.locator('#dev-J .phone-screen', { hasText: 'Are you standing in front of this person?' }).waitFor({ timeout: 10000 });
await page.locator('#dev-J .phone-screen button', { hasText: /^Confirm$/ }).click();
await page.locator('#dev-J .phone-screen', { hasText: 'Sent to Anton' }).waitFor({ timeout: 8000 });
check(true, 'Gegenseite offline: Zustellung wartet — Zustellzeit unbeschränkt');
await page.locator('#dev-J .phone-screen', { hasText: 'Show this code to Anton' }).waitFor({ timeout: 12000 });
check(true, 'Ack-Wartezeit verstrichen: automatischer Wechsel auf den Two-Way-Scan');
await page.locator('#dev-A .phone-screen button', { hasText: 'Scan code' }).click();
await page.locator('#dev-A .phone-screen', { hasText: 'Verify Jonathan back?' }).waitFor({ timeout: 10000 });
check((await page.locator('#dev-A .phone-screen', { hasText: 'two-way scan' }).count()) >= 1, 'Anton scannt das Bundle: Vollbild-Prompt, dieselbe Begegnung optisch übernommen');
await page.locator('#dev-A .phone-screen button', { hasText: /^Confirm$/ }).click();
await page.waitForFunction(() =>
  [...window.__probe.A.contacts.values()].some(c => !c.deactivated && c.name === 'Jonathan' && c.state === '→')
  && (window.__probe.A.pendingDocs?.length ?? 0) === 1, { timeout: 8000 });
check(true, 'offline bestätigt: ehrlich einseitig, Gegen-Credential wartet auf Netz');
await page.locator('#dev-A .devctls .devbtn').first().click(); // Anton zurück ans Netz
await page.waitForFunction(() => {
  const act = (p) => [...p.contacts.values()].filter(c => !c.deactivated);
  const jo = act(window.__probe.A).find(c => c.name === 'Jonathan');
  const an = act(window.__probe.J).find(c => c.name === 'Anton');
  return jo?.state === '✓' && an?.state === '✓' && act(window.__probe.A).length === 2 && act(window.__probe.J).length === 2;
}, { timeout: 20000 });
check(true, 'Netz zurück: Credentials fließen nach, Probe kettet die Re-Verifikation — beidseitig ✓, keine Dublette');

// ── Baustein 7: Delivery-Stufen sichtbar + Fault-Injection ──────────────
check(await page.evaluate(() => window.__probe.wire.some(w => (w.stages?.length ?? 0) >= 5 && w.disp === 'unique')),
  'Draht-Panel: jede Zustellung trägt die Contract-Stufen 1–4 + Dispatch (Port aus dem Zeremonie-Sim)');
check((await page.locator('.fbtn').count()) === 4, 'Fault-Panel: hold · dup · tamper · lose');

// dup-Fault: A vertraut Emil — die Zustellung läuft doppelt, der
// completed-effect-Cache antwortet duplicate-known (kein zweiter Effekt)
await page.locator('.fbtn', { hasText: 'Deliver everything twice' }).click();
await page.locator('#dev-A .cdlg button', { hasText: 'Done' }).click(); // Feier-Dialog der Re-Verifikation schließen
await tab('A', 'Contacts');
await page.locator('#dev-A .prow', { hasText: 'Emil' }).click();
await page.locator('#dev-A .profact button.trust').click();
await page.locator('#dev-A .phdlg-btns button', { hasText: /^Trust$/ }).click();
await page.waitForFunction(() => window.__probe.wire.some(w => w.kind.includes('DUPLICATE (fault)') && w.disp === 'duplicate-known'), { timeout: 8000 });
check(true, 'dup-Fault: zweite Zustellung → duplicate-known, prior outcome applies — kein zweiter Effekt');
check(await page.evaluate(() => {
  const e = [...window.__probe.E.contacts.values()].filter(c => !c.deactivated).find(c => c.name === 'Anton');
  return e && e.trustReceived && e.selfAnchor;
}), 'der Effekt selbst kam genau einmal an: Emil hält Antons Offenlegung');
await page.locator('.fbtn', { hasText: 'Deliver everything twice' }).click();

// ── Baustein 8: die Sim-Uhr — laufen, altern, driften ───────────────────
check((await page.locator('.clockbar .rbtn').count()) === 4
  && (await page.locator('.devctls .devbtn').count()) === 6, 'Zeitsteuerung aufgeteilt: Weltzeit + Raffer im Kopf, Drift-Knopf an JEDEM Gerät');
check((await page.locator('.stored').count()) === 3, 'Artefakt-Ebene: ein Panel unter jedem Gerät (außerhalb der App)');

// Skew ist geräte-relativ und sofort in der Statusleiste sichtbar
const clockOf = (id) => page.locator(`#dev-${id} .phone-status span`).first().textContent();
const beforeSkew = await clockOf('A');
await page.locator('#dev-A .devctls .devbtn:last-child').click();
check((await clockOf('A')) !== beforeSkew && (await clockOf('A')) !== (await clockOf('J')),
  'Skew: Antons Gerät liest eine andere Uhr als Jonathans — Drift ist der Normalfall');
await page.locator('#dev-A .devctls .devbtn:last-child').click();
await page.locator('#dev-A .devctls .devbtn:last-child').click(); // zurück auf ±0 (zyklisch wie im Zeremonie-Sim)

// Alterung wird echt: der gezeigte Code rotiert bei PT5M von selbst
// (offene Dialoge zuerst schließen — der FAB weicht ihnen)
for (const sel of ['#dev-J .cdlg button', '#dev-J .phdlg-btns button']) {
  const b = page.locator(sel).first();
  if (await b.count()) await b.click();
}
await page.locator('#dev-J .fab').waitFor({ timeout: 8000 });
await page.locator('#dev-J .fab').click();
const shown = await page.evaluate(() => window.__probe.shows.J.ctx.anchor);
await page.locator('.rbtn', { hasText: '600×' }).click();
await page.waitForFunction((a) => window.__probe.shows?.J?.ctx.anchor !== a, shown, { timeout: 20000 });
check(await page.evaluate(() => window.__probe.J.log.some(l => l.includes('rotated by itself'))),
  'laufende Zeit: der gezeigte Code erreicht PT5M und prägt sich neu — Anzeige rotiert, Retention bleibt');
await page.locator('.rbtn', { hasText: 'paused' }).click();
check(await page.evaluate(() => window.__probe.J.showLog.size >= 2),
  'das Show-Log hält beide Challenges auflösbar (5.3: rotation changes what is displayed, never what is retained)');

console.log(fails ? `\n${fails} FAILED` : '\nNETZWERK-UI-DURCHLAUF (APP-FLOW + DELIVERY + SIM-UHR) BESTANDEN');
await browser.close();
process.exit(fails ? 1 : 0);
