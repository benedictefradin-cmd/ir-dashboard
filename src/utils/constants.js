// ─── Palette Institut Rousseau ────────────────────────
export const COLORS = {
  navy: '#1a2744',
  navyLight: '#243356',
  sky: '#4a90d9',
  skyLight: '#EBF4FF',
  terra: '#c45a3c',
  terraLight: '#FEF2F0',
  ochre: '#d4a843',
  ochreLight: '#FFF9E6',
  green: '#2D8659',
  greenLight: '#ECFDF5',
  cream: '#f7f4ee',
  white: '#ffffff',
  bg: '#f7f4ee',
  border: '#E5E7EB',
  text: '#1a2744',
  textLight: '#6B7280',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  sand: '#F5F0E8',
  grayText: '#6B6560',
};

// ─── Navigation (groupée) ─────────────────────────────
export const NAV_GROUPS = [
  {
    key: 'main',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: '⌂' },
    ],
  },
  {
    key: 'editorial',
    label: 'Éditorial',
    defaultOpen: true,
    items: [
      { key: 'articles', label: 'Publications', icon: '\u{1F4C4}' },
      { key: 'evenements', label: 'Événements', icon: '\u{1F4C5}' },
      { key: 'presse', label: 'Presse', icon: '\u{1F4F0}' },
      { key: 'auteurs', label: 'Auteurs', icon: '\u{1F465}' },
    ],
  },
  {
    key: 'communication',
    label: 'Communication',
    defaultOpen: false,
    items: [
      { key: 'newsletter', label: 'Newsletter', icon: '✉' },
      { key: 'messagerie', label: 'Messagerie', icon: '\u{1F4AC}' },
      { key: 'calendrier', label: 'Calendrier', icon: '\u{1F5D3}' },
      { key: 'sollicitations', label: 'Sollicitations', icon: '\u{1F4EC}' },
    ],
  },
  {
    key: 'site',
    label: 'Site & Config',
    defaultOpen: false,
    items: [
      { key: 'pagessite', label: 'Pages du site', icon: '\u{1F3E0}' },
      { key: 'seo', label: 'SEO', icon: '\u{1F50D}' },
      { key: 'medias', label: 'Médias', icon: '\u{1F5BC}' },
      { key: 'technique', label: 'Technique', icon: '\u{2699}' },
      { key: 'settings', label: 'Config', icon: '⚙' },
    ],
  },
];

// Flat array pour rétrocompatibilité des badges
export const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items);

// ─── Catégories et sources ──────────────────────────
export const CATEGORIES = [
  'Économie', 'Écologie', 'Social', 'Numérique', 'Géopolitique', 'Démocratie',
];

export const THEMATIQUES = [
  'Écologie', 'Économie', 'Institutions', 'Social', 'International', 'Culture et Controverses',
];

export const PUB_TYPES = ['Note d\'analyse', 'Point de vue', 'Rapport', 'Rapport phare', 'Tribune'];

export const SOURCES = ['Site web', 'Événement', 'LinkedIn', 'Manuel', 'Brevo'];

// ─── Statuts ──────────────────────────────────────────
export const ARTICLE_STATUSES = {
  draft: { label: 'Brouillon', badgeClass: 'badge-gray' },
  review: { label: 'À relire', badgeClass: 'badge-ochre' },
  ready: { label: 'Prêt à publier', badgeClass: 'badge-amber' },
  scheduled: { label: 'Programmé', badgeClass: 'badge-sky' },
  published: { label: 'Publié', badgeClass: 'badge-green' },
  archived: { label: 'Archivé', badgeClass: 'badge-gray' },
};

export const SUB_STATUSES = {
  added: { label: 'Ajouté', badgeClass: 'badge-green' },
  pending: { label: 'En attente', badgeClass: 'badge-ochre' },
  rejected: { label: 'Refusé', badgeClass: 'badge-danger' },
};

export const EVT_TYPES = ['Conférence', 'Atelier', 'Salon', 'Cycle', 'Anniversaire', 'Partenariat'];

export const EVT_STATUSES = {
  confirme: { label: 'Confirmé', badgeClass: 'badge-green' },
  en_preparation: { label: 'En préparation', badgeClass: 'badge-ochre' },
  annule: { label: 'Annulé', badgeClass: 'badge-terra' },
  passe: { label: 'Passé', badgeClass: 'badge-gray' },
};

export const PRESSE_TYPES = ['Tribune', 'Entretien', 'Podcast'];

export const CONTACT_SUBJECTS = [
  { key: 'general', label: 'Question générale' },
  { key: 'presse', label: 'Demande presse / média' },
  { key: 'partenariat', label: 'Partenariat' },
  { key: 'evenement', label: 'Événement' },
  { key: 'newsletter', label: 'Newsletter' },
  { key: 'autre', label: 'Autre' },
];

export const SOLLICITATION_STATUSES = {
  new: { label: 'Nouveau', badgeClass: 'badge-sky', color: '#4a90d9' },
  in_progress: { label: 'En cours', badgeClass: 'badge-ochre', color: '#d4a843' },
  resolved: { label: 'Résolu', badgeClass: 'badge-green', color: '#2d8a4e' },
  archived: { label: 'Archivé', badgeClass: 'badge-gray', color: '#8a8a8a' },
};

