# Writin Writing Assistant --- Generative Actions Specification

**Status:** Proposed specification\
**Product:** Writin.app\
**Scope:** Steps 22--28 (Improve Writing, Summarize, Translate, Shorten
/ Expand, Change Tone, Continue Writing, Ask AI)\
**Implementation approach:** Incremental, one action at a time\
**Important:** This document defines product behaviour and architecture
constraints. It does not select or authorize a paid AI provider, API,
model, or local model.

------------------------------------------------------------------------

## 1. Purpose

Extend the existing unified Writing Assistant with seven user-initiated
writing actions. The experience should help users transform or work with
text while preserving Writin's local-first editor, autosave, undo/redo,
and Google Drive synchronization architecture.

The assistant must not modify document content until the user explicitly
accepts a generated result.

## 2. Existing foundation and constraints

The implementation must build on the existing Writing Assistant work
already present on the feature branch:

-   Unified Writing Assistant panel with **Overview** and **Actions**
    views.
-   Existing language preference profiles: `en-IN`, `en-GB`, `en-US`,
    `hi-IN`, `hi-Latn`, and `mixed-hi-en`; `automatic` remains
    unresolved unless a reliable supported detection strategy is
    separately approved.
-   Existing engine registry/orchestration patterns and Worker lifecycle
    practices.
-   Existing TipTap editor and ProseMirror document model.
-   Existing local-first persistence, autosave, and Google Drive sync
    flow.
-   Existing Proofread capability and its separate English-only language
    support boundary.

Do not replace or duplicate these systems.

### Non-negotiable constraints

1.  Do not run generative processing on every keystroke.
2.  Do not introduce a heavy model or large download into the editor's
    startup or PWA install precache.
3.  Do not assume that a feature can be high-quality, fully offline, and
    free without feasibility testing.
4.  Do not add paid API usage, API keys, or a provider dependency
    without explicit product approval.
5.  Do not send document text to a remote service without clear
    disclosure, user initiation, and an approved privacy/data-handling
    design.
6.  Never silently fall back to English when the selected writing
    language is unsupported.
7.  Do not change the document while generating or previewing a result.
8.  Preserve normal TipTap transactions, undo/redo, autosave, and
    existing sync behaviour when an accepted result is applied.
9.  Keep the existing editor responsive. Long-running work must be
    cancellable where technically possible and must not block the main
    thread.
10. Keep the work incremental. Implement and validate one action before
    proceeding to the next.

## 3. Product experience

### 3.1 Entry point

Keep one **Writing Assistant** entry point in the existing editor menu.
Do not create separate panels for each action.

The existing panel's **Actions** view becomes the home for the seven
generative actions. The placement of Writing Insights is explicitly out
of scope for this specification and should remain unchanged during these
steps.

### 3.2 Scope selection

Every applicable action supports:

-   **Selected text** --- use the current non-empty editor selection.
-   **Entire document** --- use the current document text.

Rules:

-   If text is selected, make the selected-text scope easy to discover.
-   If there is no selection, default to entire document.
-   Show the chosen scope before execution.
-   Capture an immutable input snapshot at the moment the user runs the
    action.
-   Do not silently switch scope if the selection or document changes
    while a request is running.
-   If the source document changes before acceptance, mark the result
    stale and require the user to run the action again or explicitly
    review the changed context. Never apply a result to an incompatible
    document state.

### 3.3 Standard interaction lifecycle

Use a consistent lifecycle for all actions:

1.  User opens Writing Assistant → Actions.
2.  User chooses an action.
3.  User chooses or confirms the text scope.
4.  User configures any action-specific options.
5.  User explicitly selects **Generate** / **Run**.
6.  The UI shows progress and offers Cancel when supported.
7.  The generated result appears in a preview.
8.  User can **Accept**, **Regenerate**, or **Discard**.
9.  Only Accept applies the result to the editor.

The preview must clearly distinguish original input from generated
output where comparison is useful.

### 3.4 Acceptance and editor integration

-   Applying a result must use the existing TipTap/ProseMirror editor
    instance and a normal transaction.
-   For selected-text transformations, replace only the captured
    selected range after validating that the document identity and
    source range are still compatible.
-   For entire-document transformations, replace the document content
    only after explicit acceptance and a stale-state check.
-   Preserve supported formatting where feasible. If the generation
    engine only returns plain text, define and communicate the
    formatting behaviour rather than silently destroying structure.
