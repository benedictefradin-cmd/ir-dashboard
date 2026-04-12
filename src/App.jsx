import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ─── ENV ───────────────────────────────────────────────
const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN || '';
const BREVO_API_KEY = import.meta.env.VITE_BREVO_API_KEY || '';
const GITHUB_REPO = 'benedictefradin-cmd/institut-rousseau';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/contents`;

const hasGitHub = GITHUB_TOKEN && GITHUB_TOKEN !== 'VOTRE_TOKEN' && GITHUB_TOKEN !== 'MON_TOKEN';
const hasBrevo = BREVO_API_KEY && BREVO_API_KEY !== 'VOTRE_CLE_BREVO';

// ─── COLORS ────────────────────────────────────────────
const C = {
  navy: '#1B2A4A', sky: '#4A90D9', terra: '#C45A3C', ochre: '#D4A843',
  green: '#2D8659', bg: '#FAFAF7', white: '#FFFFFF', border: '#E5E7EB',
  text: '#1B2A4A', textLight: '#6B7280', danger: '#DC2626',
};

// ─── TAGS / CATEGORIES ─────────────────────────────────
const THEMATIQUES = ['Ecologie', 'Economie', 'Institutions', 'Social', 'Industrie', 'Technologies'];
const PUB_STATUSES = ['draft', 'review', 'ready', 'published'];
const PUB_STATUS_LABELS = { draft: 'Brouillon', review: 'Relecture', ready: 'Pret', published: 'Publie' };
const PUB_STATUS_BADGE = { draft: 'badge-gray', review: 'badge-ochre', ready: 'badge-sky', published: 'badge-green' };
const EVT_TYPES = ['Conference', 'Atelier', 'Salon', 'Cycle', 'Partenariat'];
const EVT_STATUSES = ['confirme', 'en_preparation', 'annule'];
const EVT_STATUS_LABELS = { confirme: 'Confirme', en_preparation: 'En preparation', annule: 'Annule' };
const EVT_STATUS_BADGE = { confirme: 'badge-green', en_preparation: 'badge-ochre', annule: 'badge-terra' };

// ─── DEMO DATA ─────────────────────────────────────────
const DEMO_PUBLICATIONS = [
  { id: 1, title: 'Etats-Unis hors-la-loi, hors climat : quelles consequences pour l\'Europe ?', author: 'Nicolas Dufrene', date: '2025-03-15', tags: ['Ecologie', 'Institutions'], summary: 'Analyse des consequences du retrait americain des accords climatiques sur la politique europeenne.', content: '', type: 'Note', pdfUrl: '', status: 'published' },
  { id: 2, title: 'Relancer l\'offensive climatique europeenne par des obligations ciblees', author: 'Simon Pujau', date: '2025-02-20', tags: ['Ecologie', 'Industrie'], summary: 'Propositions pour financer la transition via des obligations vertes europeennes.', content: '', type: 'Note', pdfUrl: '', status: 'published' },
  { id: 3, title: 'Economie circulaire : une critique necessaire', author: 'Arthur Boutiab', date: '2025-01-10', tags: ['Economie', 'Ecologie'], summary: 'Retour critique sur les limites du modele d\'economie circulaire actuel.', content: '', type: 'Point de vue', pdfUrl: '', status: 'published' },
  { id: 4, title: 'Souverainete numerique et communs digitaux', author: 'Nicolas Music', date: '2026-04-01', tags: ['Technologies'], summary: 'Pour une politique europeenne des communs numeriques.', content: '', type: 'Note', pdfUrl: '', status: 'draft' },
  { id: 5, title: 'L\'avenir de la protection sociale', author: 'Chloe Music', date: '2026-04-05', tags: ['Social'], summary: 'Repenser le modele social francais face aux mutations du travail.', content: '', type: 'Point de vue', pdfUrl: '', status: 'review' },
  { id: 6, title: 'Planification ecologique : bilan d\'un an', author: 'Pierre Music', date: '2026-04-08', tags: ['Ecologie'], summary: 'Bilan de la premiere annee de planification ecologique en France.', content: '', type: 'Note', pdfUrl: '', status: 'ready' },
];

const DEMO_EVENTS = [
  { id: 1, date: '2026-04-27', type: 'Cycle', title: 'La decroissance — Cycle avec Les Canaux (1/4)', lieu: 'Les Canaux, 6 Quai de la Seine, 75019 Paris', partenaire: 'Les Canaux', description: 'Premier volet du cycle de conferences sur la decroissance.', lienInscription: '', status: 'confirme' },
  { id: 2, date: '2026-05-15', type: 'Conference', title: 'La presomption d\'innocence en question', lieu: 'Paris (a confirmer)', partenaire: '', description: 'Rencontres Culture & Controverse — debat autour de la presomption d\'innocence.', lienInscription: '', status: 'en_preparation' },
  { id: 3, date: '2026-06-04', type: 'Salon', title: 'Les think tanks, faiseurs de lois ?', lieu: 'Salon Affaires Publiques & Influences, Paris', partenaire: '', description: 'Participation au Salon Affaires Publiques & Influences.', lienInscription: '', status: 'confirme' },
  { id: 4, date: '2026-06-09', type: 'Cycle', title: 'La democratie locale — Cycle IR x Ville de Paris', lieu: 'Carrefour des Associations Parisiennes, 181 av Daumesnil 75012 Paris', partenaire: 'Ville de Paris', description: 'Cycle de conferences sur la democratie locale en partenariat avec la Ville de Paris.', lienInscription: '', status: 'confirme' },
];

const DEMO_PRESSE = [
  { id: 1, title: 'Institut Rousseau : un think tank au service de la reconstruction', media: 'Le Monde', date: '2026-03-15', url: '#', summary: '' },
  { id: 2, title: 'Les propositions de l\'Institut Rousseau pour le climat', media: 'Mediapart', date: '2026-02-20', url: '#', summary: '' },
  { id: 3, title: 'Road to Net Zero : le plan de decarbonation europeen', media: 'Les Echos', date: '2026-01-10', url: '#', summary: '' },
  { id: 4, title: 'Reforme des institutions : les idees de l\'Institut Rousseau', media: 'Liberation', date: '2025-12-05', url: '#', summary: '' },
  { id: 5, title: 'Economie circulaire : les limites pointees par l\'Institut Rousseau', media: 'Alternatives Economiques', date: '2025-11-18', url: '#', summary: '' },
  { id: 6, title: 'L\'Institut Rousseau milite pour la souverainete numerique', media: 'La Tribune', date: '2025-10-22', url: '#', summary: '' },
];

const DEMO_EQUIPE = {
  ca: [
    { id: 1, name: 'Beverley Toudic', fonction: 'Directrice adjointe' },
    { id: 2, name: 'Emilie Lory', fonction: 'Secretaire generale' },
    { id: 3, name: 'Nicolas Dufrene', fonction: 'Directeur' },
    { id: 4, name: 'Chloe Ridel', fonction: 'Presidente' },
    { id: 5, name: 'Nathan Sperber', fonction: 'Tresorier' },
    { id: 6, name: 'Mahaut Chaudouet-Delmas', fonction: 'Membre' },
  ],
  cs: {
    'Droit et institutions': [
      { id: 10, name: 'Mahaut Chaudouet-Delmas', fonction: '' },
      { id: 11, name: 'Dorian Guinard', fonction: '' },
      { id: 12, name: 'Magali Lafourcade', fonction: '' },
      { id: 13, name: 'Chloe Ridel', fonction: '' },
      { id: 14, name: 'Nathan Sperber', fonction: '' },
      { id: 15, name: 'Beverley Toudic', fonction: '' },
    ],
    'Economie et ecologie': [
      { id: 20, name: 'Gael Giraud', fonction: '' },
      { id: 21, name: 'Lea Falco', fonction: '' },
      { id: 22, name: 'Nicolas Dufrene', fonction: '' },
    ],
    'Geopolitique': [
      { id: 30, name: 'Simon Music', fonction: '' },
      { id: 31, name: 'Claire Music', fonction: '' },
    ],
  },
  copil: [
    { id: 40, name: 'Marie Music', fonction: 'Coordinatrice' },
    { id: 41, name: 'Paul Music', fonction: 'Responsable communication' },
    { id: 42, name: 'Julie Music', fonction: 'Responsable evenements' },
  ],
};

const DEMO_SUBSCRIBERS = [
  { id: 1, name: 'Marie Dupont', email: 'marie.dupont@gmail.com', date: '2026-04-01', status: 'added', source: 'Site web' },
  { id: 2, name: 'Jean Martin', email: 'j.martin@outlook.fr', date: '2026-04-03', status: 'pending', source: 'Site web' },
  { id: 3, name: 'Sophie Bernard', email: 'sophie.b@proton.me', date: '2026-04-05', status: 'added', source: 'Evenement' },
  { id: 4, name: 'Pierre Leclerc', email: 'p.leclerc@yahoo.fr', date: '2026-04-06', status: 'pending', source: 'Site web' },
  { id: 5, name: 'Alice Moreau', email: 'a.moreau@gmail.com', date: '2026-04-07', status: 'rejected', source: 'Manuel' },
  { id: 6, name: 'Lucas Rousseau', email: 'lucas.r@free.fr', date: '2026-04-08', status: 'pending', source: 'Site web' },
  { id: 7, name: 'Camille Durand', email: 'camille.d@gmail.com', date: '2026-04-09', status: 'pending', source: 'LinkedIn' },
  { id: 8, name: 'Nicolas Petit', email: 'n.petit@laposte.net', date: '2026-04-10', status: 'added', source: 'Site web' },
  { id: 9, name: 'Emma Laurent', email: 'emma.l@gmail.com', date: '2026-04-10', status: 'pending', source: 'Evenement' },
  { id: 10, name: 'Hugo Garcia', email: 'hugo.g@outlook.fr', date: '2026-04-11', status: 'added', source: 'Site web' },
];

const PAGES_CONFIG = [
  { name: 'Accueil', path: 'index.html', refreshCycle: 60 },
  { name: 'Notre projet', path: 'le-projet.html', refreshCycle: 180 },
  { name: 'Publications', path: 'publications.html', refreshCycle: 30 },
  { name: 'Evenements', path: 'evenements.html', refreshCycle: 30 },
  { name: 'Presse', path: 'presse.html', refreshCycle: 45 },
  { name: 'L\'equipe', path: 'equipe.html', refreshCycle: 180 },
  { name: 'Adherer', path: 'adherer.html', refreshCycle: 120 },
  { name: 'Contact', path: 'contact.html', refreshCycle: 180 },
  { name: 'Mentions legales', path: 'mentions-legales.html', refreshCycle: 365 },
  { name: 'Road to Net Zero', path: 'road-to-net-zero.html', refreshCycle: 90 },
];

const DEMO_PAGES = PAGES_CONFIG.map((p, i) => {
  const daysAgo = [5, 45, 35, 60, 50, 200, 100, 150, 400, 95][i];
  const d = new Date(); d.setDate(d.getDate() - daysAgo);
  return { ...p, lastModified: d.toISOString().split('T')[0], sha: 'demo_sha_' + i, daysAgo };
});

const DEMO_ACTIVITY = [
  { date: '2026-04-11', text: 'Hugo Garcia ajoute a la newsletter' },
  { date: '2026-04-11', text: 'Article "Souverainete numerique" passe en brouillon' },
  { date: '2026-04-10', text: 'Page Evenements mise a jour sur le site' },
  { date: '2026-04-09', text: 'Camille Durand inscrite via LinkedIn' },
  { date: '2026-04-08', text: 'Article "Planification ecologique" soumis pour relecture' },
];

// ─── HELPERS ───────────────────────────────────────────
function formatDateFr(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function pageStatus(daysAgo, cycle) {
  if (daysAgo <= cycle) return 'ok';
  if (daysAgo <= cycle * 1.5) return 'review';
  return 'obsolete';
}

function pageStatusLabel(s) {
  if (s === 'ok') return 'A jour';
  if (s === 'review') return 'A verifier';
  return 'Obsolete';
}

function pageStatusBadge(s) {
  if (s === 'ok') return 'badge-green';
  if (s === 'review') return 'badge-ochre';
  return 'badge-terra';
}

async function githubGet(path) {
  const res = await fetch(`${GITHUB_API}/${path}`, {
    headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' },
  });
  if (!res.ok) throw new Error(handleHttpError(res.status));
  return res.json();
}

async function githubPut(path, content, sha, message) {
  const body = {
    message: message || `Mise a jour de ${path} depuis le back-office`,
    content: btoa(unescape(encodeURIComponent(content))),
    branch: 'main',
  };
  if (sha) body.sha = sha;
  const res = await fetch(`${GITHUB_API}/${path}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(handleHttpError(res.status));
  return res.json();
}

