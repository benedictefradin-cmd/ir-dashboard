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
  red: '#D32F2F',
}

const font = {
  title: "'Cormorant Garamond', Georgia, serif",
  body: "'Source Sans 3', 'Segoe UI', sans-serif",
}

// ─── CSS ANIMATIONS (injected once) ────────────────────────────────────────────
const styleId = 'ir-dashboard-styles'
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 500px; } }
    @keyframes toastIn { from { opacity: 0; transform: translateX(100px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes toastOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(100px); } }
  `
  document.head.appendChild(style)
}

// ─── HELPERS ────────────────────────────────────────────────────────────────────
const MONTHS_FR = ['janv.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

function formatDateFR(dateStr) {
  const d = new Date(dateStr)
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
}

function daysAgo(dateStr) {
  const now = new Date('2026-04-12')
  const d = new Date(dateStr)
  return Math.floor((now - d) / (1000 * 60 * 60 * 24))
}

function formatAge(dateStr) {
  const days = daysAgo(dateStr)
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'il y a 1 jour'
  if (days < 30) return `il y a ${days} jours`
  const months = Math.floor(days / 30)
  if (months === 1) return 'il y a 1 mois'
  if (months < 12) return `il y a ${months} mois`
  const years = Math.floor(months / 12)
  return years === 1 ? 'il y a 1 an' : `il y a ${years} ans`
}

function todayStr() {
  return '2026-04-12'
}

// ─── INITIAL DATA ───────────────────────────────────────────────────────────────
const INIT_SUBSCRIBERS = [
  { id: 1, name: 'Marie Dupont', email: 'marie.dupont@gmail.com', date: '2026-04-01', status: 'added', source: 'Site web' },
  { id: 2, name: 'Jean Martin', email: 'j.martin@outlook.fr', date: '2026-04-03', status: 'pending', source: 'Site web' },
  { id: 3, name: 'Sophie Bernard', email: 'sophie.b@proton.me', date: '2026-04-05', status: 'added', source: 'Événement' },
  { id: 4, name: 'Pierre Leclerc', email: 'p.leclerc@yahoo.fr', date: '2026-04-06', status: 'pending', source: 'Site web' },
  { id: 5, name: 'Alice Moreau', email: 'a.moreau@gmail.com', date: '2026-04-07', status: 'rejected', source: 'Manuel' },
  { id: 6, name: 'Lucas Rousseau', email: 'lucas.r@free.fr', date: '2026-04-08', status: 'pending', source: 'Site web' },
  { id: 7, name: 'Camille Durand', email: 'camille.d@gmail.com', date: '2026-04-09', status: 'pending', source: 'LinkedIn' },
  { id: 8, name: 'Nicolas Petit', email: 'n.petit@laposte.net', date: '2026-04-10', status: 'added', source: 'Site web' },
  { id: 9, name: 'Emma Laurent', email: 'emma.l@gmail.com', date: '2026-04-10', status: 'pending', source: 'Événement' },
  { id: 10, name: 'Hugo Garcia', email: 'hugo.g@outlook.fr', date: '2026-04-11', status: 'added', source: 'Site web' },
]

const INIT_ARTICLES = [
  { id: 1, title: 'Pour une politique industrielle verte européenne', author: 'Gaël Giraud', status: 'published', date: '2026-03-15', category: 'Économie', synced: true, content: '' },
  { id: 2, title: "Réformer la PAC : urgences et leviers d'action", author: 'Léa Falco', status: 'published', date: '2026-03-22', category: 'Écologie', synced: true, content: '' },
  { id: 3, title: 'Souveraineté numérique et communs digitaux', author: 'Nicolas Music', status: 'ready', date: '2026-04-01', category: 'Numérique', synced: false, content: '' },
  { id: 4, title: "L'avenir de la protection sociale en France", author: 'Chloé Music', status: 'draft', date: '2026-04-05', category: 'Social', synced: false, content: '' },
  { id: 5, title: 'Planification écologique : retour sur un an', author: 'Pierre Music', status: 'ready', date: '2026-04-08', category: 'Écologie', synced: false, content: '' },
  { id: 6, title: "Géopolitique de l'énergie : nouveaux équilibres", author: 'Sophie Music', status: 'draft', date: '2026-04-10', category: 'Géopolitique', synced: false, content: '' },
  { id: 7, title: "Démocratiser l'entreprise : propositions concrètes", author: 'Marc Music', status: 'review', date: '2026-04-11', category: 'Démocratie', synced: false, content: '' },
]

const INIT_PAGES = [
  { id: 1, name: 'Accueil', path: '/', lastModified: '2026-04-08', refreshCycle: 60 },
  { id: 2, name: 'Qui sommes-nous', path: '/qui-sommes-nous', lastModified: '2026-03-20', refreshCycle: 180 },
  { id: 3, name: 'Publications', path: '/publications', lastModified: '2026-04-10', refreshCycle: 30 },
  { id: 4, name: 'Événements', path: '/evenements', lastModified: '2026-03-01', refreshCycle: 30 },
  { id: 5, name: 'Presse', path: '/presse', lastModified: '2026-04-05', refreshCycle: 45 },
  { id: 6, name: "L'équipe", path: '/equipe', lastModified: '2026-02-15', refreshCycle: 180 },
  { id: 7, name: 'Adhérer / Donner', path: '/adherer', lastModified: '2026-04-01', refreshCycle: 120 },
  { id: 8, name: 'Contact', path: '/contact', lastModified: '2026-01-10', refreshCycle: 180 },
  { id: 9, name: 'Mentions légales', path: '/mentions-legales', lastModified: '2025-12-01', refreshCycle: 365 },
  { id: 10, name: 'Road to Net Zero', path: '/road-to-net-zero', lastModified: '2026-03-28', refreshCycle: 90 },
]

function getPageStatus(page) {
  const age = daysAgo(page.lastModified)
  if (age < page.refreshCycle) return 'fresh'
  if (age < page.refreshCycle * 1.5) return 'review'
  return 'stale'
}

// ─── REUSABLE COMPONENTS ────────────────────────────────────────────────────────

function Toast({ toasts, removeToast }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: C.navy, color: C.white, padding: '12px 20px', borderRadius: 10,
          fontFamily: font.body, fontSize: 14, animation: t.removing ? 'toastOut 0.3s forwards' : 'toastIn 0.3s ease-out',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)', maxWidth: 320
        }}>
          {t.message}
        </div>
      ))}
    </div>
  )
}

function useToasts() {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)
  const addToast = useCallback((message) => {
    const id = nextId.current++
    setToasts(prev => [...prev, { id, message, removing: false }])
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t))
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300)
    }, 2700)
  }, [])
  return { toasts, addToast }
}

function Badge({ label, color, bg }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600,
      fontFamily: font.body, color: color || C.white, background: bg || C.muted, whiteSpace: 'nowrap'
    }}>
      {label}
    </span>
  )
}

function StatusBadge({ status }) {
  const map = {
    added: { label: 'Ajouté', bg: C.green, color: C.white },
    pending: { label: 'En attente', bg: C.ochre, color: C.white },
    rejected: { label: 'Refusé', bg: C.terra, color: C.white },
    draft: { label: 'Brouillon', bg: C.muted, color: C.white },
    review: { label: 'Relecture', bg: C.ochre, color: C.white },
    ready: { label: 'Prêt', bg: C.sky, color: C.white },
    published: { label: 'Publié', bg: C.green, color: C.white },
  }
  const s = map[status] || { label: status, bg: C.muted, color: C.white }
  return <Badge label={s.label} color={s.color} bg={s.bg} />
}

function PageStatusBadge({ status }) {
  const map = {
    fresh: { label: 'À jour', bg: C.green, color: C.white },
    review: { label: 'À revoir', bg: C.ochre, color: C.white },
    stale: { label: 'Obsolète', bg: C.terra, color: C.white },
  }
  const s = map[status]
  return <Badge label={s.label} color={s.color} bg={s.bg} />
}

function Btn({ children, onClick, variant = 'primary', disabled, style: extraStyle }) {
  const styles = {
    primary: { background: C.navy, color: C.white, border: 'none' },
    secondary: { background: 'transparent', color: C.navy, border: `1px solid ${C.border}` },
    success: { background: C.green, color: C.white, border: 'none' },
    danger: { background: C.terra, color: C.white, border: 'none' },
    ghost: { background: 'transparent', color: C.sky, border: 'none', padding: '4px 8px' },
    ghostDanger: { background: 'transparent', color: C.terra, border: 'none', padding: '4px 8px' },
    ghostSuccess: { background: 'transparent', color: C.green, border: 'none', padding: '4px 8px' },
  }
  const s = styles[variant] || styles.primary
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: font.body, fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s ease', ...s, ...extraStyle,
      }}
      onMouseEnter={e => { if (!disabled) e.target.style.opacity = '0.8' }}
      onMouseLeave={e => { if (!disabled) e.target.style.opacity = '1' }}
    >
      {children}
    </button>
  )
}

function Card({ children, accent, style: extraStyle }) {
  return (
    <div style={{
      background: C.white, borderRadius: 10, border: `1px solid ${C.borderLight}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden',
      animation: 'slideUp 0.4s ease-out', ...extraStyle,
    }}>
      {accent && <div style={{ height: 3, background: accent }} />}
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <h3 style={{ fontFamily: font.title, fontSize: 22, fontWeight: 600, color: C.navy, margin: '0 0 16px 0' }}>
      {children}
    </h3>
  )
}

