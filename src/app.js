import { factoryDesign, machineLibrary, designMetrics, renderPrompt } from './data.js';

const tabs = [
  { id: 'summary', label: 'Summary' },
  { id: 'machines', label: 'Machines' },
  { id: 'layout', label: 'Layout' },
  { id: 'flow', label: 'Flow' },
  { id: 'renders', label: 'Renders' },
];

const appState = {
  activeTab: 'summary',
  showFlow: true,
  selectedMachineId: factoryDesign.machines[0].id,
  layoutMachines: factoryDesign.machines.map((machine) => ({ ...machine, source: 'Baseline factory model' })),
  split: 50,
};

const getMachine = (id) => appState.layoutMachines.find((machine) => machine.id === id) ?? factoryDesign.machines.find((machine) => machine.id === id) ?? appState.layoutMachines[0];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function machineFromLibrary(libraryId, x = 1.2, y = 1.2) {
  const asset = machineLibrary.find((machine) => machine.id === libraryId);
  if (!asset) return null;
  const instanceNumber = appState.layoutMachines.filter((machine) => machine.libraryId === asset.id).length + 1;
  const footprint = {
    x: clamp(x, 0.6, factoryDesign.floorSize.width - asset.footprint.w - 0.6),
    y: clamp(y, 0.6, factoryDesign.floorSize.height - asset.footprint.h - 0.6),
    w: asset.footprint.w,
    h: asset.footprint.h,
  };

  return {
    id: `${asset.id}-${Date.now()}-${instanceNumber}`,
    libraryId: asset.id,
    name: asset.name,
    type: asset.category,
    status: 'Planned',
    operator: 'Configure after placement',
    cycleTime: asset.cycleTime,
    uptime: 95,
    energy: asset.energy,
    footprint,
    inputs: asset.inputs,
    outputs: asset.outputs,
    parameters: asset.parameters,
    source: asset.source,
    sourceUrl: asset.sourceUrl,
    why: asset.why,
  };
}

function placeLibraryMachine(libraryId, x, y) {
  const machine = machineFromLibrary(libraryId, x, y);
  if (!machine) return false;
  appState.layoutMachines = [...appState.layoutMachines, machine];
  appState.selectedMachineId = machine.id;
  return true;
}

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

