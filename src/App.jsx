import { useState, useEffect, useCallback, useRef } from 'react';
import './styles.css';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Articles from './pages/Articles';
import Newsletter from './pages/Newsletter';
import Messagerie from './pages/Messagerie';
import Settings from './pages/Settings';
import Evenements from './pages/Evenements';
import Presse from './pages/Presse';
import Auteurs from './pages/Auteurs';
import Contenu from './pages/Contenu';
import Sollicitations from './pages/Sollicitations';
import { checkHealth } from './services/api';
import { fetchContacts, fetchCampaigns } from './services/brevo';
import { loadLocal, saveLocal } from './utils/localStorage';
import { LS_KEYS, COLORS } from './utils/constants';
import useNotionSync from './hooks/useNotionSync';
import authorsData from './data/authors.json';

// ─── DEMO DATA ─────────────────────────────────────────
const DEMO_ARTICLES = [
  { id: 1, title: '\u00c9tats-Unis hors-la-loi, hors climat : quelles cons\u00e9quences pour l\u2019Europe ?', author: 'Nicolas Dufr\u00eane', date: '2025-03-15', tags: ['\u00c9cologie', 'Institutions'], summary: 'Analyse des cons\u00e9quences du retrait am\u00e9ricain des accords climatiques.', content: '', type: 'Note d\'analyse', pdfUrl: '', status: 'published' },
  { id: 2, title: 'Relancer l\u2019offensive climatique europ\u00e9enne par des obligations cibl\u00e9es', author: 'Simon Pujau', date: '2025-02-20', tags: ['\u00c9cologie', '\u00c9conomie'], summary: 'Propositions pour financer la transition via des obligations vertes.', content: '', type: 'Note d\'analyse', pdfUrl: '', status: 'published' },
  { id: 3, title: '\u00c9conomie circulaire : une critique n\u00e9cessaire', author: 'Arthur Boutiab', date: '2025-01-10', tags: ['\u00c9conomie', '\u00c9cologie'], summary: 'Retour critique sur les limites du mod\u00e8le d\u2019\u00e9conomie circulaire actuel.', content: '', type: 'Point de vue', pdfUrl: '', status: 'published' },
  { id: 4, title: 'Souverainet\u00e9 num\u00e9rique et communs digitaux', author: 'Nicolas Music', date: '2026-04-01', tags: ['Culture'], summary: 'Pour une politique europ\u00e9enne des communs num\u00e9riques.', content: '', type: 'Note d\'analyse', pdfUrl: '', status: 'draft' },
  { id: 5, title: 'L\u2019avenir de la protection sociale', author: 'Chlo\u00e9 Music', date: '2026-04-05', tags: ['Social'], summary: 'Repenser le mod\u00e8le social fran\u00e7ais face aux mutations du travail.', content: '', type: 'Point de vue', pdfUrl: '', status: 'review' },
  { id: 6, title: 'Planification \u00e9cologique : bilan d\u2019un an', author: 'Pierre Music', date: '2026-04-08', tags: ['\u00c9cologie'], summary: 'Bilan de la premi\u00e8re ann\u00e9e de planification \u00e9cologique en France.', content: '', type: 'Note d\'analyse', pdfUrl: '', status: 'ready' },
];

