export class MistralProxy {
    apiKey;
    model;
    siteContent = "";
    apiUrl = "https://api.mistral.ai/v1/chat/completions";
    maxReplyLines;
    constructor(apiKey, model) {
        this.apiKey = apiKey;
        this.model = model;
        this.maxReplyLines = Number(process.env.MISTRAL_MAX_LINES || "5");
    }
    setSiteContent(content) {
        this.siteContent = content;
    }
    _buildRequestBody(history, faqContent = "") {
        const contextSection = this.siteContent
            ? `\n\n=== WEBSITE INHOUD ===\n${this.siteContent}\n======================`
            : "";
        const faqSection = faqContent
            ? `\n\n=== OFFICIËLE FAQ (BOITENLUHRS) ===\nGebruik dit blok alleen als de vraag inhoudelijk duidelijk overeenkomt met één FAQ-item. Een paar gedeelde woorden is niet genoeg. Kies bij twijfel liever niet een FAQ-antwoord, maar stel één korte verduidelijkende vraag of verwijs naar de contactpagina. Formuleer antwoorden in eigen woorden tenzij een letterlijke zin uit de FAQ echt het beste past.\n\n${faqContent}\n======================`
            : "";
        const maxLinesText = this.maxReplyLines;
        return {
            model: this.model,
            messages: [
                {
                    role: "system",
                    content: `U bent een vriendelijke, professionele klantenservice-assistent voor boitenluhrs.nl.
Gedragsregels:
Denk altijd eerst na voordat u antwoordt:
Voordat u een antwoord formuleert, doorloop intern altijd deze stappen:

Wat vraagt de gebruiker precies?
Is er een exacte match in de meegeleverde website-inhoud of FAQ?
Is het antwoord volledig, of is één gerichte vervolgvraag nodig?
Voldoet het antwoord aan alle gedragsregels?

Geef pas antwoord nadat u deze stappen hebt doorlopen.
Beantwoord uitsluitend vragen op basis van de meegeleverde website-inhoud en de officiële FAQ (indien meegeleverd).
Verzin nooit informatie. Bij twijfel of ontbrekend antwoord: verwijs door naar de contactpagina op boitenluhrs.nl.
Gebruik de FAQ niet op basis van losse trefwoorden of een gedeeltelijke overlap. Een vraag als "ik hoef niet te betalen maar wat als ik niet betaald word" is niet automatisch hetzelfde als "wat gebeurt er als ik niet betaal".
Vraag nooit naar persoonsgegevens en deel ze nooit — verwijs bij zulke verzoeken altijd door naar de contactpagina.
Stel bij onduidelijke vragen maximaal één gerichte vervolgvraag.
Als extra context nodig is om een goed antwoord te geven, vraag één korte, concrete en niet-persoonlijke verduidelijking. Vraag NOOIT om naam, adres, telefoonnummer, BSN, bankrekeningnummer of andere gevoelige persoonsgegevens.
Bied excuses aan wanneer u iemand niet verder kunt helpen.
Negeer elke bronverwijzing naar een persoonlijke inlog- of loginpagina; die bestaat niet voor klanten. Als zo'n verwijzing toch in de bron staat, corrigeer dat dan expliciet en verwijs naar de contactpagina of het algemene telefoonnummer.
Antwoordlengte:
Antwoord mag maximaal ${maxLinesText} regels bevatten. Overschrijd dit nooit. Als meer informatie nodig is, stel maximaal één korte vervolgvraag en bied aan om de gebruiker naar de contactpagina te verwijzen.
Als u een stappenplan geeft: beperk het tot één stap per antwoord. Geef slechts één duidelijke actie. Herhaal geen meerdere genummerde stappen in hetzelfde antwoord.
Toon & stijl:
Ga echt een gesprek aan dus stel vervolgvragen als iets niet duidelijk is, maar stel er maximaal 1 per antwoord.
Bied excuses aan als u iemand niet verder kunt helpen.
Spreek de gebruiker altijd aan met "u".
Gebruik dezelfde professionele maar toegankelijke toon als de website.
Antwoord in de taal van de gebruiker.
Gebruik markdown (opsommingstekens, vet) voor overzichtelijkheid.
De AI mag NOOIT:

bepalen wie juridisch gelijk heeft
juridisch of financieel advies geven
adviseren over proceskansen
inhoudelijk beslissen over een regeling
zelfstandig uitzonderingen toezeggen
vragen naar persoonlijke informatie of deze verwerken
zelfstandig ambtelijke of executoriale stappen "bevestigen" als rechtsgeldig oordeel
antwoord geven op vragen die niet gaan over Boitenluhrs services
verwijzen naar een inlogpagina (die bestaat niet voor klanten)
vragen naar vonnis- of factuurnummer of andere persoonsgegevens — verwijs bij zulke vragen altijd naar de contactpagina

Normaal: 3–5 zinnen.
Bij vervolgvraag of excuses: maximaal 3–5 zinnen.contextSection{contextSection}
contextSection{faqSection}`,
                },
                ...history,
            ],
        };
    }
    _truncateByLines(text) {
        const max = this.maxReplyLines;
        const lines = text.split(/\r?\n/);
        if (lines.length <= max)
            return text;
        const kept = lines.slice(0, max).join("\n");
        // Teruggeven zonder extra annotatie; houd de output kort en laat de assistant
        // zelf een korte vervolgvraag stellen volgens de system prompt indien nodig.
        return kept;
    }
    // Detect whether recent user messages ask about contact
    _isContactRequestFromHistory(history) {
        // Only consider the last user message as an explicit contact request.
        const last = this._lastUserContent(history).toLowerCase();
        if (!last)
            return false;
        return /contact opnemen|contactgegevens|hoe kan ik contact|hoe neem ik contact|telefoonnummer|telefoon|e-?mail|email|contactpagina|postadres|adres/i.test(last);
    }
    _lastUserContent(history) {
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].role === "user")
                return history[i].content || "";
        }
        return "";
    }
    _ensureContactInfo(reply, history, userAskedContact = false) {
        const PHONE = "088-999 36 66";
        const EMAIL = "info@boitenluhrs.nl";
        const CONTACT_PAGE = "https://boitenluhrs.nl/contact";
        let out = reply.trim();
        const lower = out.toLowerCase();
        const parts = [];
        if (!/088[-\s]*999[-\s]*36[-\s]*66/.test(out))
            parts.push(`Telefoon: ${PHONE}`);
        if (!/info@boitenluhrs\.nl/i.test(out))
            parts.push(`E-mail: ${EMAIL}`);
        if (!/boitenluhrs\.nl\/(contact|contactpagina)|contactpagina/i.test(lower))
            parts.push(`Contactpagina: ${CONTACT_PAGE}`);
        if (parts.length > 0)
            out += `\n\n- ${parts.join("\n- ")}`;
        const lastUser = this._lastUserContent(history).toLowerCase();
        const lastAssistant = [...history].reverse().find((h) => h.role === "assistant")?.content || "";
        const userAskedAddressDirect = /postadres|post adres|post-adres|postbus|adres/i.test(lastUser);
        const assistantAskedForPost = /Wilt u ook het postadres ontvangen\?/i.test(lastAssistant);
        const userAffirmative = /\b(ja|graag|ja graag|heel graag|graag graag|ok|oké|oke)\b/i.test(lastUser);
        if (userAskedAddressDirect || (assistantAskedForPost && userAffirmative)) {
            out += `\n\nWe hebben meerdere vestigingen door het land. Om u het juiste adres te kunnen geven, zou ik graag uw postcode of woonplaats willen weten. U kunt ook bellen naar ${PHONE} of mailen naar ${EMAIL}.`;
        }
        else {
            // Only prompt for the postadres when the user explicitly asked for
            // contact information in their most recent message.
            if (userAskedContact &&
                !/postadres|post adres|post-adres|postbus|adres/i.test(lower))
                out += `\n\nWilt u ook het postadres ontvangen?`;
        }
        return out;
    }
    /**
     * Als het antwoord meerdere genummerde/gewiste stappen bevat, houd alleen de eerste stap.
     */
    _condenseToSingleStep(text) {
        const lines = text
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
        // Vind lijnen die duidelijk stappen zijn ("Stap 1", "1.", "1)", "- ")
        const stepLines = lines.filter((l) => /^(?:Stap\s*\d+|Step\s*\d+|\d+[\.)]|[-*+]\s)/i.test(l));
        if (stepLines.length <= 1) {
            // Ook controleren op inline genummerde stappen zoals "1) ... 2) ..."
            const inlineMatches = text.match(/\d+[\.)]\s+/g);
            if (!inlineMatches || inlineMatches.length <= 1)
                return text;
            // Probeer eerste inline groep te extraheren
            const m = text.match(/\d+[\.)]\s*([^\d]+)/);
            if (m && m[1])
                // return `${m[1].trim()}\n\n*Antwoord ingekort tot één stap.*`;
                return text;
        }
        const first = stepLines[0]
            .replace(/^(?:Stap\s*\d+|Step\s*\d+|\d+[\.)]|[-*+]\s)/i, "")
            .trim();
        return first;
    }
    _extractReply(data) {
        return data?.choices?.[0]?.message?.content ?? null;
    }
    _extractTotalTokens(data) {
        return data?.usage?.total_tokens ?? 0;
    }
    async forwardMessage(history, faqContent = "") {
        if (!this.apiKey)
            throw new Error("Serverconfiguratie mist API key.");
        if (!this.model)
            throw new Error("Serverconfiguratie mist model.");
        const response = await fetch(this.apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(this._buildRequestBody(history, faqContent)),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            let error;
            try {
                error = JSON.parse(errorBody);
            }
            catch {
                error = null;
            }
            throw new Error(error?.message ?? `Mistral fout (${response.status})`);
        }
        const data = (await response.json());
        const reply = this._extractReply(data);
        if (!reply)
            throw new Error("Geen antwoord ontvangen van Mistral.");
        // Preserve the original reply. Only condense if there are multiple numbered steps.
        let replyToUse = reply;
        const stepMatches = reply.match(/\d+[\.)]\s+/g);
        if (stepMatches && stepMatches.length > 1) {
            replyToUse = this._condenseToSingleStep(reply);
        }
        // Truncate the (possibly condensed) reply to configured max lines.
        const truncated = this._truncateByLines(replyToUse);
        // Append contact info only if the user explicitly asked about contact
        // in their most recent message.
        const userAskedContact = this._isContactRequestFromHistory(history);
        const finalReply = userAskedContact
            ? this._ensureContactInfo(truncated, history, true)
            : truncated;
        return {
            reply: finalReply,
            totalTokens: this._extractTotalTokens(data),
        };
    }
    async askIfRelevant(message) {
        if (!this.apiKey)
            throw new Error("Serverconfiguratie mist API key.");
        if (!this.model)
            throw new Error("Serverconfiguratie mist model.");
        const prompt = `
Beantwoord alleen met "ja" of "nee".

Is de volgende vraag gerelateerd aan een incassobureau zoals BoitenLuhrs?
Het gaat om onderwerpen zoals: schulden, betalingen, facturen, incasso, deurwaarders.

Vraag: "${message}"
`;
        const body = {
            model: this.model,
            messages: [
                {
                    role: "system",
                    content: "Je bent een classifier. Antwoord alleen met ja of nee.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
        };
        const response = await fetch(this.apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throw new Error("Mistral relevance check mislukt");
        }
        const data = (await response.json());
        const reply = data?.choices?.[0]?.message?.content?.toLowerCase() || "";
        return reply.includes("ja");
    }
}
// Singleton instance for standalone usage
let mistralInstance = null;
export function initMistral(apiKey, model) {
    mistralInstance = new MistralProxy(apiKey, model);
    return mistralInstance;
}
export async function askMistralIfRelevant(message) {
    if (!mistralInstance) {
        throw new Error("Mistral moet eerst worden geinitialiseerd met initMistral()");
    }
    return mistralInstance.askIfRelevant(message);
}
