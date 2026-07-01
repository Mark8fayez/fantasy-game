// ---------- Leaderboard logic ----------

const medal = (i) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1);

async function loadOverall() {
  const rows = await api("GET", "/api/leaderboard");
  const tb = document.getElementById("overall");
  if (!rows.length) { tb.innerHTML = `<tr><td colspan="4" class="muted">No teams yet.</td></tr>`; return; }
  tb.innerHTML = rows.map((r, i) => `
    <tr>
      <td class="rank">${medal(i)}</td>
      <td><b>${esc(r.manager)}</b></td>
      <td class="muted">${esc(r.teamName || "—")}</td>
      <td class="points">${r.totalPoints}</td>
    </tr>`).join("");
}

async function loadWeeks() {
  const weeks = await api("GET", "/api/gameweeks");
  const sel = document.getElementById("weekSelect");
  if (!weeks.length) {
    sel.innerHTML = `<option>No rounds yet</option>`;
    document.getElementById("weekly").innerHTML = `<tr><td colspan="4" class="muted">No rounds yet.</td></tr>`;
    return;
  }
  sel.innerHTML = weeks.map((w) => `<option value="${w.id}">${esc(w.name)}</option>`).join("");
  sel.onchange = () => loadWeekly(sel.value);
  loadWeekly(weeks[weeks.length - 1].id); // show latest week by default
}

async function loadWeekly(gwId) {
  const rows = await api("GET", "/api/leaderboard/week/" + gwId);
  const tb = document.getElementById("weekly");
  const banner = document.getElementById("winnerBanner");

  const scored = rows.filter((r) => r.points !== 0);
  if (scored.length && rows[0].points > 0) {
    banner.style.display = "block";
    banner.textContent = `👑 Winner of the week: ${rows[0].manager} (${rows[0].points} pts)`;
  } else {
    banner.style.display = "none";
  }

  if (!rows.length) { tb.innerHTML = `<tr><td colspan="4" class="muted">No teams yet.</td></tr>`; return; }
  tb.innerHTML = rows.map((r, i) => `
    <tr>
      <td class="rank">${medal(i)}</td>
      <td><b>${esc(r.manager)}</b></td>
      <td class="muted">${esc(r.teamName || "—")}</td>
      <td class="points">${r.points}</td>
    </tr>`).join("");
}

(async function () {
  try { await loadOverall(); await loadWeeks(); }
  catch (e) { console.error(e); }
})();
