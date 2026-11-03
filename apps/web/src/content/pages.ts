/**
 * Long-form trust pages. Kept out of the message catalogues because they are
 * documents, not interface strings; src/content/pages.test.ts checks that both
 * languages have the same pages and section structure.
 */
export interface Section {
  heading: string;
  body: string[];
}
export interface PageContent {
  title: string;
  updated: string;
  draft?: boolean;
  intro: string;
  sections: Section[];
}
export type PageId = "accessibility" | "ai" | "contact" | "privacy" | "terms";

const UPDATED = "2026-11-03";

export const PAGES: Record<"en-CA" | "fr-CA", Record<PageId, PageContent>> = {
  "en-CA": {
    accessibility: {
      title: "Accessibility statement",
      updated: UPDATED,
      intro:
        "PathAble is built for people who need accurate information about sidewalks, so the product itself has to work with the tools they use. This statement says what we have tested and what we have not. We do not claim conformance with WCAG 2.2 because no independent audit has taken place.",
      sections: [
        {
          heading: "What we test on every change",
          body: [
            "Automated checks with axe-core on every page in English and French, in light, dark and high-contrast themes, with menus, dialogs and route details open.",
            "Keyboard-only flows for the skip link, route selection, the destination search, the command menu, onboarding and the route panel.",
            "Colour contrast for every pair of colours we use, measured from our design tokens; text meets 4.5:1 and controls 3:1, and the high-contrast themes meet 7:1.",
            "No horizontal scrolling at 390 pixels wide, at 150% text size.",
          ],
        },
        {
          heading: "What has not been tested yet",
          body: [
            "Testing with people who use screen readers, switch access, magnification or voice control. The scripts we will use are published in our repository, and testing with five participants is planned but has not happened.",
            "A formal audit by an independent accessibility specialist.",
          ],
        },
        {
          heading: "Known limitations",
          body: [
            "The interactive map is a visual aid. Everything it shows is also available as text: route cards, directions, sections and hazards.",
            "Arabic and Urdu right-to-left layouts are built but not yet enabled, because the translations have not been reviewed.",
          ],
        },
        {
          heading: "Tell us about a barrier in PathAble itself",
          body: ["Use the contact page. We aim to reply within five business days and will tell you what we changed."],
        },
      ],
    },
    ai: {
      title: "How we use AI",
      updated: UPDATED,
      intro: "Short version: automatic photo analysis is turned off. No route, rating or statistic on this site comes from an AI model.",
      sections: [
        {
          heading: "What is planned",
          body: [
            "A model that suggests what a report photo shows, such as a missing curb ramp or snow blocking a ramp. A person would always review the suggestion before a report is sent, and the suggestion would be shown as a suggestion.",
          ],
        },
        {
          heading: "When it would be turned on",
          body: [
            "Only after it passes an evaluation we publish in advance: accuracy measured separately for each kind of barrier, each season and each neighbourhood, on photos the model never saw during training.",
            "Only with training photos we have a licence to use. We do not train on images collected without permission.",
          ],
        },
        {
          heading: "What you see today",
          body: ["The report flow shows that automatic analysis is unavailable, and every report is reviewed by a person."],
        },
      ],
    },
    contact: {
      title: "Contact",
      updated: UPDATED,
      intro: "PathAble is a pilot. We do not have a phone line or support team, and we will not pretend to.",
      sections: [
        {
          heading: "Problems with PathAble",
          body: ["Open an issue in the public repository linked below. Please do not include personal details."],
        },
        {
          heading: "A broken sidewalk, curb ramp or signal",
          body: [
            "Report it to the City of Toronto through 311, which is responsible for repairs. You can also report it in PathAble so other people know about it, but a PathAble report does not reach the City.",
          ],
        },
      ],
    },
    privacy: {
      title: "Privacy",
      updated: UPDATED,
      draft: true,
      intro: "This is the structure of a privacy policy, written plainly so it can be reviewed. It is not yet in effect.",
      sections: [
        {
          heading: "What stays on your device",
          body: [
            "Your preferences, personal notes and saved reports are stored in your browser. Your current trip is kept only for the open tab and is cleared when you close it. We cannot see any of it.",
          ],
        },
        {
          heading: "What is sent",
          body: [
            "To find routes: the start, destination and your preference values, never your profile or notes. Requests are not stored with any identifier.",
            "When you send a report: its type, location, date, description and photo. Location data is removed from the photo on your device, and again on the server, before faces and licence plates are blurred.",
          ],
        },
        { heading: "What still needs legal review", body: ["Retention periods, the lawful basis for processing, and how to request deletion of a sent report."] },
      ],
    },
    terms: {
      title: "Terms",
      updated: UPDATED,
      draft: true,
      intro: "This is the structure of the terms of use. It is not yet in effect.",
      sections: [
        {
          heading: "No guarantee about any sidewalk",
          body: [
            "PathAble shows what open data and reports say, with their sources and dates. Conditions change, data can be wrong, and \"no data\" means nobody knows. Always use your own judgement on the street.",
          ],
        },
        { heading: "Data licences", body: ["Map data is from OpenStreetMap contributors under the Open Database Licence, and from the City of Toronto and the Government of Canada under their open government licences."] },
      ],
    },
  },
  "fr-CA": {
    accessibility: {
      title: "Déclaration d’accessibilité",
      updated: UPDATED,
      intro:
        "PathAble s’adresse à des personnes qui ont besoin de renseignements fiables sur les trottoirs; le produit lui-même doit donc fonctionner avec leurs outils. Cette déclaration précise ce que nous avons testé et ce qui ne l’a pas été. Nous ne déclarons pas la conformité aux WCAG 2.2, car aucun audit indépendant n’a eu lieu.",
      sections: [
        {
          heading: "Ce que nous testons à chaque modification",
          body: [
            "Des vérifications automatisées avec axe-core sur chaque page, en anglais et en français, en thèmes clair, sombre et à contraste élevé, avec les menus, boîtes de dialogue et détails d’itinéraire ouverts.",
            "Des parcours au clavier seulement : lien d’évitement, choix de l’itinéraire, recherche de destination, menu de commandes, configuration et panneau des itinéraires.",
            "Le contraste de chaque paire de couleurs utilisée, mesuré à partir de nos jetons de conception : 4,5:1 pour le texte, 3:1 pour les commandes et 7:1 dans les thèmes à contraste élevé.",
            "Aucun défilement horizontal à 390 pixels de largeur, avec un texte agrandi à 150 %.",
          ],
        },
        {
          heading: "Ce qui n’a pas encore été testé",
          body: [
            "Des tests avec des personnes qui utilisent un lecteur d’écran, un contacteur, un agrandisseur ou la commande vocale. Les scénarios sont publiés dans notre dépôt; des tests avec cinq personnes sont prévus, mais n’ont pas encore eu lieu.",
            "Un audit officiel par une ou un spécialiste indépendant de l’accessibilité.",
          ],
        },
        {
          heading: "Limites connues",
          body: [
            "La carte interactive est une aide visuelle. Tout ce qu’elle montre est aussi offert sous forme de texte : fiches d’itinéraire, indications, tronçons et dangers.",
            "Les mises en page de droite à gauche pour l’arabe et l’ourdou sont prêtes, mais pas encore activées, car les traductions n’ont pas été révisées.",
          ],
        },
        {
          heading: "Signalez un obstacle dans PathAble",
          body: ["Utilisez la page Nous joindre. Nous visons une réponse en cinq jours ouvrables et vous dirons ce que nous avons changé."],
        },
      ],
    },
    ai: {
      title: "Notre usage de l’IA",
      updated: UPDATED,
      intro: "En bref : l’analyse automatique des photos est désactivée. Aucun itinéraire, aucune cote ni aucune statistique de ce site ne provient d’un modèle d’IA.",
      sections: [
        {
          heading: "Ce qui est prévu",
          body: [
            "Un modèle qui suggère ce que montre la photo d’un signalement, par exemple un bateau de trottoir absent ou enseveli sous la neige. Une personne examinerait toujours la suggestion avant l’envoi, et celle-ci serait présentée comme une suggestion.",
          ],
        },
        {
          heading: "Quand il serait activé",
          body: [
            "Seulement après avoir réussi une évaluation publiée à l’avance : la précision mesurée séparément pour chaque type d’obstacle, chaque saison et chaque quartier, sur des photos que le modèle n’a jamais vues à l’entraînement.",
            "Seulement avec des photos d’entraînement dont nous détenons la licence. Nous n’entraînons aucun modèle sur des images recueillies sans permission.",
          ],
        },
        {
          heading: "Ce que vous voyez aujourd’hui",
          body: ["Le parcours de signalement indique que l’analyse automatique n’est pas offerte, et chaque signalement est examiné par une personne."],
        },
      ],
    },
    contact: {
      title: "Nous joindre",
      updated: UPDATED,
      intro: "PathAble est un projet pilote. Nous n’avons ni ligne téléphonique ni équipe de soutien, et nous ne prétendrons pas le contraire.",
      sections: [
        {
          heading: "Un problème avec PathAble",
          body: ["Ouvrez un billet dans le dépôt public dont le lien figure ci-dessous. N’y incluez aucun renseignement personnel."],
        },
        {
          heading: "Un trottoir, un bateau de trottoir ou un feu endommagé",
          body: [
            "Signalez-le à la Ville de Toronto au 311, qui est responsable des réparations. Vous pouvez aussi le signaler dans PathAble pour informer les autres, mais un signalement PathAble ne parvient pas à la Ville.",
          ],
        },
      ],
    },
    privacy: {
      title: "Confidentialité",
      updated: UPDATED,
      draft: true,
      intro: "Voici la structure d’une politique de confidentialité, rédigée simplement pour pouvoir être révisée. Elle n’est pas encore en vigueur.",
      sections: [
        {
          heading: "Ce qui reste sur votre appareil",
          body: [
            "Vos préférences, notes personnelles et signalements enregistrés sont stockés dans votre navigateur. Votre trajet en cours n’est conservé que dans l’onglet ouvert et s’efface à sa fermeture. Nous ne voyons rien de tout cela.",
          ],
        },
        {
          heading: "Ce qui est transmis",
          body: [
            "Pour trouver un itinéraire : le départ, la destination et les valeurs de vos préférences, jamais votre profil ni vos notes. Les demandes ne sont associées à aucun identifiant.",
            "Lorsque vous envoyez un signalement : son type, son emplacement, sa date, sa description et sa photo. Les données de localisation sont retirées de la photo sur votre appareil, puis de nouveau sur le serveur, avant que les visages et les plaques soient floutés.",
          ],
        },
        { heading: "Ce qui doit encore être révisé par un juriste", body: ["Les durées de conservation, le fondement juridique du traitement et la façon de demander la suppression d’un signalement envoyé."] },
      ],
    },
    terms: {
      title: "Conditions",
      updated: UPDATED,
      draft: true,
      intro: "Voici la structure des conditions d’utilisation. Elles ne sont pas encore en vigueur.",
      sections: [
        {
          heading: "Aucune garantie sur un trottoir",
          body: [
            "PathAble présente ce que disent les données ouvertes et les signalements, avec leurs sources et leurs dates. Les conditions changent, les données peuvent être erronées, et « aucune donnée » signifie que personne ne le sait. Fiez-vous toujours à votre jugement sur place.",
          ],
        },
        { heading: "Licences des données", body: ["Les données cartographiques proviennent des contributeurs d’OpenStreetMap sous la Licence ouverte de bases de données, ainsi que de la Ville de Toronto et du gouvernement du Canada sous leurs licences du gouvernement ouvert."] },
      ],
    },
  },
};
