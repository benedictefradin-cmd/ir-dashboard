/**
 * Cloudflare Worker — API proxy pour le dashboard Institut Rousseau
 *
 * Les clés API sont stockées en secrets Cloudflare (wrangler secret put).
 * Le front n'envoie jamais de credentials.
 *
 * Secrets requis :
 *   BREVO_API_KEY
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_CHANNEL_ID
 *
 * KV Namespace:
 *   CONTACT_SUBMISSIONS  — stockage des sollicitations du formulaire de contact
 *
 * Secrets supplémentaires (optionnels):
 *   CONTACT_AUTH_TOKEN    — Bearer token pour les endpoints back-office
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Notion-Token, X-Notion-Database-Id, X-GitHub-Token, X-GitHub-Owner, X-GitHub-Repo',
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
      // BREVO
      // ═══════════════════════════════════════════

      if (path.startsWith('/api/brevo/')) {
        const apiKey = env.BREVO_API_KEY;
        if (!apiKey) {
          return json({ error: 'Brevo non configuré. Ajoutez BREVO_API_KEY en secret.' }, 503);
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
          if (!resp.ok) return json({ error: `Brevo contacts : ${resp.status}` }, resp.status);
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
          if (!resp.ok) return json({ error: data.message || `Brevo : ${resp.status}` }, resp.status);
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
          if (!resp.ok) return json({ error: data.message || `Brevo : ${resp.status}` }, resp.status);
          return json(data);
        }

        // ─── GET /api/brevo/contacts/lists ───
        if (path === '/api/brevo/contacts/lists') {
          const resp = await fetch('https://api.brevo.com/v3/contacts/lists?limit=50&offset=0', {
            headers: brevoHeaders,
          });
          if (!resp.ok) return json({ error: `Brevo listes : ${resp.status}` }, resp.status);
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
          if (!resp.ok) return json({ error: `Brevo campagnes : ${resp.status}` }, resp.status);
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
          return json({ error: 'Telegram non configuré. Ajoutez TELEGRAM_BOT_TOKEN en secret.' }, 503);
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
          if (!channelId) return json({ error: 'Channel ID non configuré' }, 400);
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
      // CONTACT / SOLLICITATIONS
      // ═══════════════════════════════════════════

      if (path.startsWith('/api/contact')) {
        // ─── POST /api/contact ─── (formulaire public)
        if (path === '/api/contact' && request.method === 'POST') {
          if (!env.CONTACT_SUBMISSIONS) {
            return json({ error: 'KV CONTACT_SUBMISSIONS non configuré' }, 503);
          }

          const body = await request.json();

          // Honeypot anti-spam
          if (body.website) return json({ success: true }, 200);

          // Validation
          if (!body.name || !body.email || !body.subject || !body.message || !body.consent) {
            return json({ error: 'Champs obligatoires manquants' }, 400);
          }

          // Rate limiting basique par IP (5/h)
          const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
          const rlKey = `_rl_${ip}_${Math.floor(Date.now() / 3600000)}`;
          const rlCount = parseInt(await env.CONTACT_SUBMISSIONS.get(rlKey) || '0');
          if (rlCount >= 5) {
            return json({ error: 'Trop de soumissions. Réessayez plus tard.' }, 429);
          }
          await env.CONTACT_SUBMISSIONS.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

          // Générer ID unique
          const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

          const submission = {
            id,
            name: body.name,
            email: body.email,
            organization: body.organization || '',
            phone: body.phone || '',
            subject: body.subject,
            message: body.message,
            consent: body.consent,
            submitted_at: new Date().toISOString(),
            source_page: body.source_page || '/contact',
            user_agent: request.headers.get('User-Agent') || '',
            status: 'new',
            assigned_to: null,
            priority: 'normal',
            internal_notes: [],
            replies: [],
            tags: [],
            updated_at: new Date().toISOString(),
            resolved_at: null,
          };

          // Stocker dans KV
          await env.CONTACT_SUBMISSIONS.put(id, JSON.stringify(submission));

          // Index
          const index = JSON.parse(await env.CONTACT_SUBMISSIONS.get('_index') || '[]');
          index.unshift({ id, submitted_at: submission.submitted_at, subject: submission.subject, status: 'new' });
          await env.CONTACT_SUBMISSIONS.put('_index', JSON.stringify(index));

          // Notification email via Brevo
          if (env.BREVO_API_KEY) {
            try {
              await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sender: { name: 'Institut Rousseau', email: 'contact@institut-rousseau.fr' },
                  to: [{ email: 'contact@institut-rousseau.fr' }],
                  subject: `[Nouveau contact] ${submission.subject} — ${submission.name}`,
                  htmlContent: `<h3>Nouvelle sollicitation</h3><p><strong>Nom :</strong> ${submission.name}</p><p><strong>Email :</strong> ${submission.email}</p><p><strong>Organisation :</strong> ${submission.organization || '—'}</p><p><strong>Objet :</strong> ${submission.subject}</p><hr/><p>${submission.message.replace(/\n/g, '<br/>')}</p>`,
                }),
              });
            } catch { /* notification non bloquante */ }
          }

          // Notification Telegram
          if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
            try {
              await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: env.TELEGRAM_CHAT_ID,
                  text: `📬 <b>Nouvelle sollicitation</b>\n\n<b>${submission.name}</b> (${submission.subject})\n${submission.organization ? submission.organization + '\n' : ''}${submission.email}\n\n${submission.message.slice(0, 200)}${submission.message.length > 200 ? '…' : ''}`,
                  parse_mode: 'HTML',
                }),
              });
            } catch { /* notification non bloquante */ }
          }

          return json({ success: true, id }, 201);
        }

        // ── Auth check pour les endpoints back-office ──
        const authToken = env.CONTACT_AUTH_TOKEN;
        if (authToken) {
          const authHeader = request.headers.get('Authorization') || '';
          if (authHeader !== `Bearer ${authToken}`) {
            return json({ error: 'Non autorisé' }, 401);
          }
        }

        if (!env.CONTACT_SUBMISSIONS) {
          return json({ error: 'KV CONTACT_SUBMISSIONS non configuré' }, 503);
        }

        // ─── GET /api/contact/list ─── (back-office)
        if (path === '/api/contact/list' && request.method === 'GET') {
          const index = JSON.parse(await env.CONTACT_SUBMISSIONS.get('_index') || '[]');

          let filtered = [...index];

          // Filtrage par statut
          const statusFilter = url.searchParams.get('status');
          if (statusFilter) {
            filtered = filtered.filter(i => i.status === statusFilter);
          }

          // Filtrage par sujet
          const subjectFilter = url.searchParams.get('subject');
          if (subjectFilter) {
            filtered = filtered.filter(i => i.subject === subjectFilter);
          }

          // Pagination
          const page = parseInt(url.searchParams.get('page') || '1');
          const limit = parseInt(url.searchParams.get('limit') || '20');
          const total = filtered.length;
          const pages = Math.max(1, Math.ceil(total / limit));
          const pageItems = filtered.slice((page - 1) * limit, page * limit);

          // Charger les objets complets
          const items = await Promise.all(
            pageItems.map(async (entry) => {
              const data = await env.CONTACT_SUBMISSIONS.get(entry.id);
              return data ? JSON.parse(data) : null;
            })
          );

          // Recherche full-text (côté Worker après chargement)
          const searchTerm = url.searchParams.get('search');
          let results = items.filter(Boolean);
          if (searchTerm) {
            const q = searchTerm.toLowerCase();
            results = results.filter(s =>
              (s.name && s.name.toLowerCase().includes(q)) ||
              (s.email && s.email.toLowerCase().includes(q)) ||
              (s.organization && s.organization.toLowerCase().includes(q)) ||
              (s.message && s.message.toLowerCase().includes(q))
            );
          }

          return json({ items: results, total, page, pages });
        }

        // ─── GET /api/contact/:id ─── (détail)
        const idMatch = path.match(/^\/api\/contact\/([^/]+)$/);
        if (idMatch && request.method === 'GET') {
          const id = decodeURIComponent(idMatch[1]);
          const data = await env.CONTACT_SUBMISSIONS.get(id);
          if (!data) return json({ error: 'Sollicitation non trouvée' }, 404);
          return json(JSON.parse(data));
        }

        // ─── PATCH /api/contact/:id ─── (mise à jour)
        if (idMatch && request.method === 'PATCH') {
          const id = decodeURIComponent(idMatch[1]);
          const existing = await env.CONTACT_SUBMISSIONS.get(id);
          if (!existing) return json({ error: 'Sollicitation non trouvée' }, 404);

          const item = JSON.parse(existing);
          const updates = await request.json();

          // Merger les champs
          if (updates.status !== undefined) item.status = updates.status;
          if (updates.assigned_to !== undefined) item.assigned_to = updates.assigned_to;
          if (updates.priority !== undefined) item.priority = updates.priority;
          if (updates.tags !== undefined) item.tags = updates.tags;
          if (updates.internal_notes !== undefined) item.internal_notes = updates.internal_notes;

          // Si ajout d'une note individuelle
          if (updates.add_note) {
            item.internal_notes.push({
              ...updates.add_note,
              date: updates.add_note.date || new Date().toISOString(),
            });
          }

          item.updated_at = new Date().toISOString();
          if (updates.status === 'resolved' && !item.resolved_at) {
            item.resolved_at = new Date().toISOString();
          }

          await env.CONTACT_SUBMISSIONS.put(id, JSON.stringify(item));

          // Mettre à jour l'index aussi
          const index = JSON.parse(await env.CONTACT_SUBMISSIONS.get('_index') || '[]');
          const idx = index.findIndex(e => e.id === id);
          if (idx !== -1) {
            index[idx].status = item.status;
            await env.CONTACT_SUBMISSIONS.put('_index', JSON.stringify(index));
          }

          return json(item);
        }

        // ─── POST /api/contact/:id/reply ─── (envoi réponse email)
        const replyMatch = path.match(/^\/api\/contact\/([^/]+)\/reply$/);
        if (replyMatch && request.method === 'POST') {
          const id = decodeURIComponent(replyMatch[1]);
          const existing = await env.CONTACT_SUBMISSIONS.get(id);
          if (!existing) return json({ error: 'Sollicitation non trouvée' }, 404);

          const item = JSON.parse(existing);
          const { text, sent_by } = await request.json();

          if (!text) return json({ error: 'Texte de la réponse manquant' }, 400);

          // Envoyer email via Brevo
          if (env.BREVO_API_KEY && item.email) {
            try {
              await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sender: { name: 'Institut Rousseau', email: 'contact@institut-rousseau.fr' },
                  to: [{ email: item.email, name: item.name }],
                  subject: `Re: ${item.subject}`,
                  htmlContent: `<p>${text.replace(/\n/g, '<br/>')}</p><hr/><p><em>Institut Rousseau — <a href="https://institut-rousseau.fr">institut-rousseau.fr</a></em></p>`,
                }),
              });
            } catch (err) {
              return json({ error: 'Erreur lors de l\'envoi de l\'email' }, 500);
            }
          }

          // Enregistrer la réponse
          const reply = {
            text,
            sent_by: sent_by || 'Admin',
            sent_at: new Date().toISOString(),
          };
          item.replies.push(reply);

          // Note dans l'historique
          item.internal_notes.push({
            type: 'reply_sent',
            text: `Réponse envoyée par ${reply.sent_by}`,
            date: reply.sent_at,
            author: reply.sent_by,
          });

          // Passer en résolu automatiquement
          item.status = 'resolved';
          item.resolved_at = new Date().toISOString();
          item.updated_at = new Date().toISOString();

          await env.CONTACT_SUBMISSIONS.put(id, JSON.stringify(item));

          // Mettre à jour l'index
          const index = JSON.parse(await env.CONTACT_SUBMISSIONS.get('_index') || '[]');
          const idx = index.findIndex(e => e.id === id);
          if (idx !== -1) {
            index[idx].status = item.status;
            await env.CONTACT_SUBMISSIONS.put('_index', JSON.stringify(index));
          }

          return json(item);
        }

        // ─── DELETE /api/contact/:id ─── (soft delete → archived)
        if (idMatch && request.method === 'DELETE') {
          const id = decodeURIComponent(idMatch[1]);
          const existing = await env.CONTACT_SUBMISSIONS.get(id);
          if (!existing) return json({ error: 'Sollicitation non trouvée' }, 404);

          const item = JSON.parse(existing);
          item.status = 'archived';
          item.updated_at = new Date().toISOString();
          await env.CONTACT_SUBMISSIONS.put(id, JSON.stringify(item));

          // Mettre à jour l'index
          const index = JSON.parse(await env.CONTACT_SUBMISSIONS.get('_index') || '[]');
          const idx = index.findIndex(e => e.id === id);
          if (idx !== -1) {
            index[idx].status = 'archived';
            await env.CONTACT_SUBMISSIONS.put('_index', JSON.stringify(index));
          }

          return json({ success: true });
        }

        return json({ error: 'Route contact inconnue' }, 404);
      }

      // ═══════════════════════════════════════════
      // NOTION
      // ═══════════════════════════════════════════

      if (path.startsWith('/api/notion/')) {
        const notionToken = request.headers.get('X-Notion-Token');
        const databaseId = request.headers.get('X-Notion-Database-Id');

        if (!notionToken) {
          return json({ error: 'Token Notion manquant. Configurez-le dans les paramètres.' }, 400);
        }

        const notionHeaders = {
          'Authorization': `Bearer ${notionToken}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        };

        // ─── GET /api/notion/articles ───
        if (path === '/api/notion/articles' && request.method === 'GET') {
          if (!databaseId) {
            return json({ error: 'ID de base Notion manquant.' }, 400);
          }

          let allResults = [];
          let hasMore = true;
          let startCursor = undefined;

          while (hasMore) {
            const body = {
              sorts: [{ property: 'Dernière modif.', direction: 'descending' }],
              page_size: 100,
            };
            if (startCursor) body.start_cursor = startCursor;

            const resp = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
              method: 'POST',
              headers: notionHeaders,
              body: JSON.stringify(body),
            });
            if (!resp.ok) {
              const err = await resp.json().catch(() => ({}));
              return json({ error: err.message || `Notion : ${resp.status}` }, resp.status);
            }
            const data = await resp.json();
            allResults = allResults.concat(data.results || []);
            hasMore = data.has_more || false;
            startCursor = data.next_cursor;
          }

          const articles = allResults.map(page => {
            const props = page.properties || {};
            return {
              id: page.id,
              title: extractTitle(props['Titre'] || props['Title'] || props['Name']),
              status: extractStatus(props['Statut'] || props['Status']),
              pole: extractSelect(props['Pôle'] || props['Pole']),
              type: extractSelect(props['Type']),
              authors: extractText(props['Auteur(s)'] || props['Auteurs'] || props['Author']),
              summary: extractText(props['Résumé'] || props['Resume']),
              slug: extractText(props['Slug']),
              publishDate: extractDate(props['Date de publication'] || props['Publish Date']),
              lastEdited: page.last_edited_time,
              featured: extractCheckbox(props['Mis en avant'] || props['Featured']),
              mediaSource: extractText(props['Média source'] || props['Media Source']),
              externalUrl: extractUrl(props['URL externe'] || props['External URL']),
            };
          });

          return json({ articles, total: articles.length });
        }

        // ─── GET /api/notion/articles/:id/content ───
        const contentMatch = path.match(/^\/api\/notion\/articles\/([^/]+)\/content$/);
        if (contentMatch && request.method === 'GET') {
          const pageId = decodeURIComponent(contentMatch[1]);
          let allBlocks = [];
          let hasMore = true;
          let startCursor = undefined;

          while (hasMore) {
            const qs = startCursor ? `?page_size=100&start_cursor=${startCursor}` : '?page_size=100';
            const resp = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children${qs}`, {
              headers: notionHeaders,
            });
            if (!resp.ok) {
              const err = await resp.json().catch(() => ({}));
              return json({ error: err.message || `Notion blocks : ${resp.status}` }, resp.status);
            }
            const data = await resp.json();
            allBlocks = allBlocks.concat(data.results || []);
            hasMore = data.has_more || false;
            startCursor = data.next_cursor;
          }

          const html = blocksToHtml(allBlocks);
          const wordCount = html.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
          return json({ html, wordCount });
        }

        // ─── PATCH /api/notion/articles/:id/status ───
        const statusMatch = path.match(/^\/api\/notion\/articles\/([^/]+)\/status$/);
        if (statusMatch && request.method === 'PATCH') {
          const pageId = decodeURIComponent(statusMatch[1]);
          const body = await request.json();
          const properties = {};

          if (body.status) {
            properties['Statut'] = { status: { name: body.status } };
          }
          if (body.publishDate) {
            properties['Date de publication'] = { date: { start: body.publishDate } };
          }
          if (body.authors) {
            properties['Auteur(s)'] = { rich_text: [{ text: { content: body.authors } }] };
          }

          const resp = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
            method: 'PATCH',
            headers: notionHeaders,
            body: JSON.stringify({ properties }),
          });
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            return json({ error: err.message || `Notion update : ${resp.status}` }, resp.status);
          }
          return json({ success: true });
        }

        return json({ error: 'Route Notion inconnue' }, 404);
      }

      // ═══════════════════════════════════════════
      // GITHUB — Site data & publish
      // ═══════════════════════════════════════════

      if (path.startsWith('/api/github/')) {
        const githubToken = request.headers.get('X-GitHub-Token');
        const owner = request.headers.get('X-GitHub-Owner');
        const repo = request.headers.get('X-GitHub-Repo');

        if (!githubToken) {
          return json({ error: 'Token GitHub manquant.' }, 400);
        }

        const githubHeaders = {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        };

        // ─── GET /api/github/data/:file ─── (lire un fichier JSON du site)
        const dataMatch = path.match(/^\/api\/github\/data\/(.+)$/);
        if (dataMatch && request.method === 'GET') {
          if (!owner || !repo) return json({ error: 'Owner ou repo GitHub manquant.' }, 400);
          const fileName = decodeURIComponent(dataMatch[1]);
          const allowed = ['publications.json', 'events.json', 'presse.json', 'auteurs.json'];
          if (!allowed.includes(fileName)) return json({ error: 'Fichier non autorisé.' }, 403);

          const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/data/${fileName}`;
          const resp = await fetch(apiUrl, { headers: githubHeaders });
          if (!resp.ok) return json({ error: `GitHub : ${resp.status}` }, resp.status);
          const file = await resp.json();
          const content = decodeURIComponent(escape(atob(file.content.replace(/\n/g, ''))));
          return json({ data: JSON.parse(content), sha: file.sha });
        }

        // ─── PUT /api/github/data/:file ─── (écrire un fichier JSON du site)
        if (dataMatch && request.method === 'PUT') {
          if (!owner || !repo) return json({ error: 'Owner ou repo GitHub manquant.' }, 400);
          const fileName = decodeURIComponent(dataMatch[1]);
          const allowed = ['publications.json', 'events.json', 'presse.json', 'auteurs.json'];
          if (!allowed.includes(fileName)) return json({ error: 'Fichier non autorisé.' }, 403);

          const body = await request.json();
          if (!body.data) return json({ error: 'Données manquantes (champ "data" requis).' }, 400);

          const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/data/${fileName}`;

          // Récupérer le SHA actuel
          let currentSha = body.sha || null;
          if (!currentSha) {
            const checkResp = await fetch(apiUrl, { headers: githubHeaders });
            if (checkResp.ok) {
              const existing = await checkResp.json();
              currentSha = existing.sha;
            }
          }

          const content = btoa(unescape(encodeURIComponent(JSON.stringify(body.data, null, 2))));
          const putBody = {
            message: body.message || `Mise à jour ${fileName} depuis le back-office`,
            content,
            branch: 'main',
          };
          if (currentSha) putBody.sha = currentSha;

          const putResp = await fetch(apiUrl, {
            method: 'PUT',
            headers: githubHeaders,
            body: JSON.stringify(putBody),
          });

          if (!putResp.ok) {
            const err = await putResp.json().catch(() => ({}));
            return json({ error: err.message || `GitHub : ${putResp.status}` }, putResp.status);
          }
          const result = await putResp.json();
          return json({ success: true, sha: result.content?.sha });
        }

        // ─── POST /api/github/publish ───
        if (path === '/api/github/publish' && request.method === 'POST') {
          if (!owner || !repo) {
            return json({ error: 'Owner ou repo GitHub manquant.' }, 400);
          }

          const body = await request.json();
          const { slug, html, metadata, commitMessage } = body;

          if (!slug || !html) {
            return json({ error: 'Slug et HTML requis.' }, 400);
          }

          const filePath = `publications/${slug}.html`;
          const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

          // Check if file exists (get SHA for update)
          let existingSha = null;
          const checkResp = await fetch(apiUrl, { headers: githubHeaders });
          if (checkResp.ok) {
            const existing = await checkResp.json();
            existingSha = existing.sha;
          }

          // Create or update file
          const content = btoa(unescape(encodeURIComponent(html)));
          const putBody = {
            message: commitMessage || `Publish: ${metadata?.title || slug}`,
            content,
            branch: 'main',
          };
          if (existingSha) putBody.sha = existingSha;

          const putResp = await fetch(apiUrl, {
            method: 'PUT',
            headers: githubHeaders,
            body: JSON.stringify(putBody),
          });

          if (!putResp.ok) {
            const err = await putResp.json().catch(() => ({}));
            return json({ error: err.message || `GitHub : ${putResp.status}` }, putResp.status);
          }

          const result = await putResp.json();
          return json({
            success: true,
            sha: result.content?.sha,
            url: result.content?.html_url,
            path: filePath,
          });
        }

        // ─── GET /api/github/check/:slug ───
        const checkMatch = path.match(/^\/api\/github\/check\/(.+)$/);
        if (checkMatch && request.method === 'GET') {
          if (!owner || !repo) {
            return json({ error: 'Owner ou repo GitHub manquant.' }, 400);
          }
          const slug = decodeURIComponent(checkMatch[1]);
          const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/publications/${slug}.html`;
          const resp = await fetch(apiUrl, { headers: githubHeaders });
          return json({ exists: resp.ok });
        }

        return json({ error: 'Route GitHub inconnue' }, 404);
      }

      // ═══════════════════════════════════════════
      // HEALTH
      // ═══════════════════════════════════════════

      if (path === '/health' || path === '/api/health') {
        return json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          services: {
            brevo: !!env.BREVO_API_KEY,
            telegram: !!env.TELEGRAM_BOT_TOKEN,
            github: true,
          },
        });
      }

      // ═══════════════════════════════════════════
      // LEGACY ROUTES (compatibilité avec l'ancien front)
      // ═══════════════════════════════════════════

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

// ═══ Notion property extractors ══════════════════════

function extractTitle(prop) {
  if (!prop) return '';
  if (prop.title) return prop.title.map(t => t.plain_text || '').join('');
  return '';
}

function extractText(prop) {
  if (!prop) return '';
  if (prop.rich_text) return prop.rich_text.map(t => t.plain_text || '').join('');
  return '';
}

function extractSelect(prop) {
  if (!prop) return '';
  if (prop.select) return prop.select.name || '';
  return '';
}

function extractStatus(prop) {
  if (!prop) return '';
  if (prop.status) return prop.status.name || '';
  return '';
}

function extractDate(prop) {
  if (!prop) return null;
  if (prop.date) return prop.date.start || null;
  return null;
}

function extractCheckbox(prop) {
  if (!prop) return false;
  if (prop.checkbox !== undefined) return prop.checkbox;
  return false;
}

function extractUrl(prop) {
  if (!prop) return null;
  if (prop.url !== undefined) return prop.url;
  return null;
}

// ═══ Notion blocks → HTML converter ═════════════════

function richTextToHtml(richTexts) {
  if (!richTexts || !richTexts.length) return '';
  return richTexts.map(rt => {
    let text = rt.plain_text || '';
    if (!text) return '';
    // Escape HTML
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const a = rt.annotations || {};
    if (a.bold) text = `<strong>${text}</strong>`;
    if (a.italic) text = `<em>${text}</em>`;
    if (a.code) text = `<code>${text}</code>`;
    if (a.underline) text = `<u>${text}</u>`;
    if (a.strikethrough) text = `<s>${text}</s>`;
    if (rt.href) text = `<a href="${rt.href}" target="_blank" rel="noopener">${text}</a>`;
    return text;
  }).join('');
}

function blocksToHtml(blocks) {
  let html = '';
  let inUl = false;
  let inOl = false;

  for (const block of blocks) {
    const type = block.type;

    // Close open lists if needed
    if (type !== 'bulleted_list_item' && inUl) { html += '</ul>'; inUl = false; }
    if (type !== 'numbered_list_item' && inOl) { html += '</ol>'; inOl = false; }

    switch (type) {
      case 'paragraph':
        html += `<p>${richTextToHtml(block.paragraph?.rich_text)}</p>`;
        break;
      case 'heading_1':
        html += `<h1>${richTextToHtml(block.heading_1?.rich_text)}</h1>`;
        break;
      case 'heading_2':
        html += `<h2>${richTextToHtml(block.heading_2?.rich_text)}</h2>`;
        break;
      case 'heading_3':
        html += `<h3>${richTextToHtml(block.heading_3?.rich_text)}</h3>`;
        break;
      case 'bulleted_list_item':
        if (!inUl) { html += '<ul>'; inUl = true; }
        html += `<li>${richTextToHtml(block.bulleted_list_item?.rich_text)}</li>`;
        break;
      case 'numbered_list_item':
        if (!inOl) { html += '<ol>'; inOl = true; }
        html += `<li>${richTextToHtml(block.numbered_list_item?.rich_text)}</li>`;
        break;
      case 'quote':
        html += `<blockquote>${richTextToHtml(block.quote?.rich_text)}</blockquote>`;
        break;
      case 'divider':
        html += '<hr/>';
        break;
      case 'image': {
        const imgUrl = block.image?.file?.url || block.image?.external?.url || '';
        const caption = block.image?.caption ? richTextToHtml(block.image.caption) : '';
        if (imgUrl) {
          html += `<figure><img src="${imgUrl}" alt="${caption.replace(/<[^>]*>/g, '')}"/>${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
        }
        break;
      }
      case 'code':
        html += `<pre><code>${richTextToHtml(block.code?.rich_text)}</code></pre>`;
        break;
      case 'callout':
        html += `<aside class="callout">${richTextToHtml(block.callout?.rich_text)}</aside>`;
        break;
      case 'toggle':
        html += `<details><summary>${richTextToHtml(block.toggle?.rich_text)}</summary></details>`;
        break;
      default:
        break;
    }
  }

  if (inUl) html += '</ul>';
  if (inOl) html += '</ol>';

  return html;
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
