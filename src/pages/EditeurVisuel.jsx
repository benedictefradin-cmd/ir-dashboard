import { useState, useEffect, useRef, useMemo } from 'react';
import { fetchI18n, saveSiteData } from '../services/siteData';
import { hasGitHub } from '../services/github';
import { DEFAULT_WORKER_URL } from '../utils/constants';
import { loadLocal } from '../utils/localStorage';
import { LS_KEYS } from '../utils/constants';
import ServiceBadge from '../components/shared/ServiceBadge';

// Liste des pages éditables (correspond aux fichiers .html du site).
const PAGES = [
  { slug: 'index',              label: 'Accueil',               url: 'index.html' },
  { slug: 'le-projet',          label: 'Le projet',             url: 'le-projet.html' },
  { slug: 'road-to-net-zero',   label: 'Road to Net Zero',      url: 'road-to-net-zero.html' },
  { slug: 'nos-propositions',   label: 'Nos propositions',      url: 'nos-propositions.html' },
  { slug: 'rapport-activite',   label: "Rapport d'activité",    url: 'rapport-activite.html' },
  { slug: 'publications',       label: 'Publications',          url: 'publications.html' },
  { slug: 'points-de-vue',      label: 'Points de vue',         url: 'points-de-vue.html' },
  { slug: 'editos',             label: 'Éditoriaux',            url: 'editos.html' },
  { slug: 'librairie',          label: 'En librairie',          url: 'librairie.html' },
  { slug: 'fiches-thematiques', label: 'Fiches thématiques',    url: 'fiches-thematiques.html' },
  { slug: 'evenements',         label: 'Événements',            url: 'evenements.html' },
  { slug: 'equipe',             label: 'Équipe',                url: 'equipe.html' },
  { slug: 'auteurs',            label: 'Auteurs',               url: 'auteurs.html' },
  { slug: 'partenaires',        label: 'Partenaires',           url: 'partenaires.html' },
  { slug: 'presse',             label: 'Presse',                url: 'presse.html' },
  { slug: 'newsletter',         label: 'Newsletter',            url: 'newsletter.html' },
  { slug: 'adhesion',           label: 'Adhésion',              url: 'adhesion.html' },
  { slug: 'don',                label: 'Faire un don',          url: 'don.html' },
  { slug: 'contact',            label: 'Contact',               url: 'contact.html' },
  { slug: 'mentions-legales',   label: 'Mentions légales',      url: 'mentions-legales.html' },
  { slug: 'confidentialite',    label: 'Confidentialité',       url: 'confidentialite.html' },
  { slug: 'rgpd',               label: 'RGPD',                  url: 'rgpd.html' },
  { slug: '404',                label: 'Page 404',              url: '404.html' },
];

const LANGS = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
];

function getWorkerUrl() {
  return loadLocal(LS_KEYS.workerUrl, null) || DEFAULT_WORKER_URL || '';
}

