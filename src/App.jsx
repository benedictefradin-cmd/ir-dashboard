import { useState, useEffect, useCallback, useMemo, useRef } from 'react'

// ─── DESIGN TOKENS ─────────────────────────────────────────────────────────────
const C = {
  navy: '#1B2A4A',
  sky: '#4A90D9',
  terra: '#C45A3C',
  ochre: '#D4A843',
  green: '#2D8659',
  bg: '#FAFAF7',
  white: '#FFFFFF',
  muted: '#7A8694',
  border: '#E2E0DA',
  borderLight: '#EDEAE4',
}

const font = {
  title: "'Cormorant Garamond', Georgia, serif",
  body: "'Source Sans 3', 'Segoe UI', sans-serif",
}

// ─── CSS KEYFRAMES (injected once) ──────────────────────────────────────────────
const styleId = '__ir_dashboard_styles'
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const sheet = document.createElement('style')
  sheet.id = styleId
  sheet.textContent = `
    @keyframes irFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes irSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes irSlideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 500px; } }
    @keyframes irToastIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes irToastOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(40px); } }
    .ir-row:hover { background: ${C.bg} !important; }
    .ir-btn:hover { opacity: 0.85; filter: brightness(1.05); }
    body { background: ${C.bg}; }
  `
  document.head.appendChild(sheet)
}

// ─── DONNÉES DE DÉMO ────────────────────────────────────────────────────────────
const initialSubscribers = [
  { id: 1, name: 'Marie Dupont', email: 'marie.dupont@mail.fr', source: 'Site web', date: '2026-03-28', status: 'added' },
  { id: 2, name: 'Jean-Pierre Martin', email: 'jp.martin@gmail.com', source: 'Événement', date: '2026-04-02', status: 'pending' },
  { id: 3, name: 'Sophie Leclerc', email: 'sophie.l@outlook.fr', source: 'LinkedIn', date: '2026-04-05', status: 'added' },
  { id: 4, name: 'Thomas Bernard', email: 't.bernard@yahoo.fr', source: 'Site web', date: '2026-04-07', status: 'pending' },
  { id: 5, name: 'Camille Rousseau', email: 'c.rousseau@mail.fr', source: 'Manuel', date: '2026-03-15', status: 'added' },
  { id: 6, name: 'Lucas Moreau', email: 'lucas.moreau@proton.me', source: 'Événement', date: '2026-04-09', status: 'pending' },
  { id: 7, name: 'Élise Fontaine', email: 'elise.f@gmail.com', source: 'Site web', date: '2026-03-22', status: 'rejected' },
  { id: 8, name: 'Nicolas Petit', email: 'n.petit@mail.fr', source: 'LinkedIn', date: '2026-04-10', status: 'pending' },
  { id: 9, name: 'Amina Benali', email: 'amina.b@outlook.fr', source: 'Site web', date: '2026-03-10', status: 'added' },
  { id: 10, name: 'François Garnier', email: 'f.garnier@gmail.com', source: 'Manuel', date: '2026-02-28', status: 'rejected' },
]

const initialArticles = [
  { id: 1, title: 'Pour une fiscalité écologique juste', author: 'Marie Dupont', category: 'Économie', date: '2026-04-10', status: 'draft', synced: false, content: 'Analyse des mécanismes de taxation carbone et de leur impact redistributif sur les ménages français.' },
  { id: 2, title: 'Souveraineté numérique européenne', author: 'Lucas Moreau', category: 'Numérique', date: '2026-04-08', status: 'review', synced: false, content: 'État des lieux de la dépendance technologique de l\'UE et propositions pour un cloud souverain.' },
  { id: 3, title: 'Réindustrialisation verte des territoires', author: 'Sophie Leclerc', category: 'Écologie', date: '2026-04-05', status: 'ready', synced: false, content: 'Cartographie des opportunités industrielles liées à la transition énergétique dans les régions désindustrialisées.' },
  { id: 4, title: 'Défense européenne : quel modèle ?', author: 'Jean-Pierre Martin', category: 'Géopolitique', date: '2026-03-28', status: 'published', synced: true, content: 'Comparaison des doctrines de défense et propositions pour une autonomie stratégique européenne.' },
  { id: 5, title: 'Réforme du RSA : bilan et perspectives', author: 'Camille Rousseau', category: 'Social', date: '2026-03-20', status: 'published', synced: true, content: 'Évaluation des expérimentations en cours et propositions pour un revenu minimum garanti.' },
  { id: 6, title: 'Assemblées citoyennes et démocratie délibérative', author: 'Élise Fontaine', category: 'Démocratie', date: '2026-04-11', status: 'draft', synced: false, content: 'Retour sur les conventions citoyennes et pistes pour institutionnaliser la démocratie participative.' },
  { id: 7, title: 'Biodiversité et politique agricole commune', author: 'Nicolas Petit', category: 'Écologie', date: '2026-04-06', status: 'review', synced: false, content: 'Analyse critique de la PAC 2023-2027 et recommandations pour intégrer les objectifs de biodiversité.' },
]

