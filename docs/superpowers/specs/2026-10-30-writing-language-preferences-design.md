# Writing Language Preferences Design

## Intent

Add explicit document writing-language profiles and manual preferences to Writing Insights, while keeping interface language independent and preserving unresolved language as unresolved. This is the foundation for future multilingual engines; it does not detect language or add any spelling, grammar, translation, or generative engine.

## Goals and constraints

- Register `en-IN`, `en-GB`, `en-US`, `hi-IN`, `hi-Latn`, and the Writin-only `mixed-hi-en` profile with names, script, direction, description, and mixed-language metadata.
- Offer Automatic (unresolved in this step) and manual profile selection in the existing panel.
- Persist per-document selection through current file metadata storage and existing local Markdown / Drive metadata paths, without touching editor JSON, autosave scheduling, or sync reconciliation.
- Route only explicitly supported English profiles to the current English-oriented insights engine; unsupported profiles show an explanation and no results.
- Keep mixed language as a product-level profile and leave segmentation for later.

## Non-goals

Automatic detection, segmentation, new language engines, translation, rewriting, app UI localization, document editor changes, and new dependencies.

## Approaches considered

1. **Extend existing document metadata and synchronize Drive appProperties (chosen).** Store the profile ID on `MyBookFile`, expose a metadata-only repository update that leaves `updatedAt` and content alone, preserve the field in local Markdown frontmatter, and synchronize it through a queued metadata-only Drive `appProperties` update. Normal content backups also include the field. This supports cross-device changes without uploading document content or putting preference changes on the content autosave path.
2. **Store a preference only in IndexedDB settings keyed by file ID.** Simpler and avoids metadata serialization work, but not portable with local Markdown / Drive document metadata and duplicates the existing per-file settings model.
3. **Store language in TipTap document attributes or JSON.** Rejected because it changes document content and risks editor transactions, autosave, and persistence semantics.

## Design details

- A central registry owns the profile definitions and the `automatic`/manual preference representation. An absent or invalid stored profile resolves to Automatic/unresolved, never English.
- Profiles expose stable IDs. English profiles expose exact BCP 47 tags. The mixed profile has no BCP 47 tag and is never passed to an English engine.
- The current insights engine explicitly declares only the three initial English regional profiles. Hindi and Hinglish remain unsupported. Registry lookup does not infer regional compatibility.
- Writing Insights receives the document preference separately from `<html lang>`. Selecting Automatic reports that detection is not implemented. Manual unsupported profiles show a clear unavailable message and do not run the worker.
- Persistence is invoked from the panel through a callback. The feature does not import the database or synchronization modules.
- Existing single-language UI remains unchanged; no localization framework is added.

## Risks / calls

- Drive metadata import/export and Markdown frontmatter must preserve legacy files without a language field. The language field is additive and optional; no IndexedDB index or version migration is required.
- Existing favorite metadata is included in Drive backups but has no metadata-only queue operation. Because cross-device language preference must propagate without rewriting document content or depending on a later edit, this step adds a focused `metadata-update` file queue operation that PATCHes appProperties only. It must preserve current favorite metadata, record the returned remote modified time as local last-synced time, and leave document content, `updatedAt`, autosave, and conflict reconciliation untouched. Offline updates remain queued and use existing retry handling.
- Analysis remains English-oriented and rule-based. Profile support describes routing compatibility, not quality guarantees for every dialect.
