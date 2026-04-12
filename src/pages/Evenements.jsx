import { useState, useMemo } from 'react';
import StatsCard from '../components/shared/StatsCard';
import ServiceBadge from '../components/shared/ServiceBadge';
import Modal from '../components/shared/Modal';
import { SkeletonCard } from '../components/shared/SkeletonLoader';
import { formatDateFr } from '../utils/formatters';
import { COLORS, EVT_TYPES, EVT_STATUSES } from '../utils/constants';
import { hasGitHub, insertHtmlInPage, formatDateSite } from '../services/github';

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
  status: 'confirme',
};

const statusDot = (status, isPast) => {
  if (isPast && status !== 'annule') return COLORS.textLight;
  if (status === 'confirme') return COLORS.green;
  if (status === 'en_preparation') return COLORS.ochre;
  if (status === 'annule') return COLORS.terra;
  return COLORS.textLight;
};

export default function Evenements({ events, setEvents, loading, toast }) {
  const [showForm, setShowForm] = useState(false);
  const [editingEvt, setEditingEvt] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [publishingId, setPublishingId] = useState(null);

  // Stats
  const stats = useMemo(() => {
    const aVenir = events.filter(e => isFuture(e.date) && e.status !== 'annule').length;
    const passes = events.filter(e => !isFuture(e.date)).length;
    const enPrep = events.filter(e => e.status === 'en_preparation').length;
    return { aVenir, passes, enPrep };
  }, [events]);

  // Tri : futurs d'abord, puis passés
  const sorted = useMemo(() => {
    const futurs = events.filter(e => isFuture(e.date)).sort((a, b) => new Date(a.date) - new Date(b.date));
    const passes = events.filter(e => !isFuture(e.date)).sort((a, b) => new Date(b.date) - new Date(a.date));
    return [...futurs, ...passes];
  }, [events]);

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
      lienConcours: evt.lienConcours || '', status: evt.status || 'confirme',
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

  // Publier sur le site via GitHub API
  const publishEvent = async (evt) => {
    setPublishingId(evt.id);
    try {
      if (hasGitHub()) {
        const intervenantsHtml = (evt.intervenants || []).map(i =>
          `<span class="intervenant">${i.name}${i.titre ? ` — ${i.titre}` : ''}</span>`
        ).join('\n  ');

        const cardHtml = `
<article class="event-card" data-status="${evt.status}">
  <time>${formatDateSite(evt.date)}</time>
  <span class="type">${evt.type}</span>
  <h3>${evt.title}</h3>${evt.sousTitre ? `\n  <p class="sous-titre">${evt.sousTitre}</p>` : ''}
  <p class="lieu">${evt.lieu || ''}</p>${evt.partenaire ? `\n  <p class="partenaire">En partenariat avec ${evt.partenaire}</p>` : ''}${intervenantsHtml ? `\n  <div class="intervenants">${intervenantsHtml}</div>` : ''}
  <p>${evt.description || ''}</p>${evt.lienInscription ? `\n  <a href="${evt.lienInscription}" target="_blank" class="btn-inscription">S’inscrire</a>` : ''}
</article>`;
        await insertHtmlInPage('evenements.html', cardHtml, `Ajout événement : ${evt.title}`);
        toast('Événement publié sur le site');
      } else {
        await new Promise(r => setTimeout(r, 1500));
        toast('Événement publié (simulation — configurez VITE_GITHUB_TOKEN)');
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

        {/* Formulaire */}
        {showForm && (
          <div className="card mb-24 slide-down" style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>{editingEvt ? 'Modifier l’événement' : 'Nouvel événement'}</h3>

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

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 16 }}>
              <div><label>Titre *</label><input value={form.title} onChange={e => setField('title', e.target.value)} placeholder="Titre de l’événement" /></div>
              <div><label>Sous-titre</label><input value={form.sousTitre} onChange={e => setField('sousTitre', e.target.value)} placeholder="Optionnel" /></div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label>Description</label>
              <textarea rows={3} value={form.description} onChange={e => setField('description', e.target.value)} placeholder="Description de l’événement" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div><label>Lieu / Adresse</label><input value={form.lieu} onChange={e => setField('lieu', e.target.value)} /></div>
              <div><label>Partenaire</label><input value={form.partenaire} onChange={e => setField('partenaire', e.target.value)} placeholder="Optionnel" /></div>
              <div><label>Lien d’inscription</label><input value={form.lienInscription} onChange={e => setField('lienInscription', e.target.value)} placeholder="https://..." /></div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label>Lien concours (optionnel)</label>
              <input value={form.lienConcours} onChange={e => setField('lienConcours', e.target.value)} placeholder="https://..." style={{ maxWidth: 400 }} />
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

            <div style={{ display: 'flex', gap: 8 }}>
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
                    <button
                      className="btn btn-green btn-sm"
                      onClick={() => publishEvent(evt)}
                      disabled={publishingId === evt.id}
                    >
                      {publishingId === evt.id ? 'Publication…' : 'Publier'}
                    </button>
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
        <Modal title="Supprimer l’événement" onClose={() => setConfirmDelete(null)}>
          <p style={{ marginBottom: 8 }}>Voulez-vous vraiment supprimer <strong>{confirmDelete.title}</strong> ?</p>
          <p style={{ color: 'var(--text-light)', fontSize: 13 }}>Cette action est irréversible.</p>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setConfirmDelete(null)}>Annuler</button>
            <button className="btn btn-terra" onClick={() => deleteEvent(confirmDelete.id)}>Supprimer</button>
          </div>
        </Modal>
      )}
    </>
  );
}
