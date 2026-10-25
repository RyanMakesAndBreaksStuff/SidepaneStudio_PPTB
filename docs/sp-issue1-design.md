# SP Issue 1: design options

Companion to [sp-isssue1.md](sp-isssue1.md). Date: 2026-10-24. Code read: `CodeGenerationService.ts`, `ValidationService.ts`, `configGuards.ts`, `sidePaneHelper.ts`/`.js`/`.d.ts`, `ConfigurePanel.tsx`, `PaneOverlay.tsx`, `CommandStepsTab.tsx`, existing plans. Microsoft Learn pages re-fetched on this date (navigateTo, generative navigation examples, sidePanes, createPane, AppSidePane, OnLookupTagClick, generative pages).

Nothing here was run in a live app. Items marked **[verify]** are assumptions listed again in the checklist at the end.

## 0. Corrections to the issue and to older docs

| # | Finding | Effect |
| --- | --- | --- |
| C1 | `docs/update-targets.md` says generative is "do not add: Microsoft documents createPane + generative as unsupported". Microsoft now documents it: [create-app-side-panes](https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/create-app-side-panes) has a "Display a generative page in a side pane" example. | Item 6 is allowed. Amend the `update-targets.md` row so nobody reads the old decision. |
| C2 | The issue says "rebuild `sidepane.runtime.js` with `npm run build:runtime`". The shipped file is **hand-written** and imported via `?raw` (`OutputPanel.tsx`). `build:runtime` bundles `sidePaneHelper.ts` into `dist-runtime/`, which nothing consumes. | A runtime key change is **three hand edits** (`.ts`, `.js`, `.d.ts`), not a rebuild. `sidePaneHelper.test.ts` tests the `.ts` copy; `PageParameters.test.ts` evals the real `.js`, so the `.js` is covered, but only by the parameter tests. See Prep P1. |
| C3 | The issue says "all six trigger kinds". There are **nine** (`TriggerKind`). | Tests must loop over the list, not hard-code six. |
| C4 | `hidden` **is** documented in `createPane` and `AppSidePane`. The code comment "Never consumed by any consumer" describes this tool, not the API. | Item 5: the contradiction resolves as "valid API, deliberately unsupported". |
| C5 | `AppSidePane.navigate` is documented as accepting "the same parameters as `navigateTo`". Whether `navigationOptions` is honoured in a pane is not stated. | Item 4's premise ("`pane.navigate` takes only `pageInput`") is unproven. **[verify]**, but a pane ignoring dialog options is the likely outcome and does not change the design. |
| C6 | "Dependencies tab" in the form event-handler dialog is for **Dependent Columns**, not libraries. | Item 2's Command Steps need: add libraries under Form Libraries, register the OnLoad handler, then add the lookup column(s) on the Dependencies tab. |
| C7 | `getTagValue()` also returns `fieldName` (the originating lookup column). | One handler can serve several lookups and tell them apart. Not needed now: all listed lookups open the same pane definition. |
| C8 | Issue item 7 says the page ID is "environment-specific". Microsoft says generative pages are solution-aware (stored as "UX Agent Project" rows) but does not say the GUID is preserved on import. | Soften the docs wording and **[verify]** before telling users to re-enter it. |
| C9 | `Change-Log.md` tops out at v1.1.1 while `package.json` is 1.3.1. | Item 8's Change-Log entry needs the missing versions or an explicit new heading. |

## Summary

| Item | Recommended path | Size | Order |
| --- | --- | --- | --- |
| P1 prep | Retire the `.ts` runtime copy; named record-aware target lists (`LOOKUP_TAG_TARGETS`, `RELATED_RECORD_TARGETS`); exhaustive `pageType` switches | S | 0 |
| 1 create mode | Explicit "Open existing / Create new" choice on the Table record target | S | 1 |
| 2 lookup tag | Generated registrar, remove-then-add (no global flag), multi-lookup via comma list, corrected Command Steps | M | 2 |
| 3 pageInput keys | Implement `createFromEntity` only (as "pre-fill from current record" in create mode); document the other six as unsupported | S | 1 |
| 4 navigateTo | Decide separately. Lean: yes, as a narrow "Open as: Dialog" mode after 6 to 8; otherwise record as out of scope | L | 5 |
| 5 sidePanes surface | Document `hidden` and collapse as unsupported; fix the `hidden` comment. Add a close/toggle option for command-bar triggers (uses `getSelectedPane` + `state`) and an availability guard in every script | M | 4 |
| 6, 7, 8 generative | One change: type, generator (with brace-stripped IDs), 2-file runtime, validation, UI, preview, docs, tests, plus a **Page prompt** output tab that writes the setup prompt for the generative page | L | 3 |
| 7 (stretch) page picker | Dropdown of the environment's generative pages in place of the GUID field; GUID entry stays as fallback. Gated on the page table being readable | M | 3b |
| 9 dialog + generative | Only with item 4; `returnValue` stub; Page prompt adds the `setPageOutput` wording | S on top of 4 | 5 |

