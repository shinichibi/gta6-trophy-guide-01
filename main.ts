// VICE LEDGER — entrypoint.
//
// Hands in the guide: copies the app (app/: the static frontend, opened at
// app/index.html) and its screenshots (screenshots/) from this repository into
// the output directory, then writes the entry's dossier.json there with
// make.fun's own dossier library, so the dossier is exactly what the scorer
// computes from the same files.
//
// Run it with Node 22+:  node main.ts
// The output directory is /output, or $MAKEFUN_OUTPUT_DIR when that is set.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
// Clear any earlier hand-in so the output holds exactly this repository's files.
rmSync(join(outDir, 'app'), { recursive: true, force: true });
rmSync(join(outDir, 'screenshots'), { recursive: true, force: true });
cpSync(join(repoRoot, 'app'), join(outDir, 'app'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 3, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 16777216,
});

const dossierPath = join(outDir, 'dossier.json');
writeFileSync(dossierPath, dossier);
console.log(`vice-ledger: app/ and screenshots/ copied to ${outDir}`);
console.log(`vice-ledger: dossier written to ${dossierPath} (${dossier.length} bytes)`);