const DEMO_EVENTS = [
  { id: 1, date: '2026-04-27', type: 'Conf\u00e9rence', title: 'La d\u00e9croissance', sousTitre: 'Cycle avec Les Canaux (1/4)', lieu: 'Les Canaux, 6 Quai de la Seine, 75019 Paris', intervenants: [], partenaire: 'Les Canaux', description: 'Premier volet du cycle de conf\u00e9rences sur la d\u00e9croissance.', lienInscription: '', lienConcours: '', status: 'confirme' },
  { id: 2, date: '2026-06-03', type: 'Salon', title: 'Les think tanks, faiseurs de lois ?', sousTitre: 'Salon Affaires Publiques', lieu: 'Salon Affaires Publiques & Influences, Paris', intervenants: [], partenaire: '', description: 'Participation au Salon Affaires Publiques & Influences.', lienInscription: '', lienConcours: '', status: 'confirme' },
  { id: 3, date: '2026-06-09', type: 'Cycle', title: 'D\u00e9mocratie et droit d\u2019amendement citoyen', sousTitre: 'Cycle Paris 1/3', lieu: 'CAP, 181 av Daumesnil, 75012 Paris', intervenants: [{ name: 'Beverley Toudic', titre: 'Directrice adjointe' }, { name: 'Mila Jeudy', titre: '' }], partenaire: 'Ville de Paris', description: 'Cycle de conf\u00e9rences sur la d\u00e9mocratie locale en partenariat avec la Ville de Paris.', lienInscription: '', lienConcours: '', status: 'confirme' },
  { id: 4, date: '2026-09-15', type: 'Conf\u00e9rence', title: 'La pr\u00e9somption d\u2019innocence', sousTitre: 'Rencontres Culture & Controverse', lieu: '\u00c0 confirmer', intervenants: [{ name: 'Gabrielle Barnaud', titre: '' }, { name: 'Magali Lafourcade', titre: 'Secr\u00e9taire g\u00e9n\u00e9rale CNCDH' }, { name: '\u00c9milie Lory', titre: 'M\u00e9diation' }], partenaire: '', description: 'D\u00e9bat autour de la pr\u00e9somption d\u2019innocence.', lienInscription: '', lienConcours: '', status: 'en_preparation' },
  { id: 5, date: '2026-10-01', type: 'Cycle', title: 'La transition \u00e9cologique \u00e0 Paris', sousTitre: 'Cycle Paris 2/3', lieu: 'Climate House, Paris', intervenants: [], partenaire: 'Ville de Paris', description: 'Deuxi\u00e8me volet du cycle parisien sur la transition \u00e9cologique.', lienInscription: '', lienConcours: '', status: 'en_preparation' },
  { id: 6, date: '2026-11-15', type: 'Cycle', title: 'Les politiques publiques sociales', sousTitre: 'Cycle Paris 3/3', lieu: 'Th\u00e9\u00e2tre de la Concorde (sous r\u00e9serve)', intervenants: [], partenaire: 'Ville de Paris', description: 'Troisi\u00e8me volet du cycle parisien sur les politiques sociales.', lienInscription: '', lienConcours: '', status: 'en_preparation' },
];

const DEMO_PRESSE = [
  { id: 1, type: 'Tribune', title: 'Institut Rousseau : un think tank au service de la reconstruction', auteur: 'Nicolas Dufr\u00eane', media: 'Le Monde', date: '2026-03-15', url: '', urlInterne: '' },
  { id: 2, type: 'Entretien', title: 'Les propositions de l\u2019IR pour le climat', auteur: 'Chlo\u00e9 Ridel', media: 'Mediapart', date: '2026-02-20', url: '', urlInterne: '' },
  { id: 3, type: 'Tribune', title: 'Road to Net Zero : le plan de d\u00e9carbonation', auteur: 'Ga\u00ebl Giraud', media: 'Les \u00c9chos', date: '2026-01-10', url: '', urlInterne: '' },
  { id: 4, type: 'Entretien', title: 'R\u00e9forme des institutions : les id\u00e9es de l\u2019IR', auteur: 'Beverley Toudic', media: 'Lib\u00e9ration', date: '2025-12-05', url: '', urlInterne: '' },
  { id: 5, type: 'Tribune', title: '\u00c9conomie circulaire : les limites point\u00e9es', auteur: 'Arthur Boutiab', media: 'Alternatives \u00c9conomiques', date: '2025-11-18', url: '', urlInterne: '' },
  { id: 6, type: 'Podcast', title: 'Souverainet\u00e9 num\u00e9rique — \u00c9pisode 1', auteur: '', media: 'Spotify', date: '2025-10-22', url: '', urlInterne: '' },
  { id: 7, type: 'Tribune', title: 'Militer pour la souverainet\u00e9 num\u00e9rique', auteur: 'Nicolas Music', media: 'La Tribune', date: '2025-10-01', url: '', urlInterne: '' },
  { id: 8, type: 'Entretien', title: 'L\u2019\u00e9cologie au c\u0153ur de la relance', auteur: 'L\u00e9a Falco', media: 'France Inter', date: '2025-09-15', url: '', urlInterne: '' },
  { id: 9, type: 'Podcast', title: 'Think tanks et politique \u2014 \u00c9pisode 2', auteur: '', media: 'Spotify', date: '2025-08-20', url: '', urlInterne: '' },
  { id: 10, type: 'Tribune', title: 'Pour un Green New Deal europ\u00e9en', auteur: 'Simon Pujau', media: 'The Conversation', date: '2025-07-10', url: '', urlInterne: '' },
];

