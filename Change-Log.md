# Change Log

## v1.1.1

### Added

- Implemented the reusable `SidePaneHelper` runtime, exposed it on the host
  window, and added a separate `build:runtime` build. Shared Library output
  includes a runtime download and a check for the deployed
  `spstudio_/scripts/sidepane.runtime.js` web resource.
- Added system and personal view selection for table-list navigation and
  preview, including `viewId` and `viewType`. Table-record targets support
  `formId`, `tabName`, and validated JSON-object form data.
- Added a grid preview using the selected view's FetchXML, capped at 10 rows.
  Columns follow the view layout, widths, and localized display labels, with
  formatted record values and linked-table column handling.
- Added grid command-bar presentation, checkbox selection, select-all state,
  refresh, and a **Preview command** action for a single selected row.
- Added main-grid and subgrid row-selection triggers through `OnRecordSelect`.
- Added lookup tag click navigation, including registration instructions,
  cancellation of default navigation, and clicked-record context for custom
  pages and table records.
- Added reversible **Custom tables only** quick filters to table selectors,
  including the grid preview selector.
- Exposed pane behavior options and a configured record ID for manual scripts.
  Added form-data examples, documentation links, and guidance for existing
  records.

### Changed

- Replaced the Deep Ocean palette with the charcoal-and-citron Kiln theme.
  PPTB owns light/dark mode; preview surfaces and text follow shared theme
  tokens. Updated branding, the SVG icon and its manifest path, and package
  description and documentation links.
- Preserved grid view, loaded rows and columns, selection, and active-row state
  across workbench navigation for the current session. Reset and connection
  changes invalidate preview state.
- Added visible Configure, Preview, and Output panel titles in the wide layout.
- Consolidated record-context generation and used one configured record ID
  across navigation options. Lookup tag identity takes precedence when the
  clicked record supplies the target context.
- Normalized restored configuration and enforced pane widths of 300–1200 px.
- Removed the unsupported Resizable toggle and omitted unsupported pane
  creation options from generated output. Badge values are applied after pane
  creation, and relative icon paths receive the `WebResources/` prefix.
- Added warnings for hidden headers and the undocumented Search target.

### Fixed

- Blocked invalid table-record configurations without a resolvable record ID
  and web-resource targets without a name. Copy is disabled for invalid code,
  and success notifications wait for successful operations.
- Corrected Shared Library payload names and record context to match the
  runtime contract, including `webresourceName`.
- Updated existing panes with fresh navigation context when reused and applied
  **Close other panes** on both the reuse and creation paths.
- Surfaced generated-script failures through `openErrorDialog` as well as the
  console, and exposed toolbox settings failures instead of swallowing them.
- Validated stored settings and added recoverable error handling. Failed
  configuration restoration offers **Retry restore** and **Continue with
  defaults**, preventing accidental overwrite while recovery is pending.
- Corrected toolbox connection-event handling, revalidated the active
  connection before metadata reload, and rejected stale metadata responses
  after a connection change. Cleared environment-specific selections when
  switching organizations.
- Used PPTB clipboard support with a reliable manual-copy fallback when
  automatic copying is unavailable or fails.
- Corrected the main-grid table-record warning and made form XML access use
  the injected Xrm context.

### Development and maintenance

- Updated dependencies and ESLint configuration, including migration to
  `@eslint-react/eslint-plugin`, and resolved lint errors.
- Raised the declared Node.js minimum to 20.19.0 and refined Vite build
  configuration for PPTB and the separate shared runtime.
- Expanded regression coverage for code generation, validation, saved
  configuration, metadata and connection changes, preview behavior, filters,
  clipboard handling, and the runtime.
