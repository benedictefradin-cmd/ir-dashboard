// ─── Contact / Sollicitations API ─────────────────────
// Endpoints pour les sollicitations via le Cloudflare Worker.
// L'auth (Bearer session) est injectée par `api.js`.

import api from './api';

/**
 * Liste paginée des sollicitations.
 * @param {Object} params - { status, subject, page, limit, search }
 */
export async function fetchSollicitations(params = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.subject) qs.set('subject', params.subject);
  if (params.page) qs.set('page', params.page);
  if (params.limit) qs.set('limit', params.limit);
  if (params.search) qs.set('search', params.search);
  return api.get(`/api/contact/list?${qs.toString()}`);
}

/**
 * Détail d'une sollicitation.
 */
export async function fetchSollicitation(id) {
  return api.get(`/api/contact/${encodeURIComponent(id)}`);
}

/**
 * Mise à jour partielle d'une sollicitation (statut, assignation, notes, tags…).
 */
export async function updateSollicitation(id, updates) {
  return api.patch(`/api/contact/${encodeURIComponent(id)}`, updates);
}

/**
 * Envoyer une réponse par email via Brevo.
 * @param {Object} payload - { text, sent_by, cc?: [{email,name}], bcc?: [{email,name}] }
 */
export async function replySollicitation(id, { text, sent_by, cc, bcc }) {
  return api.post(`/api/contact/${encodeURIComponent(id)}/reply`, { text, sent_by, cc, bcc });
}

/**
 * Supprimer (soft delete → archived).
 */
export async function deleteSollicitation(id) {
  return api.patch(`/api/contact/${encodeURIComponent(id)}`, { status: 'archived' });
}

/**
 * Routing CC par type d'objet (Chantier 4) — KV `config:messageRouting`.
 */
export async function fetchMessageRouting() {
  return api.get('/api/messages/routing');
}

export async function saveMessageRouting(routing) {
  return api.put('/api/messages/routing', { routing });
}
