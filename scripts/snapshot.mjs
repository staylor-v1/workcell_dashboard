import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { renderApp } from '../src/app.js';

const root = { innerHTML: '' };
renderApp(root);

const css = await readFile('src/styles.css', 'utf8');
const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><style>${css}</style></head><body>${root.innerHTML}</body></html>`;

await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/microfactory-studio.html', html);

const result = spawnSync('wkhtmltoimage', [
  '--width', '1440',
  '--height', '1200',
  '--quality', '92',
  'artifacts/microfactory-studio.html',
  'artifacts/microfactory-studio.png',
], { stdio: 'inherit' });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log('Snapshot written to artifacts/microfactory-studio.png');
