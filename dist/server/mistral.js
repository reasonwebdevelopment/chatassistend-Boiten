export class MistralProxy {
    apiKey;
    model;
    siteContent = "";
    apiUrl = "https://api.mistral.ai/v1/chat/completions";
    constructor(apiKey, model) {
        this.apiKey = apiKey;
        this.model = model;
    }
    setSiteContent(content) {
        this.siteContent = content;
    }
    _buildRequestBody(history) {
        const contextSection = this.siteContent
            ? `\n\n=== WEBSITE INHOUD ===\n${this.siteContent}\n======================`
            : "";
        return {
            model: this.model,
            messages: [
                {
                    role: "system",
                    content: `Je bent een vriendelijke klantenservice-assistent voor boitenluhrs.nl.
Beantwoord ALLEEN vragen op basis van de meegestuurde website-inhoud hieronder.
Als het antwoord er niet in staat, zeg dan: "Ik weet dat niet zeker. Neem contact op via boitenluhrs.nl."
Verzin NOOIT informatie. Antwoord kort en bondig, maximaal 2-3 zinnen.
Antwoord altijd in dezelfde taal als de vraag.
Gebruik GEEN markdown, geen sterretjes, geen opsommingstekens. Antwoord in gewone tekst.
Spreek de gebruiker aan met "u" en gebruik dezelfde professionele maar toegankelijke toon als de website.${contextSection}`,
                },
                ...history,
            ],
        };
    }
    _extractReply(data) {
        return data?.choices?.[0]?.message?.content ?? null;
    }
    _extractTotalTokens(data) {
        return data?.usage?.total_tokens ?? 0;
    }
    async forwardMessage(history) {
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
            body: JSON.stringify(this._buildRequestBody(history)),
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
        return {
            reply,
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
