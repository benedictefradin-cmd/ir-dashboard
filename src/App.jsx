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
import logoSvg from './assets/logo.svg';

// ─── DEMO DATA ─────────────────────────────────────────
const DEMO_ARTICLES = [
  { id: 1, title: 'États-Unis hors-la-loi, hors climat : quelles conséquences pour l’Europe ?', author: 'Nicolas Dufrêne', date: '2025-03-15', tags: ['Écologie', 'Institutions'], summary: 'Analyse des conséquences du retrait américain des accords climatiques.', content: '', type: 'Note d\'analyse', pdfUrl: '', status: 'published' },
  { id: 2, title: 'Relancer l’offensive climatique européenne par des obligations ciblées', author: 'Simon Pujau', date: '2025-02-20', tags: ['Écologie', 'Économie'], summary: 'Propositions pour financer la transition via des obligations vertes.', content: '', type: 'Note d\'analyse', pdfUrl: '', status: 'published' },
  { id: 3, title: 'Économie circulaire : une critique nécessaire', author: 'Arthur Boutiab', date: '2025-01-10', tags: ['Économie', 'Écologie'], summary: 'Retour critique sur les limites du modèle d’économie circulaire actuel.', content: '', type: 'Point de vue', pdfUrl: '', status: 'published' },
  { id: 4, title: 'Souveraineté numérique et communs digitaux', author: 'Nicolas Music', date: '2026-04-01', tags: ['Culture'], summary: 'Pour une politique européenne des communs numériques.', content: '', type: 'Note d\'analyse', pdfUrl: '', status: 'draft' },
  { id: 5, title: 'L’avenir de la protection sociale', author: 'Chloé Music', date: '2026-04-05', tags: ['Social'], summary: 'Repenser le modèle social français face aux mutations du travail.', content: '', type: 'Point de vue', pdfUrl: '', status: 'review' },
  { id: 6, title: 'Planification écologique : bilan d’un an', author: 'Pierre Music', date: '2026-04-08', tags: ['Écologie'], summary: 'Bilan de la première année de planification écologique en France.', content: '', type: 'Note d\'analyse', pdfUrl: '', status: 'ready' },
];

const DEMO_EVENTS = [
  { id: 1, date: '2026-04-27', type: 'Conférence', title: 'La décroissance', sousTitre: 'Cycle avec Les Canaux (1/4)', lieu: 'Les Canaux, 6 Quai de la Seine, 75019 Paris', intervenants: [], partenaire: 'Les Canaux', description: 'Premier volet du cycle de conférences sur la décroissance.', lienInscription: '', lienConcours: '', status: 'confirme' },
  { id: 2, date: '2026-06-03', type: 'Salon', title: 'Les think tanks, faiseurs de lois ?', sousTitre: 'Salon Affaires Publiques', lieu: 'Salon Affaires Publiques & Influences, Paris', intervenants: [], partenaire: '', description: 'Participation au Salon Affaires Publiques & Influences.', lienInscription: '', lienConcours: '', status: 'confirme' },
  { id: 3, date: '2026-06-09', type: 'Cycle', title: 'Démocratie et droit d’amendement citoyen', sousTitre: 'Cycle Paris 1/3', lieu: 'CAP, 181 av Daumesnil, 75012 Paris', intervenants: [{ name: 'Beverley Toudic', titre: 'Directrice adjointe' }, { name: 'Mila Jeudy', titre: '' }], partenaire: 'Ville de Paris', description: 'Cycle de conférences sur la démocratie locale en partenariat avec la Ville de Paris.', lienInscription: '', lienConcours: '', status: 'confirme' },
  { id: 4, date: '2026-09-15', type: 'Conférence', title: 'La présomption d’innocence', sousTitre: 'Rencontres Culture & Controverse', lieu: 'À confirmer', intervenants: [{ name: 'Gabrielle Barnaud', titre: '' }, { name: 'Magali Lafourcade', titre: 'Secrétaire générale CNCDH' }, { name: 'Émilie Lory', titre: 'Médiation' }], partenaire: '', description: 'Débat autour de la présomption d’innocence.', lienInscription: '', lienConcours: '', status: 'en_preparation' },
  { id: 5, date: '2026-10-01', type: 'Cycle', title: 'La transition écologique à Paris', sousTitre: 'Cycle Paris 2/3', lieu: 'Climate House, Paris', intervenants: [], partenaire: 'Ville de Paris', description: 'Deuxième volet du cycle parisien sur la transition écologique.', lienInscription: '', lienConcours: '', status: 'en_preparation' },
  { id: 6, date: '2026-11-15', type: 'Cycle', title: 'Les politiques publiques sociales', sousTitre: 'Cycle Paris 3/3', lieu: 'Théâtre de la Concorde (sous réserve)', intervenants: [], partenaire: 'Ville de Paris', description: 'Troisième volet du cycle parisien sur les politiques sociales.', lienInscription: '', lienConcours: '', status: 'en_preparation' },
];