// Authors loaded from src/data/authors.json — fallback to inline demo
const DEMO_AUTEURS = authorsData.length ? authorsData.map(a => ({
  ...a,
  name: `${a.firstName} ${a.lastName}`,
  titre: a.role,
})) : [
  { id: 'marine-yzquierdo', firstName: 'Marine', lastName: 'Yzquierdo', name: 'Marine Yzquierdo', role: 'Spécialiste travail et environnement', titre: 'Spécialiste travail et environnement', photo: '', bio: '', publications: 3 },
  { id: 'nicolas-dufrene', firstName: 'Nicolas', lastName: 'Dufrêne', name: 'Nicolas Dufrêne', role: 'Directeur de l\u2019Institut Rousseau', titre: 'Directeur de l\u2019Institut Rousseau', photo: '', bio: '', publications: 12 },
];

const DEMO_SUBSCRIBERS = [
  { id: 1, name: 'Marie Dupont', email: 'marie.dupont@gmail.com', date: '2026-04-01', status: 'added', source: 'Site web' },
  { id: 2, name: 'Jean Martin', email: 'j.martin@outlook.fr', date: '2026-04-03', status: 'pending', source: 'Site web' },
  { id: 3, name: 'Sophie Bernard', email: 'sophie.b@proton.me', date: '2026-04-05', status: 'added', source: '\u00c9v\u00e9nement' },
  { id: 4, name: 'Pierre Leclerc', email: 'p.leclerc@yahoo.fr', date: '2026-04-06', status: 'pending', source: 'Site web' },
  { id: 5, name: 'Alice Moreau', email: 'a.moreau@gmail.com', date: '2026-04-07', status: 'rejected', source: 'Manuel' },
  { id: 6, name: 'Lucas Rousseau', email: 'lucas.r@free.fr', date: '2026-04-08', status: 'pending', source: 'Site web' },
  { id: 7, name: 'Camille Durand', email: 'camille.d@gmail.com', date: '2026-04-09', status: 'pending', source: 'LinkedIn' },
  { id: 8, name: 'Nicolas Petit', email: 'n.petit@laposte.net', date: '2026-04-10', status: 'added', source: 'Site web' },
  { id: 9, name: 'Emma Laurent', email: 'emma.l@gmail.com', date: '2026-04-10', status: 'pending', source: '\u00c9v\u00e9nement' },
  { id: 10, name: 'Hugo Garcia', email: 'hugo.g@outlook.fr', date: '2026-04-11', status: 'added', source: 'Site web' },
];

