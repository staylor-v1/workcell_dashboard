export const factoryDesign = {
  name: 'Aster Microfactory Concept',
  product: 'Smart sensor pod',
  throughput: '480 units / shift',
  taktTime: '58 sec',
  floorSize: { width: 24, height: 14, unit: 'm' },
  machines: [
    {
      id: 'prep',
      name: 'Feedstock Prep Cell',
      type: 'Material Conditioning',
      status: 'Nominal',
      operator: '1 shared',
      cycleTime: 42,
      uptime: 96,
      energy: 4.8,
      footprint: { x: 1.2, y: 2.2, w: 4.1, h: 2.4 },
      inputs: ['Polymer pellets', 'Copper blanks'],
      outputs: ['Dried resin', 'Stamped contacts'],
      parameters: [
        ['Dryer temp', '74 °C'],
        ['Moisture target', '< 0.04%'],
        ['Blank feed rate', '68/min'],
      ],
    },
    {
      id: 'mold',
      name: 'Precision Molding Island',
      type: 'Forming',
      status: 'Optimizing',
      operator: 'Lights-out',
      cycleTime: 58,
      uptime: 93,
      energy: 18.2,
      footprint: { x: 7.1, y: 1.4, w: 4.6, h: 3.1 },
      inputs: ['Dried resin', 'Stamped contacts'],
      outputs: ['Overmolded shell'],
      parameters: [
        ['Clamp force', '120 ton'],
        ['Mold temp', '62 °C'],
        ['Cavity count', '4-up'],
      ],
    },
    {
      id: 'pcb',
      name: 'Electronics Assembly Cell',
      type: 'SMT + Micro Assembly',
      status: 'Nominal',
      operator: '1 technician',
      cycleTime: 51,
      uptime: 97,
      energy: 9.6,
      footprint: { x: 13.4, y: 1.8, w: 4.5, h: 2.8 },
      inputs: ['Bare PCB', 'MEMS sensor', 'Battery tab'],
      outputs: ['Testable PCB stack'],
      parameters: [
        ['Placement accuracy', '±18 µm'],
        ['Reflow profile', 'Lead-free 5-zone'],
        ['AOI sampling', '100%'],
      ],
    },
    {
      id: 'assembly',
      name: 'Robotic Final Assembly',
      type: 'Assembly',
      status: 'Nominal',
      operator: '1 shared',
      cycleTime: 55,
      uptime: 95,
      energy: 7.4,
      footprint: { x: 9.2, y: 7.1, w: 4.8, h: 3.2 },
      inputs: ['Overmolded shell', 'Testable PCB stack', 'Gasket'],
      outputs: ['Sealed sensor pod'],
      parameters: [
        ['Robot reach', '900 mm'],
        ['Adhesive bead', '0.42 mm'],
        ['Torque control', '±3%'],
      ],
    },
    {
      id: 'test',
      name: 'Validation & Packout',
      type: 'Test + Packaging',
      status: 'Nominal',
      operator: '1 inspector',
      cycleTime: 47,
      uptime: 98,
      energy: 3.1,
      footprint: { x: 17.1, y: 7.3, w: 4.1, h: 3.0 },
      inputs: ['Sealed sensor pod'],
      outputs: ['Finished and serialized product'],
      parameters: [
        ['Leak decay', '< 0.12 kPa/min'],
        ['Calibration points', '9-axis'],
        ['Pack format', '12 tray carton'],
      ],
    },
  ],
  flow: [
    {
      id: 'feedstock',
      title: 'Condition feedstock',
      state: 'Stable raw materials',
      detail: 'Resin is dried, contacts are blanked, and incoming lots are staged against the takt plan.',
      visual: '◌',
    },
    {
      id: 'form',
      title: 'Form product shell',
      state: 'Overmolded enclosure',
      detail: 'Contacts are insert-molded into a rugged polymer shell with traceable cavity data.',
      visual: '⬡',
    },
    {
      id: 'electronics',
      title: 'Build electronics core',
      state: 'Functional PCB stack',
      detail: 'Sensors, power tabs, and firmware identity are assembled and optically inspected.',
      visual: '▣',
    },
    {
      id: 'seal',
      title: 'Seal final assembly',
      state: 'Environmental pod',
      detail: 'Robot places the PCB stack, dispenses gasket adhesive, and closes the pod.',
      visual: '◈',
    },
    {
      id: 'validate',
      title: 'Validate and pack',
      state: 'Finished tested product',
      detail: 'Leak, calibration, communications, and serialization checks release units to packout.',
      visual: '◆',
    },
  ],
  flowLinks: [
    ['prep', 'mold'],
    ['prep', 'pcb'],
    ['mold', 'assembly'],
    ['pcb', 'assembly'],
    ['assembly', 'test'],
  ],

  envelopeOptions: [
    {
      id: 'conex-40',
      name: '40ft Conex / ISO dry container',
      category: 'Intermodal steel container',
      dimensions: { length: 12.192, width: 2.438, height: 2.591, unit: 'm' },
      clearDimensions: { length: 12.03, width: 2.35, height: 2.39, unit: 'm' },
      recommendedUse: 'Road-transportable linear microfactory with utilities packed along one wall.',
      cadModel: {
        status: 'Parametric model created in-app',
        source: 'ISO 668 nominal external dimensions; corrugations, corner castings, forklift pockets, double doors, and interior clear volume are generated from dimensions.',
        features: ['corrugated steel shell', 'corner castings', 'rear double doors', 'forklift pockets', 'interior clearance box'],
      },
    },
    {
      id: 'conex-20',
      name: '20ft Conex / ISO dry container',
      category: 'Intermodal steel container',
      dimensions: { length: 6.058, width: 2.438, height: 2.591, unit: 'm' },
      clearDimensions: { length: 5.9, width: 2.35, height: 2.39, unit: 'm' },
      recommendedUse: 'Pilot-cell deployment, field service lab, training cell, or compact single-product line.',
      cadModel: {
        status: 'Parametric model created in-app',
        source: 'ISO 668 nominal external dimensions with generated Conex details scaled to 20ft length.',
        features: ['corrugated steel shell', 'corner castings', 'single-end cargo doors', 'tie-down rails', 'interior clearance box'],
      },
    },
    {
      id: 'high-cube-40',
      name: '40ft High-Cube Conex',
      category: 'Tall intermodal steel container',
      dimensions: { length: 12.192, width: 2.438, height: 2.896, unit: 'm' },
      clearDimensions: { length: 12.03, width: 2.35, height: 2.69, unit: 'm' },
      recommendedUse: 'Robotics, overhead conveyors, air handling, mezzanine service racks, and taller safety guarding.',
      cadModel: {
        status: 'Parametric model created in-app',
        source: 'High-cube variant of ISO Series 1 envelope; extra height is modeled as a taller corrugated sidewall.',
        features: ['high-cube roof line', 'corrugated walls', 'corner castings', 'overhead utility raceway allowance'],
      },
    },
    {
      id: 'modular-skid',
      name: 'Skid-mounted modular cleanroom pod',
      category: 'Panelized microfactory pod',
      dimensions: { length: 9.0, width: 3.6, height: 3.2, unit: 'm' },
      clearDimensions: { length: 8.6, width: 3.2, height: 2.85, unit: 'm' },
      recommendedUse: 'GMP-style assembly, controlled humidity, local HEPA plenum, or precision electronics work.',
      cadModel: {
        status: 'Parametric model created in-app',
        source: 'Created from typical panelized cleanroom module constraints rather than a single vendor CAD download.',
        features: ['insulated wall panels', 'flush personnel door', 'service chase', 'HEPA ceiling modules', 'skid base'],
      },
    },
    {
      id: 'deployable-shelter',
      name: 'Expandable field shelter',
      category: 'Deployable structure',
      dimensions: { length: 6.1, width: 5.6, height: 2.8, unit: 'm' },
      clearDimensions: { length: 5.8, width: 5.2, height: 2.45, unit: 'm' },
      recommendedUse: 'Rapid-response repair cell, military or disaster-relief production, and temporary factory deployment.',
      cadModel: {
        status: 'Parametric model created in-app',
        source: 'Generated from common expandable shelter proportions with hinged side bays and leveling feet.',
        features: ['fold-out side bays', 'leveling jacks', 'soft utility vestibule', 'ribbed roof panels'],
      },
    },
    {
      id: 'custom',
      name: 'Custom envelope',
      category: 'User-defined',
      dimensions: { length: 10.0, width: 4.0, height: 3.0, unit: 'm' },
      clearDimensions: { length: 9.6, width: 3.6, height: 2.7, unit: 'm' },
      recommendedUse: 'Specify exact length, width, and height for a building bay, trailer, tent, pod, or custom fabrication.',
      cadModel: {
        status: 'Generated from user dimensions',
        source: 'Created as a neutral rectangular CAD envelope with optional wall thickness and service openings.',
        features: ['custom dimension shell', 'editable wall thickness', 'service openings', 'interior keep-out volume'],
      },
    },
  ],
  exportPackages: [
    { id: 'step', label: 'Factory STEP', extension: '.step', detail: 'Whole-factory CAD assembly with envelope, floor, machines, utility keep-outs, and product-flow reference geometry.' },
    { id: 'yaml', label: 'Design YAML', extension: '.yaml', detail: 'Human-readable design source of truth for machines, layout, envelope, flow, renders, and export metadata.' },
    { id: 'images', label: 'Rendered images', extension: '.svg', detail: 'Photorealistic render-board SVG containing the configured render prompts and camera notes.' },
    { id: 'pdf', label: 'PDF report', extension: '.pdf', detail: 'Client-side report package summarizing envelope selection, machine metrics, render prompts, and included export files.' },
  ],
  renderProfiles: [
    {
      id: 'overview',
      title: 'Factory overview',
      camera: '24 mm wide angle, 1.6 m operator eye height',
      lighting: 'soft overhead grid with cyan flow accents',
      materials: 'brushed aluminum, matte black fixtures, polished concrete',
      subject: 'all five workcells, aisles, safety envelopes, and animated product-flow traces',
    },
    {
      id: 'assembly-hero',
      title: 'Assembly hero shot',
      camera: '70 mm lens, shallow depth of field, three-quarter view',
      lighting: 'warm key light with cool robotic-cell rim light',
      materials: 'ceramic grippers, transparent guard panels, satin polymer product shell',
      subject: 'robot placing the electronics stack and sealing a smart sensor pod',
    },
    {
      id: 'transformation',
      title: 'Transformation sequence',
      camera: 'orthographic exploded product-state composition',
      lighting: 'studio gradient with crisp contact shadows',
      materials: 'raw resin, stamped copper, populated PCB, gasket adhesive, serialized carton',
      subject: 'feedstock through validated packaged product in five states',
    },
  ],
};

