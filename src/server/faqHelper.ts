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
    const faqUrl =
      process.env.FAQ_URL ??
      "https://boitenchat-355e0694e40b.herokuapp.com/faq.json";
    const response = await fetch(faqUrl);

    if (!response.ok) {
      throw new Error(`FAQ URL gaf status ${response.status}`);
    }

    const data: FAQData = await response.json();
    faqCache = data.faq ?? [];
    return faqCache;
  } catch (error) {
    console.error("Fout bij laden van FAQ via URL:", error);
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