const DEMO_PRESSE = [
  { id: 1, type: 'Tribune', title: 'Institut Rousseau : un think tank au service de la reconstruction', auteur: 'Nicolas Dufrêne', media: 'Le Monde', date: '2026-03-15', url: '', urlInterne: '' },
  { id: 2, type: 'Entretien', title: 'Les propositions de l’IR pour le climat', auteur: 'Chloé Ridel', media: 'Mediapart', date: '2026-02-20', url: '', urlInterne: '' },
  { id: 3, type: 'Tribune', title: 'Road to Net Zero : le plan de décarbonation', auteur: 'Gaël Giraud', media: 'Les Échos', date: '2026-01-10', url: '', urlInterne: '' },
  { id: 4, type: 'Entretien', title: 'Réforme des institutions : les idées de l’IR', auteur: 'Beverley Toudic', media: 'Libération', date: '2025-12-05', url: '', urlInterne: '' },
  { id: 5, type: 'Tribune', title: 'Économie circulaire : les limites pointées', auteur: 'Arthur Boutiab', media: 'Alternatives Économiques', date: '2025-11-18', url: '', urlInterne: '' },
  { id: 6, type: 'Podcast', title: 'Souveraineté numérique — Épisode 1', auteur: '', media: 'Spotify', date: '2025-10-22', url: '', urlInterne: '' },
  { id: 7, type: 'Tribune', title: 'Militer pour la souveraineté numérique', auteur: 'Nicolas Music', media: 'La Tribune', date: '2025-10-01', url: '', urlInterne: '' },
  { id: 8, type: 'Entretien', title: 'L’écologie au cœur de la relance', auteur: 'Léa Falco', media: 'France Inter', date: '2025-09-15', url: '', urlInterne: '' },
  { id: 9, type: 'Podcast', title: 'Think tanks et politique — Épisode 2', auteur: '', media: 'Spotify', date: '2025-08-20', url: '', urlInterne: '' },
  { id: 10, type: 'Tribune', title: 'Pour un Green New Deal européen', auteur: 'Simon Pujau', media: 'The Conversation', date: '2025-07-10', url: '', urlInterne: '' },
];

// Authors loaded from src/data/authors.json — fallback to inline demo
const DEMO_AUTEURS = authorsData.length ? authorsData.map(a => ({
  ...a,
  name: `${a.firstName} ${a.lastName}`,
  titre: a.role,
})) : [
  { id: 'marine-yzquierdo', firstName: 'Marine', lastName: 'Yzquierdo', name: 'Marine Yzquierdo', role: 'Spécialiste travail et environnement', titre: 'Spécialiste travail et environnement', photo: '', bio: '', publications: 3 },
  { id: 'nicolas-dufrene', firstName: 'Nicolas', lastName: 'Dufrêne', name: 'Nicolas Dufrêne', role: 'Directeur de l’Institut Rousseau', titre: 'Directeur de l’Institut Rousseau', photo: '', bio: '', publications: 12 },
];

const DEMO_SUBSCRIBERS = [
  { id: 1, name: 'Marie Dupont', email: 'marie.dupont@gmail.com', date: '2026-04-01', status: 'added', source: 'Site web' },
  { id: 2, name: 'Jean Martin', email: 'j.martin@outlook.fr', date: '2026-04-03', status: 'pending', source: 'Site web' },
  { id: 3, name: 'Sophie Bernard', email: 'sophie.b@proton.me', date: '2026-04-05', status: 'added', source: 'Événement' },
  { id: 4, name: 'Pierre Leclerc', email: 'p.leclerc@yahoo.fr', date: '2026-04-06', status: 'pending', source: 'Site web' },
  { id: 5, name: 'Alice Moreau', email: 'a.moreau@gmail.com', date: '2026-04-07', status: 'rejected', source: 'Manuel' },
  { id: 6, name: 'Lucas Rousseau', email: 'lucas.r@free.fr', date: '2026-04-08', status: 'pending', source: 'Site web' },
  { id: 7, name: 'Camille Durand', email: 'camille.d@gmail.com', date: '2026-04-09', status: 'pending', source: 'LinkedIn' },
  { id: 8, name: 'Nicolas Petit', email: 'n.petit@laposte.net', date: '2026-04-10', status: 'added', source: 'Site web' },
  { id: 9, name: 'Emma Laurent', email: 'emma.l@gmail.com', date: '2026-04-10', status: 'pending', source: 'Événement' },
  { id: 10, name: 'Hugo Garcia', email: 'hugo.g@outlook.fr', date: '2026-04-11', status: 'added', source: 'Site web' },
];

