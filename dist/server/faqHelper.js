import { readFile } from "fs/promises";
import path from "path";
let faqCache;
const LOGIN_RELATED_PATTERN = /\b(inlog(?:gen|gegevens|omgeving|pagina)?|login(?:omgeving|pagina)?|persoonlijke\s+pagina|persoonlijke\s+login|\/?login)\b/i;
function filterFaqItems(raw) {
    return raw.filter((item) => typeof item === "object" &&
        item !== null &&
        typeof item.vraag === "string" &&
        typeof item.antwoord === "string" &&
        !LOGIN_RELATED_PATTERN.test(item.vraag) &&
        !LOGIN_RELATED_PATTERN.test(item.antwoord));
}
async function loadFAQFromLocalFile() {
    const localPath = path.join(process.cwd(), "public", "faq.json");
    const raw = await readFile(localPath, "utf-8");
    const data = JSON.parse(raw);
    return filterFaqItems(data.faq ?? []);
}
function normalize(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ");
}
async function loadFAQ() {
    if (faqCache !== undefined)
        return faqCache;
    try {
        const faqUrl = process.env.FAQ_URL ??
            "https://boitenchat-355e0694e40b.herokuapp.com/faq.json";
        const response = await fetch(faqUrl);
        if (!response.ok) {
            throw new Error(`FAQ URL gaf status ${response.status}`);
        }
        const data = await response.json();
        faqCache = filterFaqItems(data.faq ?? []);
        return faqCache;
    }
    catch (error) {
        console.error("Fout bij laden van FAQ via URL:", error);
        try {
            faqCache = await loadFAQFromLocalFile();
            if (faqCache.length > 0) {
                console.log("✓ FAQ geladen uit public/faq.json (fallback)");
            }
            return faqCache;
        }
        catch {
            faqCache = [];
            return faqCache;
        }
    }
}
/** Volledige FAQ als één tekstblok voor het AI-systeembericht (RAG-vrije context). */
export async function getFaqAsPromptContext() {
    const items = await loadFAQ();
    if (items.length === 0)
        return "";
    return items
        .map((item) => `V: ${item.vraag.replace(/\s+/g, " ").trim()}\nA: ${item.antwoord.replace(/\s+/g, " ").trim()}`)
        .join("\n\n");
}
export async function findAnswerInDB(message) {
    const faqItems = await loadFAQ();
    const messageNorm = normalize(message);
    if (!messageNorm)
        return null;
    // Bij lange (dossier)teksten is "contains" matching onbetrouwbaar.
    const isLongMessage = messageNorm.length > 140;
    for (const item of faqItems) {
        const vraagNorm = normalize(item.vraag);
        if (!vraagNorm)
            continue;
        if (vraagNorm === messageNorm) {
            return item.antwoord;
        }
        if (!isLongMessage) {
            const minLen = Math.min(vraagNorm.length, messageNorm.length);
            const substantial = minLen >= 10;
            if (substantial &&
                (vraagNorm.includes(messageNorm) || messageNorm.includes(vraagNorm))) {
                return item.antwoord;
            }
        }
    }
    return null;
}
