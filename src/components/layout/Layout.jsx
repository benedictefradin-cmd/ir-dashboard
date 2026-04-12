import { useState } from 'react';
import Sidebar from './Sidebar';
import ToastContainer from '../shared/ToastContainer';
import { loadLocal, saveLocal } from '../../utils/localStorage';
import { LS_KEYS, SITE_URL } from '../../utils/constants';

export default function Layout({ activeTab, onTabChange, badges, toasts, onRemoveToast, children }) {
  const [collapsed, setCollapsed] = useState(() => loadLocal(LS_KEYS.sidebarCollapsed, false));
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    saveLocal(LS_KEYS.sidebarCollapsed, next);
  };

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
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-left">
            <span className="topbar-title">Institut Rousseau</span>
            <span className="topbar-badge">Admin</span>
          </div>
          <div className="topbar-right">
            <span className="site-status">
              <span className="status-dot green" />
              Site en ligne
            </span>
            <a href={SITE_URL} target="_blank" rel="noopener noreferrer" className="site-link">
              Voir le site &#8599;
            </a>
          </div>
        </div>

        {children}
      </main>

      <ToastContainer toasts={toasts} onRemove={onRemoveToast} />
    </div>
  );
}
