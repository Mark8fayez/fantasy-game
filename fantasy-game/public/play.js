// ---------- Player app logic ----------

let settings = { userBudget: 0, teamSize: 5 };
let allPlayers = [];
let selected = new Set();

const show = (id) => document.getElementById(id).classList.remove("hidden");
const hide = (id) => document.getElementById(id).classList.add("hidden");

// Decide which view to show based on login + whether they have a team.
async function init() {
  try {
    settings = await api("GET", "/api/settings");
  } catch { /* not logged in yet — that's fine */ }

  const token = Auth.get();
  if (!token) return renderAuth();

  try {
    const me = await api("GET", "/api/me");
    if (me.role !== "user") { Auth.clear(); return renderAuth(); }
    document.getElementById("logoutLink").classList.remove("hidden");
    if (me.user.hasTeam) return renderTeam();
    return renderBuilder();
  } catch {
    Auth.clear();
    renderAuth();
  }
}

function renderAuth() {
  hide("builderView"); hide("teamView");
  document.getElementById("logoutLink").classList.add("hidden");
  show("authView");
}

async function renderBuilder() {
  hide("authView"); hide("teamView"); show("builderView");
  settings = await api("GET", "/api/settings");
  allPlayers = await api("GET", "/api/players");

  document.getElementById("teamSizeText").textContent = settings.teamSize;
  document.getElementById("teamSizeText2").textContent = settings.teamSize;
  document.getElementById("budgetTotal").textContent = settings.userBudget;
  selected = new Set();
  drawPicker();
}

function drawPicker() {
  const spent = [...selected].reduce((s, id) => s + Number(findPlayer(id).price), 0);
  const left = settings.userBudget - spent;
  document.getElementById("budgetLeft").textContent = left;
  document.getElementById("pickedCount").textContent = selected.size;

  const box = document.getElementById("playerPicker");
  if (!allPlayers.length) {
    box.innerHTML = `<p class="muted">No players available yet. Ask the admin to add some.</p>`;
    return;
  }
  box.innerHTML = allPlayers.map((p) => {
    const isSel = selected.has(p.id);
    const tooPricey = !isSel && Number(p.price) > left;
    const full = !isSel && selected.size >= settings.teamSize;
    const disabled = tooPricey || full;
    return `
      <div class="pick ${isSel ? "selected" : ""}">
        <div>
          <b>${esc(p.name)}</b> <span class="pill">${esc(p.position)}</span><br/>
          <span class="muted">Price: ${p.price} · Points: ${p.totalPoints}</span>
        </div>
        <button class="small ${isSel ? "danger" : "secondary"}"
                data-id="${p.id}" ${disabled ? "disabled" : ""}>
          ${isSel ? "Remove" : "Add"}
        </button>
      </div>`;
  }).join("");

  box.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      drawPicker();
    };
  });
}

function findPlayer(id) { return allPlayers.find((p) => p.id === id); }

async function renderTeam() {
  hide("authView"); hide("builderView"); show("teamView");
  const t = await api("GET", "/api/team/me");
  document.getElementById("myTeamName").textContent = t.teamName || "My Team";
  document.getElementById("myTotal").textContent = t.totalPoints;
  document.getElementById("myPlayers").innerHTML = t.players.map((p) => `
    <tr>
      <td><b>${esc(p.name)}</b></td>
      <td><span class="pill">${esc(p.position)}</span></td>
      <td>${p.price}</td>
      <td class="points">${p.totalPoints}</td>
    </tr>`).join("");
}

// ---------- button handlers ----------
document.getElementById("regBtn").onclick = async () => {
  clearMsg();
  try {
    const name = document.getElementById("regName").value.trim();
    const password = document.getElementById("regPass").value;
    const { token } = await api("POST", "/api/register", { name, password });
    Auth.set(token);
    await renderBuilder();
    document.getElementById("logoutLink").classList.remove("hidden");
  } catch (e) { showMsg(e.message); }
};

document.getElementById("loginBtn").onclick = async () => {
  clearMsg();
  try {
    const name = document.getElementById("loginName").value.trim();
    const password = document.getElementById("loginPass").value;
    const { token, user } = await api("POST", "/api/login", { name, password });
    Auth.set(token);
    document.getElementById("logoutLink").classList.remove("hidden");
    if (user.hasTeam) await renderTeam(); else await renderBuilder();
  } catch (e) { showMsg(e.message); }
};

document.getElementById("saveTeamBtn").onclick = async () => {
  clearMsg();
  try {
    const teamName = document.getElementById("teamName").value.trim();
    await api("POST", "/api/team", { teamName, playerIds: [...selected] });
    showMsg("Team saved! Good luck 🍀", "ok");
    await renderTeam();
  } catch (e) { showMsg(e.message); }
};

document.getElementById("logoutLink").onclick = async (e) => {
  e.preventDefault();
  try { await api("POST", "/api/logout"); } catch {}
  Auth.clear();
  location.reload();
};

init();
