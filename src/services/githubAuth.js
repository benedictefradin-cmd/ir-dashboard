// ─── Auth OAuth GitHub ────────────────────────────────
// Le flow démarre par un lien vers le Worker qui redirige vers GitHub. Au
// retour, le Worker pousse le token + login en hash params (#token=...&login=...).
// Le front lit ces hash params au démarrage, les stocke en sessionStorage,
// puis nettoie l'URL. Le token est envoyé au Worker dans X-GitHub-User-Token
// pour que les commits soient attribués à l'utilisateur connecté.

import { loadLocal } from '../utils/localStorage';
import { DEFAULT_WORKER_URL, LS_KEYS } from '../utils/constants';

// sessionStorage : vidé à la fermeture du tab, plus sûr que localStorage
// pour un secret de durée de vie limitée (cf. brief).
const SS_KEY_TOKEN = 'ir_gh_token';
const SS_KEY_USER = 'ir_gh_user';

function getWorkerUrl() {
  return loadLocal(LS_KEYS.workerUrl, null) || DEFAULT_WORKER_URL;
}

/**
 * Récupère le token OAuth GitHub courant (ou null).
 * @returns {string|null}
 */
export function getGitHubToken() {
  try {
    return sessionStorage.getItem(SS_KEY_TOKEN);
  } catch {
    return null;
  }
}

/**
 * Récupère l'utilisateur GitHub courant (ou null).
 * @returns {{ login, name, avatar }|null}
 */
export function getGitHubUser() {
  try {
    const raw = sessionStorage.getItem(SS_KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Lance le flow OAuth GitHub : redirige le navigateur vers /api/auth/github/start.
 * Le retour se fait sur la même origine via hash params (cf. consumeOAuthHash).
 */
export function startGitHubLogin() {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) {
    throw new Error('URL du Worker non configurée');
  }
  const dashboardUrl = window.location.origin + window.location.pathname;
  const url = new URL(`${workerUrl}/api/auth/github/start`);
  url.searchParams.set('redirect', dashboardUrl);
  window.location.href = url.toString();
}

/**
 * À appeler une seule fois au démarrage de l'app : si l'URL contient des hash
 * params OAuth (#token=...&login=...), on les déplace vers sessionStorage et
 * on nettoie l'URL pour ne pas laisser le token dans l'historique du navigateur.
 * @returns {{ login, name, avatar }|null} - L'utilisateur connecté, ou null
 */
export function consumeOAuthHash() {
  if (!window.location.hash || window.location.hash.length < 2) return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get('token');
  const login = params.get('login');
  if (!token || !login) return null;

  const user = {
    login,
    name: params.get('name') || login,
    avatar: params.get('avatar') || '',
  };
  try {
    sessionStorage.setItem(SS_KEY_TOKEN, token);
    sessionStorage.setItem(SS_KEY_USER, JSON.stringify(user));
  } catch { /* private mode ou storage disabled */ }

  // Nettoyage de l'URL — le token ne doit pas rester dans l'history.
  // history.replaceState évite un reload et laisse le pathname intact.
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return user;
}

/**
 * Déconnecte l'utilisateur GitHub : supprime le token + user de sessionStorage.
 */
export async function gitHubLogout() {
  try {
    sessionStorage.removeItem(SS_KEY_TOKEN);
    sessionStorage.removeItem(SS_KEY_USER);
  } catch { /* ignore */ }
  // Notification au Worker (réservé pour révocation future).
  try {
    const workerUrl = getWorkerUrl();
    if (workerUrl) {
      await fetch(`${workerUrl}/api/auth/github/logout`, { method: 'POST' });
    }
  } catch { /* offline ou worker indisponible */ }
}

/**
 * Headers à ajouter aux requêtes Worker /api/github/* pour qu'elles utilisent
 * le token de l'utilisateur connecté (commits attribués à son nom).
 */
export function gitHubAuthHeaders() {
  const token = getGitHubToken();
  return token ? { 'X-GitHub-User-Token': token } : {};
}
