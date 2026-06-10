import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { configSourceFiles, designToml, factoryDesign, factoryStep, designMetrics, getRenderEngine, getRenderResolution, omniversePackageFiles, omniverseUsd, renderBoardSvg, renderJobManifest, renderPrompt, renderViewPlan, reportPdf } from '../src/data.js';
import { appState, envelopeCadSvg, flowGraph, layoutSvg, renderEnvelope, renderExport, renderFlow, renderLayout, renderRenders, tabs, view, readJsonResponse } from '../src/app.js';
import { parseToml } from '../src/toml.js';
import { projectStateFromToml, projectTomlFromState, slugifyProjectName } from '../src/projects.js';
import { createProjectApi } from '../project-api.mjs';
import { createMicrofactoryServer } from '../server.mjs';
import { resolveExecutable } from '../scripts/render-factory.mjs';

test('factory design contains required coordinated views loaded from TOML source files', () => {
  assert.deepEqual(tabs.map((tab) => tab.id), ['projects', 'summary', 'machines', 'layout', 'envelope', 'flow', 'renders', 'export']);
  assert.deepEqual(configSourceFiles, [
    'config/factory.toml',
    'config/machines.toml',
    'config/layout.toml',
    'config/flow.toml',
    'config/envelopes.toml',
    'config/renders.toml',
    'config/export.toml',
    'config/ui.toml',
  ]);
  assert.equal(factoryDesign.name, 'Aster Microfactory Concept');
  assert.equal(factoryDesign.machines.length, 5);
  assert.equal(factoryDesign.machines[0].footprint.x, 1.2);
  assert.deepEqual(factoryDesign.machines[0].parameters[0], ['Dryer temp', '74 °C']);
  assert.equal(factoryDesign.flow.length, 5);
  assert.equal(factoryDesign.machineCatalog.length, 10);
  assert.equal(factoryDesign.envelopeOptions.length, 6);
  assert.deepEqual(factoryDesign.renderEngines.map((engine) => engine.name), ['Blender Cycles', 'LuxCoreRender', 'Mitsuba 3']);
  assert.deepEqual(factoryDesign.renderViews.map((view) => view.id), ['top-down', 'container-door', 'orthographic']);
  assert.deepEqual(factoryDesign.renderResolutions.map((resolution) => resolution.id), ['1k', '2k', '4k', 'custom']);
  assert.equal(factoryDesign.machines[0].assetPath, 'assets/machines/prep.step');
});


test('project dashboard lists TOML-backed projects and serializes autosave state', () => {
  const previousState = { ...appState, customEnvelope: { ...appState.customEnvelope }, customResolution: { ...appState.customResolution } };
  Object.assign(appState, {
    currentProjectId: 'demo-workcell',
    currentProjectName: 'Demo Workcell',
    projectStatus: 'Autosaved Demo Workcell.',
    projects: [{ id: 'demo-workcell', name: 'Demo Workcell', filename: 'demo-workcell.toml', updatedAt: '2026-06-09T00:00:00.000Z' }],
    projectReady: true,
    activeTab: 'projects',
    selectedEnvelopeId: 'custom',
    customEnvelope: { length: 9.5, width: 3.2, height: 2.8 },
    layoutEnvelopes: [{ instanceId: 'custom-pod-1', envelopeId: 'custom', customDimensions: { length: 9.5, width: 3.2, height: 2.8 } }],
    placedMachines: [{
      ...factoryDesign.machineCatalog[0],
      id: 'eos-m290-instance',
      catalogId: factoryDesign.machineCatalog[0].id,
      name: 'EOS M290 Instance',
      status: 'Placed',
      footprint: { x: 1.1, y: 0.8, w: 2.5, h: 1.3 },
    }],
    footprintOverrides: { prep: { x: 0.5, y: 0.25, w: 1.4, h: 0.9 } },
    collapsedMachineCategories: ['Metal additive'],
  });

  const markup = view();
  const toml = projectTomlFromState(appState);
  const restored = projectStateFromToml(toml, previousState);

  assert.match(markup, /Project dashboard/);
  assert.match(markup, /demo-workcell\.toml/);
  assert.match(markup, /data-project-create/);
  assert.match(markup, /data-load-project-id="demo-workcell"/);
  assert.match(toml, /\[project\]/);
  assert.match(toml, /\[\[layoutEnvelopes\]\]/);
  assert.match(toml, /\[\[placedMachines\]\]/);
  assert.match(toml, /\[\[footprintOverrides\]\]/);
  assert.match(toml, /collapsedMachineCategories = \["Metal additive"\]/);
  assert.equal(restored.currentProjectId, 'demo-workcell');
  assert.equal(restored.currentProjectName, 'Demo Workcell');
  assert.equal(restored.customEnvelope.length, 9.5);
  assert.equal(restored.layoutEnvelopes[0].customDimensions.length, 9.5);
  assert.equal(restored.placedMachines[0].catalogId, factoryDesign.machineCatalog[0].id);
  assert.equal(restored.footprintOverrides.prep.x, 0.5);
  assert.deepEqual(restored.collapsedMachineCategories, ['Metal additive']);
  assert.equal(slugifyProjectName('Factory Project!'), 'factory-project');

  Object.assign(appState, previousState);
});



