#!/usr/bin/env node
/* eslint-disable */
/**
 * Stage 3B.4.1 — Initial Administrator Account Provisioning Script
 *
 * Explicitly invoked CLI bootstrap procedure to promote an existing, email-verified
 * user account to `role: "admin"` and `status: "active"`.
 *
 * Usage:
 *   node scripts/provision-initial-admin.js --email=developers.mindfulapps@gmail.com
 *   npm run admin:provision -- --email=developers.mindfulapps@gmail.com
 *
 * Security invariants:
 * - Never executed automatically during build, deployment, or application startup.
 * - Never exposes MongoDB credentials, password hashes, session tokens, or secrets.
 * - Never creates an account with a hardcoded or temporary password.
 * - Never fabricates an email verification state (`isEmailVerified` must already be `true`).
 * - Idempotent: running again on an active verified admin performs a safe no-op.
 * - Records an append-only bootstrap audit entry (`actorRole: "system_bootstrap"`,
 *   `actorUserId: null`) in `admin_audit_logs`.
 */

const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const DEFAULT_INITIAL_ADMIN_EMAIL = "developers.mindfulapps@gmail.com";

function loadEnvFiles() {
  const candidates = [
    path.resolve(__dirname, "../.env.local"),
    path.resolve(__dirname, "../.env"),
  ];
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    const content = fs.readFileSync(envPath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx <= 0) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  }
}

const moduleCache = new Map();

function loadTsModule(filePath) {
  const resolved = path.resolve(filePath);
  if (moduleCache.has(resolved)) {
    return moduleCache.get(resolved).exports;
  }

  const content = fs.readFileSync(resolved, "utf8");
  const transpiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;

  const m = { exports: {} };
  moduleCache.set(resolved, m);

  const customRequire = (specifier) => {
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const dir = path.dirname(resolved);
      let targetPath = path.resolve(dir, specifier);
      if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + ".ts")) {
        targetPath += ".ts";
      } else if (
        !fs.existsSync(targetPath) &&
        fs.existsSync(targetPath + ".tsx")
      ) {
        targetPath += ".tsx";
      } else if (
        !fs.existsSync(targetPath) &&
        fs.existsSync(targetPath + ".js")
      ) {
        targetPath += ".js";
      }
      return loadTsModule(targetPath);
    }
    if (specifier.startsWith("@/")) {
      let targetPath = path.resolve(__dirname, "..", "src", specifier.slice(2));
      if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + ".ts")) {
        targetPath += ".ts";
      } else if (
        !fs.existsSync(targetPath) &&
        fs.existsSync(targetPath + ".tsx")
      ) {
        targetPath += ".tsx";
      }
      return loadTsModule(targetPath);
    }
    return require(specifier);
  };

  const fn = new Function(
    "require",
    "exports",
    "module",
    "__dirname",
    "__filename",
    transpiled
  );
  fn(customRequire, m.exports, m, path.dirname(resolved), resolved);
  return m.exports;
}

function parseCliArgs(argv) {
  let email = process.env.INITIAL_ADMIN_EMAIL || DEFAULT_INITIAL_ADMIN_EMAIL;
  let allowExitZeroOnPrecondition = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--email=")) {
      email = arg.slice("--email=".length).trim();
    } else if (arg === "--email" && argv[i + 1]) {
      email = argv[i + 1].trim();
      i++;
    } else if (arg === "--allow-precondition-exit-zero") {
      allowExitZeroOnPrecondition = true;
    }
  }

  return { email, allowExitZeroOnPrecondition };
}

