// ─── Site Data Service ─────────────────────────────────
// Lit et écrit les fichiers JSON de données du site via l'API GitHub
// (passe par le Worker ou directement via GitHub API).
// Quand on sauvegarde, un commit est créé → Vercel redéploie le site.

import { githubGetFile, githubPutFile, hasGitHub } from './github';
import { resolvePhotoUrl } from '../utils/constants';

const DATA_PATH = 'data';

// ─── Cache pour stocker les SHA et éviter des requêtes inutiles ───
const shaCache = {};

/**
 * Lit un fichier JSON depuis le repo du site.
 * @param {'publications' | 'events' | 'presse' | 'auteurs'} dataType
 * @returns {Promise<Array>}
 */
export async function fetchSiteData(dataType) {
  if (!hasGitHub()) return { data: [], sha: null };
  const filePath = `${DATA_PATH}/${dataType}.json`;
  try {
    const { content, sha } = await githubGetFile(filePath);
    const data = JSON.parse(content);
    shaCache[dataType] = sha;
    return { data, sha };
  } catch (err) {
    console.warn(`[siteData] Impossible de charger ${dataType}:`, err.message);
    return { data: [], sha: null };
  }
}

/**
 * Écrit un fichier JSON dans le repo du site (crée un commit).
 * @param {'publications' | 'events' | 'presse' | 'auteurs'} dataType
 * @param {Array} data
 * @param {string} [message] - Message de commit
 * @returns {Promise<{ success: boolean, sha?: string }>}
 */
export async function saveSiteData(dataType, data, message) {
  if (!hasGitHub()) throw new Error('GitHub non configuré');
  const filePath = `${DATA_PATH}/${dataType}.json`;
  const content = JSON.stringify(data, null, 2);
  const commitMsg = message || `Mise à jour ${dataType} depuis le back-office`;

  // Utiliser le SHA en cache ou récupérer le nouveau
  let sha = shaCache[dataType];
  if (!sha) {
    try {
      const file = await githubGetFile(filePath);
      sha = file.sha;
    } catch { /* nouveau fichier */ }
  }

  const newSha = await githubPutFile(filePath, content, sha, commitMsg);
  shaCache[dataType] = newSha;
  return { success: true, sha: newSha };
}

/**
 * Lit le fichier contenu.json (textes statiques du site).
 * @returns {Promise<{ data: Object, sha: string|null }>}
 */
export async function fetchContenu() {
  if (!hasGitHub()) return { data: {}, sha: null };
  const filePath = `${DATA_PATH}/contenu.json`;
  try {
    const { content, sha } = await githubGetFile(filePath);
    const data = JSON.parse(content);
    shaCache['contenu'] = sha;
    return { data, sha };
  } catch (err) {
    console.warn('[siteData] Impossible de charger contenu:', err.message);
    return { data: {}, sha: null };
  }
}

/**
 * Charge toutes les données du site en parallèle.
 * @returns {Promise<{ publications: Array, events: Array, presse: Array, auteurs: Array, contenu: Object }>}
 */
export async function fetchAllSiteData() {
  const [pubResult, evtResult, presseResult, auteursResult, contenuResult] = await Promise.all([
    fetchSiteData('publications'),
    fetchSiteData('events'),
    fetchSiteData('presse'),
    fetchSiteData('auteurs'),
    fetchContenu(),
  ]);

  return {
    publications: pubResult.data,
    events: evtResult.data,
    presse: presseResult.data,
    auteurs: auteursResult.data,
    contenu: contenuResult.data,
  };
}

/**
 * Normalise les publications du site vers le format attendu par le dashboard.
 */
export function normalizePublications(pubs) {
  return pubs.map((p, i) => ({
    id: p.id || `pub-${i}`,
    title: p.title || '',
    author: p.author || '',
    date: p.date || '',
    tags: (p.categories || p.themes || []).map(c =>
      c.charAt(0).toUpperCase() + c.slice(1).replace('ecologie', 'Écologie').replace('economie', 'Économie')
    ),
    summary: p.description || p.excerpt || '',
    content: '',
    type: p.type || 'Note',
    pdfUrl: '',
    status: 'published',
    slug: p.slug || p.id,
    url: p.url || '',
    featured: p.featured || false,
    readingTime: p.readingTime || null,
  }));
}

/**
 * Normalise les événements du site vers le format attendu par le dashboard.
 */
export function normalizeEvents(events) {
  return events.map((e, i) => ({
    id: e.id || `evt-${i}`,
    date: e.date || '',
    type: e.type || 'Conférence',
    title: e.title || '',
    sousTitre: e.sousTitre || '',
    lieu: e.lieu || '',
    intervenants: e.intervenants || [],
    partenaire: e.partenaire || '',
    description: e.description || '',
    lienInscription: e.lienInscription || '',
    lienConcours: e.lienConcours || '',
    status: e.status || 'confirme',
    externe: e.externe || false,
    periode: e.periode || '',
  }));
}

/**
 * Normalise les mentions presse du site vers le format attendu par le dashboard.
 */
export function normalizePresse(presse) {
  return presse.map((p, i) => ({
    id: p.id || `presse-${i}`,
    type: p.type || 'Tribune',
    title: p.title || '',
    auteur: p.auteur || '',
    media: p.media || '',
    date: p.date || '',
    url: p.url || '',
    urlInterne: p.urlInterne || '',
  }));
}

/**
 * Normalise les auteurs du site vers le format attendu par le dashboard.
 */
export function normalizeAuteurs(auteurs) {
  return auteurs.map(a => ({
    id: a.id || `${a.firstName}-${a.lastName}`.toLowerCase().replace(/\s+/g, '-'),
    firstName: a.firstName || '',
    lastName: a.lastName || '',
    name: `${a.firstName || ''} ${a.lastName || ''}`.trim(),
    role: a.role || '',
    titre: a.role || '',
    bio: a.bio || '',
    photo: resolvePhotoUrl(a.photo),
    photoPath: a.photo || '',
    publications: a.publications || 0,
  }));
}
