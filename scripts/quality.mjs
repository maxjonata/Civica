import { spawnSync } from "node:child_process";
for (const [label, args] of [
  ["TypeScript", ["check"]],
  ["Lint", ["lint"]],
  ["TDD isolated suite", ["test"]],
  ["Isolated SQL integration", ["test:database"]],
  ["Build", ["build"]],
  ["Browser flow and axe triage", ["test:civic-browser"]],
  ["Dependency security", ["audit", "--audit-level=low"]],
]) {
  console.log("Quality gate:", label);
  const result = spawnSync("pnpm", args, {
    stdio: "inherit",
    env: process.env,
    // Windows exposes pnpm through a .cmd shim, which spawnSync cannot launch
    // directly without a command shell. Arguments above are fixed by this
    // script, so shell mode does not interpolate task or user input.
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(
  "All configured current-task quality gates passed. This does not prove remote CI or a security audit."
);
