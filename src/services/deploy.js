import { loadLocal, saveLocal } from '../utils/localStorage';
import { LS_KEYS } from '../utils/constants';

const LAST_DEPLOY_KEY = 'last-deploy-triggered';

/**
 * Déclenche un rebuild du site via le Vercel Deploy Hook.
 * Retourne { job, triggeredAt } — job.id est utilisable pour suivre le build.
 */
export async function triggerRebuild() {
  const hookUrl = loadLocal(LS_KEYS.vercelDeployHook, '');
  if (!hookUrl) {
    throw new Error('Deploy hook non configuré. Allez dans Config → Vercel Deploy Hook.');
  }

  const resp = await fetch(hookUrl, { method: 'POST' });
  if (!resp.ok) {
    throw new Error(`Erreur Vercel : ${resp.status}`);
  }

  const data = await resp.json();
  const triggeredAt = new Date().toISOString();
  const entry = { triggeredAt, job: data.job || null };
  saveLocal(LAST_DEPLOY_KEY, entry);
  return entry;
}

export function hasDeployHook() {
  const hookUrl = loadLocal(LS_KEYS.vercelDeployHook, '');
  return !!hookUrl;
}

export function getLastDeploy() {
  return loadLocal(LAST_DEPLOY_KEY, null);
}