const DEMO_ADHERENTS = [
  { id: 1, name: 'Marie Dupont', email: 'marie.dupont@gmail.com', date: '2026-03-15', amount: 30, type: 'Adh\u00e9sion', status: 'actif', source: 'HelloAsso', formule: 'normal' },
  { id: 2, name: 'Jean Martin', email: 'j.martin@outlook.fr', date: '2026-02-10', amount: 10, type: 'Adh\u00e9sion', status: 'actif', source: 'HelloAsso', formule: 'reduit' },
  { id: 3, name: 'Sophie Bernard', email: 'sophie.b@proton.me', date: '2025-08-20', amount: 30, type: 'Adh\u00e9sion', status: 'expire', source: 'HelloAsso', formule: 'normal' },
  { id: 4, name: 'Pierre Leclerc', email: 'p.leclerc@yahoo.fr', date: '2026-04-01', amount: 30, type: 'Adh\u00e9sion', status: 'actif', source: 'HelloAsso', formule: 'normal' },
  { id: 5, name: 'Alice Moreau', email: 'a.moreau@gmail.com', date: '2026-01-05', amount: 10, type: 'Adh\u00e9sion', status: 'actif', source: 'HelloAsso', formule: 'reduit' },
];

const DEMO_DONS = [
  { id: 101, name: 'Lucas Rousseau', email: 'lucas.r@free.fr', date: '2026-04-10', amount: 50, type: 'ponctuel', status: 'actif', source: 'HelloAsso' },
  { id: 102, name: 'Camille Durand', email: 'camille.d@gmail.com', date: '2026-04-08', amount: 25, type: 'ponctuel', status: 'actif', source: 'HelloAsso' },
  { id: 103, name: 'Nicolas Petit', email: 'n.petit@laposte.net', date: '2026-03-15', amount: 100, type: 'ponctuel', status: 'actif', source: 'HelloAsso' },
  { id: 104, name: 'Emma Laurent', email: 'emma.l@gmail.com', date: '2026-03-01', amount: 10, type: 'recurrent', status: 'actif', source: 'HelloAsso' },
  { id: 105, name: 'Hugo Garcia', email: 'hugo.g@outlook.fr', date: '2026-02-20', amount: 200, type: 'ponctuel', status: 'actif', source: 'HelloAsso' },
  { id: 106, name: 'Marie Dupont', email: 'marie.dupont@gmail.com', date: '2026-02-10', amount: 25, type: 'recurrent', status: 'actif', source: 'HelloAsso' },
];

