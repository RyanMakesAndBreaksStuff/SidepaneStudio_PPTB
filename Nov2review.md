# Plan: Address Code Review Findings (tasks/code-review.md, 2026-11-02)

**Status:** pending approval
**Branch:** `config-v2-sentence-builder` @ f734654
**Source:** `tasks/code-review.md`, adjusted by the verification pass (WR-001 reclassified; WR-005/012/013 confirmed hardening-only).
**Execution model:** sub-agent driven. One task per agent. Tasks inside a wave own disjoint files and run in parallel. A wave starts only after the previous wave is green (`npx tsc --noEmit`, `npx eslint src`, `npx vitest run`).
**Conventions (rm-react-typescript quality gates):** strict TS preserved, no `any` or broad assertions, effects keep correct deps + cleanup, async views keep loading/empty/error/retry, untrusted storage input validated, evidence classes reported separately (static / build+tests / rendered / live PPTB).

## Requirements Summary

1. Fix the one silent-failure defect (CR-001) so the advertised trigger name, both emitted scripts, and validation agree.
2. Fix confirmed wiring/completeness defects: WR-002, WR-003, WR-004, WR-006.
3. Apply hardening: WR-005, WR-012, WR-013.
4. Ship environment-neutral defaults and runtime detection: WR-010, WR-011.
5. Collapse the duplicated emitters / pickers / patch helpers: WR-007, WR-008, WR-009.
6. Land the safe prunes PR-001..PR-014 and the WR-001 reclassification (dead `configuredEntity` affordance + stale comment).
7. Zero regressions: 2333+ tests pass, typecheck and `eslint src` clean after every wave.

## Design decisions (made before execution)

- **CR-001: support dotted namespaces, do not reject them.** `Contoso.Panes` is a normal Dynamics convention and `ValidationService.test.ts:138` already blesses it. Emit `var Contoso = Contoso || {}; Contoso.Panes = Contoso.Panes || {};` (one line per segment), validate each segment with `isJsIdentifier`, and surface an **error** (not a fallback) when any segment or the function name is invalid. Remove the `MyNamespace`/`MyOrg` fallbacks entirely; the UI renders exactly the name the script defines.
- **WR-001 is reclassified.** Preview↔host binding is intentional (`PreviewPanel.tsx:59 hostBound`, commit 63af07c). Action is prune: delete `configuredEntity`/`onUseConfigured` + their tests, fix the stale "PREVIEW-LOCAL" comment in `FormSelector.tsx:16-23`.
- **WR-004:** add `set(key, value)` to `MetadataFilterSettingsAPI` (PPTB already exposes `settings.set`, used at `SidePaneBuilderWorkbench.tsx:228`) and write each filter key individually. No whole-map `setAll` for save/reset.
- **WR-013:** allow-list predicate `isSafeRelativeImagePath` exported from `previewHelpers.ts`; wave 2's emitter task reuses it in `normalizeImageSrc`.

## File ownership map