Items 1 and 3 share one code path (entity record) and ship together. Items 1, 2, 5 and 6 all edit `CodeGenerationService.ts`, so they run one at a time.

---

## P1. Prep (enabler for 3, 5, 6)

- **Retire the TS runtime copy.** This is workstream 1 of `update-targets.md`, left half-done. Delete `vite.runtime.config.ts`, the `build:runtime` script, `src/runtime/index.ts`, `sidePaneHelper.ts`; keep `sidepane.runtime.js` + `sidePaneHelper.d.ts`; point `sidePaneHelper.test.ts` at the JS the way `PageParameters.test.ts` already does (`(0, eval)(runtimeSource)`). Every later runtime change drops from three edits to two, and the tested bytes equal the shipped bytes. **End users are unaffected**: they get the file from the **Download** button on the Shared Library tab (`OutputPanel.tsx` imports `sidepane.runtime.js?raw`, so Vite inlines it in the studio bundle; save goes through `toolboxAPI.fileSystem.saveFile`, with a Blob fallback). Only the repo-level docs change: `README.md` (L93-96) and `How-To-Build.md` (L80, 83, 115, 128) still tell developers to run `build:runtime` and take `dist-runtime/sidepane.runtime.js`; repoint them to the in-app download, or to `src/runtime/sidepane.runtime.js` for repo users. Also clean `eslint.config.mjs` (L12-13). Watch: the ESLint override for a plain `.js` global (noted in `update-targets.md`), and the `/dist-runtime` gitignore line.
- **Name the record-aware target lists.** The four sites hold **three different sets**, so one shared constant would change behaviour: `buildRecordContext` (L95) and `ConfigurePanel.tsx` (L380) use `custom` + `entityrecord` (lookup tag supplies the record); `ValidationService` (L155, RelatedRecord) uses `custom` + `entityrecord` + `webresource`; `ConfigurePanel.tsx` (L423, "needs a table name to send context") uses `custom` + `webresource`. Export two constants, `LOOKUP_TAG_TARGETS` (L95, L380) and `RELATED_RECORD_TARGETS` (L155), and add `generative` to both and to the L423 condition. Leave webresource lookup-tag behaviour unchanged unless decided separately.
- **Exhaustive switches.** `PaneContentSkeleton` falls back to `EntityRecordSkeleton` for unknown types (a silent wrong picture). Replace `default` with an `assertNever` so a new `pageType` is a compile error everywhere it matters.

Alternative to the first bullet: leave the duplicate and add a parity test that runs the same cases against both. Cheaper today, permanent tax later. Not recommended.

---

## Item 1. Table record create mode

**Facts.** `entityId` omitted = create mode (navigateTo reference). `data` on a create-mode form sets default column values, so create mode plus the existing Form data field is already "new record with prefill". Today the generator throws at runtime when no ID resolves (`buildConfiguredRecordIdExpression`), and validation blocks that case, so no valid saved config produces a blank ID.

