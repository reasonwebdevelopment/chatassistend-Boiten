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
    const baseNoSlash = this.baseUrl.replace(/\/$/, "");
    const matches = [...html.matchAll(/href="([^"]+)"/g)];
    const urls = matches
      .map((m) => m[1])
      .filter((href) => href.startsWith("/") && !href.includes("#"))
      .filter((href) => {
        // Exclude typical static asset extensions (css, js, images, fonts, etc.)
        return !/\.(css|js|png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|map|pdf|xls|xlsx)$/i.test(
          href,
        );
      })
      .filter((href) => {
        // Exclude WordPress content directories like /wp-content
        return !/\/wp-content(\/|$)/i.test(href);
      })
      .map((href) => `${baseNoSlash}${href}`);
    return [...new Set(urls)].filter(
      (url) =>
        url !== this.baseUrl &&
        url !== baseNoSlash &&
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
      //* Voeg handmatig belangrijke pagina's toe die mogelijk niet via links worden gevonden
      const links = this._extractLinks(homeHtml);
      const forcedLinks = [
        "https://boitenluhrs.nl/debiteur/over-boitenluhrs/",
        "https://boitenluhrs.nl/debiteur/vonnis-ontvangen/",
        "https://boitenluhrs.nl/debiteur/beslaglegging/",
        "https://boitenluhrs.nl/debiteur/hulp-bij-betalen/",
      ];
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
