# Task 1 report — Characterize the Grid “Only Custom Tables” breakage

## Implemented

- Added a GridPreview characterization that clicks the RelatedRecord “Source table” label and asserts the source value and custom-only pressed state remain unchanged.
- Added related-mode filter tests proving a selected custom source keeps its lookup, view, and target configuration, while a selected standard source is cleared and its dependent lookup/view/target details reset through the source-change path.
- No implementation code changed.

## Verification

- Pre-change baseline:
  - Command: `npm test -- --run src/__tests__/GridPreview.test.tsx src/__tests__/CustomTableFilter.test.tsx`
  - Result: 2 files passed; 37/37 tests passed.
- F1a characterization RED:
  - Command: `npm test -- --run src/__tests__/GridPreview.test.tsx -t "Source table label"`
  - Result: 1 failed, 30 skipped. Assertion at `GridPreview.test.tsx:562`: expected custom-only `aria-pressed="false"`, received `"true"`; selected source remained `new_event`.
  - This is expected: clicking text inside the label activates its first labelable descendant, the nested source picker, whose “Only Custom Tables” button receives the click due to the current composed markup. The characterization proves the observed F1a behavior before refactoring.
- Required focused verification:
  - Command: `npm test -- GridPreview CustomTableFilter`
  - Result: CustomTableFilter 9/9 passed; GridPreview 30/31 passed; combined 39 passed, 1 failed. The sole failure is the expected F1a label-click characterization above. Existing Vite native-loader compatibility warning remains.
- `git diff --check`: passed.

## Files changed

- Task commit HEAD: `49ac0fc362e36ef5a016d0dc639e8e95a68420b9`

- `src/__tests__/GridPreview.test.tsx`
- `src/__tests__/CustomTableFilter.test.tsx`

## Self-review

- All three task acceptance cases are represented and exercise rendered GridPreview/TablePicker behavior.
- The custom-source test asserts state at the source picker, lookup picker, view picker, and related configuration output.
- The standard-source test asserts the source, lookup, view, and dependent target configuration clear.
- Changes are limited to the task-owned tests and this report; unrelated `setup-report.md` remains untouched.

## Concerns

- The F1a test is intentionally red until the follow-up implementation corrects the label/button interaction.
- The Vite config emits its existing `configLoader: 'native'` warning during test runs.