export function designMetrics(design = factoryDesign) {
  const machineCount = design.machines.length;
  const averageUptime = design.machines.reduce((sum, machine) => sum + machine.uptime, 0) / machineCount;
  const totalEnergy = design.machines.reduce((sum, machine) => sum + machine.energy, 0);
  const bottleneck = design.machines.reduce((slowest, machine) =>
    machine.cycleTime > slowest.cycleTime ? machine : slowest
  );

  return {
    machineCount,
    averageUptime: Number(averageUptime.toFixed(1)),
    totalEnergy: Number(totalEnergy.toFixed(1)),
    bottleneck: bottleneck.name,
  };
}

export function renderPrompt(profile, design = factoryDesign) {
  return `Photorealistic industrial microfactory render for ${design.product}: ${profile.subject}. Camera: ${profile.camera}. Lighting: ${profile.lighting}. Materials: ${profile.materials}. Include credible ${design.floorSize.width}m x ${design.floorSize.height}m scale, clean cable routing, safety markings, and premium manufacturing-detail realism.`;
}


export function getEnvelope(id, design = factoryDesign) {
  return design.envelopeOptions.find((envelope) => envelope.id === id) ?? design.envelopeOptions[0];
}

export function envelopeVolume(envelope) {
  const { length, width, height } = envelope.dimensions;
  return Number((length * width * height).toFixed(1));
}

