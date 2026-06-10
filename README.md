# Microfactory Layout Studio

A React/Vite web application for designing and reasoning about a compact microfactory. The studio provides coordinated tabs over a shared factory model:

- **Summary** — dashboard cards with miniature layout, machine, flow, and render-planning previews.
- **Machines** — machine list with cycle time, uptime, energy draw, operating status, and process parameters.
- **Layout** — top-down factory placement diagram with selectable machines, a researched drag-and-drop machine candidate palette, selected envelope boundary, and toggleable product-flow visualization.
- **Envelope** — container and building-envelope selector with Conex defaults, custom dimensions, generated CAD previews, and CAD model metadata.
- **Flow** — text and visual graph representations of feedstock-to-finished-product transformations with a drag-to-resize divider between the text and visual panels.
- **Renders** — photorealistic render-brief cards plus selectable Blender Cycles, LuxCoreRender, and Mitsuba 3 production defaults for one-click top-down, container-door, and orthographic factory render plans.
- **Export** — client-side export actions for an NVIDIA Omniverse USD `.zip` package, a professional CAD `.step` assembly, design `.toml`, render-board `.svg`, and `.pdf` report package.


## Editable TOML configuration

Project-specific data lives in the `config/` directory so users can customize the studio without editing application code:

- `config/factory.toml` — project identity, product, throughput, takt target, and floor size.
- `config/machines.toml` — available machines, researched drag-in machine catalog candidates, process parameters, inputs/outputs, performance metrics, source URLs, and layout footprints.
- `config/layout.toml` — product-flow links between machine IDs.
- `config/flow.toml` — feedstock-to-finished transformation steps.
- `config/envelopes.toml` — selectable factory envelopes, dimensions, clearances, and CAD metadata.
- `config/renders.toml` — render briefs, cameras, lighting, materials, subjects, engine defaults, render views, and resolution presets.
- `config/export.toml` — export package labels, extensions, and descriptions, including Omniverse USD and professional CAD STEP handoff options.
- `config/ui.toml` — tab labels, brand text, and default UI state.

The app parses these TOML files in both Node-based validation and the browser. When building the static site, `npm run build` copies `config/` into `dist/config/` alongside the application assets.

## Development

```bash
npm run dev
```

Open `http://localhost:4173`.

## Validation

```bash
npm test
npm run build
npm run snapshot
npm run assets
npm run render -- --engine blender-cycles --resolution 2k
```

`npm run snapshot` writes `artifacts/microfactory-studio.html` and `artifacts/microfactory-studio.png`; it requires the `wkhtmltoimage` binary from `wkhtmltopdf`.

## Render prompts

The Renders tab generates copy-ready photorealistic render prompts from the shared factory design, including camera, lighting, material, scale, and process-story details. It also provides Blender Cycles, LuxCoreRender, and Mitsuba 3 as selectable production render engines; each engine includes researched high-quality defaults, 1K/2K/4K resolution presets, a custom-resolution modal, and a one-click render manifest for top-down, container-door, and factory orthographic views.

The app can generate deterministic render jobs with complete scene descriptions and machine asset references by running `npm run render -- --engine <blender-cycles|luxcore|mitsuba-3> --resolution 2k`. The Node server exposes the same flow at `POST /api/render`; if Blender, LuxCoreRender, or Mitsuba is installed on the host, the render script invokes the matching executable, otherwise it writes the deterministic scene files under `artifacts/render-jobs/` and reports the missing renderer. Mitsuba jobs are rendered through the installed Mitsuba Python module so pip-installed Mitsuba 3 can write the expected PNG review images reliably; set `MICROFACTORY_PYTHON_BIN` if the server should use a specific Python environment. On Linux, the generated Mitsuba driver auto-detects common `libLLVM` install paths before importing Mitsuba/Dr.Jit. On Windows, renderer discovery checks the server process `PATH` and `PATHEXT` directly instead of relying on a Unix shell, so executables that work from PowerShell are detected when the server is launched from that environment. If the server runs with a different PATH, set `MICROFACTORY_BLENDER_BIN`, `MICROFACTORY_LUXCORE_BIN`, or `MICROFACTORY_MITSUBA_BIN` to the full executable path before starting it. Machine CAD proxy assets live in `assets/machines/` and can be regenerated with `npm run assets`.

## Envelope and export data

The Envelope tab includes standard 20ft and 40ft Conex/ISO dry-container options, a 40ft high-cube option, modular cleanroom and deployable shelter structures, and a Custom option for user-defined dimensions. CAD previews and export files are generated parametrically from the shared design model. The Export tab can now produce a ZIP of USD ASCII files (`factory.usda`, `materials.usda`, `manifest.json`, and `README.md`) for NVIDIA Omniverse, plus an AP242-style STEP assembly with envelope, floor datum, machine placements, asset references, and product-flow metadata for professional CAD tools.
