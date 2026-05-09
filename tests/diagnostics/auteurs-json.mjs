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

// Read auteurs.json via the worker (using current session token)
const result = await page.evaluate(async () => {
  const tokenItem = Object.keys(localStorage).find(k => k.startsWith('ir.session') || k === 'ir.token' || k === 'ir.authToken');
  let token = null;
  for (const k of Object.keys(localStorage)) {
    const v = localStorage.getItem(k);
    if (v && /^[A-Za-z0-9_-]{20,}$/.test(v)) { token = v; }
  }
  // Try fetching with no extra header (the app uses Bearer via gitHubAuthHeaders + maybe session cookie)
  const workerUrl = localStorage.getItem('ir.workerUrl') || 'https://ir-dashboard-api.institut-rousseau.workers.dev';
  const headers = { 'Content-Type': 'application/json' };
  // The app stores the session token; let's just try with no auth and with bearer
  const sessionToken = localStorage.getItem('ir.session') || localStorage.getItem('ir.authToken');
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
  const r = await fetch(`${workerUrl}/api/github/contents/data%2Fauteurs.json`, { headers });
  if (!r.ok) return { error: `${r.status}`, body: await r.text() };
  const data = await r.json();
  // Decode base64 content
  let parsed = [];
  try {
    parsed = JSON.parse(data.content);
  } catch (e) {
    return { error: 'parse: ' + e.message, raw: data.content?.slice(0, 200) };
  }
  const sample = parsed.slice(0, 5);
  const withPhoto = parsed.filter(a => a.photo).length;
  const withoutPhoto = parsed.length - withPhoto;
  return {
    total: parsed.length,
    withPhoto,
    withoutPhoto,
    sample,
    keys: Object.keys(parsed[0] || {}),
  };
});

console.log(JSON.stringify(result, null, 2));

await browser.close();