const initialPages = [
  { id: 1, name: 'Accueil', path: '/', lastModified: '2026-04-10' },
  { id: 2, name: 'Qui sommes-nous', path: '/qui-sommes-nous', lastModified: '2026-03-01' },
  { id: 3, name: 'Publications', path: '/publications', lastModified: '2026-04-08' },
  { id: 4, name: 'Événements', path: '/evenements', lastModified: '2026-04-05' },
  { id: 5, name: 'Presse', path: '/presse', lastModified: '2026-03-15' },
  { id: 6, name: 'L\'équipe', path: '/equipe', lastModified: '2026-01-20' },
  { id: 7, name: 'Adhérer', path: '/adherer', lastModified: '2026-02-10' },
  { id: 8, name: 'Contact', path: '/contact', lastModified: '2026-04-01' },
  { id: 9, name: 'Mentions légales', path: '/mentions-legales', lastModified: '2025-11-15' },
  { id: 10, name: 'Road to Net Zero', path: '/road-to-net-zero', lastModified: '2026-03-25' },
]

// ─── UTILITAIRES ────────────────────────────────────────────────────────────────
const formatDate = (d) => {
  const date = new Date(d)
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

const daysSince = (d) => {
  const diff = Date.now() - new Date(d).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

const freshnessColor = (days) => {
  if (days < 30) return C.green
  if (days <= 60) return C.ochre
  return C.terra
}

const freshnessLabel = (days) => {
  if (days < 30) return 'À jour'
  if (days <= 60) return 'À revoir'
  return 'Obsolète'
}

let _nextId = 100

// ─── COMPOSANTS RÉUTILISABLES ───────────────────────────────────────────────────

/** Badge textuel avec fond coloré */
const Badge = ({ label, color, bg }) => (
  <span style={{
    display: 'inline-block',
    padding: '3px 12px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    color: color || C.navy,
    background: bg || C.borderLight,
    whiteSpace: 'nowrap',
    lineHeight: '1.4',
  }}>
    {label}
  </span>
)

/** Carte statistique avec accent coloré en haut */
const StatCard = ({ label, value, sub, accent = C.sky, style: sx }) => (
  <div style={{
    background: C.white,
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    overflow: 'hidden',
    flex: '1 1 220px',
    minWidth: 200,
    animation: 'irSlideUp 0.4s ease both',
    ...sx,
  }}>
    <div style={{ height: 3, background: accent }} />
    <div style={{ padding: '20px 22px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 36, fontWeight: 700, color: C.navy, fontFamily: font.title, lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>{sub}</div>}
    </div>
  </div>
)

/** Bouton avec variantes */
const Btn = ({ children, onClick, variant = 'primary', size = 'md', disabled, style: sx }) => {
  const variants = {
    primary: { background: C.navy, color: C.white, border: 'none' },
    success: { background: C.green, color: C.white, border: 'none' },
    danger: { background: C.terra, color: C.white, border: 'none' },
    ghost: { background: 'transparent', color: C.navy, border: `1px solid ${C.border}` },
  }
  const sizes = {
    sm: { padding: '5px 12px', fontSize: 12 },
    md: { padding: '8px 18px', fontSize: 13 },
  }
  return (
    <button
      className="ir-btn"
      onClick={onClick}
      disabled={disabled}
      style={{
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: 600,
        fontFamily: font.body,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
        ...variants[variant],
        ...sizes[size],
        ...sx,
      }}
    >
      {children}
    </button>
  )
}

/** Champ de recherche */
const SearchInput = ({ value, onChange, placeholder = 'Rechercher...' }) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    style={{
      padding: '9px 14px',
      borderRadius: 6,
      border: `1px solid ${C.border}`,
      fontSize: 13,
      fontFamily: font.body,
      outline: 'none',
      width: 260,
      maxWidth: '100%',
      transition: 'border-color 0.2s',
    }}
    onFocus={(e) => (e.target.style.borderColor = C.sky)}
    onBlur={(e) => (e.target.style.borderColor = C.border)}
  />
)

/** Pilule de filtre */
const FilterPill = ({ label, active, onClick }) => (
  <button
    className="ir-btn"
    onClick={onClick}
    style={{
      padding: '5px 14px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      border: 'none',
      cursor: 'pointer',
      fontFamily: font.body,
      background: active ? C.navy : C.borderLight,
      color: active ? C.white : C.muted,
      transition: 'all 0.15s',
    }}
  >
    {label}
  </button>
)

/** En-tête de section */
const SectionHeader = ({ title, right }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  }}>
    <h3 style={{ fontSize: 20, fontWeight: 700, color: C.navy, fontFamily: font.title, margin: 0 }}>
      {title}
    </h3>
    {right}
  </div>
)

/** Tableau responsive */
const Table = ({ headers, children }) => (
  <div style={{ overflowX: 'auto', borderRadius: 10, border: `1px solid ${C.border}` }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ background: C.bg }}>
          {headers.map((h, i) => (
            <th key={i} style={{
              padding: '10px 14px',
              textAlign: 'left',
              fontSize: 11,
              fontWeight: 700,
              color: C.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              borderBottom: `1px solid ${C.border}`,
              whiteSpace: 'nowrap',
            }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
)

/** Ligne de tableau */
const TableRow = ({ children }) => (
  <tr className="ir-row" style={{ transition: 'background 0.15s' }}>
    {children}
  </tr>
)

/** Cellule de tableau */
const Td = ({ children, style: sx, mono }) => (
  <td style={{
    padding: '10px 14px',
    borderBottom: `1px solid ${C.borderLight}`,
    fontFamily: mono ? "'Source Code Pro', 'Courier New', monospace" : font.body,
    fontSize: mono ? 12 : 13,
    ...sx,
  }}>
    {children}
  </td>
)

/** État vide */
const EmptyState = ({ text }) => (
  <div style={{
    textAlign: 'center',
    padding: '40px 20px',
    color: C.muted,
    fontSize: 14,
    animation: 'irFadeIn 0.3s ease both',
  }}>
    {text}
  </div>
)

/** Toast de notification */
const ToastContainer = ({ toasts, onRemove }) => (
  <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
    {toasts.map((t) => (
      <div
        key={t.id}
        style={{
          background: t.type === 'success' ? C.green : t.type === 'danger' ? C.terra : C.navy,
          color: C.white,
          padding: '12px 20px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: font.body,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          animation: t.removing ? 'irToastOut 0.3s ease forwards' : 'irToastIn 0.3s ease both',
          cursor: 'pointer',
          maxWidth: 360,
        }}
        onClick={() => onRemove(t.id)}
      >
        {t.message}
      </div>
    ))}
  </div>
)

// ─── HOOK TOAST ─────────────────────────────────────────────────────────────────
function useToasts() {
  const [toasts, setToasts] = useState([])
  const add = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, type, removing: false }])
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, removing: true } : t)))
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300)
    }, 3000)
  }, [])
  const remove = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, removing: true } : t)))
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300)
  }, [])
  return { toasts, add, remove }
}

