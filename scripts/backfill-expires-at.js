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

async function backfill() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db("lingo_pdf");
  const codes = await db.collection("activation_codes").find({ expiresAt: { $exists: false } }).toArray();
  for (const c of codes) {
    const originalExpiry = new Date(c.createdAt.getTime() + 10 * 60 * 1000);
    await db.collection("activation_codes").updateOne(
      { _id: c._id },
      { $set: { expiresAt: originalExpiry } }
    );
    console.log("Backfilled code:", c._id.toString(), "expiresAt:", originalExpiry.toISOString());
  }
  await client.close();
}

backfill().catch(console.error);
