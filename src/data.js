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

function stepText(value) {
  return String(value).replaceAll("'", "");
}

function stepProductEntity(id, label, description) {
  return `#${id}=PRODUCT('${stepText(label)}','${stepText(label)}','${stepText(description)}',(#10));`;
}

export function factoryStep({ design = factoryDesign, envelope = getEnvelope('conex-40', design) } = {}) {
  const dims = envelope.dimensions;
  const floor = design.floorSize;
  const componentProducts = [
    stepProductEntity(30, `ENVELOPE_${envelope.id.toUpperCase()}`, `${envelope.name}; ${dims.length}m x ${dims.width}m x ${dims.height}m parametric shell; features: ${envelope.cadModel.features.join(', ')}`),
    stepProductEntity(31, 'FLOOR_REFERENCE_PLATE', `${floor.width}m x ${floor.height}m full factory floor datum with safety aisle and envelope boundary references`),
    ...design.machines.map((machine, index) =>
      stepProductEntity(40 + index, `MACHINE_${machine.id.toUpperCase()}`, `${machine.name}; ${machine.type}; footprint origin (${machine.footprint.x}m, ${machine.footprint.y}m), size ${machine.footprint.w}m x ${machine.footprint.h}m; ${machine.energy}kW load`),
    ),
    stepProductEntity(80, 'UTILITY_KEEP_OUTS', 'Service raceway, maintenance access, cable routing, and safety-clearance reference volumes generated from the layout'),
    stepProductEntity(90, 'PRODUCT_FLOW_REFERENCE', `${design.product} flow path: ${design.flowLinks.map(([from, to]) => `${from}->${to}`).join('; ')}`),
  ].join('\n');

  const assemblyChildren = ['#30', '#31', ...design.machines.map((_, index) => `#${40 + index}`), '#80', '#90'].join(',');

  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('Microfactory Studio full-design STEP assembly for professional CAD import','envelope, floor, machine footprints, utility keep-outs, and product-flow references'),'2;1');
FILE_NAME('${stepText(design.name)}.step','${design.exportMetadata.stepTimestamp}',('${stepText(design.exportMetadata.author)}'),('${stepText(design.exportMetadata.organization)}'),'${stepText(design.exportMetadata.preprocessor)}','${stepText(design.exportMetadata.originatingSystem)}','${stepText(design.exportMetadata.authorization)}');
FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF'));
ENDSEC;
DATA;
#10=PRODUCT_CONTEXT('microfactory design',#20,'mechanical');
#20=APPLICATION_CONTEXT('professional CAD STEP assembly export');
#21=PRODUCT('ASTER_MICROFACTORY_FULL_ASSEMBLY','${stepText(design.name)}','Full design assembly containing ${design.machines.length} machines in ${stepText(envelope.name)}',(#10));
#22=PRODUCT_RELATED_PRODUCT_CATEGORY('assembly','Full Microfactory Design Assembly',(#21));
#23=PRODUCT_RELATED_PRODUCT_CATEGORY('assembly components','CAD-importable assembly structure children',(${assemblyChildren}));
${componentProducts}
ENDSEC;
END-ISO-10303-21;`;
}

function usdIdentifier(value) {
  return String(value).replace(/[^A-Za-z0-9_]/g, '_').replace(/^([0-9])/, '_$1');
}

function usdString(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function usdCube(name, { x, y, z, sx, sy, sz, material = 'machine_material' }) {
  return `    def Cube "${usdIdentifier(name)}"\n    {\n        rel material:binding = </World/Looks/${material}>\n        double size = 1\n        double3 xformOp:scale = (${sx}, ${sy}, ${sz})\n        double3 xformOp:translate = (${x}, ${y}, ${z})\n        uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:scale"]\n    }`;
}

