import { useEffect, useRef, useState, useCallback } from 'react';

const STORAGE_PREFIX = 'ir-dash-draft-';
const DEFAULT_DEBOUNCE_MS = 3000;

/**
 * Auto-save d'un formulaire dans localStorage avec debounce.
 *
 * Sauvegarde le contenu (sérialisable JSON) sous `ir-dash-draft-{key}` toutes
 * les `debounceMs` après la dernière modification. Au mount, expose le draft
 * existant via `existingDraft` pour proposer de le restaurer. Une fois la
 * sauvegarde "officielle" effectuée (commit GitHub, etc.), appeler `clear()`.
 *
 * @param {string} key - Identifiant stable du formulaire (ex: article id ou 'new')
 * @param {Object} data - Objet à surveiller (sérialisé en JSON)
 * @param {Object} [opts]
 * @param {boolean} [opts.enabled=true] - Désactive l'auto-save si false
 * @param {number} [opts.debounceMs=3000]
 */
export default function useDraftAutosave(key, data, opts = {}) {
  const { enabled = true, debounceMs = DEFAULT_DEBOUNCE_MS } = opts;
  const fullKey = `${STORAGE_PREFIX}${key}`;
  const timerRef = useRef(null);
  const lastSavedRef = useRef(null);
  const [existingDraft, setExistingDraft] = useState(null);

  // Au mount : check s'il y a un draft à restaurer
  useEffect(() => {
    try {
      const raw = localStorage.getItem(fullKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.savedAt && parsed.data) {
          setExistingDraft(parsed);
        }
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey]);

  // Sauvegarde debouncée à chaque changement de data
  useEffect(() => {
    if (!enabled) return;
    const serialized = JSON.stringify(data);
    if (serialized === lastSavedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(fullKey, JSON.stringify({
          data,
          savedAt: new Date().toISOString(),
        }));
        lastSavedRef.current = serialized;
      } catch { /* quota / private mode — silencieux */ }
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, enabled, debounceMs, fullKey]);

  const clear = useCallback(() => {
    try { localStorage.removeItem(fullKey); } catch { /* ignore */ }
    lastSavedRef.current = null;
    setExistingDraft(null);
  }, [fullKey]);

  const restore = useCallback(() => {
    if (!existingDraft) return null;
    return existingDraft.data;
  }, [existingDraft]);

  const dismissDraft = useCallback(() => {
    setExistingDraft(null);
  }, []);

  return { existingDraft, restore, clear, dismissDraft };
}
