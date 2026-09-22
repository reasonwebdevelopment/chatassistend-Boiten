import { Router, Request, Response } from "express";
import { MistralProxy, NON_RELEVANT_REPLY } from "./mistral.js";
import { Database } from "./db.js";
import { isRelevant } from "./keywords.js";
import { getRelevantFaqAsPromptContext } from "./faqHelper.js";
import { getExternalContext } from "./externalContext.js";
import { authenticateToken } from "./auth.js";

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

  private _getFixedClarifyingQuestion(
    message: string,
  ): string | null {
    const normalized = this._normalizeQuestion(message);

    /*
    * "Rekening" is dubbelzinnig:
    * - factuur/rekening die iemand moet betalen
    * - bankrekening
    *
    * Daarom eerst verduidelijken.
    */
    const isUnclearAccountQuestion =
      normalized === "mijn rekening klopt niet" ||
      normalized === "de rekening klopt niet" ||
      normalized === "mijn rekening is niet goed" ||
      normalized === "er klopt iets niet aan mijn rekening" ||
      normalized === "er klopt iets niet met mijn rekening";

    if (isUnclearAccountQuestion) {
      return "Over welke rekening heeft u het?";
    }

    /*
    * Onduidelijke algemene kostenvragen.
    */
    const isUnclearCostsQuestion =
      normalized === "ik snap de kosten niet" ||
      normalized === "de kosten kloppen niet" ||
      normalized === "mijn kosten kloppen niet" ||
      normalized === "ik begrijp de kosten niet";

    if (isUnclearCostsQuestion) {
      return "Over welke kosten heeft u het?";
    }

    /*
    * Een brief zonder verdere context.
    */
    const isUnclearLetterQuestion =
      normalized === "ik heb een brief ontvangen" ||
      normalized === "ik heb een brief gekregen" ||
      normalized === "wat betekent deze brief" ||
      normalized === "ik snap de brief niet";

    if (isUnclearLetterQuestion) {
      return "Om wat voor soort brief gaat het?";
    }

    return null;
  }

  /*
   * Geeft vaste antwoorden terug voor vragen waarvan
   * het antwoord altijd exact hetzelfde moet zijn.
   *
   * Momenteel:
   * - e-mailadres / mailcontact
   */
  private _getFixedContactAnswer(
    message: string,
  ): string | null {
    const normalized = this._normalizeQuestion(message);

    const isEmailContactQuestion =
      /\b(wat is|wat zijn|geef|hebben jullie|hoe kan ik|hoe kan|waar vind ik|waar kan ik|kan ik|hoe bereik ik|hoe neem ik contact op|contact opnemen via)\b.*\b(e ?mail|emailadres|mailadres|mailen|emailen)\b/i.test(
        normalized,
      ) ||
      /\b(e ?mailadres|emailadres|mailadres)\b.*\b(van jullie|boitenluhrs|contact)\b/i.test(
        normalized,
      );

    if (!isEmailContactQuestion) {
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

  private _getFixedComplaintAnswer(
    message: string,
  ): string | null {
    const normalized = this._normalizeQuestion(message);

    console.log(
      `[CHAT] Klachtcheck: "${normalized}"`,
    );

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
    const isComplaintQuestion =
      normalized.includes("klacht") ||
      normalized.includes("klagen");

    console.log(
      `[CHAT] Klacht herkend: ${
        isComplaintQuestion ? "JA" : "NEE"
      }`,
    );

    if (!isComplaintQuestion) {
      return null;
    }

    return `[Download het klachtenreglement](https://boitenluhrs.nl/download/521/?tmstv=1782305390)`;
  }

  private _getFixedSalesAnswer(
    message: string,
  ): string | null {
    const normalized = this._normalizeQuestion(message);

    const isSalesQuestion =
      normalized.includes("dossier uit handen") ||
      normalized.includes("incassodossier uit handen") ||
      normalized.includes("dossier overdragen") ||
      normalized.includes("incassodossier overdragen") ||
      normalized.includes("vordering uit handen") ||
      normalized.includes("vordering overdragen");

    if (!isSalesQuestion) {
      return null;
    }

    return `Als u een incassodossier uit handen wilt geven, kunt u dit regelen via ons sales-team. U kunt hiervoor contact opnemen via:

  - Telefoonnummer: **088-999 35 70**
  - E-mail: **sales@boitenluhrs.nl**`;
  }

  private _getFixedPersonalDossierAnswer(
    message: string,
  ): string | null {
    const normalized = this._normalizeQuestion(message);

    const isPersonalDossierQuestion =
      normalized.includes("hoeveel schuld") ||
      normalized.includes("hoeveel staat er open") ||
      normalized.includes("wat staat er nog open") ||
      normalized.includes("openstaand bedrag") ||
      normalized.includes("mijn dossier") ||
      normalized.includes("mijn schuld") ||
      normalized.includes("saldo van mijn dossier") ||
      normalized.includes("wat moet ik nog betalen");

    if (!isPersonalDossierQuestion) {
      return null;
    }

    return `Helaas kan ik uw persoonlijke dossier niet inzien. Daarvoor moet u contact opnemen met uw dossierbehandelaar.

  Het directe telefoonnummer en e-mailadres staan op de brief. Als u deze niet bij de hand heeft, kunt u het contactformulier invullen of bellen met **088 - 999 36 66**.

  Contactformulier: https://boitenluhrs.nl/contact`;
  }

  /*
   * Normaliseer een vraag:
   * - lowercase
   * - accenten verwijderen
   * - leestekens verwijderen
   * - dubbele spaties verwijderen
   */
  private _normalizeQuestion(text: string): string {
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
  private _canonicalizeQuestion(text: string): string {
    let normalized = this._normalizeQuestion(text);

    const replacements: Array<[RegExp, string]> = [
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
  private readonly _questionStopWords = new Set([
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
  private _tokenizeQuestion(text: string): string[] {
    return this._canonicalizeQuestion(text)
      .split(" ")
      .map((token) => token.trim())
      .filter(Boolean)
      .filter((token) => token.length > 2)
      .filter(
        (token) =>
          !this._questionStopWords.has(token),
      );
  }

  /*
   * Bepaal of twee vragen inhoudelijk voldoende
   * op elkaar lijken om hetzelfde antwoord te gebruiken.
   */
  private _areQuestionsEquivalent(
    a: string,
    b: string,
  ): boolean {
    const canonA =
      this._canonicalizeQuestion(a);

    const canonB =
      this._canonicalizeQuestion(b);

    /*
     * Exact dezelfde genormaliseerde betekenis.
     */
    if (canonA === canonB) {
      return true;
    }

    const tokensA =
      this._tokenizeQuestion(a);

    const tokensB =
      this._tokenizeQuestion(b);

    if (
      tokensA.length === 0 ||
      tokensB.length === 0
    ) {
      return false;
    }

    const setA = new Set(tokensA);
    const setB = new Set(tokensB);

    const intersection =
      [...setA].filter((token) =>
        setB.has(token),
      );

    const union =
      new Set([
        ...setA,
        ...setB,
      ]);

    const jaccardScore =
      intersection.length /
      union.size;

    const smallerSize =
      Math.min(
        setA.size,
        setB.size,
      );

    const containmentScore =
      intersection.length /
      smallerSize;

    /*
     * Conservatieve grens:
     *
     * - minimaal 60% algemene overlap
     * OF
     * - minimaal 80% van de kleinste betekenisvolle set
     *   zit ook in de andere vraag.
     */
    return (
      jaccardScore >= 0.6 ||
      containmentScore >= 0.8
    );
  }

  /*
   * Zoek of dezelfde of bijna dezelfde vraag
   * eerder in deze conversatie is gesteld.
   */
  private _findPreviousAnswer(
    history: {
      role: "user" | "assistant";
      content: string;
    }[],
    currentQuestion: string,
  ): string | null {
    for (
      let i = 0;
      i < history.length;
      i++
    ) {
      const message =
        history[i];

      if (
        message.role !== "user"
      ) {
        continue;
      }

      if (
        this._areQuestionsEquivalent(
          message.content,
          currentQuestion,
        )
      ) {
        const nextMessage =
          history[i + 1];

        if (
          nextMessage &&
          nextMessage.role ===
            "assistant"
        ) {
          return nextMessage.content;
        }
      }
    }

    return null;
  }

  private _findReusableAnswer(
    history: {
      role: "user" | "assistant";
      content: string;
    }[],
    currentQuestion: string,
  ): string | null {
    const question = this._normalizeQuestion(currentQuestion);

    // Alleen zelfstandige verzoeken waarvoor hergebruik gewenst is.
    const reusableQuestions = new Set([
      "ik wil betalen",
      "ik wil een betalingsregeling",
      "ik wil een betalingsregeling aanvragen",
      "ik wil een betalingsregeling treffen",
      "ik wil een regeling treffen",
    ]);

    if (!reusableQuestions.has(question)) {
      return null;
    }

    // Zoek het meest recente antwoord op exact dezelfde vraag.
    for (let i = history.length - 2; i >= 0; i--) {
      const previousQuestion = history[i];
      const previousAnswer = history[i + 1];

      if (
        previousQuestion.role !== "user" ||
        previousAnswer.role !== "assistant" ||
        this._normalizeQuestion(previousQuestion.content) !== question
      ) {
        continue;
      }

      const answer = previousAnswer.content.trim();

      // Herhaal geen standaardafwijzing of bekende foutmelding.
      if (
        !answer ||
        answer === NON_RELEVANT_REPLY.trim() ||
        /^Ik kan u helpen met algemene vragen over betalingen/i.test(answer) ||
        /^Er is iets misgegaan/i.test(answer)
      ) {
        return null;
      }

      // Bij tussenliggende inhoudelijke berichten kan de context
      // veranderd zijn. Sta alleen een bedankje of afscheid toe.
      const interveningUserMessages = history
        .slice(i + 2)
        .filter((message) => message.role === "user");

      const onlyClosings = interveningUserMessages.every((message) =>
        /^(bedankt|dank u|dank je|dankjewel|dankuwel|dank u wel|dank je wel|tot ziens|fijne dag)$/.test(
          this._normalizeQuestion(message.content),
        ),
      );

      return onlyClosings ? answer : null;
    }

    return null;
  }

  private _registerRoutes() {
    this.router.post(
      "/chat",
      async (
        req: Request,
        res: Response,
      ) => {
        const {
          conversation_id,
        } = req.body as ChatRequestBody;

        const userMessage =
          req.body.message;

        /*
         * 1. Controleer bericht
         */
        if (
          !userMessage ||
          typeof userMessage !== "string"
        ) {
          res.status(400).json({
            error:
              "Geen geldig bericht ontvangen.",
          });
          return;
        }

        try {
          /*
           * 2. Conversatie ophalen of aanmaken
           */
          const convId =
            typeof conversation_id === "number"
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

          /*
          * Eerst controleren of de gebruiker een algemene,
          * maar nog onduidelijke vraag stelt.
          */
          const clarifyingQuestion =
            this._getFixedClarifyingQuestion(userMessage);

          if (clarifyingQuestion) {
            console.log(
              "[CHAT] Onduidelijke algemene vraag gevonden. Verduidelijkende vraag wordt gesteld.",
            );

            await this.db.saveMessage(
              convId,
              "user",
              userMessage,
            );

            await this.db.saveMessage(
              convId,
              "assistant",
              clarifyingQuestion,
            );

            res.json({
              reply: clarifyingQuestion,
              conversation_id: convId,
            });

            return;
          }
          
          const fixedContactAnswer =
            this._getFixedContactAnswer(
              userMessage,
            );

          if (fixedContactAnswer) {
            console.log(
              "[CHAT] Vaste e-mail/contactvraag gevonden. Vast antwoord wordt gebruikt.",
            );

            await this.db.saveMessage(
              convId,
              "user",
              userMessage,
            );

            await this.db.saveMessage(
              convId,
              "assistant",
              fixedContactAnswer,
            );

            res.json({
              reply: fixedContactAnswer,
              conversation_id: convId,
            });

            return;
          }

          const fixedComplaintAnswer =
            this._getFixedComplaintAnswer(
              userMessage,
            );

          if (fixedComplaintAnswer) {
            console.log(
              "[CHAT] Vaste klachtvraag gevonden. Link naar klachtenreglement wordt gebruikt.",
            );

            await this.db.saveMessage(
              convId,
              "user",
              userMessage,
            );

            await this.db.saveMessage(
              convId,
              "assistant",
              fixedComplaintAnswer,
            );

            res.json({
              reply: fixedComplaintAnswer,
              conversation_id: convId,
            });

            return;
          }

          const fixedSalesAnswer =
            this._getFixedSalesAnswer(userMessage);

          if (fixedSalesAnswer) {
            console.log(
              "[CHAT] Vaste sales/dossier-vraag gevonden. Sales-contactgegevens worden gebruikt.",
            );

            await this.db.saveMessage(
              convId,
              "user",
              userMessage,
            );

            await this.db.saveMessage(
              convId,
              "assistant",
              fixedSalesAnswer,
            );

            res.json({
              reply: fixedSalesAnswer,
              conversation_id: convId,
            });

            return;
          }

          const fixedPersonalDossierAnswer =
            this._getFixedPersonalDossierAnswer(userMessage);

          if (fixedPersonalDossierAnswer) {
            console.log(
              "[CHAT] Persoonlijke dossier-vraag gevonden. Vast antwoord wordt gebruikt.",
            );

            await this.db.saveMessage(
              convId,
              "user",
              userMessage,
            );

            await this.db.saveMessage(
              convId,
              "assistant",
              fixedPersonalDossierAnswer,
            );

            res.json({
              reply: fixedPersonalDossierAnswer,
              conversation_id: convId,
            });

            return;
          }

          /*
           * 4. Bestaande geschiedenis ophalen
           *
           * Dit doen we VOORDAT we het huidige bericht opslaan.
           */
          console.log(
            "[CHAT] Bestaande geschiedenis ophalen...",
          );

          const existingHistory =
            await this.db.getHistory(convId);

          /*
           * 5. Eerst controleren of dezelfde of vergelijkbare
           * vraag al eerder is beantwoord.
           */
          const previousAnswer = this._findReusableAnswer(
            existingHistory,
            userMessage,
          );

          if (previousAnswer !== null) {
            await this.db.saveMessage(
              convId,
              "user",
              userMessage,
            );

            await this.db.saveMessage(
              convId,
              "assistant",
              previousAnswer,
            );

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
              await this.aiProxy.askIfRelevant(
                userMessage,
                existingHistory,
              );
          } catch (error) {
            console.error(
              "[CHAT] Relevantiecheck mislukt:",
              error,
            );

            relevant =
              isRelevant(userMessage);
          }

          console.log(
            `[CHAT] Vraag relevant: ${
              relevant ? "JA" : "NEE"
            }`,
          );

          if (!relevant) {
            res.json({
              reply:
                NON_RELEVANT_REPLY,
            });

            return;
          }

          /*
           * 7. Gebruikersbericht opslaan
           */
          await this.db.saveMessage(
            convId,
            "user",
            userMessage,
          );

          /*
           * 8. Nieuwe geschiedenis ophalen,
           * nu inclusief het huidige bericht.
           */
          const history =
            await this.db.getHistory(
              convId,
            );

          console.log(
            `[CHAT] Geschiedenis opgehaald: ${history.length} berichten`,
          );

          /*
           * 9. FAQ
           */
          console.log(
            "[CHAT] FAQ-context ophalen...",
          );

          const faqContext =
            await getRelevantFaqAsPromptContext(
              userMessage,
            );

          console.log(
            `[CHAT] FAQ-context opgehaald: ${
              faqContext
                ? faqContext.length
                : 0
            } tekens`,
          );

          /*
           * 10. Externe bronnen
           */
          console.log(
            "[CHAT] Externe bronnen controleren...",
          );

          let externalContext = "";

          try {
            externalContext =
              await getExternalContext(
                userMessage,
              );

            console.log(
              `[CHAT] Externe context opgehaald: ${
                externalContext
                  ? externalContext.length
                  : 0
              } tekens`,
            );
          } catch (
            externalError
          ) {
            console.error(
              "[CHAT] Externe context kon niet worden opgehaald:",
              externalError,
            );

            externalContext = "";
          }

          /*
           * 11. Mistral
           */
          console.log(
            "[CHAT] Mistral starten...",
          );

          const {
            reply: aiResponse,
            totalTokens,
          } =
            await this.aiProxy.forwardMessage(
              history,
              faqContext,
              externalContext,
            );

          console.log(
            "[CHAT] Mistral antwoord ontvangen.",
          );

          /*
           * 12. Antwoord opslaan
           */
          await this.db.saveMessage(
            convId,
            "assistant",
            aiResponse,
          );

          await this.db.saveUsageLog(
            convId,
            totalTokens,
          );

          /*
           * 13. Antwoord terug
           */
          res.json({
            reply: aiResponse,
            conversation_id: convId,
          });
        } catch (error) {
          console.error(
            "[API /chat ERROR]",
            error,
          );

          const message_ =
            error instanceof Error
              ? error.message
              : String(error);

          const isConfigError =
            message_.includes(
              "Serverconfiguratie mist",
            );

          res
            .status(
              isConfigError
                ? 503
                : 502,
            )
            .json({
              error:
                isConfigError
                  ? message_
                  : "Er ging iets mis bij de AI-service.",
            });
        }
      },
    );

    /*
     * CONVERSATIES
     */
    this.router.get(
      "/conversations",
      authenticateToken,
      async (
        _req: Request,
        res: Response,
      ) => {
        try {
          const conversations =
            await this.db.getConversations();

          res.json(
            conversations,
          );
        } catch (error) {
          console.error(
            "[API] Fout bij /conversations:",
            error,
          );

          res.status(500).json({
            error:
              "Kon gesprekken niet ophalen.",
          });
        }
      },
    );

    /*
     * BERICHTEN VAN EEN CONVERSATIE
     */
    this.router.get(
      "/messages/:convId",
      authenticateToken,
      async (
        req: Request,
        res: Response,
      ) => {
        const convIdParam =
          Array.isArray(
            req.params.convId,
          )
            ? req.params.convId[0]
            : req.params.convId;

        const convId =
          parseInt(
            convIdParam,
            10,
          );

        if (isNaN(convId)) {
          res
            .status(400)
            .json({
              error:
                "Ongeldig gesprek ID.",
            });
          return;
        }

        try {
          const messages =
            await this.db.getHistory(
              convId,
            );

          res.json(
            messages,
          );
        } catch (error) {
          console.error(
            "[API] Fout bij ophalen berichten:",
            error,
          );

          res.status(500).json({
            error:
              "Kon berichten niet ophalen.",
          });
        }
      },
    );

    /*
     * TOKEN / USAGE STATISTIEKEN
     */
    this.router.get(
      "/usage",
      authenticateToken,
      async (
        _req: Request,
        res: Response,
      ) => {
        try {
          const totalTokens =
            await this.db.getTotalUsageTokens();

          const pricePerMillionTokens =
            0.0015;

          const cost =
            (totalTokens /
              1_000_000) *
            pricePerMillionTokens;

          res.json({
            total_tokens:
              totalTokens,
            cost,
          });
        } catch (error) {
          console.error(
            "[API] Fout bij /usage:",
            error,
          );

          res
            .status(500)
            .json({
              error:
                "Kon usage statistieken niet ophalen.",
            });
        }
      },
    );
  }
}