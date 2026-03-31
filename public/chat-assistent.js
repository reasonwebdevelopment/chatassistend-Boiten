class FAQLoader {
  constructor(faqUrl) {
    this.faqUrl = faqUrl;
    this.faqData = null;
  }

  async load() {
    if (this.faqData) return this.faqData;

    try {
      const response = await fetch(this.faqUrl);
      const data = await response.json();
      this.faqData = data.faq;
      return this.faqData;
    } catch (error) {
      console.error("Fout bij laden FAQ:", error);
      return [];
    }
  }

  findAnswer(userInput) {
    const input = userInput.toLowerCase();

    return this.faqData.find((item) => {
      const vraag = item.vraag.toLowerCase();
      return vraag.split(" ").some((word) => input.includes(word));
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

      const data = await response.json();
      return data.reply || "Sorry, ik kon geen antwoord vinden.";
    } catch (error) {
      console.error("AI API error:", error);
      return "Er ging iets mis bij het ophalen van een antwoord.";
    }
  }
}

class ChatAssistant {
  constructor(faqUrl) {
    this.faqLoader = new FAQLoader(faqUrl);
    this.aiClient = new AIClient("/api/chat"); // ← altijd naar eigen server
  }

  async getResponse(userInput) {
    await this.faqLoader.load();

    const faqMatch = this.faqLoader.findAnswer(userInput);

    if (faqMatch) {
      return faqMatch.antwoord;
    }

    return await this.aiClient.getResponse(userInput);
  }
}

window.ChatAssistant = ChatAssistant;
