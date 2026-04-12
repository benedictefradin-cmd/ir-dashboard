import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook qui affiche une alerte navigateur si l'utilisateur quitte la page
 * avec des modifications non sauvegardées.
 *
 * @param {Object} data - L'objet à surveiller (ex: contenu)
 * @returns {{ markSaved: () => void }} - Appeler après un save réussi
 */
export default function useUnsavedGuard(data) {
  const savedSnapshot = useRef(JSON.stringify(data));
  const isDirty = useRef(false);

  useEffect(() => {
    const current = JSON.stringify(data);
    isDirty.current = current !== savedSnapshot.current;
  }, [data]);

  // Alerte navigateur (fermeture d'onglet / refresh)
  useEffect(() => {
    const handler = (e) => {
      if (isDirty.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const markSaved = useCallback(() => {
    savedSnapshot.current = JSON.stringify(data);
    isDirty.current = false;
  }, [data]);

  return { markSaved, isDirty };
}
