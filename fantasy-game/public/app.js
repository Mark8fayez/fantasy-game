// Shared helpers used by every page.

// Save / read / clear the login token in the browser.
const Auth = {
  get: () => localStorage.getItem("token"),
  set: (t) => localStorage.setItem("token", t),
  clear: () => localStorage.removeItem("token"),
};

// Call our server API. Automatically attaches the login token.
async function api(method, url, body) {
  const headers = { "Content-Type": "application/json" };
  const token = Auth.get();
  if (token) headers.Authorization = "Bearer " + token;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

// Show a green (ok) or red (error) message in an element with id "msg".
function showMsg(text, kind = "error") {
  const el = document.getElementById("msg");
  if (!el) return alert(text);
  el.textContent = text;
  el.className = "msg show " + (kind === "ok" ? "ok" : "error");
}
function clearMsg() {
  const el = document.getElementById("msg");
  if (el) el.className = "msg";
}

// Escape text so player/team names can't break the page.
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
