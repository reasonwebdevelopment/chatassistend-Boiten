const themeToggle = document.getElementById(
  "theme-toggle",
) as HTMLButtonElement;
const statChats = document.getElementById("stat-chats")!;
const statMsgs = document.getElementById("stat-msgs")!;
const statCost = document.getElementById("stat-cost")!;
const refreshBtn = document.getElementById("refresh-btn") as HTMLButtonElement;

const themeStorageKey = "dashboard-theme";
const sunIcon = "☀️";
const moonIcon = "🌙";

interface Conversation {
  id: number;
  created_at: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  const stored = window.localStorage.getItem(themeStorageKey);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function applyTheme(theme: Theme): void {
  document.body.dataset.theme = theme;
  themeToggle.textContent = theme === "light" ? moonIcon : sunIcon;
  const label =
    theme === "light" ? "Schakel naar nachtmodus" : "Schakel naar dagmodus";
  themeToggle.title = label;
  themeToggle.setAttribute("aria-label", label);
  themeToggle.setAttribute("aria-pressed", String(theme === "light"));
  window.localStorage.setItem(themeStorageKey, theme);
}

function setShimmer(): void {
  statChats.innerHTML = '<span class="shimmer"></span>';
  statMsgs.innerHTML = '<span class="shimmer"></span>';
  statCost.innerHTML = '<span class="shimmer"></span>';
}

function setError(): void {
  statChats.innerHTML = '<span class="error-msg">—</span>';
  statMsgs.innerHTML = '<span class="error-msg">—</span>';
  statCost.innerHTML = '<span class="error-msg">—</span>';
}

async function loadStats(): Promise<void> {
  setShimmer();

  try {
    const res = await fetch("/api/conversations");
    if (!res.ok) throw new Error(`API fout: ${res.status}`);

    const conversations: Conversation[] = await res.json();
    statChats.textContent = conversations.length.toLocaleString("nl-NL");

    const counts = await Promise.all(
      conversations.map(async (conv) => {
        try {
          const r = await fetch(`/api/messages/${conv.id}`);
          const msgs: Message[] = await r.json();
          return Array.isArray(msgs) ? msgs.length : 0;
        } catch {
          return 0;
        }
      }),
    );

    const total = counts.reduce((acc, n) => acc + n, 0);
    statMsgs.textContent = total.toLocaleString("nl-NL");

    const usageRes = await fetch("/api/usage");
    if (!usageRes.ok) throw new Error(`API fout: ${usageRes.status}`);

    const usage: { cost?: number } = await usageRes.json();
    const formattedCost = (usage.cost ?? 0).toLocaleString("nl-NL", {
      style: "currency",
      currency: "EUR",
    });
    statCost.textContent = formattedCost;
  } catch (err) {
    console.error("Stats konden niet worden geladen:", err);
    setError();
  }
}

themeToggle.addEventListener("click", () => {
  const next: Theme =
    document.body.dataset.theme === "light" ? "dark" : "light";
  applyTheme(next);
});

refreshBtn.addEventListener("click", loadStats);

applyTheme(getInitialTheme());
loadStats();

export {};
