import { useState, useMemo } from 'react';
import SearchBar from '../components/shared/SearchBar';
import Modal from '../components/shared/Modal';
import ServiceBadge from '../components/shared/ServiceBadge';
import { SkeletonCard } from '../components/shared/SkeletonLoader';
import { COLORS } from '../utils/constants';
import useDebounce from '../hooks/useDebounce';

const emptyForm = { name: '', titre: '', photo: '', bio: '' };

const avatarColors = [COLORS.navy, COLORS.sky, COLORS.terra, COLORS.ochre, COLORS.green];

export default function Auteurs({ auteurs, setAuteurs, articles, loading, toast }) {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const debouncedSearch = useDebounce(search, 150);

  // Recherche insensible aux accents
  const normalize = (str) =>
    (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const filtered = useMemo(() => {
    if (!debouncedSearch) return auteurs;
    const q = normalize(debouncedSearch);
    return auteurs.filter(
      (a) => normalize(a.name).includes(q) || normalize(a.titre).includes(q)
    );
  }, [auteurs, debouncedSearch]);

  const getPublicationCount = (authorName) => {
    if (!articles || !articles.length || !authorName) return 0;
    return articles.filter(
      (art) => art.author && art.author.toLowerCase() === authorName.toLowerCase()
    ).length;
  };

  const getInitial = (name) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  const getAvatarColor = (index) => avatarColors[index % avatarColors.length];

  const openAdd = () => {
    setEditIndex(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (auteur, index) => {
    setEditIndex(index);
    setForm({ name: auteur.name || '', titre: auteur.titre || '', photo: auteur.photo || '', bio: auteur.bio || '' });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast('Le nom est requis', 'error');
      return;
    }

    if (editIndex !== null) {
      setAuteurs(prev => prev.map((a, i) => i === editIndex ? { ...a, ...form } : a));
      toast('Auteur mis à jour');
    } else {
      setAuteurs(prev => [...prev, { id: Date.now(), ...form, publications: 0 }]);
      toast('Auteur ajouté');
    }
    setModalOpen(false);
  };

  const handleDelete = (index, e) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer cet auteur ?')) return;
    setAuteurs(prev => prev.filter((_, i) => i !== index));
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
          <p className="page-header-sub">{auteurs.length} auteur(s)</p>
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
            {filtered.map((auteur) => {
              const realIndex = auteurs.indexOf(auteur);
              const pubCount = auteur.publications || getPublicationCount(auteur.name);
              return (
                <div
                  className="author-card"
                  key={auteur.id || realIndex}
                  onClick={() => openEdit(auteur, realIndex)}
                  style={{ cursor: 'pointer' }}
                >
                  {auteur.photo ? (
                    <div className="author-avatar">
                      <img src={auteur.photo} alt={auteur.name} />
                    </div>
                  ) : (
                    <div
                      className="author-avatar"
                      style={{
                        backgroundColor: getAvatarColor(realIndex),
                        color: '#fff',
                        fontSize: 32,
                        fontFamily: "'Cormorant Garamond', serif",
                        fontWeight: 700,
                      }}
                    >
                      {getInitial(auteur.name)}
                    </div>
                  )}
                  <h3 style={{ fontSize: 16, marginBottom: 4 }}>{auteur.name}</h3>
                  {auteur.titre && (
                    <p style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 8 }}>{auteur.titre}</p>
                  )}
                  <span className="badge badge-sky">
                    {pubCount} publication{pubCount !== 1 ? 's' : ''}
                  </span>
                  <div style={{ marginTop: 10 }}>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ color: 'var(--danger)', fontSize: 12 }}
                      onClick={(e) => handleDelete(realIndex, e)}
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
        <Modal onClose={() => setModalOpen(false)} title={editIndex !== null ? 'Modifier l\u2019auteur' : 'Ajouter un auteur'}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label>Nom complet</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nom complet" required />
              </div>
              <div>
                <label>Titre / Fonction</label>
                <input value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })} placeholder="Ex: Chercheur en politique climatique" />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label>Chemin de la photo</label>
              <input value={form.photo} onChange={e => setForm({ ...form, photo: e.target.value })} placeholder="/images/auteurs/nom.jpg" />
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
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>Annuler</button>
              <button type="submit" className="btn btn-primary">{editIndex !== null ? 'Mettre à jour' : 'Ajouter'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
