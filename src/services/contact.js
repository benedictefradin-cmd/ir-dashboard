// ─── Contact / Sollicitations API ─────────────────────
// Endpoints pour les sollicitations via le Cloudflare Worker.

import api from './api';
import { loadLocal } from '../utils/localStorage';
import { LS_KEYS } from '../utils/constants';

function authHeaders() {
  const token = loadLocal(LS_KEYS.contactAuthToken, '');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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
  return api.get(`/api/contact/list?${qs.toString()}`, { headers: authHeaders() });
}

/**
 * Détail d'une sollicitation.
 */
export async function fetchSollicitation(id) {
  return api.get(`/api/contact/${encodeURIComponent(id)}`, { headers: authHeaders() });
}

/**
 * Mise à jour partielle d'une sollicitation (statut, assignation, notes, tags…).
 */
export async function updateSollicitation(id, updates) {
  return api.patch(`/api/contact/${encodeURIComponent(id)}`, updates, { headers: authHeaders() });
}

/**
 * Envoyer une réponse par email via Brevo.
 */
export async function replySollicitation(id, { text, sent_by }) {
  return api.post(`/api/contact/${encodeURIComponent(id)}/reply`, { text, sent_by }, { headers: authHeaders() });
}

/**
 * Supprimer (soft delete → archived).
 */
export async function deleteSollicitation(id) {
  return api.patch(`/api/contact/${encodeURIComponent(id)}`, { status: 'archived' }, { headers: authHeaders() });
}
