import { useState, useMemo, useRef } from 'react';
import SearchBar from '../components/shared/SearchBar';
import Modal from '../components/shared/Modal';
import ServiceBadge from '../components/shared/ServiceBadge';
import { SkeletonCard } from '../components/shared/SkeletonLoader';
import { COLORS } from '../utils/constants';
import useDebounce from '../hooks/useDebounce';
import { hasGitHub, githubUploadImage, saveAuthorsToGitHub } from '../services/github';

const emptyForm = { firstName: '', lastName: '', role: '', photo: '', bio: '', email: '' };

const avatarColors = [COLORS.navy, COLORS.sky, COLORS.terra, COLORS.ochre, COLORS.green];

export default function Auteurs({ auteurs, setAuteurs, articles, loading, toast, saveToSite }) {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const debouncedSearch = useDebounce(search, 150);

  const normalize = (str) =>
    (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const filtered = useMemo(() => {
    if (!debouncedSearch) return auteurs;
    const q = normalize(debouncedSearch);
    return auteurs.filter(a =>
      normalize(a.firstName).includes(q) ||
      normalize(a.lastName).includes(q) ||
      normalize(a.name).includes(q) ||
      normalize(a.role).includes(q) ||
      normalize(a.titre).includes(q)
    );
  }, [auteurs, debouncedSearch]);

  const getDisplayName = (a) => {
    if (a.firstName && a.lastName) return `${a.firstName} ${a.lastName}`;
    return a.name || '';
  };

  // Get publications linked to an author (by name matching)
  const getLinkedPublications = (auteur) => {
    if (!articles?.length) return [];
    const name = getDisplayName(auteur).toLowerCase();
    if (!name) return [];
    return articles.filter(art =>
      art.author && art.author.toLowerCase().includes(name)
    );
  };

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
      photo: auteur.photo || '',
      bio: auteur.bio || '',
      email: auteur.email || '',
    });
    setPhotoPreview(auteur.photo || null);
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
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    let photoUrl = form.photo;

    // Upload de la photo sur GitHub si un nouveau fichier est sélectionné
    if (photoFile && hasGitHub()) {
      setUploading(true);
      try {
        const ext = photoFile.name.split('.').pop().toLowerCase() || 'jpg';
        const path = `images/auteurs/${slug}.${ext}`;
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(photoFile);
        });
        const result = await githubUploadImage(path, base64, `Photo auteur : ${form.firstName} ${form.lastName}`);
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

    let updatedList;
    if (editId) {
      updatedList = auteurs.map(a => a.id === editId ? { ...a, ...auteurData } : a);
      setAuteurs(updatedList);
      toast('Auteur mis à jour');
    } else {
      updatedList = [...auteurs, auteurData];
      setAuteurs(updatedList);
      toast('Auteur ajouté');
    }
    setModalOpen(false);

    // Persister dans authors.json via GitHub + sync vers le site
    if (hasGitHub()) {
      try {
        await saveAuthorsToGitHub(updatedList);
        toast('authors.json mis à jour sur GitHub');
      } catch (err) {
        toast(`Erreur sync GitHub : ${err.message}`, 'error');
      }

      // Sync auteurs.json sur le site repo
      if (saveToSite) {
        try {
          await saveToSite('auteurs', updatedList.map(({ id, firstName, lastName, role, bio, photo, photoPath, publications }) => ({
            id, firstName, lastName, role, bio, photo: photoPath || photo || '', publications: publications || 0,
          })), `Mise à jour auteur : ${form.firstName} ${form.lastName}`);
        } catch { /* silent — already toasted from saveToSite */ }
      }
    }
  };

  const handleDelete = async (auteur, e) => {
    e.stopPropagation();
    if (!window.confirm(`Supprimer ${getDisplayName(auteur)} ?`)) return;
    const updatedList = auteurs.filter(a => a.id !== auteur.id);
    setAuteurs(updatedList);
    toast('Auteur supprimé');
    if (hasGitHub()) {
      try { await saveAuthorsToGitHub(updatedList); } catch { /* silent */ }
      if (saveToSite) {
        try {
          await saveToSite('auteurs', updatedList.map(({ id, firstName, lastName, role, bio, photo, photoPath, publications }) => ({
            id, firstName, lastName, role, bio, photo: photoPath || photo || '', publications: publications || 0,
          })), `Suppression auteur : ${getDisplayName(auteur)}`);
        } catch { /* silent */ }
      }
    }
  };

  // Publications linked to the author being edited
  const editingAuteur = editId ? auteurs.find(a => a.id === editId) : null;
  const linkedPubs = editingAuteur ? getLinkedPublications(editingAuteur) : [];

  if (loading) {
    return (
      <>
        <div className="page-header"><h1>Auteurs</h1></div>
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
          <h1>Auteurs</h1>
          <p className="page-header-sub">{auteurs.length} auteur{auteurs.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex-center gap-8">
          <ServiceBadge service="notion" />
          {saveToSite && hasGitHub() && (
            <button className="btn btn-green" onClick={() => saveToSite('auteurs', auteurs.map(({ id, firstName, lastName, role, bio, photo, photoPath, publications }) => ({ id, firstName, lastName, role, bio, photo: photoPath || photo || '', publications: publications || 0 })))}>
              Publier tout sur le site
            </button>
          )}
          <button className="btn btn-primary" onClick={openAdd}>+ Ajouter un auteur</button>
        </div>
      </div>

      <div className="page-body">
        <div className="mb-20">
          <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un auteur…" />
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">&#128100;</div>
            <p>Aucun auteur trouvé.</p>
          </div>
        ) : (
          <div className="grid grid-3 grid-mobile-2">
            {filtered.map((auteur, i) => {
              const pubCount = getPublicationCount(auteur);
              return (
                <div
                  className="author-card"
                  key={auteur.id}
                  onClick={() => openEdit(auteur)}
                  style={{ cursor: 'pointer' }}
                >
                  {auteur.photo ? (
                    <div className="author-avatar">
                      <img src={auteur.photo} alt={getDisplayName(auteur)} />
                    </div>
                  ) : (
                    <div
                      className="author-avatar"
                      style={{
                        backgroundColor: getAvatarColor(i),
                        color: '#fff',
                        fontSize: 32,
                        fontFamily: "'Cormorant Garamond', serif",
                        fontWeight: 700,
                      }}
                    >
                      {getInitial(auteur)}
                    </div>
                  )}
                  <h3 style={{ fontSize: 16, marginBottom: 4 }}>{getDisplayName(auteur)}</h3>
                  {(auteur.role || auteur.titre) && (
                    <p style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 8 }}>
                      {auteur.role || auteur.titre}
                    </p>
                  )}
                  <span className="badge badge-sky">
                    {pubCount} publication{pubCount !== 1 ? 's' : ''}
                  </span>
                  <div style={{ marginTop: 10 }}>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ color: 'var(--danger)', fontSize: 12 }}
                      onClick={(e) => handleDelete(auteur, e)}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)} title={editId ? 'Modifier l\u2019auteur' : 'Ajouter un auteur'}>
          <form onSubmit={handleSubmit}>
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
              <label>Photo de l'auteur</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoSelect}
                style={{ display: 'none' }}
              />
              {photoPreview ? (
                <div className="photo-upload-preview">
                  <img src={photoPreview} alt="Aperçu" />
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

            {/* Publications liées */}
            {editId && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 600 }}>Publications liées ({linkedPubs.length})</label>
                {linkedPubs.length === 0 ? (
                  <p style={{ fontSize: 13, color: COLORS.textLight, marginTop: 4 }}>Aucune publication liée à cet auteur.</p>
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
