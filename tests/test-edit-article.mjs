#!/usr/bin/env node
// Probe ciblé : login + ouverture d'un article existant + vérif que l'éditeur
// charge le contenu en mode HTML, et compare au résultat d'une extraction
// directe (Node + JSDOM) du même article — round-trip exact attendu.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const BASE = process.argv[2] || 'http://localhost:5173';
const SLUG = process.argv[3] || 'critique-liberale-liberalisme';
const SOURCE_HTML_PATH = `/Users/mb/Documents/GitHub/institut-rousseau/publications/${SLUG}.html`;

const log = (...a) => console.log('•', ...a);
const errs = [];
const pageErrs = [];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

page.on('console', m => {
  if (m.type() !== 'error') return;
  if (m.text().includes('Failed to load resource')) return;
  errs.push(m.text().slice(0, 300));
});
page.on('pageerror', e => pageErrs.push(e.message));

log('goto', BASE);
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });

log('login admin / IR2026!');
await page.fill('input[placeholder="Identifiant"]', 'admin');
await page.fill('input[placeholder="Mot de passe"]', 'IR2026!');
await page.click('button[type=submit]');

try {
  await page.waitForSelector('.nav-item', { timeout: 30000 });
  log('login OK');
} catch (e) {
  console.error('LOGIN FAIL'); await browser.close(); process.exit(1);
}

await page.waitForTimeout(4000);

log('open Publications tab');
await page.click('.nav-item:has-text("Publications")');
await page.waitForTimeout(1500);

await page.waitForTimeout(2500); // laisse DataTable rendre les ~250 lignes

log('locate row for slug:', SLUG);
const editBtn = await page.$(`tr:has(a[href*="/${SLUG}.html"]) button:has-text("Éditer")`);
if (!editBtn) {
  await page.fill('input[placeholder*="Rechercher une publication"]', SLUG.split('-')[0]);
  await page.waitForTimeout(1200);
  const fallback = await page.$('button:has-text("Éditer")');
  if (!fallback) { console.error('No Éditer button'); await browser.close(); process.exit(1); }
  await fallback.click();
} else {
  await editBtn.click();
}
await page.waitForSelector('.modal', { timeout: 5000 });
log('modal opened');

log('wait for content load…');
for (let i = 0; i < 60; i++) {
  const loadingMsg = await page.$('text=Chargement de l\'article depuis le site');
  if (!loadingMsg) break;
  await page.waitForTimeout(500);
}
await page.waitForTimeout(1000);

const tabs = await page.$$eval('.rich-editor-mode-btn', els => els.map(e => e.textContent.trim()));
const activeTab = await page.$eval('.rich-editor-mode-btn.active', e => e.textContent.trim()).catch(() => null);
log('tabs:', tabs.join(' | '), '| active:', activeTab);

// Debug : titre actuellement édité
const editedTitle = await page.$eval('.modal input[value]', el => el.value).catch(() => '?');
log('edited title:', editedTitle);

const bodyHtml = await page.$eval('.code-editor-textarea', el => el.value).catch(() => '');
log('body HTML length:', bodyHtml.length);

// Extraction directe pour comparaison
const source = readFileSync(SOURCE_HTML_PATH, 'utf8');
const dom = new JSDOM(source);
const root = dom.window.document.querySelector('.article-content');
const STRIP = ['.article-hero-img', '.article-author-block', '.article-share',
               '.related-publications', '.article-cta', '#relatedPubs', '.article-back'];
STRIP.forEach(sel => root.querySelectorAll(sel).forEach(el => el.remove()));
const expectedBody = root.innerHTML.trim();
log('expected body length:', expectedBody.length);

const checks = [];
checks.push(['Mode visuel masqué', !tabs.includes('Visuel')]);
checks.push(['Mode HTML actif', activeTab === 'HTML']);
checks.push(['Body chargé (>1000 chars)', bodyHtml.length > 1000]);
checks.push(['Body match extraction directe', bodyHtml === expectedBody]);
checks.push(['<sup> préservés', /<sup>/i.test(bodyHtml)]);
checks.push(['name="_ftn préservés', /name="_ftn/.test(bodyHtml)]);
checks.push(['footnotes-section présent', /footnotes-section/.test(bodyHtml)]);
checks.push(['Pas d\'erreurs JS', pageErrs.length === 0]);

console.log('\n=== Résultats ===');
let pass = true;
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) pass = false;
}
if (!pass && bodyHtml.length > 0) {
  // Trouver première divergence
  let i = 0;
  while (i < Math.min(bodyHtml.length, expectedBody.length) && bodyHtml[i] === expectedBody[i]) i++;
  console.log(`\nDivergence à l'offset ${i}/${Math.max(bodyHtml.length, expectedBody.length)}`);
  console.log('  dashboard:', JSON.stringify(bodyHtml.slice(Math.max(0, i-30), i+80)));
  console.log('  expected :', JSON.stringify(expectedBody.slice(Math.max(0, i-30), i+80)));
}
if (errs.length) {
  console.log('\nConsole errors:');
  errs.slice(0, 5).forEach(e => console.log('  -', e));
}
if (pageErrs.length) {
  console.log('\nPage errors:');
  pageErrs.slice(0, 5).forEach(e => console.log('  -', e));
}

await browser.close();
process.exit(pass ? 0 : 1);
