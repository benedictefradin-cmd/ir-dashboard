import { useState, useEffect } from 'react';
import Modal from '../shared/Modal';
import { TARGET_LANGUAGES, SITE_LANGUAGES } from '../../utils/constants';
import { translateArticle } from '../../services/translate';

/**
 * Modal de publication avec traduction automatique multilingue.
 * Lancé quand l'utilisateur clique "Publier" dans le formulaire article.
 */
export default function PublishWithTranslation({ article, onPublished, onClose, toast }) {
  // État de traduction par langue
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
  const [allDone, setAllDone] = useState(false);
  const [translateDisabled, setTranslateDisabled] = useState(false);

  // Vérifier si toutes les traductions sont terminées
  useEffect(() => {
    const statuses = Object.values(translations);
    setAllDone(statuses.every(t => t.status === 'done' || t.status === 'error'));
  }, [translations]);

  // Lancer les traductions au montage
  useEffect(() => {
    const pendingLangs = TARGET_LANGUAGES.filter(l => translations[l.code].status === 'pending');
    if (pendingLangs.length === 0) return;

    pendingLangs.forEach(lang => {
      setTranslations(prev => ({
        ...prev,
        [lang.code]: { ...prev[lang.code], status: 'translating' },
      }));

      translateArticle(
        { title: article.fr.title, summary: article.fr.summary, content: article.fr.content },
        'fr',
        lang.code
      )
        .then(result => {
          setTranslations(prev => ({
            ...prev,
            [lang.code]: {
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
          if (isConfigMissing) setTranslateDisabled(true);
          setTranslations(prev => ({
            ...prev,
            [lang.code]: {
              ...prev[lang.code],
              status: 'error',
              error: err.message,
            },
          }));
        });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Retenter une traduction échouée
  const retry = (langCode) => {
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
          [langCode]: { status: 'done', title: result.title, summary: result.summary, content: result.content, error: null },
        }));
      })
      .catch(err => {
        setTranslations(prev => ({
          ...prev,
          [langCode]: { ...prev[langCode], status: 'error', error: err.message },
        }));
      });
  };

  // Édition manuelle d'un champ (mode sans API de traduction)
  const updateField = (langCode, field, value) => {
    setTranslations(prev => ({
      ...prev,
      [langCode]: { ...prev[langCode], [field]: value },
    }));
  };

  const isFilled = (t) => !!(t.title?.trim() && t.content?.trim());

  // Publier — retourner l'article final avec toutes les traductions
  const handlePublish = async () => {
    if (!translateDisabled) {
      const hasErrors = Object.values(translations).some(t => t.status === 'error');
      if (hasErrors) {
        toast('Certaines traductions ont échoué — corrigez ou réessayez', 'error');
        return;
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

  return (
    <Modal title={translateDisabled ? 'Publication' : 'Publication multilingue'} onClose={onClose} size="lg">
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 15, color: 'var(--navy)', marginBottom: 8 }}>
          <strong>{article.fr.title}</strong>
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-light)' }}>
          {translateDisabled
            ? 'Traduction automatique non configurée. Remplis les langues que tu veux publier, laisse vide les autres.'
            : `Traduction automatique en cours vers ${totalCount} langue${totalCount > 1 ? 's' : ''}…`}
        </p>
      </div>

      {/* Progression / saisie par langue */}
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
            return (
              <div key={lang.code} className="publish-lang-manual">
                <div className="publish-lang-manual-header">
                  <span className="publish-lang-flag">{lang.flag}</span>
                  <span className="publish-lang-name">{lang.label}</span>
                  <span className={`publish-lang-status ${filled ? 'done' : 'pending'}`}>
                    {filled ? '✓ rempli' : 'vide — ne sera pas publié'}
                  </span>
                </div>
                <input
                  type="text"
                  placeholder={`Titre en ${lang.label}`}
                  value={t.title}
                  onChange={(e) => updateField(lang.code, 'title', e.target.value)}
                  style={{ width: '100%', marginBottom: 6 }}
                />
                <textarea
                  placeholder={`Résumé en ${lang.label} (optionnel)`}
                  value={t.summary}
                  onChange={(e) => updateField(lang.code, 'summary', e.target.value)}
                  rows={2}
                  style={{ width: '100%', marginBottom: 6, resize: 'vertical' }}
                />
                <textarea
                  placeholder={`Contenu en ${lang.label} (HTML autorisé)`}
                  value={t.content}
                  onChange={(e) => updateField(lang.code, 'content', e.target.value)}
                  rows={6}
                  style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                />
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
                  <button className="btn btn-outline btn-sm" style={{ marginLeft: 8 }} onClick={() => retry(lang.code)}>Réessayer</button>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Barre de progression */}
      <div className="publish-progress-bar">
        <div
          className="publish-progress-fill"
          style={{ width: `${((successCount + 1) / (totalCount + 1)) * 100}%` }}
        />
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-light)', textAlign: 'center', marginTop: 4 }}>
        {successCount + 1} / {totalCount + 1} langues prêtes
      </p>

      {/* Actions */}
      <div className="modal-footer" style={{ marginTop: 16 }}>
        <button className="btn btn-outline" onClick={onClose} disabled={publishing}>Annuler</button>
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-primary"
          onClick={handlePublish}
          disabled={!allDone || publishing || (!translateDisabled && successCount < totalCount)}
        >
          {publishing
            ? 'Publication…'
            : translateDisabled
              ? 'Publier (FR seul)'
              : `Publier (${totalCount + 1} langues)`}
        </button>
      </div>
    </Modal>
  );
}
