import { useState, useMemo, useEffect } from 'react';
import Sidebar from './Sidebar';
import ToastContainer from '../shared/ToastContainer';
import { loadLocal, saveLocal } from '../../utils/localStorage';
import { LS_KEYS, SITE_URL } from '../../utils/constants';

export default function Layout({
  activeTab, onTabChange, badges, toasts, onRemoveToast, children,
  articles, events, presse, subscribers, sollicitations,
  currentUser, onLogout,
}) {
  const [collapsed, setCollapsed] = useState(() => loadLocal(LS_KEYS.sidebarCollapsed, false));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    saveLocal(LS_KEYS.sidebarCollapsed, next);
  };

  // Recherche globale
  const searchResults = useMemo(() => {
    if (!globalSearch || globalSearch.length < 2) return [];
    const q = globalSearch.toLowerCase();
    const results = [];

    (articles || []).forEach(a => {
      if ((a.title || '').toLowerCase().includes(q) || (a.author || '').toLowerCase().includes(q)) {
        results.push({ type: 'article', label: a.title, sub: a.author, tab: 'articles' });
      }
    });
    (events || []).forEach(e => {
      if ((e.title || e.titre || '').toLowerCase().includes(q)) {
        results.push({ type: 'événement', label: e.title || e.titre, sub: e.lieu, tab: 'evenements' });
      }
    });
    (presse || []).forEach(p => {
      if ((p.title || '').toLowerCase().includes(q) || (p.media || '').toLowerCase().includes(q)) {
        results.push({ type: 'presse', label: p.title, sub: p.media, tab: 'presse' });
      }
    });
    (subscribers || []).forEach(s => {
      if ((s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q)) {
        results.push({ type: 'contact', label: s.name, sub: s.email, tab: 'newsletter' });
      }
    });
    (sollicitations || []).forEach(s => {
      if ((s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q) || (s.message || '').toLowerCase().includes(q)) {
        results.push({ type: 'sollicitation', label: s.name, sub: s.email, tab: 'sollicitations' });
      }
    });

    return results.slice(0, 8);
  }, [globalSearch, articles, events, presse, subscribers, sollicitations]);

  const selectResult = (result) => {
    onTabChange(result.tab);
    setGlobalSearch('');
    setShowSearchResults(false);
  };

  // Raccourci Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector('.global-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="app-layout">
      <Sidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        badges={badges}
        collapsed={collapsed}
        onToggle={toggleSidebar}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="mobile-header">
        <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)}>
          &#9776;
        </button>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 16 }}>
          Institut Rousseau
        </span>
      </div>

      <main className={`main-content${collapsed ? ' sidebar-collapsed' : ''}`}>
        {/* Topbar améliorée */}
        <div className="topbar">
          <div className="topbar-left">
            <div className="global-search-wrapper">
              <input
                type="text"
                className="global-search-input"
                placeholder="Rechercher partout… (⌘K)"
                value={globalSearch}
                onChange={e => { setGlobalSearch(e.target.value); setShowSearchResults(true); }}
                onFocus={() => setShowSearchResults(true)}
                onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
              />
              {showSearchResults && searchResults.length > 0 && (
                <div className="global-search-results">
                  {searchResults.map((r, i) => (
                    <button key={i} className="global-search-result" onMouseDown={() => selectResult(r)}>
                      <span className="search-result-type">{r.type}</span>
                      <span className="search-result-label">{r.label}</span>
                      {r.sub && <span className="search-result-sub">{r.sub}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="topbar-right">
            <span className="site-status">
              <span className="status-dot green" />
              En ligne
            </span>
            <a href={SITE_URL} target="_blank" rel="noopener noreferrer" className="site-link">
              Voir le site &#8599;
            </a>
            {currentUser && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-light)' }}>
                <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{currentUser.name}</span>
                {currentUser.role === 'admin' && (
                  <span className="badge badge-sky" style={{ fontSize: 10 }}>admin</span>
                )}
                <button className="btn btn-outline btn-sm" onClick={onLogout} title="Se déconnecter">Déconnexion</button>
              </span>
            )}
          </div>
        </div>

        {children}
      </main>

      <ToastContainer toasts={toasts} onRemove={onRemoveToast} />
    </div>
  );
}
