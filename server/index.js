import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const snapshotPath = path.join(root, "data", "api.json");
const app = express();
app.use(cors());

function snapshot() {
  try { return JSON.parse(fs.readFileSync(snapshotPath, "utf8")); }
  catch { return null; }
}
app.get("/api/health", (_req, res) => {
  const data = snapshot();
  res.json({ ok: Boolean(data), snapshot: Boolean(data), generated_at: data?.quality?.generated_at ?? null });
});
app.get("/api/summary", (_req, res) => res.json(snapshot()?.summary ?? {}));
app.get("/api/daily", (_req, res) => res.json(snapshot()?.daily ?? []));
app.get("/api/asteroids", (_req, res) => res.json(snapshot()?.asteroids ?? []));
app.get("/api/solar", (_req, res) => res.json(snapshot()?.solar ?? { flares: [], cmes: [], kp: [], apod: [] }));
app.get("/api/quality", (_req, res) => res.json(snapshot()?.quality ?? { error: "Run the pipeline first" }));
app.use(express.static(path.join(root, "dist")));
app.get("*", (_req, res) => res.sendFile(path.join(root, "dist", "index.html")));
const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`Cosmos API listening on http://localhost:${port}`));
