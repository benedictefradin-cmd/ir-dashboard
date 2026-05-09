import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
if (await page.locator('input[placeholder="Identifiant"]').count()) {
  await page.fill('input[placeholder="Identifiant"]', 'admin');
  await page.fill('input[placeholder="Mot de passe"]', 'IR2026!');
  await page.click('button[type=submit]');
  await page.waitForSelector('.nav-item', { timeout: 15000 });
}

const result = await page.evaluate(async () => {
  const workerUrl = localStorage.getItem('ir.workerUrl') || 'https://ir-dashboard-api.institut-rousseau.workers.dev';
  const headers = { 'Content-Type': 'application/json' };
  const sessionToken = localStorage.getItem('ir.session') || localStorage.getItem('ir.authToken');
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;

  const list = async (path) => {
    const r = await fetch(`${workerUrl}/api/github/list/${encodeURI(path)}`, { headers });
    if (!r.ok) return { error: `${r.status}`, path };
    const data = await r.json();
    return data.items || [];
  };

  const [equipe, auteurs] = await Promise.all([
    list('assets/images/equipe'),
    list('assets/images/auteurs'),
  ]);

  return {
    equipe: Array.isArray(equipe) ? equipe.map(f => f.name).sort() : equipe,
    auteurs: Array.isArray(auteurs) ? auteurs.map(f => f.name).sort() : auteurs,
  };
});

console.log('=== assets/images/equipe ===');
console.log('count:', result.equipe.length || 'ERROR', result.equipe.error || '');
if (Array.isArray(result.equipe)) result.equipe.forEach(n => console.log(' ', n));
console.log();
console.log('=== assets/images/auteurs ===');
console.log('count:', result.auteurs.length || 'ERROR', result.auteurs.error || '');
if (Array.isArray(result.auteurs)) result.auteurs.forEach(n => console.log(' ', n));

await browser.close();
