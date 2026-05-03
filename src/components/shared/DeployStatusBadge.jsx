// ─── DeployStatusBadge — Chantier D ──────────────────────────────────
// Affiche le statut du dernier déploiement Vercel + bouton "Forcer un
// nouveau déploiement". Poll toutes les 30 s par défaut. Dégrade
// proprement si VERCEL_TOKEN n'est pas configuré côté Worker
// (message "Configurer Vercel" + lien vers Paramètres).

import { useEffect, useState, useCallback } from 'react';
import { fetchDeployments, triggerRebuild } from '../../services/deploy';
import { timeAgo } from '../../utils/formatters';

const STATE_LABEL = {
  READY: { label: 'Publié', icon: '✓', color: '#16A34A', bg: '#DCFCE7' },
  BUILDING: { label: 'Déploiement en cours', icon: '⟳', color: '#D97706', bg: '#FEF3C7', spin: true },
  QUEUED: { label: 'En attente', icon: '⏱', color: '#D97706', bg: '#FEF3C7' },
  INITIALIZING: { label: 'Démarrage', icon: '⟳', color: '#D97706', bg: '#FEF3C7', spin: true },
  ERROR: { label: 'Erreur de déploiement', icon: '✕', color: '#C1121F', bg: '#FEE2E2' },
  CANCELED: { label: 'Annulé', icon: '⊘', color: '#6B7280', bg: '#F3F4F6' },
  UNKNOWN: { label: 'Statut inconnu', icon: '?', color: '#6B7280', bg: '#F3F4F6' },
};

export default function DeployStatusBadge({
  pollMs = 30000,
  onTabChange,                 // callback pour ouvrir Settings si non configuré
  showActions = true,
}) {
  const [state, setState] = useState({ loading: true, configured: null, deployments: [], error: null });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchDeployments(5);
      setState({ loading: false, configured: data.configured, deployments: data.deployments || [], error: data.error || null });
    } catch (e) {
      setState({ loading: false, configured: null, deployments: [], error: e.message });
    }
  }, []);

  useEffect(() => {
    refresh();
    const onVisibilityChange = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    const last = state.deployments[0];
    const isLive = last && (last.state === 'BUILDING' || last.state === 'QUEUED' || last.state === 'INITIALIZING');
    const interval = setInterval(refresh, isLive ? Math.min(pollMs, 8000) : pollMs);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisibilityChange); };
    // refresh est stable, deployments[0].state pilote le tempo de polling
  }, [refresh, state.deployments[0]?.state, pollMs]);

  const onForceDeploy = async () => {
    setBusy(true);
    try {
      await triggerRebuild();
      // Petit délai pour laisser Vercel prendre la requête en compte
      setTimeout(refresh, 1500);
    } catch (e) {
      alert(`Impossible de déclencher le déploiement :\n${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  if (state.loading) {
    return <div style={badgeStyle('#F3F4F6', '#6B7280')}>Chargement du statut Vercel…</div>;
  }

  if (state.configured === false) {
    return (
      <div style={{ ...badgeStyle('#FEF3C7', '#92400E'), display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>⚠ Vercel non configuré côté Worker (VERCEL_TOKEN manquant)</span>
        {onTabChange && (
          <button
            type="button"
            onClick={() => onTabChange('settings')}
            style={btnStyle}
          >
            Paramètres →
          </button>
        )}
      </div>
    );
  }

  if (state.error) {
    return (
      <div style={{ ...badgeStyle('#FEE2E2', '#991B1B'), display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>✕ Erreur Vercel : {state.error}</span>
        <button type="button" onClick={refresh} style={btnStyle}>Réessayer</button>
      </div>
    );
  }

  const last = state.deployments[0];
  if (!last) {
    return <div style={badgeStyle('#F3F4F6', '#6B7280')}>Aucun déploiement Vercel récent.</div>;
  }

  const cfg = STATE_LABEL[last.state] || STATE_LABEL.UNKNOWN;
  const ageText = last.createdAt ? timeAgo(last.createdAt) : '—';
  return (
    <div style={{ ...badgeStyle(cfg.bg, cfg.color), display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16, animation: cfg.spin ? 'spin 1.2s linear infinite' : 'none' }}>{cfg.icon}</span>
        <strong>{cfg.label}</strong>
        <span style={{ opacity: 0.7 }}>· {ageText}</span>
        {last.commitMessage && (
          <span style={{ opacity: 0.7, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            · {last.commitMessage}
          </span>
        )}
      </span>
      {showActions && (
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {last.inspectorUrl && (
            <a href={last.inspectorUrl} target="_blank" rel="noopener noreferrer" style={{ ...btnStyle, textDecoration: 'none' }}>
              Logs Vercel ↗
            </a>
          )}
          <button type="button" onClick={refresh} style={btnStyle} disabled={busy}>↻</button>
          <button type="button" onClick={onForceDeploy} style={{ ...btnStyle, background: cfg.color, color: 'white' }} disabled={busy}>
            {busy ? 'Lancement…' : 'Forcer un déploiement'}
          </button>
        </span>
      )}
    </div>
  );
}

function badgeStyle(bg, color) {
  return {
    background: bg,
    color,
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
  };
}

const btnStyle = {
  background: 'rgba(255,255,255,0.6)',
  color: 'inherit',
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: 12,
  cursor: 'pointer',
  fontWeight: 500,
};

// Liste compacte des 5 derniers builds — utilisée dans Paramètres.
export function DeployHistoryList() {
  const [state, setState] = useState({ loading: true, configured: null, deployments: [] });

  useEffect(() => {
    let alive = true;
    fetchDeployments(5).then(d => { if (alive) setState({ loading: false, ...d }); });
    return () => { alive = false; };
  }, []);

  if (state.loading) return <p style={{ fontSize: 13, color: '#6B7280' }}>Chargement…</p>;
  if (state.configured === false) {
    return <p style={{ fontSize: 13, color: '#92400E' }}>Vercel non configuré (VERCEL_TOKEN manquant).</p>;
  }
  if (!state.deployments.length) return <p style={{ fontSize: 13, color: '#6B7280' }}>Aucun build récent.</p>;

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
          <th style={{ padding: 6 }}>Statut</th>
          <th style={{ padding: 6 }}>Quand</th>
          <th style={{ padding: 6 }}>Commit</th>
          <th style={{ padding: 6 }}>Branche</th>
          <th style={{ padding: 6 }}>Durée</th>
          <th style={{ padding: 6 }} />
        </tr>
      </thead>
      <tbody>
        {state.deployments.map(d => {
          const cfg = STATE_LABEL[d.state] || STATE_LABEL.UNKNOWN;
          return (
            <tr key={d.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
              <td style={{ padding: 6 }}>
                <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: cfg.bg, color: cfg.color, fontSize: 12, fontWeight: 600 }}>
                  {cfg.icon} {cfg.label}
                </span>
              </td>
              <td style={{ padding: 6, color: '#6B7280' }}>{d.createdAt ? timeAgo(d.createdAt) : '—'}</td>
              <td style={{ padding: 6, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.commitMessage}>
                {d.commitMessage || '—'}
              </td>
              <td style={{ padding: 6, color: '#6B7280' }}>{d.branch || '—'}</td>
              <td style={{ padding: 6, color: '#6B7280' }}>{d.duration ? `${Math.round(d.duration / 1000)}s` : '—'}</td>
              <td style={{ padding: 6 }}>
                {d.inspectorUrl && <a href={d.inspectorUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>Voir ↗</a>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
