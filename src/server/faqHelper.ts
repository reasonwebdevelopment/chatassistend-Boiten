import fs from "fs";
import path from "path";

interface FAQItem {
  vraag: string;
  antwoord: string;
}

interface FAQData {
  faq: FAQItem[];
}

let faqCache: FAQItem[] | null = null;

async function loadFAQ(): Promise<FAQItem[]> {
  if (faqCache) return faqCache;

  try {
    const faqPath = path.join(process.cwd(), "public", "faq.json");
    const data: FAQData = JSON.parse(fs.readFileSync(faqPath, "utf-8"));
    faqCache = data.faq ?? [];
    return faqCache;
  } catch (error) {
    console.error("Fout bij laden van FAQ:", error);
    return [];
  }
}

export async function findAnswerInDB(message: string): Promise<string | null> {
  const faqItems = await loadFAQ();
  const messageLower = message.toLowerCase();

  // Zoek naar match in FAQ-vragen
  for (const item of faqItems) {
    const vraagLower = item.vraag.toLowerCase();
    if (
      vraagLower.includes(messageLower) ||
      messageLower.includes(vraagLower)
    ) {
      return item.antwoord;
    }
  }

  return null;
}
