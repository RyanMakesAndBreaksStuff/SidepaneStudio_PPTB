# PPTB API Review — `src/adapters/PptbContextAdapter.ts` and all invocations

**Date:** 2026-10-28
**Reviewed against:** `pptb-api-expertise` skill (SKILL.md Core Principles, `dataverse-api.md`, `toolbox-api.md`, `events-api.md`, `error-handling.md`), checked against the published `@pptb/types@1.2.5` declarations (the version pinned in `package.json`).
**Scope:** the adapter file, every production call site of its members, and the direct `window.dataverseAPI` calls that skip the adapter.

> Note: `node_modules` is not installed in this checkout, so `npm run typecheck` could not run. Type facts below come from the `@pptb/types@1.2.5` tarball (`dataverseAPI.d.ts`, `toolboxAPI.d.ts`, `README.md`), downloaded separately.

---

## 1. Summary

The adapter is a thin, correctly-typed wrapper over `window.dataverseAPI`. Every PPTB call it makes uses a method and argument order that exists in `@pptb/types@1.2.5`, and nothing in it needs anything newer than the declared `minAPI` of `1.2.0`. Callers await or `.catch` every promise, and the workbench checks for an active connection before loading data, as the skill requires. There are no correctness bugs that break the current production flows.

The findings are mostly about contract drift and error quality:

| # | Severity | Finding |
|---|----------|---------|
| F1 | Medium | `webApiGetEntity` fetches a single record through `queryData`. That method is typed as a collection, so the code depends on undocumented runtime behavior. The typed API for this is `dataverseAPI.retrieve`. |
| F2 | Medium | `connectionTarget` is plumbed through 4 adapter methods and 4 `MetadataService` methods, but `package.json` declares `"multiConnection": "none"`. No production caller passes it, and `'secondary'` would fail at runtime. |
| F3 | Medium | Errors are reduced to `err instanceof Error ? err.message : …`. The HTTP `status` that the skill says to map (401/403/404/429) is lost, and nothing is logged to the console. |
| F4 | Low | `webApiGet` returns `result.value` unchecked and ignores `@odata.nextLink` paging. |
| F5 | Low | `GridPreview` calls `window.dataverseAPI.fetchXmlQuery` directly, skipping the `IXrmContext` seam. |
| F6 | Low | Six of the ten `IXrmHostExtensions` members are dead in production: `createPane`, `getPane`, `getHostKind`, `readEnvVar`, `getCurrentAppId`, and `getAllEntitiesMetadata`. So are `getCurrentUserId` and `dataverseExecute`, which back the WhoAmI cache. |
| F7 | Low | The WhoAmI cache has a small race across `resetUserId()`. It is latent only, because nothing in production calls `getCurrentUserId`. |
| F8 | Info | The `OutputPanel` web-resource check effect has no stale-response guard. |
| F9 | Info | Small type/style issues: an explicit `undefined` target, `any[]`, and a `properties` parameter that is required in the adapter but optional in the API. |
| S1 | Skill doc | The skill says to declare multi-connection via `features.connections` and allows numeric slots. `@pptb/types@1.2.5` uses `features.multiConnection` and allows only `'primary' \| 'secondary'`. The repo follows the types, which is correct. |

---

## 2. Compliance against skill Core Principles

