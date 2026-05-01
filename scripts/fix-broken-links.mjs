#!/usr/bin/env node
// Fix automatique des liens cassés via la Wayback Machine.
//
// Lit le JSON produit par scripts/link-checker.mjs, query archive.org pour
// chaque URL en 4xx (les vraies 404 — pas les timeouts ni les fetch failed
// qu'on ne peut pas fixer aveuglément), et remplace dans tous les fichiers
// HTML du repo site qui les référencent par leur dernière archive disponible.
//
// Modes :
//   --dry-run   (défaut) : affiche les fixs proposés, ne touche à rien
//   --apply              : applique les modifs (1 commit par fichier modifié)
//
// Usage :
//   node scripts/fix-broken-links.mjs                # dry-run
//   node scripts/fix-broken-links.mjs --apply        # applique
//   node scripts/fix-broken-links.mjs --report=path  # JSON spécifique
//
// Prérequis : un rapport reports/link-check-*.json (généré par link-checker).

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const WORKER_URL = process.env.WORKER_URL || 'https://ir-dashboard-api.institut-rousseau.workers.dev';
const WAYBACK_PARALLELISM = 4;
const APPLY = process.argv.includes('--apply');
const REPORT_ARG = process.argv.find(a => a.startsWith('--report='))?.slice('--report='.length);

// ─── Helpers ──────────────────────────────────────────

async function findLatestReport() {
  if (REPORT_ARG) return REPORT_ARG;
  const files = await readdir('reports').catch(() => []);
  const json = files.filter(f => /^link-check-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  if (!json.length) throw new Error('Aucun rapport reports/link-check-*.json. Lance d\'abord : node scripts/link-checker.mjs');
  return join('reports', json.at(-1));
}

async function queryWayback(url) {
  const api = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const resp = await fetch(api, { signal: ctrl.signal });
    if (!resp.ok) return null;
    const data = await resp.json();
    const snap = data.archived_snapshots?.closest;
    if (!snap?.available || snap.status !== '200') return null;
    return snap.url;
  } catch {
    return null;
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
      results[idx] = await worker(items[idx]);
      done++;
      if (done % 5 === 0) process.stderr.write(`  ${done}/${items.length}\r`);
    }
  });
  await Promise.all(workers);
  return results;
}

async function readRemoteFile(path) {
  const r = await fetch(`${WORKER_URL}/api/github/contents/${encodeURIComponent(path)}`);
  if (!r.ok) throw new Error(`Lecture ${path} : HTTP ${r.status}`);
  return r.json(); // { content, sha }
}

