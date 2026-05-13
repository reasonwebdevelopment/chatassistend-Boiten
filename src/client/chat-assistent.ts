interface FAQItem {
  vraag: string;
  antwoord: string;
}

interface FAQData {
  faq: FAQItem[];
}

interface AIResponse {
  reply?: string;
  conversation_id?: number;
}

interface AIErrorResponse {
  error?: string;
}

/** Woorden die we niet meetellen bij FAQ-overlap (module-scope: één allocatie). */
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
]);
const FAQ_MIN_SCORE = 0.45;

class FAQLoader {
  private readonly faqUrl: string;
  private faqData: FAQItem[] | null = null;

  constructor(faqUrl: string) {
    this.faqUrl = faqUrl;
  }

  private _tokenize(text: unknown): string[] {
    const normalized = typeof text === "string" ? text : "";
    return (
      normalized
        .toLowerCase()
        .trim()
        .match(/[\p{L}\p{N}]+/gu)
        ?.filter(Boolean) ?? []
    );
  }

  async load(): Promise<FAQItem[]> {
    if (this.faqData) return this.faqData;

    try {
      const response = await fetch(this.faqUrl);

      if (!response.ok) {
        throw new Error(`FAQ niet gevonden (${response.status})`);
      }

      const data: FAQData = await response.json();
      const rawFaq = data.faq ?? [];
      // Defensive: tolerate malformed entries in `faq.json`.
      this.faqData = rawFaq.filter(
        (item): item is FAQItem =>
          typeof item?.vraag === "string" && typeof item?.antwoord === "string",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("FAQ niet geladen, alleen AI wordt gebruikt:", message);
      this.faqData = [];
    }

    return this.faqData;
  }

  findAnswer(userInput: string): FAQItem | undefined {
    if (!this.faqData || this.faqData.length === 0) return undefined;

    const inputTokens = this._tokenize(userInput);
    const inputText = inputTokens.join(" ");
    const inputTokenSet = new Set(inputTokens);

    // Bij lange (dossier)teksten is FAQ matching vaak een false positive.
    if (inputText.length > 140) return undefined;

    let bestMatch: FAQItem | undefined;
    let bestScore = 0;
    let bestOverlapCount = 0;

    for (const item of this.faqData) {
      const words = this._tokenize(item.vraag).filter(
        (w) => w.length > 2 && !FAQ_STOP_WORDS.has(w),
      );

      if (words.length === 0) continue;

      // Match op token-niveau (niet op substring) om "ben" in "bent" te voorkomen.
      const overlapCount = words.reduce(
        (n, word) => n + (inputTokenSet.has(word) ? 1 : 0),
        0,
      );
      const score = overlapCount / words.length;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
        bestOverlapCount = overlapCount;
      }
    }

    if (!bestMatch) return undefined;

    // Extra guard: minimaal 2 token-overlap (behalve bij één-token gebruikersinput).
    const isSingleTokenQuery = inputTokens.length === 1;
    const strongSingleTokenMatch = isSingleTokenQuery && bestOverlapCount >= 1;

    return bestScore >= FAQ_MIN_SCORE &&
      (bestOverlapCount >= 2 || strongSingleTokenMatch)
      ? bestMatch
      : undefined;
  }
}

class AIClient {
  private readonly proxyUrl: string;
  private conversationId: number | null = null; // Onthoudt het gesprek
  private readonly fallbackMessage =
    "Er is iets mis gegaan. Probeer het later opnieuw.";

  constructor(proxyUrl: string) {
    this.proxyUrl = proxyUrl;
  }

  async getResponse(message: string): Promise<string> {
    try {
      const response = await fetch(this.proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          conversation_id: this.conversationId, // Stuur mee als die er al is
        }),
      });

      if (!response.ok) {
        let errorMessage = `Server fout (${response.status})`;

        try {
          const errorData: AIErrorResponse = await response.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Geen bruikbare JSON-fout, gebruik standaardmelding.
        }

        throw new Error(errorMessage);
      }

      const data: AIResponse = await response.json();

      // Sla het conversation_id op voor de volgende berichten
      if (data.conversation_id) {
        this.conversationId = data.conversation_id;
      }

      return data.reply ?? "Sorry, ik kon geen antwoord vinden.";
    } catch (error) {
      console.warn("AI-antwoord kon niet worden opgehaald:", error);
      return this.fallbackMessage;
    }
  }
}

class ChatAssistant {
  private readonly faqLoader: FAQLoader;
  private readonly aiClient: AIClient;

  constructor(faqUrl: string) {
    this.faqLoader = new FAQLoader(faqUrl);
    this.aiClient = new AIClient("/api/chat");
  }

  private _fakeDelay(): Promise<void> {
    const ms = Math.floor(Math.random() * 1200) + 800;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getResponse(userInput: string): Promise<string> {
    await this.faqLoader.load();

    const faqMatch = this.faqLoader.findAnswer(userInput);

    if (faqMatch) {
      await this._fakeDelay();
      return faqMatch.antwoord;
    }

    return this.aiClient.getResponse(userInput);
  }
}

export { ChatAssistant };
