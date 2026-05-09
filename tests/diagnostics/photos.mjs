import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

const photoCalls = [];
page.on('response', async (resp) => {
  const u = resp.url();
  if (u.includes('/api/github/contents/') && u.includes('binary=1')) {
    photoCalls.push({ url: u, status: resp.status() });
  }
});

const errs = [];
page.on('pageerror', e => errs.push('PAGE: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 300)); });

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
const needsLogin = await page.locator('input[placeholder="Identifiant"]').count();
if (needsLogin) {
  await page.fill('input[placeholder="Identifiant"]', 'admin');
  await page.fill('input[placeholder="Mot de passe"]', 'IR2026!');
  await page.click('button[type=submit]');
  await page.waitForSelector('.nav-item', { timeout: 15000 });
}

// Go to Profils
const profilsTab = page.locator('.nav-item', { hasText: 'Profils' }).first();
await profilsTab.click();
await page.waitForTimeout(2500);

// Inspect the auteurs in app state via the React props on cards
const stats = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('.auteur-card-v2'));
  return {
    cardCount: cards.length,
    withImg: cards.filter(c => !!c.querySelector('img')).length,
    withFallback: cards.filter(c => !c.querySelector('img')).length,
    sample: cards.slice(0, 8).map(c => ({
      name: c.querySelector('.auteur-card-name')?.innerText,
      hasImg: !!c.querySelector('img'),
      imgSrcStart: c.querySelector('img')?.src?.slice(0, 40) || null,
    })),
  };
});

// Count by status
const byStatus = photoCalls.reduce((acc, p) => { acc[p.status] = (acc[p.status]||0)+1; return acc; }, {});

console.log('Card count:', stats.cardCount);
console.log('With <img>:', stats.withImg);
console.log('With fallback (no img):', stats.withFallback);
console.log('Photo API calls:', photoCalls.length, 'by status:', byStatus);
console.log('Sample cards:');
console.log(JSON.stringify(stats.sample, null, 2));
if (errs.length) console.log('ERRORS:', errs.slice(0,5));

await page.screenshot({ path: '/tmp/profils-diag.png', fullPage: false });

await browser.close();
