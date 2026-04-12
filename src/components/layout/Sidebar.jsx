import { NAV_ITEMS } from '../../utils/constants';

const ICONS = {
  dashboard: '\u2302',
  people: '\u263A',
  mail: '\u2709',
  article: '\u270E',
  send: '\u2708',
  settings: '\u2699',
};

export default function Sidebar({ activeTab, onTabChange, badges, collapsed, onToggle, mobileOpen, onMobileClose }) {
  return (
    <>
      {mobileOpen && <div className="mobile-overlay" onClick={onMobileClose} />}
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">IR</div>
          <div className="sidebar-title">
            <h2>Institut Rousseau</h2>
            <span>Back-office</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              className={`nav-item${activeTab === item.key ? ' active' : ''}`}
              onClick={() => { onTabChange(item.key); onMobileClose?.(); }}
            >
              <span className="nav-icon">{ICONS[item.icon] || '\u25CF'}</span>
              <span className="nav-label">{item.label}</span>
              {badges[item.key] > 0 && (
                <span className="nav-badge">{badges[item.key]}</span>
              )}
            </button>
          ))}
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
