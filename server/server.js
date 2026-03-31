import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

class AIProxy {
  constructor(apiUrl, apiKey) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  async forwardMessage(message) {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ message }),
    });

    const data = await response.json();
    return data.reply;
  }
}

class ChatRouter {
  constructor(aiProxy) {
    this.aiProxy = aiProxy;
    this.router = express.Router();
    this._registerRoutes();
  }

  _registerRoutes() {
    this.router.post("/chat", async (req, res) => {
      const { message } = req.body;

      try {
        const reply = await this.aiProxy.forwardMessage(message);
        res.json({ reply });
      } catch (error) {
        console.error("API error:", error);
        res.status(500).json({ error: "Er ging iets mis." });
      }
    });
  }
}

class Server {
  constructor(port) {
    this.port = port;
    this.app = express();
    this._configure();
  }

  _configure() {
    this.app.use(express.json());
    this.app.use(express.static("public"));

    const aiProxy = new AIProxy(process.env.AI_API_URL, process.env.AI_API_KEY);

    const chatRouter = new ChatRouter(aiProxy);
    this.app.use("/api", chatRouter.router);
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`Server draait op http://localhost:${this.port}`);
    });
  }
}

// opstarten
const server = new Server(process.env.PORT || 3000);
server.start();
