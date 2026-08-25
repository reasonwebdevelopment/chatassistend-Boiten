import * as cheerio from "cheerio";
/**
 * Alleen deze domeinen mogen als externe bron worden gebruikt.
 */
const ALLOWED_DOMAINS = [
    "schuldinfo.nl",
    "www.schuldinfo.nl",
    "kbvg.nl",
    "www.kbvg.nl",
];
/**
 * Mogelijke sitemaplocaties.
 *
 * WordPress gebruikt vaak wp-sitemap.xml.
 * Andere websites gebruiken vaak sitemap.xml of sitemap_index.xml.
 */
const SITEMAP_URLS = [
    "sitemap-schuldinfo.xml",
    "https://www.kbvg.nl/wp-sitemap.xml",
    "https://www.kbvg.nl/sitemap.xml",
    "https://www.kbvg.nl/sitemap_index.xml",
];
/**
 * Sitemap maximaal 6 uur cachen.
 *
 * Daardoor hoeft de chatbot niet bij iedere vraag opnieuw
 * alle sitemaps op te halen.
 */
const SITEMAP_CACHE_TTL = 6 * 60 * 60 * 1000;
const sitemapCache = new Map();
/**
 * Maximum aantal pagina's dat uiteindelijk inhoudelijk
 * wordt opgehaald.
 *
 * Houd dit laag om de chatbot snel te houden.
 */
const MAX_PAGES_TO_FETCH = 6;
/**
 * Maximum aantal externe bronnen dat naar Mistral gaat.
 */
const MAX_RESULTS = 3;
/**
 * Maximale hoeveelheid tekst per externe pagina.
 */
const MAX_CONTENT_PER_PAGE = 5000;
/**
 * Request timeout.
 */
const REQUEST_TIMEOUT = 8000;
/**
 * Veel voorkomende woorden die nauwelijks helpen bij
 * het bepalen van de relevantie.
 */
const STOP_WORDS = new Set([
    "de",
    "het",
    "een",
    "en",
    "of",
    "voor",
    "van",
    "in",
    "op",
    "met",
    "aan",
    "bij",
    "is",
    "zijn",
    "was",
    "wordt",
    "worden",
    "kan",
    "kun",
    "mag",
    "moet",
    "hoe",
    "wat",
    "wanneer",
    "waar",
    "waarom",
    "welke",
    "wie",
    "ik",
    "mijn",
    "mij",
    "u",
    "uw",
    "je",
    "jouw",
    "dit",
    "dat",
    "die",
    "als",
    "dan",
    "er",
    "nog",
    "ook",
    "te",
    "tot",
    "om",
    "naar",
    "over",
    "door",
    "heb",
    "heeft",
    "hebben",
    "geldt",
    "geldig",
]);
/**
 * Controleert streng of een URL tot één van de
 * toegestane domeinen behoort.
 */
function isAllowedUrl(url) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
            return false;
        }
        return ALLOWED_DOMAINS.includes(parsed.hostname.toLowerCase());
    }
    catch {
        return false;
    }
}
/**
 * Algemene fetch-functie met timeout.
 */
async function fetchWithTimeout(url) {
    if (!isAllowedUrl(url)) {
        throw new Error(`Niet toegestaan extern domein: ${url}`);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, REQUEST_TIMEOUT);
    try {
        return await fetch(url, {
            signal: controller.signal,
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; BoitenLuhrsKlantenservice/1.0)",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            redirect: "follow",
        });
    }
    finally {
        clearTimeout(timeout);
    }
}
/**
 * HTML/XML entities uit sitemap-URL's halen.
 */
function decodeXml(value) {
    return value
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}
/**
 * Haalt alle <loc> waarden uit een sitemap.
 */
