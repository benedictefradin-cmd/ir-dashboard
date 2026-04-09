/**
 * Cloudflare Worker — API proxy pour le dashboard Institut Rousseau
 *
 * Résout les problèmes CORS pour : HelloAsso, Brevo, Notion
 * 
 * DÉPLOIEMENT :
 * 1. Créer un compte Cloudflare (gratuit)
 * 2. npm install -g wrangler
 * 3. wrangler login
 * 4. wrangler deploy
 *
 * OU copier-coller ce fichier dans le dashboard Cloudflare Workers
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // En production : remplacer par l'URL de ton GitHub Pages
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ─── HelloAsso ───
      if (path === '/helloasso/members' || path === '/helloasso/donations') {
        const { clientId, clientSecret, orgSlug } = await request.json();

        // 1. Get OAuth token
        const tokenResp = await fetch('https://api.helloasso.com/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
        });
        if (!tokenResp.ok) {
          return jsonResponse({ error: 'HelloAsso auth failed', status: tokenResp.status }, 401);
        }
        const { access_token } = await tokenResp.json();

        // 2. Fetch data
        const endpoint = path.includes('donations') ? 'payments' : 'members';
        const dataResp = await fetch(
          `https://api.helloasso.com/v5/organizations/${orgSlug}/${endpoint}?pageSize=100`,
          { headers: { Authorization: `Bearer ${access_token}` } }
        );
        if (!dataResp.ok) {
          return jsonResponse({ error: `HelloAsso ${endpoint} fetch failed` }, dataResp.status);
        }
        const data = await dataResp.json();

        // 3. Normalize to our contact format
        const contacts = (data.data || []).map(item => ({
          id: `ha-${item.id}`,
          name: `${item.payer?.firstName || item.user?.firstName || ''} ${item.payer?.lastName || item.user?.lastName || ''}`.trim(),
          email: (item.payer?.email || item.user?.email || '').toLowerCase(),
          amount: item.amount ? item.amount / 100 : null,
          date: item.date?.slice(0, 10) || item.meta?.createdDate?.slice(0, 10) || '',
          type: path.includes('donations') ? 'donateur' : 'membre',
          helloassoId: String(item.id),
        })).filter(c => c.email);

        return jsonResponse(contacts);
      }

      // ─── Brevo ───
      if (path === '/brevo/send') {
        const { apiKey, to, subject, htmlContent, sender } = await request.json();
        const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: sender || { name: 'Institut Rousseau', email: 'contact@institut-rousseau.fr' },
            to: Array.isArray(to) ? to : [{ email: to }],
            subject,
            htmlContent,
          }),
        });
        const data = await resp.json();
        if (!resp.ok) return jsonResponse({ error: 'Brevo send failed', details: data }, resp.status);
        return jsonResponse(data);
      }

      if (path === '/brevo/campaign') {
        const { apiKey, recipients, subject, htmlContent, senderName, senderEmail } = await request.json();
        const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: { name: senderName, email: senderEmail },
            to: recipients.map(email => ({ email })),
            subject,
            htmlContent,
          }),
        });
        const data = await resp.json();
        if (!resp.ok) return jsonResponse({ error: 'Brevo campaign failed', details: data }, resp.status);
        return jsonResponse({ sent: recipients.length, ...data });
      }

      // ─── Notion ───
      if (path === '/notion/query') {
        const { notionKey, databaseId } = await request.json();
        const resp = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${notionKey}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ page_size: 100 }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          return jsonResponse({ error: err.message || 'Notion query failed' }, resp.status);
        }
        const data = await resp.json();

        // Normalize Notion pages to article format
        const articles = (data.results || []).map(page => {
          const props = page.properties || {};
          return {
            id: page.id,
            title: extractNotionTitle(props),
            author: extractNotionText(props, ['Auteur', 'Author', 'auteur']),
            status: extractNotionSelect(props, ['Statut', 'Status', 'statut']) || 'draft',
            date: extractNotionDate(props, ['Date', 'date', 'Date de publication']),
            pole: extractNotionSelect(props, ['Pôle', 'Pole', 'Catégorie', 'Category', 'pôle']),
            notionUrl: page.url,
          };
        });

        return jsonResponse(articles);
      }

      // ─── Health check ───
      if (path === '/health') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
      }

      return jsonResponse({ error: 'Unknown endpoint' }, 404);

    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  }
};

// ─── Helpers ───
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function extractNotionTitle(props) {
  for (const key of Object.keys(props)) {
    if (props[key].type === 'title') {
      return props[key].title?.map(t => t.plain_text).join('') || '';
    }
  }
  return '';
}

function extractNotionText(props, keys) {
  for (const key of keys) {
    if (props[key]) {
      if (props[key].type === 'rich_text') return props[key].rich_text?.map(t => t.plain_text).join('') || '';
      if (props[key].type === 'people') return props[key].people?.map(p => p.name).join(', ') || '';
    }
  }
  return '';
}

function extractNotionSelect(props, keys) {
  for (const key of keys) {
    if (props[key]?.type === 'select') return props[key].select?.name || '';
    if (props[key]?.type === 'status') return props[key].status?.name || '';
  }
  return '';
}

function extractNotionDate(props, keys) {
  for (const key of keys) {
    if (props[key]?.type === 'date') return props[key].date?.start || '';
  }
  return '';
}
