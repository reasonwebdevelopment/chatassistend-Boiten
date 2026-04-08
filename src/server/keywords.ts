type Keyword = {
  word: string;
  weight: number;
};

const POSITIVE_KEYWORDS: Keyword[] = [
  // Sterk — directe match met BoitenLuhrs domein
  { word: "boitenluhrs", weight: 10 },
  { word: "boiten", weight: 8 },
  { word: "incasso", weight: 5 },
  { word: "deurwaarder", weight: 5 },
  { word: "beslag", weight: 5 },
  { word: "uitzetting", weight: 5 },
  { word: "openstaande vordering", weight: 5 },
  { word: "automatische incasso", weight: 5 },

  // Medium — financiële context
  { word: "schuld", weight: 3 },
  { word: "factuur", weight: 3 },
  { word: "betaling", weight: 3 },
  { word: "betalen", weight: 3 },
  { word: "betaald", weight: 3 },
  { word: "afrekening", weight: 3 },
  { word: "vordering", weight: 3 },
  { word: "achterstand", weight: 3 },
  { word: "betalingsregeling", weight: 3 },
  { word: "aflossing", weight: 3 },
  { word: "lening", weight: 3 },
  { word: "debiteur", weight: 3 },

  // Zwak — generieke vragen die prima zijn voor dit bedrijf
  { word: "contact", weight: 1 },
  { word: "email", weight: 1 },
  { word: "e-mail", weight: 1 },
  { word: "mail", weight: 1 },
  { word: "telefoon", weight: 1 },
  { word: "telefoonnummer", weight: 1 },
  { word: "bellen", weight: 1 },
  { word: "adres", weight: 1 },
  { word: "openingstijd", weight: 1 },
  { word: "bereikbaar", weight: 1 },
  { word: "kantoor", weight: 1 },
  { word: "vestiging", weight: 1 },
  { word: "dossier", weight: 1 },
  { word: "kenmerk", weight: 1 },
  { word: "opdrachtgever", weight: 1 },
  { word: "regeling", weight: 1 },
  { word: "herinnering", weight: 1 },
  { word: "brief", weight: 1 },
  { word: "vve", weight: 2 },
  { word: "stookkosten", weight: 2 },
  { word: "bijdrage", weight: 2 },
  { word: "inloggegevens", weight: 2 },
];

// Alleen keywords die écht niks met BoitenLuhrs te maken hebben
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
  "kleding",
  "pizza",
  "burger",
  "bier",
  "wijn",
  "muziek",
  "horloge",
  "schoenen",
  "boodschappen",
  "kapsalon",
  "kapper",
  "recept",
  "koken",
  "bakken",
];

// Bereken scores los, zodat je ze apart kunt wegen
function getScores(message: string): { positive: number; negative: number } {
  const lower = message.toLowerCase();
  let positive = 0;
  let negative = 0;

  for (const keyword of POSITIVE_KEYWORDS) {
    if (lower.includes(keyword.word)) {
      positive += keyword.weight;
    }
  }

  for (const word of NEGATIVE_KEYWORDS) {
    if (lower.includes(word)) {
      negative += 1;
    }
  }

  // Combinatie-bonussen
  if (lower.includes("betaling") && lower.includes("regeling")) positive += 2;
  if (lower.includes("schuld") && lower.includes("afloss")) positive += 2;
  if (lower.includes("factuur") && lower.includes("betalen")) positive += 2;
  if (lower.includes("deurwaarder") && lower.includes("beslag")) positive += 2;
  if (lower.includes("openstaande") && lower.includes("vordering"))
    positive += 3;

  return { positive, negative };
}

export function getRelevanceScore(message: string): number {
  const { positive, negative } = getScores(message);
  return positive - negative;
}

export function isRelevant(message: string): boolean {
  const trimmed = message.trim();

  // Lege berichten of pure begroetingen altijd doorlaten
  // (de LLM zelf handelt dit prima af)
  if (trimmed.length < 20) return true;

  const { positive, negative } = getScores(trimmed);

  // Expliciet positief signaal → altijd relevant
  if (positive >= 3) return true;

  // Alleen off-topic als er negatieve signalen zijn ZONDER positieve context
  if (negative > 0 && positive === 0) return false;

  // Twijfelgeval: geef het voordeel van de twijfel
  return true;
}
