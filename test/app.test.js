import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { configSourceFiles, designToml, factoryDesign, factoryStep, designMetrics, getRenderEngine, getRenderResolution, omniversePackageFiles, omniverseUsd, renderBoardSvg, renderJobManifest, renderPrompt, renderViewPlan, reportPdf } from '../src/data.js';
import { appState, envelopeCadSvg, flowGraph, layoutSvg, renderEnvelope, renderExport, renderFlow, renderLayout, renderRenders, tabs, view, readJsonResponse } from '../src/app.js';
import { parseToml } from '../src/toml.js';
import { projectStateFromToml, projectTomlFromState, slugifyProjectName } from '../src/projects.js';
import { createProjectApi } from '../project-api.mjs';

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
    placedMachines: [{
      ...factoryDesign.machineCatalog[0],
      id: 'eos-m290-instance',
      catalogId: factoryDesign.machineCatalog[0].id,
      name: 'EOS M290 Instance',
      status: 'Placed',
      footprint: { x: 1.1, y: 0.8, w: 2.5, h: 1.3 },
    }],
    footprintOverrides: { prep: { x: 0.5, y: 0.25, w: 1.4, h: 0.9 } },
  });

  const markup = view();
  const toml = projectTomlFromState(appState);
  const restored = projectStateFromToml(toml, previousState);

  assert.match(markup, /Project dashboard/);
  assert.match(markup, /demo-workcell\.toml/);
  assert.match(markup, /data-project-create/);
  assert.match(markup, /data-load-project-id="demo-workcell"/);
  assert.match(toml, /\[project\]/);
  assert.match(toml, /\[\[placedMachines\]\]/);
  assert.match(toml, /\[\[footprintOverrides\]\]/);
  assert.equal(restored.currentProjectId, 'demo-workcell');
  assert.equal(restored.currentProjectName, 'Demo Workcell');
  assert.equal(restored.customEnvelope.length, 9.5);
  assert.equal(restored.placedMachines[0].catalogId, factoryDesign.machineCatalog[0].id);
  assert.equal(restored.footprintOverrides.prep.x, 0.5);
  assert.equal(slugifyProjectName('Factory Project!'), 'factory-project');

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
  const layoutMarkup = layoutSvg();
  const graphMarkup = flowGraph();
  assert.match(layoutMarkup, /Top down microfactory layout/);
  assert.match(layoutMarkup, /data-layout-pan-zoom="true"/);
  assert.match(layoutMarkup, /viewBox="-0\.12 -0\.12 12\.432 2\.678/);
  assert.match(layoutMarkup, /Precision Molding Island|Precision/);
  assert.match(layoutMarkup, /PMI-58/);
  assert.doesNotMatch(layoutMarkup, /58s takt/);
  assert.match(graphMarkup, /Finished tested product/);
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

test('selected layout machines expose footprint delete and reposition controls', () => {
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
  const result = spawnSync('node', ['scripts/render-factory.mjs', '--engine', 'mitsuba-3', '--width', '1234', '--height', '777', '--out', out], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const scene = JSON.parse(await readFile(join(out, 'scene.json'), 'utf8'));
  const manifest = await readFile(join(out, 'manifest.txt'), 'utf8');
  const mitsubaScene = await readFile(join(out, 'top-down.xml'), 'utf8');
  const luxMesh = await readFile(join(out, 'machine_0.ply'), 'utf8');

  assert.equal(scene.resolution.width, 1234);
  assert.equal(scene.resolution.height, 777);
  assert.equal(scene.assets.length, machines.length);
  assert.match(manifest, /Assets: 15 STEP files/);
  assert.match(mitsubaScene, /<scene version="3.0.0">/);
  assert.match(mitsubaScene, /sample_count" value="1024"/);
  assert.match(luxMesh, /element vertex 8/);
});
