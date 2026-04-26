import { spawnSync } from "node:child_process";

const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  JWT_SECRET: process.env.JWT_SECRET || "seriesforge-secret",
};

const result = spawnSync("npx", ["prisma", "generate"], {
  stdio: "inherit",
  env,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const buildResult = spawnSync("next", ["build"], {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

process.exit(buildResult.status ?? 1);
