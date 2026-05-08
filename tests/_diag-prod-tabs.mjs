// Reproduit le bug en simulant chaque onglet sauvé en localStorage.
import { chromium } from 'playwright';

const URL = 'https://benedictefradin-cmd.github.io/ir-dashboard/';
const TABS = [
  'dashboard','articles','evenements','calendrier','presse','profils',
  'newsletter','messagerie','pagessite','accueil','seo','medias',
  'navigation','equipe','technique','sollicitations','settings','editeur','contenu',
];

const browser = await chromium.launch({ headless: true });

for (const tab of TABS) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errs.push('CONSOLE: ' + m.text().slice(0, 200)); });

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 20000 });
  await page.evaluate((t) => localStorage.setItem('ir-dash-active-tab', JSON.stringify(t)), tab);
  await page.fill('input[placeholder="Identifiant"]', 'admin');
  await page.fill('input[placeholder="Mot de passe"]', 'IR2026!');
  await page.click('button[type=submit]');
  await page.waitForTimeout(3000);

  const root = await page.evaluate(() => document.getElementById('root')?.innerHTML?.length || 0);
  const visible = await page.evaluate(() => document.body.innerText.length);
  const hasSidebar = await page.evaluate(() => !!document.querySelector('.sidebar'));
  const status = errs.length ? 'CRASH' : (root < 200 ? 'BLANK' : (hasSidebar ? 'OK' : 'NO_SIDEBAR'));
  console.log(`${tab.padEnd(15)} ${status.padEnd(12)} root=${root} body=${visible} ${errs.length ? '|| ' + errs.join(' | ').slice(0, 200) : ''}`);

  await ctx.close();
}

await browser.close();
