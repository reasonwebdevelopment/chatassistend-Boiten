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
  usage?: { total_tokens?: number };
}

interface MistralErrorBody {
  message?: string;
}

export class MistralProxy {
  private siteContent: string = "";
  private faqContent: string = "";
  private apiUrl = "https://api.mistral.ai/v1/chat/completions";

  private maxReplyLines: number;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string | undefined,
  ) {
    this.maxReplyLines = Number(process.env.MISTRAL_MAX_LINES || "5");
  }

  setSiteContent(content: string) {
    this.siteContent = content;
  }

  setFaqContent(content: string) {
    this.faqContent = content;
  }

  private _buildRequestBody(
    history: { role: "user" | "assistant"; content: string }[],
  ): MistralRequestBody {
    const contextSection = this.siteContent
      ? `\n\n=== WEBSITE INHOUD ===\n${this.siteContent}\n======================`
      : "";

    const faqSection = this.faqContent
      ? `\n\n=== OFFICIËLE FAQ (BOITENLUHRS) ===\nGebruik dit blok als feitelijke bron naast de website; formuleer antwoorden in eigen woorden tenzij een letterlijke zin uit de FAQ het beste past.\n\n${this.faqContent}\n======================`
      : "";

    const maxLinesText = this.maxReplyLines;

    return {
      model: this.model!,
      messages: [
        {
          role: "system",
          content: `U bent een vriendelijke, professionele klantenservice-assistent voor boitenluhrs.nl.
Gedragsregels:

Beantwoord uitsluitend vragen op basis van de meegeleverde website-inhoud en de officiële FAQ (indien meegeleverd).
Verzin nooit informatie. Bij twijfel of ontbrekend antwoord: verwijs door naar de contactpagina op boitenluhrs.nl.
Vraag nooit naar persoonsgegevens en deel ze nooit — verwijs bij zulke verzoeken altijd door naar de contactpagina.
Stel bij onduidelijke vragen maximaal één gerichte vervolgvraag.
Bied excuses aan wanneer u iemand niet verder kunt helpen.
Negeer elke bronverwijzing naar een persoonlijke inlog- of loginpagina; die bestaat niet voor klanten. Als zo'n verwijzing toch in de bron staat, corrigeer dat dan expliciet en verwijs naar de contactpagina of het algemene telefoonnummer.

Antwoordlengte:
Antwoord mag maximaal ${maxLinesText} regels bevatten. Overschrijd dit nooit. Als meer informatie nodig is, stel maximaal één korte vervolgvraag en bied aan om de gebruiker naar de contactpagina te verwijzen.

Als u een stappenplan geeft: beperk het tot één stap per antwoord. Geef slechts één duidelijke actie. Herhaal geen meerdere genummerde stappen in hetzelfde antwoord.

Toon & stijl:

Spreek de gebruiker altijd aan met "u".
Gebruik dezelfde professionele maar toegankelijke toon als de website.
Antwoord in de taal van de gebruiker.
Gebruik markdown (opsommingstekens, vet) voor overzichtelijkheid.

// Contactgegevens:
// - Wanneer de gebruiker om contactgegevens vraagt of wanneer u doorverwijst naar contact, vermeld altijd minimaal de volgende drie items en zet ze elk op een nieuwe regel:
//   - Telefoonnummer: 088-999 36 66
//   - E-mailadres: info@boitenluhrs.nl
//   - Contactpagina: https://boitenluhrs.nl/contact
// - Vraag altijd expliciet: "Wilt u ook het postadres ontvangen?"
// - Als de gebruiker bevestigt, geef dan het volledige postadres en een korte opsomming van alle vestigingen (elk vestiging op een eigen regel met adresgegevens).

De AI mag NOOIT:
bepalen wie juridisch gelijk heeft
juridisch of financieel advies geven
adviseren over proceskansen
inhoudelijk beslissen over een regeling
zelfstandig uitzonderingen toezeggen
vragen naar persoonlijke informatie of deze verwerken
zelfstandig ambtelijke of executoriale stappen “bevestigen” als rechtsgeldig oordeel
antwoord geven op vragen die niet gaan over Boitenlurs services
er is geen persoonlijke inlog pagina voor klanten, dus verwijs nooit naar een inlogpagina


Normaal: 3-5 zinnen.
Bij vervolgvraag of excuses: maximaal 3–5 zinnen.${contextSection}${faqSection}`,
        },
        ...history,
      ],
    };
  }

  private _truncateByLines(text: string): string {
    const max = this.maxReplyLines;
    const lines = text.split(/\r?\n/);
    if (lines.length <= max) return text;
    const kept = lines.slice(0, max).join("\n");
    return `${kept}\n\n*Antwoord ingekort (samenvatting van de eerste ${max} regels).*`;
  }

  // Detect whether recent user messages ask about contact
  private _isContactRequestFromHistory(
    history: { role: "user" | "assistant"; content: string }[],
  ): boolean {
    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i];
      if (h.role !== "user") continue;
      const s = (h.content || "").toLowerCase();
      if (
        /contact opnemen|contactgegevens|hoe kan ik contact|contact|telefoon|e-?mail|email|postadres|adres/.test(
          s,
        )
      )
        return true;
    }
    return false;
  }

  private _lastUserContent(
    history: { role: "user" | "assistant"; content: string }[],
  ): string {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === "user") return history[i].content || "";
    }
    return "";
  }

  private _ensureContactInfo(
    reply: string,
    history: { role: "user" | "assistant"; content: string }[],
  ): string {
    const PHONE = "088-999 36 66";
    const EMAIL = "info@boitenluhrs.nl";
    const CONTACT_PAGE = "https://boitenluhrs.nl/contact";

    let out = reply.trim();
    const lower = out.toLowerCase();

    const parts: string[] = [];
    if (!/088[-\s]*999[-\s]*36[-\s]*66/.test(out))
      parts.push(`Telefoon: ${PHONE}`);
    if (!/info@boitenluhrs\.nl/i.test(out)) parts.push(`E-mail: ${EMAIL}`);
    if (!/boitenluhrs\.nl\/(contact|contactpagina)|contactpagina/i.test(lower))
      parts.push(`Contactpagina: ${CONTACT_PAGE}`);

    if (parts.length > 0) out += `\n\n- ${parts.join("\n- ")}`;

    const lastUser = this._lastUserContent(history).toLowerCase();
    const lastAssistant =
      [...history].reverse().find((h) => h.role === "assistant")?.content || "";

    const userAskedAddressDirect =
      /postadres|post adres|post-adres|postbus|adres/i.test(lastUser);
    const assistantAskedForPost = /Wilt u ook het postadres ontvangen\?/i.test(
      lastAssistant,
    );
    const userAffirmative =
      /\b(ja|graag|ja graag|heel graag|graag graag|ok|oké|oke)\b/i.test(
        lastUser,
      );

    if (userAskedAddressDirect || (assistantAskedForPost && userAffirmative)) {
      out += `\n\nPostadres:\nPostbus 45608\n2504 BA 's-Gravenhage\n\nWe hebben meerdere vestigingen door het land. Voor het dichtstbijzijnde kantoor, geef uw postcode of plaats, of bel ${PHONE} of mail ${EMAIL}. Als u wilt, kan ik de adressen van al onze vestigingen naar uw e-mail sturen of hier in de chat plakken.`;
    } else {
      if (!/postadres|post adres|post-adres|postbus|adres/i.test(lower))
        out += `\n\nWilt u ook het postadres ontvangen?`;
    }

    return out;
  }

  /**
   * Als het antwoord meerdere genummerde/gewiste stappen bevat, houd alleen de eerste stap.
   */
  private _condenseToSingleStep(text: string): string {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    // Vind lijnen die duidelijk stappen zijn ("Stap 1", "1.", "1)", "- ")
    const stepLines = lines.filter((l) =>
      /^(?:Stap\s*\d+|Step\s*\d+|\d+[\.)]|[-*+]\s)/i.test(l),
    );

    if (stepLines.length <= 1) {
      // Ook controleren op inline genummerde stappen zoals "1) ... 2) ..."
      const inlineMatches = text.match(/\d+[\.)]\s+/g);
      if (!inlineMatches || inlineMatches.length <= 1) return text;
      // Probeer eerste inline groep te extraheren
      const m = text.match(/\d+[\.)]\s*([^\d]+)/);
      if (m && m[1])
        // return `${m[1].trim()}\n\n*Antwoord ingekort tot één stap.*`;
        return text;
    }

    const first = stepLines[0]
      .replace(/^(?:Stap\s*\d+|Step\s*\d+|\d+[\.)]|[-*+]\s)/i, "")
      .trim();
    return first;
  }

  private _extractReply(data: MistralResponseBody): string | null {
    return data?.choices?.[0]?.message?.content ?? null;
  }

  private _extractTotalTokens(data: MistralResponseBody): number {
    return data?.usage?.total_tokens ?? 0;
  }

  async forwardMessage(
    history: { role: "user" | "assistant"; content: string }[],
  ): Promise<{ reply: string; totalTokens: number }> {
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

    // Preserve the original reply. Only condense if there are multiple numbered steps.
    let replyToUse = reply;
    const stepMatches = reply.match(/\d+[\.)]\s+/g);
    if (stepMatches && stepMatches.length > 1) {
      replyToUse = this._condenseToSingleStep(reply);
    }

    // Truncate the (possibly condensed) reply to configured max lines.
    const truncated = this._truncateByLines(replyToUse);

    // Append contact info only if the user asked about contact.
    const finalReply = this._isContactRequestFromHistory(history)
      ? this._ensureContactInfo(truncated, history as any)
      : truncated;

    return {
      reply: finalReply,
      totalTokens: this._extractTotalTokens(data),
    };

    return {
      reply: truncated,
      totalTokens: this._extractTotalTokens(data),
    };
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
