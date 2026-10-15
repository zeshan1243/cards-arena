// Generate backend parity fixtures from the TypeScript engines.
//   node scripts/export-replays.mjs <slug-folder> [<slug-folder> ...]
//   e.g. node scripts/export-replays.mjs court-piece twenty-nine
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const folders = process.argv.slice(2);
if (!folders.length) {
  console.error('usage: node scripts/export-replays.mjs <game-folder> ...');
  process.exit(1);
}
const outDir = resolve('../backend/tests/fixtures/replays');
mkdirSync(outDir, { recursive: true });
mkdirSync('dist/scripts', { recursive: true });

for (const folder of folders) {
  const outfile = resolve(`dist/scripts/export-${folder}.mjs`);
  await build({
    stdin: {
      contents: `
        import { definition } from './src/app/games/${folder}/${folder}.definition';
        import { exportReplays } from './src/app/games/core/replay-export';
        export const fixtures = exportReplays(definition);
      `,
      resolveDir: resolve('.'),
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    logLevel: 'warning',
  });
  const { fixtures } = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
  const slug = fixtures[0].slug;
  writeFileSync(`${outDir}/${slug}.json`, JSON.stringify(fixtures, null, 1));
  console.log(`${slug}: wrote ${fixtures.length} games`);
}
