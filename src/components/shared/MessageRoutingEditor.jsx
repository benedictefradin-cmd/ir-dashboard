import { useState, useEffect } from 'react';
import { fetchMessageRouting, saveMessageRouting } from '../../services/contact';
import { CONTACT_SUBJECTS, COLORS } from '../../utils/constants';

/**
 * Éditeur de routing CC par type de sollicitation (Chantier 4).
 * Stockage : KV Worker `config:messageRouting` (admin only).
 *
 * Le routing résout `ccProfileIds → emails` au moment du send (cf.
 * Sollicitations.jsx → handleReply). On stocke uniquement les IDs ici.
 */
export default function MessageRoutingEditor({ auteurs = [], toast }) {
  const [open, setOpen] = useState(false);
  const [routing, setRouting] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || routing !== null) return;
    setLoading(true);
    fetchMessageRouting()
      .then(r => setRouting(r?.routing || {}))
      .catch(() => setRouting({}))
      .finally(() => setLoading(false));
  }, [open, routing]);

  const toggleId = (subjectKey, profileId) => {
    setRouting(prev => {
      const cfg = prev[subjectKey] || { ccProfileIds: [] };
      const ids = cfg.ccProfileIds.includes(profileId)
        ? cfg.ccProfileIds.filter(x => x !== profileId)
        : [...cfg.ccProfileIds, profileId];
      return { ...prev, [subjectKey]: { ccProfileIds: ids } };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await saveMessageRouting(routing || {});
      setRouting(r?.routing || {});
      toast?.('Routing CC enregistré');
    } catch (err) {
      toast?.(`Erreur : ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const sortedAuteurs = (auteurs || [])
    .filter(a => a.actif !== false && a.email)
    .sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '', 'fr'));

  return (
    <div className="card" style={{ marginBottom: 16, padding: 12 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: COLORS.navy, padding: 0 }}
      >
        {open ? '▾' : '▸'} Routing CC par type d'objet (qui reçoit en copie chaque type de message)
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          {loading && <p style={{ color: COLORS.textLight }}>Chargement…</p>}
          {!loading && routing && (
            <>
              <p style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 12 }}>
                Pour chaque type de sollicitation, sélectionne les profils dont l'email
                sera ajouté en copie de la réponse. Seuls les profils ayant un email
                renseigné apparaissent ici.
              </p>
              <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <th style={{ textAlign: 'left', padding: 6, width: 220 }}>Type d'objet</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>Profils en CC</th>
                  </tr>
                </thead>
                <tbody>
                  {CONTACT_SUBJECTS.map(s => {
                    const ids = (routing[s.key]?.ccProfileIds) || [];
                    return (
                      <tr key={s.key} style={{ borderBottom: `1px solid ${COLORS.border}`, verticalAlign: 'top' }}>
                        <td style={{ padding: 6, fontWeight: 500 }}>{s.label}</td>
                        <td style={{ padding: 6 }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {sortedAuteurs.length === 0 && (
                              <span style={{ fontSize: 12, color: COLORS.textLight }}>
                                Aucun profil avec email saisi — Profils → renseigne un email puis reviens ici.
                              </span>
                            )}
                            {sortedAuteurs.map(a => {
                              const checked = ids.includes(a.id);
                              return (
                                <label
                                  key={a.id}
                                  style={{
                                    cursor: 'pointer',
                                    padding: '4px 10px',
                                    borderRadius: 12,
                                    fontSize: 12,
                                    background: checked ? COLORS.navy : '#f3f4f6',
                                    color: checked ? '#fff' : COLORS.text,
                                    userSelect: 'none',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleId(s.key, a.id)}
                                    style={{ display: 'none' }}
                                  />
                                  {a.firstName} {a.lastName}
                                </label>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
                  {saving ? 'Sauvegarde…' : 'Enregistrer le routing'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
