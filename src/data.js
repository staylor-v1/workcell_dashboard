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
