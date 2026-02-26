import "dotenv/config";
import express from "express";
import cors from "cors";
import { OAuth2Client } from "google-auth-library";
import { initDb } from "./db.js";

const PORT = process.env.PORT || 8081;
const DB_PATH = process.env.DATABASE_PATH || "./data.db";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const DEV_BYPASS_AUTH = process.env.DEV_BYPASS_AUTH === "true";

const db = initDb(DB_PATH);
const app = express();
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

function nowIso() {
  return new Date().toISOString();
}

async function verifyGoogleToken(idToken) {
  if (!googleClient) {
    throw new Error("Google client not configured");
  }
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
}

async function requireAuth(req, res, next) {
  if (DEV_BYPASS_AUTH) {
    req.user = {
      id: "dev-user",
      email: "dev@example.com",
      name: "Dev User",
      avatar: "",
    };
    ensureUser(req.user);
    return next();
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  try {
    const payload = await verifyGoogleToken(token);
    if (!payload || !payload.sub) {
      return res.status(401).json({ error: "Invalid token" });
    }
    const user = {
      id: payload.sub,
      email: payload.email || "",
      name: payload.name || payload.email || "User",
      avatar: payload.picture || "",
    };
    ensureUser(user);
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Auth failed" });
  }
}

function ensureUser(user) {
  const exists = db.prepare("SELECT id FROM users WHERE id = ?").get(user.id);
  if (exists) return;
  db.prepare(
    "INSERT INTO users (id, email, name, avatar, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(user.id, user.email, user.name, user.avatar, nowIso());
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/members", requireAuth, (req, res) => {
  const rows = db
    .prepare("SELECT id, name FROM members WHERE user_id = ? ORDER BY created_at ASC")
    .all(req.user.id);
  res.json({ members: rows });
});

app.post("/api/members", requireAuth, (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }
  const id = generateId("m");
  db.prepare(
    "INSERT INTO members (id, user_id, name, created_at) VALUES (?, ?, ?, ?)"
  ).run(id, req.user.id, name, nowIso());
  res.status(201).json({ member: { id, name } });
});

app.delete("/api/members/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  db.prepare("DELETE FROM members WHERE id = ? AND user_id = ?").run(id, req.user.id);
  db.prepare(
    "UPDATE chores SET assignee_id = NULL WHERE assignee_id = ? AND user_id = ?"
  ).run(id, req.user.id);
  res.json({ ok: true });
});

app.get("/api/chores", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      "SELECT id, title, assignee_id, date, time, duration, recurrence_type, recurrence_interval, recurrence_end FROM chores WHERE user_id = ? ORDER BY date ASC, time ASC"
    )
    .all(req.user.id);
  res.json({ chores: rows.map(formatChore) });
});

app.post("/api/chores", requireAuth, (req, res) => {
  const title = String(req.body.title || "").trim();
  const date = String(req.body.date || "");
  const time = String(req.body.time || "");
  const duration = Number(req.body.duration || 30);
  const recurrence = req.body.recurrence || {};
  const recurrenceType = String(recurrence.type || "none");
  const recurrenceInterval = Number(recurrence.interval || 1);
  const recurrenceEnd = recurrence.endDate ? String(recurrence.endDate) : null;
  const assigneeId = req.body.assigneeId ? String(req.body.assigneeId) : null;

  if (!title || !date || !time) {
    return res.status(400).json({ error: "title, date, and time are required" });
  }

  const id = generateId("c");
  db.prepare(
    `INSERT INTO chores
      (id, user_id, title, assignee_id, date, time, duration, recurrence_type, recurrence_interval, recurrence_end, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.user.id,
    title,
    assigneeId,
    date,
    time,
    duration,
    recurrenceType,
    recurrenceInterval,
    recurrenceEnd,
    nowIso()
  );

  const chore = {
    id,
    title,
    assigneeId,
    date,
    time,
    duration,
    recurrence: {
      type: recurrenceType,
      interval: recurrenceInterval,
      endDate: recurrenceEnd || "",
    },
  };

  res.status(201).json({ chore });
});

app.delete("/api/chores/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  db.prepare("DELETE FROM chores WHERE id = ? AND user_id = ?").run(id, req.user.id);
  res.json({ ok: true });
});

function formatChore(row) {
  return {
    id: row.id,
    title: row.title,
    assigneeId: row.assignee_id || "",
    date: row.date,
    time: row.time,
    duration: row.duration,
    recurrence: {
      type: row.recurrence_type,
      interval: row.recurrence_interval,
      endDate: row.recurrence_end || "",
    },
  };
}

app.listen(PORT, () => {
  console.log(`API listening on ${PORT}`);
});
