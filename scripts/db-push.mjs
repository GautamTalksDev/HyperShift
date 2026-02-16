#!/usr/bin/env node
/**
 * Run Prisma db:push for the dashboard (create/update tables in Postgres).
 * Usage: from repo root, run: node scripts/db-push.mjs
 * Requires: DATABASE_URL in apps/dashboard/.env (same as Vercel for production DB).
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dashboardDir = path.join(root, "apps/dashboard");

const child = spawn("pnpm", ["run", "db:push"], {
  cwd: dashboardDir,
  stdio: "inherit",
  shell: true,
});
child.on("error", (err) => {
  console.error("db:push failed:", err);
  process.exit(1);
});
child.on("exit", (code) => {
  process.exit(code ?? 0);
});