test('new projects start with no machines and the default workflow is available as the last example project', () => {
  const previousState = { ...appState, removedMachineIds: [...appState.removedMachineIds], projects: [...appState.projects] };
  Object.assign(appState, {
    activeTab: 'projects',
    currentProjectId: '',
    currentProjectName: '',
    projects: [{ id: 'alpha-workcell', name: 'Alpha Workcell', filename: 'alpha-workcell.toml', updatedAt: '2026-06-09T00:00:00.000Z' }],
    removedMachineIds: factoryDesign.machines.map((machine) => machine.id),
    selectedMachineId: '',
  });

  const emptyProject = projectStateFromToml('[project]\nversion = 1\nid = \"empty\"\nname = \"Empty\"\n', {});
  const layoutMarkup = layoutSvg();
  const dashboardMarkup = view();
  const exampleIndex = dashboardMarkup.indexOf('data-load-project-id="example-default-workflow"');
  const savedProjectIndex = dashboardMarkup.indexOf('data-load-project-id="alpha-workcell"');

  assert.deepEqual(emptyProject.removedMachineIds, factoryDesign.machines.map((machine) => machine.id));
  assert.doesNotMatch(layoutMarkup, /data-layout-draggable="true"/);
  assert.match(layoutMarkup, /40ft Conex \/ ISO dry container/);
  assert.match(dashboardMarkup, /Example: default machine workflow/);
  assert.ok(exampleIndex > savedProjectIndex);

  Object.assign(appState, previousState);
});

test('layout view recovers when zoom or pan leaves an invalid viewBox after clicking the container', () => {
  const previousState = { ...appState, layoutViewBox: appState.layoutViewBox ? { ...appState.layoutViewBox } : null, layoutViewBoxEnvelopeKey: appState.layoutViewBoxEnvelopeKey };
  Object.assign(appState, {
    layoutViewBox: { x: Number.NaN, y: Number.POSITIVE_INFINITY, width: 0, height: Number.NaN },
    layoutViewBoxEnvelopeKey: 'conex-40:12.192:2.438',
  });

  const layoutMarkup = layoutSvg();

  assert.match(layoutMarkup, /viewBox="-0\.45 -0\.45 13\.092 3\.338/);
  assert.doesNotMatch(layoutMarkup, /NaN|Infinity/);
  assert.match(layoutMarkup, /40ft Conex \/ ISO dry container/);

  Object.assign(appState, previousState);
});

test('project API creates TOML projects with JSON responses', async () => {
  const projectDir = await mkdtemp(join(tmpdir(), 'workcell-projects-'));
  const handleProjectsRequest = createProjectApi({ root: process.cwd(), projectDir });
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (await handleProjectsRequest(request, response, url)) return;
    response.writeHead(404);
    response.end();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'API Smoke Project' }),
    });
    const result = await response.json();
    const saved = await readFile(join(projectDir, 'api-smoke-project.toml'), 'utf8');

    assert.equal(response.status, 201);
    assert.equal(result.id, 'api-smoke-project');
    assert.match(saved, /name = "API Smoke Project"/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});


