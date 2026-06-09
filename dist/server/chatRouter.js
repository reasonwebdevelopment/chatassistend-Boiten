import { Router } from "express";
import { NON_RELEVANT_REPLY } from "./mistral.js";
import { isRelevant } from "./keywords.js";
import { getRelevantFaqAsPromptContext } from "./faqHelper.js";
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
                    reply: NON_RELEVANT_REPLY,
                });
                return;
            }
            try {
                const convId = typeof conversation_id === "number"
                    ? conversation_id
                    : await this.db.createConversation();
                await this.db.saveMessage(convId, "user", userMessage);
                const history = await this.db.getHistory(convId);
                const faqContext = await getRelevantFaqAsPromptContext(userMessage);
                const { reply: aiResponse, totalTokens } = await this.aiProxy.forwardMessage(history, faqContext);
                await this.db.saveMessage(convId, "assistant", aiResponse);
                await this.db.saveUsageLog(convId, totalTokens);
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
                console.error("[API] Fout bij /conversations:", error);
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
        this.router.get("/usage", async (_req, res) => {
            try {
                const totalTokens = await this.db.getTotalUsageTokens();
                const pricePerMillionTokens = 0.0015;
                const cost = (totalTokens / 1_000_000) * pricePerMillionTokens;
                res.json({
                    total_tokens: totalTokens,
                    cost,
                });
            }
            catch (error) {
                console.error("[API] Fout bij /usage:", error);
                res.status(500).json({ error: "Kon usage statistieken niet ophalen." });
            }
        });
    }
}
