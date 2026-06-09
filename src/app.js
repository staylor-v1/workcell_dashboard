import { designMetrics, designToml, envelopeVolume, factoryDesign, factoryStep, getEnvelope, getRenderEngine, getRenderResolution, normalizedRenderResolution, omniversePackageFiles, renderBoardSvg, renderJobManifest, renderPrompt, renderViewPlan, reportPdf } from './data.js';

const tabs = factoryDesign.ui.tabs;

const appState = {
  ...factoryDesign.ui.defaults,
  selectedMachineId: factoryDesign.machines[0].id,
  customEnvelope: { ...factoryDesign.ui.defaults.customEnvelope },
  selectedRenderEngineId: factoryDesign.renderEngines[0].id,
  selectedResolutionId: '2k',
  customResolution: { ...factoryDesign.renderResolutions.find((resolution) => resolution.id === 'custom') },
  showCustomResolutionModal: false,
  renderStatus: '',
  placedMachines: [],
  removedMachineIds: [],
  footprintOverrides: {},
  layoutViewBox: null,
  layoutViewBoxEnvelopeKey: '',
};

const withCurrentFootprint = (machine) => ({
  ...machine,
  footprint: { ...machine.footprint, ...appState.footprintOverrides[machine.id] },
});

const layoutMachines = () => [...factoryDesign.machines, ...appState.placedMachines]
  .filter((machine) => !appState.removedMachineIds.includes(machine.id))
  .map(withCurrentFootprint);

const findLayoutMachine = (id) => layoutMachines().find((machine) => machine.id === id);
const getMachine = (id) => findLayoutMachine(id) ?? layoutMachines()[0] ?? factoryDesign.machines[0];
const getCatalogMachine = (id) => factoryDesign.machineCatalog.find((machine) => machine.id === id);

const selectedEnvelope = () => {
  const envelope = getEnvelope(appState.selectedEnvelopeId);
  if (envelope.id !== 'custom') return envelope;
  const { length, width, height } = appState.customEnvelope;
  return {
    ...envelope,
    dimensions: { length, width, height, unit: 'm' },
    clearDimensions: { length: Math.max(length - 0.4, 0), width: Math.max(width - 0.4, 0), height: Math.max(height - 0.3, 0), unit: 'm' },
  };
};

function machineCard(machine, compact = false) {
  const params = machine.parameters
    .map(([label, value]) => `<li><span>${label}</span><strong>${value}</strong></li>`)
    .join('');

  return `
    <article class="machine-card ${compact ? 'compact' : ''}" data-machine-id="${machine.id}">
      <div class="machine-card__topline">
        <span class="status ${machine.status.toLowerCase()}">${machine.status}</span>
        <span>${machine.type}</span>
      </div>
      <h3>${machine.name}</h3>
      <div class="machine-card__metrics">
        <span><strong>${machine.cycleTime}s</strong> cycle</span>
        <span><strong>${machine.uptime}%</strong> uptime</span>
        <span><strong>${machine.energy}kW</strong> draw</span>
      </div>
      ${compact ? '' : `<ul class="parameter-list">${params}</ul>`}
    </article>`;
}

function layoutEnvelopeKey() {
  const envelope = selectedEnvelope();
  const { length, width } = envelope.dimensions;
  return `${envelope.id}:${length}:${width}`;
}

function defaultLayoutViewBox() {
  const envelope = selectedEnvelope();
  const padding = Math.max(Math.min(envelope.dimensions.length, envelope.dimensions.width) * 0.035, 0.12);
  return {
    x: -padding,
    y: -padding,
    width: envelope.dimensions.length + padding * 2,
    height: envelope.dimensions.width + padding * 2,
  };
}

function currentLayoutViewBox() {
  const key = layoutEnvelopeKey();
  if (!appState.layoutViewBox || appState.layoutViewBoxEnvelopeKey !== key) {
    appState.layoutViewBox = defaultLayoutViewBox();
    appState.layoutViewBoxEnvelopeKey = key;
  }
  return appState.layoutViewBox;
}

