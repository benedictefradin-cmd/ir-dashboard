import { useState, useMemo, useRef } from 'react';
import Modal from '../components/shared/Modal';
import ServiceBadge from '../components/shared/ServiceBadge';
import { SkeletonCard } from '../components/shared/SkeletonLoader';
import { COLORS, normalizeName, namesMatch, findPublicationsForAuthor, canonicalPhotoPath } from '../utils/constants';
import useDebounce from '../hooks/useDebounce';
import usePhoto from '../hooks/usePhoto';
import RepoPhoto from '../components/shared/RepoPhoto';
import PersonIllustration from '../components/shared/PersonIllustration';
import { hasGitHub, githubUploadImage, saveAuthorsToGitHub } from '../services/github';
import { useConfirm } from '../components/shared/ConfirmDialog';
import { humanizeError } from '../utils/errors';
import ResultsCount from '../components/shared/ResultsCount';

const emptyForm = {
  firstName: '', lastName: '', role: '', photo: '',
  bioCourte: '', bioLongue: '',
  email: '', linkedin: '', x: '', site: '',
  dateArrivee: '', actif: true,
};

// Sérialise un profil au format attendu côté repo site (data/auteurs.json).
// Ordre des clés stable pour des diffs git lisibles.
function serializeAuteur(a) {
  return {
    id: a.id,
    firstName: a.firstName || '',
    lastName: a.lastName || '',
    role: a.role || '',
    bio: a.bioCourte || a.bio || '',          // legacy : conservé pour rétrocompat assets/js/auteurs.js
    bioCourte: a.bioCourte || a.bio || '',
    bioLongue: a.bioLongue || '',
    photo: a.photoPath || a.photo || '',
    reseaux: {
      linkedin: a.reseaux?.linkedin || a.linkedin || '',
      x: a.reseaux?.x || a.x || a.twitter || '',
      site: a.reseaux?.site || a.site || a.website || '',
      email: a.reseaux?.email || a.email || '',
    },
    dateArrivee: a.dateArrivee || '',
    actif: a.actif === false ? false : true,
  };
}

const avatarColors = [COLORS.navy, COLORS.sky, COLORS.terra, COLORS.ochre, COLORS.green];

const SORT_OPTIONS = [
  { value: 'alpha', label: 'A → Z' },
  { value: 'alpha-desc', label: 'Z → A' },
  { value: 'pubs', label: 'Publications ↓' },
  { value: 'recent', label: 'Récents d’abord' },
  { value: 'no-photo', label: 'Sans photo en premier' },
];

