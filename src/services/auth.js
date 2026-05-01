// ─── Auth service ─────────────────────────────────────
// Communique avec /api/auth/* du Worker Cloudflare.
// Token stocké dans localStorage (clé `ir_auth_token`).

import { loadLocal, saveLocal, removeLocal } from '../utils/localStorage';
import { DEFAULT_WORKER_URL, LS_KEYS } from '../utils/constants';

const TOKEN_KEY = 'ir_auth_token';

function getWorkerUrl() {
  return loadLocal(LS_KEYS.workerUrl, null) || DEFAULT_WORKER_URL;
}

export function getToken() {
  return loadLocal(TOKEN_KEY, null);
}

export function setToken(token) {
  if (token) saveLocal(TOKEN_KEY, token);
  else removeLocal(TOKEN_KEY);
}

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
