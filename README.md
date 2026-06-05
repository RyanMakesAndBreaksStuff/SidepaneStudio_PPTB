# Side Pane Studio

Side Pane Studio is a visual builder for Dynamics 365 and Power Apps
model-driven app side panes. It runs inside Power Platform Toolbox (PPTB),
lets makers configure a pane without hand-writing JavaScript, previews the
result, and generates the code needed to open the pane from a form, grid,
command bar button, field change, or manual script.

## What It Builds

Side panes can target:

- Custom pages
- Dataverse table records
- Dataverse table lists
- HTML or JavaScript web resources
- Dashboards
- Global search results

The generated configuration includes pane presentation, target content,
trigger wiring, context handling, and behavior options such as pane reuse,
expansion, and closing other panes.

## Usage Guide

Start with the [basic usage guide](https://raw.githubusercontent.com/RyanMakesAndBreaksStuff/SidepaneStudio_PPTB/refs/heads/main/documentation/usage.md) for the end-to-end
workflow: connect PPTB, configure a target, preview the pane, generate code,
and deploy the result into a model-driven app.

## Requirements

- Node.js 18 or newer for local development
- PPTB with an active Dataverse connection for full runtime use
- Access to a Dynamics 365 or Power Apps model-driven app environment

## Local Development

Install dependencies:

```powershell
npm install
```

Start the Vite dev server:

```powershell
npm run dev
```

Build the package:

```powershell
npm run build
```

Run tests:

```powershell
npm test
```

Run type checking:

```powershell
npm run typecheck
```

## Project Structure

- `src/` - React app, services, types, and PPTB integration code.
- `src/components/` - Workbench panels, preview UI, config inputs, and output UI.
- `src/services/` - Code generation, validation, metadata, and form XML helpers.
- `documentation/` - User-facing guides and supporting docs.

## Notes

Side Pane Studio saves the current configuration through PPTB settings when
available, so the last pane setup can be restored the next time the tool opens.
