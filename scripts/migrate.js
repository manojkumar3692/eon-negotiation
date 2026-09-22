import fs from "node:fs/promises";
import pg from "pg";
if (
  process.env.NEON_BRANCH === "production" &&
  !process.argv.includes("--production")
)
  throw Error(
    "Use a development branch. Production requires explicit --production.",
  );
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED,
});
await client.connect();
try {
  await client.query("begin");
  await client.query(
    await fs.readFile(
      new URL("../db/migrations/001_dashboard.sql", import.meta.url),
      "utf8",
    ),
  );
  await client.query("commit");
  console.log("Dashboard migration applied to", process.env.NEON_BRANCH);
} catch (e) {
  await client.query("rollback");
  throw e;
} finally {
  await client.end();
}
