import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import './styles.css';
import Layout from './components/layout/Layout';

// ─── Lazy-loaded pages ─────────────────────────────
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Articles = lazy(() => import('./pages/Articles'));
const Newsletter = lazy(() => import('./pages/Newsletter'));
const Messagerie = lazy(() => import('./pages/Messagerie'));
const Settings = lazy(() => import('./pages/Settings'));
const Evenements = lazy(() => import('./pages/Evenements'));
const Presse = lazy(() => import('./pages/Presse'));
const Profils = lazy(() => import('./pages/Profils'));
const Contenu = lazy(() => import('./pages/Contenu'));
const Accueil = lazy(() => import('./pages/Accueil'));
const SEO = lazy(() => import('./pages/SEO'));
const Medias = lazy(() => import('./pages/Medias'));
const Navigation = lazy(() => import('./pages/Navigation'));
const Equipe = lazy(() => import('./pages/Equipe'));
const Technique = lazy(() => import('./pages/Technique'));
const Sollicitations = lazy(() => import('./pages/Sollicitations'));
const Calendrier = lazy(() => import('./pages/Calendrier'));
const PagesSite = lazy(() => import('./pages/PagesSite'));
import { checkHealth } from './services/api';
import { fetchContacts, fetchCampaigns } from './services/brevo';
import { fetchSollicitations } from './services/contact';
import { fetchAllCalendar, saveCalendar } from './services/calendar';
import { fetchAllSiteData, normalizePublications, normalizeEvents, normalizePresse, normalizeAuteurs, saveSiteData } from './services/siteData';
import { hasGitHub } from './services/github';
import { login as apiLogin, logout as apiLogout, fetchMe, getToken } from './services/auth';
import {
  consumeOAuthHash, getGitHubUser, getGitHubToken,
  startGitHubLogin, gitHubLogout,
} from './services/githubAuth';
import { loadLocal, saveLocal } from './utils/localStorage';
import { LS_KEYS, COLORS } from './utils/constants';
import { getActivity, logActivity } from './utils/activity';
import useNotionSync from './hooks/useNotionSync';
import logoSvg from './assets/logo.svg';


// ─── Pas de données démo : tout est chargé depuis le site via GitHub ───

