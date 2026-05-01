import { useState, useRef, useMemo, useEffect } from 'react';
import ServiceBadge from '../components/shared/ServiceBadge';
import { loadLocal, saveLocal } from '../utils/localStorage';
import { LS_KEYS, DEFAULT_WORKER_URL } from '../utils/constants';
import { parseFile, isValidEmail, findDuplicates } from '../services/export';
import { exportMultiSheet } from '../services/export';
import { checkHealth } from '../services/api';
import { testConnection as testTelegram } from '../services/telegram';
import { addContact as addBrevoContact } from '../services/brevo';
import {
  listUsers, createUser as apiCreateUser, updateUser as apiUpdateUser,
  deleteUser as apiDeleteUser, changeMyPassword,
} from '../services/auth';

export default function Settings({ subscribers, services, onImportSubscribers, onRefresh, toast, currentUser }) {
  // ─── Config API ───────────────────────────────
  const [workerUrl, setWorkerUrl] = useState(() => loadLocal(LS_KEYS.workerUrl, DEFAULT_WORKER_URL));
  const [testing, setTesting] = useState({});

  // ─── GitHub : tout est secret côté Worker ─────
  // Le PAT, owner et repo cibles sont configurés via `wrangler secret put`.
  // Plus aucune valeur sensible ne transite par le navigateur (cf. MIGRATION.md).

  // ─── Vercel deploy hook ───────────────────────
  const [deployHook, setDeployHook] = useState(() => loadLocal(LS_KEYS.vercelDeployHook, ''));

  // ─── Contact auth token ──────────────────────
  const [contactAuthToken, setContactAuthToken] = useState(() => loadLocal(LS_KEYS.contactAuthToken, ''));

  // ─── Opérateur ──────────────────────────────
  const [operator, setOperator] = useState(() => loadLocal(LS_KEYS.operator, ''));

  // ─── Import ───────────────────────────────────
  const [importStep, setImportStep] = useState(0);
  const [importData, setImportData] = useState(null);
  const [importHeaders, setImportHeaders] = useState([]);
  const [importMapping, setImportMapping] = useState({});
  const [importTarget, setImportTarget] = useState('newsletter');
  const [importing, setImporting] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState('skip'); // skip | update
  const fileRef = useRef(null);

  // ─── Automatisations ──────────────────────────
  const [automations, setAutomations] = useState(() => loadLocal('automations', {
    telegramNewSubscriber: false,
  }));

  const [activeSettingsTab, setActiveSettingsTab] = useState('connexions');

  const isAdmin = currentUser?.role === 'admin';
  // L'onglet "Automatisations" est masqué en attendant un consommateur réel
  // côté Worker (toggle décoratif jusqu'ici, cf. AUDIT §3.11 / Q9). Le state
  // reste en localStorage pour ne pas perdre la config existante.
  const SETTINGS_TABS = [
    { key: 'connexions', label: 'Connexions API' },
    { key: 'utilisateurs', label: 'Utilisateurs' },
    { key: 'import', label: 'Import / Export' },
    { key: 'avance', label: 'Avancé' },
  ];

  // ─── Utilisateurs ────────────────────────────
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [newUser, setNewUser] = useState({ login: '', name: '', password: '', role: 'editor' });
  const [creatingUser, setCreatingUser] = useState(false);
  const [resetTarget, setResetTarget] = useState(null); // {id, login}
  const [resetPassword, setResetPassword] = useState('');
  // Mot de passe perso
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);

  const refreshUsers = async () => {
    if (!isAdmin) return;
    setUsersLoading(true);
    setUsersError('');
    try {
      const data = await listUsers();
      setUsers(data.users || []);
    } catch (err) {
      setUsersError(err.message || 'Erreur de chargement');
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (activeSettingsTab === 'utilisateurs' && isAdmin) refreshUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSettingsTab, isAdmin]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.login.trim() || !newUser.name.trim() || newUser.password.length < 8) {
      toast('Champs requis (mot de passe min 8 caractères)', 'error');
      return;
    }
    setCreatingUser(true);
    try {
      await apiCreateUser({
        login: newUser.login.trim(),
        name: newUser.name.trim(),
        password: newUser.password,
        role: newUser.role,
      });
      toast(`Compte "${newUser.login}" créé`);
      setNewUser({ login: '', name: '', password: '', role: 'editor' });
      refreshUsers();
    } catch (err) {
      toast(err.message || 'Erreur création', 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (u) => {
    if (!confirm(`Supprimer définitivement le compte "${u.login}" ?`)) return;
    try {
      await apiDeleteUser(u.id);
      toast(`Compte "${u.login}" supprimé`);
      refreshUsers();
    } catch (err) {
      toast(err.message || 'Erreur suppression', 'error');
    }
  };

  const handleToggleRole = async (u) => {
    const nextRole = u.role === 'admin' ? 'editor' : 'admin';
    try {
      await apiUpdateUser(u.id, { role: nextRole });
      toast(`Rôle de "${u.login}" changé en ${nextRole}`);
      refreshUsers();
    } catch (err) {
      toast(err.message || 'Erreur', 'error');
    }
  };

  const handleResetPassword = async () => {
    if (resetPassword.length < 8) {
      toast('Mot de passe trop court (min 8 caractères)', 'error');
      return;
    }
    try {
      await apiUpdateUser(resetTarget.id, { password: resetPassword });
      toast(`Mot de passe de "${resetTarget.login}" réinitialisé`);
      setResetTarget(null);
      setResetPassword('');
    } catch (err) {
      toast(err.message || 'Erreur', 'error');
    }
  };

  const handleChangeMyPassword = async (e) => {
    e.preventDefault();
    if (pwForm.next.length < 8) {
      toast('Mot de passe trop court (min 8 caractères)', 'error');
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      toast('Les mots de passe ne correspondent pas', 'error');
      return;
    }
    setPwBusy(true);
    try {
      await changeMyPassword(pwForm.current, pwForm.next);
      toast('Mot de passe modifié');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      toast(err.message || 'Erreur', 'error');
    } finally {
      setPwBusy(false);
    }
  };

  const toggleAutomation = (key) => {
    setAutomations(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveLocal('automations', next);
      return next;
    });
  };

  // ─── Sauvegarder config ───────────────────────
  const saveConfig = () => {
    saveLocal(LS_KEYS.workerUrl, workerUrl);
    saveLocal(LS_KEYS.operator, operator);
    saveLocal(LS_KEYS.vercelDeployHook, deployHook);
    saveLocal(LS_KEYS.contactAuthToken, contactAuthToken);
    toast('Configuration sauvegardée');
    if (onRefresh) onRefresh();
  };

  const testGitHub = async () => {
    setTesting(prev => ({ ...prev, github: 'loading' }));
    try {
      // Test côté Worker — vérifie que le secret GITHUB_PAT est bien configuré
      // et que le repo cible est accessible. Plus de token côté navigateur.
      const health = await checkHealth();
      if (!health?.services?.github) {
        throw new Error('Secret GITHUB_PAT non configuré côté Worker (cf. MIGRATION.md)');
      }
      // Lecture d'un fichier test pour confirmer l'accès au repo
      const { githubGetFile } = await import('../services/github');
      const file = await githubGetFile('data/publications.json');
      const data = JSON.parse(file.content);
      setTesting(prev => ({ ...prev, github: 'ok' }));
      toast(`GitHub connecté — ${Array.isArray(data) ? data.length : 0} publications dans le repo`);
    } catch (err) {
      setTesting(prev => ({ ...prev, github: 'error' }));
      toast(`Erreur GitHub : ${err.message}`, 'error');
    }
  };

  // ─── Test connexion ───────────────────────────
  const testService = async (service) => {
    setTesting(prev => ({ ...prev, [service]: 'loading' }));
    try {
      if (service === 'worker') {
        const health = await checkHealth();
        setTesting(prev => ({
          ...prev,
          worker: 'ok',
          brevo: health.services?.brevo ? 'ok' : 'error',
          telegram: health.services?.telegram ? 'ok' : 'error',
          github: health.services?.github ? 'ok' : 'error',
          translate: health.services?.translate ? 'ok' : 'error',
        }));
        toast(`Worker connecté — Brevo : ${health.services?.brevo ? '✅' : '❌'}, Telegram : ${health.services?.telegram ? '✅' : '❌'}`);
        if (onRefresh) onRefresh();
      } else if (service === 'telegram') {
        await testTelegram();
        setTesting(prev => ({ ...prev, telegram: 'ok' }));
        toast('Message test envoyé sur Telegram');
      } else if (service === 'brevo') {
        const { fetchContacts } = await import('../services/brevo');
        const data = await fetchContacts(1);
        setTesting(prev => ({ ...prev, brevo: 'ok' }));
        toast(`Brevo OK — ${data.count || 0} contacts dans la base`);
      }
    } catch (err) {
      setTesting(prev => ({ ...prev, [service]: 'error' }));
      toast(`Erreur : ${err.message}`, 'error');
    }
  };

  // ─── Import Excel ─────────────────────────────
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await parseFile(file);
      setImportData(result.data);
      setImportHeaders(result.headers);
      // Auto-mapping
      const autoMap = {};
      const headerLower = result.headers.map(h => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim());
      const mappings = {
        nom: ['nom', 'name', 'last_name', 'lastname', 'nom de famille'],
        prenom: ['prenom', 'first_name', 'firstname'],
        email: ['email', 'e-mail', 'mail', 'courriel', 'adresse email'],
        telephone: ['telephone', 'tel', 'phone', 'mobile', 'numero'],
        date: ['date', 'date_inscription', 'created', 'date inscription'],
        statut: ['statut', 'status', 'etat'],
        source: ['source', 'origine', 'origin', 'provenance'],
      };
      for (const [field, aliases] of Object.entries(mappings)) {
        const idx = headerLower.findIndex(h => aliases.includes(h));
        if (idx >= 0) autoMap[field] = result.headers[idx];
      }
      setImportMapping(autoMap);
      setImportStep(1);
      toast(`${result.data.length} lignes détectées`, 'info');
    } catch (err) {
      toast(err.message, 'error');
    }
    e.target.value = '';
  };

  const getValidationSummary = () => {
    if (!importData) return { ok: 0, errors: 0, duplicates: 0, total: 0 };
    const emailField = importMapping.email;
    const existingEmails = subscribers.map(a => (a.email || '').toLowerCase());
    let errors = 0;
    const rowsWithEmail = [];
    const rowsWithoutEmail = [];

    for (const row of importData) {
      const email = emailField ? String(row[emailField] || '').trim() : '';
      if (!email) {
        rowsWithoutEmail.push(row);
        continue;
      }
      if (!isValidEmail(email)) {
        errors++;
        continue;
      }
      rowsWithEmail.push({ ...row, _email: email.toLowerCase() });
    }

    const { unique, duplicates } = findDuplicates(rowsWithEmail, existingEmails);
    return {
      ok: unique.length,
      errors,
      duplicates: duplicates.length,
      noEmail: rowsWithoutEmail.length,
      total: importData.length,
      uniqueRows: unique,
      duplicateRows: duplicates,
    };
  };

  const validationSummary = importStep >= 1 ? getValidationSummary() : null;

  const executeImport = async () => {
    if (!validationSummary) return;
    setImporting(true);

    const rowsToImport = [
      ...validationSummary.uniqueRows,
      ...(duplicateAction === 'update' ? validationSummary.duplicateRows : []),
    ];

    const newItems = rowsToImport.map((row, i) => ({
      id: Date.now() + i,
      name: [
        importMapping.prenom ? row[importMapping.prenom] : '',
        importMapping.nom ? row[importMapping.nom] : '',
      ].filter(Boolean).join(' ') || row._email?.split('@')[0] || `Import ${i + 1}`,
      firstName: importMapping.prenom ? String(row[importMapping.prenom] || '') : '',
      lastName: importMapping.nom ? String(row[importMapping.nom] || '') : '',
      email: row._email || '',
      phone: importMapping.telephone ? String(row[importMapping.telephone] || '') : '',
      date: importMapping.date ? String(row[importMapping.date] || new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
      status: importMapping.statut ? String(row[importMapping.statut] || '') : 'added',
      source: importMapping.source ? String(row[importMapping.source] || 'Import') : 'Import',
    }));

    onImportSubscribers(newItems);

    // Tenter de pousser vers Brevo si connecté et import newsletter
    if (importTarget === 'newsletter' && services?.brevo) {
      let synced = 0;
      for (const item of newItems.slice(0, 50)) {
        try {
          await addBrevoContact({
            email: item.email,
            firstName: item.firstName,
            lastName: item.lastName,
            source: 'Import back-office',
          });
          synced++;
        } catch { /* continue */ }
      }
      if (synced > 0) {
        toast(`${synced} contact${synced > 1 ? 's' : ''} synchronisé${synced > 1 ? 's' : ''} avec Brevo`, 'info');
      }
    }

    setImporting(false);
    setImportStep(0);
    setImportData(null);
    toast(`${newItems.length} contact${newItems.length > 1 ? 's' : ''} importé${newItems.length > 1 ? 's' : ''}`);
  };

  // ─── Export global ────────────────────────────
  const handleExportGlobal = () => {
    const subscribersData = subscribers.map(s => ({
      Nom: s.name, Email: s.email, 'Date inscription': s.date,
      Statut: s.status, Source: s.source,
    }));
    exportMultiSheet([
      { data: subscribersData, name: 'Newsletter' },
    ], `export-global-IR-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast('Export global téléchargé');
  };

  const statusIcon = (s) => {
    if (s === 'ok') return <span className="status-dot green" style={{ marginLeft: 8 }} />;
    if (s === 'error') return <span className="status-dot red" style={{ marginLeft: 8 }} />;
    if (s === 'loading') return <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-light)' }}>Test…</span>;
    return <span className="status-dot gray" style={{ marginLeft: 8 }} />;
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Configuration</h1>
          <p className="page-header-sub">Connexions API, import/export, automatisations</p>
        </div>
        <div className="flex-center gap-8">
          <ServiceBadge service="cloudflare" />
        </div>
      </div>

      <div className="page-body">
        {/* Onglets internes */}
        <div className="tab-group mb-16">
          {SETTINGS_TABS.map(t => (
            <button key={t.key} className={`tab-item${activeSettingsTab === t.key ? ' active' : ''}`} onClick={() => setActiveSettingsTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>


        {/* ═══ ONGLET CONNEXIONS ═══ */}
        {activeSettingsTab === 'connexions' && (<>
          <div className="settings-grid">
            <div className="card">
              <h3 style={{ fontSize: 16, marginBottom: 16 }}>Connexions API</h3>
              <div style={{ marginBottom: 16 }}>
                <label>URL du Cloudflare Worker</label>
                <div className="flex-center gap-8">
                  <input value={workerUrl} onChange={e => setWorkerUrl(e.target.value)} placeholder="https://ir-dashboard-api.xxx.workers.dev" />
                  <button className="btn btn-outline btn-sm" onClick={() => testService('worker')} style={{ whiteSpace: 'nowrap' }}>Tester tout</button>
                </div>
              </div>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--navy)' }}>État des services</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[
                  { key: 'brevo', label: 'Brevo', connected: services?.brevo },
                  { key: 'telegram', label: 'Telegram', connected: services?.telegram },
                  { key: 'github', label: 'GitHub', connected: services?.github },
                  { key: 'translate', label: 'Translate', connected: services?.translate },
                ].map(({ key, label, connected }) => (
                  <div key={key} style={{ textAlign: 'center', padding: 12, background: 'var(--cream)', borderRadius: 8 }}>
                    <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>{label} {statusIcon(testing[key] || (connected ? 'ok' : ''))}</p>
                    <p style={{ fontWeight: 600, fontSize: 14, color: connected ? 'var(--green)' : 'var(--text-light)' }}>{connected ? 'Configuré' : 'Non configuré'}</p>
                  </div>
                ))}
              </div>
              <div className="flex-wrap gap-8" style={{ marginBottom: 12 }}>
                {services?.brevo && <button className="btn btn-outline btn-sm" onClick={() => testService('brevo')} disabled={testing.brevo === 'loading'}>{testing.brevo === 'loading' ? 'Test…' : 'Test Brevo'}</button>}
                {services?.telegram && <button className="btn btn-outline btn-sm" onClick={() => testService('telegram')}>Test Telegram</button>}
                {services?.github && <button className="btn btn-outline btn-sm" onClick={testGitHub} disabled={testing.github === 'loading'}>{testing.github === 'loading' ? 'Test…' : 'Test GitHub'}</button>}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 12, lineHeight: 1.6 }}>
                Les clés API sont stockées en secrets sur le Cloudflare Worker (jamais côté client).
                Pour configurer : <code style={{ fontSize: 11, background: '#f0f0f0', padding: '1px 4px', borderRadius: 3 }}>wrangler secret put NOM_SECRET</code>
              </p>
            </div>
          </div>

          <div className="settings-grid" style={{ marginTop: 20 }}>
            <div className="card">
              <h3 style={{ fontSize: 16, marginBottom: 16 }}>
                Publication GitHub {statusIcon(testing.github || (services?.github ? 'ok' : ''))}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 12 }}>
                Le token GitHub est désormais un secret côté Worker (jamais
                dans le navigateur). Configuration via{' '}
                <code style={{ fontSize: 11, background: '#f0f0f0', padding: '1px 4px', borderRadius: 3 }}>wrangler secret put GITHUB_PAT</code>.
                Quand un utilisateur se connecte en OAuth GitHub, ses commits
                sont en plus attribués à son propre compte (cf. MIGRATION.md).
              </p>
              <button
                className="btn btn-outline btn-sm"
                onClick={testGitHub}
                disabled={testing.github === 'loading'}
              >
                {testing.github === 'loading' ? 'Test…' : 'Tester la connexion GitHub'}
              </button>
            </div>
            <div className="card">
              <h3 style={{ fontSize: 16, marginBottom: 16 }}>Vercel Deploy Hook {statusIcon(deployHook ? 'ok' : '')}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 16 }}>Configurez l'URL du deploy hook Vercel pour permettre le rebuild du site depuis le dashboard.</p>
              <div style={{ marginBottom: 12 }}><label>URL du deploy hook</label><input value={deployHook} onChange={e => setDeployHook(e.target.value)} placeholder="https://api.vercel.com/v1/integrations/deploy/prj_..." /></div>
            </div>
            <div className="card">
              <h3 style={{ fontSize: 16, marginBottom: 16 }}>Sollicitations — Token d'accès {statusIcon(contactAuthToken ? 'ok' : '')}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 16 }}>
                Si vous avez configuré un <code style={{ fontSize: 11, background: '#f0f0f0', padding: '1px 4px', borderRadius: 3 }}>CONTACT_AUTH_TOKEN</code> sur le Worker,
                renseignez-le ici pour que le dashboard puisse lire et gérer les sollicitations.
              </p>
              <div style={{ marginBottom: 12 }}><label>Bearer token</label><input type="password" value={contactAuthToken} onChange={e => setContactAuthToken(e.target.value)} placeholder="Votre token (optionnel si pas de token côté Worker)" /></div>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <button className="btn btn-primary btn-lg" onClick={saveConfig}>Sauvegarder la configuration</button>
          </div>
        </>)}

        {/* ═══ ONGLET UTILISATEURS ═══ */}
        {activeSettingsTab === 'utilisateurs' && (<>
          {/* Mon mot de passe — disponible pour tout le monde */}
          <div className="card mb-16">
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Mon mot de passe</h3>
            <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 12 }}>
              Connecté en tant que <strong>{currentUser?.name}</strong> ({currentUser?.login}) — rôle <strong>{currentUser?.role}</strong>
            </p>
            <form onSubmit={handleChangeMyPassword} style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
              <input type="password" placeholder="Mot de passe actuel" value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} autoComplete="current-password" />
              <input type="password" placeholder="Nouveau mot de passe (min 8 caractères)" value={pwForm.next} onChange={e => setPwForm({ ...pwForm, next: e.target.value })} autoComplete="new-password" />
              <input type="password" placeholder="Confirmer le nouveau mot de passe" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} autoComplete="new-password" />
              <div>
                <button type="submit" className="btn btn-primary" disabled={pwBusy || !pwForm.current || !pwForm.next}>
                  {pwBusy ? 'Modification…' : 'Changer mon mot de passe'}
                </button>
              </div>
            </form>
          </div>

          {!isAdmin && (
            <div className="card">
              <p style={{ fontSize: 13, color: 'var(--text-light)' }}>
                Seuls les administrateurs peuvent gérer les comptes des autres utilisateurs.
              </p>
            </div>
          )}

          {isAdmin && (<>
            {/* Liste utilisateurs */}
            <div className="card mb-16">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, margin: 0 }}>Comptes ({users.length})</h3>
                <button className="btn btn-outline btn-sm" onClick={refreshUsers} disabled={usersLoading}>
                  {usersLoading ? 'Chargement…' : 'Rafraîchir'}
                </button>
              </div>
              {usersError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{usersError}</p>}
              {users.length === 0 && !usersLoading && !usersError && (
                <p style={{ fontSize: 13, color: 'var(--text-light)' }}>Aucun compte enregistré.</p>
              )}
              {users.length > 0 && (
                <table className="data-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Identifiant</th>
                      <th>Nom</th>
                      <th>Rôle</th>
                      <th>Créé le</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => {
                      const isMe = u.id === currentUser?.id;
                      return (
                        <tr key={u.id}>
                          <td><strong>{u.login}</strong>{isMe && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-light)' }}>(vous)</span>}</td>
                          <td>{u.name}</td>
                          <td>
                            <span className={`badge ${u.role === 'admin' ? 'badge-sky' : 'badge-gray'}`}>{u.role}</span>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-light)' }}>
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '—'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="flex-wrap gap-8" style={{ justifyContent: 'flex-end' }}>
                              <button className="btn btn-outline btn-sm" onClick={() => { setResetTarget(u); setResetPassword(''); }}>
                                Réinit. mdp
                              </button>
                              {!isMe && (
                                <button className="btn btn-outline btn-sm" onClick={() => handleToggleRole(u)}>
                                  {u.role === 'admin' ? '→ editor' : '→ admin'}
                                </button>
                              )}
                              {!isMe && (
                                <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteUser(u)}>
                                  Supprimer
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Création */}
            <div className="card mb-16">
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Créer un compte</h3>
              <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label>Identifiant</label>
                  <input value={newUser.login} onChange={e => setNewUser({ ...newUser, login: e.target.value })} placeholder="ex : marie" autoComplete="off" />
                </div>
                <div>
                  <label>Nom complet</label>
                  <input value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} placeholder="ex : Marie Durand" autoComplete="off" />
                </div>
                <div>
                  <label>Mot de passe (min 8)</label>
                  <input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} autoComplete="new-password" />
                </div>
                <div>
                  <label>Rôle</label>
                  <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                    <option value="editor">editor (accès dashboard)</option>
                    <option value="admin">admin (gère les comptes)</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <button type="submit" className="btn btn-primary" disabled={creatingUser}>
                    {creatingUser ? 'Création…' : 'Créer le compte'}
                  </button>
                </div>
              </form>
            </div>

            {/* Modal réinit. mdp */}
            {resetTarget && (
              <div className="card" style={{ borderColor: 'var(--ochre)' }}>
                <h3 style={{ fontSize: 16, marginBottom: 12 }}>Réinitialiser le mot de passe — {resetTarget.login}</h3>
                <input
                  type="password"
                  placeholder="Nouveau mot de passe (min 8 caractères)"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  style={{ maxWidth: 420 }}
                  autoComplete="new-password"
                />
                <div className="flex-wrap gap-8" style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={handleResetPassword}>Confirmer</button>
                  <button className="btn btn-outline" onClick={() => { setResetTarget(null); setResetPassword(''); }}>Annuler</button>
                </div>
              </div>
            )}
          </>)}
        </>)}

        {/* ═══ ONGLET IMPORT / EXPORT ═══ */}
        {activeSettingsTab === 'import' && (<>
          <div className="card mb-16">
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>Export global</h3>
            <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 12 }}>
              Téléchargez toutes les données en un fichier Excel avec des onglets séparés ({subscribers.length} abonnés).
            </p>
            <button className="btn btn-primary" onClick={handleExportGlobal}>Télécharger l&rsquo;export global</button>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>Importer un fichier Excel / CSV</h3>
            {importStep === 0 && (
              <>
                <div className="flex-wrap gap-16 mb-16">
                  <div>
                    <label>Type d&rsquo;import</label>
                    <select value={importTarget} onChange={e => setImportTarget(e.target.value)} style={{ width: 'auto', minWidth: 200 }}>
                      <option value="newsletter">Abonnés newsletter</option>
                    </select>
                  </div>
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} style={{ display: 'none' }} />
                <button className="btn btn-sky" onClick={() => fileRef.current?.click()}>Choisir un fichier (.xlsx, .xls, .csv)</button>
              </>
            )}
            {importStep >= 1 && importData && (
              <>
                <div className="alert-banner alert-info mb-16">{importData.length} lignes détectées — Colonnes : {importHeaders.join(', ')}</div>
                <div className="table-wrap mb-16" style={{ maxHeight: 200, overflow: 'auto' }}>
                  <table className="data-table">
                    <thead><tr>{importHeaders.map(h => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>{importData.slice(0, 5).map((row, i) => (<tr key={i}>{importHeaders.map(h => <td key={h}>{String(row[h] ?? '')}</td>)}</tr>))}</tbody>
                  </table>
                </div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--navy)' }}>Mapping des colonnes</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                  {['nom', 'prenom', 'email', 'date', 'statut', 'source'].map(field => (
                    <div key={field}>
                      <label>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                      <select value={importMapping[field] || ''} onChange={e => setImportMapping(prev => ({ ...prev, [field]: e.target.value }))} style={{ fontSize: 13 }}>
                        <option value="">— Non mappé —</option>
                        {importHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                {validationSummary && (
                  <div className="mb-16">
                    <div className="flex-wrap gap-8 mb-8">
                      <span className="badge badge-green">{validationSummary.ok} lignes OK</span>
                      {validationSummary.errors > 0 && <span className="badge badge-danger">{validationSummary.errors} emails invalides</span>}
                      {validationSummary.duplicates > 0 && <span className="badge badge-ochre">{validationSummary.duplicates} doublons</span>}
                      {validationSummary.noEmail > 0 && <span className="badge badge-gray">{validationSummary.noEmail} sans email</span>}
                    </div>
                    {validationSummary.duplicates > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <label>Action pour les doublons</label>
                        <div className="flex-center gap-8" style={{ marginTop: 4 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', textTransform: 'none', fontWeight: 400, fontSize: 14 }}>
                            <input type="radio" name="dupAction" checked={duplicateAction === 'skip'} onChange={() => setDuplicateAction('skip')} /> Ignorer les doublons
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', textTransform: 'none', fontWeight: 400, fontSize: 14 }}>
                            <input type="radio" name="dupAction" checked={duplicateAction === 'update'} onChange={() => setDuplicateAction('update')} /> Mettre à jour les existants
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex-center gap-8">
                  <button className="btn btn-outline" onClick={() => { setImportStep(0); setImportData(null); }}>Annuler</button>
                  <button className="btn btn-primary" onClick={executeImport} disabled={importing || !validationSummary || validationSummary.ok === 0}>
                    {importing ? 'Import en cours…' : `Importer ${(validationSummary?.ok || 0) + (duplicateAction === 'update' ? (validationSummary?.duplicates || 0) : 0)} contacts`}
                  </button>
                </div>
              </>
            )}
          </div>
        </>)}

        {/* ═══ ONGLET AUTOMATISATIONS ═══ */}
        {activeSettingsTab === 'automations' && (
          <div className="card">
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>Automatisations</h3>
            {[
              ['telegramNewSubscriber', 'Notif Telegram (nouvel abonné newsletter)'],
            ].map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 14 }}>{label}</span>
                <button className={`btn btn-sm ${automations[key] ? 'btn-green' : 'btn-outline'}`} onClick={() => toggleAutomation(key)} style={{ minWidth: 60 }}>
                  {automations[key] ? 'ON' : 'OFF'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ═══ ONGLET AVANCÉ ═══ */}
        {activeSettingsTab === 'avance' && (<>
          <div className="card mb-16">
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>Opérateur actif</h3>
            <label>Votre nom</label>
            <input value={operator} onChange={e => setOperator(e.target.value)} placeholder="Ex : Marie, Lucas, Bénédicte" />
            <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 8 }}>Les actions seront loguées avec ce nom.</p>
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary" onClick={saveConfig}>Sauvegarder</button>
            </div>
          </div>
          <div className="card">
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>Informations de debug</h3>
            <p style={{ fontSize: 13, color: 'var(--text-light)' }}>Worker URL : {workerUrl || '(non configuré)'}</p>
            <p style={{ fontSize: 13, color: 'var(--text-light)' }}>GitHub repo cible : configuré côté Worker (secrets GITHUB_OWNER / GITHUB_SITE_REPO)</p>
          </div>
        </>)}
      </div>
    </>
  );
}
