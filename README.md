# Microfactory Layout Studio

A zero-dependency web application for designing and reasoning about a compact microfactory. The studio provides coordinated tabs over a shared factory model:

- **Summary** — dashboard cards with miniature layout, machine, flow, and render-planning previews.
- **Machines** — machine list with cycle time, uptime, energy draw, operating status, and process parameters.
- **Layout** — top-down factory placement diagram with selectable machines, selected envelope boundary, and toggleable product-flow visualization.
- **Envelope** — container and building-envelope selector with Conex defaults, custom dimensions, generated CAD previews, and CAD model metadata.
- **Flow** — text and visual graph representations of feedstock-to-finished-product transformations with an adjustable split bar.
- **Renders** — photorealistic render-brief cards for turning the design into visual direction.
- **Export** — client-side export actions for a whole-factory `.step`, design `.yaml`, render-board `.svg`, and `.pdf` report package.


## Editable TOML configuration

Project-specific data lives in the `config/` directory so users can customize the studio without editing application code:

- `config/factory.toml` — project identity, product, throughput, takt target, and floor size.
- `config/machines.toml` — available machines, process parameters, inputs/outputs, performance metrics, and layout footprints.
- `config/layout.toml` — product-flow links between machine IDs.
- `config/flow.toml` — feedstock-to-finished transformation steps.
- `config/envelopes.toml` — selectable factory envelopes, dimensions, clearances, and CAD metadata.
- `config/renders.toml` — render briefs, cameras, lighting, materials, and subjects.
- `config/export.toml` — export package labels, extensions, and descriptions.
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
```

`npm run snapshot` writes `artifacts/microfactory-studio.html` and `artifacts/microfactory-studio.png`; it requires the `wkhtmltoimage` binary from `wkhtmltopdf`.

## Render prompts

The Renders tab generates copy-ready photorealistic render prompts from the shared factory design, including camera, lighting, material, scale, and process-story details.

## Envelope and export data

The Envelope tab includes standard 20ft and 40ft Conex/ISO dry-container options, a 40ft high-cube option, modular cleanroom and deployable shelter structures, and a Custom option for user-defined dimensions. CAD previews and export files are generated parametrically from the shared design model.