// ─── BADGES DE STATUT ───────────────────────────────────────────────────────────
const statusBadges = {
  // Newsletter
  pending: { label: 'En attente', color: C.ochre, bg: '#FFF8E8' },
  added: { label: 'Ajouté', color: C.green, bg: '#E8F5EE' },
  rejected: { label: 'Refusé', color: C.terra, bg: '#FDEBE7' },
  // Articles
  draft: { label: 'Brouillon', color: C.muted, bg: C.borderLight },
  review: { label: 'Relecture', color: C.sky, bg: '#E8F0FB' },
  ready: { label: 'Prêt', color: C.ochre, bg: '#FFF8E8' },
  published: { label: 'Publié', color: C.green, bg: '#E8F5EE' },
}

const StatusBadge = ({ status }) => {
  const b = statusBadges[status]
  if (!b) return null
  return <Badge label={b.label} color={b.color} bg={b.bg} />
}

// Badges de catégorie article
const categoryColors = {
  'Économie': { color: '#5B4FA0', bg: '#EEEBFA' },
  'Écologie': { color: C.green, bg: '#E8F5EE' },
  'Social': { color: C.terra, bg: '#FDEBE7' },
  'Numérique': { color: C.sky, bg: '#E8F0FB' },
  'Géopolitique': { color: '#8B6914', bg: '#FFF4DC' },
  'Démocratie': { color: C.navy, bg: '#E3E8F0' },
}

