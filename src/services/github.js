// ─── GitHub API — Publication directe sur le site ─────
// Utilise le token VITE_GITHUB_TOKEN pour lire/écrire les fichiers HTML
// du repo institut-rousseau via l'API GitHub Contents.

const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN || '';
const GITHUB_REPO = 'benedictefradin-cmd/institut-rousseau';
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
 * Formate la date en français pour l'affichage sur le site.
 */
export function formatDateSite(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
