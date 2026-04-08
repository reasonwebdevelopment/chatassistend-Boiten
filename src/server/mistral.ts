interface MistralMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface MistralRequestBody {
  model: string;
  messages: MistralMessage[];
}

interface MistralResponseBody {
  choices?: { message?: { content?: string } }[];
}

interface MistralErrorBody {
  message?: string;
}

export class MistralProxy {
  private siteContent: string = "";
  private apiUrl = "https://api.mistral.ai/v1/chat/completions";

  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string | undefined,
  ) {}

  setSiteContent(content: string) {
    this.siteContent = content;
  }

  private _buildRequestBody(
    history: { role: "user" | "assistant"; content: string }[],
  ): MistralRequestBody {
    const contextSection = this.siteContent
      ? `\n\n=== WEBSITE INHOUD ===\n${this.siteContent}\n======================`
      : "";

    return {
      model: this.model!,
      messages: [
        {
          role: "system",
          content: `Je bent een vriendelijke klantenservice-assistent voor boitenluhrs.nl.
Beantwoord ALLEEN vragen op basis van de meegestuurde website-inhoud hieronder.
Als het antwoord er niet in staat, zeg dan: "Ik weet dat niet zeker. Neem contact op via boitenluhrs.nl."
Verzin NOOIT informatie. Antwoord kort en bondig, maximaal 2-3 zinnen.
Antwoord altijd in dezelfde taal als de vraag.
Gebruik GEEN markdown, geen sterretjes, geen opsommingstekens. Antwoord in gewone tekst.
Spreek de gebruiker aan met "u" en gebruik dezelfde professionele maar toegankelijke toon als de website.${contextSection}`,
        },
        ...history,
      ],
    };
  }

  private _extractReply(data: MistralResponseBody): string | null {
    return data?.choices?.[0]?.message?.content ?? null;
  }

  async forwardMessage(
    history: { role: "user" | "assistant"; content: string }[],
  ): Promise<string> {
    if (!this.apiKey) throw new Error("Serverconfiguratie mist API key.");
    if (!this.model) throw new Error("Serverconfiguratie mist model.");

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(this._buildRequestBody(history)),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let error: MistralErrorBody | null;
      try {
        error = JSON.parse(errorBody);
      } catch {
        error = null;
      }
      throw new Error(error?.message ?? `Mistral fout (${response.status})`);
    }

    const data = (await response.json()) as MistralResponseBody;
    const reply = this._extractReply(data);
    if (!reply) throw new Error("Geen antwoord ontvangen van Mistral.");
    return reply;
  }

  async askIfRelevant(message: string): Promise<boolean> {
    if (!this.apiKey) throw new Error("Serverconfiguratie mist API key.");
    if (!this.model) throw new Error("Serverconfiguratie mist model.");

    const prompt = `
Beantwoord alleen met "ja" of "nee".

Is de volgende vraag gerelateerd aan een incassobureau zoals BoitenLuhrs?
Het gaat om onderwerpen zoals: schulden, betalingen, facturen, incasso, deurwaarders.

Vraag: "${message}"
`;

    const body: MistralRequestBody = {
      model: this.model,
      messages: [
        {
          role: "system",
          content: "Je bent een classifier. Antwoord alleen met ja of nee.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    };

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error("Mistral relevance check mislukt");
    }

    const data = (await response.json()) as MistralResponseBody;
    const reply = data?.choices?.[0]?.message?.content?.toLowerCase() || "";

    return reply.includes("ja");
  }
}

// Singleton instance for standalone usage
let mistralInstance: MistralProxy | null = null;

export function initMistral(
  apiKey: string | undefined,
  model: string | undefined,
): MistralProxy {
  mistralInstance = new MistralProxy(apiKey, model);
  return mistralInstance;
}

export async function askMistralIfRelevant(message: string): Promise<boolean> {
  if (!mistralInstance) {
    throw new Error(
      "Mistral moet eerst worden geinitialiseerd met initMistral()",
    );
  }
  return mistralInstance.askIfRelevant(message);
}
