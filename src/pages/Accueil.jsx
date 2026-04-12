import { useState } from 'react';
import ServiceBadge from '../components/shared/ServiceBadge';
import { triggerRebuild, hasDeployHook } from '../services/deploy';
import { hasGitHub } from '../services/github';

const SECTIONS = [
  { id: 'hero', label: 'Hero (Bannière principale)' },
  { id: 'citations', label: 'Citations mises en avant' },
  { id: 'apropos', label: 'À propos (bloc résumé)' },
  { id: 'chiffres', label: 'Chiffres clés' },
  { id: 'partenaires', label: 'Partenaires & Soutiens' },
  { id: 'cta', label: 'Appels à l\'action' },
];

export default function Accueil({ contenu, setContenu, toast, saveToSite }) {
  const [activeSection, setActiveSection] = useState('hero');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState({});

  const home = contenu?.accueil || {};

  const getValue = (key) => home[key] || '';

  const handleChange = (key, value) => {
    setContenu((prev) => ({
      ...prev,
      accueil: { ...(prev?.accueil || {}), [key]: value },
    }));
  };

  const handleSave = async () => {
    if (!saveToSite || !hasGitHub()) {
      toast('GitHub non configuré — allez dans Config', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveToSite('contenu', contenu, 'Mise à jour page d\'accueil depuis le back-office');
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

  const renderTextField = (key, label, rows = 6) => {
    const isPreview = preview[key];
    return (
      <div className="card mb-16" style={{ padding: 20 }}>
        <div className="flex-between mb-8">
          <h3 style={{ fontSize: 15 }}>{label}</h3>
          <button className="btn btn-outline btn-sm" onClick={() => togglePreview(key)}>
            {isPreview ? 'Éditer' : 'Aperçu'}
          </button>
        </div>
        {isPreview ? (
          <div
            style={{ padding: 16, background: 'var(--cream)', borderRadius: 8, fontSize: 14, lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(getValue(key)) }}
          />
        ) : (
          <textarea
            value={getValue(key)}
            onChange={(e) => handleChange(key, e.target.value)}
            rows={rows}
            placeholder={`Contenu pour ${label}…`}
          />
        )}
      </div>
    );
  };

  const renderInputField = (key, label, placeholder) => (
    <div style={{ marginBottom: 12 }}>
      <label>{label}</label>
      <input
        value={getValue(key)}
        onChange={(e) => handleChange(key, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  const renderHero = () => (
    <>
      {renderInputField('hero_titre', 'Titre principal', 'Ex: Institut Rousseau')}
      {renderInputField('hero_soustitre', 'Sous-titre', 'Ex: Laboratoire d\'idées pour la République')}
      {renderTextField('hero_accroche', 'Accroche / texte d\'introduction', 4)}
      {renderInputField('hero_image', 'Image de fond (chemin)', '/images/hero-bg.jpg')}
      {renderInputField('hero_bouton_texte', 'Texte du bouton CTA', 'Découvrir nos travaux')}
      {renderInputField('hero_bouton_lien', 'Lien du bouton CTA', '/publications')}
    </>
  );

  const renderCitations = () => {
    const citations = home.citations || [{ auteur: '', texte: '', fonction: '' }];

    const updateCitation = (index, field, value) => {
      const updated = [...citations];
      updated[index] = { ...updated[index], [field]: value };
      handleChange('citations', updated);
    };

    const addCitation = () => {
      handleChange('citations', [...citations, { auteur: '', texte: '', fonction: '' }]);
    };

    const removeCitation = (index) => {
      handleChange('citations', citations.filter((_, i) => i !== index));
    };

    return (
      <>
        {citations.map((cit, i) => (
          <div key={i} className="card mb-16" style={{ padding: 20 }}>
            <div className="flex-between mb-8">
              <h3 style={{ fontSize: 15 }}>Citation {i + 1}</h3>
              {citations.length > 1 && (
                <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => removeCitation(i)}>
                  Supprimer
                </button>
              )}
            </div>
            <textarea
              value={cit.texte || ''}
              onChange={(e) => updateCitation(i, 'texte', e.target.value)}
              rows={3}
              placeholder="Texte de la citation…"
              style={{ marginBottom: 8 }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input
                value={cit.auteur || ''}
                onChange={(e) => updateCitation(i, 'auteur', e.target.value)}
                placeholder="Auteur"
              />
              <input
                value={cit.fonction || ''}
                onChange={(e) => updateCitation(i, 'fonction', e.target.value)}
                placeholder="Fonction / titre"
              />
            </div>
          </div>
        ))}
        <button className="btn btn-outline" onClick={addCitation}>+ Ajouter une citation</button>
      </>
    );
  };

  const renderApropos = () => (
    <>
      {renderInputField('apropos_titre', 'Titre du bloc', 'Ex: Notre mission')}
      {renderTextField('apropos_texte', 'Texte de présentation', 6)}
      {renderInputField('apropos_lien_texte', 'Texte du lien', 'En savoir plus')}
      {renderInputField('apropos_lien_url', 'URL du lien', '/le-projet')}
    </>
  );

  const renderChiffres = () => {
    const chiffres = home.chiffres || [{ valeur: '', label: '' }];

    const updateChiffre = (index, field, value) => {
      const updated = [...chiffres];
      updated[index] = { ...updated[index], [field]: value };
      handleChange('chiffres', updated);
    };

    const addChiffre = () => {
      handleChange('chiffres', [...chiffres, { valeur: '', label: '' }]);
    };

    const removeChiffre = (index) => {
      handleChange('chiffres', chiffres.filter((_, i) => i !== index));
    };

    return (
      <>
        <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 12 }}>
          Chiffres affichés sur la page d'accueil (ex: "150+ publications", "30 chercheurs")
        </p>
        {chiffres.map((ch, i) => (
          <div key={i} className="card mb-16" style={{ padding: 16 }}>
            <div className="flex-between mb-8">
              <span style={{ fontSize: 13, fontWeight: 600 }}>Chiffre {i + 1}</span>
              {chiffres.length > 1 && (
                <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => removeChiffre(i)}>
                  Supprimer
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8 }}>
              <input
                value={ch.valeur || ''}
                onChange={(e) => updateChiffre(i, 'valeur', e.target.value)}
                placeholder="150+"
                style={{ fontWeight: 700, fontSize: 18, textAlign: 'center' }}
              />
              <input
                value={ch.label || ''}
                onChange={(e) => updateChiffre(i, 'label', e.target.value)}
                placeholder="publications"
              />
            </div>
          </div>
        ))}
        <button className="btn btn-outline" onClick={addChiffre}>+ Ajouter un chiffre</button>
      </>
    );
  };

  const renderPartenaires = () => {
    const partenaires = home.partenaires || [{ nom: '', logo: '', url: '' }];

    const updatePartenaire = (index, field, value) => {
      const updated = [...partenaires];
      updated[index] = { ...updated[index], [field]: value };
      handleChange('partenaires', updated);
    };

    const addPartenaire = () => {
      handleChange('partenaires', [...partenaires, { nom: '', logo: '', url: '' }]);
    };

    const removePartenaire = (index) => {
      handleChange('partenaires', partenaires.filter((_, i) => i !== index));
    };

    return (
      <>
        {partenaires.map((p, i) => (
          <div key={i} className="card mb-16" style={{ padding: 16 }}>
            <div className="flex-between mb-8">
              <span style={{ fontSize: 13, fontWeight: 600 }}>Partenaire {i + 1}</span>
              {partenaires.length > 1 && (
                <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => removePartenaire(i)}>
                  Supprimer
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <input value={p.nom || ''} onChange={(e) => updatePartenaire(i, 'nom', e.target.value)} placeholder="Nom" />
              <input value={p.logo || ''} onChange={(e) => updatePartenaire(i, 'logo', e.target.value)} placeholder="Chemin logo (images/partenaires/…)" />
              <input value={p.url || ''} onChange={(e) => updatePartenaire(i, 'url', e.target.value)} placeholder="URL du site" />
            </div>
          </div>
        ))}
        <button className="btn btn-outline" onClick={addPartenaire}>+ Ajouter un partenaire</button>
      </>
    );
  };

  const renderCTA = () => (
    <>
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Bloc CTA principal</h3>
        {renderInputField('cta_titre', 'Titre', 'Ex: Soutenez l\'Institut')}
        {renderTextField('cta_texte', 'Texte', 3)}
        {renderInputField('cta_bouton_texte', 'Texte du bouton', 'Nous soutenir')}
        {renderInputField('cta_bouton_lien', 'Lien', '/soutenir')}
      </div>
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Bloc Newsletter</h3>
        {renderInputField('newsletter_titre', 'Titre', 'Restez informé')}
        {renderTextField('newsletter_texte', 'Texte d\'invitation', 3)}
      </div>
    </>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Page d'accueil</h1>
          <p className="page-header-sub">Hero, citations, chiffres clés, partenaires</p>
        </div>
        <div className="flex-center gap-8">
          <ServiceBadge service="github" />
          {saveToSite && hasGitHub() && (
            <button className="btn btn-green" onClick={handleSave} disabled={saving}>
              {saving ? 'Publication…' : 'Publier sur le site'}
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        <div className="tab-group">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`tab-item${activeSection === s.id ? ' active' : ''}`}
              onClick={() => setActiveSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {activeSection === 'hero' && renderHero()}
        {activeSection === 'citations' && renderCitations()}
        {activeSection === 'apropos' && renderApropos()}
        {activeSection === 'chiffres' && renderChiffres()}
        {activeSection === 'partenaires' && renderPartenaires()}
        {activeSection === 'cta' && renderCTA()}

        <div className="flex-wrap gap-8" style={{ marginTop: 24 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Sauvegarde…' : 'Sauvegarder tout'}
          </button>
          <button className="btn btn-outline" onClick={async () => {
            if (!hasDeployHook()) { toast('Deploy hook non configuré', 'error'); return; }
            try { await triggerRebuild(); toast('Rebuild déclenché'); } catch (e) { toast(e.message, 'error'); }
          }}>Rebuild site</button>
        </div>
      </div>
    </>
  );
}
