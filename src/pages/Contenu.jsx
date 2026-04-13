import { useState } from 'react';
import ServiceBadge from '../components/shared/ServiceBadge';
import { THEMATIQUES } from '../utils/constants';
import { triggerRebuild, hasDeployHook } from '../services/deploy';
import { hasGitHub } from '../services/github';
import useUnsavedGuard from '../hooks/useUnsavedGuard';

// ─── Toutes les pages statiques du site, regroupées par catégorie ───
const PAGE_GROUPS = [
  {
    group: 'Identité',
    pages: [
      { id: 'projet', label: 'Le Projet' },
      { id: 'roadmap', label: 'Road to Net Zero' },
      { id: 'thematiques', label: 'Thématiques' },
      { id: 'propositions', label: 'Nos propositions' },
      { id: 'rapport_activite', label: 'Rapport d\'activité' },
    ],
  },
  {
    group: 'Engagement',
    pages: [
      { id: 'adhesion', label: 'Adhésion' },
      { id: 'don', label: 'Faire un don' },
      { id: 'partenaires', label: 'Partenaires' },
    ],
  },
  {
    group: 'Contenu éditorial',
    pages: [
      { id: 'editos', label: 'Éditoriaux' },
      { id: 'librairie', label: 'En librairie' },
      { id: 'fiches_thematiques', label: 'Fiches thématiques' },
    ],
  },
  {
    group: 'Communication',
    pages: [
      { id: 'contact', label: 'Contact' },
      { id: 'newsletter_page', label: 'Page Newsletter' },
    ],
  },
  {
    group: 'Légal',
    pages: [
      { id: 'confidentialite', label: 'Confidentialité' },
      { id: 'mentions_legales', label: 'Mentions légales' },
      { id: 'rgpd', label: 'RGPD' },
      { id: 'erreur_404', label: 'Page 404' },
    ],
  },
];

const ALL_PAGES = PAGE_GROUPS.flatMap(g => g.pages);

