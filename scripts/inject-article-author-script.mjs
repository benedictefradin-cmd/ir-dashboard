#!/usr/bin/env node
// ─── Chantier C — Inject article-author.js dans les pages existantes ───
// Pour chaque /publications/*.html du repo site, ajoute le tag <script>
// pointant vers assets/js/article-author.js (avant </body>) si absent.
//
// Idempotent : ré-exécutable sans effet.
//
// Usage : node scripts/inject-article-author-script.mjs [--site-repo <path>] [--dry-run]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const siteRepoArg = args.indexOf('--site-repo');
const siteRepo = siteRepoArg >= 0
  ? args[siteRepoArg + 1]
  : path.resolve(__dirname, '..', '..', 'institut-rousseau');

const pubDir = path.join(siteRepo, 'publications');
if (!fs.existsSync(pubDir)) {
  console.error(`✗ Introuvable : ${pubDir}`);
  process.exit(1);
}

const TAG = '<script defer src="../assets/js/article-author.js?v=1"></script>';
const MARKER_RE = /<script[^>]+article-author\.js/;

const files = fs.readdirSync(pubDir).filter(f => f.endsWith('.html'));
console.log(`→ ${files.length} pages publications à scanner`);

let alreadyOk = 0, injected = 0, missingBody = 0;

for (const f of files) {
  const fp = path.join(pubDir, f);
  const html = fs.readFileSync(fp, 'utf8');
  if (MARKER_RE.test(html)) { alreadyOk++; continue; }
  if (!html.includes('</body>')) { missingBody++; continue; }
  const next = html.replace('</body>', TAG + '\n</body>');
  if (!dryRun) fs.writeFileSync(fp, next, 'utf8');
  injected++;
}

console.log(`✓ Déjà à jour    : ${alreadyOk}`);
console.log(`✓ Injectés       : ${injected}${dryRun ? ' (dry-run)' : ''}`);
if (missingBody) console.log(`⚠ Sans </body>   : ${missingBody}`);
