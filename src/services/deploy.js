import { loadLocal } from '../utils/localStorage';
import { LS_KEYS } from '../utils/constants';

/**
 * Déclenche un rebuild du site via le Vercel Deploy Hook.
 * Le hook est un POST sur une URL du type :
 * https://api.vercel.com/v1/integrations/deploy/prj_xxx/yyy
 * Configurable dans Settings → localStorage.
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

  return resp.json();
}

export function hasDeployHook() {
  const hookUrl = loadLocal(LS_KEYS.vercelDeployHook, '');
  return !!hookUrl;
}
