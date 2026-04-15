import { useState, useEffect } from 'react';
import { githubGetImageDataUrl, hasGitHub } from '../services/github';

/**
 * Charge une photo depuis le repo site (privé) via l'API GitHub authentifiée
 * et retourne un data URL utilisable dans un <img>.
 *
 * Accepte :
 *   - un chemin interne (ex: 'assets/images/equipe/x.png') → fetch via API
 *   - une URL absolue (http/https/data:) → retournée telle quelle
 *   - vide / null → retourne ''
 *
 * @param {string} photo
 * @returns {{ url: string, loading: boolean, error: Error | null }}
 */
export default function usePhoto(photo) {
  const [url, setUrl] = useState(() => {
    if (!photo) return '';
    if (photo.startsWith('http') || photo.startsWith('data:')) return photo;
    return '';
  });
  const [loading, setLoading] = useState(() => {
    return !!photo && !photo.startsWith('http') && !photo.startsWith('data:');
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!photo) { setUrl(''); setLoading(false); setError(null); return; }
    if (photo.startsWith('http') || photo.startsWith('data:')) {
      setUrl(photo); setLoading(false); setError(null); return;
    }
    if (!hasGitHub()) { setUrl(''); setLoading(false); setError(new Error('no github token')); return; }

    let cancelled = false;
    setLoading(true);
    setError(null);
    githubGetImageDataUrl(photo)
      .then(dataUrl => { if (!cancelled) { setUrl(dataUrl); setLoading(false); } })
      .catch(err => { if (!cancelled) { setError(err); setLoading(false); setUrl(''); } });
    return () => { cancelled = true; };
  }, [photo]);

  return { url, loading, error };
}
