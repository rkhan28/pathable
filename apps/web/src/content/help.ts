export interface Faq {
  q: string;
  a: string;
}

/** Help centre entries; the pages test checks both languages have the same count. */
export const HELP: Record<"en-CA" | "fr-CA", Faq[]> = {
  "en-CA": [
    { q: "What does “no data” mean?", a: "Nobody has recorded that fact for that stretch, or the measurement is too close to your limit to tell. PathAble never treats no data as accessible." },
    { q: "Why does a route say “has known barriers” when it looks fine?", a: "A barrier is measured against your preferences. A 6% slope is a barrier if your limit is 5% and fine if it is 8.3%. Open the route’s sections to see the value, its source and when it was observed." },
    { q: "Where does the slope come from?", a: "From two lidar terrain surveys flown in 2015 and 2023. Slope only counts when both surveys agree, because disagreement usually means construction or a wall the survey picked up." },
    { q: "How accurate is the width?", a: "It is estimated from the City’s sidewalk outlines, which do not subtract poles, signs or benches, so the clear width can be narrower. Widths close to your limit are shown as no data." },
    { q: "Does PathAble know about curb ramps?", a: "Only where volunteers have mapped them in OpenStreetMap, which is about 7% of crossings in North York. Everywhere else, curb ramps are no data. Reports from people who were there will fill this in over time." },
    { q: "What is sent when I search for a route?", a: "The start, the destination and your preference values. Not your profile, not your notes, and nothing that identifies you." },
    { q: "Why can I only plan trips in North York?", a: "This is a pilot. We only show routes where we have measured the data, and we have measured North York." },
    { q: "Who fixes a broken sidewalk?", a: "The City of Toronto, through 311. A PathAble report tells other people about the problem but does not reach the City." },
  ],
  "fr-CA": [
    { q: "Que signifie « aucune donnée »?", a: "Personne n’a consigné ce renseignement pour ce tronçon, ou la mesure est trop proche de votre limite pour trancher. PathAble ne considère jamais l’absence de données comme accessible." },
    { q: "Pourquoi un itinéraire indique-t-il des obstacles connus alors qu’il semble correct?", a: "Un obstacle se mesure selon vos préférences. Une pente de 6 % est un obstacle si votre limite est de 5 %, mais pas si elle est de 8,3 %. Ouvrez les tronçons de l’itinéraire pour voir la valeur, sa source et sa date d’observation." },
    { q: "D’où vient la pente?", a: "De deux relevés lidar du terrain effectués en 2015 et en 2023. La pente n’est retenue que si les deux relevés concordent, car un écart signale généralement des travaux ou un mur capté par le relevé." },
    { q: "La largeur est-elle précise?", a: "Elle est estimée à partir des contours de trottoirs de la Ville, qui ne retranchent ni les poteaux, ni les panneaux, ni les bancs; la largeur libre peut donc être moindre. Les largeurs proches de votre limite sont présentées comme sans données." },
    { q: "PathAble connaît-il les bateaux de trottoir?", a: "Seulement là où des bénévoles les ont cartographiés dans OpenStreetMap, soit environ 7 % des traverses de North York. Ailleurs, il n’y a aucune donnée. Les signalements faits sur place combleront ce manque peu à peu." },
    { q: "Qu’est-ce qui est transmis quand je cherche un itinéraire?", a: "Le départ, la destination et les valeurs de vos préférences. Ni votre profil, ni vos notes, ni quoi que ce soit qui vous identifie." },
    { q: "Pourquoi seulement des trajets à North York?", a: "Il s’agit d’un projet pilote. Nous n’affichons d’itinéraires que là où nous avons mesuré les données, et nous avons mesuré North York." },
    { q: "Qui répare un trottoir endommagé?", a: "La Ville de Toronto, par le 311. Un signalement PathAble informe les autres, mais ne parvient pas à la Ville." },
  ],
};
