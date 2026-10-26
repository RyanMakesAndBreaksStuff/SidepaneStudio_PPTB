# PptbContextAdapter Review

**Date:** 2026-10-26
**Scope:** `src/adapters/PptbContextAdapter.ts` and every call into it or into `window.dataverseAPI` / `window.toolboxAPI`.
**Reference:** https://docs.powerplatformtoolbox.com/tool-development/api-reference and its sub-pages (Toolbox, Dataverse, Events, Settings, Error Handling). The docs name `@pptb/types` as the authority for exact types. That package is not installed in this container, so where the docs and our code disagree, check the claim against `@pptb/types` before acting on it.
**Method:** A subagent summarised the docs. The adapter and all its call sites were then read directly.

## Summary

The adapter calls the documented API correctly. Every method it uses exists with the argument order we pass: `queryData(odataQuery, connectionTarget?)`, `execute(request, connectionTarget?)` and `getAllEntitiesMetadata(entityProperties?, connectionTarget?)`. Every OData path uses entity set names (`systemforms`, `savedqueries`, `webresourceset`, `EntityDefinitions`), which is what `queryData` expects. No call is outright wrong. The risks are in error handling, in behaviour the docs don't cover, and in dead code.

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | **High** | Dataverse errors may not be `Error` instances, so the real message gets thrown away | ✅ Fixed: `DataverseError` + `callApi` |
| 2 | Medium | `webApiGet` returns `result.value` without a guard, so callers crash on an unexpected shape | ✅ Fixed: throws on missing `value` |
| 3 | Medium | `webApiGetEntity` relies on undocumented `queryData` behaviour | ✅ Fixed: unwraps `{value:[x]}` |
| 4 | Medium | The `connectionTarget` parameter is never used, and secondary-connection support is untested in production | ✅ Removed parameter |
| 5 | Medium | `@pptb/types` is pinned at 1.2.5 while the docs describe up to 1.2.8 | ✅ Bumped to 1.2.7 (latest published) |
| 6 | Low | `toolboxAPI.events.off` is not in the docs | ✅ No change: `off` is declared in 1.2.7 types |
| 7 | Low | Two components call `dataverseAPI.fetchXmlQuery` directly instead of going through the adapter | ✅ Fixed: `fetchXml` on adapter |
| 8 | Low | Dead code: the WhoAmI cache, `getAllEntitiesMetadata`, and the extension stubs | ✅ Deleted |
| 9 | Low | No paging: `queryData` gives no `@odata.nextLink` handling | ⏸ Deferred: verify on a large org first |
| 10 | Low | `ConnectionTarget` is narrower than the docs allow (no numeric slots) | ✅ Moot (parameter removed) |
| 11 | Info | Query strings are escaped for OData but not URL-encoded | ℹ️ No change |

## Method-by-method validation

