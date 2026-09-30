import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "../data");
const DB_FILE = path.join(DATA_DIR, "db.json");

// In-memory cache synced with disk
let dbData = {
  users: [],
  projects: [],
  documents: [],
  chatMessages: [],
};

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      console.warn("[LocalDB] Could not create data directory, running purely in-memory:", e.message);
    }
  }
}

// Load from disk on startup
export async function connectDB() {
  ensureDataDir();
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      dbData = { ...dbData, ...JSON.parse(raw) };
      console.log("[LocalDB] Embedded local database loaded successfully.");
    } else {
      saveDB();
      console.log("[LocalDB] Embedded local database created successfully.");
    }
  } catch (err) {
    console.warn("[LocalDB] Notice reading db file, starting with fresh store:", err.message);
  }
}

// Debounced / immediate write to disk
let writeTimer = null;
export function saveDB() {
  ensureDataDir();
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), "utf-8");
    } catch (e) {
      // Memory fallback if filesystem is read-only
    }
  }, 100);
}

export function getCollection(name) {
  if (!dbData[name]) dbData[name] = [];
  return dbData[name];
}