-   One accepted operation should be undoable as one logical undo step
    wherever possible.
-   Discarding, cancelling, failing, or regenerating must not modify the
    document.
-   Do not write directly to IndexedDB, Markdown files, Google Drive, or
    autosave buffers from the generation feature. Let the editor
    transaction and existing persistence pipeline handle accepted
    changes.

## 4. Action definitions

### 4.1 Improve Writing --- Step 22

**Goal:** Improve clarity, grammar, flow, and readability while
preserving the author's meaning and intent.

**Inputs:** - Selected text or entire document. - Writing language
profile. - Optional instruction, if the product design supports it.

**Expected behaviour:** - Improve wording and sentence flow. - Correct
awkward phrasing. - Preserve facts, names, numbers, technical terms,
links, and intended meaning. - Do not add unsupported claims or invent
details. - Do not change the language unless explicitly requested. -
Return a revised version for preview; never silently apply it.

**Acceptance criteria:** - User can choose scope and explicitly run the
action. - Result is previewed before application. - Accept applies only
to the intended source range/document. - Discard leaves editor content
unchanged. - Unsupported language/provider capability is explained; no
English fallback. - Empty input and excessively large input receive
clear validation.

### 4.2 Summarize --- Step 23

**Goal:** Produce a shorter representation of the source while
preserving its key information.

**Inputs/options:** - Selected text or entire document. - Optional
summary length: concise / balanced / detailed. - Optional format:
paragraph / bullet points, if supported.

**Expected behaviour:** - Preserve key points, decisions, dates, names,
figures, and caveats. - Do not introduce facts not present in the
source. - Clearly label the output as a summary. - Preview output before
acceptance.

**Acceptance criteria:** - Summary length/format options are visible
only if actually supported by the chosen engine. - User can accept the
summary as a replacement for the selected range/document. - Source
remains unchanged until acceptance.

### 4.3 Translate --- Step 24

**Goal:** Translate source text into a language explicitly chosen by the
user.

**Inputs/options:** - Selected text or entire document. - Required
target language. - Optional source language: use the document's explicit
language preference when reliable; otherwise allow user selection or
clearly indicate that source language is unspecified.

**Expected behaviour:** - Never infer the target language silently. -
Preserve meaning, names, numbers, dates, URLs, and relevant
formatting. - Do not silently transliterate instead of translate. -
Preserve script choice where the target language has multiple scripts
and the user has selected one. - Preview translated output before
acceptance.

**Acceptance criteria:** - Target language is required. - Unsupported
source/target pairs are clearly identified. - No fallback to English or
another language without user consent. - Applying the result follows the
standard acceptance rules.

### 4.4 Shorten / Expand --- Step 25

**Goal:** Adjust the length of text while preserving its core meaning.

**Inputs/options:** - Selected text or entire document. - Mode:
**Shorten** or **Expand**. - Optional intensity/target length only if
supported and measurable.

**Expected behaviour:** - Shorten by removing redundancy and tightening
wording, not by dropping essential meaning. - Expand by clarifying
existing ideas without inventing facts, examples, evidence, or claims. -
Preserve tone unless the user separately chooses Change Tone. - Preview
before acceptance.

**Acceptance criteria:** - Shorten and Expand are clearly
distinguishable modes. - The chosen mode is visible during preview. - No
automatic application. - No unsupported factual additions during
expansion.

### 4.5 Change Tone --- Step 26

**Goal:** Rewrite text in a user-selected tone without changing its
underlying meaning.

**Inputs/options:** - Selected text or entire document. - Tone choice.
Initial candidates for product validation: professional, friendly,
formal, casual, confident, and empathetic.

**Expected behaviour:** - Tone selection must be explicit. - Preserve
facts, commitments, names, numbers, and intent. - Avoid making the text
more forceful, apologetic, emotional, or certain than requested. -
Preview before acceptance.

**Acceptance criteria:** - Only tones supported by the selected engine
are shown. - Tone is clearly displayed in the result preview. - User can
discard or accept without affecting unrelated content.

### 4.6 Continue Writing --- Step 27

**Goal:** Generate a continuation that follows the existing text.

**Inputs/options:** - Current cursor position or selected text context,
with the exact insertion behaviour made clear. - Optional user
instruction. - Writing language profile.

