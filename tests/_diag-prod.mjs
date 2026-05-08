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
await page.waitForTimeout(5000);

const bodyText = await page.evaluate(() => document.body.innerText);
const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML?.slice(0, 800) || 'NO ROOT');
const url = page.url();

console.log('URL after login:', url);
console.log('\n=== BODY TEXT (first 800) ===');
console.log(bodyText.slice(0, 800) || '(empty)');
console.log('\n=== ROOT HTML (first 800) ===');
console.log(rootHtml);
console.log('\n=== EVENTS ===');
events.forEach(e => console.log(e));

await browser.close();
