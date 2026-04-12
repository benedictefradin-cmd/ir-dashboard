import { NAV_ITEMS } from '../../utils/constants';
import logoSvg from '../../assets/logo.svg';

export default function Sidebar({ activeTab, onTabChange, badges, collapsed, onToggle, mobileOpen, onMobileClose }) {
  return (
    <>
      {mobileOpen && <div className="mobile-overlay" onClick={onMobileClose} />}
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
        <div className="sidebar-header">
          <img src={logoSvg} alt="Institut Rousseau" className="sidebar-logo-img" />
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => {
            if (item.type === 'separator') {
              return <div key={item.key} className="nav-separator" />;
            }
            return (
              <button
                key={item.key}
                className={`nav-item${activeTab === item.key ? ' active' : ''}`}
                onClick={() => { onTabChange(item.key); onMobileClose?.(); }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {badges[item.key] > 0 && (
                  <span className="nav-badge">{badges[item.key]}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? 'Agrandir' : 'R\u00e9duire'}>
            {collapsed ? '\u25B6' : '\u25C0'}
          </button>
        </div>
      </aside>
    </>
  );
}
