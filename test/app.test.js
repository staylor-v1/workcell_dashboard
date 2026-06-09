import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { configSourceFiles, designToml, factoryDesign, factoryStep, designMetrics, renderBoardSvg, renderPrompt, reportPdf } from '../src/data.js';
import { envelopeCadSvg, flowGraph, layoutSvg, renderEnvelope, renderExport, renderLayout, tabs } from '../src/app.js';
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

test('layout view exposes researched drag-and-drop industrial machine candidates', () => {
  const layoutMarkup = renderLayout();

  assert.match(layoutMarkup, /Drag-in machine menu/);
  assert.match(layoutMarkup, /data-catalog-machine-id="eos-m290"/);
  assert.match(layoutMarkup, /TRUMPF TruPrint 3000/);
  assert.match(layoutMarkup, /Mitsubishi MV1200S/);
  assert.match(layoutMarkup, /Brother SPEEDIO S300X2/);
  assert.match(layoutMarkup, /draggable="true"/);
});

test('render profiles produce photorealistic prompts from the shared design', () => {
  assert.equal(factoryDesign.renderProfiles.length, 3);
  const prompt = renderPrompt(factoryDesign.renderProfiles[0]);
  assert.match(prompt, /Photorealistic industrial microfactory render/);
  assert.match(prompt, /24m x 14m scale/);
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
  assert.equal(parseToml(toml).envelope.id, factoryDesign.envelopeOptions[0].id);
  assert.match(svg, /Photorealistic render board/);
  assert.match(pdf, /%PDF-1\.4/);
});
