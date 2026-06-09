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

export function getRenderEngine(id, design = factoryDesign) {
  return design.renderEngines.find((engine) => engine.id === id) ?? design.renderEngines[0];
}

export function getRenderResolution(id, design = factoryDesign) {
  return design.renderResolutions.find((resolution) => resolution.id === id) ?? design.renderResolutions[1] ?? design.renderResolutions[0];
}

export function normalizedRenderResolution(resolution) {
  const width = Math.max(64, Math.round(Number(resolution.width) || 1920));
  const height = Math.max(64, Math.round(Number(resolution.height) || 1080));
  return { ...resolution, width, height, label: resolution.label ?? `${width} × ${height}` };
}

export function renderViewPlan(engine, view, design = factoryDesign, resolution = getRenderResolution('2k', design)) {
  const size = normalizedRenderResolution(resolution);
  return `${engine.name} ${view.title} render for ${design.name}: ${view.shot}. Camera: ${view.camera}. Use ${engine.integrator}; ${engine.samples} samples at ${size.width} × ${size.height}; ${engine.color}. Output ${view.output}.`;
}

export function renderJobManifest(engine = getRenderEngine('blender-cycles'), design = factoryDesign, resolution = getRenderResolution('2k', design)) {
  const size = normalizedRenderResolution(resolution);
  const lines = [
    `${engine.name} render job`,
    `Quality: ${engine.quality}`,
    `Resolution: ${size.label} (${size.width} × ${size.height})`,
    `Command: ${engine.command}`,
    `Views: ${design.renderViews.length}`,
    `Assets: ${design.machines.length + design.machineCatalog.length} STEP files under assets/machines/`,
    ...design.renderViews.map((view, index) => `${index + 1}. ${view.title} -> ${view.output}: ${view.camera}`),
  ];
  return lines.join('\n');
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

  for (const { id, name, type, cycleTime, uptime, energy, footprint, assetPath } of design.machines) {
    lines.push(
      '[[machines]]',
      tomlField('id', id),
      tomlField('name', name),
      tomlField('type', type),
      tomlField('cycleTimeSeconds', cycleTime),
      tomlField('uptimePercent', uptime),
      tomlField('energyKw', energy),
      tomlField('footprint', footprint),
      tomlField('assetPath', assetPath),
      '',
    );
  }

  for (const { id, name, type, category, buildVolume, sourceUrl, footprint, assetPath } of design.machineCatalog) {
    lines.push(
      '[[machineCatalog]]',
      tomlField('id', id),
      tomlField('name', name),
      tomlField('type', type),
      tomlField('category', category),
      tomlField('buildVolume', buildVolume),
      tomlField('sourceUrl', sourceUrl),
      tomlField('footprint', footprint),
      tomlField('assetPath', assetPath),
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

  for (const { id, name, engine, integrator, samples, resolution, command } of design.renderEngines) {
    lines.push(
      '[[renderEngines]]',
      tomlField('id', id),
      tomlField('name', name),
      tomlField('engine', engine),
      tomlField('integrator', integrator),
      tomlField('samples', samples),
      tomlField('resolution', resolution),
      tomlField('command', command),
      '',
    );
  }

  for (const { id, title, camera, shot, output } of design.renderViews) {
    lines.push(
      '[[renderViews]]',
      tomlField('id', id),
      tomlField('title', title),
      tomlField('camera', camera),
      tomlField('shot', shot),
      tomlField('output', output),
      '',
    );
  }

  for (const { id, label, width, height, preset } of design.renderResolutions) {
    lines.push(
      '[[renderResolutions]]',
      tomlField('id', id),
      tomlField('label', label),
      tomlField('width', width),
      tomlField('height', height),
      tomlField('preset', preset),
      '',
    );
  }

  return lines.join('\n').trimEnd();
}

function stepSafe(value) {
  return String(value).replaceAll("'", "");
}

function stepProductLine(id, name, description, contextId) {
  return `#${id}=PRODUCT('${stepSafe(name)}','${stepSafe(name)}','${stepSafe(description)}',(#${contextId}));`;
}

function machineCenter(machine) {
  return {
    x: Number((machine.footprint.x + machine.footprint.w / 2).toFixed(3)),
    y: Number((machine.footprint.y + machine.footprint.h / 2).toFixed(3)),
    z: 0,
  };
}

export function factoryStep({ design = factoryDesign, envelope = getEnvelope('conex-40', design) } = {}) {
  const dims = envelope.dimensions;
  const machineProducts = design.machines
    .map((machine, index) => {
      const center = machineCenter(machine);
      return stepProductLine(
        100 + index,
        `MACHINE_${machine.id.toUpperCase()}`,
        `${machine.name}; asset=${machine.assetPath}; footprint=${machine.footprint.w}m x ${machine.footprint.h}m; placement=${center.x},${center.y},${center.z}m`,
        10,
      );
    })
    .join('\n');
  const machineRepresentations = design.machines
    .map((machine, index) => {
      const center = machineCenter(machine);
      return `#${200 + index}=PROPERTY_DEFINITION('CAD_PLACEMENT_${machine.id}','${machine.name} bounding-box placement in metres',#${100 + index});
#${300 + index}=DESCRIPTIVE_REPRESENTATION_ITEM('placement_xyz_m','${center.x}, ${center.y}, ${center.z}');
#${400 + index}=DESCRIPTIVE_REPRESENTATION_ITEM('size_lwh_m','${machine.footprint.w}, ${machine.footprint.h}, 1.8');`;
    })
    .join('\n');
  const flow = design.flowLinks.map(([from, to]) => `${from}->${to}`).join('; ');

  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('Microfactory Studio professional CAD STEP assembly; envelope, floor datum, machine placements, asset references, and flow reference geometry'),'2;1');
FILE_NAME('${stepSafe(design.name)}.step','${design.exportMetadata.stepTimestamp}',('${stepSafe(design.exportMetadata.author)}'),('${stepSafe(design.exportMetadata.organization)}'), '${stepSafe(design.exportMetadata.preprocessor)}','${stepSafe(design.exportMetadata.originatingSystem)}','${stepSafe(design.exportMetadata.authorization)}');
FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF'));
ENDSEC;
DATA;
#10=PRODUCT_CONTEXT('microfactory design',#20,'mechanical');
#20=APPLICATION_CONTEXT('professional CAD assembly export');
#30=PRODUCT('ASTER_MICROFACTORY_ASSEMBLY','${stepSafe(design.name)}','Full factory assembly for professional CAD import',(#10));
#31=PRODUCT('ENVELOPE_${envelope.id.toUpperCase()}','${stepSafe(envelope.name)}','${dims.length}m x ${dims.width}m x ${dims.height}m parametric shell: ${stepSafe(envelope.cadModel.features.join(', '))}',(#10));
#32=PRODUCT('FLOOR_DATUM','${design.floorSize.width}m x ${design.floorSize.height}m floor datum','Shared layout coordinate system in metres',(#10));
${machineProducts}
#90=PRODUCT('PRODUCT_FLOW','${stepSafe(design.product)} flow path','${stepSafe(flow)}',(#10));
#91=PROPERTY_DEFINITION('ASSEMBLY_CONTENTS','${design.machines.length} positioned machines plus envelope and floor datum',#30);
${machineRepresentations}
ENDSEC;
END-ISO-10303-21;`;
}

function usdString(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function usdIdentifier(value) {
  return String(value).replace(/[^A-Za-z0-9_]/g, '_').replace(/^([0-9])/, '_$1');
}

export function omniverseUsd({ design = factoryDesign, envelope = getEnvelope('conex-40', design) } = {}) {
  const dims = envelope.dimensions;
  const machines = design.machines.map((machine) => {
    const center = machineCenter(machine);
    return `    def Xform "${usdIdentifier(machine.id)}" (
        assetInfo = {
            string assetPath = "${usdString(machine.assetPath)}"
            string machineName = "${usdString(machine.name)}"
        }
    )
    {
        double3 xformOp:translate = (${center.x}, ${center.y}, 0.9)
        double3 xformOp:scale = (${machine.footprint.w}, ${machine.footprint.h}, 1.8)
        uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:scale"]
        def Cube "footprint_proxy" {
            rel material:binding = </Looks/machine_blue>
            string type = "${usdString(machine.type)}"
            float cycleTimeSeconds = ${machine.cycleTime}
            float uptimePercent = ${machine.uptime}
        }
    }`;
  }).join('\n\n');
  const flowCurves = design.flowLinks.map(([fromId, toId], index) => {
    const from = design.machines.find((machine) => machine.id === fromId);
    const to = design.machines.find((machine) => machine.id === toId);
    if (!from || !to) return '';
    const a = machineCenter(from);
    const b = machineCenter(to);
    return `    def BasisCurves "flow_${index + 1}_${usdIdentifier(fromId)}_to_${usdIdentifier(toId)}" {
        uniform token type = "linear"
        int[] curveVertexCounts = [2]
        point3f[] points = [( ${a.x}, ${a.y}, 0.08 ), ( ${b.x}, ${b.y}, 0.08 )]
        color3f[] primvars:displayColor = [(0.24, 0.91, 0.78)]
        float[] widths = [0.055, 0.055]
    }`;
  }).filter(Boolean).join('\n\n');

  return `#usda 1.0
(
    defaultPrim = "Factory"
    metersPerUnit = 1
    upAxis = "Z"
)

subLayers = [
    @materials.usda@
]

def Xform "Factory" (
    assetInfo = {
        string project = "${usdString(design.name)}"
        string product = "${usdString(design.product)}"
        string envelope = "${usdString(envelope.name)}"
    }
)
{
    def Cube "envelope_clearance" {
        double3 xformOp:translate = (${dims.length / 2}, ${dims.width / 2}, ${dims.height / 2})
        double3 xformOp:scale = (${dims.length}, ${dims.width}, ${dims.height})
        uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:scale"]
        rel material:binding = </Looks/envelope_glass>
    }

    def Cube "floor_datum" {
        double3 xformOp:translate = (${design.floorSize.width / 2}, ${design.floorSize.height / 2}, -0.025)
        double3 xformOp:scale = (${design.floorSize.width}, ${design.floorSize.height}, 0.05)
        uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:scale"]
        rel material:binding = </Looks/floor_dark>
    }

${machines}

${flowCurves}
}
`;
}

export function omniverseMaterialsUsd() {
  return `#usda 1.0

def Scope "Looks"
{
    def Material "machine_blue" {
        color3f inputs:diffuseColor = (0.17, 0.39, 0.92)
        float inputs:roughness = 0.42
    }

    def Material "envelope_glass" {
        color3f inputs:diffuseColor = (0.24, 0.91, 0.78)
        float inputs:opacity = 0.18
    }

    def Material "floor_dark" {
        color3f inputs:diffuseColor = (0.02, 0.04, 0.09)
        float inputs:roughness = 0.65
    }
}
`;
}

export function omniversePackageFiles({ design = factoryDesign, envelope = getEnvelope('conex-40', design) } = {}) {
  const manifest = {
    project: design.name,
    product: design.product,
    envelope: envelope.name,
    units: 'meters',
    rootLayer: 'factory.usda',
    files: ['factory.usda', 'materials.usda', 'manifest.json', 'README.md'],
    referencedStepAssets: design.machines.map((machine) => machine.assetPath),
  };
  const readme = `# ${design.name} Omniverse package

Open \`factory.usda\` in NVIDIA Omniverse USD Composer, Create, or any USD-capable Omniverse application. The package contains metre-scale envelope, floor, machine footprint proxies, material bindings, product-flow guide curves, and references to source STEP asset paths for detailed machine replacement.
`;
  return [
    { path: 'factory.usda', contents: omniverseUsd({ design, envelope }) },
    { path: 'materials.usda', contents: omniverseMaterialsUsd({ design, envelope }) },
    { path: 'manifest.json', contents: JSON.stringify(manifest, null, 2) },
    { path: 'README.md', contents: readme },
  ];
}

export function renderBoardSvg({ design = factoryDesign, envelope = getEnvelope('conex-40', design) } = {}) {
  const prompts = design.renderProfiles.map((profile, index) => `${index + 1}. ${profile.title}: ${renderPrompt(profile, design)}`);
  const engineSummary = design.renderEngines.map((engine) => `${engine.name}: ${engine.integrator}, ${engine.samples} spp`).join(' • ');
  const resolutionSummary = design.renderResolutions.map((resolution) => `${resolution.label}: ${resolution.width}x${resolution.height}`).join(' • ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" role="img" aria-label="Photorealistic render board for ${design.name}">
  <defs><linearGradient id="bg" x1="0" x2="1"><stop stop-color="#020617"/><stop offset="1" stop-color="#0f766e"/></linearGradient></defs>
  <rect width="1600" height="1000" fill="url(#bg)"/>
  <text x="80" y="110" fill="#f8fafc" font-size="54" font-family="Arial" font-weight="700">${design.name}</text>
  <text x="80" y="170" fill="#99f6e4" font-size="28" font-family="Arial">Envelope: ${envelope.name} (${envelope.dimensions.length}m x ${envelope.dimensions.width}m x ${envelope.dimensions.height}m)</text>
  <text x="80" y="215" fill="#c4b5fd" font-size="22" font-family="Arial">Render engines: ${engineSummary}</text>
  <text x="80" y="250" fill="#bfdbfe" font-size="20" font-family="Arial">Resolution presets: ${resolutionSummary}</text>
  ${prompts.map((prompt, index) => `<foreignObject x="80" y="${285 + index * 220}" width="1440" height="180"><div xmlns="http://www.w3.org/1999/xhtml" style="font: 30px Arial; color: white; line-height: 1.35; background: rgba(15,23,42,.72); border: 1px solid rgba(153,246,228,.35); border-radius: 24px; padding: 28px;">${prompt}</div></foreignObject>`).join('\n  ')}
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
