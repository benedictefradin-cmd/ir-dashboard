import { useState, useRef, useMemo } from 'react';
import ServiceBadge from '../components/shared/ServiceBadge';
import Modal from '../components/shared/Modal';
import { COLORS, resolvePhotoUrl, normalizeName, namesMatch, findPublicationsForAuthor, canonicalPhotoPath } from '../utils/constants';
import { hasGitHub, githubUploadImage, saveAuthorsToGitHub } from '../services/github';

const CS_CATEGORIES = [
  { id: 'droit', label: 'Droit & Institutions', icon: '⚖️' },
  { id: 'economie', label: 'Économie', icon: '📈' },
  { id: 'idees', label: 'Idées & Société', icon: '💡' },
  { id: 'culture', label: 'Culture', icon: '🎨' },
  { id: 'ecologie', label: 'Écologie', icon: '🌿' },
  { id: 'international', label: 'International', icon: '🌍' },
];

const DIRECTION_THEMES = [
  { name: 'Écologie', icon: '🌿' },
  { name: 'Économie', icon: '📈' },
  { name: 'Institutions', icon: '🏛️' },
  { name: 'Social', icon: '🤝' },
  { name: 'International', icon: '🌍' },
  { name: 'Culture', icon: '🎨' },
];

function slugify(prenom, nom) {
  return `${prenom}-${nom}`.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ─── Shared avatar component ───
function Avatar({ photo, prenom, nom, size = 48 }) {
  const initials = (prenom || '?').charAt(0).toUpperCase();
  if (photo) {
    return (
      <div className="equipe-avatar" style={{ width: size, height: size }}>
        <img
          src={resolvePhotoUrl(photo)}
          alt={`${prenom} ${nom}`}
          onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.style.display = 'none'; }}
        />
      </div>
    );
  }
  return (
    <div className="equipe-avatar equipe-avatar-placeholder" style={{
      width: size, height: size, fontSize: size * 0.42,
    }}>
      {initials}
    </div>
  );
}

