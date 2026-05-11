let faqCache = null;
function normalize(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ");
}
async function loadFAQ() {
    if (faqCache)
        return faqCache;
    try {
        const faqUrl = process.env.FAQ_URL ??
            "https://boitenchat-355e0694e40b.herokuapp.com/faq.json";
        const response = await fetch(faqUrl);
        if (!response.ok) {
            throw new Error(`FAQ URL gaf status ${response.status}`);
        }
        const data = await response.json();
        faqCache = data.faq ?? [];
        return faqCache;
    }
    catch (error) {
        console.error("Fout bij laden van FAQ via URL:", error);
        return [];
    }
}
export async function findAnswerInDB(message) {
    const faqItems = await loadFAQ();
    const messageNorm = normalize(message);
    if (!messageNorm)
        return null;
    // Bij lange (dossier)teksten is "contains" matching onbetrouwbaar.
    // Sta alleen exacte/zeer-dichte match toe.
    const isLongMessage = messageNorm.length > 140;
    for (const item of faqItems) {
        const vraagNorm = normalize(item.vraag);
        if (!vraagNorm)
            continue;
        // Exacte match
        if (vraagNorm === messageNorm) {
            return item.antwoord;
        }
        // Voor korte vragen: sta substring match toe, maar alleen als de overlap substantieel is.
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
