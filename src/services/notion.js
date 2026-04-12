// ─── Notion API — Pipeline de publication ──────────────
// Toutes les requêtes passent par le Worker Cloudflare.
// Les tokens Notion sont stockés dans localStorage et envoyés via headers.

import { loadLocal } from '../utils/localStorage';
import { DEFAULT_WORKER_URL, LS_KEYS } from '../utils/constants';

function getWorkerUrl() {
  return loadLocal(LS_KEYS.workerUrl, null) || DEFAULT_WORKER_URL;
}

function getNotionHeaders() {
  const token = loadLocal('ir_notion_token', '') || import.meta.env.VITE_NOTION_API_KEY || '';
  const dbId = loadLocal('ir_notion_db_id', '') || import.meta.env.VITE_NOTION_DATABASE_ID || '';
  return {
    'Content-Type': 'application/json',
    'X-Notion-Token': token,
    'X-Notion-Database-Id': dbId,
  };
}

/**
 * Récupère tous les articles de la base Notion.
 */
export async function fetchArticles() {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) throw new Error('Worker URL non configurée');

  const resp = await fetch(`${workerUrl}/api/notion/articles`, {
    headers: getNotionHeaders(),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Erreur Notion ${resp.status}`);
  }
  const data = await resp.json();
  return data.articles || [];
}

/**
 * Récupère le contenu HTML d'un article Notion.
 */
export async function fetchArticleContent(pageId) {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) throw new Error('Worker URL non configurée');

  const resp = await fetch(`${workerUrl}/api/notion/articles/${pageId}/content`, {
    headers: getNotionHeaders(),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Erreur contenu Notion ${resp.status}`);
  }
  return resp.json(); // { html, wordCount }
}

/**
 * Met à jour le statut d'un article dans Notion.
 */
export async function updateArticleStatus(pageId, status, publishDate, authors) {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) throw new Error('Worker URL non configurée');

  const body = { status };
  if (publishDate) body.publishDate = publishDate;
  if (authors) body.authors = authors;

  const resp = await fetch(`${workerUrl}/api/notion/articles/${pageId}/status`, {
    method: 'PATCH',
    headers: getNotionHeaders(),
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Erreur mise à jour Notion ${resp.status}`);
  }
  return resp.json();
}

/**
 * Compte les articles par statut.
 */
export function countByStatus(articles) {
  const counts = { draft: 0, writing: 0, review: 0, ready: 0, published: 0, archived: 0 };
  for (const a of articles) {
    const s = (a.status || '').toLowerCase();
    if (s === 'idée' || s === 'idee') counts.draft++;
    else if (s === 'en rédaction' || s === 'en redaction') counts.writing++;
    else if (s === 'prêt à relire' || s === 'pret a relire') counts.review++;
    else if (s === 'prêt à publier' || s === 'pret a publier') counts.ready++;
    else if (s === 'publié' || s === 'publie') counts.published++;
    else if (s === 'archivé' || s === 'archive') counts.archived++;
  }
  return counts;
}

/**
 * Vérifie si Notion est configuré.
 */
export function hasNotion() {
  const token = loadLocal('ir_notion_token', '') || import.meta.env.VITE_NOTION_API_KEY || '';
  const dbId = loadLocal('ir_notion_db_id', '') || import.meta.env.VITE_NOTION_DATABASE_ID || '';
  return !!(token && dbId);
}
