#!/usr/bin/env node
/**
 * Push to GitHub and connect Vercel Git integration for reliable deploys.
 * Prerequisite: gh auth login -h github.com -p https -w
 */
import { execSync, spawnSync } from "child_process";

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", shell: true });
}

function ghOk() {
  return spawnSync("gh", ["auth", "status"], { encoding: "utf8" }).status === 0;
}

if (!ghOk()) {
  console.error(
    "\nGitHub CLI not authenticated.\n\nRun in your terminal:\n  gh auth login -h github.com -p https -w\n\nThen re-run:\n  node scripts/publish-production.mjs\n"
  );
  process.exit(1);
}

const login = execSync("gh api user -q .login", { encoding: "utf8" }).trim();
const repoName = "core-rentals-tlv";
const repoUrl = `https://github.com/${login}/${repoName}.git`;

const view = spawnSync("gh", ["repo", "view", repoName], { encoding: "utf8" });
if (view.status !== 0) {
  run(
    `gh repo create ${repoName} --private --source=. --remote=origin --description "Core Rentals TLV vacation rental catalog"`
  );
} else {
  console.log(`\nRepo exists: ${repoUrl}`);
  try {
    run("git remote get-url origin");
  } catch {
    run(`git remote add origin ${repoUrl}`);
  }
}

console.log("\nPushing to GitHub (8+ GB — may take 30–90 minutes)...");
run("git push -u origin main");

console.log("\nConnecting Vercel to GitHub...");
try {
  run(`vercel git connect ${repoUrl} --yes`);
} catch {
  console.log(
    "\nIf auto-connect fails, open:\n  https://vercel.com/bandiexchas-projects/core-rentals-tlv/settings/git\n  → Connect Git Repository → select core-rentals-tlv\n"
  );
}

console.log("\nVercel will build from GitHub. Production updates in ~10 min after push completes.");
