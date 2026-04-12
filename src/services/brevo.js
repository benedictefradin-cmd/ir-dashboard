import api from './api';

// ─── Brevo via Cloudflare Worker ──────────────────────

export async function fetchContacts(limit = 50, offset = 0) {
  return api.get(`/api/brevo/contacts?limit=${limit}&offset=${offset}`);
  // { contacts: [...], count: N }
}

export async function fetchAllContacts() {
  const allContacts = [];
  let offset = 0;
  const limit = 50;

  // Première page
  const first = await fetchContacts(limit, 0);
  allContacts.push(...(first.contacts || []));
  const total = first.count || 0;

  // Pages suivantes (max 5 requêtes = 300 contacts)
  while (allContacts.length < total && offset + limit < total && allContacts.length < 300) {
    offset += limit;
    const page = await fetchContacts(limit, offset);
    allContacts.push(...(page.contacts || []));
  }

  return allContacts;
}

export async function fetchLists() {
  return api.get('/api/brevo/contacts/lists');
}

export async function addContact({ email, firstName, lastName, source, listIds }) {
  return api.post('/api/brevo/contacts', {
    email,
    attributes: {
      PRENOM: firstName || '',
      NOM: lastName || '',
      SOURCE: source || 'Back-office',
    },
    listIds: listIds || [],
    updateEnabled: true,
  });
}

export async function updateContact(email, attributes) {
  return api.put(`/api/brevo/contacts/${encodeURIComponent(email)}`, { attributes });
}

export async function sendEmail({ to, subject, htmlContent, sender }) {
  return api.post('/api/brevo/email/send', { to, subject, htmlContent, sender });
}

export async function sendBulkEmail({ recipients, subject, htmlContent, sender }) {
  // Envoyer par lots de 50
  const results = [];
  for (let i = 0; i < recipients.length; i += 50) {
    const batch = recipients.slice(i, i + 50).map(email => ({ email }));
    const result = await sendEmail({
      to: batch,
      subject,
      htmlContent,
      sender,
    });
    results.push(result);
  }
  return { sent: recipients.length, batches: results.length };
}

export async function fetchCampaigns(limit = 20, offset = 0) {
  return api.get(`/api/brevo/campaigns?limit=${limit}&offset=${offset}`);
  // { campaigns: [...], count: N }
}