async function main() {
  loadEnvFiles();
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "development";
  }

  const { email, allowExitZeroOnPrecondition } = parseCliArgs(
    process.argv.slice(2)
  );

  if (!process.env.MONGODB_URI) {
    console.error(
      "[Admin Provisioning Error] MONGODB_URI is not configured in the environment."
    );
    process.exit(1);
  }

  const { getMongoClient, getDb } = loadTsModule(
    path.resolve(__dirname, "../src/lib/db/mongodb.ts")
  );
  const { provisionInitialAdminAccount } = loadTsModule(
    path.resolve(__dirname, "../src/lib/auth/bootstrapAdmin.ts")
  );

  let client = null;
  try {
    client = await getMongoClient();
    const db = await getDb();

    console.log(
      "=== LingoPDF Stage 3B.4.1 — Initial Administrator Provisioning ==="
    );
    console.log(`Target Email: ${email.trim().toLowerCase()}`);

    const result = await provisionInitialAdminAccount(db, email);

    console.log("\n--- Bootstrap Provisioning Summary ---");
    console.log(`Bootstrap Operation ID : ${result.bootstrapOperationId}`);
    console.log(`Status                 : ${result.status}`);
    console.log(`Promoted               : ${result.promoted}`);
    console.log(`Idempotent No-Op       : ${result.idempotent}`);
    console.log(`Target Email           : ${result.targetEmail}`);
    console.log(`Target User ID         : ${result.targetUserId ?? "N/A"}`);
    console.log(`Previous Role          : ${result.previousRole ?? "N/A"}`);
    console.log(`New Role               : ${result.newRole ?? "N/A"}`);
    console.log(`Previous Account Status: ${result.previousStatus ?? "N/A"}`);
    console.log(`New Account Status     : ${result.newStatus ?? "N/A"}`);
    console.log(
      `Email Verified         : ${
        result.isEmailVerified === null ? "N/A" : String(result.isEmailVerified)
      }`
    );
    console.log(
      `Password Hash Preserved: ${
        result.passwordHashPreserved === null
          ? "N/A"
          : String(result.passwordHashPreserved)
      }`
    );
    console.log(`Audit Log Record ID    : ${result.auditLogId}`);
    console.log(`Timestamp              : ${result.timestamp}`);
    console.log(
      `ADMIN_EMAIL_ALLOWLIST  : ${
        result.allowlistEvaluation.allowlistConfigured
          ? result.allowlistEvaluation.emailAllowedByAllowlist
            ? "Configured (target email IS in allowlist)"
            : "WARNING: Configured, but target email is NOT in ADMIN_EMAIL_ALLOWLIST!"
          : "Not configured (database role='admin' + status='active' + isEmailVerified=true governs access)"
      }`
    );
    console.log(`\nMessage: ${result.message}`);

    if (result.status === "promoted" || result.status === "already_admin") {
      console.log(
        "\nPassword & Access Guidance:\n" +
          "- Existing password hash was preserved without modification.\n" +
          "- No shared or temporary password was generated.\n" +
          "- The administrator can sign in at /login, or use /forgot-password to establish a new password via their verified email address, and then access /admin."
      );
      process.exitCode = 0;
    } else if (result.status === "account_not_found") {
      console.log(
        "\nRequired Next Step:\n" +
          `1. Register "${result.targetEmail}" through the normal registration flow (/register).\n` +
          "2. Complete email verification via the verification link sent to that inbox.\n" +
          "3. Re-run: npm run admin:provision -- --email=" +
          result.targetEmail
      );
      process.exitCode = allowExitZeroOnPrecondition ? 0 : 2;
    } else if (result.status === "email_not_verified") {
      console.log(
        "\nRequired Next Step:\n" +
          `1. Complete email verification for "${result.targetEmail}" using the verification link sent during registration.\n` +
          "2. Re-run: npm run admin:provision -- --email=" +
          result.targetEmail
      );
      process.exitCode = allowExitZeroOnPrecondition ? 0 : 3;
    }
  } catch (err) {
    const safeMessage =
      err instanceof Error ? err.message : "Unexpected bootstrap failure";
    console.error(`[Admin Provisioning Failed] ${safeMessage}`);
    process.exitCode = 1;
  } finally {
    if (client) {
      try {
        await client.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}

main();
