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
  if (status === 401) return 'Token invalide \u2014 v\u00e9rifiez vos identifiants';
  if (status === 403) return 'Acc\u00e8s refus\u00e9 ou limite d\u2019appels atteinte';
  if (status === 404) return 'Ressource non trouv\u00e9e';
  if (status === 429) return 'Trop de requ\u00eates \u2014 r\u00e9essayez dans quelques secondes';
  if (status === 503) return 'Service non configur\u00e9 sur le Worker';
  if (status >= 500) return 'Erreur serveur \u2014 r\u00e9essayez plus tard';
  return `Erreur\u00a0${status}`;
}

async function request(endpoint, options = {}) {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) {
    throw new ApiError('URL du Worker non configur\u00e9e. Allez dans Param\u00e8tres.', 0, endpoint);
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
 * V\u00e9rifie si le Worker est joignable et quels services sont configur\u00e9s.
 * @returns {{ status: string, services: { helloasso: boolean, brevo: boolean, telegram: boolean } }}
 */
export async function checkHealth() {
  return api.get('/api/health');
}

export default api;