test('render option cards stay brief with only renderer names and reference links', () => {
  const markup = renderRenders();
  const picker = markup.match(/<section class="render-engine-picker"[\s\S]*?<\/section>/)?.[0] ?? '';

  for (const engine of factoryDesign.renderEngines) {
    assert.match(picker, new RegExp(`<h3>${engine.name}</h3>`));
    assert.match(picker, new RegExp(`href="${engine.source_url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  }
  assert.doesNotMatch(picker, /render-engine-card__top|render-specs|render-settings-list|spp/);
});


test('renders tab explains renderer setup without requiring another app rebuild', () => {
  const previousState = { ...appState, selectedRenderEngineId: appState.selectedRenderEngineId, renderStatus: appState.renderStatus };
  Object.assign(appState, { selectedRenderEngineId: 'blender-cycles', renderStatus: '' });

  const markup = renderRenders();

  assert.match(markup, /No extra app rebuild is required/);
  assert.match(markup, /npm run build<\/code> only for production static assets/);
  assert.match(markup, /<code>blender<\/code>/);
  assert.match(markup, /<code>MICROFACTORY_BLENDER_BIN<\/code>/);
  assert.match(markup, /<code>npm run render -- --engine blender-cycles --resolution 2k --execute true<\/code>/);

  Object.assign(appState, previousState);
});

test('render view panels show their corresponding completed images instead of planning text', () => {
  const previousState = { ...appState, renderImages: [...appState.renderImages], fullscreenRenderImageIndex: appState.fullscreenRenderImageIndex };
  Object.assign(appState, {
    renderImages: factoryDesign.renderViews.map((renderView) => ({
      viewId: renderView.id,
      viewTitle: renderView.title,
      label: `${renderView.title} render`,
      output: renderView.output,
      url: `/artifacts/render-jobs/test/${renderView.output}`,
      path: `artifacts/render-jobs/test/${renderView.output}`,
    })),
    fullscreenRenderImageIndex: null,
  });

  const markup = renderRenders();
  const grid = markup.match(/<div class="render-view-grid">[\s\S]*?<\/div>\s*<section class="render-output-panel"/)?.[0] ?? '';

  assert.equal((grid.match(/class="render-view-card has-render-image"/g) ?? []).length, factoryDesign.renderViews.length);
  for (const renderView of factoryDesign.renderViews) {
    assert.match(grid, new RegExp(`<img src="/artifacts/render-jobs/test/${renderView.output.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
    assert.doesNotMatch(grid, new RegExp(`<h3>${renderView.output.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h3>`));
  }
  assert.doesNotMatch(grid, /render-view-card">[\s\S]*?<p>/);

  Object.assign(appState, previousState);
});

test('render API fails when a renderer reports success but writes none of the expected images', async () => {
  const fakeBinDir = await mkdtemp(join(tmpdir(), 'workcell-fake-renderer-'));
  const fakeBlender = join(fakeBinDir, 'fake-blender');
  const artifactDir = 'artifacts/render-jobs/blender-cycles-111x99';
  await writeFile(fakeBlender, '#!/bin/sh\nexit 0\n');
  await chmod(fakeBlender, 0o755);
  await rm(artifactDir, { recursive: true, force: true });
  const previousBlenderBin = process.env.MICROFACTORY_BLENDER_BIN;
  process.env.MICROFACTORY_BLENDER_BIN = fakeBlender;
  const server = createMicrofactoryServer().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/render`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ engineId: 'blender-cycles', resolution: { width: 111, height: 99 }, execute: true }),
    });
    const result = await readJsonResponse(response, 'Render job failed');

    assert.equal(response.status, 500);
    assert.match(result.error, /finished without writing expected image files/);
    assert.equal(result.missingOutputs.length, factoryDesign.renderViews.length);
    assert.deepEqual(result.outputImages, []);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    if (previousBlenderBin === undefined) delete process.env.MICROFACTORY_BLENDER_BIN;
    else process.env.MICROFACTORY_BLENDER_BIN = previousBlenderBin;
    await rm(artifactDir, { recursive: true, force: true });
    await rm(fakeBinDir, { recursive: true, force: true });
  }
});


test('Mitsuba render API reports missing images when the Python driver exits without outputs', async () => {
  const fakeBinDir = await mkdtemp(join(tmpdir(), 'workcell-fake-empty-mitsuba-python-'));
  const fakePython = join(fakeBinDir, 'python3');
  const artifactDir = 'artifacts/render-jobs/mitsuba-3-2048x1152';
  await writeFile(fakePython, `#!/bin/sh
if [ "$1" = "-c" ]; then
  exit 0
fi
exit 0
`);
  await chmod(fakePython, 0o755);
  await rm(artifactDir, { recursive: true, force: true });
  const previousPythonBin = process.env.MICROFACTORY_PYTHON_BIN;
  const previousMitsubaBin = process.env.MICROFACTORY_MITSUBA_BIN;
  process.env.MICROFACTORY_PYTHON_BIN = fakePython;
  process.env.MICROFACTORY_MITSUBA_BIN = join(fakeBinDir, 'missing-mitsuba');
  const server = createMicrofactoryServer().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/render`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ engineId: 'mitsuba-3', resolution: { width: 2048, height: 1152 }, execute: true }),
    });
    const result = await readJsonResponse(response, 'Mitsuba render job failed');

    assert.equal(response.status, 500);
    assert.match(result.error, /Render worker finished without writing expected image files/);
    assert.deepEqual(result.missingOutputs, factoryDesign.renderViews.map((renderView) => join(artifactDir, renderView.output)));
    assert.deepEqual(result.outputImages, []);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    if (previousPythonBin === undefined) delete process.env.MICROFACTORY_PYTHON_BIN;
    else process.env.MICROFACTORY_PYTHON_BIN = previousPythonBin;
    if (previousMitsubaBin === undefined) delete process.env.MICROFACTORY_MITSUBA_BIN;
    else process.env.MICROFACTORY_MITSUBA_BIN = previousMitsubaBin;
    await rm(artifactDir, { recursive: true, force: true });
    await rm(fakeBinDir, { recursive: true, force: true });
  }
});



