import { useState, useRef } from 'react';
import ServiceBadge from '../components/shared/ServiceBadge';
import { loadLocal, saveLocal } from '../utils/localStorage';
import { LS_KEYS, DEFAULT_WORKER_URL } from '../utils/constants';
import { parseFile, isValidEmail, findDuplicates } from '../services/export';
import { exportMultiSheet } from '../services/export';
import { checkHealth } from '../services/api';
import { testConnection as testTelegram } from '../services/telegram';
import { addContact as addBrevoContact } from '../services/brevo';

export default function Settings({ adherents, subscribers, services, onImportAdherents, onImportSubscribers, onRefresh, toast }) {
  // ─── Config API ───────────────────────────────
  const [workerUrl, setWorkerUrl] = useState(() => loadLocal(LS_KEYS.workerUrl, DEFAULT_WORKER_URL));
  const [testing, setTesting] = useState({});

  // ─── Op\u00e9rateur ──────────────────────────────
  const [operator, setOperator] = useState(() => loadLocal(LS_KEYS.operator, ''));

  // ─── Import ───────────────────────────────────
  const [importStep, setImportStep] = useState(0);
  const [importData, setImportData] = useState(null);
  const [importHeaders, setImportHeaders] = useState([]);
  const [importMapping, setImportMapping] = useState({});
  const [importTarget, setImportTarget] = useState('adherents');
  const [importing, setImporting] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState('skip'); // skip | update
  const fileRef = useRef(null);

  // ─── Automatisations ──────────────────────────
  const [automations, setAutomations] = useState(() => loadLocal('automations', {
    welcomeEmail: true,
    renewalReminder: false,
    telegramNewAdherent: true,
    telegramNewSubscriber: false,
  }));

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
    toast('Configuration sauvegard\u00e9e');
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
          helloasso: health.services?.helloasso ? 'ok' : 'error',
          brevo: health.services?.brevo ? 'ok' : 'error',
          telegram: health.services?.telegram ? 'ok' : 'error',
        }));
        toast(`Worker connect\u00e9 \u2014 HelloAsso\u00a0: ${health.services?.helloasso ? '\u2705' : '\u274c'}, Brevo\u00a0: ${health.services?.brevo ? '\u2705' : '\u274c'}, Telegram\u00a0: ${health.services?.telegram ? '\u2705' : '\u274c'}`);
        if (onRefresh) onRefresh();
      } else if (service === 'telegram') {
        await testTelegram();
        setTesting(prev => ({ ...prev, telegram: 'ok' }));
        toast('Message test envoy\u00e9 sur Telegram');
      }
    } catch (err) {
      setTesting(prev => ({ ...prev, [service]: 'error' }));
      toast(`Erreur\u00a0: ${err.message}`, 'error');
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
      const headerLower = result.headers.map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim());
      const mappings = {
        nom: ['nom', 'name', 'last_name', 'lastname', 'nom de famille'],
        prenom: ['prenom', 'first_name', 'firstname'],
        email: ['email', 'e-mail', 'mail', 'courriel', 'adresse email'],
        telephone: ['telephone', 'tel', 'phone', 'mobile', 'numero'],
        date: ['date', 'date_adhesion', 'date_inscription', 'created', 'date adhesion', 'date inscription'],
        montant: ['montant', 'amount', 'prix', 'price', 'somme'],
        statut: ['statut', 'status', 'etat'],
        source: ['source', 'origine', 'origin', 'provenance'],
      };
      for (const [field, aliases] of Object.entries(mappings)) {
        const idx = headerLower.findIndex(h => aliases.includes(h));
        if (idx >= 0) autoMap[field] = result.headers[idx];
      }
      setImportMapping(autoMap);
      setImportStep(1);
      toast(`${result.data.length} lignes d\u00e9tect\u00e9es`, 'info');
    } catch (err) {
      toast(err.message, 'error');
    }
    e.target.value = '';
  };

  const getValidationSummary = () => {
    if (!importData) return { ok: 0, errors: 0, duplicates: 0, total: 0 };
    const emailField = importMapping.email;
    const existingEmails = (importTarget === 'adherents' ? adherents : subscribers).map(a => (a.email || '').toLowerCase());
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
      amount: importMapping.montant ? parseFloat(row[importMapping.montant]) || 0 : 0,
      type: importTarget === 'adherents' ? 'Adh\u00e9sion' : undefined,
      status: importMapping.statut ? String(row[importMapping.statut] || '') : (importTarget === 'adherents' ? 'actif' : 'added'),
      source: importMapping.source ? String(row[importMapping.source] || 'Import') : 'Import',
    }));

    // Pousser dans le state
    if (importTarget === 'adherents') {
      onImportAdherents(newItems);
    } else {
      onImportSubscribers(newItems);
    }

    // Tenter de pousser vers Brevo si connect\u00e9 et import newsletter
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
        toast(`${synced} contact${synced > 1 ? 's' : ''} synchronis\u00e9${synced > 1 ? 's' : ''} avec Brevo`, 'info');
      }
    }

    setImporting(false);
    setImportStep(0);
    setImportData(null);
    toast(`${newItems.length} contact${newItems.length > 1 ? 's' : ''} import\u00e9${newItems.length > 1 ? 's' : ''}`);
  };

  // ─── Export global ────────────────────────────
  const handleExportGlobal = () => {
    const adherentsData = adherents.map(a => ({
      Nom: a.name, Email: a.email, Date: a.date,
      'Montant (\u20ac)': a.amount, Type: a.type, Statut: a.status, Source: a.source,
    }));
    const subscribersData = subscribers.map(s => ({
      Nom: s.name, Email: s.email, 'Date inscription': s.date,
      Statut: s.status, Source: s.source,
    }));
    exportMultiSheet([
      { data: adherentsData, name: 'Adh\u00e9rents' },
      { data: subscribersData, name: 'Newsletter' },
    ], `export-global-IR-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast('Export global t\u00e9l\u00e9charg\u00e9');
  };

  const statusIcon = (s) => {
    if (s === 'ok') return <span className="status-dot green" style={{ marginLeft: 8 }} />;
    if (s === 'error') return <span className="status-dot red" style={{ marginLeft: 8 }} />;
    if (s === 'loading') return <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-light)' }}>Test\u2026</span>;
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Config API */}
          <div className="card">
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>Connexions API</h3>

            <div style={{ marginBottom: 16 }}>
              <label>URL du Cloudflare Worker</label>
              <div className="flex-center gap-8">
                <input value={workerUrl} onChange={e => setWorkerUrl(e.target.value)} placeholder="https://ir-dashboard-api.xxx.workers.dev" />
                <button className="btn btn-outline btn-sm" onClick={() => testService('worker')} style={{ whiteSpace: 'nowrap' }}>
                  Tester tout
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ textAlign: 'center', padding: 12, background: 'var(--cream)', borderRadius: 8 }}>
                <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>HelloAsso {statusIcon(testing.helloasso || (services?.helloasso ? 'ok' : ''))}</p>
                <p style={{ fontWeight: 600, fontSize: 14, color: services?.helloasso ? 'var(--green)' : 'var(--text-light)' }}>
                  {services?.helloasso ? 'Connect\u00e9' : 'Non configur\u00e9'}
                </p>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'var(--cream)', borderRadius: 8 }}>
                <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Brevo {statusIcon(testing.brevo || (services?.brevo ? 'ok' : ''))}</p>
                <p style={{ fontWeight: 600, fontSize: 14, color: services?.brevo ? 'var(--green)' : 'var(--text-light)' }}>
                  {services?.brevo ? 'Connect\u00e9' : 'Non configur\u00e9'}
                </p>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'var(--cream)', borderRadius: 8 }}>
                <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Telegram {statusIcon(testing.telegram || (services?.telegram ? 'ok' : ''))}</p>
                <p style={{ fontWeight: 600, fontSize: 14, color: services?.telegram ? 'var(--green)' : 'var(--text-light)' }}>
                  {services?.telegram ? 'Connect\u00e9' : 'Non configur\u00e9'}
                </p>
              </div>
            </div>

            {services?.telegram && (
              <button className="btn btn-outline btn-sm" onClick={() => testService('telegram')}>
                Envoyer un message test Telegram
              </button>
            )}

            <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 12, lineHeight: 1.6 }}>
              Les cl\u00e9s API sont stock\u00e9es en secrets sur le Cloudflare Worker (jamais c\u00f4t\u00e9 client).
              Pour configurer\u00a0: <code style={{ fontSize: 11, background: '#f0f0f0', padding: '1px 4px', borderRadius: 3 }}>wrangler secret put NOM_SECRET</code>
            </p>
          </div>

          {/* Op\u00e9rateur + Export */}
          <div>
            <div className="card mb-16">
              <h3 style={{ fontSize: 16, marginBottom: 16 }}>Op\u00e9rateur actif</h3>
              <label>Votre nom</label>
              <input value={operator} onChange={e => setOperator(e.target.value)} placeholder="Ex\u00a0: Marie, Lucas, B\u00e9n\u00e9dicte" />
              <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 8 }}>
                Les actions seront logu\u00e9es avec ce nom.
              </p>
            </div>

            <div className="card mb-16">
              <h3 style={{ fontSize: 16, marginBottom: 16 }}>Export global</h3>
              <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 12 }}>
                T\u00e9l\u00e9chargez toutes les donn\u00e9es en un fichier Excel avec des onglets s\u00e9par\u00e9s
                ({adherents.length} adh\u00e9rents, {subscribers.length} abonn\u00e9s).
              </p>
              <button className="btn btn-primary" onClick={handleExportGlobal}>
                T\u00e9l\u00e9charger l&rsquo;export global
              </button>
            </div>

            {/* Automatisations */}
            <div className="card">
              <h3 style={{ fontSize: 16, marginBottom: 16 }}>Automatisations</h3>
              {[
                ['welcomeEmail', 'Email de bienvenue (nouvel adh\u00e9rent)'],
                ['renewalReminder', 'Rappel de renouvellement (30j avant expiration)'],
                ['telegramNewAdherent', 'Notif Telegram (nouvelle adh\u00e9sion)'],
                ['telegramNewSubscriber', 'Notif Telegram (nouvel abonn\u00e9)'],
              ].map(([key, label]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 14 }}>{label}</span>
                  <button
                    className={`btn btn-sm ${automations[key] ? 'btn-green' : 'btn-outline'}`}
                    onClick={() => toggleAutomation(key)}
                    style={{ minWidth: 60 }}
                  >
                    {automations[key] ? 'ON' : 'OFF'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <button className="btn btn-primary btn-lg" onClick={saveConfig}>
            Sauvegarder la configuration
          </button>
        </div>

        {/* Import Excel */}
        <div className="card" style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Importer un fichier Excel / CSV</h3>

          {importStep === 0 && (
            <>
              <div className="flex-wrap gap-16 mb-16">
                <div>
                  <label>Type d&rsquo;import</label>
                  <select value={importTarget} onChange={e => setImportTarget(e.target.value)} style={{ width: 'auto', minWidth: 200 }}>
                    <option value="adherents">Adh\u00e9rents</option>
                    <option value="newsletter">Abonn\u00e9s newsletter</option>
                  </select>
                </div>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} style={{ display: 'none' }} />
              <button className="btn btn-sky" onClick={() => fileRef.current?.click()}>
                Choisir un fichier (.xlsx, .xls, .csv)
              </button>
            </>
          )}

          {importStep >= 1 && importData && (
            <>
              <div className="alert-banner alert-info mb-16">
                {importData.length} lignes d\u00e9tect\u00e9es \u2014 Colonnes\u00a0: {importHeaders.join(', ')}
              </div>

              {/* Pr\u00e9visualisation */}
              <div className="table-wrap mb-16" style={{ maxHeight: 200, overflow: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>{importHeaders.map(h => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {importData.slice(0, 5).map((row, i) => (
                      <tr key={i}>{importHeaders.map(h => <td key={h}>{String(row[h] ?? '')}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mapping */}
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--navy)' }}>Mapping des colonnes</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                {(importTarget === 'adherents'
                  ? ['nom', 'prenom', 'email', 'telephone', 'date', 'montant', 'statut', 'source']
                  : ['nom', 'prenom', 'email', 'date', 'statut', 'source']
                ).map(field => (
                  <div key={field}>
                    <label>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                    <select
                      value={importMapping[field] || ''}
                      onChange={e => setImportMapping(prev => ({ ...prev, [field]: e.target.value }))}
                      style={{ fontSize: 13 }}
                    >
                      <option value="">\u2014 Non mapp\u00e9 \u2014</option>
                      {importHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* Validation */}
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
                          <input type="radio" name="dupAction" checked={duplicateAction === 'skip'} onChange={() => setDuplicateAction('skip')} />
                          Ignorer les doublons
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', textTransform: 'none', fontWeight: 400, fontSize: 14 }}>
                          <input type="radio" name="dupAction" checked={duplicateAction === 'update'} onChange={() => setDuplicateAction('update')} />
                          Mettre \u00e0 jour les existants
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex-center gap-8">
                <button className="btn btn-outline" onClick={() => { setImportStep(0); setImportData(null); }}>Annuler</button>
                <button
                  className="btn btn-primary"
                  onClick={executeImport}
                  disabled={importing || !validationSummary || validationSummary.ok === 0}
                >
                  {importing ? 'Import en cours\u2026' : `Importer ${(validationSummary?.ok || 0) + (duplicateAction === 'update' ? (validationSummary?.duplicates || 0) : 0)} contacts`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