function Input({ value, onChange, placeholder, type = 'text', style: extra }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        fontFamily: font.body, fontSize: 14, padding: '8px 12px', borderRadius: 6,
        border: `1px solid ${C.border}`, outline: 'none', width: '100%',
        transition: 'border-color 0.2s', ...extra,
      }}
      onFocus={e => e.target.style.borderColor = C.sky}
      onBlur={e => e.target.style.borderColor = C.border}
    />
  )
}

function Select({ value, onChange, options, style: extra }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        fontFamily: font.body, fontSize: 14, padding: '8px 12px', borderRadius: 6,
        border: `1px solid ${C.border}`, outline: 'none', background: C.white,
        cursor: 'pointer', ...extra,
      }}
    >
      {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
    </select>
  )
}

function Textarea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        fontFamily: font.body, fontSize: 14, padding: '8px 12px', borderRadius: 6,
        border: `1px solid ${C.border}`, outline: 'none', width: '100%', resize: 'vertical',
      }}
      onFocus={e => e.target.style.borderColor = C.sky}
      onBlur={e => e.target.style.borderColor = C.border}
    />
  )
}

function TableWrap({ children }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: `1px solid ${C.borderLight}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: font.body, fontSize: 14 }}>
        {children}
      </table>
    </div>
  )
}

function Th({ children, style: extra }) {
  return (
    <th style={{
      textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 12, textTransform: 'uppercase',
      letterSpacing: '0.5px', color: C.muted, background: '#F7F6F3', borderBottom: `1px solid ${C.borderLight}`,
      whiteSpace: 'nowrap', ...extra,
    }}>
      {children}
    </th>
  )
}

function Td({ children, style: extra }) {
  return (
    <td style={{ padding: '10px 14px', borderBottom: `1px solid ${C.borderLight}`, verticalAlign: 'middle', ...extra }}>
      {children}
    </td>
  )
}

function Tr({ children }) {
  const [hovered, setHovered] = useState(false)
  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? '#FAFAF7' : 'transparent', transition: 'background 0.15s' }}
    >
      {children}
    </tr>
  )
}

function Pill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: font.body, fontSize: 13, fontWeight: active ? 600 : 400, padding: '5px 14px',
        borderRadius: 20, border: active ? `1px solid ${C.navy}` : `1px solid ${C.border}`,
        background: active ? C.navy : 'transparent', color: active ? C.white : C.navy,
        cursor: 'pointer', transition: 'all 0.2s',
      }}
    >
      {label}
    </button>
  )
}

// ─── LOGIN SCREEN ───────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (username === 'admin' && password === 'IR2026!') {
      onLogin()
    } else {
      setError('Identifiants incorrects')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: C.bg, fontFamily: font.body, animation: 'fadeIn 0.5s ease-out',
    }}>
      <div style={{ width: '100%', maxWidth: 380, padding: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontFamily: font.title, fontSize: 42, fontWeight: 700, color: C.navy, margin: 0, lineHeight: 1.1 }}>
            Institut Rousseau
          </h1>
          <p style={{ fontFamily: font.body, fontSize: 16, color: C.muted, marginTop: 8 }}>
            Back-office de gestion
          </p>
        </div>
        <form onSubmit={handleSubmit}>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.navy, display: 'block', marginBottom: 4 }}>Identifiant</label>
                <Input value={username} onChange={v => { setUsername(v); setError('') }} placeholder="Identifiant" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.navy, display: 'block', marginBottom: 4 }}>Mot de passe</label>
                <Input value={password} onChange={v => { setPassword(v); setError('') }} placeholder="Mot de passe" type="password" />
              </div>
              {error && (
                <p style={{ color: C.terra, fontSize: 13, margin: 0 }}>{error}</p>
              )}
              <Btn onClick={() => {}} variant="primary" style={{ width: '100%', padding: '10px 0', fontSize: 15, marginTop: 4 }}>
                Se connecter
              </Btn>
            </div>
          </Card>
        </form>
      </div>
    </div>
  )
}

// ─── HEADER ─────────────────────────────────────────────────────────────────────
function Header({ tab, setTab, onLogout }) {
  const tabs = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'newsletter', label: 'Newsletter' },
    { key: 'articles', label: 'Articles' },
    { key: 'pages', label: 'Pages' },
  ]
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100, background: C.navy, color: C.white,
      fontFamily: font.body, boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 24px',
        display: 'flex', alignItems: 'center', height: 56, gap: 24, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8 }}>
          <span style={{
            fontFamily: font.title, fontWeight: 700, fontSize: 22, background: C.sky,
            color: C.white, padding: '2px 10px', borderRadius: 6, lineHeight: 1.3,
          }}>IR</span>
          <span style={{ fontFamily: font.title, fontWeight: 600, fontSize: 18, whiteSpace: 'nowrap' }}>Institut Rousseau</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>Back-office</span>
        </div>
        <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                fontFamily: font.body, fontSize: 14, fontWeight: tab === t.key ? 600 : 400,
                color: C.white, background: tab === t.key ? 'rgba(255,255,255,0.15)' : 'transparent',
                border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => { if (tab !== t.key) e.target.style.background = 'rgba(255,255,255,0.08)' }}
              onMouseLeave={e => { if (tab !== t.key) e.target.style.background = 'transparent' }}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <button
          onClick={onLogout}
          style={{
            fontFamily: font.body, fontSize: 13, color: 'rgba(255,255,255,0.6)', background: 'transparent',
            border: '1px solid rgba(255,255,255,0.2)', padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.target.style.color = C.white; e.target.style.borderColor = 'rgba(255,255,255,0.5)' }}
          onMouseLeave={e => { e.target.style.color = 'rgba(255,255,255,0.6)'; e.target.style.borderColor = 'rgba(255,255,255,0.2)' }}
        >
          Déconnexion
        </button>
      </div>
    </header>
  )
}

// ─── DASHBOARD TAB ──────────────────────────────────────────────────────────────
function DashboardTab({ subscribers, articles, pages, onApprove, onReject, onPublish }) {
  const totalSubs = subscribers.length
  const pendingSubs = subscribers.filter(s => s.status === 'pending').length
  const addedSubs = subscribers.filter(s => s.status === 'added').length
  const totalArticles = articles.length
  const publishedArticles = articles.filter(a => a.status === 'published').length
  const readyArticles = articles.filter(a => a.status === 'ready').length
  const totalPages = pages.length
  const pagesToUpdate = pages.filter(p => getPageStatus(p) !== 'fresh').length
  const validationRate = totalSubs > 0 ? Math.round((addedSubs / totalSubs) * 100) : 0

  const pendingList = subscribers.filter(s => s.status === 'pending').slice(-4).reverse()
  const readyList = articles.filter(a => a.status === 'ready')

  const workflowSteps = ['Rédaction', 'Relecture', 'Prêt', 'Push GitHub', 'En ligne']

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        <Card accent={C.sky}>
          <p style={{ fontSize: 13, color: C.muted, margin: 0, fontFamily: font.body }}>Abonnés newsletter</p>
          <p style={{ fontSize: 36, fontWeight: 700, color: C.navy, margin: '4px 0', fontFamily: font.title }}>{totalSubs}</p>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>{pendingSubs} en attente</p>
        </Card>
        <Card accent={C.green}>
          <p style={{ fontSize: 13, color: C.muted, margin: 0, fontFamily: font.body }}>Articles</p>
          <p style={{ fontSize: 36, fontWeight: 700, color: C.navy, margin: '4px 0', fontFamily: font.title }}>{totalArticles}</p>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>{publishedArticles} publiés, {readyArticles} prêts</p>
        </Card>
        <Card accent={C.ochre}>
          <p style={{ fontSize: 13, color: C.muted, margin: 0, fontFamily: font.body }}>Pages du site</p>
          <p style={{ fontSize: 36, fontWeight: 700, color: C.navy, margin: '4px 0', fontFamily: font.title }}>{totalPages}</p>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>{pagesToUpdate} à mettre à jour</p>
        </Card>
        <Card accent={C.terra}>
          <p style={{ fontSize: 13, color: C.muted, margin: 0, fontFamily: font.body }}>Taux de validation</p>
          <p style={{ fontSize: 36, fontWeight: 700, color: C.navy, margin: '4px 0', fontFamily: font.title }}>{validationRate}%</p>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>inscrits validés</p>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24, marginBottom: 32 }}>
        {/* Pending subscriptions */}
        <Card>
          <SectionTitle>Inscriptions en attente</SectionTitle>
          {pendingList.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 14 }}>Aucune inscription en attente</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pendingList.map(s => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  padding: '8px 12px', background: '#F7F6F3', borderRadius: 8,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, margin: 0, color: C.navy }}>{s.name}</p>
                    <p style={{ fontSize: 12, color: C.muted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.email}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <Btn variant="ghostSuccess" onClick={() => onApprove(s.id)}>Ajouter</Btn>
                    <Btn variant="ghostDanger" onClick={() => onReject(s.id)}>Refuser</Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Ready articles */}
        <Card>
          <SectionTitle>Articles prêts à publier</SectionTitle>
          {readyList.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 14 }}>Aucun article prêt</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {readyList.map(a => (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  padding: '8px 12px', background: '#F7F6F3', borderRadius: 8,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, margin: 0, color: C.navy, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</p>
                    <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{a.author}</p>
                  </div>
                  <Btn variant="ghost" onClick={() => onPublish(a.id)}>Publier</Btn>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Workflow */}
      <Card>
        <SectionTitle>Workflow de publication</SectionTitle>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 0, overflowX: 'auto', padding: '16px 0' }}>
          {workflowSteps.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: C.navy, color: C.white, fontFamily: font.title, fontSize: 20, fontWeight: 700,
                }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: 12, color: C.navy, fontWeight: 500, marginTop: 8, textAlign: 'center', fontFamily: font.body }}>
                  {step}
                </span>
              </div>
              {i < workflowSteps.length - 1 && (
                <div style={{ width: 48, height: 2, background: C.border, marginTop: -16 }} />
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ─── NEWSLETTER TAB ─────────────────────────────────────────────────────────────
function NewsletterTab({ subscribers, setSubscribers, addToast }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formSource, setFormSource] = useState('Site web')

  const filtered = useMemo(() => {
    let list = subscribers
    if (filter !== 'all') list = list.filter(s => s.status === filter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
    }
    return list
  }, [subscribers, filter, search])

  const approve = (id) => {
    setSubscribers(prev => prev.map(s => s.id === id ? { ...s, status: 'added' } : s))
    addToast('Abonné ajouté avec succès')
  }
  const reject = (id) => {
    setSubscribers(prev => prev.map(s => s.id === id ? { ...s, status: 'rejected' } : s))
    addToast('Inscription refusée')
  }
  const addManual = () => {
    if (!formName.trim() || !formEmail.trim()) return
    const newSub = {
      id: Date.now(), name: formName.trim(), email: formEmail.trim(),
      date: todayStr(), status: 'pending', source: formSource,
    }
    setSubscribers(prev => [...prev, newSub])
    setFormName(''); setFormEmail(''); setFormSource('Site web'); setShowForm(false)
    addToast('Abonné ajouté manuellement')
  }

  const counts = {
    all: subscribers.length,
    pending: subscribers.filter(s => s.status === 'pending').length,
    added: subscribers.filter(s => s.status === 'added').length,
    rejected: subscribers.filter(s => s.status === 'rejected').length,
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <Input value={search} onChange={setSearch} placeholder="Rechercher par nom ou email..." style={{ maxWidth: 300, flex: 1 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'Tous' },
            { key: 'pending', label: 'En attente' },
            { key: 'added', label: 'Ajoutés' },
            { key: 'rejected', label: 'Refusés' },
          ].map(f => <Pill key={f.key} label={f.label} active={filter === f.key} onClick={() => setFilter(f.key)} />)}
        </div>
        <Btn onClick={() => setShowForm(!showForm)} variant={showForm ? 'secondary' : 'primary'}>
          {showForm ? 'Annuler' : 'Ajouter manuellement'}
        </Btn>
      </div>

      {showForm && (
        <Card style={{ marginBottom: 16, animation: 'slideUp 0.3s ease-out' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.navy, display: 'block', marginBottom: 4 }}>Nom</label>
              <Input value={formName} onChange={setFormName} placeholder="Nom complet" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.navy, display: 'block', marginBottom: 4 }}>Email</label>
              <Input value={formEmail} onChange={setFormEmail} placeholder="email@exemple.fr" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.navy, display: 'block', marginBottom: 4 }}>Source</label>
              <Select value={formSource} onChange={setFormSource} options={['Site web', 'Événement', 'LinkedIn', 'Manuel']} style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="secondary" onClick={() => setShowForm(false)}>Annuler</Btn>
              <Btn variant="primary" onClick={addManual}>Ajouter</Btn>
            </div>
          </div>
        </Card>
      )}

      <TableWrap>
        <thead>
          <tr>
            <Th>Nom</Th><Th>Email</Th><Th>Source</Th><Th>Date</Th><Th>Statut</Th><Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(s => (
            <Tr key={s.id}>
              <Td style={{ fontWeight: 600, color: C.navy }}>{s.name}</Td>
              <Td style={{ color: C.muted }}>{s.email}</Td>
              <Td><Badge label={s.source} bg='#EDEAE4' color={C.navy} /></Td>
              <Td style={{ whiteSpace: 'nowrap' }}>{formatDateFR(s.date)}</Td>
              <Td><StatusBadge status={s.status} /></Td>
              <Td>
                {s.status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Btn variant="ghostSuccess" onClick={() => approve(s.id)}>Ajouter</Btn>
                    <Btn variant="ghostDanger" onClick={() => reject(s.id)}>Refuser</Btn>
                  </div>
                ) : (
                  <span style={{ color: C.muted }}>—</span>
                )}
              </Td>
            </Tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: C.muted, fontFamily: font.body }}>Aucun résultat</td></tr>
          )}
        </tbody>
      </TableWrap>

      <div style={{
        display: 'flex', gap: 16, marginTop: 16, fontSize: 13, color: C.muted, fontFamily: font.body, flexWrap: 'wrap',
      }}>
        <span>Total : {counts.all}</span>
        <span>En attente : {counts.pending}</span>
        <span>Ajoutés : {counts.added}</span>
        <span>Refusés : {counts.rejected}</span>
      </div>
    </div>
  )
}

// ─── ARTICLES TAB ───────────────────────────────────────────────────────────────
function ArticlesTab({ articles, setArticles, addToast }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formTitle, setFormTitle] = useState('')
  const [formAuthor, setFormAuthor] = useState('')
  const [formCategory, setFormCategory] = useState('Économie')
  const [formContent, setFormContent] = useState('')
  const [syncingId, setSyncingId] = useState(null)

  const categories = ['Économie', 'Écologie', 'Social', 'Numérique', 'Géopolitique', 'Démocratie']

  const filtered = useMemo(() => {
    let list = articles
    if (filter !== 'all') list = list.filter(a => a.status === filter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(a => a.title.toLowerCase().includes(q) || a.author.toLowerCase().includes(q))
    }
    return list
  }, [articles, filter, search])

  const resetForm = () => {
    setFormTitle(''); setFormAuthor(''); setFormCategory('Économie'); setFormContent('')
    setShowForm(false); setEditingId(null)
  }

  const openNew = () => {
    resetForm(); setShowForm(true); setEditingId(null)
  }

  const openEdit = (a) => {
    setFormTitle(a.title); setFormAuthor(a.author); setFormCategory(a.category); setFormContent(a.content || '')
    setEditingId(a.id); setShowForm(true)
  }

  const saveArticle = () => {
    if (!formTitle.trim() || !formAuthor.trim()) return
    if (editingId) {
      setArticles(prev => prev.map(a => a.id === editingId ? { ...a, title: formTitle.trim(), author: formAuthor.trim(), category: formCategory, content: formContent } : a))
      addToast('Article modifié')
    } else {
      const newArticle = {
        id: Date.now(), title: formTitle.trim(), author: formAuthor.trim(), category: formCategory,
        content: formContent, status: 'draft', date: todayStr(), synced: false,
      }
      setArticles(prev => [...prev, newArticle])
      addToast('Article créé')
    }
    resetForm()
  }

  const changeStatus = (id, newStatus) => {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a))
    const labels = { review: 'en relecture', ready: 'prêt', draft: 'repassé en brouillon' }
    addToast(`Article ${labels[newStatus] || newStatus}`)
  }

  const publishArticle = (id) => {
    setSyncingId(id)
    setTimeout(() => {
      setArticles(prev => prev.map(a => a.id === id ? { ...a, status: 'published', synced: true } : a))
      setSyncingId(null)
      addToast('Article publié et synchronisé')
    }, 2000)
  }

  const unpublish = (id) => {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, status: 'draft', synced: false } : a))
    addToast('Article dépublié')
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <Input value={search} onChange={setSearch} placeholder="Rechercher par titre ou auteur..." style={{ maxWidth: 300, flex: 1 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'Tous' },
            { key: 'draft', label: 'Brouillons' },
            { key: 'review', label: 'Relecture' },
            { key: 'ready', label: 'Prêts' },
            { key: 'published', label: 'Publiés' },
          ].map(f => <Pill key={f.key} label={f.label} active={filter === f.key} onClick={() => setFilter(f.key)} />)}
        </div>
        <Btn onClick={openNew} variant="primary">Nouvel article</Btn>
      </div>

      {showForm && (
        <Card style={{ marginBottom: 16, animation: 'slideUp 0.3s ease-out' }}>
          <SectionTitle>{editingId ? 'Modifier l\'article' : 'Nouvel article'}</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.navy, display: 'block', marginBottom: 4 }}>Titre</label>
              <Input value={formTitle} onChange={setFormTitle} placeholder="Titre de l'article" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.navy, display: 'block', marginBottom: 4 }}>Auteur</label>
              <Input value={formAuthor} onChange={setFormAuthor} placeholder="Nom de l'auteur" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.navy, display: 'block', marginBottom: 4 }}>Catégorie</label>
              <Select value={formCategory} onChange={setFormCategory} options={categories} style={{ width: '100%' }} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.navy, display: 'block', marginBottom: 4 }}>Contenu</label>
            <Textarea value={formContent} onChange={setFormContent} placeholder="Contenu de l'article..." rows={4} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={resetForm}>Annuler</Btn>
            <Btn variant="primary" onClick={saveArticle}>{editingId ? 'Sauvegarder' : 'Créer'}</Btn>
          </div>
        </Card>
      )}

      <TableWrap>
        <thead>
          <tr>
            <Th>Titre</Th><Th>Auteur</Th><Th>Catégorie</Th><Th>Date</Th><Th>Statut</Th><Th>GitHub</Th><Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(a => (
            <Tr key={a.id}>
              <Td style={{ fontWeight: 600, color: C.navy, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</Td>
              <Td>{a.author}</Td>
              <Td><Badge label={a.category} bg={C.sky} color={C.white} /></Td>
              <Td style={{ whiteSpace: 'nowrap' }}>{formatDateFR(a.date)}</Td>
              <Td><StatusBadge status={a.status} /></Td>
              <Td>
                {syncingId === a.id ? (
                  <span style={{ color: C.ochre, fontSize: 13, fontWeight: 600 }}>Sync...</span>
                ) : a.synced ? (
                  <span style={{ color: C.green, fontSize: 13, fontWeight: 600 }}>Synchronisé</span>
                ) : (
                  <span style={{ color: C.muted, fontSize: 13 }}>Non sync.</span>
                )}
              </Td>
              <Td>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <Btn variant="ghost" onClick={() => openEdit(a)}>Éditer</Btn>
                  {a.status === 'draft' && <Btn variant="ghost" onClick={() => changeStatus(a.id, 'review')}>→ Relecture</Btn>}
                  {a.status === 'review' && <Btn variant="ghost" onClick={() => changeStatus(a.id, 'ready')}>→ Prêt</Btn>}
                  {a.status === 'ready' && <Btn variant="ghostSuccess" onClick={() => publishArticle(a.id)} disabled={syncingId === a.id}>Publier</Btn>}
                  {a.status === 'published' && <Btn variant="ghostDanger" onClick={() => unpublish(a.id)}>Dépublier</Btn>}
                </div>
              </Td>
            </Tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: C.muted, fontFamily: font.body }}>Aucun résultat</td></tr>
          )}
        </tbody>
      </TableWrap>
    </div>
  )
}

// ─── PAGES TAB ──────────────────────────────────────────────────────────────────
function PagesTab({ pages, addToast }) {
  const stats = useMemo(() => {
    const fresh = pages.filter(p => getPageStatus(p) === 'fresh').length
    const review = pages.filter(p => getPageStatus(p) === 'review').length
    const stale = pages.filter(p => getPageStatus(p) === 'stale').length
    return { fresh, review, stale }
  }, [pages])

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Card accent={C.green}>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Pages à jour</p>
          <p style={{ fontSize: 36, fontWeight: 700, color: C.green, margin: '4px 0', fontFamily: font.title }}>{stats.fresh}</p>
        </Card>
        <Card accent={C.ochre}>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Pages à revoir</p>
          <p style={{ fontSize: 36, fontWeight: 700, color: C.ochre, margin: '4px 0', fontFamily: font.title }}>{stats.review}</p>
        </Card>
        <Card accent={C.terra}>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Pages obsolètes</p>
          <p style={{ fontSize: 36, fontWeight: 700, color: C.terra, margin: '4px 0', fontFamily: font.title }}>{stats.stale}</p>
        </Card>
      </div>

      <TableWrap>
        <thead>
          <tr>
            <Th>Page</Th><Th>Chemin</Th><Th>Dernière modification</Th><Th>Ancienneté</Th><Th>Statut</Th><Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {pages.map(p => {
            const status = getPageStatus(p)
            return (
              <Tr key={p.id}>
                <Td style={{ fontWeight: 600, color: C.navy }}>{p.name}</Td>
                <Td>
                  <code style={{ fontFamily: 'monospace', fontSize: 13, color: C.sky, background: '#F0F4FA', padding: '2px 6px', borderRadius: 4 }}>
                    {p.path}
                  </code>
                </Td>
                <Td style={{ whiteSpace: 'nowrap' }}>{formatDateFR(p.lastModified)}</Td>
                <Td style={{ whiteSpace: 'nowrap' }}>{formatAge(p.lastModified)}</Td>
                <Td><PageStatusBadge status={status} /></Td>
                <Td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Btn variant="ghost" onClick={() => addToast(`Édition de "${p.name}" ouverte`)}>Éditer</Btn>
                    <Btn variant="ghost" onClick={() => addToast(`Aperçu de ${p.path}`)}>Voir</Btn>
                  </div>
                </Td>
              </Tr>
            )
          })}
        </tbody>
      </TableWrap>

      <div style={{
        marginTop: 20, padding: '14px 18px', background: '#F7F6F3', borderRadius: 10,
        fontSize: 13, color: C.muted, fontFamily: font.body, lineHeight: 1.6,
        border: `1px solid ${C.borderLight}`,
      }}>
        <strong style={{ color: C.navy }}>Seuils adaptatifs</strong> — Les seuils de fraîcheur sont adaptés à chaque page.
        Exemple : L'équipe est considérée à jour pendant 6 mois, les Événements pendant 30 jours.
        Une page est "à revoir" au-delà du seuil, et "obsolète" au-delà de 1,5 fois le seuil.
      </div>
    </div>
  )
}

// ─── MAIN APP ───────────────────────────────────────────────────────────────────
export default function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [tab, setTab] = useState('dashboard')
  const [subscribers, setSubscribers] = useState(INIT_SUBSCRIBERS)
  const [articles, setArticles] = useState(INIT_ARTICLES)
  const [pages] = useState(INIT_PAGES)
  const { toasts, addToast } = useToasts()

  const approveSubscriber = useCallback((id) => {
    setSubscribers(prev => prev.map(s => s.id === id ? { ...s, status: 'added' } : s))
    addToast('Abonné ajouté avec succès')
  }, [addToast])

  const rejectSubscriber = useCallback((id) => {
    setSubscribers(prev => prev.map(s => s.id === id ? { ...s, status: 'rejected' } : s))
    addToast('Inscription refusée')
  }, [addToast])

  const publishFromDashboard = useCallback((id) => {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, status: 'published', synced: true } : a))
    addToast('Article publié et synchronisé')
  }, [addToast])

  if (!loggedIn) {
    return (
      <>
        <LoginScreen onLogin={() => setLoggedIn(true)} />
        <Toast toasts={toasts} removeToast={() => {}} />
      </>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: font.body }}>
      <Header tab={tab} setTab={setTab} onLogout={() => { setLoggedIn(false); setTab('dashboard') }} />
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 48px' }}>
        {tab === 'dashboard' && (
          <DashboardTab
            subscribers={subscribers}
            articles={articles}
            pages={pages}
            onApprove={approveSubscriber}
            onReject={rejectSubscriber}
            onPublish={publishFromDashboard}
          />
        )}
        {tab === 'newsletter' && (
          <NewsletterTab subscribers={subscribers} setSubscribers={setSubscribers} addToast={addToast} />
        )}
        {tab === 'articles' && (
          <ArticlesTab articles={articles} setArticles={setArticles} addToast={addToast} />
        )}
        {tab === 'pages' && (
          <PagesTab pages={pages} addToast={addToast} />
        )}
      </main>
      <Toast toasts={toasts} removeToast={() => {}} />
    </div>
  )
}
