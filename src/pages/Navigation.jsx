import { useState } from 'react';
import ServiceBadge from '../components/shared/ServiceBadge';
import { hasGitHub } from '../services/github';

const TABS = [
  { id: 'menu', label: 'Menu principal' },
  { id: 'footer', label: 'Footer' },
  { id: 'reseaux', label: 'Réseaux sociaux' },
  { id: 'mentions', label: 'Mentions légales' },
];

export default function Navigation({ contenu, setContenu, toast, saveToSite }) {
  const [activeTab, setActiveTab] = useState('menu');
  const [saving, setSaving] = useState(false);

  const nav = contenu?.navigation || {};

  const handleChange = (section, key, value) => {
    setContenu((prev) => ({
      ...prev,
      navigation: {
        ...(prev?.navigation || {}),
        [section]: {
          ...((prev?.navigation || {})[section] || {}),
          [key]: value,
        },
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
      await saveToSite('contenu', contenu, 'Mise à jour navigation/footer depuis le back-office');
    } finally {
      setSaving(false);
    }
  };

  // ─── Menu principal ──────────────────────────
  const renderMenu = () => {
    const items = nav.menu?.items || [
      { label: 'Accueil', url: '/', visible: true },
      { label: 'Publications', url: '/publications', visible: true },
      { label: 'Événements', url: '/evenements', visible: true },
      { label: 'Presse', url: '/presse', visible: true },
      { label: 'Le Projet', url: '/le-projet', visible: true },
      { label: 'Road to Net Zero', url: '/road-to-net-zero', visible: true },
      { label: 'Contact', url: '/contact', visible: true },
    ];

    const updateItem = (index, field, value) => {
      const updated = [...items];
      updated[index] = { ...updated[index], [field]: value };
      handleChange('menu', 'items', updated);
    };

    const moveItem = (index, direction) => {
      const updated = [...items];
      const target = index + direction;
      if (target < 0 || target >= updated.length) return;
      [updated[index], updated[target]] = [updated[target], updated[index]];
      handleChange('menu', 'items', updated);
    };

    const addItem = () => {
      handleChange('menu', 'items', [...items, { label: '', url: '/', visible: true }]);
    };

    const removeItem = (index) => {
      handleChange('menu', 'items', items.filter((_, i) => i !== index));
    };

    return (
      <>
        <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 16 }}>
          Gérez les liens du menu de navigation principal. Glissez pour réordonner, décochez pour masquer.
        </p>
        {items.map((item, i) => (
          <div key={i} className="card mb-8" style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button className="btn btn-outline btn-sm" onClick={() => moveItem(i, -1)} disabled={i === 0} style={{ padding: '2px 6px', fontSize: 11 }}>\u25B2</button>
                <button className="btn btn-outline btn-sm" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} style={{ padding: '2px 6px', fontSize: 11 }}>\u25BC</button>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', margin: 0, minWidth: 0 }}>
                <input
                  type="checkbox"
                  checked={item.visible !== false}
                  onChange={(e) => updateItem(i, 'visible', e.target.checked)}
                />
              </label>
              <input
                value={item.label || ''}
                onChange={(e) => updateItem(i, 'label', e.target.value)}
                placeholder="Label"
                style={{ flex: 1, opacity: item.visible === false ? 0.4 : 1 }}
              />
              <input
                value={item.url || ''}
                onChange={(e) => updateItem(i, 'url', e.target.value)}
                placeholder="/chemin"
                style={{ flex: 1, opacity: item.visible === false ? 0.4 : 1 }}
              />
              <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)', padding: '4px 8px' }} onClick={() => removeItem(i)}>
                \u2715
              </button>
            </div>
          </div>
        ))}
        <button className="btn btn-outline" style={{ marginTop: 8 }} onClick={addItem}>+ Ajouter un lien</button>

        {/* Logo alt text */}
        <div className="card" style={{ padding: 20, marginTop: 16 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Logo & branding</h3>
          <div style={{ marginBottom: 12 }}>
            <label>Texte alternatif du logo</label>
            <input
              value={nav.menu?.logo_alt || ''}
              onChange={(e) => handleChange('menu', 'logo_alt', e.target.value)}
              placeholder="Institut Rousseau — Laboratoire d'idées"
            />
          </div>
          <div>
            <label>Chemin du logo (header)</label>
            <input
              value={nav.menu?.logo_path || ''}
              onChange={(e) => handleChange('menu', 'logo_path', e.target.value)}
              placeholder="/images/logo.svg"
            />
          </div>
        </div>
      </>
    );
  };

  // ─── Footer ──────────────────────────────────
  const renderFooter = () => {
    const footer = nav.footer || {};

    const footerLinks = footer.liens || [{ label: '', url: '' }];

    const updateLink = (index, field, value) => {
      const updated = [...footerLinks];
      updated[index] = { ...updated[index], [field]: value };
      handleChange('footer', 'liens', updated);
    };

    const addLink = () => {
      handleChange('footer', 'liens', [...footerLinks, { label: '', url: '' }]);
    };

    const removeLink = (index) => {
      handleChange('footer', 'liens', footerLinks.filter((_, i) => i !== index));
    };

    return (
      <>
        <div className="card mb-16" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Texte du footer</h3>
          <div style={{ marginBottom: 12 }}>
            <label>Ligne de copyright</label>
            <input
              value={footer.copyright || ''}
              onChange={(e) => handleChange('footer', 'copyright', e.target.value)}
              placeholder="© 2024 Institut Rousseau. Tous droits réservés."
            />
          </div>
          <div>
            <label>Description courte</label>
            <textarea
              value={footer.description || ''}
              onChange={(e) => handleChange('footer', 'description', e.target.value)}
              rows={3}
              placeholder="L'Institut Rousseau est un laboratoire d'idées…"
            />
          </div>
        </div>

        <div className="card mb-16" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Liens du footer</h3>
          {footerLinks.map((link, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input value={link.label || ''} onChange={(e) => updateLink(i, 'label', e.target.value)} placeholder="Label" style={{ flex: 1 }} />
              <input value={link.url || ''} onChange={(e) => updateLink(i, 'url', e.target.value)} placeholder="/chemin" style={{ flex: 1 }} />
              <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => removeLink(i)}>\u2715</button>
            </div>
          ))}
          <button className="btn btn-outline" onClick={addLink}>+ Ajouter un lien</button>
        </div>

        <div className="card mb-16" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Coordonnées</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label>Adresse</label>
              <input value={footer.adresse || ''} onChange={(e) => handleChange('footer', 'adresse', e.target.value)} placeholder="Paris, France" />
            </div>
            <div>
              <label>Email de contact</label>
              <input value={footer.email || ''} onChange={(e) => handleChange('footer', 'email', e.target.value)} placeholder="contact@institut-rousseau.fr" />
            </div>
            <div>
              <label>Téléphone</label>
              <input value={footer.telephone || ''} onChange={(e) => handleChange('footer', 'telephone', e.target.value)} placeholder="+33 1 XX XX XX XX" />
            </div>
          </div>
        </div>
      </>
    );
  };

  // ─── Réseaux sociaux ─────────────────────────
  const renderReseaux = () => {
    const reseaux = nav.reseaux || {};
    const SOCIAL_NETWORKS = [
      { id: 'twitter', label: 'Twitter / X', placeholder: 'https://twitter.com/InstitutRousseau' },
      { id: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/institut-rousseau' },
      { id: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/InstitutRousseau' },
      { id: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@InstitutRousseau' },
      { id: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/institutroussseau' },
      { id: 'telegram', label: 'Telegram', placeholder: 'https://t.me/institutrouisseau' },
    ];

    return (
      <>
        <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 16 }}>
          Liens vers les réseaux sociaux, affichés dans le header et le footer du site.
        </p>
        {SOCIAL_NETWORKS.map((sn) => (
          <div key={sn.id} className="card mb-8" style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 13, minWidth: 100 }}>{sn.label}</span>
              <input
                value={reseaux[sn.id] || ''}
                onChange={(e) => {
                  setContenu((prev) => ({
                    ...prev,
                    navigation: {
                      ...(prev?.navigation || {}),
                      reseaux: {
                        ...((prev?.navigation || {}).reseaux || {}),
                        [sn.id]: e.target.value,
                      },
                    },
                  }));
                }}
                placeholder={sn.placeholder}
                style={{ flex: 1 }}
              />
            </div>
          </div>
        ))}
      </>
    );
  };

  // ─── Mentions légales ────────────────────────
  const renderMentions = () => {
    const mentions = nav.mentions || {};
    return (
      <>
        <div className="card mb-16" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Mentions légales</h3>
          <textarea
            value={mentions.texte || ''}
            onChange={(e) => {
              setContenu((prev) => ({
                ...prev,
                navigation: {
                  ...(prev?.navigation || {}),
                  mentions: {
                    ...((prev?.navigation || {}).mentions || {}),
                    texte: e.target.value,
                  },
                },
              }));
            }}
            rows={12}
            placeholder="Éditeur du site : Institut Rousseau…"
          />
        </div>
        <div className="card mb-16" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Crédits</h3>
          <textarea
            value={mentions.credits || ''}
            onChange={(e) => {
              setContenu((prev) => ({
                ...prev,
                navigation: {
                  ...(prev?.navigation || {}),
                  mentions: {
                    ...((prev?.navigation || {}).mentions || {}),
                    credits: e.target.value,
                  },
                },
              }));
            }}
            rows={4}
            placeholder="Conception et développement : …"
          />
        </div>
      </>
    );
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Navigation & Footer</h1>
          <p className="page-header-sub">Menus, liens, réseaux sociaux, mentions légales</p>
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

        {activeTab === 'menu' && renderMenu()}
        {activeTab === 'footer' && renderFooter()}
        {activeTab === 'reseaux' && renderReseaux()}
        {activeTab === 'mentions' && renderMentions()}

        <div className="flex-wrap gap-8" style={{ marginTop: 24 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Sauvegarde…' : 'Sauvegarder tout'}
          </button>
        </div>
      </div>
    </>
  );
}
