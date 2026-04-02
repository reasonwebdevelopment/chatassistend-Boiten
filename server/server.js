import express from "express";
import dotenv from "dotenv";

dotenv.config();

// ------------------- Mistral Proxy -------------------
class MistralProxy {
  constructor(apiKey, model) {
    this.apiKey = apiKey;
    this.model = model;
    this.apiUrl = "https://api.mistral.ai/v1/chat/completions";
  }

  _buildRequestBody(message) {
    return {
      model: this.model,
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

  _extractReply(data) {
    return data?.choices?.[0]?.message?.content ?? null;
  }

  async forwardMessage(message) {
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
      let error;

      try {
        error = JSON.parse(errorBody);
      } catch {
        error = null;
      }

      throw new Error(
        error?.message ??
          `Mistral fout (${response.status}): ${errorBody || "onbekende fout"}`,
      );
    }

    const data = await response.json();
    const reply = this._extractReply(data);

    if (!reply) {
      throw new Error("Geen antwoord ontvangen van Mistral.");
    }

    return reply;
  }
}

// ------------------- Relevantie Check -------------------
const allowedKeywords = [
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

function isRelevant(message) {
  const lower = message.toLowerCase();
  return allowedKeywords.some((keyword) => lower.includes(keyword));
}

// ------------------- Chat Router -------------------
class ChatRouter {
  constructor(aiProxy) {
    this.aiProxy = aiProxy;
    this.router = express.Router();
    this._registerRoutes();
  }

  _registerRoutes() {
    this.router.post("/chat", async (req, res) => {
      const { message } = req.body;

      if (!message || typeof message !== "string") {
        return res
          .status(400)
          .json({ error: "Geen geldig bericht ontvangen." });
      }

      // Check op relevante keywords
      if (!isRelevant(message)) {
        return res.json({
          reply:
            "Sorry, ik kan daar niet bij helpen. Stel vragen die relevant zijn voor boitenluhrs, zoals over diensten of betalingen.",
        });
      }

      try {
        const reply = await this.aiProxy.forwardMessage(message);
        res.json({ reply });
      } catch (error) {
        console.error("Mistral API fout:", error.message);

        const isConfigError = error.message.includes(
          "Serverconfiguratie mist API key",
        );
        const status = isConfigError ? 503 : 502;

        res.status(status).json({
          error: isConfigError
            ? error.message
            : "Er ging iets mis bij de AI-service.",
        });
      }
    });
  }
}

// ------------------- Server -------------------
class Server {
  constructor(port) {
    this.port = port;
    this.app = express();
    this._configure();
  }

  _configure() {
    this.app.use(express.json());
    this.app.use(express.static("public"));

    const mistralProxy = new MistralProxy(
      process.env.MISTRAL_API_KEY,
      process.env.MISTRAL_MODEL ?? "ministral-8b-latest",
    );

    const chatRouter = new ChatRouter(mistralProxy);
    this.app.use("/api", chatRouter.router);
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`Server draait op http://localhost:${this.port}`);
    });
  }
}

const server = new Server(process.env.PORT ?? 3000);
server.start();
