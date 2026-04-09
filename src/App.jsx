import { useState, useEffect, useCallback } from 'react'
import {
  fetchHelloAssoMembers, fetchHelloAssoDonations,
  sendBrevoCampaign, sendTelegramMessage,
  fetchGitHubCommits, fetchNotionDatabase, checkPageLink,
  saveLocal, loadLocal, parseCSV, exportCSV,
} from './api'

const C = {
  bg: '#f5f3ee', white: '#fff', navy: '#1a2744',
  sky: '#4a90d9', terra: '#c45a3c', ochre: '#d4a843', green: '#3a9d6a',
  red: '#d94452', muted: '#8494a7', border: '#e8e4db',
  greenBg: '#e8f5ee', ochreBg: '#fff4e6', redBg: '#fdeaec', skyBg: '#e8f0fb',
}
const SITE = 'https://institut-rousseau-kb9p.vercel.app'
const ALL_PAGES = [
  { path: '/', name: 'Accueil' }, { path: '/publications.html', name: 'Publications' },
  { path: '/auteurs.html', name: 'Auteurs' }, { path: '/evenements.html', name: 'Événements' },
  { path: '/presse.html', name: 'Presse' }, { path: '/road-to-net-zero.html', name: 'Road to Net Zero' },
  { path: '/le-projet.html', name: 'Le projet' }, { path: '/contact.html', name: 'Contact' },
  { path: '/don.html', name: 'Faire un don' }, { path: '/adhesion.html', name: 'Adhésion' },
  { path: '/thematique-ecologie.html', name: 'Pôle Écologie' }, { path: '/thematique-economie.html', name: 'Pôle Économie' },
  { path: '/thematique-institutions.html', name: 'Pôle Institutions' }, { path: '/thematique-social.html', name: 'Pôle Social' },
  { path: '/thematique-international.html', name: 'Pôle International' }, { path: '/thematique-culture.html', name: 'Pôle Culture' },
  { path: '/confidentialite.html', name: 'Confidentialité' },
]

const TAGS = [
  { id: 'membre', label: 'Membre', color: C.green, bg: C.greenBg, icon: '👤' },
  { id: 'donateur', label: 'Donateur', color: C.ochre, bg: C.ochreBg, icon: '💛' },
  { id: 'newsletter', label: 'Newsletter', color: C.sky, bg: C.skyBg, icon: '📬' },
  { id: 'presse', label: 'Presse', color: C.terra, bg: '#fce8e3', icon: '📰' },
  { id: 'auteur', label: 'Auteur', color: C.navy, bg: '#e3e8f0', icon: '✍️' },
  { id: 'evenement', label: 'Événement', color: '#8b5cf6', bg: '#ede9fe', icon: '🎤' },
]

const AUTOMATIONS_INIT = [
  { id: 'welcome_member', name: 'Bienvenue membre', trigger: "Nouveau tag 'membre'", channel: 'email', desc: 'Accueil + lien Telegram + invitation NL', active: true },
  { id: 'welcome_donor', name: 'Merci donateur', trigger: "Nouveau tag 'donateur'", channel: 'email', desc: "Reçu fiscal + incitation adhésion", active: true },
  { id: 'welcome_nl', name: 'Bienvenue newsletter', trigger: 'Inscription NL', channel: 'email', desc: 'Présentation + derniers articles + nudge adhésion', active: true },
  { id: 'nudge_adhesion', name: 'Relance adhésion', trigger: 'NL > 30j sans tag membre', channel: 'email', desc: 'Suggestion adhésion aux abonnés NL non-membres', active: false },
  { id: 'new_article_tg', name: 'Alerte article', trigger: 'Article publié', channel: 'telegram', desc: 'Broadcast Telegram automatique', active: true },
  { id: 'event_reminder', name: 'Rappel événement', trigger: 'J-3 événement', channel: 'email+telegram', desc: 'Rappel inscrits + Telegram', active: false },
]

// ─── Icons ───
const Ico = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
)
const P = {
  home: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 3a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  file: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8',
  link: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6z',
  check: 'M20 6L9 17l-5-5', x: 'M18 6L6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  ext: 'M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3',
  git: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22',
  trash: 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2',
  search: 'M11 3a8 8 0 100 16 8 8 0 000-16zM21 21l-4.35-4.35',
  alert: 'M12 2L2 22h20L12 2zM12 9v4M12 17h.01',
  save: 'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
  play: 'M5 3l14 9-14 9V3z',
  download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12',
  mail: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  zap: 'M13 2L3 14h9l-1 10 10-12h-9l1-10z',
  globe: 'M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20',
}

// ─── Micro components ───
const Tag = ({ s, label }) => {
  const m = { ok:{c:C.green,bg:C.greenBg}, error:{c:C.red,bg:C.redBg}, checking:{c:C.sky,bg:C.skyBg}, unchecked:{c:C.muted,bg:'#eef1f5'}, published:{c:C.green,bg:C.greenBg}, draft:{c:C.muted,bg:'#eef1f5'}, ready:{c:C.sky,bg:C.skyBg} }
  const st = m[s] || m.unchecked
  return <span style={{ padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:600,color:st.c,background:st.bg,whiteSpace:'nowrap' }}>{label||s}</span>
}

const CTag = ({ tagId }) => {
  const t = TAGS.find(x => x.id === tagId)
  if (!t) return null
  return <span style={{ padding:'1px 8px',borderRadius:12,fontSize:10,fontWeight:600,color:t.color,background:t.bg }}>{t.icon} {t.label}</span>
}