function viewBoxAttribute(viewBox) {
  return `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
}

function machineModelNumber(machine) {
  return machine.modelNumber ?? machine.model ?? machine.name;
}

function layoutSvg({ compact = false } = {}) {
  const envelope = selectedEnvelope();
  const viewBox = compact
    ? { x: -0.5, y: -0.5, width: Math.max(factoryDesign.floorSize.width, envelope.dimensions.length) + 1, height: Math.max(factoryDesign.floorSize.height, envelope.dimensions.width) + 1 }
    : currentLayoutViewBox();
  const machines = layoutMachines()
    .map((machine) => {
      const { x, y, w, h } = machine.footprint;
      const selected = machine.id === appState.selectedMachineId;
      const selectedClass = selected ? ' selected' : '';
      const deleteX = x + w - 0.16;
      const deleteY = y + 0.16;
      const deleteSize = 0.08;
      const rotateX = x + 0.2;
      const rotateY = y + h - 0.2;
      const rotateControl = selected && !compact
        ? `<g class="layout-machine__rotate" data-rotate-machine-id="${machine.id}" tabindex="0" role="button" aria-label="Rotate ${machine.name} footprint 90 degrees">
            <circle class="layout-machine__rotate-hitbox" cx="${rotateX}" cy="${rotateY}" r="0.22" />
            <path d="M ${rotateX - 0.08} ${rotateY - 0.1} A 0.16 0.16 0 0 1 ${rotateX + 0.1} ${rotateY - 0.08}" />
            <path class="layout-machine__rotate-arrow" d="M ${rotateX + 0.1} ${rotateY - 0.08} L ${rotateX + 0.055} ${rotateY - 0.12} M ${rotateX + 0.1} ${rotateY - 0.08} L ${rotateX + 0.095} ${rotateY - 0.14}" />
            <path d="M ${rotateX + 0.08} ${rotateY + 0.1} A 0.16 0.16 0 0 1 ${rotateX - 0.1} ${rotateY + 0.08}" />
            <path class="layout-machine__rotate-arrow" d="M ${rotateX - 0.1} ${rotateY + 0.08} L ${rotateX - 0.055} ${rotateY + 0.12} M ${rotateX - 0.1} ${rotateY + 0.08} L ${rotateX - 0.095} ${rotateY + 0.14}" />
          </g>`
        : '';
      const deleteControl = selected && !compact
        ? `<g class="layout-machine__delete" data-delete-machine-id="${machine.id}" tabindex="0" role="button" aria-label="Delete ${machine.name} from layout">
            <circle class="layout-machine__delete-hitbox" cx="${deleteX}" cy="${deleteY}" r="0.18" />
            <path d="M ${deleteX - deleteSize} ${deleteY - deleteSize} L ${deleteX + deleteSize} ${deleteY + deleteSize} M ${deleteX + deleteSize} ${deleteY - deleteSize} L ${deleteX - deleteSize} ${deleteY + deleteSize}" />
          </g>`
        : '';
      return `
        <g class="layout-machine${selectedClass}" data-machine-id="${machine.id}" data-layout-draggable="true" tabindex="0" role="button" aria-label="Select and drag ${machine.name}">
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="0.18" />
          <text x="${x + w / 2}" y="${y + h / 2 - 0.12}" text-anchor="middle">${machine.name.split(' ')[0]}</text>
          <text class="layout-machine__sub" x="${x + w / 2}" y="${y + h / 2 + 0.22}" text-anchor="middle">${machineModelNumber(machine)}</text>
        </g>
        ${rotateControl}
        ${deleteControl}`;
    })
    .join('');

  const flows = appState.showFlow
    ? factoryDesign.flowLinks
        .map(([fromId, toId]) => {
          const fromMachine = findLayoutMachine(fromId);
          const toMachine = findLayoutMachine(toId);
          if (!fromMachine || !toMachine) return '';
          const from = fromMachine.footprint;
          const to = toMachine.footprint;
          return `<path class="flow-line" d="M ${from.x + from.w} ${from.y + from.h / 2} C ${from.x + from.w + 1.5} ${from.y + from.h / 2}, ${to.x - 1.5} ${to.y + to.h / 2}, ${to.x} ${to.y + to.h / 2}" />`;
        })
        .join('')
    : '';

  return `
    <div class="layout-shell ${compact ? 'compact' : ''}" data-layout-pan-zoom="${compact ? 'false' : 'true'}">
      <svg class="layout-canvas" viewBox="${viewBoxAttribute(viewBox)}" data-layout-viewbox="${viewBoxAttribute(viewBox)}" role="img" aria-label="Top down microfactory layout">
        <defs>
          <pattern id="floor-grid" width="1" height="1" patternUnits="userSpaceOnUse">
            <path d="M 1 0 L 0 0 0 1" fill="none" stroke="rgba(148, 163, 184, .18)" stroke-width="0.025" />
          </pattern>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L8,3 z" fill="#3ee7c6" />
          </marker>
        </defs>
        <rect x="${viewBox.x}" y="${viewBox.y}" width="${viewBox.width}" height="${viewBox.height}" rx="0.24" fill="url(#floor-grid)" />
        <rect x="0" y="0" width="${factoryDesign.floorSize.width}" height="${factoryDesign.floorSize.height}" rx="0.2" class="floor-boundary" />
        <rect x="0" y="0" width="${envelope.dimensions.length}" height="${envelope.dimensions.width}" rx="0.16" class="envelope-boundary" />
        <text x="0.24" y="0.38" class="envelope-label">${envelope.name}</text>
        ${flows}
        ${machines}
      </svg>
    </div>`;
}

function flowGraph(compact = false) {
  return `
    <div class="flow-graph ${compact ? 'compact' : ''}">
      ${factoryDesign.flow
        .map(
          (step, index) => `
        <div class="flow-node">
          <div class="flow-node__icon">${step.visual}</div>
          <div>
            <span>Step ${index + 1}</span>
            <strong>${step.state}</strong>
          </div>
        </div>
        ${index < factoryDesign.flow.length - 1 ? '<div class="flow-connector"></div>' : ''}`,
        )
        .join('')}
    </div>`;
}

function flowText() {
  return `
    <div class="flow-copy">
      ${factoryDesign.flow
        .map(
          (step, index) => `
        <article class="flow-step">
          <span class="eyebrow">Transformation ${index + 1}</span>
          <h3>${step.title}</h3>
          <p>${step.detail}</p>
          <strong>Product state: ${step.state}</strong>
        </article>`,
        )
        .join('')}
    </div>`;
}

function heroMetrics() {
  const metrics = designMetrics();
  return `
    <section class="metrics-grid">
      <article><span>Machines</span><strong>${metrics.machineCount}</strong></article>
      <article><span>Avg uptime</span><strong>${metrics.averageUptime}%</strong></article>
      <article><span>Total load</span><strong>${metrics.totalEnergy} kW</strong></article>
      <article><span>Bottleneck</span><strong>${metrics.bottleneck}</strong></article>
    </section>`;
}

function renderSummary() {
  return `
    <section class="hero-panel">
      <div>
        <span class="eyebrow">Factory design workspace</span>
        <h1>${factoryDesign.name}</h1>
        <p>Design a compact microfactory from machine parameters to layout, material movement, process transformations, envelope CAD, export packages, and render direction.</p>
      </div>
      <div class="hero-product">
        <span>${factoryDesign.product}</span>
        <strong>${factoryDesign.throughput}</strong>
        <small>Takt target ${factoryDesign.taktTime}</small>
      </div>
    </section>
    ${heroMetrics()}
    <section class="summary-grid">
      <article class="mini-panel wide">
        <div class="panel-heading"><h2>Layout preview</h2><button data-tab-target="layout">Open Layout</button></div>
        ${layoutSvg({ compact: true })}
      </article>
      <article class="mini-panel">
        <div class="panel-heading"><h2>Machine stack</h2><button data-tab-target="machines">Open Machines</button></div>
        <div class="compact-list">${factoryDesign.machines.slice(0, 3).map((machine) => machineCard(machine, true)).join('')}</div>
      </article>
      <article class="mini-panel wide">
        <div class="panel-heading"><h2>Flow preview</h2><button data-tab-target="flow">Open Flow</button></div>
        ${flowGraph(true)}
      </article>
      <article class="mini-panel render-preview">
        <div class="panel-heading"><h2>Render mood</h2><button data-tab-target="renders">Open Renders</button></div>
        <div class="render-card"><div class="render-orb"></div><p>Photorealistic render planning with cinematic materials, lighting, and operator-scale context.</p></div>
      </article>
    </section>`;
}

function renderMachines() {
  const selected = getMachine(appState.selectedMachineId);
  return `
    <section class="workspace two-column">
      <div>
        <span class="eyebrow">Machine library</span>
        <h1>Machines and process parameters</h1>
        <p>Every tab reads from the same shared design model, so selecting or evaluating a machine informs layout and flow decisions.</p>
        <div class="machine-list">${factoryDesign.machines.map((machine) => machineCard(machine)).join('')}</div>
      </div>
      <aside class="detail-panel">
        <span class="eyebrow">Selected asset</span>
        <h2>${selected.name}</h2>
        <dl>
          <div><dt>Inputs</dt><dd>${selected.inputs.join(', ')}</dd></div>
          <div><dt>Outputs</dt><dd>${selected.outputs.join(', ')}</dd></div>
          <div><dt>Operator model</dt><dd>${selected.operator}</dd></div>
          <div><dt>Footprint</dt><dd>${selected.footprint.w}m × ${selected.footprint.h}m</dd></div>
        </dl>
      </aside>
    </section>`;
}

function footprintDimensions(machine) {
  return `${machine.footprint.w}m × ${machine.footprint.h}m`;
}

function machinePalette() {
  const categories = [...new Set(factoryDesign.machineCatalog.map((machine) => machine.category))];
  return `
    <aside class="machine-palette" aria-label="Machine catalog">
      <div class="machine-palette__header">
        <span class="eyebrow">Drag-in machine menu</span>
        <h2>Industrial machine candidates</h2>
        <p>Researched small and medium facility equipment, biased toward industrial machines with approximately 300 mm-class useful build or travel envelopes.</p>
      </div>
      ${categories.map((category) => `
        <section class="machine-palette__group">
          <h3>${category}</h3>
          ${factoryDesign.machineCatalog
            .filter((machine) => machine.category === category)
            .map((machine) => `
              <article class="palette-machine" draggable="true" data-catalog-machine-id="${machine.id}" tabindex="0">
                <div>
                  <strong>${machine.name}</strong>
                  <span>${machine.type}</span>
                </div>
                <dl class="palette-machine__dimensions" aria-label="Machine dimensions">
                  <div>
                    <dt>Working envelope</dt>
                    <dd>${machine.buildVolume}</dd>
                  </div>
                  <div>
                    <dt>Footprint</dt>
                    <dd>${footprintDimensions(machine)}</dd>
                  </div>
                </dl>
                <p>${machine.researchNote}</p>
                <a href="${machine.sourceUrl}" target="_blank" rel="noreferrer">${machine.sourceLabel}</a>
              </article>`)
            .join('')}
        </section>`)
        .join('')}
    </aside>`;
}

function createPlacedMachine(catalogMachine, x, y) {
  const instanceNumber = appState.placedMachines.filter((machine) => machine.catalogId === catalogMachine.id).length + 1;
  const id = `${catalogMachine.id}-${Date.now().toString(36)}-${instanceNumber}`;
  return {
    ...catalogMachine,
    id,
    catalogId: catalogMachine.id,
    status: 'Placed',
    name: instanceNumber > 1 ? `${catalogMachine.name} #${instanceNumber}` : catalogMachine.name,
    footprint: {
      x,
      y,
      w: catalogMachine.footprint.w,
      h: catalogMachine.footprint.h,
    },
  };
}

