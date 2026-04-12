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
};

// ─── Navigation ───────────────────────────────────────
export const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'adherents', label: 'Adh\u00e9rents', icon: 'people' },
  { key: 'newsletter', label: 'Newsletter', icon: 'mail' },
  { key: 'articles', label: 'Articles', icon: 'article' },
  { key: 'messagerie', label: 'Messagerie', icon: 'send' },
  { key: 'settings', label: 'Param\u00e8tres', icon: 'settings' },
];

// ─── Cat\u00e9gories et sources ──────────────────────────
export const CATEGORIES = [
  '\u00c9conomie', '\u00c9cologie', 'Social', 'Num\u00e9rique', 'G\u00e9opolitique', 'D\u00e9mocratie',
];

export const SOURCES = ['Site web', '\u00c9v\u00e9nement', 'LinkedIn', 'Manuel', 'HelloAsso', 'Brevo'];

// ─── Statuts ──────────────────────────────────────────
export const ADHERENT_STATUSES = {
  actif: { label: 'Actif', badgeClass: 'badge-green' },
  expire: { label: 'Expir\u00e9', badgeClass: 'badge-terra' },
  en_attente: { label: 'En attente', badgeClass: 'badge-ochre' },
};

export const ARTICLE_STATUSES = {
  draft: { label: 'Brouillon', badgeClass: 'badge-gray' },
  review: { label: '\u00c0 relire', badgeClass: 'badge-ochre' },
  ready: { label: 'Pr\u00eat', badgeClass: 'badge-sky' },
  published: { label: 'Publi\u00e9', badgeClass: 'badge-green' },
};

export const SUB_STATUSES = {
  added: { label: 'Ajout\u00e9', badgeClass: 'badge-green' },
  pending: { label: 'En attente', badgeClass: 'badge-ochre' },
  rejected: { label: 'Refus\u00e9', badgeClass: 'badge-danger' },
};

// ─── Templates email ──────────────────────────────────
export const EMAIL_TEMPLATES = {
  bienvenue: {
    name: 'Bienvenue adh\u00e9rent',
    subject: 'Bienvenue \u00e0 l\u2019Institut Rousseau\u00a0!',
    body: `Bonjour {pr\u00e9nom},

Votre adh\u00e9sion \u00e0 l\u2019Institut Rousseau a bien \u00e9t\u00e9 enregistr\u00e9e. Merci pour votre engagement\u00a0!

En tant que membre, vous recevrez\u00a0:
\u2014 Notre newsletter mensuelle avec nos derni\u00e8res publications
\u2014 Des invitations \u00e0 nos \u00e9v\u00e9nements (ateliers, conf\u00e9rences, rencontres)
\u2014 Un acc\u00e8s privil\u00e9gi\u00e9 \u00e0 nos travaux en avant-premi\u00e8re

\u00c0 tr\u00e8s bient\u00f4t,
L\u2019\u00e9quipe de l\u2019Institut Rousseau

institut-rousseau.fr`,
  },
  renouvellement: {
    name: 'Rappel de renouvellement',
    subject: 'Votre adh\u00e9sion arrive \u00e0 \u00e9ch\u00e9ance',
    body: `Bonjour {pr\u00e9nom},

Votre adh\u00e9sion \u00e0 l\u2019Institut Rousseau expire le {date_expiration}.

Pour continuer \u00e0 soutenir nos travaux et rester membre de notre communaut\u00e9 de {nombre_membres} adh\u00e9rents, renouvelez votre adh\u00e9sion\u00a0:

\u2192 Renouveler mon adh\u00e9sion\u00a0: {lien_helloasso}

Merci pour votre fid\u00e9lit\u00e9,
L\u2019Institut Rousseau`,
  },
  publication: {
    name: 'Nouvelle publication',
    subject: '{titre_article} \u2014 Nouvelle publication',
    body: `Bonjour,

L\u2019Institut Rousseau publie aujourd\u2019hui une nouvelle note\u00a0:

\ud83d\udcc4 {titre_article}
Par {auteur}

{extrait}...

\u2192 Lire la publication\u00a0: {lien_article}

Bonne lecture,
L\u2019Institut Rousseau`,
  },
};

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
};

// ─── Config par d\u00e9faut ──────────────────────────────
export const DEFAULT_WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
export const DEFAULT_PAGE_SIZE = 50;
