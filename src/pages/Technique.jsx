import { useState, useCallback } from 'react';
import ServiceBadge from '../components/shared/ServiceBadge';
import { hasGitHub, githubGetFile, githubPutFile } from '../services/github';

const TABS = [
  { id: 'robots', label: 'robots.txt' },
  { id: 'manifest', label: 'manifest.json' },
  { id: 'sitemap', label: 'Sitemap' },
  { id: 'rss', label: 'Flux RSS' },
  { id: 'search_index', label: 'Index de recherche' },
  { id: 'vercel', label: 'vercel.json' },
  { id: 'schema', label: 'Schema.org' },
];

export default function Technique({ toast }) {
  const [activeTab, setActiveTab] = useState('robots');
  const [files, setFiles] = useState({});
  const [loading, setLoading] = useState({});
  const [saving, setSaving] = useState({});

  const loadFile = useCallback(async (path, key) => {
    if (!hasGitHub()) { toast('GitHub non configuré', 'error'); return; }
    setLoading(prev => ({ ...prev, [key]: true }));
    try {
      const { content, sha } = await githubGetFile(path);
      setFiles(prev => ({ ...prev, [key]: { content, sha, path } }));
    } catch (err) {
      toast(`Erreur chargement ${path} : ${err.message}`, 'error');
      setFiles(prev => ({ ...prev, [key]: { content: '', sha: null, path } }));
    }
    setLoading(prev => ({ ...prev, [key]: false }));
  }, [toast]);

  const saveFile = useCallback(async (key) => {
    const file = files[key];
    if (!file) return;
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      const newSha = await githubPutFile(file.path, file.content, file.sha, `Mise à jour ${file.path} depuis le back-office`);
      setFiles(prev => ({ ...prev, [key]: { ...prev[key], sha: newSha } }));
      toast(`${file.path} sauvegardé`);
    } catch (err) {
      toast(`Erreur : ${err.message}`, 'error');
    }
    setSaving(prev => ({ ...prev, [key]: false }));
  }, [files, toast]);

  const updateContent = (key, content) => {
    setFiles(prev => ({ ...prev, [key]: { ...prev[key], content } }));
  };

  const FileEditor = ({ fileKey, path, description, language }) => {
    const file = files[fileKey];
    const isLoading = loading[fileKey];
    const isSaving = saving[fileKey];

    return (
      <div className="card mb-16" style={{ padding: 20 }}>
        <div className="flex-between mb-8">
          <div>
            <h3 style={{ fontSize: 15 }}>{path}</h3>
            <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>{description}</p>
          </div>
          <div className="flex-center gap-8">
            {!file && (
              <button className="btn btn-outline btn-sm" onClick={() => loadFile(path, fileKey)} disabled={isLoading}>
                {isLoading ? 'Chargement…' : 'Charger'}
              </button>
            )}
            {file && (
              <button className="btn btn-primary btn-sm" onClick={() => saveFile(fileKey)} disabled={isSaving}>
                {isSaving ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
            )}
          </div>
        </div>
        {file && (
          <textarea
            value={file.content}
            onChange={(e) => updateContent(fileKey, e.target.value)}
            rows={20}
            style={{
              fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5,
              background: '#1e1e2e', color: '#cdd6f4', borderRadius: 8, padding: 16,
              border: '1px solid var(--border)',
            }}
          />
        )}
      </div>
    );
  };

  const renderRobots = () => (
    <>
      <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 16 }}>
        Contrôle quels robots d'indexation peuvent accéder au site et quelles pages sont exclues.
      </p>
      <FileEditor fileKey="robots" path="robots.txt"
        description="Fichier robots.txt — instructions pour les moteurs de recherche" />
    </>
  );

  const renderManifest = () => (
    <>
      <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 16 }}>
        Manifeste PWA — définit le nom, les couleurs et les icônes de l'application web.
      </p>
      <FileEditor fileKey="manifest" path="manifest.json"
        description="Manifeste Web App (PWA)" language="json" />
    </>
  );

  const renderSitemap = () => (
    <>
      <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 16 }}>
        Le sitemap XML permet aux moteurs de recherche de découvrir toutes les pages du site.
      </p>
      <FileEditor fileKey="sitemap" path="sitemap.xml"
        description="Plan du site XML pour Google, Bing, etc." language="xml" />
    </>
  );

  const renderRSS = () => (
    <>
      <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 16 }}>
        Le flux RSS permet aux lecteurs de s'abonner aux nouvelles publications via un agrégateur.
      </p>
      <FileEditor fileKey="rss" path="rss.xml"
        description="Flux RSS des publications" language="xml" />
    </>
  );

  const renderSearchIndex = () => (
    <>
      <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 16 }}>
        Index de recherche client-side (utilisé par la page 404 et la recherche du site). Contient toutes les publications indexées.
      </p>
      <FileEditor fileKey="search_index" path="search-index.json"
        description="Index de recherche full-text (JSON)" language="json" />
      <div className="card" style={{ padding: 16, background: 'var(--cream)' }}>
        <p style={{ fontSize: 12, color: 'var(--text-light)' }}>
          <strong>Note :</strong> Ce fichier est volumineux (300+ entrées). Idéalement, il devrait être régénéré automatiquement à chaque publication d'article. La modification manuelle est possible mais déconseillée.
        </p>
      </div>
    </>
  );

  const renderVercel = () => (
    <>
      <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 16 }}>
        Configuration de déploiement Vercel — headers de sécurité, cache, redirections.
      </p>
      <FileEditor fileKey="vercel" path="vercel.json"
        description="Configuration Vercel (headers, redirections, cache)" language="json" />
    </>
  );

  const renderSchema = () => {
    const schema = files.schema;
    return (
      <>
        <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 16 }}>
          Données structurées Schema.org intégrées dans le code HTML de la page d'accueil. Améliorent l'affichage dans Google.
        </p>
        <div className="card mb-16" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Schema.org — Organisation</h3>
          <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 12 }}>
            Ces données sont embarquées dans index.html. Modifiez-les ci-dessous et sauvegardez pour mettre à jour.
          </p>
          {!schema ? (
            <button className="btn btn-outline" onClick={() => loadFile('index.html', 'schema')} disabled={loading.schema}>
              {loading.schema ? 'Chargement…' : 'Charger index.html'}
            </button>
          ) : (
            <>
              <textarea
                value={(() => {
                  try {
                    const match = schema.content.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
                    return match ? match[1].trim() : '(Schema.org non trouvé dans index.html)';
                  } catch { return ''; }
                })()}
                onChange={(e) => {
                  const newSchema = e.target.value;
                  const updated = schema.content.replace(
                    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
                    `<script type="application/ld+json">\n${newSchema}\n</script>`
                  );
                  updateContent('schema', updated);
                }}
                rows={15}
                style={{
                  fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5,
                  background: '#1e1e2e', color: '#cdd6f4', borderRadius: 8, padding: 16,
                }}
              />
              <div style={{ marginTop: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={() => saveFile('schema')} disabled={saving.schema}>
                  {saving.schema ? 'Sauvegarde…' : 'Sauvegarder index.html'}
                </button>
              </div>
            </>
          )}
        </div>
      </>
    );
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Fichiers techniques</h1>
          <p className="page-header-sub">robots.txt, sitemap, manifest, RSS, search-index, config</p>
        </div>
        <ServiceBadge service="github" />
      </div>

      <div className="page-body">
        <div className="tab-group" style={{ flexWrap: 'wrap' }}>
          {TABS.map((tab) => (
            <button key={tab.id} className={`tab-item${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'robots' && renderRobots()}
        {activeTab === 'manifest' && renderManifest()}
        {activeTab === 'sitemap' && renderSitemap()}
        {activeTab === 'rss' && renderRSS()}
        {activeTab === 'search_index' && renderSearchIndex()}
        {activeTab === 'vercel' && renderVercel()}
        {activeTab === 'schema' && renderSchema()}
      </div>
    </>
  );
}
