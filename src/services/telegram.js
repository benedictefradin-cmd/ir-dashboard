import api from './api';

// ─── Telegram via Cloudflare Worker ───────────────────

export async function sendMessage(chatId, text) {
  return api.post('/api/telegram/send', { chatId, text });
}

export async function sendChannelMessage(text) {
  return api.post('/api/telegram/send-channel', { text });
}

export async function testConnection() {
  return sendMessage(null, '\u2705 Connexion Telegram v\u00e9rifi\u00e9e depuis le back-office Institut Rousseau.');
}

// Formate un message article pour le canal public
export function formatArticleMessage(article) {
  const lines = [];
  lines.push(`\ud83d\udcc4 <b>${article.title}</b>`);
  if (article.author) lines.push(`Par ${article.author}`);
  if (article.excerpt) {
    lines.push('');
    lines.push(article.excerpt);
  }
  if (article.url) {
    lines.push('');
    lines.push(`\u2192 ${article.url}`);
  }
  return lines.join('\n');
}

// Formate une notification priv\u00e9e
export function formatNotification(type, data) {
  switch (type) {
    case 'new_adherent':
      return `\ud83c\udd95 Nouvelle adh\u00e9sion\u00a0: ${data.name} (${data.email}) \u2014 ${data.amount}\u00a0\u20ac`;
    case 'new_subscriber':
      return `\ud83d\udcec Nouvel abonn\u00e9 newsletter\u00a0: ${data.email}`;
    case 'api_error':
      return `\u26a0\ufe0f Erreur sync ${data.service}\u00a0: ${data.message}`;
    default:
      return data.message || '';
  }
}
