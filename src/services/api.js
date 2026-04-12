// ─── API Wrapper ──────────────────────────────────────
// Tous les appels vers les services externes passent par le Cloudflare Worker.

import { loadLocal } from '../utils/localStorage';
import { LS_KEYS, DEFAULT_WORKER_URL } from '../utils/constants';

function getWorkerUrl() {
  return loadLocal(LS_KEYS.workerUrl, null) || DEFAULT_WORKER_URL;
}

export class ApiError extends Error {
  constructor(message, status, endpoint) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
  }
}

function errorMessage(status) {
  if (status === 401) return 'Token invalide — vérifiez vos identifiants';
  if (status === 403) return 'Accès refusé ou limite d’appels atteinte';
  if (status === 404) return 'Ressource non trouvée';
  if (status === 429) return 'Trop de requêtes — réessayez dans quelques secondes';
  if (status === 503) return 'Service non configuré sur le Worker';
  if (status >= 500) return 'Erreur serveur — réessayez plus tard';
  return `Erreur ${status}`;
}

async function request(endpoint, options = {}) {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) {
    throw new ApiError('URL du Worker non configurée. Allez dans Paramètres.', 0, endpoint);
  }

  const url = `${workerUrl}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  };

  const resp = await fetch(url, config);

  if (!resp.ok) {
    let msg = errorMessage(resp.status);
    try {
      const body = await resp.json();
      if (body.error) msg = body.error;
    } catch { /* ignore */ }
    throw new ApiError(msg, resp.status, endpoint);
  }

  return resp.json();
}

export const api = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (endpoint, body) => request(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
};

/**
 * Vérifie si le Worker est joignable et quels services sont configurés.
 * @returns {{ status: string, services: { brevo: boolean, telegram: boolean } }}
 */
export async function checkHealth() {
  return api.get('/api/health');
}

export default api;
