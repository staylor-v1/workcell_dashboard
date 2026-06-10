import { access, mkdir, writeFile } from 'node:fs/promises';
import { accessSync, constants, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { factoryDesign, getRenderEngine, getRenderResolution, normalizedRenderResolution, renderJobManifest } from '../src/data.js';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith('--')) continue;
  const key = arg.slice(2);
  const next = process.argv[index + 1];
  if (!next || next.startsWith('--')) {
    args.set(key, true);
  } else {
    args.set(key, next);
    index += 1;
  }
}

const engine = getRenderEngine(args.get('engine') ?? args.get('engineId') ?? 'blender-cycles');
const baseResolution = getRenderResolution(args.get('resolution') ?? '2k');
const resolution = normalizedRenderResolution({
  ...baseResolution,
  width: args.has('width') ? Number(args.get('width')) : baseResolution.width,
  height: args.has('height') ? Number(args.get('height')) : baseResolution.height,
});
const execute = args.get('execute') === true || args.get('execute') === 'true';
const outDir = args.get('out') ?? `artifacts/render-jobs/${engine.id}-${resolution.width}x${resolution.height}`;

function machineHeight(machine) {
  const width = machine.footprint?.w ?? 1;
  const depth = machine.footprint?.h ?? 1;
  return Math.max(1.2, Math.min(3.2, Number(((width + depth) / 2).toFixed(2))));
}

function renderMachines() {
  return factoryDesign.machines.map((machine) => ({
    id: machine.id,
    name: machine.name,
    type: machine.type,
    assetPath: machine.assetPath,
    position: { x: machine.footprint.x, y: machine.footprint.y, z: 0 },
    size: { x: machine.footprint.w, y: machine.footprint.h, z: machineHeight(machine) },
    material: machine.status === 'Optimizing' ? 'warning_panel' : 'machine_blue',
  }));
}

function sceneDescription() {
  return {
    schema: 'microfactory-render-scene/v1',
    deterministicSeed: 424242,
    generatedAt: '2026-06-09T00:00:00.000Z',
    project: factoryDesign.name,
    product: factoryDesign.product,
    floorSize: factoryDesign.floorSize,
    engine: { id: engine.id, name: engine.name, samples: engine.samples, integrator: engine.integrator },
    resolution: { id: resolution.id, label: resolution.label, width: resolution.width, height: resolution.height },
    assets: [...factoryDesign.machines, ...factoryDesign.machineCatalog].map((machine) => ({ id: machine.id, name: machine.name, path: machine.assetPath })),
    machines: renderMachines(),
    views: factoryDesign.renderViews,
    lighting: {
      world: [0.02, 0.035, 0.06],
      overheadAreaLights: [
        { name: 'softbox_left', position: [6, 4, 6], size: 6, power: 650 },
        { name: 'softbox_right', position: [18, 10, 6], size: 7, power: 720 },
      ],
    },
    materials: {
      machine_blue: { baseColor: [0.19, 0.33, 0.58], roughness: 0.42, metallic: 0.2 },
      warning_panel: { baseColor: [0.9, 0.58, 0.15], roughness: 0.36, metallic: 0.1 },
      floor: { baseColor: [0.35, 0.37, 0.39], roughness: 0.64, metallic: 0.0 },
      accent: { baseColor: [0.05, 0.9, 0.75], roughness: 0.25, metallic: 0.0 },
    },
  };
}

