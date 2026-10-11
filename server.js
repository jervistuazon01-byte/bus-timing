const http = require('http');
const fs = require('fs');
const path = require('path');
const { createHandler } = require('./lib/lta');
const ASSETS = new Set(['index.html', 'app.js', 'api.js', 'style.css', 'minimal-ui.css', 'manifest.json', 'icon.png', 'service-worker.js']);
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
function createServer({ publicDir = path.join(__dirname, 'public'), apiKey, request } = {}) {
 const handlers = { '/api/bus-arrival': createHandler('arrival', { apiKey, request }), '/api/bus-stops': createHandler('stops', { apiKey, request }) };
 return http.createServer(async (req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400).end(); return; }
  if (handlers[pathname]) return handlers[pathname](req, res);
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  const target = path.resolve(publicDir, name);
  const relative = path.relative(publicDir, target);
  if (pathname.includes('\\') || name.split('/').some(part => part.startsWith('.')) || relative.startsWith('..') || path.isAbsolute(relative) || !ASSETS.has(name)) { res.writeHead(404).end(); return; }
  try {
   const root = await fs.promises.realpath(publicDir);
   const real = await fs.promises.realpath(target);
   const actualRelative = path.relative(root, real);
   if (actualRelative.startsWith('..') || path.isAbsolute(actualRelative)) { res.writeHead(404).end(); return; }
   const content = await fs.promises.readFile(real);
   res.writeHead(200, { 'Content-Type': MIME[path.extname(name)], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
   res.end(req.method === 'HEAD' ? undefined : content);
  } catch { res.writeHead(404).end(); }
 });
}
if (require.main === module) {
 let apiKey = process.env.LTA_API_KEY;
 if (!apiKey) { try { apiKey = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/^LTA_API_KEY=(.*)$/m)?.[1].trim(); } catch {} }
 const port = Number(process.env.PORT || 3000);
 createServer({ apiKey }).listen(port, '127.0.0.1', () => console.log('SG Bus Timing: http://localhost:' + port));
}
module.exports = { createServer };
