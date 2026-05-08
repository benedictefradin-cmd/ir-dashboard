import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

const errs = [];
page.on('pageerror', e => errs.push('PAGE: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 300)); });

await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
await page.fill('input[placeholder="Identifiant"]', 'admin');
await page.fill('input[placeholder="Mot de passe"]', 'IR2026!');
await page.click('button[type=submit]');
await page.waitForSelector('.nav-item', { timeout: 15000 });
await page.waitForTimeout(3000);

await page.screenshot({ path: '/tmp/dashboard-default.png', fullPage: false });

const visibleText = await page.evaluate(() => document.body.innerText.slice(0, 1000));
const mainHasContent = await page.evaluate(() => {
  const main = document.querySelector('main.main-content');
  return main ? main.innerText.length : -1;
});
const activeTab = await page.evaluate(() => {
  const a = document.querySelector('.nav-item.active .nav-label');
  return a?.textContent?.trim() || null;
});
const lsTab = await page.evaluate(() => localStorage.getItem('ir.activeTab'));

console.log('Active tab (sidebar):', activeTab);
console.log('Tab in localStorage:', lsTab);
console.log('Main content length:', mainHasContent);
console.log('Errors:', errs);
console.log('---VISIBLE TEXT---');
console.log(visibleText);

await browser.close();
