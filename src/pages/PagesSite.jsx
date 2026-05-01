import { useState } from 'react';
import Accueil from './Accueil';
import Equipe from './Equipe';
import Navigation from './Navigation';

const SECTIONS = [
  { key: 'accueil', label: "Page d'accueil", icon: '\u{1F3E0}' },
  { key: 'equipe', label: 'Équipe', icon: '\u{1F464}' },
  { key: 'navigation', label: 'Navigation', icon: '\u{1F517}' },
];

export default function PagesSite(props) {
  const [section, setSection] = useState('accueil');

  return (
    <>
      <div className="page-header slide-up">
        <div>
          <h1>Pages du site</h1>
          <p className="page-header-sub">Gérer le contenu statique du site</p>
        </div>
      </div>

      <div className="page-body">
        <div className="tab-group mb-16">
          {SECTIONS.map(s => (
            <button
              key={s.key}
              className={`tab-item${section === s.key ? ' active' : ''}`}
              onClick={() => setSection(s.key)}
            >
              <span style={{ marginRight: 6 }}>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {section === 'accueil' && <Accueil {...props} embedded />}
        {section === 'equipe' && <Equipe {...props} embedded />}
        {section === 'navigation' && <Navigation {...props} embedded />}
      </div>
    </>
  );
}
