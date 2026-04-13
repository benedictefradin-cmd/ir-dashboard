import { useState, useMemo } from 'react';
import StatsCard from '../components/shared/StatsCard';
import ServiceBadge from '../components/shared/ServiceBadge';
import Modal from '../components/shared/Modal';
import { SkeletonCard } from '../components/shared/SkeletonLoader';
import { formatDateFr } from '../utils/formatters';
import { COLORS, EVT_TYPES, EVT_STATUSES } from '../utils/constants';
import { hasGitHub } from '../services/github';

const isFuture = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d >= today;
};

const emptyForm = {
  date: '',
  type: 'Conférence',
  title: '',
  sousTitre: '',
  description: '',
  lieu: '',
  intervenants: [{ name: '', titre: '' }],
  partenaire: '',
  lienInscription: '',
  lienConcours: '',
  inscriptions: 0,
  status: 'confirme',
  externe: false,
};

const statusDot = (status, isPast) => {
  if (isPast && status !== 'annule') return COLORS.textLight;
  if (status === 'confirme') return COLORS.green;
  if (status === 'en_preparation') return COLORS.ochre;
  if (status === 'annule') return COLORS.terra;
  return COLORS.textLight;
};

export default function Evenements({ events, setEvents, loading, toast, saveToSite }) {
  const [showForm, setShowForm] = useState(false);
  const [editingEvt, setEditingEvt] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [publishingId, setPublishingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [previewEvt, setPreviewEvt] = useState(null);
  const [formMode, setFormMode] = useState('template'); // 'template' | 'classique'

  // Stats
  const stats = useMemo(() => {
    const aVenir = events.filter(e => isFuture(e.date) && e.status !== 'annule').length;
    const passes = events.filter(e => !isFuture(e.date)).length;
    const enPrep = events.filter(e => e.status === 'en_preparation').length;
    return { aVenir, passes, enPrep };
  }, [events]);

  // Filtrage + tri : futurs d'abord, puis passés
  const sorted = useMemo(() => {
    let list = events;
    if (statusFilter === 'a_venir') list = list.filter(e => isFuture(e.date) && e.status !== 'annule');
    else if (statusFilter === 'passe') list = list.filter(e => !isFuture(e.date));
    else if (statusFilter !== 'all') list = list.filter(e => e.status === statusFilter);
    const futurs = list.filter(e => isFuture(e.date)).sort((a, b) => new Date(a.date) - new Date(b.date));
    const passes = list.filter(e => !isFuture(e.date)).sort((a, b) => new Date(b.date) - new Date(a.date));
    return [...futurs, ...passes];
  }, [events, statusFilter]);

  // Form helpers
  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const addIntervenant = () => setForm(prev => ({ ...prev, intervenants: [...prev.intervenants, { name: '', titre: '' }] }));
  const removeIntervenant = (idx) => setForm(prev => ({ ...prev, intervenants: prev.intervenants.filter((_, i) => i !== idx) }));
  const updateIntervenant = (idx, key, val) => setForm(prev => ({
    ...prev, intervenants: prev.intervenants.map((item, i) => (i === idx ? { ...item, [key]: val } : item)),
  }));

  const openNew = () => {
    setEditingEvt(null);
    setForm({ ...emptyForm, intervenants: [{ name: '', titre: '' }] });
    setShowForm(true);
  };

  const openEdit = (evt) => {
    setEditingEvt(evt);
    setForm({
      date: evt.date || '', type: evt.type || 'Conférence', title: evt.title || '',
      sousTitre: evt.sousTitre || '', description: evt.description || '', lieu: evt.lieu || '',
      intervenants: evt.intervenants?.length ? evt.intervenants.map(i => ({ ...i })) : [{ name: '', titre: '' }],
      partenaire: evt.partenaire || '', lienInscription: evt.lienInscription || '',
      lienConcours: evt.lienConcours || '', inscriptions: evt.inscriptions || 0,
      status: evt.status || 'confirme',
      externe: evt.externe || false,
    });
    setShowForm(true);
  };

  const saveEvent = () => {
    if (!form.title) return toast('Le titre est requis', 'error');
    if (!form.date) return toast('La date est requise', 'error');
    const cleanIntervenants = form.intervenants.filter(i => i.name.trim());
    if (editingEvt) {
      setEvents(prev => prev.map(e => e.id === editingEvt.id ? { ...e, ...form, intervenants: cleanIntervenants } : e));
      toast('Événement mis à jour');
    } else {
      setEvents(prev => [{ ...form, intervenants: cleanIntervenants, id: Date.now() }, ...prev]);
      toast('Événement ajouté');
    }
    setShowForm(false);
    setEditingEvt(null);
  };

  const deleteEvent = (id) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    setConfirmDelete(null);
    toast('Événement supprimé');
  };

  const archivePasses = () => {
    let count = 0;
    setEvents(prev => prev.map(e => {
      if (!isFuture(e.date) && e.status !== 'passe' && e.status !== 'annule') { count++; return { ...e, status: 'passe' }; }
      return e;
    }));
    toast(`${count} événement(s) archivé(s)`);
  };

  // Publier tous les événements sur le site via data/events.json
  const publishEvent = async () => {
    setPublishingId('all');
    try {
      if (hasGitHub() && saveToSite) {
        const cleanEvents = events.map(({ id, date, type, title, sousTitre, lieu, intervenants, partenaire, description, lienInscription, status }) => ({
          id, date, type, title, sousTitre, lieu, intervenants: (intervenants || []).filter(i => i.name), partenaire, description, lienInscription, status,
        }));
        await saveToSite('events', cleanEvents, 'Mise à jour événements depuis le back-office');
        toast('Événements publiés sur le site');
      } else {
        toast('GitHub non configuré — allez dans Config', 'error');
      }
    } catch (e) {
      toast(e.message || 'Erreur de publication', 'error');
    }
    setPublishingId(null);
  };

  if (loading) {
    return (
      <div className="page-body">
        <div className="grid grid-3 mb-24"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Événements</h1>
          <p className="page-header-sub">{events.length} événement(s) au total</p>
        </div>
        <div className="flex-center gap-8">
          <ServiceBadge service="github" />
          {saveToSite && hasGitHub() && (
            <button className="btn btn-green" onClick={publishEvent} disabled={publishingId === 'all'}>
              {publishingId === 'all' ? 'Publication…' : 'Publier sur le site'}
            </button>
          )}
          <button className="btn btn-outline" onClick={archivePasses}>Archiver les passés</button>
          <button className="btn btn-primary" onClick={openNew}>+ Nouvel événement</button>
        </div>
      </div>

      <div className="page-body">
        {!hasGitHub() && (
          <div className="alert-banner alert-warning mb-16">
            Mode démo — configurez VITE_GITHUB_TOKEN pour publier sur le site
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-3 mb-24">
          <StatsCard label="À venir" value={stats.aVenir} accentColor={COLORS.green} sub="confirmés ou en préparation" />
          <StatsCard label="Passés" value={stats.passes} accentColor={COLORS.textLight} sub="événements terminés" />
          <StatsCard label="En préparation" value={stats.enPrep} accentColor={COLORS.ochre} sub="à confirmer" />
        </div>

        {/* Filtre par statut */}
        <div className="flex-wrap mb-16" style={{ gap: 8 }}>
          {[
            ['all', 'Tous'],
            ['a_venir', 'À venir'],
            ['confirme', 'Confirmés'],
            ['en_preparation', 'En préparation'],
            ['passe', 'Passés'],
            ['annule', 'Annulés'],
          ].map(([key, label]) => (
            <span
              key={key}
              className={`pill${statusFilter === key ? ' active' : ''}`}
              onClick={() => setStatusFilter(key)}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Formulaire */}
        {showForm && (
          <div className="card mb-24 slide-down" style={{ padding: 24 }}>
            <div className="flex-between mb-16">
              <h3>{editingEvt ? "Modifier l\u2019\u00e9v\u00e9nement" : "Nouvel \u00e9v\u00e9nement"}</h3>
              {!editingEvt && (
                <div className="flex-center gap-8">
                  <span
                    className={`pill${formMode === 'template' ? ' active' : ''}`}
                    onClick={() => setFormMode('template')}
                  >
                    Texte à trou
                  </span>
                  <span
                    className={`pill${formMode === 'classique' ? ' active' : ''}`}
                    onClick={() => setFormMode('classique')}
                  >
                    Formulaire classique
                  </span>
                </div>
              )}
            </div>

            {/* ── Mode texte à trou ──────────────── */}
            {(formMode === 'template' && !editingEvt) && (
              <div style={{ fontSize: 15, lineHeight: 2.4, color: COLORS.navy }}>
                <p>
                  Le{' '}
                  <input type="date" value={form.date} onChange={e => setField('date', e.target.value)}
                    style={{ display: 'inline-block', width: 160, padding: '4px 8px', fontSize: 14 }} />{', '}
                  <select value={form.type} onChange={e => setField('type', e.target.value)}
                    style={{ display: 'inline-block', width: 140, padding: '4px 8px', fontSize: 14 }}>
                    {EVT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {' « '}
                  <input value={form.title} onChange={e => setField('title', e.target.value)}
                    placeholder="titre de l'événement"
                    style={{ display: 'inline-block', width: 280, padding: '4px 8px', fontSize: 14 }} />
                  {' »'}
                </p>
                <p>
                  {'à '}
                  <input value={form.lieu} onChange={e => setField('lieu', e.target.value)}
                    placeholder="adresse complète"
                    style={{ display: 'inline-block', width: 320, padding: '4px 8px', fontSize: 14 }} />
                  {', en partenariat avec '}
                  <input value={form.partenaire} onChange={e => setField('partenaire', e.target.value)}
                    placeholder="partenaire (optionnel)"
                    style={{ display: 'inline-block', width: 200, padding: '4px 8px', fontSize: 14 }} />
                  {'.'}
                </p>
                <p>
                  {'Intervenant(s) : '}
                  {form.intervenants.map((inter, idx) => (
                    <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {idx > 0 && ', '}
                      <input value={inter.name} onChange={e => updateIntervenant(idx, 'name', e.target.value)}
                        placeholder="Nom"
                        style={{ display: 'inline-block', width: 140, padding: '4px 8px', fontSize: 14 }} />
                      {' ('}
                      <input value={inter.titre} onChange={e => updateIntervenant(idx, 'titre', e.target.value)}
                        placeholder="fonction"
                        style={{ display: 'inline-block', width: 140, padding: '4px 8px', fontSize: 14 }} />
                      {')'}
                      {form.intervenants.length > 1 && (
                        <button className="btn btn-outline btn-sm" onClick={() => removeIntervenant(idx)}
                          style={{ color: 'var(--terra)', padding: '0 4px', minWidth: 0, lineHeight: 1 }}>&times;</button>
                      )}
                    </span>
                  ))}
                  {' '}
                  <button className="btn btn-outline btn-sm" onClick={addIntervenant} style={{ fontSize: 12 }}>+</button>
                </p>
                <div style={{ marginTop: 12 }}>
                  <textarea rows={2} value={form.description} onChange={e => setField('description', e.target.value)}
                    placeholder="Description (optionnel)" style={{ fontSize: 14 }} />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, fontSize: 14 }}>
                  <input value={form.lienInscription} onChange={e => setField('lienInscription', e.target.value)}
                    placeholder="Lien inscription (https://…)" style={{ flex: 1, minWidth: 200, padding: '4px 8px', fontSize: 14 }} />
                  <input value={form.lienConcours} onChange={e => setField('lienConcours', e.target.value)}
                    placeholder="Lien concours (optionnel)" style={{ flex: 1, minWidth: 200, padding: '4px 8px', fontSize: 14 }} />
                </div>
              </div>
            )}

            {/* ── Mode formulaire classique ──────── */}
            {(formMode === 'classique' || editingEvt) && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div><label>Date *</label><input type="date" value={form.date} onChange={e => setField('date', e.target.value)} /></div>
                  <div><label>Type</label>
                    <select value={form.type} onChange={e => setField('type', e.target.value)}>
                      {EVT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><label>Statut</label>
                    <select value={form.status} onChange={e => setField('status', e.target.value)}>
                      {Object.entries(EVT_STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <label style={{ margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={form.externe} onChange={e => setField('externe', e.target.checked)} />
                    Événement extérieur (non organisé par l'IR)
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div><label>Titre *</label><input value={form.title} onChange={e => setField('title', e.target.value)} placeholder="Titre de l\u2019événement" /></div>
                  <div><label>Sous-titre</label><input value={form.sousTitre} onChange={e => setField('sousTitre', e.target.value)} placeholder="Optionnel" /></div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label>Description</label>
                  <textarea rows={3} value={form.description} onChange={e => setField('description', e.target.value)} placeholder="Description de l\u2019événement" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div><label>Lieu / Adresse</label><input value={form.lieu} onChange={e => setField('lieu', e.target.value)} /></div>
                  <div><label>Partenaire</label><input value={form.partenaire} onChange={e => setField('partenaire', e.target.value)} placeholder="Optionnel" /></div>
                  <div><label>Lien d&rsquo;inscription</label><input value={form.lienInscription} onChange={e => setField('lienInscription', e.target.value)} placeholder="https://..." /></div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label>Lien concours (optionnel)</label>
                    <input value={form.lienConcours} onChange={e => setField('lienConcours', e.target.value)} placeholder="https://..." />
                  </div>
                  <div>
                    <label>Nombre d'inscriptions</label>
                    <input type="number" min="0" value={form.inscriptions} onChange={e => setField('inscriptions', parseInt(e.target.value) || 0)} placeholder="0" />
                  </div>
                </div>

                {/* Intervenants */}
                <div style={{ marginBottom: 16 }}>
                  <label>Intervenants</label>
                  {form.intervenants.map((inter, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <input value={inter.name} onChange={e => updateIntervenant(idx, 'name', e.target.value)} placeholder="Nom" style={{ flex: 1 }} />
                      <input value={inter.titre} onChange={e => updateIntervenant(idx, 'titre', e.target.value)} placeholder="Titre / Fonction" style={{ flex: 1 }} />
                      {form.intervenants.length > 1 && (
                        <button className="btn btn-outline btn-sm" onClick={() => removeIntervenant(idx)} style={{ color: 'var(--terra)' }}>&times;</button>
                      )}
                    </div>
                  ))}
                  <button className="btn btn-outline btn-sm" onClick={addIntervenant}>+ Ajouter un intervenant</button>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-primary" onClick={saveEvent}>{editingEvt ? 'Enregistrer' : 'Ajouter'}</button>
              <button className="btn btn-outline" onClick={() => { setShowForm(false); setEditingEvt(null); }}>Annuler</button>
            </div>
          </div>
        )}

        {/* Liste des événements */}
        {sorted.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-light)' }}>Aucun événement</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sorted.map(evt => {
              const past = !isFuture(evt.date);
              const d = evt.date ? new Date(evt.date) : null;
              const statusCfg = EVT_STATUSES[evt.status] || EVT_STATUSES.confirme;
              const dotColor = statusDot(evt.status, past);

              return (
                <div key={evt.id} className="card" style={{ display: 'flex', gap: 16, padding: 16, opacity: past ? 0.5 : 1 }}>
                  {/* Date */}
                  <div style={{ minWidth: 70, textAlign: 'center', padding: '8px 4px', borderRight: '2px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {d && <>
                      <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)', lineHeight: 1 }}>{d.getDate()}</span>
                      <span style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-light)', marginTop: 2 }}>{d.toLocaleDateString('fr-FR', { month: 'short' })}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-light)' }}>{d.getFullYear()}</span>
                    </>}
                  </div>

                  {/* Contenu */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span className="badge badge-navy" style={{ fontSize: 11 }}>{evt.type || 'Événement'}</span>
                      {evt.externe && <span className="badge badge-ochre" style={{ fontSize: 10 }}>Extérieur</span>}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: dotColor }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
                        {past && evt.status !== 'annule' ? 'Passé' : statusCfg.label}
                      </span>
                    </div>
                    <h4 style={{ margin: '2px 0', color: 'var(--navy)' }}>{evt.title}</h4>
                    {evt.sousTitre && <p style={{ margin: '2px 0', fontSize: 13, color: 'var(--text-light)' }}>{evt.sousTitre}</p>}
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, fontSize: 13, color: 'var(--text-light)' }}>
                      {evt.lieu && <span>{evt.lieu}</span>}
                      {evt.partenaire && <span>Partenaire : {evt.partenaire}</span>}
                      {evt.inscriptions > 0 && <span style={{ color: COLORS.sky }}>{evt.inscriptions} inscription{evt.inscriptions > 1 ? 's' : ''}</span>}
                    </div>
                    {evt.intervenants?.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {evt.intervenants.map((inter, i) => (
                          <span key={i} className="pill" style={{ fontSize: 12 }}>{inter.name}{inter.titre ? ` — ${inter.titre}` : ''}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(evt)}>Modifier</button>
                    <button className="btn btn-outline btn-sm" onClick={() => setPreviewEvt(evt)}>Prévisualiser</button>
                    <button className="btn btn-outline btn-sm" style={{ color: 'var(--terra)' }} onClick={() => setConfirmDelete(evt)}>Supprimer</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal suppression */}
      {confirmDelete && (
        <Modal title="Supprimer l'événement" onClose={() => setConfirmDelete(null)}>
          <p style={{ marginBottom: 8 }}>Voulez-vous vraiment supprimer <strong>{confirmDelete.title}</strong> ?</p>
          <p style={{ color: 'var(--text-light)', fontSize: 13 }}>Cette action est irréversible.</p>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setConfirmDelete(null)}>Annuler</button>
            <button className="btn btn-terra" onClick={() => deleteEvent(confirmDelete.id)}>Supprimer</button>
          </div>
        </Modal>
      )}

      {/* Modal prévisualisation */}
      {previewEvt && (
        <Modal title="Prévisualisation" onClose={() => setPreviewEvt(null)} size="lg">
          <div style={{ padding: 24, background: 'var(--cream)', borderRadius: 8 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <span className="badge badge-navy">{previewEvt.type || 'Événement'}</span>
              <span className={`badge ${EVT_STATUSES[previewEvt.status]?.badgeClass || 'badge-gray'}`}>
                {EVT_STATUSES[previewEvt.status]?.label || previewEvt.status}
              </span>
            </div>
            <time style={{ fontSize: 14, color: COLORS.sky, fontWeight: 600 }}>
              {formatDateFr(previewEvt.date)}
            </time>
            <h2 style={{ fontSize: 24, margin: '8px 0 4px', fontFamily: "'Cormorant Garamond', serif", color: COLORS.navy }}>
              {previewEvt.title}
            </h2>
            {previewEvt.sousTitre && (
              <p style={{ fontSize: 15, color: COLORS.textLight, marginBottom: 8 }}>{previewEvt.sousTitre}</p>
            )}
            {previewEvt.lieu && (
              <p style={{ fontSize: 14, marginBottom: 8 }}>{previewEvt.lieu}</p>
            )}
            {previewEvt.partenaire && (
              <p style={{ fontSize: 14, marginBottom: 8 }}>En partenariat avec <strong>{previewEvt.partenaire}</strong></p>
            )}
            {previewEvt.inscriptions > 0 && (
              <p style={{ fontSize: 14, marginBottom: 8, color: COLORS.sky }}>{previewEvt.inscriptions} inscription{previewEvt.inscriptions > 1 ? 's' : ''}</p>
            )}
            {previewEvt.description && (
              <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 12 }}>{previewEvt.description}</p>
            )}
            {previewEvt.intervenants?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Intervenants</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {previewEvt.intervenants.map((inter, i) => (
                    <span key={i} className="pill">{inter.name}{inter.titre ? ` — ${inter.titre}` : ''}</span>
                  ))}
                </div>
              </div>
            )}
            {previewEvt.lienInscription && (
              <div style={{ marginTop: 16 }}>
                <a href={previewEvt.lienInscription} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                  S'inscrire
                </a>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setPreviewEvt(null)}>Fermer</button>
            <button className="btn btn-green" onClick={() => { setPreviewEvt(null); publishEvent(); }}>
              Publier tout sur le site
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
