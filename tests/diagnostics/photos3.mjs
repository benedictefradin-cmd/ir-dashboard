import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

const calls = [];
page.on('response', async (resp) => {
  const u = resp.url();
  if (u.includes('/api/github/contents/') && u.includes('binary=1')) {
    calls.push({ url: u, status: resp.status() });
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
if (await page.locator('input[placeholder="Identifiant"]').count()) {
  await page.fill('input[placeholder="Identifiant"]', 'admin');
  await page.fill('input[placeholder="Mot de passe"]', 'IR2026!');
  await page.click('button[type=submit]');
  await page.waitForSelector('.nav-item', { timeout: 15000 });
}
await page.locator('.nav-item', { hasText: 'Profils' }).first().click();
await page.waitForSelector('.auteur-card-v2', { timeout: 15000 });

// Snapshot rendering progression (3s, 6s, 10s)
const snap = async (t) => {
  await page.waitForTimeout(t);
  const c = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.auteur-card-v2'));
    return { total: cards.length, withImg: cards.filter(c => !!c.querySelector('img')).length };
  });
  return c;
};
const at3s = await snap(3000);
const at6s = await snap(3000);
const at10s = await snap(4000);
console.log('Cards at 3s:', at3s);
console.log('Cards at 6s:', at6s);
console.log('Cards at 10s:', at10s);

const byStatus = calls.reduce((acc, c) => { acc[c.status] = (acc[c.status]||0)+1; return acc; }, {});
const failed = calls.filter(c => c.status >= 400).map(c => decodeURIComponent(c.url.split('/api/github/contents/')[1].split('?')[0]));
const ok = calls.filter(c => c.status < 400);

console.log('Total photo API calls:', calls.length);
console.log('By status:', byStatus);
console.log('OK:', ok.length, 'Failed:', failed.length);
console.log();
console.log('=== FAILED PATHS (first 30) ===');
failed.slice(0, 30).forEach(p => console.log(' ', p));

// Cross-check: how many cards actually rendered <img>?
const visible = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('.auteur-card-v2'));
  return {
    total: cards.length,
    withImg: cards.filter(c => !!c.querySelector('img')).length,
  };
});
console.log();
console.log('Cards visible:', visible);

await browser.close();
