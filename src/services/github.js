// ─── Service GitHub ────────────────────────────────────
// Tous les appels GitHub passent désormais par le Cloudflare Worker, qui
// utilise le secret server-side env.GITHUB_PAT. Plus aucun token n'est lu
// côté navigateur : le bundle JS public ne contient aucun PAT.
//
// L'API publique (noms de fonctions exportées) est préservée pour minimiser
// les changements en cascade dans les pages.

import JSON5 from 'json5';
import { loadLocal } from '../utils/localStorage';
import { LS_KEYS, DEFAULT_WORKER_URL } from '../utils/constants';
import { gitHubAuthHeaders } from './githubAuth';

function getWorkerUrl() {
  return loadLocal(LS_KEYS.workerUrl, null) || DEFAULT_WORKER_URL;
}

/**
 * Indique si le dashboard peut parler à GitHub via le Worker.
 * Vérification synchrone (présence d'une URL Worker). Le statut réel du
 * secret GITHUB_PAT côté Worker est exposé par /api/health ; ici on reste
 * optimiste — les requêtes qui aboutiraient sans secret échouent naturellement
 * en 503 avec un message clair côté UI.
 */
export function hasGitHub() {
  return !!getWorkerUrl();
}

function handleHttpError(status, fallback) {
  if (status === 401) return 'Non autorisé (vérifier le token côté Worker)';
  if (status === 403) return 'Accès refusé ou limite atteinte';
  if (status === 404) return 'Fichier non trouvé';
  if (status === 409) return 'Conflit : le fichier a été modifié entre-temps. Rechargez et réessayez.';
  if (status === 503) return 'GitHub non configuré côté Worker (secret GITHUB_PAT manquant).';
  return fallback || `Erreur ${status}`;
}

async function workerFetch(endpoint, opts = {}) {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) throw new Error('URL du Worker non configurée');
  const resp = await fetch(`${workerUrl}${endpoint}`, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Si l'utilisateur est connecté en OAuth GitHub, on envoie son token
      // pour que les commits soient attribués à son compte. Sinon le Worker
      // tombe sur le PAT serveur (env.GITHUB_PAT).
      ...gitHubAuthHeaders(),
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!resp.ok) {
    let msg;
    try {
      const err = await resp.json();
      msg = err.error;
    } catch { /* pas de JSON */ }
    throw new Error(handleHttpError(resp.status, msg));
  }
  return resp.json();
}

/**
 * Lit un fichier texte du repo site.
 * @param {string} path - Chemin relatif (ex: 'data/publications.json')
 * @returns {Promise<{ content: string, sha: string }>}
 */
export async function githubGetFile(path) {
  const data = await workerFetch(`/api/github/contents/${encodeURI(path)}`);
  return { content: data.content, sha: data.sha };
}

/**
 * Écrit un fichier texte sur le repo site (crée un commit).
 * @param {string} path - Chemin relatif
 * @param {string} content - Contenu UTF-8
 * @param {string|null} sha - SHA actuel (null si nouveau fichier)
 * @param {string} message - Message de commit
 * @returns {Promise<string|null>} - Nouveau SHA
 */
export async function githubPutFile(path, content, sha, message) {
  const data = await workerFetch(`/api/github/contents/${encodeURI(path)}`, {
    method: 'PUT',
    body: { content, sha: sha || undefined, message },
  });
  return data.sha || null;
}

/**
 * Supprime un fichier du repo site.
 */
export async function githubDeleteFile(path, sha, message) {
  await workerFetch(`/api/github/contents/${encodeURI(path)}`, {
    method: 'DELETE',
    body: { sha, message },
  });
  return true;
}

/**
 * Liste le contenu d'un dossier du repo site.
 * @returns {Promise<Array<{ name, path, type, size, sha }>>}
 */
export async function githubListDir(path) {
  const data = await workerFetch(`/api/github/list/${encodeURI(path)}`);
  return data.items || [];
}

