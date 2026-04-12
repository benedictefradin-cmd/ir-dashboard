import { useState, useEffect, useCallback, useMemo } from 'react';

// ─── ENV ───────────────────────────────────────────────
const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN || '';
const BREVO_API_KEY = import.meta.env.VITE_BREVO_API_KEY || '';
const NOTION_API_KEY = import.meta.env.VITE_NOTION_API_KEY || '';
const NOTION_DATABASE_ID = import.meta.env.VITE_NOTION_DATABASE_ID || '';
const HELLOASSO_CLIENT_ID = import.meta.env.VITE_HELLOASSO_CLIENT_ID || '';
const HELLOASSO_CLIENT_SECRET = import.meta.env.VITE_HELLOASSO_CLIENT_SECRET || '';
const HELLOASSO_ORG_SLUG = import.meta.env.VITE_HELLOASSO_ORG_SLUG || 'institut-rousseau';

const hasGitHub = GITHUB_TOKEN && GITHUB_TOKEN !== 'VOTRE_TOKEN' && GITHUB_TOKEN !== 'MON_TOKEN';
const hasBrevo = BREVO_API_KEY && BREVO_API_KEY !== 'VOTRE_CLE_BREVO';
const hasNotion = NOTION_API_KEY && NOTION_API_KEY !== 'VOTRE_CLE_NOTION' && NOTION_DATABASE_ID && NOTION_DATABASE_ID !== 'VOTRE_DATABASE_ID_NOTION';
const hasHelloAsso = HELLOASSO_CLIENT_ID && HELLOASSO_CLIENT_ID !== 'VOTRE_CLIENT_ID' && HELLOASSO_CLIENT_SECRET && HELLOASSO_CLIENT_SECRET !== 'VOTRE_CLIENT_SECRET';

// ─── COLORS ────────────────────────────────────────────
const C = {
  navy: '#1B2A4A', sky: '#4A90D9', terra: '#C45A3C', ochre: '#D4A843',
  green: '#2D8659', bg: '#FAFAF7', white: '#FFFFFF', border: '#E5E7EB',
  text: '#1B2A4A', textLight: '#6B7280', danger: '#DC2626',
};

// ─── DEMO DATA ─────────────────────────────────────────
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

const DEMO_MEMBERS = [
  { id: 1, name: 'Claire Fontaine', email: 'claire.f@gmail.com', date: '2026-01-15', amount: 50, type: 'Adhésion', status: 'Payé' },
  { id: 2, name: 'Thomas Mercier', email: 't.mercier@outlook.fr', date: '2026-02-01', amount: 100, type: 'Don', status: 'Payé' },
  { id: 3, name: 'Julie Lambert', email: 'j.lambert@gmail.com', date: '2026-02-20', amount: 50, type: 'Adhésion', status: 'Payé' },
  { id: 4, name: 'François Dubois', email: 'f.dubois@free.fr', date: '2026-03-05', amount: 200, type: 'Don', status: 'Payé' },
  { id: 5, name: 'Nathalie Roux', email: 'n.roux@yahoo.fr', date: '2026-03-15', amount: 50, type: 'Adhésion', status: 'Payé' },
  { id: 6, name: 'Antoine Lefèvre', email: 'a.lefevre@gmail.com', date: '2026-04-01', amount: 50, type: 'Adhésion', status: 'Payé' },
  { id: 7, name: 'Isabelle Simon', email: 'i.simon@proton.me', date: '2026-04-05', amount: 75, type: 'Don', status: 'En attente' },
  { id: 8, name: 'Romain Blanc', email: 'r.blanc@gmail.com', date: '2026-04-10', amount: 50, type: 'Adhésion', status: 'Payé' },
];

const DEMO_ARTICLES = [
  { id: 1, title: 'Pour une politique industrielle verte européenne', author: 'Gaël Giraud', status: 'published', date: '2026-03-15', category: 'Économie', synced: true, source: 'Manuel', content: '' },
  { id: 2, title: 'Réformer la PAC : urgences et leviers d\'action', author: 'Léa Falco', status: 'published', date: '2026-03-22', category: 'Écologie', synced: true, source: 'Notion', content: '' },
  { id: 3, title: 'Souveraineté numérique et communs digitaux', author: 'Nicolas Music', status: 'ready', date: '2026-04-01', category: 'Numérique', synced: false, source: 'Notion', content: '' },
  { id: 4, title: 'L\'avenir de la protection sociale en France', author: 'Chloé Music', status: 'draft', date: '2026-04-05', category: 'Social', synced: false, source: 'Manuel', content: '' },
  { id: 5, title: 'Planification écologique : retour sur un an', author: 'Pierre Music', status: 'review', date: '2026-04-08', category: 'Écologie', synced: false, source: 'Notion', content: '' },
  { id: 6, title: 'Géopolitique de l\'énergie : nouveaux équilibres', author: 'Sophie Music', status: 'draft', date: '2026-04-10', category: 'Géopolitique', synced: false, source: 'Manuel', content: '' },
  { id: 7, title: 'Démocratiser l\'entreprise : propositions concrètes', author: 'Marc Music', status: 'review', date: '2026-04-11', category: 'Démocratie', synced: false, source: 'Notion', content: '' },
];

