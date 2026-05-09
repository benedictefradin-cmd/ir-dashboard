import { describe, it, expect } from 'vitest';
import { toRoman } from '../shared/RomanNumeral';

describe('toRoman — conversion en chiffres romains', () => {
  it('convertit les pôles thématiques (1 à 6)', () => {
    expect(toRoman(1)).toBe('I');
    expect(toRoman(2)).toBe('II');
    expect(toRoman(3)).toBe('III');
    expect(toRoman(4)).toBe('IV');
    expect(toRoman(5)).toBe('V');
    expect(toRoman(6)).toBe('VI');
  });

  it('gère les cas mentionnés dans la spec', () => {
    expect(toRoman(12)).toBe('XII');
    expect(toRoman(42)).toBe('XLII');
    expect(toRoman(100)).toBe('C');
    expect(toRoman(257)).toBe('CCLVII');
  });

  it('gère les bornes', () => {
    expect(toRoman(1)).toBe('I');
    expect(toRoman(3999)).toBe('MMMCMXCIX');
  });

  it('renvoie une chaîne vide hors plage ou pour valeurs invalides', () => {
    expect(toRoman(0)).toBe('');
    expect(toRoman(-1)).toBe('');
    expect(toRoman(4000)).toBe('');
    expect(toRoman(1.5)).toBe('');
    expect(toRoman(NaN)).toBe('');
    expect(toRoman('5')).toBe('');
    expect(toRoman(null)).toBe('');
    expect(toRoman(undefined)).toBe('');
  });
});
