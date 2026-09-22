import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createChat } from './chat.js';
const demo = createChat();
const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
createServer(async (req, res) => {
 res.setHeader('X-Content-Type-Options', 'nosniff');
 res.setHeader('Cache-Control', 'no-store');
 try {
  if (req.url === '/api/demo' && req.method === 'POST') {
   let data = '';
   for await (const chunk of req) { data += chunk; if (Buffer.byteLength(data) > 8192) { res.writeHead(413); res.end(); return; } }
   const result = await demo(JSON.parse(data));
   res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(result)); return;
  }
  const file = files[req.url];
  if (!file || req.method !== 'GET') { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': file[1] }); res.end(await readFile(new URL('../public/' + file[0], import.meta.url)));
 } catch (e) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e.message })); }
}).listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log('Demo: http://localhost:' + (process.env.PORT || 3000)));