const CategoryBadge = ({ category }) => {
  const c = categoryColors[category] || { color: C.muted, bg: C.borderLight }
  return <Badge label={category} color={c.color} bg={c.bg} />
}

// Badge de source newsletter
const sourceColors = {
  'Site web': { color: C.sky, bg: '#E8F0FB' },
  'Événement': { color: '#5B4FA0', bg: '#EEEBFA' },
  'LinkedIn': { color: '#0A66C2', bg: '#E8F0FB' },
  'Manuel': { color: C.muted, bg: C.borderLight },
}

const SourceBadge = ({ source }) => {
  const c = sourceColors[source] || { color: C.muted, bg: C.borderLight }
  return <Badge label={source} color={c.color} bg={c.bg} />
}

// ─── ONGLET DASHBOARD ───────────────────────────────────────────────────────────
const TabDashboard = ({ subscribers, articles, pages, onSubscriberAction, onPublishArticle, toast }) => {
  const pending = subscribers.filter((s) => s.status === 'pending')
  const added = subscribers.filter((s) => s.status === 'added')
  const readyArticles = articles.filter((a) => a.status === 'ready')
  const publishedArticles = articles.filter((a) => a.status === 'published')
  const pagesToUpdate = pages.filter((p) => daysSince(p.lastModified) >= 30)
  const validationRate = subscribers.length > 0
    ? Math.round((added.length / subscribers.length) * 100)
    : 0

  const workflowSteps = ['Rédaction', 'Relecture', 'Prêt', 'Push GitHub', 'En ligne']

  return (
    <div style={{ animation: 'irFadeIn 0.4s ease both' }}>
      {/* Cartes stats */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
        <StatCard label="Abonnés newsletter" value={subscribers.length} sub={`${pending.length} en attente`} accent={C.sky} />
        <StatCard label="Articles" value={articles.length} sub={`${publishedArticles.length} publiés, ${readyArticles.length} prêts`} accent={C.green} />
        <StatCard label="Pages du site" value={pages.length} sub={`${pagesToUpdate.length} à mettre à jour`} accent={C.ochre} />
        <StatCard label="Taux de validation" value={`${validationRate}%`} sub={`${added.length} inscrits validés`} accent={validationRate >= 50 ? C.green : C.terra} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 24, marginBottom: 32 }}>
        {/* Inscriptions en attente */}
        <div style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, padding: 20, animation: 'irSlideUp 0.5s ease both' }}>
          <SectionHeader title="Inscriptions en attente" />
          {pending.length === 0 ? (
            <EmptyState text="Aucune inscription en attente" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pending.slice(0, 4).map((sub) => (
                <div key={sub.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: C.bg,
                  borderRadius: 8,
                  flexWrap: 'wrap',
                  gap: 8,
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: C.navy }}>{sub.name}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{sub.email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn size="sm" variant="success" onClick={() => onSubscriberAction(sub.id, 'added')}>Ajouter</Btn>
                    <Btn size="sm" variant="danger" onClick={() => onSubscriberAction(sub.id, 'rejected')}>Refuser</Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Articles prêts à publier */}
        <div style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, padding: 20, animation: 'irSlideUp 0.6s ease both' }}>
          <SectionHeader title="Articles prêts à publier" />
          {readyArticles.length === 0 ? (
            <EmptyState text="Aucun article prêt" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {readyArticles.map((art) => (
                <div key={art.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: C.bg,
                  borderRadius: 8,
                  flexWrap: 'wrap',
                  gap: 8,
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: C.navy }}>{art.title}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{art.author} — {art.category}</div>
                  </div>
                  <Btn size="sm" variant="success" onClick={() => onPublishArticle(art.id)}>Publier</Btn>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Workflow de publication */}
      <div style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, padding: '24px 20px', animation: 'irSlideUp 0.7s ease both' }}>
        <SectionHeader title="Workflow de publication" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, overflowX: 'auto', padding: '10px 0' }}>
          {workflowSteps.map((step, i) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: i === workflowSteps.length - 1 ? C.green : C.navy,
                  color: C.white,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 14,
                  fontFamily: font.title,
                }}>
                  {i + 1}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.navy, marginTop: 8, textAlign: 'center' }}>
                  {step}
                </div>
              </div>
              {i < workflowSteps.length - 1 && (
                <div style={{ width: 48, height: 2, background: C.border, margin: '0 4px', marginBottom: 20 }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── ONGLET NEWSLETTER ──────────────────────────────────────────────────────────
const TabNewsletter = ({ subscribers, setSubscribers, toast }) => {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', source: 'Manuel' })

  const filtered = useMemo(() => {
    let list = subscribers
    if (filter !== 'all') list = list.filter((s) => s.status === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
    }
    return list
  }, [subscribers, filter, search])

  const counts = useMemo(() => ({
    added: subscribers.filter((s) => s.status === 'added').length,
    pending: subscribers.filter((s) => s.status === 'pending').length,
    rejected: subscribers.filter((s) => s.status === 'rejected').length,
  }), [subscribers])

  const handleAction = (id, newStatus) => {
    setSubscribers((prev) => prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s)))
    toast(newStatus === 'added' ? 'Abonné ajouté avec succès' : 'Inscription refusée', newStatus === 'added' ? 'success' : 'danger')
  }

  const handleAdd = () => {
    if (!formData.name.trim() || !formData.email.trim()) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast('Adresse email invalide', 'danger')
      return
    }
    const newSub = {
      id: ++_nextId,
      name: formData.name.trim(),
      email: formData.email.trim(),
      source: formData.source,
      date: new Date().toISOString().slice(0, 10),
      status: 'added',
    }
    setSubscribers((prev) => [newSub, ...prev])
    setFormData({ name: '', email: '', source: 'Manuel' })
    setShowForm(false)
    toast('Abonné ajouté manuellement')
  }

  return (
    <div style={{ animation: 'irFadeIn 0.4s ease both' }}>
      {/* Barre de contrôle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un abonné..." />
          <div style={{ display: 'flex', gap: 4 }}>
            <FilterPill label="Tous" active={filter === 'all'} onClick={() => setFilter('all')} />
            <FilterPill label="En attente" active={filter === 'pending'} onClick={() => setFilter('pending')} />
            <FilterPill label="Ajoutés" active={filter === 'added'} onClick={() => setFilter('added')} />
            <FilterPill label="Refusés" active={filter === 'rejected'} onClick={() => setFilter('rejected')} />
          </div>
        </div>
        <Btn variant={showForm ? 'ghost' : 'primary'} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Annuler' : 'Ajouter manuellement'}
        </Btn>
      </div>

      {/* Formulaire inline */}
      {showForm && (
        <div style={{
          background: C.white,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          padding: 20,
          marginBottom: 16,
          animation: 'irSlideUp 0.3s ease both',
        }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 4 }}>Nom</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                placeholder="Prénom Nom"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font.body, outline: 'none' }}
              />
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 4 }}>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@exemple.fr"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font.body, outline: 'none' }}
              />
            </div>
            <div style={{ flex: '0 0 140px' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 4 }}>Source</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData((f) => ({ ...f, source: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font.body, outline: 'none', background: C.white }}
              >
                <option>Manuel</option>
                <option>Site web</option>
                <option>Événement</option>
                <option>LinkedIn</option>
              </select>
            </div>
            <Btn variant="success" onClick={handleAdd}>Ajouter</Btn>
          </div>
        </div>
      )}

      {/* Tableau */}
      {filtered.length === 0 ? (
        <EmptyState text="Aucun abonné trouvé" />
      ) : (
        <Table headers={['Nom', 'Email', 'Source', 'Date', 'Statut', 'Actions']}>
          {filtered.map((sub) => (
            <TableRow key={sub.id}>
              <Td style={{ fontWeight: 600, color: C.navy }}>{sub.name}</Td>
              <Td>{sub.email}</Td>
              <Td><SourceBadge source={sub.source} /></Td>
              <Td>{formatDate(sub.date)}</Td>
              <Td><StatusBadge status={sub.status} /></Td>
              <Td>
                {sub.status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn size="sm" variant="success" onClick={() => handleAction(sub.id, 'added')}>Ajouter</Btn>
                    <Btn size="sm" variant="danger" onClick={() => handleAction(sub.id, 'rejected')}>Refuser</Btn>
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: C.muted }}>—</span>
                )}
              </Td>
            </TableRow>
          ))}
        </Table>
      )}

      {/* Footer récapitulatif */}
      <div style={{
        marginTop: 16,
        padding: '12px 16px',
        background: C.white,
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        fontSize: 13,
        color: C.muted,
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <span><strong style={{ color: C.green }}>{counts.added}</strong> ajoutés</span>
        <span><strong style={{ color: C.ochre }}>{counts.pending}</strong> en attente</span>
        <span><strong style={{ color: C.terra }}>{counts.rejected}</strong> refusés</span>
        <span><strong style={{ color: C.navy }}>{subscribers.length}</strong> total</span>
      </div>
    </div>
  )
}