test('Mitsuba render worker uses the Python from a pip-installed mitsuba launcher', async () => {
  const fakeBinDir = await mkdtemp(join(tmpdir(), 'workcell-fake-mitsuba-launcher-'));
  const fakePython = join(fakeBinDir, 'python-with-mitsuba');
  const fakeMitsuba = join(fakeBinDir, 'mitsuba');
  const out = await mkdtemp(join(tmpdir(), 'workcell-mitsuba-launcher-render-'));
  await writeFile(fakePython, `#!/bin/sh
if [ "$1" = "-c" ]; then
  exit 0
fi
mkdir -p "$(dirname "$3")"
printf 'fake launcher png bytes' > "$3"
`);
  await chmod(fakePython, 0o755);
  await writeFile(fakeMitsuba, `#!${fakePython}
# launcher body is intentionally unused; the worker should run the shebang Python directly.
`);
  await chmod(fakeMitsuba, 0o755);
  const previousPath = process.env.PATH;
  const previousPythonBin = process.env.MICROFACTORY_PYTHON_BIN;
  const previousMitsubaBin = process.env.MICROFACTORY_MITSUBA_BIN;
  process.env.PATH = `${fakeBinDir}${delimiter}${previousPath ?? ''}`;
  delete process.env.MICROFACTORY_PYTHON_BIN;
  delete process.env.MICROFACTORY_MITSUBA_BIN;

  try {
    const result = spawnSync('node', ['scripts/render-factory.mjs', '--engine', 'mitsuba-3', '--width', '88', '--height', '66', '--out', out, '--execute', 'true'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);

    const resultBody = JSON.parse(await readFile(join(out, 'result.json'), 'utf8'));
    assert.equal(resultBody.resolvedExecutable, fakeMitsuba);
    assert.ok(resultBody.mitsubaPythonCandidates.includes(fakePython));
    assert.equal(resultBody.resolvedMitsubaPythonExecutable, fakePython);
    assert.equal(resultBody.mitsubaPythonImportable, true);
    assert.deepEqual(resultBody.missingOutputs, []);
    assert.equal(resultBody.executed.length, factoryDesign.renderViews.length);
    for (const executed of resultBody.executed) {
      assert.equal(executed.command, fakePython);
      assert.equal(executed.args[0], join(out, 'mitsuba_python_render.py'));
    }
    for (const renderView of factoryDesign.renderViews) {
      assert.equal(await readFile(join(out, renderView.output), 'utf8'), 'fake launcher png bytes');
    }
  } finally {
    process.env.PATH = previousPath;
    if (previousPythonBin === undefined) delete process.env.MICROFACTORY_PYTHON_BIN;
    else process.env.MICROFACTORY_PYTHON_BIN = previousPythonBin;
    if (previousMitsubaBin === undefined) delete process.env.MICROFACTORY_MITSUBA_BIN;
    else process.env.MICROFACTORY_MITSUBA_BIN = previousMitsubaBin;
    await rm(out, { recursive: true, force: true });
    await rm(fakeBinDir, { recursive: true, force: true });
  }
});

test('Mitsuba render worker falls back to the Mitsuba CLI when Python cannot import Mitsuba', async () => {
  const fakeBinDir = await mkdtemp(join(tmpdir(), 'workcell-fake-mitsuba-cli-'));
  const fakePython = join(fakeBinDir, 'python3');
  const fakeMitsuba = join(fakeBinDir, 'mitsuba');
  const out = await mkdtemp(join(tmpdir(), 'workcell-mitsuba-cli-render-'));
  await writeFile(fakePython, `#!/bin/sh
if [ "$1" = "-c" ]; then
  echo "No module named mitsuba" >&2
  exit 1
fi
exit 0
`);
  await chmod(fakePython, 0o755);
  await writeFile(fakeMitsuba, `#!/bin/sh
out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then
    shift
    out="$1"
  fi
  shift
done
if [ -z "$out" ]; then
  echo "missing -o output" >&2
  exit 45
fi
mkdir -p "$(dirname "$out")"
printf 'fake mitsuba cli png bytes' > "$out"
`);
  await chmod(fakeMitsuba, 0o755);
  const previousPythonBin = process.env.MICROFACTORY_PYTHON_BIN;
  const previousMitsubaBin = process.env.MICROFACTORY_MITSUBA_BIN;
  process.env.MICROFACTORY_PYTHON_BIN = fakePython;
  process.env.MICROFACTORY_MITSUBA_BIN = fakeMitsuba;

  try {
    const result = spawnSync('node', ['scripts/render-factory.mjs', '--engine', 'mitsuba-3', '--width', '77', '--height', '55', '--out', out, '--execute', 'true'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);

    const resultBody = JSON.parse(await readFile(join(out, 'result.json'), 'utf8'));
    assert.equal(resultBody.engineId, 'mitsuba-3');
    assert.equal(resultBody.resolvedMitsubaPythonExecutable, null);
    assert.equal(resultBody.mitsubaPythonImportable, false);
    assert.equal(resultBody.resolvedExecutable, fakeMitsuba);
    assert.deepEqual(resultBody.missingOutputs, []);
    assert.equal(resultBody.executed.length, factoryDesign.renderViews.length);
    for (const executed of resultBody.executed) {
      assert.equal(executed.command, fakeMitsuba);
      assert.deepEqual(executed.args.slice(0, 3), ['-m', 'scalar_rgb', '-o']);
      assert.match(executed.args[3], /\.png$/);
      assert.match(executed.args[4], /\.xml$/);
    }
    for (const renderView of factoryDesign.renderViews) {
      assert.equal(await readFile(join(out, renderView.output), 'utf8'), 'fake mitsuba cli png bytes');
    }
  } finally {
    if (previousPythonBin === undefined) delete process.env.MICROFACTORY_PYTHON_BIN;
    else process.env.MICROFACTORY_PYTHON_BIN = previousPythonBin;
    if (previousMitsubaBin === undefined) delete process.env.MICROFACTORY_MITSUBA_BIN;
    else process.env.MICROFACTORY_MITSUBA_BIN = previousMitsubaBin;
    await rm(out, { recursive: true, force: true });
    await rm(fakeBinDir, { recursive: true, force: true });
  }
});

test('Mitsuba render worker uses the Python driver and records completed output images', async () => {
  const fakeBinDir = await mkdtemp(join(tmpdir(), 'workcell-fake-mitsuba-python-'));
  const fakePython = join(fakeBinDir, 'python3');
  const out = await mkdtemp(join(tmpdir(), 'workcell-mitsuba-render-'));
  await writeFile(fakePython, `#!/bin/sh
if [ "$1" = "-c" ]; then
  exit 0
fi
script="$1"
scene="$2"
out="$3"
if [ "$(basename "$script")" != "mitsuba_python_render.py" ]; then
  echo "unexpected Mitsuba driver script: $script" >&2
  exit 42
fi
case "$scene" in
  *.xml) ;;
  *)
  echo "expected an XML scene path" >&2
  exit 43
  ;;
esac
if [ -z "$out" ]; then
  echo "missing output path" >&2
  exit 44
fi
mkdir -p "$(dirname "$out")"
printf 'fake png bytes' > "$out"
`);
  await chmod(fakePython, 0o755);
  const previousPythonBin = process.env.MICROFACTORY_PYTHON_BIN;
  process.env.MICROFACTORY_PYTHON_BIN = fakePython;

  try {
    const result = spawnSync('node', ['scripts/render-factory.mjs', '--engine', 'mitsuba-3', '--width', '77', '--height', '55', '--out', out, '--execute', 'true'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);

    const resultBody = JSON.parse(await readFile(join(out, 'result.json'), 'utf8'));
    const driver = await readFile(join(out, 'mitsuba_python_render.py'), 'utf8');
    assert.equal(resultBody.engineId, 'mitsuba-3');
    assert.equal(resultBody.resolvedMitsubaPythonExecutable, fakePython);
    assert.deepEqual(resultBody.missingOutputs, []);
    assert.match(driver, /mi\.util\.write_bitmap\(output_path, image\)/);
    assert.equal(resultBody.executed.length, factoryDesign.renderViews.length);
    for (const executed of resultBody.executed) {
      assert.equal(executed.command, fakePython);
      assert.equal(executed.args[0], join(out, 'mitsuba_python_render.py'));
      assert.match(executed.args[1], /\.xml$/);
      assert.notEqual(executed.args[0], 'render');
    }
    for (const renderView of factoryDesign.renderViews) {
      assert.equal(await readFile(join(out, renderView.output), 'utf8'), 'fake png bytes');
    }
  } finally {
    if (previousPythonBin === undefined) delete process.env.MICROFACTORY_PYTHON_BIN;
    else process.env.MICROFACTORY_PYTHON_BIN = previousPythonBin;
    await rm(out, { recursive: true, force: true });
    await rm(fakeBinDir, { recursive: true, force: true });
  }
});

test('render API returns JSON job metadata for every render engine', async () => {
  const server = createMicrofactoryServer().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  try {
    for (const engine of factoryDesign.renderEngines) {
      const response = await fetch(`http://127.0.0.1:${port}/api/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ engineId: engine.id, resolution: { width: 320, height: 180 }, execute: false }),
      });
      const result = await readJsonResponse(response, 'Render job failed');

      assert.equal(response.status, 200);
      assert.equal(result.engineId, engine.id);
      assert.equal(result.outputs.length, factoryDesign.renderViews.length);
      assert.deepEqual(result.outputImages, []);
      assert.equal(result.executed.length, 0);
      assert.match(result.scene, /scene\.json$/);
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('server serves completed render image artifacts with image content types', async () => {
  const artifactPath = 'artifacts/render-jobs/test-static-output/top-down.png';
  await mkdir('artifacts/render-jobs/test-static-output', { recursive: true });
  await writeFile(artifactPath, 'fake png bytes');
  const server = createMicrofactoryServer().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/${artifactPath}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm('artifacts/render-jobs/test-static-output', { recursive: true, force: true });
  }
});

test('project API responses report empty or invalid JSON bodies clearly', async () => {
  await assert.rejects(
    readJsonResponse(new Response('', { status: 404 }), 'Project create failed'),
    /empty response from server/,
  );

  await assert.rejects(
    readJsonResponse(new Response('<h1>Not found</h1>', { status: 404 }), 'Project create failed'),
    /server returned non-JSON response/,
  );
});

test('design metrics identify the bottleneck from shared machine data', () => {
  const metrics = designMetrics(factoryDesign);
  assert.equal(metrics.machineCount, 5);
  assert.equal(metrics.bottleneck, 'Precision Molding Island');
  assert.equal(metrics.totalEnergy, 43.1);
});

test('layout and flow render from the same machine and flow model', () => {
  const previousState = { ...appState, removedMachineIds: [...appState.removedMachineIds], layoutViewBox: appState.layoutViewBox ? { ...appState.layoutViewBox } : null };
  Object.assign(appState, { removedMachineIds: [], selectedMachineId: 'prep', layoutViewBox: null, layoutViewBoxEnvelopeKey: '' });
  const layoutMarkup = layoutSvg();
  const graphMarkup = flowGraph();
  assert.match(layoutMarkup, /Top down microfactory layout/);
  assert.match(layoutMarkup, /data-layout-pan-zoom="true"/);
  assert.match(layoutMarkup, /viewBox="-0\.45 -0\.45 13\.092 3\.338/);
  assert.doesNotMatch(layoutMarkup, /floor-grid/);
  assert.doesNotMatch(layoutMarkup, /floor-boundary/);
  assert.doesNotMatch(layoutMarkup, /class="layout-machine[^>]*>\s*<rect[^>]*rx=/);
  assert.doesNotMatch(layoutMarkup, /class="envelope-boundary"[^>]*rx=/);
  assert.match(layoutMarkup, /Precision Molding Island|Precision/);
  assert.match(layoutMarkup, /PMI-58/);
  assert.doesNotMatch(layoutMarkup, /58s takt/);
  assert.match(graphMarkup, /Finished tested product/);

  Object.assign(appState, previousState);
});

test('flow view uses draggable divider instead of range slider control', () => {
  const flowMarkup = renderFlow();

  assert.match(flowMarkup, /data-resizable-split/);
  assert.match(flowMarkup, /data-split-divider/);
  assert.match(flowMarkup, /role="separator"/);
  assert.doesNotMatch(flowMarkup, /type="range"/);
  assert.doesNotMatch(flowMarkup, /splitRange/);
});

test('layout view exposes researched drag-and-drop industrial machine candidates', () => {
  const layoutMarkup = renderLayout();

  assert.match(layoutMarkup, /Drag-in machine menu/);
  assert.match(layoutMarkup, /data-catalog-machine-id="eos-m290"/);
  assert.match(layoutMarkup, /TRUMPF TruPrint 3000/);
  assert.match(layoutMarkup, /Nikon SLM Solutions SLM 280 2.0/);
  assert.match(layoutMarkup, /Mitsubishi MV1200S/);
  assert.match(layoutMarkup, /Brother SPEEDIO S300X2/);
  assert.match(layoutMarkup, /Working envelope/);
  assert.match(layoutMarkup, /Footprint/);
  assert.match(layoutMarkup, /250 × 250 × 325 mm/);
  assert.match(layoutMarkup, /2.5m × 1.3m/);
  assert.match(layoutMarkup, /300 × 400 × 300 mm travel/);
  assert.match(layoutMarkup, /1.08m × 2.463m/);
  assert.equal((layoutMarkup.match(/Working envelope/g) ?? []).length, factoryDesign.machineCatalog.length);
  assert.equal((layoutMarkup.match(/Footprint/g) ?? []).length, factoryDesign.machineCatalog.length);
  assert.match(layoutMarkup, /draggable="true"/);

  const nikon = factoryDesign.machineCatalog.find((machine) => machine.id === 'nikon-slm280-2');
  assert.equal(nikon.footprint.w, 3.15);
  assert.equal(nikon.footprint.h, 1.28);
  assert.match(nikon.sourceUrl, /System-Nikon-SLM280-2-02024\.pdf/);
});


test('machine palette categories can be collapsed and hidden from the drag catalog', () => {
  const previousState = { ...appState, collapsedMachineCategories: [...(appState.collapsedMachineCategories ?? [])] };
  Object.assign(appState, { collapsedMachineCategories: ['Metal additive'] });

  const layoutMarkup = renderLayout();

  assert.match(layoutMarkup, /data-toggle-machine-category="Metal additive"/);
  assert.match(layoutMarkup, /aria-expanded="false"/);
  assert.match(layoutMarkup, /<div class="machine-palette__items" id="machine-category-1" hidden>/);
  assert.match(layoutMarkup, /data-toggle-machine-category="Wire EDM"[^]*aria-expanded="true"/);

  Object.assign(appState, previousState);
});

test('selected layout machines expose footprint delete and reposition controls', () => {
  const previousState = { ...appState, removedMachineIds: [...appState.removedMachineIds], layoutViewBox: appState.layoutViewBox ? { ...appState.layoutViewBox } : null };
  Object.assign(appState, { removedMachineIds: [], selectedMachineId: 'prep', layoutViewBox: null, layoutViewBoxEnvelopeKey: '' });
  const layoutMarkup = layoutSvg();

  assert.match(layoutMarkup, /data-layout-draggable="true"/);
  assert.match(layoutMarkup, /aria-label="Select and drag Feedstock Prep Cell"/);
  assert.match(layoutMarkup, /class="layout-machine__delete"/);
  assert.match(layoutMarkup, /class="layout-machine__delete-hitbox"/);
  assert.match(layoutMarkup, /data-delete-machine-id="prep"/);
  assert.match(layoutMarkup, /aria-label="Delete Feedstock Prep Cell from layout"/);
  assert.match(layoutMarkup, /class="layout-machine__rotate"/);
  assert.match(layoutMarkup, /class="layout-machine__rotate-hitbox"/);
  assert.match(layoutMarkup, /data-rotate-machine-id="prep"/);
  assert.match(layoutMarkup, /aria-label="Rotate Feedstock Prep Cell footprint 90 degrees"/);

  Object.assign(appState, previousState);
});

test('render profiles and engines produce photorealistic prompts and one-click view plans', () => {
  assert.equal(factoryDesign.renderProfiles.length, 3);
  assert.equal(factoryDesign.renderEngines.length, 3);
  assert.equal(factoryDesign.renderViews.length, 3);

  const prompt = renderPrompt(factoryDesign.renderProfiles[0]);
  const engine = getRenderEngine('mitsuba-3');
  const resolution = getRenderResolution('4k');
  const viewPlan = renderViewPlan(engine, factoryDesign.renderViews[0], factoryDesign, resolution);
  const manifest = renderJobManifest(engine, factoryDesign, resolution);
  const renderMarkup = renderRenders();

  assert.match(prompt, /Photorealistic industrial microfactory render/);
  assert.match(prompt, /24m x 14m scale/);
  assert.match(viewPlan, /Mitsuba 3 Top down render/);
  assert.match(viewPlan, /1024 samples at 3840 × 2160/);
  assert.match(manifest, /container-door\.png/);
  assert.match(renderMarkup, /Blender Cycles/);
  assert.match(renderMarkup, /LuxCoreRender/);
  assert.match(renderMarkup, /Mitsuba 3/);
  assert.match(renderMarkup, /data-render-selected-engine="blender-cycles"/);
  assert.match(renderMarkup, /data-render-resolution-id="1k"/);
  assert.match(renderMarkup, /data-render-resolution-id="custom"/);
  assert.match(renderMarkup, /top-down\.png/);
  assert.match(renderMarkup, /container-door\.png/);
  assert.match(renderMarkup, /factory-orthographic\.png/);
});

test('renders tab shows completed output images with fullscreen controls', () => {
  const previousState = {
    renderImages: appState.renderImages,
    fullscreenRenderImageIndex: appState.fullscreenRenderImageIndex,
  };
  appState.renderImages = [
    { url: '/artifacts/render-jobs/blender-cycles-320x180/top-down.png', output: 'top-down.png' },
    { url: '/artifacts/render-jobs/blender-cycles-320x180/container-door.png', output: 'container-door.png' },
  ];
  appState.fullscreenRenderImageIndex = 1;

  const renderMarkup = renderRenders();

  assert.match(renderMarkup, /Completed outputs/);
  assert.match(renderMarkup, /data-render-image-index="0"/);
  assert.match(renderMarkup, /Click any image to view it fullscreen/);
  assert.match(renderMarkup, /render-fullscreen-modal/);
  assert.match(renderMarkup, /data-close-render-fullscreen="true"/);
  assert.match(renderMarkup, /container-door\.png/);

  Object.assign(appState, previousState);
});

test('browser entrypoint loads stylesheet from HTML and keeps JavaScript browser-safe', async () => {
  const [html, main] = await Promise.all([
    readFile('index.html', 'utf8'),
    readFile('src/main.js', 'utf8'),
  ]);

  assert.match(html, /<title>Microfactory Studio<\/title>/);
  assert.match(html, /<link rel="stylesheet" href="\/src\/styles\.css" \/>/);
  assert.doesNotMatch(main, /import\s+['"].*\.css['"]/);
});


test('envelope tab provides researched defaults, custom dimensions, and CAD previews', () => {
  const envelopeMarkup = renderEnvelope();
  const cadMarkup = envelopeCadSvg(factoryDesign.envelopeOptions[0]);

  assert.match(envelopeMarkup, /40ft Conex \/ ISO dry container/);
  assert.match(envelopeMarkup, /20ft Conex \/ ISO dry container/);
  assert.match(envelopeMarkup, /Custom envelope/);
  assert.match(envelopeMarkup, /data-custom-dimension="length"/);
  assert.match(envelopeMarkup, /Layout envelope list/);
  assert.match(envelopeMarkup, /data-add-layout-envelope="conex-40"/);
  assert.match(envelopeMarkup, /data-remove-layout-envelope="primary-envelope"/);
  assert.match(cadMarkup, /CAD preview for 40ft Conex/);
  assert.equal(factoryDesign.envelopeOptions[0].cadModel.assetPath, 'assets/envelopes/conex-40.step');
});

test('envelope STEP assets exist for every selectable envelope option', async () => {
  for (const envelope of factoryDesign.envelopeOptions) {
    const step = await readFile(envelope.cadModel.assetPath, 'utf8');
    assert.match(step, /ISO-10303-21/);
    assert.ok(step.includes(envelope.id));
    assert.match(step, /cad_source/);
  }
});

test('export tab generates Omniverse USD, STEP, TOML, render-board SVG, and PDF package content', () => {
  const exportMarkup = renderExport();
  const step = factoryStep();
  const toml = designToml();
  const svg = renderBoardSvg();
  const pdf = reportPdf();
  const usd = omniverseUsd();
  const omniverseFiles = omniversePackageFiles();

  assert.match(exportMarkup, /NVIDIA Omniverse USD package/);
  assert.match(exportMarkup, /Professional CAD STEP assembly/);
  assert.match(exportMarkup, /Download \.zip/);
  assert.match(exportMarkup, /Download \.step/);
  assert.match(exportMarkup, /Download \.toml/);
  assert.match(exportMarkup, /Download \.svg/);
  assert.match(exportMarkup, /Download \.pdf/);
  assert.match(step, /ISO-10303-21/);
  assert.match(step, /professional CAD STEP assembly/i);
  assert.match(step, /CAD_PLACEMENT_prep/);
  assert.match(usd, /#usda 1\.0/);
  assert.match(usd, /defaultPrim = "Factory"/);
  assert.match(usd, /assetPath = "assets\/machines\/prep.step"/);
  assert.deepEqual(omniverseFiles.map((file) => file.path), ['factory.usda', 'materials.usda', 'manifest.json', 'README.md']);
  assert.match(toml, /\[envelope\]/);
  assert.match(toml, /\[\[renderEngines\]\]/);
  assert.match(toml, /\[\[renderViews\]\]/);
  assert.match(toml, /\[\[renderResolutions\]\]/);
  assert.match(toml, /assetPath = "assets\/machines\/prep.step"/);
  assert.equal(parseToml(toml).envelope.id, factoryDesign.envelopeOptions[0].id);
  assert.match(svg, /Photorealistic render board/);
  assert.match(pdf, /%PDF-1\.4/);
});


test('renderer executable discovery honors direct PATH lookup and Windows PATHEXT', async () => {
  const binDir = await mkdtemp(join(tmpdir(), 'microfactory-render-bin-'));
  const posixMitsuba = join(binDir, 'mitsuba');
  const windowsMitsuba = join(binDir, 'mitsuba.EXE');
  await writeFile(posixMitsuba, '#!/bin/sh\nexit 0\n');
  await chmod(posixMitsuba, 0o755);
  await writeFile(windowsMitsuba, '');

  assert.equal(resolveExecutable('mitsuba', { platform: 'linux', env: { PATH: binDir } }), posixMitsuba);
  assert.equal(resolveExecutable('mitsuba', { platform: 'win32', env: { Path: binDir, PATHEXT: '.EXE;.CMD' } }), windowsMitsuba);
});

test('machine STEP assets exist for every layout-available machine and render script writes deterministic scenes', async () => {
  const machines = [...factoryDesign.machines, ...factoryDesign.machineCatalog];
  assert.equal(machines.length, 15);

  for (const machine of machines) {
    const step = await readFile(machine.assetPath, 'utf8');
    assert.match(step, /ISO-10303-21/);
    assert.ok(step.includes(machine.id));
    assert.match(step, /dimension_source/);
  }

  const out = await mkdtemp(join(tmpdir(), 'microfactory-render-'));
  const result = spawnSync('node', ['scripts/render-factory.mjs', '--engine', 'mitsuba-3', '--width', '1234', '--height', '777', '--samples', '4', '--out', out], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const scene = JSON.parse(await readFile(join(out, 'scene.json'), 'utf8'));
  const manifest = await readFile(join(out, 'manifest.txt'), 'utf8');
  const mitsubaScene = await readFile(join(out, 'top-down.xml'), 'utf8');
  const luxMesh = await readFile(join(out, 'machine_0.ply'), 'utf8');

  assert.equal(scene.resolution.width, 1234);
  assert.equal(scene.resolution.height, 777);
  assert.equal(scene.engine.samples, 4);
  assert.equal(scene.assets.length, machines.length);
  assert.match(manifest, /Assets: 15 STEP files/);
  assert.match(mitsubaScene, /<scene version="3.0.0">/);
  assert.match(mitsubaScene, /<scale x="28" y="28"\/>/);
  assert.match(mitsubaScene, /sample_count" value="4"/);
  assert.match(mitsubaScene, /<emitter type="point">/);
  assert.doesNotMatch(mitsubaScene, /<shape type="rectangle">/);
  assert.match(luxMesh, /element vertex 8/);
});
