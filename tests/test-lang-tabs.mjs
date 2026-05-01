#!/usr/bin/env node
// Probe : verifie le flux des onglets de langue dans le formulaire d'article.
// - tabs visibles (FR EN ES DE IT)
// - bascule entre FR et EN preserve les contenus
// - le check "filled" apparait quand titre + contenu remplis
// - intercepte le PUT publications-i18n.js pour verifier le payload
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:5175';
const SLUG = process.argv[3] || 'critique-liberale-liberalisme';

const log = (...a) => console.log('•', ...a);
const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok, detail });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

const pageErrs = [];
page.on('pageerror', (e) => pageErrs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) pageErrs.push(m.text().slice(0, 200)); });

// Intercepte tous les PUT GitHub pour ne pas reellement publier
let i18nPayload = null;
let publishPayload = null;
await page.route('**/api/github/publish', async (route) => {
  publishPayload = route.request().postDataJSON();
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, sha: 'fake' }) });
});
await page.route('**/api/github/contents/**', async (route) => {
  if (route.request().method() === 'PUT') {
    const body = route.request().postDataJSON();
    const url = route.request().url();
    if (url.includes('publications-i18n.js')) {
      i18nPayload = body;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sha: 'fake' }) });
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
await page.waitForTimeout(3000);
log('login OK');

await page.click('.nav-item:has-text("Publications")');
await page.waitForTimeout(2500);

log('locate row for slug:', SLUG);
const editBtn = await page.$(`tr:has(a[href*="/${SLUG}.html"]) button:has-text("Éditer")`);
if (!editBtn) {
  console.error('No row for slug ' + SLUG);
  await browser.close();
  process.exit(1);
}
await editBtn.click();
await page.waitForSelector('.modal', { timeout: 5000 });

log('wait for content load…');
for (let i = 0; i < 60; i++) {
  const m = await page.$('text=Chargement de l\'article depuis le site');
  if (!m) break;
  await page.waitForTimeout(500);
}
await page.waitForTimeout(1500);

// === Test 1 : tabs visibles ===
const tabsCount = await page.$$eval('.lang-tabs .lang-tab', (els) => els.length);
check('5 onglets de langue presents', tabsCount === 5, `${tabsCount} onglets`);

const tabLabels = await page.$$eval('.lang-tabs .lang-tab .lang-tab-label', (els) => els.map(e => e.textContent.trim()));
check('Labels: Français/English/Español/Deutsch/Italiano', JSON.stringify(tabLabels) === JSON.stringify(['Français','English','Español','Deutsch','Italiano']), tabLabels.join(','));

const sourceBadge = await page.$('.lang-tabs .lang-tab:first-child .lang-tab-source');
check('Badge "source" sur FR', !!sourceBadge);

// === Test 2 : FR est l'onglet actif au demarrage ===
const activeFr = await page.$('.lang-tabs .lang-tab.active:has-text("Français")');
check('FR actif par defaut', !!activeFr);

// Capturer le titre FR avant switch
const frTitleBefore = await page.inputValue('input[value]:not([disabled]) >> nth=0').catch(() => '');
const frTitleInputs = await page.$$('input[type=text], input:not([type])');
let frTitle = '';
for (const inp of frTitleInputs) {
  const val = await inp.inputValue();
  if (val && val.length > 5 && (await inp.evaluate(e => e.previousElementSibling?.textContent?.includes('Titre')))) {
    frTitle = val;
    break;
  }
}
log('FR title before switch:', frTitle.slice(0, 50));

// === Test 3 : switch sur EN ===
log('click EN tab');
await page.click('.lang-tabs .lang-tab:has-text("English")');
await page.waitForTimeout(500);

const activeEn = await page.$('.lang-tabs .lang-tab.active:has-text("English")');
check('EN actif apres clic', !!activeEn);

// Le titre devrait etre vide (ou contenir une traduction existante)
let enTitleField = null;
const allInputs = await page.$$('input[type=text], input:not([type])');
for (const inp of allInputs) {
  const labelText = await inp.evaluate(e => {
    const lab = e.closest('div')?.querySelector('label')?.textContent || '';
    return lab;
  });
  if (labelText.includes('Titre')) { enTitleField = inp; break; }
}

