class FAQLoader {
  constructor(faqUrl) {
    this.faqUrl = faqUrl;
    this.faqData = null;
  }

  async load() {
    if (this.faqData) return this.faqData;

    try {
      const response = await fetch(this.faqUrl);

      if (!response.ok) {
        throw new Error(`FAQ niet gevonden (${response.status})`);
      }

      const data = await response.json();
      this.faqData = data.faq ?? [];
    } catch (error) {
      console.warn(
        "FAQ niet geladen, alleen AI wordt gebruikt:",
        error.message,
      );
      this.faqData = [];
    }

    return this.faqData;
  }

  findAnswer(userInput) {
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
  constructor(proxyUrl) {
    this.proxyUrl = proxyUrl;
  }

  async getResponse(message) {
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
          const errorData = await response.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Geen bruikbare JSON-fout, gebruik standaardmelding.
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.reply || "Sorry, ik kon geen antwoord vinden.";
    } catch (error) {
      if (error instanceof TypeError) {
        console.warn("Geen server bereikbaar, mock antwoord wordt gebruikt.");
        return `Je vroeg: "${message}" — de AI server draait nog niet. Start 'node server/server.js' voor echte antwoorden.`;
      }

      return `Sorry, ${error.message}`;
    }
  }
}

class ChatAssistant {
  constructor(faqUrl) {
    this.faqLoader = new FAQLoader(faqUrl);
    this.aiClient = new AIClient("/api/chat");
  }

  _fakeDelay() {
    // Willekeurige vertraging tussen 800ms en 2000ms voor een natuurlijk gevoel
    const ms = Math.floor(Math.random() * 1200) + 800;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getResponse(userInput) {
    await this.faqLoader.load();

    const faqMatch = this.faqLoader.findAnswer(userInput);

    if (faqMatch) {
      await this._fakeDelay();
      return faqMatch.antwoord;
    }

    return await this.aiClient.getResponse(userInput);
  }
}

window.ChatAssistant = ChatAssistant;