export default function Contenu({ contenu, setContenu, toast, saveToSite, embedded }) {
  const [activePage, setActivePage] = useState('projet');
  const [preview, setPreview] = useState({});
  const [saving, setSaving] = useState(false);
  const { markSaved } = useUnsavedGuard(contenu);

  const getValue = (section, key) => {
    if (!contenu || !contenu[section]) return '';
    if (key) return contenu[section][key] || '';
    return contenu[section] || '';
  };

  const handleChange = (section, key, value) => {
    setContenu((prev) => {
      const updated = { ...prev };
      if (key) {
        updated[section] = { ...(updated[section] || {}), [key]: value };
      } else {
        updated[section] = value;
      }
      return updated;
    });
  };

  const handleSave = async () => {
    if (!saveToSite || !hasGitHub()) {
      toast('GitHub non configuré — allez dans Config', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveToSite('contenu', contenu, 'Mise à jour contenu du site depuis le back-office');
      markSaved();
    } finally {
      setSaving(false);
    }
  };

  const togglePreview = (key) => {
    setPreview((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderMarkdown = (text) => {
    if (!text) return '<p style="color: var(--text-light); font-style: italic;">Aucun contenu</p>';
    return text
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n/g, '<br />');
  };

  // ─── Composants réutilisables ────────────────────

  const TextSection = ({ section, label, fieldKey, rows = 8 }) => {
    const key = fieldKey || section;
    const val = fieldKey ? getValue(section, fieldKey) : getValue(section);
    const isPreview = preview[key];
    return (
      <div className="card mb-16" style={{ padding: 20 }}>
        <div className="flex-between mb-8">
          <h3 style={{ fontSize: 15 }}>{label}</h3>
          <button className="btn btn-outline btn-sm" onClick={() => togglePreview(key)}>
            {isPreview ? 'Éditer' : 'Aperçu'}
          </button>
        </div>
        {isPreview ? (
          <div style={{ padding: 16, background: 'var(--cream)', borderRadius: 8, fontSize: 14, lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(val) }} />
        ) : (
          <textarea value={val} onChange={(e) => handleChange(section, fieldKey || null, e.target.value)}
            rows={rows} placeholder={`Contenu de la section ${label}…`} />
        )}
      </div>
    );
  };

  const InputField = ({ section, fieldKey, label, placeholder }) => (
    <div style={{ marginBottom: 12 }}>
      <label>{label}</label>
      <input value={getValue(section, fieldKey)} onChange={(e) => handleChange(section, fieldKey, e.target.value)} placeholder={placeholder} />
    </div>
  );

  const DynamicList = ({ section, listKey, fields, addLabel }) => {
    const items = getValue(section, listKey) || [];
    const realItems = Array.isArray(items) ? items : [];

    const update = (index, field, value) => {
      const updated = [...realItems];
      updated[index] = { ...updated[index], [field]: value };
      handleChange(section, listKey, updated);
    };

    const add = () => {
      const empty = {};
      fields.forEach(f => { empty[f.key] = ''; });
      handleChange(section, listKey, [...realItems, empty]);
    };

    const remove = (index) => {
      handleChange(section, listKey, realItems.filter((_, i) => i !== index));
    };

    return (
      <>
        {realItems.map((item, i) => (
          <div key={i} className="card mb-8" style={{ padding: 12 }}>
            <div className="flex-between mb-8">
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-light)' }}>#{i + 1}</span>
              <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)', fontSize: 11 }} onClick={() => remove(i)}>Supprimer</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: fields.length > 2 ? 'repeat(auto-fill, minmax(200px, 1fr))' : '1fr 1fr', gap: 8 }}>
              {fields.map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11 }}>{f.label}</label>
                  {f.type === 'textarea' ? (
                    <textarea value={item[f.key] || ''} onChange={(e) => update(i, f.key, e.target.value)} rows={3} placeholder={f.placeholder || ''} />
                  ) : (
                    <input value={item[f.key] || ''} onChange={(e) => update(i, f.key, e.target.value)} placeholder={f.placeholder || ''} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        <button className="btn btn-outline" style={{ marginTop: 4 }} onClick={add}>+ {addLabel || 'Ajouter'}</button>
      </>
    );
  };

  // ─── Rendus par page ─────────────────────────────

  const renderProjet = () => (
    <>
      <TextSection section="projet" label="Texte fondateur" fieldKey="presentation" />
      <TextSection section="projet" label="Citation Rousseau" fieldKey="citation" rows={3} />
      <InputField section="projet" fieldKey="citation_auteur" label="Attribution citation" placeholder="Jean-Jacques Rousseau, Du contrat social" />
      <TextSection section="projet" label="Manifeste (paragraphes fondateurs)" fieldKey="manifeste" />
      <TextSection section="projet" label="4 piliers (Écologie, Démocratie, Social, Économie)" fieldKey="piliers" />
      <TextSection section="projet" label="3 convictions" fieldKey="convictions" />
      <TextSection section="projet" label="Timeline historique" fieldKey="timeline" />
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>FAQ du projet</h3>
        <DynamicList section="projet" listKey="faq" addLabel="Ajouter une question"
          fields={[
            { key: 'question', label: 'Question', placeholder: 'Quelle est la mission de l\'Institut ?' },
            { key: 'reponse', label: 'Réponse', type: 'textarea', placeholder: 'L\'Institut Rousseau est…' },
          ]} />
      </div>
      <InputField section="projet" fieldKey="cta_titre" label="CTA — Titre" placeholder="Rejoignez le mouvement" />
      <InputField section="projet" fieldKey="cta_texte" label="CTA — Texte" placeholder="Adhérez à l'Institut…" />
    </>
  );

  const renderRoadmap = () => (
    <>
      <TextSection section="roadmap" label="Introduction Road to Net Zero" fieldKey="intro" />
      <TextSection section="roadmap" label="Description du projet" fieldKey="description" />
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 16 }}>Statistiques clés</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <InputField section="roadmap" fieldKey="stat1_label" label="Stat 1 — Label" placeholder="Réduction des émissions" />
          <InputField section="roadmap" fieldKey="stat1_value" label="Stat 1 — Valeur" placeholder="-55% d'ici 2030" />
          <InputField section="roadmap" fieldKey="stat2_label" label="Stat 2 — Label" placeholder="Investissements" />
          <InputField section="roadmap" fieldKey="stat2_value" label="Stat 2 — Valeur" placeholder="2,3% du PIB" />
        </div>
      </div>
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Documents PDF</h3>
        <InputField section="roadmap" fieldKey="pdf_rapport" label="PDF Rapport complet" placeholder="/assets/pdf/rtnz/Livre-RTNZ-FR.pdf" />
        <InputField section="roadmap" fieldKey="pdf_synthese" label="PDF Synthèse" placeholder="/assets/pdf/rtnz/RTNZ-Resume.pdf" />
        <InputField section="roadmap" fieldKey="pdf_methodologie" label="PDF Méthodologie" placeholder="/assets/pdf/rtnz/RtoNZ-Methodological-Appendix.pdf" />
      </div>
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Annexes par pays</h3>
        <DynamicList section="roadmap" listKey="annexes_pays" addLabel="Ajouter un pays"
          fields={[
            { key: 'pays', label: 'Pays', placeholder: 'France' },
            { key: 'pdf', label: 'Chemin PDF', placeholder: '/assets/pdf/rtnz/RTNZ-Annexes-France.pdf' },
          ]} />
      </div>
      <TextSection section="roadmap" label="Section investissement (2% pour 2°C)" fieldKey="investissement" />
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Citations d'experts</h3>
        <DynamicList section="roadmap" listKey="citations_experts" addLabel="Ajouter une citation"
          fields={[
            { key: 'texte', label: 'Citation', type: 'textarea', placeholder: 'Ce rapport est…' },
            { key: 'auteur', label: 'Auteur', placeholder: 'Nom' },
            { key: 'fonction', label: 'Fonction', placeholder: 'Professeur, Université de…' },
          ]} />
      </div>
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Mentions presse</h3>
        <DynamicList section="roadmap" listKey="mentions_presse" addLabel="Ajouter une mention"
          fields={[
            { key: 'media', label: 'Média', placeholder: 'Le Monde' },
            { key: 'url', label: 'URL', placeholder: 'https://…' },
          ]} />
      </div>
    </>
  );

  const renderThematiques = () => (
    <>
      {THEMATIQUES.map((theme) => (
        <TextSection key={theme} section="thematiques" label={theme}
          fieldKey={theme.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')} />
      ))}
    </>
  );

  const renderPropositions = () => (
    <>
      <InputField section="propositions" fieldKey="hero_label" label="Eyebrow label" placeholder="Des idées aux politiques publiques" />
      <InputField section="propositions" fieldKey="hero_titre" label="Titre principal" placeholder="Nos propositions" />
      <TextSection section="propositions" label="Description hero" fieldKey="hero_description" rows={4} />
      {['Écologie', 'Économie', 'Institutions', 'Social', 'International'].map(theme => (
        <div key={theme} className="card mb-16" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Propositions — {theme}</h3>
          <TextSection section="propositions" label={`Description section ${theme}`}
            fieldKey={`${theme.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}_description`} rows={3} />
          <DynamicList section="propositions" listKey={`${theme.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}_items`}
            addLabel="Ajouter une proposition"
            fields={[
              { key: 'titre', label: 'Titre', placeholder: 'Titre de la proposition' },
              { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Détail…' },
              { key: 'lien', label: 'Lien publication', placeholder: '/publications/…' },
            ]} />
        </div>
      ))}
      <InputField section="propositions" fieldKey="cta_titre" label="CTA — Titre" placeholder="Soutenez nos propositions" />
      <TextSection section="propositions" label="CTA — Texte" fieldKey="cta_texte" rows={3} />
    </>
  );

  const renderRapportActivite = () => (
    <>
      <InputField section="rapport_activite" fieldKey="titre" label="Titre" placeholder="Rapport d'activité" />
      <TextSection section="rapport_activite" label="Introduction" fieldKey="intro" rows={4} />
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Chiffres clés</h3>
        <DynamicList section="rapport_activite" listKey="chiffres" addLabel="Ajouter un chiffre"
          fields={[
            { key: 'valeur', label: 'Valeur', placeholder: '+400' },
            { key: 'label', label: 'Label', placeholder: 'Publications en accès libre' },
          ]} />
      </div>
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Timeline (jalons)</h3>
        <DynamicList section="rapport_activite" listKey="timeline" addLabel="Ajouter un jalon"
          fields={[
            { key: 'annee', label: 'Année', placeholder: '2024' },
            { key: 'titre', label: 'Titre', placeholder: 'Croissance' },
            { key: 'description', label: 'Description', type: 'textarea', placeholder: 'L\'Institut…' },
          ]} />
      </div>
      <TextSection section="rapport_activite" label="Section organisation" fieldKey="organisation" />
      <TextSection section="rapport_activite" label="Section production" fieldKey="production" />
      <TextSection section="rapport_activite" label="Section indépendance/financement" fieldKey="financement" />
      <InputField section="rapport_activite" fieldKey="cta_titre" label="CTA — Titre" placeholder="Rejoignez l'aventure" />
    </>
  );

  const renderAdhesion = () => (
    <>
      <InputField section="adhesion" fieldKey="hero_label" label="Eyebrow" placeholder="Soutenir l'Institut" />
      <InputField section="adhesion" fieldKey="hero_titre" label="Titre principal" placeholder="Devenez membre" />
      <TextSection section="adhesion" label="Sous-titre / description" fieldKey="hero_description" rows={3} />
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Avantages membres (3 blocs)</h3>
        <DynamicList section="adhesion" listKey="avantages" addLabel="Ajouter un avantage"
          fields={[
            { key: 'titre', label: 'Titre', placeholder: 'Accès prioritaire' },
            { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Recevez en avant-première…' },
          ]} />
      </div>
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Formules d'adhésion</h3>
        <DynamicList section="adhesion" listKey="formules" addLabel="Ajouter une formule"
          fields={[
            { key: 'nom', label: 'Nom', placeholder: 'Adhésion standard' },
            { key: 'prix', label: 'Prix', placeholder: '50€ / an' },
            { key: 'description', label: 'Description', placeholder: 'Pour les particuliers' },
            { key: 'recommande', label: 'Badge (vide si non)', placeholder: 'Recommandé' },
            { key: 'lien', label: 'Lien HelloAsso', placeholder: 'https://…' },
          ]} />
      </div>
      <InputField section="adhesion" fieldKey="fiscal_pourcentage" label="Réduction fiscale (%)" placeholder="66" />
      <TextSection section="adhesion" label="Texte réduction fiscale" fieldKey="fiscal_texte" rows={2} />
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>FAQ Adhésion</h3>
        <DynamicList section="adhesion" listKey="faq" addLabel="Ajouter une question"
          fields={[
            { key: 'question', label: 'Question', placeholder: 'Comment adhérer ?' },
            { key: 'reponse', label: 'Réponse', type: 'textarea', placeholder: 'Il suffit de…' },
          ]} />
      </div>
    </>
  );

  const renderDon = () => (
    <>
      <InputField section="don" fieldKey="hero_label" label="Eyebrow" placeholder="Soutenir l'Institut" />
      <InputField section="don" fieldKey="hero_titre" label="Titre" placeholder="Faire un don" />
      <TextSection section="don" label="Description hero" fieldKey="hero_description" rows={3} />
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Montants suggérés</h3>
        <DynamicList section="don" listKey="montants" addLabel="Ajouter un montant"
          fields={[
            { key: 'valeur', label: 'Montant (€)', placeholder: '50' },
            { key: 'impact', label: 'Impact', placeholder: 'Finance une note d\'analyse' },
            { key: 'apres_impot', label: 'Après réduction fiscale', placeholder: '17€' },
          ]} />
      </div>
      <InputField section="don" fieldKey="fiscal_pourcentage" label="Réduction fiscale (%)" placeholder="66" />
      <TextSection section="don" label="Texte réduction fiscale" fieldKey="fiscal_texte" rows={2} />
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Pourquoi donner ? (3 raisons)</h3>
        <DynamicList section="don" listKey="raisons" addLabel="Ajouter une raison"
          fields={[
            { key: 'titre', label: 'Titre', placeholder: 'Indépendance' },
            { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Vos dons garantissent…' },
          ]} />
      </div>
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Répartition des fonds</h3>
        <DynamicList section="don" listKey="repartition" addLabel="Ajouter une catégorie"
          fields={[
            { key: 'categorie', label: 'Catégorie', placeholder: 'Recherche' },
            { key: 'pourcentage', label: 'Pourcentage', placeholder: '60' },
          ]} />
      </div>
      <InputField section="don" fieldKey="lien_helloasso" label="Lien HelloAsso" placeholder="https://www.helloasso.com/…" />
    </>
  );

  const renderPartenaires = () => (
    <>
      <InputField section="partenaires" fieldKey="titre" label="Titre" placeholder="Nos partenaires" />
      <TextSection section="partenaires" label="Introduction" fieldKey="intro" rows={3} />
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Liste des partenaires</h3>
        <DynamicList section="partenaires" listKey="liste" addLabel="Ajouter un partenaire"
          fields={[
            { key: 'nom', label: 'Nom', placeholder: 'Fondation XYZ' },
            { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Organisation dédiée à…' },
            { key: 'logo', label: 'Logo (chemin)', placeholder: '/assets/images/partenaires/xyz.png' },
            { key: 'url', label: 'Site web', placeholder: 'https://…' },
          ]} />
      </div>
      <InputField section="partenaires" fieldKey="cta_titre" label="CTA — Devenir partenaire" placeholder="Devenir partenaire" />
      <TextSection section="partenaires" label="CTA — Texte" fieldKey="cta_texte" rows={2} />
    </>
  );

  const renderEditos = () => (
    <>
      <InputField section="editos" fieldKey="titre" label="Titre" placeholder="Éditoriaux" />
      <TextSection section="editos" label="Description / sous-titre" fieldKey="description" rows={3} />
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Éditoriaux mis en avant</h3>
        <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 12 }}>
          Sélectionnez les éditoriaux à mettre en avant sur la page. Les articles complets sont gérés dans Publications.
        </p>
        <DynamicList section="editos" listKey="featured" addLabel="Ajouter un éditorial"
          fields={[
            { key: 'titre', label: 'Titre', placeholder: 'La transition écologique…' },
            { key: 'auteur', label: 'Auteur', placeholder: 'Jean Dupont' },
            { key: 'extrait', label: 'Extrait', type: 'textarea', placeholder: 'Résumé court…' },
            { key: 'lien', label: 'Lien', placeholder: '/publications/…' },
            { key: 'categorie', label: 'Catégorie', placeholder: 'Écologie' },
          ]} />
      </div>
      <InputField section="editos" fieldKey="newsletter_titre" label="Bloc newsletter — Titre" placeholder="Restez informé" />
      <TextSection section="editos" label="Bloc newsletter — Texte" fieldKey="newsletter_texte" rows={2} />
    </>
  );

  const renderLibrairie = () => (
    <>
      <InputField section="librairie" fieldKey="titre" label="Titre" placeholder="En librairie" />
      <TextSection section="librairie" label="Description" fieldKey="description" rows={3} />
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Ouvrages</h3>
        <DynamicList section="librairie" listKey="ouvrages" addLabel="Ajouter un ouvrage"
          fields={[
            { key: 'titre', label: 'Titre', placeholder: 'Le titre du livre' },
            { key: 'auteur', label: 'Auteur(s)', placeholder: 'Prénom Nom' },
            { key: 'editeur', label: 'Éditeur', placeholder: 'Éditions XYZ' },
            { key: 'date', label: 'Date de publication', placeholder: '2024' },
            { key: 'description', label: 'Synopsis', type: 'textarea', placeholder: 'Ce livre explore…' },
            { key: 'image', label: 'Image couverture', placeholder: '/assets/images/librairie/…' },
            { key: 'badge', label: 'Badge (vide si non)', placeholder: 'Ouvrage fondateur' },
          ]} />
      </div>
      <InputField section="librairie" fieldKey="cta_texte" label="CTA bas de page" placeholder="Vous souhaitez contribuer ?" />
    </>
  );

  const renderFichesThematiques = () => (
    <>
      <InputField section="fiches_thematiques" fieldKey="titre" label="Titre" placeholder="Fiches thématiques" />
      <InputField section="fiches_thematiques" fieldKey="label" label="Label collection" placeholder="Collection" />
      <TextSection section="fiches_thematiques" label="Description" fieldKey="description" rows={3} />
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Fiches par thème</h3>
        <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 12 }}>
          Description courte affichée pour chaque thème sur la page fiches.
        </p>
        {THEMATIQUES.map(theme => {
          const key = theme.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return (
            <div key={theme} style={{ marginBottom: 12 }}>
              <label style={{ fontWeight: 600 }}>{theme}</label>
              <textarea
                value={getValue('fiches_thematiques', `${key}_description`) || ''}
                onChange={(e) => handleChange('fiches_thematiques', `${key}_description`, e.target.value)}
                rows={2} placeholder={`Description courte pour ${theme}…`}
              />
            </div>
          );
        })}
      </div>
    </>
  );

  const renderContact = () => (
    <>
      <InputField section="contact" fieldKey="titre" label="Titre" placeholder="Contactez l'Institut Rousseau" />
      <TextSection section="contact" label="Sous-titre / description" fieldKey="description" rows={3} />
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Sujets du formulaire</h3>
        <DynamicList section="contact" listKey="sujets" addLabel="Ajouter un sujet"
          fields={[
            { key: 'valeur', label: 'Valeur technique', placeholder: 'presse' },
            { key: 'label', label: 'Label affiché', placeholder: 'Demande presse / média' },
          ]} />
      </div>
      <InputField section="contact" fieldKey="temps_reponse" label="Temps de réponse affiché" placeholder="48 heures ouvrées" />
      <TextSection section="contact" label="Texte confidentialité formulaire" fieldKey="confidentialite_texte" rows={2} />
      <InputField section="contact" fieldKey="social_titre" label="Section réseaux — Titre" placeholder="Nous suivre" />
    </>
  );

  const renderNewsletterPage = () => (
    <>
      <InputField section="newsletter_page" fieldKey="label" label="Eyebrow" placeholder="Restez informé" />
      <InputField section="newsletter_page" fieldKey="titre" label="Titre" placeholder="Newsletter" />
      <TextSection section="newsletter_page" label="Description" fieldKey="description" rows={3} />
      <InputField section="newsletter_page" fieldKey="compteur" label="Compteur abonnés" placeholder="1 500+ abonnés" />
      <InputField section="newsletter_page" fieldKey="placeholder_email" label="Placeholder email" placeholder="votre@email.com" />
      <InputField section="newsletter_page" fieldKey="bouton_texte" label="Texte du bouton" placeholder="S'inscrire" />
      <TextSection section="newsletter_page" label="Texte RGPD sous formulaire" fieldKey="rgpd_texte" rows={2} />
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Aperçu derniers envois</h3>
        <DynamicList section="newsletter_page" listKey="derniers_envois" addLabel="Ajouter un envoi"
          fields={[
            { key: 'sujet', label: 'Sujet', placeholder: 'Nouvelle note d\'analyse' },
            { key: 'date', label: 'Date', placeholder: '15 mars 2026' },
          ]} />
      </div>
      <InputField section="newsletter_page" fieldKey="social_titre" label="Réseaux sociaux — Titre" placeholder="Suivez-nous aussi" />
      <TextSection section="newsletter_page" label="Réseaux sociaux — Description" fieldKey="social_description" rows={2} />
    </>
  );

  const renderConfidentialite = () => (
    <TextSection section="confidentialite" label="Politique de confidentialité" />
  );

  const renderMentionsLegales = () => (
    <>
      <InputField section="mentions_legales" fieldKey="titre" label="Titre" placeholder="Mentions légales" />
      <TextSection section="mentions_legales" label="Informations légales" fieldKey="infos_legales" />
      <TextSection section="mentions_legales" label="Protection des données" fieldKey="protection_donnees" />
      <TextSection section="mentions_legales" label="Propriété intellectuelle" fieldKey="propriete_intellectuelle" />
    </>
  );

  const renderRGPD = () => (
    <>
      <InputField section="rgpd" fieldKey="titre" label="Titre" placeholder="Politique de confidentialité" />
      <TextSection section="rgpd" label="Responsable du traitement" fieldKey="responsable" rows={4} />
      <TextSection section="rgpd" label="Données collectées" fieldKey="donnees_collectees" />
      <TextSection section="rgpd" label="Finalités du traitement" fieldKey="finalites" />
      <TextSection section="rgpd" label="Base légale" fieldKey="base_legale" />
      <TextSection section="rgpd" label="Destinataires" fieldKey="destinataires" />
      <TextSection section="rgpd" label="Durées de conservation" fieldKey="conservation" />
      <TextSection section="rgpd" label="Droits des utilisateurs" fieldKey="droits" />
      <TextSection section="rgpd" label="Cookies" fieldKey="cookies" rows={4} />
      <TextSection section="rgpd" label="Sécurité" fieldKey="securite" rows={4} />
      <InputField section="rgpd" fieldKey="derniere_maj" label="Date dernière mise à jour" placeholder="12 avril 2026" />
    </>
  );

  const render404 = () => (
    <>
      <InputField section="erreur_404" fieldKey="titre" label="Titre" placeholder="Page introuvable" />
      <TextSection section="erreur_404" label="Message d'erreur" fieldKey="message" rows={3} />
      <InputField section="erreur_404" fieldKey="bouton_accueil" label="Texte bouton accueil" placeholder="Retour à l'accueil" />
      <InputField section="erreur_404" fieldKey="bouton_publications" label="Texte bouton publications" placeholder="Nos publications" />
      <InputField section="erreur_404" fieldKey="search_placeholder" label="Placeholder recherche" placeholder="Rechercher une publication…" />
      <div className="card mb-16" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Liens populaires suggérés</h3>
        <DynamicList section="erreur_404" listKey="liens_populaires" addLabel="Ajouter un lien"
          fields={[
            { key: 'label', label: 'Label', placeholder: 'Publications' },
            { key: 'url', label: 'URL', placeholder: '/publications' },
          ]} />
      </div>
    </>
  );

  const RENDERERS = {
    projet: renderProjet,
    roadmap: renderRoadmap,
    thematiques: renderThematiques,
    propositions: renderPropositions,
    rapport_activite: renderRapportActivite,
    adhesion: renderAdhesion,
    don: renderDon,
    partenaires: renderPartenaires,
    editos: renderEditos,
    librairie: renderLibrairie,
    fiches_thematiques: renderFichesThematiques,
    contact: renderContact,
    newsletter_page: renderNewsletterPage,
    confidentialite: renderConfidentialite,
    mentions_legales: renderMentionsLegales,
    rgpd: renderRGPD,
    erreur_404: render404,
  };

  const activeLabel = ALL_PAGES.find(p => p.id === activePage)?.label || '';

  const content = (
    <>
        {/* Sélecteur de page par groupes */}
        {PAGE_GROUPS.map((group) => (
          <div key={group.group} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, paddingLeft: 4 }}>
              {group.group}
            </div>
            <div className="tab-group" style={{ flexWrap: 'wrap', marginBottom: 4 }}>
              {group.pages.map((page) => (
                <button
                  key={page.id}
                  className={`tab-item${activePage === page.id ? ' active' : ''}`}
                  onClick={() => setActivePage(page.id)}
                  style={{ fontSize: 13 }}
                >
                  {page.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 8 }}>
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>{activeLabel}</h2>
          {RENDERERS[activePage]?.()}
        </div>

        <div className="flex-wrap gap-8" style={{ marginTop: 24 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Sauvegarde…' : 'Sauvegarder tout'}
          </button>
          <button className="btn btn-outline" onClick={async () => {
            if (!hasDeployHook()) { toast('Deploy hook non configuré — allez dans Config', 'error'); return; }
            try { await triggerRebuild(); toast('Rebuild déclenché'); } catch (e) { toast(e.message, 'error'); }
          }}>Rebuild site</button>
        </div>
    </>
  );

  if (embedded) return content;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Contenu du site</h1>
          <p className="page-header-sub">Toutes les pages statiques — {ALL_PAGES.length} pages</p>
        </div>
        <div className="flex-center gap-8">
          <ServiceBadge service="github" />
          {saveToSite && hasGitHub() && (
            <button className="btn btn-green" onClick={handleSave} disabled={saving}>
              {saving ? 'Publication…' : 'Publier sur le site'}
            </button>
          )}
        </div>
      </div>
      <div className="page-body">
        {content}
      </div>
    </>
  );
}
