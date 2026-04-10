(function () {
  if (window.__boitenluhrsChat) return;
  window.__boitenluhrsChat = !0;
  function e() {
    let e = document.querySelectorAll(`script[src]`);
    for (let t of Array.from(e))
      if (t.src.includes(`chatbot.js`)) {
        let e = new URL(t.src);
        return `${e.protocol}//${e.host}`;
      }
    return `http://localhost:3000`;
  }
  let t = e(),
    n = `${t}/faq.json`,
    r = `${t}/api/chat`,
    i = document.createElement(`style`);
  ((i.textContent = `
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
  `),
    document.head.appendChild(i));
  let a = document.createElement(`div`);
  ((a.id = `bl-chat-root`),
    (a.innerHTML = `
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
  `),
    document.body.appendChild(a));
  class o {
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
    async load() {
      if (this.data) return this.data;
      try {
        let e = await fetch(n);
        if (!e.ok) throw Error(`${e.status}`);
        this.data = (await e.json()).faq ?? [];
      } catch {
        this.data = [];
      }
      return this.data;
    }
    findAnswer(e) {
      if (!this.data?.length) return;
      let t = e.toLowerCase(),
        n,
        r = 0;
      for (let e of this.data) {
        let i = e.vraag
          .toLowerCase()
          .split(` `)
          .filter((e) => e.length > 2 && !this.STOP_WORDS.has(e));
        if (!i.length) continue;
        let a = i.filter((e) => t.includes(e)).length / i.length;
        a > r && ((r = a), (n = e));
      }
      return r >= 0.3 ? n : void 0;
    }
  }
  class s {
    conversationId = null;
    async getResponse(e) {
      try {
        let t = await fetch(r, {
          method: `POST`,
          headers: { "Content-Type": `application/json` },
          body: JSON.stringify({
            message: e,
            conversation_id: this.conversationId,
          }),
        });
        if (!t.ok) {
          let e = `Server fout (${t.status})`;
          try {
            let n = await t.json();
            n?.error && (e = n.error);
          } catch {}
          throw Error(e);
        }
        let n = await t.json();
        return (
          n.conversation_id && (this.conversationId = n.conversation_id),
          n.reply ?? `Sorry, ik kon geen antwoord vinden.`
        );
      } catch (e) {
        return e instanceof TypeError
          ? `De chatserver is momenteel niet bereikbaar. Probeer het later opnieuw.`
          : `Sorry, ${e instanceof Error ? e.message : String(e)}`;
      }
    }
  }
  class c {
    faq = new o();
    ai = new s();
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
  let l = document.getElementById(`bl-chat-bubble`),
    u = document.getElementById(`bl-chat-popup`),
    d = document.getElementById(`bl-chat-messages`),
    f = document.getElementById(`bl-chat-input`),
    p = document.getElementById(`bl-chat-send`),
    m = u.querySelector(`.bl-close-btn`),
    h = new c();
  function g() {
    return new Date().toLocaleTimeString(`nl-NL`, {
      hour: `2-digit`,
      minute: `2-digit`,
    });
  }
  function _(e, t) {
    let n = document.createElement(`div`);
    n.className = `bl-msg bl-msg--${t}`;
    let r = document.createElement(`div`);
    ((r.className = `bl-msg__bubble`), (r.textContent = e));
    let i = document.createElement(`div`);
    ((i.className = `bl-msg__time`),
      (i.textContent = g()),
      n.appendChild(r),
      n.appendChild(i),
      d.appendChild(n),
      (d.scrollTop = d.scrollHeight));
  }
  function v() {
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
      d.appendChild(e),
      (d.scrollTop = d.scrollHeight),
      e
    );
  }
  function y() {
    (u.classList.add(`is-open`),
      u.setAttribute(`aria-hidden`, `false`),
      l.classList.add(`is-open`),
      f.focus());
  }
  function b() {
    (u.classList.remove(`is-open`),
      u.setAttribute(`aria-hidden`, `true`),
      l.classList.remove(`is-open`));
  }
  async function x() {
    let e = f.value.trim();
    if (!e) return;
    ((f.value = ``), (f.disabled = !0), (p.disabled = !0), _(e, `user`));
    let t = v(),
      n = await h.getResponse(e);
    (t.remove(), _(n, `bot`), (f.disabled = !1), (p.disabled = !1), f.focus());
  }
  (l.addEventListener(`click`, () =>
    u.classList.contains(`is-open`) ? b() : y(),
  ),
    m.addEventListener(`click`, b),
    p.addEventListener(`click`, x),
    f.addEventListener(`keydown`, (e) => {
      e.key === `Enter` && !e.shiftKey && (e.preventDefault(), x());
    }));
})();
