// =====================================================================
//  FANTASY GAME — SERVER
//  Works both locally (node index.js) and on Vercel (exported app).
// =====================================================================
const express = require("express");
const crypto = require("crypto");
const path = require("path");
const { db, save, reload } = require("./db");
const { pointsForEvent } = require("./scoring");

const app = express();
app.use(express.json());

// Serve the web pages (home, play, admin, leaderboard). No DB needed here.
app.use(express.static(path.join(__dirname, "public")));

// Before every /api request, load the latest data from the database.
app.use(async (req, res, next) => {
  if (!req.path.startsWith("/api")) return next();
  try {
    await reload();
    next();
  } catch (e) {
    console.error("DB load error:", e);
    res.status(500).json({ error: "Database error." });
  }
});

// The admin password comes from the ADMIN_PASSWORD environment variable.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// ---------- small helpers ----------
const newId = () => crypto.randomUUID();

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}
function newToken() {
  return crypto.randomBytes(24).toString("hex");
}
function getSession(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  return db().sessions[token] || null;
}
function requireUser(req, res, next) {
  const s = getSession(req);
  if (!s || s.role !== "user") return res.status(401).json({ error: "Please log in." });
  req.userId = s.userId;
  next();
}
function requireAdmin(req, res, next) {
  const s = getSession(req);
  if (!s || s.role !== "admin") return res.status(401).json({ error: "Admin only." });
  next();
}
function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    teamName: u.teamName || null,
    playerIds: u.playerIds || [],
    budgetSpent: u.budgetSpent || 0,
    hasTeam: !!(u.playerIds && u.playerIds.length),
  };
}

// =====================================================================
//  AUTH
// =====================================================================
app.post("/api/register", async (req, res) => {
  const { name, password } = req.body || {};
  if (!name || !password) return res.status(400).json({ error: "Name and password are required." });
  const data = db();
  if (data.users.find((u) => u.name.toLowerCase() === name.toLowerCase())) {
    return res.status(400).json({ error: "That name is already taken." });
  }
  const { salt, hash } = hashPassword(password);
  const user = {
    id: newId(), name, salt, passwordHash: hash,
    teamName: null, playerIds: [], budgetSpent: 0, createdAt: Date.now(),
  };
  data.users.push(user);
  const token = newToken();
  data.sessions[token] = { role: "user", userId: user.id };
  await save();
  res.json({ token, user: publicUser(user) });
});

app.post("/api/login", async (req, res) => {
  const { name, password } = req.body || {};
  const data = db();
  const user = data.users.find((u) => u.name.toLowerCase() === (name || "").toLowerCase());
  if (!user) return res.status(400).json({ error: "Wrong name or password." });
  const { hash } = hashPassword(password || "", user.salt);
  if (hash !== user.passwordHash) return res.status(400).json({ error: "Wrong name or password." });
  const token = newToken();
  data.sessions[token] = { role: "user", userId: user.id };
  await save();
  res.json({ token, user: publicUser(user) });
});

app.post("/api/admin/login", async (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) return res.status(400).json({ error: "Wrong admin password." });
  const data = db();
  const token = newToken();
  data.sessions[token] = { role: "admin" };
  await save();
  res.json({ token });
});

app.post("/api/logout", async (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token && db().sessions[token]) {
    delete db().sessions[token];
    await save();
  }
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  const s = getSession(req);
  if (!s) return res.json({ role: null });
  if (s.role === "admin") return res.json({ role: "admin" });
  const user = db().users.find((u) => u.id === s.userId);
  res.json({ role: "user", user: publicUser(user) });
});

// =====================================================================
//  PUBLIC DATA
// =====================================================================
app.get("/api/settings", (req, res) => res.json(db().settings));

app.get("/api/players", (req, res) => {
  res.json([...db().players].sort((a, b) => b.totalPoints - a.totalPoints));
});

app.get("/api/gameweeks", (req, res) => {
  res.json([...db().gameweeks].sort((a, b) => a.weekNumber - b.weekNumber));
});