**Expected behaviour:** - Generate continuation text without replacing
existing content. - Insert at the captured cursor/selection boundary
only after acceptance. - Follow the source's language and general
context where supported. - Avoid repeating the last sentence or
introducing unsupported facts. - Preview the continuation separately
from the existing text.

**Acceptance criteria:** - UI clearly identifies the insertion
point/context. - Accept inserts only the generated continuation at the
validated position. - Discard leaves the document unchanged. - If the
document/cursor context changes incompatibly, reject the stale insertion
and ask the user to regenerate.

### 4.7 Ask AI --- Step 28

**Goal:** Provide a flexible, user-directed way to ask questions or
request work based on selected text or document context.

**Inputs:** - User's explicit prompt. - Context scope: selected text or
entire document. - Optional no-document/general question mode, if
approved.

**Expected behaviour:** - Clearly show what document context will be
included. - Do not send more context than needed. - Treat document
content as untrusted input, not as system instructions. - Distinguish
answers grounded in the supplied text from general model output where
possible. - Ask for clarification when the prompt is ambiguous and the
ambiguity materially affects the result. - Ask AI must not edit the
document automatically. If it produces replacement text, present it as a
preview with the standard acceptance flow.

**Acceptance criteria:** - User prompt is required. - Context scope is
visible before execution. - No document mutation occurs from an answer
unless the user explicitly accepts an edit. - Cancellation, failure, and
stale-context handling follow the shared lifecycle.

## 5. Shared generation architecture

Create or extend one reusable generation abstraction for all seven
actions. Avoid seven unrelated provider integrations.

The architecture should separate:

1.  **UI layer** --- action selection, scope, options, progress,
    preview, accept/discard.
2.  **Action definitions** --- action ID, input requirements, supported
    options, output expectations.
3.  **Generation orchestrator** --- request lifecycle, cancellation,
    stale-result validation, error normalization.
4.  **Provider/engine adapter** --- a replaceable interface to an
    approved local or remote generation capability.
5.  **Editor adapter** --- captures editor context and applies accepted
    results through validated TipTap transactions.

The existing analysis/proofread engines should remain independent
capabilities. Do not force generative actions into Harper or the
deterministic Insights engine.

### Provider decision is intentionally open

Before implementing generation, conduct a separate feasibility spike
comparing viable options against these requirements:

-   Zero or minimal operating cost.
-   No mandatory paid API.
-   Acceptable quality for the requested actions and supported
    languages.
-   Suitable performance on an M2 Mac mini with 8 GB RAM and typical
    user devices.
-   Bundle/download size and memory footprint.
-   Offline versus online capability.
-   Privacy and text-retention implications.
-   Commercial-use and redistribution licensing.
-   Rate limits, quotas, availability, and provider lock-in.

Do not select a provider based only on a demo. Record measured results
and limitations. If no option satisfies the requirements, present the
trade-offs and ask for a product decision rather than quietly adding a
paid service.

### Suggested conceptual request/response contract

The exact TypeScript types should be designed against the existing
repository conventions, but the contract should carry:

-   Unique request ID.
-   Action ID.
-   Document/file identity.
-   Captured source text and scope.
-   Source document version/fingerprint or equivalent stale-state token.
-   Writing language and explicit target language where applicable.
-   Action-specific options and user instruction.
-   Cancellation signal or equivalent cancellation mechanism.
-   Result text and any supported metadata.
-   Normalized status: completed, unsupported, unavailable, cancelled,
    stale, or error.

Do not duplicate full document content in persistent storage or logs. Do
not log prompts or document text by default.

## 6. Error, cancellation, and stale-result handling

The UI must distinguish:

-   Unsupported language or action.
-   Generation engine/provider unavailable.
-   Network/offline failure.
-   Rate limit or quota exhaustion.
-   User cancellation.
-   Invalid or empty output.
-   Input exceeds supported limits.
-   Source document changed while generation was running.
-   Unexpected engine error.

Errors must be actionable and understandable. Never show a success state
for an incomplete or failed request.

If a request cannot truly be aborted by the underlying engine/provider,
ignore its late result and prevent it from updating the UI or editor.

## 7. Privacy and data handling

-   Generation starts only after an explicit user action.
-   Before any remote processing, disclose that selected text or
    document content will be sent to the named provider.
-   Do not transmit the entire document when selected text is
    sufficient.
