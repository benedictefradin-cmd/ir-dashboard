const SERVICES = {
  notion: { label: 'Notion', className: 'service-badge-notion' },
  brevo: { label: 'Brevo', className: 'service-badge-brevo' },
  github: { label: 'GitHub', className: 'service-badge-github' },
  cloudflare: { label: 'Cloudflare', className: 'service-badge-cloudflare' },
  vercel: { label: 'Vercel', className: 'service-badge-vercel' },
};

export default function ServiceBadge({ service }) {
  const cfg = SERVICES[service];
  if (!cfg) return null;
  return <span className={`service-badge ${cfg.className}`}>{cfg.label}</span>;
}
