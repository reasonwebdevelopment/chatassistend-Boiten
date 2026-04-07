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
        const convId =
          typeof conversation_id === "number"
            ? conversation_id
            : await this.db.createConversation();
        await this.db.saveMessage(convId, "user", message);

        const history = await this.db.getHistory(convId);
        const reply = await this.aiProxy.forwardMessage(history);

        await this.db.saveMessage(convId, "assistant", reply);
        res.json({ reply, conversation_id: convId });
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