// ─── ONGLET ARTICLES ────────────────────────────────────────────────────────────
const TabArticles = ({ articles, setArticles, toast }) => {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ title: '', author: '', category: 'Économie', content: '', status: 'draft' })
  const [syncingId, setSyncingId] = useState(null)

  const categories = ['Économie', 'Écologie', 'Social', 'Numérique', 'Géopolitique', 'Démocratie']

  const filtered = useMemo(() => {
    let list = articles
    if (filter !== 'all') list = list.filter((a) => a.status === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((a) => a.title.toLowerCase().includes(q) || a.author.toLowerCase().includes(q))
    }
    return list
  }, [articles, filter, search])

  const resetForm = () => {
    setFormData({ title: '', author: '', category: 'Économie', content: '', status: 'draft' })
    setEditingId(null)
    setShowForm(false)
  }

  const openEdit = (art) => {
    setFormData({ title: art.title, author: art.author, category: art.category, content: art.content, status: art.status })
    setEditingId(art.id)
    setShowForm(true)
  }

  const handleSave = () => {
    if (!formData.title.trim() || !formData.author.trim()) {
      toast('Titre et auteur requis', 'danger')
      return
    }
    if (editingId) {
      setArticles((prev) => prev.map((a) =>
        a.id === editingId ? { ...a, title: formData.title.trim(), author: formData.author.trim(), category: formData.category, content: formData.content.trim() } : a
      ))
      toast('Article mis à jour')
    } else {
      const newArt = {
        id: ++_nextId,
        title: formData.title.trim(),
        author: formData.author.trim(),
        category: formData.category,
        content: formData.content.trim(),
        date: new Date().toISOString().slice(0, 10),
        status: 'draft',
        synced: false,
      }
      setArticles((prev) => [newArt, ...prev])
      toast('Nouvel article créé')
    }
    resetForm()
  }

  const changeStatus = (id, newStatus) => {
    setArticles((prev) => prev.map((a) => (a.id === id ? { ...a, status: newStatus, synced: newStatus === 'draft' ? false : a.synced } : a)))
    const labels = { review: 'Article passé en relecture', ready: 'Article marqué prêt', draft: 'Article dépublié' }
    toast(labels[newStatus] || 'Statut mis à jour')
  }

  const pushGitHub = (id) => {
    setSyncingId(id)
    setTimeout(() => {
      setArticles((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'published', synced: true } : a)))
      setSyncingId(null)
      toast('Article publié sur GitHub Pages')
    }, 2000)
  }

  return (
    <div style={{ animation: 'irFadeIn 0.4s ease both' }}>
      {/* Barre de contrôle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un article..." />
          <div style={{ display: 'flex', gap: 4 }}>
            <FilterPill label="Tous" active={filter === 'all'} onClick={() => setFilter('all')} />
            <FilterPill label="Brouillons" active={filter === 'draft'} onClick={() => setFilter('draft')} />
            <FilterPill label="Relecture" active={filter === 'review'} onClick={() => setFilter('review')} />
            <FilterPill label="Prêts" active={filter === 'ready'} onClick={() => setFilter('ready')} />
            <FilterPill label="Publiés" active={filter === 'published'} onClick={() => setFilter('published')} />
          </div>
        </div>
        <Btn
          variant={showForm && !editingId ? 'ghost' : 'primary'}
          onClick={() => { if (showForm && !editingId) resetForm(); else { resetForm(); setShowForm(true); } }}
        >
          {showForm && !editingId ? 'Annuler' : 'Nouvel article'}
        </Btn>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div style={{
          background: C.white,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          padding: 20,
          marginBottom: 16,
          animation: 'irSlideUp 0.3s ease both',
        }}>
          <h4 style={{ margin: '0 0 16px', fontFamily: font.title, fontSize: 18, color: C.navy }}>
            {editingId ? 'Modifier l\'article' : 'Nouvel article'}
          </h4>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ flex: '1 1 250px' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 4 }}>Titre</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
                placeholder="Titre de l'article"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font.body, outline: 'none' }}
              />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 4 }}>Auteur</label>
              <input
                type="text"
                value={formData.author}
                onChange={(e) => setFormData((f) => ({ ...f, author: e.target.value }))}
                placeholder="Prénom Nom"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font.body, outline: 'none' }}
              />
            </div>
            <div style={{ flex: '0 0 160px' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 4 }}>Catégorie</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font.body, outline: 'none', background: C.white }}
              >
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 4 }}>Contenu</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData((f) => ({ ...f, content: e.target.value }))}
              placeholder="Contenu de l'article..."
              rows={4}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font.body, outline: 'none', resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="success" onClick={handleSave}>{editingId ? 'Sauvegarder' : 'Créer l\'article'}</Btn>
            <Btn variant="ghost" onClick={resetForm}>Annuler</Btn>
          </div>
        </div>
      )}

      {/* Tableau */}
      {filtered.length === 0 ? (
        <EmptyState text="Aucun article trouvé" />
      ) : (
        <Table headers={['Titre', 'Auteur', 'Catégorie', 'Date', 'Statut', 'Sync GitHub', 'Actions']}>
          {filtered.map((art) => (
            <TableRow key={art.id}>
              <Td style={{ fontWeight: 600, color: C.navy, maxWidth: 260 }}>{art.title}</Td>
              <Td>{art.author}</Td>
              <Td><CategoryBadge category={art.category} /></Td>
              <Td style={{ whiteSpace: 'nowrap' }}>{formatDate(art.date)}</Td>
              <Td><StatusBadge status={art.status} /></Td>
              <Td>
                {syncingId === art.id ? (
                  <span style={{ fontSize: 12, color: C.sky, fontWeight: 600 }}>Synchronisation...</span>
                ) : (
                  <span style={{ fontSize: 12, color: art.synced ? C.green : C.muted, fontWeight: 600 }}>
                    {art.synced ? 'Synchronisé' : 'Non sync.'}
                  </span>
                )}
              </Td>
              <Td>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {art.status === 'draft' && (
                    <>
                      <Btn size="sm" variant="ghost" onClick={() => openEdit(art)}>Éditer</Btn>
                      <Btn size="sm" variant="primary" onClick={() => changeStatus(art.id, 'review')}>Passer en relecture</Btn>
                    </>
                  )}
                  {art.status === 'review' && (
                    <>
                      <Btn size="sm" variant="ghost" onClick={() => openEdit(art)}>Éditer</Btn>
                      <Btn size="sm" variant="primary" onClick={() => changeStatus(art.id, 'ready')}>Marquer prêt</Btn>
                    </>
                  )}
                  {art.status === 'ready' && (
                    <>
                      <Btn size="sm" variant="ghost" onClick={() => openEdit(art)}>Éditer</Btn>
                      <Btn size="sm" variant="success" onClick={() => pushGitHub(art.id)} disabled={syncingId === art.id}>
                        {syncingId === art.id ? 'Synchronisation...' : 'Push GitHub'}
                      </Btn>
                    </>
                  )}
                  {art.status === 'published' && (
                    <>
                      <Btn size="sm" variant="ghost" onClick={() => toast(`Aperçu : ${art.title}`)}>Voir</Btn>
                      <Btn size="sm" variant="danger" onClick={() => changeStatus(art.id, 'draft')}>Dépublier</Btn>
                    </>
                  )}
                </div>
              </Td>
            </TableRow>
          ))}
        </Table>
      )}
    </div>
  )
}

