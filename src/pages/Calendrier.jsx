import { useState, useMemo, useCallback } from 'react';
import Modal from '../components/shared/Modal';
import StatsCard from '../components/shared/StatsCard';
import { COLORS } from '../utils/constants';
import { formatDateFr, formatDateShort } from '../utils/formatters';

// ═══════════════════════════════════════════════════════════
// CALENDRIER — Social Media · Rapports Fondations · Événements
// ═══════════════════════════════════════════════════════════

const SUB_TABS = [
  { key: 'social', label: 'Réseaux sociaux', icon: '📱' },
  { key: 'rapports', label: 'Rapports fondations', icon: '📊' },
  { key: 'extevents', label: 'Événements extérieurs', icon: '🗓' },
];

// ─── Constantes Social Media ──────────────────────────────
const PLATFORMS = [
  { key: 'linkedin', label: 'LinkedIn', color: '#0A66C2' },
  { key: 'x', label: 'X / Twitter', color: '#14171A' },
  { key: 'instagram', label: 'Instagram', color: '#E1306C' },
  { key: 'facebook', label: 'Facebook', color: '#1877F2' },
  { key: 'bluesky', label: 'Bluesky', color: '#0085FF' },
];

const POST_TYPES = [
  'Article IR', 'Thread', 'Visuel', 'Vidéo', 'Réaction actu', 'Relai partenaire',
];

const POST_STATUSES = {
  brouillon: { label: 'Brouillon', badgeClass: 'badge-gray' },
  planifie: { label: 'Planifié', badgeClass: 'badge-sky' },
  publie: { label: 'Publié', badgeClass: 'badge-green' },
};

// ─── Constantes Rapports Fondations ───────────────────────
const REPORT_TYPES = ['Intermédiaire', 'Final'];
const REPORT_STATUSES = {
  a_faire: { label: 'À faire', badgeClass: 'badge-gray' },
  en_cours: { label: 'En cours', badgeClass: 'badge-ochre' },
  envoye: { label: 'Envoyé', badgeClass: 'badge-green' },
};

const DEFAULT_FONDATIONS = ['Fondation de France', 'Fondation Green-Got'];

// ─── Constantes Événements extérieurs ─────────────────────
const EXT_THEMATIQUES = ['Climat', 'Énergie', 'Social', 'Europe', 'Démocratie'];
const EXT_STATUSES = {
  repere: { label: 'Repéré', badgeClass: 'badge-gray' },
  inscrit: { label: 'Inscrit', badgeClass: 'badge-ochre' },
  confirme: { label: 'Confirmé', badgeClass: 'badge-green' },
  decline: { label: 'Décliné', badgeClass: 'badge-terra' },
  passe: { label: 'Passé', badgeClass: 'badge-navy' },
};

const TEAM_MEMBERS = ['Michel', 'Bénédicte', 'Guillaume'];

// ─── Helpers ──────────────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
}

function urgencyColor(days) {
  if (days < 0) return COLORS.text;
  if (days < 15) return COLORS.danger;
  if (days <= 30) return COLORS.ochre;
  return COLORS.green;
}

function urgencyLabel(days) {
  if (days < 0) return 'Dépassé';
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Demain';
  return `${days} j`;
}

function getMonthDays(year, month) {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startDow = (first.getDay() + 6) % 7; // lundi = 0
  const days = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay; d++) days.push(d);
  return days;
}

function toDateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const DOW_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// ═══════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function Calendrier({ socialPosts, setSocialPosts, rapports, setRapports, extEvents, setExtEvents, events = [], toast, onTabChange }) {
  const [subTab, setSubTab] = useState('social');

  return (
    <>
      <div className="page-header slide-up">
        <div>
          <h1>Calendrier</h1>
          <p className="page-header-sub">Planning social media, rapports fondations, événements extérieurs</p>
        </div>
      </div>

      <div className="page-body">
        {/* Sub-tabs */}
        <div className="flex-wrap mb-16" style={{ gap: 6 }}>
          {SUB_TABS.map(st => (
            <button
              key={st.key}
              className={`pill${subTab === st.key ? ' active' : ''}`}
              onClick={() => setSubTab(st.key)}
            >
              {st.icon} {st.label}
            </button>
          ))}
        </div>

        {subTab === 'social' && (
          <SocialMediaCalendar posts={socialPosts} setPosts={setSocialPosts} events={events} toast={toast} onTabChange={onTabChange} />
        )}
        {subTab === 'rapports' && (
          <RapportsFondations rapports={rapports} setRapports={setRapports} toast={toast} />
        )}
        {subTab === 'extevents' && (
          <EvenementsExterieurs extEvents={extEvents} setExtEvents={setExtEvents} toast={toast} />
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// A1 — CALENDRIER RÉSEAUX SOCIAUX
// ═══════════════════════════════════════════════════════════
function SocialMediaCalendar({ posts, setPosts, toast }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [viewMode, setViewMode] = useState('grille'); // grille | liste
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [prefillDate, setPrefillDate] = useState('');

  const emptyForm = { platform: 'linkedin', type: 'Article IR', text: '', status: 'brouillon', date: '', heure: '09:00' };
  const [form, setForm] = useState(emptyForm);

  const days = getMonthDays(year, month);

  // Posts indexés par date
  const postsByDate = useMemo(() => {
    const map = {};
    posts.forEach(p => {
      const key = p.date?.slice(0, 10);
      if (key) (map[key] = map[key] || []).push(p);
    });
    return map;
  }, [posts]);

  // Compteurs par plateforme pour le mois courant
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const platformCounts = useMemo(() => {
    const counts = {};
    PLATFORMS.forEach(p => { counts[p.key] = 0; });
    posts.forEach(p => {
      if (p.date?.startsWith(monthKey)) counts[p.platform] = (counts[p.platform] || 0) + 1;
    });
    return counts;
  }, [posts, monthKey]);

  const openForm = (date) => {
    const d = date || '';
    setPrefillDate(d);
    setForm({ ...emptyForm, date: d });
    setEditingPost(null);
    setShowForm(true);
  };

  const openEdit = (post) => {
    setForm({ ...post });
    setEditingPost(post);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.date) { toast('Veuillez renseigner une date', 'error'); return; }
    if (!form.text.trim()) { toast('Veuillez renseigner le texte du post', 'error'); return; }

    if (editingPost) {
      setPosts(prev => prev.map(p => p.id === editingPost.id ? { ...form, id: editingPost.id } : p));
      toast('Post modifié');
    } else {
      setPosts(prev => [...prev, { ...form, id: Date.now() + Math.random() }]);
      toast('Post ajouté au calendrier');
    }
    setShowForm(false);
  };

  const handleDelete = (id) => {
    setPosts(prev => prev.filter(p => p.id !== id));
    toast('Post supprimé');
  };

  const markPublished = (id) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'publie' } : p));
    toast('Post marqué comme publié');
  };

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const platformObj = (key) => PLATFORMS.find(p => p.key === key) || PLATFORMS[0];

  // Posts à venir triés pour la vue liste
  const upcomingPosts = useMemo(() => {
    const filtered = posts.filter(p => p.date?.startsWith(monthKey));
    return [...filtered].sort((a, b) => (a.date + (a.heure || '')).localeCompare(b.date + (b.heure || '')));
  }, [posts, monthKey]);

  return (
    <>
      {/* Compteurs par plateforme */}
      <div className="grid grid-5 mb-16">
        {PLATFORMS.map(pl => (
          <StatsCard
            key={pl.key}
            label={pl.label}
            value={platformCounts[pl.key]}
            sub={`posts en ${MONTH_NAMES[month].toLowerCase()}`}
            accentColor={pl.color}
          />
        ))}
      </div>

      {/* Navigation mois + toggle vue */}
      <div className="card mb-16" style={{ padding: '12px 20px' }}>
        <div className="flex-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-outline btn-sm" onClick={prevMonth}>◀</button>
            <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Cormorant Garamond, serif', color: COLORS.navy, minWidth: 160, textAlign: 'center' }}>
              {MONTH_NAMES[month]} {year}
            </span>
            <button className="btn btn-outline btn-sm" onClick={nextMonth}>▶</button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={`pill${viewMode === 'grille' ? ' active' : ''}`} onClick={() => setViewMode('grille')}>Grille</button>
            <button className={`pill${viewMode === 'liste' ? ' active' : ''}`} onClick={() => setViewMode('liste')}>Liste</button>
            <button className="btn btn-primary btn-sm" onClick={() => openForm(toDateKey(year, month, new Date().getDate()))}>+ Post</button>
          </div>
        </div>
      </div>

      {/* Vue grille */}
      {viewMode === 'grille' && (
        <div className="card fade-in" style={{ padding: 16 }}>
          <div className="cal-grid-header">
            {DOW_LABELS.map(d => (
              <div key={d} className="cal-dow">{d}</div>
            ))}
          </div>
          <div className="cal-grid">
            {days.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} className="cal-cell cal-cell-empty" />;
              const dateKey = toDateKey(year, month, day);
              const cellPosts = postsByDate[dateKey] || [];
              const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
              return (
                <div
                  key={dateKey}
                  className={`cal-cell${isToday ? ' cal-cell-today' : ''}`}
                  onClick={() => openForm(dateKey)}
                >
                  <span className="cal-day-num">{day}</span>
                  <div className="cal-cell-posts">
                    {cellPosts.slice(0, 3).map(p => {
                      const pl = platformObj(p.platform);
                      return (
                        <div
                          key={p.id}
                          className="cal-post-chip"
                          style={{ borderLeftColor: pl.color }}
                          onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                          title={p.text}
                        >
                          {p.type === 'Réaction actu' && <span style={{ marginRight: 2 }}>⚡</span>}
                          <span className="cal-chip-text">{p.text?.slice(0, 30) || pl.label}</span>
                          {p.status === 'publie' && <span style={{ color: COLORS.green, marginLeft: 'auto', fontSize: 10 }}>✓</span>}
                        </div>
                      );
                    })}
                    {cellPosts.length > 3 && (
                      <span style={{ fontSize: 10, color: COLORS.textLight }}>+{cellPosts.length - 3} autres</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vue liste */}
      {viewMode === 'liste' && (
        <div className="card fade-in">
          {upcomingPosts.length === 0 && (
            <p style={{ color: COLORS.textLight, padding: 20, textAlign: 'center' }}>Aucun post prévu pour {MONTH_NAMES[month].toLowerCase()} {year}</p>
          )}
          {upcomingPosts.map(p => {
            const pl = platformObj(p.platform);
            return (
              <div key={p.id} className="cal-list-row" onClick={() => openEdit(p)}>
                <div style={{ width: 4, borderRadius: 4, background: pl.color, alignSelf: 'stretch', flexShrink: 0 }} />
                <div style={{ minWidth: 80, fontSize: 13, color: COLORS.textLight }}>
                  {formatDateShort(p.date)}<br />{p.heure || ''}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span className="badge" style={{ background: pl.color, color: '#fff', fontSize: 10 }}>{pl.label}</span>
                    <span style={{ fontSize: 12, color: COLORS.textLight }}>{p.type}</span>
                    {p.type === 'Réaction actu' && <span>⚡</span>}
                  </div>
                  <p style={{ fontSize: 14, color: COLORS.navy, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.text}</p>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  <span className={`badge ${POST_STATUSES[p.status]?.badgeClass || 'badge-gray'}`}>{POST_STATUSES[p.status]?.label || p.status}</span>
                  {p.status !== 'publie' && (
                    <button className="btn btn-green btn-sm" onClick={(e) => { e.stopPropagation(); markPublished(p.id); }}>✓ Publié</button>
                  )}
                  <button className="btn btn-outline btn-sm" style={{ color: COLORS.danger }} onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modale ajout/édition post */}
      {showForm && (
        <Modal title={editingPost ? 'Modifier le post' : 'Nouveau post'} onClose={() => setShowForm(false)} footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSave}>{editingPost ? 'Enregistrer' : 'Ajouter'}</button>
          </div>
        }>
          <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, display: 'block', marginBottom: 4 }}>Plateforme</label>
                <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                  {PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, display: 'block', marginBottom: 4 }}>Type de contenu</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {POST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, display: 'block', marginBottom: 4 }}>Date</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, display: 'block', marginBottom: 4 }}>Heure</label>
                <input type="time" value={form.heure} onChange={e => setForm(f => ({ ...f, heure: e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, display: 'block', marginBottom: 4 }}>Statut</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {Object.entries(POST_STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, display: 'block', marginBottom: 4 }}>Texte du post</label>
              <textarea rows={4} value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} placeholder="Contenu du post..." />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// A2 — RAPPORTS FONDATIONS
// ═══════════════════════════════════════════════════════════
function RapportsFondations({ rapports, setRapports, toast }) {
  const [showForm, setShowForm] = useState(false);
  const [editingRapport, setEditingRapport] = useState(null);
  const emptyForm = { fondation: DEFAULT_FONDATIONS[0], type: 'Intermédiaire', deadline: '', status: 'a_faire', responsable: 'Bénédicte', notes: '', dateEnvoi: '' };
  const [form, setForm] = useState(emptyForm);
  const [statusFilter, setStatusFilter] = useState('all');

  const openAdd = () => { setForm(emptyForm); setEditingRapport(null); setShowForm(true); };
  const openEdit = (r) => { setForm({ ...r }); setEditingRapport(r); setShowForm(true); };

  const handleSave = () => {
    if (!form.fondation.trim()) { toast('Veuillez renseigner la fondation', 'error'); return; }
    if (!form.deadline) { toast('Veuillez renseigner la deadline', 'error'); return; }

    if (editingRapport) {
      setRapports(prev => prev.map(r => r.id === editingRapport.id ? { ...form, id: editingRapport.id } : r));
      toast('Rapport modifié');
    } else {
      setRapports(prev => [...prev, { ...form, id: Date.now() + Math.random() }]);
      toast('Rapport ajouté');
    }
    setShowForm(false);
  };

  const handleDelete = (id) => { setRapports(prev => prev.filter(r => r.id !== id)); toast('Rapport supprimé'); };

  const markSent = (id) => {
    const today = new Date().toISOString().slice(0, 10);
    setRapports(prev => prev.map(r => r.id === id ? { ...r, status: 'envoye', dateEnvoi: today } : r));
    toast('Rapport marqué comme envoyé');
  };

  // Tri par deadline
  const sorted = useMemo(() => {
    let items = [...rapports];
    if (statusFilter !== 'all') items = items.filter(r => r.status === statusFilter);
    return items.sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));
  }, [rapports, statusFilter]);

  // Alertes urgentes
  const urgentCount = rapports.filter(r => r.status !== 'envoye' && daysUntil(r.deadline) < 15).length;

  // Fondations uniques (pour l'autocomplete)
  const allFondations = useMemo(() => {
    const set = new Set(DEFAULT_FONDATIONS);
    rapports.forEach(r => { if (r.fondation) set.add(r.fondation); });
    return [...set];
  }, [rapports]);

  return (
    <>
      {/* Alerte urgente */}
      {urgentCount > 0 && (
        <div className="alert-banner alert-banner-danger mb-16 slide-up">
          <span className="alert-banner-icon">⚠</span>
          <strong>{urgentCount} rapport{urgentCount > 1 ? 's' : ''} urgent{urgentCount > 1 ? 's' : ''}</strong> — deadline dans moins de 15 jours
        </div>
      )}

      {/* Stats rapides */}
      <div className="grid grid-4 mb-16">
        <StatsCard label="Total rapports" value={rapports.length} sub="tous statuts" accentColor={COLORS.navy} />
        <StatsCard label="À faire" value={rapports.filter(r => r.status === 'a_faire').length} sub="en attente" accentColor={COLORS.ochre} />
        <StatsCard label="En cours" value={rapports.filter(r => r.status === 'en_cours').length} sub="en rédaction" accentColor={COLORS.sky} />
        <StatsCard label="Envoyés" value={rapports.filter(r => r.status === 'envoye').length} sub="terminés" accentColor={COLORS.green} />
      </div>

      {/* Filtres + action */}
      <div className="card mb-16" style={{ padding: '12px 20px' }}>
        <div className="flex-between">
          <div className="flex-wrap" style={{ gap: 6 }}>
            {[{ key: 'all', label: 'Tous' }, ...Object.entries(REPORT_STATUSES).map(([k, v]) => ({ key: k, label: v.label }))].map(f => (
              <button key={f.key} className={`pill${statusFilter === f.key ? ' active' : ''}`} onClick={() => setStatusFilter(f.key)}>{f.label}</button>
            ))}
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Rapport</button>
        </div>
      </div>

      {/* Tableau */}
      <div className="card fade-in" style={{ overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Fondation</th>
              <th>Type</th>
              <th>Deadline</th>
              <th>Délai</th>
              <th>Statut</th>
              <th>Responsable</th>
              <th>Notes</th>
              <th style={{ width: 140 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: COLORS.textLight, padding: 24 }}>Aucun rapport</td></tr>
            )}
            {sorted.map(r => {
              const days = daysUntil(r.deadline);
              const uc = urgencyColor(days);
              return (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.fondation}</td>
                  <td>{r.type}</td>
                  <td>{formatDateShort(r.deadline)}</td>
                  <td>
                    {r.status === 'envoye' ? (
                      <span style={{ color: COLORS.green, fontSize: 12 }}>Envoyé{r.dateEnvoi ? ` le ${formatDateShort(r.dateEnvoi)}` : ''}</span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: COLORS.border, overflow: 'hidden' }}>
                          <div style={{
                            width: `${days <= 0 ? 100 : Math.max(0, 100 - (days / 60) * 100)}%`,
                            height: '100%', borderRadius: 3, background: uc, transition: 'width 0.3s',
                          }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: uc, whiteSpace: 'nowrap' }}>{urgencyLabel(days)}</span>
                      </div>
                    )}
                  </td>
                  <td><span className={`badge ${REPORT_STATUSES[r.status]?.badgeClass || 'badge-gray'}`}>{REPORT_STATUSES[r.status]?.label || r.status}</span></td>
                  <td>{r.responsable}</td>
                  <td style={{ fontSize: 12, color: COLORS.textLight, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.notes}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(r)}>Modifier</button>
                      {r.status !== 'envoye' && <button className="btn btn-green btn-sm" onClick={() => markSent(r.id)}>Envoyé</button>}
                      <button className="btn btn-outline btn-sm" style={{ color: COLORS.danger }} onClick={() => handleDelete(r.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modale ajout/édition */}
      {showForm && (
        <Modal title={editingRapport ? 'Modifier le rapport' : 'Nouveau rapport'} onClose={() => setShowForm(false)} footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSave}>{editingRapport ? 'Enregistrer' : 'Ajouter'}</button>
          </div>
        }>
          <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, display: 'block', marginBottom: 4 }}>Fondation</label>
              <input list="fondations-list" value={form.fondation} onChange={e => setForm(f => ({ ...f, fondation: e.target.value }))} placeholder="Nom de la fondation" />
              <datalist id="fondations-list">
                {allFondations.map(f => <option key={f} value={f} />)}
              </datalist>
            </div>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, display: 'block', marginBottom: 4 }}>Type de rapport</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {REPORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, display: 'block', marginBottom: 4 }}>Deadline</label>
                <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, display: 'block', marginBottom: 4 }}>Statut</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {Object.entries(REPORT_STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, display: 'block', marginBottom: 4 }}>Responsable</label>
                <select value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))}>
                  {TEAM_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, display: 'block', marginBottom: 4 }}>Notes</label>
              <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes, consignes..." />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// A3 — ÉVÉNEMENTS EXTÉRIEURS
