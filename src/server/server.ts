import express, { Router, Request, Response, Application } from "express";
import dotenv from "dotenv";

dotenv.config();

// ------------------- Scraper -------------------

class WebScraper {
  private readonly baseUrl: string;
  private content: string = ""; //gescrapte inhoud van de site

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private _stripHtml(html: string): string {
    // Verwijder scripts, styles en overige tags zodat alleen leesbare tekst overblijft.
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  private _extractLinks(html: string): string[] {
    // Verzamel alleen interne links zodat we niet buiten de domeinscope gaan.
    const matches = [...html.matchAll(/href="([^"]+)"/g)];
    return matches
      .map((m) => m[1])
      .filter((href) => href.startsWith("/") && !href.includes("#"))
      .map((href) => `${this.baseUrl.replace(/\/$/, "")}${href}`)
      .filter((url, i, arr) => arr.indexOf(url) === i)
      .filter(
        (url) =>
          url !== this.baseUrl && url !== this.baseUrl.replace(/\/$/, ""),
      ); // verwijder homepage duplicaat
  }

  private async _fetchPage(url: string): Promise<string> {
    // Haal een pagina op en normaliseer de inhoud naar platte tekst.
    try {
      const response = await fetch(url);
      if (!response.ok) return "";
      const html = await response.text();
      return this._stripHtml(html);
    } catch {
      return "";
    }
  }

  async load(): Promise<void> {
    try {
      // Gebruik de homepage als startpunt voor het vinden van relevante interne pagina's.
      const homeResponse = await fetch(this.baseUrl);
      if (!homeResponse.ok) throw new Error(`HTTP ${homeResponse.status}`);
      const homeHtml = await homeResponse.text();

      // Vind alle interne links en scrape die mee voor extra context.
      const links = this._extractLinks(homeHtml);
      console.log(`Gevonden pagina's: ${links.length}`);
      console.log("Te scrapen URL's:", [this.baseUrl, ...links]);

      // Combineer de inhoud van meerdere pagina's tot één compacte context.
      const pages = await Promise.all([
        this._fetchPage(this.baseUrl),
        ...links.map((url) => this._fetchPage(url)),
      ]);

      // Combineer en limiteer tot 12000 tekens
      this.content = pages.filter(Boolean).join("\n\n").slice(0, 12000);

      console.log(
        `Site geladen: ${this.content.length} tekens van ${links.length + 1} pagina's`,
      );
    } catch (error) {
      console.warn("Website kon niet gescraped worden:", error);
      this.content = "";
    }
  }

  getContent(): string {
    return this.content;
  }
}

// ------------------- Mistral Types -------------------

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

class MistralProxy {
  private readonly apiKey: string | undefined;
  private readonly model: string | undefined;
  private readonly apiUrl = "https://api.mistral.ai/v1/chat/completions";
  private siteContent: string = "";

  constructor(apiKey: string | undefined, model: string | undefined) {
    this.apiKey = apiKey;
    this.model = model;
  }

  setSiteContent(content: string): void {
    this.siteContent = content;
  }

