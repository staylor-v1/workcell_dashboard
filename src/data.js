import { config, configSourceFiles, factoryDesign } from './config.js';

export { config as factoryConfig, configSourceFiles, factoryDesign };

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

function tomlString(value) {
  return JSON.stringify(String(value));
}

function tomlValue(value) {
  if (Array.isArray(value)) return `[${value.map(tomlValue).join(', ')}]`;
  if (value && typeof value === 'object') {
    return `{ ${Object.entries(value).map(([key, item]) => `${key} = ${tomlValue(item)}`).join(', ')} }`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return tomlString(value);
}

function tomlField(key, value) {
  return `${key} = ${tomlValue(value)}`;
}

export function designToml({ design = factoryDesign, envelope = getEnvelope('conex-40', design) } = {}) {
  const lines = [
    tomlField('project', design.name),
    tomlField('product', design.product),
    tomlField('throughput', design.throughput),
    tomlField('taktTime', design.taktTime),
    tomlField('floorSize', design.floorSize),
    tomlField('flowLinks', design.flowLinks),
    '',
    '[envelope]',
    tomlField('id', envelope.id),
    tomlField('name', envelope.name),
    tomlField('category', envelope.category),
    tomlField('dimensions', envelope.dimensions),
    tomlField('clearDimensions', envelope.clearDimensions),
    tomlField('cadModel', envelope.cadModel),
    '',
  ];

  for (const { id, name, type, cycleTime, uptime, energy, footprint } of design.machines) {
    lines.push(
      '[[machines]]',
      tomlField('id', id),
      tomlField('name', name),
      tomlField('type', type),
      tomlField('cycleTimeSeconds', cycleTime),
      tomlField('uptimePercent', uptime),
      tomlField('energyKw', energy),
      tomlField('footprint', footprint),
      '',
    );
  }

  for (const { id, name, type, category, buildVolume, sourceUrl, footprint } of design.machineCatalog) {
    lines.push(
      '[[machineCatalog]]',
      tomlField('id', id),
      tomlField('name', name),
      tomlField('type', type),
      tomlField('category', category),
      tomlField('buildVolume', buildVolume),
      tomlField('sourceUrl', sourceUrl),
      tomlField('footprint', footprint),
      '',
    );
  }

  for (const { id, title, camera, lighting, materials } of design.renderProfiles) {
    lines.push(
      '[[renderProfiles]]',
      tomlField('id', id),
      tomlField('title', title),
      tomlField('camera', camera),
      tomlField('lighting', lighting),
      tomlField('materials', materials),
      '',
    );
  }

  return lines.join('\n').trimEnd();
}

export function factoryStep({ design = factoryDesign, envelope = getEnvelope('conex-40', design) } = {}) {
  const dims = envelope.dimensions;
  const machines = design.machines
    .map((machine, index) => `#${40 + index}=PRODUCT('MACHINE_${machine.id.toUpperCase()}','${machine.name}', 'footprint ${machine.footprint.w}m x ${machine.footprint.h}m', (#10));`)
    .join('\n');
  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('Microfactory Studio whole factory envelope and machine placeholder assembly'),'2;1');
FILE_NAME('${design.name.replaceAll("'", '')}.step','${design.exportMetadata.stepTimestamp}',('${design.exportMetadata.author}'),('${design.exportMetadata.organization}'), '${design.exportMetadata.preprocessor}','${design.exportMetadata.originatingSystem}','${design.exportMetadata.authorization}');
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
    'Includes: STEP assembly, TOML design, render-board SVG, and this PDF report.',
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
