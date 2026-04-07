import mysql from "mysql2/promise";

export class Database {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST ?? "localhost",
      user: process.env.DB_USER ?? "root",
      password: process.env.DB_PASS ?? "",
      database: process.env.DB_NAME ?? "chatbot",
      waitForConnections: true,
    });
  }

  async init(): Promise<void> {
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        conversation_id INT NOT NULL,
        role ENUM('user','assistant') NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      )
    `);
    console.log("Database klaar.");
  }

  async createConversation(): Promise<number> {
    const [result] = await this.pool.execute(
      "INSERT INTO conversations () VALUES ()",
    );
    return (result as mysql.ResultSetHeader).insertId;
  }

  async saveMessage(
    conversationId: number,
    role: "user" | "assistant",
    content: string,
  ): Promise<void> {
    await this.pool.execute(
      "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
      [conversationId, role, content],
    );
  }

  async getHistory(
    conversationId: number,
    limit = 20,
  ): Promise<{ role: "user" | "assistant"; content: string }[]> {
    const [rows] = await this.pool.execute(
      `SELECT role, content FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC
       LIMIT ?`,
      [conversationId, limit],
    );
    return rows as { role: "user" | "assistant"; content: string }[];
  }
}