export default function EditeurVisuel({ toast }) {
  const [pageSlug, setPageSlug] = useState(PAGES[0].slug);
  const [i18n, setI18n] = useState({ translations: {}, pageTitles: {} });
  const [pendingEdits, setPendingEdits] = useState({}); // { 'fr|nav.publications': 'new value', ... }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState(null); // { key, html, text, tag }
  const [showAllLangs, setShowAllLangs] = useState(false);
  const [iframeBust, setIframeBust] = useState(0);

  const iframeRef = useRef(null);
  const pendingEditsRef = useRef(pendingEdits);
  pendingEditsRef.current = pendingEdits;
  const workerUrl = useMemo(() => getWorkerUrl().replace(/\/+$/, ''), []);

  const page = PAGES.find(p => p.slug === pageSlug) || PAGES[0];
  const iframeSrc = workerUrl
    ? `${workerUrl}/site-proxy/${page.url}?edit=1&v=${iframeBust}`
    : '';

  // Chargement initial du dictionnaire i18n
  useEffect(() => {
    if (!hasGitHub()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchI18n().then(({ data }) => {
      if (cancelled) return;
      setI18n({
        translations: data.translations || {},
        pageTitles: data.pageTitles || {},
      });
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // Réception des messages depuis l'iframe (clic sur un élément éditable)
  useEffect(() => {
    function onMessage(e) {
      const msg = e.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'ir-edit-click') {
        setSelection({
          key: msg.key,
          html: msg.html,
          text: msg.text,
          tag: msg.tag,
        });
      } else if (msg.type === 'ir-edit-ready') {
        // Iframe (re)chargée — re-pousse tous les pending edits pour
        // l'aperçu live, sinon on perdrait les modifs non publiées.
        const iframe = iframeRef.current?.contentWindow;
        if (iframe) {
          Object.entries(pendingEditsRef.current).forEach(([k, value]) => {
            const sep = k.indexOf('|');
            iframe.postMessage({
              type: 'ir-apply-live',
              lang: k.slice(0, sep),
              key: k.slice(sep + 1),
              value,
            }, '*');
          });
        }
      } else if (msg.type === 'ir-navigate-request') {
        toast?.(`Navigation bloquée en mode édition : ${msg.href}`, 'info');
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [toast]);

  // Helpers
  const editKey = (lang, key) => `${lang}|${key}`;

  const getValue = (lang, key) => {
    const editKeyStr = editKey(lang, key);
    if (Object.prototype.hasOwnProperty.call(pendingEdits, editKeyStr)) {
      return pendingEdits[editKeyStr];
    }
    return (i18n.translations[key] && i18n.translations[key][lang]) || '';
  };

  const setValue = (lang, key, value) => {
    setPendingEdits(prev => ({ ...prev, [editKey(lang, key)]: value }));
    // Pousse la valeur dans l'iframe pour aperçu immédiat
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'ir-apply-live', key, lang, value },
      '*'
    );
  };

  const revertValue = (lang, key) => {
    setPendingEdits(prev => {
      const next = { ...prev };
      delete next[editKey(lang, key)];
      return next;
    });
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'ir-revert-live', key, lang },
      '*'
    );
  };

  const pendingCount = Object.keys(pendingEdits).length;

  // Rafraîchit les traductions dans l'iframe sans recharger la page entière
  const reloadIframeTranslations = () => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'ir-reload-i18n' }, '*');
  };

  // Apply : pousse les pendingEdits dans i18n (en mémoire) et rafraîchit l'iframe
  const applyPending = async () => {
    if (pendingCount === 0) return;
    const nextTranslations = { ...i18n.translations };
    Object.entries(pendingEdits).forEach(([k, value]) => {
      const sep = k.indexOf('|');
      const lang = k.slice(0, sep);
      const key = k.slice(sep + 1);
      if (!nextTranslations[key]) nextTranslations[key] = {};
      else nextTranslations[key] = { ...nextTranslations[key] };
      nextTranslations[key][lang] = value;
    });
    setI18n(prev => ({ ...prev, translations: nextTranslations }));
    setPendingEdits({});
    // Note : l'iframe relit toujours data/i18n.json depuis le serveur (sources GitHub),
    // donc pour voir les changements en preview il faut soit publier, soit que le
    // back-office serve les changements pending. On force un reload de l'iframe pour
    // qu'elle re-fetche (et idéalement on pourrait servir les pending depuis Vite —
    // amélioration future).
    return nextTranslations;
  };

  const publish = async () => {
    if (!hasGitHub()) {
      toast?.('GitHub non configuré', 'error');
      return;
    }
    setSaving(true);
    try {
      const nextTranslations = await applyPending();
      const payload = {
        translations: nextTranslations || i18n.translations,
        pageTitles: i18n.pageTitles,
      };
      await saveSiteData('i18n', payload, 'Mise à jour i18n depuis l\'éditeur visuel');
      toast?.('Modifications publiées', 'success');
      setIframeBust(b => b + 1); // force reload pour fetch le nouveau JSON
    } catch (err) {
      toast?.(`Erreur publication : ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Sauvegarde locale d'une édition + reload iframe trad
  const applySingleEdit = (lang, key) => {
    const value = pendingEdits[editKey(lang, key)];
    if (value === undefined) return;
    setI18n(prev => {
      const nextTrans = { ...prev.translations };
      if (!nextTrans[key]) nextTrans[key] = {};
      else nextTrans[key] = { ...nextTrans[key] };
      nextTrans[key][lang] = value;
      return { ...prev, translations: nextTrans };
    });
    setPendingEdits(prev => {
      const next = { ...prev };
      delete next[editKey(lang, key)];
      return next;
    });
    // Pour vraiment voir le changement dans l'iframe, il faut publier (l'iframe lit
    // depuis GitHub via Vercel, pas depuis le state du dashboard). On signale juste
    // visuellement que le changement est en attente de publication.
  };

  // ────────────────────────────────────────────
  // Rendu
  // ────────────────────────────────────────────
  if (!workerUrl) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1>Éditeur visuel</h1>
            <p className="page-header-sub">Édition in-page des textes du site</p>
          </div>
        </div>
        <div className="page-body">
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 8 }}>Worker non configuré</h3>
            <p style={{ color: 'var(--text-light)', fontSize: 14, lineHeight: 1.6 }}>
              L'éditeur visuel passe par le Cloudflare Worker pour iframe-er le
              site (qui sinon refuse l'iframe via <code>X-Frame-Options</code>).
              Allez dans <strong>Config</strong> pour renseigner l'URL du Worker,
              ou définissez <code>VITE_WORKER_URL</code>.
            </p>
          </div>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <div className="page-header"><div><h1>Éditeur visuel</h1></div></div>
        <div className="page-body"><div className="card" style={{ padding: 24 }}>Chargement du dictionnaire i18n…</div></div>
      </>
    );
  }

  return (
    <>
      <div className="page-header" style={{ alignItems: 'center' }}>
        <div>
          <h1>Éditeur visuel</h1>
          <p className="page-header-sub">
            Cliquez sur n'importe quel texte du site pour l'éditer
          </p>
        </div>
        <div className="flex-center gap-8">
          <ServiceBadge service="github" />
          {pendingCount > 0 && (
            <span className="badge badge-amber" title="Modifications non publiées">
              {pendingCount} en attente
            </span>
          )}
          <button
            className="btn btn-green"
            onClick={publish}
            disabled={saving || pendingCount === 0}
          >
            {saving ? 'Publication…' : `Publier${pendingCount ? ` (${pendingCount})` : ''}`}
          </button>
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', gap: 16, height: 'calc(100vh - 180px)', minHeight: 600 }}>

        {/* Iframe + sélecteur de page */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div className="flex-wrap gap-8 mb-8" style={{ alignItems: 'center' }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Page :</label>
            <select
              value={pageSlug}
              onChange={(e) => { setPageSlug(e.target.value); setSelection(null); }}
              style={{ minWidth: 220 }}
            >
              {PAGES.map(p => <option key={p.slug} value={p.slug}>{p.label}</option>)}
            </select>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setIframeBust(b => b + 1)}
              title="Recharger l'iframe"
            >
              ↻ Recharger
            </button>
            <a
              href={`https://institut-rousseau.fr/${page.url.replace(/\.html$/, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm"
            >
              Voir sur le site ↗
            </a>
          </div>

          <iframe
            ref={iframeRef}
            key={iframeBust}
            src={iframeSrc}
            title={`Aperçu ${page.label}`}
            style={{
              flex: 1,
              width: '100%',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'white',
            }}
          />
        </div>

        {/* Panneau d'édition */}
        <div style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!selection ? (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, marginBottom: 8 }}>Mode édition</h3>
              <p style={{ fontSize: 13, color: 'var(--text-light)', lineHeight: 1.6 }}>
                Survolez un texte dans l'aperçu — un cadre orange apparaît sur les éléments
                modifiables. Cliquez pour ouvrir l'éditeur ici.
              </p>
              <ul style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 12, paddingLeft: 16, lineHeight: 1.7 }}>
                <li>Les modifications sont en attente jusqu'à la publication.</li>
                <li>Publier crée un commit GitHub et redéploie le site.</li>
                <li>Pour voir les changements dans l'aperçu, publiez puis rechargez.</li>
              </ul>
            </div>
          ) : (
            <SelectionEditor
              selection={selection}
              i18n={i18n}
              pendingEdits={pendingEdits}
              showAllLangs={showAllLangs}
              setShowAllLangs={setShowAllLangs}
              getValue={getValue}
              setValue={setValue}
              revertValue={revertValue}
              applySingleEdit={applySingleEdit}
              onClose={() => {
                setSelection(null);
                iframeRef.current?.contentWindow?.postMessage({ type: 'ir-clear-selection' }, '*');
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ─── Sous-composants ────────────────────────────────────

function SelectionEditor({
  selection, i18n, pendingEdits, showAllLangs, setShowAllLangs,
  getValue, setValue, revertValue, applySingleEdit, onClose,
}) {
  const { key, tag, html, text } = selection;
  const entry = i18n.translations[key];
  const exists = !!entry;
  const isHtml = (html || '').includes('<');

  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Élément sélectionné
          </div>
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 13, fontWeight: 600, marginTop: 2, wordBreak: 'break-all' }}>
            {key}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>
            &lt;{tag}&gt;{exists ? '' : ' · clé inconnue'}
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={onClose} title="Fermer">×</button>
      </div>

      {!exists && (
        <div className="alert alert-warning" style={{ fontSize: 12 }}>
          Cette clé n'existe pas dans <code>i18n.json</code>. Le site affiche le texte
          inline du HTML. Modifier ici la créera dans le dictionnaire.
        </div>
      )}

      <LangFieldGroup
        lang="fr"
        showAlways
        keyName={key}
        getValue={getValue}
        setValue={setValue}
        revertValue={revertValue}
        applySingleEdit={applySingleEdit}
        pendingEdits={pendingEdits}
        baseValue={entry?.fr}
      />

      <button
        className="btn btn-outline btn-sm"
        onClick={() => setShowAllLangs(v => !v)}
        style={{ alignSelf: 'flex-start' }}
      >
        {showAllLangs ? '− Masquer les autres langues' : '+ Autres langues (4)'}
      </button>

      {showAllLangs && LANGS.filter(l => l.code !== 'fr').map(l => (
        <LangFieldGroup
          key={l.code}
          lang={l.code}
          label={l.label}
          keyName={key}
          getValue={getValue}
          setValue={setValue}
          revertValue={revertValue}
          applySingleEdit={applySingleEdit}
          pendingEdits={pendingEdits}
          baseValue={entry?.[l.code]}
        />
      ))}

      <details style={{ fontSize: 11, color: 'var(--text-light)' }}>
        <summary style={{ cursor: 'pointer' }}>Texte affiché actuellement</summary>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 8, padding: 8, background: 'var(--cream)', borderRadius: 4, maxHeight: 120, overflow: 'auto' }}>
          {isHtml ? html : text}
        </pre>
      </details>
    </div>
  );
}

