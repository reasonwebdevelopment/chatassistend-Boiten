const conversationsDiv = document.getElementById("conversations")!;
const messagesDiv = document.getElementById("messages")!;

interface Conversation {
  id: number;
  created_at: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Gesprekken ophalen
async function loadConversations() {
  const res = await fetch("/conversations");
  const data: Conversation[] = await res.json();

  data.forEach((conv) => {
    const div = document.createElement("div");
    div.textContent = `Gesprek #${conv.id}`;
    div.addEventListener("click", () => loadMessages(conv.id));
    conversationsDiv.appendChild(div);
  });
}

// Berichten van een gesprek ophalen
async function loadMessages(convId: number) {
  const res = await fetch(`/messages/${convId}`);
  const data: Message[] = await res.json();

  messagesDiv.innerHTML = "<h3>Berichten</h3>"; // reset
  data.forEach((msg) => {
    const div = document.createElement("div");
    div.className = `message ${msg.role}`;
    div.textContent = `${msg.role}: ${msg.content}`;
    messagesDiv.appendChild(div);
  });
}

// Initialiseren
loadConversations();
