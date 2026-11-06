# AI Writing Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify Writin's writing tools, make mobile AI reachable, and ensure AI changes are reviewed before applying.

**Architecture:** Extend existing React/TipTap editor and writing-assistant components. Keep local-first editor transactions as the only path for accepted changes. Remove the separate Proofread surface and worker, and reuse the existing engine orchestration and download state.

**Tech Stack:** React, TypeScript, TipTap/ProseMirror, Tailwind, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-06-ai-writing-experience-design.md`

## Global Constraints

- Base branch is latest `origin/dev`; implementation remains on `feature/ai-writing-experience`.
- Do not add hosted AI, API keys, dependencies, or automatic language detection.
- AI output never changes a document until the user accepts it.
- Accepted changes use the normal editor transaction, preserving undo/redo and existing save/sync behavior.
- Maintain mobile selection, keyboard, focus, accessibility, and safe-area behavior.

## Review Focus

- Mobile selection blur/native selection menu: the AI action remains available for a non-empty selection.
- User edits after generation: stale proposals cannot replace newer content.
- Local model unavailable or not downloaded: users get a clear retry/setup path.
- Empty, Unicode, whitespace, and punctuation-heavy documents: counts remain sensible and language-independent.
- Rewrite/shorten/expand/summary output: preserve named facts, numbers, dates, negation, and commitments; flag model variability rather than asserting deterministic accuracy.

---

### Task 1: Add live editor word and character counts

**Files:**
- Modify: `src/components/document-editor/TiptapDocumentEditor.tsx` and the existing editor toolbar/status component identified during implementation.
- Test: focused editor toolbar tests and a count utility test if a helper is needed.

- [x] Add tests for empty text, whitespace, punctuation, Unicode, and live updates.
- [x] Implement counts from editor document text without language selection.
- [x] Run focused tests and confirm updates as editor content changes.

### Task 2: Simplify AI actions and remove Proofread/More panel entry

**Files:**
- Modify: `src/features/writing-assistant/useContextualSelectionAi.ts`, `src/features/writing-assistant/GenerativeActionsSection.tsx`, `src/components/document-editor/TiptapDocumentEditor.tsx`, relevant Preferences files, and assistant exports.
- Remove: `WritingInsightsPanel` Proofread UI and worker/types when no longer referenced.
- Test: action menu, More menu, settings, and proofread removal behavior.

- [x] Test the exact action set: Rewrite, Summarize, Adjust, Write with AI; Translate remains separate.
- [x] Test each action's short descriptive secondary text and Adjust options for tone and length.
- [x] Test the More menu no longer opens the assistant/Proofread panel.
- [x] Test local model setup/download is discoverable in Preferences and remains available from first use.
- [x] Remove Proofread UI, worker, and dead exports without removing the remaining AI engine.

### Task 3: Make mobile AI reachable from both toolbars

**Files:**
- Modify: `src/components/document-editor/SelectionFormattingToolbar.tsx`, `src/components/document-editor/MobileSelectionAiBar.tsx`, `src/components/document-editor/TiptapDocumentEditor.tsx`.
- Test: related toolbar and mobile selection tests.

- [x] Add tests showing both toolbar entry points open the same actions for a selection.
- [x] Reproduce blur/native-selection behavior and assert the AI entry remains available while selection is valid.
- [x] Implement robust selection tracking and position the action above the keyboard/bottom toolbar.
- [x] Verify Escape, selection clearing, locked documents, and touch targets in focused tests and browser emulation.

### Task 4: Improve proposal review on desktop and mobile

**Files:**
- Modify: `src/features/writing-assistant/GenerativeResultPreview.tsx`, desktop/mobile AI UI, and corresponding tests.

- [x] Add tests that generated output is a proposal and source content stays unchanged until acceptance.
- [x] Add tests for accept, discard, regenerate, stale result, and one-step undo behavior.
- [x] Implement compact inline review on desktop and a readable before/after view on mobile.
- [x] Keep clear loading, cancellation, unavailable-engine, and error states.

### Task 5: Check capability and result quality

**Files:**
- Test: existing `src/features/writing-assistant` engine and action tests; add a focused quality fixture where needed.
- Document: `docs/superpowers/plans/2026-11-06-ai-writing-experience.md` final validation notes.

- [x] Run a representative fact-preservation sample through the real local model for Rewrite, Summarize, Adjust (tone and length), and Write with AI.
- [x] Compare the local outputs with ChatGPT reference rewrites and summaries for names, numbers, dates, negation, and commitments.
- [x] Record capability gaps, inconsistent results, model availability, and unsupported actions.
- [x] Treat the actual model result as a quality failure where facts are omitted or invented, despite passing mock-engine tests.

#### Actual local model quality check (2026-11-06)

The real on-device Llama 3.2 1B model initialized and generated output from this synthetic sample, without applying any proposal:

> The meeting is scheduled for 3 PM on Friday. Please do not cancel the room; Dana will confirm attendance by noon.

ChatGPT reference examples:

- Rewrite: “The meeting is set for 3 PM Friday. Please keep the room booked; Dana will confirm attendance by noon.”
- Summarize: “The meeting is Friday at 3 PM; keep the room booked, and Dana will confirm attendance by noon.”
- Shorter: “Meeting: Friday at 3 PM. Keep the room booked; Dana will confirm attendance by noon.”
- Professional: “The meeting is scheduled for 3 PM on Friday. Please keep the room booked. Dana will confirm attendance by noon.”
- Write with AI prompt “Turn this into a concise professional reminder”: “Reminder: The meeting is Friday at 3 PM. Please keep the room booked; Dana will confirm attendance by noon.”

Observed local outputs and assessment:

- Rewrite preserved 3 PM, Friday, Dana, noon, and “do not cancel”; acceptable for this sample.
- Summarize first retained only the meeting time. A second run retained Dana and the room request but dropped Friday and 3 PM, and added an unsupported cancellation condition.
- Shorter retained Dana, noon, and the room request but dropped the date and time.
- Professional tone added unsupported claims about a “secure room environment” and changed how the room request was phrased.
- Write with AI returned essentially unchanged text for the requested concise reminder.
- Longer returned a false safety refusal for the benign reminder. The refusal detector originally missed the wording “could cause harm or damage” because it only recognized “harmful”; the detector now recognizes this language and the regression is covered by a test. A refusal must be surfaced as an error, not a suggestion.

The selection was never accepted; the source text remained unchanged. The actual model quality check failed overall: users can review proposals, but this 1B model is not reliable enough to preserve key details in Summarize, Shorter, Professional tone, or Write with AI. Keep this branch out of `dev` until the local-model quality issue is addressed or those actions are gated.

### Task 6: Regression checks and PR preparation

- [x] Run focused writing-assistant and editor tests.
- [x] Run `npm run lint`, `npm run typecheck`, `npm test -- --run`, and `npm run build` as appropriate for the completed scope. Full checks passed before the final refusal-detector adjustment; focused tests and typecheck passed afterward.
- [x] Review the diff and prepare the PR title and description; do not merge or open a PR.

#### PR preparation

Title: `feat: simplify AI writing tools and review`

Summary: Simplify selected-text AI writing actions, make them reachable on mobile, and let users review proposed changes inline before applying them.

Changes: Add automatic editor counts; remove Proofread from More and remove its functionality; add a Preferences entry for one-time local model setup; expose Rewrite, Summarize, Adjust, and Write with Writin Assist from desktop and mobile selection tools; add inline review and refusal detection coverage.

Testing: `npm run lint`, `npm run typecheck`, `npm test -- --run` (156 files; latest run 1,755 passed, 1 skipped), `npm run build`, targeted writing-assistant/editor tests, and Playwright desktop/mobile UI checks (2 passed). Local model actions were exercised against synthetic text and showed significant accuracy gaps.

Risk / impact: Changes affect editor toolbars, More menu, Preferences, selection handling, inline suggestion decorations, and local model output handling. Local model quality is not yet reliable for several actions; do not merge to `dev` until quality is addressed or unreliable actions are limited.

Screenshots / UI notes: Desktop and mobile emulation confirmed the action entry points and compact inline review. Mobile was checked in Chromium emulation, not on a physical device.

Environment / config changes: None.

Known issues: Summarize, Shorter, Professional tone, and Write with Writin Assist omitted or changed important details in observed model runs. Longer produced a false refusal; the refusal detector fix is covered by a focused regression test, but the live model was not rerun after that fix.

#### User-requested UI refinements (2026-11-06)

- [x] Rename the selection toolbar entry and menu to Writin Assist, and place the toolbar entry immediately before the separator and overflow menu.
- [x] Show `Local AI Model - Llama 3.2 1B` in the selection tool and Preferences.
- [x] Close the toolbar action menu on action selection, shimmer the selected text while the local model works, then anchor a white review bar above the selection with the action label and Accept / Regenerate / Discard controls; show the generated suggestion inline in the document.
- [x] Rename the Adjust length section to “Make it” and open the “Write with Writin Assist” composer at the selection with a send control.
- [x] Apply the updated labels and review behavior to mobile selection UI.
- [x] Re-run focused component tests, full lint/typecheck/test/build checks, and desktop/mobile browser emulation.
