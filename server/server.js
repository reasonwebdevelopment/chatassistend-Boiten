import express from "express";
import dotenv from "dotenv";

dotenv.config();

class GeminiProxy {
  constructor(apiKey, model) {
    this.apiKey = apiKey;
    this.model = model;
    this.apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  }

  _buildRequestBody(message) {
    return {
      contents: [
        {
          role: "user",
          parts: [{ text: message }],
        },
      ],
    };
  }

  _extractReply(data) {
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  }

  async forwardMessage(message) {
    if (!this.apiKey) {
      throw new Error(
        "Serverconfiguratie mist API key. Zet GEMINI_API_KEY (of AI_API_KEY) in je .env.",
      );
    }

    if (!this.model) {
      throw new Error(
        "Serverconfiguratie mist model. Zet GEMINI_MODEL (of AI_MODEL) in je .env.",
      );
    }

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey, // ← Gemini gebruikt dit i.p.v. Bearer
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
        error?.error?.message ??
          `Gemini fout (${response.status}): ${errorBody || "onbekende fout"}`,
      );
    }

    const data = await response.json();
    const reply = this._extractReply(data);

    if (!reply) {
      throw new Error("Geen antwoord ontvangen van Gemini.");
    }

    return reply;
  }
}

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

      try {
        const reply = await this.aiProxy.forwardMessage(message);
        res.json({ reply });
      } catch (error) {
        console.error("Gemini API fout:", error.message);

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

class Server {
  constructor(port) {
    this.port = port;
    this.app = express();
    this._configure();
  }

  _configure() {
    this.app.use(express.json());
    this.app.use(express.static("public"));

    const geminiProxy = new GeminiProxy(
      process.env.GEMINI_API_KEY ?? process.env.AI_API_KEY,
      process.env.GEMINI_MODEL ?? process.env.AI_MODEL ?? "Gemini 3 Flash Live",
    );

    const chatRouter = new ChatRouter(geminiProxy);
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
