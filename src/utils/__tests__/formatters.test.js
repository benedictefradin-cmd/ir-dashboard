import { describe, it, expect } from 'vitest';
import { escapeHtml, slugify, truncate, capitalize } from '../formatters';

describe('escapeHtml — barrière XSS pour les concats HTML (AUDIT §4.6)', () => {
  it('échappe les balises script', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('échappe les guillemets (sortie attribut)', () => {
    expect(escapeHtml('test"onerror="alert(1)')).toBe('test&quot;onerror=&quot;alert(1)');
  });

  it("échappe l'apostrophe (sortie attribut)", () => {
    expect(escapeHtml("test'onclick='alert(1)")).toBe('test&#39;onclick=&#39;alert(1)');
  });

  it('échappe l\'esperluette en premier (pas de double-encoding)', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml('<a>&amp;</a>')).toBe('&lt;a&gt;&amp;amp;&lt;/a&gt;');
  });

  it('gère null/undefined sans planter', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml('')).toBe('');
  });

  it('coerce les non-strings (numbers, bool)', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(true)).toBe('true');
  });

  it('payload XSS classique inerte après escape', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const escaped = escapeHtml(payload);
    // Aucun caractère HTML actif ne subsiste
    expect(escaped).not.toContain('<');
    expect(escaped).not.toContain('>');
    expect(escaped).not.toContain('"');
  });

  it('payload </h3> qui casse une card publication', () => {
    // C'est exactement ce que le smoke test injecte
    const title = 'Mon titre</h3><script>fetch("//evil")</script>';
    const escaped = escapeHtml(title);
    expect(escaped).toBe(
      'Mon titre&lt;/h3&gt;&lt;script&gt;fetch(&quot;//evil&quot;)&lt;/script&gt;'
    );
  });
});

describe('slugify', () => {
  it('normalise les accents', () => {
    expect(slugify('Économie & Société')).toBe('economie-societe');
  });

  it('trime les tirets en bord', () => {
    expect(slugify('---test---')).toBe('test');
  });

  it('lowercase + tirets en place des espaces', () => {
    expect(slugify('Hello World !')).toBe('hello-world');
  });
});

describe('truncate', () => {
  it("ajoute une ellipse au-delà de maxLen", () => {
    expect(truncate('abcdefghij', 5)).toBe('abcde…');
  });

  it("ne touche pas si déjà court", () => {
    expect(truncate('abc', 10)).toBe('abc');
  });

  it("gère null/undefined", () => {
    expect(truncate(null)).toBe('');
    expect(truncate(undefined)).toBe('');
  });
});

describe('capitalize', () => {
  it('met la 1re lettre en maj', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it("renvoie '' sur input vide", () => {
    expect(capitalize('')).toBe('');
    expect(capitalize(null)).toBe('');
  });
});