function dropMachineOnLayout(root, catalogMachineId, clientX, clientY) {
  const catalogMachine = getCatalogMachine(catalogMachineId);
  const svg = root.querySelector('.layout-canvas');
  if (!catalogMachine || !svg) return;

  const pointer = pointerToLayout(svg, clientX, clientY);
  const footprint = catalogMachine.footprint;
  const bounds = layoutPlacementBounds(footprint);
  const x = Math.min(Math.max(pointer.x - footprint.w / 2, 0), bounds.width - footprint.w);
  const y = Math.min(Math.max(pointer.y - footprint.h / 2, 0), bounds.height - footprint.h);
  const placedMachine = createPlacedMachine(catalogMachine, Number(x.toFixed(2)), Number(y.toFixed(2)));

  appState.placedMachines = [...appState.placedMachines, placedMachine];
  appState.selectedMachineId = placedMachine.id;
  renderApp(root);
}


function svgViewBox(svg) {
  const [x, y, width, height] = (svg.getAttribute('viewBox') ?? viewBoxAttribute(currentLayoutViewBox()))
    .split(/\s+/)
    .map(Number);
  return { x, y, width, height };
}

function pointerToLayout(svg, clientX, clientY) {
  const bounds = svg.getBoundingClientRect();
  const viewBox = svgViewBox(svg);
  const pointerX = viewBox.x + ((clientX - bounds.left) / bounds.width) * viewBox.width;
  const pointerY = viewBox.y + ((clientY - bounds.top) / bounds.height) * viewBox.height;
  return { x: pointerX, y: pointerY };
}

function layoutPlacementBounds(footprint = { w: 0, h: 0 }) {
  const envelope = selectedEnvelope();
  return {
    width: Math.max(envelope.dimensions.length, footprint.w, 0.1),
    height: Math.max(envelope.dimensions.width, footprint.h, 0.1),
  };
}

function clampedFootprintPosition(machine, x, y) {
  const bounds = layoutPlacementBounds(machine.footprint);
  return {
    x: Number(Math.min(Math.max(x, 0), bounds.width - machine.footprint.w).toFixed(2)),
    y: Number(Math.min(Math.max(y, 0), bounds.height - machine.footprint.h).toFixed(2)),
  };
}

