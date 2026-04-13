import { useState, useRef, useMemo } from 'react';
import ServiceBadge from '../components/shared/ServiceBadge';
import Modal from '../components/shared/Modal';
import { COLORS } from '../utils/constants';
import { hasGitHub, githubUploadImage, saveAuthorsToGitHub } from '../services/github';

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

export default function Equipe({ contenu, setContenu, auteurs = [], setAuteurs, articles = [], toast, saveToSite }) {
  const [activeSection, setActiveSection] = useState('ca');
  const [saving, setSaving] = useState(false);
  const [editingCA, setEditingCA] = useState(null); // index of CA member being edited
  const [caModal, setCaModal] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const equipe = contenu?.equipe || {};

  // ─── Helpers ───
  const normalize = (str) =>
    (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const slugify = (prenom, nom) =>
    `${prenom}-${nom}`.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // Find linked author for a CA member (by linkedAuthorId or name match)
  const findLinkedAuthor = (membre) => {
    if (!membre) return null;
    if (membre.linkedAuthorId) {
      return auteurs.find(a => a.id === membre.linkedAuthorId) || null;
    }
    // Fallback: match by name
    const fullName = normalize(`${membre.prenom} ${membre.nom}`);
    if (!fullName.trim()) return null;
    return auteurs.find(a => {
      const aName = normalize(`${a.firstName} ${a.lastName}`);
      return aName === fullName;
    }) || null;
  };

  // Get publications linked to an author
  const getLinkedPublications = (auteur) => {
    if (!auteur || !articles?.length) return [];
    const name = `${auteur.firstName} ${auteur.lastName}`.toLowerCase();
    if (!name.trim()) return [];
    return articles.filter(art =>
      art.author && art.author.toLowerCase().includes(name)
    );
  };

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

  // ─── Photo handling ───
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Veuillez sélectionner une image (JPG, PNG, WebP)', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast('La photo ne doit pas dépasser 2 Mo', 'error');
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Sync photo between team member and author ───
  const syncPhotoToAuthor = async (authorId, photoPath, photoUrl) => {
    if (!authorId || !setAuteurs) return;
    const updated = auteurs.map(a =>
      a.id === authorId ? { ...a, photo: photoUrl || photoPath, photoPath: photoPath } : a
    );
    setAuteurs(updated);
    if (hasGitHub()) {
      try {
        await saveAuthorsToGitHub(updated);
      } catch { /* silent */ }
      if (saveToSite) {
        try {
          await saveToSite('auteurs', updated.map(({ id, firstName, lastName, role, bio, photo, photoPath, publications }) => ({
            id, firstName, lastName, role, bio, photo: photoPath || photo || '', publications: publications || 0,
          })), `Sync photo auteur depuis Équipe`);
        } catch { /* silent */ }
      }
    }
  };

  // ─── CA Member Modal ───
  const openCAEdit = (index) => {
    const membres = equipe?.ca?.membres || [];
    setEditingCA(index);
    const m = index !== null ? membres[index] : null;
    setPhotoFile(null);
    setPhotoPreview(m?.photo || null);
    setCaModal(true);
  };

  const openCAAdd = () => {
    setEditingCA(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setCaModal(true);
  };

  const getCAForm = () => {
    if (editingCA === null) return { prenom: '', nom: '', role: '', description: '', photo: '', linkedin: '', linkedAuthorId: '' };
    const m = (equipe?.ca?.membres || [])[editingCA] || {};
    return { ...m };
  };

  const handleCASave = async (formData) => {
    const membres = [...(equipe?.ca?.membres || [])];
    let photoUrl = formData.photo || '';
    let photoPath = formData.photo || '';

    // Upload photo if new file selected
    if (photoFile && hasGitHub()) {
      setUploading(true);
      try {
        const slug = slugify(formData.prenom, formData.nom);
        const ext = photoFile.name.split('.').pop().toLowerCase() || 'jpg';
        const path = `images/equipe/${slug}.${ext}`;
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(photoFile);
        });
        const result = await githubUploadImage(path, base64, `Photo équipe : ${formData.prenom} ${formData.nom}`);
        photoUrl = result.url;
        photoPath = `assets/${path}`;
        toast('Photo uploadée sur GitHub');
      } catch (err) {
        toast(`Erreur upload photo : ${err.message}`, 'error');
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const updatedMember = {
      ...formData,
      photo: photoPath || photoUrl,
    };

    if (editingCA !== null) {
      membres[editingCA] = updatedMember;
    } else {
      membres.push(updatedMember);
    }

    handleChange('ca', 'membres', membres);
    setCaModal(false);

    // Sync photo to linked author
    const linkedId = formData.linkedAuthorId;
    if (linkedId && (photoFile || photoPath)) {
      await syncPhotoToAuthor(linkedId, photoPath, photoUrl);
      toast('Photo synchronisée avec l\'auteur');
    }

    // Auto-create author link if linking to an existing author
    if (linkedId) {
      const author = auteurs.find(a => a.id === linkedId);
      if (author && photoPath && !photoFile) {
        // If the CA member has a photo but no new upload, just ensure the link
      }
    }
  };

  // ─── Link/Unlink author ───
  const handleLinkAuthor = (caIndex, authorId) => {
    const membres = [...(equipe?.ca?.membres || [])];
    if (membres[caIndex]) {
      membres[caIndex] = { ...membres[caIndex], linkedAuthorId: authorId || '' };
      handleChange('ca', 'membres', membres);
    }
  };

  // ─── Create author from CA member ───
  const createAuthorFromCA = async (membre) => {
    if (!setAuteurs) return;
    const slug = slugify(membre.prenom, membre.nom);
    if (auteurs.find(a => a.id === slug)) {
      toast('Un auteur avec ce nom existe déjà', 'error');
      return null;
    }
    const newAuthor = {
      id: slug,
      firstName: membre.prenom,
      lastName: membre.nom,
      name: `${membre.prenom} ${membre.nom}`,
      role: membre.role || '',
      titre: membre.role || '',
      bio: membre.description || '',
      photo: membre.photo || '',
      photoPath: membre.photo || '',
      publications: 0,
    };
    const updated = [...auteurs, newAuthor];
    setAuteurs(updated);
    if (hasGitHub()) {
      try {
        await saveAuthorsToGitHub(updated);
        toast('Auteur créé et lié');
      } catch (err) {
        toast(`Erreur création auteur : ${err.message}`, 'error');
      }
      if (saveToSite) {
        try {
          await saveToSite('auteurs', updated.map(({ id, firstName, lastName, role, bio, photo, photoPath, publications }) => ({
            id, firstName, lastName, role, bio, photo: photoPath || photo || '', publications: publications || 0,
          })), `Création auteur depuis Équipe : ${membre.prenom} ${membre.nom}`);
        } catch { /* silent */ }
      }
    }
    return slug;
  };

  // ─── Generic MemberList (directions, CS, permanent) ───
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

  // ─── CA Section with author linking ───
  const renderCA = () => {
    const membres = equipe?.ca?.membres || [];

    return (
      <>
        <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 16 }}>
          Membres du Conseil d'administration — liés aux fiches auteurs pour synchroniser photos et publications.
        </p>

        {membres.map((membre, i) => {
          const linked = findLinkedAuthor(membre);
          const pubs = linked ? getLinkedPublications(linked) : [];

          return (
            <div key={i} className="card mb-8" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Reorder */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => {
                    const updated = [...membres];
                    if (i > 0) [updated[i], updated[i - 1]] = [updated[i - 1], updated[i]];
                    handleChange('ca', 'membres', updated);
                  }} disabled={i === 0} style={{ padding: '2px 6px', fontSize: 10 }}>{'\u25B2'}</button>
                  <button className="btn btn-outline btn-sm" onClick={() => {
                    const updated = [...membres];
                    if (i < membres.length - 1) [updated[i], updated[i + 1]] = [updated[i + 1], updated[i]];
                    handleChange('ca', 'membres', updated);
                  }} disabled={i === membres.length - 1} style={{ padding: '2px 6px', fontSize: 10 }}>{'\u25BC'}</button>
                </div>

                {/* Avatar */}
                {membre.photo ? (
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                    border: `2px solid ${COLORS.sky}`,
                  }}>
                    <img src={membre.photo.startsWith('http') ? membre.photo : `https://raw.githubusercontent.com/${import.meta.env.VITE_GITHUB_OWNER || 'benedictefradin-cmd'}/${import.meta.env.VITE_GITHUB_SITE_REPO || 'institut-rousseau'}/main/${membre.photo.replace('assets/', '')}`}
                      alt={`${membre.prenom} ${membre.nom}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                ) : (
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%', backgroundColor: COLORS.navy,
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, fontWeight: 700, fontFamily: "'Cormorant Garamond', serif", flexShrink: 0,
                  }}>
                    {(membre.prenom || '?').charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {membre.prenom || ''} {membre.nom || ''}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textLight }}>
                    {membre.role || 'Membre du CA'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    {linked ? (
                      <span className="badge badge-green" style={{ fontSize: 10 }}>
                        Auteur lié ({pubs.length} pub{pubs.length !== 1 ? 's' : ''})
                      </span>
                    ) : (
                      <span className="badge badge-ochre" style={{ fontSize: 10 }}>
                        Pas d'auteur lié
                      </span>
                    )}
                    {membre.linkedin && (
                      <a href={membre.linkedin} target="_blank" rel="noopener noreferrer"
                        className="badge badge-sky" style={{ fontSize: 10, textDecoration: 'none' }}
                        onClick={e => e.stopPropagation()}>
                        LinkedIn
                      </a>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => openCAEdit(i)}>
                    Modifier
                  </button>
                  <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }}
                    onClick={() => {
                      if (window.confirm(`Supprimer ${membre.prenom} ${membre.nom} du CA ?`)) {
                        handleChange('ca', 'membres', membres.filter((_, j) => j !== i));
                      }
                    }}>
                    Supprimer
                  </button>
                </div>
              </div>

              {/* Publications if linked */}
              {linked && pubs.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textLight }}>
                    Publications ({pubs.length})
                  </label>
                  <div style={{ maxHeight: 120, overflowY: 'auto', marginTop: 4 }}>
                    {pubs.slice(0, 5).map(pub => (
                      <div key={pub.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 12 }}>
                        <span className={`badge badge-${pub.status === 'published' ? 'green' : 'ochre'}`} style={{ fontSize: 9, flexShrink: 0 }}>
                          {pub.status === 'published' ? 'Publié' : 'Brouillon'}
                        </span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pub.title}
                        </span>
                      </div>
                    ))}
                    {pubs.length > 5 && (
                      <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 4 }}>
                        … et {pubs.length - 5} autre{pubs.length - 5 > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button className="btn btn-outline" style={{ marginTop: 8 }} onClick={openCAAdd}>
          + Ajouter un membre du CA
        </button>
      </>
    );
  };

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

      {caModal && (
        <Modal onClose={() => { setCaModal(false); removePhoto(); }} title={editingCA !== null ? 'Modifier le membre du CA' : 'Ajouter un membre du CA'}>
          <CAEditForm
            initial={getCAForm()}
            auteurs={auteurs}
            articles={articles}
            findLinkedAuthor={findLinkedAuthor}
            getLinkedPublications={getLinkedPublications}
            photoPreview={photoPreview}
            photoFile={photoFile}
            fileInputRef={fileInputRef}
            handlePhotoSelect={handlePhotoSelect}
            removePhoto={removePhoto}
            uploading={uploading}
            onSave={handleCASave}
            onClose={() => { setCaModal(false); removePhoto(); }}
            onCreateAuthor={createAuthorFromCA}
            toast={toast}
            isEdit={editingCA !== null}
          />
        </Modal>
      )}
    </>
  );
}

// ─── CA Edit Form (separate component to manage local state) ───
function CAEditForm({ initial, auteurs, articles, findLinkedAuthor, getLinkedPublications, photoPreview, photoFile, fileInputRef, handlePhotoSelect, removePhoto, uploading, onSave, onClose, onCreateAuthor, toast, isEdit }) {
  const [form, setForm] = useState({ ...initial });
  const [creatingAuthor, setCreatingAuthor] = useState(false);

  const linked = form.linkedAuthorId
    ? auteurs.find(a => a.id === form.linkedAuthorId)
    : findLinkedAuthor(form);

  const linkedPubs = linked ? getLinkedPublications(linked) : [];

  // Auto-detect linked author when name changes
  const autoDetected = useMemo(() => {
    if (form.linkedAuthorId) return null;
    const detected = findLinkedAuthor(form);
    return detected;
  }, [form.prenom, form.nom, form.linkedAuthorId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.prenom?.trim() || !form.nom?.trim()) {
      toast('Le prénom et le nom sont requis', 'error');
      return;
    }
    // If auto-detected, set the link
    const finalForm = { ...form };
    if (!finalForm.linkedAuthorId && autoDetected) {
      finalForm.linkedAuthorId = autoDetected.id;
    }
    onSave(finalForm);
  };

  const handleCreateAuthor = async () => {
    setCreatingAuthor(true);
    const authorId = await onCreateAuthor(form);
    if (authorId) {
      setForm(f => ({ ...f, linkedAuthorId: authorId }));
    }
    setCreatingAuthor(false);
  };

  const effectiveLinked = linked || autoDetected;
  const effectivePubs = effectiveLinked ? getLinkedPublications(effectiveLinked) : [];

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label>Prénom *</label>
          <input value={form.prenom || ''} onChange={e => setForm({ ...form, prenom: e.target.value })} placeholder="Prénom" required />
        </div>
        <div>
          <label>Nom *</label>
          <input value={form.nom || ''} onChange={e => setForm({ ...form, nom: e.target.value })} placeholder="Nom" required />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label>Rôle / Fonction</label>
        <input value={form.role || ''} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="Président, Secrétaire général…" />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label>Description</label>
        <textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Bio courte…" />
      </div>

      {/* Photo upload */}
      <div style={{ marginBottom: 16 }}>
        <label>Photo</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePhotoSelect}
          style={{ display: 'none' }}
        />
        {photoPreview || form.photo ? (
          <div className="photo-upload-preview">
            <img
              src={photoPreview || (form.photo?.startsWith('http') ? form.photo : `https://raw.githubusercontent.com/${import.meta.env.VITE_GITHUB_OWNER || 'benedictefradin-cmd'}/${import.meta.env.VITE_GITHUB_SITE_REPO || 'institut-rousseau'}/main/${(form.photo || '').replace('assets/', '')}`)}
              alt="Aperçu"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div className="photo-upload-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()}>
                Changer
              </button>
              <button type="button" className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => {
                removePhoto();
                setForm(f => ({ ...f, photo: '' }));
              }}>
                Supprimer
              </button>
            </div>
          </div>
        ) : (
          <div className="photo-upload-zone" onClick={() => fileInputRef.current?.click()}>
            <span style={{ fontSize: 32, marginBottom: 4 }}>&#128247;</span>
            <span>Cliquez pour télécharger une photo</span>
            <span style={{ fontSize: 12, color: 'var(--text-light)' }}>JPG, PNG ou WebP — max 2 Mo</span>
          </div>
        )}
        {effectiveLinked && (
          <p style={{ fontSize: 11, color: COLORS.green, marginTop: 4 }}>
            La photo sera synchronisée avec la fiche auteur "{effectiveLinked.firstName} {effectiveLinked.lastName}"
          </p>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label>LinkedIn (URL)</label>
        <input value={form.linkedin || ''} onChange={e => setForm({ ...form, linkedin: e.target.value })} placeholder="https://www.linkedin.com/in/…" />
      </div>

      {/* Author linking */}
      <div style={{ marginBottom: 16, padding: 12, backgroundColor: 'var(--bg-alt, #f8f9fa)', borderRadius: 8, border: '1px solid var(--border)' }}>
        <label style={{ fontWeight: 600, fontSize: 13 }}>Auteur lié</label>

        {autoDetected && !form.linkedAuthorId && (
          <div style={{ padding: '8px 0', fontSize: 12, color: COLORS.green }}>
            Auteur détecté automatiquement : <strong>{autoDetected.firstName} {autoDetected.lastName}</strong>
          </div>
        )}

        <select
          value={form.linkedAuthorId || (autoDetected?.id || '')}
          onChange={e => setForm({ ...form, linkedAuthorId: e.target.value })}
          style={{ width: '100%', marginTop: 4 }}
        >
          <option value="">— Aucun auteur lié —</option>
          {auteurs.map(a => (
            <option key={a.id} value={a.id}>
              {a.firstName} {a.lastName} ({a.publications || 0} pub{(a.publications || 0) !== 1 ? 's' : ''})
            </option>
          ))}
        </select>

        {!effectiveLinked && form.prenom && form.nom && (
          <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 8 }}
            onClick={handleCreateAuthor} disabled={creatingAuthor}>
            {creatingAuthor ? 'Création…' : `Créer "${form.prenom} ${form.nom}" comme auteur`}
          </button>
        )}
      </div>

      {/* Linked publications */}
      {effectiveLinked && (
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
                  <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pub.title}
                  </span>
                  {pub.date && (
                    <span style={{ fontSize: 11, color: COLORS.textLight, flexShrink: 0 }}>{pub.date}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={uploading}>Annuler</button>
        <button type="submit" className="btn btn-primary" disabled={uploading}>
          {uploading ? 'Upload en cours…' : isEdit ? 'Mettre à jour' : 'Ajouter'}
        </button>
      </div>
    </form>
  );
}
