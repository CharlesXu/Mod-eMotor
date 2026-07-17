import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RULES = [
  {
    id: "private-key",
    pattern: /-----BEGIN (?:(?:RSA|EC|OPENSSH|DSA|ENCRYPTED) )?PRIVATE KEY-----/g,
  },
  {
    id: "github-token",
    pattern: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/g,
  },
  {
    id: "aws-access-key",
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  },
  {
    id: "openai-api-key",
    pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    id: "slack-token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  },
  {
    id: "personal-path",
    pattern: /\/(?:Users|home)\/(?!Shared(?:\/|$))[^/\s"'`]+/g,
  },
  {
    id: "personal-path",
    pattern: /\b[A-Za-z]:\\Users\\[^\\\s"'`]+/g,
  },
];

const SECRET_ASSIGNMENT = /["']?\b(api[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token|password|passwd)\b["']?\s*[:=]\s*(?:(["'`])([^"'`\r\n]{8,})\2|([^\s,#;}{\]]{8,}))/gi;
const PLACEHOLDER = /^(?:your[-_]|example|sample|dummy|test[-_]|changeme|replace[-_]|<[^>]+>|x{4,}|\$\{|process\.env|import\.meta\.env|deno\.env|bun\.env|os\.environ)/i;
const SKIPPED_FILES = new Set(["package-lock.json"]);

function lineNumberAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

export function scanText(file, text) {
  const findings = [];

  for (const { id, pattern } of RULES) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      findings.push({ file, line: lineNumberAt(text, match.index), rule: id });
    }
  }

  SECRET_ASSIGNMENT.lastIndex = 0;
  for (const match of text.matchAll(SECRET_ASSIGNMENT)) {
    const value = match[3] ?? match[4];
    if (!PLACEHOLDER.test(value)) {
      findings.push({
        file,
        line: lineNumberAt(text, match.index),
        rule: "hardcoded-secret",
      });
    }
  }

  return findings.sort((left, right) => left.line - right.line);
}

function trackedFiles() {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { encoding: "utf8" },
  );

  return output.split("\0").filter(Boolean);
}

function isScannable(file) {
  if (SKIPPED_FILES.has(file)) return false;
  return statSync(file).size <= 5 * 1024 * 1024;
}

function scanRepository() {
  const findings = [];

  for (const file of trackedFiles()) {
    if (!isScannable(file)) continue;
    const buffer = readFileSync(file);
    if (buffer.includes(0)) continue;
    findings.push(...scanText(file, buffer.toString("utf8")));
  }

  return findings;
}

function main() {
  const findings = scanRepository();

  if (findings.length === 0) {
    console.log("Sensitive-data scan passed: no tracked-file findings.");
    return;
  }

  console.error(`Sensitive-data scan failed with ${findings.length} finding(s):`);
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} [${finding.rule}]`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