function yamlValue(value, depth = 0) {
  const indent = '  '.repeat(depth);
  if (Array.isArray(value)) {
    return value.length
      ? `\n${value.map((item) => `${indent}- ${typeof item === 'object' ? yamlValue(item, depth + 1).trimStart() : item}`).join('\n')}`
      : ' []';
  }
  if (value && typeof value === 'object') {
    return `\n${Object.entries(value)
      .map(([key, item]) => `${indent}${key}:${yamlValue(item, depth + 1)}`)
      .join('\n')}`;
  }
  return ` ${String(value).replace(/:/g, ' -')}`;
}

export function designYaml({ design = factoryDesign, envelope = getEnvelope('conex-40', design) } = {}) {
  const exportModel = {
    project: design.name,
    product: design.product,
    throughput: design.throughput,
    taktTime: design.taktTime,
    floorSize: design.floorSize,
    envelope: {
      id: envelope.id,
      name: envelope.name,
      category: envelope.category,
      dimensions: envelope.dimensions,
      clearDimensions: envelope.clearDimensions,
      cadModel: envelope.cadModel,
    },
    machines: design.machines.map(({ id, name, type, cycleTime, uptime, energy, footprint }) => ({
      id,
      name,
      type,
      cycleTimeSeconds: cycleTime,
      uptimePercent: uptime,
      energyKw: energy,
      footprint,
    })),
    flowLinks: design.flowLinks,
    renderProfiles: design.renderProfiles.map(({ id, title, camera, lighting, materials }) => ({ id, title, camera, lighting, materials })),
  };
  return Object.entries(exportModel).map(([key, value]) => `${key}:${yamlValue(value, 1)}`).join('\n');
}