export const SOLLICITATION_PRIORITIES = {
  low: { label: 'Basse', badgeClass: 'badge-gray' },
  normal: { label: 'Normale', badgeClass: 'badge-sky' },
  high: { label: 'Haute', badgeClass: 'badge-ochre' },
  urgent: { label: 'Urgente', badgeClass: 'badge-danger' },
};

export const SOLLICITATION_ADMINS = ['Michel', 'Bénédicte', 'Guillaume'];

// Legacy compat
export const CONTACT_STATUSES = {
  nouveau: { label: 'Nouveau', badgeClass: 'badge-sky' },
  lu: { label: 'Lu', badgeClass: 'badge-ochre' },
  traite: { label: 'Traité', badgeClass: 'badge-green' },
  a_suivre: { label: 'À suivre', badgeClass: 'badge-terra' },
};

// ─── Templates email ──────────────────────────────────
export const EMAIL_TEMPLATES = {
  publication: {
    name: 'Nouvelle publication',
    subject: '{titre_article} — Nouvelle publication',
    body: `Bonjour,

L’Institut Rousseau publie aujourd’hui une nouvelle note :

{titre_article}
Par {auteur}

{extrait}...

→ Lire la publication : {lien_article}

Bonne lecture,
L’Institut Rousseau`,
  },
};

// ─── Langues du site ─────────────────────────────────
export const SITE_LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷', isSource: true },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

export const TARGET_LANGUAGES = SITE_LANGUAGES.filter(l => !l.isSource);
export const SOURCE_LANGUAGE = SITE_LANGUAGES.find(l => l.isSource);

// ─── LocalStorage keys ────────────────────────────────
export const LS_PREFIX = 'ir-dash-';
export const LS_KEYS = {
  activeTab: 'active-tab',
  operator: 'operator',
  workerUrl: 'worker-url',
  telegramBotToken: 'tg-bot-token',
  telegramChatId: 'tg-chat-id',
  telegramChannelId: 'tg-channel-id',
  sidebarCollapsed: 'sidebar-collapsed',
  socialPosts: 'social-posts',
  rapportsFondations: 'rapports-fondations',
  extEvents: 'ext-events',
  vercelDeployHook: 'vercel-deploy-hook',
  contactAuthToken: 'contact-auth-token',
};

// ─── Config par défaut ──────────────────────────────
export const DEFAULT_WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
export const DEFAULT_GITHUB_OWNER = import.meta.env.VITE_GITHUB_OWNER || 'benedictefradin-cmd';
export const DEFAULT_GITHUB_SITE_REPO = import.meta.env.VITE_GITHUB_SITE_REPO || 'institut-rousseau';
export const DEFAULT_PAGE_SIZE = 50;

// ─── Site URL ────────────────────────────────────────
export const SITE_URL = 'https://institut-rousseau-kb9p.vercel.app';

// ─── Photo helpers ───────────────────────────────────
const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${DEFAULT_GITHUB_OWNER}/${DEFAULT_GITHUB_SITE_REPO}/main`;

/**
 * Résout un chemin de photo vers une URL affichable.
 * Gère les URLs absolues, les chemins assets/*, et les chemins relatifs.
 */
export function resolvePhotoUrl(photo) {
  if (!photo) return '';
  if (photo.startsWith('http')) return photo;
  if (photo.startsWith('assets/')) return `${GITHUB_RAW_BASE}/${photo.replace('assets/', '')}`;
  if (photo.startsWith('images/')) return `${GITHUB_RAW_BASE}/${photo}`;
  return `${SITE_URL}/${photo}`;
}

/**
 * Normalise un nom complet pour comparaison (minuscules, sans accents, trimmed).
 */
export function normalizeName(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/**
 * Compare deux noms (prénom+nom) de façon exacte après normalisation.
 */
export function namesMatch(prenom1, nom1, prenom2, nom2) {
  const a = normalizeName(`${prenom1} ${nom1}`);
  const b = normalizeName(`${prenom2} ${nom2}`);
  return a && b && a === b;
}

/**
 * Trouve les publications liées à un auteur par correspondance exacte du nom complet.
 * Gère les champs auteur multi-noms séparés par virgule, & ou "et".
 * @param {{ firstName: string, lastName: string }} auteur
 * @param {Array<{ author?: string }>} articles
 * @returns {Array}
 */
export function findPublicationsForAuthor(auteur, articles) {
  if (!auteur || !articles?.length) return [];
  const fullName = normalizeName(`${auteur.firstName} ${auteur.lastName}`);
  if (!fullName) return [];
  return articles.filter(art => {
    if (!art.author) return false;
    const authorNames = art.author.split(/,|&|\bet\b/).map(s => normalizeName(s));
    return authorNames.some(an => an === fullName);
  });
}

/**
 * Génère un chemin canonique pour la photo d'une personne.
 * @param {'equipe' | 'auteurs'} folder — 'equipe' si membre de l'équipe, 'auteurs' sinon
 */
export function canonicalPhotoPath(prenom, nom, extension = 'jpg', folder = 'equipe') {
  const slug = `${prenom}-${nom}`.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `assets/images/${folder}/${slug}.${extension}`;
}
