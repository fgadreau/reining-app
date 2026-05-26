import React from "react";
import { Link } from "react-router-dom";
import { appStyles as styles } from "../../styles/appStyles";

const LAST_UPDATED = "26 mai 2026";

const policyNotice =
  "Document de travail fourni pour aider à encadrer l'utilisation de ShowScore. Il ne remplace pas l'avis d'un avocat et devrait être validé avant une utilisation commerciale publique.";

const termsSections = [
  {
    title: "1. Acceptation",
    paragraphs: [
      "En utilisant ShowScore, vous acceptez les présentes conditions d'utilisation, la politique de confidentialité et l'avis sur les résultats.",
      "Si vous utilisez ShowScore pour une association, un show ou un organisme, vous confirmez avoir l'autorité nécessaire pour agir en son nom.",
    ],
  },
  {
    title: "2. Nature du service",
    paragraphs: [
      "ShowScore est un outil de gestion de pointage pour compétitions équestres jugées. L'application aide à préparer les classes, enregistrer les scores, générer des feuilles de pointage, suivre le déroulement d'un show et publier certains résultats.",
      "ShowScore ne remplace pas le jugement des officiels, les règlements de l'association, le secrétariat du concours ni les procédures officielles de validation.",
    ],
  },
  {
    title: "3. Comptes et accès",
    paragraphs: [
      "Les utilisateurs sont responsables de garder leurs identifiants confidentiels et d'utiliser seulement les rôles qui leur sont attribués.",
      "Un administrateur d'association peut inviter ou retirer des utilisateurs selon les besoins opérationnels du show.",
    ],
  },
  {
    title: "4. Données de compétition",
    paragraphs: [
      "Les associations et leurs utilisateurs sont responsables de l'exactitude des inscriptions, ordres de passage, scores, pénalités, notes, validations et publications.",
      "Les notes ajoutées par les juges ou scribes doivent rester pertinentes au pointage et ne devraient pas contenir de renseignements sensibles inutiles.",
    ],
  },
  {
    title: "5. Publication des résultats",
    paragraphs: [
      "Les résultats, scoresheets, informations de classes et données de live peuvent devenir visibles au public lorsqu'une association les publie ou active la vitrine publique.",
      "Une association doit s'assurer qu'elle a le droit de publier les renseignements de compétition qu'elle rend publics.",
    ],
  },
  {
    title: "6. Utilisation acceptable",
    paragraphs: [
      "Il est interdit d'utiliser ShowScore pour compromettre la sécurité de l'application, contourner les accès, publier du contenu trompeur ou saisir des renseignements qui ne sont pas nécessaires à l'organisation du concours.",
      "ShowScore peut suspendre ou limiter un accès en cas d'utilisation abusive, de risque de sécurité ou de demande raisonnable d'une association responsable.",
    ],
  },
  {
    title: "7. Disponibilité, sauvegardes et vérification",
    paragraphs: [
      "ShowScore vise à rester disponible et fiable, mais aucun service numérique ne peut garantir une disponibilité parfaite.",
      "Les associations devraient vérifier les scores avant publication et conserver leurs propres copies des documents importants lorsque requis par leurs procédures.",
    ],
  },
  {
    title: "8. Propriété intellectuelle",
    paragraphs: [
      "Le nom, l'interface, le code et les éléments de ShowScore appartiennent à leur propriétaire, sauf indication contraire.",
      "Les données de compétition saisies par une association demeurent sous la responsabilité de cette association.",
    ],
  },
  {
    title: "9. Limitation de responsabilité",
    paragraphs: [
      "Dans la mesure permise par la loi, ShowScore n'est pas responsable des erreurs de pointage, décisions officielles, pertes de données, interruptions, retards de publication ou dommages indirects liés à l'utilisation de l'application.",
      "Les utilisateurs doivent valider les résultats selon les règlements et processus de leur association.",
    ],
  },
  {
    title: "10. Modifications",
    paragraphs: [
      "Ces conditions peuvent être mises à jour à mesure que l'application évolue. La date de mise à jour indique la version applicable.",
    ],
  },
  {
    title: "11. Contact",
    paragraphs: [
      "Pour toute question, communiquez avec l'administrateur qui vous a donné accès ou avec le canal de support fourni par ShowScore.",
    ],
  },
];

