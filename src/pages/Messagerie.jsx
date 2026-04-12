import { useState } from 'react';
import Modal from '../components/shared/Modal';
import ServiceBadge from '../components/shared/ServiceBadge';
import { EMAIL_TEMPLATES, COLORS } from '../utils/constants';
import { sendBulkEmail } from '../services/brevo';
import { sendMessage, sendChannelMessage } from '../services/telegram';

export default function Messagerie({ adherents, subscribers, services, toast }) {
  const [channel, setChannel] = useState('email');
  const [templateKey, setTemplateKey] = useState('');
  const [recipients, setRecipients] = useState('all_subscribers');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [history, setHistory] = useState([]);

  const loadTemplate = (key) => {
    setTemplateKey(key);
    const tpl = EMAIL_TEMPLATES[key];
    if (tpl) {
      setSubject(tpl.subject);
      setBody(tpl.body);
    }
  };

  const getRecipientList = () => {
    if (recipients === 'all_subscribers') return subscribers.filter(s => s.status === 'added' || s.status === 'abonn\u00e9');
    if (recipients === 'all_adherents') return adherents.filter(a => a.status === 'actif' || a.status === 'Pay\u00e9');
    if (recipients === 'all') {
      const seen = new Set();
      const all = [];
      for (const s of subscribers.filter(s => s.status === 'added' || s.status === 'abonn\u00e9')) {
        if (!seen.has(s.email)) { seen.add(s.email); all.push(s); }
      }
      for (const a of adherents) {
        if (!seen.has(a.email)) { seen.add(a.email); all.push(a); }
      }
      return all;
    }
    return [];
  };

  const getRecipientCount = () => getRecipientList().length;

  const handleSend = async () => {
    if (!body.trim()) return toast('Le message est vide', 'error');
    if (channel === 'email' && !subject.trim()) return toast('L\u2019objet est requis', 'error');

    setSending(true);
    try {
      if (channel === 'email') {
        if (services?.brevo) {
          const recipientEmails = getRecipientList().map(r => r.email);
          const htmlContent = body.replace(/\n/g, '<br>');
          await sendBulkEmail({
            recipients: recipientEmails,
            subject,
            htmlContent: `<div style="font-family: 'Source Sans 3', Arial, sans-serif; line-height: 1.6; color: #1a2744;">${htmlContent}</div>`,
            sender: { name: 'Institut Rousseau', email: 'contact@institut-rousseau.fr' },
          });
          toast(`Email envoy\u00e9 \u00e0 ${recipientEmails.length} destinataire${recipientEmails.length > 1 ? 's' : ''}`);
        } else {
          await new Promise(r => setTimeout(r, 1500));
          toast(`Email envoy\u00e9 \u00e0 ${getRecipientCount()} destinataire${getRecipientCount() > 1 ? 's' : ''} (simulation)`);
        }
      } else if (channel === 'telegram-channel') {
        if (services?.telegram) {
          await sendChannelMessage(body);
          toast('Message publi\u00e9 sur le canal Telegram');
        } else {
          await new Promise(r => setTimeout(r, 1000));
          toast('Message publi\u00e9 sur le canal Telegram (simulation)');
        }
      } else if (channel === 'telegram-private') {
        if (services?.telegram) {
          await sendMessage(null, body);
          toast('Notification Telegram envoy\u00e9e');
        } else {
          await new Promise(r => setTimeout(r, 1000));
          toast('Notification Telegram envoy\u00e9e (simulation)');
        }
      }

      // Ajouter \u00e0 l'historique
      setHistory(prev => [{
        id: Date.now(),
        channel,
        subject: channel === 'email' ? subject : '',
        body: body.slice(0, 100),
        recipients: channel === 'email' ? getRecipientCount() : 1,
        date: new Date().toISOString(),
        status: 'sent',
      }, ...prev]);

      setSubject('');
      setBody('');
      setTemplateKey('');
    } catch (err) {
      toast(`Erreur d\u2019envoi\u00a0: ${err.message}`, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Messagerie</h1>
          <p className="page-header-sub">Envois cibl\u00e9s par email et Telegram</p>
        </div>
        <div className="flex-center gap-8">
          <ServiceBadge service="brevo" />
        </div>
      </div>

      <div className="page-body">
        {/* Canal */}
        <div className="card mb-24">
          <h3 style={{ fontSize: 15, marginBottom: 14 }}>Canal d&rsquo;envoi</h3>
          <div className="flex-wrap gap-8">
            {[
              ['email', '\u2709\ufe0f Email (Brevo)', COLORS.sky, services?.brevo],
              ['telegram-channel', '\ud83d\udce2 Canal Telegram', COLORS.green, services?.telegram],
              ['telegram-private', '\ud83d\udd14 Notification priv\u00e9e', COLORS.ochre, services?.telegram],
            ].map(([key, label, color, connected]) => (
              <button
                key={key}
                className={`btn ${channel === key ? 'btn-primary' : 'btn-outline'}`}
                style={channel === key ? { background: color } : {}}
                onClick={() => setChannel(key)}
              >
                {label}
                {connected && <span className="status-dot green" style={{ marginLeft: 6 }} />}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
          {/* Panneau gauche */}
          <div>
            {channel === 'email' && (
              <>
                <div className="card mb-16">
                  <h3 style={{ fontSize: 15, marginBottom: 12 }}>Destinataires</h3>
                  {[
                    ['all_subscribers', `Abonn\u00e9s newsletter (${subscribers.filter(s => s.status === 'added' || s.status === 'abonn\u00e9').length})`],
                    ['all_adherents', `Adh\u00e9rents actifs (${adherents.filter(a => a.status === 'actif' || a.status === 'Pay\u00e9').length})`],
                    ['donateurs', 'Donateurs'],
                    ['presse', 'Contacts presse'],
                    ['auteurs', 'Auteurs'],
                    ['all', 'Tous les contacts'],
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', textTransform: 'none', fontWeight: 400, fontSize: 14 }}>
                      <input type="radio" name="recipients" value={key} checked={recipients === key} onChange={() => setRecipients(key)} />
                      {label}
                    </label>
                  ))}
                </div>

                <div className="card">
                  <h3 style={{ fontSize: 15, marginBottom: 12 }}>Templates</h3>
                  {Object.entries(EMAIL_TEMPLATES).map(([key, tpl]) => (
                    <button
                      key={key}
                      className={`btn ${templateKey === key ? 'btn-sky' : 'btn-outline'} btn-sm`}
                      style={{ width: '100%', marginBottom: 6, justifyContent: 'flex-start' }}
                      onClick={() => loadTemplate(key)}
                    >
                      {tpl.name}
                    </button>
                  ))}
                  <button
                    className={`btn ${!templateKey ? 'btn-sky' : 'btn-outline'} btn-sm`}
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                    onClick={() => { setTemplateKey(''); setSubject(''); setBody(''); }}
                  >
                    Message libre
                  </button>
                </div>
              </>
            )}

            {channel !== 'email' && (
              <div className="card">
                <p style={{ fontSize: 14, color: 'var(--text-light)', lineHeight: 1.6 }}>
                  {channel === 'telegram-channel'
                    ? 'Le message sera publi\u00e9 sur le canal public Telegram de l\u2019Institut Rousseau.'
                    : 'La notification sera envoy\u00e9e au chat priv\u00e9 de l\u2019admin configur\u00e9 dans les param\u00e8tres.'}
                </p>
                {!services?.telegram && (
                  <p className="alert-banner alert-warning" style={{ marginTop: 12 }}>
                    Telegram non connect\u00e9 \u2014 les envois seront simul\u00e9s
                  </p>
                )}
              </div>
            )}

            {/* Historique */}
            {history.length > 0 && (
              <div className="card" style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: 15, marginBottom: 12 }}>Historique r\u00e9cent</h3>
                {history.slice(0, 5).map(h => (
                  <div key={h.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <span className={`badge ${h.channel === 'email' ? 'badge-sky' : 'badge-green'}`} style={{ marginRight: 8 }}>
                      {h.channel === 'email' ? 'Email' : 'Telegram'}
                    </span>
                    <span style={{ color: 'var(--text-light)' }}>
                      {h.channel === 'email' ? `${h.recipients} dest.` : ''} {new Date(h.date).toLocaleString('fr-FR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* \u00c9diteur */}
          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 14 }}>
              {channel === 'email' ? 'Composer l\u2019email' : 'Composer le message'}
            </h3>

            {channel === 'email' && (
              <div style={{ marginBottom: 12 }}>
                <label>Objet</label>
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Objet de l\u2019email" />
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label>Message</label>
              <textarea
                rows={channel === 'email' ? 12 : 6}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder={channel === 'telegram-channel' ? 'Max 280 caract\u00e8res recommand\u00e9s + lien' : 'Votre message\u2026'}
              />
              {channel === 'telegram-channel' && (
                <p style={{ fontSize: 12, color: body.length > 280 ? 'var(--terra)' : 'var(--text-light)', marginTop: 4 }}>
                  {body.length} / 280 caract\u00e8res
                </p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn btn-outline" onClick={() => setShowPreview(true)} disabled={!body.trim()}>
                Pr\u00e9visualiser
              </button>
              <button className="btn btn-primary btn-lg" onClick={handleSend} disabled={sending || !body.trim()}>
                {sending ? 'Envoi en cours\u2026' : `Envoyer${channel === 'email' ? ` \u00e0 ${getRecipientCount()} contact${getRecipientCount() > 1 ? 's' : ''}` : ''}`}
              </button>
            </div>
          </div>
        </div>

        {/* Pr\u00e9visualisation */}
        {showPreview && (
          <Modal title="Pr\u00e9visualisation" onClose={() => setShowPreview(false)}>
            {channel === 'email' ? (
              <>
                <p style={{ fontWeight: 600, marginBottom: 8 }}>Objet\u00a0: {subject}</p>
                <div style={{ padding: 20, background: '#f9f9f7', borderRadius: 8, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7 }}>
                  {body}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 8 }}>
                  Sera envoy\u00e9 \u00e0 {getRecipientCount()} destinataire{getRecipientCount() > 1 ? 's' : ''}
                  {!services?.brevo && ' (simulation \u2014 Brevo non connect\u00e9)'}
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
