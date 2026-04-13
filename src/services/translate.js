import { loadLocal } from '../utils/localStorage';

/**
 * Traduit un article (title, summary, content) d'une langue source vers une langue cible
 * via le Worker API (endpoint /api/translate).
 *
 * @param {{ title: string, summary: string, content: string }} article
 * @param {string} fromLang - code langue source (ex: 'fr')
 * @param {string} toLang - code langue cible (ex: 'en')
 * @returns {Promise<{ title: string, summary: string, content: string }>}
 */
export async function translateArticle(article, fromLang, toLang) {
  const workerUrl = loadLocal('ir_worker_url', '') || loadLocal('worker-url', '') || import.meta.env.VITE_WORKER_URL || '';

  if (!workerUrl) {
    throw new Error('Worker URL non configurée — allez dans Config');
  }

  const resp = await fetch(`${workerUrl}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: article.title,
      summary: article.summary,
      content: article.content,
      from: fromLang,
      to: toLang,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Traduction ${toLang} : erreur ${resp.status}`);
  }

  return resp.json();
}