const DEMO_SOLLICITATIONS = [
  {
    id: 'msg_1712930400_a3f2', name: 'Marie Dupont', email: 'marie.dupont@media.fr',
    organization: 'Le Monde', phone: '+33 6 12 34 56 78', subject: 'presse',
    message: 'Bonjour,\nNous pr\u00e9parons un dossier sp\u00e9cial sur la transition \u00e9cologique pour notre \u00e9dition de mai. Serait-il possible d\u2019interviewer un membre de votre conseil scientifique sur le sujet de la dette climatique ?\nCordialement, Marie Dupont',
    consent: true, submitted_at: '2026-04-12T14:30:00Z', source_page: '/contact',
    status: 'new', assigned_to: null, priority: 'high',
    internal_notes: [], replies: [], tags: ['presse', 'road-to-net-zero'],
    updated_at: '2026-04-12T14:30:00Z', resolved_at: null,
  },
  {
    id: 'msg_1712844000_b7e1', name: 'Jean Martin', email: 'j.martin@wwf.fr',
    organization: 'WWF France', phone: '', subject: 'partenariat',
    message: 'Suite \u00e0 notre \u00e9change lors du Salon Affaires Publiques, nous souhaiterions explorer un partenariat pour un cycle de conf\u00e9rences sur la biodiversit\u00e9.',
    consent: true, submitted_at: '2026-04-11T10:00:00Z', source_page: '/contact',
    status: 'in_progress', assigned_to: 'Michel', priority: 'normal',
    internal_notes: [
      { type: 'status_change', text: 'Statut \u2192 En cours', date: '2026-04-11T11:00:00Z', author: 'Michel' },
      { type: 'note', text: 'Transmettre \u00e0 Guillaume pour le cycle biodiversit\u00e9', date: '2026-04-11T11:05:00Z', author: 'Michel' },
    ],
    replies: [], tags: ['partenariat-ong'],
    updated_at: '2026-04-11T11:05:00Z', resolved_at: null,
  },
  {
    id: 'msg_1712671200_c5d9', name: 'Sophie Bernard', email: 'sophie.b@gmail.com',
    organization: '', phone: '', subject: 'general',
    message: 'J\u2019aimerais savoir comment acc\u00e9der aux rapports en version PDF, notamment celui sur la planification \u00e9cologique.',
    consent: true, submitted_at: '2026-04-03T09:00:00Z', source_page: '/contact',
    status: 'resolved', assigned_to: 'B\u00e9n\u00e9dicte', priority: 'normal',
    internal_notes: [
      { type: 'status_change', text: 'Statut \u2192 En cours', date: '2026-04-03T10:00:00Z', author: 'B\u00e9n\u00e9dicte' },
      { type: 'reply_sent', text: 'R\u00e9ponse envoy\u00e9e par email', date: '2026-04-03T10:30:00Z', author: 'B\u00e9n\u00e9dicte' },
      { type: 'status_change', text: 'Statut \u2192 R\u00e9solu', date: '2026-04-03T10:30:00Z', author: 'B\u00e9n\u00e9dicte' },
    ],
    replies: [{ text: 'Bonjour Sophie, les rapports PDF sont disponibles sur notre page Publications. Voici le lien direct\u2026', sent_by: 'B\u00e9n\u00e9dicte', sent_at: '2026-04-03T10:30:00Z' }],
    tags: [],
    updated_at: '2026-04-03T10:30:00Z', resolved_at: '2026-04-03T10:30:00Z',
  },
  {
    id: 'msg_1712584800_d2a7', name: 'Paul Martin', email: 'paul.m@gmail.com',
    organization: '', phone: '+33 7 98 76 54 32', subject: 'evenement',
    message: 'Bonjour, je souhaiterais participer \u00e0 la conf\u00e9rence du 27 avril sur la d\u00e9croissance. Y a-t-il encore des places disponibles ?',
    consent: true, submitted_at: '2026-04-11T16:00:00Z', source_page: '/contact',
    status: 'new', assigned_to: null, priority: 'normal',
    internal_notes: [], replies: [], tags: ['evenement'],
    updated_at: '2026-04-11T16:00:00Z', resolved_at: null,
  },
  {
    id: 'msg_1712498400_e9b3', name: 'Claire Dubois', email: 'claire.d@lemonde.fr',
    organization: 'Le Monde', phone: '', subject: 'presse',
    message: 'Bonjour, je suis journaliste au Monde et je souhaiterais organiser un entretien avec Nicolas Dufr\u00eane au sujet du rapport Road to Net Zero. Nous pr\u00e9voyons un article pour la semaine prochaine.',
    consent: true, submitted_at: '2026-04-10T08:30:00Z', source_page: '/contact',
    status: 'in_progress', assigned_to: 'Michel', priority: 'high',
    internal_notes: [
      { type: 'status_change', text: 'Statut \u2192 En cours', date: '2026-04-10T09:00:00Z', author: 'Michel' },
      { type: 'note', text: 'Contacter ND pour confirmer dispo interview', date: '2026-04-10T09:05:00Z', author: 'Michel' },
    ],
    replies: [], tags: ['presse', 'road-to-net-zero', 'urgent'],
    updated_at: '2026-04-10T09:05:00Z', resolved_at: null,
  },
  {
    id: 'msg_1712325600_f1c4', name: 'Association Greenpeace', email: 'partenariats@greenpeace.fr',
    organization: 'Greenpeace France', phone: '', subject: 'partenariat',
    message: 'Nous souhaiterions co-organiser un \u00e9v\u00e9nement sur le th\u00e8me de la d\u00e9carbonation industrielle. Serait-il possible de prendre contact ?',
    consent: true, submitted_at: '2026-04-08T14:00:00Z', source_page: '/contact',
    status: 'resolved', assigned_to: 'Guillaume', priority: 'normal',
    internal_notes: [
      { type: 'status_change', text: 'Statut \u2192 En cours', date: '2026-04-08T15:00:00Z', author: 'Guillaume' },
      { type: 'reply_sent', text: 'R\u00e9ponse envoy\u00e9e par email', date: '2026-04-09T10:00:00Z', author: 'Guillaume' },
      { type: 'status_change', text: 'Statut \u2192 R\u00e9solu', date: '2026-04-09T10:00:00Z', author: 'Guillaume' },
    ],
    replies: [{ text: 'Bonjour, merci pour votre int\u00e9r\u00eat. Je vous propose un appel la semaine prochaine pour en discuter.', sent_by: 'Guillaume', sent_at: '2026-04-09T10:00:00Z' }],
    tags: ['partenariat-ong', 'decarbonation'],
    updated_at: '2026-04-09T10:00:00Z', resolved_at: '2026-04-09T10:00:00Z',
  },
  {
    id: 'msg_1712239200_g8h5', name: 'Marc Lefebvre', email: 'marc.l@free.fr',
    organization: '', phone: '', subject: 'adhesion',
    message: 'Bonjour, je souhaite adh\u00e9rer \u00e0 l\u2019Institut Rousseau mais je rencontre un probl\u00e8me sur HelloAsso. Pouvez-vous m\u2019aider ?',
    consent: true, submitted_at: '2026-04-07T11:00:00Z', source_page: '/contact',
    status: 'resolved', assigned_to: 'B\u00e9n\u00e9dicte', priority: 'low',
    internal_notes: [
      { type: 'reply_sent', text: 'R\u00e9ponse envoy\u00e9e par email', date: '2026-04-07T14:00:00Z', author: 'B\u00e9n\u00e9dicte' },
      { type: 'status_change', text: 'Statut \u2192 R\u00e9solu', date: '2026-04-07T14:00:00Z', author: 'B\u00e9n\u00e9dicte' },
    ],
    replies: [{ text: 'Bonjour Marc, vous pouvez utiliser ce lien direct pour adh\u00e9rer\u2026', sent_by: 'B\u00e9n\u00e9dicte', sent_at: '2026-04-07T14:00:00Z' }],
    tags: [],
    updated_at: '2026-04-07T14:00:00Z', resolved_at: '2026-04-07T14:00:00Z',
  },
  {
    id: 'msg_1711980000_i2j6', name: 'Spam Bot', email: 'noreply@spam.xyz',
    organization: '', phone: '', subject: 'autre',
    message: 'Buy cheap viagra online now!!!',
    consent: true, submitted_at: '2026-04-02T06:00:00Z', source_page: '/contact',
    status: 'archived', assigned_to: null, priority: 'low',
    internal_notes: [{ type: 'status_change', text: 'Statut \u2192 Archiv\u00e9', date: '2026-04-02T08:00:00Z', author: 'Admin' }],
    replies: [], tags: ['spam'],
    updated_at: '2026-04-02T08:00:00Z', resolved_at: null,
  },
];

