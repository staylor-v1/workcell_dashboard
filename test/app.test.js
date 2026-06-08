import test from 'node:test';
import assert from 'node:assert/strict';
import { factoryDesign, designMetrics } from '../src/data.js';
import { flowGraph, layoutSvg, tabs } from '../src/app.js';

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
