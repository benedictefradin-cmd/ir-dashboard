import Modal from '../shared/Modal';
import AuthorPicker from '../shared/AuthorPicker';
import ServiceBadge from '../shared/ServiceBadge';
import { COLORS } from '../../utils/constants';

// Modale de publication legacy en 3 étapes (Profil → Prévisualisation → Publication).
// Utilisée depuis Articles.jsx via le bouton "Publier" sur les articles `ready`.
// La nouvelle modale multilingue (PublishWithTranslation) est utilisée depuis le
// formulaire d'édition.
export default function PublishFlowModal({
  publishFlow,
  setPublishFlow,
  onClose,
  auteurs,
  selectedAuthors,
  setSelectedAuthors,
  previewHtml,
  previewLoading,
  publishResult,
  publishError,
  goToStep2,
  executePublish,
  onAddNewProfile,
}) {
  return (
    <Modal
      title={
        publishFlow.step === 1 ? 'Publier — Étape 1/3 : Sélection du profil' :
        publishFlow.step === 2 ? 'Publier — Étape 2/3 : Prévisualisation' :
        'Publier — Étape 3/3 : Confirmation'
      }
      onClose={onClose}
      size="lg"
    >
      <div className="publish-stepper mb-20">
        {[1, 2, 3].map(s => (
          <div key={s} className={`publish-step${publishFlow.step === s ? ' active' : ''}${publishFlow.step > s ? ' done' : ''}`}>
            <span className="publish-step-num">{publishFlow.step > s ? '✓' : s}</span>
            <span className="publish-step-label">
              {s === 1 ? 'Profil' : s === 2 ? 'Prévisualisation' : 'Publication'}
            </span>
          </div>
        ))}
      </div>

      {publishFlow.step === 1 && (
        <div>
          <p style={{ fontSize: 14, color: COLORS.textLight, marginBottom: 16 }}>
            Sélectionnez le ou les profil(s) auteur de « <strong>{publishFlow.article.title}</strong> »
          </p>
          <AuthorPicker
            authors={auteurs.filter(a => a.actif !== false)}
            selected={selectedAuthors}
            onChange={setSelectedAuthors}
            multiple={true}
            onAddNew={onAddNewProfile}
          />
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={onClose}>Annuler</button>
            <button
              className="btn btn-primary"
              disabled={selectedAuthors.length === 0}
              onClick={goToStep2}
            >
              Suivant →
            </button>
          </div>
        </div>
      )}

      {publishFlow.step === 2 && (
        <div>
          <div className="publish-preview-meta mb-16">
            <div className="flex-wrap gap-8 mb-8">
              {selectedAuthors.map(id => {
                const a = auteurs.find(au => au.id === id);
                if (!a) return null;
                return (
                  <span key={id} className="author-chip">
                    {a.firstName && a.lastName ? `${a.firstName} ${a.lastName}` : a.name}
                  </span>
                );
              })}
            </div>
            <div className="flex-wrap gap-8">
              {publishFlow.article.tags?.map(t => <span key={t} className="badge badge-sky">{t}</span>)}
              {publishFlow.article.type && <span className="badge badge-navy">{publishFlow.article.type}</span>}
              {publishFlow.article.mediaSource && <span className="badge badge-ochre">{publishFlow.article.mediaSource}</span>}
            </div>
          </div>

          <div className="publish-preview-content">
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, marginBottom: 12, color: COLORS.navy }}>
              {publishFlow.article.title}
            </h2>
            {previewLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: COLORS.textLight }}>Chargement du contenu…</div>
            ) : (
              <div className="notion-content" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            )}
          </div>

          <div className="flex-wrap gap-8 mt-16 mb-8">
            <ServiceBadge service="github" />
            <ServiceBadge service="vercel" />
          </div>

          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setPublishFlow(prev => ({ ...prev, step: 1 }))}>← Retour</button>
            <button className="btn btn-outline" onClick={onClose}>Annuler</button>
            <button className="btn btn-primary" onClick={executePublish}>
              Publier sur le site
            </button>
          </div>
        </div>
      )}

      {publishFlow.step === 3 && (
        <div>
          {!publishResult && !publishError && (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <div className="publish-spinner" />
              <p style={{ marginTop: 16, color: COLORS.textLight }}>Publication en cours…</p>
            </div>
          )}

          {publishResult && (
            <div className="publish-success slide-up">
              <div className="publish-success-icon">&#10003;</div>
              <h3>Article publié avec succès</h3>
              <div className="publish-success-details">
                <div><strong>Titre :</strong> {publishResult.title}</div>
                <div><strong>Auteur(s) :</strong> {publishResult.authors}</div>
                <div><strong>Date :</strong> {publishResult.date}</div>
                <div><strong>Slug :</strong> {publishResult.slug}</div>
                {publishResult.sha && <div><strong>Commit :</strong> <code>{publishResult.sha.slice(0, 7)}</code></div>}
                <div className="flex-wrap gap-8 mt-8">
                  <span className="badge badge-green">GitHub : Commité</span>
                </div>
              </div>
              <div className="modal-footer">
                {publishResult.siteUrl && (
                  <a href={publishResult.siteUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                    Voir sur le site ↗
                  </a>
                )}
                <button className="btn btn-outline" onClick={onClose}>Fermer</button>
              </div>
            </div>
          )}

          {publishError && (
            <div className="publish-error slide-up">
              <div className="publish-error-icon">&#10007;</div>
              <h3>Erreur lors de la publication</h3>
              <p style={{ color: COLORS.danger, marginBottom: 16 }}>{publishError}</p>
              <div className="modal-footer">
                <button className="btn btn-primary" onClick={executePublish}>Réessayer</button>
                <button className="btn btn-outline" onClick={onClose}>Fermer</button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