function updateMachineFootprint(machineId, x, y) {
  const machine = findLayoutMachine(machineId);
  if (!machine) return;
  const position = clampedFootprintPosition(machine, x, y);
  appState.footprintOverrides = {
    ...appState.footprintOverrides,
    [machineId]: { ...machine.footprint, ...position },
  };
}

function rotateMachineFootprint(machineId) {
  const machine = findLayoutMachine(machineId);
  if (!machine) return;
  const rotatedFootprint = {
    ...machine.footprint,
    w: machine.footprint.h,
    h: machine.footprint.w,
  };
  const bounds = layoutPlacementBounds(rotatedFootprint);
  const position = {
    x: Number(Math.min(machine.footprint.x, bounds.width - rotatedFootprint.w).toFixed(2)),
    y: Number(Math.min(machine.footprint.y, bounds.height - rotatedFootprint.h).toFixed(2)),
  };
  appState.footprintOverrides = {
    ...appState.footprintOverrides,
    [machineId]: { ...rotatedFootprint, ...position },
  };
}

function deleteMachineFromLayout(machineId) {
  const remainingPlacedMachines = appState.placedMachines.filter((machine) => machine.id !== machineId);
  const removedPlacedMachine = remainingPlacedMachines.length !== appState.placedMachines.length;
  appState.placedMachines = remainingPlacedMachines;
  if (!removedPlacedMachine && factoryDesign.machines.some((machine) => machine.id === machineId)) {
    appState.removedMachineIds = [...new Set([...appState.removedMachineIds, machineId])];
  }

  const { [machineId]: _deletedFootprint, ...footprintOverrides } = appState.footprintOverrides;
  appState.footprintOverrides = footprintOverrides;
  if (appState.selectedMachineId === machineId) {
    appState.selectedMachineId = layoutMachines()[0]?.id ?? factoryDesign.machines[0].id;
  }
}

function startMachineDrag(root, machineElement, event) {
  const svg = machineElement.closest('.layout-canvas');
  const machineId = machineElement.dataset.machineId;
  const machine = findLayoutMachine(machineId);
  if (!svg || !machine || event.target.closest('[data-delete-machine-id], [data-rotate-machine-id]')) return;

  event.preventDefault();
  machineElement.setPointerCapture?.(event.pointerId);
  appState.selectedMachineId = machineId;
  const pointer = pointerToLayout(svg, event.clientX, event.clientY);
  const offset = { x: pointer.x - machine.footprint.x, y: pointer.y - machine.footprint.y };
  document.body.classList.add('is-dragging-machine');
  renderApp(root);

  const handlePointerMove = (moveEvent) => {
    const nextPointer = pointerToLayout(root.querySelector('.layout-canvas') ?? svg, moveEvent.clientX, moveEvent.clientY);
    updateMachineFootprint(machineId, nextPointer.x - offset.x, nextPointer.y - offset.y);
    renderApp(root);
  };

  const handlePointerUp = () => {
    document.body.classList.remove('is-dragging-machine');
    machineElement.releasePointerCapture?.(event.pointerId);
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    renderApp(root);
  };

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp, { once: true });
}
function setLayoutViewBox(svg, viewBox) {
  appState.layoutViewBox = viewBox;
  svg.setAttribute('viewBox', viewBoxAttribute(viewBox));
  svg.dataset.layoutViewbox = viewBoxAttribute(viewBox);
}

function zoomLayoutAtPointer(svg, event) {
  event.preventDefault();
  const current = svgViewBox(svg);
  const pointer = pointerToLayout(svg, event.clientX, event.clientY);
  const zoomFactor = event.deltaY < 0 ? 0.88 : 1.14;
  const envelope = selectedEnvelope();
  const minWidth = Math.max(envelope.dimensions.length * 0.16, 1.2);
  const maxWidth = Math.max(factoryDesign.floorSize.width, envelope.dimensions.length) * 1.8;
  const nextWidth = Math.min(Math.max(current.width * zoomFactor, minWidth), maxWidth);
  const nextHeight = nextWidth * (current.height / current.width);
  const ratioX = (pointer.x - current.x) / current.width;
  const ratioY = (pointer.y - current.y) / current.height;
  setLayoutViewBox(svg, {
    x: pointer.x - ratioX * nextWidth,
    y: pointer.y - ratioY * nextHeight,
    width: nextWidth,
    height: nextHeight,
  });
}

function startLayoutPan(root, svg, event) {
  if (event.target.closest('[data-layout-draggable], [data-delete-machine-id], [data-rotate-machine-id]')) return;
  event.preventDefault();
  svg.setPointerCapture?.(event.pointerId);
  const start = { x: event.clientX, y: event.clientY, viewBox: svgViewBox(svg) };
  document.body.classList.add('is-panning-layout');

  const handlePointerMove = (moveEvent) => {
    const bounds = svg.getBoundingClientRect();
    const dx = ((moveEvent.clientX - start.x) / bounds.width) * start.viewBox.width;
    const dy = ((moveEvent.clientY - start.y) / bounds.height) * start.viewBox.height;
    setLayoutViewBox(svg, {
      ...start.viewBox,
      x: start.viewBox.x - dx,
      y: start.viewBox.y - dy,
    });
  };

  const handlePointerUp = () => {
    document.body.classList.remove('is-panning-layout');
    svg.releasePointerCapture?.(event.pointerId);
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
  };

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp, { once: true });
}


function renderLayout() {
  const selected = getMachine(appState.selectedMachineId);
  return `
    <section class="workspace">
      <div class="panel-heading large">
        <div><span class="eyebrow">Top-down layout</span><h1>Machine placement and product movement</h1></div>
        <label class="switch"><input type="checkbox" id="flowToggle" ${appState.showFlow ? 'checked' : ''} /> <span>Show product flow</span></label>
      </div>
      <div class="layout-workbench">
        ${machinePalette()}
        <div class="layout-stage">
          ${layoutSvg()}
          <aside class="layout-inspector">
            <strong>${selected.name}</strong>
            <span>${selected.type}</span>
            <p>${selected.inputs.join(' + ')} → ${selected.outputs.join(' + ')}</p>
          </aside>
        </div>
      </div>
    </section>`;
}

