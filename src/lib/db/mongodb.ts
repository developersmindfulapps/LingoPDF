import dns from "node:dns";
import { MongoClient, Db } from "mongodb";

// Resolve Atlas SRV records reliably in local development on networks where local DNS blocks querySrv
if (process.env.NODE_ENV === "development") {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch {
    // Graceful fallback
  }
}

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const dbName = process.env.MONGODB_DB || "lingo_pdf";

let clientPromise: Promise<MongoClient> | null = null;

if (process.env.MONGODB_URI) {
  const uri = process.env.MONGODB_URI;
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri);
      global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    const client = new MongoClient(uri);
    clientPromise = client.connect();
  }
  // Attach rejection handler to prevent process crash on network/DNS errors before query execution
  clientPromise.catch(() => {});
}

/**
 * Gets a connected MongoDB client.
 * Throws a clean, safe configuration error if MONGODB_URI is not set.
 */
export async function getMongoClient(): Promise<MongoClient> {
  const currentUri = process.env.MONGODB_URI;
  if (!currentUri) {
    throw new Error("MONGODB_NOT_CONFIGURED");
  }
  if (!clientPromise) {
    if (process.env.NODE_ENV === "development") {
      if (!global._mongoClientPromise) {
        const client = new MongoClient(currentUri);
        global._mongoClientPromise = client.connect();
      }
      clientPromise = global._mongoClientPromise;
    } else {
      const client = new MongoClient(currentUri);
      clientPromise = client.connect();
    }
    clientPromise.catch(() => {});
  }
  return clientPromise;
}

/**
 * Gets the LingoPDF MongoDB database instance.
 */
export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(dbName);
}
