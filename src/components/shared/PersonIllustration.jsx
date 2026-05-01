import { COLORS } from '../../utils/constants';

const BG_COLORS = [COLORS.ochre, COLORS.sky, COLORS.terra, COLORS.green, COLORS.navy];

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Illustration de silhouette de personne minimaliste, dans le style IR
 * (cercle + buste tracés au feutre noir sur fond couleur de la palette).
 * Fallback visuel pour les profils sans photo.
 *
 * La couleur de fond est dérivée du nom (hash → palette) pour que chaque
 * profil ait une couleur stable mais variée.
 */
export default function PersonIllustration({ name = '', size = '100%', className, style }) {
  const bg = BG_COLORS[hashCode(name) % BG_COLORS.length];
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', ...style }}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="200" height="200" fill={bg} />
      {/* Cercle ouvert (esquisse au feutre) */}
      <path
        d="M 38 110 A 62 62 0 1 1 100 172"
        stroke="#1a1a1a"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      {/* Tête + buste (silhouette) */}
      <path
        d="M 100 60
           C 86 60, 75 72, 75 88
           C 75 100, 81 110, 89 114
           C 70 120, 58 138, 56 158
           C 70 162, 130 162, 144 158
           C 142 138, 130 120, 111 114
           C 119 110, 125 100, 125 88
           C 125 72, 114 60, 100 60 Z"
        stroke="#1a1a1a"
        strokeWidth="5"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
