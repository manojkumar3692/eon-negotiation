import fs from 'node:fs/promises';
import pg from 'pg';
if(process.env.NEON_BRANCH!=='dashboard-onboarding')throw Error('Connector migration is restricted to dashboard-onboarding.');
const c=new pg.Client({connectionString:process.env.DATABASE_URL_UNPOOLED});await c.connect();
try {await c.query('begin');await c.query(await fs.readFile(new URL('../db/migrations/002_connector_installations.sql',import.meta.url),'utf8'));await c.query('commit');console.log('Connector migration applied to development branch.');}
catch(e){await c.query('rollback');throw e;}finally{await c.end();}