if (!enTitleField) {
  check('Champ titre EN trouve', false, 'pas de champ titre apres switch');
} else {
  // Tape une traduction EN
  await enTitleField.fill('English title test');
  await page.waitForTimeout(300);
  const enTitle = await enTitleField.inputValue();
  check('Saisie titre EN', enTitle === 'English title test', enTitle);
}

// Saisir contenu EN dans le RichEditor (mode HTML)
// Cliquer sur l'onglet HTML si dispo
const htmlBtn = await page.$('button:has-text("HTML"):not(.tab-item)').catch(() => null);
if (htmlBtn) await htmlBtn.click().catch(() => {});
await page.waitForTimeout(300);

// Trouver le textarea de l'editeur HTML
const codeTa = await page.$('.code-editor-textarea, textarea[class*="code"]');
if (codeTa) {
  await codeTa.evaluate((el, val) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, '<p>English content test</p>');
  await page.waitForTimeout(500);
}

// === Test 4 : retour FR preserve le contenu original ===
log('click FR tab');
await page.click('.lang-tabs .lang-tab:has-text("Français")');
await page.waitForTimeout(500);

let frTitleAfter = '';
const allInputsFr = await page.$$('input[type=text], input:not([type])');
for (const inp of allInputsFr) {
  const labelText = await inp.evaluate(e => e.closest('div')?.querySelector('label')?.textContent || '');
  if (labelText.includes('Titre')) { frTitleAfter = await inp.inputValue(); break; }
}
check('FR titre preserve apres switch FR -> EN -> FR', frTitleAfter === frTitle, frTitleAfter.slice(0, 50));

// === Test 5 : retour EN preserve la saisie EN ===
log('click EN tab again');
await page.click('.lang-tabs .lang-tab:has-text("English")');
await page.waitForTimeout(500);

let enTitleAfter = '';
const allInputsEn = await page.$$('input[type=text], input:not([type])');
for (const inp of allInputsEn) {
  const labelText = await inp.evaluate(e => e.closest('div')?.querySelector('label')?.textContent || '');
  if (labelText.includes('Titre')) { enTitleAfter = await inp.inputValue(); break; }
}
check('EN titre preserve apres switch EN -> FR -> EN', enTitleAfter === 'English title test', enTitleAfter);

// === Test 6 : EN tab affiche le check "filled" ===
const enFilled = await page.$('.lang-tabs .lang-tab.filled:has-text("English")');
check('EN tab marque "filled" quand titre + contenu remplis', !!enFilled);

// === Test 7 : Sauvegarder pousse l'i18n ===
log('click Sauvegarder');
const saveBtn = await page.$('button:has-text("Sauvegarder"):not(:has-text("Brouillon"))');
if (saveBtn) {
  await saveBtn.click();
  for (let i = 0; i < 30; i++) {
    if (i18nPayload) break;
    await page.waitForTimeout(300);
  }
  check('PUT publications-i18n.js intercepte', !!i18nPayload);
  if (i18nPayload) {
    const content = i18nPayload.content || '';
    // Le content est UTF-8 brut envoye au worker, qui le base64 ensuite. Selon
    // l'API du Worker, le PUT contents prend `content` (texte) ou `base64`.
    const decoded = content.includes('PUB_I18N') ? content : Buffer.from(content, 'base64').toString('utf8');
    check('i18n payload contient title_en', decoded.includes('title_en') || decoded.includes('"title_en"'));
    check('i18n payload contient body_en', decoded.includes('body_en') || decoded.includes('"body_en"'));
    check('i18n payload contient "English title test"', decoded.includes('English title test'));
  }
} else {
  check('bouton Sauvegarder trouve', false);
}

console.log('\n=== Resume ===');
const passed = checks.filter(c => c.ok).length;
const total = checks.length;
console.log(`${passed}/${total} ${passed === total ? '✓ all pass' : '✗ failures'}`);
if (pageErrs.length) {
  console.log('\nPage errors:');
  pageErrs.slice(0, 5).forEach(e => console.log('  -', e));
}
await browser.close();
process.exit(passed === total ? 0 : 1);
