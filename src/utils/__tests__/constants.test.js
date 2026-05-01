import { describe, it, expect } from 'vitest';
import { resolvePhotoUrl, normalizeName, namesMatch, findPublicationsForAuthor, canonicalPhotoPath } from '../constants';

describe('resolvePhotoUrl', () => {
  it('renvoie tel quel pour URLs absolues', () => {
    expect(resolvePhotoUrl('https://example.com/x.jpg')).toBe('https://example.com/x.jpg');
    expect(resolvePhotoUrl('data:image/png;base64,xx')).toBe('data:image/png;base64,xx');
  });

  it('conserve les chemins assets/ et images/ tels quels (pour le loader auth)', () => {
    expect(resolvePhotoUrl('assets/images/equipe/x.png')).toBe('assets/images/equipe/x.png');
    expect(resolvePhotoUrl('images/site/y.jpg')).toBe('images/site/y.jpg');
  });

  it('préfixe le SITE_URL pour les chemins relatifs simples', () => {
    expect(resolvePhotoUrl('logo.svg')).toMatch(/institut-rousseau\.fr\/logo\.svg$/);
  });

  it('renvoie chaîne vide pour falsy', () => {
    expect(resolvePhotoUrl('')).toBe('');
    expect(resolvePhotoUrl(null)).toBe('');
  });
});

describe('normalizeName', () => {
  it('normalise accents + minuscules + trim', () => {
    expect(normalizeName('  Bénédicte  ')).toBe('benedicte');
    expect(normalizeName('NICOLAS Dufrêne')).toBe('nicolas dufrene');
  });

  it("gère null/undefined", () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
});

describe('namesMatch', () => {
  it('match exact insensible aux accents/casse', () => {
    expect(namesMatch('Bénédicte', 'Fradin', 'BENEDICTE', 'fradin')).toBe(true);
  });

  it('false sur prénom différent', () => {
    expect(namesMatch('Marie', 'Fradin', 'Bénédicte', 'Fradin')).toBe(false);
  });

  it('false si l\'un est vide', () => {
    expect(namesMatch('', 'Fradin', 'Marie', 'Fradin')).toBe(false);
  });
});

describe('findPublicationsForAuthor', () => {
  const articles = [
    { id: 1, author: 'Nicolas Dufrêne', title: 'Note A' },
    { id: 2, author: 'Bénédicte Fradin, Nicolas Dufrêne', title: 'Note B' },
    { id: 3, author: 'Marie & Bénédicte Fradin', title: 'Note C' },
    { id: 4, author: 'Bénédicte Fradin et Nicolas Dufrêne', title: 'Note D' },
    { id: 5, author: '', title: 'Note E' },
  ];

  it('trouve les publications par nom complet exact', () => {
    const found = findPublicationsForAuthor(
      { firstName: 'Bénédicte', lastName: 'Fradin' },
      articles
    );
    // Articles 2, 3, 4 contiennent "Bénédicte Fradin"
    expect(found.map(a => a.id).sort()).toEqual([2, 3, 4]);
  });

  it('split sur virgule, & et "et"', () => {
    const found = findPublicationsForAuthor(
      { firstName: 'Nicolas', lastName: 'Dufrêne' },
      articles
    );
    expect(found.map(a => a.id).sort()).toEqual([1, 2, 4]);
  });

  it('renvoie [] si pas d\'articles', () => {
    expect(findPublicationsForAuthor({ firstName: 'X', lastName: 'Y' }, [])).toEqual([]);
  });

  it('renvoie [] si auteur vide', () => {
    expect(findPublicationsForAuthor(null, articles)).toEqual([]);
  });
});

describe('canonicalPhotoPath', () => {
  it('génère un slug propre', () => {
    expect(canonicalPhotoPath('Bénédicte', 'Fradin')).toBe('assets/images/equipe/benedicte-fradin.jpg');
  });

  it('respecte l\'extension demandée', () => {
    expect(canonicalPhotoPath('Marie', 'Curie', 'png')).toBe('assets/images/equipe/marie-curie.png');
  });

  it('respecte le folder', () => {
    expect(canonicalPhotoPath('Marie', 'Curie', 'jpg', 'auteurs')).toBe('assets/images/auteurs/marie-curie.jpg');
  });
});
