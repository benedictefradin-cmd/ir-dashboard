import { useState } from 'react';
import Sidebar from './Sidebar';
import ToastContainer from '../shared/ToastContainer';
import { loadLocal, saveLocal } from '../../utils/localStorage';
import { LS_KEYS } from '../../utils/constants';

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
        {children}
      </main>

      <ToastContainer toasts={toasts} onRemove={onRemoveToast} />
    </div>
  );
}
