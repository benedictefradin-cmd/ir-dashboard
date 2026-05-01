#!/usr/bin/env node
// Link checker — vérifie que toutes les URLs externes des publications/events/presse
// du site sont joignables. À lancer en local : `node scripts/link-checker.mjs`.
//
// - Lit data/{publications,events,presse}.json depuis le repo via le Worker.
// - Extrait toutes les URLs externes (champ `url` + URLs trouvées dans le HTML).
// - HEAD chaque URL avec timeout 10s, parallélisme 8.
// - Rapporte les liens cassés (HTTP ≥ 400 ou timeout) en console.
//
// Permet de garder une boucle de feedback rapide sur la santé des liens des
// 253 publications, sans avoir à monter un Cron Trigger Cloudflare (limite 30s
// par invocation HTTP). Lancement manuel = pas de coût récurrent.

const WORKER_URL = process.env.WORKER_URL || 'https://ir-dashboard-api.institut-rousseau.workers.dev';
const TIMEOUT_MS = 10000;
const PARALLELISM = 8;

// ─── Helpers ──────────────────────────────────────────

async function fetchJson(path) {
  const url = `${WORKER_URL}/api/github/contents/${encodeURIComponent(path)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Worker ${resp.status} sur ${path}`);
  const { content } = await resp.json();
  return JSON.parse(content);
}

function extractUrls(text) {
  if (!text) return [];
  const re = /https?:\/\/[^\s"'<>)]+/g;
  return [...text.matchAll(re)].map(m => m[0]);
}

async function checkUrl(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let resp = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal });
    // Certains serveurs refusent HEAD (405) — on retente en GET sans télécharger
    if (resp.status === 405 || resp.status === 403) {
      resp = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal });
    }
    return { url, status: resp.status, ok: resp.ok };
  } catch (err) {
    return { url, status: 0, ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(t);
  }
}

async function pool(items, worker, parallelism) {
  const results = [];
  let i = 0;
  let done = 0;
  const workers = Array(parallelism).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      const r = await worker(items[idx]);
      results[idx] = r;
      done++;
      if (done % 10 === 0) process.stderr.write(`  ${done}/${items.length}\r`);
    }
  });
  await Promise.all(workers);
  return results;
}

// ─── Main ─────────────────────────────────────────────

async function main() {
  console.log(`→ Worker : ${WORKER_URL}`);
  console.log('→ Chargement des collections…');
  const [pubs, events, presse] = await Promise.all([
    fetchJson('data/publications.json').catch(e => { console.warn('  publications.json :', e.message); return []; }),
    fetchJson('data/events.json').catch(e => { console.warn('  events.json :', e.message); return []; }),
    fetchJson('data/presse.json').catch(e => { console.warn('  presse.json :', e.message); return []; }),
  ]);
  console.log(`  publications : ${pubs.length}`);
  console.log(`  events       : ${events.length}`);
  console.log(`  presse       : ${presse.length}`);

  // Collecte de toutes les URLs avec leur source pour le rapport.
  const urlMap = new Map(); // url -> [{source, id, title}]
  const addUrl = (url, source, id, title) => {
    if (!url || !/^https?:/i.test(url)) return;
    // Skip les URLs internes (institut-rousseau.fr) — on suppose qu'elles
    // sont valides puisque le site est servi par le repo qu'on connaît.
    if (url.includes('institut-rousseau.fr') || url.includes('institut-rousseau-kb9p.vercel.app')) return;
    if (!urlMap.has(url)) urlMap.set(url, []);
    urlMap.get(url).push({ source, id, title });
  };

  for (const p of pubs) {
    addUrl(p.url, 'publications', p.id || p.slug, p.title);
    for (const u of extractUrls(p.description || '')) addUrl(u, 'publications', p.id || p.slug, p.title);
  }
  for (const e of events) {
    addUrl(e.lienInscription, 'events', e.id, e.title);
    addUrl(e.lienConcours, 'events', e.id, e.title);
    for (const u of extractUrls(e.description || '')) addUrl(u, 'events', e.id, e.title);
  }
  for (const p of presse) {
    addUrl(p.url, 'presse', p.id, p.title);
  }

  const urls = [...urlMap.keys()];
  console.log(`\n→ Vérification de ${urls.length} URLs uniques (parallélisme ${PARALLELISM}, timeout ${TIMEOUT_MS / 1000}s)…\n`);

  const start = Date.now();
  const results = await pool(urls, checkUrl, PARALLELISM);
  process.stderr.write('\n');
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  const broken = results.filter(r => !r.ok);
  const ok = results.length - broken.length;

  console.log(`══ RÉSULTAT (${elapsed}s) ══`);
  console.log(`  ✓ ${ok}/${results.length} OK`);
  console.log(`  ✗ ${broken.length} cassés ou injoignables\n`);

  if (broken.length) {
    console.log('─── Liens cassés ───');
    for (const r of broken.sort((a, b) => (b.status || 0) - (a.status || 0))) {
      const refs = urlMap.get(r.url) || [];
      const tag = r.status === 0 ? `[${r.error || 'fail'}]` : `[HTTP ${r.status}]`;
      console.log(`\n${tag} ${r.url}`);
      for (const ref of refs.slice(0, 3)) {
        console.log(`    ↳ ${ref.source} : ${(ref.title || ref.id || '').slice(0, 70)}`);
      }
      if (refs.length > 3) console.log(`    ↳ +${refs.length - 3} autres`);
    }
  }

  process.exit(broken.length ? 1 : 0);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(2);
});
