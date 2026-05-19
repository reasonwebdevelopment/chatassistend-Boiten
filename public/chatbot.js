(function () {
  if (window.__boitenluhrsChat) return;
  window.__boitenluhrsChat = !0;
  const DEFAULT_API_BASE = `https://boitenchat-355e0694e40b.herokuapp.com`;
  function e() {
    // Prefer document.currentScript when available
    let script = document.currentScript;
    if (!script) {
      // Fallback: prefer a script tag that explicitly sets data-api-base,
      // otherwise try to find the script by filename.
      script =
        Array.from(document.querySelectorAll("script[src]")).find((s) =>
          s.getAttribute("data-api-base"),
        ) ||
        Array.from(document.querySelectorAll("script[src]")).find(
          (s) => s.src && s.src.includes("chatbot.js"),
        );
    }
    if (!script) return DEFAULT_API_BASE;

    // If the embed provides a data-api-base attribute, use it.
    let apiBase = script.getAttribute("data-api-base")?.trim();
    if (apiBase) return apiBase.replace(/\/$/, "");

    // Allow passing the API base via a query param on the script src, e.g.
    try {
      let src = script.src || "";
      if (src) {
        let url = new URL(src, document.baseURI);
        let param =
          url.searchParams.get("api_base") || url.searchParams.get("api-base");
        if (param) return param.replace(/\/$/, "");
        return url.origin || DEFAULT_API_BASE;
      }
    } catch (err) {}

    return DEFAULT_API_BASE;
  }
  let t = `${e()}/faq.json`,
    n = document.createElement(`style`);
  ((n.textContent = `
    @import url("https://fonts.googleapis.com/css2?family=Biryani:wght@300;400;500;600;700&display=swap");

    #bl-chat-root,
    #bl-chat-root * {
      font-family: "Biryani", sans-serif;
      box-sizing: border-box;
    }

    /* Chat Bubble */
    #bl-chat-bubble {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      min-width: 58px;
      height: 58px;
      padding: 0 1rem;
      background: #533a92;
      color: #fff;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 1000;
      box-shadow: 0 4px 20px rgba(83, 58, 146, 0.4);
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s;
      user-select: none;
      border: none;
    }

    #bl-chat-bubble:hover {
      transform: scale(1.1);
      box-shadow: 0 8px 30px rgba(83, 58, 146, 0.5);
    }

    #bl-chat-bubble .bl-icon-open {
      position: absolute;
      transition: opacity 0.2s, transform 0.2s;
      font-size: 0.82rem;
      font-weight: 500;
      letter-spacing: 0.01em;
      white-space: nowrap;
    }

    #bl-chat-bubble .bl-icon-close {
      position: absolute;
      opacity: 0;
      transform: rotate(-90deg);
      transition: opacity 0.2s, transform 0.2s;
      font-style: normal;
      font-size: 1.1rem;
    }

    #bl-chat-bubble.is-open .bl-icon-open {
      opacity: 0;
      transform: rotate(90deg);
    }

    #bl-chat-bubble.is-open .bl-icon-close {
      opacity: 1;
      transform: rotate(0deg);
    }

    /* Chat Popup */
    #bl-chat-popup {
      position: fixed;
      bottom: 5.5rem;
      right: 2rem;
      width: 440px;
      max-height: 700px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.14);
      border: 1px solid #e4e2da;
      display: flex;
      flex-direction: column;
      z-index: 999;
      overflow: hidden;
      opacity: 0;
      transform: translateY(20px) scale(0.96);
      transform-origin: bottom right;
      pointer-events: none;
      transition: opacity 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
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
      background: #533a92;
      color: #fff;
    }

    #bl-chat-popup .bl-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: "Biryani", sans-serif;
      font-size: 1.1rem;
      flex-shrink: 0;
    }

    #bl-chat-popup .bl-name {
      font-weight: 500;
      font-size: 0.9rem;
    }

    #bl-chat-popup .bl-status {
      font-size: 0.75rem;
      opacity: 0.85;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    #bl-chat-popup .bl-dot {
      width: 7px;
      height: 7px;
      background: #4ade80;
      border-radius: 50%;
      display: inline-block;
    }

    #bl-chat-popup .bl-close-btn {
      margin-left: auto;
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.7);
      cursor: pointer;
      font-size: 0.85rem;
      padding: 0.25rem;
      border-radius: 4px;
      transition: color 0.2s;
      line-height: 1;
    }

    #bl-chat-popup .bl-close-btn:hover {
      color: #fff;
    }

    /* Messages */
    #bl-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      scroll-behavior: smooth;
      background: #ffffff;
    }

    #bl-chat-messages::-webkit-scrollbar {
      width: 4px;
    }

    #bl-chat-messages::-webkit-scrollbar-track {
      background: transparent;
    }

    #bl-chat-messages::-webkit-scrollbar-thumb {
      background: #e4e2da;
      border-radius: 2px;
    }

    .bl-msg {
      display: flex;
      flex-direction: column;
      max-width: 80%;
    }

    .bl-msg--user {
      align-self: flex-end;
      align-items: flex-end;
    }

    .bl-msg--bot {
      align-self: flex-start;
      align-items: flex-start;
    }

    .bl-msg__bubble {
      padding: 0.7rem 1rem;
      border-radius: 18px;
      font-size: 0.88rem;
      line-height: 1.55;
      word-break: break-word;
    }

    .bl-msg__bubble strong {
      font-weight: 600;
      color: inherit;
    }

    .bl-msg__bubble em {
      font-style: italic;
      color: inherit;
    }

    .bl-msg__bubble a {
      color: #00a0d0;
      text-decoration: underline;
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .bl-msg__bubble a:hover {
      opacity: 0.8;
    }

    .bl-msg__bubble p {
      margin: 0.5rem 0;
    }

    .bl-msg__bubble p:first-child {
      margin-top: 0;
    }

    .bl-msg__bubble p:last-child {
      margin-bottom: 0;
    }

    .bl-msg__bubble ul,
    .bl-msg__bubble ol {
      margin: 0.5rem 0;
      padding-left: 1.5rem;
    }

    .bl-msg__bubble li {
      margin: 0.25rem 0;
    }

    .bl-msg__bubble code {
      background: rgba(0, 0, 0, 0.1);
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
      font-family: "Courier New", monospace;
      font-size: 0.85em;
    }

    .bl-msg__bubble pre {
      background: rgba(0, 0, 0, 0.1);
      padding: 0.75rem;
      border-radius: 6px;
      overflow-x: auto;
      margin: 0.5rem 0;
    }

    .bl-msg__bubble pre code {
      background: none;
      padding: 0;
    }

    .bl-msg__bubble blockquote {
      border-left: 3px solid #00a0d0;
      padding-left: 0.75rem;
      margin: 0.5rem 0;
      font-style: italic;
      opacity: 0.8;
    }

    .bl-msg--user .bl-msg__bubble {
      background: #533a92;
      color: #fff;
      border-bottom-right-radius: 4px;
    }

    .bl-msg--user .bl-msg__bubble a {
      color: #fff;
      text-decoration: underline;
      opacity: 0.9;
    }

    .bl-msg--bot .bl-msg__bubble {
      background: #f7f5f0;
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

    /* Typing Indicator */
    .bl-typing .bl-msg__bubble {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 0.75rem 1rem;
    }

    .bl-typing-dot {
      width: 7px;
      height: 7px;
      background: #6b6b60;
      border-radius: 50%;
      animation: typingBounce 1.2s ease-in-out infinite;
    }

    .bl-typing-dot:nth-child(2) {
      animation-delay: 0.2s;
    }

    .bl-typing-dot:nth-child(3) {
      animation-delay: 0.4s;
    }

    /* Quick Questions */
    .chat-popup__quick-questions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.6rem;
      padding: 1rem;
      border-top: 1px solid rgba(228, 226, 218, 0.7);
      align-items: stretch;
    }

    .chat-popup__quick-questions.is-hidden {
      display: none;
    }

    .chat-popup__quick-question {
      appearance: none;
      border: 1px solid rgba(26, 26, 24, 0.12);
      background: linear-gradient(180deg, rgba(83, 58, 146, 0.06), rgba(83, 58, 146, 0.03));
      color: #1a3fd4;
      border-radius: 999px;
      padding: 0.45rem 0.9rem;
      font-family: "Biryani", sans-serif;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.15s, background 0.2s, border-color 0.2s, opacity 0.2s;
      width: 100%;
      text-align: center;
      height: 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 18px rgba(83, 58, 146, 0.06);
      border: 1px solid rgba(83, 58, 146, 0.12);
    }

    .chat-popup__quick-question:hover:not(:disabled) {
      background: linear-gradient(180deg, rgba(83, 58, 146, 0.1), rgba(83, 58, 146, 0.04));
      border-color: rgba(83, 58, 146, 0.22);
      transform: translateY(-2px);
    }

    .chat-popup__quick-question:disabled {
      cursor: wait;
      opacity: 0.65;
    }

    .is-hidden {
      display: none !important;
    }

    /* Footer */
    #bl-chat-popup .bl-footer {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.85rem 1rem;
      border-top: 1px solid #e4e2da;
    }

    #bl-chat-input {
      flex: 1;
      border: 1px solid #e4e2da;
      border-radius: 100px;
      padding: 0.6rem 1rem;
      font-family: "Biryani", sans-serif;
      font-size: 0.875rem;
      background: #f7f5f0;
      color: #1a1a18;
      outline: none;
      transition: border-color 0.2s;
    }

    #bl-chat-input:focus {
      border-color: #533a92;
    }

    #bl-chat-input::placeholder {
      color: #6b6b60;
    }

    #bl-chat-send {
      width: 38px;
      height: 38px;
      background: #533a92;
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

    #bl-chat-send:hover {
      background: #3f2b70;
      transform: scale(1.05);
    }

    #bl-chat-send:disabled {
      background: #b5a9d3;
      cursor: not-allowed;
      transform: none;
    }

    #bl-chat-input:disabled {
      opacity: 0.6;
    }

    #bl-chat-popup .bl-disclaimer {
      font-size: 0.72rem;
      line-height: 1.45;
      color: #6b6b60;
      padding: 0 1rem 0.85rem;
    }

    /* Animations */
    @keyframes typingBounce {
      0%, 60%, 100% {
        transform: translateY(0);
      }
      30% {
        transform: translateY(-5px);
      }
    }

    @media (max-width: 768px) {
      #bl-chat-popup {
        width: calc(100vw - 1rem);
        height: calc(100vh - 6rem);
        max-height: none;
        right: 0.5rem;
        bottom: 4.5rem;
      }

      .chat-popup__quick-question {
        font-size: 0.82rem;
        height: 36px;
        padding: 0 0.8rem;
      }

      .bl-msg {
        max-width: 90%;
      }

      .bl-msg__bubble {
        font-size: 0.85rem;
        padding: 0.6rem 0.9rem;
        margin-bottom: 0.25rem;
      }

      #bl-chat-input {
        font-size: 0.8rem;
        padding: 0.5rem 0.9rem;
      }

      #bl-chat-send {
        width: 34px;
        height: 34px;
      }
    }

    @media (max-width: 480px) {
      #bl-chat-bubble {
        bottom: 1rem;
        right: 1rem;
        width: 50px;
        height: 50px;
        font-size: 0.75rem;
      }

      #bl-chat-popup {
        position: fixed;
        width: calc(100vw - 1rem);
        height: calc(100vh - 6rem);
        max-height: none;
        right: 0.5rem;
        bottom: 4.5rem;
        border-radius: 12px;
      }
    }
  `),
    document.head.appendChild(n));
  let r = document.createElement(`div`);
  ((r.id = `bl-chat-root`),
    (r.innerHTML = `
    <button id="bl-chat-bubble" aria-label="Open chat">
      <span class="bl-icon-open">💬</span>
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
          <div class="bl-msg__bubble">Hallo, ik ben de BetaalCoach van BoitenLuhrs. Ik help met algemene vragen over betalingen, brieven, betalingsregelingen, de dienstverlening en het incasso- en deurwaarderstraject. Ik heb geen toegang tot persoonlijke dossiers of actuele betaalgegevens.</div>
          <div class="bl-msg__time">Nu</div>
        </div>
      </div>

        <div class="chat-popup__quick-questions" aria-label="Veel gestelde vragen">
          <button type="button" class="chat-popup__quick-question" data-question="Hoe kan ik contact opnemen met BoitenLuhrs?">contact opnemen?</button>
          <button type="button" class="chat-popup__quick-question" data-question="Ik wil graag uitstel aanvragen?">uitstel aanvragen?</button>
          <button type="button" class="chat-popup__quick-question" data-question="Wat gebeurt er als ik niet betaal?">niet betalen?</button>
          <button type="button" class="chat-popup__quick-question" data-question="Hoe vraag ik een betalingsregeling aan?">regeling?</button>
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
  `),
    document.body.appendChild(r));
  class i {
    data = null;
    STOP_WORDS = new Set([
      `de`,
      `het`,
      `een`,
      `van`,
      `is`,
      `wat`,
      `hoe`,
      `kan`,
      `ik`,
      `en`,
      `op`,
      `in`,
      `te`,
    ]);
    // Tokenize using Unicode-aware word characters (letters/numbers)
    _tokenize(text) {
      if (typeof text !== "string") return [];
      try {
        return (
          text
            .toLowerCase()
            .trim()
            .match(/[\p{L}\p{N}]+/gu) || []
        );
      } catch (err) {
        // Fallback for environments without unicode regex support
        return text
          .toLowerCase()
          .trim()
          .split(/[^a-z0-9]+/i)
          .filter(Boolean);
      }
    }
    async load() {
      if (this.data) return this.data;
      try {
        let res = await fetch(t);
        if (!res.ok) throw Error(`${res.status}`);
        const json = await res.json();
        this.data = (json.faq || []).filter(
          (it) =>
            it &&
            typeof it.vraag === "string" &&
            typeof it.antwoord === "string",
        );
      } catch (err) {
        this.data = [];
      }
      return this.data;
    }
    findAnswer(input) {
      if (!this.data || this.data.length === 0) return;
      const inputTokens = this._tokenize(input);
      const inputText = inputTokens.join(" ");

      // Avoid false positives for very long inputs
      if (inputText.length > 140) return;

      const inputSet = new Set(inputTokens);

      let best = undefined;
      let bestScore = 0;
      let bestOverlap = 0;

      for (const item of this.data) {
        const words = this._tokenize(item.vraag).filter(
          (w) => w.length > 2 && !this.STOP_WORDS.has(w),
        );
        if (words.length === 0) continue;

        const overlapCount = words.reduce(
          (n, w) => n + (inputSet.has(w) ? 1 : 0),
          0,
        );
        const score = overlapCount / words.length;

        if (score > bestScore) {
          bestScore = score;
          best = item;
          bestOverlap = overlapCount;
        }
      }

      if (!best) return;

      const isSingleToken = inputTokens.length === 1;
      const strongSingleToken = isSingleToken && bestOverlap >= 1;

      // Slightly stricter threshold than before to reduce false positives
      return bestScore >= 0.45 && (bestOverlap >= 2 || strongSingleToken)
        ? best
        : undefined;
    }
  }
  class a {
    conversationId = null;
    async getResponse(t) {
      try {
        let n = await fetch(`${e()}/api/chat`, {
          method: `POST`,
          headers: { "Content-Type": `application/json` },
          body: JSON.stringify({
            message: t,
            conversation_id: this.conversationId,
          }),
        });
        if (!n.ok) {
          let e = `Server fout (${n.status})`;
          try {
            let r = await n.json();
            r?.error && (e = r.error);
          } catch {}
          throw Error(e);
        }
        let r = await n.json();
        return (
          r.conversation_id && (this.conversationId = r.conversation_id),
          r.reply ?? `Sorry, ik kon geen antwoord vinden.`
        );
      } catch (e) {
        return e instanceof TypeError
          ? `De chatserver is momenteel niet bereikbaar. Probeer het later opnieuw.`
          : `Sorry, ${e instanceof Error ? e.message : String(e)}`;
      }
    }
  }
  class o {
    faq = new i();
    ai = new a();
    delay() {
      return new Promise((e) =>
        setTimeout(e, Math.floor(Math.random() * 1200) + 800),
      );
    }
    async getResponse(e) {
      await this.faq.load();
      let t = this.faq.findAnswer(e);
      return t ? (await this.delay(), t.antwoord) : this.ai.getResponse(e);
    }
  }
  let s = document.getElementById(`bl-chat-bubble`),
    c = document.getElementById(`bl-chat-popup`),
    l = document.getElementById(`bl-chat-messages`),
    u = document.getElementById(`bl-chat-input`),
    d = document.getElementById(`bl-chat-send`),
    f = c.querySelector(`.bl-close-btn`),
    p = new o();
  function m() {
    return new Date().toLocaleTimeString(`nl-NL`, {
      hour: `2-digit`,
      minute: `2-digit`,
    });
  }
  function h(e, t) {
    let n = document.createElement(`div`);
    n.className = `bl-msg bl-msg--${t}`;
    let r = document.createElement(`div`);
    r.className = `bl-msg__bubble`;
    if (t === `bot`) {
      // If marked is available, render markdown; otherwise use textContent
      try {
        if (window.marked && typeof window.marked.parse === "function") {
          r.innerHTML = window.marked.parse(e);
        } else {
          r.textContent = e;
        }
      } catch (err) {
        r.textContent = e;
      }
    } else {
      r.textContent = e;
    }
    let i = document.createElement(`div`);
    ((i.className = `bl-msg__time`),
      (i.textContent = m()),
      n.appendChild(r),
      n.appendChild(i),
      l.appendChild(n),
      (l.scrollTop = l.scrollHeight));
  }

  // Add quick-question behavior and load marked for markdown rendering
  (function setupExtras() {
    // Load marked from CDN (optional) for markdown rendering in bot replies
    try {
      if (!window.marked) {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
        s.crossOrigin = "";
        s.onload = () => {
          /* marked loaded */
        };
        document.head.appendChild(s);
      }
    } catch (e) {}

    // Quick question buttons
    const quickWrap = document.querySelector(".chat-popup__quick-questions");
    const quickBtns = Array.from(
      document.querySelectorAll(".chat-popup__quick-question"),
    );
    quickBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        // hide quick questions
        if (quickWrap) {
          quickWrap.classList.add("is-hidden");
          quickWrap.setAttribute("aria-hidden", "true");
        }
        // send the question
        const q = btn.getAttribute("data-question") || btn.textContent || "";
        u.value = q;
        y();
      });
    });

    // Hide quick questions when user types their own question
    u.addEventListener("input", () => {
      if (!quickWrap) return;
      if (u.value.trim().length > 0) {
        quickWrap.classList.add("is-hidden");
        quickWrap.setAttribute("aria-hidden", "true");
      }
    });
  })();
  function g() {
    let e = document.createElement(`div`);
    e.className = `bl-msg bl-msg--bot bl-typing`;
    let t = document.createElement(`div`);
    t.className = `bl-msg__bubble`;
    for (let e = 0; e < 3; e++) {
      let e = document.createElement(`span`);
      ((e.className = `bl-typing-dot`), t.appendChild(e));
    }
    return (
      e.appendChild(t),
      l.appendChild(e),
      (l.scrollTop = l.scrollHeight),
      e
    );
  }
  function _() {
    (c.classList.add(`is-open`),
      c.setAttribute(`aria-hidden`, `false`),
      s.classList.add(`is-open`),
      u.focus());
  }
  function v() {
    (c.classList.remove(`is-open`),
      c.setAttribute(`aria-hidden`, `true`),
      s.classList.remove(`is-open`));
  }
  async function y() {
    let e = u.value.trim();
    if (!e) return;
    ((u.value = ``), (u.disabled = !0), (d.disabled = !0), h(e, `user`));
    let t = g(),
      n = await p.getResponse(e);
    (t.remove(), h(n, `bot`), (u.disabled = !1), (d.disabled = !1), u.focus());
  }
  (s.addEventListener(`click`, () =>
    c.classList.contains(`is-open`) ? v() : _(),
  ),
    f.addEventListener(`click`, v),
    d.addEventListener(`click`, y),
    u.addEventListener(`keydown`, (e) => {
      e.key === `Enter` && !e.shiftKey && (e.preventDefault(), y());
    }));
})();
