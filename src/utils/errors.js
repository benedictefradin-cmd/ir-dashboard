// Traduit une erreur réseau/API en message clair pour un utilisateur non-tech.
// Usage : toast(humanizeError(err, 'Impossible de sauvegarder'), 'error')

const PATTERNS = [
  // Connexion / réseau
  { test: (e, m) => e?.name === 'TypeError' && /fetch|network|failed/i.test(m), msg: 'Connexion perdue. Vérifiez votre internet et réessayez.' },
  { test: (e, m) => /networkerror|network error|failed to fetch|load failed/i.test(m), msg: 'Connexion perdue. Vérifiez votre internet et réessayez.' },
  { test: (e, m) => /timeout|timed out/i.test(m), msg: 'Le serveur a mis trop de temps à répondre. Réessayez.' },
  { test: (e, m) => /aborted|abort/i.test(m), msg: 'Opération annulée.' },

  // Codes HTTP courants (worker renvoie souvent "GitHub : 422" / "API : 401")
  { test: (e, m) => /\b401\b|unauthorized/i.test(m), msg: 'Session expirée. Reconnectez-vous.' },
  { test: (e, m) => /\b403\b|forbidden/i.test(m), msg: "Vous n'avez pas les droits pour cette action." },
  { test: (e, m) => /\b404\b|not found/i.test(m), msg: 'Élément introuvable. Il a peut-être déjà été supprimé.' },
  { test: (e, m) => /\b409\b|conflict/i.test(m), msg: 'Conflit : un élément similaire existe déjà ou a été modifié entre-temps.' },
  { test: (e, m) => /\b413\b|payload too large/i.test(m), msg: 'Fichier trop volumineux. Réduisez sa taille.' },
  { test: (e, m) => /\b422\b|unprocessable/i.test(m), msg: 'Données invalides. Vérifiez que tous les champs requis sont remplis correctement.' },
  { test: (e, m) => /\b429\b|too many requests|rate limit/i.test(m), msg: 'Trop de tentatives. Patientez quelques instants avant de réessayer.' },
  { test: (e, m) => /\b50[0-9]\b|server error|bad gateway|service unavailable/i.test(m), msg: 'Erreur du serveur. Réessayez dans quelques minutes.' },

  // GitHub spécifique (publication site)
  { test: (e, m) => /github.*token|invalid.*token|bad credentials/i.test(m), msg: 'Token GitHub invalide ou expiré. Reconnectez-vous via GitHub.' },
  { test: (e, m) => /github.*: ?422/i.test(m), msg: 'GitHub a refusé : un fichier identique existe déjà ou un champ obligatoire manque.' },
];

export function humanizeError(err, fallback = 'Une erreur est survenue') {
  const message = (err?.message || err || '').toString();
  for (const p of PATTERNS) {
    if (p.test(err, message)) return p.msg;
  }
  // Si c'est déjà un message court et lisible (sans stack trace ni "Error: "), on le garde
  if (message && message.length < 120 && !/^Error:|^TypeError:|^[A-Z]\w+Error:/.test(message)) {
    return message;
  }
  return fallback;
}

// Variante avec préfixe contextuel : humanizeError(err, "Sauvegarde du membre")
// → "Sauvegarde du membre : Connexion perdue…"
export function describeError(err, context) {
  const human = humanizeError(err, 'Erreur inconnue');
  return context ? `${context} : ${human}` : human;
}
