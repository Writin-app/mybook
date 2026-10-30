# Writing Assistant Engine Architecture Implementation Plan

**Goal:** Route the existing English-oriented Writing Insights analysis through minimal shared contracts, a language-aware registry, and an orchestrator while preserving supported English behavior.

**Architecture:** Keep `analysis.ts` and the Worker protocol. Add common types, explicit capability/language matching, orchestration, and a thin adapter that delegates to `analyzeWriting()` through the existing Worker callback. Route the existing panel action through this path while preserving its lifecycle and snapshot checks.

**Tech:** TypeScript, React, TipTap, Vitest; no added dependencies.

**Constraints:** Register only Writing Insights; no document language detection, spelling/grammar provider, translation, AI, editor lifecycle/autosave/Drive changes, dependency changes, or commit. Read the declared page language for routing; disclose that the rules are English-oriented. UTF-16 offsets, `und` unknown language, explicit unsupported/unavailable/error/stale states.

## Files

- Create contract, registry, orchestrator, and insights adapter modules with focused tests under `src/features/writing-assistant/`.
- Keep the existing analysis Worker protocol and executor unchanged; the registered engine adapter wraps the panel's existing Worker request path.
- Modify `WritingInsightsPanel.tsx` and its tests to route explicit open/refresh through the orchestrator.
- Leave `TiptapDocumentEditor.tsx` and persistence/sync code untouched.

## Tasks

1. Tests first for contract semantics and declarations; then add the smallest shared contract types.
2. Tests first for unique registration, duplicate rejection, capability lookup, exact or explicitly declared language support, unsupported/missing engine, execution, engine errors, and stale identity; then implement registry and orchestrator.
3. Test adapter parity with direct `analyzeWriting()` output and English-oriented capability declaration; adapt Worker internally without changing protocol.
4. Test panel open/refresh routing and result parity; preserve UI, existing worker lifecycle, identity checks, and mapping.
5. Run focused tests, existing editor sync/typing regression tests, typecheck, lint, full Vitest suite, and build; inspect final status/diff and preserve unrelated user changes.

## Review focus

- `und` and unsupported variants never fall back silently.
- Duplicate IDs never replace the original engine.
- Stale request results cannot be applied.
- Engine exceptions become typed errors.
- Findings, offsets, Worker lifecycle, and editor identity behavior remain unchanged.

## Rulings

- Keep `analysis.worker.ts` unchanged: the panel-side engine adapter delegates to the existing Worker request path, and the orchestrator retains document/snapshot identity without transferring it through the Worker protocol. Cost if wrong: engine execution remains coupled to the current panel Worker callback until a later Worker protocol migration is justified.
