import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { configSourceFiles, designToml, factoryDesign, factoryStep, designMetrics, getRenderEngine, getRenderResolution, renderBoardSvg, renderJobManifest, renderPrompt, renderViewPlan, reportPdf } from '../src/data.js';
import { envelopeCadSvg, flowGraph, layoutSvg, renderEnvelope, renderExport, renderFlow, renderLayout, renderRenders, tabs } from '../src/app.js';
import { parseToml } from '../src/toml.js';

test('factory design contains required coordinated views loaded from TOML source files', () => {
  assert.deepEqual(tabs.map((tab) => tab.id), ['summary', 'machines', 'layout', 'envelope', 'flow', 'renders', 'export']);
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
  assert.equal(factoryDesign.machineCatalog.length, 9);
  assert.equal(factoryDesign.envelopeOptions.length, 6);
  assert.deepEqual(factoryDesign.renderEngines.map((engine) => engine.name), ['Blender Cycles', 'LuxCoreRender', 'Mitsuba 3']);
  assert.deepEqual(factoryDesign.renderViews.map((view) => view.id), ['top-down', 'container-door', 'orthographic']);
  assert.deepEqual(factoryDesign.renderResolutions.map((resolution) => resolution.id), ['1k', '2k', '4k', 'custom']);
  assert.equal(factoryDesign.machines[0].assetPath, 'assets/machines/prep.step');
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
  assert.match(layoutMarkup, /Precision Molding Island|Precision/);
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
  assert.match(layoutMarkup, /Mitsubishi MV1200S/);
  assert.match(layoutMarkup, /Brother SPEEDIO S300X2/);
  assert.match(layoutMarkup, /draggable="true"/);
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
});

test('export tab generates STEP, TOML, render-board SVG, and PDF package content', () => {
  const exportMarkup = renderExport();
  const step = factoryStep();
  const toml = designToml();
  const svg = renderBoardSvg();
  const pdf = reportPdf();

  assert.match(exportMarkup, /Download \.step/);
  assert.match(exportMarkup, /Download \.toml/);
  assert.match(exportMarkup, /Download \.svg/);
  assert.match(exportMarkup, /Download \.pdf/);
  assert.match(step, /ISO-10303-21/);
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
  assert.equal(machines.length, 14);

  for (const machine of machines) {
    const step = await readFile(machine.assetPath, 'utf8');
    assert.match(step, /ISO-10303-21/);
    assert.ok(step.includes(machine.id));
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
  assert.match(manifest, /Assets: 14 STEP files/);
  assert.match(mitsubaScene, /<scene version="3.0.0">/);
  assert.match(mitsubaScene, /sample_count" value="1024"/);
  assert.match(luxMesh, /element vertex 8/);
});