// ─── ONGLET PAGES ───────────────────────────────────────────────────────────────
const TabPages = ({ pages, toast }) => {
  const upToDate = pages.filter((p) => daysSince(p.lastModified) < 30)
  const toReview = pages.filter((p) => { const d = daysSince(p.lastModified); return d >= 30 && d <= 60 })
  const obsolete = pages.filter((p) => daysSince(p.lastModified) > 60)

  return (
    <div style={{ animation: 'irFadeIn 0.4s ease both' }}>
      {/* Cartes récap */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatCard label="Pages à jour" value={upToDate.length} accent={C.green} sub="Moins de 30 jours" />
        <StatCard label="Pages à revoir" value={toReview.length} accent={C.ochre} sub="Entre 30 et 60 jours" />
        <StatCard label="Pages obsolètes" value={obsolete.length} accent={C.terra} sub="Plus de 60 jours" />
      </div>

      {/* Tableau */}
      <Table headers={['Page', 'Chemin', 'Dernière modification', 'Ancienneté', 'Statut', 'Actions']}>
        {pages.map((page) => {
          const days = daysSince(page.lastModified)
          return (
            <TableRow key={page.id}>
              <Td style={{ fontWeight: 600, color: C.navy }}>{page.name}</Td>
              <Td mono>{page.path}</Td>
              <Td style={{ whiteSpace: 'nowrap' }}>{formatDate(page.lastModified)}</Td>
              <Td>
                <span style={{ fontWeight: 600, color: freshnessColor(days) }}>
                  {days} jour{days !== 1 ? 's' : ''}
                </span>
              </Td>
              <Td>
                <Badge
                  label={freshnessLabel(days)}
                  color={freshnessColor(days)}
                  bg={days < 30 ? '#E8F5EE' : days <= 60 ? '#FFF8E8' : '#FDEBE7'}
                />
              </Td>
              <Td>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Btn size="sm" variant="ghost" onClick={() => toast(`Édition de ${page.name}`)}>Éditer</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => toast(`Aperçu : ${page.path}`)}>Voir</Btn>
                </div>
              </Td>
            </TableRow>
          )
        })}
      </Table>

      {/* Légende */}
      <div style={{
        marginTop: 16,
        padding: '12px 16px',
        background: C.white,
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        fontSize: 13,
        color: C.muted,
        display: 'flex',
        gap: 24,
        flexWrap: 'wrap',
      }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: C.green, marginRight: 6, verticalAlign: 'middle' }} />Moins de 30 jours = à jour</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: C.ochre, marginRight: 6, verticalAlign: 'middle' }} />30 à 60 jours = à revoir</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: C.terra, marginRight: 6, verticalAlign: 'middle' }} />Plus de 60 jours = obsolète</span>
      </div>
    </div>
  )
}