export default function Profils({ auteurs, setAuteurs, articles, contenu, setContenu, loading, toast, saveToSite, onTabChange }) {
  const confirm = useConfirm();
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
      bioCourte: auteur.bioCourte || auteur.bio || '',
      bioLongue: auteur.bioLongue || '',
      email: auteur.reseaux?.email || auteur.email || '',
      linkedin: auteur.reseaux?.linkedin || '',
      x: auteur.reseaux?.x || '',
      site: auteur.reseaux?.site || '',
      dateArrivee: auteur.dateArrivee || '',
      actif: auteur.actif === false ? false : true,
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
      photoPath: uploadedPath || (photoUrl && !photoUrl.startsWith('http') ? photoUrl : (auteurs.find(a => a.id === editId)?.photoPath || '')),
      bioCourte: form.bioCourte,
      bioLongue: form.bioLongue,
      bio: form.bioCourte,                    // legacy mirror
      reseaux: {
        linkedin: form.linkedin || '',
        x: form.x || '',
        site: form.site || '',
        email: form.email || '',
      },
      email: form.email,                      // legacy mirror
      dateArrivee: form.dateArrivee || '',
      actif: form.actif === false ? false : true,
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
          await saveToSite('auteurs', updatedList.map(serializeAuteur),
            `Mise à jour profil : ${form.firstName} ${form.lastName}`);
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
    const name = getDisplayName(auteur);
    const pubsCount = findPublicationsForAuthor(auteur, articles).length;
    const ok = await confirm({
      title: 'Supprimer le profil',
      message: `Voulez-vous vraiment supprimer le profil de ${name} ?`,
      details: pubsCount > 0
        ? `Ce profil est lié à ${pubsCount} publication${pubsCount > 1 ? 's' : ''}. Les publications resteront sur le site, mais elles ne seront plus liées à l'auteur.`
        : 'Aucune publication n\'est liée à ce profil.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    const updatedList = auteurs.filter(a => a.id !== auteur.id);
    setAuteurs(updatedList);
    setModalOpen(false);
    toast('Profil supprimé');
    if (hasGitHub()) {
      try {
        await saveAuthorsToGitHub(updatedList);
      } catch (err) {
        toast(humanizeError(err, 'La suppression a été enregistrée localement mais GitHub n\'a pas pu être mis à jour'), 'error', {
          action: { label: 'Réessayer', onClick: () => saveAuthorsToGitHub(updatedList).catch(() => {}) },
        });
      }
      if (saveToSite) {
        try {
          await saveToSite('auteurs', updatedList.map(serializeAuteur),
            `Suppression profil : ${name}`);
        } catch { /* déjà toasté par saveToSite avec retry */ }
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
          
          {saveToSite && hasGitHub() && (
            <button className="btn btn-green" onClick={() => saveToSite('auteurs', auteurs.map(serializeAuteur))}>
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

        <ResultsCount
          count={filtered.length}
          total={auteurs.length}
          itemLabel="profil"
          itemLabelPlural="profils"
          onReset={() => setSearch('')}
        />

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">&#128100;</div>
            <p>{debouncedSearch ? 'Aucun profil ne correspond à votre recherche.' : 'Aucun profil pour le moment. Créez le premier profil auteur.'}</p>
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
                  {/* Photo or person illustration fallback */}
                  <div className="auteur-card-photo">
                    <RepoPhoto
                      photo={auteur.photoPath || auteur.photo}
                      alt={getDisplayName(auteur)}
                      fallback={<PersonIllustration name={getDisplayName(auteur) || auteur.id} />}
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
                  <PersonIllustration name={`${form.firstName} ${form.lastName}`.trim() || 'nouveau'} />
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
            <fieldset style={{ marginBottom: 16, border: 'none', padding: 0 }}>
              <legend style={{ fontSize: 13, fontWeight: 600, color: COLORS.navy, marginBottom: 8 }}>Biographie</legend>
              <div style={{ marginBottom: 12 }}>
                <label>Bio courte (max 200 car.) — affichée sur les listes et fiches</label>
                <textarea
                  value={form.bioCourte}
                  onChange={e => setForm({ ...form, bioCourte: e.target.value.slice(0, 200) })}
                  rows={3}
                  placeholder="Une à deux phrases qui résument le profil…"
                  maxLength={200}
                />
                <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>{(form.bioCourte || '').length} / 200</p>
              </div>
              <div>
                <label>Bio longue (optionnelle) — affichée sur la fiche profil détaillée</label>
                <textarea
                  value={form.bioLongue}
                  onChange={e => setForm({ ...form, bioLongue: e.target.value })}
                  rows={6}
                  placeholder="Parcours, publications de référence, engagements…"
                />
              </div>
            </fieldset>

            <fieldset style={{ marginBottom: 16, border: 'none', padding: 0 }}>
              <legend style={{ fontSize: 13, fontWeight: 600, color: COLORS.navy, marginBottom: 8 }}>Réseaux & contact</legend>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label>Email (interne, non affiché)</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@exemple.fr" />
                </div>
                <div>
                  <label>LinkedIn</label>
                  <input type="url" value={form.linkedin} onChange={e => setForm({ ...form, linkedin: e.target.value })} placeholder="https://linkedin.com/in/…" />
                </div>
                <div>
                  <label>X / Twitter</label>
                  <input type="url" value={form.x} onChange={e => setForm({ ...form, x: e.target.value })} placeholder="https://x.com/…" />
                </div>
                <div>
                  <label>Site personnel</label>
                  <input type="url" value={form.site} onChange={e => setForm({ ...form, site: e.target.value })} placeholder="https://…" />
                </div>
              </div>
            </fieldset>

            <fieldset style={{ marginBottom: 16, border: 'none', padding: 0 }}>
              <legend style={{ fontSize: 13, fontWeight: 600, color: COLORS.navy, marginBottom: 8 }}>Statut</legend>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
                <div>
                  <label>Date d'arrivée (optionnelle)</label>
                  <input type="month" value={form.dateArrivee} onChange={e => setForm({ ...form, dateArrivee: e.target.value })} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', paddingBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={form.actif !== false}
                    onChange={e => setForm({ ...form, actif: e.target.checked })}
                    style={{ width: 'auto' }}
                  />
                  <span>Profil actif (décocher pour archiver)</span>
                </label>
              </div>
            </fieldset>

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
