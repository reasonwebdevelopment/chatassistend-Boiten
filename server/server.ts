import express, { Router, Request, Response, Application } from "express";
import dotenv from "dotenv";

dotenv.config();

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

  constructor(apiKey: string | undefined, model: string | undefined) {
    this.apiKey = apiKey;
    this.model = model;
  }

  private _buildRequestBody(message: string): MistralRequestBody {
    return {
      model: this.model!,
      messages: [
        {
          role: "system",
          content: `Je bent een vriendelijke klantenservice-assistent en betaalcoach voor boitenluhrs.nl.
Beantwoord ALLEEN vragen die direct relevant zijn voor boitenluhrs.nl: diensten, producten, prijzen, contactinformatie of betalingen.
Als de vraag niet relevant is, mag je GEEN extra uitleg geven en alleen dit antwoorden: "Sorry, ik kan daar niet bij helpen. Stel vragen over boitenluhrs.nl."
Antwoord kort en bondig, maximaal 2-3 zinnen.
Antwoord altijd in dezelfde taal als de vraag.`,
        },
        {
          role: "user",
          content: message,
        },
      ],
    };
  }

  private _extractReply(data: MistralResponseBody): string | null {
    return data?.choices?.[0]?.message?.content ?? null;
  }

  async forwardMessage(message: string): Promise<string> {
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

    if (!reply) {
      throw new Error("Geen antwoord ontvangen van Mistral.");
    }

    return reply;
  }
}


const ALLOWED_KEYWORDS: readonly string[] = [
  "boitenluhrs",
  "dienst",
  "product",
  "prijs",
  "contact",
  "betaling",
  "factuur",
  "openingstijd",
  "adres",
];

function isRelevant(message: string): boolean {
  const lower = message.toLowerCase();
  return ALLOWED_KEYWORDS.some((keyword) => lower.includes(keyword));
}


class ChatRouter {
  private readonly aiProxy: MistralProxy;
  readonly router: Router;

  constructor(aiProxy: MistralProxy) {
    this.aiProxy = aiProxy;
    this.router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.router.post("/chat", async (req: Request, res: Response) => {
      const { message } = req.body as { message?: unknown };

      if (!message || typeof message !== "string") {
        res.status(400).json({ error: "Geen geldig bericht ontvangen." });
        return;
      }

      if (!isRelevant(message)) {
        res.json({
          reply:
            "Sorry, ik kan daar niet bij helpen. Stel vragen die relevant zijn voor boitenluhrs, zoals over diensten of betalingen.",
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
        const status = isConfigError ? 503 : 502;

        res.status(status).json({
          error: isConfigError
            ? message_
            : "Er ging iets mis bij de AI-service.",
        });
      }
    });
  }
}


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
    this.app.use(express.static("public"));

    const mistralProxy = new MistralProxy(
      process.env.MISTRAL_API_KEY,
      process.env.MISTRAL_MODEL ?? "ministral-8b-latest",
    );

    const chatRouter = new ChatRouter(mistralProxy);
    this.app.use("/api", chatRouter.router);
  }

  start(): void {
    this.app.listen(this.port, () => {
      console.log(`Server draait op http://localhost:${this.port}`);
    });
  }
}

const server = new Server(Number(process.env.PORT ?? 3000));
server.start();