// ─── APPLICATION PRINCIPALE ─────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [subscribers, setSubscribers] = useState(initialSubscribers)
  const [articles, setArticles] = useState(initialArticles)
  const { toasts, add: toast, remove: removeToast } = useToasts()

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'newsletter', label: 'Newsletter' },
    { id: 'articles', label: 'Articles' },
    { id: 'pages', label: 'Pages' },
  ]

  const handleSubscriberAction = useCallback((id, newStatus) => {
    setSubscribers((prev) => prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s)))
    toast(newStatus === 'added' ? 'Abonné ajouté avec succès' : 'Inscription refusée', newStatus === 'added' ? 'success' : 'danger')
  }, [toast])

  const handlePublishArticle = useCallback((id) => {
    const art = articles.find((a) => a.id === id)
    if (!art) return
    toast(`Publication de "${art.title}" en cours...`)
    setTimeout(() => {
      setArticles((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'published', synced: true } : a)))
      toast('Article publié sur GitHub Pages')
    }, 2000)
  }, [articles, toast])

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: font.body }}>
      {/* Header sticky */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: C.navy,
        padding: '0 24px',
        boxShadow: '0 2px 12px rgba(27,42,74,0.15)',
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}>
          <h1 style={{
            fontSize: 20,
            fontWeight: 700,
            color: C.white,
            fontFamily: font.title,
            margin: 0,
            padding: '14px 0',
            letterSpacing: '-0.01em',
          }}>
            Institut Rousseau
          </h1>
          <nav style={{ display: 'flex', gap: 0 }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                className="ir-btn"
                onClick={() => setTab(t.id)}
                style={{
                  padding: '14px 20px',
                  background: 'transparent',
                  border: 'none',
                  color: tab === t.id ? C.white : 'rgba(255,255,255,0.55)',
                  fontWeight: 600,
                  fontSize: 14,
                  fontFamily: font.body,
                  cursor: 'pointer',
                  borderBottom: tab === t.id ? `2px solid ${C.white}` : '2px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Contenu */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 60px' }}>
        {tab === 'dashboard' && (
          <TabDashboard
            subscribers={subscribers}
            articles={articles}
            pages={initialPages}
            onSubscriberAction={handleSubscriberAction}
            onPublishArticle={handlePublishArticle}
            toast={toast}
          />
        )}
        {tab === 'newsletter' && (
          <TabNewsletter subscribers={subscribers} setSubscribers={setSubscribers} toast={toast} />
        )}
        {tab === 'articles' && (
          <TabArticles articles={articles} setArticles={setArticles} toast={toast} />
        )}
        {tab === 'pages' && (
          <TabPages pages={initialPages} toast={toast} />
        )}
      </main>

      {/* Toasts */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
