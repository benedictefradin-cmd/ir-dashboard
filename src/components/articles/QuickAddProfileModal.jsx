import Modal from '../shared/Modal';

// Création express d'un profil (prénom + nom) depuis le picker d'auteurs
// d'un article. Le profil est créé avec le rôle "auteur_externe" et auto-
// sélectionné dans le picker en cours.
export default function QuickAddProfileModal({ value, onChange, onSubmit, onClose, saving }) {
  const canSubmit = value.firstName.trim() && value.lastName.trim() && !saving;

  return (
    <Modal title="Nouveau profil — création rapide" onClose={onClose} size="sm">
      <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 16 }}>
        Crée un profil minimal (prénom + nom). Tu pourras compléter description,
        photo, LinkedIn et email plus tard depuis la page Profils.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label>Prénom *</label>
          <input
            value={value.firstName}
            onChange={e => onChange({ ...value, firstName: e.target.value })}
            autoFocus
          />
        </div>
        <div>
          <label>Nom *</label>
          <input
            value={value.lastName}
            onChange={e => onChange({ ...value, lastName: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && canSubmit && onSubmit()}
          />
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 16 }}>
        Le profil sera créé avec le rôle « Auteur externe » par défaut. Tu pourras
        changer ça depuis la page Profils.
      </p>
      <div className="modal-footer">
        <button className="btn btn-outline" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!canSubmit} onClick={onSubmit}>
          {saving ? 'Création…' : 'Créer et sélectionner'}
        </button>
      </div>
    </Modal>
  );
}