export default function Equipe({ contenu, setContenu, auteurs = [], setAuteurs, articles = [], toast, saveToSite, onTabChange }) {
  const [activeSection, setActiveSection] = useState('ca');
  const [saving, setSaving] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSection, setModalSection] = useState(null);
  const [modalListKey, setModalListKey] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [modalFields, setModalFields] = useState([]);
  const [modalTitle, setModalTitle] = useState('');
  const [modalHasPhoto, setModalHasPhoto] = useState(false);
  const [modalHasAuthorLink, setModalHasAuthorLink] = useState(false);

  const equipe = contenu?.equipe || {};

  // ─── Counts ───
  const countCA = (equipe?.ca?.membres || []).length;
  const countDirections = DIRECTION_THEMES.reduce((sum, t) => {
    const key = t.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return sum + (equipe?.directions?.[`${key}_membres`] || []).length;
  }, 0);
  const countCS = CS_CATEGORIES.reduce((sum, c) => sum + (equipe?.conseil_scientifique?.[`${c.id}_membres`] || []).length, 0);
  const countPerm = (equipe?.equipe_permanente?.membres || []).length;
  const totalMembers = countCA + countDirections + countCS + countPerm;

  const SECTIONS = [
    { id: 'ca', label: 'Conseil d\'administration', count: countCA, icon: '🏛️' },
    { id: 'directions', label: 'Directions d\'études', count: countDirections, icon: '📚' },
    { id: 'conseil_scientifique', label: 'Conseil scientifique', count: countCS, icon: '🔬' },
    { id: 'equipe_permanente', label: 'Équipe permanente', count: countPerm, icon: '👥' },
    { id: 'page_settings', label: 'En-tête de page', count: null, icon: '⚙️' },
  ];

  // ─── Find linked author ───
  const findLinkedAuthor = (membre) => {
    if (!membre) return null;
    if (membre.linkedAuthorId) return auteurs.find(a => a.id === membre.linkedAuthorId) || null;
    if (!membre.prenom || !membre.nom) return null;
    return auteurs.find(a => namesMatch(membre.prenom, membre.nom, a.firstName, a.lastName)) || null;
  };

  const getLinkedPublications = (auteur) => findPublicationsForAuthor(auteur, articles);

  // ─── Contenu updates ───
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
    setContenu((prev) => ({ ...prev, equipe: { ...(prev?.equipe || {}), [key]: value } }));
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

  // ─── Sync photo to linked author ───
  const syncPhotoToAuthor = async (authorId, photoPath) => {
    if (!authorId || !setAuteurs) return;
    const photoUrl = resolvePhotoUrl(photoPath);
    const updated = auteurs.map(a =>
      a.id === authorId ? { ...a, photo: photoUrl, photoPath } : a
    );
    setAuteurs(updated);
    if (hasGitHub()) {
      try { await saveAuthorsToGitHub(updated); } catch { /* silent */ }
      if (saveToSite) {
        try {
          await saveToSite('auteurs', updated.map(({ id, firstName, lastName, role, bio, photo, photoPath: pp, publications }) => ({
            id, firstName, lastName, role, bio, photo: pp || photo || '', publications: publications || 0,
          })), 'Sync photo auteur depuis Équipe');
        } catch { /* silent */ }
      }
    }
  };

  // ─── Create author from member ───
  const createAuthorFromMember = async (membre) => {
    if (!setAuteurs) return null;
    const slug = slugify(membre.prenom, membre.nom);
    if (auteurs.find(a => a.id === slug)) {
      toast('Un auteur avec ce nom existe déjà', 'error');
      return null;
    }
    const newAuthor = {
      id: slug, firstName: membre.prenom, lastName: membre.nom,
      name: `${membre.prenom} ${membre.nom}`, role: membre.role || '', titre: membre.role || '',
      bio: membre.description || '', photo: resolvePhotoUrl(membre.photo),
      photoPath: membre.photo || '', publications: 0,
    };
    const updated = [...auteurs, newAuthor];
    setAuteurs(updated);
    if (hasGitHub()) {
      try {
        await saveAuthorsToGitHub(updated);
        toast('Auteur créé et lié');
      } catch (err) { toast(`Erreur création auteur : ${err.message}`, 'error'); }
      if (saveToSite) {
        try {
          await saveToSite('auteurs', updated.map(({ id, firstName, lastName, role, bio, photo, photoPath: pp, publications }) => ({
            id, firstName, lastName, role, bio, photo: pp || photo || '', publications: publications || 0,
          })), `Création auteur depuis Équipe : ${membre.prenom} ${membre.nom}`);
        } catch { /* silent */ }
      }
    }
    return slug;
  };

  // ─── Open modal ───
  const openMemberModal = ({ section, listKey, index, fields, title, hasPhoto = false, hasAuthorLink = false }) => {
    setModalSection(section);
    setModalListKey(listKey);
    setEditingIndex(index);
    setModalFields(fields);
    setModalTitle(title);
    setModalHasPhoto(hasPhoto);
    setModalHasAuthorLink(hasAuthorLink);
    setModalOpen(true);
  };

  const getModalInitial = () => {
    if (editingIndex === null) {
      const empty = {};
      modalFields.forEach(f => { empty[f.key] = ''; });
      if (modalHasPhoto) empty.photo = '';
      if (modalHasAuthorLink) empty.linkedAuthorId = '';
      return empty;
    }
    return { ...(equipe?.[modalSection]?.[modalListKey] || [])[editingIndex] } || {};
  };

  const handleModalSave = async (formData, photoFile) => {
    const items = [...(equipe?.[modalSection]?.[modalListKey] || [])];
    let photoPath = formData.photo || '';

    if (photoFile && hasGitHub()) {
      try {
        const ext = photoFile.name.split('.').pop().toLowerCase() || 'jpg';
        photoPath = canonicalPhotoPath(formData.prenom, formData.nom, ext);
        const ghPath = photoPath.replace('assets/', '');
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(photoFile);
        });
        await githubUploadImage(ghPath, base64, `Photo équipe : ${formData.prenom} ${formData.nom}`);
        toast('Photo uploadée sur GitHub');
      } catch (err) {
        toast(`Erreur upload photo : ${err.message}`, 'error');
        return;
      }
    } else if (photoFile && !hasGitHub()) {
      toast('Token GitHub non configuré — photo non uploadée', 'error');
      return;
    }

    const updatedMember = { ...formData, photo: photoPath };

    if (editingIndex !== null) {
      items[editingIndex] = updatedMember;
    } else {
      items.push(updatedMember);
    }

    handleChange(modalSection, modalListKey, items);
    setModalOpen(false);

    if (modalHasAuthorLink && photoPath) {
      const linkedId = formData.linkedAuthorId || findLinkedAuthor(formData)?.id;
      if (linkedId) {
        await syncPhotoToAuthor(linkedId, photoPath);
        toast('Photo synchronisée avec l\'auteur');
      }
    }
  };

  // ─── Reorder / Delete ───
  const moveMember = (section, listKey, index, direction) => {
    const items = [...(equipe?.[section]?.[listKey] || [])];
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    handleChange(section, listKey, items);
  };

  const deleteMember = (section, listKey, index, name) => {
    if (!window.confirm(`Supprimer ${name} ? Cette action est irréversible.`)) return;
    handleChange(section, listKey, (equipe?.[section]?.[listKey] || []).filter((_, i) => i !== index));
  };

  // ─── Field configs ───
  const caFields = [
    { key: 'prenom', label: 'Prénom *', placeholder: 'Jean', required: true },
    { key: 'nom', label: 'Nom *', placeholder: 'Dupont', required: true },
    { key: 'role', label: 'Rôle / Fonction', placeholder: 'Président, Secrétaire général…' },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Bio courte…' },
    { key: 'linkedin', label: 'LinkedIn (URL)', placeholder: 'https://www.linkedin.com/in/…' },
  ];

  const fullMemberFields = [
    { key: 'prenom', label: 'Prénom *', placeholder: 'Marie', required: true },
    { key: 'nom', label: 'Nom *', placeholder: 'Martin', required: true },
    { key: 'role', label: 'Rôle / Fonction', placeholder: 'Directrice des études' },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Bio courte…' },
    { key: 'linkedin', label: 'LinkedIn (URL)', placeholder: 'https://www.linkedin.com/in/…' },
  ];

  const simpleMemberFields = [
    { key: 'prenom', label: 'Prénom *', placeholder: 'Marie', required: true },
    { key: 'nom', label: 'Nom *', placeholder: 'Martin', required: true },
    { key: 'role', label: 'Rôle', placeholder: 'Directrice d\'études' },
  ];

  // ─── Visual member card ───
  const MemberCard = ({ membre, index, section, listKey, total, fields, hasPhoto = false, hasAuthorLink = false }) => {
    const linked = hasAuthorLink ? findLinkedAuthor(membre) : null;
    const pubs = linked ? getLinkedPublications(linked) : [];
    const name = [membre.prenom, membre.nom].filter(Boolean).join(' ') || `#${index + 1}`;

    return (
      <div className="equipe-member-card">
        <div className="equipe-member-card-main">
          {/* Reorder */}
          <div className="equipe-reorder">
            <button className="equipe-reorder-btn" onClick={() => moveMember(section, listKey, index, -1)}
              disabled={index === 0} title="Monter">{'▲'}</button>
            <button className="equipe-reorder-btn" onClick={() => moveMember(section, listKey, index, 1)}
              disabled={index === total - 1} title="Descendre">{'▼'}</button>
          </div>

          {/* Avatar */}
          <Avatar photo={membre.photo} prenom={membre.prenom} nom={membre.nom} size={48} />

          {/* Info */}
          <div className="equipe-member-info">
            <div className="equipe-member-name">{name}</div>
            <div className="equipe-member-role">{membre.role || '—'}</div>
            <div className="equipe-member-badges">
              {hasAuthorLink && linked && (
                <span className="badge badge-green"
                  style={{ cursor: onTabChange ? 'pointer' : 'default' }}
                  onClick={(e) => { e.stopPropagation(); if (onTabChange) onTabChange('auteurs'); }}
                  title="Voir la fiche auteur">
                  Auteur lié ({pubs.length} pub{pubs.length !== 1 ? 's' : ''})
                </span>
              )}
              {hasAuthorLink && !linked && (
                <span className="badge badge-ochre">Pas d'auteur lié</span>
              )}
              {membre.linkedin && (
                <a href={membre.linkedin} target="_blank" rel="noopener noreferrer"
                  className="badge badge-sky" style={{ textDecoration: 'none' }}
                  onClick={e => e.stopPropagation()}>LinkedIn</a>
              )}
              {hasPhoto && membre.photo && <span className="badge badge-green">Photo</span>}
              {hasPhoto && !membre.photo && <span className="badge badge-ochre">Pas de photo</span>}
            </div>
          </div>

          {/* Actions */}
          <div className="equipe-member-actions">
            <button className="btn btn-outline btn-sm" onClick={() => openMemberModal({
              section, listKey, index, fields, hasPhoto, hasAuthorLink,
              title: `Modifier — ${name}`,
            })}>Modifier</button>
            <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }}
              onClick={() => deleteMember(section, listKey, index, name)}>Supprimer</button>
          </div>
        </div>

        {/* Publications preview for linked authors */}
        {linked && pubs.length > 0 && (
          <div className="equipe-member-pubs">
            <label>Publications ({pubs.length})</label>
            <div className="equipe-member-pubs-list">
              {pubs.slice(0, 3).map(pub => (
                <div key={pub.id} className="equipe-member-pub-item">
                  <span className={`badge badge-${pub.status === 'published' ? 'green' : 'ochre'}`}>
                    {pub.status === 'published' ? 'Publié' : 'Brouillon'}
                  </span>
                  <span className="equipe-member-pub-title">{pub.title}</span>
                </div>
              ))}
              {pubs.length > 3 && <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 2 }}>… et {pubs.length - 3} autre{pubs.length - 3 > 1 ? 's' : ''}</div>}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Section: CA ───
  const renderCA = () => {
    const membres = equipe?.ca?.membres || [];
    return (
      <div className="equipe-section-content">
        <div className="equipe-section-desc">
          Membres du Conseil d'administration — liés aux fiches auteurs pour synchroniser photos et publications.
        </div>
        <div className="equipe-member-list">
          {membres.map((membre, i) => (
            <MemberCard key={i} membre={membre} index={i} total={membres.length}
              section="ca" listKey="membres" fields={caFields}
              hasPhoto hasAuthorLink />
          ))}
        </div>
        <button className="btn btn-outline equipe-add-btn" onClick={() => openMemberModal({
          section: 'ca', listKey: 'membres', index: null, fields: caFields,
          title: 'Ajouter un membre du CA', hasPhoto: true, hasAuthorLink: true,
        })}>+ Ajouter un membre du CA</button>
      </div>
    );
  };

  // ─── Section: Directions ───
  const renderDirections = () => (
    <div className="equipe-section-content">
      <div className="equipe-section-desc">
        Directions d'études thématiques — chaque direction a un titre, une description et une liste de membres.
      </div>
      {DIRECTION_THEMES.map(theme => {
        const key = theme.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const listKey = `${key}_membres`;
        const membres = equipe?.directions?.[listKey] || [];
        return (
          <div key={theme.name} className="equipe-direction-card">
            <div className="equipe-direction-header">
              <span className="equipe-direction-icon">{theme.icon}</span>
              <h3 className="equipe-direction-title">
                Direction — {theme.name}
                <span className="badge badge-sky" style={{ marginLeft: 8 }}>{membres.length}</span>
              </h3>
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12 }}>Titre de la direction</label>
              <input value={equipe?.directions?.[`${key}_titre`] || ''}
                onChange={(e) => handleChange('directions', `${key}_titre`, e.target.value)}
                placeholder={`Direction d'études ${theme.name}`} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12 }}>Description</label>
              <textarea value={equipe?.directions?.[`${key}_description`] || ''}
                onChange={(e) => handleChange('directions', `${key}_description`, e.target.value)}
                rows={3} placeholder="Cette direction travaille sur…" />
            </div>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: 'block' }}>Membres de la direction</label>
            <div className="equipe-member-list">
              {membres.map((membre, i) => (
                <MemberCard key={i} membre={membre} index={i} total={membres.length}
                  section="directions" listKey={listKey} fields={fullMemberFields}
                  hasPhoto hasAuthorLink />
              ))}
            </div>
            <button className="btn btn-outline equipe-add-btn" onClick={() => openMemberModal({
              section: 'directions', listKey, index: null, fields: fullMemberFields,
              title: `Ajouter un membre — ${theme.name}`, hasPhoto: true, hasAuthorLink: true,
            })}>+ Ajouter un membre</button>
          </div>
        );
      })}
    </div>
  );

  // ─── Section: Conseil scientifique ───
  const renderConseilScientifique = () => (
    <div className="equipe-section-content">
      <div className="equipe-section-desc">
        Membres du Conseil scientifique, organisés par domaine d'expertise.
      </div>
      {CS_CATEGORIES.map(cat => {
        const listKey = `${cat.id}_membres`;
        const membres = equipe?.conseil_scientifique?.[listKey] || [];
        return (
          <div key={cat.id} className="equipe-direction-card">
            <div className="equipe-direction-header">
              <span className="equipe-direction-icon">{cat.icon}</span>
              <h3 className="equipe-direction-title">
                {cat.label}
                <span className="badge badge-sky" style={{ marginLeft: 8 }}>{membres.length}</span>
              </h3>
            </div>
            <div className="equipe-member-list">
              {membres.map((membre, i) => (
                <MemberCard key={i} membre={membre} index={i} total={membres.length}
                  section="conseil_scientifique" listKey={listKey} fields={fullMemberFields} hasPhoto hasAuthorLink />
              ))}
            </div>
            <button className="btn btn-outline equipe-add-btn" onClick={() => openMemberModal({
              section: 'conseil_scientifique', listKey, index: null, fields: fullMemberFields,
              title: `Ajouter un expert — ${cat.label}`, hasPhoto: true, hasAuthorLink: true,
            })}>+ Ajouter un expert</button>
          </div>
        );
      })}
    </div>
  );

  // ─── Section: Équipe permanente ───
  const renderEquipePermanente = () => {
    const membres = equipe?.equipe_permanente?.membres || [];
    return (
      <div className="equipe-section-content">
        <div className="equipe-section-desc">
          Salariés et collaborateurs permanents de l'Institut.
        </div>
        <div className="equipe-member-list">
          {membres.map((membre, i) => (
            <MemberCard key={i} membre={membre} index={i} total={membres.length}
              section="equipe_permanente" listKey="membres" fields={fullMemberFields} hasPhoto hasAuthorLink />
          ))}
        </div>
        <button className="btn btn-outline equipe-add-btn" onClick={() => openMemberModal({
          section: 'equipe_permanente', listKey: 'membres', index: null, fields: fullMemberFields,
          title: 'Ajouter un membre permanent', hasPhoto: true, hasAuthorLink: true,
        })}>+ Ajouter un membre</button>
      </div>
    );
  };

  // ─── Section: Page settings ───
  const renderPageSettings = () => (
    <div className="equipe-section-content">
      <div className="equipe-direction-card">
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
      <div className="equipe-direction-card">
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
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Équipe</h1>
          <p className="page-header-sub">{totalMembers} membre{totalMembers !== 1 ? 's' : ''} au total</p>
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
        {/* Stats bar */}
        <div className="equipe-stats-bar">
          {SECTIONS.filter(s => s.count !== null).map(s => (
            <button
              key={s.id}
              className={`equipe-stat-item${activeSection === s.id ? ' active' : ''}`}
              onClick={() => setActiveSection(s.id)}
            >
              <span className="equipe-stat-icon">{s.icon}</span>
              <span className="equipe-stat-count">{s.count}</span>
              <span className="equipe-stat-label">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Live-site banner */}
        <div className="equipe-site-banner">
          <span style={{ fontSize: 16 }}>&#127760;</span>
          <span>
            <strong>Lié au site en ligne</strong> — chaque modification publiée met à jour la page Équipe sur institut-rousseau.fr.
          </span>
        </div>

        {/* Section tabs */}
        <div className="tab-group" style={{ flexWrap: 'wrap' }}>
          {SECTIONS.map((s) => (
            <button key={s.id} className={`tab-item${activeSection === s.id ? ' active' : ''}`}
              onClick={() => setActiveSection(s.id)}>
              <span style={{ marginRight: 6 }}>{s.icon}</span>
              {s.label}
              {s.count !== null && (
                <span className="equipe-tab-count">{s.count}</span>
              )}
            </button>
          ))}
        </div>

        {activeSection === 'ca' && renderCA()}
        {activeSection === 'directions' && renderDirections()}
        {activeSection === 'conseil_scientifique' && renderConseilScientifique()}
        {activeSection === 'equipe_permanente' && renderEquipePermanente()}
        {activeSection === 'page_settings' && renderPageSettings()}

        <div className="equipe-footer-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Sauvegarde…' : 'Publier sur le site'}
          </button>
          <span style={{ fontSize: 12, color: COLORS.textLight, alignSelf: 'center' }}>
            Les modifications seront visibles sur institut-rousseau.fr après publication.
          </span>
        </div>
      </div>

      {/* ─── Unified member edit modal ─── */}
      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)} title={modalTitle}>
          <MemberEditForm
            key={`${modalSection}-${modalListKey}-${editingIndex ?? 'new'}`}
            initial={getModalInitial()}
            fields={modalFields}
            hasPhoto={modalHasPhoto}
            hasAuthorLink={modalHasAuthorLink}
            auteurs={auteurs}
            findLinkedAuthor={findLinkedAuthor}
            getLinkedPublications={getLinkedPublications}
            onSave={handleModalSave}
            onClose={() => setModalOpen(false)}
            onCreateAuthor={createAuthorFromMember}
            onTabChange={onTabChange}
            toast={toast}
            isEdit={editingIndex !== null}
          />
        </Modal>
      )}
    </>
  );
}

