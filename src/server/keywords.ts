type Keyword = {
  word: string;
  weight: number;
};

//  Positieve keywords (gebaseerd op jouw lijst, maar slimmer verdeeld)
const KEYWORDS: Keyword[] = [
  //  Sterk
  { word: "boitenluhrs", weight: 4 },
  { word: "incasso", weight: 3 },
  { word: "schuld", weight: 3 },
  { word: "betaling", weight: 3 },
  { word: "betalen", weight: 3 },
  { word: "betaald", weight: 3 },
  { word: "factuur", weight: 3 },
  { word: "deurwaarder", weight: 3 },
  { word: "beslag", weight: 3 },
  { word: "automatische incasso", weight: 3 },
  { word: "uitzetting", weight: 3 },
  { word: "vve", weight: 3 },
  { word: "openstaande vordering", weight: 3 },

  //  Medium
  { word: "betalingsregeling", weight: 2 },
  { word: "regeling", weight: 2 },
  { word: "achterstand", weight: 2 },
  { word: "vordering", weight: 2 },
  { word: "aflossing", weight: 2 },
  { word: "lening", weight: 2 },
  { word: "debiteur", weight: 2 },
  { word: "herinnering", weight: 2 },
  { word: "openstaand", weight: 2 },
  { word: "kenmerk", weight: 2 },
  { word: "betaalbewijs", weight: 2 },
  { word: "opdrachtgever", weight: 2 },
  { word: "bewijs betaald", weight: 2 },
  { word: "inloggegevens", weight: 2 },
  { word: "beheerder", weight: 2 },
  { word: "bijdrage", weight: 2 },
  { word: "stookkosten", weight: 2 },
  { word: "afrekenen", weight: 3 },
  { word: "afrekening", weight: 3 },

  //  Zwak
  { word: "contact", weight: 1 },
  { word: "mail", weight: 1 },
  { word: "email", weight: 1 },
  { word: "e-mail", weight: 1 },
  { word: "telefoon", weight: 1 },
  { word: "telefoonnummer", weight: 1 },
  { word: "nummer", weight: 1 },
  { word: "bellen", weight: 1 },
  { word: "adres", weight: 1 },
  { word: "locatie", weight: 1 },
  { word: "vestiging", weight: 1 },
  { word: "kantoor", weight: 1 },
  { word: "openingstijd", weight: 1 },
  { word: "bereikbaar", weight: 1 },
  { word: "prijs", weight: 1 },
  { word: "dienst", weight: 1 },
  { word: "product", weight: 1 },
  { word: "brief", weight: 1 },
  { word: "dossier", weight: 1 },
  { word: "antwoord", weight: 1 },

  //  Speciaal
  { word: "oplichter", weight: 2 },
  { word: "legitiem", weight: 2 },
  { word: "niet betalen", weight: 2 },
  { word: "afrekeningen", weight: 2 },
];

//  Negatieve keywords (off-topic)
const NEGATIVE_KEYWORDS: string[] = [
  "supermarkt",
  "restaurant",
  "eten",
  "drinken",
  "weer",
  "weerbericht",
  "voetbal",
  "wedstrijd",
  "film",
  "netflix",
  "youtube",
  "spotify",
  "game",
  "gaming",
  "winkel",
  "kleding",
  "pizza",
  "burger",
  "bier",
  "wijn",
  "auto",
  "muziek",
  "horloge",
  "schoenen",
  "boeken",
  "pc",
  "laptop",
  "sport",
  "training",
];

//  Score berekenen
export function getRelevanceScore(message: string): number {
  const lower = message.toLowerCase();
  let score = 0;

  // positieve matches
  for (const keyword of KEYWORDS) {
    if (lower.includes(keyword.word)) {
      score += keyword.weight;
    }
  }

  // negatieve matches
  for (const word of NEGATIVE_KEYWORDS) {
    if (lower.includes(word)) {
      score -= 3;
    }
  }

  //Slimme combinaties
  if (lower.includes("betaling") && lower.includes("regeling")) {
    score += 2;
  }

  if (lower.includes("schuld") && lower.includes("aflossen")) {
    score += 2;
  }

  if (lower.includes("factuur") && lower.includes("betalen")) {
    score += 2;
  }

  if (lower.includes("automatische") && lower.includes("incasso")) {
    score += 3;
  }

  if (lower.includes("deurwaarder") && lower.includes("beslag")) {
    score += 2;
  }

  if (lower.includes("herinnering") && lower.includes("betaling")) {
    score += 2;
  }

  if (lower.includes("openstaande") && lower.includes("vordering")) {
    score += 3;
  }

  return score;
}

// Hoofdfunctie
export function isRelevant(message: string): boolean {
  const score = getRelevanceScore(message);

  // 🔥 tweak dit getal indien nodig
  return score >= 3;
}
