import test from 'node:test';
import assert from 'node:assert/strict';
import { factoryDesign, machineLibrary, designMetrics, renderPrompt } from '../src/data.js';
import { appState, flowGraph, layoutSvg, placeLibraryMachine, resetLayoutMachines, tabs } from '../src/app.js';

test('factory design contains required coordinated views', () => {
  assert.deepEqual(tabs.map((tab) => tab.id), ['summary', 'machines', 'layout', 'flow', 'renders']);
  assert.equal(factoryDesign.machines.length, 5);
  assert.equal(factoryDesign.flow.length, 5);
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

test('render profiles produce photorealistic prompts from the shared design', () => {
  assert.equal(factoryDesign.renderProfiles.length, 3);
  const prompt = renderPrompt(factoryDesign.renderProfiles[0]);
  assert.match(prompt, /Photorealistic industrial microfactory render/);
  assert.match(prompt, /24m x 14m scale/);
});


test('layout view offers a researched drag-and-drop machine palette', () => {
  const categories = new Set(machineLibrary.map((machine) => machine.category));
  assert.ok(categories.has('Metal 3D Printer'));
  assert.ok(categories.has('Wire EDM'));
  assert.ok(categories.has('CNC Mill'));
  assert.match(machineLibrary.map((machine) => machine.name).join(' | '), /Markforged Metal X/);
  assert.match(machineLibrary.map((machine) => machine.name).join(' | '), /Sodick ALN400G/);
  assert.match(machineLibrary.map((machine) => machine.name).join(' | '), /Haas Mini Mill/);
});

test('machines from the palette can be placed onto the layout model', () => {
  resetLayoutMachines();
  const initialCount = appState.layoutMachines.length;
  assert.equal(placeLibraryMachine('haas-mini-mill', 30, 30), true);
  assert.equal(appState.layoutMachines.length, initialCount + 1);
  const placed = appState.layoutMachines.at(-1);
  assert.equal(placed.id, 'haas-mini-mill-1');
  assert.equal(placed.name, 'Haas Mini Mill');
  assert.equal(placed.footprint.x <= factoryDesign.floorSize.width - placed.footprint.w - 0.6, true);
  assert.match(layoutSvg(), /Haas/);
  resetLayoutMachines();
});
