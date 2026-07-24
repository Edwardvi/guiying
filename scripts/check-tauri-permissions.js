#!/usr/bin/env node
/**
 * Validates that every Tauri custom command registered in main.rs
 * has a matching permission entry in src-tauri/permissions/default.toml,
 * and that the capability file includes "pi-desktop:default".
 *
 * Run:  node scripts/check-tauri-permissions.js
 * Exit: 0 = OK, 1 = mismatch found
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ── 1. Parse commands from main.rs ──────────────────────────────────────────

const mainRs = readFileSync(resolve(root, "src-tauri/src/main.rs"), "utf8");

// Match: tauri::generate_handler![cmd_a, cmd_b, ...]
const handlerBlock = mainRs.match(/tauri::generate_handler!\[([^\]]+)\]/);
if (!handlerBlock) {
  console.error("ERROR: Could not find tauri::generate_handler! block in main.rs");
  process.exit(1);
}

const registeredCommands = handlerBlock[1]
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ── 2. Parse permissions from default.toml ──────────────────────────────────

const toml = readFileSync(resolve(root, "src-tauri/permissions/default.toml"), "utf8");

// Extract all commands.allow = ["cmd_x"] entries
const allowedInToml = [...toml.matchAll(/commands\.allow\s*=\s*\[([^\]]+)\]/g)].flatMap((m) =>
  m[1]
    .split(",")
    .map((s) => s.trim().replace(/^"|"$/g, ""))
    .filter(Boolean),
);

// Extract [default] permissions list
const defaultBlock = toml.match(/\[default\][^[]*permissions\s*=\s*\[([^\]]+)\]/s);
const defaultPermissions = defaultBlock
  ? defaultBlock[1]
      .split(",")
      .map((s) => s.trim().replace(/^"|"$/g, ""))
      .filter(Boolean)
  : [];

// ── 3. Parse capability JSON ─────────────────────────────────────────────────

const capability = JSON.parse(
  readFileSync(resolve(root, "src-tauri/capabilities/default.json"), "utf8"),
);
const capabilityPermissions = capability.permissions ?? [];

// ── 4. Validate ──────────────────────────────────────────────────────────────

let errors = 0;

function fail(msg) {
  console.error(`  FAIL  ${msg}`);
  errors++;
}

function pass(msg) {
  console.log(`  OK    ${msg}`);
}

console.log("\nChecking Tauri command permissions...\n");

// 4a. Every registered command must appear in permissions/default.toml
for (const cmd of registeredCommands) {
  if (allowedInToml.includes(cmd)) {
    pass(`${cmd} declared in permissions/default.toml`);
  } else {
    fail(`${cmd} is registered in main.rs but NOT declared in permissions/default.toml`);
  }
}

// 4b. Every command in permissions must appear in [default] permissions list
for (const cmd of allowedInToml) {
  const permId = `allow-${cmd.replace(/_/g, "-")}`;
  if (defaultPermissions.includes(permId)) {
    pass(`${permId} included in [default]`);
  } else {
    fail(`${permId} declared in permissions/default.toml but NOT listed under [default]`);
  }
}

// 4c. Capability must include the app's bundled default permission set.
// Within the same app, the local permission group is referenced as "default"
// (Tauri resolves it to <package>:default internally at build time).
if (
  capabilityPermissions.includes("default") ||
  capabilityPermissions.includes("pi-desktop:default")
) {
  pass(`capabilities/default.json includes the app default permission set`);
} else {
  fail(
    `capabilities/default.json does NOT include "default" — custom commands will be blocked at runtime`,
  );
}

// ── 5. Report ────────────────────────────────────────────────────────────────

console.log("");
if (errors === 0) {
  console.log(`All ${registeredCommands.length} commands are correctly declared. ✓\n`);
  process.exit(0);
} else {
  console.error(`${errors} problem(s) found. Fix them before building.\n`);
  process.exit(1);
}
