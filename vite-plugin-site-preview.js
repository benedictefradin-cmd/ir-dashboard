/**
 * vite-plugin-site-preview
 *
 * Sert le repo voisin `institut-rousseau` (le code du site live) sous
 * `/site-preview/*` pendant `vite dev`. Permet à la page "Éditeur visuel"
 * d'iframer le site en same-origin pour le mode édition.
 *
 * Quand la requête contient `?edit=1`, on injecte un petit script de mode
 * édition juste avant `</body>` (surlignage des `[data-i18n]`, capture des
 * clics, postMessage vers le parent).
 *
 * Dev-only — ce plugin n'est jamais inclus dans le build de production.
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.pdf':  'application/pdf',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.xml':  'application/xml; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
};

const EDIT_MODE_SCRIPT = `
<script>
(function () {
  if (window.parent === window) return;
  var origin = '*'; // dev only — same-origin via Vite proxy

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

  // Patch local appliqué en plus du dictionnaire i18n distant.
  // Permet au back-office de pousser des modifications "live" sans
  // recharger le JSON, pour un aperçu immédiat avant publication.
  var livePatch = Object.create(null); // { key: { lang: value } }

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

  function currentLang() {
    return localStorage.getItem('lang') || 'fr';
  }

  window.addEventListener('message', function (e) {
    var msg = e.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'ir-reload-i18n') {
      if (typeof window.__irReloadTranslations === 'function') {
        window.__irReloadTranslations().then(function () {
          // Re-applique le patch local par-dessus
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
      // Re-fetch les traductions pour récupérer la valeur d'origine
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

export default function sitePreviewPlugin(options = {}) {
  const siteRoot = options.siteRoot || path.resolve(process.cwd(), '../institut-rousseau');
  const PREFIX = '/site-preview';

  return {
    name: 'site-preview',
    apply: 'serve',
    configureServer(server) {
      if (!fs.existsSync(siteRoot)) {
        server.config.logger.warn(
          `[site-preview] Repo introuvable : ${siteRoot}. Le mode édition visuelle ne fonctionnera pas.`
        );
        return;
      }

      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith(PREFIX)) return next();

        const parsed = url.parse(req.url, true);
        let rel = decodeURIComponent(parsed.pathname.slice(PREFIX.length) || '/');
        if (rel === '/' || rel === '') rel = '/index.html';
        // Block escape attempts
        if (rel.includes('..')) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

        let abs = path.join(siteRoot, rel);

        // Pretty URLs : /le-projet → /le-projet.html
        if (!fs.existsSync(abs) && fs.existsSync(abs + '.html')) {
          abs = abs + '.html';
          rel = rel + '.html';
        }
        if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
          const idx = path.join(abs, 'index.html');
          if (fs.existsSync(idx)) abs = idx;
        }

        if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
          res.statusCode = 404;
          res.end('Not found in site repo: ' + rel);
          return;
        }

        const ext = path.extname(abs).toLowerCase();
        const mime = MIME[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'no-cache');

        if (ext === '.html') {
          let html = fs.readFileSync(abs, 'utf8');
          const editMode = parsed.query && parsed.query.edit === '1';
          if (editMode) {
            if (html.includes('</body>')) {
              html = html.replace('</body>', EDIT_MODE_SCRIPT + '</body>');
            } else {
              html = html + EDIT_MODE_SCRIPT;
            }
          }
          res.end(html);
        } else {
          fs.createReadStream(abs).pipe(res);
        }
      });
    },
  };
}
