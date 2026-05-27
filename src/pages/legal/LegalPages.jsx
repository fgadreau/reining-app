import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { appStyles as styles } from "../../styles/appStyles";

const LAST_UPDATED = "26 mai 2026";
const LAST_UPDATED_EN = "May 26, 2026";

const policyNotice =
  "Document de travail fourni pour aider à encadrer l'utilisation de ShowScore. Il ne remplace pas l'avis d'un avocat et devrait être validé avant une utilisation commerciale publique.";
const policyNoticeEn =
  "Working document provided to help frame the use of ShowScore. It does not replace legal advice and should be validated before public commercial use.";

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

const termsSectionsEn = [
  {
    title: "1. Acceptance",
    paragraphs: [
      "By using ShowScore, you accept these terms of use, the privacy policy, and the results notice.",
      "If you use ShowScore for an association, show, or organization, you confirm that you have the authority needed to act on its behalf.",
    ],
  },
  {
    title: "2. Nature of the service",
    paragraphs: [
      "ShowScore is a scoring management tool for judged equestrian competitions. The application helps prepare classes, record scores, generate score sheets, follow the flow of a show, and publish certain results.",
      "ShowScore does not replace the judgment of officials, association rules, show secretariat work, or official validation procedures.",
    ],
  },
  {
    title: "3. Accounts and access",
    paragraphs: [
      "Users are responsible for keeping their credentials confidential and using only the roles assigned to them.",
      "An association administrator may invite or remove users according to the operational needs of the show.",
    ],
  },
  {
    title: "4. Competition data",
    paragraphs: [
      "Associations and their users are responsible for the accuracy of entries, orders of go, scores, penalties, notes, validations, and publications.",
      "Notes added by judges or scribes must remain relevant to scoring and should not contain unnecessary sensitive information.",
    ],
  },
  {
    title: "5. Publication of results",
    paragraphs: [
      "Results, score sheets, class information, and live data may become visible to the public when an association publishes them or activates the public showcase.",
      "An association must ensure it has the right to publish the competition information it makes public.",
    ],
  },
  {
    title: "6. Acceptable use",
    paragraphs: [
      "ShowScore may not be used to compromise application security, bypass access controls, publish misleading content, or enter information that is not needed to organize the competition.",
      "ShowScore may suspend or limit access in cases of misuse, security risk, or a reasonable request from a responsible association.",
    ],
  },
  {
    title: "7. Availability, backups, and verification",
    paragraphs: [
      "ShowScore aims to remain available and reliable, but no digital service can guarantee perfect availability.",
      "Associations should verify scores before publication and keep their own copies of important documents when required by their procedures.",
    ],
  },
  {
    title: "8. Intellectual property",
    paragraphs: [
      "The ShowScore name, interface, code, and elements belong to their owner unless otherwise stated.",
      "Competition data entered by an association remains under that association’s responsibility.",
    ],
  },
  {
    title: "9. Limitation of liability",
    paragraphs: [
      "To the extent permitted by law, ShowScore is not responsible for scoring errors, official decisions, data loss, interruptions, publication delays, or indirect damages related to use of the application.",
      "Users must validate results according to their association’s rules and processes.",
    ],
  },
  {
    title: "10. Changes",
    paragraphs: [
      "These terms may be updated as the application evolves. The update date indicates the applicable version.",
    ],
  },
  {
    title: "11. Contact",
    paragraphs: [
      "For questions, contact the administrator who gave you access or the support channel provided by ShowScore.",
    ],
  },
];

const privacySectionsEn = [
  {
    title: "1. Information collected",
    paragraphs: [
      "ShowScore may process account information such as email, display name, and access roles.",
      "The application may also process competition information such as associations, shows, days, classes, participants, horses, back numbers, orders of go, scores, penalties, notes, signatures, validations, and generated PDF documents.",
      "Technical information may be processed for authentication, cloud sync, security, local storage, and proper operation of the application.",
    ],
  },
  {
    title: "2. Purposes",
    paragraphs: [
      "Information is used to manage access, prepare classes, record scores, synchronize data, generate documents, publish authorized results, and support show operations.",
      "Information should be entered only when it is necessary for those purposes.",
    ],
  },
  {
    title: "3. Sharing and publication",
    paragraphs: [
      "Data may be visible to authorized users of an association according to their role.",
      "When live or published results are enabled, certain competition data may be visible in the public showcase.",
      "ShowScore may rely on technical providers, including for hosting, authentication, and database services, to operate the service.",
    ],
  },
  {
    title: "4. Retention and security",
    paragraphs: [
      "ShowScore applies reasonable measures to protect information from unauthorized access, loss, or inappropriate use.",
      "Users must also protect their accounts, devices, exports, and downloaded files.",
      "Information is retained as long as necessary to provide the service, meet operational needs, or comply with applicable obligations.",
    ],
  },
  {
    title: "5. Local storage and synchronization",
    paragraphs: [
      "Some data may be temporarily kept in the browser or device to support local mode, performance, or synchronization.",
      "A shared device should be signed out or cleaned according to the association’s procedures after a competition.",
    ],
  },
  {
    title: "6. Rights and requests",
    paragraphs: [
      "A person may request access to, correction of, or deletion of personal information about them, subject to applicable legal or operational limits.",
      "Requests related to competition data should first be directed to the association responsible for the show.",
    ],
  },
  {
    title: "7. Minors and sensitive information",
    paragraphs: [
      "Associations should limit information about minors to what is strictly necessary for the competition.",
      "Judge or scribe notes should not contain medical, financial, family, or other sensitive information that is not required for scoring.",
    ],
  },
  {
    title: "8. Changes",
    paragraphs: [
      "This policy may be updated as ShowScore evolves or legal requirements change.",
    ],
  },
  {
    title: "9. Contact",
    paragraphs: [
      "For a privacy question, contact the administrator who gave you access or the support channel provided by ShowScore.",
    ],
  },
];

