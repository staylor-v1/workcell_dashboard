import { mkdir, cp, copyFile, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/src', { recursive: true });
await copyFile('index.html', 'dist/index.html');
await cp('src', 'dist/src', { recursive: true });
await cp('config', 'dist/config', { recursive: true });
await cp('assets', 'dist/assets', { recursive: true });
console.log('Static app built into dist/');
