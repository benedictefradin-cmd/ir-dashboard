import usePhoto from '../../hooks/usePhoto';

/**
 * <img> qui charge automatiquement une photo du repo site (privé) via l'API
 * GitHub authentifiée. Si `photo` est vide ou échoue, affiche le fallback
 * (children) — typiquement les initiales.
 */
export default function RepoPhoto({ photo, alt, className, style, fallback, onLoadedChange }) {
  const { url, loading, error } = usePhoto(photo);

  if (!url) {
    // Pas d'URL (vide, en chargement, ou erreur) → afficher le fallback
    return fallback || null;
  }

  return (
    <img
      src={url}
      alt={alt || ''}
      className={className}
      style={style}
      onLoad={() => onLoadedChange && onLoadedChange(true)}
      onError={() => onLoadedChange && onLoadedChange(false)}
    />
  );
}
