import "./modulepreload-polyfill-wMinxHhO.js";
var e = document.getElementById(`conversations`),
  t = document.getElementById(`messages-list`),
  n = document.querySelector(`#messages h3`),
  r = document.getElementById(`theme-toggle`),
  i = `dashboard-theme`,
  a = `☀️`,
  o = `🌙`;
function s() {
  let e = window.localStorage.getItem(i);
  return e === `light` || e === `dark`
    ? e
    : window.matchMedia(`(prefers-color-scheme: light)`).matches
      ? `light`
      : `dark`;
}
function c(e) {
  ((document.body.dataset.theme = e),
    (r.textContent = e === `light` ? o : a),
    (r.title =
      e === `light` ? `Schakel naar nachtmodus` : `Schakel naar dagmodus`),
    r.setAttribute(
      `aria-label`,
      e === `light` ? `Schakel naar nachtmodus` : `Schakel naar dagmodus`,
    ),
    r.setAttribute(`aria-pressed`, String(e === `light`)),
    window.localStorage.setItem(i, e));
}
function l(e) {
  return new Date(e).toLocaleString(`nl-NL`, {
    day: `2-digit`,
    month: `short`,
    hour: `2-digit`,
    minute: `2-digit`,
    timeZone: `Europe/Amsterdam`,
  });
}
async function u() {
  (await (await fetch(`/api/conversations`)).json()).forEach((t, n) => {
    let r = document.createElement(`div`);
    ((r.className = `conv-item`),
      (r.style.animationDelay = `${n * 40}ms`),
      (r.innerHTML = `
      <span class="conv-title">#${t.id}</span>
      <span class="conv-date">${l(t.created_at)}</span>
    `),
      r.addEventListener(`click`, () => {
        (document
          .querySelectorAll(`.conv-item`)
          .forEach((e) => e.classList.remove(`active`)),
          r.classList.add(`active`),
          d(t.id));
      }),
      e.appendChild(r));
  });
}
async function d(e) {
  ((n.textContent = `Gesprek #${e}`), (t.innerHTML = ``));
  let r = await (await fetch(`/api/messages/${e}`)).json();
  if (r.length === 0) {
    t.innerHTML = `<div class="empty-state"><p>Geen berichten gevonden.</p></div>`;
    return;
  }
  r.forEach((e, n) => {
    let r = document.createElement(`div`);
    ((r.className = `message ${e.role}`),
      (r.style.animationDelay = `${n * 30}ms`),
      (r.innerHTML = `
      <span class="role-label">${e.role === `user` ? `Gebruiker` : `Assistent`}</span>
      <div class="bubble">${e.content}</div>
    `),
      t.appendChild(r));
  });
}
(r.addEventListener(`click`, () => {
  c(document.body.dataset.theme === `light` ? `dark` : `light`);
}),
  c(s()),
  u());
