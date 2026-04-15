// ─── Calendar API ──────────────────────────────────────
// Persiste les données du calendrier (posts sociaux, rapports, événements
// extérieurs) dans le Worker KV. Les réponses sont aussi mises en cache
// localStorage pour le mode offline / premier rendu.

import api from './api';
import { loadLocal } from '../utils/localStorage';
import { LS_KEYS } from '../utils/constants';

const TYPES = ['socialPosts', 'rapports', 'extEvents'];

function authHeaders() {
  const token = loadLocal(LS_KEYS.contactAuthToken, '');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchCalendar(type) {
  if (!TYPES.includes(type)) throw new Error(`Type inconnu : ${type}`);
  const res = await api.get(`/api/calendar/${type}`, { headers: authHeaders() });
  return res.items || [];
}

export async function saveCalendar(type, items) {
  if (!TYPES.includes(type)) throw new Error(`Type inconnu : ${type}`);
  return api.put(`/api/calendar/${type}`, { items }, { headers: authHeaders() });
}

export async function fetchAllCalendar() {
  const [socialPosts, rapports, extEvents] = await Promise.all(
    TYPES.map(t => fetchCalendar(t).catch(() => null))
  );
  return { socialPosts, rapports, extEvents };
}