function extractSitemapLocations(xml) {
    const urls = [];
    const matches = xml.matchAll(/<loc>(.*?)<\/loc>/gis);
    for (const match of matches) {
        const value = match[1]?.trim();
        if (!value) {
            continue;
        }
        urls.push(decodeXml(value));
    }
    return urls;
}
/**
 * Controleert of een locatie waarschijnlijk zelf een sitemap is.
 */
function looksLikeSitemap(url) {
    const lower = url.toLowerCase();
    return (lower.endsWith(".xml") ||
        lower.includes("sitemap"));
}
/**
 * Sitemap recursief uitlezen.
 *
 * Sommige sites hebben:
 *
 * sitemap_index.xml
 *   ↓
 * post-sitemap.xml
 * page-sitemap.xml
 * enz.
 */
async function loadSitemap(sitemapUrl, depth = 0) {
    if (depth > 2) {
        return [];
    }
    if (!isAllowedUrl(sitemapUrl)) {
        return [];
    }
    const cached = sitemapCache.get(sitemapUrl);
    if (cached &&
        Date.now() - cached.loadedAt < SITEMAP_CACHE_TTL) {
        return cached.urls;
    }
    try {
        console.log(`[ExternalContext] Sitemap ophalen: ${sitemapUrl}`);
        const response = await fetchWithTimeout(sitemapUrl);
        if (!response.ok) {
            console.log(`[ExternalContext] Sitemap mislukt (${response.status}): ${sitemapUrl}`);
            return [];
        }
        const xml = await response.text();
        const locations = extractSitemapLocations(xml);
        const pageUrls = [];
        for (const location of locations) {
            if (!isAllowedUrl(location)) {
                continue;
            }
            if (looksLikeSitemap(location)) {
                const nested = await loadSitemap(location, depth + 1);
                pageUrls.push(...nested);
            }
            else {
                pageUrls.push(location);
            }
        }
        const uniqueUrls = [...new Set(pageUrls)];
        sitemapCache.set(sitemapUrl, {
            urls: uniqueUrls,
            loadedAt: Date.now(),
        });
        return uniqueUrls;
    }
    catch (error) {
        console.error(`[ExternalContext] Sitemap fout: ${sitemapUrl}`, error);
        return [];
    }
}
/**
 * Alle beschikbare URL's van Schuldinfo en KBvG verzamelen.
 */
async function getAllExternalUrls() {
    const allUrls = [];
    for (const sitemap of SITEMAP_URLS) {
        const urls = await loadSitemap(sitemap);
        allUrls.push(...urls);
    }
    return [...new Set(allUrls)].filter(isAllowedUrl);
}
/**
 * Vraag omzetten naar bruikbare zoektermen.
 */
function getQueryTerms(query) {
    return [
        ...new Set(query
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\s-]/g, " ")
            .split(/\s+/)
            .map((term) => term.trim())
            .filter(Boolean)
            .filter((term) => term.length >= 3)
            .filter((term) => !STOP_WORDS.has(term))),
    ];
}
/**
 * Extra zoekvarianten maken voor onderwerpen die in het
 * schuld-/deurwaardersdomein vaak voorkomen.
 */
function expandQueryTerms(terms) {
    const expanded = new Set(terms);
    const joined = terms.join(" ");
    if (joined.includes("beslag") ||
        joined.includes("beslagvrije") ||
        joined.includes("voet")) {
        expanded.add("beslag");
        expanded.add("beslagvrije");
        expanded.add("beslagvrijevoet");
    }
    if (joined.includes("loonbeslag") ||
        joined.includes("loon")) {
        expanded.add("loonbeslag");
        expanded.add("beslag");
    }
    if (joined.includes("bankbeslag") ||
        joined.includes("bank")) {
        expanded.add("bankbeslag");
        expanded.add("beslag");
    }
    if (joined.includes("regeling") ||
        joined.includes("betalingsregeling")) {
        expanded.add("betalingsregeling");
        expanded.add("regeling");
    }
    if (joined.includes("incassokosten") ||
        joined.includes("incasso")) {
        expanded.add("incasso");
        expanded.add("incassokosten");
    }
    if (joined.includes("deurwaarder") ||
        joined.includes("gerechtsdeurwaarder")) {
        expanded.add("deurwaarder");
        expanded.add("gerechtsdeurwaarder");
    }
    return [...expanded];
}
/**
 * URL geschikt maken voor scoring.
 */
