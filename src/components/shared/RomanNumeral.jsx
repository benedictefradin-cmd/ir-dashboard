// Numérotation en chiffres romains (1 à 3999) avec aria-label automatique
// donnant la valeur arabe — sinon un lecteur d'écran lirait "I-I-I" pour III.

const SYMBOLS = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function toRoman(n) {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return '';
  let result = '';
  let remaining = n;
  for (const [v, s] of SYMBOLS) {
    while (remaining >= v) {
      result += s;
      remaining -= v;
    }
  }
  return result;
}

export default function RomanNumeral({ value, className, ...rest }) {
  const roman = toRoman(value);
  if (!roman) return null;
  return (
    <span
      className={className ? `roman-numeral ${className}` : 'roman-numeral'}
      aria-label={String(value)}
      {...rest}
    >
      {roman}
    </span>
  );
}
