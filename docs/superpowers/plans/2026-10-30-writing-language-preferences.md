# Writing Language Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit writing-language profiles and per-document manual/Automatic preferences to Writing Insights without changing application language or editor content.

**Architecture:** A pure registry defines profiles and engine tags. The panel receives preference data and persistence callbacks from the editor integration. The existing document metadata path stores preferences in IndexedDB and local Markdown frontmatter. Cross-device Drive persistence uses a queued metadata-only PATCH of appProperties, so it does not rewrite document content or depend on a later backup.

**Tech Stack:** TypeScript, React, Dexie, existing Markdown/Google Drive metadata flow, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-30-writing-language-preferences-design.md`

## Global Constraints

- Do not implement automatic language detection or language segmentation.
- Do not add spelling/grammar engines, translation, rewriting, paid APIs, or dependencies.
- Do not modify editor initialization, `onUpdate`, autosave scheduling, or sync conflict reconciliation. Add only a metadata-only queue operation for cross-device writing-language preferences.
- Do not use app UI language as document writing language.
- Missing or invalid preference resolves to Automatic/unresolved and never English.
- Only explicitly declared compatible languages may reach the English-oriented insights engine.

## Review Focus

- Missing/invalid persisted language must remain unresolved; test legacy file metadata and Automatic state.
- Changing language must not alter document JSON, content, or `updatedAt`; test metadata-only persistence and the content-free Drive PATCH.
- Drive/local Markdown without the new field must remain backward-compatible; test import and round-trip.
- Drive metadata updates must preserve favorite state, avoid sending document content, keep the last-synced time current, and retry failures/offline updates through the existing queue; test queue behavior.
- English regional compatibility must remain exact and opt-in; test en-IN/en-GB/en-US and reject unrelated English tags.
- Switching documents during analysis must not display the previous document's language/results; test panel prop changes and invalidation.

---

### Task 1: Define language profiles and explicit engine compatibility

**Files:**
- Create: `src/features/writing-assistant/languages.ts`
- Create: `src/features/writing-assistant/languages.test.ts`
- Modify: `src/features/writing-assistant/insightsEngine.ts`
- Modify: `src/features/writing-assistant/insightsEngine.test.ts`
- Modify: `src/features/writing-assistant/index.ts`
- Modify: `src/features/writing-assistant/engineRegistry.test.ts`

**Interfaces:**
- `WritingLanguageProfileId`: union of `en-IN | en-GB | en-US | hi-IN | hi-Latn | mixed-hi-en`.
- `DocumentWritingLanguagePreference`: `{ mode: 'automatic' } | { mode: 'manual'; profileId: WritingLanguageProfileId }`.
- `WRITING_LANGUAGE_PROFILES`: immutable profile records with IDs, labels, native labels where applicable, BCP 47 tag or `null`, base language(s), region, script, direction, description, and mixed flag.
- Helpers: `getWritingLanguageProfile(id)`, `normalizeDocumentWritingLanguagePreference(value)`, and `getEngineLanguageTag(preference)`; unresolved/mixed returns `und`.

- [x] **Step 1: Add profile and helper tests** for six exact IDs, names, scripts, directions, mixed metadata, BCP 47 tags, unique IDs, and unresolved/invalid input normalization.
- [x] **Step 2: Run the focused language test** with `npm test -- --run src/features/writing-assistant/languages.test.ts`; verify failure because the module is absent.
- [x] **Step 3: Implement the immutable registry and normalization helpers** in `languages.ts`; do not detect or infer language.
- [x] **Step 4: Declare exact English coverage in the insights engine** for `en-IN`, `en-GB`, and `en-US`, with no broad `en-*` subtag matching.
- [x] **Step 5: Update registry/engine tests** to require those three tags and reject `en`, `en-AU`, Hindi, Hinglish, and `und`.
- [x] **Step 6: Run focused registry/engine tests** and confirm exact compatibility behavior.

### Task 2: Persist document preference through existing metadata paths

**Files:**
- Modify: `src/types/files.ts`
- Modify: `src/utils/mybookMarkdown.ts`
- Modify: `src/utils/mybookMarkdown.test.ts`
- Modify: `src/services/localWorkspace.ts`
- Modify: `src/services/localWorkspace.test.ts`
- Modify: `src/database/repositories.ts`
- Modify: `src/database/repositories.test.ts`
- Modify: `src/services/googleDrive.ts`
- Modify: `src/services/googleDrive.test.ts`

**Interfaces:**
- `MyBookFile.writingLanguage?: string` stores the stable profile ID or `automatic`; unknown values normalize to Automatic in the UI.
- `fileRepository.setWritingLanguage(id, preferenceId)` writes the property, leaves content and `updatedAt` untouched, persists local workspace frontmatter, and queues a metadata-only Drive update for an existing Drive-backed file.
- `SyncOperation` adds `metadata-update`, which calls `updateDriveFile(fileId, { appProperties })` without content, preserves both `isFavorite` and `writingLanguage`, and records the returned `modifiedTime` as `lastSyncedAt`.
- `MyBookMarkdownMetadata.writingLanguage?: string` round-trips the optional `writing_language` frontmatter value.

- [x] **Step 1: Add failing tests** for metadata-only repository updates, legacy frontmatter parsing, frontmatter round-trip, local workspace propagation, Drive `appProperties` import/export, queue coalescing/retry, favorite preservation, content-free PATCH, and remote modified-time handling.
- [x] **Step 2: Run those focused tests** and verify failures correspond to missing language metadata support.
- [x] **Step 3: Extend the file and Markdown metadata types** and parse/serialize optional `writing_language` without requiring a Dexie version/index change.
- [x] **Step 4: Pass the optional language metadata through local workspace writes/scans** while preserving it when legacy Markdown has no field.
- [x] **Step 5: Add `fileRepository.setWritingLanguage`** that updates only `writingLanguage`, persists local workspace frontmatter, and queues `metadata-update` for a Drive-backed file; leave `updatedAt`, content, and autosave behavior unchanged.
- [x] **Step 6: Process `metadata-update` with a content-free Drive appProperties PATCH** that preserves `isFavorite` and `writingLanguage`, retries through the existing queue, records the returned modified time, and does not enter document conflict reconciliation. Include language metadata on normal backups and imports as well.
- [x] **Step 7: Run focused repository, Markdown, local workspace, and Drive tests** and verify legacy files, conflict state, content, and favorite state remain intact.

### Task 3: Add manual language selection to Writing Insights

**Files:**
- Modify: `src/features/writing-assistant/WritingInsightsPanel.tsx`
- Modify: `src/features/writing-assistant/WritingInsightsPanel.test.tsx`

**Interfaces:**
- Panel receives `writingLanguage?: string` and `onWritingLanguageChange(preferenceId: string): Promise<void>`.
- Its analysis context derives the language only from the saved/selected document preference, never `document.documentElement.lang`.
- Automatic, mixed, unsupported, and unknown values do not invoke the English engine/Worker.

- [x] **Step 1: Add failing panel tests** for selector options, automatic unresolved state, manual selection, supported English analysis, unsupported Hindi/Roman Hindi/Hinglish, invalid stored values, and stale result clearing when the document preference changes.
- [x] **Step 2: Run the focused panel tests** and verify the new behavior fails before implementation.
- [x] **Step 3: Add a compact selector** to the existing panel, including Automatic/manual status and a clear unsupported-language message while preserving the current layout.
- [x] **Step 4: Gate explicit analysis through the profile and engine registry**; clear prior results and never create a Worker for unsupported/unresolved profiles.
- [x] **Step 5: Run the focused panel tests** and verify existing supported-English statistics and suggestions remain unchanged.

### Task 4: Connect file metadata to the panel and validate

**Files:**
- Modify: `src/components/document-editor/TiptapDocumentEditor.tsx`
- Modify: `src/services/editorSyncAndTypingRegression.test.tsx`
- Modify: `src/features/writing-assistant/WritingInsightsPanel.test.tsx`

**Interfaces:**
- The editor passes the active `file.writingLanguage` and a callback to `fileRepository.setWritingLanguage`; the panel itself remains independent of persistence and app localization.

- [x] **Step 1: Add a regression assertion** that selecting a writing language changes only the file metadata and leaves editor JSON/content and editor transaction count unchanged.
- [x] **Step 2: Run the focused regression test** and verify it fails before wiring the callback.
- [x] **Step 3: Pass the active document preference and metadata-only callback to the panel** without changing editor initialization or `onUpdate`.
- [x] **Step 4: Verify document switching, close/reopen, and panel state** using repository and panel tests; confirm the app `<html lang>` is not changed.
- [x] **Step 5: Run required validation:** focused and full Vitest, TypeScript checks, ESLint, production build, and editor synchronization/typing regression tests. Report any pre-existing modified/untracked user files separately and preserve them.

## Self-review

- Spec coverage: registry, profile metadata, BCP 47 tags, mixed product profile, app/document language separation, manual/Automatic UI, persistence, engine routing, unsupported messaging, mixed-language preparation, and all requested validation are assigned above.
- Changes remain outside editor initialization, `onUpdate`, autosave timing, and conflict reconciliation. The metadata-only Drive queue operation does not upload content.
- The optional metadata field requires no IndexedDB index migration and remains backward-compatible with existing files.
