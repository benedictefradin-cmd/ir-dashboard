import { useState } from 'react';
import ServiceBadge from '../components/shared/ServiceBadge';
import { hasGitHub } from '../services/github';

const TABS = [
  { id: 'menu', label: 'Menu principal' },
  { id: 'dropdowns', label: 'Sous-menus' },
  { id: 'cta', label: 'Boutons header' },
  { id: 'langues', label: 'Langues' },
  { id: 'footer_cols', label: 'Colonnes footer' },
  { id: 'footer_general', label: 'Footer général' },
  { id: 'reseaux', label: 'Réseaux sociaux' },
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

  // ─── Helper: liste dynamique ─────────────────────
  const DynList = ({ section, listKey, fields, addLabel }) => {
    const items = nav[section]?.[listKey] || [];
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
    const remove = (index) => handleChange(section, listKey, realItems.filter((_, i) => i !== index));
    const move = (index, dir) => {
      const updated = [...realItems];
      const t = index + dir;
      if (t < 0 || t >= updated.length) return;
      [updated[index], updated[t]] = [updated[t], updated[index]];
      handleChange(section, listKey, updated);
    };

    return (
      <>
        {realItems.map((item, i) => (
          <div key={i} className="card mb-8" style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button className="btn btn-outline btn-sm" onClick={() => move(i, -1)} disabled={i === 0} style={{ padding: '1px 5px', fontSize: 10 }}>{'\u25B2'}</button>
                <button className="btn btn-outline btn-sm" onClick={() => move(i, 1)} disabled={i === realItems.length - 1} style={{ padding: '1px 5px', fontSize: 10 }}>{'\u25BC'}</button>
              </div>
              {fields.map(f => (
                <input key={f.key} value={item[f.key] || ''} onChange={(e) => update(i, f.key, e.target.value)}
                  placeholder={f.placeholder || f.label} style={{ flex: f.flex || 1, fontSize: 13 }} />
              ))}
              <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)', padding: '4px 6px' }} onClick={() => remove(i)}>{'\u2715'}</button>
            </div>
          </div>
        ))}
        <button className="btn btn-outline" style={{ marginTop: 4, fontSize: 13 }} onClick={add}>+ {addLabel}</button>
      </>
    );
  };

  // ─── Menu principal ──────────────────────────
  const renderMenu = () => {
    const items = nav.menu?.items || [
      { label: 'Thématiques', url: '#', type: 'dropdown', visible: true },
      { label: 'Publications', url: '#', type: 'dropdown', visible: true },
      { label: 'Événements', url: 'evenements.html', type: 'link', visible: true },
      { label: 'Presse et médias', url: 'presse.html', type: 'link', visible: true },
      { label: 'L\'Institut', url: '#', type: 'dropdown', visible: true },
    ];

    const updateItem = (index, field, value) => {
      const updated = [...items];
      updated[index] = { ...updated[index], [field]: value };
      handleChange('menu', 'items', updated);
    };
    const moveItem = (index, dir) => {
      const updated = [...items];
      const t = index + dir;
      if (t < 0 || t >= updated.length) return;
      [updated[index], updated[t]] = [updated[t], updated[index]];
      handleChange('menu', 'items', updated);
    };
    const addItem = () => handleChange('menu', 'items', [...items, { label: '', url: '/', type: 'link', visible: true }]);
    const removeItem = (i) => handleChange('menu', 'items', items.filter((_, idx) => idx !== i));

    return (
      <>
        <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 16 }}>
          Liens principaux du header. Type "dropdown" = sous-menu déroulant (configurer dans l'onglet Sous-menus).
        </p>
        {items.map((item, i) => (
          <div key={i} className="card mb-8" style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button className="btn btn-outline btn-sm" onClick={() => moveItem(i, -1)} disabled={i === 0} style={{ padding: '2px 6px', fontSize: 10 }}>{'\u25B2'}</button>
                <button className="btn btn-outline btn-sm" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} style={{ padding: '2px 6px', fontSize: 10 }}>{'\u25BC'}</button>
              </div>
              <input type="checkbox" checked={item.visible !== false} onChange={(e) => updateItem(i, 'visible', e.target.checked)} />
              <input value={item.label || ''} onChange={(e) => updateItem(i, 'label', e.target.value)} placeholder="Label"
                style={{ flex: 2, opacity: item.visible === false ? 0.4 : 1 }} />
              <input value={item.url || ''} onChange={(e) => updateItem(i, 'url', e.target.value)} placeholder="URL"
                style={{ flex: 2, opacity: item.visible === false ? 0.4 : 1 }} />
              <select value={item.type || 'link'} onChange={(e) => updateItem(i, 'type', e.target.value)} style={{ width: 110 }}>
                <option value="link">Lien</option>
                <option value="dropdown">Dropdown</option>
              </select>
              <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => removeItem(i)}>{'\u2715'}</button>
            </div>
          </div>
        ))}
        <button className="btn btn-outline" style={{ marginTop: 8 }} onClick={addItem}>+ Ajouter</button>

        <div className="card" style={{ padding: 20, marginTop: 16 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Logo</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label>Chemin logo header</label>
              <input value={nav.menu?.logo_path || ''} onChange={(e) => handleChange('menu', 'logo_path', e.target.value)} placeholder="assets/images/logo.svg" />
            </div>
            <div>
              <label>Chemin logo footer (blanc)</label>
              <input value={nav.menu?.logo_footer_path || ''} onChange={(e) => handleChange('menu', 'logo_footer_path', e.target.value)} placeholder="assets/images/logo-white.svg" />
            </div>
            <div>
              <label>Texte alternatif</label>
              <input value={nav.menu?.logo_alt || ''} onChange={(e) => handleChange('menu', 'logo_alt', e.target.value)} placeholder="Institut Rousseau" />
            </div>
          </div>
        </div>
      </>
    );
  };

  // ─── Sous-menus (dropdowns) ──────────────────
  const renderDropdowns = () => {
    const DROPDOWN_DEFS = [
      {
        id: 'thematiques', label: 'Thématiques',
        defaults: [
          { label: 'Écologie', desc: 'Climat, biodiversité, énergie', url: 'thematique-ecologie.html' },
          { label: 'Économie', desc: 'Politique économique, fiscalité', url: 'thematique-economie.html' },
          { label: 'Institutions', desc: 'Gouvernance, démocratie', url: 'thematique-institutions.html' },
          { label: 'Social', desc: 'Protection sociale, éducation', url: 'thematique-social.html' },
          { label: 'International', desc: 'Géopolitique, Europe, diplomatie', url: 'thematique-international.html' },
          { label: 'Culture', desc: 'Débats, controverses, société', url: 'thematique-culture.html' },
        ],
      },
      {
        id: 'publications', label: 'Publications',
        defaults: [
          { label: 'Toutes les publications', desc: 'Notes, rapports, tribunes', url: 'publications.html' },
          { label: 'Points de vue', desc: 'Tribunes et opinions', url: 'points-de-vue.html' },
          { label: 'Road to Net Zero', desc: 'Rapport phare décarbonation', url: 'road-to-net-zero.html' },
        ],
      },
      {
        id: 'institut', label: 'L\'Institut',
        defaults: [
          { label: 'Notre projet', desc: 'Mission et convictions', url: 'le-projet.html' },
          { label: 'L\'équipe', desc: 'CA et directions d\'études', url: 'equipe.html' },
          { label: 'Nos experts', desc: 'Conseil scientifique', url: 'equipe.html#conseil-scientifique' },
          { label: 'Partenaires', desc: 'Nos collaborations', url: 'partenaires.html' },
        ],
      },
    ];

    return (
      <>
        <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 16 }}>
          Contenu des menus déroulants (dropdowns) du header.
        </p>
        {DROPDOWN_DEFS.map(dd => (
          <div key={dd.id} className="card mb-16" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Dropdown — {dd.label}</h3>
            <DynList section="dropdowns" listKey={`${dd.id}_items`} addLabel="Ajouter un sous-lien"
              fields={[
                { key: 'label', label: 'Label', placeholder: 'Label', flex: 2 },
                { key: 'desc', label: 'Description', placeholder: 'Description courte', flex: 2 },
                { key: 'url', label: 'URL', placeholder: 'page.html', flex: 2 },
              ]} />
          </div>
        ))}
      </>
    );
  };

  // ─── Boutons CTA du header ──────────────────
  const renderCTA = () => (
    <>
      <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 16 }}>
        Boutons d'action dans la barre de navigation (Newsletter, Adhérer, Faire un don).
      </p>
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Bouton Newsletter</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label>Texte</label><input value={nav.cta?.newsletter_label || ''} onChange={(e) => handleChange('cta', 'newsletter_label', e.target.value)} placeholder="Newsletter" /></div>
          <div><label>URL</label><input value={nav.cta?.newsletter_url || ''} onChange={(e) => handleChange('cta', 'newsletter_url', e.target.value)} placeholder="newsletter.html" /></div>
        </div>
      </div>
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Bouton Adhérer</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label>Texte</label><input value={nav.cta?.adhesion_label || ''} onChange={(e) => handleChange('cta', 'adhesion_label', e.target.value)} placeholder="Adhérer" /></div>
          <div><label>URL</label><input value={nav.cta?.adhesion_url || ''} onChange={(e) => handleChange('cta', 'adhesion_url', e.target.value)} placeholder="adhesion.html" /></div>
        </div>
      </div>
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Bouton Faire un don</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label>Texte</label><input value={nav.cta?.don_label || ''} onChange={(e) => handleChange('cta', 'don_label', e.target.value)} placeholder="Faire un don" /></div>
          <div><label>URL</label><input value={nav.cta?.don_url || ''} onChange={(e) => handleChange('cta', 'don_url', e.target.value)} placeholder="don.html" /></div>
        </div>
      </div>
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Recherche</h3>
        <div>
          <label>Texte aria-label du bouton recherche</label>
          <input value={nav.cta?.search_label || ''} onChange={(e) => handleChange('cta', 'search_label', e.target.value)} placeholder="Rechercher sur le site" />
        </div>
      </div>
    </>
  );

  // ─── Langues ─────────────────────────────────
  const renderLangues = () => (
    <>
      <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 16 }}>
        Langues disponibles dans le sélecteur de langue du header. Le site supporte le multilingue via data-i18n.
      </p>
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Langues disponibles</h3>
        <DynList section="langues" listKey="items" addLabel="Ajouter une langue"
          fields={[
            { key: 'code', label: 'Code', placeholder: 'fr' },
            { key: 'label', label: 'Label', placeholder: 'Français' },
          ]} />
      </div>
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Hreflang</h3>
        <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 8 }}>
          Balises hreflang pour le SEO multilingue (indiquent aux moteurs de recherche les versions linguistiques).
        </p>
        <DynList section="langues" listKey="hreflang" addLabel="Ajouter un hreflang"
          fields={[
            { key: 'lang', label: 'Langue', placeholder: 'fr' },
            { key: 'url', label: 'URL', placeholder: 'https://institut-rousseau.fr/' },
          ]} />
      </div>
    </>
  );

  // ─── Colonnes footer ─────────────────────────
  const renderFooterCols = () => {
    const FOOTER_COLS = [
      { id: 'publications', label: 'Publications', defaults: ['Toutes les publications', 'Points de vue', 'Road to Net Zero', 'En librairie'] },
      { id: 'institut', label: 'L\'Institut', defaults: ['Notre projet', 'L\'équipe', 'Nos experts', 'Événements', 'Presse et médias', 'Partenaires'] },
      { id: 'contact', label: 'Contact', defaults: ['Nous écrire', 'Adhérer', 'Faire un don', 'Newsletter'] },
    ];

    return (
      <>
        <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 16 }}>
          Les 3 colonnes de liens dans le footer du site.
        </p>
        {FOOTER_COLS.map(col => (
          <div key={col.id} className="card mb-16" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, marginBottom: 8 }}>Colonne — {col.label}</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12 }}>Titre de la colonne</label>
              <input value={nav.footer_cols?.[`${col.id}_titre`] || ''} onChange={(e) => handleChange('footer_cols', `${col.id}_titre`, e.target.value)} placeholder={col.label} />
            </div>
            <DynList section="footer_cols" listKey={`${col.id}_liens`} addLabel="Ajouter un lien"
              fields={[
                { key: 'label', label: 'Label', placeholder: 'Label' },
                { key: 'url', label: 'URL', placeholder: 'page.html' },
              ]} />
          </div>
        ))}
      </>
    );
  };

  // ─── Footer général ──────────────────────────
  const renderFooterGeneral = () => {
    const footer = nav.footer || {};
    return (
      <>
        <div className="card mb-16" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Texte de marque (brand)</h3>
          <div style={{ marginBottom: 12 }}>
            <label>Description de l'Institut</label>
            <textarea value={footer.description || ''} onChange={(e) => handleChange('footer', 'description', e.target.value)} rows={3}
              placeholder="Think tank indépendant fondé en 2020…" />
          </div>
        </div>
        <div className="card mb-16" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Barre de copyright (bottom)</h3>
          <div style={{ marginBottom: 12 }}>
            <label>Copyright</label>
            <input value={footer.copyright || ''} onChange={(e) => handleChange('footer', 'copyright', e.target.value)}
              placeholder="© 2020-2026 Institut Rousseau. Association loi 1901. Tous droits réservés." />
          </div>
          <div>
            <label>Liens bas de footer</label>
            <DynList section="footer" listKey="bottom_links" addLabel="Ajouter un lien"
              fields={[
                { key: 'label', label: 'Label', placeholder: 'Mentions légales' },
                { key: 'url', label: 'URL', placeholder: 'mentions-legales.html' },
              ]} />
          </div>
        </div>
        <div className="card mb-16" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Coordonnées</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label>Adresse</label><input value={footer.adresse || ''} onChange={(e) => handleChange('footer', 'adresse', e.target.value)} placeholder="Paris, France" /></div>
            <div><label>Email</label><input value={footer.email || ''} onChange={(e) => handleChange('footer', 'email', e.target.value)} placeholder="contact@institut-rousseau.fr" /></div>
            <div><label>Téléphone</label><input value={footer.telephone || ''} onChange={(e) => handleChange('footer', 'telephone', e.target.value)} placeholder="+33 1 …" /></div>
          </div>
        </div>
      </>
    );
  };

  // ─── Réseaux sociaux ─────────────────────────
  const renderReseaux = () => {
    const reseaux = nav.reseaux || {};
    const NETWORKS = [
      { id: 'linkedin', label: 'LinkedIn', placeholder: 'https://www.linkedin.com/company/institrousseau/' },
      { id: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/institRousseau' },
      { id: 'youtube', label: 'YouTube', placeholder: 'https://www.youtube.com/@InstitutRousseau' },
      { id: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/InstitutRousseau' },
      { id: 'telegram', label: 'Telegram', placeholder: 'https://t.me/InstitutRousseau' },
      { id: 'twitter', label: 'Twitter / X', placeholder: 'https://twitter.com/InstitRousseau' },
    ];

    return (
      <>
        <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 16 }}>
          Liens vers les réseaux sociaux (affichés dans le footer et les pages Contact/Newsletter).
        </p>
        {NETWORKS.map((sn) => (
          <div key={sn.id} className="card mb-8" style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 13, minWidth: 100 }}>{sn.label}</span>
              <input value={reseaux[sn.id] || ''} style={{ flex: 1 }}
                onChange={(e) => {
                  setContenu((prev) => ({
                    ...prev,
                    navigation: {
                      ...(prev?.navigation || {}),
                      reseaux: { ...((prev?.navigation || {}).reseaux || {}), [sn.id]: e.target.value },
                    },
                  }));
                }}
                placeholder={sn.placeholder} />
            </div>
          </div>
        ))}
      </>
    );
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Navigation & Footer</h1>
          <p className="page-header-sub">Header, menus, dropdowns, boutons CTA, langues, footer, réseaux</p>
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
          {TABS.map((tab) => (
            <button key={tab.id} className={`tab-item${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'menu' && renderMenu()}
        {activeTab === 'dropdowns' && renderDropdowns()}
        {activeTab === 'cta' && renderCTA()}
        {activeTab === 'langues' && renderLangues()}
        {activeTab === 'footer_cols' && renderFooterCols()}
        {activeTab === 'footer_general' && renderFooterGeneral()}
        {activeTab === 'reseaux' && renderReseaux()}

        <div className="flex-wrap gap-8" style={{ marginTop: 24 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Sauvegarde…' : 'Sauvegarder tout'}
          </button>
        </div>
      </div>
    </>
  );
}
