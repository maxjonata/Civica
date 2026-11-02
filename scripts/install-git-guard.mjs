import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
const hooks = execFileSync("git", ["rev-parse", "--git-path", "hooks"], {
  encoding: "utf8",
}).trim();
const target = path.resolve(hooks, "pre-push");
const script =
  '#!/bin/sh\n# Civica local quality gate — remote CI/branch protection are separate.\nset -eu\ncd "$(git rev-parse --show-toplevel)"\npnpm quality\n';
try {
  const existing = await fs.readFile(target, "utf8");
  if (existing !== script)
    throw new Error(
      "Existing pre-push hook preserved; integrate manually instead of overwriting."
    );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, script, { mode: 0o755, flag: "wx" });
}
console.log(
  "Local pre-push quality hook installed or already present. No remote CI was activated."
);
