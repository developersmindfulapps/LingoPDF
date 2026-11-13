/* eslint-disable */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

function loadEnvFile(envFilePath) {
  if (!fs.existsSync(envFilePath)) return;
  const content = fs.readFileSync(envFilePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));

async function inspectAtlasIndexes() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("lingo_pdf");

  const cols = ["activation_codes", "device_bindings", "entitlements", "licence_challenges"];
  for (const c of cols) {
    console.log(`\n=== COLLECTION: ${c} ===`);
    try {
      const indexes = await db.collection(c).indexes();
      for (const idx of indexes) {
        console.log(`- Index Name: "${idx.name}"`);
        console.log(`  Key: ${JSON.stringify(idx.key)}`);
        if (idx.unique) console.log(`  Unique: ${idx.unique}`);
        if (idx.partialFilterExpression) console.log(`  Partial Filter: ${JSON.stringify(idx.partialFilterExpression)}`);
        if (idx.expireAfterSeconds !== undefined) console.log(`  expireAfterSeconds: ${idx.expireAfterSeconds}`);
        if (idx.sparse) console.log(`  Sparse: ${idx.sparse}`);
      }
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }
  await client.close();
}

inspectAtlasIndexes().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