| Principle (SKILL.md) | Status | Evidence |
|---|---|---|
| Always `await` Promise-returning methods | ✅ Pass | Every adapter method awaits or returns the PPTB promise. Call sites either `await` inside `try` or chain `.then/.catch` (`OutputPanel.tsx:82-84`, `TablePicker.tsx:55/64`, `FormSelector.tsx:105/113`, `DashboardPicker.tsx:37/44`, `ViewPicker.tsx:26/28`). |
| Wrap every API call in try/catch | ✅ Pass (at service/component layer) | The adapter does not catch, which is fine for an adapter. `FormXmlService` and `MetadataService` turn errors into result objects, and components catch the rest. One exception is `MetadataService.listAttributeLabels`, which throws. Its caller `GridPreview.generate` catches it (`GridPreview.tsx:94/114`). |
| User messages via `showNotification`, technical details to console | ⚠️ Partial | Data failures show inline UI error states instead of notifications. That is acceptable UX, but nothing is logged to the console (see F3). `showNotification` is used only for settings and reset (`SidePaneBuilderWorkbench.tsx:24, 226`). |
| Prefer typed `@pptb/types` | ✅ Pass | Pinned `1.2.5`, set in `tsconfig.json` `types`. The adapter uses `DataverseAPI.ExecuteRequest`. Two casts work against the types (F1, and `execute`'s `Record<string, unknown>` → `T`). |
| No access tokens | ✅ Pass | No token handling anywhere. |
| `connectionTarget` defaults to `'primary'`; non-primary only when multi-connection is declared | ⚠️ See F2 | The parameter is accepted everywhere but never passed in production, and the manifest says `"none"`. |
| Check `getActiveConnection()` before data calls (`error-handling.md`) | ✅ Pass | `SidePaneBuilderWorkbench.tsx:111` gates the UI on `connectionState.status === 'ready'`. |
| Register events once and route inside one handler, with try/catch (`events-api.md`) | ✅ Pass | One handler, registered once (`:152`), routes on `payload.event`, try/catch with `console.error` (`:131-150`), `off` on unmount. On connection change it calls `resetUserId()` and `metaRef.invalidate()`, which is the right invalidation. |

---

## 3. PPTB API surface used by the adapter (verified against `@pptb/types@1.2.5`)

| Adapter member | PPTB call | Declared signature (1.2.5) | Match |
|---|---|---|---|
| `checkWebResourceExists` | `dataverseAPI.queryData(q, undefined)` | `queryData(odataQuery: string, connectionTarget?: "primary" \| "secondary") => Promise<{ value: Record<string, unknown>[] }>` | ✅ |
| `webApiGet` | `dataverseAPI.queryData(path, target)` | same as above | ✅ |
| `webApiGetEntity` | `dataverseAPI.queryData(path, target)` | same; **typed as a collection** | ⚠️ F1 |
| `dataverseExecute` | `dataverseAPI.execute(payload, target)` | `execute(request: ExecuteRequest, connectionTarget?) => Promise<Record<string, unknown>>` | ✅ (cast to `T`) |
| `getAllEntitiesMetadata` | `dataverseAPI.getAllEntitiesMetadata(props, target)` | `(entityProperties?: string[], connectionTarget?) => Promise<EntityMetadataCollection>` | ✅ (narrows to `any[]`, F9) |
| `getCurrentUserId` | via `dataverseExecute({ operationName: 'WhoAmI', operationType: 'function' })` | unbound function, needs no entity | ✅ |

Version gating: all of these exist at `minAPI 1.2.0`. The adapter uses no batch/transaction (1.2.8+) or numeric multi-slot (1.2.7+) APIs.

---

## 4. Invocation map

### 4.1 Construction / injection
- `SidePaneBuilderWorkbench.tsx:63-64`: one instance per mounted workbench, held in a `useRef`.
- `SidePaneBuilderWorkbench.tsx:67`: the same instance is passed to `new MetadataService(adapter)`.
- `SidePaneBuilderWorkbench.tsx:317`: passed as `xrm` to `WorkbenchShell`, which passes it on to `PreviewPanel` and `OutputPanel` and builds `FormXmlService(xrm)`. `PreviewPanel.tsx:86` creates a second `FormXmlService`. That is harmless because the service is stateless.
- There is no React context, factory, or singleton. Consumers see only `IXrmContext`; `MetadataService` uses `Pick<IXrmContext, 'webApiGet'>`.

### 4.2 Production call sites

| Member | Call site | Path / args | Awaited | Error handling |
|---|---|---|---|---|
| `checkWebResourceExists` | `OutputPanel.tsx:82` | `'spstudio_/scripts/sidepane.runtime.js'` | `.then/.catch` | sets `runtimeCheckError` state |
| `webApiGet` | `FormXmlService.ts:106` | `systemforms?$filter=objecttypecode eq '<e>' and type eq 2&$select=name,formid&$orderby=name asc` | yes, in try | `{ ok:false, code:'query-failed', cause }` |
| `webApiGet` | `MetadataService.ts:139` | `EntityDefinitions?$select=…&$filter=IsValidForAdvancedFind eq true and …` | yes, in try | `{ status:'error', reason }` |
| `webApiGet` ×2 | `MetadataService.ts:172, 176` | `systemforms?$filter=type eq 0…`, `userforms?$filter=type eq 0…` | `Promise.all`, in try | `{ status:'error', reason }` |
| `webApiGet` ×2 | `MetadataService.ts:203, 204` | `savedqueries?…returnedtypecode eq '<e>' and querytype eq 0…`, `userqueries?…` | `Promise.all`, in try | `{ status:'error', reason }` |
| `webApiGet` | `MetadataService.ts:223` (`listAttributeLabels`) | `EntityDefinitions(LogicalName='<e>')/Attributes?$select=LogicalName,DisplayName` | returned, not caught | propagates → `GridViewModel.ts:66` → caught in `GridPreview.tsx:114` |
| `webApiGetEntity` | `FormXmlService.ts:138` | `systemforms(<guid>)?$select=formxml` | yes, in try | `{ ok:false, code:'query-failed' }`; `missing-formxml` if shape is wrong |
| `resetUserId` | `SidePaneBuilderWorkbench.tsx:139` | on `connection:created/updated/deleted` | n/a | in handler try → `console.error` |

**No production callers:** `dataverseExecute` (used only internally by `getCurrentUserId`), `getAllEntitiesMetadata`, `getCurrentUserId`, `createPane`, `getPane`, `getHostKind`, `readEnvVar`, `getCurrentAppId`, `isAvailable`, `sidePanesAvailable`. These are exercised only in `src/__tests__/PptbContextAdapter.test.ts`.

**`connectionTarget`:** no production caller passes a non-`undefined` value. Only tests pass `'secondary'`.

### 4.3 Direct PPTB calls outside the adapter (for context)
- `GridPreview.tsx:104`: `window.dataverseAPI.fetchXmlQuery(xml)` (F5).
- `main.tsx:8-9`: presence checks only.
- The `toolboxAPI` uses (connections, events, settings, utils, fileSystem) are outside the adapter's scope and were not reviewed in depth.

### 4.4 OData input safety at call sites

| Builder (`odataGuards.ts`) | Interpolated input | Guard |
|---|---|---|
| `checkWebResourceExists` | web resource name | `escapeODataStringLiteral` (`'` → `''`); input is a constant |
| `buildSystemFormsForEntityPath` | entity logical name | escaped (callers also validate with `isValidLogicalName`, `FormXmlService.ts:94`) |
| `buildSystemFormXmlPath` | form id | `normalizeGuid` regex; returns `null` if invalid |
| `buildViewsForEntityPath`, `buildAttributeLabelsPath` | entity logical name | `isValidLogicalName` regex `^[A-Za-z_][A-Za-z0-9_]{0,127}$` |

All interpolated inputs are validated or escaped. Nothing is URL-encoded (`&`, `#`, `%`, `+`), but every current input is either a constant or regex-restricted to `[A-Za-z0-9_]`, so this is safe today. The guard only becomes unsafe if `escapeODataStringLiteral` is later used on free text.

---

## 5. Findings in detail

### F1 — `webApiGetEntity` relies on `queryData` returning a non-collection (Medium)
`PptbContextAdapter.ts:132-136`

```ts
const result = await window.dataverseAPI.queryData(cleanPath, connectionTarget);
return result as unknown as T;
```

`queryData` is declared as `Promise<{ value: Record<string, unknown>[] }>`. The code comment says it really returns the bare entity for a keyed path. That behavior is undocumented in both the types and the skill, so a host update could change it without notice. The skill's documented single-record method is:

```ts
retrieve(entityLogicalName: string, id: string, columns?: string[], connectionTarget?) => Promise<Record<string, unknown>>
```

There is one production caller (`FormXmlService.ts:138`, `systemforms(<guid>)?$select=formxml`). It can be replaced with `dataverseAPI.retrieve('systemform', guid, ['formxml'])`, which removes the double cast. Today's failure mode is graceful: if the shape changes, `FormXmlService` returns `missing-formxml` instead of crashing. That is why this is Medium and not High.

**Recommendation:** add `retrieveEntity(entityLogicalName, id, columns, connectionTarget?)` to `IXrmContext` backed by `dataverseAPI.retrieve`, switch `FormXmlService.getFormModelResult` to it, then delete `webApiGetEntity`. `normalizeGuid` stays as the id guard. Update `FormXmlService.test.ts:108`.

### F2 — `connectionTarget` plumbing conflicts with `"multiConnection": "none"` (Medium)
- `package.json:7`: `"features": { "minAPI": "1.2.0", "multiConnection": "none" }`.
- `IXrmContext.webApiGet/webApiGetEntity`, `IXrmHostExtensions.dataverseExecute/getAllEntitiesMetadata`, and `MetadataService.listAccessibleTables/listAccessibleDashboards/listViewsForEntity/listAttributeLabels` all accept `connectionTarget?: 'primary' | 'secondary'`.
- No production caller passes it. If one did pass `'secondary'`, the host would have no secondary connection to resolve, because the tool declared `"none"`.
- `checkWebResourceExists` is the only `IXrmContext` member without the parameter (it hard-codes `undefined`), so the interface is already inconsistent.
- `MetadataService` cache keys (`connectionTarget ?? 'default'`) exist only to serve this unused dimension.

**Recommendation:** pick one of these:
- **(a)** Remove the parameter from the interface and services. It is YAGNI, gives a smaller surface, and removes a footgun.
- **(b)** Keep it, but make it consistent (add it to `checkWebResourceExists`) and add a comment tying it to the manifest flag. A future switch to `"optional"` would then also need `toolboxAPI.connections.getSecondaryConnection()` gating.

Option (a) is recommended unless multi-connection is on the roadmap.

### F3 — Error detail is discarded; no status mapping or console logging (Medium)
The skill (`error-handling.md`) says PPTB/Dataverse errors look like `{ message, status, statusText }`. It also says to log technical details to the console and give status-specific user messages (401 → reconnect, 403 → no permission, 429 → retry later).

What the code does:
- `MetadataService.ts:155-157, 188-190, 212-214`: `err instanceof Error ? err.message : 'Unknown error…'`. If the host rejects with a plain object, the message becomes generic and `status` is dropped. Nothing is logged.
- `OutputPanel.tsx:84`: `err instanceof Error ? err.message : String(err)`. A plain-object rejection renders as `"[object Object]"`.
- `GridPreview.tsx:116`: same pattern. Nothing is logged.
- `FormXmlService` keeps `cause` in the result object (good), but nothing logs it or shows it.

**Recommendation:** add one helper, e.g. `describePptbError(err): { message: string; status?: number }`, that reads `message`/`status` from both `Error` and plain objects. Use it at these four catch sites, add `console.error(context, err)`, and map 401/403/429 to the skill's suggested messages. The inline error-state UX can stay as it is.

### F4 — `webApiGet` returns `value` unchecked and drops paging (Low)
`PptbContextAdapter.ts:123-124` returns `result.value as unknown as T`.
- If `value` is missing (for example a keyed path sent to `webApiGet` by mistake), `MetadataService` calls `.filter`/`.map` on `undefined` and throws. That error is caught, but the message is unhelpful. `FormXmlService` already defends with `rows ?? []`.
- `@odata.nextLink` is ignored. `EntityDefinitions` is not paged. `savedqueries`, `userqueries`, `systemforms`, and `userforms` hit the default 5000-row page limit only in extreme orgs, so this risk is theoretical.

**Recommendation:** `return (result.value ?? []) as unknown as T;`. Optionally `console.warn` when `@odata.nextLink` is present.

### F5 — `GridPreview` skips the adapter for `fetchXmlQuery` (Low)
`GridPreview.tsx:104`: `window.dataverseAPI.fetchXmlQuery(xml)`. Every other Dataverse read goes through `IXrmContext`, which `testHelpers.ts` stubs. This one call needs a global mock, ignores the `connectionTarget` design, and splits the seam. The response is runtime-validated (`:106`), which is good.

**Recommendation:** add `fetchXml<T>(xml, connectionTarget?)` to `IXrmContext` and route `GridPreview` through `metadataService` or `xrm`.

### F6 — Dead `IXrmHostExtensions` surface (Low)
`createPane` (always throws), `getPane`, `getHostKind`, `readEnvVar` (`console.warn` + `null`), `getCurrentAppId`, `getAllEntitiesMetadata`, `getCurrentUserId`, and `dataverseExecute` have no production caller. The header comment (`:46-55`) says they were kept on purpose as an extension point (PR-002). That is a documented choice, not a defect. The cost is ~45 lines and ~15 tests that maintain code nothing uses, plus `isAvailable = false` / `sidePanesAvailable = false` flags that could mislead a future reader into thinking the PPTB context is "unavailable".

**Recommendation:** no change is required. If trimming, remove the side-pane and env-var stubs first, since PPTB has no host equivalent for them, and keep `dataverseExecute`/`getCurrentUserId` only if a feature will use them.

### F7 — WhoAmI cache race across `resetUserId()` (Low, latent)
`PptbContextAdapter.ts:104-119`. Suppose call P1 is in flight when `resetUserId()` runs on a connection change, and a new call then caches P2:
- If P1 rejects, its `.catch` sets `this._whoAmIPromise = null`, which evicts P2. This only causes an extra request.
- If P1 resolves, callers awaiting P1 get the **previous connection's** user id.

Nothing in production calls `getCurrentUserId`, so this is latent. If it is wired up later, guard the clear with an identity check: `if (this._whoAmIPromise === p) this._whoAmIPromise = null`.

### F8 — `OutputPanel` web-resource check has no stale guard (Info)
`OutputPanel.tsx:78-86`. Switching away from the library tab and back quickly starts two checks, and whichever finishes last wins. Both query the same constant, so the outcome is the same. Add an `active` flag and a cleanup like the workbench's own effects use, for consistency.

### F9 — Minor typing/style (Info)
- `checkWebResourceExists` passes `undefined` as the second argument explicitly (`:90`); omitting it is clearer.
- `getAllEntitiesMetadata(properties: string[]…)` makes `properties` required, while the API has `entityProperties?`. It also returns `any[]` where it could return `DataverseAPI.EntityMetadata[]`.
- `dataverseExecute` copies the request into `DataverseAPI.ExecuteRequest` field by field. `DataverseExecuteRequest` is structurally identical to `DataverseAPI.ExecuteRequest` (1.2.5), so the local interface could alias it.
- `@pptb/types` is pinned to `1.2.5`; `1.2.7` is the latest stable. No adapter change is needed, but bump it when convenient.

---

## 6. Skill documentation discrepancies (S1)
These were found while cross-checking the skill against `@pptb/types@1.2.5`, and should be fed back to the skill author:

| Skill says | `@pptb/types@1.2.5` says |
|---|---|
| Declare multi-connection with `package.json` `features.connections` (SKILL.md, `toolbox-api.md`) | `features.multiConnection: "required" \| "optional" \| "none"` (README validator table; `toolboxAPI.d.ts:504`) |
| `connectionTarget` may be `'primary' \| 'secondary' \| number` | Every `dataverseAPI` method declares `"primary" \| "secondary"` only. Numeric slots are marked v1.2.7+ in the skill and are not in 1.2.5. |
| `connections.getConnection(target)` / `getConnections()` | 1.2.5 `ConnectionsAPI` has only `getActiveConnection()` and `getSecondaryConnection()`. |
| Events handler example uses the first argument `event` (a string) to route | 1.2.5 declares `on(callback: (event: any, payload: ToolBoxEventPayload) => void)`, with the event name in `payload.event`. The repo routes on `payload.event`, which matches the types. |

The repo's manifest (`"multiConnection": "none"`) and handler are correct for the version it targets.

---

## 7. Recommended actions (priority order)
1. **F1:** replace `webApiGetEntity` with a `dataverseAPI.retrieve`-backed method and migrate `FormXmlService.getFormModelResult`.
2. **F3:** add a shared PPTB error describer with console logging and 401/403/429 mapping, and use it in `MetadataService`, `OutputPanel`, and `GridPreview`.
3. **F2:** decide on multi-connection. Remove the `connectionTarget` plumbing, or make it consistent and document its link to `features.multiConnection`.
4. **F4:** default `webApiGet` to `[]` when `value` is missing.
5. **F5:** route `GridPreview`'s `fetchXmlQuery` through `IXrmContext`.
6. **F6–F9:** optional cleanup.

## 8. Method
- The skill was loaded from the attached `pptb-api-expertise.zip` (SKILL.md and references).
- Two Haiku explorer subagents (medium effort) mapped every adapter invocation and looked for the PPTB type declarations. The main reviewer re-checked the key call sites (`SidePaneBuilderWorkbench.tsx`, `MetadataService.ts`, `FormXmlService.ts`, `OutputPanel.tsx`, `GridPreview.tsx`, `GridViewModel.ts`, `odataGuards.ts`).
- Type signatures came from `npm pack @pptb/types@1.2.5` (not installed into the project).
- No source files were changed.
