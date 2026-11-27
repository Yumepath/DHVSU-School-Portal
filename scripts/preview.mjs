import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

const root = resolve('www');
await access(resolve(root, 'index.html')).catch(() => { throw new Error('Run npm run build before previewing.'); });
const port = Number(process.env.PREVIEW_PORT ?? 4200);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) return response.writeHead(405).end();
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    let filename = resolve(root, '.' + pathname);
    if (!filename.startsWith(root + sep) && filename !== root) return response.writeHead(404).end();
    const info = await stat(filename).catch(() => null);
    if (!info?.isFile()) {
      if (extname(pathname)) return response.writeHead(404).end();
      filename = resolve(root, 'index.html');
    }
    const type = types[extname(filename)] ?? 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' });
    if (request.method === 'HEAD') return response.end();
    createReadStream(filename).on('error', () => response.destroy()).pipe(response);
  } catch {
    response.writeHead(400).end();
  }
});
server.listen(port, '127.0.0.1', () => console.log('DHVSU portal preview at http://127.0.0.1:' + port));
