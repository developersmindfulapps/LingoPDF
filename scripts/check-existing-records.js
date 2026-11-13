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

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db("lingo_pdf");
  
  const totalCodes = await db.collection("activation_codes").countDocuments();
  console.log("Total activation_codes:", totalCodes);
  
  const docs = await db.collection("activation_codes").find().toArray();
  for (const doc of docs) {
    console.log({
      id: doc._id.toString(),
      status: doc.status,
      createdAt: doc.createdAt,
      expiresAt: doc.expiresAt,
      cleanupAt: doc.cleanupAt,
      consumedAt: doc.consumedAt,
    });
  }
  
  const totalBindings = await db.collection("device_bindings").countDocuments();
  console.log("Total device_bindings:", totalBindings);
  
  await client.close();
}

run().catch(console.error);
