import { useState } from 'react';
import { NAV_GROUPS } from '../../utils/constants';
import { loadLocal, saveLocal } from '../../utils/localStorage';
import logoSvg from '../../assets/logo.svg';

export default function Sidebar({ activeTab, onTabChange, badges, collapsed, onToggle, mobileOpen, onMobileClose }) {
  const [openGroups, setOpenGroups] = useState(() => {
    const saved = loadLocal('sidebar-groups', null);
    if (saved) return saved;
    const defaults = {};
    NAV_GROUPS.forEach(g => { defaults[g.key] = g.defaultOpen !== false; });
    return defaults;
  });

  const toggleGroup = (key) => {
    setOpenGroups(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveLocal('sidebar-groups', next);
      return next;
    });
  };

  const groupContainsActive = (group) => group.items.some(item => item.key === activeTab);
  const groupBadgeCount = (group) => group.items.reduce((sum, item) => sum + (badges[item.key] || 0), 0);

  return (
    <>
      {mobileOpen && <div className="mobile-overlay" onClick={onMobileClose} />}
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
        <div className="sidebar-header">
          <img src={logoSvg} alt="Institut Rousseau" className="sidebar-logo-img" />
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map(group => {
            const isOpen = openGroups[group.key] || groupContainsActive(group);
            const totalBadge = groupBadgeCount(group);

            // Groupe sans label (dashboard) — afficher directement les items
            if (!group.label) {
              return group.items.map(item => (
                <button
                  key={item.key}
                  className={`nav-item${activeTab === item.key ? ' active' : ''}`}
                  onClick={() => { onTabChange(item.key); onMobileClose?.(); }}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                  {badges[item.key] > 0 && <span className="nav-badge">{badges[item.key]}</span>}
                </button>
              ));
            }

            return (
              <div key={group.key} className="nav-group">
                <button
                  className={`nav-group-header${isOpen ? ' open' : ''}${groupContainsActive(group) ? ' has-active' : ''}`}
                  onClick={() => toggleGroup(group.key)}
                >
                  <span className="nav-group-arrow">{isOpen ? '▾' : '▸'}</span>
                  <span className="nav-group-label">{group.label}</span>
                  {!isOpen && totalBadge > 0 && <span className="nav-badge">{totalBadge}</span>}
                </button>
                {isOpen && (
                  <div className="nav-group-items">
                    {group.items.map(item => (
                      <button
                        key={item.key}
                        className={`nav-item nav-item-nested${activeTab === item.key ? ' active' : ''}`}
                        onClick={() => { onTabChange(item.key); onMobileClose?.(); }}
                      >
                        <span className="nav-icon">{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                        {badges[item.key] > 0 && <span className="nav-badge">{badges[item.key]}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? 'Agrandir' : 'Réduire'}>
            {collapsed ? '▶' : '◀'}
          </button>
        </div>
      </aside>
    </>
  );
}
