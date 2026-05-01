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

// ─── CORS — allowlist d'origines (cf. AUDIT §4.4) ───
// Origin: * était permissif au point que tout site malveillant pouvait
// adresser le Worker. On échoit l'Origin uniquement si elle figure dans
// la liste blanche. Les endpoints publics (formulaire de contact) restent
// joignables — l'auth Bearer protège déjà les endpoints sensibles.
const ALLOWED_ORIGINS = [
  'https://benedictefradin-cmd.github.io',
  'https://institut-rousseau.fr',
  'https://www.institut-rousseau.fr',
];
const ALLOWED_ORIGIN_PATTERNS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

function pickAllowedOrigin(origin) {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (ALLOWED_ORIGIN_PATTERNS.some(rx => rx.test(origin))) return origin;
  return null;
}

function corsHeaders(request) {
  const origin = pickAllowedOrigin(request.headers.get('Origin'));
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Notion-Token, X-Notion-Database-Id, X-GitHub-Token, X-GitHub-Owner, X-GitHub-Repo, X-GitHub-User-Token',
    'Vary': 'Origin',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

// Headers CORS de méthodes/headers (toujours présents). L'Allow-Origin est
// décidé dynamiquement via `pickAllowedOrigin` puis injecté dans le wrapper
// fetch() ci-dessous (préflight + post-handler).
const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Notion-Token, X-Notion-Database-Id, X-GitHub-Token, X-GitHub-Owner, X-GitHub-Repo, X-GitHub-User-Token',
};

// Encode des bytes UTF-8 en base64 sans planter sur les gros payloads.
// `String.fromCharCode(...utf8)` lève "Maximum call stack size exceeded" dès
// ~100 ko (limite du nombre d'arguments du spread). On chunke par 8 ko.
function utf8ToBase64(bytes) {
  let bin = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    const response = await handle(request, env).catch(err => json({ error: err.message || 'Erreur interne' }, 500));
    // Injecte les headers CORS sur la réponse finale (sans toucher 134 appels à json()).
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return new Response(response.body, { status: response.status, headers });
  },
};