function normalizeUrlForSearch(url) {
    try {
        return decodeURIComponent(new URL(url).pathname)
            .toLowerCase()
            .replace(/[-_/]/g, " ");
    }
    catch {
        return url.toLowerCase();
    }
}
/**
 * Bepaalt aan de hand van de URL welke pagina's
 * waarschijnlijk relevant zijn.
 *
 * Hierdoor hoeven we niet honderden pagina's op te halen.
 */
function scoreUrl(url, terms) {
    const searchable = normalizeUrlForSearch(url);
    let score = 0;
    for (const term of terms) {
        if (searchable.includes(term)) {
            score += 5;
        }
    }
    /**
     * Diepere contentpagina's zijn meestal nuttiger dan
     * homepage/tag/category pagina's.
     */
    try {
        const parsed = new URL(url);
        const parts = parsed.pathname
            .split("/")
            .filter(Boolean);
        if (parts.length >= 1) {
            score += 1;
        }
        if (parts.length >= 2) {
            score += 1;
        }
    }
    catch {
        // niets doen
    }
    return score;
}
/**
 * Navigatie en overbodige pagina-elementen verwijderen.
 */
function cleanHtml($) {
    $([
        "script",
        "style",
        "noscript",
        "svg",
        "iframe",
        "form",
        "nav",
        "footer",
        "header",
        ".cookie",
        ".cookies",
        ".cookiebanner",
        ".cookie-banner",
        ".menu",
        ".navigation",
        ".sidebar",
        ".breadcrumb",
        ".breadcrumbs",
        "#cookie",
        "#cookies",
    ].join(",")).remove();
}
/**
 * Tekst van een externe pagina ophalen.
 */
async function fetchExternalPage(url, terms) {
    if (!isAllowedUrl(url)) {
        return null;
    }
    try {
        console.log(`[ExternalContext] Pagina ophalen: ${url}`);
        const response = await fetchWithTimeout(url);
        if (!response.ok) {
            console.log(`[ExternalContext] Pagina mislukt (${response.status}): ${url}`);
            return null;
        }
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text/html") &&
            !contentType.includes("application/xhtml+xml")) {
            return null;
        }
        const html = await response.text();
        const $ = cheerio.load(html);
        cleanHtml($);
        const title = $("h1").first().text().trim() ||
            $("title").first().text().trim() ||
            url;
        /**
         * Eerst proberen de hoofdinhoud te pakken.
         */
        let content = $("main").first().text() ||
            $("article").first().text() ||
            $('[role="main"]').first().text() ||
            $("body").text();
        content = content
            .replace(/\s+/g, " ")
            .trim();
        if (!content || content.length < 100) {
            return null;
        }
        let score = scoreText(`${title} ${content}`, terms);
        /**
         * Titelmatches zijn extra belangrijk.
         */
        const titleLower = title.toLowerCase();
        for (const term of terms) {
            if (titleLower.includes(term)) {
                score += 10;
            }
        }
        return {
            url,
            title,
            content: content.slice(0, MAX_CONTENT_PER_PAGE),
            score,
        };
    }
    catch (error) {
        console.error(`[ExternalContext] Fout bij pagina ${url}:`, error);
        return null;
    }
}
/**
 * Tekst inhoudelijk scoren.
 */
function scoreText(text, terms) {
    const lower = text.toLowerCase();
    let score = 0;
    for (const term of terms) {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const matches = lower.match(new RegExp(escaped, "g"));
        if (matches) {
            score += Math.min(matches.length, 10);
        }
    }
    return score;
}
/**
 * Uit een lange pagina alleen de tekst rondom relevante
 * zoektermen halen.
 *
 * Dit voorkomt dat duizenden irrelevante woorden naar
 * Mistral worden gestuurd.
 */
