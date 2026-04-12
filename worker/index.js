/**
 * Cloudflare Worker — API proxy pour le dashboard Institut Rousseau
 *
 * Les cl\u00e9s API sont stock\u00e9es en secrets Cloudflare (wrangler secret put).
 * Le front n'envoie jamais de credentials.
 *
 * Secrets requis :
 *   HELLOASSO_CLIENT_ID, HELLOASSO_CLIENT_SECRET, HELLOASSO_ORG_SLUG
 *   BREVO_API_KEY
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_CHANNEL_ID
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ═══════════════════════════════════════════
      // HELLOASSO
      // ═══════════════════════════════════════════

      if (path.startsWith('/api/helloasso/')) {
        const clientId = env.HELLOASSO_CLIENT_ID;
        const clientSecret = env.HELLOASSO_CLIENT_SECRET;
        const orgSlug = env.HELLOASSO_ORG_SLUG || 'institut-rousseau';

        if (!clientId || !clientSecret) {
          return json({ error: 'HelloAsso non configur\u00e9. Ajoutez HELLOASSO_CLIENT_ID et HELLOASSO_CLIENT_SECRET en secrets.' }, 503);
        }

        // OAuth token
        const tokenResp = await fetch('https://api.helloasso.com/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
        });
        if (!tokenResp.ok) {
          return json({ error: 'HelloAsso\u00a0: authentification \u00e9chou\u00e9e', status: tokenResp.status }, 401);
        }
        const { access_token } = await tokenResp.json();
        const headers = { Authorization: `Bearer ${access_token}` };

        // ─── /api/helloasso/adhesions ───
        if (path === '/api/helloasso/adhesions') {
          const pageIndex = url.searchParams.get('pageIndex') || 1;
          const pageSize = url.searchParams.get('pageSize') || 50;
          const resp = await fetch(
            `https://api.helloasso.com/v5/organizations/${orgSlug}/forms/Membership/items?pageIndex=${pageIndex}&pageSize=${pageSize}&withDetails=true`,
            { headers }
          );
          if (!resp.ok) return json({ error: `HelloAsso adhesions\u00a0: ${resp.status}` }, resp.status);
          const data = await resp.json();
          return json(normalizeHelloAssoItems(data, 'Adh\u00e9sion'));
        }

        // ─── /api/helloasso/dons ───
        if (path === '/api/helloasso/dons') {
          const pageIndex = url.searchParams.get('pageIndex') || 1;
          const pageSize = url.searchParams.get('pageSize') || 50;
          const resp = await fetch(
            `https://api.helloasso.com/v5/organizations/${orgSlug}/forms/Donation/items?pageIndex=${pageIndex}&pageSize=${pageSize}&withDetails=true`,
            { headers }
          );
          if (!resp.ok) return json({ error: `HelloAsso dons\u00a0: ${resp.status}` }, resp.status);
          const data = await resp.json();
          return json(normalizeHelloAssoItems(data, 'Don'));
        }

        // ─── /api/helloasso/members ───
        if (path === '/api/helloasso/members') {
          const pageIndex = url.searchParams.get('pageIndex') || 1;
          const pageSize = url.searchParams.get('pageSize') || 50;
          const resp = await fetch(
            `https://api.helloasso.com/v5/organizations/${orgSlug}/members?pageIndex=${pageIndex}&pageSize=${pageSize}`,
            { headers }
          );
          if (!resp.ok) return json({ error: `HelloAsso members\u00a0: ${resp.status}` }, resp.status);
          const data = await resp.json();
          return json(normalizeHelloAssoItems(data, 'Adh\u00e9sion'));
        }

        // ─── /api/helloasso/payments ───
        if (path === '/api/helloasso/payments') {
          const pageIndex = url.searchParams.get('pageIndex') || 1;
          const pageSize = url.searchParams.get('pageSize') || 50;
          const resp = await fetch(
            `https://api.helloasso.com/v5/organizations/${orgSlug}/payments?pageIndex=${pageIndex}&pageSize=${pageSize}`,
            { headers }
          );
          if (!resp.ok) return json({ error: `HelloAsso payments\u00a0: ${resp.status}` }, resp.status);
          const data = await resp.json();
          return json(normalizeHelloAssoPayments(data));
        }

        return json({ error: 'Route HelloAsso inconnue' }, 404);
      }

      // ═══════════════════════════════════════════
      // BREVO
      // ═══════════════════════════════════════════

      if (path.startsWith('/api/brevo/')) {
        const apiKey = env.BREVO_API_KEY;
        if (!apiKey) {
          return json({ error: 'Brevo non configur\u00e9. Ajoutez BREVO_API_KEY en secret.' }, 503);
        }
        const brevoHeaders = {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        };

        // ─── GET /api/brevo/contacts ───
        if (path === '/api/brevo/contacts' && request.method === 'GET') {
          const limit = url.searchParams.get('limit') || 50;
          const offset = url.searchParams.get('offset') || 0;
          const resp = await fetch(
            `https://api.brevo.com/v3/contacts?limit=${limit}&offset=${offset}`,
            { headers: brevoHeaders }
          );
          if (!resp.ok) return json({ error: `Brevo contacts\u00a0: ${resp.status}` }, resp.status);
          const data = await resp.json();
          return json({
            contacts: (data.contacts || []).map(normalizeBrevoContact),
            count: data.count || 0,
          });
        }

        // ─── POST /api/brevo/contacts ───
        if (path === '/api/brevo/contacts' && request.method === 'POST') {
          const body = await request.json();
          const resp = await fetch('https://api.brevo.com/v3/contacts', {
            method: 'POST',
            headers: brevoHeaders,
            body: JSON.stringify(body),
          });
          const data = await resp.json();
          if (!resp.ok) return json({ error: data.message || `Brevo\u00a0: ${resp.status}` }, resp.status);
          return json(data);
        }

        // ─── PUT /api/brevo/contacts/:email ───
        if (path.startsWith('/api/brevo/contacts/') && request.method === 'PUT') {
          const email = decodeURIComponent(path.split('/api/brevo/contacts/')[1]);
          const body = await request.json();
          const resp = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
            method: 'PUT',
            headers: brevoHeaders,
            body: JSON.stringify(body),
          });
          if (resp.status === 204) return json({ success: true });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) return json({ error: data.message || `Brevo\u00a0: ${resp.status}` }, resp.status);
          return json(data);
        }

        // ─── GET /api/brevo/contacts/lists ───
        if (path === '/api/brevo/contacts/lists') {
          const resp = await fetch('https://api.brevo.com/v3/contacts/lists?limit=50&offset=0', {
            headers: brevoHeaders,
          });
          if (!resp.ok) return json({ error: `Brevo listes\u00a0: ${resp.status}` }, resp.status);
          return json(await resp.json());
        }

        // ─── POST /api/brevo/email/send ───
        if (path === '/api/brevo/email/send') {
          const body = await request.json();
          const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: brevoHeaders,
            body: JSON.stringify({
              sender: body.sender || { name: 'Institut Rousseau', email: 'contact@institut-rousseau.fr' },
              to: Array.isArray(body.to) ? body.to : [{ email: body.to }],
              subject: body.subject,
              htmlContent: body.htmlContent,
            }),
          });
          const data = await resp.json();
          if (!resp.ok) return json({ error: data.message || 'Erreur envoi email' }, resp.status);
          return json(data);
        }

        // ─── GET /api/brevo/campaigns ───
        if (path === '/api/brevo/campaigns') {
          const limit = url.searchParams.get('limit') || 20;
          const offset = url.searchParams.get('offset') || 0;
          const resp = await fetch(
            `https://api.brevo.com/v3/emailCampaigns?type=classic&status=sent&limit=${limit}&offset=${offset}&sort=desc`,
            { headers: brevoHeaders }
          );
          if (!resp.ok) return json({ error: `Brevo campagnes\u00a0: ${resp.status}` }, resp.status);
          const data = await resp.json();
          return json({
            campaigns: (data.campaigns || []).map(c => ({
              id: c.id,
              name: c.name,
              subject: c.subject,
              status: c.status,
              date: c.sentDate || c.scheduledAt || c.createdAt,
              recipients: c.statistics?.globalStats?.sent || c.recipients?.count || 0,
              openRate: c.statistics?.globalStats?.uniqueOpens != null
                ? Math.round((c.statistics.globalStats.uniqueOpens / (c.statistics.globalStats.sent || 1)) * 100)
                : null,
              clickRate: c.statistics?.globalStats?.uniqueClicks != null
                ? Math.round((c.statistics.globalStats.uniqueClicks / (c.statistics.globalStats.sent || 1)) * 100)
                : null,
            })),
            count: data.count || 0,
          });
        }

        return json({ error: 'Route Brevo inconnue' }, 404);
      }

      // ═══════════════════════════════════════════
      // TELEGRAM
      // ═══════════════════════════════════════════

      if (path.startsWith('/api/telegram/')) {
        const botToken = env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
          return json({ error: 'Telegram non configur\u00e9. Ajoutez TELEGRAM_BOT_TOKEN en secret.' }, 503);
        }

        // ─── POST /api/telegram/send ───
        if (path === '/api/telegram/send') {
          const { chatId, text } = await request.json();
          const targetChat = chatId || env.TELEGRAM_CHAT_ID;
          if (!targetChat) return json({ error: 'Chat ID manquant' }, 400);
          const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: targetChat, text, parse_mode: 'HTML' }),
          });
          const data = await resp.json();
          if (!resp.ok) return json({ error: data.description || 'Erreur Telegram' }, resp.status);
          return json(data);
        }

        // ─── POST /api/telegram/send-channel ───
        if (path === '/api/telegram/send-channel') {
          const { text } = await request.json();
          const channelId = env.TELEGRAM_CHANNEL_ID;
          if (!channelId) return json({ error: 'Channel ID non configur\u00e9' }, 400);
          const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: channelId, text, parse_mode: 'HTML' }),
          });
          const data = await resp.json();
          if (!resp.ok) return json({ error: data.description || 'Erreur Telegram' }, resp.status);
          return json(data);
        }

        return json({ error: 'Route Telegram inconnue' }, 404);
      }

      // ═══════════════════════════════════════════
      // HEALTH
      // ═══════════════════════════════════════════

      if (path === '/health' || path === '/api/health') {
        return json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          services: {
            helloasso: !!(env.HELLOASSO_CLIENT_ID && env.HELLOASSO_CLIENT_SECRET),
            brevo: !!env.BREVO_API_KEY,
            telegram: !!env.TELEGRAM_BOT_TOKEN,
          },
        });
      }

      // ═══════════════════════════════════════════
      // LEGACY ROUTES (compatibilit\u00e9 avec l'ancien front)
      // ═══════════════════════════════════════════

      if (path === '/helloasso/members' || path === '/helloasso/donations') {
        const body = await request.json();
        const clientId = body.clientId || env.HELLOASSO_CLIENT_ID;
        const clientSecret = body.clientSecret || env.HELLOASSO_CLIENT_SECRET;
        const orgSlug = body.orgSlug || env.HELLOASSO_ORG_SLUG || 'institut-rousseau';

        const tokenResp = await fetch('https://api.helloasso.com/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
        });
        if (!tokenResp.ok) return json({ error: 'HelloAsso auth failed' }, 401);
        const { access_token } = await tokenResp.json();

        const endpoint = path.includes('donations') ? 'payments' : 'members';
        const dataResp = await fetch(
          `https://api.helloasso.com/v5/organizations/${orgSlug}/${endpoint}?pageSize=100`,
          { headers: { Authorization: `Bearer ${access_token}` } }
        );
        if (!dataResp.ok) return json({ error: `HelloAsso ${endpoint} failed` }, dataResp.status);
        const data = await dataResp.json();
        return json(normalizeHelloAssoPayments(data));
      }

      if (path === '/brevo/send') {
        const body = await request.json();
        const apiKey = body.apiKey || env.BREVO_API_KEY;
        const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: body.sender || { name: 'Institut Rousseau', email: 'contact@institut-rousseau.fr' },
            to: Array.isArray(body.to) ? body.to : [{ email: body.to }],
            subject: body.subject,
            htmlContent: body.htmlContent,
          }),
        });
        const data = await resp.json();
        if (!resp.ok) return json({ error: 'Brevo send failed', details: data }, resp.status);
        return json(data);
      }

      return json({ error: 'Route inconnue', path }, 404);

    } catch (err) {
      return json({ error: err.message || 'Erreur interne' }, 500);
    }
  },
};

// ═══ Helpers ═══════════════════════════════════════

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function normalizeHelloAssoItems(apiResponse, type) {
  const items = apiResponse.data || apiResponse.items || [];
  const pagination = apiResponse.pagination || {};
  return {
    items: items.map(item => {
      const payer = item.payer || item.user || {};
      return {
        id: `ha-${item.id}`,
        name: `${payer.firstName || ''} ${payer.lastName || ''}`.trim() || 'Anonyme',
        firstName: payer.firstName || '',
        lastName: payer.lastName || '',
        email: (payer.email || '').toLowerCase(),
        phone: payer.phone || '',
        date: item.order?.date?.slice(0, 10) || item.date?.slice(0, 10) || '',
        amount: item.amount ? item.amount / 100 : item.initialAmount ? item.initialAmount / 100 : 0,
        type,
        status: item.state === 'Processed' || item.state === 'Authorized' ? 'actif' : 'en_attente',
        source: 'HelloAsso',
        helloassoId: String(item.id),
        formName: item.name || '',
      };
    }).filter(c => c.email),
    pagination: {
      totalCount: pagination.totalCount || items.length,
      pageIndex: pagination.pageIndex || 1,
      pageSize: pagination.pageSize || 50,
      totalPages: pagination.totalPages || 1,
    },
  };
}

function normalizeHelloAssoPayments(apiResponse) {
  const items = apiResponse.data || [];
  return items.map(p => ({
    id: `ha-${p.id}`,
    name: `${p.payer?.firstName || ''} ${p.payer?.lastName || ''}`.trim() || 'Anonyme',
    email: (p.payer?.email || '').toLowerCase(),
    amount: p.amount ? p.amount / 100 : 0,
    date: p.date?.slice(0, 10) || '',
    type: p.paymentType === 'Donation' ? 'Don' : 'Adh\u00e9sion',
    status: p.state === 'Authorized' ? 'actif' : 'en_attente',
    source: 'HelloAsso',
  })).filter(c => c.email);
}

function normalizeBrevoContact(c) {
  const attrs = c.attributes || {};
  return {
    id: c.id,
    name: (attrs.PRENOM || attrs.NOM)
      ? `${attrs.PRENOM || ''} ${attrs.NOM || ''}`.trim()
      : c.email.split('@')[0],
    firstName: attrs.PRENOM || '',
    lastName: attrs.NOM || '',
    email: c.email,
    date: c.createdAt?.split('T')[0] || '',
    status: c.emailBlacklisted ? 'rejected' : 'added',
    source: attrs.SOURCE || 'Brevo',
    lists: c.listIds || [],
  };
}
