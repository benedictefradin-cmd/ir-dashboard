// ─── GitHub API — Publication directe sur le site ─────
// Utilise le token VITE_GITHUB_TOKEN pour lire/écrire les fichiers HTML
// du repo institut-rousseau via l'API GitHub Contents.

const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN || '';
const GITHUB_OWNER = import.meta.env.VITE_GITHUB_OWNER || 'benedictefradin-cmd';
const GITHUB_SITE_REPO = import.meta.env.VITE_GITHUB_SITE_REPO || 'institut-rousseau';
const GITHUB_REPO = `${GITHUB_OWNER}/${GITHUB_SITE_REPO}`;
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/contents`;

export function hasGitHub() {
  return GITHUB_TOKEN && GITHUB_TOKEN !== 'VOTRE_TOKEN' && GITHUB_TOKEN !== 'MON_TOKEN';
}

function handleHttpError(status) {
  if (status === 401) return 'Token GitHub invalide';
  if (status === 403) return 'Accès refusé ou limite atteinte';
  if (status === 404) return 'Fichier non trouvé';
  if (status === 409) return 'Conflit — rechargez la page';
  return `Erreur ${status}`;
}

function decodeContent(base64) {
  return decodeURIComponent(escape(atob(base64.replace(/\n/g, ''))));
}

export async function githubGetFile(path) {
  const res = await fetch(`${GITHUB_API}/${path}`, {
    headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' },
  });
  if (!res.ok) throw new Error(handleHttpError(res.status));
  const data = await res.json();
  return { content: decodeContent(data.content), sha: data.sha };
}

// ─── Cache en mémoire pour les images chargées via l'API (repo privé) ───
const imageCache = new Map(); // path → Promise<dataUrl>

/**
 * Charge une image binaire depuis le repo site via l'API GitHub authentifiée
 * et retourne un data URL (base64). Utilisé pour contourner l'inaccessibilité
 * de raw.githubusercontent.com sur les repos privés.
 * @param {string} path - Chemin dans le repo (ex: 'assets/images/equipe/x.png')
 * @returns {Promise<string>} data URL prêt à être mis dans un <img src>
 */
export function githubGetImageDataUrl(path) {
  if (!path) return Promise.resolve('');
  if (path.startsWith('http') || path.startsWith('data:')) return Promise.resolve(path);
  if (imageCache.has(path)) return imageCache.get(path);

  const p = (async () => {
    const res = await fetch(`${GITHUB_API}/${path}`, {
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' },
    });
    if (!res.ok) throw new Error(handleHttpError(res.status));
    const data = await res.json();
    const base64 = (data.content || '').replace(/\n/g, '');
    const ext = (path.split('.').pop() || 'jpg').toLowerCase();
    const mime = ext === 'png' ? 'image/png'
      : ext === 'webp' ? 'image/webp'
      : ext === 'svg' ? 'image/svg+xml'
      : ext === 'gif' ? 'image/gif'
      : 'image/jpeg';
    return `data:${mime};base64,${base64}`;
  })().catch(err => {
    imageCache.delete(path); // permet de retenter après échec
    throw err;
  });

  imageCache.set(path, p);
  return p;
}

export async function githubPutFile(path, content, sha, message) {
  const body = {
    message: message || `Mise à jour de ${path} depuis le back-office`,
    content: btoa(unescape(encodeURIComponent(content))),
    branch: 'main',
  };
  if (sha) body.sha = sha;
  const res = await fetch(`${GITHUB_API}/${path}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(handleHttpError(res.status));
  const data = await res.json();
  return data.content?.sha || null;
}

/**
 * Insère du HTML avant le dernier </section> d'un fichier du site.
 * @param {string} path - Chemin du fichier (ex: 'evenements.html')
 * @param {string} cardHtml - HTML à insérer
 * @param {string} commitMessage - Message de commit
 * @returns {string|null} - Nouveau SHA ou null en cas d'erreur
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
 * Upload une image (fichier binaire) sur le repo GitHub.
 * @param {string} path - Chemin dans le repo (ex: 'images/auteurs/nicolas-dufrene.jpg')
 * @param {string} base64Content - Contenu du fichier encodé en base64 (sans préfixe data:…)
 * @param {string} [message] - Message de commit
 * @returns {{ sha: string, url: string }} - SHA du fichier et URL brute
 */
export async function githubUploadImage(path, base64Content, message) {
  // Vérifier si le fichier existe déjà (pour récupérer le SHA)
  let existingSha = null;
  try {
    const res = await fetch(`${GITHUB_API}/${path}`, {
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' },
    });
    if (res.ok) {
      const data = await res.json();
      existingSha = data.sha;
    }
  } catch { /* fichier n'existe pas encore */ }

  const body = {
    message: message || `Ajout photo auteur : ${path}`,
    content: base64Content,
    branch: 'main',
  };
  if (existingSha) body.sha = existingSha;

  const res = await fetch(`${GITHUB_API}/${path}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(handleHttpError(res.status));
  const data = await res.json();

  const rawUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${path}`;
  return { sha: data.content?.sha || null, url: rawUrl };
}

/**
 * Sauvegarde le fichier authors.json dans le repo ir-dashboard via l'API GitHub.
 * Utilise le token + owner configurés dans Settings (pas VITE_GITHUB_TOKEN).
 * @param {Array} authors - Tableau d'auteurs à sauvegarder
 * @returns {string|null} - SHA du commit ou null
 */
export async function saveAuthorsToGitHub(authors) {
  const readLS = (key) => { try { const v = localStorage.getItem('ir-dash-' + key); return v ? JSON.parse(v) : ''; } catch { return ''; } };
  const token = readLS('ir_github_token') || GITHUB_TOKEN;
  const owner = readLS('ir_github_owner') || GITHUB_OWNER;
  if (!token || !owner) throw new Error('Token ou owner GitHub non configuré');

  const repo = 'ir-dashboard';
  const path = 'src/data/authors.json';
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' };

  // Récupérer le SHA actuel du fichier
  let sha = null;
  try {
    const res = await fetch(apiUrl, { headers });
    if (res.ok) {
      const data = await res.json();
      sha = data.sha;
    }
  } catch { /* fichier n'existe pas encore */ }

  // Préparer le contenu (auteurs clean sans champs d'affichage temporaires)
  const cleanAuthors = authors.map(({ id, firstName, lastName, role, photo, bio, email, publications }) => ({
    id, firstName, lastName, role, photo: photo || '', bio: bio || '', email: email || '', publications: publications || 0,
  }));

  const content = btoa(unescape(encodeURIComponent(JSON.stringify(cleanAuthors, null, 2) + '\n')));

  const body = {
    message: 'Mise à jour authors.json depuis le back-office',
    content,
    branch: 'main',
  };
  if (sha) body.sha = sha;

  const res = await fetch(apiUrl, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(handleHttpError(res.status));
  const data = await res.json();
  return data.content?.sha || null;
}

/**
 * Formate la date en français pour l'affichage sur le site.
 */
export function formatDateSite(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
