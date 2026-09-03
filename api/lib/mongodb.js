import { MongoClient } from 'mongodb';

let connection;

/** One pool per warm function; no implicit local database or frontend secrets. */
export async function getDatabase() {
  const uri = process.env.MONGODB_URI;
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
