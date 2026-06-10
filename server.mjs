import { createServer } from 'node:http';
import { access, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { extname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProjectApi, readRequestJson } from './project-api.mjs';
import { factoryDesign } from './src/data.js';

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const handleProjectsRequest = createProjectApi({ root });
const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.toml', 'text/plain; charset=utf-8'],
  ['.step', 'model/step'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.json', 'application/json; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.cfg', 'text/plain; charset=utf-8'],
  ['.scn', 'text/plain; charset=utf-8'],
]);


function isInsideRoot(file) {
  return file === root || file.startsWith(`${root}${sep}`);
}

function jsonResponse(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}


async function existingRenderImages(resultBody) {
  const outputs = Array.isArray(resultBody.outputs) ? resultBody.outputs : [];
  const images = [];
  for (const output of outputs) {
    const outputPath = normalize(join(root, String(output)));
    if (!isInsideRoot(outputPath)) continue;
    try {
      await access(outputPath);
    } catch {
      continue;
    }
    const relativePath = relative(root, outputPath).split(sep).join('/');
    const outputName = relativePath.split('/').at(-1);
    const view = factoryDesign.renderViews.find((renderView) => renderView.output === outputName);
    images.push({
      path: relativePath,
      url: `/${relativePath}`,
      output: outputName,
      viewId: view?.id ?? '',
      viewTitle: view?.title ?? outputName,
      label: view ? `${view.title} render` : outputName,
    });
  }
  return images;
}

export async function handleRenderRequest(request, response) {
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

    let resultBody;
    try {
      resultBody = JSON.parse(await readFile(join(root, out, 'result.json'), 'utf8'));
    } catch (error) {
      const details = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
      jsonResponse(response, 500, {
        error: `Render worker did not produce a JSON result for ${engineId}: ${details || error.message}`,
        stdout: result.stdout,
        stderr: result.stderr,
      });
      return;
    }

    const outputImages = await existingRenderImages(resultBody);
    const missingOutputs = Array.isArray(resultBody.missingOutputs) ? resultBody.missingOutputs : [];
    const renderFailed = result.status !== 0 || missingOutputs.length > 0;
    jsonResponse(response, renderFailed ? 500 : 200, {
      ...resultBody,
      outputImages,
      stdout: result.stdout,
      stderr: result.stderr,
      ...(renderFailed ? { error: missingOutputs.length
        ? `Render worker finished without writing expected image files: ${missingOutputs.join(', ')}`
        : `Render worker failed for ${engineId}` } : {}),
    });
  } catch (error) {
    jsonResponse(response, 500, { error: error.message });
  }
}

export function createMicrofactoryServer() {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    if (await handleProjectsRequest(request, response, url)) return;

    if (url.pathname === '/api/render' && request.method === 'POST') {
      await handleRenderRequest(request, response);
      return;
    }

    const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = normalize(join(root, pathname));

    if (!isInsideRoot(file)) {
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
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createMicrofactoryServer().listen(port, () => {
    console.log(`Microfactory Studio available at http://localhost:${port}`);
  });
}
