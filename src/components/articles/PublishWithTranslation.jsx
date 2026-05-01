import { useState, useEffect } from 'react';
import Modal from '../shared/Modal';
import { TARGET_LANGUAGES } from '../../utils/constants';
import { translateArticle } from '../../services/translate';
import { checkHealth } from '../../services/api';
import { useConfirm } from '../shared/ConfirmDialog';
import RichEditor from '../editor/RichEditor';

/**
 * Modal de publication multilingue.
 * - Si le Worker expose la traduction (DEEPL ou ANTHROPIC) → traduction auto.
 * - Sinon → mode manuel : champs vides par langue, l'utilisatrice traduit ce qu'elle veut.
 */
export default function PublishWithTranslation({ article, onPublished, onClose, toast }) {
  const confirm = useConfirm();
  const [translations, setTranslations] = useState(() => {
    const initial = {};
    TARGET_LANGUAGES.forEach(lang => {
      const existing = article[lang.code];
      initial[lang.code] = {
        status: existing?.title && existing?.content ? 'done' : 'pending',
        title: existing?.title || '',
        summary: existing?.summary || '',
        content: existing?.content || '',
        error: null,
      };
    });
    return initial;
  });

  const [publishing, setPublishing] = useState(false);
  // null = en cours de check ; true = manuel ; false = auto
  const [translateDisabled, setTranslateDisabled] = useState(null);
  const [expanded, setExpanded] = useState({});

  const isFilled = (t) => !!(t.title?.trim() && t.content?.trim());
  const isPartial = (t) => !isFilled(t) && !!(t.title?.trim() || t.summary?.trim() || t.content?.trim());

  const markAllManual = () => {
    setTranslations(prev => {
      const next = { ...prev };
      TARGET_LANGUAGES.forEach(l => {
        if (next[l.code].status === 'pending') {
          next[l.code] = { ...next[l.code], status: 'manual' };
        }
      });
      return next;
    });
  };

  const launchTranslation = (langCode) => {
    setTranslations(prev => ({
      ...prev,
      [langCode]: { ...prev[langCode], status: 'translating', error: null },
    }));
    translateArticle(
      { title: article.fr.title, summary: article.fr.summary, content: article.fr.content },
      'fr',
      langCode
    )
      .then(result => {
        setTranslations(prev => ({
          ...prev,
          [langCode]: {
            status: 'done',
            title: result.title || '',
            summary: result.summary || '',
            content: result.content || '',
            error: null,
          },
        }));
      })
      .catch(err => {
        const isConfigMissing = /non configur/i.test(err.message);
        if (isConfigMissing) {
          setTranslateDisabled(true);
          markAllManual();
          return;
        }
        setTranslations(prev => ({
          ...prev,
          [langCode]: { ...prev[langCode], status: 'error', error: err.message },
        }));
      });
  };

  // Health check, puis lancement (ou bascule en manuel)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let available = false;
      try {
        const health = await checkHealth();
        available = !!health?.services?.translate;
      } catch {
        available = false;
      }
      if (cancelled) return;
      setTranslateDisabled(!available);
      if (!available) {
        markAllManual();
        return;
      }
      TARGET_LANGUAGES
        .filter(l => translations[l.code].status === 'pending')
        .forEach(l => launchTranslation(l.code));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateField = (langCode, field, value) => {
    setTranslations(prev => ({
      ...prev,
      [langCode]: { ...prev[langCode], [field]: value },
    }));
  };

  const copyFromFr = (langCode) => {
    setTranslations(prev => ({
      ...prev,
      [langCode]: {
        ...prev[langCode],
        title: article.fr.title || '',
        summary: article.fr.summary || '',
        content: article.fr.content || '',
      },
    }));
    setExpanded(prev => ({ ...prev, [langCode]: true }));
    toast?.('Texte FR copié — à toi de le traduire', 'info');
  };

  const clearLang = (langCode) => {
    setTranslations(prev => ({
      ...prev,
      [langCode]: { ...prev[langCode], title: '', summary: '', content: '' },
    }));
  };

  const handlePublish = async () => {
    if (!translateDisabled) {
      const hasErrors = Object.values(translations).some(t => t.status === 'error');
      if (hasErrors) {
        toast('Certaines traductions ont échoué — corrigez ou réessayez', 'error');
        return;
      }
    } else {
      const partial = TARGET_LANGUAGES.filter(l => isPartial(translations[l.code]));
      if (partial.length > 0) {
        const names = partial.map(l => l.label).join(', ');
        const ok = await confirm({
          title: 'Langues incomplètes',
          message: 'Certaines langues ont un titre ou un contenu manquant et ne seront pas publiées. Continuer ?',
          details: names,
          confirmLabel: 'Publier sans elles',
          cancelLabel: 'Revenir',
        });
        if (!ok) return;
      }
    }

    setPublishing(true);
    try {
      const finalArticle = {
        ...article,
        status: 'published',
        date: article.date || new Date().toISOString().split('T')[0],
        lastModified: new Date().toISOString(),
      };

      TARGET_LANGUAGES.forEach(lang => {
        const t = translations[lang.code];
        const include = translateDisabled ? isFilled(t) : t.status === 'done';
        if (include) {
          finalArticle[lang.code] = {
            title: t.title,
            summary: t.summary,
            content: t.content,
            translatedAt: new Date().toISOString(),
          };
        }
      });

      finalArticle.translatedLangs = TARGET_LANGUAGES
        .filter(l => {
          const t = translations[l.code];
          return translateDisabled ? isFilled(t) : t.status === 'done';
        })
        .map(l => l.code);

      onPublished?.(finalArticle);
      onClose();
    } catch (err) {
      toast(`Erreur publication : ${err.message}`, 'error');
    } finally {
      setPublishing(false);
    }
  };

  const successCount = translateDisabled
    ? Object.values(translations).filter(isFilled).length
    : Object.values(translations).filter(t => t.status === 'done').length;
  const totalCount = TARGET_LANGUAGES.length;
  const allDone = !translateDisabled
    && Object.values(translations).every(t => t.status === 'done' || t.status === 'error');

  // Phase d'init (health check en cours) — éviter le flicker
  if (translateDisabled === null) {
    return (
      <Modal title="Publication" onClose={onClose} size="lg">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 }}>
          <span className="spinner-sm" />
          <span style={{ color: 'var(--text-light)' }}>Vérification de la traduction automatique…</span>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={translateDisabled ? 'Publication multilingue (manuel)' : 'Publication multilingue'}
      onClose={onClose}
      size={translateDisabled ? 'xl' : 'lg'}
    >
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 15, color: 'var(--navy)', marginBottom: 8 }}>
          <strong>{article.fr.title}</strong>
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-light)' }}>
          {translateDisabled
            ? 'Traduction automatique non configurée. Déplie une langue pour la remplir, ou laisse-la vide pour ne pas la publier.'
            : `Traduction automatique en cours vers ${totalCount} langue${totalCount > 1 ? 's' : ''}…`}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {/* Source FR — toujours OK */}
        <div className="publish-lang-row">
          <span className="publish-lang-flag">🇫🇷</span>
          <span className="publish-lang-name">Français (source)</span>
          <span className="publish-lang-status done">✓</span>
        </div>

        {TARGET_LANGUAGES.map(lang => {
          const t = translations[lang.code];

          if (translateDisabled) {
            const filled = isFilled(t);
            const partial = isPartial(t);
            const isOpen = !!expanded[lang.code];
            const statusLabel = filled ? '✓ rempli' : partial ? '⚠ incomplet — sera ignoré' : 'vide — ne sera pas publié';
            const statusClass = filled ? 'done' : partial ? 'error' : 'pending';

            return (
              <div key={lang.code} className={`publish-lang-manual${isOpen ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="publish-lang-manual-header"
                  onClick={() => setExpanded(prev => ({ ...prev, [lang.code]: !prev[lang.code] }))}
                  aria-expanded={isOpen}
                >
                  <span className="publish-lang-flag">{lang.flag}</span>
                  <span className="publish-lang-name">{lang.label}</span>
                  <span className={`publish-lang-status ${statusClass}`}>{statusLabel}</span>
                  <span className="publish-lang-chevron" aria-hidden>{isOpen ? '▾' : '▸'}</span>
                </button>

                {isOpen && (
                  <div className="publish-lang-manual-body">
                    <div className="publish-lang-actions">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => copyFromFr(lang.code)}
                        title="Pré-remplir avec le texte FR (à traduire ensuite)"
                      >
                        Copier le FR
                      </button>
                      {(t.title || t.summary || t.content) && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => clearLang(lang.code)}
                        >
                          Vider
                        </button>
                      )}
                    </div>

                    <label>Titre</label>
                    <input
                      type="text"
                      placeholder={`Titre en ${lang.label}`}
                      value={t.title}
                      onChange={(e) => updateField(lang.code, 'title', e.target.value)}
                      style={{ width: '100%', marginBottom: 10 }}
                    />

                    <label>Résumé (optionnel)</label>
                    <textarea
                      placeholder={`Résumé en ${lang.label}`}
                      value={t.summary}
                      onChange={(e) => updateField(lang.code, 'summary', e.target.value)}
                      rows={2}
                      style={{ width: '100%', marginBottom: 10, resize: 'vertical' }}
                    />

                    <label>Contenu</label>
                    <RichEditor
                      value={t.content}
                      onChange={(html) => updateField(lang.code, 'content', html)}
                      title={t.title || article.fr.title}
                      author={article.author}
                      placeholder={`Contenu en ${lang.label}…`}
                      slug={`${article.slug || 'article'}-${lang.code}`}
                      toast={toast}
                      defaultMode="apercu"
                    />
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={lang.code} className="publish-lang-row">
              <span className="publish-lang-flag">{lang.flag}</span>
              <span className="publish-lang-name">{lang.label}</span>
              {t.status === 'pending' && <span className="publish-lang-status pending">En attente</span>}
              {t.status === 'translating' && (
                <span className="publish-lang-status translating">
                  <span className="spinner-sm" /> Traduction…
                </span>
              )}
              {t.status === 'done' && (
                <span className="publish-lang-status done">✓ {t.title ? `"${t.title.slice(0, 40)}…"` : 'Traduit'}</span>
              )}
              {t.status === 'error' && (
                <span className="publish-lang-status error">
                  ✗ {t.error}
                  <button className="btn btn-outline btn-sm" style={{ marginLeft: 8 }} onClick={() => launchTranslation(lang.code)}>Réessayer</button>
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="publish-progress-bar">
        <div
          className="publish-progress-fill"
          style={{ width: `${((successCount + 1) / (totalCount + 1)) * 100}%` }}
        />
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-light)', textAlign: 'center', marginTop: 4 }}>
        {successCount + 1} / {totalCount + 1} langues prêtes
      </p>

      <div className="modal-footer" style={{ marginTop: 16 }}>
        <button className="btn btn-outline" onClick={onClose} disabled={publishing}>Annuler</button>
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-primary"
          onClick={handlePublish}
          disabled={publishing || (!translateDisabled && (!allDone || successCount < totalCount))}
        >
          {publishing
            ? 'Publication…'
            : `Publier (${successCount + 1} langue${successCount + 1 > 1 ? 's' : ''})`}
        </button>
      </div>
    </Modal>
  );
}
