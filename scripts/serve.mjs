// Servidor estático mínimo para testar dist/ localmente (imita a Vercel com trailingSlash).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'dist');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.xml': 'application/xml', '.txt': 'text/plain' };

export function servir(porta = 4173) {
  const server = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let arquivo = path.join(DIST, p);
    if (!arquivo.startsWith(DIST)) { res.writeHead(403).end(); return; }
    try {
      if ((await stat(arquivo)).isDirectory()) {
        if (!p.endsWith('/')) { res.writeHead(308, { Location: p + '/' }).end(); return; }
        arquivo = path.join(arquivo, 'index.html');
      }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
      res.end(await readFile(arquivo));
    } catch {
      res.writeHead(404, { 'Content-Type': TIPOS['.html'] });
      res.end(await readFile(path.join(DIST, '404.html')).catch(() => 'Não encontrado'));
    }
  });
  return new Promise((ok) => server.listen(porta, () => ok(server)));
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const porta = Number(process.env.PORT) || 4173;
  await servir(porta);
  console.log(`Servindo dist/ em http://localhost:${porta}`);
}
