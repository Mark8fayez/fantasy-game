// =====================================================================
//  DATABASE
//  - On a real host (Render): stores data in Upstash (a free cloud
//    database) so nothing is ever lost, even when the server restarts.
//  - On your computer (local dev): stores data in a file, data.json.
//  It automatically picks the right one based on environment variables.
// =====================================================================
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "data.json");
const KEY = "fantasydata";

// Upstash settings come from environment variables (set on Render).
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const useCloud = !!(UPSTASH_URL && UPSTASH_TOKEN);

// The shape of a brand-new, empty database.
const DEFAULT_DATA = {
  settings: { userBudget: 100, teamSize: 5 },
  players: [],     // { id, name, position, price, totalPoints }
  gameweeks: [],   // { id, name, weekNumber }
  events: [],      // { id, playerId, gameweekId, type, points, createdAt }
  users: [],       // { id, name, passwordHash, salt, teamName, playerIds, budgetSpent, createdAt }
  sessions: {},    // token -> { role: 'user'|'admin', userId }
};

let data;

// ---- Cloud (Upstash) helpers ----
async function cloudGet() {
  const res = await fetch(`${UPSTASH_URL}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  const json = await res.json();
  return json.result ? JSON.parse(json.result) : null;
}
async function cloudSet() {
  await fetch(`${UPSTASH_URL}/set/${KEY}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    body: JSON.stringify(data),
  });
}

// Load data once at startup. (index.js awaits this before the server starts.)
async function load() {
  if (useCloud) {
    const stored = await cloudGet();
    if (stored) {
      data = { ...structuredClone(DEFAULT_DATA), ...stored };
    } else {
      data = structuredClone(DEFAULT_DATA);
      await cloudSet();
    }
    console.log("Database: using Upstash cloud storage.");
  } else {
    try {
      data = { ...structuredClone(DEFAULT_DATA), ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
    } catch {
      data = structuredClone(DEFAULT_DATA);
      fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
    }
    console.log("Database: using local file (data.json).");
  }
}

// Save data after every change.
function save() {
  if (useCloud) {
    cloudSet().catch((e) => console.error("Cloud save failed:", e.message));
  } else {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  }
}

// Get the whole database object.
function db() {
  return data;
}

module.exports = { db, save, load };
