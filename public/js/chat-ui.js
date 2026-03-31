class ChatUI {
  constructor(assistantInstance) {
    this.assistant = assistantInstance;

    this.bubble = document.getElementById("chatBubble");
    this.popup = document.getElementById("chatPopup");
    this.messages = document.getElementById("chatMessages");
    this.input = document.getElementById("chatInput");
    this.sendBtn = document.getElementById("chatSend");
    this.closeBtn = document.getElementById("chatClose");

    this._bindEvents();
  }

  _bindEvents() {
    this.bubble.addEventListener("click", () => this.toggle());
    this.closeBtn.addEventListener("click", () => this.close());
    this.sendBtn.addEventListener("click", () => this._handleSend());

    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this._handleSend();
      }
    });
  }

  toggle() {
    this.popup.classList.contains("is-open") ? this.close() : this.open();
  }

  open() {
    this.popup.classList.add("is-open");
    this.popup.setAttribute("aria-hidden", "false");
    this.bubble.classList.add("is-open");
    this.input.focus();
  }

  close() {
    this.popup.classList.remove("is-open");
    this.popup.setAttribute("aria-hidden", "true");
    this.bubble.classList.remove("is-open");
  }

  _getTime() {
    return new Date().toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  _addMessage(text, sender = "bot") {
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

  _showTyping() {
    const wrapper = document.createElement("div");
    wrapper.classList.add(
      "chat-message",
      "chat-message--bot",
      "typing-indicator",
    );

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

  _scrollToBottom() {
    this.messages.scrollTop = this.messages.scrollHeight;
  }

  async _handleSend() {
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

// Opstarten zodra de pagina geladen is
document.addEventListener("DOMContentLoaded", () => {
  try {
    const assistant = new ChatAssistant("/faq.json");
    const ui = new ChatUI(assistant);
    window._chatUI = ui;
  } catch (error) {
    console.error("Chat kon niet opstarten:", error);
  }
});