const Btn = ({ children, onClick, v='primary', sm, disabled, style:sx }) => {
  const s = { primary:{background:C.navy,color:C.white}, sky:{background:C.sky,color:C.white}, green:{background:C.green,color:C.white}, danger:{background:C.red,color:C.white}, ghost:{background:'transparent',color:C.navy,border:`1px solid ${C.border}`}, ochre:{background:C.ochre,color:C.white} }
  return <button onClick={onClick} disabled={disabled} style={{ border:'none',borderRadius:7,cursor:disabled?'not-allowed':'pointer',fontWeight:600,fontSize:sm?11:13,display:'inline-flex',alignItems:'center',gap:5,padding:sm?'5px 10px':'8px 16px',opacity:disabled?.5:1,transition:'filter .15s',...s[v],...sx }}>{children}</button>
}

const Metric = ({ icon, label, val, sub, color=C.sky }) => (
  <div style={{ background:C.white,borderRadius:12,padding:'14px 16px',border:`1px solid ${C.border}`,flex:'1 1 140px',minWidth:120 }}>
    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3 }}>
      <span style={{ color:C.muted,fontSize:11,fontWeight:500 }}>{label}</span>
      <span style={{ color,opacity:.5 }}><Ico d={icon}/></span>
    </div>
    <div style={{ fontSize:24,fontWeight:700,color:C.navy,fontFamily:"'Cormorant Garamond',Georgia,serif" }}>{val}</div>
    {sub && <div style={{ fontSize:10,color:C.muted,marginTop:1 }}>{sub}</div>}
  </div>
)

