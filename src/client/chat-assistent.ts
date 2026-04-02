interface FAQItem {
  vraag: string;
  antwoord: string;
}

interface FAQData {
  faq: FAQItem[];
}

interface AIResponse {
  reply?: string;
}

interface AIErrorResponse {
  error?: string;
}

class FAQLoader {
  private readonly faqUrl: string;
  private faqData: FAQItem[] | null = null;

  constructor(faqUrl: string) {
    this.faqUrl = faqUrl;
  }

  async load(): Promise<FAQItem[]> {
    if (this.faqData) return this.faqData;

    try {
      const response = await fetch(this.faqUrl);

      if (!response.ok) {
        throw new Error(`FAQ niet gevonden (${response.status})`);
      }

      const data: FAQData = await response.json();
      this.faqData = data.faq ?? [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("FAQ niet geladen, alleen AI wordt gebruikt:", message);
      this.faqData = [];
    }

    return this.faqData;
  }

  findAnswer(userInput: string): FAQItem | undefined {
    if (!this.faqData || this.faqData.length === 0) return undefined;

    const input = userInput.toLowerCase();

    return this.faqData.find((item) => {
      const vraag = item.vraag.toLowerCase();
      return vraag
        .split(" ")
        .some((word) => word.length > 2 && input.includes(word));
    });
  }
}

class AIClient {
  private readonly proxyUrl: string;

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
        body: JSON.stringify({ message }),
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
      return data.reply ?? "Sorry, ik kon geen antwoord vinden.";
    } catch (error) {
      if (error instanceof TypeError) {
        console.warn("Geen server bereikbaar, mock antwoord wordt gebruikt.");
        return `Je vroeg: "${message}" — de AI server draait nog niet. Start 'node server/server.js' voor echte antwoorden.`;
      }

      const message_ = error instanceof Error ? error.message : String(error);
      return `Sorry, ${message_}`;
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