import express, { Router, Request, Response, Application } from "express";
import dotenv from "dotenv";
import mysql from "mysql2/promise.js";

dotenv.config();

// ------------------- Database -------------------

class Database {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST ?? "localhost",
      user: process.env.DB_USER ?? "root",
      password: process.env.DB_PASS ?? "",
      database: process.env.DB_NAME ?? "chatbot",
      waitForConnections: true,
    });
  }

  async init(): Promise<void> {
    // Maak tabellen aan als ze nog niet bestaan
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        conversation_id INT NOT NULL,
        role ENUM('user', 'assistant') NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      )
    `);
    console.log("Database klaar.");
  }

  async createConversation(): Promise<number> {
    const [result] = await this.pool.execute(
      "INSERT INTO conversations () VALUES ()",
    );
    return (result as mysql.ResultSetHeader).insertId;
  }

  async saveMessage(
    conversationId: number,
    role: "user" | "assistant",
    content: string,
  ): Promise<void> {
    await this.pool.execute(
      "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
      [conversationId, role, content],
    );
  }

  async getHistory(
    conversationId: number,
    limit = 20,
  ): Promise<{ role: "user" | "assistant"; content: string }[]> {
    const [rows] = await this.pool.execute(
      `SELECT role, content FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC
       LIMIT ?`,
      [conversationId, limit],
    );
    return rows as { role: "user" | "assistant"; content: string }[];
  }
}

// ------------------- Scraper -------------------

class WebScraper {
  private readonly baseUrl: string;
  private content: string = "";

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private _stripHtml(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  private _extractLinks(html: string): string[] {
    const matches = [...html.matchAll(/href="([^"]+)"/g)];
    return matches
      .map((m) => m[1])
      .filter((href) => href.startsWith("/") && !href.includes("#"))
      .map((href) => `${this.baseUrl.replace(/\/$/, "")}${href}`)
      .filter((url, i, arr) => arr.indexOf(url) === i)
      .filter(
        (url) =>
          url !== this.baseUrl && url !== this.baseUrl.replace(/\/$/, ""),
      );
  }

  private async _fetchPage(url: string): Promise<string> {
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
      const homeResponse = await fetch(this.baseUrl);
      if (!homeResponse.ok) throw new Error(`HTTP ${homeResponse.status}`);
      const homeHtml = await homeResponse.text();

      const links = this._extractLinks(homeHtml);
      console.log(`Gevonden pagina's: ${links.length}`);

      const pages = await Promise.all([
        this._fetchPage(this.baseUrl),
        ...links.map((url) => this._fetchPage(url)),
      ]);

      this.content = pages.filter(Boolean).join("\n\n").slice(0, 12000);
      console.log(`Site geladen: ${this.content.length} tekens`);
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
        // Stuur de volledige gespreksgeschiedenis mee als context
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
      body: JSON.stringify(this._buildRequestBody(history)),
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
];

function isRelevant(message: string): boolean {
  const lower = message.toLowerCase();
  return ALLOWED_KEYWORDS.some((keyword) => lower.includes(keyword));
}

// ------------------- Router -------------------

interface ChatRequestBody {
  message?: unknown;
  conversation_id?: unknown;
}

class ChatRouter {
  private readonly aiProxy: MistralProxy;
  private readonly db: Database;
  readonly router: Router;

  constructor(aiProxy: MistralProxy, db: Database) {
    this.aiProxy = aiProxy;
    this.db = db;
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.post("/chat", async (req: Request, res: Response) => {
      const { message, conversation_id } = req.body as ChatRequestBody;

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
        // Maak nieuw gesprek aan of gebruik bestaand
        let convId: number;
        if (conversation_id && typeof conversation_id === "number") {
          convId = conversation_id;
        } else {
          convId = await this.db.createConversation();
        }

        // Sla gebruikersbericht op
        await this.db.saveMessage(convId, "user", message);

        // Haal geschiedenis op en stuur naar Mistral
        const history = await this.db.getHistory(convId);
        const reply = await this.aiProxy.forwardMessage(history);

        // Sla antwoord op
        await this.db.saveMessage(convId, "assistant", reply);

        res.json({ reply, conversation_id: convId });
      } catch (error) {
        const message_ = error instanceof Error ? error.message : String(error);
        console.error("Fout:", message_);
        const isConfigError = message_.includes("Serverconfiguratie mist");
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
    this.app.use(express.json());
    this.app.use(express.static("dist/client"));
  }

  private _registerChat(mistralProxy: MistralProxy, db: Database): void {
    const chatRouter = new ChatRouter(mistralProxy, db);
    this.app.use("/api", chatRouter.router);
  }

  async start(): Promise<void> {
    // Database initialiseren
    const db = new Database();
    await db.init();

    // Website scrapen
    const scraper = new WebScraper("https://boitenluhrs.nl/");
    await scraper.load();

    // Mistral proxy instellen
    const mistralProxy = new MistralProxy(
      process.env.MISTRAL_API_KEY,
      process.env.MISTRAL_MODEL ?? "ministral-8b-latest",
    );
    mistralProxy.setSiteContent(scraper.getContent());

    this._registerChat(mistralProxy, db);

    this.app.listen(this.port, () => {
      console.log(`Server draait op http://localhost:${this.port}`);
    });
  }
}

const server = new Server(Number(process.env.PORT ?? 3000));
server.start();