| Task | Files owned (no other task in the same wave touches these) |
|---|---|
| 1A | `src/services/CodeGenerationService.ts` (lines 22-39 only), `src/services/ValidationService.ts` (trigger block only), `src/components/CommandStepsTab.tsx` (fqn only), `src/components/config/TriggerSection.tsx`, `src/__tests__/CodeGenerationService.test.ts`, `src/__tests__/ValidationService.test.ts`, `src/__tests__/ClipboardIntegration.test.tsx` |
| 1B | `src/components/DashboardPicker.tsx`, `src/__tests__/DashboardPicker.test.tsx` |
| 1C | `src/components/WidthPicker.tsx`, `src/__tests__/WidthPicker.test.tsx` (new) |
| 1D | `src/services/MetadataFilterSettingsService.ts`, `src/__tests__/MetadataFilterSettingsService.test.ts` |
| 1E | `src/components/ErrorBoundary.tsx`, `src/__tests__/ErrorBoundary.test.tsx` (new) |
| 1F | `src/SidePaneBuilderWorkbench.tsx` (clearOrgSelections only), `src/__tests__/ConnectionMetadataReload.test.tsx` |
| 1G | `src/components/previewHelpers.ts`, `src/components/TableComboDropdown.tsx` (only if `matchedOn` is referenced), `src/__tests__/PaneOverlay.test.tsx` (image-src cases), `src/__tests__/previewHelpers.test.ts` (new, filterTables cases) |
| 1H | `src/components/FormSelector.tsx`, `src/__tests__/FormSelector.test.tsx`, `src/__tests__/CustomTableFilter.test.tsx` |
| 1I | delete `src/components/CustomTableFilterButton.tsx`, `src/components/Select.tsx`, `src/types/index.ts` |
| 1J | `src/components/Section.tsx` |
| 1K | `src/components/ChoiceGroup.tsx` |
| 1L | `src/components/PaneOverlay.tsx`, `src/components/NativeMdaFrame.tsx`, `src/components/flTokens.ts`, `src/components/PreviewPanel.tsx` + `src/components/GridPreview.tsx` (NativeMdaFrame call sites only), `src/__tests__/PaneOverlay.test.tsx` (frame cases), `src/__tests__/NativeMdaFrame.test.tsx` |
| 1M | `src/components/GridPreview.tsx` (capGridFetchXml only), `src/services/GridViewModel.ts`, `src/__tests__/GridPreview.test.tsx`, `src/__tests__/GridViewModel.test.ts` (new) |
| 2N | `src/services/CodeGenerationService.ts` (whole file), `src/__tests__/CodeGenerationService.test.ts`, `src/__tests__/PageParameters.test.ts` |
| 2O | `src/components/config/ColumnPicker.tsx`, `src/components/config/LookupControlsPicker.tsx`, `src/components/LookupPicker.tsx`, `src/components/ViewPicker.tsx`, `src/components/DashboardPicker.tsx`, `src/components/useMetadataRequest.ts` (new; repo has no `hooks/` dir, `useAccessibleTables.ts` lives beside components), `src/services/MetadataService.ts` (label helper only), their tests |
| 2P | `src/components/config/DestinationSection.tsx`, `src/services/triggerCapabilities.ts`, `src/services/ValidationService.ts` (creating/sendsRecord import only), `src/services/describeConfig.ts`, their tests |
| 2Q | `src/components/SummaryCard.tsx`, `src/components/CommandStepsTab.tsx`, `src/components/OutputPanel.tsx`, their tests |
| 2R | `src/components/TableComboBox.tsx`, `src/components/TablePicker.tsx`, `src/components/FormSelector.tsx` (line 254 only), `src/__tests__/TableComboBox.test.tsx` |
| 3S | `src/types/PaneDefinitionConfig.ts` (DEFAULT_CONFIG), `src/services/ValidationService.ts` (namespace-required), `DestinationSection.tsx:105`, `TriggerSection.tsx:91,95` placeholders, tests |
| 3T | `src/constants.ts`, `src/adapters/PptbContextAdapter.ts`, `src/components/OutputPanel.tsx`, `src/components/CommandStepsTab.tsx`, `src/__tests__/OutputPanel.test.tsx` |
| 3U | `src/types/PaneDefinitionConfig.ts` (isResizable), `src/services/configGuards.ts:195`, `src/__tests__/CodeGenerationService.test.ts:579-583,675-678` |
| 3V | `src/components/previewHelpers.ts:4`, `src/components/config/PaneSection.tsx:5`, `src/components/WidthPicker.tsx:5` |

Line numbers reference f734654; agents re-locate by symbol, not by line. Wave-1 collision note: 1L touches `PreviewPanel.tsx`/`GridPreview.tsx` call sites and 1M touches `GridPreview.tsx` `capGridFetchXml`; both edit `GridPreview.tsx`, so **1M runs after 1L lands** (everything else in wave 1 is fully parallel).

---

## Wave 1 — independent fixes and prunes (13 agents, parallel)