async function writeRemoteFile(path, content, sha, message) {
  const r = await fetch(`${WORKER_URL}/api/github/contents/${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, sha, message }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data.sha || null;
}

// ─── Main ─────────────────────────────────────────────

async function main() {
  const reportPath = await findLatestReport();
  console.log(`→ Rapport source : ${reportPath}`);
  const report = JSON.parse(await readFile(reportPath, 'utf-8'));

  // Filtre : seulement les 4xx (sauf paywall déjà filtrés en amont). Les
  // timeouts et fetch_failed ne sont pas fiables — l'URL peut juste être lente
  // ou bloquer notre UA, on évite de remplacer aveuglément.
  const candidates = report.broken.filter(b => b.category === '4xx');
  console.log(`→ Candidats 4xx (probables 404) : ${candidates.length} sur ${report.broken.length} cassés`);

  console.log(`\n→ Query Wayback Machine (parallélisme ${WAYBACK_PARALLELISM})…\n`);
  const start = Date.now();
  const fixes = await pool(
    candidates,
    async (c) => {
      const archive = await queryWayback(c.url);
      return { ...c, archive };
    },
    WAYBACK_PARALLELISM
  );
  process.stderr.write('\n');
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  const fixable = fixes.filter(f => f.archive);
  const noArchive = fixes.filter(f => !f.archive);

  console.log(`\n══ RÉSUMÉ Wayback (${elapsed}s) ══`);
  console.log(`  ✓ ${fixable.length} URLs fixables (archive trouvée)`);
  console.log(`  ✗ ${noArchive.length} URLs sans archive Wayback (à traiter manuellement)`);

  // Groupe les fixs par fichier (on fait 1 commit par fichier, pas 1 par URL)
  const byFile = new Map();
  for (const f of fixable) {
    for (const ref of f.refs) {
      // On ne fixe que les fichiers HTML du repo site ; pas les data/*.json
      // (qui sont source de vérité distincts gérés par le dashboard).
      if (!ref.source.startsWith('publications/')) continue;
      const path = ref.source;
      if (!byFile.has(path)) byFile.set(path, []);
      byFile.get(path).push({ old: f.url, new: f.archive });
    }
  }
  console.log(`  → ${byFile.size} fichier${byFile.size > 1 ? 's' : ''} HTML à modifier`);

  if (!APPLY) {
    console.log('\n══ DRY-RUN — aucun fichier modifié ══');
    console.log('Pour appliquer : node scripts/fix-broken-links.mjs --apply\n');
    // Échantillon des fixs
    const sample = [...byFile.entries()].slice(0, 5);
    for (const [file, subs] of sample) {
      console.log(`\n${file} (${subs.length} substitution${subs.length > 1 ? 's' : ''}) :`);
      for (const s of subs.slice(0, 2)) {
        console.log(`  - ${s.old.slice(0, 70)}…`);
        console.log(`    → ${s.new.slice(0, 70)}…`);
      }
      if (subs.length > 2) console.log(`  ... +${subs.length - 2}`);
    }
    if (byFile.size > 5) console.log(`\n... et ${byFile.size - 5} autres fichiers`);
    return;
  }

  // ─── Mode --apply ─────────────────────────────────────
  console.log('\n══ APPLY — commits sur le repo site ══\n');
  const log = [];
  let done = 0;
  let success = 0;
  let failed = 0;

  for (const [path, subs] of byFile) {
    done++;
    try {
      const { content, sha } = await readRemoteFile(path);
      let updated = content;
      let changed = 0;
      for (const sub of subs) {
        if (updated.includes(sub.old)) {
          updated = updated.split(sub.old).join(sub.new);
          changed++;
        }
      }
      if (changed === 0) {
        console.log(`  ⊘ [${done}/${byFile.size}] ${path} : URLs déjà absentes (skip)`);
        log.push({ path, status: 'skip', reason: 'urls already absent', subs });
        continue;
      }
      const newSha = await writeRemoteFile(
        path,
        updated,
        sha,
        `fix(links): remplace ${changed} lien${changed > 1 ? 's' : ''} cassé${changed > 1 ? 's' : ''} par leur archive Wayback`
      );
      console.log(`  ✓ [${done}/${byFile.size}] ${path} : ${changed} fix${changed > 1 ? 's' : ''} commit (sha ${(newSha || '').slice(0, 7)})`);
      log.push({ path, status: 'ok', changed, sha: newSha, subs });
      success++;
      // Petite pause pour ne pas saturer l'API GitHub
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.log(`  ✗ [${done}/${byFile.size}] ${path} : ${err.message}`);
      log.push({ path, status: 'error', error: err.message, subs });
      failed++;
    }
  }

  console.log(`\n══ TERMINÉ : ${success} OK, ${failed} échecs ══`);

  // Sauvegarde un log
  await mkdir('reports', { recursive: true });
  const logPath = `reports/fix-broken-links-${new Date().toISOString().slice(0, 10)}.json`;
  await writeFile(logPath, JSON.stringify({
    appliedAt: new Date().toISOString(),
    fixable: fixable.length,
    noArchive: noArchive.length,
    files: byFile.size,
    success,
    failed,
    log,
    noArchiveUrls: noArchive.map(n => n.url),
  }, null, 2));
  console.log(`Log → ${logPath}`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(2);
});
