import { useState, useMemo, useEffect } from 'react';
import Modal from '../components/shared/Modal';
import ServiceBadge from '../components/shared/ServiceBadge';
import { EMAIL_TEMPLATES, COLORS, LS_KEYS } from '../utils/constants';
import { loadLocal, saveLocal } from '../utils/localStorage';
import { sendBulkEmail, sendEmail } from '../services/brevo';
import { sendMessage, sendChannelMessage, fetchMessages } from '../services/telegram';

export default function Messagerie({ subscribers = [], presse = [], auteurs = [], events = [], services, toast }) {
  const [channel, setChannel] = useState('email');
  const [templateKey, setTemplateKey] = useState('');
  const [selectedSegments, setSelectedSegments] = useState(['all_subscribers']);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState(() => loadLocal('ir_test_send_email', ''));
  const [showPreview, setShowPreview] = useState(false);
  const [history, setHistory] = useState(() => loadLocal(LS_KEYS.messageHistory, []));
  const [inbox, setInbox] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(false);

  // Charger boîte de réception Telegram quand Telegram est connecté
  useEffect(() => {
    if (!services?.telegram) return;
    let cancelled = false;
    const load = async () => {
      setInboxLoading(true);
      try {
        const msgs = await fetchMessages(30);
        if (!cancelled) setInbox(msgs);
      } catch {
        // silencieux — le bouton Rafraîchir reste dispo
      } finally {
        if (!cancelled) setInboxLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [services?.telegram]);

  const refreshInbox = async () => {
    setInboxLoading(true);
    try {
      const msgs = await fetchMessages(30);
      setInbox(msgs);
      toast('Boîte Telegram rafraîchie');
    } catch (err) {
      toast(`Erreur Telegram : ${err.message}`, 'error');
    } finally {
      setInboxLoading(false);
    }
  };

  // Compter les destinataires par segment
  const activeSubscribers = useMemo(
    () => subscribers.filter(s => s.status === 'added' || s.status === 'abonné'),
    [subscribers]
  );

  const presseContacts = useMemo(
    () => presse.filter(p => p.email),
    [presse]
  );

  const auteursContacts = useMemo(
    () => auteurs.filter(a => a.email),
    [auteurs]
  );

  const eventInscrits = useMemo(
    () => events.flatMap(e => (e.inscrits || []).filter(i => i.email)),
    [events]
  );

  const segments = [
    { key: 'all_subscribers', label: 'Abonnés newsletter', count: activeSubscribers.length, icon: '📬' },
    { key: 'all', label: 'Tous les contacts', count: subscribers.length, icon: '👥' },
    { key: 'presse', label: 'Contacts presse', count: presseContacts.length, icon: '📰' },
    { key: 'auteurs', label: 'Profils', count: auteursContacts.length, icon: '✍️' },
    { key: 'evenement', label: 'Inscrits événements', count: eventInscrits.length, icon: '🎤' },
  ];

  const toggleSegment = (key) => {
    setSelectedSegments(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const loadTemplate = (key) => {
    setTemplateKey(key);
    const tpl = EMAIL_TEMPLATES[key];
    if (tpl) {
      setSubject(tpl.subject);
      setBody(tpl.body);
    }
  };

  const recipientList = useMemo(() => {
    const map = new Map();
    const addContacts = (list) => list.forEach(c => { if (c.email) map.set(c.email, c); });
    selectedSegments.forEach(seg => {
      if (seg === 'all_subscribers') addContacts(activeSubscribers);
      else if (seg === 'all') addContacts(subscribers);
      else if (seg === 'presse') addContacts(presseContacts);
      else if (seg === 'auteurs') addContacts(auteursContacts);
      else if (seg === 'evenement') addContacts(eventInscrits);
    });
    return [...map.values()];
  }, [selectedSegments, activeSubscribers, subscribers, presseContacts, auteursContacts, eventInscrits]);

  const recipientCount = recipientList.length;

  /**
   * Test send : envoie le message à une seule adresse (ou au chat privé admin
   * pour Telegram) pour valider le rendu avant l'envoi de masse. Pas de
   * persistence dans l'historique, pas de comptage, pas d'effet sur la cible.
   */
  const handleTestSend = async () => {
    if (!body.trim()) return toast('Le message est vide', 'error');
    if (channel === 'email') {
      if (!subject.trim()) return toast("L'objet est requis", 'error');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.trim())) {
        return toast('Saisis une adresse email de test valide', 'error');
      }
    }
    setTesting(true);
    try {
      saveLocal('ir_test_send_email', testEmail.trim());
      if (channel === 'email') {
        if (!services?.brevo) {
          toast('Brevo non connecté — test simulé', 'success');
        } else {
          const htmlContent = body.replace(/\n/g, '<br>');
          await sendEmail({
            to: [{ email: testEmail.trim() }],
            subject: `[TEST] ${subject}`,
            htmlContent: `<div style="font-family: 'Source Sans 3', Arial, sans-serif; line-height: 1.6; color: #1a2744;"><p style="background:#fef3c7;padding:8px;border-radius:4px;font-size:13px;color:#92400e;margin-bottom:16px;">⚠️ Email de test — pas envoyé aux abonnés</p>${htmlContent}</div>`,
            sender: { name: 'Institut Rousseau (test)', email: 'contact@institut-rousseau.fr' },
          });
          toast(`Test envoyé à ${testEmail.trim()}`);
        }
      } else if (channel === 'telegram-channel' || channel === 'telegram-private') {
        // Pour Telegram on redirige vers le chat privé admin (TELEGRAM_CHAT_ID)
        // au lieu du canal public, ce qui donne un aperçu sans publier.
        if (!services?.telegram) {
          toast('Telegram non connecté — test simulé', 'success');
        } else {
          const prefix = channel === 'telegram-channel' ? '🧪 [TEST canal]\n\n' : '🧪 [TEST]\n\n';
          await sendMessage(null, prefix + body);
          toast('Test envoyé sur le chat privé admin');
        }
      }
    } catch (err) {
      toast(`Erreur test : ${err.message}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSend = async () => {
    if (!body.trim()) return toast('Le message est vide', 'error');
    if (channel === 'email' && !subject.trim()) return toast('L\'objet est requis', 'error');
    if (channel === 'email' && recipientCount === 0) return toast('Aucun destinataire sélectionné', 'error');

    setSending(true);
    try {
      if (channel === 'email') {
        if (services?.brevo) {
          const recipientEmails = recipientList.map(r => r.email);
          const htmlContent = body.replace(/\n/g, '<br>');
          await sendBulkEmail({
            recipients: recipientEmails,
            subject,
            htmlContent: `<div style="font-family: 'Source Sans 3', Arial, sans-serif; line-height: 1.6; color: #1a2744;">${htmlContent}</div>`,
            sender: { name: 'Institut Rousseau', email: 'contact@institut-rousseau.fr' },
          });
          toast(`Email envoyé à ${recipientEmails.length} destinataire${recipientEmails.length > 1 ? 's' : ''}`);
        } else {
          await new Promise(r => setTimeout(r, 1500));
          toast(`Email envoyé à ${recipientCount} destinataire${recipientCount > 1 ? 's' : ''} (simulation)`);
        }
      } else if (channel === 'telegram-channel') {
        if (services?.telegram) {
          await sendChannelMessage(body);
          toast('Message publié sur le canal Telegram');
        } else {
          await new Promise(r => setTimeout(r, 1000));
          toast('Message publié sur le canal Telegram (simulation)');
        }
      } else if (channel === 'telegram-private') {
        if (services?.telegram) {
          await sendMessage(null, body);
          toast('Notification Telegram envoyée');
        } else {
          await new Promise(r => setTimeout(r, 1000));
          toast('Notification Telegram envoyée (simulation)');
        }
      }

      setHistory(prev => {
        const entry = {
          id: Date.now(),
          channel,
          subject: channel === 'email' ? subject : '',
          body: body.slice(0, 100),
          recipients: channel === 'email' ? recipientCount : 1,
          date: new Date().toISOString(),
          status: 'sent',
        };
        const next = [entry, ...prev].slice(0, 100);
        saveLocal(LS_KEYS.messageHistory, next);
        return next;
      });

      setSubject('');
      setBody('');
      setTemplateKey('');
    } catch (err) {
      toast(`Erreur d'envoi : ${err.message}`, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Messagerie</h1>
          <p className="page-header-sub">Envois ciblés par email et Telegram</p>
        </div>
        <div className="flex-center gap-8">
          <ServiceBadge service="brevo" />
        </div>
      </div>

      <div className="page-body">
        {/* Canal d'envoi */}
        <div className="msg-channel-bar">
          {[
            ['email', 'Email (Brevo)', COLORS.sky, services?.brevo],
            ['telegram-channel', 'Canal Telegram', COLORS.green, services?.telegram],
            ['telegram-private', 'Notification privée', COLORS.ochre, services?.telegram],
          ].map(([key, label, color, connected]) => (
            <button
              key={key}
              className={`msg-channel-btn ${channel === key ? 'active' : ''}`}
              style={channel === key ? { '--accent': color } : {}}
              onClick={() => setChannel(key)}
            >
              <span className="msg-channel-icon">
                {key === 'email' ? '✉️' : key === 'telegram-channel' ? '📢' : '🔔'}
              </span>
              <span>{label}</span>
              {connected && <span className="msg-channel-dot" />}
            </button>
          ))}
        </div>

        <div className="msg-layout">
          {/* Panneau gauche — Destinataires & Templates */}
          <aside className="msg-sidebar">
            {channel === 'email' && (
              <>
                {/* Destinataires */}
                <div className="msg-panel">
                  <div className="msg-panel-title">Destinataires</div>
                  <div className="msg-segment-list">
                    {segments.map(({ key, label, count, icon }) => (
                      <div
                        key={key}
                        className={`msg-segment ${selectedSegments.includes(key) ? 'selected' : ''}`}
                        onClick={() => toggleSegment(key)}
                      >
                        <span className="msg-segment-check">
                          {selectedSegments.includes(key) ? '✓' : ''}
                        </span>
                        <span className="msg-segment-icon">{icon}</span>
                        <span className="msg-segment-label">{label}</span>
                        <span className="msg-segment-count">{count}</span>
                      </div>
                    ))}
                  </div>
                  {recipientCount > 0 && (
                    <div className="msg-recipient-summary">
                      {recipientCount} destinataire{recipientCount > 1 ? 's' : ''} sélectionné{recipientCount > 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                {/* Templates */}
                <div className="msg-panel">
                  <div className="msg-panel-title">Templates</div>
                  <div className="msg-template-list">
                    <button
                      className={`msg-template-btn ${!templateKey ? 'active' : ''}`}
                      onClick={() => { setTemplateKey(''); setSubject(''); setBody(''); }}
                    >
                      Message libre
                    </button>
                    {Object.entries(EMAIL_TEMPLATES).map(([key, tpl]) => (
                      <button
                        key={key}
                        className={`msg-template-btn ${templateKey === key ? 'active' : ''}`}
                        onClick={() => loadTemplate(key)}
                      >
                        {tpl.name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {channel !== 'email' && (
              <div className="msg-panel">
                <div className="msg-panel-title">
                  {channel === 'telegram-channel' ? 'Canal public' : 'Notification admin'}
                </div>
                <p className="msg-panel-desc">
                  {channel === 'telegram-channel'
                    ? 'Le message sera publié sur le canal public Telegram de l\'Institut Rousseau.'
                    : 'La notification sera envoyée au chat privé de l\'admin configuré dans les paramètres.'}
                </p>
                {!services?.telegram && (
                  <div className="msg-panel-warning">
                    Telegram non connecté — les envois seront simulés
                  </div>
                )}
              </div>
            )}

            {/* Boîte de réception Telegram */}
            {(channel === 'telegram-channel' || channel === 'telegram-private') && services?.telegram && (
              <div className="msg-panel">
                <div className="msg-panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Reçus sur le bot</span>
                  <button className="btn btn-outline btn-sm" onClick={refreshInbox} disabled={inboxLoading}>
                    {inboxLoading ? '…' : '↻'}
                  </button>
                </div>
                {inbox.length === 0 && !inboxLoading && (
                  <p className="msg-panel-desc">Aucun message reçu.</p>
                )}
                {inbox.slice(0, 8).map(m => (
                  <div key={m.id} className="msg-history-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                      <span className={`badge ${m.type === 'channel' ? 'badge-green' : 'badge-sky'}`}>{m.from}</span>
                      <span className="msg-history-meta" style={{ marginLeft: 'auto' }}>
                        {m.date ? new Date(m.date).toLocaleString('fr-FR') : ''}
                      </span>
                    </div>
                    {m.text && <div style={{ fontSize: 13, color: 'var(--text)' }}>{m.text.slice(0, 120)}{m.text.length > 120 ? '…' : ''}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Historique */}
            {history.length > 0 && (
              <div className="msg-panel">
                <div className="msg-panel-title">Historique récent</div>
                {history.slice(0, 5).map(h => (
                  <div key={h.id} className="msg-history-item">
                    <span className={`badge ${h.channel === 'email' ? 'badge-sky' : 'badge-green'}`}>
                      {h.channel === 'email' ? 'Email' : 'Telegram'}
                    </span>
                    <span className="msg-history-meta">
                      {h.channel === 'email' ? `${h.recipients} dest. · ` : ''}
                      {new Date(h.date).toLocaleString('fr-FR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </aside>

          {/* Éditeur */}
          <div className="msg-editor">
            <div className="msg-editor-header">
              {channel === 'email' ? 'Composer l\'email' : 'Composer le message'}
            </div>

            {channel === 'email' && (
              <div className="msg-field">
                <div className="msg-field-label">Objet</div>
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Objet de l'email" />
              </div>
            )}

            <div className="msg-field">
              <div className="msg-field-label">Message</div>
              <textarea
                rows={channel === 'email' ? 14 : 6}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder={channel === 'telegram-channel' ? 'Max 280 caractères recommandés + lien' : 'Votre message…'}
              />
              {channel === 'telegram-channel' && (
                <div className="msg-char-count" data-over={body.length > 280 ? 'true' : undefined}>
                  {body.length} / 280
                </div>
              )}
            </div>

            {/* Test send : envoie une seule fois pour valider le rendu avant
                d'envoyer à toute la cible. Telegram redirige vers le chat privé. */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                padding: 12,
                background: 'var(--cream)',
                borderRadius: 8,
                marginTop: 12,
                border: '1px solid var(--border)',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-light)' }}>🧪 Test :</span>
              {channel === 'email' ? (
                <input
                  type="email"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  placeholder="adresse@exemple.com"
                  style={{ flex: 1, minWidth: 200, fontSize: 13 }}
                />
              ) : (
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-light)' }}>
                  → envoyé sur le chat privé admin (pas sur le canal public)
                </span>
              )}
              <button
                className="btn btn-outline btn-sm"
                onClick={handleTestSend}
                disabled={testing || !body.trim()}
                title="Envoie un seul message pour tester le rendu"
              >
                {testing ? 'Envoi test…' : 'Envoyer un test'}
              </button>
            </div>

            <div className="msg-editor-actions">
              <button className="btn btn-outline" onClick={() => setShowPreview(true)} disabled={!body.trim()}>
                Prévisualiser
              </button>
              <button className="btn btn-primary btn-lg" onClick={handleSend} disabled={sending || !body.trim()}>
                {sending ? 'Envoi en cours…' : channel === 'email'
                  ? `Envoyer à ${recipientCount} contact${recipientCount > 1 ? 's' : ''}`
                  : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>

        {/* Prévisualisation */}
        {showPreview && (
          <Modal title="Prévisualisation" onClose={() => setShowPreview(false)}>
            {channel === 'email' ? (
              <>
                <p style={{ fontWeight: 600, marginBottom: 8 }}>Objet : {subject}</p>
                <div style={{ padding: 20, background: '#f9f9f7', borderRadius: 8, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7 }}>
                  {body}
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 10 }}>
                  Sera envoyé à {recipientCount} destinataire{recipientCount > 1 ? 's' : ''}
                  {!services?.brevo && ' (simulation — Brevo non connecté)'}
                </p>
              </>
            ) : (
              <div style={{ maxWidth: 400, background: '#E3F2FD', borderRadius: '12px 12px 12px 0', padding: '12px 16px', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {body}
              </div>
            )}
          </Modal>
        )}
      </div>
    </>
  );
}