// ─── Cache en mémoire pour les images chargées via le Worker ───
const imageCache = new Map(); // path → Promise<dataUrl>

/**
 * Invalide une entrée du cache d'images (à appeler après upload d'une nouvelle
 * photo pour le même chemin).
 */
export function invalidateImageCache(path) {
  if (path) imageCache.delete(path);
  else imageCache.clear();
}

/**
 * Charge une image binaire depuis le repo site via le Worker authentifié et
 * retourne un data URL (base64). Le repo étant privé, raw.githubusercontent.com
 * n'est pas utilisable.
 * @param {string} path - Chemin dans le repo (ex: 'assets/images/equipe/x.png')
 * @returns {Promise<string>} data URL prêt à mettre dans <img src>
 */
export function githubGetImageDataUrl(path) {
  if (!path) return Promise.resolve('');
  if (path.startsWith('http') || path.startsWith('data:')) return Promise.resolve(path);
  if (imageCache.has(path)) return imageCache.get(path);

  const p = workerFetch(`/api/github/contents/${encodeURI(path)}?binary=1`)
    .then(data => data.dataUrl)
    .catch(err => {
      imageCache.delete(path);
      console.warn(`[github] Échec chargement image ${path}:`, err.message);
      throw err;
    });

  imageCache.set(path, p);
  return p;
}

/**
 * Upload une image (binaire) sur le repo site.
 * @param {string} path - Chemin (ex: 'assets/images/auteurs/nicolas-dufrene.jpg')
 * @param {string} base64Content - Contenu encodé en base64 (sans préfixe data:)
 * @param {string} [message] - Message de commit
 * @returns {Promise<{ sha: string|null, url: string }>}
 */
export async function githubUploadImage(path, base64Content, message) {
  const data = await workerFetch(`/api/github/contents/${encodeURI(path)}`, {
    method: 'PUT',
    body: {
      base64: base64Content,
      message: message || `Ajout image : ${path}`,
    },
  });
  // Invalide le cache : la photo précédente à ce chemin est obsolète.
  invalidateImageCache(path);
  invalidateImageCache(`assets/${path}`);
  return { sha: data.sha || null, url: '' };
}

/**
 * Insère du HTML avant le dernier </section> d'un fichier du site.
 * Utilisé pour l'ajout legacy de cards dans publications.html / presse.html.
 */
export async function insertHtmlInPage(path, cardHtml, commitMessage) {
  const file = await githubGetFile(path);
  let html = file.content;
  const insertPoint = html.lastIndexOf('</section>');
  if (insertPoint > -1) {
    html = html.slice(0, insertPoint) + cardHtml + '\n' + html.slice(insertPoint);
  } else {
    html += cardHtml;
  }
  return githubPutFile(path, html, file.sha, commitMessage);
}

/**
 * Sauvegarde le tableau d'auteurs dans `data/auteurs.json` du repo site.
 * (Ancienne version écrivait `src/data/authors.json` du repo dashboard,
 * ce qui mélangeait code et données — corrigé dans ce refactor.)
 */
export async function saveAuthorsToGitHub(authors) {
  const cleanAuthors = authors.map(({ id, firstName, lastName, role, photo, bio, email, publications }) => ({
    id,
    firstName,
    lastName,
    role,
    photo: photo || '',
    bio: bio || '',
    email: email || '',
    publications: publications || 0,
  }));
  const filePath = 'data/auteurs.json';
  let sha = null;
  try {
    const existing = await githubGetFile(filePath);
    sha = existing.sha;
  } catch { /* nouveau fichier */ }
  return githubPutFile(
    filePath,
    JSON.stringify(cleanAuthors, null, 2) + '\n',
    sha,
    'Mise à jour data/auteurs.json depuis le back-office'
  );
}

/**
 * Lit l'entrée de traduction d'un slug dans `assets/js/publications-i18n.js`.
 * Retourne `{ title_en, description_en, body_en, title_es, ... }` ou `{}`.
 * Best-effort : ne lève pas si le fichier est absent ou mal formé.
 */
