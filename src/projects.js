import { factoryDesign } from './data.js';
import { parseToml } from './toml.js';

const TOML_PROJECT_VERSION = 1;

export function slugifyProjectName(name, fallback = 'untitled-project') {
  const slug = String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || fallback;
}

function tomlString(value) {
  return JSON.stringify(String(value ?? ''));
}

function tomlValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map(tomlValue).join(', ')}]`;
  return tomlString(value);
}

function field(key, value) {
  return `${key} = ${tomlValue(value)}`;
}

function footprintFields(footprint = {}) {
  return [
    field('x', Number(footprint.x ?? 0)),
    field('y', Number(footprint.y ?? 0)),
    field('w', Number(footprint.w ?? 0)),
    field('h', Number(footprint.h ?? 0)),
  ];
}

export function projectTomlFromState(state) {
  const lines = [
    '# Microfactory Studio project autosave file',
    '[project]',
    field('version', TOML_PROJECT_VERSION),
    field('id', state.currentProjectId),
    field('name', state.currentProjectName),
    field('updatedAt', new Date().toISOString()),
    field('activeTab', state.activeTab),
    field('selectedMachineId', state.selectedMachineId),
    field('selectedEnvelopeId', state.selectedEnvelopeId),
    field('showFlow', Boolean(state.showFlow)),
    field('split', Number(state.split ?? 50)),
    field('selectedRenderEngineId', state.selectedRenderEngineId),
    field('selectedResolutionId', state.selectedResolutionId),
    field('removedMachineIds', state.removedMachineIds ?? []),
    '',
    '[customEnvelope]',
    field('length', Number(state.customEnvelope?.length ?? 0)),
    field('width', Number(state.customEnvelope?.width ?? 0)),
    field('height', Number(state.customEnvelope?.height ?? 0)),
    '',
    '[customResolution]',
    field('id', state.customResolution?.id ?? 'custom'),
    field('label', state.customResolution?.label ?? 'Custom'),
    field('width', Number(state.customResolution?.width ?? 1920)),
    field('height', Number(state.customResolution?.height ?? 1080)),
    field('preset', state.customResolution?.preset ?? 'manual'),
    '',
  ];

  if (state.layoutViewBox) {
    lines.push('[layoutViewBox]', ...footprintFields(state.layoutViewBox).map((line) => line.replace(/^w = /, 'width = ').replace(/^h = /, 'height = ')), '');
  }

  for (const envelope of state.layoutEnvelopes ?? []) {
    lines.push(
      '[[layoutEnvelopes]]',
      field('instanceId', envelope.instanceId),
      field('envelopeId', envelope.envelopeId),
      field('customLength', Number(envelope.customDimensions?.length ?? 0)),
      field('customWidth', Number(envelope.customDimensions?.width ?? 0)),
      field('customHeight', Number(envelope.customDimensions?.height ?? 0)),
      '',
    );
  }

  for (const machine of state.placedMachines ?? []) {
    lines.push(
      '[[placedMachines]]',
      field('id', machine.id),
      field('catalogId', machine.catalogId ?? machine.id),
      field('name', machine.name),
      field('status', machine.status ?? 'Placed'),
      ...footprintFields(machine.footprint),
      '',
    );
  }

  for (const [machineId, footprint] of Object.entries(state.footprintOverrides ?? {})) {
    lines.push(
      '[[footprintOverrides]]',
      field('machineId', machineId),
      ...footprintFields(footprint),
      '',
    );
  }

  return `${lines.join('\n')}\n`;
}

function numberOrFallback(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function catalogMachine(catalogId) {
  return factoryDesign.machineCatalog.find((machine) => machine.id === catalogId);
}

export function projectStateFromToml(source, defaults = {}) {
  const parsed = parseToml(source);
  const project = parsed.project ?? {};
  const customEnvelope = parsed.customEnvelope ?? {};
  const customResolution = parsed.customResolution ?? {};
  const layoutViewBox = parsed.layoutViewBox;

  const layoutEnvelopes = (parsed.layoutEnvelopes ?? [])
    .map((envelope) => {
      if (!factoryDesign.envelopeOptions.some((option) => option.id === envelope.envelopeId)) return null;
      return {
        instanceId: envelope.instanceId || `${envelope.envelopeId}-saved`,
        envelopeId: envelope.envelopeId,
        customDimensions: envelope.envelopeId === 'custom' ? {
          length: numberOrFallback(envelope.customLength, factoryDesign.ui.defaults.customEnvelope.length),
          width: numberOrFallback(envelope.customWidth, factoryDesign.ui.defaults.customEnvelope.width),
          height: numberOrFallback(envelope.customHeight, factoryDesign.ui.defaults.customEnvelope.height),
        } : null,
      };
    })
    .filter(Boolean);

  const placedMachines = (parsed.placedMachines ?? [])
    .map((machine) => {
      const catalog = catalogMachine(machine.catalogId);
      if (!catalog) return null;
      return {
        ...catalog,
        id: machine.id,
        catalogId: machine.catalogId,
        name: machine.name || catalog.name,
        status: machine.status || 'Placed',
        footprint: {
          x: numberOrFallback(machine.x, catalog.footprint.x ?? 0),
          y: numberOrFallback(machine.y, catalog.footprint.y ?? 0),
          w: numberOrFallback(machine.w, catalog.footprint.w),
          h: numberOrFallback(machine.h, catalog.footprint.h),
        },
      };
    })
    .filter(Boolean);

  const footprintOverrides = Object.fromEntries((parsed.footprintOverrides ?? []).map((entry) => [entry.machineId, {
    x: numberOrFallback(entry.x, 0),
    y: numberOrFallback(entry.y, 0),
    w: numberOrFallback(entry.w, 0),
    h: numberOrFallback(entry.h, 0),
  }]));

  return {
    currentProjectId: project.id || defaults.currentProjectId || '',
    currentProjectName: project.name || defaults.currentProjectName || 'Untitled project',
    activeTab: project.activeTab || defaults.activeTab || 'summary',
    selectedMachineId: project.selectedMachineId || defaults.selectedMachineId || factoryDesign.machines[0].id,
    selectedEnvelopeId: project.selectedEnvelopeId || defaults.selectedEnvelopeId || factoryDesign.ui.defaults.selectedEnvelopeId,
    showFlow: typeof project.showFlow === 'boolean' ? project.showFlow : defaults.showFlow,
    split: numberOrFallback(project.split, defaults.split ?? factoryDesign.ui.defaults.split),
    selectedRenderEngineId: project.selectedRenderEngineId || defaults.selectedRenderEngineId || factoryDesign.renderEngines[0].id,
    selectedResolutionId: project.selectedResolutionId || defaults.selectedResolutionId || '2k',
    removedMachineIds: Array.isArray(project.removedMachineIds) ? project.removedMachineIds : [],
    customEnvelope: {
      length: numberOrFallback(customEnvelope.length, defaults.customEnvelope?.length ?? factoryDesign.ui.defaults.customEnvelope.length),
      width: numberOrFallback(customEnvelope.width, defaults.customEnvelope?.width ?? factoryDesign.ui.defaults.customEnvelope.width),
      height: numberOrFallback(customEnvelope.height, defaults.customEnvelope?.height ?? factoryDesign.ui.defaults.customEnvelope.height),
    },
    customResolution: {
      ...factoryDesign.renderResolutions.find((resolution) => resolution.id === 'custom'),
      ...defaults.customResolution,
      ...customResolution,
      width: numberOrFallback(customResolution.width, defaults.customResolution?.width ?? 1920),
      height: numberOrFallback(customResolution.height, defaults.customResolution?.height ?? 1080),
    },
    layoutViewBox: layoutViewBox ? {
      x: numberOrFallback(layoutViewBox.x, 0),
      y: numberOrFallback(layoutViewBox.y, 0),
      width: numberOrFallback(layoutViewBox.width, 1),
      height: numberOrFallback(layoutViewBox.height, 1),
    } : null,
    layoutEnvelopes,
    placedMachines,
    footprintOverrides,
  };
}
