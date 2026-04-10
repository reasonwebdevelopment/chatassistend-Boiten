/**
 * chatbot.ts — Embeddable widget voor BoitenLuhrs
 * Gebruik: <script src="http://localhost:3000/chatbot.js"></script>
 *
 * Bevat alle logica van chat-assistent.ts en chat-ui.ts inline,
 * zodat dit bestand volledig zelfstandig werkt op elke pagina.
 */

(function () {
  // Voorkom dubbele initialisatie
  if ((window as any).__boitenluhrsChat) return;
  (window as any).__boitenluhrsChat = true;

  // ─────────────────────────────────────────────
  // 1. SERVER URL — past zich aan aan het script-tag
  // ─────────────────────────────────────────────
  function getServerUrl(): string {
    const scripts = document.querySelectorAll<HTMLScriptElement>("script[src]");
    for (const script of Array.from(scripts)) {
      if (script.src.includes("chatbot.js")) {
        const url = new URL(script.src);
        return `${url.protocol}//${url.host}`;
      }
    }
    return "http://localhost:3000"; // fallback
  }

  const SERVER_URL = getServerUrl();
  const FAQ_URL = `${SERVER_URL}/faq.json`;
  const API_URL = "https://boitenchat-355e0694e40b.herokuapp.com/api/chat"; //!hier reqest url aanpassen als nodig

  // ─────────────────────────────────────────────
  // 2. CSS — gebaseerd op style.css van het project
  // ─────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    #bl-chat-bubble {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      min-width: 58px;
      height: 58px;
      padding: 0 1.2rem;
      background: #2a5cff;
      color: #fff;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 2147483646;
      box-shadow: 0 4px 20px rgba(42,92,255,0.4);
      transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s;
      user-select: none;
      border: none;
      font-family: "DM Sans", sans-serif;
      font-size: 0.85rem;
      font-weight: 500;
      gap: 0.5rem;
      white-space: nowrap;
    }
    #bl-chat-bubble:hover {
      transform: scale(1.08);
      box-shadow: 0 8px 30px rgba(42,92,255,0.5);
    }
    #bl-chat-bubble.is-open {
      padding: 0;
      min-width: 58px;
    }
    #bl-chat-bubble .bl-icon-open  { transition: opacity 0.2s, transform 0.2s; }
    #bl-chat-bubble .bl-icon-close {
      position: absolute;
      opacity: 0;
      transform: rotate(-90deg);
      transition: opacity 0.2s, transform 0.2s;
      font-style: normal;
      font-size: 1.1rem;
    }
    #bl-chat-bubble.is-open .bl-icon-open  { opacity: 0; transform: rotate(90deg); }
    #bl-chat-bubble.is-open .bl-icon-close { opacity: 1; transform: rotate(0deg); }

    #bl-chat-popup {
      position: fixed;
      bottom: 5.5rem;
      right: 2rem;
      width: 360px;
      max-height: 520px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.14);
      border: 1px solid #e4e2da;
      display: flex;
      flex-direction: column;
      z-index: 2147483645;
      overflow: hidden;
      opacity: 0;
      transform: translateY(20px) scale(0.96);
      transform-origin: bottom right;
      pointer-events: none;
      transition: opacity 0.3s cubic-bezier(0.34,1.56,0.64,1),
                  transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
      font-family: "DM Sans", sans-serif;
    }
    #bl-chat-popup.is-open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: all;
    }

    /* Header */
    #bl-chat-popup .bl-header {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 1.1rem 1.25rem;
      background: #2a5cff;
      color: #fff;
      flex-shrink: 0;
    }
    #bl-chat-popup .bl-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Georgia, serif;
      font-size: 1.1rem;
      flex-shrink: 0;
    }
    #bl-chat-popup .bl-name   { font-weight: 500; font-size: 0.9rem; }
    #bl-chat-popup .bl-status {
      font-size: 0.75rem;
      opacity: 0.85;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    #bl-chat-popup .bl-dot {
      width: 7px; height: 7px;
      background: #4ade80;
      border-radius: 50%;
      display: inline-block;
    }
    #bl-chat-popup .bl-close-btn {
      margin-left: auto;
      background: none;
      border: none;
      color: rgba(255,255,255,0.7);
      cursor: pointer;
      font-size: 0.85rem;
      padding: 0.25rem;
      border-radius: 4px;
      transition: color 0.2s;
      line-height: 1;
    }
    #bl-chat-popup .bl-close-btn:hover { color: #fff; }

    /* Messages */
    #bl-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      scroll-behavior: smooth;
      background: #f7f5f0;
    }
    #bl-chat-messages::-webkit-scrollbar { width: 4px; }
    #bl-chat-messages::-webkit-scrollbar-track { background: transparent; }
    #bl-chat-messages::-webkit-scrollbar-thumb { background: #e4e2da; border-radius: 2px; }

    .bl-msg {
      display: flex;
      flex-direction: column;
      max-width: 82%;
    }
    .bl-msg--user  { align-self: flex-end;  align-items: flex-end; }
    .bl-msg--bot   { align-self: flex-start; align-items: flex-start; }

    .bl-msg__bubble {
      padding: 0.7rem 1rem;
      border-radius: 18px;
      font-size: 0.88rem;
      line-height: 1.55;
      word-break: break-word;
    }
    .bl-msg--user .bl-msg__bubble {
      background: #2a5cff;
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .bl-msg--bot .bl-msg__bubble {
      background: #ffffff;
      color: #1a1a18;
      border: 1px solid #e4e2da;
      border-bottom-left-radius: 4px;
    }
    .bl-msg__time {
      font-size: 0.7rem;
      color: #6b6b60;
      margin-top: 0.3rem;
      padding: 0 0.25rem;
    }

    /* Typing indicator */
    .bl-typing .bl-msg__bubble {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 0.75rem 1rem;
    }
    .bl-typing-dot {
      width: 7px; height: 7px;
      background: #6b6b60;
      border-radius: 50%;
      animation: bl-bounce 1.2s ease-in-out infinite;
    }
    .bl-typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .bl-typing-dot:nth-child(3) { animation-delay: 0.4s; }

    /* Footer */
    #bl-chat-popup .bl-footer {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.85rem 1rem;
      border-top: 1px solid #e4e2da;
      background: #ffffff;
      flex-shrink: 0;
    }
    #bl-chat-input {
      flex: 1;
      border: 1px solid #e4e2da;
      border-radius: 100px;
      padding: 0.6rem 1rem;
      font-family: "DM Sans", sans-serif;
      font-size: 0.875rem;
      background: #f7f5f0;
      color: #1a1a18;
      outline: none;
      transition: border-color 0.2s;
    }
    #bl-chat-input:focus       { border-color: #2a5cff; }
    #bl-chat-input::placeholder { color: #6b6b60; }

    #bl-chat-send {
      width: 38px; height: 38px;
      background: #2a5cff;
      color: #fff;
      border: none;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.2s, transform 0.15s;
    }
    #bl-chat-send:hover              { background: #1a3fd4; transform: scale(1.05); }
    #bl-chat-send:disabled           { background: #c0c8f0; cursor: not-allowed; transform: none; }
    #bl-chat-input:disabled          { opacity: 0.6; }

    #bl-chat-popup .bl-disclaimer {
      font-size: 0.72rem;
      color: #6b6b60;
      padding: 0 1rem 0.85rem;
      background: #ffffff;
      line-height: 1.45;
    }

    @keyframes bl-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30%            { transform: translateY(-5px); }
    }

    @media (max-width: 480px) {
      #bl-chat-popup {
        position: fixed;
        width: calc(100vw - 1rem);
        height: calc(100vh - 6rem);
        max-height: none;
        right: 0.5rem;
        bottom: 4.5rem;
        border-radius: 12px;
      }
      #bl-chat-bubble {
        bottom: 1rem;
        right: 1rem;
      }
    }
  `;
  document.head.appendChild(style);

  // ─────────────────────────────────────────────
  // 3. HTML INJECTEREN
  // ─────────────────────────────────────────────
  const container = document.createElement("div");
  container.id = "bl-chat-root";
  container.innerHTML = `
    <button id="bl-chat-bubble" aria-label="Open chat">
      <span class="bl-icon-open">💬 Stel een vraag</span>
      <span class="bl-icon-close">✕</span>
    </button>

    <div id="bl-chat-popup" aria-hidden="true" role="dialog" aria-label="Chat">
      <div class="bl-header">
        <div class="bl-avatar">B</div>
        <div>
          <div class="bl-name">BoitenLuhrs</div>
          <div class="bl-status"><span class="bl-dot"></span> Online</div>
        </div>
        <button class="bl-close-btn" aria-label="Sluit chat">✕</button>
      </div>

      <div id="bl-chat-messages">
        <div class="bl-msg bl-msg--bot">
          <div class="bl-msg__bubble">Hallo! 👋 Hoe kan ik u vandaag helpen?</div>
          <div class="bl-msg__time">Nu</div>
        </div>
      </div>

      <div class="bl-footer">
        <input id="bl-chat-input" type="text" placeholder="Stel een vraag..." autocomplete="off" />
        <button id="bl-chat-send" aria-label="Verstuur">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>

      <p class="bl-disclaimer">Deze chat is informatief en geeft geen financieel advies.</p>
    </div>
  `;
  document.body.appendChild(container);

  // ─────────────────────────────────────────────
  // 4. FAQ LOADER  (uit chat-assistent.ts)
  // ─────────────────────────────────────────────
  interface FAQItem {
    vraag: string;
    antwoord: string;
  }

  class FAQLoader {
    private data: FAQItem[] | null = null;
    private readonly STOP_WORDS = new Set([
      "de",
      "het",
      "een",
      "van",
      "is",
      "wat",
      "hoe",
      "kan",
      "ik",
      "en",
      "op",
      "in",
      "te",
    ]);

    async load(): Promise<FAQItem[]> {
      if (this.data) return this.data;
      try {
        const res = await fetch(FAQ_URL);
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        this.data = json.faq ?? [];
      } catch {
        this.data = [];
      }
      return this.data!;
    }

    findAnswer(input: string): FAQItem | undefined {
      if (!this.data?.length) return undefined;
      const lower = input.toLowerCase();
      const MIN_SCORE = 0.3;
      let best: FAQItem | undefined;
      let bestScore = 0;

      for (const item of this.data) {
        const words = item.vraag
          .toLowerCase()
          .split(" ")
          .filter((w) => w.length > 2 && !this.STOP_WORDS.has(w));
        if (!words.length) continue;
        const score =
          words.filter((w) => lower.includes(w)).length / words.length;
        if (score > bestScore) {
          bestScore = score;
          best = item;
        }
      }
      return bestScore >= MIN_SCORE ? best : undefined;
    }
  }

  // ─────────────────────────────────────────────
  // 5. AI CLIENT  (uit chat-assistent.ts)
  // ─────────────────────────────────────────────
  class AIClient {
    private conversationId: number | null = null;

    async getResponse(message: string): Promise<string> {
      try {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            conversation_id: this.conversationId,
          }),
        });

        if (!res.ok) {
          let errMsg = `Server fout (${res.status})`;
          try {
            const e = await res.json();
            if (e?.error) errMsg = e.error;
          } catch {}
          throw new Error(errMsg);
        }

        const data = await res.json();
        if (data.conversation_id) this.conversationId = data.conversation_id;
        return data.reply ?? "Sorry, ik kon geen antwoord vinden.";
      } catch (err) {
        if (err instanceof TypeError) {
          return "De chatserver is momenteel niet bereikbaar. Probeer het later opnieuw.";
        }
        return `Sorry, ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  }

  // ─────────────────────────────────────────────
  // 6. CHAT ASSISTENT  (combineert FAQ + AI)
  // ─────────────────────────────────────────────
  class ChatAssistant {
    private faq = new FAQLoader();
    private ai = new AIClient();

    private delay(): Promise<void> {
      return new Promise((r) =>
        setTimeout(r, Math.floor(Math.random() * 1200) + 800),
      );
    }

    async getResponse(input: string): Promise<string> {
      await this.faq.load();
      const match = this.faq.findAnswer(input);
      if (match) {
        await this.delay();
        return match.antwoord;
      }
      return this.ai.getResponse(input);
    }
  }

  // ─────────────────────────────────────────────
  // 7. UI LOGICA  (uit chat-ui.ts)
  // ─────────────────────────────────────────────
  const bubble = document.getElementById("bl-chat-bubble")!;
  const popup = document.getElementById("bl-chat-popup")!;
  const messages = document.getElementById("bl-chat-messages")!;
  const input = document.getElementById("bl-chat-input") as HTMLInputElement;
  const sendBtn = document.getElementById("bl-chat-send") as HTMLButtonElement;
  const closeBtn = popup.querySelector<HTMLButtonElement>(".bl-close-btn")!;

  const assistant = new ChatAssistant();

  function getTime(): string {
    return new Date().toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function addMessage(text: string, role: "user" | "bot"): void {
    const wrapper = document.createElement("div");
    wrapper.className = `bl-msg bl-msg--${role}`;

    const b = document.createElement("div");
    b.className = "bl-msg__bubble";
    b.textContent = text;

    const t = document.createElement("div");
    t.className = "bl-msg__time";
    t.textContent = getTime();

    wrapper.appendChild(b);
    wrapper.appendChild(t);
    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;
  }

  function showTyping(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "bl-msg bl-msg--bot bl-typing";
    const b = document.createElement("div");
    b.className = "bl-msg__bubble";
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("span");
      dot.className = "bl-typing-dot";
      b.appendChild(dot);
    }
    wrapper.appendChild(b);
    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;
    return wrapper;
  }

  function open(): void {
    popup.classList.add("is-open");
    popup.setAttribute("aria-hidden", "false");
    bubble.classList.add("is-open");
    input.focus();
  }

  function close(): void {
    popup.classList.remove("is-open");
    popup.setAttribute("aria-hidden", "true");
    bubble.classList.remove("is-open");
  }

  async function handleSend(): Promise<void> {
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    input.disabled = true;
    sendBtn.disabled = true;

    addMessage(text, "user");
    const typing = showTyping();
    const reply = await assistant.getResponse(text);
    typing.remove();
    addMessage(reply, "bot");

    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  }

  bubble.addEventListener("click", () =>
    popup.classList.contains("is-open") ? close() : open(),
  );
  closeBtn.addEventListener("click", close);
  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
})();
