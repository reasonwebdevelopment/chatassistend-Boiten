import express from "express";
import type { Request, Response } from "express";
import { Database } from "./db.js";
import { WebScraper } from "./scraper.js";
import { MistralProxy } from "./mistral.js";
import { ChatRouter } from "./chatRouter.js";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";
dotenv.config();

const CORS_OPTIONS = {
  origin: ["https://boitenluhrs.nl", "http://localhost:5173"] as string[],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
};

class Server {
  private app = express();

  constructor(private port: number) {
    this._configure();
  }

  private _configure() {
    this.app.use(cors(CORS_OPTIONS));
    this.app.options("*", cors(CORS_OPTIONS));

    this.app.use(express.json());
    this.app.use(express.static("public"));
    this.app.use(express.static("dist/client"));
    this.app.get(
      "/dashboard",
      (_req: express.Request, res: express.Response) => {
        res.sendFile(path.resolve("dist/client/dashboard.html"));
      },
    );
  }

  async start() {
    try {
      console.log("Database initialiseren...");
      const db = new Database();
      await db.init();
      console.log("✓ Database succesvol geïnitialiseerd");

      console.log("Website inhoud laden...");
      const scraper = new WebScraper("https://boitenluhrs.nl/");
      await scraper.load();
      console.log("✓ Website inhoud geladen");

      const mistral = new MistralProxy(
        process.env.MISTRAL_API_KEY,
        process.env.MISTRAL_MODEL ?? "ministral-8b-latest",
      );
      mistral.setSiteContent(scraper.getContent());

      const chatRouter = new ChatRouter(mistral, db);
      this.app.use("/api", chatRouter.router);

      // Endpoint voor huidige maandelijkse kosten-schatting (berekent op verzoek)
      this.app.get(
        "/api/usage/monthly",
        async (_req: Request, res: Response) => {
          try {
            const totalTokens = await db.getTotalUsageTokens();
            const pricePerMillionTokens = 0.0015;
            const cost = (totalTokens / 1_000_000) * pricePerMillionTokens;
            const now = new Date();
            const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            res.json({ month, total_tokens: totalTokens, cost });
          } catch {
            res.status(500).json({ error: "Kon kosten niet berekenen." });
          }
        },
      );

      this.app.listen(this.port, () =>
        console.log(`✓ Server draait op http://localhost:${this.port}`),
      );
    } catch (error) {
      console.error("❌ Fout bij starten van server:", error);
      process.exit(1);
    }
  }
}

new Server(Number(process.env.PORT ?? 3000)).start();
