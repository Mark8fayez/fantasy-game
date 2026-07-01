// =====================================================================
//  DATABASE
//  - On the host (Vercel): reads/writes data to Upstash (free cloud DB).
//  - On your computer: uses a local file, data.json.
//  Because Vercel runs "serverless" (no always-on process), we re-read
//  the data on each API request and save right after each change.
// =====================================================================
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "data.json");
const KEY = "fantasydata";

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const useCloud = !!(UPSTASH_URL && UPSTASH_TOKEN);

// The shape of a brand-new, empty database.
const DEFAULT_DATA = {
  settings: { userBudget: 100, teamSize: 5 },
  players: [],
  gameweeks: [],
  events: [],
  users: [],
  sessions: {},
};

let data = null;

// Read the whole database (from Upstash in the cloud, or the file locally).
async function reload() {
  if (useCloud) {
    const res = await fetch(`${UPSTASH_URL}/get/${KEY}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    const json = await res.json();
    const stored = json.result ? JSON.parse(json.result) : null;
    data = stored
      ? { ...structuredClone(DEFAULT_DATA), ...stored }
      : structuredClone(DEFAULT_DATA);
    if (!stored) await save();
  } else {
    try {
      data = { ...structuredClone(DEFAULT_DATA), ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
    } catch {
      data = structuredClone(DEFAULT_DATA);
      fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
    }
  }
  return data;
}

// Write the whole database back.
async function save() {
  if (useCloud) {
    await fetch(`${UPSTASH_URL}/set/${KEY}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      body: JSON.stringify(data),
    });
  } else {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  }
}

// Get the in-memory data (already loaded by reload() at the start of each request).
function db() {
  return data;
}

module.exports = { db, save, reload };