const PAGES_CONFIG = [
  { name: 'Accueil', path: 'index.html', refreshCycle: 60 },
  { name: 'Qui sommes-nous', path: 'qui-sommes-nous.html', refreshCycle: 180 },
  { name: 'Publications', path: 'publications.html', refreshCycle: 30 },
  { name: 'Événements', path: 'evenements.html', refreshCycle: 30 },
  { name: 'Presse', path: 'presse.html', refreshCycle: 45 },
  { name: 'L\'équipe', path: 'equipe.html', refreshCycle: 180 },
  { name: 'Adhérer', path: 'adherer.html', refreshCycle: 120 },
  { name: 'Contact', path: 'contact.html', refreshCycle: 180 },
  { name: 'Mentions légales', path: 'mentions-legales.html', refreshCycle: 365 },
  { name: 'Road to Net Zero', path: 'road-to-net-zero.html', refreshCycle: 90 },
];

const DEMO_PAGES = PAGES_CONFIG.map((p, i) => {
  const daysAgo = [5, 45, 35, 60, 50, 200, 100, 150, 400, 95][i];
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return { ...p, lastModified: d.toISOString().split('T')[0], sha: 'demo_sha_' + i, daysAgo };
});

const DEMO_ACTIVITY = [
  { date: '2026-04-11', text: 'Hugo Garcia ajouté à la newsletter' },
  { date: '2026-04-11', text: 'Article "Démocratiser l\'entreprise" passé en relecture' },
  { date: '2026-04-10', text: 'Page Événements mise à jour sur le site' },
  { date: '2026-04-09', text: 'Camille Durand inscrite via LinkedIn' },
  { date: '2026-04-08', text: 'Article "Planification écologique" soumis pour relecture' },
];

const CATEGORIES = ['Économie', 'Écologie', 'Social', 'Numérique', 'Géopolitique', 'Démocratie'];
const SOURCES = ['Site web', 'Événement', 'LinkedIn', 'Manuel'];

