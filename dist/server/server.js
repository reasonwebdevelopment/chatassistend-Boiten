import express from "express";
import cors from "cors";
import { Database } from "../server/db.js";
import { WebScraper } from "../server/scraper.js";
import { MistralProxy } from "../server/mistral.js";
import { ChatRouter } from "../server/chatRouter.js";
import path from "path";
import dotenv from "dotenv";
dotenv.config();
class Server {
    port;
    app = express();
    constructor(port) {
        this.port = port;
        this._configure();
    }
    _configure() {
        // CORS FIX
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static("dist/client"));
        this.app.get("/dashboard", (_req, res) => {
            res.sendFile(path.resolve("dist/client/dashboard.html"));
        });
    }
    async start() {
        const db = new Database();
        await db.init();
        const scraper = new WebScraper("https://boitenluhrs.nl/");
        await scraper.load();
        const mistral = new MistralProxy(process.env.MISTRAL_API_KEY, process.env.MISTRAL_MODEL ?? "ministral-8b-latest");
        mistral.setSiteContent(scraper.getContent());
        const chatRouter = new ChatRouter(mistral, db);
        this.app.use("/api", chatRouter.router);
        this.app.listen(this.port, () => console.log(`Server draait op http://localhost:${this.port}`));
    }
}
new Server(Number(process.env.PORT ?? 3000)).start();