const Card = ({ children, style:sx }) => <div style={{ background:C.white,borderRadius:12,padding:18,border:`1px solid ${C.border}`,...sx }}>{children}</div>
const Field = ({ label, children, help }) => <div style={{ marginBottom:12 }}><label style={{ display:'block',fontSize:11,fontWeight:600,color:C.navy,marginBottom:3 }}>{label}</label>{children}{help&&<div style={{ fontSize:10,color:C.muted,marginTop:2 }}>{help}</div>}</div>
const iStyle = { width:'100%',padding:'7px 11px',borderRadius:7,border:`1px solid ${C.border}`,fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit' }

const Modal = ({ open, onClose, title, children, wide }) => {
  if (!open) return null
  return (
    <div onClick={onClose} style={{ position:'fixed',inset:0,background:'rgba(15,26,46,.4)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(3px)' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.white,borderRadius:14,padding:'22px 26px',maxWidth:wide?640:480,width:'92%',boxShadow:'0 16px 48px rgba(0,0,0,.15)',maxHeight:'85vh',overflowY:'auto' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
          <h3 style={{ margin:0,fontSize:16,color:C.navy,fontFamily:"'Cormorant Garamond',Georgia,serif" }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:C.muted }}><Ico d={P.x}/></button>
        </div>
        {children}
      </div>
    </div>
  )
}

const SectionTitle = ({ children, right }) => (
  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
    <h2 style={{ fontSize:18,fontWeight:700,margin:0,fontFamily:"'Cormorant Garamond',Georgia,serif",color:C.navy }}>{children}</h2>
    {right}
  </div>
)

// ═══════════════════
// MAIN
// ═══════════════════
export default function App() {
  const [tab, setTab] = useState('overview')
  const [toast, setToast] = useState(null)
  const [config, setConfig] = useState(() => loadLocal('config', {
    notionKey:'',notionDbId:'',ghOwner:'',ghRepo:'',ghToken:'',brevoKey:'',
    helloassoClientId:'',helloassoClientSecret:'',helloassoOrg:'',
    telegramBotToken:'',telegramChatId:'',
  }))
  const [contacts, setContacts] = useState(() => loadLocal('contacts', []))
  const [contactSearch, setContactSearch] = useState('')
  const [contactFilter, setContactFilter] = useState('all')
  const [contactTab, setContactTab] = useState('list')
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [newC, setNewC] = useState({ name:'',email:'',tags:['newsletter'],source:'manual' })
  const [importText, setImportText] = useState('')
  const [automations, setAutomations] = useState(AUTOMATIONS_INIT)
  const [campaign, setCampaign] = useState({ subject:'',body:'',targetTag:'newsletter',channel:'email' })
  const [notionArticles, setNotionArticles] = useState([])
  const [notionLoading, setNotionLoading] = useState(false)
  const [notionError, setNotionError] = useState(null)
  const [ghCommits, setGhCommits] = useState([])
  const [ghLoading, setGhLoading] = useState(false)
  const [linkResults, setLinkResults] = useState(ALL_PAGES.map(p => ({ ...p, status:'unchecked', time:null })))
  const [linkChecking, setLinkChecking] = useState(false)
  const [haLoading, setHaLoading] = useState(false)

  const notify = useCallback((msg, bad) => { setToast({ msg, bad }); setTimeout(() => setToast(null), 2800) }, [])

  const saveC = (list) => { setContacts(list); saveLocal('contacts', list) }
  const saveCfg = (c) => { setConfig(c); saveLocal('config', c); notify('Sauvegardé') }

  // ─── Real API calls ───
  const syncHA = async () => {
    if (!config.helloassoClientId || !config.helloassoClientSecret || !config.helloassoOrg) { notify('Config HelloAsso incomplète', true); return }
    setHaLoading(true)
    try {
      const [members, donors] = await Promise.all([
        fetchHelloAssoMembers(config.helloassoClientId, config.helloassoClientSecret, config.helloassoOrg),
        fetchHelloAssoDonations(config.helloassoClientId, config.helloassoClientSecret, config.helloassoOrg),
      ])
      let added = 0
      const updated = [...contacts]
      const allHA = [...members, ...donors]
      allHA.forEach(ha => {
        if (!ha.email) return
        const existing = updated.find(c => c.email.toLowerCase() === ha.email.toLowerCase())
        if (existing) {
          if (ha.type === 'membre' && !existing.tags.includes('membre')) { existing.tags.push('membre'); added++ }
          if (ha.type === 'donateur' && !existing.tags.includes('donateur')) { existing.tags.push('donateur'); added++ }
          if (ha.amount) existing.amount = (existing.amount || 0) + ha.amount
          existing.helloassoId = ha.helloassoId
        } else {
          updated.push({ id: Date.now() + added, name: ha.name, email: ha.email, tags: [ha.type, 'newsletter'], source: 'helloasso', date: ha.date, helloassoId: ha.helloassoId, amount: ha.amount })
          added++
        }
      })
      saveC(updated)
      notify(`HelloAsso: ${added} ajouts/mises à jour`)
    } catch (e) { notify('HelloAsso: ' + e.message, true) }
    setHaLoading(false)
  }

  const doSendCampaign = async () => {
    const targets = contacts.filter(c => c.tags.includes(campaign.targetTag) && c.email)
    if (targets.length === 0) { notify('Aucun destinataire', true); return }
    if (campaign.channel === 'telegram') {
      if (!config.telegramBotToken || !config.telegramChatId) { notify('Config Telegram manquante', true); return }
      try { await sendTelegramMessage(config.telegramBotToken, config.telegramChatId, campaign.body); notify('Telegram envoyé ✓') }
      catch (e) { notify('Telegram: ' + e.message, true) }
    } else {
      if (!config.brevoKey) { notify('Clé Brevo manquante', true); return }
      try {
        const r = await sendBrevoCampaign(config.brevoKey, { emails: targets.map(c => c.email), subject: campaign.subject, htmlContent: `<p>${campaign.body.replace(/\n/g, '<br>')}</p>` })
        notify(`Brevo: ${r.sent} emails envoyés ✓`)
      } catch (e) { notify('Brevo: ' + e.message, true) }
    }
  }

  const doFetchGH = async () => {
    if (!config.ghOwner || !config.ghRepo) return
    setGhLoading(true)
    try { setGhCommits(await fetchGitHubCommits(config.ghOwner, config.ghRepo, config.ghToken)) }
    catch (e) { notify('GitHub: ' + e.message, true) }
    setGhLoading(false)
  }

  const doFetchNotion = async () => {
    if (!config.notionKey || !config.notionDbId) return
    setNotionLoading(true); setNotionError(null)
    try { const a = await fetchNotionDatabase(config.notionKey, config.notionDbId); setNotionArticles(a); notify(`${a.length} articles`) }
    catch (e) { setNotionError(e.message) }
    setNotionLoading(false)
  }

  const doCheckLinks = async () => {
    setLinkChecking(true)
    const res = ALL_PAGES.map(p => ({ ...p, status:'unchecked', time:null }))
    for (let i = 0; i < ALL_PAGES.length; i++) {
      res[i] = { ...res[i], status:'checking' }; setLinkResults([...res])
      const r = await checkPageLink(`${SITE}${ALL_PAGES[i].path}`)
      res[i] = { ...res[i], ...r }; setLinkResults([...res])
    }
    setLinkChecking(false)
    const errs = res.filter(r => r.status === 'error').length
    notify(errs ? `${errs} erreur(s)` : 'Tout OK ✓', errs > 0)
  }

  useEffect(() => { if (config.ghOwner && config.ghRepo) doFetchGH() }, [])

  // ─── Contact actions ───
  const addContact = () => {
    if (!newC.email) return
    if (contacts.find(c => c.email.toLowerCase() === newC.email.toLowerCase())) { notify('Email existant', true); return }
    saveC([{ id: Date.now(), ...newC, date: new Date().toISOString().slice(0,10) }, ...contacts])
    setNewC({ name:'',email:'',tags:['newsletter'],source:'manual' }); setShowAdd(false); notify('Ajouté')
  }

  const toggleTag = (id, tagId) => {
    saveC(contacts.map(c => c.id !== id ? c : { ...c, tags: c.tags.includes(tagId) ? c.tags.filter(t => t !== tagId) : [...c.tags, tagId] }))
  }
  const deleteContact = (id) => { saveC(contacts.filter(c => c.id !== id)); notify('Supprimé') }

  const doImport = () => {
    const rows = parseCSV(importText); if (!rows.length) { notify('Aucune donnée', true); return }
    let added = 0; const u = [...contacts]
    rows.forEach(r => {
      const email = (r.email || r.mail || r['e-mail'] || r.courriel || '').toLowerCase()
      if (!email || u.find(c => c.email === email)) return
      const name = r.nom || r.name || r['nom complet'] || `${r.prenom||''} ${r.nom||''}`.trim() || email.split('@')[0]
      const tags = (r.tags || r.tag || r.type || 'newsletter').toLowerCase().split(/[;,]/).map(t=>t.trim()).filter(Boolean)
      u.push({ id: Date.now()+added, name, email, tags, source:'import', date: new Date().toISOString().slice(0,10) }); added++
    })
    saveC(u); setShowImport(false); setImportText(''); notify(`${added} importé(s)`)
  }

  // Computed
  const ghOk = !!(config.ghOwner && config.ghRepo), notionOk = !!(config.notionKey && config.notionDbId)
  const brevoOk = !!config.brevoKey, haOk = !!(config.helloassoClientId && config.helloassoClientSecret && config.helloassoOrg)
  const tgOk = !!(config.telegramBotToken && config.telegramChatId)
  const countTag = id => contacts.filter(c => c.tags.includes(id)).length
  const okPages = linkResults.filter(r => r.status === 'ok').length
  const errPages = linkResults.filter(r => r.status === 'error').length
  const filtered = contacts.filter(c => (contactFilter === 'all' || c.tags.includes(contactFilter)) && (!contactSearch || c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.email.toLowerCase().includes(contactSearch.toLowerCase())))

  const tabs2 = [
    { id:'overview',label:'Vue d\'ensemble',icon:P.home },
    { id:'contacts',label:'Contacts',icon:P.users },
    { id:'articles',label:'Articles',icon:P.file },
    { id:'site',label:'Site',icon:P.link },
    { id:'config',label:'Config',icon:P.settings },
  ]

  return (
    <div style={{ minHeight:'100vh',background:C.bg,fontFamily:"'Source Sans 3','Segoe UI',sans-serif",color:C.navy }}>
      {toast && <div style={{ position:'fixed',top:14,right:14,zIndex:2000,padding:'10px 20px',borderRadius:8,fontSize:13,fontWeight:600,color:C.white,background:toast.bad?C.red:C.green,boxShadow:'0 6px 24px rgba(0,0,0,.15)' }}>{toast.msg}</div>}

      <header style={{ background:C.navy,height:50,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 18px',borderBottom:`2px solid ${C.sky}` }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ width:28,height:28,borderRadius:7,background:`linear-gradient(135deg,${C.sky},${C.terra})`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:12,color:C.white,fontFamily:"'Cormorant Garamond',Georgia,serif" }}>IR</div>
          <span style={{ color:C.white,fontSize:14,fontWeight:700,fontFamily:"'Cormorant Garamond',Georgia,serif" }}>Institut Rousseau</span>
        </div>
        <div style={{ display:'flex',gap:8,alignItems:'center' }}>
          <a href={SITE} target="_blank" rel="noopener" style={{ color:C.white,opacity:.5,display:'flex',alignItems:'center',gap:3,fontSize:11,textDecoration:'none' }}><Ico d={P.ext} size={12}/> Site</a>
          {ghOk && <a href={`https://github.com/${config.ghOwner}/${config.ghRepo}`} target="_blank" rel="noopener" style={{ color:C.white,opacity:.5,display:'flex',alignItems:'center',gap:3,fontSize:11,textDecoration:'none' }}><Ico d={P.git} size={12}/> Repo</a>}
        </div>
      </header>

      <nav style={{ background:C.white,borderBottom:`1px solid ${C.border}`,display:'flex',padding:'0 18px',overflowX:'auto' }}>
        {tabs2.map(t => <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:'10px 14px',border:'none',background:'none',cursor:'pointer',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',gap:5,color:tab===t.id?C.navy:C.muted,borderBottom:tab===t.id?`2px solid ${C.sky}`:'2px solid transparent' }}><Ico d={t.icon}/>{t.label}</button>)}
      </nav>

      <main style={{ maxWidth:1080,margin:'0 auto',padding:'18px 16px' }}>

        {/* ═══ OVERVIEW ═══ */}
        {tab === 'overview' && <>
          <div style={{ display:'flex',flexWrap:'wrap',gap:10,marginBottom:18 }}>
            <Metric icon={P.users} label="Contacts" val={contacts.length} sub={`${countTag('membre')} membres · ${countTag('donateur')} donateurs`} color={C.navy}/>
            <Metric icon={P.mail} label="Newsletter" val={countTag('newsletter')} sub={brevoOk?'Brevo connecté':'Non configuré'} color={C.sky}/>
            <Metric icon={P.file} label="Articles" val={notionArticles.length||'—'} sub={notionOk?'Notion connecté':'Non configuré'} color={notionOk?C.green:C.muted}/>
            <Metric icon={P.link} label="Pages" val={`${okPages}/${ALL_PAGES.length}`} sub={errPages?`${errPages} err`:okPages?'OK':'—'} color={errPages?C.red:okPages?C.green:C.muted}/>
          </div>

          <Card style={{ marginBottom:12,padding:'14px 16px' }}>
            <h3 style={{ fontSize:13,fontWeight:700,margin:'0 0 8px' }}>Segments</h3>
            <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
              {TAGS.map(t => (
                <div key={t.id} onClick={()=>{setTab('contacts');setContactFilter(t.id)}} style={{ cursor:'pointer',display:'flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:8,background:t.bg,border:`1px solid ${t.color}25` }}>
                  <span>{t.icon}</span><span style={{ fontSize:12,fontWeight:600,color:t.color }}>{t.label}</span>
                  <span style={{ fontSize:15,fontWeight:700,color:t.color }}>{countTag(t.id)}</span>
                </div>
              ))}
            </div>
          </Card>

          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <Card>
              <h3 style={{ fontSize:13,fontWeight:700,margin:'0 0 8px' }}>Derniers contacts</h3>
              {contacts.slice(0,5).map(c => (
                <div key={c.id} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:`1px solid ${C.border}15` }}>
                  <div><div style={{ fontWeight:600,fontSize:12 }}>{c.name}</div><div style={{ fontSize:10,color:C.muted }}>{c.email}</div></div>
                  <div style={{ display:'flex',gap:3 }}>{c.tags.slice(0,2).map(t=><CTag key={t} tagId={t}/>)}</div>
                </div>
              ))}
            </Card>
            <Card>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
                <h3 style={{ fontSize:13,fontWeight:700,margin:0 }}>Commits</h3>
                {ghOk && <Btn sm v="ghost" onClick={doFetchGH} disabled={ghLoading}><Ico d={P.refresh}/></Btn>}
              </div>
              {ghCommits.slice(0,4).map((c,i)=>(
                <a key={i} href={c.url} target="_blank" rel="noopener" style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0',borderBottom:`1px solid ${C.border}15`,textDecoration:'none',color:C.navy }}>
                  <div style={{ flex:1,minWidth:0 }}><div style={{ fontWeight:600,fontSize:11,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{c.message}</div><div style={{ fontSize:10,color:C.muted }}>{c.author} · {c.date}</div></div>
                  <code style={{ fontSize:10,color:C.sky,marginLeft:6 }}>{c.sha}</code>
                </a>
              ))}
              {!ghOk && <p style={{ color:C.muted,fontSize:12,margin:0 }}>GitHub non configuré</p>}
            </Card>
          </div>
        </>}

        {/* ═══ CONTACTS ═══ */}
        {tab === 'contacts' && <>
          <SectionTitle right={
            <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
              <Btn sm v="ghost" onClick={()=>setShowImport(true)}><Ico d={P.upload}/> CSV</Btn>
              <Btn sm v="ghost" onClick={()=>exportCSV(filtered)}><Ico d={P.download}/> Export</Btn>
              {haOk && <Btn sm v="ochre" onClick={syncHA} disabled={haLoading}>{haLoading?'…':'🫶 HelloAsso'}</Btn>}
              <Btn sm onClick={()=>setShowAdd(true)}><Ico d={P.plus}/> Contact</Btn>
            </div>
          }>Contacts ({contacts.length})</SectionTitle>

          <div style={{ display:'flex',gap:0,marginBottom:12,borderBottom:`1px solid ${C.border}` }}>
            {[{id:'list',l:'Liste'},{id:'automations',l:'Automations'},{id:'campaigns',l:'Campagnes'}].map(t=>
              <button key={t.id} onClick={()=>setContactTab(t.id)} style={{ padding:'7px 12px',border:'none',background:'none',cursor:'pointer',fontSize:12,fontWeight:600,color:contactTab===t.id?C.navy:C.muted,borderBottom:contactTab===t.id?`2px solid ${C.sky}`:'2px solid transparent' }}>{t.l}</button>
            )}
          </div>

          {contactTab === 'list' && <>
            <div style={{ display:'flex',gap:6,marginBottom:12,flexWrap:'wrap',alignItems:'center' }}>
              <div style={{ position:'relative',flex:'1 1 200px',maxWidth:260 }}>
                <span style={{ position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:C.muted }}><Ico d={P.search}/></span>
                <input value={contactSearch} onChange={e=>setContactSearch(e.target.value)} placeholder="Rechercher…" style={{ ...iStyle,paddingLeft:30 }}/>
              </div>
              <div style={{ display:'flex',gap:3,flexWrap:'wrap' }}>
                <button onClick={()=>setContactFilter('all')} style={{ padding:'3px 8px',borderRadius:6,border:`1px solid ${contactFilter==='all'?C.sky:C.border}`,background:contactFilter==='all'?C.skyBg:'transparent',color:contactFilter==='all'?C.sky:C.muted,fontSize:11,fontWeight:600,cursor:'pointer' }}>Tous</button>
                {TAGS.map(t=><button key={t.id} onClick={()=>setContactFilter(t.id)} style={{ padding:'3px 8px',borderRadius:6,border:`1px solid ${contactFilter===t.id?t.color:C.border}`,background:contactFilter===t.id?t.bg:'transparent',color:contactFilter===t.id?t.color:C.muted,fontSize:11,fontWeight:600,cursor:'pointer' }}>{t.icon} {countTag(t.id)}</button>)}
              </div>
            </div>
            <div style={{ overflowX:'auto',borderRadius:10,border:`1px solid ${C.border}`,background:C.white }}>
              <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12 }}>
                <thead><tr style={{ background:C.bg }}>
                  {['Nom','Email','Tags','Source','Date',''].map((h,i)=><th key={i} style={{ padding:'8px 12px',textAlign:'left',fontWeight:600,color:C.navy,fontSize:10,textTransform:'uppercase',letterSpacing:'.05em',borderBottom:`1px solid ${C.border}` }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {filtered.map(c=>(
                    <tr key={c.id} style={{ borderBottom:`1px solid ${C.border}18` }}>
                      <td style={{ padding:'8px 12px',fontWeight:600 }}>{c.name}</td>
                      <td style={{ padding:'8px 12px',color:C.muted }}>{c.email}</td>
                      <td style={{ padding:'8px 12px' }}><div style={{ display:'flex',gap:3,flexWrap:'wrap' }}>{c.tags.map(t=><CTag key={t} tagId={t}/>)}</div></td>
                      <td style={{ padding:'8px 12px',fontSize:11,color:C.muted }}>{c.source}</td>
                      <td style={{ padding:'8px 12px',fontSize:11,color:C.muted }}>{c.date}</td>
                      <td style={{ padding:'8px 12px' }}>
                        <div style={{ display:'flex',gap:3 }}>
                          {!c.tags.includes('newsletter')&&<Btn sm v="sky" onClick={()=>toggleTag(c.id,'newsletter')} style={{ fontSize:10,padding:'2px 5px' }}>+NL</Btn>}
                          {!c.tags.includes('membre')&&<Btn sm v="green" onClick={()=>toggleTag(c.id,'membre')} style={{ fontSize:10,padding:'2px 5px' }}>+Mb</Btn>}
                          <Btn sm v="ghost" onClick={()=>deleteContact(c.id)} style={{ padding:'2px 5px' }}><Ico d={P.trash} size={12}/></Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filtered.length && <tr><td colSpan={6} style={{ padding:20,textAlign:'center',color:C.muted }}>Aucun résultat</td></tr>}
                </tbody>
              </table>
            </div>
          </>}

          {contactTab === 'automations' && <div style={{ display:'grid',gap:8 }}>
            {automations.map(a=>(
              <Card key={a.id} style={{ padding:'12px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',opacity:a.active?1:.6 }}>
                <div>
                  <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:3 }}>
                    <Ico d={P.zap} size={13}/><span style={{ fontWeight:700,fontSize:13 }}>{a.name}</span>
                    <span style={{ padding:'1px 6px',borderRadius:8,fontSize:10,fontWeight:600,background:a.channel.includes('email')?C.skyBg:'#e0f2fe',color:a.channel.includes('email')?C.sky:'#0284c7' }}>{a.channel}</span>
                  </div>
                  <div style={{ fontSize:11,color:C.muted }}>{a.trigger} — {a.desc}</div>
                </div>
                <div onClick={()=>setAutomations(p=>p.map(x=>x.id===a.id?{...x,active:!x.active}:x))} style={{ width:38,height:20,borderRadius:10,background:a.active?C.green:C.border,cursor:'pointer',position:'relative' }}>
                  <div style={{ width:16,height:16,borderRadius:8,background:C.white,position:'absolute',top:2,left:a.active?20:2,transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,.15)' }}/>
                </div>
              </Card>
            ))}
          </div>}

          {contactTab === 'campaigns' && <Card>
            <h3 style={{ fontSize:14,fontWeight:700,margin:'0 0 12px' }}>Envoyer une campagne</h3>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8 }}>
              <Field label="Canal"><select value={campaign.channel} onChange={e=>setCampaign({...campaign,channel:e.target.value})} style={iStyle}><option value="email">Email (Brevo)</option><option value="telegram">Telegram</option></select></Field>
              <Field label="Segment"><select value={campaign.targetTag} onChange={e=>setCampaign({...campaign,targetTag:e.target.value})} style={iStyle}>{TAGS.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label} ({countTag(t.id)})</option>)}</select></Field>
            </div>
            {campaign.channel==='email'&&<Field label="Objet"><input value={campaign.subject} onChange={e=>setCampaign({...campaign,subject:e.target.value})} placeholder="Objet" style={iStyle}/></Field>}
            <Field label="Message"><textarea value={campaign.body} onChange={e=>setCampaign({...campaign,body:e.target.value})} rows={4} placeholder="Message…" style={{ ...iStyle,resize:'vertical' }}/></Field>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <span style={{ fontSize:11,color:C.muted }}>{contacts.filter(c=>c.tags.includes(campaign.targetTag)).length} destinataire(s)</span>
              <Btn sm onClick={doSendCampaign}><Ico d={P.send}/> Envoyer</Btn>
            </div>
            <div style={{ display:'flex',flexWrap:'wrap',gap:4,marginTop:12 }}>
              {[
                { l:'📬 Nouvel article', b:`📝 Nouveau :\n\n[TITRE]\nPar [AUTEUR]\n\n🔗 ${SITE}/publications.html` },
                { l:'🎤 Événement', b:`🗓️ [NOM]\n📍 [LIEU] — [DATE]\n\n${SITE}/evenements.html` },
                { l:'💛 Appel dons', b:`Soutenez un labo d'idées 100% indépendant.\n66% déductible.\n👉 ${SITE}/don.html` },
                { l:'🫶 Adhésion', b:`Rejoignez l'Institut Rousseau !\nÀ partir de 10€/an.\n👉 ${SITE}/adhesion.html` },
              ].map((t,i)=><button key={i} onClick={()=>setCampaign({...campaign,body:t.b})} style={{ padding:'5px 8px',borderRadius:6,border:`1px solid ${C.border}`,background:'transparent',cursor:'pointer',fontSize:11,color:C.navy }}>{t.l}</button>)}
            </div>
          </Card>}

          {/* Modals */}
          <Modal open={showAdd} onClose={()=>setShowAdd(false)} title="Nouveau contact">
            <Field label="Nom"><input value={newC.name} onChange={e=>setNewC({...newC,name:e.target.value})} placeholder="Nom" style={iStyle}/></Field>
            <Field label="Email"><input type="email" value={newC.email} onChange={e=>setNewC({...newC,email:e.target.value})} placeholder="email@…" style={iStyle}/></Field>
            <Field label="Tags"><div style={{ display:'flex',flexWrap:'wrap',gap:4 }}>
              {TAGS.map(t=><button key={t.id} onClick={()=>setNewC({...newC,tags:newC.tags.includes(t.id)?newC.tags.filter(x=>x!==t.id):[...newC.tags,t.id]})} style={{ padding:'3px 8px',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',border:`1px solid ${newC.tags.includes(t.id)?t.color:C.border}`,background:newC.tags.includes(t.id)?t.bg:'transparent',color:newC.tags.includes(t.id)?t.color:C.muted }}>{t.icon} {t.label}</button>)}
            </div></Field>
            <div style={{ display:'flex',gap:6,justifyContent:'flex-end',marginTop:14 }}>
              <Btn v="ghost" onClick={()=>setShowAdd(false)}>Annuler</Btn>
              <Btn onClick={addContact}>Ajouter</Btn>
            </div>
          </Modal>
          <Modal open={showImport} onClose={()=>setShowImport(false)} title="Importer CSV" wide>
            <p style={{ fontSize:12,color:C.muted,margin:'0 0 8px' }}>Colonnes : <code style={{ background:C.bg,padding:'1px 4px',borderRadius:3,fontSize:11 }}>nom, email, tags</code></p>
            <textarea value={importText} onChange={e=>setImportText(e.target.value)} rows={6} placeholder="nom;email;tags" style={{ ...iStyle,fontFamily:'monospace',fontSize:11 }}/>
            <div style={{ display:'flex',gap:6,justifyContent:'flex-end',marginTop:10 }}>
              <Btn v="ghost" onClick={()=>setShowImport(false)}>Annuler</Btn>
              <Btn onClick={doImport}><Ico d={P.upload}/> Importer</Btn>
            </div>
          </Modal>
        </>}

        {/* ═══ ARTICLES ═══ */}
        {tab === 'articles' && <>
          <SectionTitle right={notionOk && <div style={{ display:'flex',gap:6 }}>
            <Btn sm v="sky" onClick={doFetchNotion} disabled={notionLoading}><Ico d={P.refresh}/> {notionLoading?'…':'Sync'}</Btn>
            <Btn sm v="ghost" onClick={()=>window.open(`https://notion.so/${config.notionDbId.replace(/-/g,'')}`, '_blank')}><Ico d={P.ext}/> Notion</Btn>
          </div>}>Articles</SectionTitle>
          {!notionOk && <Card style={{ textAlign:'center',padding:'32px 16px' }}><p style={{ color:C.muted,fontSize:13 }}>Notion non configuré.</p><Btn sm onClick={()=>setTab('config')}>Configurer</Btn></Card>}
          {notionError && <div style={{ background:C.redBg,borderRadius:8,padding:'8px 12px',marginBottom:10,fontSize:12,color:C.red }}>{notionError}</div>}
          {notionArticles.length > 0 && <div style={{ overflowX:'auto',borderRadius:10,border:`1px solid ${C.border}`,background:C.white }}>
            <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12 }}>
              <thead><tr style={{ background:C.bg }}>{['Titre','Auteur','Pôle','Statut'].map((h,i)=><th key={i} style={{ padding:'8px 12px',textAlign:'left',fontWeight:600,fontSize:10,textTransform:'uppercase',borderBottom:`1px solid ${C.border}` }}>{h}</th>)}</tr></thead>
              <tbody>{notionArticles.map((a,i)=><tr key={i} style={{ borderBottom:`1px solid ${C.border}18` }}>
                <td style={{ padding:'8px 12px',fontWeight:600 }}>{a.title}</td><td style={{ padding:'8px 12px' }}>{a.author||'—'}</td>
                <td style={{ padding:'8px 12px' }}>{a.pole||'—'}</td><td style={{ padding:'8px 12px' }}><Tag s={a.status||'draft'} label={a.status}/></td>
              </tr>)}</tbody>
            </table>
          </div>}
        </>}

        {/* ═══ SITE ═══ */}
        {tab === 'site' && <>
          <SectionTitle right={<Btn sm v={linkChecking?'ghost':'primary'} onClick={doCheckLinks} disabled={linkChecking}><Ico d={linkChecking?P.refresh:P.play}/> {linkChecking?'…':'Vérifier'}</Btn>}>Site</SectionTitle>
          <div style={{ display:'flex',gap:10,marginBottom:12 }}>
            <Metric icon={P.globe} label="Pages" val={ALL_PAGES.length} color={C.navy}/><Metric icon={P.check} label="OK" val={okPages} color={C.green}/><Metric icon={P.alert} label="Err" val={errPages} color={errPages?C.red:C.muted}/>
          </div>
          <div style={{ overflowX:'auto',borderRadius:10,border:`1px solid ${C.border}`,background:C.white }}>
            <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12 }}>
              <thead><tr style={{ background:C.bg }}>{['Page','URL','Statut','ms',''].map((h,i)=><th key={i} style={{ padding:'8px 12px',textAlign:'left',fontWeight:600,fontSize:10,textTransform:'uppercase',borderBottom:`1px solid ${C.border}` }}>{h}</th>)}</tr></thead>
              <tbody>{linkResults.map((r,i)=><tr key={i} style={{ borderBottom:`1px solid ${C.border}18`,background:r.status==='error'?C.redBg+'40':'transparent' }}>
                <td style={{ padding:'8px 12px',fontWeight:600 }}>{r.name}</td>
                <td style={{ padding:'8px 12px',fontFamily:'monospace',fontSize:11 }}><a href={`${SITE}${r.path}`} target="_blank" rel="noopener" style={{ color:C.sky,textDecoration:'none' }}>{r.path}</a></td>
                <td style={{ padding:'8px 12px' }}><Tag s={r.status} label={r.status==='ok'?'OK':r.status==='error'?'Err':r.status==='checking'?'…':'—'}/></td>
                <td style={{ padding:'8px 12px',fontSize:11,color:C.muted }}>{r.time||'—'}</td>
                <td style={{ padding:'8px 12px' }}><a href={`${SITE}${r.path}`} target="_blank" rel="noopener" style={{ color:C.muted }}><Ico d={P.ext} size={13}/></a></td>
              </tr>)}</tbody>
            </table>
          </div>
        </>}

        {/* ═══ CONFIG ═══ */}
        {tab === 'config' && <>
          <SectionTitle>Configuration</SectionTitle>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <Card>
              <h3 style={{ fontSize:14,fontWeight:700,margin:'0 0 10px' }}>🫶 HelloAsso {haOk&&<Tag s="ok" label="OK"/>}</h3>
              <Field label="Client ID" help="HelloAsso → Mon compte → API"><input value={config.helloassoClientId} onChange={e=>setConfig({...config,helloassoClientId:e.target.value})} style={iStyle}/></Field>
              <Field label="Client Secret"><input type="password" value={config.helloassoClientSecret} onChange={e=>setConfig({...config,helloassoClientSecret:e.target.value})} style={iStyle}/></Field>
              <Field label="Slug organisation" help="helloasso.com/associations/[slug]"><input value={config.helloassoOrg} onChange={e=>setConfig({...config,helloassoOrg:e.target.value})} placeholder="institut-rousseau" style={iStyle}/></Field>
            </Card>
            <Card>
              <h3 style={{ fontSize:14,fontWeight:700,margin:'0 0 10px' }}>📬 Brevo {brevoOk&&<Tag s="ok" label="OK"/>}</h3>
              <Field label="Clé API" help="Brevo → Paramètres → Clés API"><input type="password" value={config.brevoKey} onChange={e=>setConfig({...config,brevoKey:e.target.value})} placeholder="xkeysib-…" style={iStyle}/></Field>
            </Card>
            <Card>
              <h3 style={{ fontSize:14,fontWeight:700,margin:'0 0 10px' }}>✈️ Telegram {tgOk&&<Tag s="ok" label="OK"/>}</h3>
              <Field label="Bot Token" help="@BotFather"><input type="password" value={config.telegramBotToken} onChange={e=>setConfig({...config,telegramBotToken:e.target.value})} style={iStyle}/></Field>
              <Field label="Chat ID"><input value={config.telegramChatId} onChange={e=>setConfig({...config,telegramChatId:e.target.value})} placeholder="-100…" style={iStyle}/></Field>
              {tgOk && <Btn sm v="sky" onClick={()=>sendTelegramMessage(config.telegramBotToken,config.telegramChatId,'🔔 Test dashboard IR').then(()=>notify('Test OK')).catch(e=>notify(e.message,true))}>Test</Btn>}
            </Card>
            <Card>
              <h3 style={{ fontSize:14,fontWeight:700,margin:'0 0 10px' }}>📝 Notion {notionOk&&<Tag s="ok" label="OK"/>}</h3>
              <Field label="Clé API"><input type="password" value={config.notionKey} onChange={e=>setConfig({...config,notionKey:e.target.value})} placeholder="ntn_…" style={iStyle}/></Field>
              <Field label="Database ID"><input value={config.notionDbId} onChange={e=>setConfig({...config,notionDbId:e.target.value})} style={iStyle}/></Field>
            </Card>
            <Card>
              <h3 style={{ fontSize:14,fontWeight:700,margin:'0 0 10px' }}><Ico d={P.git}/> GitHub {ghOk&&<Tag s="ok" label="OK"/>}</h3>
              <Field label="Owner"><input value={config.ghOwner} onChange={e=>setConfig({...config,ghOwner:e.target.value})} style={iStyle}/></Field>
              <Field label="Repo"><input value={config.ghRepo} onChange={e=>setConfig({...config,ghRepo:e.target.value})} style={iStyle}/></Field>
              <Field label="Token (optionnel)"><input type="password" value={config.ghToken} onChange={e=>setConfig({...config,ghToken:e.target.value})} style={iStyle}/></Field>
            </Card>
            <Card>
              <h3 style={{ fontSize:14,fontWeight:700,margin:'0 0 10px' }}>🌐 Site</h3>
              <div style={{ ...iStyle,background:C.bg,color:C.muted }}>{SITE}</div>
              <div style={{ fontSize:11,color:C.muted,marginTop:6 }}>Modifier dans le code quand migration GitHub Pages.</div>
            </Card>
          </div>
          <div style={{ marginTop:14,display:'flex',justifyContent:'flex-end' }}>
            <Btn onClick={()=>saveCfg(config)}><Ico d={P.save}/> Sauvegarder</Btn>
          </div>
        </>}
      </main>

      <style>{`
        button:hover:not(:disabled) { filter: brightness(1.08); }
        tr:hover { background: ${C.bg}55; }
        input:focus, select:focus, textarea:focus { border-color: ${C.sky}; box-shadow: 0 0 0 3px ${C.sky}18; }
        @media (max-width: 700px) {
          main { padding: 12px 10px !important; }
          div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