// ─── MAIN APP ──────────────────────────────────────────
export default function App() {
  // Auth
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const lastActivity = useRef(Date.now());

  // Auth GitHub OAuth (token en sessionStorage)
  const [ghUser, setGhUser] = useState(() => getGitHubUser());

  // Au démarrage : récupère le token OAuth depuis l'URL si on revient du
  // callback Worker (#token=…&login=…), nettoie l'URL, puis vérifie l'auth
  // login/mdp legacy si encore présent.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1. Consomme le hash OAuth GitHub si on revient du callback
      const oauthUser = consumeOAuthHash();
      if (oauthUser && !cancelled) {
        setGhUser(oauthUser);
        setLoggedIn(true);
        // L'utilisateur "courant" est le compte GitHub. role='admin' tant
        // qu'on a la whitelist côté Worker — pas de rôle granulaire pour
        // l'instant (à raffiner si besoin via une table dans KV).
        setCurrentUser({ id: `gh:${oauthUser.login}`, login: oauthUser.login, name: oauthUser.name, role: 'admin' });
        setAuthChecking(false);
        return;
      }
      // 2. Si déjà connecté GitHub (sessionStorage), on retient
      const existing = getGitHubUser();
      if (existing && !cancelled) {
        setLoggedIn(true);
        setCurrentUser({ id: `gh:${existing.login}`, login: existing.login, name: existing.name, role: 'admin' });
        setAuthChecking(false);
        return;
      }
      // 3. Fallback : auth login/mdp legacy
      if (!getToken()) { setAuthChecking(false); return; }
      try {
        const { user } = await fetchMe();
        if (!cancelled && user) {
          setCurrentUser(user);
          setLoggedIn(true);
        }
      } catch { /* token invalide → non connecté */ }
      if (!cancelled) setAuthChecking(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Si le worker répond 401 sur un appel authentifié (token invalidé par admin reset,
  // suppression de compte, expiration), on bascule sur l'écran de login.
  useEffect(() => {
    const handler = () => {
      setLoggedIn(false);
      setCurrentUser(null);
      setLoginError('Session expirée — reconnectez-vous');
    };
    window.addEventListener('auth:invalidated', handler);
    return () => window.removeEventListener('auth:invalidated', handler);
  }, []);

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
  const [activity, setActivity] = useState(() => getActivity());
  const [contenu, setContenu] = useState({});

  // Calendrier data (localStorage)
  const [socialPosts, setSocialPostsRaw] = useState(() => loadLocal(LS_KEYS.socialPosts, []));
  const [rapports, setRapportsRaw] = useState(() => loadLocal(LS_KEYS.rapportsFondations, []));
  const [extEvents, setExtEventsRaw] = useState(() => loadLocal(LS_KEYS.extEvents, []));

  // Services
  const [services, setServices] = useState({ brevo: false, telegram: false, github: hasGitHub() });
  const [loading, setLoading] = useState(true);

  // Notion sync
  const { notionArticles, notionCounts, notionLoading, notionError, syncNotion, notionConfigured } = useNotionSync();

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    // Logger les actions réussies dans le feed d'activité
    if (type === 'success') {
      setActivity(logActivity(message));
    }
  }, []);

  const changeTab = useCallback((key) => {
    setTab(key);
    saveLocal(LS_KEYS.activeTab, key);
  }, []);

  // Auth handlers
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginBusy(true);
    try {
      const { user } = await apiLogin(loginId, loginPw);
      setCurrentUser(user);
      setLoggedIn(true);
      lastActivity.current = Date.now();
      setLoginPw('');
    } catch (err) {
      setLoginError(err.message || 'Identifiants incorrects');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = useCallback(async () => {
    // Déconnecte les deux mécanismes (GitHub OAuth + login/mdp legacy).
    await Promise.all([
      gitHubLogout(),
      apiLogout().catch(() => {}),
    ]);
    setGhUser(null);
    setLoggedIn(false);
    setCurrentUser(null);
  }, []);

  // Inactivity timer (15 min sans activité → déconnexion)
  useEffect(() => {
    if (!loggedIn) return;
    const resetTimer = () => { lastActivity.current = Date.now(); };
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

    // Charger le calendrier depuis le Worker (KV). Migration one-shot :
    // si KV vide mais localStorage contient des données, on les pousse vers KV.
    try {
      const cal = await fetchAllCalendar();
      const localSocial = loadLocal(LS_KEYS.socialPosts, []);
      const localRapports = loadLocal(LS_KEYS.rapportsFondations, []);
      const localExt = loadLocal(LS_KEYS.extEvents, []);

      if (Array.isArray(cal.socialPosts) && cal.socialPosts.length > 0) {
        setSocialPostsRaw(cal.socialPosts);
      } else if (localSocial.length > 0) {
        saveCalendar('socialPosts', localSocial).catch(() => {});
      }

      if (Array.isArray(cal.rapports) && cal.rapports.length > 0) {
        setRapportsRaw(cal.rapports);
      } else if (localRapports.length > 0) {
        saveCalendar('rapports', localRapports).catch(() => {});
      }

      if (Array.isArray(cal.extEvents) && cal.extEvents.length > 0) {
        setExtEventsRaw(cal.extEvents);
      } else if (localExt.length > 0) {
        saveCalendar('extEvents', localExt).catch(() => {});
      }
    } catch (err) {
      console.warn('[App] Erreur chargement calendrier KV, fallback localStorage :', err.message);
    }

    // Charger les contacts Brevo et vérifier les services
    try {
      const health = await checkHealth();
      if (health?.services) {
        setServices(health.services);
        if (health.services.brevo) {
          try {
            const contactsData = await fetchContacts();
            const contacts = contactsData?.contacts || [];
            if (contacts.length) setSubscribers(contacts);
            const campaignsData = await fetchCampaigns();
            const campaignsList = campaignsData?.campaigns || [];
            if (campaignsList.length) setCampaigns(campaignsList);
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

  // Calendrier setters : localStorage (cache offline) + KV (persist multi-machines)
  const calendarSaveTimers = useRef({});
  const persistCalendar = useCallback((type, items) => {
    clearTimeout(calendarSaveTimers.current[type]);
    calendarSaveTimers.current[type] = setTimeout(() => {
      saveCalendar(type, items).catch(err => {
        console.warn(`[App] KV sync ${type} :`, err.message);
      });
    }, 1200);
  }, []);
  const setSocialPosts = useCallback((updater) => {
    setSocialPostsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLocal(LS_KEYS.socialPosts, next);
      persistCalendar('socialPosts', next);
      return next;
    });
  }, [persistCalendar]);
  const setRapports = useCallback((updater) => {
    setRapportsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLocal(LS_KEYS.rapportsFondations, next);
      persistCalendar('rapports', next);
      return next;
    });
  }, [persistCalendar]);
  const setExtEvents = useCallback((updater) => {
    setExtEventsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLocal(LS_KEYS.extEvents, next);
      persistCalendar('extEvents', next);
      return next;
    });
  }, [persistCalendar]);

  // Computed badges
  const readyCount = (notionCounts.ready || 0) + articles.filter(a => a.status === 'ready').length;
  const badges = {
    dashboard: 0,
    articles: readyCount || articles.filter(a => a.status === 'review').length,
    evenements: 0,
    calendrier: (() => {
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const in7 = new Date(now); in7.setDate(in7.getDate() + 7);
      const urgentRapports = rapports.filter(r => r.status !== 'envoye' && r.deadline && new Date(r.deadline) <= in7).length;
      const weekEvents = extEvents.filter(e => e.status !== 'decline' && e.dateDebut && new Date(e.dateDebut) >= now && new Date(e.dateDebut) <= in7).length;
      return urgentRapports + weekEvents;
    })(),
    presse: 0,
    profils: 0,
    newsletter: subscribers.filter(s => s.status === 'pending').length,
    messagerie: 0,
    contenu: 0,
    accueil: 0,
    seo: 0,
    medias: 0,
    navigation: 0,
    equipe: 0,
    technique: 0,
    sollicitations: sollicitations.filter(s => s.status === 'new').length,
    pagessite: 0,
    settings: 0,
  };

  // Vérification du token en cours
  if (authChecking) {
    return (
      <div className="login-wrapper fade-in">
        <div style={{ color: 'var(--text-light)' }}>Vérification de la session…</div>
      </div>
    );
  }

  // Login screen
  if (!loggedIn) {
    return (
      <div className="login-wrapper fade-in">
        <div className="card login-card slide-up">
          <img src={logoSvg} alt="Institut Rousseau" style={{ height: 40, marginBottom: 24 }} />
          <p className="login-sub">Back-office</p>

          {/* Bouton GitHub OAuth — option recommandée. Le clic redirige vers
              le Worker qui passe la main à GitHub puis revient ici avec le
              token. Le compte doit être dans ALLOWED_GITHUB_USERS côté Worker. */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => { try { startGitHubLogin(); } catch (e) { setLoginError(e.message); } }}
            style={{ padding: '10px 24px', fontSize: 15, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#24292f', borderColor: '#24292f' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2.05c-3.34.73-4.04-1.61-4.04-1.61-.55-1.4-1.34-1.77-1.34-1.77-1.09-.74.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23.96-.27 2-.4 3.03-.4 1.03 0 2.07.13 3.03.4 2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 0z"/>
            </svg>
            Se connecter avec GitHub
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0', color: 'var(--text-light)', fontSize: 12 }}>
            <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            ou identifiants
            <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <input placeholder="Identifiant" value={loginId} onChange={e => setLoginId(e.target.value)} style={{ width: '100%' }} autoComplete="username" />
            <input placeholder="Mot de passe" type="password" value={loginPw} onChange={e => setLoginPw(e.target.value)} style={{ width: '100%' }} autoComplete="current-password" />
            {loginError && <p className="login-error">{loginError}</p>}
            <button type="submit" className="btn btn-outline" style={{ padding: '10px 32px', fontSize: 14 }} disabled={loginBusy}>
              {loginBusy ? 'Connexion…' : 'Se connecter'}
            </button>
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
          socialPosts={socialPosts} rapports={rapports} extEvents={extEvents}
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
      case 'calendrier':
        return <Calendrier socialPosts={socialPosts} setSocialPosts={setSocialPosts} rapports={rapports} setRapports={setRapports} extEvents={extEvents} setExtEvents={setExtEvents} events={events} toast={toast} onTabChange={changeTab} />;
      case 'presse':
        return <Presse presse={presse} setPresse={setPresse} sollicitations={sollicitations} loading={loading} toast={toast} saveToSite={saveToSite} />;
      case 'profils':
        return <Profils auteurs={auteurs} setAuteurs={setAuteurs} articles={articles} contenu={contenu} setContenu={setContenu} loading={loading} toast={toast} saveToSite={saveToSite} onTabChange={changeTab} />;
      case 'newsletter':
        return <Newsletter subscribers={subscribers} setSubscribers={setSubscribers} campaigns={campaigns} loading={loading} connected={services.brevo} onRefresh={loadData} toast={toast} />;
      case 'messagerie':
        return <Messagerie subscribers={subscribers} presse={presse} auteurs={auteurs} events={events} services={services} toast={toast} />;
      case 'pagessite':
        return <PagesSite contenu={contenu} setContenu={setContenu} auteurs={auteurs} setAuteurs={setAuteurs} articles={articles} toast={toast} saveToSite={saveToSite} onTabChange={changeTab} />;
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
      case 'equipe':
        return <Equipe contenu={contenu} setContenu={setContenu} auteurs={auteurs} setAuteurs={setAuteurs} articles={articles} toast={toast} saveToSite={saveToSite} onTabChange={changeTab} />;
      case 'technique':
        return <Technique toast={toast} />;
      case 'sollicitations':
        return <Sollicitations sollicitations={sollicitations} setSollicitations={setSollicitations} loading={loading} toast={toast} />;
      case 'settings':
        return <Settings
          subscribers={subscribers} services={services}
          onImportSubscribers={(items) => setSubscribers(prev => [...items, ...prev])}
          onRefresh={loadData} toast={toast}
          currentUser={currentUser}
        />;
      default:
        return <Dashboard
          subscribers={subscribers} articles={articles}
          events={events} presse={presse} sollicitations={sollicitations}
          campaigns={campaigns} activity={activity} loading={loading}
          onTabChange={changeTab} toast={toast}
          notionArticles={notionArticles} notionCounts={notionCounts}
          socialPosts={socialPosts} rapports={rapports} extEvents={extEvents}
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
      articles={articles}
      events={events}
      presse={presse}
      subscribers={subscribers}
      sollicitations={sollicitations}
      currentUser={currentUser}
      onLogout={handleLogout}
    >
      <Suspense fallback={<div className="page-body" style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>Chargement…</div>}>
        {renderPage()}
      </Suspense>
    </Layout>
  );
}
