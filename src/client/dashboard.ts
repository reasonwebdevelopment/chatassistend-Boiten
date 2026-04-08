const conversationsDiv = document.getElementById("conversations")!;
const messagesList = document.getElementById("messages-list")!;
const messagesHeader = document.querySelector("#messages h3")!;

interface Conversation {
  id: number;
  created_at: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadConversations() {
  const res = await fetch("/api/conversations");
  const data: Conversation[] = await res.json();

  data.forEach((conv, i) => {
    const div = document.createElement("div");
    div.className = "conv-item";
    div.style.animationDelay = `${i * 40}ms`;
    div.innerHTML = `
      <span class="conv-title">#${conv.id}</span>
      <span class="conv-date">${formatDate(conv.created_at)}</span>
    `;
    div.addEventListener("click", () => {
      document
        .querySelectorAll(".conv-item")
        .forEach((el) => el.classList.remove("active"));
      div.classList.add("active");
      loadMessages(conv.id);
    });
    conversationsDiv.appendChild(div);
  });
}

async function loadMessages(convId: number) {
  messagesHeader.textContent = `Gesprek #${convId}`;
  messagesList.innerHTML = "";

  const res = await fetch(`/api/messages/${convId}`);
  const data: Message[] = await res.json();

  if (data.length === 0) {
    messagesList.innerHTML = `<div class="empty-state"><p>Geen berichten gevonden.</p></div>`;
    return;
  }

  data.forEach((msg, i) => {
    const div = document.createElement("div");
    div.className = `message ${msg.role}`;
    div.style.animationDelay = `${i * 30}ms`;
    div.innerHTML = `
      <span class="role-label">${msg.role === "user" ? "Gebruiker" : "Assistent"}</span>
      <div class="bubble">${msg.content}</div>
    `;
    messagesList.appendChild(div);
  });
}

loadConversations();