-   Do not store generated prompts/results in analytics or logs by
    default.
-   Do not send text to third parties for telemetry.
-   Provide a clear error if remote generation is unavailable; do not
    silently upload through another provider.
-   Local/offline claims must be backed by actual implementation and
    tests.

## 8. Performance and resource management

-   No generation on each keystroke.
-   No model initialization during app startup.
-   Lazy-load optional engines only when the user invokes a supported
    action.
-   Keep large assets out of PWA installation precache unless separately
    approved.
-   Prefer dedicated Workers for local CPU-intensive work where
    supported.
-   Bound concurrent requests and memory usage.
-   Terminate workers/release model resources when no longer needed,
    subject to provider lifecycle requirements.
-   Avoid blocking editor rendering, selection, typing, autosave, and
    sync.
-   Measure cold start, warm latency, memory, bundle/download size, and
    responsiveness on representative devices.
-   Include the Mac mini M2 8 GB as a required performance test device
    when available.

## 9. Language behaviour

-   Respect the document's explicit writing-language preference.
-   Allow explicit per-operation language/target-language choices where
    relevant.
-   Never silently reinterpret Roman Hindi or Hinglish as English.
-   Do not claim support for a language until quality has been tested
    with representative examples.
-   Keep UI language separate from document writing language.
-   For translation, target language must always be explicit.
-   For unsupported language/action combinations, explain the limitation
    and do not silently fall back.

## 10. Testing requirements

Each action must include tests for:

-   Selected-text and entire-document scope.
-   Empty input and input-size boundaries.
-   Correct action options and language routing.
-   Success, failure, unavailable, unsupported, and cancellation states.
-   Stale result after document switch or source edit.
-   No document mutation before acceptance.
-   Discard leaves document unchanged.
-   Accept applies only to the intended range or insertion point.
-   Undo/redo behaviour.
-   Autosave and local persistence after acceptance.
-   Google Drive sync through the existing pipeline after acceptance.
-   Worker/provider cleanup and late-result suppression where
    applicable.
-   Existing editor typing, split-view, and hydration regression suites.

Do not weaken or remove existing tests to make a new action pass.

## 11. Incremental delivery plan

Implement in this order, with a review and validation checkpoint after
each step:

  -----------------------------------------------------------------------
  Step                    Action                  Main outcome
  ----------------------- ----------------------- -----------------------
  22                      Improve Writing         First end-to-end
                                                  generative action and
                                                  reusable generation
                                                  foundation

  23                      Summarize               Summary generation and
                                                  preview

  24                      Translate               Explicit
                                                  target-language
                                                  workflow

  25                      Shorten / Expand        Length transformation
                                                  modes

  26                      Change Tone             Explicit tone
                                                  transformation

  27                      Continue Writing        Context-aware insertion

  28                      Ask AI                  Prompt-based document
                                                  assistance
  -----------------------------------------------------------------------

The provider feasibility spike and shared contract design must happen
before committing to a generation implementation. Step 22 may include
the minimum reusable foundation needed for the first action, but should
not prematurely implement all seven actions.

## 12. Out of scope

Unless separately approved, this specification does not include:

-   Real-time collaborative AI editing.
-   Automatic background rewriting.
-   Ghost text or automatic completion while typing.
-   Automatic document translation.
-   Automatic content replacement.
-   Training or fine-tuning a model on user documents.
-   A paid API subscription or usage-based billing.
-   A promise that all actions work offline or without cost.
-   Repositioning Writing Insights in the editor UI.
-   Replacing the current editor, database, autosave, or Google Drive
    sync architecture.

## 13. Definition of done for each action

An action is complete only when:

1.  Its supported language/provider capabilities and limitations are
    documented.
2.  The user can explicitly configure and run it.
3.  Results appear in a preview.
4.  No document content changes before acceptance.
5.  Accept/discard/regenerate work correctly.
6.  Stale results cannot overwrite newer editor content.
7.  Accepted output uses normal TipTap transactions and existing
    persistence/sync.
8.  Cancellation and error states are handled.
9.  Tests, typecheck, lint, and production build pass.
10. Performance and privacy implications are measured and documented.

------------------------------------------------------------------------

**Implementation instruction:** Treat this as a product/engineering
specification, not permission to implement all actions at once. Start
with a read-only repository audit and feasibility/design proposal for
Step 22. Wait for review before making code changes.