function LangFieldGroup({
  lang, label, keyName, getValue, setValue, revertValue, applySingleEdit,
  pendingEdits, baseValue, showAlways,
}) {
  const value = getValue(lang, keyName);
  const editKeyStr = `${lang}|${keyName}`;
  const isPending = Object.prototype.hasOwnProperty.call(pendingEdits, editKeyStr);
  const containsHtml = (value || '').includes('<');
  const isLong = (value || '').length > 80 || containsHtml;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>
          {label || lang.toUpperCase()}
          {isPending && <span style={{ color: 'var(--warning, #c97e1f)', marginLeft: 6 }}>● modifié</span>}
        </label>
        <div className="flex-center gap-8" style={{ fontSize: 11 }}>
          {isPending && (
            <button
              className="btn btn-outline btn-sm"
              style={{ fontSize: 11, padding: '2px 8px' }}
              onClick={() => revertValue(lang, keyName)}
              title="Annuler la modification"
            >
              ↺
            </button>
          )}
        </div>
      </div>
      {isLong ? (
        <textarea
          value={value}
          rows={Math.min(8, Math.max(2, Math.ceil((value || '').length / 50)))}
          onChange={(e) => setValue(lang, keyName, e.target.value)}
          style={{ fontFamily: containsHtml ? 'var(--font-mono, monospace)' : 'inherit', fontSize: 13 }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(lang, keyName, e.target.value)}
          style={{ fontSize: 13 }}
        />
      )}
      {containsHtml && (
        <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 2 }}>
          Contient du HTML — éditez avec précaution (balises et attributs sont conservés tels quels).
        </div>
      )}
    </div>
  );
}
