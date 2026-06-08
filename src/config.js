import { parseToml } from './toml.js';

const configFiles = [
  'config/factory.toml',
  'config/machines.toml',
  'config/layout.toml',
  'config/flow.toml',
  'config/envelopes.toml',
  'config/renders.toml',
  'config/export.toml',
  'config/ui.toml',
];

async function readConfigFile(path) {
  if (globalThis.window?.fetch) {
    const response = await fetch(`/${path}`);
    if (!response.ok) throw new Error(`Unable to load ${path}: ${response.status}`);
    return response.text();
  }

  const { readFile } = await import('node:fs/promises');
  return readFile(path, 'utf8');
}

export async function loadConfig(files = configFiles) {
  const loaded = await Promise.all(files.map(async (path) => [path, parseToml(await readConfigFile(path))]));
  return Object.fromEntries(loaded);
}

function normalizeParameters(parameters = []) {
  return parameters.map((parameter) => [parameter.label, parameter.value]);
}

function normalizeMachines(machines = []) {
  return machines.map((machine) => ({
    ...machine,
    parameters: normalizeParameters(machine.parameters),
  }));
}

function normalizeMachineCatalog(machineCatalog = []) {
  return machineCatalog.map((machine) => ({
    ...machine,
    parameters: normalizeParameters(machine.parameters),
  }));
}

function normalizeFlowLinks(links = []) {
  return links.map(({ from, to }) => [from, to]);
}

export function buildFactoryDesign(config) {
  const factory = config['config/factory.toml'];
  const machines = config['config/machines.toml'];
  const layout = config['config/layout.toml'];
  const flow = config['config/flow.toml'];
  const envelopes = config['config/envelopes.toml'];
  const renders = config['config/renders.toml'];
  const exports = config['config/export.toml'];
  const ui = config['config/ui.toml'];

  return {
    name: factory.project.name,
    product: factory.project.product,
    throughput: factory.project.throughput,
    taktTime: factory.project.takt_time,
    floorSize: factory.floor_size,
    machines: normalizeMachines(machines.machines),
    machineCatalog: normalizeMachineCatalog(machines.machine_catalog),
    flow: flow.flow,
    flowLinks: normalizeFlowLinks(layout.flow_links),
    envelopeOptions: envelopes.envelopes,
    exportPackages: exports.export_packages,
    exportMetadata: exports.metadata,
    renderProfiles: renders.render_profiles,
    ui: {
      tabs: ui.tabs,
      brand: ui.brand,
      defaults: ui.defaults,
    },
  };
}

export const configSourceFiles = configFiles;
export const config = await loadConfig();
export const factoryDesign = buildFactoryDesign(config);
