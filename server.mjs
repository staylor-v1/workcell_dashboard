import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { createProjectApi, readRequestJson } from './project-api.mjs';

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const handleProjectsRequest = createProjectApi({ root });
const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.toml', 'text/plain; charset=utf-8'],
  ['.step', 'model/step'],
  ['.json', 'application/json; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.cfg', 'text/plain; charset=utf-8'],
  ['.scn', 'text/plain; charset=utf-8'],
]);

function jsonResponse(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function handleRenderRequest(request, response) {
  try {
    const payload = await readRequestJson(request);
    const engineId = String(payload.engineId ?? 'blender-cycles');
    const resolution = payload.resolution ?? {};
    const width = Number(resolution.width ?? 2048);
    const height = Number(resolution.height ?? 1152);
    const out = `artifacts/render-jobs/${engineId}-${width}x${height}`;
    const result = spawnSync('node', [
      'scripts/render-factory.mjs',
      '--engine', engineId,
      '--width', String(width),
      '--height', String(height),
      '--out', out,
      '--execute', payload.execute === false ? 'false' : 'true',
    ], { cwd: root, encoding: 'utf8' });

    const resultBody = JSON.parse(await readFile(join(root, out, 'result.json'), 'utf8'));
    jsonResponse(response, result.status === 0 ? 200 : 202, {
      ...resultBody,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  } catch (error) {
    jsonResponse(response, 500, { error: error.message });
  }
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
  if (await handleProjectsRequest(request, response, url)) return;

  if (url.pathname === '/api/render' && request.method === 'POST') {
    await handleRenderRequest(request, response);
    return;
  }

  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = normalize(join(root, pathname));

  if (!file.startsWith(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': types.get(extname(file)) ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}).listen(port, () => {
  console.log(`Microfactory Studio available at http://localhost:${port}`);
});
