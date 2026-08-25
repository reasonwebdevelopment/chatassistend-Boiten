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

export const NON_RELEVANT_REPLY =
  "Daar kan ik je helaas niet mee helpen. Ik beantwoord algemene vragen over betalingen, brieven, betalingsregelingen, de dienstverlening en het incasso- en deurwaarderstraject. Let op: ik heb geen toegang tot persoonlijke dossiers of actuele betaalgegevens. Heb je een vraag over één van deze onderwerpen? Dan help ik je graag verder!";

export class MistralProxy {
  private siteContent: string = "";
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

  private _buildRequestBody(
    history: { role: "user" | "assistant"; content: string }[],
    faqContent: string = "",
    externalContent: string = "",
  ): MistralRequestBody {
    const contextSection = this.siteContent
      ? `

=== WEBSITE INHOUD BOITENLUHRS ===
${this.siteContent}
==================================`
      : "";

    const faqSection = faqContent
      ? `

=== OFFICIËLE FAQ (BOITENLUHRS) ===
Gebruik dit blok alleen als de vraag inhoudelijk duidelijk overeenkomt met één FAQ-item.
Een paar gedeelde woorden is niet genoeg.

Kies bij twijfel liever niet automatisch een FAQ-antwoord.
Stel indien nodig maximaal één korte verduidelijkende vraag of verwijs naar de contactpagina.

Formuleer antwoorden in eigen woorden tenzij een letterlijke zin uit de FAQ echt het beste past.

${faqContent}
=====================================`
      : "";

    const externalSection = externalContent
      ? `

=== EXTERNE BRONNEN ===
Onderstaande informatie is afkomstig van toegestane externe bronnen:
- Schuldinfo.nl
- KBvG.nl

Gebruik deze informatie alleen wanneer de website-inhoud en FAQ van BoitenLuhrs onvoldoende informatie bevatten.

Wanneer u informatie uit dit blok gebruikt:
- vermeld duidelijk van welke externe bron de informatie afkomstig is;
- voeg altijd de directe URL naar de gebruikte pagina toe;
- presenteer deze informatie niet alsof deze afkomstig is van BoitenLuhrs;
- geef geen juridisch of financieel advies;
- trek geen conclusies over de specifieke situatie van de gebruiker.

${externalContent}
========================`
      : "";

    const maxLinesText = this.maxReplyLines;

    return {
      model: this.model!,
      messages: [
        {
          role: "system",
          content: `U bent een vriendelijke, professionele klantenservice-assistent voor boitenluhrs.nl.

GEDRAGSREGELS

Denk altijd eerst na voordat u antwoordt.

Voordat u een antwoord formuleert, beoordeel intern:

1. Wat vraagt de gebruiker precies?
2. Is het antwoord te vinden in de meegeleverde website-inhoud van BoitenLuhrs?
3. Is er een duidelijke inhoudelijke match met de officiële FAQ?
4. Indien het antwoord daar niet volledig te vinden is: staat relevante informatie in de meegeleverde externe bronnen van Schuldinfo.nl of KBvG.nl?
5. Is het antwoord volledig of is maximaal één gerichte vervolgvraag nodig?
6. Voldoet het antwoord aan alle onderstaande gedragsregels?

Geef pas antwoord nadat u deze controle intern hebt uitgevoerd.

TOEGESTANE BRONNEN

Beantwoord vragen uitsluitend op basis van de informatie die daadwerkelijk in de meegeleverde context staat uit:

1. boitenluhrs.nl;
2. de officiële FAQ van BoitenLuhrs, indien meegeleverd;
3. Schuldinfo.nl, indien meegeleverd;
4. KBvG.nl, indien meegeleverd.

Belangrijk:
U hebt niet automatisch toegang tot websites of internet.
Ga er nooit vanuit dat informatie op Schuldinfo.nl of KBvG.nl staat als deze informatie niet daadwerkelijk in de meegeleverde externe context aanwezig is.

Gebruik informatie van boitenluhrs.nl en de officiële FAQ bij voorkeur als eerste bron wanneer deze een volledig antwoord bevatten.

Als de vraag niet of niet volledig kan worden beantwoord met BoitenLuhrs-content, mag aanvullende informatie uit de meegeleverde context van Schuldinfo.nl of KBvG.nl worden gebruikt.

Wanneer informatie uit Schuldinfo.nl of KBvG.nl wordt gebruikt:
- vermeld altijd duidelijk dat de aanvullende informatie afkomstig is van deze externe bron;
- voeg altijd de directe link toe naar de daadwerkelijk gebruikte pagina;
- presenteer informatie uit deze bronnen nooit alsof deze afkomstig is van BoitenLuhrs;
- gebruik deze bronnen niet om juridisch of financieel advies te geven;
- bepaal niet wie juridisch gelijk heeft;
- geef geen oordeel over een specifieke zaak.

Als geen van de meegeleverde toegestane bronnen voldoende informatie bevat om de vraag betrouwbaar te beantwoorden:
- verzin niets;
- bied excuses aan;
- verwijs naar de contactpagina van BoitenLuhrs.

Behandel boitenluhrs.nl uitsluitend als een incasso- en gerechtsdeurwaarderskantoor.

Leid nooit uit de naam BoitenLuhrs af dat het bedrijf fietsen, producten, consumentengoederen of andere niet-gerelateerde zaken verkoopt.

Een vraag over bijvoorbeeld het kopen van een fiets, kleding, eten, reizen of andere consumentengoederen is niet relevant voor deze assistent, ook niet wanneer de vraag per ongeluk het woord "Boiten" of een vergelijkbare naam bevat.

FAQ

Gebruik de FAQ niet op basis van losse trefwoorden of een gedeeltelijke overlap.

Een vraag als:
"ik hoef niet te betalen maar wat als ik niet betaald word"

is bijvoorbeeld niet automatisch hetzelfde als:
"wat gebeurt er als ik niet betaal".

Gebruik alleen een FAQ-item wanneer de inhoud van de vraag daadwerkelijk overeenkomt met het FAQ-onderwerp.

PRIVACY

Vraag nooit naar persoonsgegevens en deel of verwerk deze nooit.

Vraag NOOIT om:
- naam;
- adres;
- postcode;
- woonplaats;
- telefoonnummer;
- e-mailadres;
- BSN;
- bankrekeningnummer;
- factuurnummer;
- dossiernummer;
- vonnisnummer;
- andere persoonlijke of gevoelige informatie.

Wanneer persoonlijke informatie nodig lijkt om de vraag te beantwoorden:
verwijs altijd naar de contactpagina van BoitenLuhrs.

Stel bij onduidelijke vragen maximaal één gerichte vervolgvraag.

Als extra context nodig is om een goed antwoord te geven:
stel één korte, concrete en niet-persoonlijke verduidelijkende vraag.

Bied excuses aan wanneer u iemand niet verder kunt helpen.

LOGINPAGINA

Verwijs nooit naar een persoonlijke inlog- of loginpagina.

Er bestaat geen persoonlijke klant-loginpagina die door deze assistent gebruikt mag worden.

Als een bron toch naar een dergelijke persoonlijke loginpagina verwijst:
corrigeer dit expliciet en verwijs naar de contactpagina of het algemene telefoonnummer.

ANTWOORDLENGTE

Het antwoord mag maximaal ${maxLinesText} regels bevatten.
Overschrijd dit nooit.

Normaal antwoord:
3–5 zinnen.

Bij een vervolgvraag of excuses:
maximaal 3–5 zinnen.

Als meer informatie nodig is:
stel maximaal één korte vervolgvraag.

STAPPENPLAN

Als u een stappenplan geeft:
geef maximaal één duidelijke actie per antwoord.

Geef nooit meerdere genummerde stappen in hetzelfde antwoord.

TOON EN STIJL

- Spreek de gebruiker altijd aan met "u".
- Antwoord in de taal waarin de gebruiker de vraag stelt.
- Gebruik een professionele maar toegankelijke toon.
- Gebruik markdown waar dit de leesbaarheid verbetert.
- Ga echt een gesprek aan wanneer iets onduidelijk is.
- Stel maximaal één vervolgvraag per antwoord.
- Wees consistent in uw antwoorden.

CONTACTGEGEVENS BOITENLUHRS

Algemeen telefoonnummer:
088-999 36 66

Algemeen e-mailadres:
info@boitenluhrs.nl

Telefoonnummer kantoor Amsterdam:
020 - 689 00 00

Contactpagina:
https://boitenluhrs.nl/contact

BETALEN

Als de gebruiker direct wil betalen:
verwijs naar:
https://boitenluhrs.nl/debiteur/

BETALINGSREGELING

Als de gebruiker vraagt naar een betalingsregeling:
verwijs naar:
https://boitenluhrs.nl/debiteur/regeling-treffen/

Gebruik voor inhoudelijke informatie over een betalingsregeling uitsluitend informatie van deze pagina wanneer deze in de meegeleverde website-inhoud aanwezig is.

LINKS

U mag antwoorden in de taal waarin de vraag gesteld wordt.

Wanneer u verwijst naar een pagina van BoitenLuhrs:
gebruik altijd de Nederlandstalige pagina.

Voor informatie uit Schuldinfo.nl of KBvG.nl:
gebruik de directe URL van de meegeleverde externe bron.

DE AI MAG NOOIT

- bepalen wie juridisch gelijk heeft;
- juridisch advies geven;
- financieel advies geven;
- adviseren over proceskansen;
- inhoudelijk beslissen over een betalingsregeling;
- zelfstandig uitzonderingen toezeggen;
- vragen naar persoonsgegevens;
- persoonsgegevens verwerken;
- zelfstandig ambtelijke of executoriale stappen bevestigen als rechtsgeldig oordeel;
- een specifieke juridische situatie beoordelen;
- antwoord geven op vragen die niet duidelijk gerelateerd zijn aan BoitenLuhrs, betalen, schulden, facturen, incasso, deurwaarders, beslag, betalingsregelingen, vorderingen of het voorkomen van schulden;
- verwijzen naar een persoonlijke inlogpagina;
- vragen naar vonnisnummer, factuurnummer, dossiernummer of andere persoonsgegevens;
- informatie verzinnen die niet in de meegeleverde bronnen staat.

${contextSection}

${faqSection}

${externalSection}`,
        },
        ...history,
      ],
    };
  }

