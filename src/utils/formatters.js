// ─── Dates ────────────────────────────────────────────
export function formatDateFr(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function timeAgo(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  const diffD = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 1) return "à l’instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffH < 24) return `il y a ${diffH} h`;
  if (diffD === 0) return "aujourd’hui";
  if (diffD === 1) return 'hier';
  if (diffD < 30) return `il y a ${diffD} jours`;
  if (diffD < 60) return 'il y a 1 mois';
  const months = Math.floor(diffD / 30);
  if (months < 12) return `il y a ${months} mois`;
  return `il y a ${Math.floor(diffD / 365)} an(s)`;
}

// ─── Texte ────────────────────────────────────────────
export function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function truncate(str, maxLen = 150) {
  if (!str || str.length <= maxLen) return str || '';
  return str.slice(0, maxLen).trimEnd() + '…';
}

export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Variation pourcentage ────────────────────────────
export function calcVariation(current, previous) {
  if (!previous || previous === 0) return { pct: 0, direction: 'neutral' };
  const pct = Math.round(((current - previous) / previous) * 100);
  return {
    pct: Math.abs(pct),
    direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral',
  };
}
