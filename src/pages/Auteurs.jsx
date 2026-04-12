import { useState, useMemo } from 'react';
import SearchBar from '../components/shared/SearchBar';
import Modal from '../components/shared/Modal';
import ServiceBadge from '../components/shared/ServiceBadge';
import { SkeletonCard } from '../components/shared/SkeletonLoader';
import { COLORS } from '../utils/constants';
import useDebounce from '../hooks/useDebounce';

const emptyForm = { firstName: '', lastName: '', role: '', photo: '', bio: '', email: '' };

const avatarColors = [COLORS.navy, COLORS.sky, COLORS.terra, COLORS.ochre, COLORS.green];

export default function Auteurs({ auteurs, setAuteurs, articles, loading, toast }) {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
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

  const getPublicationCount = (auteur) => {
    if (!articles?.length) return auteur.publications || 0;
    const name = getDisplayName(auteur).toLowerCase();
    const count = articles.filter(art =>
      art.author && art.author.toLowerCase().includes(name)
    ).length;
    return count || auteur.publications || 0;
  };

  const getInitial = (a) => {
    if (a.firstName) return a.firstName.charAt(0).toUpperCase();
    if (a.name) return a.name.charAt(0).toUpperCase();
    return '?';
  };

  const getAvatarColor = (index) => avatarColors[index % avatarColors.length];

  const openAdd = () => {
    setEditId(null);
    setForm({ ...emptyForm });
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
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast('Le prénom et le nom sont requis', 'error');
      return;
    }

    const slug = `${form.firstName}-${form.lastName}`.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    if (editId) {
      setAuteurs(prev => prev.map(a => a.id === editId ? {
        ...a,
        firstName: form.firstName,
        lastName: form.lastName,
        name: `${form.firstName} ${form.lastName}`,
        role: form.role,
        titre: form.role,
        photo: form.photo,
        bio: form.bio,
        email: form.email,
      } : a));
      toast('Auteur mis à jour');
    } else {
      setAuteurs(prev => [...prev, {
        id: slug,
        firstName: form.firstName,
        lastName: form.lastName,
        name: `${form.firstName} ${form.lastName}`,
        role: form.role,
        titre: form.role,
        photo: form.photo,
        bio: form.bio,
        email: form.email,
        publications: 0,
      }]);
      toast('Auteur ajouté');
    }
    setModalOpen(false);
  };

  const handleDelete = (auteur, e) => {
    e.stopPropagation();
    if (!window.confirm(`Supprimer ${getDisplayName(auteur)} ?`)) return;
    setAuteurs(prev => prev.filter(a => a.id !== auteur.id));
    toast('Auteur supprimé');
  };

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
          <div className="grid grid-3">
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
              <label>Chemin de la photo</label>
              <input value={form.photo} onChange={e => setForm({ ...form, photo: e.target.value })} placeholder="assets/images/auteurs/prenom-nom.jpg" />
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
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>Annuler</button>
              <button type="submit" className="btn btn-primary">{editId ? 'Mettre à jour' : 'Ajouter'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