### Task 1A — CR-001: trigger name contract (executor, model=opus)
**Change**
- `CodeGenerationService.ts`: replace `safeIdentifier`/`getSafeTriggerNames` with `resolveTriggerNames(config): { segments: string[]; fn: string }` that splits `trigger.namespace` on `.`, trims, and throws/returns a typed error if any segment or `fn` fails `isJsIdentifier` or is in `GENERATED_NAMES`. Export `namespaceDeclaration(segments)` producing one `var A = A || {};` then `A.B = A.B || {};` per segment. Replace every `var ${ns} = ${ns} || {};` site (`generateFormOnLoad`, `generateFormButton`, `generateGridButtonScript`, `generateLibraryScript`, etc.) with it. Delete the `MyNamespace`/`MyOrg` fallbacks.
- `ValidationService.ts`: in the trigger block, push **errors** on `trigger.namespace` (empty, any segment not an identifier, reserved) and `trigger.functionName` (empty or not an identifier). Keep the special-char warning loop.
- `CommandStepsTab.tsx:69-70` and `TriggerSection.tsx` FQN display: render from the same resolver (no `'Ns'`/`'fn'` fallbacks); when invalid, render the validation message instead of a Copy button.
**Tests**
- `Contoso.Panes` + `openPane` → basic and library both contain `var Contoso = Contoso || {};`, `Contoso.Panes = Contoso.Panes || {};`, `Contoso.Panes.openPane = `.
- `namespace: 'Contoso Panes'`, `''`, `'class'` → validation error on `trigger.namespace`; generator does not emit a fallback name.
- `functionName: ''` → error on `trigger.functionName`.
- `ClipboardIntegration.test.tsx`: copied FQN equals the emitted name.
**Acceptance:** no string `MyNamespace` or `MyOrg` remains in `src/`; `validate(cfg({trigger:{namespace:'Contoso.Panes'}})).errors` is empty; both emitters share one declaration helper.

### Task 1B — WR-002: Dashboard clear (executor)
- `DashboardPicker.tsx:59-63`: `if (id === '') { onChange('', ''); return; }` before the lookup.
- Test: click "Clear selection" → `onChange` called with `('', '')`; field shows placeholder.

### Task 1C — WR-003: width input draft (executor)
- `WidthPicker.tsx`: keep a local `draft: string` state for the number input; `onChange` parses but only calls parent `onChange` when the parsed integer is within `[min,max]`; clamp + commit on `blur` and on `Enter`; sync `draft` from `value` when `value` changes externally (slider/preset). Keep `aria-label`.
- Test (new file): typing `6`,`0`,`0` yields parent calls ending in `600` and never `300`; typing `50` then blur commits `300`; typing `2000` then blur commits `1200`; slider still commits immediately.

### Task 1D — WR-004: keyed settings writes (executor)
- `MetadataFilterSettingsService.ts`: add `set: (key: string, value: unknown) => Promise<void>` to `MetadataFilterSettingsAPI`; `save`/`reset` call `set` per `SETTING_KEYS` entry; drop `setAll` from the interface if no other caller. `load` keeps `getAll`.
- Test: `save` never calls `setAll`; calls `set` exactly 3 times with the normalized values; a concurrent `lastConfig` key present in `getAll` is never written back.

### Task 1E — WR-005: ErrorBoundary recovery (executor)
- `ErrorBoundary.tsx`: `handleReset` → on success reload; on failure set `state.resetError` and render the failure message, the original error, a "Copy error details" button, and a "Reload anyway" button. Guard against reloading twice in one mount.
- Test (new file): render with a throwing child → fallback shown; `settings.set` rejects → no `location.reload`, error text visible; resolves → reload called once.

### Task 1F — WR-006: org-scoped field map (executor)
- `SidePaneBuilderWorkbench.tsx:34-48`: replace the ternary with `const ORG_SCOPED_TARGET_FIELDS: Record<PageType, readonly string[]>` (`entityrecord: ['entityName','formId','tabName']`, `entitylist: ['entityName','viewId','viewType']`, `dashboard: ['dashboardId','dashboardName']`, `generative: ['pageId','data']`, `custom: []`, `webresource: []`, `search: []`) and one loop setting each listed field to `''`. Keep `host` and `source` clearing as is.
- Test in `ConnectionMetadataReload.test.tsx`: generative `pageId`/`data` cleared on connection switch; `custom.name` preserved; table/lookup cases still pass. Add a compile-time exhaustiveness check (`satisfies Record<PageType, …>`).