function blenderPython(scene) {
  const machineJson = JSON.stringify(scene.machines);
  const viewsJson = JSON.stringify(scene.views);
  return `import bpy, math\nfrom mathutils import Vector\nbpy.ops.object.select_all(action='SELECT')\nbpy.ops.object.delete()\nscene=bpy.context.scene\nscene.render.engine='CYCLES'\nscene.cycles.samples=${engine.samples}\nscene.cycles.use_denoising=True\nscene.cycles.max_bounces=12\nscene.view_settings.view_transform='Filmic'\nscene.view_settings.look='Medium High Contrast'\nscene.render.resolution_x=${resolution.width}\nscene.render.resolution_y=${resolution.height}\nscene.render.film_transparent=False\ndef mat(name, color, metallic=0, roughness=.5):\n    material=bpy.data.materials.new(name); material.use_nodes=True\n    bsdf=material.node_tree.nodes.get('Principled BSDF')\n    bsdf.inputs['Base Color'].default_value=(color[0],color[1],color[2],1)\n    bsdf.inputs['Metallic'].default_value=metallic\n    bsdf.inputs['Roughness'].default_value=roughness\n    return material\nmaterials={\n 'machine_blue': mat('machine_blue',(0.19,0.33,0.58),.2,.42),\n 'warning_panel': mat('warning_panel',(0.9,0.58,0.15),.1,.36),\n 'floor': mat('floor',(0.35,0.37,0.39),0,.64),\n 'accent': mat('accent',(0.05,0.9,0.75),0,.25),\n}\nbpy.ops.mesh.primitive_cube_add(size=1, location=(${scene.floorSize.width / 2},${scene.floorSize.height / 2},-0.03))\nfloor=bpy.context.object; floor.name='factory_floor'; floor.dimensions=(${scene.floorSize.width},${scene.floorSize.height},0.06); floor.data.materials.append(materials['floor']); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)\nfor machine in ${machineJson}:\n    x=machine['position']['x']+machine['size']['x']/2; y=machine['position']['y']+machine['size']['y']/2; z=machine['size']['z']/2\n    bpy.ops.mesh.primitive_cube_add(size=1, location=(x,y,z))\n    obj=bpy.context.object; obj.name=machine['id']; obj.dimensions=(machine['size']['x'],machine['size']['y'],machine['size']['z']); obj.data.materials.append(materials[machine['material']]); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)\n    bpy.ops.mesh.primitive_cube_add(size=1, location=(x,y,z+machine['size']['z']/2+.08))\n    beacon=bpy.context.object; beacon.name=machine['id']+'_status_light'; beacon.dimensions=(.25,.25,.12); beacon.data.materials.append(materials['accent']); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)\ndef light(name, loc, size, power):\n    bpy.ops.object.light_add(type='AREA', location=loc); lamp=bpy.context.object; lamp.name=name; lamp.data.size=size; lamp.data.energy=power\nlight('softbox_left',(6,4,6),6,650); light('softbox_right',(18,10,6),7,720)\ndef add_camera(view):\n    if view['id']=='top-down': loc=(${scene.floorSize.width / 2},${scene.floorSize.height / 2},28); rot=(0,0,0); ortho=28\n    elif view['id']=='container-door': loc=(${scene.floorSize.width / 2},-11,4.2); rot=(math.radians(68),0,0); ortho=15\n    else: loc=(${scene.floorSize.width / 2},-10,18); rot=(math.radians(60),0,math.radians(38)); ortho=27\n    bpy.ops.object.camera_add(location=loc, rotation=rot); cam=bpy.context.object; cam.name=view['id']; cam.data.type='ORTHO'; cam.data.ortho_scale=ortho; return cam\nfor view in ${viewsJson}: add_camera(view)\nfor view in ${viewsJson}:\n    scene.camera=bpy.data.objects[view['id']]\n    scene.render.filepath='${outDir}/'+view['output']\n    bpy.ops.render.render(write_still=True)\n`;
}

function mitsubaXml(scene, view) {
  const sensor = view.id === 'container-door'
    ? '<lookat origin="12,-11,4.2" target="12,7,1.2" up="0,0,1"/>'
    : view.id === 'top-down'
      ? '<lookat origin="12,7,28" target="12,7,0" up="0,1,0"/>'
      : '<lookat origin="12,-10,18" target="12,7,0" up="0,0,1"/>';
  const shapes = scene.machines.map((machine) => {
    const x = machine.position.x + machine.size.x / 2;
    const y = machine.position.y + machine.size.y / 2;
    const z = machine.size.z / 2;
    return `<shape type="cube"><transform name="to_world"><scale x="${machine.size.x / 2}" y="${machine.size.y / 2}" z="${machine.size.z / 2}"/><translate x="${x}" y="${y}" z="${z}"/></transform><ref id="${machine.material}" name="bsdf"/></shape>`;
  }).join('\n  ');
  return `<scene version="3.0.0">\n  <integrator type="path"><integer name="max_depth" value="12"/><integer name="rr_depth" value="5"/></integrator>\n  <sensor type="orthographic"><transform name="to_world">${sensor}</transform><sampler type="ldsampler"><integer name="sample_count" value="${engine.samples}"/></sampler><film type="hdrfilm"><integer name="width" value="${resolution.width}"/><integer name="height" value="${resolution.height}"/><rfilter type="gaussian"/></film></sensor>\n  <bsdf type="diffuse" id="machine_blue"><rgb name="reflectance" value="0.19,0.33,0.58"/></bsdf>\n  <bsdf type="diffuse" id="warning_panel"><rgb name="reflectance" value="0.9,0.58,0.15"/></bsdf>\n  <bsdf type="diffuse" id="floor"><rgb name="reflectance" value="0.35,0.37,0.39"/></bsdf>\n  <shape type="cube"><transform name="to_world"><scale x="12" y="7" z="0.03"/><translate x="12" y="7" z="-0.03"/></transform><ref id="floor" name="bsdf"/></shape>\n  ${shapes}\n  <emitter type="constant"><rgb name="radiance" value="0.02,0.035,0.06"/></emitter>\n  <shape type="rectangle"><transform name="to_world"><scale x="7" y="7" z="1"/><translate x="12" y="7" z="7"/></transform><emitter type="area"><rgb name="radiance" value="12,12,12"/></emitter></shape>\n</scene>\n`;
}


