// ─── Calendar API ──────────────────────────────────────
// Persiste les données du calendrier (posts sociaux, rapports, événements
// extérieurs) dans le Worker KV. L'auth (Bearer session) est injectée par
// `api.js`.

import api from './api';

const TYPES = ['socialPosts', 'rapports', 'extEvents'];

export async function fetchCalendar(type) {
  if (!TYPES.includes(type)) throw new Error(`Type inconnu : ${type}`);
  const res = await api.get(`/api/calendar/${type}`);
  return res.items || [];
}

export async function saveCalendar(type, items) {
  if (!TYPES.includes(type)) throw new Error(`Type inconnu : ${type}`);
  return api.put(`/api/calendar/${type}`, { items });
}

export async function fetchAllCalendar() {
  const [socialPosts, rapports, extEvents] = await Promise.all(
    TYPES.map(t => fetchCalendar(t).catch(() => null))
  );
  return { socialPosts, rapports, extEvents };
}
