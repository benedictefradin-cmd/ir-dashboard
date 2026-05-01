// ─── Auth service ─────────────────────────────────────
// Communique avec /api/auth/* du Worker Cloudflare.
// Token stocké en sessionStorage : vidé à la fermeture de l'onglet, pas
// partagé entre onglets, et cohérent avec le brief sécurité (cf. AUDIT §4.2).

import { loadLocal } from '../utils/localStorage';
import { DEFAULT_WORKER_URL, LS_KEYS, LS_PREFIX } from '../utils/constants';

const TOKEN_KEY = `${LS_PREFIX}ir_auth_token`;

function getWorkerUrl() {
  return loadLocal(LS_KEYS.workerUrl, null) || DEFAULT_WORKER_URL;
}

export function getToken() {
  try {
    const v = sessionStorage.getItem(TOKEN_KEY);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* private mode / quota */ }
}

// Migration unique : si l'ancien token traîne en localStorage, on le bascule
// en sessionStorage la première fois et on purge la clé persistante.
try {
  const legacy = localStorage.getItem(TOKEN_KEY);
  if (legacy) {
    if (!sessionStorage.getItem(TOKEN_KEY)) {
      sessionStorage.setItem(TOKEN_KEY, legacy);
    }
    localStorage.removeItem(TOKEN_KEY);
  }
} catch { /* ignore (SSR / quota) */ }

async function authFetch(endpoint, { method = 'GET', body, withAuth = true } = {}) {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) throw new Error('URL du Worker non configurée');
  const headers = { 'Content-Type': 'application/json' };
  if (withAuth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const resp = await fetch(`${workerUrl}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await resp.json(); } catch { /* ignore */ }
  if (!resp.ok) {
    // Token invalidé côté serveur (admin reset, suppression de compte, expiration) :
    // on purge le token local et on prévient l'app pour repasser sur l'écran de login.
    if (resp.status === 401 && withAuth && getToken()) {
      setToken(null);
      try { window.dispatchEvent(new CustomEvent('auth:invalidated')); } catch { /* SSR */ }
    }
    const err = new Error((data && data.error) || `Erreur ${resp.status}`);
    err.status = resp.status;
    throw err;
  }
  return data;
}

export async function login(loginId, password) {
  const data = await authFetch('/api/auth/login', {
    method: 'POST',
    body: { login: loginId, password },
    withAuth: false,
  });
  if (data?.token) setToken(data.token);
  return data;
}

export async function logout() {
  try {
    await authFetch('/api/auth/logout', { method: 'POST' });
  } catch { /* token déjà invalide */ }
  setToken(null);
}

export async function fetchMe() {
  return authFetch('/api/auth/me');
}

export async function changeMyPassword(currentPassword, newPassword) {
  return authFetch('/api/auth/me/password', {
    method: 'PATCH',
    body: { currentPassword, newPassword },
  });
}

export async function listUsers() {
  return authFetch('/api/auth/users');
}

export async function createUser({ login: loginId, name, password, role }) {
  return authFetch('/api/auth/users', {
    method: 'POST',
    body: { login: loginId, name, password, role },
  });
}

export async function updateUser(id, updates) {
  return authFetch(`/api/auth/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: updates,
  });
}

export async function deleteUser(id) {
  return authFetch(`/api/auth/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
