import express from "express";
import { Database } from "./db.js";
import { WebScraper } from "./scraper.js";
import { MistralProxy } from "./mistral.js";
import { ChatRouter } from "./chatRouter.js";
import dotenv from "dotenv";
dotenv.config();

const db = new Database();
await db.init();
class Server {
  private app = express();

  constructor(private port: number) {
    this._configure();
  }

  private _configure() {
    this.app.use(express.json());
    this.app.use(express.static("dist/client"));
  }

  async start() {
    const db = new Database();
    await db.init();

    const scraper = new WebScraper("https://boitenluhrs.nl/");
    await scraper.load();

    const mistral = new MistralProxy(
      process.env.MISTRAL_API_KEY,
      process.env.MISTRAL_MODEL ?? "ministral-8b-latest",
    );
    mistral.setSiteContent(scraper.getContent());

    const chatRouter = new ChatRouter(mistral, db);
    this.app.use("/api", chatRouter.router);

    this.app.listen(this.port, () =>
      console.log(`Server draait op http://localhost:${this.port}`),
    );
  }
}

new Server(Number(process.env.PORT ?? 3000)).start();
