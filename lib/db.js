import pg from "pg";
import { attachDatabasePool } from "@vercel/functions";
const globalPool = globalThis;
export const pool =
  globalPool.negotiationPool ||
  new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 20000,
  });
if (process.env.NODE_ENV !== "production") globalPool.negotiationPool = pool;
attachDatabasePool(pool);
export async function tenant(userId, fn) {
  if (typeof userId !== "string" || !userId || userId.length > 200)
    throw Error("Invalid principal");
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role negotiation_app");
    await client.query("select set_config('app.user_id',$1,true)", [userId]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
