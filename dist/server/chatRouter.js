import { Router } from "express";
import { NON_RELEVANT_REPLY } from "./mistral.js";
import { isRelevant } from "./keywords.js";
import { getRelevantFaqAsPromptContext } from "./faqHelper.js";
import { getExternalContext } from "./externalContext.js";
import { authenticateToken } from "./auth.js";
export class ChatRouter {
    aiProxy;
    db;
    router = Router();
    constructor(aiProxy, db) {
        this.aiProxy = aiProxy;
        this.db = db;
        this._registerRoutes();
    }
    /*
     * Geeft vaste antwoorden terug voor vragen waarvan
     * het antwoord altijd exact hetzelfde moet zijn.
     *
     * Momenteel:
     * - e-mailadres / mailcontact
     */
    _getFixedContactAnswer(message) {
        const normalized = this._normalizeQuestion(message);
        const isEmailQuestion = /\be ?mail\b|\bemailadres\b|\bmailadres\b|\bmailen\b|\bemailen\b/i.test(normalized);
        if (!isEmailQuestion) {
            return null;
        }
        return `U kunt ons bereiken via het algemene e-mailadres: **info@boitenluhrs.nl**

    Indien u vragen heeft voor een specifieke afdeling dan kunt u uw bericht aan:

    - Afdeling VvE: **vve@boitenluhrs.nl**
    - Afdeling huur: **huur@boitenluhrs.nl**
    - Afdeling legal: **legal@boitenluhrs.nl**
    - Afdeling mkb: **mkb@boitenluhrs.nl**
    - Afdeling overheid: **overheid@boitenluhrs.nl**
    - Afdeling Amsterdam: **amsterdam@boitenluhrs.nl**

    Contactpagina: https://boitenluhrs.nl/contact`;
    }
    _getFixedComplaintAnswer(message) {
        const normalized = this._normalizeQuestion(message);
        console.log(`[CHAT] Klachtcheck: "${normalized}"`);
        /*
        * Iedere vraag waarin het woord "klacht" voorkomt,
        * krijgt hetzelfde vaste antwoord.
        *
        * Dit vangt onder andere af:
        * - Ik heb een klacht
        * - Wat moet ik met mijn klacht?
        * - Waar kan ik een klacht indienen?
        * - Ik wil een klacht melden
        * - Hoe werkt de klachtenregeling?
        * - Waar staat het klachtenreglement?
        */
        const isComplaintQuestion = normalized.includes("klacht") ||
            normalized.includes("klagen");
        console.log(`[CHAT] Klacht herkend: ${isComplaintQuestion ? "JA" : "NEE"}`);
        if (!isComplaintQuestion) {
            return null;
        }
        return `[Download het klachtenreglement](https://boitenluhrs.nl/download/521/?tmstv=1782305390)`;
    }
    /*
     * Normaliseer een vraag:
     * - lowercase
     * - accenten verwijderen
     * - leestekens verwijderen
     * - dubbele spaties verwijderen
     */
    _normalizeQuestion(text) {
        return text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\p{L}\p{N}\s]/gu, " ")
            .replace(/\s+/g, " ")
            .trim();
    }
    /*
     * Zet verschillende formuleringen om naar
     * zoveel mogelijk dezelfde betekenis.
     *
     * Bijvoorbeeld:
     * "ik wil een regeling treffen"
     * "ik wil een betalingsregeling treffen"
     *
     * worden inhoudelijk dichter naar elkaar toegebracht.
     */
    _canonicalizeQuestion(text) {
        let normalized = this._normalizeQuestion(text);
        const replacements = [
            [/\bbetaalregeling\b/g, "betalingsregeling"],
            [/\been regeling treffen\b/g, "betalingsregeling"],
            [/\bregeling treffen\b/g, "betalingsregeling"],
            [/\bregeling aanvragen\b/g, "betalingsregeling"],
            [/\bbetaal afspraak\b/g, "betalingsregeling"],
            [/\bbeslag vrije voet\b/g, "beslagvrijevoet"],
            [/\bbeslagvrije voet\b/g, "beslagvrijevoet"],
            [/\bgerechts deurwaarder\b/g, "gerechtsdeurwaarder"],
            [/\bgerechtsdeurwaarders\b/g, "gerechtsdeurwaarder"],
            [/\bdeurwaarders\b/g, "deurwaarder"],
            [/\bincasso bureau\b/g, "incassobureau"],
            [/\bincasso kantoor\b/g, "incassobureau"],
            [/\bopenstaande rekening\b/g, "openstaande factuur"],
            [/\bopenstaande rekeningen\b/g, "openstaande factuur"],
        ];
        for (const [pattern, replacement] of replacements) {
            normalized = normalized.replace(pattern, replacement);
        }
        return normalized
            .replace(/\s+/g, " ")
            .trim();
    }
    /*
     * Woorden die weinig betekenis toevoegen
     * bij het vergelijken van twee vragen.
     */
    _questionStopWords = new Set([
        "ik",
        "wij",
        "we",
        "wil",
        "willen",
        "zou",
        "graag",
        "een",
        "de",
        "het",
        "en",
        "of",
        "dan",
        "dat",
        "dit",
        "die",
        "is",
        "zijn",
        "te",
        "om",
        "van",
        "voor",
        "met",
        "op",
        "in",
        "aan",
        "bij",
        "naar",
        "over",
        "hoe",
        "wat",
        "wanneer",
        "waar",
        "waarom",
        "kan",
        "kun",
        "kunt",
        "mag",
        "moet",
        "mijn",
        "uw",
        "u",
        "je",
        "jij",
        "heb",
        "heeft",
        "hebben",
    ]);
    /*
     * Haal alleen betekenisvolle woorden uit een vraag.
     */
    _tokenizeQuestion(text) {
        return this._canonicalizeQuestion(text)
            .split(" ")
            .map((token) => token.trim())
            .filter(Boolean)
            .filter((token) => token.length > 2)
            .filter((token) => !this._questionStopWords.has(token));
    }
    /*
     * Bepaal of twee vragen inhoudelijk voldoende
     * op elkaar lijken om hetzelfde antwoord te gebruiken.
     */
    _areQuestionsEquivalent(a, b) {
        const canonA = this._canonicalizeQuestion(a);
        const canonB = this._canonicalizeQuestion(b);
        /*
         * Exact dezelfde genormaliseerde betekenis.
         */
        if (canonA === canonB) {
            return true;
        }
        const tokensA = this._tokenizeQuestion(a);
        const tokensB = this._tokenizeQuestion(b);
        if (tokensA.length === 0 ||
            tokensB.length === 0) {
            return false;
        }
        const setA = new Set(tokensA);
        const setB = new Set(tokensB);
        const intersection = [...setA].filter((token) => setB.has(token));
        const union = new Set([
            ...setA,
            ...setB,
        ]);
        const jaccardScore = intersection.length /
            union.size;
        const smallerSize = Math.min(setA.size, setB.size);
        const containmentScore = intersection.length /
            smallerSize;
        /*
         * Conservatieve grens:
         *
         * - minimaal 60% algemene overlap
         * OF
         * - minimaal 80% van de kleinste betekenisvolle set
         *   zit ook in de andere vraag.
         */
        return (jaccardScore >= 0.6 ||
            containmentScore >= 0.8);
    }
    /*
     * Zoek of dezelfde of bijna dezelfde vraag
     * eerder in deze conversatie is gesteld.
     */
    _findPreviousAnswer(history, currentQuestion) {
        for (let i = 0; i < history.length; i++) {
            const message = history[i];
            if (message.role !== "user") {
                continue;
            }
            if (this._areQuestionsEquivalent(message.content, currentQuestion)) {
                const nextMessage = history[i + 1];
                if (nextMessage &&
                    nextMessage.role ===
                        "assistant") {
                    return nextMessage.content;
                }
            }
        }
        return null;
    }
    _registerRoutes() {
        this.router.post("/chat", async (req, res) => {
            const { conversation_id, } = req.body;
            const userMessage = req.body.message;
            /*
             * 1. Controleer bericht
             */
            if (!userMessage ||
                typeof userMessage !== "string") {
                res.status(400).json({
                    error: "Geen geldig bericht ontvangen.",
                });
                return;
            }
            try {
                /*
                 * 2. Conversatie ophalen of aanmaken
                 */
                const convId = typeof conversation_id === "number"
                    ? conversation_id
                    : await this.db.createConversation();
                /*
                 * 3. Controleer eerst of dit een vraag is
                 * waarvoor een vast antwoord bestaat.
                 *
                 * Dit gebeurt bewust vóór:
                 * - eerdere antwoord-cache
                 * - relevantiecheck
                 * - FAQ
                 * - externe bronnen
                 * - Mistral
                 */
                const fixedContactAnswer = this._getFixedContactAnswer(userMessage);
                if (fixedContactAnswer) {
                    console.log("[CHAT] Vaste e-mail/contactvraag gevonden. Vast antwoord wordt gebruikt.");
                    await this.db.saveMessage(convId, "user", userMessage);
                    await this.db.saveMessage(convId, "assistant", fixedContactAnswer);
                    res.json({
                        reply: fixedContactAnswer,
                        conversation_id: convId,
                    });
                    return;
                }
                const fixedComplaintAnswer = this._getFixedComplaintAnswer(userMessage);
                if (fixedComplaintAnswer) {
                    console.log("[CHAT] Vaste klachtvraag gevonden. Link naar klachtenreglement wordt gebruikt.");
                    await this.db.saveMessage(convId, "user", userMessage);
                    await this.db.saveMessage(convId, "assistant", fixedComplaintAnswer);
                    res.json({
                        reply: fixedComplaintAnswer,
                        conversation_id: convId,
                    });
                    return;
                }
                /*
                 * 4. Bestaande geschiedenis ophalen
                 *
                 * Dit doen we VOORDAT we het huidige bericht opslaan.
                 */
                console.log("[CHAT] Bestaande geschiedenis ophalen...");
                const existingHistory = await this.db.getHistory(convId);
                /*
                 * 5. Eerst controleren of dezelfde of vergelijkbare
                 * vraag al eerder is beantwoord.
                 */
                const previousAnswer = this._findPreviousAnswer(existingHistory, userMessage);
                if (previousAnswer) {
                    console.log("[CHAT] Vergelijkbare vraag eerder beantwoord. Exact hetzelfde antwoord wordt hergebruikt.");
                    /*
                     * Huidige vraag wel gewoon opslaan.
                     */
                    await this.db.saveMessage(convId, "user", userMessage);
                    /*
                     * Exact hetzelfde eerdere antwoord opslaan.
                     */
                    await this.db.saveMessage(convId, "assistant", previousAnswer);
                    res.json({
                        reply: previousAnswer,
                        conversation_id: convId,
                    });
                    return;
                }
                /*
                 * 6. Alleen als de vraag nog niet eerder is beantwoord,
                 * voeren we de relevantiecheck uit.
                 */
                let relevant = false;
                try {
                    relevant =
                        await this.aiProxy.askIfRelevant(userMessage);
                }
                catch (error) {
                    console.error("[CHAT] Relevantiecheck mislukt:", error);
                    relevant =
                        isRelevant(userMessage);
                }
                console.log(`[CHAT] Vraag relevant: ${relevant ? "JA" : "NEE"}`);
                if (!relevant) {
                    res.json({
                        reply: NON_RELEVANT_REPLY,
                    });
                    return;
                }
                /*
                 * 7. Gebruikersbericht opslaan
                 */
                await this.db.saveMessage(convId, "user", userMessage);
                /*
                 * 8. Nieuwe geschiedenis ophalen,
                 * nu inclusief het huidige bericht.
                 */
                const history = await this.db.getHistory(convId);
                console.log(`[CHAT] Geschiedenis opgehaald: ${history.length} berichten`);
                /*
                 * 9. FAQ
                 */
                console.log("[CHAT] FAQ-context ophalen...");
                const faqContext = await getRelevantFaqAsPromptContext(userMessage);
                console.log(`[CHAT] FAQ-context opgehaald: ${faqContext
                    ? faqContext.length
                    : 0} tekens`);
                /*
                 * 10. Externe bronnen
                 */
                console.log("[CHAT] Externe bronnen controleren...");
                let externalContext = "";
                try {
                    externalContext =
                        await getExternalContext(userMessage);
                    console.log(`[CHAT] Externe context opgehaald: ${externalContext
                        ? externalContext.length
                        : 0} tekens`);
                }
                catch (externalError) {
                    console.error("[CHAT] Externe context kon niet worden opgehaald:", externalError);
                    externalContext = "";
                }
                /*
                 * 11. Mistral
                 */
                console.log("[CHAT] Mistral starten...");
                const { reply: aiResponse, totalTokens, } = await this.aiProxy.forwardMessage(history, faqContext, externalContext);
                console.log("[CHAT] Mistral antwoord ontvangen.");
                /*
                 * 12. Antwoord opslaan
                 */
                await this.db.saveMessage(convId, "assistant", aiResponse);
                await this.db.saveUsageLog(convId, totalTokens);
                /*
                 * 13. Antwoord terug
                 */
                res.json({
                    reply: aiResponse,
                    conversation_id: convId,
                });
            }
            catch (error) {
                console.error("[API /chat ERROR]", error);
                const message_ = error instanceof Error
                    ? error.message
                    : String(error);
                const isConfigError = message_.includes("Serverconfiguratie mist");
                res
                    .status(isConfigError
                    ? 503
                    : 502)
                    .json({
                    error: isConfigError
                        ? message_
                        : "Er ging iets mis bij de AI-service.",
                });
            }
        });
        /*
         * CONVERSATIES
         */
        this.router.get("/conversations", authenticateToken, async (_req, res) => {
            try {
                const conversations = await this.db.getConversations();
                res.json(conversations);
            }
            catch (error) {
                console.error("[API] Fout bij /conversations:", error);
                res.status(500).json({
                    error: "Kon gesprekken niet ophalen.",
                });
            }
        });
        /*
         * BERICHTEN VAN EEN CONVERSATIE
         */
        this.router.get("/messages/:convId", authenticateToken, async (req, res) => {
            const convIdParam = Array.isArray(req.params.convId)
                ? req.params.convId[0]
                : req.params.convId;
            const convId = parseInt(convIdParam, 10);
            if (isNaN(convId)) {
                res
                    .status(400)
                    .json({
                    error: "Ongeldig gesprek ID.",
                });
                return;
            }
            try {
                const messages = await this.db.getHistory(convId);
                res.json(messages);
            }
            catch (error) {
                console.error("[API] Fout bij ophalen berichten:", error);
                res.status(500).json({
                    error: "Kon berichten niet ophalen.",
                });
            }
        });
        /*
         * TOKEN / USAGE STATISTIEKEN
         */
        this.router.get("/usage", authenticateToken, async (_req, res) => {
            try {
                const totalTokens = await this.db.getTotalUsageTokens();
                const pricePerMillionTokens = 0.0015;
                const cost = (totalTokens /
                    1_000_000) *
                    pricePerMillionTokens;
                res.json({
                    total_tokens: totalTokens,
                    cost,
                });
            }
            catch (error) {
                console.error("[API] Fout bij /usage:", error);
                res
                    .status(500)
                    .json({
                    error: "Kon usage statistieken niet ophalen.",
                });
            }
        });
    }
}
