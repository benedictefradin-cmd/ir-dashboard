import { useMemo, useState } from 'react';
import StatsCard from '../components/shared/StatsCard';
import ServiceBadge from '../components/shared/ServiceBadge';
import { SkeletonCard } from '../components/shared/SkeletonLoader';
import { formatDateFr, timeAgo } from '../utils/formatters';
import { COLORS } from '../utils/constants';
import { triggerRebuild, hasDeployHook } from '../services/deploy';

export default function Dashboard({
  subscribers = [],
  articles = [],
  events = [],
  presse = [],
  sollicitations = [],
  campaigns = [],
  activity = [],
  loading,
  onTabChange,
  toast,
  notionArticles = [],
  notionCounts = {},
  socialPosts = [],
  rapports = [],
  extEvents = [],
}) {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const isThisMonth = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
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

  const nlStats = useMemo(() => {
    const total = subscribers.length;
    // Dernier taux d'ouverture depuis les campagnes
    const sentCampaigns = (campaigns || []).filter(c => c.status === 'sent' && c.openRate != null);
    const lastOpenRate = sentCampaigns.length > 0
      ? sentCampaigns[sentCampaigns.length - 1].openRate
      : null;
    return { total, lastOpenRate };
  }, [subscribers, campaigns]);

  const presseStats = useMemo(() => {
    const total = presse.length;
    const thisMonthCount = presse.filter(p => isThisMonth(p.date)).length;
    return { total, thisMonthCount };
  }, [presse, thisMonth, thisYear]);

  const nextEvent = evtStats.next;
  const newSollCount = sollicitations.filter(s => s.status === 'new').length;

  const [rebuilding, setRebuilding] = useState(false);

  const handleRebuild = async () => {
    if (!hasDeployHook()) {
      toast?.('Deploy hook non configuré — allez dans Config', 'error');
      return;
    }
    setRebuilding(true);
    try {
      await triggerRebuild();
      toast?.('Rebuild du site déclenché avec succès');
    } catch (e) {
      toast?.(e.message || 'Erreur lors du rebuild', 'error');
    }
    setRebuilding(false);
  };

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
            label="Événements"
            value={`${evtStats.upcomingCount} à venir`}
            sub={nextEvent ? `${formatDateFr(nextEvent.date)} — ${nextEvent.title || nextEvent.titre || ''}` : 'Aucun prévu'}
            accentColor={COLORS.sky}
            onClick={() => onTabChange('evenements')}
          />
          <StatsCard
            label="Newsletter"
            value={nlStats.total}
            sub={nlStats.lastOpenRate != null ? `Dernier taux : ${nlStats.lastOpenRate} %` : 'abonnés'}
            accentColor={COLORS.navy}
            onClick={() => onTabChange('newsletter')}
          />
          <StatsCard
            label="Presse"
            value={presseStats.total}
            sub={`${presseStats.thisMonthCount} ce mois-ci`}
            accentColor={COLORS.green}
            onClick={() => onTabChange('presse')}
          />
          <StatsCard
            label="Sollicitations"
            value={newSollCount}
            sub="en attente"
            accentColor={newSollCount > 0 ? COLORS.terra : COLORS.green}
            onClick={() => onTabChange('sollicitations')}
          />
        </div>

        {/* ── Actions rapides ────────────────────── */}
        <div className="card mb-16 fade-in" style={{ padding: '14px 20px' }}>
          <div className="flex-wrap" style={{ gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.navy, marginRight: 8 }}>Actions rapides</span>
            <button className="btn btn-outline btn-sm" onClick={() => onTabChange('articles')}>+ Nouveau article</button>
            <button className="btn btn-outline btn-sm" onClick={() => onTabChange('evenements')}>+ Nouvel événement</button>
            <button className="btn btn-outline btn-sm" onClick={() => onTabChange('presse')}>+ Retombée presse</button>
            <button className="btn btn-outline btn-sm" onClick={() => onTabChange('newsletter')}>Envoyer newsletter</button>
            <button className="btn btn-outline btn-sm" onClick={handleRebuild} disabled={rebuilding}>
              {rebuilding ? 'Rebuild…' : 'Rebuild site'}
            </button>
            {newSollCount > 0 && (
              <button className="btn btn-sky btn-sm" onClick={() => onTabChange('sollicitations')}>
                {newSollCount} sollicitation{newSollCount > 1 ? 's' : ''} en attente
              </button>
            )}
          </div>
        </div>

        {/* ── Alerte publications prêtes ─────────── */}
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

        {/* ── Prochaines échéances + Semaine en cours ── */}
        {(() => {
          const now = new Date();
          // Collect all upcoming deadlines
          const deadlines = [];
          rapports.filter(r => r.status !== 'envoye' && r.deadline).forEach(r => {
            const d = new Date(r.deadline);
            if (d >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
              deadlines.push({ type: 'rapport', label: `Rapport ${r.type} — ${r.fondation}`, date: r.deadline, color: COLORS.terra });
          });
          extEvents.filter(e => e.dateDebut && new Date(e.dateDebut) >= now && e.status !== 'decline').forEach(e => {
            deadlines.push({ type: 'event', label: e.nom, date: e.dateDebut, color: COLORS.sky });
          });
          socialPosts.filter(p => p.date && new Date(p.date) >= now && p.status !== 'publie').forEach(p => {
            deadlines.push({ type: 'post', label: `${p.platform} — ${(p.text || '').slice(0, 40)}`, date: p.date, color: COLORS.ochre });
          });
          deadlines.sort((a, b) => a.date.localeCompare(b.date));
          const top5 = deadlines.slice(0, 5);

          // Week calendar (Mon-Sun of current week)
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const dow = (today.getDay() + 6) % 7;
          const monday = new Date(today); monday.setDate(today.getDate() - dow);
          const weekDays = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(monday); d.setDate(monday.getDate() + i);
            return d;
          });
          const postsByDate = {};
          socialPosts.forEach(p => { const k = p.date?.slice(0, 10); if (k) (postsByDate[k] = postsByDate[k] || []).push(p); });
          const evtByDate = {};
          extEvents.forEach(e => { const k = e.dateDebut?.slice(0, 10); if (k) (evtByDate[k] = evtByDate[k] || []).push(e); });
          const dayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

          if (top5.length === 0 && socialPosts.length === 0 && extEvents.length === 0) return null;

          return (
            <div className="grid grid-2 mb-16">
              {/* Prochaines échéances */}
              <div className="card fade-in" style={{ cursor: 'pointer' }} onClick={() => onTabChange('calendrier')}>
                <h2 style={{ fontSize: 16, marginBottom: 12 }}>Prochaines échéances</h2>
                {top5.length === 0 ? (
                  <p style={{ color: COLORS.textLight, fontSize: 13 }}>Aucune échéance à venir</p>
                ) : top5.map((dl, i) => {
                  const daysLeft = Math.ceil((new Date(dl.date) - today) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
                      borderBottom: i < top5.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                    }}>
                      <div style={{ width: 4, height: 32, borderRadius: 2, background: dl.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, color: COLORS.navy, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dl.label}</p>
                        <p style={{ fontSize: 11, color: COLORS.textLight, margin: 0 }}>{formatDateFr(dl.date)}</p>
                      </div>
                      <span style={{
                        fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                        background: daysLeft <= 3 ? COLORS.dangerLight : daysLeft <= 7 ? COLORS.ochreLight : COLORS.greenLight,
                        color: daysLeft <= 3 ? COLORS.danger : daysLeft <= 7 ? COLORS.ochre : COLORS.green,
                      }}>
                        {daysLeft === 0 ? "Aujourd'hui" : daysLeft === 1 ? 'Demain' : `J-${daysLeft}`}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Mini semaine */}
              <div className="card fade-in">
                <h2 style={{ fontSize: 16, marginBottom: 12 }}>Cette semaine</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
                  {weekDays.map((d, i) => {
                    const key = d.toISOString().slice(0, 10);
                    const isToday = key === today.toISOString().slice(0, 10);
                    const posts = postsByDate[key] || [];
                    const evts = evtByDate[key] || [];
                    return (
                      <div key={i} style={{
                        padding: '6px 2px', borderRadius: 8,
                        background: isToday ? COLORS.skyLight : 'transparent',
                        border: isToday ? `2px solid ${COLORS.sky}` : `1px solid ${COLORS.border}`,
                      }}>
                        <div style={{ fontSize: 11, color: COLORS.textLight, fontWeight: 600 }}>{dayLabels[i]}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: isToday ? COLORS.sky : COLORS.navy }}>{d.getDate()}</div>
                        {posts.length > 0 && <div style={{ fontSize: 10, color: COLORS.ochre, marginTop: 2 }}>{posts.length} post{posts.length > 1 ? 's' : ''}</div>}
                        {evts.length > 0 && <div style={{ fontSize: 10, color: COLORS.sky, marginTop: 1 }}>{evts.length} evt</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Prochain événement + Activité récente ── */}
        <div className="grid grid-2 mb-16">
          <div className="card fade-in" style={{ cursor: 'pointer' }} onClick={() => onTabChange('evenements')}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>Prochain événement</h2>
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
                {nextEvent.type && (
                  <span className="badge badge-navy" style={{ marginTop: 8, display: 'inline-block' }}>{nextEvent.type}</span>
                )}
              </div>
            ) : (
              <p style={{ color: COLORS.textLight, fontSize: 13 }}>Aucun événement à venir.</p>
            )}
          </div>

          <div className="card fade-in">
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>Activité récente</h2>
            {activity.length === 0 && (
              <p style={{ color: COLORS.textLight, fontSize: 13 }}>Aucune activité récente</p>
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

        {/* ── Presse récente ────────────────────── */}
        {presse.length > 0 && (
          <div className="card fade-in">
            <div className="flex-between mb-8">
              <h2 style={{ fontSize: 16 }}>Dernières retombées presse</h2>
              <button className="btn btn-outline btn-sm" onClick={() => onTabChange('presse')}>Tout voir</button>
            </div>
            <div>
              {presse.slice(0, 4).map((p, i) => (
                <div
                  key={p.id || i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: i < Math.min(presse.length, 4) - 1 ? `1px solid ${COLORS.border}` : 'none',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.navy }}>
                      {p.title}
                    </span>
                    <span style={{ fontSize: 12, color: COLORS.textLight, marginLeft: 8 }}>
                      {p.media}
                    </span>
                  </div>
                  <span className={`badge ${p.type === 'Tribune' ? 'badge-ochre' : p.type === 'Podcast' ? 'badge-sky' : 'badge-green'}`}>
                    {p.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
