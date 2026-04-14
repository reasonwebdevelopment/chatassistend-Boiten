export class WebScraper {
  private content: string = "";

  constructor(private readonly baseUrl: string) {}

  private _stripHtml(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  private _extractLinks(html: string): string[] {
    const matches = [...html.matchAll(/href="([^"]+)"/g)];
    return matches
      .map((m) => m[1])
      .filter((href) => href.startsWith("/") && !href.includes("#"))
      .map((href) => `${this.baseUrl.replace(/\/$/, "")}${href}`)
      .filter((url, i, arr) => arr.indexOf(url) === i)
      .filter(
        (url) =>
          url !== this.baseUrl &&
          url !== this.baseUrl.replace(/\/$/, "") &&
          !url.includes("/opdrachtgever"),
      );
  }

  private async _fetchPage(url: string): Promise<string> {
    try {
      console.log(`[Scraper] Scrapen: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`[Scraper] Mislukt (${response.status}): ${url}`);
        return "";
      }
      const html = await response.text();
      return this._stripHtml(html);
    } catch (error) {
      console.warn(`[Scraper] Fout bij scrapen: ${url}`, error);
      return "";
    }
  }

  async load(): Promise<void> {
    try {
      const homeResponse = await fetch(this.baseUrl);
      if (!homeResponse.ok) throw new Error(`HTTP ${homeResponse.status}`);
      const homeHtml = await homeResponse.text();

      const links = this._extractLinks(homeHtml);
      const forcedLinks = ["https://boitenluhrs.nl/debiteur/over-boitenluhrs/"];
      const allLinks = [...new Set([...links, ...forcedLinks])];
      console.log(`Gevonden pagina's: ${allLinks.length}`);

      const pages = await Promise.all([
        this._fetchPage(this.baseUrl),
        ...allLinks.map((url) => this._fetchPage(url)),
      ]);

      this.content = pages.filter(Boolean).join("\n\n").slice(0, 12000);
      console.log(`Site geladen: ${this.content.length} tekens`);
    } catch (error) {
      console.warn("Website kon niet gescraped worden:", error);
      this.content = "";
    }
  }

  getContent(): string {
    return this.content;
  }
}
