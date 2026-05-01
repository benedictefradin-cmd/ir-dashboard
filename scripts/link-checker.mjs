#!/usr/bin/env node
// Link checker — vérifie que toutes les URLs externes du site sont joignables.
// À lancer en local : `node scripts/link-checker.mjs`.
//
// Sources scannées :
//   - Champs `url` / `description` de data/{publications,events,presse}.json
//   - Tous les liens <a href="..."> dans publications/<slug>.html (253 pages)
//
// Étapes :
//   1. Lit data/*.json via le Worker.
//   2. Pour chaque publication avec un slug, télécharge le HTML via le Worker
//      (parallélisme 6 pour rester loin du rate limit GitHub).
//   3. Dédoublonne les URLs externes (un même article cite souvent les mêmes
//      sources que d'autres).
//   4. HEAD chaque URL externe avec timeout 10s, parallélisme 8.
//   5. Rapporte les liens cassés (HTTP ≥ 400 ou timeout) avec leur contexte.
//
// Lancement manuel = pas de coût récurrent. Pas de Cron Trigger Cloudflare
// (limite 30s par invocation HTTP, insuffisant pour ~1000 URLs externes).

const WORKER_URL = process.env.WORKER_URL || 'https://ir-dashboard-api.institut-rousseau.workers.dev';
const TIMEOUT_MS = 10000;
const PARALLELISM = 8;
// Lecture des HTML : plus prudent (rate limit GitHub 5000 req/h sur un PAT).
const GITHUB_PARALLELISM = 6;

// ─── Helpers ──────────────────────────────────────────

async function fetchText(path) {
  const url = `${WORKER_URL}/api/github/contents/${encodeURIComponent(path)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Worker ${resp.status} sur ${path}`);
  const { content } = await resp.json();
  return content;
}

async function fetchJson(path) {
  return JSON.parse(await fetchText(path));
}

// Extrait toutes les URLs http(s) qui apparaissent dans un texte plat
// (descriptions, champs de données — pas du HTML structuré).
function extractUrls(text) {
  if (!text) return [];
  const re = /https?:\/\/[^\s"'<>)]+/g;
  return [...text.matchAll(re)].map(m => m[0]);
}

// Extrait uniquement les href="…" et href='…' d'un HTML — ne capture pas les
// <img src>, <script src>, <link href> de polices/CSS qui font beaucoup de
// bruit (Google Fonts, polices CDN…). Ce qu'on veut vérifier ce sont les
// liens cliquables qu'un visiteur peut suivre.
function extractHrefs(html) {
  if (!html) return [];
  const re = /<a\b[^>]*\bhref=(["'])(https?:\/\/[^"']+)\1/gi;
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    // Nettoie les fragments / parenthèses traînantes
    let url = m[2].replace(/[)\.,;]+$/, '');
    out.push(url);
  }
  return out;
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

  // ─── Scan profond : <a href> de chaque publication HTML ───────
  const pubsWithSlug = pubs.filter(p => p.slug);
  console.log(`\n→ Téléchargement de ${pubsWithSlug.length} pages publications/*.html (parallélisme ${GITHUB_PARALLELISM})…`);
  const htmlStart = Date.now();
  await pool(
    pubsWithSlug,
    async (p) => {
      try {
        const html = await fetchText(`publications/${p.slug}.html`);
        for (const u of extractHrefs(html)) {
          addUrl(u, `publications/${p.slug}.html`, p.id || p.slug, p.title);
        }
      } catch (err) {
        // Une 404 ici signifie que data/publications.json référence un slug
        // dont le fichier HTML n'existe pas encore — utile à savoir.
        process.stderr.write(`\n  ⚠ ${p.slug} : ${err.message}\n`);
      }
    },
    GITHUB_PARALLELISM
  );
  process.stderr.write('\n');
  console.log(`  HTML scannés en ${((Date.now() - htmlStart) / 1000).toFixed(1)}s`);

  const urls = [...urlMap.keys()];
  console.log(`\n→ Vérification de ${urls.length} URLs externes uniques (parallélisme ${PARALLELISM}, timeout ${TIMEOUT_MS / 1000}s)…\n`);

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