// ═══════════════════════════════════════════════════════════
function EvenementsExterieurs({ extEvents, setExtEvents, toast }) {
  const [showForm, setShowForm] = useState(false);
  const [editingEvt, setEditingEvt] = useState(null);
  const [viewMode, setViewMode] = useState('liste');
  const [filterTheme, setFilterTheme] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');

  const emptyForm = {
    nom: '', dateDebut: '', dateFin: '', lieu: '', organisateur: '',
    thematique: 'Climat', pertinence: 3, status: 'repere', quiYVa: [], notes: '',
  };
  const [form, setForm] = useState(emptyForm);

  const openAdd = () => { setForm(emptyForm); setEditingEvt(null); setShowForm(true); };
  const openEdit = (evt) => { setForm({ ...evt }); setEditingEvt(evt); setShowForm(true); };

  const handleSave = () => {
    if (!form.nom.trim()) { toast('Veuillez renseigner le nom', 'error'); return; }
    if (!form.dateDebut) { toast('Veuillez renseigner la date', 'error'); return; }

    if (editingEvt) {
      setExtEvents(prev => prev.map(e => e.id === editingEvt.id ? { ...form, id: editingEvt.id } : e));
      toast('Événement modifié');
    } else {
      setExtEvents(prev => [...prev, { ...form, id: Date.now() + Math.random() }]);
      toast('Événement ajouté');
    }
    setShowForm(false);
  };

  const handleDelete = (id) => { setExtEvents(prev => prev.filter(e => e.id !== id)); toast('Événement supprimé'); };

  // Filtrage & tri
  const filtered = useMemo(() => {
    let items = [...extEvents];
    if (filterTheme !== 'all') items = items.filter(e => e.thematique === filterTheme);
    if (filterMonth !== 'all') items = items.filter(e => e.dateDebut?.slice(5, 7) === filterMonth);
    return items.sort((a, b) => (a.dateDebut || '').localeCompare(b.dateDebut || ''));
  }, [extEvents, filterTheme, filterMonth]);

  // Mini-calendrier : mois avec événements
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const calDays = getMonthDays(calYear, calMonth);
  const evtDatesSet = useMemo(() => {
    const set = new Set();
    extEvents.forEach(e => { if (e.dateDebut) set.add(e.dateDebut.slice(0, 10)); });
    return set;
  }, [extEvents]);

  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); };

  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

  return (
    <>
      {/* Stats */}
      <div className="grid grid-4 mb-16">
        <StatsCard label="Total" value={extEvents.length} sub="événements" accentColor={COLORS.navy} />
        <StatsCard label="À venir" value={extEvents.filter(e => e.dateDebut && new Date(e.dateDebut) >= now && e.status !== 'decline').length} sub="confirmés ou repérés" accentColor={COLORS.sky} />
        <StatsCard label="Confirmés" value={extEvents.filter(e => e.status === 'confirme').length} sub="participation" accentColor={COLORS.green} />
        <StatsCard label="Cette semaine" value={extEvents.filter(e => { const d = daysUntil(e.dateDebut); return d >= 0 && d <= 7 && e.status !== 'decline'; }).length} sub="prochainement" accentColor={COLORS.ochre} />
      </div>

      {/* Filtres + toggle */}
      <div className="card mb-16" style={{ padding: '12px 20px' }}>
        <div className="flex-between flex-wrap" style={{ gap: 8 }}>
          <div className="flex-wrap" style={{ gap: 6 }}>
            <button className={`pill${filterTheme === 'all' ? ' active' : ''}`} onClick={() => setFilterTheme('all')}>Tous</button>
            {EXT_THEMATIQUES.map(t => (
              <button key={t} className={`pill${filterTheme === t ? ' active' : ''}`} onClick={() => setFilterTheme(t)}>{t}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ width: 'auto', padding: '4px 10px', fontSize: 13 }}>
              <option value="all">Tous les mois</option>
              {MONTH_NAMES.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
            </select>
            <button className={`pill${viewMode === 'liste' ? ' active' : ''}`} onClick={() => setViewMode('liste')}>Liste</button>
            <button className={`pill${viewMode === 'mini-cal' ? ' active' : ''}`} onClick={() => setViewMode('mini-cal')}>Calendrier</button>
            <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Événement</button>
          </div>
        </div>
      </div>

      {/* Vue liste */}
      {viewMode === 'liste' && (
        <div className="card fade-in">
          {filtered.length === 0 && (
            <p style={{ color: COLORS.textLight, padding: 20, textAlign: 'center' }}>Aucun événement extérieur</p>
          )}
          {filtered.map(evt => (
            <div key={evt.id} className="cal-list-row" onClick={() => openEdit(evt)}>
              <div style={{ minWidth: 80, fontSize: 13, color: COLORS.textLight }}>
                {formatDateShort(evt.dateDebut)}
                {evt.dateFin && evt.dateFin !== evt.dateDebut && <><br /><span style={{ fontSize: 11 }}>→ {formatDateShort(evt.dateFin)}</span></>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: COLORS.navy, margin: 0 }}>{evt.nom}</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                  {evt.lieu && <span style={{ fontSize: 12, color: COLORS.textLight }}>📍 {evt.lieu}</span>}
                  {evt.organisateur && <span style={{ fontSize: 12, color: COLORS.textLight }}>par {evt.organisateur}</span>}
                  <span className="badge badge-navy" style={{ fontSize: 10 }}>{evt.thematique}</span>
                  <span style={{ fontSize: 12, color: COLORS.ochre, letterSpacing: 1 }}>{stars(evt.pertinence)}</span>
                </div>
                {evt.quiYVa?.length > 0 && (
                  <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {evt.quiYVa.map(name => <span key={name} className="badge badge-sky" style={{ fontSize: 10 }}>{name}</span>)}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                <span className={`badge ${EXT_STATUSES[evt.status]?.badgeClass || 'badge-gray'}`}>{EXT_STATUSES[evt.status]?.label || evt.status}</span>
                <button className="btn btn-outline btn-sm" style={{ color: COLORS.danger }} onClick={(e) => { e.stopPropagation(); handleDelete(evt.id); }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mini-calendrier */}
      {viewMode === 'mini-cal' && (
        <div className="card fade-in" style={{ padding: 16 }}>
          <div className="flex-between mb-16">
            <button className="btn btn-outline btn-sm" onClick={prevMonth}>◀</button>
            <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Cormorant Garamond, serif', color: COLORS.navy }}>
              {MONTH_NAMES[calMonth]} {calYear}
            </span>
            <button className="btn btn-outline btn-sm" onClick={nextMonth}>▶</button>
          </div>
          <div className="cal-grid-header">
            {DOW_LABELS.map(d => <div key={d} className="cal-dow">{d}</div>)}
          </div>
          <div className="cal-grid cal-grid-mini">
            {calDays.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} className="cal-cell cal-cell-empty" style={{ minHeight: 36 }} />;
              const dateKey = toDateKey(calYear, calMonth, day);
              const hasEvt = evtDatesSet.has(dateKey);
              const isToday = day === now.getDate() && calMonth === now.getMonth() && calYear === now.getFullYear();
              return (
                <div key={dateKey} className={`cal-cell${isToday ? ' cal-cell-today' : ''}`} style={{ minHeight: 36, justifyContent: 'center', alignItems: 'center', cursor: 'default' }}>
                  <span className="cal-day-num" style={{ fontSize: 13 }}>{day}</span>
                  {hasEvt && <div style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.sky, margin: '2px auto 0' }} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modale ajout/édition */}
      {showForm && (
        <Modal title={editingEvt ? 'Modifier l\'événement' : 'Nouvel événement extérieur'} onClose={() => setShowForm(false)} size="lg" footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSave}>{editingEvt ? 'Enregistrer' : 'Ajouter'}</button>
          </div>
        }>
          <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, display: 'block', marginBottom: 4 }}>Nom de l'événement</label>
              <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Ex: Forum Mondial de l'Eau" />
            </div>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, display: 'block', marginBottom: 4 }}>Date de début</label>
                <input type="date" value={form.dateDebut} onChange={e => setForm(f => ({ ...f, dateDebut: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, display: 'block', marginBottom: 4 }}>Date de fin (optionnel)</label>
                <input type="date" value={form.dateFin || ''} onChange={e => setForm(f => ({ ...f, dateFin: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, display: 'block', marginBottom: 4 }}>Lieu</label>
                <input value={form.lieu} onChange={e => setForm(f => ({ ...f, lieu: e.target.value }))} placeholder="Ville, salle..." />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, display: 'block', marginBottom: 4 }}>Organisateur</label>
                <input value={form.organisateur} onChange={e => setForm(f => ({ ...f, organisateur: e.target.value }))} placeholder="Nom de l'organisateur" />
              </div>
            </div>
            <div className="grid grid-3" style={{ gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, display: 'block', marginBottom: 4 }}>Thématique</label>
                <select value={form.thematique} onChange={e => setForm(f => ({ ...f, thematique: e.target.value }))}>
                  {EXT_THEMATIQUES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, display: 'block', marginBottom: 4 }}>Pertinence (1-5)</label>
                <select value={form.pertinence} onChange={e => setForm(f => ({ ...f, pertinence: Number(e.target.value) }))}>
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{stars(n)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, display: 'block', marginBottom: 4 }}>Statut</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {Object.entries(EXT_STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, display: 'block', marginBottom: 4 }}>Qui y va ?</label>
              <div className="flex-wrap" style={{ gap: 6 }}>
                {TEAM_MEMBERS.map(m => (
                  <button
                    key={m}
                    className={`pill${(form.quiYVa || []).includes(m) ? ' active' : ''}`}
                    onClick={() => setForm(f => ({
                      ...f,
                      quiYVa: (f.quiYVa || []).includes(m) ? f.quiYVa.filter(x => x !== m) : [...(f.quiYVa || []), m],
                    }))}
                  >{m}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, display: 'block', marginBottom: 4 }}>Notes / Objectifs</label>
              <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Pourquoi y aller, contacts à rencontrer..." />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// Export des helpers pour le Dashboard
export { daysUntil, urgencyColor, urgencyLabel };