function unitCubePly() {
  return `ply
format ascii 1.0
element vertex 8
property float x
property float y
property float z
element face 12
property list uchar int vertex_indices
end_header
-0.5 -0.5 -0.5
0.5 -0.5 -0.5
0.5 0.5 -0.5
-0.5 0.5 -0.5
-0.5 -0.5 0.5
0.5 -0.5 0.5
0.5 0.5 0.5
-0.5 0.5 0.5
3 0 1 2
3 0 2 3
3 4 6 5
3 4 7 6
3 0 4 5
3 0 5 1
3 1 5 6
3 1 6 2
3 2 6 7
3 2 7 3
3 3 7 4
3 3 4 0
`;
}

function luxCoreScene(scene, view) {
  const camera = view.id === 'container-door'
    ? 'scene.camera.lookat.orig = 12 -11 4.2\nscene.camera.lookat.target = 12 7 1.2'
    : view.id === 'top-down'
      ? 'scene.camera.lookat.orig = 12 7 28\nscene.camera.lookat.target = 12 7 0'
      : 'scene.camera.lookat.orig = 12 -10 18\nscene.camera.lookat.target = 12 7 0';
  const objects = scene.machines.map((machine, index) => {
    const x = machine.position.x + machine.size.x / 2;
    const y = machine.position.y + machine.size.y / 2;
    const z = machine.size.z / 2;
    return `scene.objects.${machine.id}.ply = machine_${index}.ply\nscene.objects.${machine.id}.transformation = ${machine.size.x} 0 0 0 ${machine.size.y} 0 0 0 ${machine.size.z} ${x} ${y} ${z}\nscene.objects.${machine.id}.material = ${machine.material}`;
  }).join('\n');
  return `scene.camera.type = orthographic\n${camera}\nscene.camera.up = 0 0 1\nscene.materials.machine_blue.type = matte\nscene.materials.machine_blue.kd = 0.19 0.33 0.58\nscene.materials.warning_panel.type = matte\nscene.materials.warning_panel.kd = 0.9 0.58 0.15\nscene.materials.floor.type = matte\nscene.materials.floor.kd = 0.35 0.37 0.39\nscene.lights.softbox.type = area\nscene.lights.softbox.gain = 650 650 650\n${objects}\n`;
}

function luxCoreCfg(view) {
  return `scene.file = ${join(outDir, `${view.id}.scn`)}\nrenderengine.type = PATHCPU\nsampler.type = SOBOL\npath.pathdepth.total = 12\npath.russianroulette.depth = 5\nbatch.haltspp = ${engine.samples}\nfilm.width = ${resolution.width}\nfilm.height = ${resolution.height}\nfilm.outputs.1.type = RGB_IMAGEPIPELINE\nfilm.outputs.1.filename = ${join(outDir, view.output)}\n`;
}

function executableEnvVarName(engineId = engine.id) {
  if (engineId === 'blender-cycles') return 'MICROFACTORY_BLENDER_BIN';
  if (engineId === 'luxcore') return 'MICROFACTORY_LUXCORE_BIN';
  return 'MICROFACTORY_MITSUBA_BIN';
}

function executableForEngine(engineId = engine.id, env = process.env) {
  const configuredExecutable = env[executableEnvVarName(engineId)];
  if (configuredExecutable) return configuredExecutable;
  if (engineId === 'blender-cycles') return 'blender';
  if (engineId === 'luxcore') return 'luxcoreconsole';
  return 'mitsuba';
}

