import { getRelevanceScore } from "./keywords.js";
import { NON_RELEVANT_REPLY, askMistralIfRelevant } from "./mistral.js";
import { findAnswerInDB } from "./faqHelper.js";
export async function handleMessage(message) {
    const score = getRelevanceScore(message);
    const answer = await findAnswerInDB(message);
    // duidelijke match
    if (score >= 3) {
        if (answer)
            return answer;
        return "Goede vraag! Neem contact op met de klantenservice.";
    }
    //  AI check
    const aiRelevant = await askMistralIfRelevant(message);
    if (!aiRelevant) {
        return NON_RELEVANT_REPLY;
    }
    // AI zegt relevant
    if (answer)
        return answer;
    return "Goede vraag! Deze informatie staat niet op de website.";
}
