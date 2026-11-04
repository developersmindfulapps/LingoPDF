/* eslint-disable */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

/**
 * Loads environment variables from .env.local if not already set in process.env.
 * Never logs secret values.
 */
function loadEnvFile(envFilePath) {
  if (!fs.existsSync(envFilePath)) return;
  const content = fs.readFileSync(envFilePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/**
 * Transpiles and loads a TypeScript module from src/ using the repository's TypeScript dependency
 * so centralized index definitions in src/lib/db/models.ts remain the single source of truth.
 */
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
      } else if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + ".js")) {
        targetPath += ".js";
      }
      return loadTsModule(targetPath);
    }
    if (specifier.startsWith("@/")) {
      let targetPath = path.resolve(__dirname, "..", "src", specifier.slice(2));
      if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + ".ts")) {
        targetPath += ".ts";
      }
      return loadTsModule(targetPath);
    }
    return require(specifier);
  };

  const fn = new Function("require", "exports", "module", "__dirname", "__filename", transpiled);
  fn(customRequire, m.exports, m, path.dirname(resolved), resolved);
  return m.exports;
}

async function main() {
  loadEnvFile(path.resolve(__dirname, "..", ".env.local"));

  if (!process.env.MONGODB_URI) {
    console.error("[db:indexes] Error: MONGODB_URI is not configured.");
    process.exit(1);
  }

  const { getMongoClient, getDb } = loadTsModule(
    path.resolve(__dirname, "../src/lib/db/mongodb.ts")
  );
  const { ensureIndexes } = loadTsModule(
    path.resolve(__dirname, "../src/lib/db/models.ts")
  );

  let client;
  try {
    console.log("[db:indexes] Connecting to MongoDB...");
    client = await getMongoClient();
    const db = await getDb();
    console.log(`[db:indexes] Provisioning indexes on database "${db.databaseName}"...`);

    const provisioned = await ensureIndexes(db);

    for (const item of provisioned) {
      console.log(`  ✓ ${item.collection}: ${item.indexName}`);
    }

    console.log(`[db:indexes] Successfully provisioned ${provisioned.length} indexes.`);
  } catch (err) {
    console.error(
      "[db:indexes] Index provisioning failed:",
      err instanceof Error ? err.message : String(err)
    );
    process.exitCode = 1;
  } finally {
    if (client) {
      await client.close().catch(() => {});
    }
  }
}

main();