export async function fetchPublicationI18n(slug) {
  try {
    const file = await githubGetFile('assets/js/publications-i18n.js');
    const match = file.content.match(/window\.PUB_I18N\s*=\s*([\s\S]*?);\s*$/);
    if (!match) return {};
    const obj = JSON5.parse(match[1]);
    return obj[slug] || {};
  } catch {
    return {};
  }
}

/**
 * Met à jour le fichier `assets/js/publications-i18n.js` pour ajouter ou
 * remplacer les traductions d'un slug.
 *
 * Le fichier source utilise une syntaxe JS-objet (clés non-quotées, virgules
 * traînantes). On le parse avec JSON5 (au lieu de l'ancien `new Function`,
 * cf. AUDIT §4.7) puis on merge et on réécrit en JSON strict.
 */
export async function updatePublicationsI18n(slug, entry) {
  const path = 'assets/js/publications-i18n.js';
  const file = await githubGetFile(path);

  const match = file.content.match(/window\.PUB_I18N\s*=\s*([\s\S]*?);\s*$/);
  if (!match) throw new Error('Format inattendu dans publications-i18n.js');

  let obj;
  try {
    obj = JSON5.parse(match[1]);
  } catch (e) {
    throw new Error(`Parsing publications-i18n.js : ${e.message}`);
  }

  obj[slug] = {
    ...(obj[slug] || {}),
    ...Object.fromEntries(
      Object.entries(entry).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ),
  };

  const header = `/* ============================================
   Publications i18n — EN/ES/DE/IT translations
   for titles, descriptions and bodies
   ============================================ */
`;
  const newContent = `${header}window.PUB_I18N = ${JSON.stringify(obj, null, 2)};\n`;
  return githubPutFile(path, newContent, file.sha, `Traductions publication : ${slug}`);
}

/**
 * Met à jour `assets/js/publications-data.js` pour enregistrer une nouvelle
 * publication dans la liste officielle du site.
 */
export async function updatePublicationsData(entry) {
  const path = 'assets/js/publications-data.js';
  const file = await githubGetFile(path);

  const match = file.content.match(/window\.PUBLICATIONS_DATA\s*=\s*(\[[\s\S]*\])\s*;?\s*$/);
  if (!match) throw new Error('Format inattendu dans publications-data.js');

  let arr;
  try {
    arr = JSON.parse(match[1]);
  } catch {
    // Fallback tolérant : JSON5 accepte les clés non-quotées et les virgules
    // traînantes du JS, sans exécuter de code (contrairement à `new Function`).
    try {
      arr = JSON5.parse(match[1]);
    } catch (e) {
      throw new Error(`Parsing publications-data.js : ${e.message}`);
    }
  }

  const idx = arr.findIndex(p => p.id === entry.id);
  if (idx >= 0) {
    arr[idx] = { ...arr[idx], ...entry };
  } else {
    arr.unshift(entry);
  }

  const newContent = `window.PUBLICATIONS_DATA = ${JSON.stringify(arr, null, 2)};\n`;
  return githubPutFile(path, newContent, file.sha, `Publication ajoutée : ${entry.title}`);
}

// ─── Helpers d'affichage ───────────────────────────────

// Couleur par défaut selon la première catégorie (matche les couleurs utilisées dans publications-data.js).
export function categoryColor(category) {
  const c = (category || '').toLowerCase();
  if (c.includes('econom')) return '#2563EB';
  if (c.includes('ecolog')) return '#16A34A';
  if (c.includes('institution')) return '#D97706';
  if (c.includes('international')) return '#0EA5E9';
  if (c.includes('social')) return '#C1121F';
  if (c.includes('culture')) return '#8B5CF6';
  return '#1B2A4A';
}

/**
 * Formate la date en français pour l'affichage sur le site.
 */
export function formatDateSite(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
