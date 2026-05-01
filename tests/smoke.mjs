#!/usr/bin/env node
// Smoke E2E — login + clics sur la sidebar pour visiter toutes les pages.
// Capture les vrais bugs JS (pageerror), pas les 4xx HTTP attendus.

import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:5173';
const PAGES = [
  'dashboard', 'articles', 'evenements', 'calendrier', 'presse', 'profils',
  'newsletter', 'messagerie', 'pagessite', 'contenu', 'accueil', 'seo',
  'medias', 'navigation', 'equipe', 'technique', 'sollicitations', 'settings',
];

const jsErrors = []; // pageerror = vraie erreur JS
const httpErrors = new Map(); // URL → count
const consoleErrors = []; // console.error qui ne sont pas "Failed to load"

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  let currentTab = 'login';

  page.on('console', m => {
    if (m.type() !== 'error') return;
    const text = m.text();
    // Filtrer le bruit "Failed to load resource" (déjà capturé par response listener)
    if (text.includes('Failed to load resource')) return;
    consoleErrors.push({ tab: currentTab, text: text.slice(0, 300) });
  });
  page.on('pageerror', err => jsErrors.push({ tab: currentTab, msg: err.message }));
  page.on('response', resp => {
    const status = resp.status();
    if (status < 400) return;
    const url = resp.url();
    if (url.includes('localhost') || url.includes('@vite')) return;
    const key = `${status} ${url.split('?')[0]}`;
    httpErrors.set(key, (httpErrors.get(key) || 0) + 1);
  });

  console.log(`→ Navigation vers ${BASE}`);
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });

  console.log('→ Login admin / IR2026!');
  await page.fill('input[placeholder="Identifiant"]', 'admin');
  await page.fill('input[placeholder="Mot de passe"]', 'IR2026!');
  await page.click('button[type=submit]');
  await page.waitForSelector('.nav-item', { timeout: 15000 });
  await page.waitForTimeout(2000); // laisser loadData() terminer

  // (warmup gardé dans le rapport pour transparence)

  // Ouvrir tous les groupes de la sidebar
  for (let i = 0; i < 5; i++) {
    const opened = await page.evaluate(() => {
      const headers = [...document.querySelectorAll('.nav-group-header')];
      let count = 0;
      headers.forEach(h => { if (!h.classList.contains('open')) { h.click(); count++; } });
      return count;
    });
    if (opened === 0) break;
    await page.waitForTimeout(200);
  }

  // ─── Visite via clic sur sidebar ───
  const labels = {
    dashboard: 'Dashboard', articles: 'Publications', evenements: 'Événements',
    calendrier: 'Calendrier', presse: 'Presse', profils: 'Profils', newsletter: 'Newsletter',
    messagerie: 'Messagerie', editeur: 'Éditeur visuel', pagessite: 'Pages du site', contenu: 'Contenu', accueil: 'Accueil',
    seo: 'SEO', medias: 'Médias', navigation: 'Navigation', equipe: 'Équipe',
    technique: 'Technique', sollicitations: 'Sollicitations', settings: 'Config',
  };

  // Pages accessibles depuis la sidebar
  const SIDEBAR_TABS = ['dashboard', 'articles', 'evenements', 'calendrier', 'presse', 'profils', 'newsletter', 'messagerie', 'editeur', 'pagessite', 'seo', 'medias', 'technique', 'sollicitations', 'settings'];
  // Sous-onglets de PagesSite
  const PAGES_SITE_SUBTABS = [
    { key: 'accueil', label: "Page d'accueil" },
    { key: 'equipe', label: 'Équipe' },
    { key: 'navigation', label: 'Navigation' },
  ];

  for (const tab of SIDEBAR_TABS) {
    currentTab = tab;
    const want = labels[tab] || tab;
    const clicked = await page.evaluate((label) => {
      const items = [...document.querySelectorAll('.nav-item')];
      const target = items.find(i => {
        const lab = i.querySelector('.nav-label');
        return lab && lab.textContent?.trim() === label;
      });
      if (target) { target.click(); return true; }
      return false;
    }, want);
    process.stdout.write(`  ${tab}${clicked ? '✓' : '✗'} `);
    await page.waitForTimeout(800);
  }
  console.log('');

  // Naviguer vers PagesSite et tester chaque sous-onglet
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('.nav-item')];
    const target = items.find(i => i.querySelector('.nav-label')?.textContent?.trim() === 'Pages du site');
    if (target) target.click();
  });
  await page.waitForTimeout(1000);

  for (const sub of PAGES_SITE_SUBTABS) {
    currentTab = sub.key;
    const clicked = await page.evaluate((label) => {
      const items = [...document.querySelectorAll('.tab-item')];
      const target = items.find(i => i.textContent?.includes(label));
      if (target) { target.click(); return true; }
      return false;
    }, sub.label);
    process.stdout.write(`  ${sub.key}${clicked ? '✓' : '✗'} `);
    await page.waitForTimeout(800);
  }
  console.log('');

  // ─── Test CRUD calendrier (via API directe depuis la page) ───
  currentTab = 'calendrier-crud';
  console.log('→ Test CRUD calendrier');
  const persistOk = await page.evaluate(async () => {
    try {
      const url = 'https://ir-dashboard-api.institut-rousseau.workers.dev/api/calendar/socialPosts';
      const items = [{ id: 'smoke-test-1', title: 'Smoke', platform: 'linkedin', status: 'brouillon' }];
      const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
      if (!put.ok) return { ok: false, step: 'put', code: put.status };
      const get = await fetch(url);
      const data = await get.json();
      const found = data.items?.find(i => i.id === 'smoke-test-1');
      await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [] }) });
      return { ok: !!found };
    } catch (e) { return { ok: false, msg: e.message }; }
  });

  // ─── Test CRUD article via l'UI (création + edition + suppression) ───
  // C'est purement local (state React) — on ne touche pas au repo site, on
  // valide seulement que les flows boutons / formulaire / draft fonctionnent
  // en runtime, pas seulement que la page se charge.
  currentTab = 'article-crud';
  console.log('→ Test CRUD article (UI)');
  const articleResults = { create: false, xssEscaped: false, draftSaved: false };

  try {
    // Aller sur Articles
    await page.evaluate(() => {
      const items = [...document.querySelectorAll('.nav-item')];
      const target = items.find(i => i.querySelector('.nav-label')?.textContent?.trim() === 'Publications');
      if (target) target.click();
    });
    await page.waitForTimeout(800);

    // Cliquer "+ Nouvelle publication"
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const target = btns.find(b => b.textContent?.includes('Nouvelle publication'));
      if (target) target.click();
    });
    await page.waitForTimeout(500);

    const xssPayload = '<img src=x onerror=alert(1)>SmokeTest';
    // Remplir titre avec un payload XSS — vérification que le HTML est échappé
    await page.evaluate((title) => {
      const inputs = [...document.querySelectorAll('input[type=text], input:not([type])')];
      const titleInput = inputs.find(i => i.previousElementSibling?.textContent?.includes('Titre'));
      if (titleInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(titleInput, title);
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, xssPayload);
    await page.waitForTimeout(300);

    // Cliquer "Brouillon" (sauve sans publier)
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const target = btns.find(b => b.textContent?.trim() === 'Brouillon');
      if (target) target.click();
    });
    await page.waitForTimeout(800);

    // Vérifier que l'article apparaît dans le tableau
    const created = await page.evaluate((title) => {
      const cells = [...document.querySelectorAll('td, .data-table td, .article-title')];
      return cells.some(c => c.textContent?.includes('SmokeTest'));
    }, xssPayload);
    articleResults.create = created;

    // Vérifier que le payload n'a pas été interprété : aucun <img onerror>
    // ne doit être présent dans le DOM avec le src=x.
    const xssExecuted = await page.evaluate(() => {
      return !!document.querySelector('img[src="x"]');
    });
    articleResults.xssEscaped = !xssExecuted;

    // Tester l'auto-save : ouvrir un nouveau form, taper, fermer, rouvrir
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const target = btns.find(b => b.textContent?.includes('Nouvelle publication'));
      if (target) target.click();
    });
    await page.waitForTimeout(400);

    await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('input[type=text], input:not([type])')];
      const titleInput = inputs.find(i => i.previousElementSibling?.textContent?.includes('Titre'));
      if (titleInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(titleInput, 'Brouillon-auto-save');
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // Attendre 3.5s pour que le debounce 3s du draft autosave écrive en localStorage
    await page.waitForTimeout(3500);

    // Vérifier que le draft est en localStorage
    articleResults.draftSaved = await page.evaluate(() => {
      const v = localStorage.getItem('ir-dash-draft-article-new');
      return !!v && v.includes('Brouillon-auto-save');
    });

    // Cleanup : fermer le modal + supprimer l'article smoke-test créé
    await page.evaluate(() => {
      const closeBtns = [...document.querySelectorAll('button')];
      const cancel = closeBtns.find(b => b.textContent?.trim() === 'Annuler');
      if (cancel) cancel.click();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      // Supprimer le draft de localStorage et l'article créé du state React
      // n'est pas trivial (pas d'API publique), mais le state vivra le temps
      // d'un reload. Le smoke test est self-contained.
      localStorage.removeItem('ir-dash-draft-article-new');
    });
  } catch (err) {
    log('error', 'article-crud', `Exception : ${err.message}`);
  }

  // ─── Rapport ───
  console.log('\n══ RÉSULTAT ══');
  console.log(`Erreurs JS (pageerror) : ${jsErrors.length}`);
  console.log(`console.error inattendues : ${consoleErrors.length}`);
  console.log(`HTTP 4xx/5xx (uniques) : ${httpErrors.size}`);
  console.log(`Calendrier CRUD : ${persistOk.ok ? '✓' : '✗ ' + JSON.stringify(persistOk)}`);
  console.log(`Article créé via UI : ${articleResults.create ? '✓' : '✗'}`);
  console.log(`XSS payload échappé : ${articleResults.xssEscaped ? '✓' : '✗ (img[src=x] présent dans le DOM !)'}`);
  console.log(`Auto-save brouillon : ${articleResults.draftSaved ? '✓' : '✗ (localStorage ir-dash-draft-article-new absent)'}`);

  if (jsErrors.length) {
    console.log('\n─── ERREURS JS (BLOQUANTES) ───');
    for (const e of jsErrors) console.log(`[${e.tab}] ${e.msg}`);
  }
  if (consoleErrors.length) {
    console.log('\n─── console.error ───');
    for (const e of consoleErrors) console.log(`[${e.tab}] ${e.text}`);
  }
  if (httpErrors.size) {
    console.log('\n─── HTTP 4xx/5xx (URLs uniques, à arbitrer) ───');
    for (const [k, count] of [...httpErrors.entries()].sort()) {
      console.log(`  ×${count} ${k}`);
    }
  }

  await browser.close();
  const allOk = !jsErrors.length && !consoleErrors.length && persistOk.ok
    && articleResults.create && articleResults.xssEscaped && articleResults.draftSaved;
  process.exit(allOk ? 0 : 1);
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(2);
});
