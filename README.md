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
- Global search results (the studio warns that `search` is an undocumented
  `navigateTo` page type)

The generated configuration includes pane presentation, target content,
trigger wiring, context handling, and behavior options such as pane reuse,
expansion, and closing other panes.

Table-record targets support a form, tab, and JSON form data. Table-list
targets support system and personal views. Metadata pickers include custom
table quick filters, and record context can come from the current record,
a selected row, a static record ID, or a clicked lookup tag.

## Preview and Generate

- **Mock** previews pane layout and presentation.
- **Form** uses connected table metadata and form XML.
- **Grid** uses a selected Dataverse view, its column order and display labels,
  and up to 10 records. Checkbox selection and **Preview command** let you
  try the configured interaction. Grid state survives workbench navigation
  within the current session.
- **Basic Script** generates self-contained JavaScript.
- **Shared Library** generates a handler that calls `SidePaneHelper`. Download
  the runtime from the Output panel, publish it as
  `spstudio_/scripts/sidepane.runtime.js`, and load it before the handler.
- **Command Steps** provides deployment and trigger-wiring instructions.

Triggers include form load, form/grid/subgrid command buttons, grid/subgrid
row selection, field change, lookup tag click, and console/manual execution.
Validation blocks copying invalid configurations. Clipboard failures provide
a manual-copy fallback.

Previews do not open a live side pane inside PPTB. Publish and test the
generated script in the target model-driven app before shipping it.

## Usage Guide

Start with the [basic usage guide](documentation/usage.md) for the end-to-end
workflow: connect PPTB, configure a target, preview the pane, generate code,
and deploy the result into a model-driven app.

The [user instruction manual](documentation/user-manual.md) starts with an
installed tool and covers configuration, deployment, and troubleshooting.
For installation and source builds, see [How-To-Build.md](How-To-Build.md).

See [Change-Log.md](Change-Log.md) for the `v1.1.1` change summary.

## Requirements

- Node.js 20.19.0 or newer for local development, as declared in `package.json`
- PPTB with host API 1.2.0 or newer and an active Dataverse connection
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

The studio build is written to `dist/`. To build the separate shared runtime:

```powershell
npm run build:runtime
```

This writes `dist-runtime/sidepane.runtime.js` for deployment as the shared
JavaScript web resource. Basic Script output does not need that runtime.

Run tests:

```powershell
npm test
```

Run type checking:

```powershell
npm run typecheck
```

Run lint and test coverage:

```powershell
npm run lint
npm run coverage
```

Use `npm run preview` to serve a production build locally. A standalone browser
does not supply the PPTB and Dataverse APIs needed for connected features.

## Project Structure

- `src/` - React app, services, types, and PPTB integration code.
- `src/components/` - Workbench panels, preview UI, config inputs, and output UI.
- `src/services/` - Code generation, validation, metadata, and form XML helpers.
- `src/contexts/` - Theme and preview session state.
- `src/runtime/` - Shared `SidePaneHelper` runtime and its entry point.
- `src/__tests__/` - Automated regression tests.
- `documentation/` - User-facing guides and supporting docs.

## Notes

Side Pane Studio saves the current configuration through PPTB settings when
available, so the last pane setup can be restored the next time the tool opens.
If restoration fails, **Retry restore** or **Continue with defaults** lets you
recover before new settings overwrite the saved configuration. Connection
changes clear environment-specific selections and invalidate metadata and
preview state. The studio follows PPTB's light or dark theme.