### Task 1G — WR-013 + PR-007: previewHelpers hardening and prune (executor)
- Export `isSafeRelativeImagePath(value): boolean` = `/^[A-Za-z0-9_\-./]+$/`, no `..` segment, no `:`; `getSafePreviewImageSrc` returns `null` unless it passes.
- Remove `FilteredEntry.matchedOn` and both construction sites; update `TableComboDropdown.tsx` only if it compiles against the field (review says it reads `entry.table` only).
- Tests: `file:///x`, `blob:…`, `WebResources/../../x`, `a:b` → null; `WebResources/img/x.png` → unchanged; `filterTables` results carry only `table`.

### Task 1H — WR-001 (reclassified) + PR-006: FormSelector cleanup (executor)
- Delete `configuredEntity`, `onUseConfigured`, `entityNameHint` props and their JSX (`FormSelector.tsx:24,30,32,49-51,197-249,258`); replace the comment at `:16-23` with: entity is host-bound when the trigger has a host picker, preview-local otherwise (see `PreviewPanel.tsx hostBound`).
- Remove the corresponding cases in `FormSelector.test.tsx` and `CustomTableFilter.test.tsx` (the `Selector` helper at `:194-197`).

### Task 1I — PR-001/002/003: delete dead files (executor, model=haiku)
- Delete `src/components/CustomTableFilterButton.tsx`, `src/components/Select.tsx`, `src/types/index.ts`. Confirm `ctx_search` finds zero importers before each delete. Typecheck.

### Task 1J — PR-008: Section always controlled (executor, model=haiku)
- Make `open`/`onOpenChange` required; delete `defaultOpen`, `localOpen`, `useState`.

### Task 1K — PR-009: ChoiceGroup `phase` (executor, model=haiku)
- Delete `phase?: string` and the `{opt.phase && …}` block (`ChoiceGroup.tsx:10,81-97`).

### Task 1L — PR-011 + PR-013: PaneOverlay / NativeMdaFrame (executor, model=opus)
- Import `FL` from `src/components/flTokens.ts`; add the one missing token there; delete the local table at `PaneOverlay.tsx:8-17`.
- `PaneOverlay` is the sole owner of the `isSelected === false` early return; remove the two conjunctions at `NativeMdaFrame.tsx:399-400`.
- Replace `paneRecord?/caption?/formModel?/hostTarget/paneTarget` with a discriminated `variant` prop: `{kind:'mock'} | {kind:'form'; model: FormModel; hostEntity: string} | {kind:'grid'; caption: string; record: …; hostEntity: string}`. Update callers (`PreviewPanel.tsx`, `GridPreview.tsx`) and tests. Rendered output must be byte-identical (snapshot before/after).

### Task 1M — PR-012: single FetchXML parse (executor)
- Move `capGridFetchXml` into `GridViewModel.ts`; `resolveGridColumns` reuses the parsed document; `GridData.generate` calls one function. One error message per failure. Move tests to the service test file.

**Wave 1 gate:** `npx tsc --noEmit && npx eslint src && npx vitest run` green. Commit per task.

---

## Wave 2 — structural collapses (5 agents, parallel)

### Task 2N — WR-007 + IN-004 + WR-013 follow-through: one target mapper (executor, model=opus; skill `safe-refactor`)
- Add `targetFields(config, rc): ReadonlyArray<[key: string, expr: string]>`, `gridRowPreamble(kind)`, `lookupTagPreamble(config)`. `buildNavigateInput` becomes a formatter over `targetFields`; `generateLibraryScript`'s if/else chain (`:528-559`) becomes the same mapper + pane-option block. Both outputs use `buildPaneOptions` so `canClose` policy is identical.
- `normalizeImageSrc` uses `isSafeRelativeImagePath` from Task 1G; invalid → `''`.
- Remove the dead `default:` in `generateBasicScript` (`:489-507`) and type the switch exhaustively (`satisfies never`).
- Tests: for every `PageType` × representative source, basic and library emit the same key set (table-driven test replaces the mirrored pairs); existing output snapshots unchanged except the `canClose` divergence, which is documented in the test.

