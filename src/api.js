// ─── API Module ───
// All CORS-blocked APIs go through the Cloudflare Worker proxy.
// Direct APIs (GitHub public, Telegram) call directly.

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://ir-api.YOUR-SUBDOMAIN.workers.dev';

// ─── HelloAsso ───
export async function fetchHelloAssoMembers(clientId, clientSecret, orgSlug) {
  const resp = await fetch(`${WORKER_URL}/helloasso/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret, orgSlug }),
  });
  if (!resp.ok) throw new Error(`HelloAsso: ${resp.status}`);
  return resp.json();
}

export async function fetchHelloAssoDonations(clientId, clientSecret, orgSlug) {
  const resp = await fetch(`${WORKER_URL}/helloasso/donations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret, orgSlug }),
  });
  if (!resp.ok) throw new Error(`HelloAsso: ${resp.status}`);
  return resp.json();
}

// ─── Brevo ───
export async function sendBrevoEmail(apiKey, { to, subject, htmlContent, sender }) {
  const resp = await fetch(`${WORKER_URL}/brevo/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, to, subject, htmlContent, sender }),
  });
  if (!resp.ok) throw new Error(`Brevo: ${resp.status}`);
  return resp.json();
}

export async function sendBrevoCampaign(apiKey, { emails, subject, htmlContent, senderName, senderEmail }) {
  // Send to multiple recipients via transactional endpoint
  const results = [];
  // Batch by 50 to avoid rate limits
  for (let i = 0; i < emails.length; i += 50) {
    const batch = emails.slice(i, i + 50);
    const resp = await fetch(`${WORKER_URL}/brevo/campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        recipients: batch,
        subject,
        htmlContent,
        senderName: senderName || 'Institut Rousseau',
        senderEmail: senderEmail || 'contact@institut-rousseau.fr',
      }),
    });
    if (!resp.ok) throw new Error(`Brevo batch ${i}: ${resp.status}`);
    results.push(await resp.json());
  }
  return { sent: emails.length, batches: results.length };
}

// ─── Notion ───
export async function fetchNotionDatabase(notionKey, databaseId) {
  const resp = await fetch(`${WORKER_URL}/notion/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notionKey, databaseId }),
  });
  if (!resp.ok) throw new Error(`Notion: ${resp.status}`);
  return resp.json();
}

// ─── Telegram (direct — no CORS issues) ───
export async function sendTelegramMessage(botToken, chatId, text) {
  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  if (!resp.ok) throw new Error(`Telegram: ${resp.status}`);
  return resp.json();
}

// ─── GitHub (direct — CORS ok for public repos) ───
export async function fetchGitHubCommits(owner, repo, token, perPage = 10) {
  const headers = { Accept: 'application/vnd.github.v3+json' };
  if (token) headers.Authorization = `token ${token}`;
  const resp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${perPage}`,
    { headers }
  );
  if (!resp.ok) throw new Error(`GitHub: ${resp.status}`);
  const data = await resp.json();
  return data.map(c => ({
    sha: c.sha?.slice(0, 7),
    message: c.commit?.message?.split('\n')[0] || '',
    author: c.commit?.author?.name || '',
    date: c.commit?.author?.date?.slice(0, 10) || '',
    url: c.html_url,
  }));
}

// ─── Link Checker (direct fetch, no-cors) ───
export async function checkPageLink(url) {
  const start = Date.now();
  try {
    await fetch(url, { method: 'HEAD', mode: 'no-cors' });
    return { status: 'ok', time: Date.now() - start };
  } catch {
    return { status: 'error', time: Date.now() - start };
  }
}

// ─── Local Storage helpers ───
const PREFIX = 'ir-dash-';

export function saveLocal(key, data) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(data)); } catch {}
}

export function loadLocal(key, fallback = null) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

// ─── CSV helpers ───
export function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(/[,;\t]/).map(h => h.trim().toLowerCase().replace(/"/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(/[,;\t]/).map(v => v.trim().replace(/"/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  }).filter(r => Object.values(r).some(v => v));
}

export function exportCSV(contacts, filename) {
  const headers = 'Nom,Email,Tags,Source,Date\n';
  const rows = contacts.map(c =>
    `"${c.name}","${c.email}","${c.tags.join(';')}","${c.source}","${c.date}"`
  ).join('\n');
  const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `contacts-IR-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
