import mysql from "mysql2/promise";
export class Database {
    pool;
    constructor() {
        this.pool = mysql.createPool({
            host: process.env.DB_HOST ?? "localhost",
            user: process.env.DB_USER ?? "root",
            password: process.env.DB_PASS ?? "",
            database: process.env.DB_NAME ?? "chatbot",
            waitForConnections: true,
        });
        console.log("Database pool aangemaakt.");
    }
    async init() {
        await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log("Tabel 'conversations' klaar.");
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
        console.log("Database init compleet.");
    }
    async createConversation() {
        console.log("Nieuwe conversatie aanmaken...");
        const [result] = await this.pool.execute("INSERT INTO conversations () VALUES ()");
        const insertId = result.insertId;
        console.log("Conversatie aangemaakt, ID:", insertId);
        return insertId;
    }
    async getConversations() {
        const [rows] = await this.pool.execute("SELECT id, created_at FROM conversations ORDER BY created_at DESC");
        return rows;
    }
    async saveMessage(conversationId, role, content) {
        console.log(`Bericht opslaan: [${role}] ${content} (conversation ${conversationId})`);
        await this.pool.execute("INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)", [conversationId, role, content]);
        console.log("Bericht opgeslagen.");
    }
    async getHistory(conversationId, limit = 20) {
        console.log(`Ophalen van geschiedenis voor conversatie ${conversationId}, limit ${limit}`);
        const [rows] = await this.pool.execute(`SELECT role, content FROM messages
     WHERE conversation_id = ?
     ORDER BY created_at ASC
     LIMIT ?`, [conversationId, limit]);
        console.log(`Geschiedenis opgehaald, ${rows.length} berichten gevonden.`);
        return rows;
    }
}
