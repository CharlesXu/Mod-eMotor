import assert from "node:assert/strict";
import test from "node:test";

import { scanText } from "../scripts/security-check.mjs";

test("accepts ordinary project text and placeholders", () => {
  const findings = scanText(
    "README.md",
    "API_KEY=your-api-key\nPASSWORD=${PASSWORD}\nhttps://example.com",
  );

  assert.deepEqual(findings, []);
});

test("detects private keys and common access-token formats", () => {
  const privateKey = ["-----BEGIN", " PRIVATE KEY-----"].join("");
  const encryptedPrivateKey = ["-----BEGIN", " ENCRYPTED PRIVATE KEY-----"].join("");
  const githubToken = ["ghp", "_abcdefghijklmnopqrstuvwxyz1234567890AB"].join("");
  const findings = scanText(
    "src/example.ts",
    `${privateKey}\n${encryptedPrivateKey}\n${githubToken}`,
  );

  assert.deepEqual(
    findings.map(({ rule }) => rule),
    ["private-key", "private-key", "github-token"],
  );
});

test("detects hard-coded secrets but ignores environment lookups", () => {
  const findings = scanText(
    "src/config.ts",
    [
      ["api", "Key"].join("") + ' = "live-secret-value"',
      "token = process.env.API_TOKEN",
    ].join("\n"),
  );

  assert.deepEqual(findings.map(({ rule }) => rule), ["hardcoded-secret"]);
});

test("detects env, JSON, and template-string credentials", () => {
  const envCredentialName = ["API", "_KEY"].join("");
  const jsonCredentialName = ["pass", "word"].join("");
  const templateCredentialName = ["client", "Secret"].join("");
  const findings = scanText(
    ".env",
    [
      `${envCredentialName}=not-a-real-secret-123`,
      `{"${jsonCredentialName}":"not-a-real-password"}`,
      `${templateCredentialName} = \`not-a-real-client-secret\``,
    ].join("\n"),
  );

  assert.deepEqual(
    findings.map(({ rule }) => rule),
    ["hardcoded-secret", "hardcoded-secret", "hardcoded-secret"],
  );
});

test("detects personal absolute paths", () => {
  const macPath = ["/Users", "/developer/private.txt"].join("");
  const linuxPath = ["/home", "/developer/private.txt"].join("");
  const findings = scanText("docs/setup.md", `${macPath}\n${linuxPath}`);

  assert.deepEqual(
    findings.map(({ rule }) => rule),
    ["personal-path", "personal-path"],
  );
});