function renderFlow() {
  return `
    <section class="workspace">
      <div class="panel-heading large">
        <div><span class="eyebrow">Process flow</span><h1>Feedstock-to-finished transformation model</h1></div>
        <span class="split-hint">Drag the divider to balance text and graphics</span>
      </div>
      <div class="flow-split" data-resizable-split style="grid-template-columns: minmax(280px, ${appState.split}%) 14px minmax(320px, 1fr)">
        <section class="flow-text-panel" id="flow-text-panel"><h2>Text representation</h2>${flowText()}</section>
        <button class="split-divider" type="button" data-split-divider aria-label="Drag to resize text and visual flow panels" aria-controls="flow-text-panel flow-visual-panel" aria-valuemin="25" aria-valuemax="75" aria-valuenow="${appState.split}" role="separator"></button>
        <section class="flow-visual-panel" id="flow-visual-panel"><h2>Visual graph</h2>${flowGraph()}</section>
      </div>
    </section>`;
}

function setSplitFromPointer(root, splitContainer, clientX) {
  const bounds = splitContainer.getBoundingClientRect();
  if (!bounds.width) return;
  const rawSplit = ((clientX - bounds.left) / bounds.width) * 100;
  appState.split = Math.min(75, Math.max(25, Math.round(rawSplit)));
  splitContainer.style.gridTemplateColumns = `minmax(280px, ${appState.split}%) 14px minmax(320px, 1fr)`;
  const divider = splitContainer.querySelector('[data-split-divider]');
  divider?.setAttribute('aria-valuenow', String(appState.split));
}

function startSplitDrag(root, divider, event) {
  const splitContainer = divider.closest('[data-resizable-split]');
  if (!splitContainer) return;

  event.preventDefault();
  divider.setPointerCapture?.(event.pointerId);
  document.body.classList.add('is-resizing-split');
  setSplitFromPointer(root, splitContainer, event.clientX);

  const handlePointerMove = (moveEvent) => {
    setSplitFromPointer(root, splitContainer, moveEvent.clientX);
  };

  const handlePointerUp = () => {
    document.body.classList.remove('is-resizing-split');
    divider.releasePointerCapture?.(event.pointerId);
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    renderApp(root);
  };

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp, { once: true });
}

function renderEngineCard(engine) {
  const selected = engine.id === appState.selectedRenderEngineId;
  return `
    <article class="render-engine-card ${selected ? 'selected' : ''}" data-render-engine-id="${engine.id}">
      <div class="render-engine-card__top"><span>${engine.quality}</span><strong>${engine.samples} spp</strong></div>
      <h3>${engine.name}</h3>
      <p>${engine.integrator}</p>
      <dl class="render-specs compact">
        <div><dt>Engine</dt><dd>${engine.engine}</dd></div>
        <div><dt>Resolution</dt><dd>${engine.resolution}</dd></div>
        <div><dt>Color/output</dt><dd>${engine.color}</dd></div>
      </dl>
      <ul class="render-settings-list">${engine.settings.map((setting) => `<li>${setting}</li>`).join('')}</ul>
      <a href="${engine.source_url}" target="_blank" rel="noreferrer">${engine.source_label}</a>
    </article>`;
}

function selectedRenderResolution() {
  return normalizedRenderResolution(appState.selectedResolutionId === 'custom' ? appState.customResolution : getRenderResolution(appState.selectedResolutionId));
}

function renderResolutionButton(resolution) {
  const selected = resolution.id === appState.selectedResolutionId;
  const size = normalizedRenderResolution(resolution.id === 'custom' ? appState.customResolution : resolution);
  return `<button class="resolution-option ${selected ? 'selected' : ''}" data-render-resolution-id="${resolution.id}" type="button"><strong>${resolution.label}</strong><span>${size.width} × ${size.height}</span></button>`;
}

function renderResolutionModal() {
  if (!appState.showCustomResolutionModal) return '';
  return `
    <div class="modal-backdrop" role="presentation" data-close-resolution-modal="true">
      <section class="resolution-modal" role="dialog" aria-modal="true" aria-labelledby="custom-resolution-title">
        <h2 id="custom-resolution-title">Custom render resolution</h2>
        <p>Set exact output pixels for all three deterministic render views.</p>
        <div class="custom-resolution-fields">
          <label>Width (px)<input type="number" min="64" max="16384" step="1" data-custom-render-resolution="width" value="${appState.customResolution.width}" /></label>
          <label>Height (px)<input type="number" min="64" max="16384" step="1" data-custom-render-resolution="height" value="${appState.customResolution.height}" /></label>
        </div>
        <div class="modal-actions">
          <button type="button" data-close-resolution-modal="true">Cancel</button>
          <button type="button" data-save-custom-resolution="true">Use custom resolution</button>
        </div>
      </section>
    </div>`;
}