const privacySections = [
  {
    title: "1. Renseignements collectés",
    paragraphs: [
      "ShowScore peut traiter des renseignements de compte, comme le courriel, le nom affiché et les rôles d'accès.",
      "L'application peut aussi traiter des renseignements de compétition, comme les associations, shows, jours, classes, participants, chevaux, numéros de dossard, ordres de passage, scores, pénalités, notes, signatures, validations et documents PDF générés.",
      "Des renseignements techniques peuvent être traités pour l'authentification, la synchronisation cloud, la sécurité, le stockage local et le bon fonctionnement de l'application.",
    ],
  },
  {
    title: "2. Finalités",
    paragraphs: [
      "Les renseignements sont utilisés pour gérer les accès, préparer les classes, enregistrer les pointages, synchroniser les données, générer des documents, publier les résultats autorisés et soutenir les opérations du show.",
      "Les renseignements ne devraient être saisis que lorsqu'ils sont nécessaires à ces finalités.",
    ],
  },
  {
    title: "3. Partage et publication",
    paragraphs: [
      "Les données peuvent être visibles par les utilisateurs autorisés d'une association selon leur rôle.",
      "Lorsque le live ou les résultats publiés sont activés, certaines données de compétition peuvent être visibles dans la vitrine publique.",
      "ShowScore peut s'appuyer sur des fournisseurs techniques, notamment pour l'hébergement, l'authentification et la base de données, afin d'exploiter le service.",
    ],
  },
  {
    title: "4. Conservation et sécurité",
    paragraphs: [
      "ShowScore applique des mesures raisonnables pour protéger les renseignements contre l'accès non autorisé, la perte ou l'utilisation inappropriée.",
      "Les utilisateurs doivent aussi protéger leurs comptes, appareils, exports et fichiers téléchargés.",
      "Les renseignements sont conservés aussi longtemps que nécessaire pour fournir le service, respecter les besoins opérationnels ou répondre à des obligations applicables.",
    ],
  },
  {
    title: "5. Stockage local et synchronisation",
    paragraphs: [
      "Certaines données peuvent être conservées temporairement dans le navigateur ou l'appareil afin de soutenir le mode local, la performance ou la synchronisation.",
      "Un appareil partagé devrait être déconnecté ou nettoyé selon les procédures de l'association après un concours.",
    ],
  },
  {
    title: "6. Droits et demandes",
    paragraphs: [
      "Une personne peut demander l'accès, la correction ou la suppression de renseignements personnels la concernant, sous réserve des limites légales ou opérationnelles applicables.",
      "Les demandes liées aux données d'une compétition devraient d'abord être dirigées vers l'association responsable du show.",
    ],
  },
  {
    title: "7. Mineurs et renseignements sensibles",
    paragraphs: [
      "Les associations devraient limiter les renseignements concernant les mineurs au strict nécessaire pour la compétition.",
      "Les notes de juge ou de scribe ne devraient pas contenir de renseignements médicaux, financiers, familiaux ou autres renseignements sensibles non requis pour le pointage.",
    ],
  },
  {
    title: "8. Modifications",
    paragraphs: [
      "Cette politique peut être mise à jour à mesure que ShowScore évolue ou que les exigences légales changent.",
    ],
  },
  {
    title: "9. Contact",
    paragraphs: [
      "Pour une question de confidentialité, communiquez avec l'administrateur qui vous a donné accès ou avec le canal de support fourni par ShowScore.",
    ],
  },
];

