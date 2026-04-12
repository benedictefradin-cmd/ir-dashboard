import { useState, useMemo } from 'react';
import SearchBar from '../components/shared/SearchBar';
import Modal from '../components/shared/Modal';
import ServiceBadge from '../components/shared/ServiceBadge';
import { SkeletonCard } from '../components/shared/SkeletonLoader';
import { COLORS } from '../utils/constants';
import useDebounce from '../hooks/useDebounce';

const emptyAuteur = { nom: '', titre: '', photo: '', bio: '' };

export default function Auteurs({ auteurs, setAuteurs, articles, loading, toast }) {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [form, setForm] = useState(emptyAuteur);

  const debouncedSearch = useDebounce(search, 300);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return auteurs;
    const q = debouncedSearch.toLowerCase();
    return auteurs.filter(
      (a) => a.nom.toLowerCase().includes(q) || (a.titre && a.titre.toLowerCase().includes(q))
    );
  }, [auteurs, debouncedSearch]);

  const getPublicationCount = (authorName) => {
    if (!articles || !articles.length) return 0;
    return articles.filter(
      (art) => art.auteur && art.auteur.toLowerCase() === authorName.toLowerCase()
    ).length;
  };

  const getInitial = (nom) => {
    if (!nom) return '?';
    return nom.charAt(0).toUpperCase();
  };

  const avatarColors = [
    COLORS.navy,
    COLORS.sky,
    COLORS.terra,
    COLORS.ochre,
    COLORS.green,
  ];

  const getAvatarColor = (index) => avatarColors[index % avatarColors.length];

  const openAdd = () => {
    setEditIndex(null);
    setForm(emptyAuteur);
    setModalOpen(true);
  };

  const openEdit = (auteur, index) => {
    setEditIndex(index);
    setForm({ ...auteur });
    setModalOpen(true);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.nom.trim()) {
      toast && toast('Le nom est requis.', 'error');
      return;
    }

    const updated = [...auteurs];
    if (editIndex !== null) {
      updated[editIndex] = { ...form };
      toast && toast('Auteur mis a jour.', 'success');
    } else {
      updated.push({ ...form });
      toast && toast('Auteur ajoute.', 'success');
    }
    setAuteurs(updated);
    setModalOpen(false);
  };

  const handleDelete = (index) => {
    if (!window.confirm('Supprimer cet auteur ?')) return;
    const updated = auteurs.filter((_, i) => i !== index);
    setAuteurs(updated);
    toast && toast('Auteur supprime.', 'success');
  };

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Auteurs</h1>
          <ServiceBadge service="notion" />
        </div>
        <div className="page-body">
          <div className="grid grid-3">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Auteurs</h1>
          <ServiceBadge service="notion" />
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          + Ajouter un auteur
        </button>
      </div>

      <div className="page-body">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Rechercher un auteur..."
        />

        {filtered.length === 0 ? (
          <p className="empty-state">Aucun auteur trouve.</p>
        ) : (
          <div className="grid grid-3">
            {filtered.map((auteur, index) => {
              const realIndex = auteurs.indexOf(auteur);
              const pubCount = getPublicationCount(auteur.nom);
              return (
                <div
                  className="card author-card"
                  key={realIndex}
                  onClick={() => openEdit(auteur, realIndex)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="author-card-header">
                    {auteur.photo ? (
                      <img
                        className="author-avatar"
                        src={auteur.photo}
                        alt={auteur.nom}
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: '50%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <div
                        className="author-avatar"
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: '50%',
                          backgroundColor: getAvatarColor(realIndex),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: '2rem',
                          fontFamily: 'Cormorant Garamond, serif',
                          fontWeight: 700,
                        }}
                      >
                        {getInitial(auteur.nom)}
                      </div>
                    )}
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(realIndex);
                      }}
                      title="Supprimer"
                    >
                      Supprimer
                    </button>
                  </div>
                  <h3>{auteur.nom}</h3>
                  {auteur.titre && <p className="author-titre">{auteur.titre}</p>}
                  <span className="badge">
                    {pubCount} publication{pubCount !== 1 ? 's' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)} title={editIndex !== null ? 'Modifier l\'auteur' : 'Ajouter un auteur'}>
          <form onSubmit={handleSubmit} className="modal-form">
            <div className="form-group">
              <label htmlFor="auteur-nom">Nom</label>
              <input
                id="auteur-nom"
                name="nom"
                type="text"
                value={form.nom}
                onChange={handleChange}
                placeholder="Nom complet"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="auteur-titre">Titre / Fonction</label>
              <input
                id="auteur-titre"
                name="titre"
                type="text"
                value={form.titre}
                onChange={handleChange}
                placeholder="Ex: Chercheur en politique climatique"
              />
            </div>
            <div className="form-group">
              <label htmlFor="auteur-photo">Chemin de la photo</label>
              <input
                id="auteur-photo"
                name="photo"
                type="text"
                value={form.photo}
                onChange={handleChange}
                placeholder="/images/auteurs/nom.jpg"
              />
            </div>
            <div className="form-group">
              <label htmlFor="auteur-bio">Biographie</label>
              <textarea
                id="auteur-bio"
                name="bio"
                value={form.bio}
                onChange={handleChange}
                rows={5}
                placeholder="Courte biographie..."
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary">
                {editIndex !== null ? 'Mettre a jour' : 'Ajouter'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