function renderRenders() {
  const engine = getRenderEngine(appState.selectedRenderEngineId);
  const resolution = selectedRenderResolution();
  return `
    <section class="workspace renders-view">
      <span class="eyebrow">Photorealistic render planner</span>
      <h1>Create credible visual direction from the factory model</h1>
      <p>Choose Blender Cycles, LuxCoreRender, or Mitsuba 3, then click Render to produce the required top-down, container-door, and orthographic factory views with researched high-quality defaults already applied.</p>
      <section class="render-engine-picker" aria-label="Photorealistic render engine options">
        ${factoryDesign.renderEngines.map(renderEngineCard).join('')}
      </section>
      <section class="resolution-picker" aria-label="Render resolution options">
        <div><span class="eyebrow">Resolution</span><h2>Image output size</h2></div>
        <div class="resolution-options">${factoryDesign.renderResolutions.map(renderResolutionButton).join('')}</div>
      </section>
      <section class="render-action-panel">
        <div>
          <span class="eyebrow">Selected engine</span>
          <h2>${engine.name}</h2>
          <p>${engine.command}</p>
          <small>${resolution.label}: ${resolution.width} × ${resolution.height}px for each view</small>
        </div>
        <button data-render-selected-engine="${engine.id}">${engine.render_button}</button>
        ${appState.renderStatus ? `<strong class="render-status">${appState.renderStatus}</strong>` : ''}
      </section>
      <div class="render-view-grid">
        ${factoryDesign.renderViews.map((view) => `
          <article class="render-view-card">
            <span>${view.title}</span>
            <h3>${view.output}</h3>
            <p>${renderViewPlan(engine, view, factoryDesign, resolution)}</p>
          </article>`).join('')}
      </div>
      <label class="prompt-label" for="render-job-manifest">One-click render job manifest</label>
      <textarea id="render-job-manifest" class="render-manifest" readonly>${renderJobManifest(engine, factoryDesign, resolution)}</textarea>
      ${renderResolutionModal()}
      <div class="render-grid">
        ${factoryDesign.renderProfiles
          .map(
            (profile, index) => `<article class="render-brief">
              <div class="render-shot shot-${index + 1}"><span>${profile.title}</span></div>
              <h3>${profile.title}</h3>
              <dl class="render-specs">
                <div><dt>Camera</dt><dd>${profile.camera}</dd></div>
                <div><dt>Lighting</dt><dd>${profile.lighting}</dd></div>
                <div><dt>Materials</dt><dd>${profile.materials}</dd></div>
              </dl>
              <label class="prompt-label" for="prompt-${profile.id}">Render prompt</label>
              <textarea id="prompt-${profile.id}" readonly>${renderPrompt(profile)}</textarea>
              <button data-copy-prompt="prompt-${profile.id}">Copy render prompt</button>
            </article>`,
          )
          .join('')}
      </div>
    </section>`;
}


function envelopeCadSvg(envelope = selectedEnvelope()) {
  const length = envelope.dimensions.length;
  const width = envelope.dimensions.width;
  const height = envelope.dimensions.height;
  const iso = envelope.id.includes('conex') || envelope.id.includes('cube');
  const ribs = Array.from({ length: 12 }, (_, index) => `<line x1="${96 + index * 48}" y1="122" x2="${126 + index * 48}" y2="264" />`).join('');
  const sideBays = envelope.id === 'deployable-shelter' ? '<polygon points="98,176 28,222 76,296 146,252"/><polygon points="600,176 672,222 624,296 552,252"/>' : '';

  return `
    <svg class="cad-preview" viewBox="0 0 720 420" role="img" aria-label="CAD preview for ${envelope.name}">
      <defs>
        <linearGradient id="cad-shell" x1="0" x2="1"><stop stop-color="#1e293b"/><stop offset="1" stop-color="#0f766e"/></linearGradient>
      </defs>
      <polygon class="cad-top" points="116,94 574,94 652,152 196,152" />
      <polygon class="cad-side" points="196,152 652,152 652,284 196,284" />
      <polygon class="cad-end" points="116,94 196,152 196,284 116,224" />
      ${sideBays}
      <g class="cad-ribs">${iso ? ribs : ''}</g>
      <rect class="cad-door" x="596" y="172" width="38" height="92" rx="4" />
      <text x="70" y="350">${length}m L × ${width}m W × ${height}m H</text>
      <text x="70" y="382">${envelope.cadModel.status}</text>
    </svg>`;
}

function renderEnvelope() {
  const envelope = selectedEnvelope();
  return `
    <section class="workspace envelope-view">
      <div class="panel-heading large">
        <div><span class="eyebrow">Factory container</span><h1>Envelope and CAD model selection</h1></div>
        <button data-tab-target="export">Export selected envelope</button>
      </div>
      <p>Choose the physical container for the microfactory. Default options include researched ISO container envelopes and generated parametric CAD structures that can be exported with the full factory package.</p>
      <div class="envelope-grid">
        ${factoryDesign.envelopeOptions.map((option) => `
          <article class="envelope-card ${option.id === appState.selectedEnvelopeId ? 'selected' : ''}" data-envelope-id="${option.id}">
            <div class="envelope-card__top"><span>${option.category}</span><strong>${option.dimensions.length} × ${option.dimensions.width} × ${option.dimensions.height} m</strong></div>
            <h3>${option.name}</h3>
            <p>${option.recommendedUse}</p>
            <small>CAD: ${option.cadModel.status}</small>
          </article>`).join('')}
      </div>
      <section class="envelope-detail">
        <div>
          <span class="eyebrow">Selected CAD envelope</span>
          <h2>${envelope.name}</h2>
          <dl class="envelope-specs">
            <div><dt>External size</dt><dd>${envelope.dimensions.length}m × ${envelope.dimensions.width}m × ${envelope.dimensions.height}m</dd></div>
            <div><dt>Clear size</dt><dd>${envelope.clearDimensions.length}m × ${envelope.clearDimensions.width}m × ${envelope.clearDimensions.height}m</dd></div>
            <div><dt>Volume</dt><dd>${envelopeVolume(envelope)} m³ gross</dd></div>
            <div><dt>Model basis</dt><dd>${envelope.cadModel.source}</dd></div>
          </dl>
          <ul class="feature-list">${envelope.cadModel.features.map((feature) => `<li>${feature}</li>`).join('')}</ul>
          <div class="custom-dimensions ${appState.selectedEnvelopeId === 'custom' ? '' : 'is-hidden'}">
            <label>Length (m)<input type="number" min="1" step="0.1" data-custom-dimension="length" value="${appState.customEnvelope.length}" /></label>
            <label>Width (m)<input type="number" min="1" step="0.1" data-custom-dimension="width" value="${appState.customEnvelope.width}" /></label>
            <label>Height (m)<input type="number" min="1" step="0.1" data-custom-dimension="height" value="${appState.customEnvelope.height}" /></label>
          </div>
        </div>
        ${envelopeCadSvg(envelope)}
      </section>
    </section>`;
}

