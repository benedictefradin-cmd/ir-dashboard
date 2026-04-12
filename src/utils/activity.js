// ─── Activity Logger ──────────────────────────────────
// Simple activity feed stored in localStorage.
// Max 50 entries, auto-pruned on write.

import { loadLocal, saveLocal } from './localStorage';

const LS_KEY = 'ir-activity';
const MAX_ENTRIES = 50;

export function getActivity() {
  return loadLocal(LS_KEY, []);
}

export function logActivity(text) {
  const entries = loadLocal(LS_KEY, []);
  entries.unshift({
    id: Date.now() + Math.random(),
    text,
    date: new Date().toISOString(),
  });
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  saveLocal(LS_KEY, entries);
  return entries;
}