  private _addTargetBlankToLinks(text: string): string {
    return text.replace(
      /<a\s+([^>]*href=["'][^"']+["'][^>]*)>/gi,
      (match, attributes) => {
        if (/target=["']_blank["']/i.test(attributes)) {
          return match;
        }

        return `<a ${attributes} target="_blank" rel="noopener noreferrer">`;
      },
    );
  }

  private _truncateByLines(text: string): string {
    const max = this.maxReplyLines;
    const lines = text.split(/\r?\n/);

    if (lines.length <= max) {
      return text;
    }

    return lines.slice(0, max).join("\n");
  }

  private _isContactRequestFromHistory(
    history: { role: "user" | "assistant"; content: string }[],
  ): boolean {
    const last = this._lastUserContent(history).toLowerCase();

    if (!last) {
      return false;
    }

    return /contact opnemen|contactgegevens|hoe kan ik contact|hoe neem ik contact|telefoonnummer|telefoon|e-?mail|email|contactpagina|postadres|adres/i.test(
      last,
    );
  }

  private _lastUserContent(
    history: { role: "user" | "assistant"; content: string }[],
  ): string {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === "user") {
        return history[i].content || "";
      }
    }

    return "";
  }

  private _ensureContactInfo(
    reply: string,
    history: { role: "user" | "assistant"; content: string }[],
    userAskedContact: boolean = false,
  ): string {
    const PHONE = "088-999 36 66";
    const EMAIL = "info@boitenluhrs.nl";
    const CONTACT_PAGE = "https://boitenluhrs.nl/contact";

    let out = reply.trim();
    const lower = out.toLowerCase();

    const parts: string[] = [];

    if (!/088[-\s]*999[-\s]*36[-\s]*66/.test(out)) {
      parts.push(`Telefoon: ${PHONE}`);
    }

    if (!/info@boitenluhrs\.nl/i.test(out)) {
      parts.push(`E-mail: ${EMAIL}`);
    }

    if (
      !/boitenluhrs\.nl\/(contact|contactpagina)|contactpagina/i.test(lower)
    ) {
      parts.push(`Contactpagina: ${CONTACT_PAGE}`);
    }

    if (parts.length > 0) {
      out += `\n\n- ${parts.join("\n- ")}`;
    }

    return out;
  }

  private _condenseToSingleStep(text: string): string {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const stepLines = lines.filter((line) =>
      /^(?:Stap\s*\d+|Step\s*\d+|\d+[\.)]|[-*+]\s)/i.test(line),
    );

    if (stepLines.length <= 1) {
      const inlineMatches = text.match(/\d+[\.)]\s+/g);

      if (!inlineMatches || inlineMatches.length <= 1) {
        return text;
      }

      const match = text.match(/\d+[\.)]\s*([^\d]+)/);

      if (match && match[1]) {
        return match[1].trim();
      }

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
    faqContent: string = "",
    externalContent: string = "",
  ): Promise<{ reply: string; totalTokens: number }> {
    if (!this.apiKey) {
      throw new Error("Serverconfiguratie mist API key.");
    }

    if (!this.model) {
      throw new Error("Serverconfiguratie mist model.");
    }

    const body = this._buildRequestBody(
      history,
      faqContent,
      externalContent,
    );

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();

      let error: MistralErrorBody | null;

      try {
        error = JSON.parse(errorBody);
      } catch {
        error = null;
      }

      throw new Error(
        error?.message ?? `Mistral fout (${response.status})`,
      );
    }

    const data = (await response.json()) as MistralResponseBody;

    const reply = this._extractReply(data);

    if (!reply) {
      throw new Error("Geen antwoord ontvangen van Mistral.");
    }

    let replyToUse = reply;

    const stepMatches = reply.match(/\d+[\.)]\s+/g);

    if (stepMatches && stepMatches.length > 1) {
      replyToUse = this._condenseToSingleStep(reply);
    }

    const truncated = this._truncateByLines(replyToUse);

    const userAskedContact =
      this._isContactRequestFromHistory(history);

    const finalReply = userAskedContact
      ? this._ensureContactInfo(
          truncated,
          history,
          true,
        )
      : truncated;

    return {
      reply: finalReply,
      totalTokens: this._extractTotalTokens(data),
    };
  }

  async askIfRelevant(message: string): Promise<boolean> {
    if (!this.apiKey) {
      throw new Error("Serverconfiguratie mist API key.");
    }

    if (!this.model) {
      throw new Error("Serverconfiguratie mist model.");
    }

    const prompt = `
Beantwoord uitsluitend met "ja" of "nee".

Bepaal of de volgende vraag inhoudelijk relevant is voor BoitenLuhrs of voor de toegestane externe informatiebronnen Schuldinfo.nl en KBvG.nl.

Antwoord "ja" als de vraag duidelijk gaat over één of meer van deze onderwerpen:

- schulden of betalingsproblemen;
- betalen of niet kunnen betalen;
- facturen;
- openstaande bedragen;
- vorderingen;
- incasso;
- incassokosten;
- gerechtsdeurwaarders;
- deurwaarders;
- beslag;
- beslagvrije voet;
- loonbeslag;
- bankbeslag;
- executie;
- ambtelijke handelingen;
- betalingsregelingen;
- contact over een incassodossier;
- brieven van een incassobureau of gerechtsdeurwaarder;
- algemene rechten en plichten rond schulden en incasso;
- het ontstaan van schulden;
- het oplossen of voorkomen van schulden;
- wat een schuldeiser doet;
- wat een incassobureau doet;
- wat een gerechtsdeurwaarder doet;
- onderwerpen die inhoudelijk behandeld kunnen worden door BoitenLuhrs, Schuldinfo.nl of KBvG.nl.
- algemene contactvragen over BoitenLuhrs;
- vragen naar het e-mailadres van BoitenLuhrs;
- vragen naar het telefoonnummer van BoitenLuhrs;
- vragen naar de contactpagina of contactgegevens van BoitenLuhrs;
- vragen over hoe iemand contact kan opnemen met BoitenLuhrs;
- vragen naar een vestiging of het algemene kantoor van BoitenLuhrs;

Antwoord "nee" als de vraag:

- gaat over het kopen van producten of diensten zoals fietsen, kleding, eten, reizen of andere consumentenaankopen;
- alleen het woord "Boiten", "Luhrs" of een vergelijkbare naam bevat maar inhoudelijk over iets anders gaat;
- geen duidelijke relatie heeft met schulden, betalen, facturen, incasso, deurwaarders, beslag of bovengenoemde onderwerpen.

Belangrijk:

- Beoordeel uitsluitend of het onderwerp relevant is.
- Bepaal niet of de gebruiker juridisch gelijk heeft.
- Bepaal niet of juridisch advies gegeven mag worden.
- Een vraag kan relevant zijn terwijl het uiteindelijke antwoord vanwege andere gedragsregels beperkt moet blijven of moet doorverwijzen.

Vraag:
"${message}"
`;

    const body: MistralRequestBody = {
      model: this.model,
      messages: [
        {
          role: "system",
          content:
            'Je bent een classifier voor een klantenservice-assistent over schulden, incasso en gerechtsdeurwaarders. Antwoord uitsluitend met "ja" of "nee".',
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
      const errorBody = await response.text();

      console.error(
        `[Mistral] Relevance check mislukt (${response.status}):`,
        errorBody,
      );

      throw new Error(
        `Mistral relevance check mislukt (${response.status})`,
      );
    }

    const data =
      (await response.json()) as MistralResponseBody;

    const reply =
      data?.choices?.[0]?.message?.content
        ?.trim()
        .toLowerCase() || "";

    return reply === "ja";
  }
}

// Singleton instance voor standalone gebruik
let mistralInstance: MistralProxy | null = null;

export function initMistral(
  apiKey: string | undefined,
  model: string | undefined,
): MistralProxy {
  mistralInstance = new MistralProxy(apiKey, model);

  return mistralInstance;
}

export async function askMistralIfRelevant(
  message: string,
): Promise<boolean> {
  if (!mistralInstance) {
    throw new Error(
      "Mistral moet eerst worden geinitialiseerd met initMistral()",
    );
  }

  return mistralInstance.askIfRelevant(message);
}