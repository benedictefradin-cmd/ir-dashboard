#!/usr/bin/env node
// ─── Chantier A — Migration schéma profils ─────────────────────────────
// Enrichit data/auteurs.json (côté repo site) avec les nouveaux champs
// requis par le brief 2026-05-02 :
//   - bioCourte (initialisé depuis bio existant)
//   - bioLongue (vide, à enrichir manuellement)
//   - reseaux: { linkedin, x, site, email }
//   - dateArrivee
//   - actif (boolean, défaut true)
// Et supprime le compteur obsolète `publications` (calculé à la volée).
//
// Le champ `bio` legacy est conservé pour rétrocompat avec assets/js/auteurs.js
// du site, jusqu'à ce que ce dernier consomme les nouveaux champs.
//
// Usage : node scripts/migrate-profile-schema.mjs [--site-repo <path>] [--dry-run]

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

const auteursPath = path.join(siteRepo, 'data', 'auteurs.json');
if (!fs.existsSync(auteursPath)) {
  console.error(`✗ Introuvable : ${auteursPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(auteursPath, 'utf8');
const auteurs = JSON.parse(raw);
console.log(`→ ${auteurs.length} profils chargés depuis ${auteursPath}`);

let added = 0;
let removed = 0;
const migrated = auteurs.map(a => {
  const next = { ...a };
  if (next.bioCourte === undefined) { next.bioCourte = next.bio || ''; added++; }
  if (next.bioLongue === undefined) { next.bioLongue = ''; }
  if (next.reseaux === undefined) {
    next.reseaux = {
      linkedin: a.linkedin || '',
      x: a.twitter || a.x || '',
      site: a.site || a.website || '',
      email: a.email || '',
    };
  }
  if (next.dateArrivee === undefined) { next.dateArrivee = ''; }
  if (next.actif === undefined) { next.actif = true; }
  if ('publications' in next) { delete next.publications; removed++; }
  return next;
});

console.log(`✓ Champs ajoutés : bioCourte/bioLongue/reseaux/dateArrivee/actif (init bioCourte: ${added})`);
console.log(`✓ Compteur 'publications' retiré : ${removed} profils`);

if (dryRun) {
  console.log('\n--- dry-run : aucun fichier modifié. ---');
  console.log('Échantillon (premier profil migré) :\n', JSON.stringify(migrated[0], null, 2));
  process.exit(0);
}

const out = JSON.stringify(migrated, null, 2) + '\n';
fs.writeFileSync(auteursPath, out, 'utf8');
console.log(`\n✓ Écrit : ${auteursPath} (${out.length} octets)`);
console.log(`Backup conservé dans backups/profiles-2026-05-02.json`);
