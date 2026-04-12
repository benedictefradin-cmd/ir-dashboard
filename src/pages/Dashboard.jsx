import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import StatsCard from '../components/shared/StatsCard';
import { SkeletonCard } from '../components/shared/SkeletonLoader';
import { formatDateFr, timeAgo, calcVariation } from '../utils/formatters';
import { COLORS } from '../utils/constants';

export default function Dashboard({ adherents, subscribers, articles, activity, loading, onTabChange }) {
  // ─── KPI calculs ──────────────────────────────
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const adherentStats = useMemo(() => {
    const actifs = adherents.filter(a => a.status === 'actif' || a.status === 'Payé').length;
    const thisMo = adherents.filter(a => {
      const d = new Date(a.date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;
    const lastMo = adherents.filter(a => {
      const d = new Date(a.date);
      const lm = thisMonth === 0 ? 11 : thisMonth - 1;
      const ly = thisMonth === 0 ? thisYear - 1 : thisYear;
      return d.getMonth() === lm && d.getFullYear() === ly;
    }).length;
    const totalAmount = adherents.reduce((s, a) => s + (a.amount || 0), 0);
    return { actifs, thisMo, lastMo, totalAmount, variation: calcVariation(thisMo, lastMo) };
  }, [adherents, thisMonth, thisYear]);

  const subStats = useMemo(() => {
    const total = subscribers.length;
    const thisMo = subscribers.filter(s => {
      const d = new Date(s.date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;
    return { total, thisMo };
  }, [subscribers, thisMonth, thisYear]);

  // ─── Graphique \u00e9volution adh\u00e9sions 12 mois ─────
  const chartData = useMemo(() => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const count = adherents.filter(a => {
        const ad = new Date(a.date);
        return ad.getMonth() === m && ad.getFullYear() === y;
      }).length;
      months.push({
        label: d.toLocaleDateString('fr-FR', { month: 'short' }),
        adherents: count,
      });
    }
    return months;
  }, [adherents, thisMonth, thisYear]);

  // ─── Actions rapides ──────────────────────────
  const pendingSubs = subscribers.filter(s => s.status === 'pending').length;
  const articlesToReview = articles.filter(a => a.status === 'review').length;
  const recentAdherents = adherents.filter(a => {
    const d = new Date(a.date);
    return (now - d) / (1000 * 60 * 60 * 24) <= 7;
  }).length;

  if (loading) {
    return (
      <>
        <div className="page-header"><h1>Dashboard</h1></div>
        <div className="page-body">
          <SkeletonCard count={4} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-header-sub">Vue d&rsquo;ensemble de l&rsquo;activit\u00e9</p>
        </div>
      </div>

      <div className="page-body">
        {/* KPI cards */}
        <div className="grid grid-4 mb-24">
          <StatsCard
            label="Adh\u00e9rents actifs"
            value={adherentStats.actifs}
            sub={`${adherentStats.thisMo} ce mois-ci`}
            accentColor={COLORS.green}
            variation={adherentStats.variation}
            onClick={() => onTabChange('adherents')}
          />
          <StatsCard
            label="Abonn\u00e9s newsletter"
            value={subStats.total}
            sub={`+${subStats.thisMo} ce mois`}
            accentColor={COLORS.sky}
            onClick={() => onTabChange('newsletter')}
          />
          <StatsCard
            label="Montant collect\u00e9"
            value={`${adherentStats.totalAmount.toLocaleString('fr-FR')}\u00a0\u20ac`}
            sub="Adh\u00e9sions + dons"
            accentColor={COLORS.navy}
          />
          <StatsCard
            label="Articles"
            value={articles.length}
            sub={`${articlesToReview} \u00e0 relire`}
            accentColor={COLORS.ochre}
            onClick={() => onTabChange('articles')}
          />
        </div>

        {/* Actions rapides */}
        {(recentAdherents > 0 || pendingSubs > 0 || articlesToReview > 0) && (
          <div className="card mb-24">
            <h3 style={{ fontSize: 16, marginBottom: 14 }}>Actions rapides</h3>
            <div className="flex-wrap gap-8">
              {recentAdherents > 0 && (
                <button className="btn btn-green" onClick={() => onTabChange('adherents')}>
                  {recentAdherents} adh\u00e9sion{recentAdherents > 1 ? 's' : ''} r\u00e9cente{recentAdherents > 1 ? 's' : ''}
                </button>
              )}
              {pendingSubs > 0 && (
                <button className="btn btn-sky" onClick={() => onTabChange('newsletter')}>
                  {pendingSubs} abonn\u00e9{pendingSubs > 1 ? 's' : ''} en attente
                </button>
              )}
              {articlesToReview > 0 && (
                <button className="btn btn-ochre" onClick={() => onTabChange('articles')}>
                  {articlesToReview} article{articlesToReview > 1 ? 's' : ''} \u00e0 relire
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-2 mb-24">
          {/* Graphique */}
          <div className="card">
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>\u00c9volution des adh\u00e9sions</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13 }}
                  formatter={(value) => [`${value} adh\u00e9sion${value > 1 ? 's' : ''}`, '']}
                />
                <Line type="monotone" dataKey="adherents" stroke={COLORS.sky} strokeWidth={2} dot={{ r: 3, fill: COLORS.sky }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Activit\u00e9 r\u00e9cente */}
          <div className="card">
            <h3 style={{ fontSize: 16, marginBottom: 14 }}>Activit\u00e9 r\u00e9cente</h3>
            {activity.length === 0 && (
              <p style={{ color: 'var(--text-light)', fontSize: 14 }}>Aucune activit\u00e9 r\u00e9cente</p>
            )}
            {activity.slice(0, 8).map((a, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, padding: '8px 0',
                borderBottom: i < Math.min(activity.length, 8) - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ color: 'var(--text-light)', fontSize: 12, minWidth: 60, flexShrink: 0 }}>
                  {timeAgo(a.date)}
                </span>
                <span style={{ fontSize: 14 }}>{a.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
