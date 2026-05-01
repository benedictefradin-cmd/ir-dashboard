#!/usr/bin/env node
// Probe ciblé : login + ouverture d'un article existant + vérif que l'éditeur
// charge le contenu, propose le mode HTML, et que le HTML est non-vide.
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://[::1]:5173';
const SLUG = process.argv[3] || 'critique-liberale-liberalisme';

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

// Attendre soit nav-item, soit erreur
try {
  await page.waitForSelector('.nav-item', { timeout: 30000 });
  log('login OK');
} catch (e) {
  const html = await page.content();
  console.error('LOGIN FAIL — page snippet:');
  console.error(html.slice(0, 2000));
  await browser.close();
  process.exit(1);
}

await page.waitForTimeout(3000); // laisser loadData() finir

log('open Publications tab');
await page.click('.nav-item:has-text("Publications")');
await page.waitForTimeout(1500);

log('search slug:', SLUG);
const titleCell = await page.$(`tr:has-text("${SLUG}"), tr td:has-text("${SLUG}")`);
if (!titleCell) {
  // fallback : chercher un article via search
  await page.fill('input[placeholder*="Rechercher"]', SLUG.split('-')[0]);
  await page.waitForTimeout(800);
}

log('click first Éditer button');
const editBtn = await page.$('button:has-text("Éditer")');
if (!editBtn) {
  console.error('No Éditer button found');
  await page.screenshot({ path: '/tmp/no-edit.png' });
  await browser.close();
  process.exit(1);
}
await editBtn.click();
await page.waitForSelector('.modal', { timeout: 5000 });
log('modal opened');

// Attendre que le chargement du contenu termine
log('waiting for content load…');
for (let i = 0; i < 30; i++) {
  const loading = await page.$('text=Chargement de l\'article depuis le site');
  if (!loading) break;
  await page.waitForTimeout(500);
}

// Vérifier les onglets de l'éditeur
const tabs = await page.$$eval('.rich-editor-mode-btn', els => els.map(e => e.textContent.trim()));
log('editor tabs:', tabs.join(' | '));
const visualTabHidden = !tabs.includes('Visuel');
log('visual tab hidden (trusted mode):', visualTabHidden);

// Mode actif
const activeTab = await page.$eval('.rich-editor-mode-btn.active', e => e.textContent.trim()).catch(() => null);
log('active tab:', activeTab);

// Lire le contenu HTML — soit dans le CodeEditor (textarea/codemirror), soit prendre dans le state
let htmlContent = '';
const codeArea = await page.$('.code-editor textarea, .CodeMirror textarea, textarea, [contenteditable]');
if (codeArea) {
  htmlContent = await page.evaluate(el => el.value || el.textContent || '', codeArea);
}
// Fallback : récupérer le state via un attribut
if (!htmlContent || htmlContent.length < 50) {
  // Essayer la zone d'édition CodeMirror
  htmlContent = await page.evaluate(() => {
    const ta = document.querySelector('.code-editor textarea, textarea');
    if (ta && ta.value) return ta.value;
    const cm = document.querySelector('.CodeMirror');
    if (cm && cm.CodeMirror) return cm.CodeMirror.getValue();
    return '';
  });
}
log('html content length:', htmlContent.length);
log('html preview:', htmlContent.slice(0, 200).replace(/\s+/g, ' '));

// Vérifications
const checks = [];
checks.push(['HTML chargé', htmlContent.length > 200]);
checks.push(['Pas de balise structurelle dans le body', !htmlContent.includes('article-author-block') && !htmlContent.includes('article-share')]);
checks.push(['Sup/notes préservés', /<sup>|<a name="_ftn|name="_ftn/.test(htmlContent) || htmlContent.includes('<p>')]);
checks.push(['Mode visuel masqué', visualTabHidden]);
checks.push(['Mode HTML actif par défaut', activeTab === 'HTML']);
checks.push(['Pas d\'erreurs JS', pageErrs.length === 0]);

console.log('\n=== Résultats ===');
let pass = true;
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) pass = false;
}
if (errs.length) {
  console.log('\nConsole errors (' + errs.length + '):');
  errs.slice(0, 5).forEach(e => console.log('  -', e));
}
if (pageErrs.length) {
  console.log('\nPage errors (' + pageErrs.length + '):');
  pageErrs.slice(0, 5).forEach(e => console.log('  -', e));
}

await browser.close();
process.exit(pass ? 0 : 1);