function handleHttpError(status) {
  if (status === 401) return 'Token invalide';
  if (status === 403) return 'Acces refuse ou limite atteinte';
  if (status === 404) return 'Fichier non trouve';
  if (status === 409) return 'Conflit — rechargez la page';
  return `Erreur ${status}`;
}

function decodeGhContent(base64) {
  return decodeURIComponent(escape(atob(base64.replace(/\n/g, ''))));
}

function isFuture(dateStr) {
  return new Date(dateStr) >= new Date(new Date().toISOString().split('T')[0]);
}

// ─── STYLES ────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Source+Sans+3:wght@300;400;500;600;700&display=swap');

* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Source Sans 3', sans-serif; background: ${C.bg}; color: ${C.text}; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 800px; } }
@keyframes toastIn { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }

.fade-in { animation: fadeIn 0.4s ease-out; }
.slide-up { animation: slideUp 0.4s ease-out; }
.slide-down { animation: slideDown 0.3s ease-out; overflow: hidden; }
.toast-in { animation: toastIn 0.3s ease-out; }

.card { background: ${C.white}; border: 1px solid ${C.border}; border-radius: 10px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
.btn { font-family: 'Source Sans 3', sans-serif; font-size: 13px; font-weight: 600; padding: 6px 14px; border: none; border-radius: 6px; cursor: pointer; transition: opacity 0.15s, transform 0.1s; }
.btn:hover { opacity: 0.85; transform: translateY(-1px); }
.btn:active { transform: translateY(0); }
.btn-navy { background: ${C.navy}; color: ${C.white}; }
.btn-sky { background: ${C.sky}; color: ${C.white}; }
.btn-green { background: ${C.green}; color: ${C.white}; }
.btn-terra { background: ${C.terra}; color: ${C.white}; }
.btn-ochre { background: ${C.ochre}; color: ${C.white}; }
.btn-outline { background: transparent; border: 1px solid ${C.border}; color: ${C.text}; }
.btn-danger { background: ${C.danger}; color: ${C.white}; }
.btn-sm { padding: 4px 10px; font-size: 12px; }

.badge { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 12px; font-weight: 600; }
.badge-sky { background: #EBF4FF; color: ${C.sky}; }
.badge-green { background: #ECFDF5; color: ${C.green}; }
.badge-ochre { background: #FFF9E6; color: #9A7B1A; }
.badge-terra { background: #FEF2F0; color: ${C.terra}; }
.badge-navy { background: #EEF0F5; color: ${C.navy}; }
.badge-gray { background: #F3F4F6; color: ${C.textLight}; }
.badge-danger { background: #FEE2E2; color: ${C.danger}; }

table { width: 100%; border-collapse: collapse; }
th { text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 600; color: ${C.textLight}; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid ${C.border}; }
td { padding: 10px 12px; font-size: 14px; border-bottom: 1px solid ${C.border}; }
tr:hover td { background: #F9FAFB; }

input, textarea, select {
  font-family: 'Source Sans 3', sans-serif; font-size: 14px; padding: 8px 12px;
  border: 1px solid ${C.border}; border-radius: 6px; outline: none; width: 100%;
  transition: border-color 0.15s;
}
input:focus, textarea:focus, select:focus { border-color: ${C.sky}; }

.pill { display: inline-block; padding: 5px 14px; border-radius: 20px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; border: 1px solid ${C.border}; background: ${C.white}; color: ${C.textLight}; margin-right: 6px; margin-bottom: 6px; }
.pill.active { background: ${C.navy}; color: ${C.white}; border-color: ${C.navy}; }

.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; animation: fadeIn 0.2s; }
.modal { background: ${C.white}; border-radius: 10px; width: 95vw; max-width: 900px; max-height: 90vh; overflow-y: auto; padding: 30px; animation: slideUp 0.3s; }
.modal-full { width: 95vw; max-width: 1200px; max-height: 95vh; }

.table-wrap { overflow-x: auto; }

.event-card { background: ${C.white}; border: 1px solid ${C.border}; border-radius: 10px; padding: 20px; display: flex; gap: 20px; margin-bottom: 12px; transition: box-shadow 0.15s; }
.event-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.event-card.past { opacity: 0.5; }

@media (max-width: 768px) {
  .grid-5 { grid-template-columns: 1fr 1fr !important; }
  .grid-3 { grid-template-columns: 1fr !important; }
  .grid-2 { grid-template-columns: 1fr !important; }
  .header-tabs { gap: 2px !important; }
  .header-tabs span { font-size: 11px !important; padding: 4px 8px !important; }
  .event-card { flex-direction: column; }
}
`;

// ─── TOAST SYSTEM ──────────────────────────────────────
function ToastContainer({ toasts, onRemove }) {
  return (
    <div style={{ position: 'fixed', top: 70, right: 20, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} className="toast-in" style={{
          background: t.type === 'error' ? '#FEE2E2' : t.type === 'warning' ? '#FFF9E6' : '#ECFDF5',
          color: t.type === 'error' ? C.danger : t.type === 'warning' ? '#9A7B1A' : C.green,
          padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 500,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)', cursor: 'pointer', maxWidth: 400,
        }} onClick={() => onRemove(t.id)}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

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

  // Tabs & toasts
  const [tab, setTab] = useState('dashboard');
  const [toasts, setToasts] = useState([]);

  // Publications
  const [publications, setPublications] = useState([]);
  const [pubSearch, setPubSearch] = useState('');
  const [pubTagFilter, setPubTagFilter] = useState('all');
  const [pubStatusFilter, setPubStatusFilter] = useState('all');
  const [showPubForm, setShowPubForm] = useState(false);
  const [editingPub, setEditingPub] = useState(null);
  const [pubForm, setPubForm] = useState({ title: '', author: '', tags: [], summary: '', content: '', type: 'Note', pdfUrl: '' });

  // Events
  const [events, setEvents] = useState([]);
  const [showEvtForm, setShowEvtForm] = useState(false);
  const [editingEvt, setEditingEvt] = useState(null);
  const [evtForm, setEvtForm] = useState({ date: '', title: '', type: 'Conference', description: '', lieu: '', partenaire: '', lienInscription: '', status: 'confirme' });

  // Presse
  const [presse, setPresse] = useState([]);
  const [presseSearch, setPresseSearch] = useState('');
  const [presseYear, setPresseYear] = useState('all');
  const [showPresseForm, setShowPresseForm] = useState(false);
  const [editingPresse, setEditingPresse] = useState(null);
  const [presseForm, setPresseForm] = useState({ title: '', media: '', date: '', url: '', summary: '' });

  // Equipe
  const [equipe, setEquipe] = useState({ ca: [], cs: {}, copil: [] });
  const [equipeTab, setEquipeTab] = useState('ca');
  const [showEquipeForm, setShowEquipeForm] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [memberForm, setMemberForm] = useState({ name: '', fonction: '', section: '' });

  // Newsletter
  const [subscribers, setSubscribers] = useState([]);
  const [subSearch, setSubSearch] = useState('');
  const [subFilter, setSubFilter] = useState('all');
  const [showAddSub, setShowAddSub] = useState(false);
  const [newSub, setNewSub] = useState({ name: '', email: '', source: 'Site web' });

  // Pages
  const [pages, setPages] = useState([]);
  const [editingPage, setEditingPage] = useState(null);
  const [pageContent, setPageContent] = useState('');
  const [pageSaving, setPageSaving] = useState(false);

  // Loading states
  const [publishing, setPublishing] = useState(null);

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // ─── AUTH ──────────────────────────────────────────
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

  // Inactivity timer — 15 min
  useEffect(() => {
    if (!loggedIn) return;
    const resetTimer = () => {
      lastActivity.current = Date.now();
      sessionStorage.setItem('ir-auth', JSON.stringify({ ts: Date.now() }));
    };
    const check = setInterval(() => {
      if (Date.now() - lastActivity.current > 15 * 60 * 1000) {
        handleLogout();
      }
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

  // ─── LOAD DATA ─────────────────────────────────────
  useEffect(() => {
    if (!loggedIn) return;
    setPublications([...DEMO_PUBLICATIONS]);
    setEvents([...DEMO_EVENTS]);
    setPresse([...DEMO_PRESSE]);
    setEquipe(JSON.parse(JSON.stringify(DEMO_EQUIPE)));
    setSubscribers([...DEMO_SUBSCRIBERS]);
    loadPages();
    if (hasBrevo) loadBrevoContacts();
  }, [loggedIn]);

  const loadBrevoContacts = async () => {
    try {
      const res = await fetch('https://api.brevo.com/v3/contacts?limit=50&offset=0', {
        headers: { 'api-key': BREVO_API_KEY, 'Accept': 'application/json' },
      });
      if (!res.ok) { toast(handleHttpError(res.status), 'error'); return; }
      const data = await res.json();
      const contacts = (data.contacts || []).map((c, i) => ({
        id: c.id || i + 1,
        name: c.attributes?.NOM || c.attributes?.PRENOM ? `${c.attributes.PRENOM || ''} ${c.attributes.NOM || ''}`.trim() : c.email.split('@')[0],
        email: c.email,
        date: c.createdAt?.split('T')[0] || '',
        status: 'added',
        source: c.attributes?.SOURCE || 'Brevo',
      }));
      setSubscribers(contacts);
    } catch {
      toast('Erreur de connexion Brevo', 'error');
    }
  };

  const loadPages = async () => {
    if (hasGitHub) {
      try {
        const data = await githubGet('');
        const htmlFiles = (Array.isArray(data) ? data : []).filter(f => f.name.endsWith('.html'));
        const mapped = htmlFiles.map(f => {
          const cfg = PAGES_CONFIG.find(p => p.path === f.name) || { name: f.name, refreshCycle: 90 };
          return { ...cfg, path: f.name, lastModified: new Date().toISOString().split('T')[0], sha: f.sha, daysAgo: 0 };
        });
        if (mapped.length > 0) { setPages(mapped); return; }
      } catch { /* fallback */ }
    }
    setPages([...DEMO_PAGES]);
  };

  // ─── GITHUB FILE OPERATIONS ────────────────────────
  const loadGitHubFile = async (path) => {
    try {
      const data = await githubGet(path);
      return { content: decodeGhContent(data.content), sha: data.sha };
    } catch (e) {
      toast(e.message, 'error');
      return null;
    }
  };

  const saveGitHubFile = async (path, content, sha, message) => {
    try {
      const result = await githubPut(path, content, sha, message);
      toast('Publie sur le site');
      return result.content?.sha || null;
    } catch (e) {
      toast(e.message, 'error');
      return null;
    }
  };

  // ─── SUBSCRIBER ACTIONS ────────────────────────────
  const changeSubStatus = async (id, newStatus) => {
    if (hasBrevo) {
      const sub = subscribers.find(s => s.id === id);
      if (sub && newStatus === 'added') {
        try {
          await fetch('https://api.brevo.com/v3/contacts', {
            method: 'POST',
            headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: sub.email, attributes: { NOM: sub.name, SOURCE: sub.source }, updateEnabled: true }),
          });
        } catch { /* continue locally */ }
      }
    }
    setSubscribers(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
    const labels = { added: 'valide', rejected: 'refuse', pending: 'remis en attente' };
    toast(`Contact ${labels[newStatus]}`);
  };

  const addSubscriber = async () => {
    if (!newSub.name || !newSub.email) return toast('Remplissez tous les champs', 'error');
    if (hasBrevo) {
      try {
        const res = await fetch('https://api.brevo.com/v3/contacts', {
          method: 'POST',
          headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: newSub.email, attributes: { NOM: newSub.name, SOURCE: newSub.source } }),
        });
        if (!res.ok) { toast(handleHttpError(res.status), 'error'); return; }
      } catch { toast('Erreur de connexion', 'error'); return; }
    }
    const entry = { id: Date.now(), name: newSub.name, email: newSub.email, date: new Date().toISOString().split('T')[0], status: 'pending', source: newSub.source };
    setSubscribers(prev => [entry, ...prev]);
    setNewSub({ name: '', email: '', source: 'Site web' });
    setShowAddSub(false);
    toast('Contact ajoute');
  };

  // ─── PUBLICATION ACTIONS ───────────────────────────
  const savePub = () => {
    if (!pubForm.title) return toast('Le titre est requis', 'error');
    if (editingPub) {
      setPublications(prev => prev.map(p => p.id === editingPub.id ? { ...p, ...pubForm } : p));
      toast('Publication mise a jour');
    } else {
      setPublications(prev => [{ id: Date.now(), ...pubForm, status: 'draft', date: new Date().toISOString().split('T')[0] }, ...prev]);
      toast('Publication creee');
    }
    resetPubForm();
  };

  const resetPubForm = () => {
    setShowPubForm(false);
    setEditingPub(null);
    setPubForm({ title: '', author: '', tags: [], summary: '', content: '', type: 'Note', pdfUrl: '' });
  };

  const startEditPub = (pub) => {
    setEditingPub(pub);
    setPubForm({ title: pub.title, author: pub.author, tags: [...pub.tags], summary: pub.summary || '', content: pub.content || '', type: pub.type || 'Note', pdfUrl: pub.pdfUrl || '' });
    setShowPubForm(true);
  };

  const changePubStatus = (id, newStatus) => {
    setPublications(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    toast(`Publication passee en ${PUB_STATUS_LABELS[newStatus]}`);
  };

  const publishPub = async (id) => {
    setPublishing(id);
    const pub = publications.find(p => p.id === id);
    if (!pub) { setPublishing(null); return; }

    if (hasGitHub) {
      try {
        const file = await loadGitHubFile('publications.html');
        if (!file) { setPublishing(null); return; }
        const cardHtml = `\n<article class="publication-card" data-tags="${pub.tags.join(' ')}">\n  <span class="tag">${pub.tags.join('</span><span class="tag">')}</span>\n  <span class="type">${pub.type}</span>\n  <h3>${pub.title}</h3>\n  <p class="meta">${pub.author} — ${formatDateFr(pub.date)}</p>\n  <p>${pub.summary}</p>${pub.pdfUrl ? `\n  <a href="${pub.pdfUrl}" target="_blank">Lire le PDF</a>` : ''}\n</article>`;
        let html = file.content;
        const insertPoint = html.lastIndexOf('</section>');
        if (insertPoint > -1) {
          html = html.slice(0, insertPoint) + cardHtml + '\n' + html.slice(insertPoint);
        } else {
          html += cardHtml;
        }
        const newSha = await saveGitHubFile('publications.html', html, file.sha, `Ajout publication: ${pub.title}`);
        if (newSha) {
          setPublications(prev => prev.map(p => p.id === id ? { ...p, status: 'published' } : p));
        }
      } catch { toast('Erreur de connexion', 'error'); }
    } else {
      await new Promise(r => setTimeout(r, 1500));
      setPublications(prev => prev.map(p => p.id === id ? { ...p, status: 'published' } : p));
      toast('Publication publiee (simulation)');
    }
    setPublishing(null);
  };

  const unpublishPub = (id) => {
    setPublications(prev => prev.map(p => p.id === id ? { ...p, status: 'ready' } : p));
    toast('Publication depubliee');
  };

  const deletePub = (id) => {
    setPublications(prev => prev.filter(p => p.id !== id));
    toast('Publication supprimee');
  };

  // ─── EVENT ACTIONS ─────────────────────────────────
  const saveEvt = () => {
    if (!evtForm.title || !evtForm.date) return toast('Titre et date requis', 'error');
    if (editingEvt) {
      setEvents(prev => prev.map(e => e.id === editingEvt.id ? { ...e, ...evtForm } : e));
      toast('Evenement mis a jour');
    } else {
      setEvents(prev => [...prev, { id: Date.now(), ...evtForm }]);
      toast('Evenement cree');
    }
    resetEvtForm();
  };

  const resetEvtForm = () => {
    setShowEvtForm(false);
    setEditingEvt(null);
    setEvtForm({ date: '', title: '', type: 'Conference', description: '', lieu: '', partenaire: '', lienInscription: '', status: 'confirme' });
  };

  const startEditEvt = (evt) => {
    setEditingEvt(evt);
    setEvtForm({ date: evt.date, title: evt.title, type: evt.type, description: evt.description || '', lieu: evt.lieu || '', partenaire: evt.partenaire || '', lienInscription: evt.lienInscription || '', status: evt.status });
    setShowEvtForm(true);
  };

  const deleteEvt = (id) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    toast('Evenement supprime');
  };

  const publishEvt = async (id) => {
    setPublishing(id);
    const evt = events.find(e => e.id === id);
    if (!evt) { setPublishing(null); return; }

    if (hasGitHub) {
      try {
        const file = await loadGitHubFile('evenements.html');
        if (!file) { setPublishing(null); return; }
        const cardHtml = `\n<article class="event-card" data-status="${evt.status}">\n  <time>${formatDateFr(evt.date)}</time>\n  <span class="type">${evt.type}</span>\n  <h3>${evt.title}</h3>\n  <p class="lieu">${evt.lieu}</p>${evt.partenaire ? `\n  <p class="partenaire">En partenariat avec ${evt.partenaire}</p>` : ''}\n  <p>${evt.description}</p>\n</article>`;
        let html = file.content;
        const insertPoint = html.lastIndexOf('</section>');
        if (insertPoint > -1) {
          html = html.slice(0, insertPoint) + cardHtml + '\n' + html.slice(insertPoint);
        } else {
          html += cardHtml;
        }
        await saveGitHubFile('evenements.html', html, file.sha, `Ajout evenement: ${evt.title}`);
      } catch { toast('Erreur de connexion', 'error'); }
    } else {
      await new Promise(r => setTimeout(r, 1500));
      toast('Evenement publie (simulation)');
    }
    setPublishing(null);
  };

  // ─── PRESSE ACTIONS ────────────────────────────────
  const savePresseItem = () => {
    if (!presseForm.title || !presseForm.media) return toast('Titre et media requis', 'error');
    if (editingPresse) {
      setPresse(prev => prev.map(p => p.id === editingPresse.id ? { ...p, ...presseForm } : p));
      toast('Article presse mis a jour');
    } else {
      setPresse(prev => [{ id: Date.now(), ...presseForm, date: presseForm.date || new Date().toISOString().split('T')[0] }, ...prev]);
      toast('Article presse ajoute');
    }
    resetPresseForm();
  };

  const resetPresseForm = () => {
    setShowPresseForm(false);
    setEditingPresse(null);
    setPresseForm({ title: '', media: '', date: '', url: '', summary: '' });
  };

  const startEditPresse = (p) => {
    setEditingPresse(p);
    setPresseForm({ title: p.title, media: p.media, date: p.date, url: p.url || '', summary: p.summary || '' });
    setShowPresseForm(true);
  };

  const deletePresse = (id) => {
    setPresse(prev => prev.filter(p => p.id !== id));
    toast('Article presse supprime');
  };

  const publishPresse = async (id) => {
    setPublishing(id);
    const art = presse.find(p => p.id === id);
    if (!art) { setPublishing(null); return; }

    if (hasGitHub) {
      try {
        const file = await loadGitHubFile('presse.html');
        if (!file) { setPublishing(null); return; }
        const cardHtml = `\n<article class="presse-item">\n  <span class="media">${art.media}</span>\n  <h3><a href="${art.url || '#'}" target="_blank">${art.title}</a></h3>\n  <time>${formatDateFr(art.date)}</time>${art.summary ? `\n  <p>${art.summary}</p>` : ''}\n</article>`;
        let html = file.content;
        const insertPoint = html.lastIndexOf('</section>');
        if (insertPoint > -1) {
          html = html.slice(0, insertPoint) + cardHtml + '\n' + html.slice(insertPoint);
        } else {
          html += cardHtml;
        }
        await saveGitHubFile('presse.html', html, file.sha, `Ajout article presse: ${art.title}`);
      } catch { toast('Erreur de connexion', 'error'); }
    } else {
      await new Promise(r => setTimeout(r, 1500));
      toast('Article presse publie (simulation)');
    }
    setPublishing(null);
  };

  // ─── EQUIPE ACTIONS ────────────────────────────────
  const saveEquipeMember = () => {
    if (!memberForm.name) return toast('Le nom est requis', 'error');
    if (equipeTab === 'ca') {
      if (editingMember) {
        setEquipe(prev => ({ ...prev, ca: prev.ca.map(m => m.id === editingMember.id ? { ...m, name: memberForm.name, fonction: memberForm.fonction } : m) }));
      } else {
        setEquipe(prev => ({ ...prev, ca: [...prev.ca, { id: Date.now(), name: memberForm.name, fonction: memberForm.fonction }] }));
      }
    } else if (equipeTab === 'cs') {
      const section = memberForm.section || Object.keys(equipe.cs)[0] || 'Autre';
      if (editingMember) {
        setEquipe(prev => {
          const cs = { ...prev.cs };
          for (const key of Object.keys(cs)) {
            cs[key] = cs[key].map(m => m.id === editingMember.id ? { ...m, name: memberForm.name, fonction: memberForm.fonction } : m);
          }
          return { ...prev, cs };
        });
      } else {
        setEquipe(prev => {
          const cs = { ...prev.cs };
          if (!cs[section]) cs[section] = [];
          cs[section] = [...cs[section], { id: Date.now(), name: memberForm.name, fonction: memberForm.fonction }];
          return { ...prev, cs };
        });
      }
    } else {
      if (editingMember) {
        setEquipe(prev => ({ ...prev, copil: prev.copil.map(m => m.id === editingMember.id ? { ...m, name: memberForm.name, fonction: memberForm.fonction } : m) }));
      } else {
        setEquipe(prev => ({ ...prev, copil: [...prev.copil, { id: Date.now(), name: memberForm.name, fonction: memberForm.fonction }] }));
      }
    }
    toast(editingMember ? 'Membre mis a jour' : 'Membre ajoute');
    setShowEquipeForm(false);
    setEditingMember(null);
    setMemberForm({ name: '', fonction: '', section: '' });
  };

  const startEditMember = (m) => {
    setEditingMember(m);
    setMemberForm({ name: m.name, fonction: m.fonction || '', section: '' });
    setShowEquipeForm(true);
  };

  const deleteMember = (id) => {
    setEquipe(prev => {
      const ca = prev.ca.filter(m => m.id !== id);
      const cs = {};
      for (const key of Object.keys(prev.cs)) {
        cs[key] = prev.cs[key].filter(m => m.id !== id);
      }
      const copil = prev.copil.filter(m => m.id !== id);
      return { ca, cs, copil };
    });
    toast('Membre supprime');
  };

  const moveInList = (listKey, idx, dir) => {
    setEquipe(prev => {
      const arr = [...prev[listKey]];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= arr.length) return prev;
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return { ...prev, [listKey]: arr };
    });
  };

  const publishEquipe = async () => {
    setPublishing('equipe');
    if (hasGitHub) {
      try {
        const file = await loadGitHubFile('equipe.html');
        if (file) {
          toast('Equipe publiee sur le site');
        }
      } catch { toast('Erreur de connexion', 'error'); }
    } else {
      await new Promise(r => setTimeout(r, 1000));
      toast('Equipe publiee (simulation)');
    }
    setPublishing(null);
  };

  // ─── PAGE ACTIONS ──────────────────────────────────
  const editPage = async (page) => {
    if (hasGitHub) {
      try {
        const data = await githubGet(page.path);
        setPageContent(decodeGhContent(data.content));
        setEditingPage({ ...page, sha: data.sha });
      } catch (e) { toast(e.message || 'Erreur de connexion', 'error'); }
    } else {
      setPageContent(`<!DOCTYPE html>\n<html lang="fr">\n<head><title>${page.name} — Institut Rousseau</title></head>\n<body>\n<h1>${page.name}</h1>\n<p>Contenu de demo</p>\n</body>\n</html>`);
      setEditingPage(page);
    }
  };

  const savePage = async () => {
    if (!editingPage) return;
    setPageSaving(true);
    if (hasGitHub) {
      try {
        const newSha = await saveGitHubFile(editingPage.path, pageContent, editingPage.sha, `Mise a jour de ${editingPage.name} depuis le back-office`);
        if (newSha) {
          setEditingPage(null);
          loadPages();
        }
      } catch { toast('Erreur de connexion', 'error'); }
    } else {
      await new Promise(r => setTimeout(r, 1500));
      toast('Page sauvegardee (simulation)');
      setEditingPage(null);
    }
    setPageSaving(false);
  };

  // ─── COMPUTED ──────────────────────────────────────
  const subCounts = useMemo(() => {
    const added = subscribers.filter(s => s.status === 'added').length;
    const pending = subscribers.filter(s => s.status === 'pending').length;
    const rejected = subscribers.filter(s => s.status === 'rejected').length;
    return { added, pending, rejected, total: subscribers.length };
  }, [subscribers]);

  const pubCounts = useMemo(() => ({
    total: publications.length,
    draft: publications.filter(p => p.status === 'draft').length,
    review: publications.filter(p => p.status === 'review').length,
    ready: publications.filter(p => p.status === 'ready').length,
    published: publications.filter(p => p.status === 'published').length,
  }), [publications]);

  const evtCounts = useMemo(() => ({
    total: events.length,
    upcoming: events.filter(e => isFuture(e.date)).length,
    past: events.filter(e => !isFuture(e.date)).length,
    enPrep: events.filter(e => e.status === 'en_preparation').length,
  }), [events]);

  const pageCounts = useMemo(() => {
    const ok = pages.filter(p => pageStatus(p.daysAgo, p.refreshCycle) === 'ok').length;
    const review = pages.filter(p => pageStatus(p.daysAgo, p.refreshCycle) === 'review').length;
    const obsolete = pages.filter(p => pageStatus(p.daysAgo, p.refreshCycle) === 'obsolete').length;
    return { ok, review, obsolete, total: pages.length };
  }, [pages]);

  const tabBadges = useMemo(() => ({
    dashboard: 0,
    publications: pubCounts.review,
    evenements: 0,
    presse: 0,
    equipe: 0,
    newsletter: subCounts.pending,
    pages: pageCounts.review + pageCounts.obsolete,
  }), [pubCounts, subCounts, pageCounts]);

  const filteredPubs = useMemo(() => {
    let list = publications;
    if (pubTagFilter !== 'all') list = list.filter(p => p.tags.includes(pubTagFilter));
    if (pubStatusFilter !== 'all') list = list.filter(p => p.status === pubStatusFilter);
    if (pubSearch) {
      const q = pubSearch.toLowerCase();
      list = list.filter(p => p.title.toLowerCase().includes(q) || p.author.toLowerCase().includes(q));
    }
    return list;
  }, [publications, pubTagFilter, pubStatusFilter, pubSearch]);

  const filteredPresse = useMemo(() => {
    let list = presse;
    if (presseYear !== 'all') list = list.filter(p => p.date.startsWith(presseYear));
    if (presseSearch) {
      const q = presseSearch.toLowerCase();
      list = list.filter(p => p.title.toLowerCase().includes(q) || p.media.toLowerCase().includes(q));
    }
    return list;
  }, [presse, presseYear, presseSearch]);

  const filteredSubs = useMemo(() => {
    let list = subscribers;
    if (subFilter !== 'all') list = list.filter(s => s.status === subFilter);
    if (subSearch) {
      const q = subSearch.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
    }
    return list;
  }, [subscribers, subFilter, subSearch]);

  const presseYears = useMemo(() => {
    return [...new Set(presse.map(p => p.date.slice(0, 4)))].sort().reverse();
  }, [presse]);

  const sortedEvents = useMemo(() => {
    const upcoming = events.filter(e => isFuture(e.date)).sort((a, b) => new Date(a.date) - new Date(b.date));
    const past = events.filter(e => !isFuture(e.date)).sort((a, b) => new Date(b.date) - new Date(a.date));
    return [...upcoming, ...past];
  }, [events]);

  // ─── LOGIN SCREEN ──────────────────────────────────
  if (!loggedIn) {
    return (
      <>
        <style>{css}</style>
        <div className="fade-in" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
          <div className="card slide-up" style={{ width: 380, padding: 40, textAlign: 'center' }}>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 700, color: C.navy, marginBottom: 4 }}>Institut Rousseau</h1>
            <p style={{ color: C.textLight, fontSize: 15, marginBottom: 30 }}>Back-office</p>
            <form onSubmit={handleLogin}>
              <input placeholder="Identifiant" value={loginId} onChange={e => setLoginId(e.target.value)} style={{ marginBottom: 12 }} />
              <input placeholder="Mot de passe" type="password" value={loginPw} onChange={e => setLoginPw(e.target.value)} style={{ marginBottom: 16 }} />
              {loginError && <p style={{ color: C.danger, fontSize: 13, marginBottom: 12 }}>{loginError}</p>}
              <button type="submit" className="btn btn-navy" style={{ width: '100%', padding: '10px 0', fontSize: 15 }}>Se connecter</button>
            </form>
          </div>
        </div>
      </>
    );
  }

  // ─── SHARED UI ─────────────────────────────────────
  const StatusDot = ({ active, label }) => (
    <span style={{ fontSize: 12, color: C.white, opacity: active ? 1 : 0.5, marginLeft: 14 }}>
      <span style={{ color: active ? '#4ADE80' : '#9CA3AF' }}>{'\u25CF'}</span> {label}
    </span>
  );

  const StatCard = ({ label, value, sub, color }) => (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Cormorant Garamond', serif", color: color || C.navy }}>{value}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: C.textLight, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  const SectionTitle = ({ children }) => (
    <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: C.navy, marginBottom: 16 }}>{children}</h2>
  );

  const FormField = ({ label, children }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textLight, marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );

  const DemoWarning = ({ service }) => (
    <div style={{ background: '#FFF9E6', border: `1px solid ${C.ochre}`, borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#9A7B1A' }}>
      Mode demo — configurez {service} pour les donnees reelles
    </div>
  );

  const tabs = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'publications', label: 'Publications' },
    { key: 'evenements', label: 'Evenements' },
    { key: 'presse', label: 'Presse' },
    { key: 'equipe', label: 'Equipe' },
    { key: 'newsletter', label: 'Newsletter' },
    { key: 'pages', label: 'Pages' },
  ];

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════
  return (
    <>
      <style>{css}</style>
      <ToastContainer toasts={toasts} onRemove={id => setToasts(prev => prev.filter(t => t.id !== id))} />

      {/* PAGE EDITOR MODAL */}
      {editingPage && (
        <div className="overlay" onClick={() => setEditingPage(null)}>
          <div className="modal modal-full" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: C.navy }}>{editingPage.name} — {editingPage.path}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline" onClick={() => setEditingPage(null)}>Annuler</button>
                <button className="btn btn-green" onClick={savePage} disabled={pageSaving}>{pageSaving ? 'Sauvegarde...' : 'Sauvegarder et publier'}</button>
              </div>
            </div>
            <textarea
              value={pageContent}
              onChange={e => setPageContent(e.target.value)}
              style={{ width: '100%', minHeight: 500, fontFamily: 'monospace', fontSize: 13, lineHeight: 1.5, padding: 16, border: `1px solid ${C.border}`, borderRadius: 8 }}
            />
          </div>
        </div>
      )}

      {/* HEADER */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: C.navy, height: 60, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 16, color: C.white }}>IR</span>
          </div>
          <div>
            <span style={{ color: C.white, fontWeight: 600, fontSize: 15 }}>Institut Rousseau</span>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginLeft: 8 }}>Back-office</span>
          </div>
        </div>

        <nav className="header-tabs" style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <span key={t.key} onClick={() => setTab(t.key)} style={{
              color: tab === t.key ? C.white : 'rgba(255,255,255,0.6)',
              fontWeight: tab === t.key ? 600 : 400,
              fontSize: 13, cursor: 'pointer', padding: '5px 12px',
              borderRadius: 6, background: tab === t.key ? 'rgba(255,255,255,0.12)' : 'transparent',
              transition: 'all 0.15s', position: 'relative', whiteSpace: 'nowrap',
            }}>
              {t.label}
              {tabBadges[t.key] > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -6,
                  background: C.terra, color: C.white, fontSize: 10, fontWeight: 700, borderRadius: 10,
                  minWidth: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
                }}>{tabBadges[t.key]}</span>
              )}
            </span>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <StatusDot active={hasGitHub} label="GitHub" />
          <StatusDot active={hasBrevo} label="Brevo" />
          <button className="btn btn-outline" style={{ marginLeft: 16, color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)', fontSize: 12 }} onClick={handleLogout}>
            Deconnexion
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>

        {/* ═══ DASHBOARD ═══ */}
        {tab === 'dashboard' && (
          <div className="fade-in">
            <SectionTitle>Tableau de bord</SectionTitle>
            <div className="grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
              <StatCard label="Publications" value={pubCounts.total} sub={`${pubCounts.published} publiees, ${pubCounts.draft} brouillons`} color={C.sky} />
              <StatCard label="Evenements" value={evtCounts.total} sub={`${evtCounts.upcoming} a venir`} color={C.green} />
              <StatCard label="Presse" value={presse.length} sub={`${presse.length} articles`} color={C.ochre} />
              <StatCard label="Newsletter" value={subCounts.total} sub={`${subCounts.pending} en attente`} color={C.terra} />
              <StatCard label="Pages du site" value={pageCounts.total} sub={`${pageCounts.review + pageCounts.obsolete} a mettre a jour`} color={C.navy} />
            </div>

            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div className="card">
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Dernieres actions en attente</h3>
                {publications.filter(p => p.status === 'review').length === 0 && subCounts.pending === 0 ? (
                  <p style={{ color: C.textLight, fontSize: 14 }}>Aucune action en attente</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {publications.filter(p => p.status === 'review').slice(0, 3).map(p => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                        <div>
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{p.title}</span>
                          <span className="badge badge-ochre" style={{ marginLeft: 8 }}>Relecture</span>
                        </div>
                        <button className="btn btn-sm btn-sky" onClick={() => setTab('publications')}>Voir</button>
                      </div>
                    ))}
                    {subCounts.pending > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{subCounts.pending} abonnes a valider</span>
                        <button className="btn btn-sm btn-sky" onClick={() => setTab('newsletter')}>Voir</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="card">
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Prochains evenements</h3>
                {events.filter(e => isFuture(e.date)).length === 0 ? (
                  <p style={{ color: C.textLight, fontSize: 14 }}>Aucun evenement a venir</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {events.filter(e => isFuture(e.date)).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 2).map(e => (
                      <div key={e.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.sky }}>{formatDateFr(e.date)}</div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{e.title}</div>
                        <div style={{ fontSize: 12, color: C.textLight }}>{e.lieu}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Activite recente</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {DEMO_ACTIVITY.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: i < DEMO_ACTIVITY.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <span style={{ fontSize: 12, color: C.textLight, minWidth: 90 }}>{formatDateFr(a.date)}</span>
                    <span style={{ fontSize: 14 }}>{a.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ PUBLICATIONS ═══ */}
        {tab === 'publications' && (
          <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <SectionTitle>Publications</SectionTitle>
              <button className="btn btn-navy" onClick={() => { resetPubForm(); setShowPubForm(true); }}>Nouvelle publication</button>
            </div>

            {!hasGitHub && <DemoWarning service="VITE_GITHUB_TOKEN" />}

            {showPubForm && (
              <div className="card slide-down" style={{ marginBottom: 16 }}>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 16 }}>{editingPub ? 'Modifier la publication' : 'Nouvelle publication'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <FormField label="Titre">
                    <input value={pubForm.title} onChange={e => setPubForm(p => ({ ...p, title: e.target.value }))} />
                  </FormField>
                  <FormField label="Auteur">
                    <input value={pubForm.author} onChange={e => setPubForm(p => ({ ...p, author: e.target.value }))} />
                  </FormField>
                </div>
                <FormField label="Thematiques">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {THEMATIQUES.map(t => (
                      <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer', padding: '4px 10px', borderRadius: 6, background: pubForm.tags.includes(t) ? '#EBF4FF' : '#F9FAFB', border: `1px solid ${pubForm.tags.includes(t) ? C.sky : C.border}` }}>
                        <input type="checkbox" checked={pubForm.tags.includes(t)} onChange={() => {
                          setPubForm(p => ({ ...p, tags: p.tags.includes(t) ? p.tags.filter(x => x !== t) : [...p.tags, t] }));
                        }} style={{ width: 'auto', marginRight: 4 }} />
                        {t}
                      </label>
                    ))}
                  </div>
                </FormField>
                <FormField label="Resume">
                  <textarea rows={3} value={pubForm.summary} onChange={e => setPubForm(p => ({ ...p, summary: e.target.value }))} />
                </FormField>
                <FormField label="Contenu complet">
                  <textarea rows={8} value={pubForm.content} onChange={e => setPubForm(p => ({ ...p, content: e.target.value }))} />
                </FormField>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <FormField label="Type">
                    <select value={pubForm.type} onChange={e => setPubForm(p => ({ ...p, type: e.target.value }))}>
                      <option>Note</option>
                      <option>Point de vue</option>
                    </select>
                  </FormField>
                  <FormField label="Lien PDF (optionnel)">
                    <input value={pubForm.pdfUrl} onChange={e => setPubForm(p => ({ ...p, pdfUrl: e.target.value }))} placeholder="https://..." />
                  </FormField>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                  <button className="btn btn-outline" onClick={resetPubForm}>Annuler</button>
                  <button className="btn btn-navy" onClick={savePub}>{editingPub ? 'Enregistrer' : 'Creer'}</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <input placeholder="Rechercher..." value={pubSearch} onChange={e => setPubSearch(e.target.value)} style={{ maxWidth: 260 }} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <span className={`pill ${pubTagFilter === 'all' ? 'active' : ''}`} onClick={() => setPubTagFilter('all')}>Toutes</span>
              {THEMATIQUES.map(t => (
                <span key={t} className={`pill ${pubTagFilter === t ? 'active' : ''}`} onClick={() => setPubTagFilter(t)}>{t}</span>
              ))}
            </div>
            <div style={{ marginBottom: 16 }}>
              <span className={`pill ${pubStatusFilter === 'all' ? 'active' : ''}`} onClick={() => setPubStatusFilter('all')}>Tous</span>
              {PUB_STATUSES.map(s => (
                <span key={s} className={`pill ${pubStatusFilter === s ? 'active' : ''}`} onClick={() => setPubStatusFilter(s)}>{PUB_STATUS_LABELS[s]}</span>
              ))}
            </div>

            <div className="card table-wrap">
              <table>
                <thead>
                  <tr><th>Titre</th><th>Auteur</th><th>Tags</th><th>Type</th><th>Date</th><th>Statut</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filteredPubs.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500, maxWidth: 280 }}>{p.title}</td>
                      <td>{p.author}</td>
                      <td>{p.tags.map(t => <span key={t} className="badge badge-sky" style={{ marginRight: 4 }}>{t}</span>)}</td>
                      <td style={{ fontSize: 13 }}>{p.type}</td>
                      <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{formatDateFr(p.date)}</td>
                      <td><span className={`badge ${PUB_STATUS_BADGE[p.status]}`}>{PUB_STATUS_LABELS[p.status]}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <button className="btn btn-sm btn-outline" onClick={() => startEditPub(p)}>Editer</button>
                          {p.status !== 'published' && (
                            <select className="btn btn-sm btn-outline" style={{ fontSize: 12, padding: '4px 6px', width: 'auto' }} value={p.status} onChange={e => changePubStatus(p.id, e.target.value)}>
                              {PUB_STATUSES.map(s => <option key={s} value={s}>{PUB_STATUS_LABELS[s]}</option>)}
                            </select>
                          )}
                          {p.status === 'ready' && (
                            <button className="btn btn-sm btn-green" onClick={() => publishPub(p.id)} disabled={publishing === p.id}>
                              {publishing === p.id ? 'Publication...' : 'Publier'}
                            </button>
                          )}
                          {p.status === 'published' && (
                            <button className="btn btn-sm btn-ochre" onClick={() => unpublishPub(p.id)}>Depublier</button>
                          )}
                          <button className="btn btn-sm btn-danger" onClick={() => deletePub(p.id)}>Supprimer</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPubs.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: C.textLight, padding: 30 }}>Aucune publication trouvee</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ EVENEMENTS ═══ */}
        {tab === 'evenements' && (
          <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <SectionTitle>Evenements</SectionTitle>
              <button className="btn btn-navy" onClick={() => { resetEvtForm(); setShowEvtForm(true); }}>Nouvel evenement</button>
            </div>

            {!hasGitHub && <DemoWarning service="VITE_GITHUB_TOKEN" />}

            <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              <StatCard label="A venir" value={evtCounts.upcoming} color={C.green} />
              <StatCard label="Passes" value={evtCounts.past} color={C.textLight} />
              <StatCard label="En preparation" value={evtCounts.enPrep} color={C.ochre} />
            </div>

            {showEvtForm && (
              <div className="card slide-down" style={{ marginBottom: 16 }}>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 16 }}>{editingEvt ? 'Modifier l\'evenement' : 'Nouvel evenement'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <FormField label="Date">
                    <input type="date" value={evtForm.date} onChange={e => setEvtForm(f => ({ ...f, date: e.target.value }))} />
                  </FormField>
                  <FormField label="Titre">
                    <input value={evtForm.title} onChange={e => setEvtForm(f => ({ ...f, title: e.target.value }))} />
                  </FormField>
                  <FormField label="Type">
                    <select value={evtForm.type} onChange={e => setEvtForm(f => ({ ...f, type: e.target.value }))}>
                      {EVT_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Statut">
                    <select value={evtForm.status} onChange={e => setEvtForm(f => ({ ...f, status: e.target.value }))}>
                      {EVT_STATUSES.map(s => <option key={s} value={s}>{EVT_STATUS_LABELS[s]}</option>)}
                    </select>
                  </FormField>
                </div>
                <FormField label="Description">
                  <textarea rows={3} value={evtForm.description} onChange={e => setEvtForm(f => ({ ...f, description: e.target.value }))} />
                </FormField>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <FormField label="Lieu">
                    <input value={evtForm.lieu} onChange={e => setEvtForm(f => ({ ...f, lieu: e.target.value }))} />
                  </FormField>
                  <FormField label="Partenaire (optionnel)">
                    <input value={evtForm.partenaire} onChange={e => setEvtForm(f => ({ ...f, partenaire: e.target.value }))} />
                  </FormField>
                </div>
                <FormField label="Lien d'inscription (optionnel)">
                  <input value={evtForm.lienInscription} onChange={e => setEvtForm(f => ({ ...f, lienInscription: e.target.value }))} placeholder="https://..." />
                </FormField>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                  <button className="btn btn-outline" onClick={resetEvtForm}>Annuler</button>
                  <button className="btn btn-navy" onClick={saveEvt}>{editingEvt ? 'Enregistrer' : 'Creer'}</button>
                </div>
              </div>
            )}

            {sortedEvents.map(e => {
              const past = !isFuture(e.date);
              return (
                <div key={e.id} className={`event-card${past ? ' past' : ''}`}>
                  <div style={{ minWidth: 100, textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Cormorant Garamond', serif", color: past ? C.textLight : C.navy }}>
                      {new Date(e.date).getDate()}
                    </div>
                    <div style={{ fontSize: 13, color: past ? C.textLight : C.sky, fontWeight: 600 }}>
                      {new Date(e.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span className={`badge ${EVT_STATUS_BADGE[e.status]}`}>{EVT_STATUS_LABELS[e.status]}</span>
                      <span className="badge badge-navy">{e.type}</span>
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 4 }}>{e.title}</h3>
                    <p style={{ fontSize: 13, color: C.textLight, marginBottom: 2 }}>{e.lieu}</p>
                    {e.partenaire && <p style={{ fontSize: 13, color: C.sky }}>En partenariat avec {e.partenaire}</p>}
                    {e.description && <p style={{ fontSize: 13, color: C.textLight, marginTop: 4 }}>{e.description}</p>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                    <button className="btn btn-sm btn-outline" onClick={() => startEditEvt(e)}>Editer</button>
                    <button className="btn btn-sm btn-green" onClick={() => publishEvt(e.id)} disabled={publishing === e.id}>
                      {publishing === e.id ? '...' : 'Publier'}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteEvt(e.id)}>Supprimer</button>
                  </div>
                </div>
              );
            })}
            {events.length === 0 && (
              <div className="card" style={{ textAlign: 'center', color: C.textLight, padding: 40 }}>Aucun evenement</div>
            )}
          </div>
        )}

        {/* ═══ PRESSE ═══ */}
        {tab === 'presse' && (
          <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <SectionTitle>Presse</SectionTitle>
              <button className="btn btn-navy" onClick={() => { resetPresseForm(); setShowPresseForm(true); }}>Ajouter un article presse</button>
            </div>

            {!hasGitHub && <DemoWarning service="VITE_GITHUB_TOKEN" />}

            {showPresseForm && (
              <div className="card slide-down" style={{ marginBottom: 16 }}>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 16 }}>{editingPresse ? 'Modifier l\'article' : 'Nouvel article presse'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <FormField label="Titre">
                    <input value={presseForm.title} onChange={e => setPresseForm(f => ({ ...f, title: e.target.value }))} />
                  </FormField>
                  <FormField label="Media">
                    <input value={presseForm.media} onChange={e => setPresseForm(f => ({ ...f, media: e.target.value }))} />
                  </FormField>
                  <FormField label="Date">
                    <input type="date" value={presseForm.date} onChange={e => setPresseForm(f => ({ ...f, date: e.target.value }))} />
                  </FormField>
                  <FormField label="URL de l'article">
                    <input value={presseForm.url} onChange={e => setPresseForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." />
                  </FormField>
                </div>
                <FormField label="Resume (optionnel)">
                  <textarea rows={2} value={presseForm.summary} onChange={e => setPresseForm(f => ({ ...f, summary: e.target.value }))} />
                </FormField>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                  <button className="btn btn-outline" onClick={resetPresseForm}>Annuler</button>
                  <button className="btn btn-navy" onClick={savePresseItem}>{editingPresse ? 'Enregistrer' : 'Ajouter'}</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <input placeholder="Rechercher..." value={presseSearch} onChange={e => setPresseSearch(e.target.value)} style={{ maxWidth: 260 }} />
              <select value={presseYear} onChange={e => setPresseYear(e.target.value)} style={{ maxWidth: 140 }}>
                <option value="all">Toutes les annees</option>
                {presseYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div className="card table-wrap">
              <table>
                <thead>
                  <tr><th>Titre</th><th>Media</th><th>Date</th><th>Lien</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filteredPresse.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500, maxWidth: 350 }}>{p.title}</td>
                      <td><span className="badge badge-navy">{p.media}</span></td>
                      <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{formatDateFr(p.date)}</td>
                      <td>{p.url && p.url !== '#' ? <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: C.sky, fontSize: 13 }}>Voir l'article</a> : <span style={{ color: C.textLight, fontSize: 13 }}>—</span>}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-sm btn-outline" onClick={() => startEditPresse(p)}>Editer</button>
                          <button className="btn btn-sm btn-green" onClick={() => publishPresse(p.id)} disabled={publishing === p.id}>
                            {publishing === p.id ? '...' : 'Publier'}
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => deletePresse(p.id)}>Supprimer</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPresse.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: C.textLight, padding: 30 }}>Aucun article trouve</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ EQUIPE ═══ */}
        {tab === 'equipe' && (
          <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <SectionTitle>L'equipe</SectionTitle>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-navy" onClick={() => { setEditingMember(null); setMemberForm({ name: '', fonction: '', section: '' }); setShowEquipeForm(true); }}>Ajouter un membre</button>
                <button className="btn btn-green" onClick={publishEquipe} disabled={publishing === 'equipe'}>{publishing === 'equipe' ? '...' : 'Publier sur le site'}</button>
              </div>
            </div>

            <div style={{ background: '#FFF9E6', border: `1px solid ${C.ochre}`, borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#9A7B1A' }}>
              Regle editoriale : les femmes doivent apparaitre en positions 1 et 2 dans chaque liste
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[{ key: 'ca', label: 'Conseil d\'administration' }, { key: 'cs', label: 'Conseil scientifique' }, { key: 'copil', label: 'COPIL' }].map(t => (
                <span key={t.key} className={`pill ${equipeTab === t.key ? 'active' : ''}`} onClick={() => setEquipeTab(t.key)}>{t.label}</span>
              ))}
            </div>

            {showEquipeForm && (
              <div className="card slide-down" style={{ marginBottom: 16 }}>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 16 }}>{editingMember ? 'Modifier le membre' : 'Nouveau membre'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <FormField label="Nom">
                    <input value={memberForm.name} onChange={e => setMemberForm(f => ({ ...f, name: e.target.value }))} />
                  </FormField>
                  <FormField label="Fonction">
                    <input value={memberForm.fonction} onChange={e => setMemberForm(f => ({ ...f, fonction: e.target.value }))} />
                  </FormField>
                </div>
                {equipeTab === 'cs' && (
                  <FormField label="Section">
                    <select value={memberForm.section} onChange={e => setMemberForm(f => ({ ...f, section: e.target.value }))}>
                      <option value="">Choisir une section</option>
                      {Object.keys(equipe.cs).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </FormField>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                  <button className="btn btn-outline" onClick={() => { setShowEquipeForm(false); setEditingMember(null); }}>Annuler</button>
                  <button className="btn btn-navy" onClick={saveEquipeMember}>{editingMember ? 'Enregistrer' : 'Ajouter'}</button>
                </div>
              </div>
            )}

            {equipeTab === 'ca' && (
              <div className="card">
                <table>
                  <thead><tr><th style={{ width: 40 }}>#</th><th>Nom</th><th>Fonction</th><th>Actions</th></tr></thead>
                  <tbody>
                    {equipe.ca.map((m, i) => (
                      <tr key={m.id}>
                        <td style={{ color: C.textLight, fontSize: 13 }}>{i + 1}</td>
                        <td style={{ fontWeight: 500 }}>{m.name}</td>
                        <td style={{ fontSize: 13 }}>{m.fonction}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-sm btn-outline" onClick={() => moveInList('ca', i, -1)} disabled={i === 0}>Monter</button>
                            <button className="btn btn-sm btn-outline" onClick={() => moveInList('ca', i, 1)} disabled={i === equipe.ca.length - 1}>Descendre</button>
                            <button className="btn btn-sm btn-outline" onClick={() => startEditMember(m)}>Editer</button>
                            <button className="btn btn-sm btn-danger" onClick={() => deleteMember(m.id)}>Supprimer</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {equipeTab === 'cs' && (
              <div>
                {Object.entries(equipe.cs).map(([section, members]) => (
                  <div key={section} className="card" style={{ marginBottom: 12 }}>
                    <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 700, color: C.navy, marginBottom: 12 }}>{section}</h3>
                    <table>
                      <thead><tr><th style={{ width: 40 }}>#</th><th>Nom</th><th>Actions</th></tr></thead>
                      <tbody>
                        {members.map((m, i) => (
                          <tr key={m.id}>
                            <td style={{ color: C.textLight, fontSize: 13 }}>{i + 1}</td>
                            <td style={{ fontWeight: 500 }}>{m.name}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn btn-sm btn-outline" onClick={() => startEditMember(m)}>Editer</button>
                                <button className="btn btn-sm btn-danger" onClick={() => deleteMember(m.id)}>Supprimer</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}

            {equipeTab === 'copil' && (
              <div className="card">
                <table>
                  <thead><tr><th style={{ width: 40 }}>#</th><th>Nom</th><th>Fonction</th><th>Actions</th></tr></thead>
                  <tbody>
                    {equipe.copil.map((m, i) => (
                      <tr key={m.id}>
                        <td style={{ color: C.textLight, fontSize: 13 }}>{i + 1}</td>
                        <td style={{ fontWeight: 500 }}>{m.name}</td>
                        <td style={{ fontSize: 13 }}>{m.fonction}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-sm btn-outline" onClick={() => moveInList('copil', i, -1)} disabled={i === 0}>Monter</button>
                            <button className="btn btn-sm btn-outline" onClick={() => moveInList('copil', i, 1)} disabled={i === equipe.copil.length - 1}>Descendre</button>
                            <button className="btn btn-sm btn-outline" onClick={() => startEditMember(m)}>Editer</button>
                            <button className="btn btn-sm btn-danger" onClick={() => deleteMember(m.id)}>Supprimer</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══ NEWSLETTER ═══ */}
        {tab === 'newsletter' && (
          <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <SectionTitle>Newsletter (Brevo)</SectionTitle>
              <button className="btn btn-navy" onClick={() => { setNewSub({ name: '', email: '', source: 'Site web' }); setShowAddSub(true); }}>Ajouter un contact</button>
            </div>

            {!hasBrevo && <DemoWarning service="VITE_BREVO_API_KEY" />}

            <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              <StatCard label="Total" value={subCounts.total} color={C.navy} />
              <StatCard label="Valides" value={subCounts.added} color={C.green} />
              <StatCard label="En attente" value={subCounts.pending} color={C.ochre} />
              <StatCard label="Refuses" value={subCounts.rejected} color={C.terra} />
            </div>

            {showAddSub && (
              <div className="card slide-down" style={{ marginBottom: 16 }}>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 16 }}>Ajouter un contact</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <FormField label="Nom">
                    <input value={newSub.name} onChange={e => setNewSub(s => ({ ...s, name: e.target.value }))} />
                  </FormField>
                  <FormField label="Email">
                    <input type="email" value={newSub.email} onChange={e => setNewSub(s => ({ ...s, email: e.target.value }))} />
                  </FormField>
                  <FormField label="Source">
                    <select value={newSub.source} onChange={e => setNewSub(s => ({ ...s, source: e.target.value }))}>
                      <option>Site web</option>
                      <option>Evenement</option>
                      <option>LinkedIn</option>
                      <option>Manuel</option>
                    </select>
                  </FormField>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                  <button className="btn btn-outline" onClick={() => setShowAddSub(false)}>Annuler</button>
                  <button className="btn btn-navy" onClick={addSubscriber}>Ajouter</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <input placeholder="Rechercher..." value={subSearch} onChange={e => setSubSearch(e.target.value)} style={{ maxWidth: 260 }} />
              <div>
                {[{ key: 'all', label: 'Tous' }, { key: 'added', label: 'Valides' }, { key: 'pending', label: 'En attente' }, { key: 'rejected', label: 'Refuses' }].map(f => (
                  <span key={f.key} className={`pill ${subFilter === f.key ? 'active' : ''}`} onClick={() => setSubFilter(f.key)}>{f.label}</span>
                ))}
              </div>
            </div>

            <div className="card table-wrap">
              <table>
                <thead><tr><th>Nom</th><th>Email</th><th>Source</th><th>Date</th><th>Statut</th><th>Actions</th></tr></thead>
                <tbody>
                  {filteredSubs.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 500 }}>{s.name}</td>
                      <td style={{ fontSize: 13 }}>{s.email}</td>
                      <td><span className="badge badge-navy">{s.source}</span></td>
                      <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{formatDateFr(s.date)}</td>
                      <td>
                        <span className={`badge ${s.status === 'added' ? 'badge-green' : s.status === 'pending' ? 'badge-ochre' : 'badge-terra'}`}>
                          {s.status === 'added' ? 'Valide' : s.status === 'pending' ? 'En attente' : 'Refuse'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {s.status !== 'added' && <button className="btn btn-sm btn-green" onClick={() => changeSubStatus(s.id, 'added')}>Valider</button>}
                          {s.status !== 'rejected' && <button className="btn btn-sm btn-terra" onClick={() => changeSubStatus(s.id, 'rejected')}>Refuser</button>}
                          {s.status !== 'pending' && <button className="btn btn-sm btn-outline" onClick={() => changeSubStatus(s.id, 'pending')}>En attente</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredSubs.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: C.textLight, padding: 30 }}>Aucun contact trouve</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ PAGES ═══ */}
        {tab === 'pages' && (
          <div className="fade-in">
            <SectionTitle>Pages du site</SectionTitle>

            {!hasGitHub && <DemoWarning service="VITE_GITHUB_TOKEN" />}

            <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              <StatCard label="A jour" value={pageCounts.ok} color={C.green} />
              <StatCard label="A verifier" value={pageCounts.review} color={C.ochre} />
              <StatCard label="Obsoletes" value={pageCounts.obsolete} color={C.terra} />
            </div>

            <div className="card table-wrap">
              <table>
                <thead><tr><th>Page</th><th>Fichier</th><th>Derniere modification</th><th>Cycle (jours)</th><th>Statut</th><th>Actions</th></tr></thead>
                <tbody>
                  {pages.map(p => {
                    const s = pageStatus(p.daysAgo, p.refreshCycle);
                    return (
                      <tr key={p.path}>
                        <td style={{ fontWeight: 500 }}>{p.name}</td>
                        <td style={{ fontSize: 13, fontFamily: 'monospace' }}>{p.path}</td>
                        <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{formatDateFr(p.lastModified)}</td>
                        <td style={{ fontSize: 13, textAlign: 'center' }}>{p.refreshCycle}</td>
                        <td><span className={`badge ${pageStatusBadge(s)}`}>{pageStatusLabel(s)}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-sm btn-sky" onClick={() => editPage(p)}>Editer</button>
                            <a href={`https://benedictefradin-cmd.github.io/institut-rousseau/${p.path}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline" style={{ textDecoration: 'none' }}>Voir</a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