function layoutSvg({ compact = false } = {}) {
  const width = 640;
  const height = 380;
  const scaleX = width / factoryDesign.floorSize.width;
  const scaleY = height / factoryDesign.floorSize.height;
  const machines = appState.layoutMachines
    .map((machine) => {
      const { x, y, w, h } = machine.footprint;
      const selected = machine.id === appState.selectedMachineId ? ' selected' : '';
      return `
        <g class="layout-machine${selected}" data-machine-id="${machine.id}" tabindex="0" role="button" aria-label="Select ${machine.name}">
          <rect x="${x * scaleX}" y="${y * scaleY}" width="${w * scaleX}" height="${h * scaleY}" rx="14" />
          <text x="${(x + w / 2) * scaleX}" y="${(y + h / 2) * scaleY - 5}" text-anchor="middle">${machine.name.split(' ')[0]}</text>
          <text class="layout-machine__sub" x="${(x + w / 2) * scaleX}" y="${(y + h / 2) * scaleY + 17}" text-anchor="middle">${machine.cycleTime}s takt</text>
        </g>`;
    })
    .join('');

  const flows = appState.showFlow
    ? factoryDesign.flowLinks
        .map(([fromId, toId]) => {
          const from = getMachine(fromId).footprint;
          const to = getMachine(toId).footprint;
          return `<path class="flow-line" d="M ${(from.x + from.w) * scaleX} ${(from.y + from.h / 2) * scaleY} C ${(from.x + from.w + 1.5) * scaleX} ${(from.y + from.h / 2) * scaleY}, ${(to.x - 1.5) * scaleX} ${(to.y + to.h / 2) * scaleY}, ${to.x * scaleX} ${(to.y + to.h / 2) * scaleY}" />`;
        })
        .join('')
    : '';

  return `
    <div class="layout-shell ${compact ? 'compact' : ''}">
      <svg class="layout-canvas" viewBox="0 0 ${width} ${height}" role="img" aria-label="Top down microfactory layout">
        <defs>
          <pattern id="floor-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(148, 163, 184, .18)" stroke-width="1" />
          </pattern>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L8,3 z" fill="#3ee7c6" />
          </marker>
        </defs>
        <rect width="${width}" height="${height}" rx="24" fill="url(#floor-grid)" />
        <rect x="18" y="18" width="${width - 36}" height="${height - 36}" rx="20" class="floor-boundary" />
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
        <p>Design a compact microfactory from machine parameters to layout, material movement, process transformations, and render direction.</p>
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

function machinePaletteCard(machine) {
  return `
    <button class="palette-card" draggable="true" data-library-machine-id="${machine.id}" aria-label="Drag ${machine.name} onto the layout">
      <span class="palette-card__category">${machine.category}</span>
      <strong>${machine.name}</strong>
      <small>${machine.type}</small>
      <p>${machine.why}</p>
      <span class="palette-card__source">Source: ${machine.source}</span>
    </button>`;
}

function renderLayout() {
  const selected = getMachine(appState.selectedMachineId);
  return `
    <section class="workspace layout-workspace">
      <aside class="machine-palette" aria-label="Potential machines">
        <span class="eyebrow">Machine menu</span>
        <h2>Drag machines onto the layout</h2>
        <p>Popular microfactory-ready assets researched from compact metal additive, wire EDM, and CNC milling product families.</p>
        <div class="palette-list">${machineLibrary.map((machine) => machinePaletteCard(machine)).join('')}</div>
      </aside>
      <div class="layout-stage">
        <div class="panel-heading large">
          <div><span class="eyebrow">Top-down layout</span><h1>Machine placement and product movement</h1></div>
          <label class="switch"><input type="checkbox" id="flowToggle" ${appState.showFlow ? 'checked' : ''} /> <span>Show product flow</span></label>
        </div>
        <div data-layout-dropzone="true">${layoutSvg()}</div>
        <aside class="layout-inspector">
          <strong>${selected.name}</strong>
          <span>${selected.type}</span>
          <p>${selected.inputs.join(' + ')} → ${selected.outputs.join(' + ')}</p>
          ${selected.source ? `<small>Source: ${selected.sourceUrl ? `<a href="${selected.sourceUrl}" target="_blank" rel="noreferrer">${selected.source}</a>` : selected.source}</small>` : ''}
        </aside>
      </div>
    </section>`;
}

function renderFlow() {
  return `
    <section class="workspace">
      <div class="panel-heading large">
        <div><span class="eyebrow">Process flow</span><h1>Feedstock-to-finished transformation model</h1></div>
        <label class="range-label">Visual focus <input id="splitRange" type="range" min="25" max="75" value="${appState.split}" /></label>
      </div>
      <div class="flow-split" style="grid-template-columns: ${appState.split}% 1fr">
        <section class="flow-text-panel"><h2>Text representation</h2>${flowText()}</section>
        <section class="flow-visual-panel"><h2>Visual graph</h2>${flowGraph()}</section>
      </div>
    </section>`;
}

function renderRenders() {
  return `
    <section class="workspace renders-view">
      <span class="eyebrow">Photorealistic render planner</span>
      <h1>Create credible visual direction from the factory model</h1>
      <p>Each render card is generated from the same machines, floor scale, and process story as the rest of the studio, turning the design into a practical photorealistic render brief.</p>
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

function view() {
  const content = {
    summary: renderSummary,
    machines: renderMachines,
    layout: renderLayout,
    flow: renderFlow,
    renders: renderRenders,
  }[appState.activeTab]();

  return `
    <header class="app-header">
      <div class="brand"><div class="brand-mark">µ</div><div><strong>Microfactory Studio</strong><span>layout · flow · renders</span></div></div>
      <nav class="tabs" aria-label="Primary views">
        ${tabs.map((tab) => `<button class="tab ${appState.activeTab === tab.id ? 'active' : ''}" data-tab-target="${tab.id}">${tab.label}</button>`).join('')}
      </nav>
    </header>
    <main>${content}</main>`;
}

export function renderApp(root = document.querySelector('#root')) {
  if (!root) return;
  root.innerHTML = view();
}

export function bindApp(root = document.querySelector('#root')) {
  if (!root) return;
  root.addEventListener('dragstart', (event) => {
    const card = event.target.closest('[data-library-machine-id]');
    if (!card) return;
    event.dataTransfer?.setData('text/plain', card.dataset.libraryMachineId);
    event.dataTransfer?.setData('application/x-machine-library-id', card.dataset.libraryMachineId);
  });

  root.addEventListener('dragover', (event) => {
    if (event.target.closest('[data-layout-dropzone]')) {
      event.preventDefault();
    }
  });

  root.addEventListener('drop', (event) => {
    const dropzone = event.target.closest('[data-layout-dropzone]');
    if (!dropzone) return;
    event.preventDefault();
    const libraryId = event.dataTransfer?.getData('application/x-machine-library-id') || event.dataTransfer?.getData('text/plain');
    const svg = dropzone.querySelector('.layout-canvas');
    const asset = machineLibrary.find((machine) => machine.id === libraryId);
    if (!svg || !asset) return;
    const rect = svg.getBoundingClientRect();
    const floorX = ((event.clientX - rect.left) / rect.width) * factoryDesign.floorSize.width - asset.footprint.w / 2;
    const floorY = ((event.clientY - rect.top) / rect.height) * factoryDesign.floorSize.height - asset.footprint.h / 2;
    if (placeLibraryMachine(libraryId, floorX, floorY)) {
      renderApp(root);
    }
  });

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

    const libraryTarget = event.target.closest('[data-library-machine-id]');
    if (libraryTarget) {
      const offset = appState.layoutMachines.length % 5;
      placeLibraryMachine(libraryTarget.dataset.libraryMachineId, 1.4 + offset * 3.2, 10);
      renderApp(root);
      return;
    }

    const target = event.target.closest('[data-tab-target], [data-machine-id]');
    if (!target) return;
    if (target.dataset.tabTarget) {
      appState.activeTab = target.dataset.tabTarget;
    }
    if (target.dataset.machineId) {
      appState.selectedMachineId = target.dataset.machineId;
    }
    renderApp(root);
  });

  root.addEventListener('change', (event) => {
    if (event.target.id === 'flowToggle') {
      appState.showFlow = event.target.checked;
      renderApp(root);
    }
  });

  root.addEventListener('input', (event) => {
    if (event.target.id === 'splitRange') {
      appState.split = Number(event.target.value);
      renderApp(root);
    }
  });
}

export { appState, tabs, layoutSvg, flowGraph, placeLibraryMachine };
