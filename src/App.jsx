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
import Accueil from './pages/Accueil';
import SEO from './pages/SEO';
import Medias from './pages/Medias';
import Navigation from './pages/Navigation';
import Sollicitations from './pages/Sollicitations';
import { checkHealth } from './services/api';
import { fetchContacts, fetchCampaigns } from './services/brevo';
import { fetchSollicitations } from './services/contact';
import { fetchAllSiteData, normalizePublications, normalizeEvents, normalizePresse, normalizeAuteurs, saveSiteData } from './services/siteData';
import { hasGitHub } from './services/github';
import { loadLocal, saveLocal } from './utils/localStorage';
import { LS_KEYS, COLORS } from './utils/constants';
import useNotionSync from './hooks/useNotionSync';
import logoSvg from './assets/logo.svg';


// ─── Pas de données démo : tout est chargé depuis le site via GitHub ───

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
  const [services, setServices] = useState({ brevo: false, telegram: false, github: hasGitHub() });
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

    // Charger les données réelles depuis le site via GitHub
    if (hasGitHub()) {
      try {
        const siteData = await fetchAllSiteData();
        if (siteData.publications.length) setArticles(normalizePublications(siteData.publications));
        if (siteData.events.length) setEvents(normalizeEvents(siteData.events));
        if (siteData.presse.length) setPresse(normalizePresse(siteData.presse));
        if (siteData.auteurs.length) setAuteurs(normalizeAuteurs(siteData.auteurs));
        if (siteData.contenu && Object.keys(siteData.contenu).length) setContenu(siteData.contenu);
      } catch (err) {
        console.warn('[App] Erreur chargement données site :', err.message);
      }
    }

    // Charger les sollicitations depuis le Worker (KV)
    try {
      const solData = await fetchSollicitations({ limit: 200 });
      if (solData?.items?.length) setSollicitations(solData.items);
    } catch (err) {
      console.warn('[App] Erreur chargement sollicitations :', err.message);
    }

    // Charger les contacts Brevo et vérifier les services
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
          } catch { /* brevo non disponible */ }
        }
      }
    } catch { /* worker non disponible */ }
    setLoading(false);
  };

  // Sauvegarder les modifications vers le site (commit GitHub → Vercel redeploy)
  const saveToSite = useCallback(async (dataType, data, message) => {
    try {
      await saveSiteData(dataType, data, message);
      toast('Modifications publiées sur le site');
    } catch (err) {
      toast(`Erreur publication : ${err.message}`, 'error');
    }
  }, [toast]);

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
    accueil: 0,
    seo: 0,
    medias: 0,
    navigation: 0,
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
          campaigns={campaigns} activity={activity} loading={loading}
          onTabChange={changeTab} toast={toast}
          notionArticles={notionArticles} notionCounts={notionCounts}
        />;
      case 'articles':
        return <Articles
          articles={articles} setArticles={setArticles} loading={loading} toast={toast}
          notionArticles={notionArticles} notionCounts={notionCounts}
          notionLoading={notionLoading} syncNotion={syncNotion}
          notionConfigured={notionConfigured} auteurs={auteurs}
          saveToSite={saveToSite}
        />;
      case 'evenements':
        return <Evenements events={events} setEvents={setEvents} loading={loading} toast={toast} saveToSite={saveToSite} />;
      case 'presse':
        return <Presse presse={presse} setPresse={setPresse} sollicitations={sollicitations} loading={loading} toast={toast} saveToSite={saveToSite} />;
      case 'auteurs':
        return <Auteurs auteurs={auteurs} setAuteurs={setAuteurs} articles={articles} loading={loading} toast={toast} saveToSite={saveToSite} />;
      case 'newsletter':
        return <Newsletter subscribers={subscribers} setSubscribers={setSubscribers} campaigns={campaigns} loading={loading} connected={services.brevo} onRefresh={loadData} toast={toast} />;
      case 'messagerie':
        return <Messagerie subscribers={subscribers} presse={presse} auteurs={auteurs} events={events} services={services} toast={toast} />;
      case 'contenu':
        return <Contenu contenu={contenu} setContenu={setContenu} toast={toast} saveToSite={saveToSite} />;
      case 'accueil':
        return <Accueil contenu={contenu} setContenu={setContenu} toast={toast} saveToSite={saveToSite} />;
      case 'seo':
        return <SEO contenu={contenu} setContenu={setContenu} toast={toast} saveToSite={saveToSite} />;
      case 'medias':
        return <Medias toast={toast} />;
      case 'navigation':
        return <Navigation contenu={contenu} setContenu={setContenu} toast={toast} saveToSite={saveToSite} />;
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
          campaigns={campaigns} activity={activity} loading={loading}
          onTabChange={changeTab} toast={toast}
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
