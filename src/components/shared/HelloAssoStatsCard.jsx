import { useState, useEffect } from 'react';
import api from '../../services/api';
import { loadLocal } from '../../utils/localStorage';
import { LS_KEYS } from '../../utils/constants';

/**
 * HelloAssoStatsCard — Chantier 5
 * Affiche le nombre de clics adhésion / don sur 7j et 30j depuis le Worker.
 * Ne plante pas si le Worker n'est pas configuré : affiche un placeholder.
 */
export default function HelloAssoStatsCard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const token = loadLocal(LS_KEYS.contactAuthToken, '');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    api.get('/api/helloasso/stats?period=month', { headers })
      .then(r => { if (!cancelled) setStats(r); })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div className="card" style={{ padding: 16, background: '#fff', borderRadius: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1a2744', margin: 0, marginBottom: 8 }}>HelloAsso</h3>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Indisponible : {error}</p>
      </div>
    );
  }
  if (!stats) {
    return (
      <div className="card" style={{ padding: 16, background: '#fff', borderRadius: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1a2744', margin: 0, marginBottom: 8 }}>HelloAsso</h3>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Chargement…</p>
      </div>
    );
  }
  const adh = stats.counts?.adhesion?.total || 0;
  const don = stats.counts?.don?.total || 0;
  return (
    <div className="card" style={{ padding: 16, background: '#fff', borderRadius: 8 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1a2744', margin: 0, marginBottom: 12 }}>
        HelloAsso — clics 30 derniers jours
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Adhésion</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a' }}>{adh}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Don</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#2563eb' }}>{don}</div>
        </div>
      </div>
      {(adh + don) === 0 && (
        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8, marginBottom: 0 }}>
          Aucun clic enregistré. Vérifie que le script <code>helloasso-tracking.js</code> est bien déployé sur don.html / adhesion.html.
        </p>
      )}
    </div>
  );
}