| Adapter member | Documented API it calls | Matches docs? | Production callers |
|---|---|---|---|
| `checkWebResourceExists(name)` | `queryData('webresourceset?...', undefined)` | ✅ Correct entity set name; passing `undefined` means primary | `OutputPanel.tsx:88` |
| `webApiGet(path, target?)` | `queryData(path, target)` → `.value` | ✅ For collection paths | `MetadataService.ts:140,173,177,204,205,224,234`; `FormXmlService.ts:106` |
| `webApiGetEntity(path, target?)` | `queryData(path, target)` → whole result | ⚠️ Undocumented (see #3) | `FormXmlService.ts:138` |
| `dataverseExecute(req, target?)` | `execute(payload, target)` | ✅ Request shape matches exactly | Internal only (`getCurrentUserId`) |
| `getCurrentUserId()` | `execute({operationName:'WhoAmI', operationType:'function'})` | ✅ The docs use this exact example for unbound calls | **None** |
| `resetUserId()` | none | n/a | `SidePaneBuilderWorkbench.tsx:139` |
| `getAllEntitiesMetadata(props, target?)` | `getAllEntitiesMetadata(props, target)` → `.value` | ✅ | **None** |
| `createPane` / `getPane` / `getHostKind` / `readEnvVar` / `getCurrentAppId` | none (stubs) | n/a | **None** |

Path checks (in `odataGuards.ts`):
- `systemforms?$filter=objecttypecode eq '<logicalname>'`: valid, because `objecttypecode` on `systemform` is an EntityName column that takes the logical name.
- `savedqueries` / `userqueries` filtered on `returnedtypecode`: valid. The logical name is checked against a regex before it is put in the string.
- `EntityDefinitions(LogicalName='x')/Attributes[/Microsoft.Dynamics.CRM.LookupAttributeMetadata]`: valid metadata collection paths that return `{ value }`.
- `systemforms(<guid>)?$select=formxml`: a keyed single-entity path. The GUID is normalised first.

## Findings

### 1. High: Dataverse errors may not be `Error` instances
The Error Handling page shows Dataverse failures as objects shaped `{ message, status, statusText }`. Every consumer narrows errors like this:
- `MetadataService.ts`: `err instanceof Error ? err.message : 'Unknown error loading table list.'`
- `OutputPanel.tsx:90`: `err instanceof Error ? err.message : String(err)` (this one gives `"[object Object]"`)
- `FormXmlService` keeps the raw value as `cause`, which is acceptable.

If the host rejects with a plain object, users see "Unknown error…" or "[object Object]" instead of the real reason, for example a 401 or 403. Nothing branches on `status` either, so 429 throttling is indistinguishable from other failures.
**Fix:** Normalise errors in one place, inside the adapter. Wrap each `dataverseAPI` call in a helper that turns a non-`Error` rejection into `Error(message)` and keeps `status` on it. All callers then benefit without other changes. Add a test that rejects with `{ message, status: 403 }`.

### 2. Medium: `webApiGet` returns `result.value` without a guard
`return result.value as unknown as T`. If a path ever returns a single object, or the host returns something unexpected, the result is `undefined`. Callers then crash: `response.filter` (MetadataService:144), `sysResult.map`, `system.map`. `FormXmlService:110` is the only caller that guards with `rows ?? []`. The `try/catch` blocks turn the crash into an error result, but the message becomes "Cannot read properties of undefined".
**Fix:** Throw a clear error in `webApiGet` when `Array.isArray(result?.value)` is false, or default to `[]`. Throwing is better because it shows that a path is wrong.

### 3. Medium: `webApiGetEntity` relies on undocumented behaviour
The docs type `queryData` as `Promise<{ value: Record<string, unknown>[] }>`. The adapter's comment says it actually returns the entity itself for a keyed path, and the docs' own `RelationshipDefinitions(SchemaName='…')` example agrees. But this is not a documented guarantee. `FormXmlService:139` already handles a missing `formxml` gracefully, which limits the damage.
**Fix:** Keep the cast where it is, but also accept `{ value: [entity] }`, and record the host version you verified the behaviour on. Alternatively, `retrieve('systemform', id, ['formxml'])` is the documented single-record API and takes a logical name.

### 4. Medium: `connectionTarget` is never used
`webApiGet`, `webApiGetEntity`, `dataverseExecute` and `getAllEntitiesMetadata` all accept `connectionTarget`, and MetadataService passes it through. But no component ever passes a value, so every call goes to the primary connection. `checkWebResourceExists` and `FormXmlService` can't take one at all. The cache key `connectionTarget ?? 'default'` would also treat `'primary'` and `undefined` as two separate entries.
**Fix:** If secondary connections are not planned, remove the parameter. That is 4 adapter signatures and 6 MetadataService signatures. If they are planned, make it work end to end and key the cache on the resolved target.

### 5. Medium: `@pptb/types` is pinned at 1.2.5
The docs describe APIs added after 1.2.5: `connections.getConnection` / `getConnections` (1.2.7), `executeBatch` / `executeTransaction` (1.2.8), and the `connectionTarget` + `additionalHeaders` signatures. Using any of these would fail to type-check. Nothing currently depends on them, but the global types we compile against are older than the docs.
**Fix:** Update `@pptb/types` to the version that matches the minimum host you support, then re-run `tsc`. Do this before acting on #6.

### 6. Low: `toolboxAPI.events.off` is not in the docs
`SidePaneBuilderWorkbench.tsx:157` calls `toolbox.events.off(handler)`. The Events page only documents `events.on`, and says to register once. If `off` doesn't exist in the host, the cleanup throws or does nothing. Every remount (React StrictMode, HMR) would then add another handler, and each connection event would trigger several reloads.
**Fix:** Confirm `off` exists in `@pptb/types`. If it doesn't, register once at module level and fan events out internally, or guard with `typeof toolbox.events.off === 'function'`. The existing `active` flag already stops stale handlers from acting.

### 7. Low: Two components bypass the adapter
`PreviewPanel.tsx:139` and `GridPreview.tsx:113` call `window.dataverseAPI.fetchXmlQuery(xml)` directly. The calls are correct (`fetchXmlQuery(fetchXml, connectionTarget?)`), but they skip the adapter, so they won't get the error normalisation from #1 or connection targeting, and they need separate mocks in tests.
**Fix:** Add `fetchXml<T>(xml, target?)` to `IXrmContext` and send both calls through it.

### 8. Low: Dead code
- `getCurrentUserId` (the WhoAmI cache) has no production caller. `resetUserId` is called on every connection event only to clear a cache that is never filled.
- `getAllEntitiesMetadata` has no production caller.
- `IXrmHostExtensions` stubs (`createPane`, `getPane`, `getHostKind`, `readEnvVar`, `getCurrentAppId`, `isAvailable`, `sidePanesAvailable`) are there only for tests. The file's own comment admits this.

**Fix:** Delete them along with their tests, or leave them deliberately. The comment already argues for keeping them, but about 60 lines of untested-in-production surface is worth trimming.

### 9. Low: No paging
The docs say nothing about `queryData` following `@odata.nextLink`. `systemforms`, `savedqueries` and `userqueries` in a large org could, in theory, go past one page (5,000 rows). `EntityDefinitions` is not paged.
**Fix:** Check with one large environment. If results get cut off, loop on `@odata.nextLink`, or add `Prefer: odata.maxpagesize` through `additionalHeaders` after updating the types (#5).

### 10. Low: `ConnectionTarget` is too narrow
The docs allow `'primary' | 'secondary' | number`. The adapter types it as `'primary' | 'secondary'`. That's harmless today because of #4, but if multi-connection support is ever added, reuse the host's `DataverseAPI.ConnectionTarget` type instead of redefining it.

### 11. Info: Query strings are not URL-encoded
`escapeODataStringLiteral` doubles single quotes, which is correct for OData. It does not URL-encode `&`, `#` or `+`. Every value that reaches it today is either a constant (`RUNTIME_WEB_RESOURCE_NAME`) or matches `^[A-Za-z_][A-Za-z0-9_]*$`, so this can't be exploited now. Revisit it if user-entered text is ever put in a filter.

## Tests
`src/__tests__/PptbContextAdapter.test.ts` covers the concrete class. Missing tests:
- (#1) rejection with a plain `{ message, status }` object
- (#2) `queryData` resolving without `value`
- (#3) `webApiGetEntity` receiving a `{ value: [...] }` shape

## Recommended order
1. #1 error normalisation (biggest effect on users, all in the adapter)
2. #5 update types, then #6 confirm `events.off`
3. #2 and #3 response-shape guards
4. #4 / #8 / #10 cleanup: decide whether secondary connections stay in scope
5. #7 route `fetchXmlQuery` through the adapter
