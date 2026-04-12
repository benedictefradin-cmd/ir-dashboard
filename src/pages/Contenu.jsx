import { useState } from 'react';
import ServiceBadge from '../components/shared/ServiceBadge';
import { THEMATIQUES } from '../utils/constants';
import { triggerRebuild, hasDeployHook } from '../services/deploy';
import { hasGitHub } from '../services/github';

const TABS = [
  { id: 'projet', label: 'Le Projet' },
  { id: 'roadmap', label: 'Road to Net Zero' },
  { id: 'thematiques', label: 'Thématiques' },
  { id: 'confidentialite', label: 'Confidentialité' },
];

export default function Contenu({ contenu, setContenu, toast, saveToSite }) {
  const [activeTab, setActiveTab] = useState('projet');
  const [preview, setPreview] = useState({});

  const getValue = (section, key) => {
    if (!contenu || !contenu[section]) return '';
    if (key) return contenu[section][key] || '';
    return contenu[section] || '';
  };

  const handleChange = (section, key, value) => {
    setContenu((prev) => {
      const updated = { ...prev };
      if (key) {
        updated[section] = { ...(updated[section] || {}), [key]: value };
      } else {
        updated[section] = value;
      }
      return updated;
    });
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!saveToSite || !hasGitHub()) {
      toast('GitHub non configuré — allez dans Config', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveToSite('contenu', contenu, 'Mise à jour contenu du site depuis le back-office');
    } finally {
      setSaving(false);
    }
  };

  const togglePreview = (key) => {
    setPreview((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderMarkdown = (text) => {
    if (!text) return '<p style="color: var(--text-light); font-style: italic;">Aucun contenu</p>';
    return text
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n/g, '<br />');
  };

  const renderTextSection = (sectionId, label, key) => {
    const fieldKey = key || sectionId;
    const val = key ? getValue(sectionId, key) : getValue(sectionId);
    const isPreview = preview[fieldKey];

    return (
      <div key={fieldKey} className="card mb-16" style={{ padding: 20 }}>
        <div className="flex-between mb-8">
          <h3 style={{ fontSize: 15 }}>{label}</h3>
          <button className="btn btn-outline btn-sm" onClick={() => togglePreview(fieldKey)}>
            {isPreview ? 'Éditer' : 'Aperçu'}
          </button>
        </div>
        {isPreview ? (
          <div
            style={{ padding: 16, background: 'var(--cream)', borderRadius: 8, fontSize: 14, lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(val) }}
          />
        ) : (
          <textarea
            value={val}
            onChange={(e) => handleChange(sectionId, key || null, e.target.value)}
            rows={8}
            placeholder={`Contenu de la section ${label}…`}
          />
        )}
      </div>
    );
  };

  const renderProjet = () => (
    <>
      {renderTextSection('projet', 'Texte fondateur', 'presentation')}
      {renderTextSection('projet', '4 piliers (Écologie, Démocratie, Social, Économie)', 'piliers')}
      {renderTextSection('projet', '3 convictions (Raison républicaine, De l\'idéal à l\'action, Indépendance absolue)', 'convictions')}
      {renderTextSection('projet', 'Timeline historique', 'timeline')}
    </>
  );

  const renderRoadmap = () => (
    <>
      {renderTextSection('roadmap', 'Introduction Road to Net Zero', 'intro')}
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 16 }}>Statistiques clés</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label>Statistique 1 — Label</label>
            <input value={getValue('roadmap', 'stat1_label')} onChange={(e) => handleChange('roadmap', 'stat1_label', e.target.value)} placeholder="Ex: Réduction des émissions" />
          </div>
          <div>
            <label>Statistique 1 — Valeur</label>
            <input value={getValue('roadmap', 'stat1_value')} onChange={(e) => handleChange('roadmap', 'stat1_value', e.target.value)} placeholder="Ex: -55% d'ici 2030" />
          </div>
          <div>
            <label>Statistique 2 — Label</label>
            <input value={getValue('roadmap', 'stat2_label')} onChange={(e) => handleChange('roadmap', 'stat2_label', e.target.value)} placeholder="Ex: Investissements nécessaires" />
          </div>
          <div>
            <label>Statistique 2 — Valeur</label>
            <input value={getValue('roadmap', 'stat2_value')} onChange={(e) => handleChange('roadmap', 'stat2_value', e.target.value)} placeholder="Ex: 2,3% du PIB" />
          </div>
        </div>
      </div>
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 16 }}>Liens PDF</h3>
        <div style={{ marginBottom: 12 }}>
          <label>PDF Rapport complet</label>
          <input value={getValue('roadmap', 'pdf_rapport')} onChange={(e) => handleChange('roadmap', 'pdf_rapport', e.target.value)} placeholder="/documents/road-to-net-zero-rapport.pdf" />
        </div>
        <div>
          <label>PDF Synthèse</label>
          <input value={getValue('roadmap', 'pdf_synthese')} onChange={(e) => handleChange('roadmap', 'pdf_synthese', e.target.value)} placeholder="/documents/road-to-net-zero-synthese.pdf" />
        </div>
      </div>
    </>
  );

  const renderThematiques = () => (
    <>
      {THEMATIQUES.map((theme) => (
        renderTextSection('thematiques', theme, theme.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
      ))}
    </>
  );

  const renderConfidentialite = () => (
    <>
      {renderTextSection('confidentialite', 'Politique de confidentialité')}
    </>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Contenu du site</h1>
          <p className="page-header-sub">Édition des textes statiques</p>
        </div>
        <div className="flex-center gap-8">
          <ServiceBadge service="github" />
        </div>
      </div>

      <div className="page-body">
        {/* Onglets */}
        <div className="tab-group">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab-item${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'projet' && renderProjet()}
        {activeTab === 'roadmap' && renderRoadmap()}
        {activeTab === 'thematiques' && renderThematiques()}
        {activeTab === 'confidentialite' && renderConfidentialite()}
      </div>
    </>
  );
}
