import api from './api';

// ─── Telegram via Cloudflare Worker ───────────────────

export async function sendMessage(chatId, text) {
  return api.post('/api/telegram/send', { chatId, text });
}

export async function sendChannelMessage(text) {
  return api.post('/api/telegram/send-channel', { text });
}

export async function testConnection() {
  return sendMessage(null, '✅ Connexion Telegram vérifiée depuis le back-office Institut Rousseau.');
}

// Formate un message article pour le canal public
export function formatArticleMessage(article) {
  const lines = [];
  lines.push(`📄 <b>${article.title}</b>`);
  if (article.author) lines.push(`Par ${article.author}`);
  if (article.excerpt) {
    lines.push('');
    lines.push(article.excerpt);
  }
  if (article.url) {
    lines.push('');
    lines.push(`→ ${article.url}`);
  }
  return lines.join('\n');
}

// Formate une notification privée
export function formatNotification(type, data) {
  switch (type) {
    case 'new_subscriber':
      return `📬 Nouvel abonné newsletter : ${data.email}`;
    case 'api_error':
      return `⚠️ Erreur sync ${data.service} : ${data.message}`;
    default:
      return data.message || '';
  }
}
