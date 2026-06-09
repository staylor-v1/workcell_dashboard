import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, join } from 'node:path';

function jsonResponse(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

export function readRequestJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) reject(new Error('Request body too large'));
    });
    request.on('end', () => resolve(body ? JSON.parse(body) : {}));
    request.on('error', reject);
  });
}

function projectIdFromPath(pathname) {
  const id = decodeURIComponent(pathname.replace(/^\/api\/projects\/?/, '')).replace(/\.toml$/, '');
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(id)) throw new Error('Invalid project id');
  return id;
}

function slugifyProjectName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'untitled-project';
}

function projectNameFromToml(contents, fallback) {
  const match = contents.match(/^name\s*=\s*"((?:\\.|[^"])*)"/m);
  if (!match) return fallback;
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return fallback;
  }
}

export function createProjectApi({ root = process.cwd(), projectDir = process.env.PROJECT_SAVE_DIR || 'projects' } = {}) {
  const projectSaveDir = isAbsolute(projectDir) ? projectDir : join(root, projectDir);
  const projectPath = (projectId) => join(projectSaveDir, `${projectId}.toml`);

  async function ensureProjectDir() {
    await mkdir(projectSaveDir, { recursive: true });
  }

  async function uniqueProjectId(name) {
    const base = slugifyProjectName(name);
    let id = base;
    let suffix = 2;
    while (true) {
      try {
        await stat(projectPath(id));
        id = `${base}-${suffix}`;
        suffix += 1;
      } catch {
        return id;
      }
    }
  }

  return async function handleProjectsRequest(request, response, url) {
    if (!url.pathname.startsWith('/api/projects')) return false;

    try {
      await ensureProjectDir();
      if (url.pathname === '/api/projects' && request.method === 'GET') {
        const entries = await readdir(projectSaveDir, { withFileTypes: true });
        const projects = await Promise.all(entries
          .filter((entry) => entry.isFile() && entry.name.endsWith('.toml'))
          .map(async (entry) => {
            const id = basename(entry.name, '.toml');
            const file = projectPath(id);
            const [contents, stats] = await Promise.all([readFile(file, 'utf8'), stat(file)]);
            return {
              id,
              name: projectNameFromToml(contents, id),
              filename: entry.name,
              updatedAt: stats.mtime.toISOString(),
            };
          }));
        projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        jsonResponse(response, 200, projects);
        return true;
      }

      if (url.pathname === '/api/projects' && request.method === 'POST') {
        const payload = await readRequestJson(request);
        const name = String(payload.name ?? 'Untitled project').trim() || 'Untitled project';
        const id = await uniqueProjectId(name);
        const now = new Date().toISOString();
        await writeFile(projectPath(id), `[project]\nversion = 1\nid = "${id}"\nname = ${JSON.stringify(name)}\nupdatedAt = "${now}"\n`, 'utf8');
        jsonResponse(response, 201, { id, name, updatedAt: now });
        return true;
      }

      if (url.pathname.startsWith('/api/projects/') && request.method === 'GET') {
        const id = projectIdFromPath(url.pathname);
        const contents = await readFile(projectPath(id), 'utf8');
        jsonResponse(response, 200, { id, contents });
        return true;
      }

      if (url.pathname.startsWith('/api/projects/') && request.method === 'PUT') {
        const id = projectIdFromPath(url.pathname);
        const payload = await readRequestJson(request);
        if (typeof payload.contents !== 'string') throw new Error('Project contents must be a string');
        await writeFile(projectPath(id), payload.contents, 'utf8');
        jsonResponse(response, 200, { id, updatedAt: new Date().toISOString() });
        return true;
      }
    } catch (error) {
      jsonResponse(response, 400, { error: error.message });
      return true;
    }
    return false;
  };
}
