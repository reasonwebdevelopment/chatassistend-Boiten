import mysql from "mysql2/promise";

export class Database {
  private pool: mysql.Pool;
  private dbName: string;

  constructor() {
    this.dbName = process.env.DB_NAME ?? "chatbot";
    // Pool ZONDER database naam, zodat we eerst de database kunnen creëren
    this.pool = mysql.createPool({
      host: process.env.DB_HOST ?? "localhost",
      user: process.env.DB_USER ?? "root",
      password: process.env.DB_PASS ?? "",
      waitForConnections: true,
    });
    console.log(`Database pool aangemaakt (database: ${this.dbName})`);
  }

  async init(): Promise<void> {
    let connection;
    try {
      console.log("Verbinden met MySQL...");
      connection = await this.pool.getConnection();
      console.log("✓ MySQL verbinding geslaagd.");

      // Database aanmaken als die niet bestaat
      console.log(`Database '${this.dbName}' aanmaken...`);
      await connection.query(
        `CREATE DATABASE IF NOT EXISTS \`${this.dbName}\``,
      );
      console.log(`✓ Database '${this.dbName}' klaar.`);

      // Database selecteren (met query, niet execute)
      await connection.query(`USE \`${this.dbName}\``);
      console.log(`✓ Database '${this.dbName}' geselecteerd.`);

      // Tabellen aanmaken
      console.log("Tabel 'conversations' aanmaken...");
      await connection.query(`
        CREATE TABLE IF NOT EXISTS conversations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("✓ Tabel 'conversations' klaar.");

      console.log("Tabel 'messages' aanmaken...");
      await connection.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          conversation_id INT NOT NULL,
          role ENUM('user','assistant') NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        )
      `);
      console.log("✓ Tabel 'messages' klaar.");

      console.log("Tabel 'usage_logs' aanmaken...");
      await connection.query(`
        CREATE TABLE IF NOT EXISTS usage_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          conversation_id INT NOT NULL,
          tokens INT NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        )
      `);
      console.log("✓ Tabel 'usage_logs' klaar.");
      console.log("Tabel 'monthly_estimates' aanmaken...");
      await connection.query(`
        CREATE TABLE IF NOT EXISTS monthly_estimates (
          id INT AUTO_INCREMENT PRIMARY KEY,
          month VARCHAR(16) NOT NULL,
          total_tokens BIGINT NOT NULL DEFAULT 0,
          cost DECIMAL(12,6) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("✓ Tabel 'monthly_estimates' klaar.");
      console.log("✓ Database init compleet.");

      // Herbouw de pool met een vaste database, zodat alle volgende queries
      // dezelfde database gebruiken als de init-connection.
      this.pool = mysql.createPool({
        host: process.env.DB_HOST ?? "localhost",
        user: process.env.DB_USER ?? "root",
        password: process.env.DB_PASS ?? "",
        database: this.dbName,
        waitForConnections: true,
      });
      console.log(
        `✓ Database pool opnieuw aangemaakt met database '${this.dbName}'`,
      );
    } catch (error) {
      console.error("❌ Fout bij aanmaken van database/tabellen:");
      console.error(error);
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  async createConversation(): Promise<number> {
    console.log("Nieuwe conversatie aanmaken...");
    const [result] = await this.pool.execute(
      "INSERT INTO conversations () VALUES ()",
    );
    const insertId = (result as mysql.ResultSetHeader).insertId;
    console.log("Conversatie aangemaakt, ID:", insertId);
    return insertId;
  }

  async getConversations(): Promise<{ id: number; created_at: string }[]> {
    const [rows] = await this.pool.execute(
      "SELECT id, created_at FROM conversations ORDER BY created_at DESC",
    );
    return rows as { id: number; created_at: string }[];
  }

  async saveMessage(
    conversationId: number,
    role: "user" | "assistant",
    content: string,
  ): Promise<void> {
    console.log(
      `Bericht opslaan: [${role}] ${content} (conversation ${conversationId})`,
    );
    await this.pool.execute(
      "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
      [conversationId, role, content],
    );
    console.log("Bericht opgeslagen.");
  }

  async getHistory(
    conversationId: number,
    limit = 20,
  ): Promise<{ role: "user" | "assistant"; content: string }[]> {
    console.log(
      `Ophalen van geschiedenis voor conversatie ${conversationId}, limit ${limit}`,
    );
    const [rows] = await this.pool.execute(
      `SELECT role, content FROM messages
     WHERE conversation_id = ?
     ORDER BY created_at ASC
     LIMIT ?`,
      [conversationId, limit],
    );
    console.log(
      `Geschiedenis opgehaald, ${(rows as any).length} berichten gevonden.`,
    );
    return rows as { role: "user" | "assistant"; content: string }[];
  }

  async saveUsageLog(conversationId: number, tokens: number): Promise<void> {
    await this.pool.execute(
      "INSERT INTO usage_logs (conversation_id, tokens) VALUES (?, ?)",
      [conversationId, tokens],
    );
  }

  async saveMonthlyEstimate(
    month: string,
    totalTokens: number,
    cost: number,
  ): Promise<void> {
    await this.pool.execute(
      "INSERT INTO monthly_estimates (month, total_tokens, cost) VALUES (?, ?, ?)",
      [month, totalTokens, cost],
    );
  }

  async getLatestMonthlyEstimate(): Promise<{
    month: string;
    total_tokens: number;
    cost: number;
    created_at: string;
  } | null> {
    const [rows] = await this.pool.execute(
      "SELECT month, total_tokens, cost, created_at FROM monthly_estimates ORDER BY created_at DESC LIMIT 1",
    );
    const firstRow = (rows as any[])[0];
    if (!firstRow) return null;
    return {
      month: firstRow.month,
      total_tokens: Number(firstRow.total_tokens),
      cost: Number(firstRow.cost),
      created_at: firstRow.created_at,
    };
  }

  async getTotalUsageTokens(): Promise<number> {
    const [rows] = await this.pool.execute(
      "SELECT SUM(tokens) AS total_tokens FROM usage_logs",
    );
    const firstRow = (rows as { total_tokens: number | null }[])[0];
    return firstRow?.total_tokens ?? 0;
  }
}