const DEMO_SOLLICITATIONS = [
  {
    id: 'msg_1712930400_a3f2', name: 'Marie Dupont', email: 'marie.dupont@media.fr',
    organization: 'Le Monde', phone: '+33 6 12 34 56 78', subject: 'presse',
    message: 'Bonjour,\nNous préparons un dossier spécial sur la transition écologique pour notre édition de mai. Serait-il possible d’interviewer un membre de votre conseil scientifique sur le sujet de la dette climatique ?\nCordialement, Marie Dupont',
    consent: true, submitted_at: '2026-04-12T14:30:00Z', source_page: '/contact',
    status: 'new', assigned_to: null, priority: 'high',
    internal_notes: [], replies: [], tags: ['presse', 'road-to-net-zero'],
    updated_at: '2026-04-12T14:30:00Z', resolved_at: null,
  },
  {
    id: 'msg_1712844000_b7e1', name: 'Jean Martin', email: 'j.martin@wwf.fr',
    organization: 'WWF France', phone: '', subject: 'partenariat',
    message: 'Suite à notre échange lors du Salon Affaires Publiques, nous souhaiterions explorer un partenariat pour un cycle de conférences sur la biodiversité.',
    consent: true, submitted_at: '2026-04-11T10:00:00Z', source_page: '/contact',
    status: 'in_progress', assigned_to: 'Michel', priority: 'normal',
    internal_notes: [
      { type: 'status_change', text: 'Statut → En cours', date: '2026-04-11T11:00:00Z', author: 'Michel' },
      { type: 'note', text: 'Transmettre à Guillaume pour le cycle biodiversité', date: '2026-04-11T11:05:00Z', author: 'Michel' },
    ],
    replies: [], tags: ['partenariat-ong'],
    updated_at: '2026-04-11T11:05:00Z', resolved_at: null,
  },
  {
    id: 'msg_1712671200_c5d9', name: 'Sophie Bernard', email: 'sophie.b@gmail.com',
    organization: '', phone: '', subject: 'general',
    message: 'J’aimerais savoir comment accéder aux rapports en version PDF, notamment celui sur la planification écologique.',
    consent: true, submitted_at: '2026-04-03T09:00:00Z', source_page: '/contact',
    status: 'resolved', assigned_to: 'Bénédicte', priority: 'normal',
    internal_notes: [
      { type: 'status_change', text: 'Statut → En cours', date: '2026-04-03T10:00:00Z', author: 'Bénédicte' },
      { type: 'reply_sent', text: 'Réponse envoyée par email', date: '2026-04-03T10:30:00Z', author: 'Bénédicte' },
      { type: 'status_change', text: 'Statut → Résolu', date: '2026-04-03T10:30:00Z', author: 'Bénédicte' },
    ],
    replies: [{ text: 'Bonjour Sophie, les rapports PDF sont disponibles sur notre page Publications. Voici le lien direct…', sent_by: 'Bénédicte', sent_at: '2026-04-03T10:30:00Z' }],
    tags: [],
    updated_at: '2026-04-03T10:30:00Z', resolved_at: '2026-04-03T10:30:00Z',
  },
  {
    id: 'msg_1712584800_d2a7', name: 'Paul Martin', email: 'paul.m@gmail.com',
    organization: '', phone: '+33 7 98 76 54 32', subject: 'evenement',
    message: 'Bonjour, je souhaiterais participer à la conférence du 27 avril sur la décroissance. Y a-t-il encore des places disponibles ?',
    consent: true, submitted_at: '2026-04-11T16:00:00Z', source_page: '/contact',
    status: 'new', assigned_to: null, priority: 'normal',
    internal_notes: [], replies: [], tags: ['evenement'],
    updated_at: '2026-04-11T16:00:00Z', resolved_at: null,
  },
  {
    id: 'msg_1712498400_e9b3', name: 'Claire Dubois', email: 'claire.d@lemonde.fr',
    organization: 'Le Monde', phone: '', subject: 'presse',
    message: 'Bonjour, je suis journaliste au Monde et je souhaiterais organiser un entretien avec Nicolas Dufrêne au sujet du rapport Road to Net Zero. Nous prévoyons un article pour la semaine prochaine.',
    consent: true, submitted_at: '2026-04-10T08:30:00Z', source_page: '/contact',
    status: 'in_progress', assigned_to: 'Michel', priority: 'high',
    internal_notes: [
      { type: 'status_change', text: 'Statut → En cours', date: '2026-04-10T09:00:00Z', author: 'Michel' },
      { type: 'note', text: 'Contacter ND pour confirmer dispo interview', date: '2026-04-10T09:05:00Z', author: 'Michel' },
    ],
    replies: [], tags: ['presse', 'road-to-net-zero', 'urgent'],
    updated_at: '2026-04-10T09:05:00Z', resolved_at: null,
  },
  {
    id: 'msg_1712325600_f1c4', name: 'Association Greenpeace', email: 'partenariats@greenpeace.fr',
    organization: 'Greenpeace France', phone: '', subject: 'partenariat',
    message: 'Nous souhaiterions co-organiser un événement sur le thème de la décarbonation industrielle. Serait-il possible de prendre contact ?',
    consent: true, submitted_at: '2026-04-08T14:00:00Z', source_page: '/contact',
    status: 'resolved', assigned_to: 'Guillaume', priority: 'normal',
    internal_notes: [
      { type: 'status_change', text: 'Statut → En cours', date: '2026-04-08T15:00:00Z', author: 'Guillaume' },
      { type: 'reply_sent', text: 'Réponse envoyée par email', date: '2026-04-09T10:00:00Z', author: 'Guillaume' },
      { type: 'status_change', text: 'Statut → Résolu', date: '2026-04-09T10:00:00Z', author: 'Guillaume' },
    ],
    replies: [{ text: 'Bonjour, merci pour votre intérêt. Je vous propose un appel la semaine prochaine pour en discuter.', sent_by: 'Guillaume', sent_at: '2026-04-09T10:00:00Z' }],
    tags: ['partenariat-ong', 'decarbonation'],
    updated_at: '2026-04-09T10:00:00Z', resolved_at: '2026-04-09T10:00:00Z',
  },
  {
    id: 'msg_1712239200_g8h5', name: 'Marc Lefebvre', email: 'marc.l@free.fr',
    organization: '', phone: '', subject: 'general',
    message: 'Bonjour, je souhaiterais m’inscrire à la newsletter de l’Institut Rousseau mais je ne reçois pas l’email de confirmation. Pouvez-vous m’aider ?',
    consent: true, submitted_at: '2026-04-07T11:00:00Z', source_page: '/contact',
    status: 'resolved', assigned_to: 'Bénédicte', priority: 'low',
    internal_notes: [
      { type: 'reply_sent', text: 'Réponse envoyée par email', date: '2026-04-07T14:00:00Z', author: 'Bénédicte' },
      { type: 'status_change', text: 'Statut → Résolu', date: '2026-04-07T14:00:00Z', author: 'Bénédicte' },
    ],
    replies: [{ text: 'Bonjour Marc, nous avons renvoyé l’email de confirmation. Vérifiez vos spams.', sent_by: 'Bénédicte', sent_at: '2026-04-07T14:00:00Z' }],
    tags: [],
    updated_at: '2026-04-07T14:00:00Z', resolved_at: '2026-04-07T14:00:00Z',
  },
  {
    id: 'msg_1711980000_i2j6', name: 'Spam Bot', email: 'noreply@spam.xyz',
    organization: '', phone: '', subject: 'autre',
    message: 'Buy cheap viagra online now!!!',
    consent: true, submitted_at: '2026-04-02T06:00:00Z', source_page: '/contact',
    status: 'archived', assigned_to: null, priority: 'low',
    internal_notes: [{ type: 'status_change', text: 'Statut → Archivé', date: '2026-04-02T08:00:00Z', author: 'Admin' }],
    replies: [], tags: ['spam'],
    updated_at: '2026-04-02T08:00:00Z', resolved_at: null,
  },
];

const DEMO_ACTIVITY = [
  { date: '2026-04-11', text: 'Hugo Garcia ajouté à la newsletter' },
  { date: '2026-04-11', text: 'Article "Souveraineté numérique" créé en brouillon' },
  { date: '2026-04-10', text: 'Page Événements mise à jour sur le site' },
  { date: '2026-04-09', text: 'Camille Durand inscrite via LinkedIn' },
  { date: '2026-04-08', text: 'Article "Planification écologique" soumis pour relecture' },
  { date: '2026-04-08', text: 'Demande de contact presse reçue' },
  { date: '2026-04-05', text: 'Demande de contact traitée (JP Leclerc)' },
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
  const [subscribers, setSubscribers] = useState([]);
  const [sollicitations, setSollicitations] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [activity, setActivity] = useState([]);
  const [contenu, setContenu] = useState({});

  // Services
  const [services, setServices] = useState({ brevo: false, telegram: false });
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
