# Microfactory Layout Studio

A zero-dependency web application for designing and reasoning about a compact microfactory. The studio provides coordinated tabs over a shared factory model:

- **Summary** — dashboard cards with miniature layout, machine, flow, and render-planning previews.
- **Machines** — machine list with cycle time, uptime, energy draw, operating status, and process parameters.
- **Layout** — top-down factory placement diagram with selectable machines and toggleable product-flow visualization.
- **Flow** — text and visual graph representations of feedstock-to-finished-product transformations with an adjustable split bar.
- **Renders** — photorealistic render-brief cards for turning the design into visual direction.

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
