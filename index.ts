import { file } from "bun";
import { Database } from "bun:sqlite";
import { Elysia } from "elysia";
import { html } from "@elysiajs/html";
import { cors } from "@elysiajs/cors";

/**
 * 1: HTTP count ID
 * 2: WebSocket count ID
 */
type ID = 1 | 2;

/** Count DB row */
type Count = {
  id: ID;
  value: number;
};

const db = new Database("db.sqlite");
initDb();

const app = new Elysia()
  .use(html())
  .use(
    cors({
      origin: undefined,
    })
  )
  .ws("/api/ws-count", {
    open(ws) {
      ws.subscribe("count");
      ws.send(`<span id="ws-counter">${get(2)}</span>`);
    },
    message(_ws, message) {
      if (
        typeof message !== "object" ||
        message === null ||
        !("counter_action" in message)
      )
        return;

      switch (message.counter_action) {
        case "up":
          console.log("up");
          app.server?.publish("count", `<span id="ws-counter">${up(2)}</span>`);
          break;
        case "down":
          console.log("down");
          app.server?.publish(
            "count",
            `<span id="ws-counter">${down(2)}</span>`
          );
          break;
        case "reset":
          console.log("reset");
          app.server?.publish(
            "count",
            `<span id="ws-counter">${reset(2)}</span>`
          );
          break;
        default:
          console.error("Unknown action in WebSocket message");
      }
    },
    close(ws) {
      ws.unsubscribe("count");
    },
  })
  .get("/", () => {
    return file("./index.html").text();
  })
  .get("/api/count", async () => {
    return get(1);
  })
  .put("/api/up", async () => {
    return up(1);
  })
  .put("/api/down", async () => {
    return down(1);
  })
  .put("/api/reset", async () => {
    return reset(1);
  })
  .listen(4321);

console.log(`🦊 Elysia + 🐴 HTMX is running at ${app.server?.url}`);

function initDb() {
  db.run(`
  CREATE TABLE IF NOT EXISTS count (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    value INTEGER NOT NULL
  );
`);
  db.run(`
  INSERT INTO count (id, value)
  SELECT *
  FROM (
      SELECT 1,
        0
    ) AS tmp
  WHERE NOT EXISTS (
      SELECT id
      FROM count
      WHERE id = 1
    );
`);
  db.run(`
  INSERT INTO count (id, value)
  SELECT *
  FROM (
      SELECT 2,
        0
    ) AS tmp
  WHERE NOT EXISTS (
      SELECT id
      FROM count
      WHERE id = 2
    );
`);
}

function isCountRow(row: unknown): row is Count {
  return (
    typeof row === "object" &&
    row !== null &&
    "id" in row &&
    "value" in row &&
    typeof row.id === "number" &&
    typeof row.value === "number"
  );
}

function countFromDB(id: ID): number {
  const row = db.query(`select * from count where id = ${id}`).get();
  if (isCountRow(row)) return row.value;
  throw new Error("Count not found");
}

function get(id: ID): number {
  const row = db.query(`select * from count where id = ${id}`).get();
  if (isCountRow(row)) return row.value;
  return 0;
}
function up(id: ID): number {
  db.run(`update count set value = value + 1 where id = ${id}`);
  return countFromDB(id);
}
function down(id: ID): number {
  db.run(`update count set value = value - 1 where id = ${id}`);
  return countFromDB(id);
}
function reset(id: ID): number {
  db.run(`update count set value = 0 where ${id}`);
  return countFromDB(id);
}