function extractRelevantSnippet(content, terms) {
    const lower = content.toLowerCase();
    let bestIndex = -1;
    for (const term of terms) {
        const index = lower.indexOf(term.toLowerCase());
        if (index !== -1 &&
            (bestIndex === -1 || index < bestIndex)) {
            bestIndex = index;
        }
    }
    if (bestIndex === -1) {
        return content.slice(0, 2500);
    }
    const start = Math.max(0, bestIndex - 700);
    const end = Math.min(content.length, bestIndex + 2500);
    return content
        .slice(start, end)
        .trim();
}
/**
 * Hoofdfunctie.
 *
 * Deze wordt vanuit chatRouter.ts aangeroepen:
 *
 * const externalContext =
 *   await getExternalContext(userMessage);
 */
export async function getExternalContext(userMessage) {
    console.log(`[ExternalContext] Zoeken voor vraag: "${userMessage}"`);
    const baseTerms = getQueryTerms(userMessage);
    const terms = expandQueryTerms(baseTerms);
    if (terms.length === 0) {
        console.log("[ExternalContext] Geen bruikbare zoektermen.");
        return "";
    }
    console.log(`[ExternalContext] Zoektermen: ${terms.join(", ")}`);
    /*
     * 1. URL's verzamelen uit de sitemaps.
     */
    const urls = await getAllExternalUrls();
    console.log(`[ExternalContext] ${urls.length} externe URL's beschikbaar.`);
    if (urls.length === 0) {
        return "";
    }
    /*
     * 2. Eerst alleen URL's beoordelen.
     *
     * Bijvoorbeeld:
     *
     * vraag:
     * "Wanneer geldt een beslagvrije voet?"
     *
     * URL:
     * /beslagvrije-voet/
     *
     * krijgt direct een hoge score.
     */
    const rankedUrls = urls
        .map((url) => ({
        url,
        score: scoreUrl(url, terms),
    }))
        .sort((a, b) => b.score - a.score);
    /*
     * Eerst URL's met een daadwerkelijke match.
     */
    let candidates = rankedUrls
        .filter((item) => item.score > 0)
        .slice(0, MAX_PAGES_TO_FETCH);
    /*
     * Geen URL-match?
     *
     * Dan pakken we een klein aantal pagina's als fallback.
     * Dit voorkomt dat er meteen honderden pagina's
     * worden gedownload.
     */
    if (candidates.length === 0) {
        candidates = rankedUrls.slice(0, MAX_PAGES_TO_FETCH);
    }
    /*
     * 3. Alleen kandidaatpagina's inhoudelijk ophalen.
     */
    const pages = [];
    for (const candidate of candidates) {
        const page = await fetchExternalPage(candidate.url, terms);
        if (!page) {
            continue;
        }
        page.score += candidate.score;
        if (page.score > 0) {
            pages.push(page);
        }
    }
    /*
     * 4. Beste resultaten selecteren.
     */
    const results = pages
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RESULTS);
    if (results.length === 0) {
        console.log("[ExternalContext] Geen relevante externe informatie gevonden.");
        return "";
    }
    console.log(`[ExternalContext] ${results.length} relevante bron(nen) gevonden.`);
    /*
     * 5. Context bouwen die Mistral begrijpt.
     *
     * De URL staat bewust direct bij iedere bron.
     * Daardoor kan Mistral de juiste bronlink opnemen
     * in het uiteindelijke antwoord.
     */
    return results
        .map((page, index) => {
        const snippet = extractRelevantSnippet(page.content, terms);
        return `
EXTERNE BRON ${index + 1}

Titel:
${page.title}

URL:
${page.url}

Inhoud:
${snippet}
`.trim();
    })
        .join("\n\n--------------------\n\n");
}
