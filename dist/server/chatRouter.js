import { Router } from "express";
import { isRelevant } from "./keywords.js";
export class ChatRouter {
    aiProxy;
    db;
    router = Router();
    constructor(aiProxy, db) {
        this.aiProxy = aiProxy;
        this.db = db;
        this._registerRoutes();
    }
    _registerRoutes() {
        this.router.post("/chat", async (req, res) => {
            const { conversation_id } = req.body;
            const userMessage = req.body.message;
            if (!userMessage || typeof userMessage !== "string") {
                res.status(400).json({ error: "Geen geldig bericht ontvangen." });
                return;
            }
            if (!isRelevant(userMessage)) {
                res.json({
                    reply: "Sorry, ik kan daar niet bij helpen. Stel vragen die relevant zijn voor BoitenLuhrs, zoals over incasso, vorderingen of betalingen.",
                });
                return;
            }
            try {
                const convId = typeof conversation_id === "number"
                    ? conversation_id
                    : await this.db.createConversation();
                await this.db.saveMessage(convId, "user", userMessage);
                const history = await this.db.getHistory(convId);
                const aiResponse = await this.aiProxy.forwardMessage(history);
                await this.db.saveMessage(convId, "assistant", aiResponse);
                res.json({ reply: aiResponse, conversation_id: convId });
            }
            catch (error) {
                const message_ = error instanceof Error ? error.message : String(error);
                const isConfigError = message_.includes("Serverconfiguratie mist");
                res.status(isConfigError ? 503 : 502).json({
                    error: isConfigError
                        ? message_
                        : "Er ging iets mis bij de AI-service.",
                });
            }
        });
        this.router.get("/conversations", async (_req, res) => {
            try {
                const conversations = await this.db.getConversations();
                res.json(conversations);
            }
            catch (error) {
                res.status(500).json({ error: "Kon gesprekken niet ophalen." });
            }
        });
        this.router.get("/messages/:convId", async (req, res) => {
            const convIdParam = Array.isArray(req.params.convId)
                ? req.params.convId[0]
                : req.params.convId;
            const convId = parseInt(convIdParam, 10);
            if (isNaN(convId)) {
                res.status(400).json({ error: "Ongeldig gesprek ID." });
                return;
            }
            try {
                const messages = await this.db.getHistory(convId);
                res.json(messages);
            }
            catch (error) {
                res.status(500).json({ error: "Kon berichten niet ophalen." });
            }
        });
    }
}