  private _buildRequestBody(message: string): MistralRequestBody {
    // Voeg de gescrapte site-inhoud toe als context voor het model.
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
Spreek de gebruiker aan met "u" en gebruik dezelfde professionele maar toegankelijke toon als de website.
Als de website informele taal gebruikt, gebruik die dan ook. Kopieer geen zinnen letterlijk, maar pas de stijl wel aan.${contextSection}`,
        },
        {
          role: "user",
          content: message,
        },
      ],
    };
  }

  private _extractReply(data: MistralResponseBody): string | null {
    // Haal alleen de tekst van het eerste antwoord op.
    return data?.choices?.[0]?.message?.content ?? null;
  }

  async forwardMessage(message: string): Promise<string> {
    // Valideer eerst de configuratie voordat we een externe API-call doen.
    if (!this.apiKey) {
      throw new Error(
        "Serverconfiguratie mist API key. Zet MISTRAL_API_KEY in je .env.",
      );
    }
    if (!this.model) {
      throw new Error(
        "Serverconfiguratie mist model. Zet MISTRAL_MODEL in je .env.",
      );
    }

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(this._buildRequestBody(message)),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let error: MistralErrorBody | null;
      try {
        error = JSON.parse(errorBody) as MistralErrorBody;
      } catch {
        error = null;
      }
      throw new Error(
        error?.message ??
          `Mistral fout (${response.status}): ${errorBody || "onbekende fout"}`,
      );
    }

    const data = (await response.json()) as MistralResponseBody;
    const reply = this._extractReply(data);
    if (!reply) throw new Error("Geen antwoord ontvangen van Mistral.");
    return reply;
  }
}

// ------------------- Keyword filter -------------------

const ALLOWED_KEYWORDS: readonly string[] = [
  "boitenluhrs",
  "dienst",
  "product",
  "prijs",
  "contact",
  "betaling",
  "betalen",
  "betaald",
  "factuur",
  "openingstijd",
  "adres",
  "schuld",
  "lening",
  "aflossing",
  "achterstand",
  "incasso",
  "betalingsregeling",
  "budget",
  "vordering",
  "deurwaarder",
  "debiteur",
  "beslag",
  "herinnering",
  "openstaand",
  "kenmerk",
  "oplichter",
  "legitiem",
  "niet betalen",
  "telefoon",
  "telefoonnummer",
  "bellen",
  "nummer",
  "bereikbaar",
  "mail",
  "email",
  "e-mail",
  "locatie",
  "vestiging",
  "kantoor",
  "openingstijd",
];

function isRelevant(message: string): boolean {
  // Sta alleen vragen toe die waarschijnlijk over BoitenLuhrs gaan.
  const lower = message.toLowerCase();
  return ALLOWED_KEYWORDS.some((keyword) => lower.includes(keyword));
}

// ------------------- Router -------------------

class ChatRouter {
  private readonly aiProxy: MistralProxy;
  readonly router: Router;

  constructor(aiProxy: MistralProxy) {
    this.aiProxy = aiProxy;
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    // Eén chatendpoint dat input valideert, filtert en daarna doorstuurt naar de AI-service.
    this.router.post("/chat", async (req: Request, res: Response) => {
      const { message } = req.body as { message?: unknown };

      if (!message || typeof message !== "string") {
        res.status(400).json({ error: "Geen geldig bericht ontvangen." });
        return;
      }

      if (!isRelevant(message)) {
        res.json({
          reply:
            "Sorry, ik kan daar niet bij helpen. Stel vragen die relevant zijn voor BoitenLuhrs, zoals over incasso, vorderingen of betalingen.",
        });
        return;
      }

      try {
        const reply = await this.aiProxy.forwardMessage(message);
        res.json({ reply });
      } catch (error) {
        const message_ = error instanceof Error ? error.message : String(error);
        console.error("Mistral API fout:", message_);
        const isConfigError = message_.includes(
          "Serverconfiguratie mist API key",
        );
        res.status(isConfigError ? 503 : 502).json({
          error: isConfigError
            ? message_
            : "Er ging iets mis bij de AI-service.",
        });
      }
    });
  }
}

// ------------------- Server -------------------

class Server {
  private readonly port: number;
  private readonly app: Application;

  constructor(port: number) {
    this.port = port;
    this.app = express();
    this._configure();
  }

  private _configure(): void {
    // Basis Express-configuratie: JSON body parsing en statische clientbestanden.
    this.app.use(express.json());
    this.app.use(express.static("dist/client"));
  }

  private _registerChat(mistralProxy: MistralProxy): void {
    // Koppel de chatrouter onder /api zodat de client de backend kan aanroepen.
    const chatRouter = new ChatRouter(mistralProxy);
    this.app.use("/api", chatRouter.router);
  }

  async start(): Promise<void> {
    // Laad eerst de website-inhoud, initialiseer daarna de AI-proxy en start pas dan de server.
    const scraper = new WebScraper("https://boitenluhrs.nl/");
    await scraper.load();

    const mistralProxy = new MistralProxy(
      process.env.MISTRAL_API_KEY,
      process.env.MISTRAL_MODEL ?? "ministral-8b-latest",
    );
    mistralProxy.setSiteContent(scraper.getContent());

    this._registerChat(mistralProxy);

    this.app.listen(this.port, () => {
      console.log(`Server draait op http://localhost:${this.port}`);
    });
  }
}

const server = new Server(Number(process.env.PORT ?? 3000));
server.start();
