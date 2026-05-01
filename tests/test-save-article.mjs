#!/usr/bin/env node
// Probe ciblé : ouvrir un article, faire une micro-modification, cliquer
// Sauvegarder, intercepter le POST /api/github/publish et vérifier que le
// HTML produit contient toutes les structures attendues (hero, bio, footnotes,
// related curé, JSON-LD ISO date, etc.).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:5173';
const SLUG = process.argv[3] || 'critique-liberale-liberalisme';
const SOURCE_PATH = `/Users/mb/Documents/GitHub/institut-rousseau/publications/${SLUG}.html`;
const SOURCE = readFileSync(SOURCE_PATH, 'utf8');
const SRC_HAS = {
  hero: SOURCE.includes('article-hero-img'),
  bio: SOURCE.includes('article-author-bio'),
  supBracket: /<sup>\[1\]<\/sup>/.test(SOURCE),
  ftnAnchor: /name="_ftn/.test(SOURCE),
  relatedCurated: SOURCE.includes('class="related-publications"'),
};

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

// Intercepter la requête de publication
let captured = null;
await page.route('**/api/github/publish', async (route) => {
  const req = route.request();
  const body = req.postDataJSON();
  captured = body;
  log('→ INTERCEPTED publish call');
  // Répondre OK sans réellement publier
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, sha: 'fake_sha_test', path: `publications/${body.slug}.html` }),
  });
});
// Intercepter aussi le PUT contents (pour publications-data.js)
await page.route('**/api/github/contents/**', async (route) => {
  if (route.request().method() === 'PUT') {
    log('→ INTERCEPTED contents PUT (publications-data.js)');
    await route.fulfill({ status: 200, contentType: 'application/json',
                          body: JSON.stringify({ sha: 'fake_data_sha' }) });
  } else {
    await route.continue();
  }
});

log('goto', BASE);
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });

await page.fill('input[placeholder="Identifiant"]', 'admin');
await page.fill('input[placeholder="Mot de passe"]', 'IR2026!');
await page.click('button[type=submit]');
await page.waitForSelector('.nav-item', { timeout: 30000 });
await page.waitForTimeout(4000);
log('login OK');

await page.click('.nav-item:has-text("Publications")');
await page.waitForTimeout(2500); // laisse le DataTable rendre les 250+ lignes

// Cible la ligne dont le lien "Voir" pointe vers ce slug — robuste face aux
// accents (le filtre texte de la page ne normalise pas les diacritiques).
log('locate row for slug:', SLUG);
const editBtn = await page.$(`tr:has(a[href*="/${SLUG}.html"]) button:has-text("Éditer")`);
if (!editBtn) {
  // Fallback : recherche par le 1er mot du slug
  await page.fill('input[placeholder*="Rechercher une publication"]', SLUG.split('-')[0]);
  await page.waitForTimeout(1200);
  const fallback = await page.$('button:has-text("Éditer")');
  if (!fallback) { console.error('No Éditer'); await browser.close(); process.exit(1); }
  await fallback.click();
} else {
  await editBtn.click();
}
await page.waitForSelector('.modal', { timeout: 5000 });

log('wait for content load…');
for (let i = 0; i < 60; i++) {
  const m = await page.$('text=Chargement de l\'article depuis le site');
  if (!m) break;
  await page.waitForTimeout(500);
}
await page.waitForTimeout(1500);

// Faire une micro-modif : ajouter un espace en fin de body
log('micro-edit: append space in HTML body');
await page.evaluate(() => {
  const ta = document.querySelector('.code-editor-textarea');
  const orig = ta.value;
  // Trigger React-controlled change
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, orig + ' ');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(500);

log('click Sauvegarder');
await page.click('button:has-text("Sauvegarder")');

// Attendre l'interception
for (let i = 0; i < 30; i++) {
  if (captured) break;
  await page.waitForTimeout(300);
}

if (!captured) {
  console.error('FAIL: aucune requête /api/github/publish capturée');
  await page.screenshot({ path: '/tmp/save-fail.png' });
  await browser.close();
  process.exit(1);
}

const html = captured.html || '';
const meta = captured.metadata || {};
log('captured slug:', captured.slug);
log('captured commit msg:', captured.commitMessage);
log('captured html length:', html.length);

const checks = [];
const cond = (label, present, srcHasFlag) => {
  if (srcHasFlag) checks.push([label + ' (source en a)', present]);
  else checks.push([label + ' (source n\'en a pas → absence OK)', !present]);
};
checks.push(['Slug correct', captured.slug === SLUG]);
cond('Hero figure', html.includes('<figure class="article-hero-img">'), SRC_HAS.hero);
checks.push(['Bloc auteur présent', html.includes('class="article-author-block"')]);
cond('Bio auteur', html.includes('class="article-author-bio"'), SRC_HAS.bio);
cond('<sup>[N]</sup> footnotes', /<sup>\[\d+\]<\/sup>/.test(html), SRC_HAS.supBracket);
cond('name="_ftn ancres', /name="_ftn/.test(html), SRC_HAS.ftnAnchor);
cond('Section "À lire aussi" curée', html.includes('class="related-publications"'), SRC_HAS.relatedCurated);
checks.push(['#relatedPubs auto-section présente', html.includes('id="relatedPubs"')]);
checks.push(['CTA don/adhésion présent', html.includes('class="article-cta"')]);
checks.push(['Article-share présent', html.includes('class="article-share"')]);
checks.push(['JSON-LD datePublished en ISO', /"datePublished":\s*"\d{4}-\d{2}-\d{2}"/.test(html)]);
checks.push(['Avatar gradient inline préservé', /linear-gradient\(135deg,[^,]+,#aaa\)/.test(html)]);
checks.push(['Date page-header présente', /<p>[^<]+<\/p>\s*<\/div>\s*<\/section>/.test(html)]);
checks.push(['<p> du body présents', (html.match(/<p[ >]/g) || []).length > 5]);
checks.push(['Pas d\'erreurs JS', pageErrs.length === 0]);

console.log('\n=== Résultats save ===');
let pass = true;
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) pass = false;
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