function exportCard(pkg) {
  const envelope = selectedEnvelope();
  return `<article class="export-card">
    <div><span class="eyebrow">${pkg.extension}</span><h3>${pkg.label}</h3></div>
    <p>${pkg.detail}</p>
    <button data-export-kind="${pkg.id}">Download ${pkg.extension}</button>
    <small>Configured for ${envelope.name}</small>
  </article>`;
}

function renderExport() {
  const envelope = selectedEnvelope();
  return `
    <section class="workspace export-view">
      <span class="eyebrow">Design handoff</span>
      <h1>Export the whole factory package</h1>
      <p>Generate Omniverse USD packages, professional CAD STEP assemblies, source TOML, photorealistic render boards, and a PDF report from the shared machine, flow, render, and envelope model.</p>
      <aside class="export-summary">
        <strong>${factoryDesign.name}</strong>
        <span>${envelope.name}</span>
        <span>${factoryDesign.machines.length} machines · ${factoryDesign.renderProfiles.length} render briefs · ${factoryDesign.flowLinks.length} flow links</span>
      </aside>
      <div class="export-grid">${factoryDesign.exportPackages.map(exportCard).join('')}</div>
      <div class="export-manifest">
        <h2>Package manifest</h2>
        <pre>${designToml({ envelope }).split('\n').slice(0, 18).join('\n')}\n...</pre>
      </div>
    </section>`;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadText(filename, contents, type) {
  downloadBlob(filename, new Blob([contents], { type }));
}

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function writeUint16(target, offset, value) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(target, offset, value) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function zipFiles(files) {
  const encoder = new TextEncoder();
  const entries = files.map((file) => ({
    path: encoder.encode(file.path),
    contents: encoder.encode(file.contents),
  }));
  const chunks = [];
  const centralDirectory = [];
  let offset = 0;

  for (const entry of entries) {
    const checksum = crc32(entry.contents);
    const local = new Uint8Array(30 + entry.path.length + entry.contents.length);
    writeUint32(local, 0, 0x04034b50);
    writeUint16(local, 4, 20);
    writeUint16(local, 6, 0x0800);
    writeUint16(local, 8, 0);
    writeUint32(local, 14, checksum);
    writeUint32(local, 18, entry.contents.length);
    writeUint32(local, 22, entry.contents.length);
    writeUint16(local, 26, entry.path.length);
    local.set(entry.path, 30);
    local.set(entry.contents, 30 + entry.path.length);
    chunks.push(local);

    const central = new Uint8Array(46 + entry.path.length);
    writeUint32(central, 0, 0x02014b50);
    writeUint16(central, 4, 20);
    writeUint16(central, 6, 20);
    writeUint16(central, 8, 0x0800);
    writeUint16(central, 10, 0);
    writeUint32(central, 16, checksum);
    writeUint32(central, 20, entry.contents.length);
    writeUint32(central, 24, entry.contents.length);
    writeUint16(central, 28, entry.path.length);
    writeUint32(central, 42, offset);
    central.set(entry.path, 46);
    centralDirectory.push(central);
    offset += local.length;
  }

  const centralSize = centralDirectory.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new Uint8Array(22);
  writeUint32(end, 0, 0x06054b50);
  writeUint16(end, 8, entries.length);
  writeUint16(end, 10, entries.length);
  writeUint32(end, 12, centralSize);
  writeUint32(end, 16, offset);
  return new Blob([...chunks, ...centralDirectory, end], { type: 'application/zip' });
}

function handleExport(kind) {
  const envelope = selectedEnvelope();
  const slug = factoryDesign.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const exporters = {
    step: [`${slug}.step`, factoryStep({ envelope }), 'model/step'],
    'cad-step': [`${slug}-cad-assembly.step`, factoryStep({ envelope }), 'model/step'],
    omniverse: [`${slug}-omniverse-usd.zip`, zipFiles(omniversePackageFiles({ envelope })), 'application/zip'],
    toml: [`${slug}.toml`, designToml({ envelope }), 'text/plain'],
    images: [`${slug}-render-board.svg`, renderBoardSvg({ envelope }), 'image/svg+xml'],
    pdf: [`${slug}-report.pdf`, reportPdf({ envelope }), 'application/pdf'],
  };
  const file = exporters[kind];
  if (!file) return;
  if (file[1] instanceof Blob) {
    downloadBlob(file[0], file[1]);
    return;
  }
  downloadText(...file);
}

export function view() {
  const content = {
    summary: renderSummary,
    machines: renderMachines,
    layout: renderLayout,
    envelope: renderEnvelope,
    flow: renderFlow,
    renders: renderRenders,
    export: renderExport,
  }[appState.activeTab]();

  return `
    <header class="app-header">
      <div class="brand"><div class="brand-mark">${factoryDesign.ui.brand.mark}</div><div><strong>${factoryDesign.ui.brand.title}</strong><span>${factoryDesign.ui.brand.subtitle}</span></div></div>
      <nav class="tabs" aria-label="Primary views">
        ${tabs.map((tab) => `<button class="tab ${appState.activeTab === tab.id ? 'active' : ''}" data-tab-target="${tab.id}">${tab.label}</button>`).join('')}
      </nav>
    </header>
    <main>${content}</main>`;
}

export function renderApp(root = document.querySelector('#root')) {
  if (!root) return;
  if (globalThis.__microfactoryRenderApp) {
    globalThis.__microfactoryRenderApp();
    return;
  }
  root.innerHTML = view();
}

async function startRenderJob(engine, resolution) {
  const response = await fetch('/api/render', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ engineId: engine.id, resolution, execute: true }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Render job failed');
  return result;
}

export function bindApp(root = document.querySelector('#root')) {
  if (!root) return;
  root.addEventListener('click', (event) => {
    const copyTarget = event.target.closest('[data-copy-prompt]');
    if (copyTarget) {
      const prompt = root.querySelector(`#${copyTarget.dataset.copyPrompt}`);
      if (prompt) {
        prompt.select();
        navigator.clipboard?.writeText(prompt.value);
        copyTarget.textContent = 'Prompt copied';
      }
      return;
    }

    const saveResolution = event.target.closest('[data-save-custom-resolution]');
    if (saveResolution) {
      appState.selectedResolutionId = 'custom';
      appState.showCustomResolutionModal = false;
      renderApp(root);
      return;
    }

    const closeResolutionModal = event.target.closest('[data-close-resolution-modal]');
    if (closeResolutionModal && event.target === closeResolutionModal) {
      appState.showCustomResolutionModal = false;
      renderApp(root);
      return;
    }

    const renderButton = event.target.closest('[data-render-selected-engine]');
    if (renderButton) {
      const engine = getRenderEngine(renderButton.dataset.renderSelectedEngine);
      const resolution = selectedRenderResolution();
      appState.selectedRenderEngineId = engine.id;
      appState.renderStatus = `${engine.name} render job starting at ${resolution.width} × ${resolution.height}.`;
      renderApp(root);
      startRenderJob(engine, resolution)
        .then((job) => {
          appState.renderStatus = job.rendererAvailable
            ? `${engine.name} render complete: ${job.outputs.join(', ')}`
            : `${engine.name} scene generated at ${job.jobDir}; install ${job.executable} to execute renders.`;
          renderApp(root);
        })
        .catch((error) => {
          appState.renderStatus = `${engine.name} render setup failed: ${error.message}`;
          renderApp(root);
        });
      return;
    }

    const exportTarget = event.target.closest('[data-export-kind]');
    if (exportTarget) {
      handleExport(exportTarget.dataset.exportKind);
      return;
    }

    const deleteMachineTarget = event.target.closest('[data-delete-machine-id]');
    if (deleteMachineTarget) {
      deleteMachineFromLayout(deleteMachineTarget.dataset.deleteMachineId);
      renderApp(root);
      return;
    }

    const rotateMachineTarget = event.target.closest('[data-rotate-machine-id]');
    if (rotateMachineTarget) {
      rotateMachineFootprint(rotateMachineTarget.dataset.rotateMachineId);
      renderApp(root);
      return;
    }

    const target = event.target.closest('[data-tab-target], [data-machine-id], [data-envelope-id], [data-render-engine-id], [data-render-resolution-id]');

    if (!target) return;
    if (target.dataset.tabTarget) {
      appState.activeTab = target.dataset.tabTarget;
    }
    if (target.dataset.machineId) {
      appState.selectedMachineId = target.dataset.machineId;
    }
    if (target.dataset.envelopeId) {
      appState.selectedEnvelopeId = target.dataset.envelopeId;
    }
    if (target.dataset.renderEngineId) {
      appState.selectedRenderEngineId = target.dataset.renderEngineId;
      appState.renderStatus = '';
    }
    if (target.dataset.renderResolutionId) {
      appState.selectedResolutionId = target.dataset.renderResolutionId;
      appState.showCustomResolutionModal = target.dataset.renderResolutionId === 'custom';
      appState.renderStatus = '';
    }
    renderApp(root);
  });

  root.addEventListener('dragstart', (event) => {
    const paletteMachine = event.target.closest('[data-catalog-machine-id]');
    if (!paletteMachine) return;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', paletteMachine.dataset.catalogMachineId);
  });

  root.addEventListener('dragover', (event) => {
    if (!event.target.closest('.layout-shell')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });

  root.addEventListener('drop', (event) => {
    if (!event.target.closest('.layout-shell')) return;
    event.preventDefault();
    dropMachineOnLayout(root, event.dataTransfer.getData('text/plain'), event.clientX, event.clientY);
  });

  root.addEventListener('wheel', (event) => {
    const svg = event.target.closest('.layout-shell[data-layout-pan-zoom="true"] .layout-canvas');
    if (!svg) return;
    zoomLayoutAtPointer(svg, event);
  }, { passive: false });

  root.addEventListener('pointerdown', (event) => {
    const divider = event.target.closest('[data-split-divider]');
    if (divider) {
      startSplitDrag(root, divider, event);
      return;
    }

    const machine = event.target.closest('[data-layout-draggable]');
    if (machine) {
      startMachineDrag(root, machine, event);
      return;
    }

    const layoutCanvas = event.target.closest('.layout-shell[data-layout-pan-zoom="true"] .layout-canvas');
    if (layoutCanvas) startLayoutPan(root, layoutCanvas, event);
  });

  root.addEventListener('keydown', (event) => {
    const deleteMachineTarget = event.target.closest('[data-delete-machine-id]');
    if (deleteMachineTarget && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      deleteMachineFromLayout(deleteMachineTarget.dataset.deleteMachineId);
      renderApp(root);
      return;
    }

    const rotateMachineTarget = event.target.closest('[data-rotate-machine-id]');
    if (rotateMachineTarget && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      rotateMachineFootprint(rotateMachineTarget.dataset.rotateMachineId);
      renderApp(root);
      return;
    }

    const divider = event.target.closest('[data-split-divider]');
    if (!divider || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    event.preventDefault();
    if (event.key === 'Home') appState.split = 25;
    if (event.key === 'End') appState.split = 75;
    if (event.key === 'ArrowLeft') appState.split = Math.max(25, appState.split - 2);
    if (event.key === 'ArrowRight') appState.split = Math.min(75, appState.split + 2);
    renderApp(root);
  });

  root.addEventListener('change', (event) => {
    if (event.target.id === 'flowToggle') {
      appState.showFlow = event.target.checked;
      renderApp(root);
    }
  });

  root.addEventListener('input', (event) => {
    if (event.target.dataset.customDimension) {
      appState.customEnvelope[event.target.dataset.customDimension] = Number(event.target.value);
      renderApp(root);
    }
    if (event.target.dataset.customRenderResolution) {
      appState.customResolution[event.target.dataset.customRenderResolution] = Number(event.target.value);
    }
  });
}

export { appState, tabs, layoutSvg, flowGraph, renderFlow, renderLayout, renderRenders, renderEnvelope, renderExport, envelopeCadSvg };
