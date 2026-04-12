import { useState } from 'react';
import ServiceBadge from '../components/shared/ServiceBadge';
import { THEMATIQUES } from '../utils/constants';

const TABS = [
  { id: 'projet', label: 'Le Projet' },
  { id: 'roadmap', label: 'Road to Net Zero' },
  { id: 'thematiques', label: 'Thematiques' },
  { id: 'confidentialite', label: 'Confidentialite' },
];

export default function Contenu({ contenu, setContenu, toast }) {
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

  const handleSave = (section) => {
    toast && toast(`Section "${section}" sauvegardee.`, 'success');
  };

  const togglePreview = (key) => {
    setPreview((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderMarkdown = (text) => {
    if (!text) return '';
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
      <div className="content-section" key={fieldKey}>
        <div className="content-section-header">
          <h3>{label}</h3>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => togglePreview(fieldKey)}
          >
            {isPreview ? 'Editer' : 'Apercu'}
          </button>
        </div>
        {isPreview ? (
          <div
            className="markdown-preview card"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(val) }}
          />
        ) : (
          <textarea
            className="content-textarea"
            value={val}
            onChange={(e) => handleChange(sectionId, key || null, e.target.value)}
            rows={10}
            placeholder={`Contenu de la section ${label}...`}
          />
        )}
      </div>
    );
  };

  const renderProjet = () => (
    <div className="tab-content">
      {renderTextSection('projet', 'Presentation du projet')}
      <div className="content-actions">
        <button className="btn btn-primary" onClick={() => handleSave('projet')}>
          Sauvegarder
        </button>
      </div>
    </div>
  );

  const renderRoadmap = () => (
    <div className="tab-content">
      {renderTextSection('roadmap', 'Introduction Road to Net Zero', 'intro')}
      <div className="content-section">
        <h3>Statistiques cles</h3>
        <div className="grid grid-2">
          <div className="form-group">
            <label>Statistique 1 - Label</label>
            <input
              type="text"
              value={getValue('roadmap', 'stat1_label')}
              onChange={(e) => handleChange('roadmap', 'stat1_label', e.target.value)}
              placeholder="Ex: Reduction des emissions"
            />
          </div>
          <div className="form-group">
            <label>Statistique 1 - Valeur</label>
            <input
              type="text"
              value={getValue('roadmap', 'stat1_value')}
              onChange={(e) => handleChange('roadmap', 'stat1_value', e.target.value)}
              placeholder="Ex: -55% d'ici 2030"
            />
          </div>
          <div className="form-group">
            <label>Statistique 2 - Label</label>
            <input
              type="text"
              value={getValue('roadmap', 'stat2_label')}
              onChange={(e) => handleChange('roadmap', 'stat2_label', e.target.value)}
              placeholder="Ex: Investissements necessaires"
            />
          </div>
          <div className="form-group">
            <label>Statistique 2 - Valeur</label>
            <input
              type="text"
              value={getValue('roadmap', 'stat2_value')}
              onChange={(e) => handleChange('roadmap', 'stat2_value', e.target.value)}
              placeholder="Ex: 2,3% du PIB"
            />
          </div>
        </div>
      </div>
      <div className="content-section">
        <h3>Liens PDF</h3>
        <div className="form-group">
          <label>PDF Rapport complet</label>
          <input
            type="text"
            value={getValue('roadmap', 'pdf_rapport')}
            onChange={(e) => handleChange('roadmap', 'pdf_rapport', e.target.value)}
            placeholder="/documents/road-to-net-zero-rapport.pdf"
          />
        </div>
        <div className="form-group">
          <label>PDF Synthese</label>
          <input
            type="text"
            value={getValue('roadmap', 'pdf_synthese')}
            onChange={(e) => handleChange('roadmap', 'pdf_synthese', e.target.value)}
            placeholder="/documents/road-to-net-zero-synthese.pdf"
          />
        </div>
      </div>
      <div className="content-actions">
        <button className="btn btn-primary" onClick={() => handleSave('roadmap')}>
          Sauvegarder
        </button>
      </div>
    </div>
  );

  const renderThematiques = () => (
    <div className="tab-content">
      {THEMATIQUES && THEMATIQUES.length > 0 ? (
        THEMATIQUES.map((theme) => (
          <div key={theme.id || theme.slug}>
            {renderTextSection('thematiques', theme.label || theme.nom, theme.id || theme.slug)}
          </div>
        ))
      ) : (
        <div className="content-section">
          {renderTextSection('thematiques', 'Introduction generale', 'intro')}
          {renderTextSection('thematiques', 'Economie et finance', 'economie')}
          {renderTextSection('thematiques', 'Energie et climat', 'energie')}
          {renderTextSection('thematiques', 'Democratie et institutions', 'democratie')}
          {renderTextSection('thematiques', 'Europe et international', 'europe')}
          {renderTextSection('thematiques', 'Sante et protection sociale', 'sante')}
        </div>
      )}
      <div className="content-actions">
        <button className="btn btn-primary" onClick={() => handleSave('thematiques')}>
          Sauvegarder
        </button>
      </div>
    </div>
  );

  const renderConfidentialite = () => (
    <div className="tab-content">
      {renderTextSection('confidentialite', 'Politique de confidentialite')}
      <div className="content-actions">
        <button className="btn btn-primary" onClick={() => handleSave('confidentialite')}>
          Sauvegarder
        </button>
      </div>
    </div>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'projet':
        return renderProjet();
      case 'roadmap':
        return renderRoadmap();
      case 'thematiques':
        return renderThematiques();
      case 'confidentialite':
        return renderConfidentialite();
      default:
        return null;
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Contenu du site</h1>
          <ServiceBadge service="github" />
        </div>
      </div>

      <div className="page-body">
        <div className="tab-group">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {renderActiveTab()}
      </div>
    </div>
  );
}
