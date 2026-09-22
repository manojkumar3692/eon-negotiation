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
  const directory=new URL("../db/migrations/",import.meta.url);
  const files=(await fs.readdir(directory)).filter(name=>name.endsWith(".sql")).sort();
  for(const file of files)await client.query(await fs.readFile(new URL(file,directory),"utf8"));
  await client.query("commit");
  console.log(`${files.length} migrations applied to`, process.env.NEON_BRANCH);
} catch (e) {
  await client.query("rollback");
  throw e;
} finally {
  await client.end();
}
