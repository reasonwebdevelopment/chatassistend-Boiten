import { Router, Request, Response } from "express";
import { MistralProxy } from "./mistral.js";
import { Database } from "./db.js";
import { isRelevant } from "./keywords.js";

interface ChatRequestBody {
  message?: unknown;
  conversation_id?: unknown;
}

export class ChatRouter {
  readonly router = Router();

  constructor(
    private aiProxy: MistralProxy,
    private db: Database,
  ) {
    this._registerRoutes();
  }

  private _registerRoutes() {
    this.router.post("/chat", async (req: Request, res: Response) => {
      const { conversation_id } = req.body as ChatRequestBody;
      const userMessage = req.body.message;

      if (!userMessage || typeof userMessage !== "string") {
        res.status(400).json({ error: "Geen geldig bericht ontvangen." });
        return;
      }

      if (!isRelevant(userMessage)) {
        res.json({
          reply:
            "Sorry, ik kan daar niet bij helpen. Stel vragen die relevant zijn voor BoitenLuhrs, zoals over incasso, vorderingen of betalingen.",
        });
        return;
      }

      try {
        const convId =
          typeof conversation_id === "number"
            ? conversation_id
            : await this.db.createConversation();
        await this.db.saveMessage(convId, "user", userMessage);

        const history = await this.db.getHistory(convId);
        const aiResponse = await this.aiProxy.forwardMessage(history);

        await this.db.saveMessage(convId, "assistant", aiResponse);
        res.json({ reply: aiResponse, conversation_id: convId });
      } catch (error) {
        const message_ = error instanceof Error ? error.message : String(error);
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
