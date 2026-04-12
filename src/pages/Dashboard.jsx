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

  // ─── Helper : filtrer par mois ──────────────────
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

  // ─── KPI : Publications ─────────────────────────
  const pubStats = useMemo(() => {
    const total = articles.length;
    const newThisMonth = articles.filter(a => isThisMonth(a.date || a.created)).length;
    return { total, newThisMonth };
  }, [articles, thisMonth, thisYear]);

  // ─── KPI : Evenements ───────────────────────────
  const evtStats = useMemo(() => {
    const upcoming = events.filter(e => {
      const d = new Date(e.date);
      return d >= now;
    });
    upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
    const next = upcoming[0] || null;
    return { upcomingCount: upcoming.length, next };
  }, [events]);

  // ─── KPI : Adherents ───────────────────────────
  const adherentStats = useMemo(() => {
    const actifs = adherents.filter(a => a.status === 'actif' || a.status === 'Payé').length;
    const thisMo = adherents.filter(a => isThisMonth(a.date)).length;
    const lastMo = adherents.filter(a => isLastMonth(a.date)).length;
    return { actifs, variation: calcVariation(thisMo, lastMo) };
  }, [adherents, thisMonth, thisYear]);

  // ─── KPI : Newsletter ──────────────────────────
  const nlStats = useMemo(() => {
    const total = subscribers.length;
    // Chercher le dernier taux d'ouverture dans l'activite ou les subscribers
    const lastOpenRate = subscribers.reduce((best, s) => {
      if (s.openRate != null && s.openRate > 0) return s.openRate;
      return best;
    }, null);
    return { total, lastOpenRate };
  }, [subscribers]);

  // ─── KPI : Dons ─────────────────────────────────
  const donStats = useMemo(() => {
    const thisMonthDons = dons.filter(d => isThisMonth(d.date));
    const lastMonthDons = dons.filter(d => isLastMonth(d.date));
    const totalThisMonth = thisMonthDons.reduce((s, d) => s + (d.amount || d.montant || 0), 0);
    const totalLastMonth = lastMonthDons.reduce((s, d) => s + (d.amount || d.montant || 0), 0);
    return { totalThisMonth, variation: calcVariation(totalThisMonth, totalLastMonth) };
  }, [dons, thisMonth, thisYear]);

  // ─── Graphique : evolution des dons sur 6 mois ──
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

  // ─── Prochain evenement ─────────────────────────
  const nextEvent = evtStats.next;

  // ─── Loading state ──────────────────────────────
  if (loading) {
    return (
      <>
        <div className="page-header"><h1>Dashboard</h1></div>
        <div className="page-body">
          <SkeletonCard count={5} />
        </div>
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
        <div className="flex-wrap" style={{ gap: 8 }}>
          <ServiceBadge service="notion" />
          <ServiceBadge service="brevo" />
          <ServiceBadge service="helloasso" />
          <ServiceBadge service="github" />
          <ServiceBadge service="cloudflare" />
        </div>
      </div>

      <div className="page-body">
        {/* ── KPI Bar : 5 cartes cliquables ──────── */}
        <div className="grid grid-5 mb-24">
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
            sub={nextEvent ? `${formatDateFr(nextEvent.date)} — ${nextEvent.titre || nextEvent.title || ''}` : 'Aucun prevu'}
            accentColor={COLORS.sky}
            onClick={() => onTabChange('evenements')}
          />
          <StatsCard
            label="Adherents actifs"
            value={adherentStats.actifs}
            sub="membres"
            accentColor={COLORS.green}
            variation={adherentStats.variation}
            onClick={() => onTabChange('adherents')}
          />
          <StatsCard
            label="Newsletter"
            value={nlStats.total}
            sub={nlStats.lastOpenRate != null ? `Taux d'ouverture : ${nlStats.lastOpenRate} %` : 'Abonnes'}
            accentColor={COLORS.navy}
            onClick={() => onTabChange('newsletter')}
          />
          <StatsCard
            label="Dons du mois"
            value={`${donStats.totalThisMonth.toLocaleString('fr-FR')}\u00a0\u20ac`}
            sub="collectes ce mois"
            accentColor={COLORS.terra}
            variation={donStats.variation}
            onClick={() => onTabChange('dons')}
          />
        </div>

        {/* ── Alerte publications prêtes ────────── */}
        {(notionCounts.ready > 0 || articles.filter(a => a.status === 'ready').length > 0) && (() => {
          const readyNotionArticles = notionArticles.filter(a => {
            const s = (a.status || '').toLowerCase();
            return s === 'prêt à publier' || s === 'pret a publier';
          });
          const readyLocal = articles.filter(a => a.status === 'ready');
          const readyAll = [...readyNotionArticles, ...readyLocal];
          return (
            <div className="alert-banner alert-banner-amber mb-24 slide-up">
              <span className="alert-banner-icon">&#128276;</span>
              <div style={{ flex: 1 }}>
                <strong>{readyAll.length} article{readyAll.length > 1 ? 's' : ''} en attente de publication</strong>
                {readyAll.slice(0, 3).map((a, i) => (
                  <div key={a.id || i} style={{ fontSize: 13, color: COLORS.text, marginTop: 4 }}>
                    <strong>{a.title}</strong>
                    {a.authors && <span style={{ color: COLORS.textLight }}> — par {a.authors}</span>}
                    {a.lastEdited && <span style={{ color: COLORS.textLight }}> — {timeAgo(a.lastEdited)}</span>}
                  </div>
                ))}
              </div>
              <button className="btn btn-sm btn-primary" onClick={() => onTabChange('articles')}>
                Voir →
              </button>
            </div>
          );
        })()}

        {/* ── Actions rapides ────────────────────── */}
        <div className="card mb-24 fade-in">
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Actions rapides</h2>
          <div className="flex-wrap" style={{ gap: 10 }}>
            <button
              className="quick-action-btn btn btn-primary"
              onClick={() => onTabChange('articles')}
            >
              + Nouvel article
            </button>
            <button
              className="quick-action-btn btn btn-primary"
              style={{ backgroundColor: COLORS.sky }}
              onClick={() => onTabChange('evenements')}
            >
              + Nouvel evenement
            </button>
            <button
              className="quick-action-btn btn btn-primary"
              style={{ backgroundColor: COLORS.terra }}
              onClick={() => onTabChange('presse')}
            >
              + Retombee presse
            </button>
            <button
              className="quick-action-btn btn btn-primary"
              style={{ backgroundColor: COLORS.green }}
              onClick={() => onTabChange('newsletter')}
            >
              Envoyer newsletter
            </button>
          </div>
        </div>

        {/* ── Widget Sollicitations ────────────────── */}
        <div className="card mb-24 fade-in">
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 18 }}>Sollicitations</h2>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => onTabChange('sollicitations')}
            >
              Voir toutes les sollicitations &rarr;
            </button>
          </div>
          <div className="flex-wrap mb-16" style={{ gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 32, height: 32, borderRadius: 8,
                background: COLORS.skyLight, color: COLORS.sky,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 15,
              }}>
                {sollicitations.filter(s => s.status === 'new').length}
              </span>
              <span style={{ fontSize: 14, color: COLORS.textLight }}>nouvelles</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 32, height: 32, borderRadius: 8,
                background: COLORS.ochreLight, color: '#9A7B1A',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 15,
              }}>
                {sollicitations.filter(s => s.status === 'in_progress').length}
              </span>
              <span style={{ fontSize: 14, color: COLORS.textLight }}>en cours</span>
            </div>
          </div>
          {sollicitations
            .filter(s => s.status !== 'archived')
            .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
            .slice(0, 3)
            .map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 0',
                  borderBottom: i < 2 ? `1px solid ${COLORS.border}` : 'none',
                  cursor: 'pointer',
                }}
                onClick={() => onTabChange('sollicitations')}
              >
                <span className={`badge ${SOLLICITATION_STATUSES[s.status]?.badgeClass || 'badge-gray'}`} style={{ fontSize: 11 }}>
                  {SOLLICITATION_STATUSES[s.status]?.label || s.status}
                </span>
                <span style={{ fontWeight: 500, fontSize: 14 }}>{s.name || 'Anonyme'}</span>
                <span style={{ color: COLORS.textLight, fontSize: 13, flex: 1 }}>
                  &mdash; {truncate(s.message, 50)}
                </span>
                <span style={{ fontSize: 12, color: COLORS.textLight, whiteSpace: 'nowrap' }}>
                  {timeAgo(s.submitted_at)}
                </span>
              </div>
            ))}
          {sollicitations.filter(s => s.status !== 'archived').length === 0 && (
            <p style={{ color: COLORS.textLight, fontSize: 14 }}>Aucune sollicitation en attente</p>
          )}
        </div>

        {/* ── Graphique + Prochain evenement ──────── */}
        <div className="grid grid-2 mb-24">
          {/* Graphique dons 6 mois */}
          <div className="card fade-in">
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>Evolution des dons (6 mois)</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={donChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: COLORS.textLight }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: COLORS.textLight }}
                  allowDecimals={false}
                  tickFormatter={(v) => `${v}\u00a0\u20ac`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 13 }}
                  formatter={(value) => [`${value.toLocaleString('fr-FR')}\u00a0\u20ac`, 'Dons']}
                />
                <Bar
                  dataKey="dons"
                  fill={COLORS.terra}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Prochain evenement */}
          <div className="card fade-in">
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>Prochain evenement</h2>
            {nextEvent ? (
              <div
                style={{
                  padding: 20,
                  borderRadius: 10,
                  backgroundColor: COLORS.skyLight,
                  border: `1px solid ${COLORS.sky}`,
                }}
              >
                <p style={{ fontSize: 13, color: COLORS.sky, fontWeight: 600, marginBottom: 6 }}>
                  {formatDateFr(nextEvent.date)}
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: COLORS.navy, marginBottom: 8, fontFamily: 'Cormorant Garamond, serif' }}>
                  {nextEvent.titre || nextEvent.title || 'Sans titre'}
                </p>
                {(nextEvent.lieu || nextEvent.location) && (
                  <p style={{ fontSize: 14, color: COLORS.textLight }}>
                    {nextEvent.lieu || nextEvent.location}
                  </p>
                )}
                {nextEvent.type && (
                  <span className="badge badge-sky" style={{ marginTop: 10, display: 'inline-block' }}>
                    {nextEvent.type}
                  </span>
                )}
              </div>
            ) : (
              <p style={{ color: COLORS.textLight, fontSize: 14 }}>
                Aucun evenement a venir pour le moment.
              </p>
            )}
          </div>
        </div>

        {/* ── Fil d'activite ─────────────────────── */}
        <div className="card fade-in">
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Activite recente</h2>
          {activity.length === 0 && (
            <p style={{ color: COLORS.textLight, fontSize: 14 }}>Aucune activite recente</p>
          )}
          <div>
            {activity.slice(0, 12).map((a, i) => (
              <div
                key={i}
                className="slide-up"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  padding: '10px 0',
                  borderBottom: i < Math.min(activity.length, 12) - 1 ? `1px solid ${COLORS.border}` : 'none',
                  animationDelay: `${i * 40}ms`,
                }}
              >
                <span
                  style={{
                    color: COLORS.textLight,
                    fontSize: 12,
                    minWidth: 80,
                    flexShrink: 0,
                    paddingTop: 2,
                  }}
                >
                  {timeAgo(a.date)}
                </span>
                <span style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.5 }}>
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
