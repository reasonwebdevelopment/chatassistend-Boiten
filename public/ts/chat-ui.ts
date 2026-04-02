type MessageSender = "bot" | "user";

type ChatAssistantInstance = InstanceType<Window["ChatAssistant"]>;

class ChatUI {
  private readonly assistant: ChatAssistantInstance;

  private readonly bubble: HTMLElement;
  private readonly popup: HTMLElement;
  private readonly messages: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly sendBtn: HTMLButtonElement;
  private readonly closeBtn: HTMLButtonElement;

  constructor(assistantInstance: ChatAssistantInstance) {
    this.assistant = assistantInstance;

    this.bubble = ChatUI._requireElement("chatBubble");
    this.popup = ChatUI._requireElement("chatPopup");
    this.messages = ChatUI._requireElement("chatMessages");
    this.input = ChatUI._requireElement<HTMLInputElement>("chatInput");
    this.sendBtn = ChatUI._requireElement<HTMLButtonElement>("chatSend");
    this.closeBtn = ChatUI._requireElement<HTMLButtonElement>("chatClose");

    this._bindEvents();
  }

  private static _requireElement<T extends HTMLElement = HTMLElement>(
    id: string,
  ): T {
    const el = document.getElementById(id) as T | null;
    if (!el) throw new Error(`Vereist element #${id} niet gevonden in de DOM`);
    return el;
  }

  private _bindEvents(): void {
    this.bubble.addEventListener("click", () => this.toggle());
    this.closeBtn.addEventListener("click", () => this.close());
    this.sendBtn.addEventListener("click", () => this._handleSend());

    this.input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this._handleSend();
      }
    });
  }

  toggle(): void {
    this.popup.classList.contains("is-open") ? this.close() : this.open();
  }

  open(): void {
    this.popup.classList.add("is-open");
    this.popup.setAttribute("aria-hidden", "false");
    this.bubble.classList.add("is-open");
    this.input.focus();
  }

  close(): void {
    this.popup.classList.remove("is-open");
    this.popup.setAttribute("aria-hidden", "true");
    this.bubble.classList.remove("is-open");
  }

  private _getTime(): string {
    return new Date().toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  private _addMessage(text: string, sender: MessageSender = "bot"): HTMLDivElement {
    const wrapper = document.createElement("div");
    wrapper.classList.add("chat-message", `chat-message--${sender}`);

    const bubble = document.createElement("div");
    bubble.classList.add("chat-message__bubble");
    bubble.textContent = text;

    const time = document.createElement("div");
    time.classList.add("chat-message__time");
    time.textContent = this._getTime();

    wrapper.appendChild(bubble);
    wrapper.appendChild(time);
    this.messages.appendChild(wrapper);
    this._scrollToBottom();

    return wrapper;
  }

  private _showTyping(): HTMLDivElement {
    const wrapper = document.createElement("div");
    wrapper.classList.add("chat-message", "chat-message--bot", "typing-indicator");

    const bubble = document.createElement("div");
    bubble.classList.add("chat-message__bubble");

    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("span");
      dot.classList.add("typing-dot");
      bubble.appendChild(dot);
    }

    wrapper.appendChild(bubble);
    this.messages.appendChild(wrapper);
    this._scrollToBottom();

    return wrapper;
  }

  private _scrollToBottom(): void {
    this.messages.scrollTop = this.messages.scrollHeight;
  }

  private async _handleSend(): Promise<void> {
    const text = this.input.value.trim();
    if (!text) return;

    this.input.value = "";
    this.input.disabled = true;
    this.sendBtn.disabled = true;

    this._addMessage(text, "user");

    const typingEl = this._showTyping();
    const reply = await this.assistant.getResponse(text);
    typingEl.remove();

    this._addMessage(reply, "bot");

    this.input.disabled = false;
    this.sendBtn.disabled = false;
    this.input.focus();
  }
}

declare global {
  interface Window {
    _chatUI: ChatUI;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    const assistant = new window.ChatAssistant("/faq.json");
    window._chatUI = new ChatUI(assistant);
  } catch (error) {
    console.error("Chat kon niet opstarten:", error);
  }
});

export {};