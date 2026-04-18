#!/usr/bin/env node

import { execSync } from "node:child_process";
import { statSync } from "node:fs";

function toPositiveNumber(value, fallback) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

const maxMb = toPositiveNumber(process.argv[2] ?? process.env.MAX_REPO_SIZE_MB, 10);
const maxBytes = Math.floor(maxMb * 1024 * 1024);

const trackedFilesOutput = execSync("git ls-files -z", {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

const trackedFiles = trackedFilesOutput.split("\u0000").filter((filePath) => filePath.length > 0);

let totalBytes = 0;

for (const filePath of trackedFiles) {
  try {
    totalBytes += statSync(filePath).size;
  } catch {
    // Skip files that no longer exist in working tree.
  }
}

const totalMb = totalBytes / (1024 * 1024);

console.log(
  `Tracked repository size: ${totalBytes} bytes (${totalMb.toFixed(2)} MB) | limit: ${maxMb} MB`
);

if (totalBytes > maxBytes) {
  console.error(
    `Repository size check failed: tracked files exceed ${maxMb} MB limit by ${(
      (totalBytes - maxBytes) /
      (1024 * 1024)
    ).toFixed(2)} MB.`
  );
  process.exit(1);
}
