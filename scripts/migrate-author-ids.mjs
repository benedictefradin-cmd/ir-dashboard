#!/usr/bin/env node
// ─── Chantier B — Migration relation Publication ↔ Auteur par ID ────
// Pour chaque publication dans `assets/js/publications-data.js` :
//   - split le champ `author` (séparateurs , & et and)
//   - match tolérant sur `data/auteurs.json` (lower + sans accents)
//   - écrit `authorIds: [id1, id2, ...]` (toujours un tableau)
//   - garde `author` en miroir lisible humain pour rétrocompat
//
// Cas non-matchés / ambigus → `AUTHORS_MIGRATION.md` à la racine du repo
// dashboard (à valider à la main).
//
// Usage : node scripts/migrate-author-ids.mjs [--site-repo <path>] [--dry-run]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSON5 from 'json5';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const siteRepoArg = args.indexOf('--site-repo');
const siteRepo = siteRepoArg >= 0
  ? args[siteRepoArg + 1]
  : path.resolve(__dirname, '..', '..', 'institut-rousseau');
const dashboardRoot = path.resolve(__dirname, '..');

const auteursPath = path.join(siteRepo, 'data', 'auteurs.json');
const pubsPath = path.join(siteRepo, 'assets', 'js', 'publications-data.js');

if (!fs.existsSync(auteursPath)) { console.error(`✗ ${auteursPath}`); process.exit(1); }
if (!fs.existsSync(pubsPath)) { console.error(`✗ ${pubsPath}`); process.exit(1); }

const auteurs = JSON.parse(fs.readFileSync(auteursPath, 'utf8'));
const pubsRaw = fs.readFileSync(pubsPath, 'utf8');

const m = pubsRaw.match(/window\.PUBLICATIONS_DATA\s*=\s*(\[[\s\S]*\])\s*;?\s*$/);
if (!m) { console.error('✗ Format inattendu dans publications-data.js'); process.exit(1); }
let pubs;
try { pubs = JSON.parse(m[1]); }
catch { pubs = JSON5.parse(m[1]); }

console.log(`→ ${auteurs.length} profils, ${pubs.length} publications chargés`);

function norm(s) {
  return (s || '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, ' ').trim();
}

const profileByName = new Map();
for (const a of auteurs) {
  const k = norm(`${a.firstName || ''} ${a.lastName || ''}`);
  if (k) profileByName.set(k, a);
}

const SEPARATORS = / *(?:,|&| et | and ) */;

function lookupOne(part) {
  const k = norm(part);
  if (!k) return { kind: 'empty' };
  if (profileByName.has(k)) return { kind: 'match', id: profileByName.get(k).id };
  // Fuzzy : profil dont la clé contient ou est contenue (mais pas trop court)
  if (k.length >= 4) {
    const candidates = [...profileByName.entries()]
      .filter(([pk]) => pk.includes(k) || k.includes(pk));
    if (candidates.length === 1) return { kind: 'match', id: candidates[0][1].id };
    if (candidates.length > 1) return { kind: 'ambiguous', candidates: candidates.map(([, a]) => a.id) };
  }
  return { kind: 'unmatched' };
}

const report = { auto: 0, manual: [], unmatched: [], multi: 0 };
const migrated = pubs.map(p => {
  const raw = (p.author || '').trim();
  const parts = raw.split(SEPARATORS).filter(Boolean);
  if (parts.length > 1) report.multi++;
  const ids = [];
  const issues = [];
  for (const part of parts) {
    const r = lookupOne(part);
    if (r.kind === 'match') ids.push(r.id);
    else if (r.kind === 'ambiguous') issues.push({ part, kind: 'ambiguous', candidates: r.candidates });
    else if (r.kind === 'unmatched') issues.push({ part, kind: 'unmatched' });
  }
  if (issues.length === 0) report.auto++;
  else if (issues.some(i => i.kind === 'unmatched')) report.unmatched.push({ pub: p.id, raw, issues });
  else report.manual.push({ pub: p.id, raw, issues });
  return { ...p, authorIds: ids };
});

console.log(`✓ Match auto (toutes parts résolues) : ${report.auto}/${pubs.length}`);
console.log(`⚠ À valider manuellement (ambiguïtés)  : ${report.manual.length}`);
console.log(`⚠ Sans match (à créer un profil)       : ${report.unmatched.length}`);
console.log(`ℹ Publications avec 2+ co-auteurs      : ${report.multi}`);

const mdLines = [
  '# Migration auteurs → IDs — rapport (Chantier B)',
  '',
  `Généré le ${new Date().toISOString()} par \`scripts/migrate-author-ids.mjs\`.`,
  '',
  `- ${report.auto} publications migrées automatiquement`,
  `- ${report.manual.length} publications à valider manuellement (ambiguïtés)`,
  `- ${report.unmatched.length} publications sans match (créer un profil ou corriger l'auteur)`,
  '',
];

if (report.unmatched.length) {
  mdLines.push('## Sans match — créer un profil ou corriger l\'auteur');
  mdLines.push('');
  for (const r of report.unmatched) {
    mdLines.push(`- **${r.pub}** — auteur saisi : \`${r.raw}\``);
    for (const i of r.issues) {
      if (i.kind === 'unmatched') mdLines.push(`  - \`${i.part}\` → aucun profil`);
      if (i.kind === 'ambiguous') mdLines.push(`  - \`${i.part}\` → ambigu : ${i.candidates.join(', ')}`);
    }
  }
  mdLines.push('');
}

if (report.manual.length) {
  mdLines.push('## Ambiguïtés — choisir un candidat');
  mdLines.push('');
  for (const r of report.manual) {
    mdLines.push(`- **${r.pub}** — auteur saisi : \`${r.raw}\``);
    for (const i of r.issues) {
      mdLines.push(`  - \`${i.part}\` → candidats : ${i.candidates.join(', ')}`);
    }
  }
  mdLines.push('');
}

const mdPath = path.join(dashboardRoot, 'AUTHORS_MIGRATION.md');
const willWriteMd = report.manual.length || report.unmatched.length;

if (dryRun) {
  console.log('\n--- dry-run : aucun fichier modifié. ---');
  console.log('\nÉchantillon (3 premières publis migrées) :');
  for (const p of migrated.slice(0, 3)) {
    console.log(`  ${p.id}: author="${p.author}" → authorIds=${JSON.stringify(p.authorIds)}`);
  }
  if (willWriteMd) console.log(`\nRapport Markdown qui serait écrit : ${mdPath}\n`);
  process.exit(0);
}

const newContent = `window.PUBLICATIONS_DATA = ${JSON.stringify(migrated, null, 2)};\n`;
fs.writeFileSync(pubsPath, newContent, 'utf8');
console.log(`\n✓ Écrit : ${pubsPath}`);

if (willWriteMd) {
  fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf8');
  console.log(`✓ Rapport : ${mdPath}`);
} else if (fs.existsSync(mdPath)) {
  fs.unlinkSync(mdPath);
}
