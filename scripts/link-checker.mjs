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

// User-Agent réaliste : beaucoup de sites (gouv, presse) renvoient 403 sur les
// requêtes vides ou marquées "node-fetch". On se fait passer pour un Firefox
// récent — c'est ce que ferait un visiteur humain qui suit le lien.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:121.0) Gecko/20100101 Firefox/121.0';
const COMMON_HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
};

// Statuts HTTP qu'on traite comme "lien valide derrière un mur" — la page
// existe, mais nécessite un compte / un abonnement / un humain. Pas une
// cassure à corriger ; juste une info.
const PAYWALLED_STATUSES = new Set([401, 402, 403, 429]);

async function checkUrl(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let resp = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: COMMON_HEADERS,
    });
    // Certains serveurs refusent HEAD (405) ou répondent 4xx sur HEAD mais
    // OK sur GET. On retente en GET sans télécharger le corps.
    if (resp.status === 405 || PAYWALLED_STATUSES.has(resp.status) || resp.status === 400) {
      resp = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: ctrl.signal,
        headers: COMMON_HEADERS,
      });
    }
    // ok = 2xx ; on traite aussi les paywalls comme "ok" (pas cassé) — la page
    // existe, juste réservée. broken = vraiment 404/410/5xx/timeout.
    const isPaywalled = PAYWALLED_STATUSES.has(resp.status);
    const ok = resp.ok || isPaywalled;
    return { url, status: resp.status, ok, paywalled: isPaywalled };
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
  const paywalled = results.filter(r => r.paywalled);
  const ok = results.length - broken.length;

  console.log(`══ RÉSULTAT (${elapsed}s) ══`);
  console.log(`  ✓ ${ok}/${results.length} accessibles${paywalled.length ? ` (dont ${paywalled.length} paywall/auth)` : ''}`);
  console.log(`  ✗ ${broken.length} vraiment cassés (404, 5xx, timeout)\n`);

  if (broken.length) {
    // ─── Stats par catégorie d'erreur (pour prioriser le triage) ───
    const byCategory = { '4xx': 0, '5xx': 0, timeout: 0, fetch_failed: 0, other: 0 };
    for (const r of broken) {
      if (r.status === 0) {
        if (r.error === 'timeout') byCategory.timeout++;
        else byCategory.fetch_failed++;
      } else if (r.status >= 400 && r.status < 500) byCategory['4xx']++;
      else if (r.status >= 500) byCategory['5xx']++;
      else byCategory.other++;
    }
    console.log('─── Par catégorie ───');
    console.log(`  4xx (page absente) : ${byCategory['4xx']}`);
    console.log(`  5xx (serveur KO)   : ${byCategory['5xx']}`);
    console.log(`  Timeout (>10s)     : ${byCategory.timeout}`);
    console.log(`  Échec réseau       : ${byCategory.fetch_failed}`);

    // ─── Top des domaines cassés (souvent une seule source pour beaucoup) ───
    const byDomain = new Map();
    for (const r of broken) {
      const host = (() => {
        try { return new URL(r.url).host; } catch { return '?'; }
      })();
      byDomain.set(host, (byDomain.get(host) || 0) + 1);
    }
    const topDomains = [...byDomain.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log('\n─── Top domaines cassés ───');
    for (const [host, n] of topDomains) console.log(`  ${String(n).padStart(4)} ${host}`);

    // ─── Génération d'un rapport markdown actionnable ───
    const reportPath = `reports/link-check-${new Date().toISOString().slice(0, 10)}.md`;
    const lines = [];
    lines.push(`# Rapport link-checker — ${new Date().toLocaleString('fr-FR')}`);
    lines.push('');
    lines.push(`**Total :** ${results.length} URLs externes vérifiées · **${ok} OK** · **${broken.length} cassés**`);
    lines.push('');
    lines.push('## Résumé par catégorie');
    lines.push('| Catégorie | Nombre |');
    lines.push('|---|--:|');
    lines.push(`| 4xx (page absente) | ${byCategory['4xx']} |`);
    lines.push(`| 5xx (serveur KO) | ${byCategory['5xx']} |`);
    lines.push(`| Timeout (>10s) | ${byCategory.timeout} |`);
    lines.push(`| Échec réseau | ${byCategory.fetch_failed} |`);
    lines.push('');
    lines.push('## Top domaines cassés');
    lines.push('| # | Domaine |');
    lines.push('|--:|---|');
    for (const [host, n] of topDomains) lines.push(`| ${n} | \`${host}\` |`);
    lines.push('');
    lines.push('## Détail (groupé par domaine)');

    // Groupe par domaine puis trie : http 4xx d'abord (plus actionnable)
    const groupedByDomain = new Map();
    for (const r of broken) {
      const host = (() => { try { return new URL(r.url).host; } catch { return '?'; } })();
      if (!groupedByDomain.has(host)) groupedByDomain.set(host, []);
      groupedByDomain.get(host).push(r);
    }
    const sortedDomains = [...groupedByDomain.entries()]
      .sort((a, b) => b[1].length - a[1].length);

    for (const [host, items] of sortedDomains) {
      lines.push('');
      lines.push(`### \`${host}\` — ${items.length} lien${items.length > 1 ? 's' : ''}`);
      for (const r of items) {
        const tag = r.status === 0 ? `\`${r.error || 'fail'}\`` : `\`HTTP ${r.status}\``;
        lines.push('');
        lines.push(`- ${tag} ${r.url}`);
        const refs = urlMap.get(r.url) || [];
        const seenSources = new Set();
        for (const ref of refs) {
          const src = ref.source;
          if (seenSources.has(src)) continue;
          seenSources.add(src);
          lines.push(`  - ↳ \`${src}\` — ${(ref.title || ref.id || '').slice(0, 80)}`);
        }
      }
    }

    try {
      const fs = await import('node:fs/promises');
      await fs.mkdir('reports', { recursive: true });
      await fs.writeFile(reportPath, lines.join('\n'));
      console.log(`\n→ Rapport markdown écrit : ${reportPath}`);

      // Sortie JSON pour les scripts (fix-broken-links.mjs etc.) — contient
      // l'état de chaque URL cassée et les fichiers qui la référencent.
      const jsonPath = reportPath.replace(/\.md$/, '.json');
      const jsonReport = {
        generatedAt: new Date().toISOString(),
        total: results.length,
        ok,
        paywalled: paywalled.length,
        broken: broken.map(r => ({
          url: r.url,
          status: r.status,
          error: r.error || null,
          // category : 4xx (probable 404 — fixable via Wayback) / 5xx /
          // timeout / fetch_failed. Permet aux scripts de filtrer.
          category: r.status === 0
            ? (r.error === 'timeout' ? 'timeout' : 'fetch_failed')
            : (r.status >= 500 ? '5xx' : (r.status >= 400 ? '4xx' : 'other')),
          refs: (urlMap.get(r.url) || []).map(ref => ({
            source: ref.source,
            id: ref.id,
            title: ref.title,
          })),
        })),
      };
      await fs.writeFile(jsonPath, JSON.stringify(jsonReport, null, 2));
      console.log(`→ Rapport JSON écrit     : ${jsonPath}`);
    } catch (err) {
      console.warn(`Impossible d'écrire le rapport : ${err.message}`);
    }
  }

  process.exit(broken.length ? 1 : 0);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(2);
});
