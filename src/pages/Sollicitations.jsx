import { useState, useMemo, useCallback } from 'react';
import StatsCard from '../components/shared/StatsCard';
import SearchBar from '../components/shared/SearchBar';
import Modal from '../components/shared/Modal';
import ServiceBadge from '../components/shared/ServiceBadge';
import { SkeletonCard, SkeletonTable } from '../components/shared/SkeletonLoader';
import { formatDateFr, formatDateShort, timeAgo, truncate } from '../utils/formatters';
import { exportToExcel } from '../services/export';
import {
  COLORS,
  CONTACT_SUBJECTS,
  SOLLICITATION_STATUSES,
  SOLLICITATION_PRIORITIES,
  SOLLICITATION_ADMINS,
} from '../utils/constants';
import useDebounce from '../hooks/useDebounce';

// ─── Helper : status badge ─────────────────────────
function StatusBadge({ status }) {
  const cfg = SOLLICITATION_STATUSES[status];
  if (!cfg) return <span className="badge badge-gray">{status}</span>;
  return <span className={`badge ${cfg.badgeClass}`}>{cfg.label}</span>;
}

function PriorityBadge({ priority }) {
  const cfg = SOLLICITATION_PRIORITIES[priority];
  if (!cfg) return null;
  return <span className={`badge ${cfg.badgeClass}`}>{cfg.label}</span>;
}

function getSubjectLabel(subject) {
  const found = CONTACT_SUBJECTS.find(s => s.key === subject);
  return found ? found.label : subject || 'Question générale';
}

