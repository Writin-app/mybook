# English Proofread with Harper.js

## Goal

Add explicit, English-only proofreading to the Writing Assistant without placing analysis on the editor update path or changing persistence behavior.

## Implementation sequence

1. Add regression tests for UTF-16 selection mapping and Harper worker protocol/language gating.
2. Add an isolated Harper worker and typed request/response protocol. Load Harper's WASM lazily when a proofread request arrives; retain findings in the worker and calculate suggestions only on demand.
3. Add proofread controls and categorized findings to the Actions view, with explicit scope selection and Run action.
4. Guard every result and correction against session, file, editor, document, source text, language, and range changes. Accept one mapped correction in one normal editor transaction; ignore creates none.
5. Configure narrowly scoped runtime caching for the Harper WASM. Keep it out of install-time precache.
6. Run focused tests, editor regressions, typecheck, lint, build, and inspect PWA output. Record measurements and mark untested device/offline cases as release gates.

## Constraints

- Preserve pre-existing Step 12/16/17 modifications.
- Do not alter autosave, sync, editor lifecycle, or Writing Insights analysis.
- Support only en-IN, en-GB, and en-US.
- Do not commit or merge.

## Validation

Use tests first for changed behavior. Verify generated Workbox precache excludes Harper WASM and that a runtime route matches only Harper's same-origin WASM asset. Production PWA offline behavior and M2/mobile performance remain mandatory manual release checks if the current environment cannot prove them.