const resultsSections = [
  {
    title: "1. Outil d'aide au pointage",
    paragraphs: [
      "ShowScore aide à calculer, afficher et publier des scores, mais les résultats officiels demeurent sous l'autorité de l'association, du secrétariat, des juges et des officiels du concours.",
    ],
  },
  {
    title: "2. Live, provisoire et officiel",
    paragraphs: [
      "Un score affiché en direct ou dans un classement provisoire peut changer après vérification, validation du secrétariat, correction d'erreur, application des règlements ou décision officielle.",
      "Les classes avec travail en piste ou ajustement final peuvent utiliser un classement provisoire pour aider les officiels et annonceurs. Le classement doit être complété avec le travail en piste en dehors de l'application lorsque requis.",
    ],
  },
  {
    title: "3. Scoresheets publiées",
    paragraphs: [
      "Les scoresheets publiées sont fournies pour consultation. Elles peuvent contenir les scores de manoeuvres, pénalités, notes et mentions spéciales saisies dans l'application.",
      "Une association peut corriger, republier ou retirer des résultats lorsque nécessaire.",
    ],
  },
  {
    title: "4. Contestations et erreurs",
    paragraphs: [
      "Toute question concernant un score, une pénalité, une disqualification, un ordre de passage ou un classement doit être adressée à l'association ou au secrétariat du concours.",
      "ShowScore ne tranche pas les contestations sportives et ne remplace pas les procédures de l'association.",
    ],
  },
  {
    title: "5. Estimations et informations de déroulement",
    paragraphs: [
      "Les estimations de temps, statuts de classe, pauses, drags et prochains participants sont fournis à titre indicatif et peuvent varier selon le déroulement réel du concours.",
    ],
  },
];

export function TermsPage() {
  return (
    <LegalDocument
      title="Conditions d'utilisation"
      intro="Ces conditions encadrent l'utilisation de ShowScore par les administrateurs, secrétaires, scribes, annonceurs et autres utilisateurs autorisés."
      sections={termsSections}
    />
  );
}

export function PrivacyPage() {
  return (
    <LegalDocument
      title="Politique de confidentialité"
      intro="Cette politique résume les renseignements que ShowScore peut traiter et la façon dont ils sont utilisés pour offrir le service."
      sections={privacySections}
    />
  );
}

export function ResultsNoticePage() {
  return (
    <LegalDocument
      title="Avis sur les résultats"
      intro="Cet avis explique le rôle de ShowScore dans l'affichage des scores, des scoresheets et des classements provisoires."
      sections={resultsSections}
    />
  );
}

function LegalDocument({ title, intro, sections }) {
  return (
    <div style={styles.app}>
      <div style={backRowStyle}>
        <Link to="/" style={secondaryLinkStyle}>
          Accueil
        </Link>
        <Link to="/login" style={secondaryLinkStyle}>
          Connexion
        </Link>
      </div>

      <article style={documentStyle}>
        <div style={eyebrowStyle}>ShowScore</div>
        <h1 style={titleStyle}>{title}</h1>
        <div style={updatedStyle}>Dernière mise à jour : {LAST_UPDATED}</div>
        <p style={introStyle}>{intro}</p>
        <div style={noticeStyle}>{policyNotice}</div>

        {sections.map((section) => (
          <section key={section.title} style={sectionStyle}>
            <h2 style={sectionTitleStyle}>{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} style={paragraphStyle}>
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}

const backRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 16,
};

const documentStyle = {
  maxWidth: 920,
  background: "#fff",
  borderRadius: 12,
  padding: 22,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const eyebrowStyle = {
  color: "#64748b",
  fontWeight: 800,
  textTransform: "uppercase",
  fontSize: 12,
  letterSpacing: 0,
};

const titleStyle = {
  margin: "4px 0",
  fontSize: 30,
  lineHeight: 1.15,
};

const updatedStyle = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 14,
};

const introStyle = {
  color: "#334155",
  fontSize: 16,
  lineHeight: 1.5,
};

const noticeStyle = {
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#92400e",
  borderRadius: 8,
  padding: 12,
  lineHeight: 1.45,
  margin: "16px 0 20px",
};

const sectionStyle = {
  borderTop: "1px solid #e2e8f0",
  paddingTop: 16,
  marginTop: 16,
};

const sectionTitleStyle = {
  margin: "0 0 8px",
  fontSize: 20,
};

const paragraphStyle = {
  color: "#475569",
  lineHeight: 1.55,
  margin: "8px 0",
};

const secondaryLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  textDecoration: "none",
  fontWeight: 700,
};
