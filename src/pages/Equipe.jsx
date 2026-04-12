import { useState } from 'react';
import ServiceBadge from '../components/shared/ServiceBadge';
import { hasGitHub } from '../services/github';

const SECTIONS = [
  { id: 'ca', label: 'Conseil d\'administration' },
  { id: 'directions', label: 'Directions d\'études' },
  { id: 'conseil_scientifique', label: 'Conseil scientifique' },
  { id: 'equipe_permanente', label: 'Équipe permanente' },
  { id: 'page_settings', label: 'En-tête de page' },
];

const CS_CATEGORIES = [
  { id: 'droit', label: 'Droit & Institutions' },
  { id: 'economie', label: 'Économie' },
  { id: 'idees', label: 'Idées & Société' },
  { id: 'culture', label: 'Culture' },
  { id: 'ecologie', label: 'Écologie' },
  { id: 'international', label: 'International' },
];

export default function Equipe({ contenu, setContenu, toast, saveToSite }) {
  const [activeSection, setActiveSection] = useState('ca');
  const [saving, setSaving] = useState(false);

  const equipe = contenu?.equipe || {};

  const handleChange = (section, key, value) => {
    setContenu((prev) => ({
      ...prev,
      equipe: {
        ...(prev?.equipe || {}),
        [section]: {
          ...((prev?.equipe || {})[section] || {}),
          [key]: value,
        },
      },
    }));
  };

  const handleTopChange = (key, value) => {
    setContenu((prev) => ({
      ...prev,
      equipe: {
        ...(prev?.equipe || {}),
        [key]: value,
      },
    }));
  };

  const handleSave = async () => {
    if (!saveToSite || !hasGitHub()) {
      toast('GitHub non configuré — allez dans Config', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveToSite('contenu', contenu, 'Mise à jour équipe depuis le back-office');
    } finally {
      setSaving(false);
    }
  };

  const MemberList = ({ section, listKey, fields, addLabel }) => {
    const items = equipe?.[section]?.[listKey] || [];
    const realItems = Array.isArray(items) ? items : [];

    const update = (index, field, value) => {
      const updated = [...realItems];
      updated[index] = { ...updated[index], [field]: value };
      handleChange(section, listKey, updated);
    };

    const add = () => {
      const empty = {};
      fields.forEach(f => { empty[f.key] = ''; });
      handleChange(section, listKey, [...realItems, empty]);
    };

    const remove = (index) => {
      handleChange(section, listKey, realItems.filter((_, i) => i !== index));
    };

    const move = (index, direction) => {
      const updated = [...realItems];
      const target = index + direction;
      if (target < 0 || target >= updated.length) return;
      [updated[index], updated[target]] = [updated[target], updated[index]];
      handleChange(section, listKey, updated);
    };

    return (
      <>
        {realItems.map((item, i) => (
          <div key={i} className="card mb-8" style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button className="btn btn-outline btn-sm" onClick={() => move(i, -1)} disabled={i === 0} style={{ padding: '2px 6px', fontSize: 10 }}>{'\u25B2'}</button>
                <button className="btn btn-outline btn-sm" onClick={() => move(i, 1)} disabled={i === realItems.length - 1} style={{ padding: '2px 6px', fontSize: 10 }}>{'\u25BC'}</button>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600 }}>
                {item.prenom || item.nom ? `${item.prenom || ''} ${item.nom || ''}`.trim() : `#${i + 1}`}
              </span>
              <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto', color: 'var(--danger)', fontSize: 11 }} onClick={() => remove(i)}>Supprimer</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {fields.map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11 }}>{f.label}</label>
                  {f.type === 'textarea' ? (
                    <textarea value={item[f.key] || ''} onChange={(e) => update(i, f.key, e.target.value)} rows={3} placeholder={f.placeholder || ''} />
                  ) : (
                    <input value={item[f.key] || ''} onChange={(e) => update(i, f.key, e.target.value)} placeholder={f.placeholder || ''} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        <button className="btn btn-outline" style={{ marginTop: 4 }} onClick={add}>+ {addLabel || 'Ajouter un membre'}</button>
      </>
    );
  };

  const memberFields = [
    { key: 'prenom', label: 'Prénom', placeholder: 'Jean' },
    { key: 'nom', label: 'Nom', placeholder: 'Dupont' },
    { key: 'role', label: 'Rôle / Fonction', placeholder: 'Président' },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Bio courte…' },
    { key: 'photo', label: 'Photo (chemin)', placeholder: 'assets/images/equipe/jean-dupont.jpg' },
    { key: 'linkedin', label: 'LinkedIn (URL)', placeholder: 'https://www.linkedin.com/in/…' },
  ];

  const renderCA = () => (
    <>
      <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 16 }}>
        Membres du Conseil d'administration de l'Institut Rousseau.
      </p>
      <MemberList section="ca" listKey="membres" addLabel="Ajouter un membre du CA"
        fields={memberFields} />
    </>
  );

  const renderDirections = () => (
    <>
      <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 16 }}>
        Directions d'études thématiques — chaque direction a un titre, une description et une liste de membres.
      </p>
      {['Écologie', 'Économie', 'Institutions', 'Social', 'International', 'Culture'].map(theme => {
        const key = theme.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return (
          <div key={theme} className="card mb-16" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, marginBottom: 8 }}>Direction — {theme}</h3>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12 }}>Titre de la direction</label>
              <input
                value={equipe?.directions?.[`${key}_titre`] || ''}
                onChange={(e) => handleChange('directions', `${key}_titre`, e.target.value)}
                placeholder={`Direction d'études ${theme}`}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12 }}>Description</label>
              <textarea
                value={equipe?.directions?.[`${key}_description`] || ''}
                onChange={(e) => handleChange('directions', `${key}_description`, e.target.value)}
                rows={3} placeholder="Cette direction travaille sur…"
              />
            </div>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Membres de la direction</label>
            <MemberList section="directions" listKey={`${key}_membres`} addLabel="Ajouter un membre"
              fields={[
                { key: 'prenom', label: 'Prénom', placeholder: 'Marie' },
                { key: 'nom', label: 'Nom', placeholder: 'Martin' },
                { key: 'role', label: 'Rôle', placeholder: 'Directrice d\'études' },
              ]} />
          </div>
        );
      })}
    </>
  );

  const renderConseilScientifique = () => (
    <>
      <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 16 }}>
        Membres du Conseil scientifique, organisés par domaine d'expertise.
      </p>
      {CS_CATEGORIES.map(cat => (
        <div key={cat.id} className="card mb-16" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>{cat.label}</h3>
          <MemberList section="conseil_scientifique" listKey={`${cat.id}_membres`} addLabel="Ajouter un expert"
            fields={[
              { key: 'prenom', label: 'Prénom', placeholder: 'Pierre' },
              { key: 'nom', label: 'Nom', placeholder: 'Durand' },
              { key: 'role', label: 'Titre / Affiliation', placeholder: 'Professeur, Université de…' },
              { key: 'description', label: 'Bio courte', type: 'textarea', placeholder: 'Spécialiste de…' },
              { key: 'photo', label: 'Photo (chemin)', placeholder: 'assets/images/equipe/pierre-durand.jpg' },
              { key: 'linkedin', label: 'LinkedIn (URL)', placeholder: 'https://www.linkedin.com/in/…' },
            ]} />
        </div>
      ))}
    </>
  );

  const renderEquipePermanente = () => (
    <>
      <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 16 }}>
        Salariés et collaborateurs permanents de l'Institut.
      </p>
      <MemberList section="equipe_permanente" listKey="membres" addLabel="Ajouter un membre"
        fields={memberFields} />
    </>
  );

  const renderPageSettings = () => (
    <>
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>En-tête de la page Équipe</h3>
        <div style={{ marginBottom: 12 }}>
          <label>Titre</label>
          <input value={equipe?.page_titre || ''} onChange={(e) => handleTopChange('page_titre', e.target.value)} placeholder="L'équipe" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Sous-titre</label>
          <textarea value={equipe?.page_description || ''} onChange={(e) => handleTopChange('page_description', e.target.value)} rows={3}
            placeholder="L'Institut Rousseau rassemble des chercheurs…" />
        </div>
      </div>
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Appel à l'action (bas de page)</h3>
        <div style={{ marginBottom: 12 }}>
          <label>Titre CTA</label>
          <input value={equipe?.cta_titre || ''} onChange={(e) => handleTopChange('cta_titre', e.target.value)} placeholder="Rejoignez l'Institut" />
        </div>
        <div>
          <label>Texte CTA</label>
          <textarea value={equipe?.cta_texte || ''} onChange={(e) => handleTopChange('cta_texte', e.target.value)} rows={2}
            placeholder="Vous êtes chercheur, universitaire…" />
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Équipe</h1>
          <p className="page-header-sub">CA, directions d'études, conseil scientifique, permanents</p>
        </div>
        <div className="flex-center gap-8">
          <ServiceBadge service="github" />
          {saveToSite && hasGitHub() && (
            <button className="btn btn-green" onClick={handleSave} disabled={saving}>
              {saving ? 'Publication…' : 'Publier'}
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        <div className="tab-group" style={{ flexWrap: 'wrap' }}>
          {SECTIONS.map((s) => (
            <button key={s.id} className={`tab-item${activeSection === s.id ? ' active' : ''}`}
              onClick={() => setActiveSection(s.id)}>
              {s.label}
            </button>
          ))}
        </div>

        {activeSection === 'ca' && renderCA()}
        {activeSection === 'directions' && renderDirections()}
        {activeSection === 'conseil_scientifique' && renderConseilScientifique()}
        {activeSection === 'equipe_permanente' && renderEquipePermanente()}
        {activeSection === 'page_settings' && renderPageSettings()}

        <div className="flex-wrap gap-8" style={{ marginTop: 24 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Sauvegarde…' : 'Sauvegarder tout'}
          </button>
        </div>
      </div>
    </>
  );
}
