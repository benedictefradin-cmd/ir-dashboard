import { useState } from 'react';
import ServiceBadge from '../components/shared/ServiceBadge';
import { hasGitHub } from '../services/github';
import { SITE_URL } from '../utils/constants';

const PAGES_SEO = [
  { id: 'accueil', label: 'Accueil', path: '/' },
  { id: 'publications', label: 'Publications', path: '/publications' },
  { id: 'evenements', label: 'Événements', path: '/evenements' },
  { id: 'presse', label: 'Presse', path: '/presse' },
  { id: 'le-projet', label: 'Le Projet', path: '/le-projet' },
  { id: 'road-to-net-zero', label: 'Road to Net Zero', path: '/road-to-net-zero' },
  { id: 'contact', label: 'Contact', path: '/contact' },
  { id: 'confidentialite', label: 'Confidentialité', path: '/confidentialite' },
];

const OG_TYPES = ['website', 'article', 'profile'];

export default function SEO({ contenu, setContenu, toast, saveToSite }) {
  const [activePage, setActivePage] = useState('accueil');
  const [saving, setSaving] = useState(false);
  const [previewCard, setPreviewCard] = useState(false);

  const seo = contenu?.seo || {};
  const pageSeo = seo[activePage] || {};

  const getValue = (key) => pageSeo[key] || '';

  const handleChange = (key, value) => {
    setContenu((prev) => ({
      ...prev,
      seo: {
        ...(prev?.seo || {}),
        [activePage]: {
          ...((prev?.seo || {})[activePage] || {}),
          [key]: value,
        },
      },
    }));
  };

  const handleGlobalChange = (key, value) => {
    setContenu((prev) => ({
      ...prev,
      seo: {
        ...(prev?.seo || {}),
        global: {
          ...((prev?.seo || {}).global || {}),
          [key]: value,
        },
      },
    }));
  };

  const globalSeo = seo.global || {};

  const handleSave = async () => {
    if (!saveToSite || !hasGitHub()) {
      toast('GitHub non configuré — allez dans Config', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveToSite('contenu', contenu, 'Mise à jour SEO depuis le back-office');
    } finally {
      setSaving(false);
    }
  };

  const titleLength = (getValue('title') || '').length;
  const descLength = (getValue('meta_description') || '').length;

  const renderSeoScore = () => {
    const checks = [
      { ok: titleLength >= 30 && titleLength <= 60, label: 'Titre (30-60 car.)', detail: `${titleLength} car.` },
      { ok: descLength >= 120 && descLength <= 160, label: 'Description (120-160 car.)', detail: `${descLength} car.` },
      { ok: !!getValue('og_image'), label: 'Image Open Graph définie' },
      { ok: !!getValue('canonical'), label: 'URL canonique définie' },
    ];
    const score = checks.filter(c => c.ok).length;
    const color = score === 4 ? 'var(--green)' : score >= 2 ? 'var(--ochre)' : 'var(--danger)';

    return (
      <div className="card mb-16" style={{ padding: 16 }}>
        <div className="flex-between mb-8">
          <h3 style={{ fontSize: 15 }}>Score SEO</h3>
          <span style={{ fontWeight: 700, color, fontSize: 18 }}>{score}/4</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {checks.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ color: c.ok ? 'var(--green)' : 'var(--danger)', fontWeight: 700 }}>
                {c.ok ? '\u2713' : '\u2717'}
              </span>
              <span>{c.label}</span>
              {c.detail && <span style={{ color: 'var(--text-light)', marginLeft: 'auto' }}>{c.detail}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const pageInfo = PAGES_SEO.find(p => p.id === activePage);
  const previewUrl = `${SITE_URL}${pageInfo?.path || '/'}`;

  const renderGooglePreview = () => {
    const title = getValue('title') || pageInfo?.label || '';
    const desc = getValue('meta_description') || '';
    return (
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Aperçu Google</h3>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16, maxWidth: 600 }}>
          <div style={{ fontSize: 18, color: '#1a0dab', fontFamily: 'Arial, sans-serif', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title || 'Titre de la page'}
          </div>
          <div style={{ fontSize: 13, color: '#006621', marginBottom: 4, fontFamily: 'Arial, sans-serif' }}>
            {previewUrl}
          </div>
          <div style={{ fontSize: 13, color: '#545454', fontFamily: 'Arial, sans-serif', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {desc || 'Description de la page…'}
          </div>
        </div>
      </div>
    );
  };

  const renderOGPreview = () => {
    const title = getValue('og_title') || getValue('title') || pageInfo?.label || '';
    const desc = getValue('og_description') || getValue('meta_description') || '';
    const image = getValue('og_image');
    return (
      <div className="card mb-16" style={{ padding: 20 }}>
        <div className="flex-between mb-8">
          <h3 style={{ fontSize: 15 }}>Aperçu Open Graph (réseaux sociaux)</h3>
          <button className="btn btn-outline btn-sm" onClick={() => setPreviewCard(!previewCard)}>
            {previewCard ? 'Masquer' : 'Afficher'}
          </button>
        </div>
        {previewCard && (
          <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden', maxWidth: 500 }}>
            <div style={{ height: 260, background: image ? `url(${image}) center/cover` : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {!image && <span style={{ color: '#999', fontSize: 13 }}>Aucune image OG</span>}
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 11, color: '#65676b', textTransform: 'uppercase' }}>institut-rousseau.fr</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1c1e21', marginTop: 4 }}>{title}</div>
              <div style={{ fontSize: 14, color: '#606770', marginTop: 4 }}>{desc}</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>SEO & Référencement</h1>
          <p className="page-header-sub">Meta descriptions, Open Graph, URLs canoniques</p>
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
        {/* Paramètres globaux */}
        <div className="card mb-16" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Paramètres globaux</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label>Nom du site</label>
              <input value={globalSeo.site_name || ''} onChange={(e) => handleGlobalChange('site_name', e.target.value)} placeholder="Institut Rousseau" />
            </div>
            <div>
              <label>Langue</label>
              <input value={globalSeo.lang || ''} onChange={(e) => handleGlobalChange('lang', e.target.value)} placeholder="fr" />
            </div>
            <div>
              <label>Image OG par défaut</label>
              <input value={globalSeo.default_og_image || ''} onChange={(e) => handleGlobalChange('default_og_image', e.target.value)} placeholder="/images/og-default.jpg" />
            </div>
            <div>
              <label>Twitter / X @handle</label>
              <input value={globalSeo.twitter_handle || ''} onChange={(e) => handleGlobalChange('twitter_handle', e.target.value)} placeholder="@InstitutRousseau" />
            </div>
          </div>
        </div>

        {/* Sélecteur de page */}
        <div className="tab-group" style={{ flexWrap: 'wrap' }}>
          {PAGES_SEO.map((p) => (
            <button
              key={p.id}
              className={`tab-item${activePage === p.id ? ' active' : ''}`}
              onClick={() => setActivePage(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {renderSeoScore()}
        {renderGooglePreview()}

        {/* Champs SEO par page */}
        <div className="card mb-16" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Balises SEO — {pageInfo?.label}</h3>
          <div style={{ marginBottom: 12 }}>
            <label>
              Titre (title) <span style={{ color: titleLength > 60 ? 'var(--danger)' : 'var(--text-light)', fontSize: 12 }}>{titleLength}/60</span>
            </label>
            <input
              value={getValue('title')}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Titre optimisé pour Google (30-60 car.)"
              style={{ borderColor: titleLength > 60 ? 'var(--danger)' : undefined }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>
              Meta description <span style={{ color: descLength > 160 ? 'var(--danger)' : 'var(--text-light)', fontSize: 12 }}>{descLength}/160</span>
            </label>
            <textarea
              value={getValue('meta_description')}
              onChange={(e) => handleChange('meta_description', e.target.value)}
              rows={3}
              placeholder="Description affichée dans Google (120-160 car.)"
              style={{ borderColor: descLength > 160 ? 'var(--danger)' : undefined }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>URL canonique</label>
            <input
              value={getValue('canonical')}
              onChange={(e) => handleChange('canonical', e.target.value)}
              placeholder={previewUrl}
            />
          </div>
          <div>
            <label>Mots-clés (séparés par des virgules)</label>
            <input
              value={getValue('keywords')}
              onChange={(e) => handleChange('keywords', e.target.value)}
              placeholder="institut, think tank, écologie, république, économie"
            />
          </div>
        </div>

        {/* Open Graph */}
        <div className="card mb-16" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Open Graph (réseaux sociaux)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label>Titre OG</label>
              <input value={getValue('og_title')} onChange={(e) => handleChange('og_title', e.target.value)} placeholder="Laisser vide = titre SEO" />
            </div>
            <div>
              <label>Type OG</label>
              <select value={getValue('og_type') || 'website'} onChange={(e) => handleChange('og_type', e.target.value)}>
                {OG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label>Description OG</label>
            <textarea
              value={getValue('og_description')}
              onChange={(e) => handleChange('og_description', e.target.value)}
              rows={2}
              placeholder="Laisser vide = meta description"
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <label>Image OG</label>
            <input
              value={getValue('og_image')}
              onChange={(e) => handleChange('og_image', e.target.value)}
              placeholder="/images/og-publications.jpg"
            />
          </div>
        </div>

        {renderOGPreview()}

        {/* Twitter Card */}
        <div className="card mb-16" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Twitter Card</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label>Type de carte</label>
              <select value={getValue('twitter_card') || 'summary_large_image'} onChange={(e) => handleChange('twitter_card', e.target.value)}>
                <option value="summary">summary</option>
                <option value="summary_large_image">summary_large_image</option>
              </select>
            </div>
            <div>
              <label>Titre Twitter</label>
              <input value={getValue('twitter_title')} onChange={(e) => handleChange('twitter_title', e.target.value)} placeholder="Laisser vide = titre OG" />
            </div>
          </div>
        </div>

        <div className="flex-wrap gap-8" style={{ marginTop: 24 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Sauvegarde…' : 'Sauvegarder tout'}
          </button>
        </div>
      </div>
    </>
  );
}