const resultsSectionsEn = [
  {
    title: "1. Scoring assistance tool",
    paragraphs: [
      "ShowScore helps calculate, display, and publish scores, but official results remain under the authority of the association, secretariat, judges, and show officials.",
    ],
  },
  {
    title: "2. Live, provisional, and official",
    paragraphs: [
      "A score shown live or in a provisional ranking may change after review, secretariat validation, error correction, rule application, or an official decision.",
      "Classes with in-pen work or final adjustment may use a provisional ranking to help officials and announcers. The ranking must be completed with the in-pen work outside the application when required.",
    ],
  },
  {
    title: "3. Published score sheets",
    paragraphs: [
      "Published score sheets are provided for consultation. They may contain maneuver scores, penalties, notes, and special mentions entered in the application.",
      "An association may correct, republish, or remove results when necessary.",
    ],
  },
  {
    title: "4. Protests and errors",
    paragraphs: [
      "Any question about a score, penalty, disqualification, order of go, or ranking must be addressed to the association or show secretariat.",
      "ShowScore does not decide sporting disputes and does not replace association procedures.",
    ],
  },
  {
    title: "5. Estimates and flow information",
    paragraphs: [
      "Time estimates, class statuses, breaks, drags, and next participants are provided for information only and may vary according to the actual flow of the competition.",
    ],
  },
];

const legalCopy = {
  fr: {
    lastUpdated: LAST_UPDATED,
    lastUpdatedLabel: "Dernière mise à jour",
    policyNotice,
    terms: {
      title: "Conditions d'utilisation",
      intro:
        "Ces conditions encadrent l'utilisation de ShowScore par les administrateurs, secrétaires, scribes, annonceurs et autres utilisateurs autorisés.",
      sections: termsSections,
    },
    privacy: {
      title: "Politique de confidentialité",
      intro:
        "Cette politique résume les renseignements que ShowScore peut traiter et la façon dont ils sont utilisés pour offrir le service.",
      sections: privacySections,
    },
    results: {
      title: "Avis sur les résultats",
      intro:
        "Cet avis explique le rôle de ShowScore dans l'affichage des scores, des scoresheets et des classements provisoires.",
      sections: resultsSections,
    },
  },
  en: {
    lastUpdated: LAST_UPDATED_EN,
    lastUpdatedLabel: "Last updated",
    policyNotice: policyNoticeEn,
    terms: {
      title: "Terms of use",
      intro:
        "These terms frame the use of ShowScore by administrators, secretaries, scribes, announcers, and other authorized users.",
      sections: termsSectionsEn,
    },
    privacy: {
      title: "Privacy policy",
      intro:
        "This policy summarizes the information ShowScore may process and how it is used to provide the service.",
      sections: privacySectionsEn,
    },
    results: {
      title: "Results notice",
      intro:
        "This notice explains ShowScore’s role in displaying scores, score sheets, and provisional rankings.",
      sections: resultsSectionsEn,
    },
  },
};

export function TermsPage() {
  const copy = useLegalCopy("terms");

  return (
    <LegalDocument
      title={copy.title}
      intro={copy.intro}
      sections={copy.sections}
      lastUpdated={copy.lastUpdated}
      lastUpdatedLabel={copy.lastUpdatedLabel}
      policyNotice={copy.policyNotice}
    />
  );
}

export function PrivacyPage() {
  const copy = useLegalCopy("privacy");

  return (
    <LegalDocument
      title={copy.title}
      intro={copy.intro}
      sections={copy.sections}
      lastUpdated={copy.lastUpdated}
      lastUpdatedLabel={copy.lastUpdatedLabel}
      policyNotice={copy.policyNotice}
    />
  );
}

export function ResultsNoticePage() {
  const copy = useLegalCopy("results");

  return (
    <LegalDocument
      title={copy.title}
      intro={copy.intro}
      sections={copy.sections}
      lastUpdated={copy.lastUpdated}
      lastUpdatedLabel={copy.lastUpdatedLabel}
      policyNotice={copy.policyNotice}
    />
  );
}

function useLegalCopy(documentKey) {
  const { language } = useTranslation();
  const selectedCopy = legalCopy[language] || legalCopy.fr;

  return {
    ...selectedCopy[documentKey],
    lastUpdated: selectedCopy.lastUpdated,
    lastUpdatedLabel: selectedCopy.lastUpdatedLabel,
    policyNotice: selectedCopy.policyNotice,
  };
}

function LegalDocument({
  title,
  intro,
  sections,
  lastUpdated,
  lastUpdatedLabel,
  policyNotice,
}) {
  const { t } = useTranslation();

  return (
    <div style={styles.app}>
      <div style={backRowStyle}>
        <Link to="/" style={secondaryLinkStyle}>
          {t("nav.home")}
        </Link>
        <Link to="/login" style={secondaryLinkStyle}>
          {t("nav.login")}
        </Link>
      </div>

      <article style={documentStyle}>
        <div style={eyebrowStyle}>ShowScore</div>
        <h1 style={titleStyle}>{title}</h1>
        <div style={updatedStyle}>
          {lastUpdatedLabel}: {lastUpdated}
        </div>
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
