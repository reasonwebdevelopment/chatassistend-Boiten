const form = document.querySelector("form");
const usernameInput = document.querySelector(
  "#username",
) as HTMLInputElement | null;
const passwordInput = document.querySelector(
  "#password",
) as HTMLInputElement | null;

if (form && usernameInput && passwordInput) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    try {
      const apiBase =
        location.port === "5173"
          ? `${location.protocol}//${location.hostname}:3000`
          : "";
      const res = await fetch(`${apiBase}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        window.location.href = "./overzicht.html";
        return;
      }

      const data = await res.json().catch(() => ({ error: "Onbekende fout" }));
      console.error("Login failed", res.status, data);
      alert(data.error ?? "Inloggen mislukt");
    } catch (err) {
      alert("Kan geen verbinding maken met de server.");
      console.error(err);
    }
  });
}

// Toggle wachtwoord bekijken
const toggleBtn = document.querySelector(
  ".toggle-password",
) as HTMLButtonElement | null;
if (toggleBtn && passwordInput) {
  toggleBtn.addEventListener("click", () => {
    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      toggleBtn.setAttribute("aria-label", "Verberg wachtwoord");
      toggleBtn.textContent = "🙈";
    } else {
      passwordInput.type = "password";
      toggleBtn.setAttribute("aria-label", "Toon wachtwoord");
      toggleBtn.textContent = "👁️";
    }
  });
}