| Option | How | Cost | Risk |
| --- | --- | --- | --- |
| A. Implicit (issue's proposal) | Context mode None + blank static ID means create | ~10 lines, no new field | Forgetting the ID now silently generates a "new record" pane. Today that mistake is a blocking error. |
| **B. Explicit (recommended)** | Radio on the entityrecord target: **Open existing record** / **Create new record**. New `createNew: boolean` on the variant (default `false`) | 1 field in the type, `resetTarget`, `configGuards`, panel; generator + validation branches | None. Old configs read `false`. |
| C. Both | B in the UI; generator rule from A as a safety net | B + 3 lines | Two ways to say the same thing |

**Design (B).**
- Generator: when `createNew`, `entityName` = `target.entityName` only (the context table must not override it, unlike today's `context.entityName || target.entityName`), no `entityId`, keep `formId`/`tabName`/`data`. Basic and Library both. **Runtime unchanged**: it already does `if (o.entityId !== undefined)`.
- Validation: skip the static-ID error when `createNew`. Error when `createNew` is combined with `LookupTagClick` or `RelatedRecord` (no record to open). Warning when the context mode is not None and no pre-fill is set: "Create mode ignores record context."
- Panel: hide the Record ID field and the "Record context" callouts when creating; hint on Form data: "In create mode these values pre-fill columns on the new record" (link: set field values using parameters passed to a form).
- Preview: overlay label "New {table}".
- Tests: `CodeGenerationService.test.ts` (no `entityId` in output, Basic + Library), `ValidationService.test.ts` (no ID error; lookup/related errors), `configGuards`/`PageParameters.test.ts` (legacy config loads with `createNew: false`; generated create script runs against the real runtime and calls `navigate` without `entityId`).

---

## Item 2. Lookup tag click registration

**Facts.** `addOnLookupTagClick` takes a function reference; Microsoft advises a **named** function if you ever remove it. `removeOnLookupTagClick` exists. The event args carry `getTagValue()` (`id`, `entityType`, `name`, `fieldName`).

**Why not the reference post's global flag.** A page-lifetime `isLoad` flag is set on the first form and would skip registration on the next record's form, whose controls are new instances. Registrations live on the control, so the guard has to live there too.

**Recommended guard: idempotent re-registration.** Remove the same named handler, then add it. Repeat OnLoad calls cannot double-register, and there is no global state. **[verify]** `removeOnLookupTagClick` on a handler that was never added is a harmless no-op.

Generated (Basic; Library is identical apart from the handler body):

```js
var NS = NS || {};
NS.openPane = async function (executionContext) { /* unchanged handler */ };

// Form OnLoad handler ("Pass execution context" on). Safe to run more than once.
NS.registerOpenPane = function (executionContext) {
  var formContext = executionContext.getFormContext();
  ["ownerid", "parentcustomerid"].forEach(function (name) {
    var control = formContext.getControl(name);
    if (!control) { console.warn("NS.registerOpenPane: no lookup control " + name); return; }
    control.removeOnLookupTagClick(NS.openPane);
    control.addOnLookupTagClick(NS.openPane);
  });
};
```

- **Name.** `register` + capitalised function name, not a fixed `onLoad`, so two definitions in one namespace cannot collide.
- **Several lookups.** Reuse `trigger.fieldName` as a comma-separated list (trim, dedupe, each checked with `isValidLogicalName`). No schema change, old configs unaffected. A `string[]` field with chips is the heavier alternative; not worth it for this. All listed lookups open the same pane definition.
- **Command Steps** (`DEPLOY_STEPS.LookupTagClick`), replacing the current vague third step:
  1. Create the script web resource (Library mode: also upload `sidepane.runtime.js`) and publish.
  2. Form → **Form libraries**: add the runtime first (load order is list order), then the script.
  3. **Events → OnLoad**: add `NS.registerFn`, enabled, **Pass execution context as first parameter** on.
  4. On the handler's **Dependencies** tab add the lookup column(s) as Dependent Columns so they cannot be removed from the form.
- **Output panel.** Library mode's note "the runtime must be deployed" becomes the numbered steps above. Add the Library-only step 1 clause.
- **Tests.** Run the generated script with a fake form context whose controls keep a handler set; call the registrar twice; assert one handler and that the handler invokes `SidePaneHelper.open` with the tag's `id`/`entityType`. Add a missing-control case (warns, does not throw).

---

## Item 3. Missing `entityrecord` pageInput keys

| Key | Value for this tool | Decision |
| --- | --- | --- |
| `createFromEntity` | High. Create mode plus mapped defaults ("new contact from this account"). The source is always the triggering record, so it needs no new ID field. | **Implement** as a checkbox **Pre-fill from current record**, shown only when `createNew` and the trigger is a form or grid. Form: `{ entityType: formContext.data.entity.getEntityName(), id: formContext.data.entity.getId() }`. Grid: `{ entityType: <context table>, id: selectedRecordId }`. Warn that it only maps columns when a table mapping (relationship) exists between source and target. |
| `processId` | Low. A solution-imported process keeps its ID, but few users need to pin a BPF on a pane form. | Document as unsupported; revisit on request. |
| `processInstanceId`, `selectedStageId` | Runtime values; nothing static to enter. | Unsupported. |
| `relationship` | Five-field object for related-record forms. | Unsupported. |
| `isCrossEntityNavigate`, `isOfflineSyncError` | Platform-internal flags. | Unsupported. |

**Alternative.** One advanced **Extra pageInput (JSON)** field merged into any entityrecord pageInput would cover all seven and future additions in one field. It gives up the tool's validated-output promise, and `pageType`/`entityName` would need a deny list. Only worth it if users ask for the BPF keys.

Touchpoints for `createFromEntity`: add `createFromCurrent: boolean` to the entityrecord variant next to `createNew` (type, `resetTarget`, `configGuards`, panel), generator `buildNavigateInput` + Library block, runtime trio (`if (o.createFromEntity) nav.createFromEntity = ...`), `.d.ts` type. Add a user-manual "Not supported" list for the other six.

---

## Item 4. `navigateTo` and dialog targets

**What exists.** `buildNavigateInput` already produces the `pageInput`. A `navigateTo` mode reuses it, plus an options object and a result handler. Everything pane-specific (`paneId`, reuse, close others, state, badge, width, canClose) does not apply.

**Valid combinations** (from the reference): entity list inline only; entity record, web resource, generative inline or dialog; custom page inline/dialog/pane per its own article; dashboard dialog is undocumented. Dialog return values: entity record opened in **create mode** returns `savedEntityReference[]`; generative returns `returnValue`; others return nothing.

| Option | What it means | Cost |
| --- | --- | --- |
| A. Out of scope | One README paragraph: "SidePane Studio generates side-pane scripts only." | XS |
| **B. Narrow dialog mode (lean)** | New top-level **Open in: Side pane / Dialog**. Dialog hides the pane section and shows position (center/side), width, height (px or %), title. Basic output only. Allowed targets: entity record, generative, web resource, custom page. | L: type, generator branch (~40 lines), validation matrix, panel section, preview label, docs |
| C. Dialog + inline | B plus `target: 1` | B + small, but inline is not a pane; stretches the product further |

**Reasoning.** B earns its cost through two combinations nothing else offers: *New record in a dialog, then use the saved record* (item 1) and *generative picker dialog that returns a value to the form* (item 9). If the product stays "side panes only", choose A and say so. The decision is the owner's: it changes what the tool is.

**B design sketch.**
- Config: `presentation: 'pane' | 'dialog'` (default `'pane'`) plus `dialog: { position: 1 | 2; width: SizeValue; height?: SizeValue; title: string }`.
- Generator: a sibling of `buildGetOrCreateBody` emits `await Xrm.Navigation.navigateTo(pageInput, navigationOptions)`, wrapped in the standard try/catch. Triggers, namespaces, pending-guards and record context are reused untouched.
- Result stub by target: create-mode record → read `result?.savedEntityReference?.[0]`; generative → read `result?.returnValue`; otherwise none.
- Validation: error for dashboard/search/entity list in dialog; width/height > 0.
- Unknown **[verify]**: whether `pane.navigate(pageInput, navigationOptions)` honours the second argument. If it does not, nothing changes.

---

## Item 5. Remaining `sidePanes` surface, close/toggle, availability guard

| Surface | Verdict | Reason |
| --- | --- | --- |
| `createPane.hidden` | Unsupported on purpose | A hidden pane has no tab, so the user cannot reach it; this tool opens panes for users. Keep the stored field for old configs; rewrite the comment on `PaneConfig.hidden` to say so; do not show a control. |
| `getSelectedPane` | **Implemented** through the toggle option below | `getPane(paneId)` stays the lookup for opening; `getSelectedPane` answers "is my pane the one showing?". |
| `state` | Expand on open (existing) and **read** by the toggle; no collapse option | Collapsing while opening a pane contradicts opening it. `expandOnOpen: false` already omits the expand. |

Done-when: `hidden` and collapse are listed under "Not supported by design" in the user manual and README (with the comment fix); `getSelectedPane` and `state` are used by the toggle.

**Close/toggle option.** A command-bar button that cannot dismiss what it opened is an everyday annoyance, and this is the real gap behind `state`/`getSelectedPane`.
- Config: `behavior.toggleIfOpen: boolean` (default `false`; `booleanOr` in `configGuards`; Toggle in the Behavior section of the panel).
- Behaviour: if `Xrm.App.sidePanes.getSelectedPane()` returns a pane (guard for null: `getPane` is documented as returning both `null` and `undefined` on different pages, so treat `getSelectedPane` the same way), its `paneId` is this `paneId`, and `Xrm.App.sidePanes.state === 1`, close the pane and return; otherwise open or navigate as usual.
- Generator: emitted first in `buildGetOrCreateBody`, before the related-record preamble, so closing never reads a lookup. Command-bar triggers only (`FormButton`, `MainGridButton`, `SubgridButton`), where the body already sits in an async IIFE so `return` is valid.
- Validation: error on `behavior.toggleIfOpen` for any other trigger (a load or select handler would close its own pane on re-fire). Warning when `canClose` is false: the script closes a pane the user cannot.
- Runtime: `toggleIfOpen?: boolean` in `SidePaneHelperOptions`; the same check at the top of `open`; `.js` and `.d.ts` change together.
- Tests: in `PageParameters.test.ts`, a fake `sidePanes` with the pane selected and expanded; second click closes without calling `navigate`.

**Availability guard.** Microsoft: side panes are web-browser only (prevented in native players) and unavailable on-premises. Today the `TypeError` from `Xrm.App.sidePanes` is caught by the generated `try` (and by the runtime's `try`), so the user gets `openErrorDialog` with "Cannot read properties of undefined". On a FormOnLoad or OnChange trigger that error dialog appears on every load or change.
- Generator: first lines of `buildGetOrCreateBody`: if `!Xrm.App || !Xrm.App.sidePanes`, return. Command-bar triggers show `Xrm.Navigation.openAlertDialog` ("Side panes are not available in this client."); load, change, select and lookup triggers only `console.warn`, so an unsupported client does not get a dialog on every form load.
- Runtime `open`: same check ahead of `xrm.App.sidePanes`.
- Tests: generated script run with `Xrm.App` undefined neither throws nor navigates. Update any existing test that asserts on the full generated body.

---

## Items 6 to 8. Generative page target

One change; the pieces below agree on one shape: `{ pageType: 'generative'; pageId: string; data: string }`.

**Types and guards.** Add `'generative'` to `PageType` and `PAGE_TYPES` (`configGuards.ts` L12), add a branch before the final `else` (which currently means "search"), `resetTarget` case. Old configs carry no such variant. A config saved by this version and loaded by an older one returns `null` and falls back to defaults; that is existing behaviour for unknown types.

**Generator.**
- `buildNavigateInput`: `pageType`, `pageId` (normalised GUID), then `entityName` and `recordId` only when both resolve, exactly the `custom` rule and exactly the docs' "both or neither". `data: JSON.parse(...)` via `buildTargetParameterParts`, same as entity record.
- **Strip braces.** Form and grid IDs come back as `{GUID}`; lookup tags too. The generative page passes `recordId` to `dataApi.retrieveRow(tableName, { id })`, which documents `id` as "The ID (Guid) of the row". For this target only, emit `.replace(/[{}]/g, '')` on the ID expression (`buildRelatedRecordPreamble` already does the same for grids). **[verify]** whether the braces would actually fail; the strip is harmless either way.
- Lookup tag: the `tag.id`/`tag.entityType` branch in `buildRecordContext` (L95) includes generative via `LOOKUP_TAG_TARGETS`.
- Library: `pageId`, `recordId`, `entityName`, `data` options; runtime `case 'generative'` in `.js` and `.d.ts` (and `.ts` if P1 is skipped).
- Context modes all work as for `custom` (CurrentRecord, SelectedRow, Static, RelatedRecord, None).

**Validation (item 7).**
- Errors: `target.pageId` empty or not a GUID (`normalizeGuid`); `target.data` not a JSON object (`parseFormData`); Static mode with an ID but no table (`context.entityName`); Static mode with a blank ID.
- Warnings: (a) shown whenever a record or data will be sent: "`recordId`, `entityName` and `data` only reach the page if it was set up to accept input parameters" with the Microsoft Learn link; (b) when a record-context mode is used with **Reuse open pane** off: the page captures inputs at `navigate`; reuse re-navigates and keeps the pane current, so leave it on.
- Do not generate the `main.aspx?pagetype=genux` URL (external callers only).

**Panel.** "Generative page" content type; **Page ID** field (placeholder GUID; hint: app designer → select the page → properties pane → **Generative page** field); **Page data (JSON)** reusing the Form data textarea. That textarea is inline in the entityrecord block today; extract a `JsonDataField` so the two share it.

**Page picker (stretch, after the core change).** A dropdown of the environment's generative pages replaces the copy-from-designer step, built like the dashboard picker (`listAccessibleDashboards` + `DashboardPicker`). Gate on a discovery step: the rows are labelled "UX Agent Project" but the table's logical name is unverified, so first query `EntityDefinitions` for it and confirm a normal user can read name and ID. If so: `buildGenerativePagesPath` in `odataGuards.ts`, `listGenerativePages` in `MetadataService` (cached, same generation guard), picker component. Keep the GUID text box as a fallback (the read may be denied, or the page may not exist yet in this environment); validation stays on the GUID either way. If the table is not readable, drop the picker and keep the hint text. Pages are listed per app (`pac model genpage list --app-id` prints each page ID), so the picker may need to be scoped to the app rather than the environment.

**Companion prompt (Page prompt tab).** Microsoft says a page accepts `recordId`, `entityName` and `data` only if the page's prompt says so, which is the step most likely to leave a pane ignoring its inputs. Add a **Page prompt** tab to the Output panel, shown only for the generative target.
- A pure function (`buildGenerativePagePrompt(config)`, new service file) builds copy-ready text for the app agent from the config: the table (`context.entityName`) when a record ID is sent ("Set up the page to accept an `entityName` of `account` and a `recordId` GUID; on load, fetch and display that record"); the top-level keys of the Page data JSON ("accept a `data` object with `status` and `category`"); and, once item 9 exists, the `dataApi.setPageOutput?.(value)` then `Xrm.Navigation.navigateBack()` wording for dialog use (Microsoft: `setPageOutput` is not part of the shared `dataApi` contract, so the page must check it exists).
- Render with the existing `CodeBlock` and `copyText`. The text is a starting point: the agent is not deterministic, so the tab says to test the page after regenerating.
- Tests: unit tests on the function for each combination (no inputs, record only, data only, both).

**Preview and docs (item 8).**
- `PaneOverlay`: `GenerativePageSkeleton` (card grid + chart bar), `PAGE_TYPE_LABELS['generative']`, show the page ID shortened (`…` + last 8). `PreviewPanel` meta rows get `['Page ID', pageId]`. `NativeMdaFrame` only branches on record/list, so it needs no change.
- Docs: user-manual Step 4 list and trigger notes, `usage.md`, README, Change-Log (see C9). State that the page must be set up to accept parameters **by describing it in the page's prompt** (that is how Microsoft says to do it), and treat "ID changes after import" as unconfirmed (C8) until verified. Add a short note on the alternative: a generative page can be added to a form as a component and receives `recordId` automatically, which some users asking for a side pane actually want.
- Tests, beyond the issue's list: loop every `TriggerKind` × Basic/Library in `CodeGenerationService.test.ts`; `configGuards` round-trip plus legacy-config load; **`PageParameters.test.ts`**: run a generated generative script against the real runtime and assert the `navigate` argument. That test is the contract guard for the generator/runtime pair.
- Done when: `npm test`, `npm run typecheck`, `npm run lint` pass.

---

## Item 9. Generative page in a dialog

Depends on item 4 option B. Output for target `generative` + `Open in: Dialog`:

```js
var result = await Xrm.Navigation.navigateTo(
  { pageType: "generative", pageId: "…", entityName: "account", recordId: "…" },
  { target: 2, position: 1, width: { value: 70, unit: "%" }, height: { value: 80, unit: "%" }, title: "Select an account" });
var output = result && result.returnValue;   // undefined when the user cancels
if (output && typeof output === "object" && output.action === "selected" &&
    typeof output.accountId === "string" && typeof output.accountName === "string") {
  // Apply the value: e.g. formContext.getAttribute("new_accountid").setValue([{ id: output.accountId, name: output.accountName, entityType: "account" }]);
  // Call fireOnChange() on the attribute if form logic must react to the programmatic update.
}
```

Microsoft's own sample sets a lookup from the result and type-checks each field first, because the page's output is untyped; ship that as the commented stub. Side panes cannot return values, so none of this touches the pane path. The generative page must call `dataApi.setPageOutput(value)` then `Xrm.Navigation.navigateBack()`; the Page prompt tab (items 6 to 8) writes that wording for the app agent.

---

## Assumptions to verify in a live app

1. `removeOnLookupTagClick(fn)` before any `addOnLookupTagClick(fn)` does not throw.
2. A create-mode pane (`entityrecord`, no `entityId`) opens a blank form in the pane; `data` pre-fills columns.
3. `createFromEntity` with `getId()` in braces works; otherwise strip.
4. A generative `recordId` in `{braces}` fails or works (we strip regardless).
5. `pane.navigate(pageInput, navigationOptions)`: second argument ignored or honoured.
6. A generative page's ID after solution export/import: same GUID or new.
7. Generative page in a pane re-navigates correctly through the reuse path when the selected record changes.
8. The toggle's check works: `getSelectedPane().paneId` matches and `state === 1` while the pane is showing; `close()` works on a pane created with `canClose: false`.
9. The generative page table can be read through the Web API by a normal user (gates the page picker).
10. A generative page renders its content in a side pane and receives `recordId`/`data` there. During preview it did not: a February 2026 write-up ([Dianamics PCF Lady](https://dianabirkelbach.wordpress.com/2026/02/15/navigating-to-and-from-generative-pages/)) found side panes showed only the title and parameters did not arrive. Generative pages went generally available in the week of 2026-10-19, and Microsoft now documents both (create-app-side-panes, navigate-to-generative-page-examples). Treat the preview findings as superseded; one smoke test in a GA environment is enough. If a page renders blank, check whether the environment has the GA release before debugging the generator.

## Verification log (2026-10-25)

Checked against Microsoft Learn (navigateTo, create-app-side-panes, createPane, sidePanes, AppSidePane, getPane, getSelectedPane, add/removeOnLookupTagClick, OnLookupTagClick, getEventArgs, navigate-to-generative-page-examples, generative-pages, dataApi table and page methods, navigate-to-custom-page-examples), Firecrawl web and developer search, and the code at `bc6baad`.

**Confirmed:** C1 (the generative side-pane example exists; the `update-targets.md` L48 row still says "do not add"), C2 (`OutputPanel.tsx` L15 `?raw`; `build:runtime` in `package.json`; README L93-96; How-To-Build L80, 83, 115, 128; eslint L12-13; `.gitignore` L18), C3 (nine `TriggerKind`s), C4 (`hidden` is in both createPane and AppSidePane), C5 (AppSidePane.navigate "accepts the same parameters as navigateTo"), C7 (`fieldName` on `getTagValue`), C9 (Change-Log tops out at v1.1.1, package 1.3.1). Also confirmed: `entityId` omitted means create mode; `createFromEntity` and the other six keys; dialog return values (`savedEntityReference`, `returnValue`); the generative `pageInput` shape and "both or neither" for record context; the page-ID location in the app designer; "inputs captured at `pane.navigate`, call it again to update"; "side panes return no value"; `main.aspx?pagetype=genux` is for external callers only; custom pages open in centred and side dialogs; web-browser only, not on-premises; `PaneContentSkeleton` falls back to `default` (L197); `buildRelatedRecordPreamble` strips braces (L155); `sidePaneHelper.test.ts` imports the `.ts` copy and `PageParameters.test.ts` evaluates the `.js` copy; generator and validation throw or error when no entity record ID resolves.

**Corrected in this doc:** the P1 record-aware lists (three sets, not one); the availability-guard wording (the error is caught, not unhandled); the `retrieveRow` signature; `setPageOutput` being optional; the item 9 stub's type checks; null handling for `getSelectedPane`; the picker being scoped per app.

**Still open (not covered by the docs):** C6 (the Dependencies tab lists dependent columns; not re-checked), C8 (Microsoft calls generative pages "solution-aware" but does not say the GUID is kept on import), and live assumptions 1 to 10. The existing lookup handler already calls `eventArgs.preventDefault()`, which Microsoft's getEventArgs table lists for OnLookupTagClick, so item 2 needs no change there.

## Sequencing

0. P1 prep, one commit, no behaviour change.
1. Items 1 and 3 (create mode and `createFromEntity`).
2. Item 2 (lookup registrar and Command Steps).
3. Items 6 to 8, including the Page prompt tab. 3b: the page picker, once assumption 9 holds.
4. Item 5 (documentation pass, toggle, availability guard) and the item 3 "not supported" list.
5. Item 4 decision; item 9 follows it.

Rationale for moving P1 first: item 6 is the largest runtime change, and doing it before the runtime duplicate is retired doubles its edit surface and keeps the stale "rebuild" step alive.