function isRunnableExecutable(path, platform = process.platform) {
  if (!existsSync(path)) return false;
  if (platform === 'win32') return true;
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function pathValue(env = process.env) {
  return env.PATH ?? env.Path ?? env.path ?? '';
}

function windowsExecutableNames(command, env = process.env) {
  const extensions = (env.PATHEXT || '.COM;.EXE;.BAT;.CMD')
    .split(';')
    .filter(Boolean);
  const lowerCommand = command.toLowerCase();
  const hasExecutableExtension = extensions.some((extension) => lowerCommand.endsWith(extension.toLowerCase()));
  return hasExecutableExtension ? [command] : extensions.map((extension) => `${command}${extension}`);
}

export function resolveExecutable(command, { platform = process.platform, env = process.env } = {}) {
  if (!command) return null;
  if (command.includes('/') || command.includes('\\')) {
    return isRunnableExecutable(command, platform) ? command : null;
  }

  const pathEntries = pathValue(env)
    .split(platform === 'win32' ? ';' : delimiter)
    .filter(Boolean);
  const candidates = platform === 'win32' ? windowsExecutableNames(command, env) : [command];
  for (const pathEntry of pathEntries) {
    for (const candidate of candidates) {
      const executablePath = join(pathEntry, candidate);
      if (isRunnableExecutable(executablePath, platform)) return executablePath;
    }
  }

  const lookup = platform === 'win32'
    ? spawnSync('where.exe', [command], { encoding: 'utf8', env })
    : spawnSync('sh', ['-lc', `command -v -- ${JSON.stringify(command)}`], { encoding: 'utf8', env });
  if (lookup.status !== 0) return null;
  return lookup.stdout.trim().split(/\r?\n/)[0] || command;
}

async function main() {
  const scene = sceneDescription();
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'scene.json'), `${JSON.stringify(scene, null, 2)}\n`);
  await writeFile(join(outDir, 'manifest.txt'), `${renderJobManifest(engine, factoryDesign, resolution)}\n`);
  await writeFile(join(outDir, 'blender_factory_render.py'), blenderPython(scene));
  await Promise.all(scene.views.map((view) => writeFile(join(outDir, `${view.id}.xml`), mitsubaXml(scene, view))));
  await Promise.all(scene.views.map((view) => writeFile(join(outDir, `${view.id}.scn`), luxCoreScene(scene, view))));
  await Promise.all(scene.views.map((view) => writeFile(join(outDir, `${view.id}.cfg`), luxCoreCfg(view))));
  await Promise.all(scene.machines.map((_, index) => writeFile(join(outDir, `machine_${index}.ply`), unitCubePly())));

  const executable = executableForEngine();
  const resolvedExecutable = resolveExecutable(executable);
  const rendererAvailable = Boolean(resolvedExecutable);
  const outputs = scene.views.map((view) => join(outDir, view.output));
  const commands = engine.id === 'blender-cycles'
    ? [[resolvedExecutable ?? executable, ['--background', '--python', join(outDir, 'blender_factory_render.py')]]]
    : engine.id === 'luxcore'
      ? scene.views.map((view) => [resolvedExecutable ?? executable, [join(outDir, `${view.id}.cfg`)]])
      : scene.views.map((view) => [resolvedExecutable ?? executable, ['render', '-o', join(outDir, view.output), join(outDir, `${view.id}.xml`)]]);

  const executed = [];
  if (execute && rendererAvailable) {
    for (const [command, commandArgs] of commands) {
      const result = spawnSync(command, commandArgs, { cwd: process.cwd(), stdio: 'inherit' });
      executed.push({ command, args: commandArgs, status: result.status });
      if (result.status !== 0) process.exitCode = result.status ?? 1;
    }
  }

  const missingOutputs = [];
  if (execute && rendererAvailable) {
    for (const output of outputs) {
      try {
        await access(output);
      } catch {
        missingOutputs.push(output);
      }
    }
    if (missingOutputs.length) process.exitCode = process.exitCode || 1;
  }

  const result = { engineId: engine.id, executable, resolvedExecutable, rendererAvailable, executableEnvVar: executableEnvVarName(), executed, jobDir: outDir, outputs, missingOutputs, scene: join(outDir, 'scene.json') };
  await writeFile(join(outDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