// =====================================================================
//  LEADERBOARDS
// =====================================================================
app.get("/api/leaderboard", (req, res) => {
  const data = db();
  const rows = data.users
    .filter((u) => u.playerIds && u.playerIds.length)
    .map((u) => {
      const total = u.playerIds.reduce((sum, pid) => {
        const p = data.players.find((pl) => pl.id === pid);
        return sum + (p ? p.totalPoints : 0);
      }, 0);
      return { manager: u.name, teamName: u.teamName, totalPoints: total };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);
  res.json(rows);
});

app.get("/api/leaderboard/week/:gwId", (req, res) => {
  const data = db();
  const gwId = req.params.gwId;
  const rows = data.users
    .filter((u) => u.playerIds && u.playerIds.length)
    .map((u) => {
      const weekPoints = data.events
        .filter((e) => e.gameweekId === gwId && u.playerIds.includes(e.playerId))
        .reduce((sum, e) => sum + e.points, 0);
      return { manager: u.name, teamName: u.teamName, points: weekPoints };
    })
    .sort((a, b) => b.points - a.points);
  res.json(rows);
});

// =====================================================================
//  USER: team (pick once)
// =====================================================================
app.get("/api/team/me", requireUser, (req, res) => {
  const data = db();
  const user = data.users.find((u) => u.id === req.userId);
  const players = (user.playerIds || []).map((pid) => data.players.find((p) => p.id === pid)).filter(Boolean);
  const totalPoints = players.reduce((s, p) => s + p.totalPoints, 0);
  res.json({ teamName: user.teamName, players, totalPoints, budgetSpent: user.budgetSpent });
});

app.post("/api/team", requireUser, async (req, res) => {
  const data = db();
  const user = data.users.find((u) => u.id === req.userId);
  if (user.playerIds && user.playerIds.length) {
    return res.status(400).json({ error: "You already created your team (one team per player)." });
  }
  const { teamName, playerIds } = req.body || {};
  if (!teamName) return res.status(400).json({ error: "Please give your team a name." });
  if (!Array.isArray(playerIds)) return res.status(400).json({ error: "Pick your players." });

  const teamSize = data.settings.teamSize;
  const unique = [...new Set(playerIds)];
  if (unique.length !== teamSize) return res.status(400).json({ error: `You must pick exactly ${teamSize} players.` });

  const chosen = unique.map((pid) => data.players.find((p) => p.id === pid));
  if (chosen.some((p) => !p)) return res.status(400).json({ error: "One of the players no longer exists." });

  const cost = chosen.reduce((s, p) => s + Number(p.price), 0);
  if (cost > data.settings.userBudget) return res.status(400).json({ error: `Over budget: ${cost} / ${data.settings.userBudget}.` });

  user.teamName = teamName;
  user.playerIds = unique;
  user.budgetSpent = cost;
  await save();
  res.json({ ok: true, user: publicUser(user) });
});

// =====================================================================
//  ADMIN: players
// =====================================================================
app.post("/api/players", requireAdmin, async (req, res) => {
  const { name, position, price } = req.body || {};
  if (!name) return res.status(400).json({ error: "Player name is required." });
  const data = db();
  const player = { id: newId(), name, position: position || "ANY", price: Number(price) || 0, totalPoints: 0 };
  data.players.push(player);
  await save();
  res.json(player);
});

app.put("/api/players/:id", requireAdmin, async (req, res) => {
  const data = db();
  const player = data.players.find((p) => p.id === req.params.id);
  if (!player) return res.status(404).json({ error: "Player not found." });
  const { name, position, price, totalPoints } = req.body || {};
  if (name !== undefined) player.name = name;
  if (position !== undefined) player.position = position;
  if (price !== undefined) player.price = Number(price) || 0;
  if (totalPoints !== undefined) player.totalPoints = Number(totalPoints) || 0;
  await save();
  res.json(player);
});

app.delete("/api/players/:id", requireAdmin, async (req, res) => {
  const data = db();
  data.players = data.players.filter((p) => p.id !== req.params.id);
  data.events = data.events.filter((e) => e.playerId !== req.params.id);
  data.users.forEach((u) => {
    if (u.playerIds) u.playerIds = u.playerIds.filter((pid) => pid !== req.params.id);
  });
  await save();
  res.json({ ok: true });
});

// =====================================================================
//  ADMIN: settings
// =====================================================================
app.put("/api/settings", requireAdmin, async (req, res) => {
  const data = db();
  const { userBudget, teamSize } = req.body || {};
  if (userBudget !== undefined) data.settings.userBudget = Number(userBudget) || 0;
  if (teamSize !== undefined) data.settings.teamSize = Number(teamSize) || 5;
  await save();
  res.json(data.settings);
});

// =====================================================================
//  ADMIN: gameweeks
// =====================================================================
app.post("/api/gameweeks", requireAdmin, async (req, res) => {
  const { name, weekNumber } = req.body || {};
  const data = db();
  const gw = {
    id: newId(),
    name: name || `Week ${weekNumber || data.gameweeks.length + 1}`,
    weekNumber: Number(weekNumber) || data.gameweeks.length + 1,
  };
  data.gameweeks.push(gw);
  await save();
  res.json(gw);
});

app.delete("/api/gameweeks/:id", requireAdmin, async (req, res) => {
  const data = db();
  data.events
    .filter((e) => e.gameweekId === req.params.id)
    .forEach((e) => {
      const p = data.players.find((pl) => pl.id === e.playerId);
      if (p) p.totalPoints -= e.points;
    });
  data.events = data.events.filter((e) => e.gameweekId !== req.params.id);
  data.gameweeks = data.gameweeks.filter((g) => g.id !== req.params.id);
  await save();
  res.json({ ok: true });
});

// =====================================================================
//  ADMIN: events (automatic points)
// =====================================================================
app.get("/api/events", requireAdmin, (req, res) => {
  const data = db();
  const rows = [...data.events]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((e) => ({
      ...e,
      playerName: (data.players.find((p) => p.id === e.playerId) || {}).name || "(deleted)",
      gameweekName: (data.gameweeks.find((g) => g.id === e.gameweekId) || {}).name || "(deleted)",
    }));
  res.json(rows);
});

app.post("/api/events", requireAdmin, async (req, res) => {
  const { playerId, gameweekId, type, customPoints } = req.body || {};
  const data = db();
  const player = data.players.find((p) => p.id === playerId);
  const gw = data.gameweeks.find((g) => g.id === gameweekId);
  if (!player) return res.status(400).json({ error: "Pick a valid player." });
  if (!gw) return res.status(400).json({ error: "Pick a valid gameweek." });

  const points = pointsForEvent(type, customPoints);
  const event = { id: newId(), playerId, gameweekId, type, points, createdAt: Date.now() };
  data.events.push(event);
  player.totalPoints += points;
  await save();
  res.json(event);
});

app.delete("/api/events/:id", requireAdmin, async (req, res) => {
  const data = db();
  const event = data.events.find((e) => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found." });
  const player = data.players.find((p) => p.id === event.playerId);
  if (player) player.totalPoints -= event.points;
  data.events = data.events.filter((e) => e.id !== req.params.id);
  await save();
  res.json({ ok: true });
});

// =====================================================================
//  START
//  - Locally: run a normal server (node index.js).
//  - On Vercel: the app is exported and Vercel runs it for us.
// =====================================================================
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Fantasy game running on http://localhost:${PORT}`));
}

module.exports = app;