### Task 2O — WR-008: `useMetadataRequest` hook (executor, model=opus)
- `src/components/useMetadataRequest.ts`: `useMetadataRequest<T>(loader: () => Promise<Result<T>>, deps)` → `{ status, data, error, retry }` with stale-response guard and cleanup; export `MetadataStatus`; export `displayLabel(info)` (trimmed) from `MetadataService.ts` and delete the three local copies.
- Migrate `ColumnPicker`, `LookupControlsPicker`, `LookupPicker`, `ViewPicker`, `DashboardPicker` (built on Task 1B's version). One shared status/retry wrapper component.
- Tests: hook unit tests (cancel on unmount, stale response ignored, retry invalidates); each picker's existing tests still pass unchanged.

### Task 2P — WR-009 + PR-004: patch helpers and shared policy (executor)
- `triggerCapabilities.ts`: export `isCreating(target)` and `sendsRecord(config)`; delete `isGridTrigger`. `ValidationService.ts:25-26` and `describeConfig.ts:49-50` import them.
- `DestinationSection.tsx`: add `patchSource<P>` beside `patchTarget`; use the helpers at all nine sites; delete the inline guards at `:153-167,190-191,249-256` and the repeated `RECORD_TARGETS.includes` tests.
- Tests: existing `DestinationSection`/`ConfigurePanel` tests pass; add a test that a stale updater for another page type is a no-op.

### Task 2Q — WR-012: typed HTML sink (executor)
- `SummaryCard`/`CommandStepsTab`: `body`/`steps` typed `React.ReactNode`; `STEPS`/`RUNTIME_STEP` become JSX fragments (keep `<strong>`/`<code>`); delete `dangerouslySetInnerHTML` and the `escapeHtml` call in `OutputPanel.tsx:128`. `CodeBlock.tsx:145` is out of scope (highlighter output; note in the PR).
- Tests: a step containing `<img onerror>` text renders as text, not markup.

### Task 2R — PR-010: `TableComboBox` single `items` prop (executor, model=haiku)
- Remove `tables` alias; update `TablePicker.tsx:58`, `FormSelector.tsx:254`, test helpers.

**Wave 2 gate:** same three commands green.

---

## Wave 3 — defaults, runtime name, remaining prunes (4 agents, parallel)

### Task 3S — WR-010: environment-neutral defaults (executor)
- `DEFAULT_CONFIG.target.name = ''`, `DEFAULT_CONFIG.trigger.namespace = ''`; keep `sps_SidePaneBuilderPage`/`YourNamespace` only as `placeholder` props. Namespace-required error already exists from Task 1A; confirm a fresh `DEFAULT_CONFIG` yields errors on `target.name` and `trigger.namespace` and no script is rendered until both are filled. Update tests that assumed the old defaults (`cfg()` helpers should set explicit values).
- **1A follow-up:** `TriggerSection` hides the Namespace/Function fields for `ManualJS`, yet 1A validates names for every trigger (library output defines `ns.fn`). With an empty default namespace a fresh `ManualJS` config would show an error the UI cannot fix. 3S must show the name fields for `ManualJS` (preferred) or make the resolver skip namespace validation for it.

### Task 3T — WR-011: runtime detection by leaf name (executor)
- `constants.ts`: `RUNTIME_FILE_NAME = 'sidepane.runtime.js'`; `RUNTIME_WEB_RESOURCE_SUFFIX = '/scripts/' + RUNTIME_FILE_NAME`; keep the recommended full name as display text only.
- `PptbContextAdapter.ts:70-72`: `$filter=endswith(name,'${suffix}')`; return the first match's name so the UI can show the actual deployed name.
- `OutputPanel.tsx:63,70` use `RUNTIME_FILE_NAME`; `CommandStepsTab.tsx:43` wording: "upload as `<prefix>_/scripts/sidepane.runtime.js`".
- Tests: adapter test for the new filter; `OutputPanel.test.tsx:84,102` use the constant.

### Task 3U — PR-005: remove `isResizable` (executor, model=haiku)
- Remove from type, `DEFAULT_CONFIG`, `configGuards.ts:195`, and the two tests. `parseStoredConfig` must still accept stored configs that contain the key (ignore it) — add a test.

### Task 3V — PR-014: width constants ownership (executor, model=haiku)
- Delete the re-export at `previewHelpers.ts:4`; `PaneSection.tsx` and `WidthPicker.tsx` import from `../types/PaneDefinitionConfig`.

**Wave 3 gate:** same three commands green plus `npm run build`.

---

## Wave 4 — verification and review (2 agents, parallel, read-only)

### Task 4W — verifier
- Run `npx tsc --noEmit`, `npx eslint src`, `npx vitest run --coverage`, `npm run build`. Grep `src/` for `MyNamespace`, `MyOrg`, `dangerouslySetInnerHTML` (expect only `CodeBlock.tsx`), `setAll(`, `isGridTrigger`, `isResizable`, `matchedOn`, `configuredEntity`, `entityNameHint`, `phase?:`. Report each as pass/fail with output.

### Task 4X — code-reviewer
- Re-run the `ryan-makes-strict-code-review` skill against the diff `f734654..HEAD`. Verdict must address every ID in `tasks/code-review.md` as fixed / reclassified / deferred.

---

## Acceptance Criteria

1. `validate` returns an error for an empty or non-identifier namespace segment or function name; `Contoso.Panes` passes with no error. (1A)
2. Generated basic and library scripts both define exactly the FQN shown in Command Steps and Trigger section; no fallback names exist in `src/`. (1A, 4W)
3. Dashboard "Clear selection" calls `onChange('', '')`. (1B)
4. Typing `600` into the width field commits 600; out-of-range commits clamp only on blur/Enter. (1C)
5. Metadata filter save/reset never calls `setAll`. (1D)
6. ErrorBoundary never reloads when clearing settings fails; it shows the error and a manual reload. (1E)
7. Connection switch clears `generative.pageId` and `data`; the field map is exhaustive over `PageType` at compile time. (1F)
8. `getSafePreviewImageSrc` and `normalizeImageSrc` reject `file:`, `blob:`, `..`, any scheme. (1G, 2N)
9. Basic and library emitters share one `targetFields` mapper; a table-driven test asserts identical key sets for every page type. (2N)
10. Five pickers use one `useMetadataRequest` hook; ~120 lines removed (measure in PR). (2O)
11. `DestinationSection` has zero inline union guards; `isCreating`/`sendsRecord` have one definition. (2P)
12. Only `CodeBlock.tsx` uses `dangerouslySetInnerHTML`. (2Q)
13. Fresh install shows validation errors for page name and namespace and renders no script. (3S)
14. Runtime prerequisite check matches any publisher prefix; download name and check share one constant. (3T)
15. All prune targets gone; three files deleted. (1H–1M, 2R, 3U, 3V)
16. `tsc`, `eslint src`, `vitest run`, `npm run build` green after every wave. (gates)

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| 1A changes emitted script text; downstream tests/snapshots break | 1A updates its own tests; 2N owns the big snapshot rewrite and runs after |
| 3S empty defaults break `cfg()` test helpers that rely on `DEFAULT_CONFIG` | 3S audits every `cfg(` helper and sets explicit `target.name`/`namespace` |
| 2N refactor silently changes an emitted key | Table-driven parity test + unchanged runtime contract tests (`sidePaneHelper.test.ts`, `PageParameters.test.ts`) |
| Parallel agents collide on a file | Ownership map above; any agent needing a file outside its row stops and reports |
| 3T `endswith` filter matches multiple resources | Adapter returns the first and the UI shows the resolved name |
| 1C controlled/uncontrolled drift | Sync `draft` from `value` in an effect keyed on `value`; test slider/preset still update the field |
| Rendered-browser behaviour (1C, 1E, 2Q) unverified by unit tests | 4W reports it as unverified unless a Playwright pass is run; live PPTB behaviour remains unverified |

## Verification Steps (per wave)

```
npx tsc --noEmit
npx eslint src
npx vitest run
npm run build        # wave 3+
```
Evidence classes reported separately: static/typecheck, tests+build, rendered browser (if run), live PPTB (not run).

## Deferred (not in this plan)

- IN-001, IN-002, IN-003 (minor; open follow-up issues).
- Making the runtime resource name a user setting (3T uses leaf-name detection instead).
- `CodeBlock.tsx` highlighter sink review.
