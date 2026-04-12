import { LS_PREFIX } from './constants';

export function saveLocal(key, data) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(data));
  } catch { /* quota exceeded or private browsing */ }
}

export function loadLocal(key, fallback = null) {
  try {
    const v = localStorage.getItem(LS_PREFIX + key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

export function removeLocal(key) {
  try {
    localStorage.removeItem(LS_PREFIX + key);
  } catch { /* ignore */ }
}
