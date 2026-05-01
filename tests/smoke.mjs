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
    messagerie: 'Messagerie', pagessite: 'Pages du site', contenu: 'Contenu', accueil: 'Accueil',
    seo: 'SEO', medias: 'Médias', navigation: 'Navigation', equipe: 'Équipe',
    technique: 'Technique', sollicitations: 'Sollicitations', settings: 'Config',
  };

  // Pages accessibles depuis la sidebar
  const SIDEBAR_TABS = ['dashboard', 'articles', 'evenements', 'calendrier', 'presse', 'profils', 'newsletter', 'messagerie', 'pagessite', 'seo', 'medias', 'technique', 'sollicitations', 'settings'];
  // Sous-onglets de PagesSite
  const PAGES_SITE_SUBTABS = [
    { key: 'contenu', label: 'Contenu éditorial' },
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

  // ─── Rapport ───
  console.log('\n══ RÉSULTAT ══');
  console.log(`Erreurs JS (pageerror) : ${jsErrors.length}`);
  console.log(`console.error inattendues : ${consoleErrors.length}`);
  console.log(`HTTP 4xx/5xx (uniques) : ${httpErrors.size}`);
  console.log(`Calendrier CRUD : ${persistOk.ok ? '✓' : '✗ ' + JSON.stringify(persistOk)}`);

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
  process.exit(jsErrors.length || consoleErrors.length || !persistOk.ok ? 1 : 0);
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(2);
});
