import { chromium } from 'playwright';

const URL = 'https://benedictefradin-cmd.github.io/ir-dashboard/';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

const events = [];
page.on('pageerror', e => events.push('PAGEERR: ' + e.message + '\n  ' + (e.stack || '').split('\n').slice(0, 3).join('\n  ')));
page.on('console', m => {
  const t = m.type();
  if (t === 'error' || t === 'warning') events.push(`CONSOLE[${t}]: ` + m.text().slice(0, 500));
});
page.on('response', r => {
  const s = r.status();
  if (s >= 400) events.push(`HTTP ${s} ${r.url()}`);
});
page.on('requestfailed', r => events.push(`REQFAIL ${r.url()}: ${r.failure()?.errorText}`));

await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

console.log('=== ATTEMPTING LOGIN ===');
await page.fill('input[placeholder="Identifiant"]', 'admin');
await page.fill('input[placeholder="Mot de passe"]', 'IR2026!');
await page.click('button[type=submit]');

// Sample DOM at multiple timestamps to catch the "disappears" symptom
for (const t of [500, 1500, 3000, 6000, 10000, 15000]) {
  await page.waitForTimeout(t === 500 ? 500 : t - (t === 1500 ? 500 : (t === 3000 ? 1500 : (t === 6000 ? 3000 : (t === 10000 ? 6000 : 10000)))));
  const snap = await page.evaluate(() => {
    const root = document.getElementById('root');
    return {
      hasSidebar: !!document.querySelector('.sidebar'),
      hasLogin: !!document.querySelector('.login-card'),
      bodyLen: document.body.innerText.length,
      rootLen: root?.innerHTML.length || 0,
    };
  });
  console.log(`t=${t}ms sidebar=${snap.hasSidebar} login=${snap.hasLogin} body=${snap.bodyLen} root=${snap.rootLen}`);
}

console.log('\n=== EVENTS ===');
events.forEach(e => console.log(e));

await browser.close();
