import { useState, useMemo } from 'react';
import StatsCard from '../components/shared/StatsCard';
import DataTable from '../components/shared/DataTable';
import SearchBar from '../components/shared/SearchBar';
import Modal from '../components/shared/Modal';
import ServiceBadge from '../components/shared/ServiceBadge';
import { SkeletonCard, SkeletonTable } from '../components/shared/SkeletonLoader';
import { formatDateFr, truncate } from '../utils/formatters';
import { COLORS, CONTACT_SUBJECTS, CONTACT_STATUSES } from '../utils/constants';
import useDebounce from '../hooks/useDebounce';

export default function Contact({ contacts, setContacts, loading, toast }) {
  const [search, setSearch] = useState('');
  const [filterSujet, setFilterSujet] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const debouncedSearch = useDebounce(search, 300);

  const stats = useMemo(() => {
    const total = contacts.length;
    const nouveau = contacts.filter((c) => c.statut === 'nouveau').length;
    const lu = contacts.filter((c) => c.statut === 'lu').length;
    const traite = contacts.filter((c) => c.statut === 'traite').length;
    const aSuivre = contacts.filter((c) => c.statut === 'a_suivre').length;
    return { total, nouveau, lu, traite, aSuivre };
  }, [contacts]);

  const filtered = useMemo(() => {
    let result = [...contacts];

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (c) =>
          (c.nom && c.nom.toLowerCase().includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.message && c.message.toLowerCase().includes(q))
      );
    }

    if (filterSujet) {
      result = result.filter((c) => c.sujet === filterSujet);
    }

    if (filterStatut) {
      result = result.filter((c) => c.statut === filterStatut);
    }

    result.sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (sortKey === 'date') {
        va = new Date(va).getTime();
        vb = new Date(vb).getTime();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [contacts, debouncedSearch, filterSujet, filterStatut, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const updateStatus = (index, newStatut) => {
    const updated = [...contacts];
    const realIndex = contacts.indexOf(
      selectedContact || filtered[index]
    );
    if (realIndex === -1) return;

    updated[realIndex] = { ...updated[realIndex], statut: newStatut };
    setContacts(updated);

    if (selectedContact) {
      setSelectedContact({ ...selectedContact, statut: newStatut });
    }

    const labels = { lu: 'Lu', traite: 'Traite', a_suivre: 'A suivre' };
    toast && toast(`Statut mis a jour : ${labels[newStatut] || newStatut}`, 'success');
  };

  const getSubjectLabel = (sujet) => {
    if (!CONTACT_SUBJECTS) return sujet || 'General';
    const found = CONTACT_SUBJECTS.find((s) => s.id === sujet || s.value === sujet);
    return found ? found.label : sujet || 'General';
  };

  const getStatusLabel = (statut) => {
    const map = {
      nouveau: 'Nouveau',
      lu: 'Lu',
      traite: 'Traite',
      a_suivre: 'A suivre',
    };
    return map[statut] || statut || 'Nouveau';
  };

  const getStatusColor = (statut) => {
    const map = {
      nouveau: 'badge-sky',
      lu: 'badge-ochre',
      traite: 'badge-green',
      a_suivre: 'badge-terra',
    };
    return map[statut] || 'badge-sky';
  };

  const getSubjectColor = (sujet) => {
    const map = {
      general: 'pill-navy',
      evenement: 'pill-ochre',
      presse: 'pill-sky',
      partenariat: 'pill-green',
    };
    return map[sujet] || 'pill-navy';
  };

  const subjects = CONTACT_SUBJECTS || [
    { id: 'general', label: 'General' },
    { id: 'evenement', label: 'Evenement' },
    { id: 'presse', label: 'Presse' },
    { id: 'partenariat', label: 'Partenariat' },
  ];

  const statuses = CONTACT_STATUSES || [
    { id: 'nouveau', label: 'Nouveau' },
    { id: 'lu', label: 'Lu' },
    { id: 'traite', label: 'Traite' },
    { id: 'a_suivre', label: 'A suivre' },
  ];

  const columns = [
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      render: (row) => formatDateFr(row.date),
    },
    {
      key: 'nom',
      label: 'Nom',
      sortable: true,
      render: (row) => row.nom || 'Anonyme',
    },
    {
      key: 'email',
      label: 'Email',
      render: (row) => row.email || '-',
    },
    {
      key: 'sujet',
      label: 'Sujet',
      render: (row) => (
        <span className={`pill ${getSubjectColor(row.sujet)}`}>
          {getSubjectLabel(row.sujet)}
        </span>
      ),
    },
    {
      key: 'message',
      label: 'Message',
      render: (row) => truncate(row.message, 80),
    },
    {
      key: 'statut',
      label: 'Statut',
      render: (row) => (
        <span className={`badge ${getStatusColor(row.statut)}`}>
          {getStatusLabel(row.statut)}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Messages de contact</h1>
          <ServiceBadge service="cloudflare" />
        </div>
        <div className="page-body">
          <div className="grid grid-5">
            {[...Array(5)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <SkeletonTable rows={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Messages de contact</h1>
          <ServiceBadge service="cloudflare" />
        </div>
      </div>

      <div className="page-body">
        <div className="grid grid-5">
          <StatsCard label="Total" value={stats.total} color="var(--color-navy)" />
          <StatsCard label="Nouveau" value={stats.nouveau} color="var(--color-sky)" />
          <StatsCard label="Lu" value={stats.lu} color="var(--color-ochre)" />
          <StatsCard label="Traite" value={stats.traite} color="var(--color-green)" />
          <StatsCard label="A suivre" value={stats.aSuivre} color="var(--color-terra)" />
        </div>

        <div className="filters-bar">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Rechercher par nom, email, message..."
          />
          <select
            className="filter-select"
            value={filterSujet}
            onChange={(e) => setFilterSujet(e.target.value)}
          >
            <option value="">Tous les sujets</option>
            {subjects.map((s) => (
              <option key={s.id || s.value} value={s.id || s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            className="filter-select"
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            {statuses.map((s) => (
              <option key={s.id || s.value} value={s.id || s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="card table-card">
          <h2>Messages ({filtered.length})</h2>
          <DataTable
            columns={columns}
            data={filtered}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            onRowClick={(row) => setSelectedContact(row)}
          />
        </div>
      </div>

      {selectedContact && (
        <Modal
          onClose={() => setSelectedContact(null)}
          title="Detail du message"
        >
          <div className="contact-detail">
            <div className="contact-detail-meta">
              <p>
                <strong>Date :</strong> {formatDateFr(selectedContact.date)}
              </p>
              <p>
                <strong>Nom :</strong> {selectedContact.nom || 'Anonyme'}
              </p>
              <p>
                <strong>Email :</strong>{' '}
                {selectedContact.email ? (
                  <a href={`mailto:${selectedContact.email}`}>{selectedContact.email}</a>
                ) : (
                  '-'
                )}
              </p>
              <p>
                <strong>Sujet :</strong>{' '}
                <span className={`pill ${getSubjectColor(selectedContact.sujet)}`}>
                  {getSubjectLabel(selectedContact.sujet)}
                </span>
              </p>
              <p>
                <strong>Statut :</strong>{' '}
                <span className={`badge ${getStatusColor(selectedContact.statut)}`}>
                  {getStatusLabel(selectedContact.statut)}
                </span>
              </p>
            </div>

            <div className="contact-detail-message">
              <h3>Message</h3>
              <p>{selectedContact.message}</p>
            </div>

            <div className="contact-detail-actions">
              <h3>Changer le statut</h3>
              <div className="btn-group">
                <button
                  className="btn btn-sm btn-ochre"
                  onClick={() => updateStatus(null, 'lu')}
                  disabled={selectedContact.statut === 'lu'}
                >
                  Lu
                </button>
                <button
                  className="btn btn-sm btn-green"
                  onClick={() => updateStatus(null, 'traite')}
                  disabled={selectedContact.statut === 'traite'}
                >
                  Traite
                </button>
                <button
                  className="btn btn-sm btn-terra"
                  onClick={() => updateStatus(null, 'a_suivre')}
                  disabled={selectedContact.statut === 'a_suivre'}
                >
                  A suivre
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
