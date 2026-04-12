import api from './api';

// ─── HelloAsso via Cloudflare Worker ──────────────────

export async function fetchAdherents(page = 1, pageSize = 50) {
  const result = await api.get(`/api/helloasso/adhesions?pageIndex=${page}&pageSize=${pageSize}`);
  return result; // { items: [...], pagination: { totalCount, pageIndex, pageSize, totalPages } }
}

export async function fetchDons(page = 1, pageSize = 50) {
  const result = await api.get(`/api/helloasso/dons?pageIndex=${page}&pageSize=${pageSize}`);
  return result;
}

export async function fetchMembers(page = 1, pageSize = 50) {
  const result = await api.get(`/api/helloasso/members?pageIndex=${page}&pageSize=${pageSize}`);
  return result;
}

export async function fetchPayments(page = 1, pageSize = 50) {
  const result = await api.get(`/api/helloasso/payments?pageIndex=${page}&pageSize=${pageSize}`);
  return result;
}

/**
 * Charge toutes les adh\u00e9sions + dons et les fusionne.
 */
export async function fetchAllHelloAsso() {
  const [adhesions, dons] = await Promise.allSettled([
    fetchAdherents(1, 100),
    fetchDons(1, 100),
  ]);

  const items = [];
  if (adhesions.status === 'fulfilled') items.push(...(adhesions.value.items || []));
  if (dons.status === 'fulfilled') items.push(...(dons.value.items || []));

  // D\u00e9doublonner par email en gardant la plus r\u00e9cente
  const byEmail = new Map();
  for (const item of items) {
    const existing = byEmail.get(item.email);
    if (!existing || new Date(item.date) > new Date(existing.date)) {
      byEmail.set(item.email, item);
    }
  }

  // Mais on veut TOUTES les transactions, pas juste la derni\u00e8re par email
  // Retournons tout, tri\u00e9 par date d\u00e9croissante
  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  return items;
}
