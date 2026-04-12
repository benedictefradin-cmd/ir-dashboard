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
  const [filterSujet, setFilterSujet] = useState('all');
  const [filterStatut, setFilterStatut] = useState('all');
  const [selectedContact, setSelectedContact] = useState(null);
  const debouncedSearch = useDebounce(search, 300);

  const stats = useMemo(() => {
    const total = contacts.length;
    const nouveau = contacts.filter((c) => c.status === 'nouveau').length;
    const lu = contacts.filter((c) => c.status === 'lu').length;
    const traite = contacts.filter((c) => c.status === 'traite').length;
    const aSuivre = contacts.filter((c) => c.status === 'a_suivre').length;
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

    if (filterSujet !== 'all') {
      result = result.filter((c) => c.sujet === filterSujet);
    }

    if (filterStatut !== 'all') {
      result = result.filter((c) => c.status === filterStatut);
    }

    result.sort((a, b) => new Date(b.date) - new Date(a.date));

    return result;
  }, [contacts, debouncedSearch, filterSujet, filterStatut]);

  const updateStatus = (contact, newStatus) => {
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, status: newStatus } : c));
    if (selectedContact && selectedContact.id === contact.id) {
      setSelectedContact({ ...selectedContact, status: newStatus });
    }
    const labels = { lu: 'Lu', traite: 'Traité', a_suivre: 'À suivre', nouveau: 'Nouveau' };
    toast(`Statut mis à jour : ${labels[newStatus] || newStatus}`);
  };

  const getStatusBadge = (status) => {
    const cfg = CONTACT_STATUSES[status];
    if (!cfg) return <span className="badge badge-gray">{status}</span>;
    return <span className={`badge ${cfg.badgeClass}`}>{cfg.label}</span>;
  };

  const getSubjectLabel = (sujet) => {
    const found = CONTACT_SUBJECTS.find((s) => s.key === sujet);
    return found ? found.label : sujet || 'Général';
  };

  const columns = [
    { key: 'date', label: 'Date', render: (v) => formatDateFr(v) },
    { key: 'nom', label: 'Nom', render: (v) => <span style={{ fontWeight: 500 }}>{v || 'Anonyme'}</span> },
    { key: 'email', label: 'Email', render: (v) => <span style={{ color: 'var(--text-light)', fontSize: 13 }}>{v || '—'}</span> },
    { key: 'sujet', label: 'Sujet', render: (v) => <span className="badge badge-navy">{getSubjectLabel(v)}</span> },
    { key: 'message', label: 'Message', render: (v) => <span style={{ fontSize: 13, color: 'var(--text-light)' }}>{truncate(v, 60)}</span> },
    { key: 'status', label: 'Statut', render: (v) => getStatusBadge(v) },
    { key: 'actions', label: '', render: (_, row) => (
      <div className="flex-center gap-8" style={{ flexWrap: 'nowrap' }}>
        {row.status === 'nouveau' && (
          <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); updateStatus(row, 'lu'); }}>Marquer lu</button>
        )}
        {(row.status === 'nouveau' || row.status === 'lu' || row.status === 'a_suivre') && (
          <button className="btn btn-green btn-sm" onClick={(e) => { e.stopPropagation(); updateStatus(row, 'traite'); }}>Traiter</button>
        )}
      </div>
    )},
  ];

  if (loading) {
    return (
      <>
        <div className="page-header"><h1>Contact</h1></div>
        <div className="page-body"><SkeletonCard count={4} /><SkeletonTable /></div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Messages de contact</h1>
          <p className="page-header-sub">{stats.total} message(s) — {stats.nouveau} nouveau(x)</p>
        </div>
        <div className="flex-center gap-8">
          <ServiceBadge service="cloudflare" />
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div className="grid grid-4 mb-24">
          <StatsCard label="Total" value={stats.total} accentColor={COLORS.navy} />
          <StatsCard label="Nouveaux" value={stats.nouveau} accentColor={COLORS.sky} />
          <StatsCard label="Traités" value={stats.traite} accentColor={COLORS.green} />
          <StatsCard label="À suivre" value={stats.aSuivre} accentColor={COLORS.terra} />
        </div>

        {/* Filtres */}
        <div className="flex-wrap mb-16">
          <SearchBar value={search} onChange={setSearch} placeholder="Rechercher par nom, email, message…" />
          <div>
            <span className={`pill${filterSujet === 'all' ? ' active' : ''}`} onClick={() => setFilterSujet('all')}>Tous sujets</span>
            {CONTACT_SUBJECTS.map(s => (
              <span key={s.key} className={`pill${filterSujet === s.key ? ' active' : ''}`} onClick={() => setFilterSujet(s.key)}>{s.label}</span>
            ))}
          </div>
          <div>
            {[['all', 'Tous statuts'], ['nouveau', 'Nouveaux'], ['lu', 'Lus'], ['traite', 'Traités'], ['a_suivre', 'À suivre']].map(([k, l]) => (
              <span key={k} className={`pill${filterStatut === k ? ' active' : ''}`} onClick={() => setFilterStatut(k)}>{l}</span>
            ))}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          pageSize={20}
          onRowClick={setSelectedContact}
          emptyMessage="Aucun message de contact"
        />
      </div>

      {/* Détail modal */}
      {selectedContact && (
        <Modal title="Détail du message" onClose={() => setSelectedContact(null)} size="lg">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div><label>Date</label><p style={{ fontSize: 15 }}>{formatDateFr(selectedContact.date)}</p></div>
            <div><label>Nom</label><p style={{ fontSize: 15, fontWeight: 500 }}>{selectedContact.nom || 'Anonyme'}</p></div>
            <div><label>Email</label><p style={{ fontSize: 15 }}>{selectedContact.email ? <a href={`mailto:${selectedContact.email}`}>{selectedContact.email}</a> : '—'}</p></div>
            <div><label>Sujet</label><p>{getSubjectLabel(selectedContact.sujet)}</p></div>
            <div><label>Statut</label><p>{getStatusBadge(selectedContact.status)}</p></div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label>Message</label>
            <div style={{ padding: 16, background: 'var(--cream)', borderRadius: 8, fontSize: 14, lineHeight: 1.7, marginTop: 6 }}>
              {selectedContact.message}
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => updateStatus(selectedContact, 'lu')} disabled={selectedContact.status === 'lu'}>Lu</button>
            <button className="btn btn-green" onClick={() => updateStatus(selectedContact, 'traite')} disabled={selectedContact.status === 'traite'}>Traité</button>
            <button className="btn btn-terra" onClick={() => updateStatus(selectedContact, 'a_suivre')} disabled={selectedContact.status === 'a_suivre'}>À suivre</button>
            <button className="btn btn-primary" onClick={() => setSelectedContact(null)}>Fermer</button>
          </div>
        </Modal>
      )}
    </>
  );
}
