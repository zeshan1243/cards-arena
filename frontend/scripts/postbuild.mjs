// Runs after `npm run build` (npm "postbuild" hook):
//  - sitemap.xml from the prerendered pages, so new games are listed automatically;
//  - 404.html (the client-side app shell) so Vercel answers unknown URLs with a real 404.
import { copyFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SITE = 'https://www.cardsarena.world';
const OUT = 'dist/frontend/browser';
const PRIORITY = { '/': '1.0', '/games': '0.9', '/about': '0.4', '/contact': '0.3', '/privacy': '0.3' };

function pages(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'ads' ? [] : pages(path);
    return name === 'index.html' ? [path] : [];
  });
}

const today = new Date().toISOString().slice(0, 10);
const urls = pages(OUT)
  .map((file) => '/' + relative(OUT, file).replace(/\/?index\.html$/, ''))
  .sort((a, b) => (PRIORITY[b] ?? '0.8').localeCompare(PRIORITY[a] ?? '0.8') || a.localeCompare(b));

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((u) => `  <url><loc>${SITE}${u === '/' ? '/' : u}</loc><lastmod>${today}</lastmod><priority>${PRIORITY[u] ?? '0.8'}</priority></url>`),
  '</urlset>',
  '',
].join('\n');
writeFileSync(join(OUT, 'sitemap.xml'), xml);
copyFileSync(join(OUT, 'index.csr.html'), join(OUT, '404.html'));
console.log(`postbuild: sitemap.xml (${urls.length} URLs), 404.html`);
