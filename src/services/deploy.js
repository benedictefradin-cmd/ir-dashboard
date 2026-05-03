import { loadLocal, saveLocal } from '../utils/localStorage';
import { LS_KEYS, DEFAULT_WORKER_URL } from '../utils/constants';

const LAST_DEPLOY_KEY = 'last-deploy-triggered';

function getWorkerUrl() {
  return loadLocal(LS_KEYS.workerUrl, null) || DEFAULT_WORKER_URL;
}

/**
 * Déclenche un rebuild Vercel.
 *
 * Préfère le Worker (POST /api/vercel/redeploy) qui possède le hook côté
 * serveur (env.VERCEL_DEPLOY_HOOK). Si le Worker n'a pas le hook, on lui
 * passe celui stocké en localStorage (legacy). Si vraiment rien n'est
 * configuré, on lève une erreur claire.
 */
export async function triggerRebuild() {
  const workerUrl = getWorkerUrl();
  const fallbackHook = loadLocal(LS_KEYS.vercelDeployHook, '');

  if (workerUrl) {
    const resp = await fetch(`${workerUrl}/api/vercel/redeploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hookUrl: fallbackHook || undefined }),
    });
    if (resp.ok) {
      const data = await resp.json();
      const entry = { triggeredAt: data.triggeredAt || new Date().toISOString(), job: data.job || null };
      saveLocal(LAST_DEPLOY_KEY, entry);
      return entry;
    }
    if (resp.status !== 400) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `Worker /api/vercel/redeploy : ${resp.status}`);
    }
    // 400 = aucun hook côté Worker non plus → on essaie le fallback direct
  }

  if (!fallbackHook) {
    throw new Error('Deploy hook non configuré. Renseignez VERCEL_DEPLOY_HOOK côté Worker (Paramètres → Connexions API).');
  }
  const resp = await fetch(fallbackHook, { method: 'POST' });
  if (!resp.ok) throw new Error(`Erreur Vercel : ${resp.status}`);
  const data = await resp.json();
  const entry = { triggeredAt: new Date().toISOString(), job: data.job || null };
  saveLocal(LAST_DEPLOY_KEY, entry);
  return entry;
}

/**
 * Récupère les N derniers déploiements via le Worker (qui possède
 * VERCEL_TOKEN). Renvoie { configured: false } si le secret manque,
 * pour que l'UI affiche un message dédié plutôt qu'une erreur.
 */
export async function fetchDeployments(limit = 5) {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) return { configured: false, deployments: [] };
  const resp = await fetch(`${workerUrl}/api/vercel/deployments?limit=${limit}`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    return { configured: true, error: err.error || `Worker ${resp.status}`, deployments: [] };
  }
  return resp.json();
}

export function hasDeployHook() {
  const hookUrl = loadLocal(LS_KEYS.vercelDeployHook, '');
  return !!hookUrl;
}

export function getLastDeploy() {
  return loadLocal(LAST_DEPLOY_KEY, null);
}
