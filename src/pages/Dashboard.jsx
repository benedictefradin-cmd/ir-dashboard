import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import StatsCard from '../components/shared/StatsCard';
import ServiceBadge from '../components/shared/ServiceBadge';
import { SkeletonCard } from '../components/shared/SkeletonLoader';
import { formatDateFr, timeAgo, truncate, calcVariation } from '../utils/formatters';
import { COLORS, SOLLICITATION_STATUSES } from '../utils/constants';

export default function Dashboard({
  adherents = [],
  subscribers = [],
  articles = [],
  events = [],
  presse = [],
  dons = [],
  sollicitations = [],
  activity = [],
  loading,
  onTabChange,
  notionArticles = [],
  notionCounts = {},
}) {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const isThisMonth = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  };

  const isLastMonth = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const lm = thisMonth === 0 ? 11 : thisMonth - 1;
    const ly = thisMonth === 0 ? thisYear - 1 : thisYear;
    return d.getMonth() === lm && d.getFullYear() === ly;
  };

  // ─── KPIs ──────────────────────────────────────
  const pubStats = useMemo(() => {
    const total = articles.length;
    const newThisMonth = articles.filter(a => isThisMonth(a.date || a.created)).length;
    return { total, newThisMonth };
  }, [articles, thisMonth, thisYear]);

  const evtStats = useMemo(() => {
    const upcoming = events.filter(e => new Date(e.date) >= now);
    upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
    return { upcomingCount: upcoming.length, next: upcoming[0] || null };
  }, [events]);

  const adherentStats = useMemo(() => {
    const actifs = adherents.filter(a => a.status === 'actif' || a.status === 'Payé').length;
    const thisMo = adherents.filter(a => isThisMonth(a.date)).length;
    const lastMo = adherents.filter(a => isLastMonth(a.date)).length;
    return { actifs, variation: calcVariation(thisMo, lastMo) };
  }, [adherents, thisMonth, thisYear]);

  const nlStats = useMemo(() => {
    const total = subscribers.length;
    const lastOpenRate = subscribers.reduce((best, s) => {
      if (s.openRate != null && s.openRate > 0) return s.openRate;
      return best;
    }, null);
    return { total, lastOpenRate };
  }, [subscribers]);

  const donStats = useMemo(() => {
    const thisMonthDons = dons.filter(d => isThisMonth(d.date));
    const lastMonthDons = dons.filter(d => isLastMonth(d.date));
    const totalThisMonth = thisMonthDons.reduce((s, d) => s + (d.amount || d.montant || 0), 0);
    const totalLastMonth = lastMonthDons.reduce((s, d) => s + (d.amount || d.montant || 0), 0);
    return { totalThisMonth, variation: calcVariation(totalThisMonth, totalLastMonth) };
  }, [dons, thisMonth, thisYear]);

  const donChartData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const total = dons
        .filter(don => {
          const dd = new Date(don.date);
          return dd.getMonth() === m && dd.getFullYear() === y;
        })
        .reduce((s, don) => s + (don.amount || don.montant || 0), 0);
      months.push({
        label: d.toLocaleDateString('fr-FR', { month: 'short' }),
        dons: total,
      });
    }
    return months;
  }, [dons, thisMonth, thisYear]);

  const nextEvent = evtStats.next;
  const newSollCount = sollicitations.filter(s => s.status === 'new').length;

  if (loading) {
    return (
      <>
        <div className="page-header"><h1>Dashboard</h1></div>
        <div className="page-body"><SkeletonCard count={5} /></div>
      </>
    );
  }

  return (
    <>
      <div className="page-header slide-up">
        <div>
          <h1>Dashboard</h1>
          <p className="page-header-sub">Vue d&rsquo;ensemble de l&rsquo;Institut Rousseau</p>
        </div>
        <div className="flex-wrap" style={{ gap: 6 }}>
          <ServiceBadge service="notion" />
          <ServiceBadge service="github" />
        </div>
      </div>

      <div className="page-body">
        {/* ── KPI cards ──────────────────────────── */}
        <div className="grid grid-5 mb-16">
          <StatsCard
            label="Publications"
            value={pubStats.total}
            sub={`${pubStats.newThisMonth} ce mois-ci`}
            accentColor={COLORS.ochre}
            onClick={() => onTabChange('articles')}
          />
          <StatsCard
            label="Evenements"
            value={`${evtStats.upcomingCount} a venir`}
            sub={nextEvent ? formatDateFr(nextEvent.date) : 'Aucun prevu'}
            accentColor={COLORS.sky}
            onClick={() => onTabChange('evenements')}
          />
          <StatsCard
            label="Adherents"
            value={adherentStats.actifs}
            sub="actifs"
            accentColor={COLORS.green}
            variation={adherentStats.variation}
            onClick={() => onTabChange('adherents')}
          />
          <StatsCard
            label="Newsletter"
            value={nlStats.total}
            sub="abonnes"
            accentColor={COLORS.navy}
            onClick={() => onTabChange('newsletter')}
          />
          <StatsCard
            label="Dons du mois"
            value={`${donStats.totalThisMonth.toLocaleString('fr-FR')}\u00a0\u20ac`}
            accentColor={COLORS.terra}
            variation={donStats.variation}
            onClick={() => onTabChange('dons')}
          />
        </div>

        {/* ── Actions rapides ────────────────────── */}
        <div className="flex-wrap mb-16 fade-in" style={{ gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => onTabChange('articles')}>+ Article</button>
          <button className="btn btn-outline btn-sm" onClick={() => onTabChange('evenements')}>+ Evenement</button>
          <button className="btn btn-outline btn-sm" onClick={() => onTabChange('presse')}>+ Presse</button>
          <button className="btn btn-outline btn-sm" onClick={() => onTabChange('newsletter')}>Newsletter</button>
          {newSollCount > 0 && (
            <button className="btn btn-sky btn-sm" onClick={() => onTabChange('sollicitations')}>
              {newSollCount} sollicitation{newSollCount > 1 ? 's' : ''} en attente
            </button>
          )}
        </div>

        {/* ── Alerte publications pretes ─────────── */}
        {(notionCounts.ready > 0 || articles.filter(a => a.status === 'ready').length > 0) && (() => {
          const readyNotionArticles = notionArticles.filter(a => {
            const s = (a.status || '').toLowerCase();
            return s === 'prêt à publier' || s === 'pret a publier';
          });
          const readyLocal = articles.filter(a => a.status === 'ready');
          const readyAll = [...readyNotionArticles, ...readyLocal];
          return (
            <div className="alert-banner alert-banner-amber mb-16 slide-up">
              <span className="alert-banner-icon"></span>
              <div style={{ flex: 1 }}>
                <strong>{readyAll.length} article{readyAll.length > 1 ? 's' : ''} en attente de publication</strong>
              </div>
              <button className="btn btn-sm btn-primary" onClick={() => onTabChange('articles')}>
                Voir &rarr;
              </button>
            </div>
          );
        })()}

        {/* ── Graphique dons + Prochain evenement ── */}
        <div className="grid grid-2 mb-16">
          <div className="card fade-in">
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>Dons (6 mois)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={donChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: COLORS.textLight }} />
                <YAxis tick={{ fontSize: 11, fill: COLORS.textLight }} allowDecimals={false} tickFormatter={(v) => `${v}\u00a0\u20ac`} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 12 }}
                  formatter={(value) => [`${value.toLocaleString('fr-FR')}\u00a0\u20ac`, 'Dons']}
                />
                <Bar dataKey="dons" fill={COLORS.terra} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card fade-in" style={{ cursor: 'pointer' }} onClick={() => onTabChange('evenements')}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>Prochain evenement</h2>
            {nextEvent ? (
              <div>
                <p style={{ fontSize: 13, color: COLORS.sky, fontWeight: 600, marginBottom: 4 }}>
                  {formatDateFr(nextEvent.date)}
                </p>
                <p style={{ fontSize: 18, fontWeight: 700, color: COLORS.navy, fontFamily: 'Cormorant Garamond, serif' }}>
                  {nextEvent.titre || nextEvent.title || 'Sans titre'}
                </p>
                {(nextEvent.lieu || nextEvent.location) && (
                  <p style={{ fontSize: 13, color: COLORS.textLight, marginTop: 4 }}>
                    {nextEvent.lieu || nextEvent.location}
                  </p>
                )}
              </div>
            ) : (
              <p style={{ color: COLORS.textLight, fontSize: 13 }}>Aucun evenement a venir.</p>
            )}
          </div>
        </div>

        {/* ── Activite recente ───────────────────── */}
        <div className="card fade-in">
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Activite recente</h2>
          {activity.length === 0 && (
            <p style={{ color: COLORS.textLight, fontSize: 13 }}>Aucune activite recente</p>
          )}
          <div>
            {activity.slice(0, 8).map((a, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '6px 0',
                  borderBottom: i < Math.min(activity.length, 8) - 1 ? `1px solid ${COLORS.border}` : 'none',
                }}
              >
                <span style={{ color: COLORS.textLight, fontSize: 11, minWidth: 70, flexShrink: 0, paddingTop: 2 }}>
                  {timeAgo(a.date)}
                </span>
                <span style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.4 }}>
                  {a.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
