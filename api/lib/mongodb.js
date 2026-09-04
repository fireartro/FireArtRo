import { MongoClient } from 'mongodb';

let connection;

export function resolveMongoUri(env = process.env) {
  return env.MONGODB_URI || env.MONGO_MONGODB_URI || env.MONGO_URL;
}

/** One pool per warm function; no implicit local database or frontend secrets. */
export async function getDatabase() {
  const uri = resolveMongoUri();
  const name = process.env.DB_NAME;
  if (!uri?.trim() || !name?.trim()) throw new Error('Database unavailable');
  if (!connection) {
    const client = new MongoClient(uri, {
      maxPoolSize: 5, serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000, socketTimeoutMS: 5000,
    });
    connection = client.connect().catch(async () => {
      connection = undefined;
      await client.close();
      throw new Error('Database unavailable');
    });
  }
  return (await connection).db(name);
}
