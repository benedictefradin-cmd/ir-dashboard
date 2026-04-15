import { useMemo } from 'react';

const PREVIEW_STYLES = `
  body {
    font-family: 'Source Sans 3', 'Source Sans Pro', sans-serif;
    color: #333;
    line-height: 1.8;
    padding: 40px 32px;
    margin: 0;
    background: #fff;
    max-width: 800px;
    margin: 0 auto;
  }
  h1, h2, h3, h4 {
    font-family: 'Cormorant Garamond', serif;
    color: #1a2744;
    line-height: 1.3;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
  }
  h2 { font-size: 28px; border-bottom: 2px solid #4a90d9; padding-bottom: 8px; }
  h3 { font-size: 22px; }
  p { margin: 0 0 1em; font-size: 16px; }
  a { color: #4a90d9; text-decoration: underline; }
  blockquote {
    border-left: 4px solid #4a90d9;
    margin: 1.5em 0;
    padding: 12px 20px;
    background: #f0f6ff;
    color: #1a2744;
    font-style: italic;
  }
  img { max-width: 100%; height: auto; border-radius: 8px; margin: 1em 0; }
  ul, ol { padding-left: 1.5em; margin: 1em 0; }
  li { margin-bottom: 0.3em; }
  hr { border: none; border-top: 1px solid #ddd; margin: 2em 0; }
  mark { background: #fef3c7; padding: 2px 4px; border-radius: 2px; }
  .preview-header {
    background: #1a2744;
    color: white;
    padding: 24px 32px;
    margin: -40px -32px 32px;
    font-family: 'Cormorant Garamond', serif;
  }
  .preview-header h1 {
    color: white;
    font-size: 32px;
    margin: 0;
  }
  .preview-meta {
    font-family: 'Source Sans 3', sans-serif;
    font-size: 13px;
    opacity: 0.8;
    margin-top: 8px;
  }
`;

export default function PreviewPane({ html, title, author, date }) {
  const srcDoc = useMemo(() => {
    const headerHtml = title ? `
      <div class="preview-header">
        <h1>${title}</h1>
        <div class="preview-meta">
          ${author ? `Par ${author}` : ''}${author && date ? ' \u2014 ' : ''}${date || ''}
        </div>
      </div>
    ` : '';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Source+Sans+3:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>${PREVIEW_STYLES}</style>
</head>
<body>${headerHtml}${html || '<p style="color:#999">Aucun contenu \u00e0 pr\u00e9visualiser</p>'}</body>
</html>`;
  }, [html, title, author, date]);

  return (
    <div className="preview-pane">
      <iframe
        srcDoc={srcDoc}
        title="Aper\u00e7u de l\u2019article"
        className="preview-iframe"
        sandbox="allow-same-origin"
      />
    </div>
  );
}