async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // ═══════════════════════════════════════════
  // SITE PROXY — sert le site institut-rousseau dans une iframe
  // depuis le dashboard, en injectant un mode édition cliquable.
  //
  // Pourquoi : le site déployé envoie `X-Frame-Options: DENY`. On ne peut
  // donc pas iframe-er https://institut-rousseau.fr depuis le dashboard.
  // Ce proxy va chercher la page, retire XFO, ajoute une CSP qui n'autorise
  // QUE notre dashboard à iframe-er, et — si `?edit=1` — injecte un petit
  // script qui surligne les `[data-i18n]`, capture les clics et les
  // postMessage-e vers le parent (le dashboard).
  //
  // Pas d'auth sur le proxy lui-même : la page servie est publique de toute
  // façon, et la CSP frame-ancestors empêche un site tiers de l'iframe-er.
  // Les vraies modifications passent par les autres routes du Worker, qui
  // restent gardées par la session OAuth GitHub.
  // ═══════════════════════════════════════════

  if (path.startsWith('/site-proxy/')) {
    return handleSiteProxy(url, env);
  }

  try {

      // ═══════════════════════════════════════════
      // AUTH — comptes utilisateurs (PBKDF2 + sessions KV)
      // ═══════════════════════════════════════════

      if (path.startsWith('/api/auth/')) {
        if (!env.CONTACT_SUBMISSIONS) {
          return json({ error: 'KV non configuré' }, 503);
        }
        const kv = env.CONTACT_SUBMISSIONS;

        // ═══════════════════════════════════════════
        // OAuth GitHub — start + callback
        //
        // Modèle : redirect-with-token (le navigateur de l'utilisateur fait
        // l'aller-retour, jamais d'AJAX vers github.com depuis le front).
        //
        // 1) GET /api/auth/github/start?redirect=<dashboard_url>
        //    → 302 vers github.com/login/oauth/authorize avec state anti-CSRF
        //      (stocké 5 min en KV).
        // 2) GitHub redirige vers /api/auth/github/callback?code=…&state=…
        // 3) Le Worker échange code → access_token, lit /user pour vérifier
        //    le login dans ALLOWED_GITHUB_USERS, puis 302 vers le dashboard
        //    avec le token + login en hash params (lus + effacés côté front).
        // ═══════════════════════════════════════════

        if (path === '/api/auth/github/start' && request.method === 'GET') {
          if (!env.GITHUB_OAUTH_CLIENT_ID) {
            return json({ error: 'OAuth non configuré (GITHUB_OAUTH_CLIENT_ID manquant).' }, 503);
          }
          const dashboardRedirect = url.searchParams.get('redirect') || '';
          const state = randomToken(16);
          // Stocke l'URL de retour souhaitée + état dans KV (TTL 5 min)
          await kv.put(`auth:oauth_state:${state}`, JSON.stringify({ dashboardRedirect }), {
            expirationTtl: 300,
          });
          const callbackUrl = `${url.origin}/api/auth/github/callback`;
          const ghAuth = new URL('https://github.com/login/oauth/authorize');
          ghAuth.searchParams.set('client_id', env.GITHUB_OAUTH_CLIENT_ID);
          ghAuth.searchParams.set('redirect_uri', callbackUrl);
          ghAuth.searchParams.set('state', state);
          // Scope `repo` pour pouvoir commiter dans le repo privé du site,
          // `read:user` pour récupérer le login afin de vérifier la whitelist.
          ghAuth.searchParams.set('scope', 'repo read:user');
          return Response.redirect(ghAuth.toString(), 302);
        }

        if (path === '/api/auth/github/callback' && request.method === 'GET') {
          const code = url.searchParams.get('code');
          const state = url.searchParams.get('state');
          if (!code || !state) {
            return new Response('Paramètres OAuth manquants.', { status: 400 });
          }
          const stateRaw = await kv.get(`auth:oauth_state:${state}`);
          if (!stateRaw) {
            return new Response('État OAuth invalide ou expiré. Réessayez.', { status: 400 });
          }
          await kv.delete(`auth:oauth_state:${state}`);
          const { dashboardRedirect } = JSON.parse(stateRaw);

          // Échange code → access_token
          const tokenResp = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: env.GITHUB_OAUTH_CLIENT_ID,
              client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
              code,
            }),
          });
          const tokenData = await tokenResp.json().catch(() => ({}));
          const accessToken = tokenData.access_token;
          if (!accessToken) {
            return new Response(
              `Échec OAuth : ${tokenData.error_description || tokenData.error || 'pas de token'}`,
              { status: 500 }
            );
          }

          // Vérification de l'utilisateur (whitelist)
          const userResp = await fetch('https://api.github.com/user', {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'ir-dashboard-worker',
            },
          });
          if (!userResp.ok) {
            return new Response(`Impossible de récupérer le profil GitHub (${userResp.status}).`, { status: 500 });
          }
          const ghUser = await userResp.json();
          const login = ghUser.login || '';

          const allowed = (env.ALLOWED_GITHUB_USERS || '')
            .split(',')
            .map(s => s.trim().toLowerCase())
            .filter(Boolean);
          if (allowed.length > 0 && !allowed.includes(login.toLowerCase())) {
            return new Response(
              `Accès refusé : le compte GitHub "${login}" n'est pas autorisé. Contactez l'administrateur.`,
              { status: 403 }
            );
          }

          // Redirige vers le dashboard avec le token + login en hash params.
          // Le hash n'est jamais envoyé au serveur d'origine (donc pas de
          // log côté GitHub Pages). Le front lit + efface immédiatement.
          const target = dashboardRedirect && dashboardRedirect.startsWith('https://')
            ? dashboardRedirect
            : 'https://benedictefradin-cmd.github.io/ir-dashboard/';
          const params = new URLSearchParams({
            token: accessToken,
            login,
            name: ghUser.name || '',
            avatar: ghUser.avatar_url || '',
          });
          return Response.redirect(`${target}#${params.toString()}`, 302);
        }

        if (path === '/api/auth/github/logout' && request.method === 'POST') {
          // Marqueur explicite. Le token étant en sessionStorage côté front,
          // sa simple suppression suffit ; rien à faire côté serveur tant
          // qu'on ne révoque pas l'access_token via l'API GitHub apps.
          return json({ ok: true });
        }

        // ─── POST /api/auth/login ───
        if (path === '/api/auth/login' && request.method === 'POST') {
          // Rate limiting : max 10 tentatives / 15 min / IP
          const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
          const rlWindow = Math.floor(Date.now() / (15 * 60 * 1000));
          const rlKey = `auth:rl:${ip}:${rlWindow}`;
          const rlCount = parseInt(await kv.get(rlKey) || '0', 10);
          if (rlCount >= 10) {
            return json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' }, 429);
          }

          const { login, password } = await request.json();
          if (!login || !password) return json({ error: 'Identifiants requis' }, 400);

          const indexRaw = await kv.get('auth:_users_index');
          const index = indexRaw ? JSON.parse(indexRaw) : [];

          // Bootstrap : si aucun utilisateur et identifiants par défaut, seed admin
          if (index.length === 0) {
            if (login === 'admin' && password === 'IR2026!') {
              const seeded = await createUser(kv, { login: 'admin', name: 'Admin', password: 'IR2026!', role: 'admin' });
              const token = await createSession(kv, seeded.id);
              return json({ token, user: publicUser(seeded), bootstrapped: true });
            }
            await kv.put(rlKey, String(rlCount + 1), { expirationTtl: 15 * 60 });
            return json({ error: 'Aucun utilisateur. Connectez-vous avec admin / IR2026! pour initialiser.' }, 401);
          }

          const userId = await kv.get(`auth:user_login:${login.toLowerCase()}`);
          const userRaw = userId ? await kv.get(`auth:user:${userId}`) : null;
          const user = userRaw ? JSON.parse(userRaw) : null;
          // Toujours exécuter PBKDF2 (contre un hash factice si user inexistant)
          // pour éviter le timing attack qui révèle l'existence d'un login.
          const hashToVerify = user ? user.passwordHash : DUMMY_HASH;
          const passwordOk = await verifyPassword(password, hashToVerify);
          if (!user || !passwordOk) {
            await kv.put(rlKey, String(rlCount + 1), { expirationTtl: 15 * 60 });
            return json({ error: 'Identifiants invalides' }, 401);
          }

          const token = await createSession(kv, user.id);
          return json({ token, user: publicUser(user) });
        }

        // ─── Toutes les autres routes nécessitent une session ───
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
        const session = token ? await getSession(kv, token) : null;
        if (!session) return json({ error: 'Non autorisé' }, 401);
        const meRaw = await kv.get(`auth:user:${session.userId}`);
        if (!meRaw) return json({ error: 'Utilisateur introuvable' }, 401);
        const me = JSON.parse(meRaw);

        // ─── POST /api/auth/logout ───
        if (path === '/api/auth/logout' && request.method === 'POST') {
          await kv.delete(`auth:session:${token}`);
          return json({ ok: true });
        }

        // ─── GET /api/auth/me ───
        if (path === '/api/auth/me' && request.method === 'GET') {
          return json({ user: publicUser(me) });
        }

        // ─── PATCH /api/auth/me/password ─── (changer son propre mdp)
        if (path === '/api/auth/me/password' && request.method === 'PATCH') {
          const { currentPassword, newPassword } = await request.json();
          if (!currentPassword || !newPassword) return json({ error: 'Champs requis' }, 400);
          if (newPassword.length < 8) return json({ error: 'Mot de passe trop court (min 8 caractères)' }, 400);
          const ok = await verifyPassword(currentPassword, me.passwordHash);
          if (!ok) return json({ error: 'Mot de passe actuel incorrect' }, 401);
          me.passwordHash = await hashPassword(newPassword);
          me.updatedAt = new Date().toISOString();
          await kv.put(`auth:user:${me.id}`, JSON.stringify(me));
          // Invalide les autres sessions, garde la session courante
          await invalidateUserSessions(kv, me.id, token);
          return json({ ok: true });
        }

        // ─── GET /api/auth/users ─── (admin)
        if (path === '/api/auth/users' && request.method === 'GET') {
          if (me.role !== 'admin') return json({ error: 'Accès admin requis' }, 403);
          const indexRaw = await kv.get('auth:_users_index');
          const index = indexRaw ? JSON.parse(indexRaw) : [];
          return json({ users: index });
        }

        // ─── POST /api/auth/users ─── (admin)
        if (path === '/api/auth/users' && request.method === 'POST') {
          if (me.role !== 'admin') return json({ error: 'Accès admin requis' }, 403);
          const { login, name, password, role } = await request.json();
          if (!login || !name || !password) return json({ error: 'login, name, password requis' }, 400);
          if (password.length < 8) return json({ error: 'Mot de passe trop court (min 8 caractères)' }, 400);
          const existing = await kv.get(`auth:user_login:${login.toLowerCase()}`);
          if (existing) return json({ error: 'Identifiant déjà utilisé' }, 409);
          const created = await createUser(kv, { login, name, password, role: role === 'admin' ? 'admin' : 'editor' });
          return json({ user: publicUser(created) }, 201);
        }

        // ─── PATCH /api/auth/users/:id ─── (admin, ou self pour name)
        const userIdMatch = path.match(/^\/api\/auth\/users\/([^/]+)$/);
        if (userIdMatch && request.method === 'PATCH') {
          const id = decodeURIComponent(userIdMatch[1]);
          if (me.role !== 'admin' && me.id !== id) return json({ error: 'Accès refusé' }, 403);
          const targetRaw = await kv.get(`auth:user:${id}`);
          if (!targetRaw) return json({ error: 'Utilisateur introuvable' }, 404);
          const target = JSON.parse(targetRaw);
          const updates = await request.json();
          if (updates.name !== undefined) target.name = updates.name;
          if (updates.role !== undefined && me.role === 'admin') {
            target.role = updates.role === 'admin' ? 'admin' : 'editor';
          }
          let passwordChanged = false;
          if (updates.password !== undefined && me.role === 'admin') {
            if (updates.password.length < 8) return json({ error: 'Mot de passe trop court (min 8 caractères)' }, 400);
            target.passwordHash = await hashPassword(updates.password);
            passwordChanged = true;
          }
          target.updatedAt = new Date().toISOString();
          await kv.put(`auth:user:${id}`, JSON.stringify(target));
          await updateUserIndex(kv, target);
          // Reset par admin → invalide toutes les sessions de l'utilisateur cible
          if (passwordChanged) await invalidateUserSessions(kv, target.id);
          return json({ user: publicUser(target) });
        }

        // ─── DELETE /api/auth/users/:id ─── (admin, pas soi-même)
        if (userIdMatch && request.method === 'DELETE') {
          if (me.role !== 'admin') return json({ error: 'Accès admin requis' }, 403);
          const id = decodeURIComponent(userIdMatch[1]);
          if (id === me.id) return json({ error: 'Impossible de supprimer son propre compte' }, 400);
          const targetRaw = await kv.get(`auth:user:${id}`);
          if (!targetRaw) return json({ error: 'Utilisateur introuvable' }, 404);
          const target = JSON.parse(targetRaw);
          await kv.delete(`auth:user:${id}`);
          await kv.delete(`auth:user_login:${target.login.toLowerCase()}`);
          const indexRaw = await kv.get('auth:_users_index');
          const index = indexRaw ? JSON.parse(indexRaw) : [];
          await kv.put('auth:_users_index', JSON.stringify(index.filter(u => u.id !== id)));
          await invalidateUserSessions(kv, id);
          return json({ ok: true });
        }

        return json({ error: 'Route auth inconnue' }, 404);
      }

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

        // ─── GET /api/telegram/messages ─── (lecture bot updates)
        if (path === '/api/telegram/messages' && request.method === 'GET') {
          const limit = url.searchParams.get('limit') || 20;
          const resp = await fetch(
            `https://api.telegram.org/bot${botToken}/getUpdates?limit=${limit}&allowed_updates=["message","channel_post"]`
          );
          const data = await resp.json();
          if (!resp.ok || !data.ok) {
            return json({ error: data.description || 'Erreur Telegram getUpdates' }, resp.status);
          }
          const messages = (data.result || []).map(u => {
            const m = u.message || u.channel_post || {};
            return {
              id: u.update_id,
              from: m.from?.first_name || m.chat?.title || 'Inconnu',
              fromId: m.from?.id || m.chat?.id || null,
              text: m.text || m.caption || '',
              date: m.date ? new Date(m.date * 1000).toISOString() : null,
              type: u.channel_post ? 'channel' : 'private',
            };
          }).reverse();
          return json({ messages });
        }

        return json({ error: 'Route Telegram inconnue' }, 404);
      }

      // ═══════════════════════════════════════════
      // CALENDAR (Worker KV — réutilise CONTACT_SUBMISSIONS avec préfixe)
      // ═══════════════════════════════════════════

      if (path.startsWith('/api/calendar/')) {
        if (!env.CONTACT_SUBMISSIONS) {
          return json({ error: 'KV non configuré' }, 503);
        }

        // Auth — mêmes règles que sollicitations
        if (env.CONTACT_AUTH_TOKEN) {
          const auth = request.headers.get('Authorization') || '';
          const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
          if (token !== env.CONTACT_AUTH_TOKEN) {
            return json({ error: 'Non autorisé' }, 401);
          }
        }

        const type = path.split('/api/calendar/')[1];
        const allowedTypes = ['socialPosts', 'rapports', 'extEvents'];
        if (!allowedTypes.includes(type)) {
          return json({ error: `Type inconnu. Attendu : ${allowedTypes.join(', ')}` }, 400);
        }

        const kvKey = `calendar:${type}`;

        if (request.method === 'GET') {
          const raw = await env.CONTACT_SUBMISSIONS.get(kvKey);
          const items = raw ? JSON.parse(raw) : [];
          return json({ items });
        }

        if (request.method === 'PUT') {
          const body = await request.json();
          const items = Array.isArray(body.items) ? body.items : [];
          await env.CONTACT_SUBMISSIONS.put(kvKey, JSON.stringify(items));
          return json({ success: true, count: items.length });
        }

        return json({ error: 'Méthode non supportée' }, 405);
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
              sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
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
      //
      // Priorité au secret Worker (env.GITHUB_PAT) pour ne jamais
      // exposer de token côté navigateur. Fallback sur le header
      // X-GitHub-Token pendant la transition (pour ne pas casser
      // les anciennes versions du front qui envoyaient leur token).
      // À retirer une fois que le front ne pousse plus de token.
      //
      // De même pour owner/repo : priorité aux env.GITHUB_OWNER /
      // env.GITHUB_SITE_REPO (secrets), fallback sur les headers.
      // ═══════════════════════════════════════════

      if (path.startsWith('/api/github/')) {
        // Priorité au token OAuth de l'utilisateur connecté (header
        // X-GitHub-User-Token, jamais persisté côté Worker — le commit est
        // attribué à l'utilisateur). Fallback sur le PAT serveur si l'user
        // n'est pas connecté ou n'a pas envoyé de token. Dernier fallback :
        // le header legacy X-GitHub-Token (sera retiré après la transition).
        const userToken = request.headers.get('X-GitHub-User-Token');
        const githubToken = userToken || env.GITHUB_PAT || request.headers.get('X-GitHub-Token');
        const owner = env.GITHUB_OWNER || request.headers.get('X-GitHub-Owner');
        const repo = env.GITHUB_SITE_REPO || request.headers.get('X-GitHub-Repo');

        if (!githubToken) {
          return json({ error: 'Token GitHub non configuré côté Worker (secret GITHUB_PAT manquant).' }, 503);
        }
        if (!owner || !repo) {
          return json({ error: 'Owner ou repo GitHub non configuré (secrets GITHUB_OWNER / GITHUB_SITE_REPO manquants).' }, 503);
        }

        const githubHeaders = {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'ir-dashboard-worker',
        };

        // Helper : vérifie qu'un chemin est dans la liste blanche du repo site
        // (pas de remontée vers .github/, pas d'accès aux workflows, pas de tokens stockés).
        const isAllowedPath = (p) => {
          if (!p || typeof p !== 'string') return false;
          if (p.includes('..')) return false;
          if (p.startsWith('/')) return false;
          // Dossiers et fichiers autorisés (édition par le back-office)
          const allowedPrefixes = [
            'data/', 'publications/', 'assets/images/', 'assets/img/',
            'assets/pdf/', 'assets/css/', 'assets/js/', 'includes/', 'images/',
          ];
          const allowedFiles = [
            'index.html', '404.html', 'sitemap.xml', 'rss.xml', 'robots.txt',
            'manifest.json', 'vercel.json', 'search-index.json', 'CNAME',
          ];
          // Toute page .html à la racine est éditable (about, contact, équipe...)
          if (/^[a-z0-9-]+\.html$/i.test(p)) return true;
          if (allowedFiles.includes(p)) return true;
          return allowedPrefixes.some(prefix => p.startsWith(prefix));
        };

        // ─── GET /api/github/contents/* ─── lecture générique (texte ou binaire)
        // Query: ?binary=1 pour récupérer un data URL (images privées du repo)
        const contentsMatch = path.match(/^\/api\/github\/contents\/(.+)$/);
        if (contentsMatch && request.method === 'GET') {
          const filePath = decodeURIComponent(contentsMatch[1]);
          if (!isAllowedPath(filePath)) {
            return json({ error: `Chemin non autorisé : ${filePath}` }, 403);
          }
          const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
          const resp = await fetch(apiUrl, { headers: githubHeaders });
          if (!resp.ok) return json({ error: `GitHub : ${resp.status}` }, resp.status);
          const meta = await resp.json();

          // Bascule vers /git/blobs/{sha} pour les fichiers > 1 Mo (l'API contents
          // ne renvoie pas le champ `content` au-delà de cette limite).
          let base64 = (meta.content || '').replace(/\n/g, '');
          if (!base64 && meta.sha) {
            const blobResp = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/git/blobs/${meta.sha}`,
              { headers: githubHeaders }
            );
            if (!blobResp.ok) return json({ error: `GitHub blob : ${blobResp.status}` }, blobResp.status);
            const blob = await blobResp.json();
            base64 = (blob.content || '').replace(/\n/g, '');
          }

          // Mode binaire (images) : retourne directement le data URL pour <img>
          if (url.searchParams.get('binary') === '1') {
            const ext = (filePath.split('.').pop() || 'jpg').toLowerCase();
            const mime = ext === 'png' ? 'image/png'
              : ext === 'webp' ? 'image/webp'
              : ext === 'svg' ? 'image/svg+xml'
              : ext === 'gif' ? 'image/gif'
              : 'image/jpeg';
            return json({ dataUrl: `data:${mime};base64,${base64}`, sha: meta.sha });
          }

          // Mode texte : décode UTF-8 (utilise TextDecoder, pas escape/unescape déprécié)
          const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
          const content = new TextDecoder('utf-8').decode(bytes);
          return json({ content, sha: meta.sha });
        }

        // ─── PUT /api/github/contents/* ─── écriture générique (texte ou base64)
        // Body: { content?: string, base64?: string, sha?: string, message?: string }
        if (contentsMatch && request.method === 'PUT') {
          const filePath = decodeURIComponent(contentsMatch[1]);
          if (!isAllowedPath(filePath)) {
            return json({ error: `Chemin non autorisé : ${filePath}` }, 403);
          }
          const body = await request.json();
          if (body.content === undefined && !body.base64) {
            return json({ error: 'Champ "content" (texte) ou "base64" (binaire) requis.' }, 400);
          }

          const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

          // Récupération du SHA si pas fourni (mise à jour d'un fichier existant)
          let currentSha = body.sha || null;
          if (!currentSha) {
            const checkResp = await fetch(apiUrl, { headers: githubHeaders });
            if (checkResp.ok) {
              const existing = await checkResp.json();
              currentSha = existing.sha;
            }
          }

          // Encodage UTF-8 → base64 (sans escape/unescape déprécié)
          let contentBase64;
          if (body.base64) {
            contentBase64 = body.base64.replace(/\n/g, '');
          } else {
            const utf8 = new TextEncoder().encode(body.content);
            contentBase64 = utf8ToBase64(utf8);
          }

          const putBody = {
            message: body.message || `Mise à jour ${filePath} depuis le back-office`,
            content: contentBase64,
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

        // ─── DELETE /api/github/contents/* ─── suppression générique
        if (contentsMatch && request.method === 'DELETE') {
          const filePath = decodeURIComponent(contentsMatch[1]);
          if (!isAllowedPath(filePath)) {
            return json({ error: `Chemin non autorisé : ${filePath}` }, 403);
          }
          const body = await request.json().catch(() => ({}));
          const sha = body.sha;
          if (!sha) return json({ error: 'SHA requis pour la suppression.' }, 400);

          const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
          const delResp = await fetch(apiUrl, {
            method: 'DELETE',
            headers: githubHeaders,
            body: JSON.stringify({
              message: body.message || `Suppression ${filePath} depuis le back-office`,
              sha,
              branch: 'main',
            }),
          });
          if (!delResp.ok) {
            const err = await delResp.json().catch(() => ({}));
            return json({ error: err.message || `GitHub : ${delResp.status}` }, delResp.status);
          }
          return json({ success: true });
        }

        // ─── GET /api/github/list/* ─── liste les fichiers d'un dossier
        const listMatch = path.match(/^\/api\/github\/list\/(.+)$/);
        if (listMatch && request.method === 'GET') {
          const dirPath = decodeURIComponent(listMatch[1]);
          if (!isAllowedPath(dirPath + '/')) {
            return json({ error: `Chemin non autorisé : ${dirPath}` }, 403);
          }
          const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${dirPath}`;
          const resp = await fetch(apiUrl, { headers: githubHeaders });
          if (!resp.ok) return json({ error: `GitHub : ${resp.status}` }, resp.status);
          const items = await resp.json();
          // L'API retourne un objet pour un fichier, un tableau pour un dossier
          if (!Array.isArray(items)) return json({ error: 'Pas un dossier' }, 400);
          return json({
            items: items.map(i => ({
              name: i.name,
              path: i.path,
              type: i.type,
              size: i.size,
              sha: i.sha,
            })),
          });
        }

        // ─── GET /api/github/data/:file ─── (legacy : lire un JSON du site)
        // Conservé pour compat ; le nouveau front utilise /api/github/contents/data/:file.
        const dataMatch = path.match(/^\/api\/github\/data\/(.+)$/);
        if (dataMatch && request.method === 'GET') {
          const fileName = decodeURIComponent(dataMatch[1]);
          const allowed = ['publications.json', 'events.json', 'presse.json', 'auteurs.json', 'contenu.json'];
          if (!allowed.includes(fileName)) return json({ error: 'Fichier non autorisé.' }, 403);

          const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/data/${fileName}`;
          const resp = await fetch(apiUrl, { headers: githubHeaders });
          if (!resp.ok) return json({ error: `GitHub : ${resp.status}` }, resp.status);
          const file = await resp.json();
          const bytes = Uint8Array.from(atob(file.content.replace(/\n/g, '')), c => c.charCodeAt(0));
          const content = new TextDecoder('utf-8').decode(bytes);
          return json({ data: JSON.parse(content), sha: file.sha });
        }

        // ─── PUT /api/github/data/:file ─── (legacy : écrire un JSON du site)
        if (dataMatch && request.method === 'PUT') {
          const fileName = decodeURIComponent(dataMatch[1]);
          const allowed = ['publications.json', 'events.json', 'presse.json', 'auteurs.json', 'contenu.json'];
          if (!allowed.includes(fileName)) return json({ error: 'Fichier non autorisé.' }, 403);

          const body = await request.json();
          if (!body.data) return json({ error: 'Données manquantes (champ "data" requis).' }, 400);

          const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/data/${fileName}`;

          let currentSha = body.sha || null;
          if (!currentSha) {
            const checkResp = await fetch(apiUrl, { headers: githubHeaders });
            if (checkResp.ok) {
              const existing = await checkResp.json();
              currentSha = existing.sha;
            }
          }

          const utf8 = new TextEncoder().encode(JSON.stringify(body.data, null, 2));
          const content = utf8ToBase64(utf8);
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

        // ─── POST /api/github/publish ─── (publication d'un article HTML pré-rendu)
        if (path === '/api/github/publish' && request.method === 'POST') {
          const body = await request.json();
          const { slug, html, metadata, commitMessage } = body;
          if (!slug || !html) return json({ error: 'Slug et HTML requis.' }, 400);

          const filePath = `publications/${slug}.html`;
          const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

          let existingSha = null;
          const checkResp = await fetch(apiUrl, { headers: githubHeaders });
          if (checkResp.ok) {
            const existing = await checkResp.json();
            existingSha = existing.sha;
          }

          const utf8 = new TextEncoder().encode(html);
          const content = utf8ToBase64(utf8);
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

        // ─── GET /api/github/check/:slug ─── (vérifie l'existence d'une publication)
        const checkMatch = path.match(/^\/api\/github\/check\/(.+)$/);
        if (checkMatch && request.method === 'GET') {
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
            // github = true tant que le secret GITHUB_PAT est configuré
            // (le mode header X-GitHub-Token reste accepté en transition)
            github: !!env.GITHUB_PAT,
            translate: !!(env.DEEPL_API_KEY || env.ANTHROPIC_API_KEY),
            githubOAuth: !!(env.GITHUB_OAUTH_CLIENT_ID && env.GITHUB_OAUTH_CLIENT_SECRET),
          },
        });
      }

      // ═══════════════════════════════════════════
      // TRANSLATE — DeepL (préféré) ou Anthropic (fallback)
      // ═══════════════════════════════════════════

      if (path === '/api/translate' && request.method === 'POST') {
        const body = await request.json();
        const { title = '', summary = '', content = '', from = 'fr', to } = body;
        if (!to) return json({ error: 'Langue cible (to) requise' }, 400);

        // ── DeepL ──
        if (env.DEEPL_API_KEY) {
          const deeplUrl = env.DEEPL_API_KEY.endsWith(':fx')
            ? 'https://api-free.deepl.com/v2/translate'
            : 'https://api.deepl.com/v2/translate';
          const texts = [title, summary, content];
          const params = new URLSearchParams();
          texts.forEach(t => params.append('text', t || ''));
          params.append('source_lang', from.toUpperCase());
          params.append('target_lang', to.toUpperCase());
          params.append('tag_handling', 'html');
          const resp = await fetch(deeplUrl, {
            method: 'POST',
            headers: {
              'Authorization': `DeepL-Auth-Key ${env.DEEPL_API_KEY}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          });
          if (!resp.ok) {
            const errText = await resp.text();
            return json({ error: `DeepL : ${resp.status} ${errText.slice(0, 200)}` }, resp.status);
          }
          const data = await resp.json();
          const [tTitle, tSummary, tContent] = data.translations || [];
          return json({
            title: tTitle?.text || '',
            summary: tSummary?.text || '',
            content: tContent?.text || '',
            provider: 'deepl',
          });
        }

        // ── Anthropic (fallback) ──
        if (env.ANTHROPIC_API_KEY) {
          const langNames = { en: 'English', de: 'German', es: 'Spanish', fr: 'French', it: 'Italian' };
          const targetName = langNames[to] || to;
          const sourceName = langNames[from] || from;
          const prompt = `Translate the following article from ${sourceName} to ${targetName}.
Return ONLY a valid JSON object with keys "title", "summary", "content".
Preserve HTML tags in "content" exactly. Do not add any commentary.

Input:
{"title": ${JSON.stringify(title)}, "summary": ${JSON.stringify(summary)}, "content": ${JSON.stringify(content)}}`;
          const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': env.ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 8192,
              messages: [{ role: 'user', content: prompt }],
            }),
          });
          if (!resp.ok) {
            const errText = await resp.text();
            return json({ error: `Anthropic : ${resp.status} ${errText.slice(0, 200)}` }, resp.status);
          }
          const data = await resp.json();
          const text = data.content?.[0]?.text || '';
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) return json({ error: 'Réponse LLM non-JSON' }, 502);
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            return json({
              title: parsed.title || '',
              summary: parsed.summary || '',
              content: parsed.content || '',
              provider: 'anthropic',
            });
          } catch (e) {
            return json({ error: `Parsing JSON : ${e.message}` }, 502);
          }
        }

        return json({
          error: 'Traduction non configurée. Ajoutez DEEPL_API_KEY ou ANTHROPIC_API_KEY en secret Worker.',
        }, 503);
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
}

// ═══ Helpers ═══════════════════════════════════════

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// ═══ Site preview proxy ═════════════════════════════
// Origines autorisées à iframer le proxy. Reste en synchro avec ALLOWED_ORIGINS
// (côté CORS) — la liste minimale des dashboards légitimes.
const FRAME_ANCESTORS = [
  "'self'",
  'https://benedictefradin-cmd.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
];

const EDIT_MODE_SCRIPT = `
<script>
(function () {
  if (window.parent === window) return;
  var origin = '*';

  var style = document.createElement('style');
  style.textContent = [
    '[data-i18n] {',
    '  outline: 1px dashed rgba(255, 100, 0, 0.35);',
    '  outline-offset: 2px;',
    '  cursor: pointer !important;',
    '  transition: outline 80ms ease, background-color 80ms ease;',
    '}',
    '[data-i18n]:hover {',
    '  outline: 2px solid rgba(255, 100, 0, 0.95);',
    '  background-color: rgba(255, 220, 100, 0.18);',
    '}',
    '[data-i18n].ir-editing {',
    '  outline: 2px solid rgb(255, 100, 0) !important;',
    '  background-color: rgba(255, 220, 100, 0.32) !important;',
    '}',
    'a, button, summary { cursor: pointer !important; }',
  ].join('\\n');
  document.head.appendChild(style);

  function send(msg) {
    try { window.parent.postMessage(msg, origin); } catch (e) {}
  }

  document.addEventListener('click', function (e) {
    var i18nEl = e.target.closest && e.target.closest('[data-i18n]');
    if (i18nEl) {
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('.ir-editing').forEach(function (el) {
        el.classList.remove('ir-editing');
      });
      i18nEl.classList.add('ir-editing');
      var key = i18nEl.getAttribute('data-i18n');
      var html = i18nEl.innerHTML;
      var text = i18nEl.textContent;
      var rect = i18nEl.getBoundingClientRect();
      send({
        type: 'ir-edit-click',
        key: key,
        html: html,
        text: text,
        tag: i18nEl.tagName.toLowerCase(),
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      });
      return;
    }
    var link = e.target.closest && e.target.closest('a[href]');
    if (link) {
      var href = link.getAttribute('href');
      if (href && href.charAt(0) !== '#') {
        e.preventDefault();
        e.stopPropagation();
        send({ type: 'ir-navigate-request', href: href });
      }
    }
  }, true);

  document.addEventListener('submit', function (e) { e.preventDefault(); }, true);

  var livePatch = Object.create(null);
  function applyLivePatch(key, lang) {
    var value = livePatch[key] && livePatch[key][lang];
    if (value === undefined) return;
    document.querySelectorAll('[data-i18n="' + CSS.escape(key) + '"]').forEach(function (el) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = value;
      } else if (value.indexOf('<') !== -1) {
        el.innerHTML = value;
      } else {
        el.textContent = value;
      }
    });
  }
  function currentLang() { return localStorage.getItem('lang') || 'fr'; }

  window.addEventListener('message', function (e) {
    var msg = e.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'ir-reload-i18n') {
      if (typeof window.__irReloadTranslations === 'function') {
        window.__irReloadTranslations().then(function () {
          Object.keys(livePatch).forEach(function (k) { applyLivePatch(k, currentLang()); });
        });
      } else {
        window.location.reload();
      }
    } else if (msg.type === 'ir-clear-selection') {
      document.querySelectorAll('.ir-editing').forEach(function (el) {
        el.classList.remove('ir-editing');
      });
    } else if (msg.type === 'ir-apply-live' && msg.key && msg.lang) {
      if (!livePatch[msg.key]) livePatch[msg.key] = {};
      livePatch[msg.key][msg.lang] = msg.value || '';
      if (msg.lang === currentLang()) applyLivePatch(msg.key, msg.lang);
    } else if (msg.type === 'ir-revert-live' && msg.key && msg.lang) {
      if (livePatch[msg.key]) {
        delete livePatch[msg.key][msg.lang];
        if (Object.keys(livePatch[msg.key]).length === 0) delete livePatch[msg.key];
      }
      if (typeof window.__irReloadTranslations === 'function') {
        window.__irReloadTranslations();
      }
    }
  });

  function announceReady() {
    send({
      type: 'ir-edit-ready',
      page: document.documentElement.getAttribute('data-page') || '',
      url: window.location.pathname,
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', announceReady);
  } else {
    announceReady();
  }
})();
</script>`;

async function handleSiteProxy(url, env) {
  // institut-rousseau.fr pointe encore (mai 2026) sur l'ancien WordPress.
  // Le nouveau site statique est hébergé sur le sous-domaine Vercel par défaut
  // tant que le DNS n'a pas été basculé. Utilise SITE_URL pour pouvoir changer
  // sans redeploy quand le switch DNS se fera.
  const siteUrl = (env.SITE_URL || 'https://institut-rousseau-site.vercel.app').replace(/\/+$/, '');
  // Tout ce qui suit /site-proxy/ + query string remontent vers le site live.
  const subPath = url.pathname.slice('/site-proxy/'.length);
  // Garde tous les params sauf `edit` (consommé localement, jamais propagé au site).
  const passthroughQs = new URLSearchParams(url.search);
  passthroughQs.delete('edit');
  const editMode = url.searchParams.get('edit') === '1';
  const qs = passthroughQs.toString();
  const targetUrl = `${siteUrl}/${subPath}${qs ? '?' + qs : ''}`;

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      headers: { 'User-Agent': 'ir-dashboard-edit-proxy/1.0' },
      redirect: 'follow',
    });
  } catch (err) {
    return new Response(`Site upstream injoignable: ${err.message}`, { status: 502 });
  }

  const contentType = upstream.headers.get('Content-Type') || '';
  const isHtml = contentType.includes('text/html');
  const cspFrameAncestors = `frame-ancestors ${FRAME_ANCESTORS.join(' ')}`;

  if (!isHtml) {
    // Asset (CSS/JS/image/PDF/JSON) — pass-through, mais nettoie les
    // headers anti-iframe que le site applique globalement.
    const passHeaders = new Headers(upstream.headers);
    passHeaders.delete('X-Frame-Options');
    passHeaders.delete('Content-Security-Policy');
    return new Response(upstream.body, { status: upstream.status, headers: passHeaders });
  }

  let html = await upstream.text();

  // <base href> : tous les chemins relatifs du site (CSS, JS, images, fetch
  // de data/i18n.json…) résolvent contre le site live, donc le proxy n'a
  // qu'à servir l'HTML — les assets descendent en direct de Vercel.
  const baseTag = `<base href="${siteUrl}/">`;
  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, (m) => `${m}\n${baseTag}`);
  } else {
    html = baseTag + html;
  }

  if (editMode) {
    if (html.includes('</body>')) {
      html = html.replace('</body>', EDIT_MODE_SCRIPT + '</body>');
    } else {
      html += EDIT_MODE_SCRIPT;
    }
  }

  const headers = new Headers();
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Content-Security-Policy', cspFrameAncestors);
  headers.set('Cache-Control', 'no-store');
  // Pas de X-Frame-Options : la CSP frame-ancestors la remplace.

  return new Response(html, { status: 200, headers });
}

// ═══ Auth helpers ════════════════════════════════════
// Format hash : pbkdf2$<iters>$<saltHex>$<hashHex>

const PBKDF2_ITERS = 100000;
const SESSION_TTL_SECONDS = 12 * 3600;
// Hash factice utilisé contre un login inexistant pour égaliser le temps de réponse.
// Format pbkdf2$100000$<salt 16o>$<hash 32o>. Le mot de passe d'origine est inconnu et
// ne sera jamais trouvé — c'est juste là pour faire tourner PBKDF2 le même temps.
const DUMMY_HASH = 'pbkdf2$100000$00112233445566778899aabbccddeeff$' +
  '0000000000000000000000000000000000000000000000000000000000000000';

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

async function hashPassword(password, saltHex) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    key,
    256
  );
  return `pbkdf2$${PBKDF2_ITERS}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(bits))}`;
}

async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const computed = await hashPassword(password, parts[2]);
  // Comparaison à temps constant
  if (computed.length !== stored.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ stored.charCodeAt(i);
  return diff === 0;
}

function randomToken(bytes = 32) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

function publicUser(u) {
  return { id: u.id, login: u.login, name: u.name, role: u.role, createdAt: u.createdAt, updatedAt: u.updatedAt };
}

async function createUser(kv, { login, name, password, role }) {
  const id = `usr_${Date.now()}_${randomToken(4)}`;
  const passwordHash = await hashPassword(password);
  const user = {
    id,
    login,
    name,
    role: role === 'admin' ? 'admin' : 'editor',
    passwordHash,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await kv.put(`auth:user:${id}`, JSON.stringify(user));
  await kv.put(`auth:user_login:${login.toLowerCase()}`, id);
  const indexRaw = await kv.get('auth:_users_index');
  const index = indexRaw ? JSON.parse(indexRaw) : [];
  index.push({ id, login, name, role: user.role, createdAt: user.createdAt });
  await kv.put('auth:_users_index', JSON.stringify(index));
  return user;
}

async function updateUserIndex(kv, user) {
  const indexRaw = await kv.get('auth:_users_index');
  const index = indexRaw ? JSON.parse(indexRaw) : [];
  const i = index.findIndex(u => u.id === user.id);
  const entry = { id: user.id, login: user.login, name: user.name, role: user.role, createdAt: user.createdAt };
  if (i >= 0) index[i] = entry; else index.push(entry);
  await kv.put('auth:_users_index', JSON.stringify(index));
}

async function createSession(kv, userId) {
  const token = randomToken(32);
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  await kv.put(`auth:session:${token}`, JSON.stringify({ userId, expiresAt }), { expirationTtl: SESSION_TTL_SECONDS });
  return token;
}

async function getSession(kv, token) {
  const raw = await kv.get(`auth:session:${token}`);
  if (!raw) return null;
  const session = JSON.parse(raw);
  if (session.expiresAt && session.expiresAt < Date.now()) {
    await kv.delete(`auth:session:${token}`);
    return null;
  }
  return session;
}

// Invalide toutes les sessions actives d'un utilisateur (sauf optionnellement la session courante).
// Utilisé après un changement / reset de mot de passe.
async function invalidateUserSessions(kv, userId, keepToken = null) {
  let cursor;
  do {
    const list = await kv.list({ prefix: 'auth:session:', cursor });
    for (const k of list.keys) {
      const token = k.name.slice('auth:session:'.length);
      if (keepToken && token === keepToken) continue;
      const raw = await kv.get(k.name);
      if (!raw) continue;
      try {
        const s = JSON.parse(raw);
        if (s.userId === userId) await kv.delete(k.name);
      } catch { /* ignore */ }
    }
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);
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