// ─── Main Component ─────────────────────────────────
export default function Sollicitations({ sollicitations, setSollicitations, loading, toast }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Detail panel state
  const [replyText, setReplyText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const debouncedSearch = useDebounce(search, 300);
  const PAGE_SIZE = 20;

  // ─── Stats ──────────────────────────────────
  const stats = useMemo(() => {
    const total = sollicitations.length;
    const newCount = sollicitations.filter(s => s.status === 'new').length;
    const inProgress = sollicitations.filter(s => s.status === 'in_progress').length;
    const resolved = sollicitations.filter(s => s.status === 'resolved').length;
    const archived = sollicitations.filter(s => s.status === 'archived').length;

    // Stats du mois
    const now = new Date();
    const thisMonth = sollicitations.filter(s => {
      const d = new Date(s.submitted_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    // Temps moyen de réponse (pour les résolues)
    const resolvedItems = sollicitations.filter(s => s.resolved_at && s.submitted_at);
    let avgResponseTime = null;
    if (resolvedItems.length > 0) {
      const totalMs = resolvedItems.reduce((sum, s) => {
        return sum + (new Date(s.resolved_at) - new Date(s.submitted_at));
      }, 0);
      avgResponseTime = Math.round(totalMs / resolvedItems.length / (1000 * 60 * 60 * 24) * 10) / 10;
    }

    // Top sujet
    const subjectCounts = {};
    sollicitations.forEach(s => {
      const key = s.subject || 'general';
      subjectCounts[key] = (subjectCounts[key] || 0) + 1;
    });
    const topSubject = Object.entries(subjectCounts).sort((a, b) => b[1] - a[1])[0];
    const topSubjectPct = topSubject && total > 0 ? Math.round(topSubject[1] / total * 100) : 0;

    return {
      total, newCount, inProgress, resolved, archived,
      thisMonthCount: thisMonth.length,
      avgResponseTime,
      topSubject: topSubject ? getSubjectLabel(topSubject[0]) : null,
      topSubjectPct,
    };
  }, [sollicitations]);

  // ─── Filtering & sorting ────────────────────
  const filtered = useMemo(() => {
    let result = [...sollicitations];

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter(s => s.status === filterStatus);
    } else {
      // Par défaut, masquer les archivés
      result = result.filter(s => s.status !== 'archived');
    }

    // Filter by subject
    if (filterSubject !== 'all') {
      result = result.filter(s => s.subject === filterSubject);
    }

    // Full-text search
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(s =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.organization && s.organization.toLowerCase().includes(q)) ||
        (s.message && s.message.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.submitted_at) - new Date(a.submitted_at);
      if (sortBy === 'date_asc') return new Date(a.submitted_at) - new Date(b.submitted_at);
      if (sortBy === 'priority') {
        const order = { urgent: 0, high: 1, normal: 2, low: 3 };
        return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
      }
      return 0;
    });

    return result;
  }, [sollicitations, filterStatus, filterSubject, debouncedSearch, sortBy]);

  // ─── Pagination ─────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filters change
  useMemo(() => { setPage(1); }, [filterStatus, filterSubject, debouncedSearch]);

  // ─── Actions ────────────────────────────────
  const updateSollicitation = useCallback((id, updates) => {
    setSollicitations(prev => prev.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, ...updates, updated_at: new Date().toISOString() };
      if (updates.status === 'resolved' && !s.resolved_at) {
        updated.resolved_at = new Date().toISOString();
      }
      return updated;
    }));
    // Update selected if open
    if (selected && selected.id === id) {
      setSelected(prev => {
        const updated = { ...prev, ...updates, updated_at: new Date().toISOString() };
        if (updates.status === 'resolved' && !prev.resolved_at) {
          updated.resolved_at = new Date().toISOString();
        }
        return updated;
      });
    }
  }, [selected, setSollicitations]);

  const handleStatusChange = (id, newStatus) => {
    const labels = SOLLICITATION_STATUSES[newStatus]?.label || newStatus;
    const history = {
      type: 'status_change',
      text: `Statut → ${labels}`,
      date: new Date().toISOString(),
      author: 'Admin',
    };
    const item = sollicitations.find(s => s.id === id);
    updateSollicitation(id, {
      status: newStatus,
      internal_notes: [...(item?.internal_notes || []), history],
    });
    toast(`Statut mis à jour : ${labels}`);
  };

  const handleAssignChange = (id, assignee) => {
    const item = sollicitations.find(s => s.id === id);
    const history = {
      type: 'assign',
      text: assignee ? `Assigné à ${assignee}` : 'Désassigné',
      date: new Date().toISOString(),
      author: 'Admin',
    };
    updateSollicitation(id, {
      assigned_to: assignee || null,
      internal_notes: [...(item?.internal_notes || []), history],
    });
    toast(assignee ? `Assigné à ${assignee}` : 'Désassigné');
  };

  const handlePriorityChange = (id, priority) => {
    updateSollicitation(id, { priority });
    toast(`Priorité : ${SOLLICITATION_PRIORITIES[priority]?.label || priority}`);
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selected) return;
    setSendingReply(true);

    const reply = {
      text: replyText.trim(),
      sent_by: 'Admin',
      sent_at: new Date().toISOString(),
    };

    const history = {
      type: 'reply_sent',
      text: 'Réponse envoyée par email',
      date: new Date().toISOString(),
      author: 'Admin',
    };

    // TODO: Call POST /api/contact/:id/reply when Worker is ready
    // For now, update locally
    const item = sollicitations.find(s => s.id === selected.id);
    updateSollicitation(selected.id, {
      replies: [...(item?.replies || []), reply],
      status: 'resolved',
      internal_notes: [...(item?.internal_notes || []), history],
    });

    setReplyText('');
    setSendingReply(false);
    toast('Réponse envoyée et statut mis à jour');
  };

  const handleAddNote = () => {
    if (!noteText.trim() || !selected) return;
    const note = {
      type: 'note',
      text: noteText.trim(),
      date: new Date().toISOString(),
      author: 'Admin',
    };
    const item = sollicitations.find(s => s.id === selected.id);
    updateSollicitation(selected.id, {
      internal_notes: [...(item?.internal_notes || []), note],
    });
    setNoteText('');
    toast('Note ajoutée');
  };

  const handleAddTag = () => {
    if (!tagInput.trim() || !selected) return;
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    const item = sollicitations.find(s => s.id === selected.id);
    if ((item?.tags || []).includes(tag)) {
      setTagInput('');
      return;
    }
    updateSollicitation(selected.id, {
      tags: [...(item?.tags || []), tag],
    });
    setTagInput('');
  };

  const handleRemoveTag = (tag) => {
    if (!selected) return;
    const item = sollicitations.find(s => s.id === selected.id);
    updateSollicitation(selected.id, {
      tags: (item?.tags || []).filter(t => t !== tag),
    });
  };

  const handleArchive = (id) => {
    handleStatusChange(id, 'archived');
    setSelected(null);
  };

  const handleDelete = (id) => {
    handleStatusChange(id, 'archived');
    setSelected(null);
    setShowDeleteConfirm(false);
    toast('Sollicitation archivée');
  };

  const handleExportCSV = () => {
    const rows = filtered.map(s => ({
      Date: formatDateShort(s.submitted_at),
      Nom: s.name || '',
      Email: s.email || '',
      Organisation: s.organization || '',
      Objet: getSubjectLabel(s.subject),
      Statut: SOLLICITATION_STATUSES[s.status]?.label || s.status,
      'Assigné à': s.assigned_to || '',
      Priorité: SOLLICITATION_PRIORITIES[s.priority]?.label || s.priority,
      Tags: (s.tags || []).join(', '),
      'Date de résolution': s.resolved_at ? formatDateShort(s.resolved_at) : '',
    }));
    exportToExcel(rows, 'Sollicitations', `sollicitations_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast('Export généré');
  };

  const openDetail = (item) => {
    setSelected(item);
    setReplyText('');
    setNoteText('');
    setTagInput('');
    // Mark as read if new
    if (item.status === 'new') {
      handleStatusChange(item.id, 'in_progress');
    }
  };

  // ─── Loading ────────────────────────────────
  if (loading) {
    return (
      <>
        <div className="page-header"><h1>Sollicitations</h1></div>
        <div className="page-body"><SkeletonCard count={4} /><SkeletonTable /></div>
      </>
    );
  }

  // ─── Render ─────────────────────────────────
  return (
    <>
      <div className="page-header slide-up">
        <div>
          <h1>Sollicitations</h1>
          <p className="page-header-sub">
            {stats.total} sollicitation(s) — {stats.newCount} nouvelle(s)
          </p>
        </div>
        <div className="flex-center gap-8">
          <button className="btn btn-outline" onClick={handleExportCSV}>Exporter CSV</button>
          <ServiceBadge service="cloudflare" />
        </div>
      </div>

      <div className="page-body">
        {/* ── Stats compactes ────────────────────── */}
        <div className="grid grid-3 mb-16">
          <StatsCard
            label="Nouvelles"
            value={stats.newCount}
            accentColor={COLORS.sky}
            onClick={() => { setFilterStatus('new'); setPage(1); }}
          />
          <StatsCard
            label="En cours"
            value={stats.inProgress}
            accentColor={COLORS.ochre}
            onClick={() => { setFilterStatus('in_progress'); setPage(1); }}
          />
          <StatsCard
            label="Résolues"
            value={stats.resolved}
            sub={stats.avgResponseTime != null ? `~${stats.avgResponseTime} j` : ''}
            accentColor={COLORS.green}
            onClick={() => { setFilterStatus('resolved'); setPage(1); }}
          />
        </div>

        {/* ── Search & filters ────────────────── */}
        <div className="filter-bar mb-16">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Rechercher nom, email, message…"
          />
          <select
            className="filter-select"
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          >
            <option value="all">Tous les statuts</option>
            <option value="new">Nouveau ({stats.newCount})</option>
            <option value="in_progress">En cours ({stats.inProgress})</option>
            <option value="resolved">Résolu ({stats.resolved})</option>
            <option value="archived">Archivé ({stats.archived})</option>
          </select>
          <select
            className="filter-select"
            value={filterSubject}
            onChange={e => { setFilterSubject(e.target.value); setPage(1); }}
          >
            <option value="all">Tous les sujets</option>
            {CONTACT_SUBJECTS.map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <select
            className="filter-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="date_desc">Plus récent</option>
            <option value="date_asc">Plus ancien</option>
            <option value="priority">Priorité</option>
          </select>
        </div>

        {/* ── Solicitation cards ──────────────── */}
        {paginated.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">{'\u{1F4EC}'}</div>
            <p>Aucune sollicitation trouvée</p>
          </div>
        ) : (
          <div className="sollicitation-list">
            {paginated.map((item, i) => (
              <div
                key={item.id}
                className={`sollicitation-card card slide-up${item.status === 'new' ? ' sollicitation-new' : ''}`}
                style={{ animationDelay: `${i * 30}ms`, cursor: 'pointer' }}
                onClick={() => openDetail(item)}
              >
                <div className="sollicitation-card-top">
                  <div className="sollicitation-card-meta">
                    <StatusBadge status={item.status} />
                    <span className="badge badge-navy">{getSubjectLabel(item.subject)}</span>
                    {item.priority && item.priority !== 'normal' && (
                      <PriorityBadge priority={item.priority} />
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: COLORS.textLight }}>{timeAgo(item.submitted_at)}</span>
                </div>

                <div className="sollicitation-card-body">
                  <div className="sollicitation-card-info">
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{item.name || 'Anonyme'}</span>
                    {item.organization && (
                      <span style={{ color: COLORS.textLight, fontSize: 13 }}> — {item.organization}</span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: COLORS.textLight, marginTop: 4 }}>
                    &laquo;{truncate(item.message, 80)}&raquo;
                  </p>
                </div>

                <div className="sollicitation-card-bottom">
                  <div className="flex-center gap-8">
                    {item.assigned_to && (
                      <span style={{ fontSize: 12, color: COLORS.textLight }}>
                        → {item.assigned_to}
                      </span>
                    )}
                    {(item.tags || []).slice(0, 3).map(tag => (
                      <span key={tag} className="sollicitation-tag">{tag}</span>
                    ))}
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); openDetail(item); }}>
                    Ouvrir ➜
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Pagination ──────────────────────── */}
        {totalPages > 1 && (
          <div className="table-footer">
            <span>{filtered.length} résultat(s)</span>
            <div className="pagination">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>←</button>
              {Array.from({ length: Math.min(totalPages, 8) }, (_, i) => {
                let p;
                if (totalPages <= 8) {
                  p = i + 1;
                } else if (page <= 4) {
                  p = i + 1;
                } else if (page >= totalPages - 3) {
                  p = totalPages - 7 + i;
                } else {
                  p = page - 3 + i;
                }
                return (
                  <button
                    key={p}
                    className={page === p ? 'active' : ''}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>→</button>
            </div>
          </div>
        )}

        {/* ── Quick stats bar ────────────────── */}
        {stats.total > 0 && (
          <div className="card fade-in" style={{ marginTop: 24 }}>
            <div className="flex-wrap" style={{ gap: 24, fontSize: 13, color: COLORS.textLight }}>
              <span>Ce mois : <strong style={{ color: COLORS.navy }}>{stats.thisMonthCount}</strong> reçues</span>
              {stats.avgResponseTime != null && (
                <span>Temps moyen de réponse : <strong style={{ color: COLORS.navy }}>{stats.avgResponseTime} j</strong></span>
              )}
              {stats.topSubject && (
                <span>Top sujet : <strong style={{ color: COLORS.navy }}>{stats.topSubject} ({stats.topSubjectPct} %)</strong></span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ DETAIL MODAL ═════════════════════════ */}
      {selected && (
        <Modal title="Détail de la sollicitation" onClose={() => setSelected(null)} size="xl">
          {/* Header actions */}
          <div className="flex-between mb-20">
            <button className="btn btn-outline btn-sm" onClick={() => setSelected(null)}>← Retour</button>
            <div className="flex-center gap-8">
              <button className="btn btn-outline btn-sm" onClick={() => handleArchive(selected.id)}>Archiver</button>
              <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteConfirm(true)}>Supprimer</button>
            </div>
          </div>

          {/* Contact info */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 22, fontFamily: "'Cormorant Garamond', serif", marginBottom: 8 }}>
              {selected.name || 'Anonyme'}
            </h3>
            <div className="flex-wrap" style={{ gap: 16, fontSize: 14, color: COLORS.textLight }}>
              {selected.email && (
                <a href={`mailto:${selected.email}`} style={{ color: COLORS.sky }}>{selected.email}</a>
              )}
              {selected.organization && <span>{selected.organization}</span>}
              {selected.phone && <span>{selected.phone}</span>}
            </div>
            <p style={{ fontSize: 13, color: COLORS.textLight, marginTop: 4 }}>
              Reçu le {formatDateFr(selected.submitted_at)}
              {selected.submitted_at && ` à ${new Date(selected.submitted_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>

          {/* Status / Priority / Assignment */}
          <div className="grid grid-3 mb-20">
            <div>
              <label>Statut</label>
              <select
                value={selected.status}
                onChange={e => handleStatusChange(selected.id, e.target.value)}
              >
                {Object.entries(SOLLICITATION_STATUSES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Priorité</label>
              <select
                value={selected.priority || 'normal'}
                onChange={e => handlePriorityChange(selected.id, e.target.value)}
              >
                {Object.entries(SOLLICITATION_PRIORITIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Assigné à</label>
              <select
                value={selected.assigned_to || ''}
                onChange={e => handleAssignChange(selected.id, e.target.value)}
              >
                <option value="">Non assigné</option>
                {SOLLICITATION_ADMINS.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Subject & Message */}
          <div style={{ marginBottom: 20 }}>
            <label>Objet</label>
            <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>
              <span className="badge badge-navy">{getSubjectLabel(selected.subject)}</span>
            </p>
            <label>Message</label>
            <div style={{
              padding: 16, background: 'var(--cream)', borderRadius: 8,
              fontSize: 14, lineHeight: 1.7, marginTop: 6, whiteSpace: 'pre-wrap'
            }}>
              {selected.message}
            </div>
          </div>

          {/* ── Reply section ──────────────────── */}
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: 16, marginBottom: 8, borderTop: `1px solid ${COLORS.border}`, paddingTop: 16 }}>
              Répondre
            </h4>
            <p style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 8 }}>
              Expéditeur : contact@institut-rousseau.fr → {selected.email}
            </p>
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Rédigez votre réponse…"
              rows={4}
              style={{ marginBottom: 8 }}
            />
            <div className="flex-between">
              <p style={{ fontSize: 11, color: COLORS.textLight }}>
                La réponse sera envoyée par email via Brevo et enregistrée dans l’historique.
              </p>
              <button
                className="btn btn-primary"
                onClick={handleReply}
                disabled={!replyText.trim() || sendingReply}
              >
                {sendingReply ? 'Envoi…' : 'Envoyer la réponse'}
              </button>
            </div>
          </div>

          {/* ── History / Timeline ─────────────── */}
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: 16, marginBottom: 12, borderTop: `1px solid ${COLORS.border}`, paddingTop: 16 }}>
              Historique
            </h4>
            <div className="sollicitation-timeline">
              {/* Initial message */}
              <div className="timeline-item">
                <span className="timeline-icon">{'\u{1F4E8}'}</span>
                <div>
                  <span className="timeline-date">{formatDateShort(selected.submitted_at)}</span>
                  <span className="timeline-text">Message initial reçu</span>
                </div>
              </div>

              {/* Notes & history entries */}
              {(selected.internal_notes || []).map((note, i) => {
                let icon = '\u{1F4DD}';
                if (note.type === 'status_change') icon = '✅';
                if (note.type === 'reply_sent') icon = '\u{1F4E4}';
                if (note.type === 'assign') icon = '\u{1F441}️';
                return (
                  <div key={i} className="timeline-item">
                    <span className="timeline-icon">{icon}</span>
                    <div>
                      <span className="timeline-date">{formatDateShort(note.date)}</span>
                      <span className="timeline-text">{note.text}</span>
                      {note.author && <span className="timeline-author"> — {note.author}</span>}
                    </div>
                  </div>
                );
              })}

              {/* Replies */}
              {(selected.replies || []).map((reply, i) => (
                <div key={`reply-${i}`} className="timeline-item">
                  <span className="timeline-icon">{'\u{1F4E4}'}</span>
                  <div>
                    <span className="timeline-date">{formatDateShort(reply.sent_at)}</span>
                    <span className="timeline-text">Réponse envoyée par {reply.sent_by}</span>
                    <p style={{ fontSize: 13, color: COLORS.textLight, marginTop: 4, fontStyle: 'italic' }}>
                      &laquo;{truncate(reply.text, 120)}&raquo;
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Internal notes ─────────────────── */}
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: 16, marginBottom: 8, borderTop: `1px solid ${COLORS.border}`, paddingTop: 16 }}>
              Notes internes
            </h4>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Ajouter une note interne…"
              rows={2}
              style={{ marginBottom: 8 }}
            />
            <div className="flex-between">
              <p style={{ fontSize: 11, color: COLORS.textLight }}>
                Les notes ne sont visibles que dans le back-office.
              </p>
              <button className="btn btn-outline" onClick={handleAddNote} disabled={!noteText.trim()}>
                Ajouter la note
              </button>
            </div>
          </div>

          {/* ── Tags ───────────────────────────── */}
          <div>
            <h4 style={{ fontSize: 16, marginBottom: 8, borderTop: `1px solid ${COLORS.border}`, paddingTop: 16 }}>
              Tags
            </h4>
            <div className="flex-wrap mb-8" style={{ gap: 6 }}>
              {(selected.tags || []).map(tag => (
                <span key={tag} className="sollicitation-tag" style={{ cursor: 'pointer' }}>
                  {tag}
                  <span
                    onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag); }}
                    style={{ marginLeft: 4, fontWeight: 700, opacity: 0.6 }}
                  >
                    ×
                  </span>
                </span>
              ))}
            </div>
            <div className="flex-center gap-8">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                placeholder="Ajouter un tag…"
                style={{ width: 200 }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
              />
              <button className="btn btn-outline btn-sm" onClick={handleAddTag} disabled={!tagInput.trim()}>
                + Ajouter
              </button>
            </div>
          </div>

          {/* ── Delete confirmation ────────────── */}
          {showDeleteConfirm && (
            <div className="card" style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              padding: 24, zIndex: 200, background: 'var(--white)', boxShadow: 'var(--shadow-md)',
              textAlign: 'center', minWidth: 320
            }}>
              <p style={{ fontSize: 15, marginBottom: 16 }}>
                Voulez-vous vraiment supprimer cette sollicitation ?
              </p>
              <div className="flex-center" style={{ justifyContent: 'center', gap: 8 }}>
                <button className="btn btn-outline" onClick={() => setShowDeleteConfirm(false)}>Annuler</button>
                <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Supprimer</button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