const DEMO_ACTIVITY = [
  { date: '2026-04-11', text: 'Hugo Garcia ajout\u00e9 \u00e0 la newsletter' },
  { date: '2026-04-11', text: 'Article "Souverainet\u00e9 num\u00e9rique" cr\u00e9\u00e9 en brouillon' },
  { date: '2026-04-10', text: 'Page \u00c9v\u00e9nements mise \u00e0 jour sur le site' },
  { date: '2026-04-10', text: 'Don de 50\u00a0\u20ac re\u00e7u (Lucas Rousseau)' },
  { date: '2026-04-09', text: 'Camille Durand inscrite via LinkedIn' },
  { date: '2026-04-08', text: 'Article "Planification \u00e9cologique" soumis pour relecture' },
  { date: '2026-04-08', text: 'Demande de contact presse re\u00e7ue' },
  { date: '2026-04-05', text: 'Demande de contact trait\u00e9e (JP Leclerc)' },
];

// ─── MAIN APP ──────────────────────────────────────────
export default function App() {
  // Auth
  const [loggedIn, setLoggedIn] = useState(() => {
    const session = sessionStorage.getItem('ir-auth');
    if (session) {
      try {
        const { ts } = JSON.parse(session);
        if (Date.now() - ts < 15 * 60 * 1000) return true;
      } catch { /* invalid */ }
      sessionStorage.removeItem('ir-auth');
    }
    return false;
  });
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [loginError, setLoginError] = useState('');
  const lastActivity = useRef(Date.now());

  // Tab & toast
  const [tab, setTab] = useState(() => loadLocal(LS_KEYS.activeTab, 'dashboard'));
  const [toasts, setToasts] = useState([]);

  // Data
  const [articles, setArticles] = useState([]);
  const [events, setEvents] = useState([]);
  const [presse, setPresse] = useState([]);
  const [auteurs, setAuteurs] = useState([]);
  const [adherents, setAdherents] = useState([]);
  const [dons, setDons] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [sollicitations, setSollicitations] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [activity, setActivity] = useState([]);
  const [contenu, setContenu] = useState({});

  // Services
  const [services, setServices] = useState({ helloasso: false, brevo: false, telegram: false });
  const [loading, setLoading] = useState(true);

  // Notion sync
  const { notionArticles, notionCounts, notionLoading, notionError, syncNotion, notionConfigured } = useNotionSync();

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const changeTab = useCallback((key) => {
    setTab(key);
    saveLocal(LS_KEYS.activeTab, key);
  }, []);

  // Auth handlers
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginId === 'admin' && loginPw === 'IR2026!') {
      setLoggedIn(true);
      setLoginError('');
      sessionStorage.setItem('ir-auth', JSON.stringify({ ts: Date.now() }));
      lastActivity.current = Date.now();
    } else {
      setLoginError('Identifiants incorrects');
    }
  };

  const handleLogout = useCallback(() => {
    setLoggedIn(false);
    sessionStorage.removeItem('ir-auth');
  }, []);

  // Inactivity timer
  useEffect(() => {
    if (!loggedIn) return;
    const resetTimer = () => {
      lastActivity.current = Date.now();
      sessionStorage.setItem('ir-auth', JSON.stringify({ ts: Date.now() }));
    };
    const check = setInterval(() => {
      if (Date.now() - lastActivity.current > 15 * 60 * 1000) handleLogout();
    }, 30000);
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    return () => {
      clearInterval(check);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [loggedIn, handleLogout]);

  // Load data
  useEffect(() => {
    if (!loggedIn) return;
    loadData();
  }, [loggedIn]);

  const loadData = async () => {
    setLoading(true);
    // Load demo data
    setArticles([...DEMO_ARTICLES]);
    setEvents([...DEMO_EVENTS]);
    setPresse([...DEMO_PRESSE]);
    setAuteurs([...DEMO_AUTEURS]);
    setAdherents([...DEMO_ADHERENTS]);
    setDons([...DEMO_DONS]);
    setSubscribers([...DEMO_SUBSCRIBERS]);
    setSollicitations([...DEMO_SOLLICITATIONS]);
    setActivity([...DEMO_ACTIVITY]);

    // Try to connect to worker
    try {
      const health = await checkHealth();
      if (health?.services) {
        setServices(health.services);
        if (health.services.brevo) {
          try {
            const contactsData = await fetchContacts();
            if (contactsData?.length) setSubscribers(contactsData);
            const campaignsData = await fetchCampaigns();
            if (campaignsData?.length) setCampaigns(campaignsData);
          } catch { /* use demo */ }
        }
        // HelloAsso sync handled via Worker when configured
      }
    } catch { /* worker not available, use demo data */ }
    setLoading(false);
  };

  // Computed badges
  const readyCount = (notionCounts.ready || 0) + articles.filter(a => a.status === 'ready').length;
  const badges = {
    dashboard: 0,
    articles: readyCount || articles.filter(a => a.status === 'review').length,
    evenements: 0,
    presse: 0,
    auteurs: 0,
    newsletter: subscribers.filter(s => s.status === 'pending').length,
    messagerie: 0,
    contenu: 0,
    sollicitations: sollicitations.filter(s => s.status === 'new').length,
    settings: 0,
  };

  // Login screen
  if (!loggedIn) {
    return (
      <div className="login-wrapper fade-in">
        <div className="card login-card slide-up">
          <img src={logoSvg} alt="Institut Rousseau" style={{ height: 40, marginBottom: 24 }} />
          <p className="login-sub">Back-office</p>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <input placeholder="Identifiant" value={loginId} onChange={e => setLoginId(e.target.value)} style={{ width: '100%' }} />
            <input placeholder="Mot de passe" type="password" value={loginPw} onChange={e => setLoginPw(e.target.value)} style={{ width: '100%' }} />
            {loginError && <p className="login-error">{loginError}</p>}
            <button type="submit" className="btn btn-primary" style={{ padding: '10px 32px', fontSize: 15 }}>Se connecter</button>
          </form>
        </div>
      </div>
    );
  }

  // Render active page
  const renderPage = () => {
    switch (tab) {
      case 'dashboard':
        return <Dashboard
          subscribers={subscribers} articles={articles}
          events={events} presse={presse} sollicitations={sollicitations}
          activity={activity} loading={loading} onTabChange={changeTab}
          notionArticles={notionArticles} notionCounts={notionCounts}
        />;
      case 'articles':
        return <Articles
          articles={articles} setArticles={setArticles} loading={loading} toast={toast}
          notionArticles={notionArticles} notionCounts={notionCounts}
          notionLoading={notionLoading} syncNotion={syncNotion}
          notionConfigured={notionConfigured} auteurs={auteurs}
        />;
      case 'evenements':
        return <Evenements events={events} setEvents={setEvents} loading={loading} toast={toast} />;
      case 'presse':
        return <Presse presse={presse} setPresse={setPresse} loading={loading} toast={toast} />;
      case 'auteurs':
        return <Auteurs auteurs={auteurs} setAuteurs={setAuteurs} articles={articles} loading={loading} toast={toast} />;
      case 'newsletter':
        return <Newsletter subscribers={subscribers} setSubscribers={setSubscribers} campaigns={campaigns} loading={loading} connected={services.brevo} onRefresh={loadData} toast={toast} />;
      case 'messagerie':
        return <Messagerie subscribers={subscribers} services={services} toast={toast} />;
      case 'contenu':
        return <Contenu contenu={contenu} setContenu={setContenu} toast={toast} />;
      case 'sollicitations':
        return <Sollicitations sollicitations={sollicitations} setSollicitations={setSollicitations} loading={loading} toast={toast} />;
      case 'settings':
        return <Settings
          subscribers={subscribers} services={services}
          onImportSubscribers={(items) => setSubscribers(prev => [...items, ...prev])}
          onRefresh={loadData} toast={toast}
        />;
      default:
        return <Dashboard
          subscribers={subscribers} articles={articles}
          events={events} presse={presse} sollicitations={sollicitations}
          activity={activity} loading={loading} onTabChange={changeTab}
          notionArticles={notionArticles} notionCounts={notionCounts}
        />;
    }
  };

  return (
    <Layout
      activeTab={tab}
      onTabChange={changeTab}
      badges={badges}
      toasts={toasts}
      onRemoveToast={(id) => setToasts(prev => prev.filter(t => t.id !== id))}
    >
      {renderPage()}
    </Layout>
  );
}
