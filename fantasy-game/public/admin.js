// ---------- Admin dashboard logic ----------

const show = (id) => document.getElementById(id).classList.remove("hidden");
const hide = (id) => document.getElementById(id).classList.add("hidden");

async function init() {
  const token = Auth.get();
  if (token) {
    try {
      const me = await api("GET", "/api/me");
      if (me.role === "admin") return openDashboard();
    } catch {}
  }
  show("loginView");
}

document.getElementById("adminLoginBtn").onclick = async () => {
  clearMsg();
  try {
    const password = document.getElementById("adminPass").value;
    const { token } = await api("POST", "/api/admin/login", { password });
    Auth.set(token);
    openDashboard();
  } catch (e) { showMsg(e.message); }
};

document.getElementById("logoutLink").onclick = async (e) => {
  e.preventDefault();
  try { await api("POST", "/api/logout"); } catch {}
  Auth.clear();
  location.reload();
};

async function openDashboard() {
  hide("loginView"); show("dashView");
  document.getElementById("logoutLink").classList.remove("hidden");
  await Promise.all([loadPlayers(), loadGameweeks(), loadSettings()]);
}

// ---------- tabs ----------
document.querySelectorAll(".tabs button").forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    ["players", "events", "gameweeks", "settings", "board"].forEach((t) => hide("tab-" + t));
    const tab = btn.getAttribute("data-tab");
    show("tab-" + tab);
    if (tab === "events") loadEvents();
    if (tab === "board") loadBoard();
  };
});

// ---------- players ----------
async function loadPlayers() {
  const players = await api("GET", "/api/players");
  document.getElementById("playersBody").innerHTML = players.map((p) => `
    <tr>
      <td><b>${esc(p.name)}</b></td>
      <td><span class="pill">${esc(p.position)}</span></td>
      <td>${p.price}</td>
      <td class="points">${p.totalPoints}</td>
      <td><button class="danger" data-del="${p.id}">Delete</button></td>
    </tr>`).join("") || `<tr><td colspan="5" class="muted">No players yet.</td></tr>`;

  document.querySelectorAll("[data-del]").forEach((b) => {
    b.onclick = async () => {
      if (!confirm("Delete this player?")) return;
      await api("DELETE", "/api/players/" + b.getAttribute("data-del"));
      loadPlayers();
    };
  });
  fillEventPlayers(players);
}

document.getElementById("addPlayerBtn").onclick = async () => {
  clearMsg();
  try {
    const name = document.getElementById("pName").value.trim();
    const position = document.getElementById("pPos").value.trim();
    const price = document.getElementById("pPrice").value;
    await api("POST", "/api/players", { name, position, price });
    document.getElementById("pName").value = "";
    document.getElementById("pPos").value = "";
    showMsg("Player added.", "ok");
    loadPlayers();
  } catch (e) { showMsg(e.message); }
};

// ---------- gameweeks ----------
async function loadGameweeks() {
  const weeks = await api("GET", "/api/gameweeks");
  document.getElementById("gwBody").innerHTML = weeks.map((w) => `
    <tr>
      <td>${w.weekNumber}</td>
      <td><b>${esc(w.name)}</b></td>
      <td><button class="danger" data-delgw="${w.id}">Delete</button></td>
    </tr>`).join("") || `<tr><td colspan="3" class="muted">No gameweeks yet.</td></tr>`;

  document.querySelectorAll("[data-delgw]").forEach((b) => {
    b.onclick = async () => {
      if (!confirm("Delete this gameweek and its events?")) return;
      await api("DELETE", "/api/gameweeks/" + b.getAttribute("data-delgw"));
      loadGameweeks(); loadPlayers();
    };
  });
  fillEventWeeks(weeks);
}

document.getElementById("addGwBtn").onclick = async () => {
  clearMsg();
  try {
    const name = document.getElementById("gwName").value.trim();
    const weekNumber = document.getElementById("gwNum").value;
    await api("POST", "/api/gameweeks", { name, weekNumber });
    showMsg("Gameweek added.", "ok");
    loadGameweeks();
  } catch (e) { showMsg(e.message); }
};

// ---------- settings ----------
async function loadSettings() {
  const s = await api("GET", "/api/settings");
  document.getElementById("setBudget").value = s.userBudget;
  document.getElementById("setTeamSize").value = s.teamSize;
}

document.getElementById("saveSettingsBtn").onclick = async () => {
  clearMsg();
  try {
    const userBudget = document.getElementById("setBudget").value;
    const teamSize = document.getElementById("setTeamSize").value;
    await api("PUT", "/api/settings", { userBudget, teamSize });
    showMsg("Settings saved.", "ok");
  } catch (e) { showMsg(e.message); }
};

// ---------- events ----------
function fillEventPlayers(players) {
  document.getElementById("evPlayer").innerHTML =
    players.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
}
function fillEventWeeks(weeks) {
  document.getElementById("evWeek").innerHTML =
    weeks.map((w) => `<option value="${w.id}">${esc(w.name)}</option>`).join("");
}

document.getElementById("evType").onchange = (e) => {
  document.getElementById("customWrap").classList.toggle("hidden", e.target.value !== "manual");
};

document.getElementById("addEventBtn").onclick = async () => {
  clearMsg();
  try {
    const playerId = document.getElementById("evPlayer").value;
    const gameweekId = document.getElementById("evWeek").value;
    const type = document.getElementById("evType").value;
    const customPoints = document.getElementById("evCustom").value;
    if (!playerId) return showMsg("Add a player first.");
    if (!gameweekId) return showMsg("Create a gameweek first.");
    await api("POST", "/api/events", { playerId, gameweekId, type, customPoints });
    showMsg("Event applied — points updated automatically.", "ok");
    loadEvents(); loadPlayers();
  } catch (e) { showMsg(e.message); }
};

async function loadEvents() {
  const events = await api("GET", "/api/events");
  document.getElementById("eventsBody").innerHTML = events.map((e) => `
    <tr>
      <td><b>${esc(e.playerName)}</b></td>
      <td>${esc(e.type)}</td>
      <td class="muted">${esc(e.gameweekName)}</td>
      <td class="points">${e.points}</td>
      <td><button class="danger" data-delev="${e.id}">Undo</button></td>
    </tr>`).join("") || `<tr><td colspan="5" class="muted">No events yet.</td></tr>`;

  document.querySelectorAll("[data-delev]").forEach((b) => {
    b.onclick = async () => {
      await api("DELETE", "/api/events/" + b.getAttribute("data-delev"));
      loadEvents(); loadPlayers();
    };
  });
}

// ---------- board ----------
async function loadBoard() {
  const rows = await api("GET", "/api/leaderboard");
  const medal = (i) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1);
  document.getElementById("boardBody").innerHTML = rows.map((r, i) => `
    <tr>
      <td class="rank">${medal(i)}</td>
      <td><b>${esc(r.manager)}</b></td>
      <td class="muted">${esc(r.teamName || "—")}</td>
      <td class="points">${r.totalPoints}</td>
    </tr>`).join("") || `<tr><td colspan="4" class="muted">No teams yet.</td></tr>`;
}

init();
