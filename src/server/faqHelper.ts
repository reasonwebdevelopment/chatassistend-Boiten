import { readFile } from "fs/promises";
import path from "path";

interface FAQItem {
  vraag: string;
  antwoord: string;
}

interface FAQData {
  faq: FAQItem[];
}

let faqCache: FAQItem[] | undefined;

const LOGIN_RELATED_PATTERN =
  /\b(inlog(?:gen|gegevens|omgeving|pagina)?|login(?:omgeving|pagina)?|persoonlijke\s+pagina|persoonlijke\s+login|\/?login)\b/i;
const FAQ_STOP_WORDS = new Set([
  "de",
  "het",
  "een",
  "van",
  "is",
  "wat",
  "hoe",
  "kan",
  "ik",
  "en",
  "op",
  "in",
  "te",
  "als",
  "maar",
  "niet",
  "geen",
  "hoef",
  "hoeft",
  "moet",
  "moeten",
  "wordt",
  "worden",
]);

function filterFaqItems(raw: unknown[]): FAQItem[] {
  return raw.filter(
    (item): item is FAQItem =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as FAQItem).vraag === "string" &&
      typeof (item as FAQItem).antwoord === "string" &&
      !LOGIN_RELATED_PATTERN.test((item as FAQItem).vraag) &&
      !LOGIN_RELATED_PATTERN.test((item as FAQItem).antwoord),
  );
}

async function loadFAQFromLocalFile(): Promise<FAQItem[]> {
  const localPath = path.join(process.cwd(), "public", "faq.json");
  const raw = await readFile(localPath, "utf-8");
  const data = JSON.parse(raw) as FAQData;
  return filterFaqItems(data.faq ?? []);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ");
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !FAQ_STOP_WORDS.has(word));
}

async function loadFAQ(): Promise<FAQItem[]> {
  if (faqCache !== undefined) return faqCache;

  try {
    const faqUrl =
      process.env.FAQ_URL ??
      "https://boitenchat-355e0694e40b.herokuapp.com/faq.json";
    const response = await fetch(faqUrl);

    if (!response.ok) {
      throw new Error(`FAQ URL gaf status ${response.status}`);
    }

    const data: FAQData = await response.json();
    faqCache = filterFaqItems(data.faq ?? []);
    return faqCache;
  } catch (error) {
    console.error("Fout bij laden van FAQ via URL:", error);
    try {
      faqCache = await loadFAQFromLocalFile();
      if (faqCache.length > 0) {
        console.log("✓ FAQ geladen uit public/faq.json (fallback)");
      }
      return faqCache;
    } catch {
      faqCache = [];
      return faqCache;
    }
  }
}

/** Volledige FAQ als één tekstblok voor het AI-systeembericht (RAG-vrije context). */
export async function getFaqAsPromptContext(): Promise<string> {
  const items = await loadFAQ();
  if (items.length === 0) return "";

  return items
    .map(
      (item) =>
        `V: ${item.vraag.replace(/\s+/g, " ").trim()}\nA: ${item.antwoord.replace(/\s+/g, " ").trim()}`,
    )
    .join("\n\n");
}

export async function getRelevantFaqAsPromptContext(
  message: string,
  maxItems: number = 3,
): Promise<string> {
  const faqItems = await loadFAQ();
  const messageTokens = new Set(tokenize(message));

  if (messageTokens.size === 0) return "";

  const rankedItems = faqItems
    .map((item) => {
      const questionTokens = tokenize(item.vraag);
      if (questionTokens.length === 0) {
        return { item, score: 0, overlapCount: 0 };
      }

      const overlapCount = questionTokens.reduce(
        (count, token) => count + (messageTokens.has(token) ? 1 : 0),
        0,
      );
      const score = overlapCount / questionTokens.length;

      return { item, score, overlapCount };
    })
    .filter(({ score, overlapCount }) => score >= 0.4 && overlapCount >= 2)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.overlapCount !== left.overlapCount) {
        return right.overlapCount - left.overlapCount;
      }
      return left.item.vraag.length - right.item.vraag.length;
    })
    .slice(0, maxItems)
    .map(({ item }) => item);

  if (rankedItems.length === 0) return "";

  return rankedItems
    .map(
      (item) =>
        `V: ${item.vraag.replace(/\s+/g, " ").trim()}\nA: ${item.antwoord.replace(/\s+/g, " ").trim()}`,
    )
    .join("\n\n");
}

export async function findAnswerInDB(message: string): Promise<string | null> {
  const faqItems = await loadFAQ();
  const messageNorm = normalize(message);

  if (!messageNorm) return null;

  // Bij lange (dossier)teksten is "contains" matching onbetrouwbaar.
  const isLongMessage = messageNorm.length > 140;

  for (const item of faqItems) {
    const vraagNorm = normalize(item.vraag);
    if (!vraagNorm) continue;

    if (vraagNorm === messageNorm) {
      return item.antwoord;
    }

    if (!isLongMessage) {
      const minLen = Math.min(vraagNorm.length, messageNorm.length);
      const substantial = minLen >= 10;

      if (
        substantial &&
        (vraagNorm.includes(messageNorm) || messageNorm.includes(vraagNorm))
      ) {
        return item.antwoord;
      }
    }
  }

  return null;
}