// ─── Unified Member Edit Form ───
function MemberEditForm({ initial, fields, hasPhoto, hasAuthorLink, auteurs, findLinkedAuthor, getLinkedPublications, onSave, onClose, onCreateAuthor, onTabChange, toast, isEdit }) {
  const [form, setForm] = useState({ ...initial });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(initial.photo ? resolvePhotoUrl(initial.photo) : null);
  const [uploading, setUploading] = useState(false);
  const [creatingAuthor, setCreatingAuthor] = useState(false);
  const fileInputRef = useRef(null);

  const effectiveLinked = useMemo(() => {
    if (!hasAuthorLink) return null;
    if (form.linkedAuthorId) return auteurs.find(a => a.id === form.linkedAuthorId) || null;
    return findLinkedAuthor(form);
  }, [form.prenom, form.nom, form.linkedAuthorId, auteurs, hasAuthorLink]);

  const autoDetected = hasAuthorLink && !form.linkedAuthorId && effectiveLinked;
  const effectivePubs = effectiveLinked ? getLinkedPublications(effectiveLinked) : [];

  const handlePhotoSelect = (file) => {
    if (!file.type.startsWith('image/')) { toast('Sélectionnez une image (JPG, PNG, WebP)', 'error'); return; }
    if (file.size > 2 * 1024 * 1024) { toast('La photo ne doit pas dépasser 2 Mo', 'error'); return; }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setForm(f => ({ ...f, photo: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const required = fields.filter(f => f.required);
    for (const f of required) {
      if (!form[f.key]?.trim()) {
        toast(`Le champ « ${f.label.replace(' *', '')} » est requis`, 'error');
        return;
      }
    }
    setUploading(true);
    const finalForm = { ...form };
    if (hasAuthorLink && !finalForm.linkedAuthorId && autoDetected) {
      finalForm.linkedAuthorId = autoDetected.id;
    }
    await onSave(finalForm, photoFile);
    setUploading(false);
  };

  const handleCreateAuthor = async () => {
    setCreatingAuthor(true);
    const authorId = await onCreateAuthor(form);
    if (authorId) setForm(f => ({ ...f, linkedAuthorId: authorId }));
    setCreatingAuthor(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      {fields.some(f => f.key === 'prenom') && fields.some(f => f.key === 'nom') ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {fields.filter(f => f.key === 'prenom' || f.key === 'nom').map(f => (
              <div key={f.key}>
                <label>{f.label}</label>
                <input value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder} required={f.required} />
              </div>
            ))}
          </div>
          {fields.filter(f => f.key !== 'prenom' && f.key !== 'nom').map(f => (
            <div key={f.key} style={{ marginBottom: 16 }}>
              <label>{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  rows={3} placeholder={f.placeholder} />
              ) : (
                <input value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder} />
              )}
            </div>
          ))}
        </>
      ) : (
        fields.map(f => (
          <div key={f.key} style={{ marginBottom: 16 }}>
            <label>{f.label}</label>
            {f.type === 'textarea' ? (
              <textarea value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                rows={3} placeholder={f.placeholder} />
            ) : (
              <input value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder} required={f.required} />
            )}
          </div>
        ))
      )}

      {hasPhoto && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 600, fontSize: 13 }}>Photo</label>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
            onChange={(e) => { if (e.target.files?.[0]) handlePhotoSelect(e.target.files[0]); }}
            style={{ display: 'none' }} />
          {photoPreview ? (
            <div className="photo-upload-preview">
              <img src={photoPreview} alt="Aperçu" onError={(e) => { e.target.style.display = 'none'; }} />
              <div className="photo-upload-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()}>Changer</button>
                <button type="button" className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={removePhoto}>Supprimer</button>
              </div>
            </div>
          ) : (
            <div className="photo-upload-zone" onClick={() => fileInputRef.current?.click()}>
              <span style={{ fontSize: 32, marginBottom: 4 }}>&#128247;</span>
              <span>Cliquez pour ajouter une photo</span>
              <span style={{ fontSize: 12, color: 'var(--text-light)' }}>JPG, PNG ou WebP — max 2 Mo</span>
            </div>
          )}
          {!hasGitHub() && (
            <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>Token GitHub requis pour stocker les photos (voir Config)</p>
          )}
          {effectiveLinked && (
            <p style={{ fontSize: 11, color: COLORS.green, marginTop: 4 }}>
              La photo sera synchronisée avec la fiche auteur « {effectiveLinked.firstName} {effectiveLinked.lastName} »
            </p>
          )}
        </div>
      )}

      {hasAuthorLink && (
        <div className="equipe-author-link-section">
          <label style={{ fontWeight: 600, fontSize: 13 }}>Auteur lié</label>
          {autoDetected && (
            <div style={{ padding: '8px 0', fontSize: 12, color: COLORS.green }}>
              Auteur détecté automatiquement : <strong>{autoDetected.firstName} {autoDetected.lastName}</strong>
            </div>
          )}
          <select value={form.linkedAuthorId || (autoDetected?.id || '')}
            onChange={e => setForm({ ...form, linkedAuthorId: e.target.value })} style={{ width: '100%', marginTop: 4 }}>
            <option value="">— Aucun auteur lié —</option>
            {auteurs.map(a => (
              <option key={a.id} value={a.id}>{a.firstName} {a.lastName} ({a.publications || 0} pub{(a.publications || 0) !== 1 ? 's' : ''})</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {!effectiveLinked && form.prenom && form.nom && (
              <button type="button" className="btn btn-outline btn-sm" onClick={handleCreateAuthor} disabled={creatingAuthor}>
                {creatingAuthor ? 'Création…' : `Créer « ${form.prenom} ${form.nom} » comme auteur`}
              </button>
            )}
            {effectiveLinked && onTabChange && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => { onClose(); onTabChange('auteurs'); }}>
                Voir la fiche auteur
              </button>
            )}
          </div>
        </div>
      )}

      {hasAuthorLink && effectiveLinked && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 600 }}>Publications liées ({effectivePubs.length})</label>
          {effectivePubs.length === 0 ? (
            <p style={{ fontSize: 13, color: COLORS.textLight, marginTop: 4 }}>Aucune publication liée à cet auteur.</p>
          ) : (
            <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
              {effectivePubs.map(pub => (
                <div key={pub.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span className={`badge badge-${pub.status === 'published' ? 'green' : pub.status === 'ready' ? 'sky' : 'ochre'}`} style={{ fontSize: 10, flexShrink: 0 }}>
                    {pub.status === 'published' ? 'Publié' : pub.status === 'ready' ? 'Prêt' : 'Brouillon'}
                  </span>
                  <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pub.title}</span>
                  {pub.date && <span style={{ fontSize: 11, color: COLORS.textLight, flexShrink: 0 }}>{pub.date}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={uploading}>Annuler</button>
        <button type="submit" className="btn btn-primary" disabled={uploading}>
          {uploading ? 'En cours…' : isEdit ? 'Mettre à jour' : 'Ajouter'}
        </button>
      </div>
    </form>
  );
}
