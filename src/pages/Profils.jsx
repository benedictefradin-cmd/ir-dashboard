import { useState, useMemo, useRef } from 'react';
import Modal from '../components/shared/Modal';
import ServiceBadge from '../components/shared/ServiceBadge';
import { SkeletonCard } from '../components/shared/SkeletonLoader';
import { COLORS, normalizeName, namesMatch, findPublicationsForAuthor, canonicalPhotoPath } from '../utils/constants';
import useDebounce from '../hooks/useDebounce';
import usePhoto from '../hooks/usePhoto';
import RepoPhoto from '../components/shared/RepoPhoto';
import { hasGitHub, githubUploadImage, saveAuthorsToGitHub } from '../services/github';

const emptyForm = { firstName: '', lastName: '', role: '', photo: '', bio: '', email: '' };

const avatarColors = [COLORS.navy, COLORS.sky, COLORS.terra, COLORS.ochre, COLORS.green];

const SORT_OPTIONS = [
  { value: 'alpha', label: 'A → Z' },
  { value: 'alpha-desc', label: 'Z → A' },
  { value: 'pubs', label: 'Publications ↓' },
  { value: 'recent', label: 'Récents d’abord' },
  { value: 'no-photo', label: 'Sans photo en premier' },
];

export default function Profils({ auteurs, setAuteurs, articles, contenu, setContenu, loading, toast, saveToSite, onTabChange }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('alpha');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const debouncedSearch = useDebounce(search, 150);

  // Photo existante (chargée via API auth pour repo privé) quand aucun nouveau fichier n'a été choisi
  const { url: existingPhotoUrl } = usePhoto(!photoFile && !photoPreview ? form.photo : '');
  const effectivePreview = photoPreview || existingPhotoUrl;

  const filtered = useMemo(() => {
    let list = [...auteurs];

    // Filter — tokens multiples (ex: "jean dup" matche "Jean Dupont")
    if (debouncedSearch) {
      const tokens = normalizeName(debouncedSearch).split(/\s+/).filter(Boolean);
      if (tokens.length) {
        list = list.filter(a => {
          const haystack = normalizeName(
            [a.firstName, a.lastName, a.name, a.role, a.titre, a.email].filter(Boolean).join(' ')
          );
          return tokens.every(t => haystack.includes(t));
        });
      }
    }

    // Sort
    list.sort((a, b) => {
      switch (sortBy) {
        case 'alpha':
          return (a.lastName || '').localeCompare(b.lastName || '', 'fr');
        case 'alpha-desc':
          return (b.lastName || '').localeCompare(a.lastName || '', 'fr');
        case 'pubs':
          return (getPublicationCount(b) - getPublicationCount(a)) || (a.lastName || '').localeCompare(b.lastName || '', 'fr');
        case 'recent':
          return (auteurs.indexOf(b) - auteurs.indexOf(a));
        case 'no-photo': {
          const aMissing = !a.photo && !a.photoPath ? 1 : 0;
          const bMissing = !b.photo && !b.photoPath ? 1 : 0;
          return (bMissing - aMissing) || (a.lastName || '').localeCompare(b.lastName || '', 'fr');
        }
        default:
          return 0;
      }
    });

    return list;
  }, [auteurs, debouncedSearch, sortBy, articles]);

  const getDisplayName = (a) => {
    if (a.firstName && a.lastName) return `${a.firstName} ${a.lastName}`;
    return a.name || '';
  };

  const getLinkedPublications = (auteur) => findPublicationsForAuthor(auteur, articles);

  const getPublicationCount = (auteur) => {
    const linked = getLinkedPublications(auteur);
    return linked.length || auteur.publications || 0;
  };

  const getInitial = (a) => {
    if (a.firstName) return a.firstName.charAt(0).toUpperCase();
    if (a.name) return a.name.charAt(0).toUpperCase();
    return '?';
  };

  const getAvatarColor = (index) => avatarColors[index % avatarColors.length];

  // Stats
  const totalPubs = useMemo(() => auteurs.reduce((sum, a) => sum + getPublicationCount(a), 0), [auteurs, articles]);
  const withPhoto = useMemo(() => auteurs.filter(a => a.photo).length, [auteurs]);
  const teamMembers = useMemo(() => auteurs.filter(a => getTeamRole(a)).length, [auteurs, contenu]);

  // ─── Team membership detection ───
  function getTeamRole(auteur) {
    if (!contenu?.equipe) return null;
    const eq = contenu.equipe;

    const matchInList = (list) =>
      (list || []).some(m => namesMatch(m.prenom, m.nom, auteur.firstName, auteur.lastName));

    if (matchInList(eq?.ca?.membres)) return 'Membre du CA';
    if (matchInList(eq?.equipe_permanente?.membres)) return 'Équipe permanente';
    if (eq?.directions) {
      for (const k of Object.keys(eq.directions)) {
        if (k.endsWith('_membres') && matchInList(eq.directions[k])) return 'Direction d’études';
      }
    }
    if (eq?.conseil_scientifique) {
      for (const k of Object.keys(eq.conseil_scientifique)) {
        if (k.endsWith('_membres') && matchInList(eq.conseil_scientifique[k])) return 'Conseil scientifique';
      }
    }
    return null;
  }

  // ─── Sync photo to all matching team members in contenu.equipe ───
  const syncPhotoToEquipe = (firstName, lastName, photoPath) => {
    if (!setContenu || !contenu?.equipe) return;
    if (!firstName || !lastName) return;

    let changed = false;
    const updated = JSON.parse(JSON.stringify(contenu));
    const eq = updated.equipe;

    const syncInList = (list) => {
      if (!Array.isArray(list)) return;
      list.forEach((m, i) => {
        if (namesMatch(m.prenom, m.nom, firstName, lastName) && m.photo !== photoPath) {
          list[i] = { ...m, photo: photoPath };
          changed = true;
        }
      });
    };

    syncInList(eq?.ca?.membres);
    syncInList(eq?.equipe_permanente?.membres);
    if (eq?.directions) {
      Object.keys(eq.directions).forEach(k => {
        if (k.endsWith('_membres')) syncInList(eq.directions[k]);
      });
    }
    if (eq?.conseil_scientifique) {
      Object.keys(eq.conseil_scientifique).forEach(k => {
        if (k.endsWith('_membres')) syncInList(eq.conseil_scientifique[k]);
      });
    }

    if (changed) {
      setContenu(updated);
      if (saveToSite) {
        saveToSite('contenu', updated, `Sync photo équipe : ${firstName} ${lastName}`).catch(() => {});
      }
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
    setForm(f => ({ ...f, photo: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ ...emptyForm });
    setPhotoPreview(null);
    setPhotoFile(null);
    setModalOpen(true);
  };

  const openEdit = (auteur) => {
    setEditId(auteur.id);
    setForm({
      firstName: auteur.firstName || (auteur.name || '').split(' ')[0] || '',
      lastName: auteur.lastName || (auteur.name || '').split(' ').slice(1).join(' ') || '',
      role: auteur.role || auteur.titre || '',
      photo: auteur.photoPath || auteur.photo || '',
      bio: auteur.bio || '',
      email: auteur.email || '',
    });
    // La preview sera gérée par le modal via le hook usePhoto (form.photo).
    setPhotoPreview(null);
    setPhotoFile(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast('Le prénom et le nom sont requis', 'error');
      return;
    }

    const slug = `${form.firstName}-${form.lastName}`.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    let photoUrl = form.photo;
    let uploadedPath = null;

    // Upload photo to GitHub
    if (photoFile && hasGitHub()) {
      setUploading(true);
      try {
        const ext = photoFile.name.split('.').pop().toLowerCase() || 'jpg';
        const folder = getTeamRole({ firstName: form.firstName, lastName: form.lastName }) ? 'equipe' : 'auteurs';
        uploadedPath = canonicalPhotoPath(form.firstName, form.lastName, ext, folder);
        const ghPath = uploadedPath.replace('assets/', '');
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(photoFile);
        });
        const result = await githubUploadImage(ghPath, base64, `Photo profil : ${form.firstName} ${form.lastName}`);
        photoUrl = result.url;
        toast('Photo uploadée sur GitHub');
      } catch (err) {
        toast(`Erreur upload photo : ${err.message}`, 'error');
        setUploading(false);
        return;
      }
      setUploading(false);
    } else if (photoFile && !hasGitHub()) {
      toast('Token GitHub non configuré — photo non uploadée', 'error');
      setUploading(false);
      return;
    }

    const auteurData = {
      id: editId || slug,
      firstName: form.firstName,
      lastName: form.lastName,
      name: `${form.firstName} ${form.lastName}`,
      role: form.role,
      titre: form.role,
      photo: photoUrl,
      bio: form.bio,
      email: form.email,
      publications: editId ? (auteurs.find(a => a.id === editId)?.publications || 0) : 0,
    };

    const oldAuteur = editId ? auteurs.find(a => a.id === editId) : null;
    const photoChanged = oldAuteur ? oldAuteur.photo !== photoUrl : !!photoUrl;

    let updatedList;
    if (editId) {
      updatedList = auteurs.map(a => a.id === editId ? { ...a, ...auteurData } : a);
      setAuteurs(updatedList);
      toast('Profil mis à jour');
    } else {
      updatedList = [...auteurs, auteurData];
      setAuteurs(updatedList);
      toast('Profil ajouté');
    }
    setModalOpen(false);

    // Persist to GitHub
    if (hasGitHub()) {
      try {
        await saveAuthorsToGitHub(updatedList);
        toast('authors.json mis à jour sur GitHub');
      } catch (err) {
        toast(`Erreur sync GitHub : ${err.message}`, 'error');
      }

      if (saveToSite) {
        try {
          await saveToSite('auteurs', updatedList.map(({ id, firstName, lastName, role, bio, photo, photoPath, publications }) => ({
            id, firstName, lastName, role, bio, photo: photoPath || photo || '', publications: publications || 0,
          })), `Mise à jour profil : ${form.firstName} ${form.lastName}`);
        } catch { /* silent */ }
      }
    }

    // Sync photo to team members if photo changed
    if (photoChanged && photoUrl) {
      const pathForEquipe = uploadedPath || (photoUrl.startsWith('http') ? '' : photoUrl);
      if (pathForEquipe) {
        syncPhotoToEquipe(form.firstName, form.lastName, pathForEquipe);
      }
    }
  };

  const handleDelete = async (auteur) => {
    if (!window.confirm(`Supprimer ${getDisplayName(auteur)} ? Cette action est irréversible.`)) return;
    const updatedList = auteurs.filter(a => a.id !== auteur.id);
    setAuteurs(updatedList);
    setModalOpen(false);
    toast('Profil supprimé');
    if (hasGitHub()) {
      try { await saveAuthorsToGitHub(updatedList); } catch { /* silent */ }
      if (saveToSite) {
        try {
          await saveToSite('auteurs', updatedList.map(({ id, firstName, lastName, role, bio, photo, photoPath, publications }) => ({
            id, firstName, lastName, role, bio, photo: photoPath || photo || '', publications: publications || 0,
          })), `Suppression profil : ${getDisplayName(auteur)}`);
        } catch { /* silent */ }
      }
    }
  };

  // Publications for the author being edited
  const editingAuteur = editId ? auteurs.find(a => a.id === editId) : null;
  const linkedPubs = editingAuteur ? getLinkedPublications(editingAuteur) : [];

  if (loading) {
    return (
      <>
        <div className="page-header"><h1>Profils</h1></div>
        <div className="page-body">
          <div className="grid grid-3">{[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Profils</h1>
          <p className="page-header-sub">{auteurs.length} profil{auteurs.length !== 1 ? 's' : ''} enregistré{auteurs.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex-center gap-8">
          <ServiceBadge service="notion" />
          {saveToSite && hasGitHub() && (
            <button className="btn btn-green" onClick={() => saveToSite('auteurs', auteurs.map(({ id, firstName, lastName, role, bio, photo, photoPath, publications }) => ({ id, firstName, lastName, role, bio, photo: photoPath || photo || '', publications: publications || 0 })))}>
              Publier tout sur le site
            </button>
          )}
          <button className="btn btn-primary" onClick={openAdd}>+ Ajouter un profil</button>
        </div>
      </div>

      <div className="page-body">
        {/* Stats bar */}
        <div className="auteur-stats-bar">
          <div className="auteur-stat">
            <span className="auteur-stat-value">{auteurs.length}</span>
            <span className="auteur-stat-label">Profils</span>
          </div>
          <div className="auteur-stat-divider" />
          <div className="auteur-stat">
            <span className="auteur-stat-value">{totalPubs}</span>
            <span className="auteur-stat-label">Publications</span>
          </div>
          <div className="auteur-stat-divider" />
          <div className="auteur-stat">
            <span className="auteur-stat-value">{withPhoto}</span>
            <span className="auteur-stat-label">Avec photo</span>
          </div>
          <div className="auteur-stat-divider" />
          <div className="auteur-stat">
            <span className="auteur-stat-value">{teamMembers}</span>
            <span className="auteur-stat-label">Membres équipe</span>
          </div>
        </div>

        {/* Search + Sort */}
        <div className="auteur-toolbar">
          <div className="search-input" style={{ flex: 1, maxWidth: 'none' }}>
            <span className="search-icon">{'\u{1F50D}'}</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par prénom, nom ou fonction…"
              style={{ width: '100%', maxWidth: 'none' }}
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Effacer"
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-light)' }}
              >
                ×
              </button>
            )}
          </div>
          <select
            className="auteur-sort-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">&#128100;</div>
            <p>Aucun profil trouvé.</p>
            {debouncedSearch && (
              <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => setSearch('')}>
                Effacer la recherche
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-3 grid-mobile-2">
            {filtered.map((auteur, i) => {
              const pubCount = getPublicationCount(auteur);
              const teamRole = getTeamRole(auteur);
              return (
                <div
                  className="auteur-card-v2"
                  key={auteur.id}
                  onClick={() => openEdit(auteur)}
                >
                  {/* Photo or initial */}
                  <div className="auteur-card-photo">
                    <RepoPhoto
                      photo={auteur.photoPath || auteur.photo}
                      alt={getDisplayName(auteur)}
                      fallback={
                        <div
                          className="auteur-card-initials"
                          style={{ backgroundColor: getAvatarColor(i), display: 'flex' }}
                        >
                          {getInitial(auteur)}
                        </div>
                      }
                    />
                  </div>

                  {/* Info */}
                  <div className="auteur-card-body">
                    <h3 className="auteur-card-name">{getDisplayName(auteur)}</h3>
                    {(auteur.role || auteur.titre) && (
                      <p className="auteur-card-role">{auteur.role || auteur.titre}</p>
                    )}
                    <div className="auteur-card-badges">
                      {pubCount > 0 && (
                        <span className="badge badge-sky">
                          {pubCount} pub{pubCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {teamRole && (
                        <span
                          className="badge badge-green"
                          onClick={(e) => { e.stopPropagation(); if (onTabChange) onTabChange('equipe'); }}
                          title="Voir dans Équipe"
                          style={{ cursor: onTabChange ? 'pointer' : 'default' }}
                        >
                          {teamRole}
                        </span>
                      )}
                      {!auteur.photo && !auteur.photoPath && (
                        <span
                          className="badge badge-ochre"
                          style={{ cursor: 'pointer' }}
                          title="Cliquer pour ajouter une photo"
                          onClick={(e) => { e.stopPropagation(); openEdit(auteur); setTimeout(() => fileInputRef.current?.click(), 100); }}
                        >
                          + Photo
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)} title={editId ? 'Modifier le profil' : 'Ajouter un profil'} size="lg">
          <form onSubmit={handleSubmit}>
            {/* Photo preview at top of modal */}
            <div className="auteur-modal-header">
              <div className="auteur-modal-avatar">
                {effectivePreview ? (
                  <img src={effectivePreview} alt="Aperçu" />
                ) : (
                  <div className="auteur-modal-initials" style={{ backgroundColor: COLORS.navy }}>
                    {form.firstName ? form.firstName.charAt(0).toUpperCase() : '?'}
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'Cormorant Garamond', serif", color: COLORS.navy }}>
                  {form.firstName || form.lastName ? `${form.firstName} ${form.lastName}`.trim() : 'Nouveau profil'}
                </div>
                {form.role && <div style={{ fontSize: 13, color: COLORS.textLight, marginTop: 2 }}>{form.role}</div>}
                {editingAuteur && getTeamRole(editingAuteur) && (
                  <span className="badge badge-green" style={{ fontSize: 10, marginTop: 6 }}>{getTeamRole(editingAuteur)}</span>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label>Prénom *</label>
                <input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="Prénom" required />
              </div>
              <div>
                <label>Nom *</label>
                <input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="Nom" required />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label>Titre / Fonction *</label>
              <input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="Ex: Secrétaire générale de la CNCDH" required />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label>Photo</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoSelect}
                style={{ display: 'none' }}
              />
              {effectivePreview ? (
                <div className="photo-upload-preview">
                  <img src={effectivePreview} alt="Aperçu" />
                  <div className="photo-upload-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()}>
                      Changer
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={removePhoto}>
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
              {!hasGitHub() && (
                <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                  Token GitHub requis pour stocker les photos (voir Paramètres)
                </p>
              )}
              {editingAuteur && getTeamRole(editingAuteur) && (
                <p style={{ fontSize: 11, color: COLORS.green, marginTop: 4 }}>
                  La photo sera synchronisée avec la fiche équipe ({getTeamRole(editingAuteur)})
                </p>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label>Biographie (max 200 car.)</label>
              <textarea
                value={form.bio}
                onChange={e => setForm({ ...form, bio: e.target.value.slice(0, 200) })}
                rows={4}
                placeholder="Courte biographie…"
                maxLength={200}
              />
              <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>{(form.bio || '').length} / 200</p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label>Email (optionnel, non affiché)</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@exemple.fr" />
            </div>

            {/* Team membership info */}
            {editingAuteur && getTeamRole(editingAuteur) && (
              <div className="auteur-team-info">
                <span className="badge badge-green" style={{ fontSize: 10 }}>{getTeamRole(editingAuteur)}</span>
                <span style={{ fontSize: 12 }}>Ce profil est aussi membre de l'équipe.</span>
                {onTabChange && (
                  <button type="button" className="btn btn-outline btn-sm" style={{ marginLeft: 'auto', fontSize: 11 }}
                    onClick={() => { setModalOpen(false); onTabChange('equipe'); }}>
                    Voir dans Équipe
                  </button>
                )}
              </div>
            )}

            {/* Publications liées */}
            {editId && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 600 }}>Publications liées ({linkedPubs.length})</label>
                {linkedPubs.length === 0 ? (
                  <p style={{ fontSize: 13, color: COLORS.textLight, marginTop: 4 }}>Aucune publication liée à ce profil.</p>
                ) : (
                  <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                    {linkedPubs.map(pub => (
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
              {editId && (
                <button
                  type="button"
                  className="btn btn-danger-outline"
                  onClick={() => handleDelete(editingAuteur)}
                  disabled={uploading}
                  style={{ marginRight: 'auto' }}
                >
                  Supprimer ce profil
                </button>
              )}
              <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)} disabled={uploading}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={uploading}>
                {uploading ? 'Upload en cours…' : editId ? 'Mettre à jour' : 'Ajouter'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