export function omniversePackage({ design = factoryDesign, envelope = getEnvelope('conex-40', design) } = {}) {
  const slug = design.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const machineHeight = Math.min(envelope.clearDimensions.height * 0.45, 1.4);
  const machineCubes = design.machines.map((machine) => {
    const { x, y, w, h } = machine.footprint;
    return usdCube(machine.id, {
      x: Number((x + w / 2).toFixed(3)),
      y: Number((y + h / 2).toFixed(3)),
      z: Number((machineHeight / 2).toFixed(3)),
      sx: w,
      sy: h,
      sz: Number(machineHeight.toFixed(3)),
    });
  }).join('\n\n');

  const flowCurves = design.flowLinks.map(([fromId, toId], index) => {
    const from = design.machines.find((machine) => machine.id === fromId)?.footprint;
    const to = design.machines.find((machine) => machine.id === toId)?.footprint;
    if (!from || !to) return '';
    const points = [
      [Number((from.x + from.w).toFixed(3)), Number((from.y + from.h / 2).toFixed(3)), 0.08],
      [Number((to.x).toFixed(3)), Number((to.y + to.h / 2).toFixed(3)), 0.08],
    ];
    return `    def BasisCurves "flow_${index + 1}_${usdIdentifier(fromId)}_to_${usdIdentifier(toId)}"\n    {\n        rel material:binding = </World/Looks/flow_material>\n        uniform token type = "linear"\n        int[] curveVertexCounts = [2]\n        point3f[] points = [(${points[0].join(', ')}), (${points[1].join(', ')})]\n        float[] widths = [0.07, 0.07]\n    }`;
  }).filter(Boolean).join('\n\n');

  const stage = `#usda 1.0
(
    defaultPrim = "World"
    metersPerUnit = 1
    upAxis = "Z"
)

def Xform "World"
{
    custom string microfactory_project = "${usdString(design.name)}"
    custom string selected_envelope = "${usdString(envelope.name)}"

    def Scope "Looks"
    {
        def Material "machine_material"
        {
            token outputs:mdl:surface.connect = </World/Looks/machine_material/Shader.outputs:out>
            def Shader "Shader"
            {
                uniform token info:implementationSource = "sourceAsset"
                asset info:mdl:sourceAsset = @./microfactory_materials.mdl@
                token info:mdl:sourceAsset:subIdentifier = "brushed_anodized"
                token outputs:out
            }
        }

        def Material "floor_material"
        {
            token outputs:mdl:surface.connect = </World/Looks/floor_material/Shader.outputs:out>
            def Shader "Shader"
            {
                uniform token info:implementationSource = "sourceAsset"
                asset info:mdl:sourceAsset = @./microfactory_materials.mdl@
                token info:mdl:sourceAsset:subIdentifier = "sealed_factory_floor"
                token outputs:out
            }
        }

        def Material "flow_material"
        {
            color3f inputs:displayColor = (0.243, 0.906, 0.776)
        }
    }

${usdCube('floor_plate', { x: design.floorSize.width / 2, y: design.floorSize.height / 2, z: -0.025, sx: design.floorSize.width, sy: design.floorSize.height, sz: 0.05, material: 'floor_material' })}

${usdCube('selected_envelope_clearance', { x: envelope.dimensions.length / 2, y: envelope.dimensions.width / 2, z: envelope.dimensions.height / 2, sx: envelope.dimensions.length, sy: envelope.dimensions.width, sz: envelope.dimensions.height, material: 'floor_material' })}

    def Xform "Machines"
    {
${machineCubes}
    }

    def Xform "Product_Flow"
    {
${flowCurves}
    }
}`;

  const material = `mdl 1.8;

export material brushed_anodized(
    color tint = color(0.12, 0.20, 0.28)
) = material(
    surface: material_surface(
        scattering: df::microfacet_ggx_smith_bsdf(tint: tint, roughness: 0.32, mode: df::scatter_reflect)
    )
);

export material sealed_factory_floor(
    color tint = color(0.05, 0.07, 0.10)
) = material(
    surface: material_surface(
        scattering: df::diffuse_reflection_bsdf(tint: tint)
    )
);`;

  const manifest = JSON.stringify({
    format: 'NVIDIA Omniverse USD package',
    stage: `${slug}-omniverse.usda`,
    units: 'meters',
    upAxis: 'Z',
    envelope: envelope.name,
    files: [`${slug}-omniverse.usda`, 'microfactory_materials.mdl', `${slug}-omniverse-manifest.json`],
    loadInstructions: 'Open the USDA stage in NVIDIA Omniverse USD Composer, then keep the MDL material file beside the stage so material bindings resolve.',
  }, null, 2);

  return [
    { filename: `${slug}-omniverse.usda`, contents: stage, type: 'model/vnd.usd+usda' },
    { filename: 'microfactory_materials.mdl', contents: material, type: 'text/plain' },
    { filename: `${slug}-omniverse-manifest.json`, contents: manifest, type: 'application/json' },
  ];
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
