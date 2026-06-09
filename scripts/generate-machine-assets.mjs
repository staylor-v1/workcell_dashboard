import { mkdir, writeFile } from 'node:fs/promises';
import { factoryDesign } from '../src/data.js';

function safeStepString(value) {
  return String(value).replace(/'/g, "");
}

function parameterValue(machine, labelPattern) {
  return machine.parameters?.find(([label]) => labelPattern.test(label))?.[1];
}

function documentedHeight(machine, width, depth) {
  const dimensions = parameterValue(machine, /dimensions|installation dimensions|machine tool dimensions|layout envelope/i) ?? parameterValue(machine, /envelope/i);
  const match = dimensions?.match(/([0-9]+(?:\.[0-9]+)?)\s*[×x]\s*([0-9]+(?:\.[0-9]+)?)\s*[×x]\s*([0-9]+(?:\.[0-9]+)?)\s*m(?!m)/i);
  if (match) return Number(Number(match[3]).toFixed(3));
  return Math.max(1.2, Math.min(3.2, Number(((width + depth) / 2).toFixed(2))));
}

function machineStep(machine, index) {
  const width = machine.footprint?.w ?? 1;
  const depth = machine.footprint?.h ?? 1;
  const height = documentedHeight(machine, width, depth);
  const source = machine.sourceUrl ? ` Source: ${machine.sourceUrl}` : ' Parametric in-house proxy asset.';
  const cadSource = machine.cadSourceUrl ? ` CAD source searched: ${machine.cadSourceLabel ?? machine.cadSourceUrl} (${machine.cadSourceUrl}).` : '';
  const assetNote = machine.assetNote ? ` Asset note: ${machine.assetNote}` : '';
  const description = `${safeStepString(machine.type)}; footprint ${width}m x ${depth}m x ${height}m.${safeStepString(source)}${safeStepString(cadSource)}${safeStepString(assetNote)}`;
  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('Microfactory Studio deterministic machine CAD proxy','Bounding-box solid proxy with render metadata'),'2;1');
FILE_NAME('${safeStepString(machine.id)}.step','2026-06-09T00:00:00Z',('OpenAI Codex'),('Microfactory Studio'),'scripts/generate-machine-assets.mjs','Microfactory Studio','Public proxy generated because no redistributable OEM CAD was bundled');
FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF'));
ENDSEC;
DATA;
#1=APPLICATION_CONTEXT('mechanical design');
#2=PRODUCT_CONTEXT('machine asset',#1,'manufacturing equipment');
#3=PRODUCT('MACHINE_${safeStepString(machine.id).toUpperCase()}','${safeStepString(machine.name)}','${description}',(#2));
#4=PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE('1','deterministic proxy for render/layout use',#3,.MADE.);
#5=PRODUCT_DEFINITION_CONTEXT('part definition',#1,'design');
#6=PRODUCT_DEFINITION('design','${safeStepString(machine.name)} deterministic render proxy',#4,#5);
#7=PRODUCT_DEFINITION_SHAPE('shape','Axis-aligned equipment envelope used by render scene generator',#6);
#8=PROPERTY_DEFINITION('asset_id','${safeStepString(machine.id)}',#6);
#9=PROPERTY_DEFINITION('width_m','${width}',#6);
#10=PROPERTY_DEFINITION('depth_m','${depth}',#6);
#11=PROPERTY_DEFINITION('height_m','${height}',#6);
#12=PROPERTY_DEFINITION('render_geometry','box_with_control_panel_cable_tray_and_status_light',#6);
#15=PROPERTY_DEFINITION('dimension_source','${safeStepString(machine.sourceLabel ?? 'In-house default')}: ${safeStepString(machine.sourceUrl ?? 'n/a')}',#6);
#16=PROPERTY_DEFINITION('cad_source','${safeStepString(machine.cadSourceLabel ?? 'No external CAD source')}: ${safeStepString(machine.cadSourceUrl ?? 'n/a')}',#6);
#17=PROPERTY_DEFINITION('asset_note','${safeStepString(machine.assetNote ?? 'App-owned deterministic proxy')}',#6);
#13=SHAPE_REPRESENTATION('machine_${index}_proxy_envelope',(),#14);
#14=GEOMETRIC_REPRESENTATION_CONTEXT(3);
ENDSEC;
END-ISO-10303-21;
`;
}

await mkdir('assets/machines', { recursive: true });
const machines = [...factoryDesign.machines, ...factoryDesign.machineCatalog];
await Promise.all(machines.map((machine, index) => writeFile(`assets/machines/${machine.id}.step`, machineStep(machine, index + 1))));
console.log(`Wrote ${machines.length} deterministic STEP proxy assets to assets/machines/`);
