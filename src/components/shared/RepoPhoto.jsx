import { useState, useEffect } from 'react';
import usePhoto from '../../hooks/usePhoto';

/**
 * <img> qui charge automatiquement une photo du repo site (privé) via l'API
 * GitHub authentifiée. Si `photo` est vide, échoue à fetch, ou si l'image
 * elle-même ne peut pas être rendue par le navigateur, affiche le fallback
 * (typiquement les initiales).
 */
export default function RepoPhoto({ photo, alt, className, style, fallback, onLoadedChange }) {
  const { url } = usePhoto(photo);
  const [imgError, setImgError] = useState(false);

  // Reset l'état d'erreur dès que l'URL change
  useEffect(() => { setImgError(false); }, [url]);

  if (!url || imgError) {
    return fallback || null;
  }

  return (
    <img
      src={url}
      alt={alt || ''}
      className={className}
      style={style}
      onLoad={() => onLoadedChange && onLoadedChange(true)}
      onError={() => { setImgError(true); onLoadedChange && onLoadedChange(false); }}
    />
  );
}
