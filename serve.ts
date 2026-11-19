// serve.ts — the smallest useful web server: just enough to play
// Sunhaven locally.
//   node serve.ts                 → http://localhost:8080
//   node serve.ts --port 9000     → http://localhost:9000
// It serves only what lives inside game/, with the content types a
// browser game needs, and it refuses — politely, with a 403 — any path
// that tries to climb out of that folder.
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));

// --port takes the next argument; anything unusable falls back to 8080.
const argv = process.argv.slice(2);
const flagAt = argv.indexOf('--port');
const asked = flagAt === -1 ? 8080 : Number(argv[flagAt + 1]);
const port = Number.isInteger(asked) && asked > 0 && asked < 65536 ? asked : 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer((request, response) => {
  // A static game server reads; it does not take dictation.
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD' }).end('method not allowed');
    return;
  }
  const url = new URL(request.url ?? '/', 'http://localhost');
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400).end('bad request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';

  // Resolve inside the game folder, then prove the result stayed inside.
  const file = resolve(join(root, normalize(pathname)));
  if (file !== root && !file.startsWith(root + sep)) {
    response.writeHead(403).end('forbidden');
    return;
  }
  let size;
  try {
    const stats = statSync(file);
    if (!stats.isFile()) throw new Error('not a file');
    size = stats.size;
  } catch {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, {
    'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': size,
    'cache-control': 'no-store',   // a game under development is never stale on purpose
  });
  // A HEAD request gets the headers and nothing else.
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(file).pipe(response);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is taken — try: node serve.ts --port ${port + 1}`);
    process.exit(1);
  }
  throw err;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Sunhaven is on http://localhost:${port}`);
  // The screenshot scenes, straight from shots.json, ready to open.
  try {
    const shots = JSON.parse(readFileSync(join(repoRoot, 'shots.json'), 'utf8'));
    for (const shot of shots) console.log(`  ${shot.name}: http://localhost:${port}/${shot.query}`);
  } catch {
    console.log(`  screenshots: /?shot=chase&seed=7`);
  }
});