export function factoryStep({ design = factoryDesign, envelope = getEnvelope('conex-40', design) } = {}) {
  const dims = envelope.dimensions;
  const machines = design.machines
    .map((machine, index) => `#${40 + index}=PRODUCT('MACHINE_${machine.id.toUpperCase()}','${machine.name}', 'footprint ${machine.footprint.w}m x ${machine.footprint.h}m', (#10));`)
    .join('\n');
  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('Microfactory Studio whole factory envelope and machine placeholder assembly'),'2;1');
FILE_NAME('${design.name.replaceAll("'", '')}.step','2026-06-08T00:00:00',('Microfactory Studio'),('OpenAI'), 'Microfactory Studio exporter','Microfactory Studio','');
FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF'));
ENDSEC;
DATA;
#10=PRODUCT_CONTEXT('microfactory design',#20,'mechanical');
#20=APPLICATION_CONTEXT('whole factory export');
#30=PRODUCT('ENVELOPE_${envelope.id.toUpperCase()}','${envelope.name}','${dims.length}m x ${dims.width}m x ${dims.height}m parametric shell: ${envelope.cadModel.features.join(', ')}',(#10));
${machines}
#90=PRODUCT('PRODUCT_FLOW','${design.product} flow path','${design.flowLinks.map(([from, to]) => `${from}->${to}`).join('; ')}',(#10));
ENDSEC;
END-ISO-10303-21;`;
}

export function renderBoardSvg({ design = factoryDesign, envelope = getEnvelope('conex-40', design) } = {}) {
  const prompts = design.renderProfiles.map((profile, index) => `${index + 1}. ${profile.title}: ${renderPrompt(profile, design)}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" role="img" aria-label="Photorealistic render board for ${design.name}">
  <defs><linearGradient id="bg" x1="0" x2="1"><stop stop-color="#020617"/><stop offset="1" stop-color="#0f766e"/></linearGradient></defs>
  <rect width="1600" height="1000" fill="url(#bg)"/>
  <text x="80" y="110" fill="#f8fafc" font-size="54" font-family="Arial" font-weight="700">${design.name}</text>
  <text x="80" y="170" fill="#99f6e4" font-size="28" font-family="Arial">Envelope: ${envelope.name} (${envelope.dimensions.length}m x ${envelope.dimensions.width}m x ${envelope.dimensions.height}m)</text>
  ${prompts.map((prompt, index) => `<foreignObject x="80" y="${240 + index * 230}" width="1440" height="180"><div xmlns="http://www.w3.org/1999/xhtml" style="font: 30px Arial; color: white; line-height: 1.35; background: rgba(15,23,42,.72); border: 1px solid rgba(153,246,228,.35); border-radius: 24px; padding: 28px;">${prompt}</div></foreignObject>`).join('\n  ')}
</svg>`;
}

export function reportPdf({ design = factoryDesign, envelope = getEnvelope('conex-40', design) } = {}) {
  const metrics = designMetrics(design);
  const lines = [
    'Microfactory Studio Export Report',
    design.name,
    `Product: ${design.product}`,
    `Envelope: ${envelope.name}`,
    `Envelope dimensions: ${envelope.dimensions.length}m x ${envelope.dimensions.width}m x ${envelope.dimensions.height}m`,
    `Machines: ${metrics.machineCount}`,
    `Total load: ${metrics.totalEnergy} kW`,
    `Bottleneck: ${metrics.bottleneck}`,
    'Includes: STEP assembly, YAML design, render-board SVG, and this PDF report.',
  ];
  const text = lines.map((line, index) => `BT /F1 14 Tf 72 ${760 - index * 28} Td (${line.replace(/[()]/g, '')}) Tj ET`).join('\n');
  return `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length ${text.length} >> stream
${text}
endstream endobj
trailer << /Root 1 0 R >>
%%EOF`;
}
