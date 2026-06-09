import { designMetrics, designToml, envelopeVolume, factoryDesign, factoryStep, getEnvelope, getRenderEngine, getRenderResolution, normalizedRenderResolution, renderBoardSvg, renderJobManifest, renderPrompt, renderViewPlan, reportPdf } from './data.js';

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
};

const layoutMachines = () => [...factoryDesign.machines, ...appState.placedMachines];

const getMachine = (id) => layoutMachines().find((machine) => machine.id === id) ?? factoryDesign.machines[0];
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

function layoutSvg({ compact = false } = {}) {
  const width = 640;
  const height = 380;
  const envelope = selectedEnvelope();
  const scaleX = width / Math.max(factoryDesign.floorSize.width, envelope.dimensions.length);
  const scaleY = height / Math.max(factoryDesign.floorSize.height, envelope.dimensions.width);
  const machines = layoutMachines()
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
        <rect x="0" y="0" width="${envelope.dimensions.length * scaleX}" height="${envelope.dimensions.width * scaleY}" rx="18" class="envelope-boundary" />
        <text x="24" y="34" class="envelope-label">${envelope.name}</text>
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
                <small>${machine.buildVolume}</small>
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

  const bounds = svg.getBoundingClientRect();
  const envelope = selectedEnvelope();
  const viewWidth = 640;
  const viewHeight = 380;
  const scaleX = viewWidth / Math.max(factoryDesign.floorSize.width, envelope.dimensions.length);
  const scaleY = viewHeight / Math.max(factoryDesign.floorSize.height, envelope.dimensions.width);
  const pointerX = ((clientX - bounds.left) / bounds.width) * viewWidth;
  const pointerY = ((clientY - bounds.top) / bounds.height) * viewHeight;
  const footprint = catalogMachine.footprint;
  const x = Math.min(Math.max(pointerX / scaleX - footprint.w / 2, 0), factoryDesign.floorSize.width - footprint.w);
  const y = Math.min(Math.max(pointerY / scaleY - footprint.h / 2, 0), factoryDesign.floorSize.height - footprint.h);
  const placedMachine = createPlacedMachine(catalogMachine, Number(x.toFixed(2)), Number(y.toFixed(2)));

  appState.placedMachines = [...appState.placedMachines, placedMachine];
  appState.selectedMachineId = placedMachine.id;
  renderApp(root);
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
      <p>Generate neutral CAD, source TOML, photorealistic render boards, and a PDF report from the shared machine, flow, render, and envelope model.</p>
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

function downloadText(filename, contents, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function handleExport(kind) {
  const envelope = selectedEnvelope();
  const slug = factoryDesign.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const exporters = {
    step: [`${slug}.step`, factoryStep({ envelope }), 'model/step'],
    toml: [`${slug}.toml`, designToml({ envelope }), 'text/plain'],
    images: [`${slug}-render-board.svg`, renderBoardSvg({ envelope }), 'image/svg+xml'],
    pdf: [`${slug}-report.pdf`, reportPdf({ envelope }), 'application/pdf'],
  };
  const file = exporters[kind];
  if (file) downloadText(...file);
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

  root.addEventListener('pointerdown', (event) => {
    const divider = event.target.closest('[data-split-divider]');
    if (divider) startSplitDrag(root, divider, event);
  });

  root.addEventListener('keydown', (event) => {
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
