#!/usr/bin/env node

import { execSync } from "node:child_process";
import { lstatSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const FALLBACK_EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "coverage",
  "playwright-report",
  "test-results",
  "dist",
  "build",
  "out",
]);

function toPositiveNumber(value, fallback) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

const maxMb = toPositiveNumber(process.argv[2] ?? process.env.MAX_REPO_SIZE_MB, 10);
const maxBytes = Math.floor(maxMb * 1024 * 1024);

function getGitTrackedFiles() {
  try {
    const trackedFilesOutput = execSync("git ls-files -z", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    return trackedFilesOutput
      .split("\u0000")
      .filter((filePath) => filePath.length > 0);
  } catch {
    return null;
  }
}

function collectFallbackWorkspaceFiles(rootPath, relativePath = "") {
  const currentPath = relativePath ? join(rootPath, relativePath) : rootPath;
  const entries = readdirSync(currentPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (FALLBACK_EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }

      const nextRelativePath = relativePath
        ? join(relativePath, entry.name)
        : entry.name;

      files.push(...collectFallbackWorkspaceFiles(rootPath, nextRelativePath));
      continue;
    }

    const fileRelativePath = relativePath
      ? join(relativePath, entry.name)
      : entry.name;

    try {
      const stats = lstatSync(join(rootPath, fileRelativePath));

      if (!stats.isSymbolicLink() && stats.isFile()) {
        files.push(fileRelativePath);
      }
    } catch {
      // Ignore files that disappear mid-scan.
    }
  }

  return files;
}

const trackedFiles = getGitTrackedFiles();
const filesToMeasure = trackedFiles ?? collectFallbackWorkspaceFiles(process.cwd());
const measurementMode = trackedFiles ? "git-tracked" : "fallback-workspace";

let totalBytes = 0;

for (const filePath of filesToMeasure) {
  try {
    totalBytes += statSync(filePath).size;
  } catch {
    // Skip files that no longer exist in working tree.
  }
}

const totalMb = totalBytes / (1024 * 1024);

console.log(
  `Repository size (${measurementMode}): ${totalBytes} bytes (${totalMb.toFixed(2)} MB) | limit: ${maxMb} MB`
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
