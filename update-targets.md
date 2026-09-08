# Update Targets

High-level outline of three workstreams. Research complete; no code changed yet.

Decisions taken:
- `search` pageType **stays** as a warned-but-allowed option.
- Runtime delivery uses **Option B** — hand-written plain-JS runtime, no separate build.

---

## 1 · Ship the shared library to the end user

**Problem.** `dist-runtime/` is gitignored, built by a separate vite config, and imported by
nothing in `src/`. The tool ships as one inlined `index.html`, so the runtime web resource never
reaches a user — while the Shared Library tab tells them to deploy it. Dead prerequisite.

**Approach (Option B).** Delete the dual build; the runtime is ~130 lines with no imports and no
TS features beyond type annotations, so it needs no transpiling. Inline it into the app bundle via
Vite `?raw` and hand it over with PPTB's native save dialog.

- Delete `vite.runtime.config.ts`, the `build:runtime` script, the `/dist-runtime` gitignore line.
- Delete `src/runtime/index.ts` — it exists only as the vite lib entry to attach the global.
- `src/runtime/sidePaneHelper.ts` → `src/runtime/sidepane.runtime.js`, plain ES2017 IIFE that
  assigns `globalThis.SidePaneHelper`.
- `SidePaneHelperOptions` moves to a sibling `.d.ts` so the C4 contract stays greppable.
- `sidePaneHelper.test.ts`: `?raw` import + `(0,eval)(src)` — tests the exact bytes users download,
  and folds in the existing "global attachment" case.
- `OutputPanel` Shared Library tab: download button →
  `window.toolboxAPI.utils.saveFile('sidepane.runtime.js', src)`, Blob + `<a download>` fallback.
- `DEPLOY_STEPS` in `CommandStepsTab` references the new download.

**Watch out.** ESLint will now lint a plain `.js` file assigning a global — needs an override in
`eslint.config.mjs` or the clean lint state breaks.

---

## 2 · Page types and parameters

Verified against the live `navigateTo` reference.

| pageType | Gap |
|---|---|
| `entitylist` | add `viewId`, `viewType` (`savedquery` \| `userquery`) |
| `entityrecord` | add `formId`, `tabName`, `data` |
| `custom` | none |
| `webresource` | none |
| `dashboard` | none |
| `generative` | **do not add** — Microsoft documents `createPane` + generative as unsupported |
| `search` | leave as-is; already labelled undocumented and warned without blocking |

Target shape becomes:

```ts
| { pageType: 'entitylist';   entityName: string; viewId: string; viewType: '' | 'savedquery' | 'userquery' }
| { pageType: 'entityrecord'; entityName: string; entityId: string; formId: string; tabName: string }
```

**Cost per added key is five files** — the C4 contract forbids one side adding alone:
`PaneDefinitionConfig.ts` (type + `DEFAULT_CONFIG`) → `ConfigurePanel.resetTarget` + new fields →
`CodeGenerationService.buildNavigateInput` **and** `generateLibraryScript`'s separate per-pageType
block → runtime `SidePaneHelperOptions` + its `buildNavigateInput` → `ValidationService`
(GUID checks; `viewType` required when `viewId` set).

**New inputs to surface.**
- **View picker** — new `MetadataService.listViewsForEntity()` over `savedqueryset` +
  `userqueryset` filtered on `returnedtypecode`. Structurally identical to
  `listAccessibleDashboards`; add `buildViewsForEntityPath` to `odataGuards.ts` guarded by
  `isValidLogicalName`.
- **Form picker** — `FormXmlService.getFormsForEntityResult()` already exists; reuse `FormSelector`.
- **Record ID** — input exists, but `buildConfiguredRecordIdExpression` reads both
  `context.staticRecordId` and `target.entityId`. Collapse that dual source to one *before*
  adding more parameters.

---

## 3 · Grid preview

Add a third `PreviewMode` in `PreviewPanel.tsx` (`'mock' | 'form' | 'grid'`). Form mode already has
the shape: selector → async fetch → render-or-skeleton. Triggered by an explicit
**Generate grid preview** button, since it is a live read of user data.

1. Fetch the view:
   `savedqueryset?$select=name,fetchxml,layoutxml,savedqueryid&$filter=returnedtypecode eq '<entity>' and querytype eq 0`
2. Use the view's **`fetchxml`**, not `layoutxml` — `window.dataverseAPI.fetchXmlQuery(fetchXml)`
   exists. Inject `top="10"` with one string edit; formatted lookup/choice values come back without
   header negotiation, and `<cell>` column parsing is skipped entirely.
3. That also sidesteps `EntitySetName`, which `keepEntity` filters on but `TableInfo` drops.
4. Render a `MockGrid` (command strip + header + 10 rows) inside `NativeMdaFrame` with
   `hostTarget = { pageType: 'entitylist' }`, reusing existing pane/rail chrome. Clicking the fake
   command button selects a row and shows the overlay — makes `SelectedRow` context legible for
   grid triggers.

**Gating.** Grid triggers (`MainGridButton` / `SubgridButton`) or an `entitylist` target. Falls back
to Form mode's entity picker when `config.target` carries no `entityName`.

---

## Sequencing

Workstream 1 is self-contained. Workstreams 2 and 3 share the view-picker work, and 3 wants
`target.viewId` to exist first.

**1 → 2 → 3**, three commits, roughly 2 / 6 / 4 files.
