// ─── Notion : intégration retirée ──────────────────────
// Décision AUDIT §7 Q5 : la base Notion ne contenait pas d'articles à
// migrer, l'utilisateur ne s'en sert plus. Toutes les fonctions sont
// maintenues comme stubs no-op pour ne pas casser les imports résiduels
// dans Articles.jsx ; elles seront retirées avec Articles.jsx lors du
// nettoyage complet de l'écran éditorial.
//
// Les routes /api/notion/* du Worker restent en place (dormantes) au cas
// où une réactivation serait demandée. Aucun appel ne les déclenche.

export function hasNotion() {
  return false;
}

export async function fetchArticles() {
  return [];
}

export async function fetchArticleContent() {
  return { html: '', wordCount: 0 };
}

export async function updateArticleStatus() {
  return { success: false, disabled: true };
}

export function countByStatus() {
  return { draft: 0, writing: 0, review: 0, ready: 0, published: 0, archived: 0 };
}