// ─── HELPERS ───────────────────────────────────────────
function formatDateFr(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function timeAgo(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return 'il y a 1 jour';
  if (diff < 30) return `il y a ${diff} jours`;
  if (diff < 60) return 'il y a 1 mois';
  const months = Math.floor(diff / 30);
  if (months < 12) return `il y a ${months} mois`;
  return `il y a ${Math.floor(diff / 365)} an(s)`;
}

function slugify(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function pageStatus(daysAgo, cycle) {
  if (daysAgo <= cycle) return 'ok';
  if (daysAgo <= cycle * 1.5) return 'review';
  return 'obsolete';
}

async function apiError(response) {
  if (response.status === 401) return 'Token invalide \u2014 vérifiez vos identifiants dans .env';
  if (response.status === 403) return 'Accès refusé ou limite d\'appels atteinte';
  if (response.status === 404) return 'Ressource non trouvée';
  if (response.status === 409) return 'Conflit de version \u2014 rechargez la page';
  return `Erreur ${response.status}`;
}

// ─── STYLES ────────────────────────────────────────────
const css = `
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 500px; } }
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

.pill { display: inline-block; padding: 5px 14px; border-radius: 20px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; border: 1px solid ${C.border}; background: ${C.white}; color: ${C.textLight}; margin-right: 6px; }
.pill.active { background: ${C.navy}; color: ${C.white}; border-color: ${C.navy}; }

.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; animation: fadeIn 0.2s; }
.modal { background: ${C.white}; border-radius: 10px; width: 90vw; max-width: 900px; max-height: 90vh; overflow-y: auto; padding: 30px; animation: slideUp 0.3s; }

.table-wrap { overflow-x: auto; }

@media (max-width: 768px) {
  .grid-5 { grid-template-columns: 1fr 1fr !important; }
  .grid-3 { grid-template-columns: 1fr !important; }
  .grid-2 { grid-template-columns: 1fr !important; }
  .header-tabs { gap: 4px !important; }
  .header-tabs span { font-size: 12px !important; }
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
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [loginError, setLoginError] = useState('');
  const [tab, setTab] = useState('dashboard');
  const [toasts, setToasts] = useState([]);

  // Newsletter
  const [subscribers, setSubscribers] = useState([]);
  const [subSearch, setSubSearch] = useState('');
  const [subFilter, setSubFilter] = useState('all');
  const [showAddSub, setShowAddSub] = useState(false);
  const [newSub, setNewSub] = useState({ name: '', email: '', source: 'Site web' });
  const [brevoLoaded, setBrevoLoaded] = useState(false);

  // Adhésions
  const [members, setMembers] = useState([]);
  const [helloassoLoaded, setHelloassoLoaded] = useState(false);

  // Articles
  const [articles, setArticles] = useState([]);
  const [artSearch, setArtSearch] = useState('');
  const [artFilter, setArtFilter] = useState('all');
  const [showAddArt, setShowAddArt] = useState(false);
  const [editingArt, setEditingArt] = useState(null);
  const [artForm, setArtForm] = useState({ title: '', author: '', category: 'Économie', content: '' });
  const [notionLoaded, setNotionLoaded] = useState(false);
  const [publishingId, setPublishingId] = useState(null);

  // Pages
  const [pages, setPages] = useState([]);
  const [pagesLoaded, setPagesLoaded] = useState(false);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [editingPage, setEditingPage] = useState(null);
  const [pageContent, setPageContent] = useState('');
  const [pageSaving, setPageSaving] = useState(false);

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // ─── LOGIN ─────────────────────────────────────────
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginId === 'admin' && loginPw === 'IR2026!') {
      setLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('Identifiants incorrects');
    }
  };

  // ─── LOAD DATA ─────────────────────────────────────
  useEffect(() => {
    if (!loggedIn) return;
    loadSubscribers();
    loadMembers();
    loadArticles();
    loadPages();
  }, [loggedIn]);

  const loadSubscribers = async () => {
    if (hasBrevo) {
      try {
        const res = await fetch('https://api.brevo.com/v3/contacts?limit=50&offset=0', {
          headers: { 'api-key': BREVO_API_KEY, 'Accept': 'application/json' },
        });
        if (!res.ok) { toast(await apiError(res), 'error'); throw new Error(); }
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
        setBrevoLoaded(true);
        return;
      } catch { /* fall through to demo */ }
    }
    setSubscribers([...DEMO_SUBSCRIBERS]);
  };

  const loadMembers = async () => {
    if (hasHelloAsso) {
      try {
        const tokenRes = await fetch('https://api.helloasso.com/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `grant_type=client_credentials&client_id=${HELLOASSO_CLIENT_ID}&client_secret=${HELLOASSO_CLIENT_SECRET}`,
        });
        if (!tokenRes.ok) { toast(await apiError(tokenRes), 'error'); throw new Error(); }
        const tokenData = await tokenRes.json();
        const payRes = await fetch(`https://api.helloasso.com/v5/organizations/${HELLOASSO_ORG_SLUG}/payments?pageSize=20`, {
          headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
        });
        if (!payRes.ok) { toast(await apiError(payRes), 'error'); throw new Error(); }
        const payData = await payRes.json();
        const items = (payData.data || []).map((p, i) => ({
          id: p.id || i + 1,
          name: `${p.payer?.firstName || ''} ${p.payer?.lastName || ''}`.trim() || 'Anonyme',
          email: p.payer?.email || '',
          date: p.date?.split('T')[0] || '',
          amount: (p.amount || 0) / 100,
          type: p.paymentType === 'Donation' ? 'Don' : 'Adhésion',
          status: p.state === 'Authorized' ? 'Payé' : 'En attente',
        }));
        setMembers(items);
        setHelloassoLoaded(true);
        return;
      } catch { /* fall through */ }
    }
    setMembers([...DEMO_MEMBERS]);
  };

  const loadArticles = async () => {
    setArticles([...DEMO_ARTICLES]);
  };

  const refreshFromNotion = async () => {
    if (!hasNotion) return;
    try {
      const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) { toast(await apiError(res), 'error'); throw new Error(); }
      const data = await res.json();
      const notionArticles = (data.results || []).map((r, i) => {
        const props = r.properties || {};
        return {
          id: 100 + i,
          title: props.Titre?.title?.[0]?.plain_text || props.Name?.title?.[0]?.plain_text || 'Sans titre',
          author: props.Auteur?.rich_text?.[0]?.plain_text || '',
          status: 'draft',
          date: props.Date?.date?.start || r.created_time?.split('T')[0] || '',
          category: props.Catégorie?.select?.name || 'Économie',
          synced: false,
          source: 'Notion',
          content: props.Contenu?.rich_text?.[0]?.plain_text || '',
        };
      });
      setArticles(prev => [...prev.filter(a => a.source !== 'Notion'), ...notionArticles]);
      setNotionLoaded(true);
      toast('Articles Notion synchronisés');
    } catch {
      toast('L\'API Notion nécessite un proxy backend \u2014 utilisez les données de démo pour l\'instant', 'warning');
    }
  };

  const loadPages = async () => {
    if (hasGitHub) {
      setPagesLoading(true);
      try {
        const res = await fetch('https://api.github.com/repos/benedictefradin-cmd/institut-rousseau/contents/', {
          headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}` },
        });
        if (!res.ok) { toast(await apiError(res), 'error'); throw new Error(); }
        const data = await res.json();
        const htmlFiles = data.filter(f => f.name.endsWith('.html'));
        const mapped = htmlFiles.map(f => {
          const cfg = PAGES_CONFIG.find(p => p.path === f.name) || { name: f.name, refreshCycle: 90 };
          const lastMod = f.last_modified || new Date().toISOString();
          const daysAgo = Math.floor((new Date() - new Date(lastMod)) / (1000 * 60 * 60 * 24));
          return { ...cfg, path: f.name, lastModified: lastMod.split('T')[0], sha: f.sha, daysAgo: daysAgo || 0 };
        });
        setPages(mapped.length > 0 ? mapped : DEMO_PAGES);
        setPagesLoaded(true);
      } catch {
        setPages([...DEMO_PAGES]);
      } finally { setPagesLoading(false); }
    } else {
      setPages([...DEMO_PAGES]);
    }
  };

  // ─── SUBSCRIBER ACTIONS ────────────────────────────
  const changeSubStatus = async (id, newStatus) => {
    if (hasBrevo && brevoLoaded) {
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
    const labels = { added: 'ajouté', rejected: 'refusé', pending: 'remis en attente' };
    toast(`Contact ${labels[newStatus]}`);
  };

  const addSubscriber = async () => {
    if (!newSub.name || !newSub.email) return toast('Remplissez tous les champs', 'error');
    if (hasBrevo && brevoLoaded) {
      try {
        const res = await fetch('https://api.brevo.com/v3/contacts', {
          method: 'POST',
          headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: newSub.email, attributes: { NOM: newSub.name, SOURCE: newSub.source } }),
        });
        if (!res.ok) { toast(await apiError(res), 'error'); return; }
      } catch { toast('Erreur de connexion \u2014 vérifiez votre connexion internet', 'error'); return; }
    }
    const entry = { id: Date.now(), name: newSub.name, email: newSub.email, date: new Date().toISOString().split('T')[0], status: 'pending', source: newSub.source };
    setSubscribers(prev => [entry, ...prev]);
    setNewSub({ name: '', email: '', source: 'Site web' });
    setShowAddSub(false);
    toast('Contact ajouté');
  };

  // ─── ARTICLE ACTIONS ──────────────────────────────
  const updateArticleStatus = (id, newStatus) => {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    const labels = { draft: 'brouillon', review: 'relecture', ready: 'prêt', published: 'publié' };
    toast(`Article passé en ${labels[newStatus]}`);
  };

  const publishArticle = async (id) => {
    setPublishingId(id);
    const art = articles.find(a => a.id === id);
    if (!art) { setPublishingId(null); return; }
    const slug = slugify(art.title);
    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>${art.title} \u2014 Institut Rousseau</title></head>
<body>
<article>
<h1>${art.title}</h1>
<p class="meta">${art.author} \u00b7 ${art.category} \u00b7 ${formatDateFr(art.date)}</p>
<div class="content">${art.content || ''}</div>
</article>
</body>
</html>`;

    if (hasGitHub) {
      try {
        let sha;
        try {
          const check = await fetch(`https://api.github.com/repos/benedictefradin-cmd/institut-rousseau/contents/articles/${slug}.html`, {
            headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}` },
          });
          if (check.ok) { const d = await check.json(); sha = d.sha; }
        } catch { /* new file */ }
        const body = { message: `Publish: ${art.title}`, content: btoa(unescape(encodeURIComponent(html))), branch: 'main' };
        if (sha) body.sha = sha;
        const res = await fetch(`https://api.github.com/repos/benedictefradin-cmd/institut-rousseau/contents/articles/${slug}.html`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) { toast(await apiError(res), 'error'); setPublishingId(null); return; }
        setArticles(prev => prev.map(a => a.id === id ? { ...a, status: 'published', synced: true } : a));
        toast('Article publié sur GitHub');
      } catch { toast('Erreur de connexion \u2014 vérifiez votre connexion internet', 'error'); }
    } else {
      await new Promise(r => setTimeout(r, 2000));
      setArticles(prev => prev.map(a => a.id === id ? { ...a, status: 'published', synced: true } : a));
      toast('Article publié (simulation)');
    }
    setPublishingId(null);
  };

  const saveArticle = () => {
    if (!artForm.title) return toast('Le titre est requis', 'error');
    if (editingArt) {
      setArticles(prev => prev.map(a => a.id === editingArt.id ? { ...a, ...artForm } : a));
      toast('Article mis à jour');
    } else {
      const newArt = { id: Date.now(), ...artForm, status: 'draft', date: new Date().toISOString().split('T')[0], synced: false, source: 'Manuel' };
      setArticles(prev => [newArt, ...prev]);
      toast('Article créé');
    }
    setShowAddArt(false);
    setEditingArt(null);
    setArtForm({ title: '', author: '', category: 'Économie', content: '' });
  };

  const startEditArt = (art) => {
    setEditingArt(art);
    setArtForm({ title: art.title, author: art.author, category: art.category, content: art.content || '' });
    setShowAddArt(true);
  };

  // ─── PAGE ACTIONS ─────────────────────────────────
  const editPage = async (page) => {
    if (hasGitHub) {
      try {
        const res = await fetch(`https://api.github.com/repos/benedictefradin-cmd/institut-rousseau/contents/${page.path}`, {
          headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}` },
        });
        if (!res.ok) { toast(await apiError(res), 'error'); return; }
        const data = await res.json();
        setPageContent(decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))));
        setEditingPage({ ...page, sha: data.sha });
      } catch { toast('Erreur de connexion \u2014 vérifiez votre connexion internet', 'error'); }
    } else {
      setPageContent(`<!DOCTYPE html>\n<html lang="fr">\n<head><title>${page.name} \u2014 Institut Rousseau</title></head>\n<body>\n<h1>${page.name}</h1>\n<p>Contenu de démo</p>\n</body>\n</html>`);
      setEditingPage(page);
    }
  };

  const savePage = async () => {
    if (!editingPage) return;
    setPageSaving(true);
    if (hasGitHub) {
      try {
        const res = await fetch(`https://api.github.com/repos/benedictefradin-cmd/institut-rousseau/contents/${editingPage.path}`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Update ${editingPage.name}`,
            content: btoa(unescape(encodeURIComponent(pageContent))),
            sha: editingPage.sha,
            branch: 'main',
          }),
        });
        if (!res.ok) { toast(await apiError(res), 'error'); setPageSaving(false); return; }
        toast('Page publiée');
        setEditingPage(null);
        loadPages();
      } catch { toast('Erreur de connexion \u2014 vérifiez votre connexion internet', 'error'); }
    } else {
      await new Promise(r => setTimeout(r, 1500));
      toast('Page sauvegardée (simulation)');
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

  const memberCounts = useMemo(() => {
    const total = members.length;
    const now = new Date();
    const thisMonth = members.filter(m => { const d = new Date(m.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;
    const totalAmount = members.reduce((s, m) => s + m.amount, 0);
    return { total, thisMonth, totalAmount };
  }, [members]);

  const artCounts = useMemo(() => ({
    total: articles.length,
    draft: articles.filter(a => a.status === 'draft').length,
    review: articles.filter(a => a.status === 'review').length,
    ready: articles.filter(a => a.status === 'ready').length,
    published: articles.filter(a => a.status === 'published').length,
  }), [articles]);

  const pageCounts = useMemo(() => {
    const ok = pages.filter(p => pageStatus(p.daysAgo, p.refreshCycle) === 'ok').length;
    const review = pages.filter(p => pageStatus(p.daysAgo, p.refreshCycle) === 'review').length;
    const obsolete = pages.filter(p => pageStatus(p.daysAgo, p.refreshCycle) === 'obsolete').length;
    return { ok, review, obsolete, total: pages.length };
  }, [pages]);

  const tabBadges = useMemo(() => ({
    dashboard: 0,
    newsletter: subCounts.pending,
    adhesions: members.filter(m => m.status === 'En attente').length,
    articles: artCounts.review,
    pages: pageCounts.review + pageCounts.obsolete,
  }), [subCounts, members, artCounts, pageCounts]);

  const filteredSubs = useMemo(() => {
    let list = subscribers;
    if (subFilter !== 'all') list = list.filter(s => s.status === subFilter);
    if (subSearch) {
      const q = subSearch.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
    }
    return list;
  }, [subscribers, subFilter, subSearch]);

  const filteredArts = useMemo(() => {
    let list = articles;
    if (artFilter !== 'all') list = list.filter(a => a.status === artFilter);
    if (artSearch) {
      const q = artSearch.toLowerCase();
      list = list.filter(a => a.title.toLowerCase().includes(q) || a.author.toLowerCase().includes(q));
    }
    return list;
  }, [articles, artFilter, artSearch]);

  const validationRate = useMemo(() => {
    if (subCounts.total === 0) return 0;
    return Math.round((subCounts.added / subCounts.total) * 100);
  }, [subCounts]);

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

  // ─── HEADER ────────────────────────────────────────
  const tabs = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'newsletter', label: 'Newsletter' },
    { key: 'adhesions', label: 'Adhésions' },
    { key: 'articles', label: 'Articles' },
    { key: 'pages', label: 'Pages' },
  ];

  const StatusDot = ({ active, label }) => (
    <span style={{ fontSize: 12, color: C.white, opacity: active ? 1 : 0.5, marginLeft: 14 }}>
      <span style={{ color: active ? '#4ADE80' : '#9CA3AF' }}>{'\u25CF'}</span> {label}
    </span>
  );

  // ─── RENDER ────────────────────────────────────────
  return (
    <>
      <style>{css}</style>
      <ToastContainer toasts={toasts} onRemove={id => setToasts(prev => prev.filter(t => t.id !== id))} />

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

        <nav className="header-tabs" style={{ display: 'flex', gap: 6, flex: 1, justifyContent: 'center' }}>
          {tabs.map(t => (
            <span key={t.key} onClick={() => setTab(t.key)} style={{
              color: tab === t.key ? C.white : 'rgba(255,255,255,0.6)',
              fontWeight: tab === t.key ? 600 : 400,
              fontSize: 14, cursor: 'pointer', padding: '6px 14px',
              borderRadius: 6, background: tab === t.key ? 'rgba(255,255,255,0.12)' : 'transparent',
              transition: 'all 0.15s', position: 'relative',
            }}>
              {t.label}
              {tabBadges[t.key] > 0 && (
                <span style={{
                  position: 'absolute', top: -2, right: -4,
                  background: t.key === 'newsletter' ? C.sky : t.key === 'articles' ? C.ochre : C.terra,
                  color: C.white, fontSize: 10, fontWeight: 700, borderRadius: 10,
                  minWidth: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
                }}>{tabBadges[t.key]}</span>
              )}
            </span>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <StatusDot active={hasGitHub} label="GitHub" />
          <StatusDot active={hasBrevo} label="Brevo" />
          <StatusDot active={hasNotion} label="Notion" />
          <button className="btn btn-outline" style={{ marginLeft: 16, color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)', fontSize: 12 }} onClick={() => setLoggedIn(false)}>
            Déconnexion
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>

        {/* ═══ DASHBOARD ═══ */}
        {tab === 'dashboard' && (
          <div className="fade-in">
            {/* Stats */}
            <div className="grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Abonnés newsletter', value: subCounts.total, sub: `${subCounts.pending} en attente`, accent: C.sky },
                { label: 'Adhésions', value: memberCounts.total, sub: `${memberCounts.thisMonth} ce mois`, accent: C.green },
                { label: 'Articles', value: artCounts.total, sub: `${artCounts.review} à relire`, accent: C.ochre },
                { label: 'Pages du site', value: pageCounts.total, sub: `${pageCounts.review + pageCounts.obsolete} à mettre à jour`, accent: C.terra },
                { label: 'Taux de validation', value: `${validationRate}%`, sub: 'abonnés validés', accent: C.navy },
              ].map((s, i) => (
                <div key={i} className="card slide-up" style={{ borderTop: `3px solid ${s.accent}`, animationDelay: `${i * 0.05}s` }}>
                  <p style={{ color: C.textLight, fontSize: 13, marginBottom: 8 }}>{s.label}</p>
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 700, color: s.accent }}>{s.value}</p>
                  <p style={{ color: C.textLight, fontSize: 12, marginTop: 4 }}>{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Actions en attente */}
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div className="card slide-up">
                <h3 style={{ fontSize: 15, fontWeight: 600, color: C.navy, marginBottom: 14 }}>Dernières inscriptions newsletter</h3>
                {subscribers.filter(s => s.status === 'pending').slice(0, 4).map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                    <div>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{s.name}</span>
                      <span style={{ color: C.textLight, fontSize: 12, marginLeft: 8 }}>{s.email}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-green btn-sm" onClick={() => changeSubStatus(s.id, 'added')}>Ajouter</button>
                      <button className="btn btn-outline btn-sm" onClick={() => changeSubStatus(s.id, 'rejected')}>Refuser</button>
                    </div>
                  </div>
                ))}
                {subscribers.filter(s => s.status === 'pending').length === 0 && <p style={{ color: C.textLight, fontSize: 13 }}>Aucune inscription en attente</p>}
              </div>

              <div className="card slide-up">
                <h3 style={{ fontSize: 15, fontWeight: 600, color: C.navy, marginBottom: 14 }}>Articles à relire</h3>
                {articles.filter(a => a.status === 'review').map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                    <div>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{a.title}</span>
                      <span style={{ color: C.textLight, fontSize: 12, marginLeft: 8 }}>{a.author}</span>
                    </div>
                    <button className="btn btn-ochre btn-sm" onClick={() => { setTab('articles'); startEditArt(a); }}>Relire</button>
                  </div>
                ))}
                {articles.filter(a => a.status === 'review').length === 0 && <p style={{ color: C.textLight, fontSize: 13 }}>Aucun article à relire</p>}
              </div>
            </div>

            {/* Activité récente */}
            <div className="card slide-up" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: C.navy, marginBottom: 14 }}>Activité récente</h3>
              {DEMO_ACTIVITY.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: i < DEMO_ACTIVITY.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ color: C.textLight, fontSize: 12, minWidth: 90 }}>{formatDateFr(a.date)}</span>
                  <span style={{ fontSize: 14 }}>{a.text}</span>
                </div>
              ))}
            </div>

            {/* Workflow */}
            <div className="card slide-up">
              <h3 style={{ fontSize: 15, fontWeight: 600, color: C.navy, marginBottom: 20 }}>Workflow de publication</h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
                {['Rédaction (Notion)', 'Relecture (Back-office)', 'Validation', 'Push GitHub', 'En ligne'].map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', background: C.navy, color: C.white,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, margin: '0 auto 6px',
                      }}>{i + 1}</div>
                      <p style={{ fontSize: 11, color: C.textLight, maxWidth: 100 }}>{step}</p>
                    </div>
                    {i < 4 && <div style={{ width: 50, height: 2, background: C.border, margin: '0 8px', marginBottom: 20 }} />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ NEWSLETTER ═══ */}
        {tab === 'newsletter' && (
          <div className="fade-in">
            {/* Bandeau */}
            <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 20, fontSize: 13, fontWeight: 500,
              background: hasBrevo && brevoLoaded ? '#ECFDF5' : '#FFF9E6',
              color: hasBrevo && brevoLoaded ? C.green : '#9A7B1A',
            }}>
              {hasBrevo && brevoLoaded
                ? 'Connecté à Brevo \u2014 les données sont synchronisées en temps réel'
                : 'Mode démonstration \u2014 ajoutez VITE_BREVO_API_KEY dans .env pour synchroniser avec Brevo'}
            </div>

            {/* Search + filters + add */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <input placeholder="Rechercher un contact..." value={subSearch} onChange={e => setSubSearch(e.target.value)} style={{ maxWidth: 280 }} />
              <div>
                {[['all', 'Tous'], ['pending', 'En attente'], ['added', 'Ajoutés'], ['rejected', 'Refusés']].map(([k, l]) => (
                  <span key={k} className={`pill ${subFilter === k ? 'active' : ''}`} onClick={() => setSubFilter(k)}>{l}</span>
                ))}
              </div>
              <div style={{ flex: 1 }} />
              <button className="btn btn-sky" onClick={() => setShowAddSub(!showAddSub)}>Ajouter un contact</button>
            </div>

            {/* Add form */}
            {showAddSub && (
              <div className="card slide-down" style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.textLight, display: 'block', marginBottom: 4 }}>Nom</label>
                  <input value={newSub.name} onChange={e => setNewSub({ ...newSub, name: e.target.value })} />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.textLight, display: 'block', marginBottom: 4 }}>Email</label>
                  <input value={newSub.email} onChange={e => setNewSub({ ...newSub, email: e.target.value })} />
                </div>
                <div style={{ minWidth: 140 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.textLight, display: 'block', marginBottom: 4 }}>Source</label>
                  <select value={newSub.source} onChange={e => setNewSub({ ...newSub, source: e.target.value })}>
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <button className="btn btn-outline" onClick={() => setShowAddSub(false)}>Annuler</button>
                <button className="btn btn-sky" onClick={addSubscriber}>Ajouter</button>
              </div>
            )}

            {/* Table */}
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nom</th><th>Email</th><th>Source</th><th>Date d'inscription</th><th>Statut</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubs.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 500 }}>{s.name}</td>
                        <td style={{ color: C.textLight }}>{s.email}</td>
                        <td><span className="badge badge-gray">{s.source}</span></td>
                        <td>{formatDateFr(s.date)}</td>
                        <td>
                          <span className={`badge ${s.status === 'added' ? 'badge-green' : s.status === 'pending' ? 'badge-ochre' : 'badge-danger'}`}>
                            {s.status === 'added' ? 'Ajouté' : s.status === 'pending' ? 'En attente' : 'Refusé'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {s.status === 'pending' && <>
                              <button className="btn btn-green btn-sm" onClick={() => changeSubStatus(s.id, 'added')}>Ajouter</button>
                              <button className="btn btn-outline btn-sm" onClick={() => changeSubStatus(s.id, 'rejected')}>Refuser</button>
                            </>}
                            {s.status === 'added' && <button className="btn btn-outline btn-sm" onClick={() => changeSubStatus(s.id, 'rejected')}>Retirer</button>}
                            {s.status === 'rejected' && <button className="btn btn-green btn-sm" onClick={() => changeSubStatus(s.id, 'added')}>Réintégrer</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', gap: 20, padding: '14px 12px 0', borderTop: `1px solid ${C.border}`, marginTop: 8, fontSize: 13, color: C.textLight }}>
                <span>Ajoutés : <strong style={{ color: C.green }}>{subCounts.added}</strong></span>
                <span>En attente : <strong style={{ color: C.ochre }}>{subCounts.pending}</strong></span>
                <span>Refusés : <strong style={{ color: C.danger }}>{subCounts.rejected}</strong></span>
                <span>Total : <strong style={{ color: C.navy }}>{subCounts.total}</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* ═══ ADHÉSIONS ═══ */}
        {tab === 'adhesions' && (
          <div className="fade-in">
            <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 20, fontSize: 13, fontWeight: 500,
              background: hasHelloAsso && helloassoLoaded ? '#ECFDF5' : '#FFF9E6',
              color: hasHelloAsso && helloassoLoaded ? C.green : '#9A7B1A',
            }}>
              {hasHelloAsso && helloassoLoaded
                ? 'Connecté à HelloAsso \u2014 adhésions synchronisées'
                : 'Mode démonstration \u2014 configurez HelloAsso dans .env pour voir les vraies adhésions'}
            </div>

            {/* Stats */}
            <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
              {[
                { label: 'Adhésions totales', value: memberCounts.total, accent: C.green },
                { label: 'Montant total', value: `${memberCounts.totalAmount}\u00a0\u20ac`, accent: C.navy },
                { label: 'Ce mois-ci', value: memberCounts.thisMonth, accent: C.sky },
              ].map((s, i) => (
                <div key={i} className="card slide-up" style={{ textAlign: 'center', borderTop: `3px solid ${s.accent}` }}>
                  <p style={{ color: C.textLight, fontSize: 13, marginBottom: 6 }}>{s.label}</p>
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 700, color: s.accent }}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Nom</th><th>Email</th><th>Date</th><th>Montant</th><th>Type</th><th>Statut</th></tr></thead>
                  <tbody>
                    {members.map(m => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 500 }}>{m.name}</td>
                        <td style={{ color: C.textLight }}>{m.email}</td>
                        <td>{formatDateFr(m.date)}</td>
                        <td style={{ fontWeight: 600 }}>{m.amount}\u00a0\u20ac</td>
                        <td><span className={`badge ${m.type === 'Don' ? 'badge-sky' : 'badge-navy'}`}>{m.type}</span></td>
                        <td><span className={`badge ${m.status === 'Payé' ? 'badge-green' : m.status === 'En attente' ? 'badge-ochre' : 'badge-danger'}`}>{m.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '14px 12px 0', borderTop: `1px solid ${C.border}`, marginTop: 8 }}>
                <a href={`https://admin.helloasso.com/associations/${HELLOASSO_ORG_SLUG}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ fontSize: 13, textDecoration: 'none' }}>
                  Ouvrir HelloAsso
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ═══ ARTICLES ═══ */}
        {tab === 'articles' && (
          <div className="fade-in">
            <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 20, fontSize: 13, fontWeight: 500,
              background: hasNotion && notionLoaded ? '#ECFDF5' : '#FFF9E6',
              color: hasNotion && notionLoaded ? C.green : '#9A7B1A',
            }}>
              {hasNotion && notionLoaded
                ? 'Connecté à Notion \u2014 les articles de la base sont synchronisés'
                : 'Mode démonstration \u2014 configurez Notion dans .env pour synchroniser les articles'}
            </div>

            {/* Search + filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <input placeholder="Rechercher un article..." value={artSearch} onChange={e => setArtSearch(e.target.value)} style={{ maxWidth: 280 }} />
              <div>
                {[['all', 'Tous'], ['draft', 'Brouillons'], ['review', 'À relire'], ['ready', 'Prêts'], ['published', 'Publiés']].map(([k, l]) => (
                  <span key={k} className={`pill ${artFilter === k ? 'active' : ''}`} onClick={() => setArtFilter(k)}>{l}</span>
                ))}
              </div>
              <div style={{ flex: 1 }} />
              {hasNotion && <button className="btn btn-outline" onClick={refreshFromNotion}>Rafraîchir depuis Notion</button>}
              <button className="btn btn-sky" onClick={() => { setEditingArt(null); setArtForm({ title: '', author: '', category: 'Économie', content: '' }); setShowAddArt(!showAddArt); }}>Nouvel article</button>
            </div>

            {/* Form */}
            {showAddArt && (
              <div className="card slide-down" style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: C.navy }}>{editingArt ? 'Modifier l\'article' : 'Nouvel article'}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.textLight, display: 'block', marginBottom: 4 }}>Titre</label>
                    <input value={artForm.title} onChange={e => setArtForm({ ...artForm, title: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.textLight, display: 'block', marginBottom: 4 }}>Auteur</label>
                    <input value={artForm.author} onChange={e => setArtForm({ ...artForm, author: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.textLight, display: 'block', marginBottom: 4 }}>Catégorie</label>
                    <select value={artForm.category} onChange={e => setArtForm({ ...artForm, category: e.target.value })}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.textLight, display: 'block', marginBottom: 4 }}>Contenu</label>
                  <textarea rows={5} value={artForm.content} onChange={e => setArtForm({ ...artForm, content: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-outline" onClick={() => { setShowAddArt(false); setEditingArt(null); }}>Annuler</button>
                  <button className="btn btn-sky" onClick={saveArticle}>{editingArt ? 'Sauvegarder' : 'Créer'}</button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Titre</th><th>Auteur</th><th>Catégorie</th><th>Date</th><th>Statut</th><th>Source</th><th>GitHub</th><th>Actions</th></tr></thead>
                  <tbody>
                    {filteredArts.map(a => {
                      const statusLabel = { draft: 'Brouillon', review: 'À relire', ready: 'Prêt', published: 'Publié' }[a.status];
                      const statusClass = { draft: 'badge-gray', review: 'badge-ochre', ready: 'badge-sky', published: 'badge-green' }[a.status];
                      return (
                        <tr key={a.id}>
                          <td style={{ fontWeight: 500, maxWidth: 260 }}>{a.title}</td>
                          <td>{a.author}</td>
                          <td><span className="badge badge-sky">{a.category}</span></td>
                          <td>{formatDateFr(a.date)}</td>
                          <td><span className={`badge ${statusClass}`}>{statusLabel}</span></td>
                          <td style={{ color: C.textLight, fontSize: 12 }}>{a.source}</td>
                          <td style={{ fontSize: 12, color: a.synced ? C.green : C.textLight }}>{a.synced ? 'Synchronisé' : 'Non sync.'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              <button className="btn btn-outline btn-sm" onClick={() => startEditArt(a)}>Éditer</button>
                              {a.status === 'draft' && <button className="btn btn-ochre btn-sm" onClick={() => updateArticleStatus(a.id, 'review')}>Passer en relecture</button>}
                              {a.status === 'review' && <button className="btn btn-sky btn-sm" onClick={() => updateArticleStatus(a.id, 'ready')}>Valider</button>}
                              {a.status === 'ready' && (
                                <button className="btn btn-green btn-sm" onClick={() => publishArticle(a.id)} disabled={publishingId === a.id}>
                                  {publishingId === a.id ? 'Publication...' : 'Publier'}
                                </button>
                              )}
                              {a.status === 'published' && <button className="btn btn-outline btn-sm" onClick={() => updateArticleStatus(a.id, 'draft')}>Dépublier</button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══ PAGES ═══ */}
        {tab === 'pages' && (
          <div className="fade-in">
            <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 20, fontSize: 13, fontWeight: 500,
              background: hasGitHub && pagesLoaded ? '#ECFDF5' : '#FFF9E6',
              color: hasGitHub && pagesLoaded ? C.green : '#9A7B1A',
            }}>
              {hasGitHub && pagesLoaded
                ? 'Connecté au repo institut-rousseau \u2014 les modifications sont publiées en direct'
                : 'Mode démonstration \u2014 ajoutez VITE_GITHUB_TOKEN dans .env pour éditer le site'}
            </div>

            {pagesLoading && <p style={{ color: C.textLight, fontSize: 14, marginBottom: 16 }}>Chargement des fichiers...</p>}

            {/* Stats */}
            <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
              {[
                { label: 'Pages à jour', value: pageCounts.ok, accent: C.green },
                { label: 'Pages à revoir', value: pageCounts.review, accent: C.ochre },
                { label: 'Pages obsolètes', value: pageCounts.obsolete, accent: C.danger },
              ].map((s, i) => (
                <div key={i} className="card slide-up" style={{ textAlign: 'center', borderTop: `3px solid ${s.accent}` }}>
                  <p style={{ color: C.textLight, fontSize: 13, marginBottom: 6 }}>{s.label}</p>
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 700, color: s.accent }}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Page</th><th>Chemin</th><th>Dernière modification</th><th>Ancienneté</th><th>Cycle</th><th>Statut</th><th>Actions</th></tr></thead>
                  <tbody>
                    {pages.map(p => {
                      const st = pageStatus(p.daysAgo, p.refreshCycle);
                      const stLabel = { ok: 'À jour', review: 'À revoir', obsolete: 'Obsolète' }[st];
                      const stClass = { ok: 'badge-green', review: 'badge-ochre', obsolete: 'badge-danger' }[st];
                      return (
                        <tr key={p.path}>
                          <td style={{ fontWeight: 500 }}>{p.name}</td>
                          <td><code style={{ fontSize: 12, color: C.sky, background: '#F0F7FF', padding: '2px 6px', borderRadius: 4 }}>/{p.path.replace('.html', '')}</code></td>
                          <td>{formatDateFr(p.lastModified)}</td>
                          <td style={{ color: C.textLight, fontSize: 13 }}>{timeAgo(p.lastModified)}</td>
                          <td style={{ fontSize: 12, color: C.textLight }}>{p.refreshCycle}j</td>
                          <td><span className={`badge ${stClass}`}>{stLabel}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-outline btn-sm" onClick={() => editPage(p)}>Éditer</button>
                              <a href={`https://benedictefradin-cmd.github.io/institut-rousseau/${p.path}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>Voir</a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Legend */}
            <p style={{ marginTop: 16, fontSize: 12, color: C.textLight, lineHeight: 1.6 }}>
              Les seuils sont adaptés à chaque page. Exemple : L'équipe est considérée à jour pendant 6 mois, les Événements pendant 30 jours, les Mentions légales pendant 1 an.
            </p>
          </div>
        )}
      </main>

      {/* ═══ PAGE EDIT MODAL ═══ */}
      {editingPage && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditingPage(null); }}>
          <div className="modal" style={{ maxWidth: 1000, width: '95vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: C.navy }}>{editingPage.name}</h2>
              <span style={{ fontSize: 12, color: C.textLight }}>{editingPage.path}</span>
            </div>
            <textarea
              value={pageContent}
              onChange={e => setPageContent(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 13, minHeight: 500, width: '100%', lineHeight: 1.6, padding: 16, borderRadius: 8, border: `1px solid ${C.border}` }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              {pageSaving && <span style={{ fontSize: 13, color: C.textLight, alignSelf: 'center' }}>Publication en cours...</span>}
              <button className="btn btn-outline" onClick={() => setEditingPage(null)} disabled={pageSaving}>Annuler</button>
              <button className="btn btn-navy" onClick={savePage} disabled={pageSaving}>Sauvegarder et publier</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
