# AI Writing Experience Design

## Intent

Make writing assistance easier to find and safer to use, especially on mobile. Provide automatic word and character counts in the editor, simplify selected-text AI actions, show changes for review before they modify a document, and remove the unreliable Proofread experience.

## Goals

- Show live word and character counts at the editor's bottom right without a language setting.
- Remove Proofread and the Writing Assistant panel entry from the More menu.
- Keep selected-text AI reachable from both the text selection toolbar and mobile action toolbar, including when mobile selection briefly blurs the editor.
- Offer Rewrite, Summarize, Adjust (tone and length), and Write with AI. Keep Translate separate.
- Explain each action with short secondary text.
- Present generated edits as a reviewable proposal; only apply them after the user accepts. Keep mobile review usable above the keyboard.
- Put local model setup/download in Preferences. Do not add Groq or ask end users for API keys.
- Evaluate each existing AI action using the actual configured local engine, with fixtures covering meaning, facts, and instruction-following.

## Non-goals

- Adding a hosted AI provider, API keys, or language-dependent word counting.
- Applying AI output automatically or changing document persistence outside normal editor transactions.
- Guaranteeing that model output is factually correct; the interface must make review explicit and validation must identify known failure modes.

## Selected approach

Use the existing TipTap editor, mobile and desktop toolbar components, selection AI controller, local model, and persistence flow. Remove the separate Proofread panel/worker path. Reuse the current generated-result lifecycle while adapting the review UI to show a compact inline before/after proposal on larger screens and a readable bottom-sheet review on mobile. Apply only through the existing editor transaction after explicit acceptance.

## Constraints and open implementation choices

- Preserve document content, formatting where currently supported, undo/redo, autosave, and Drive sync.
- Preserve cancellation, stale-result checks, and clear loading/error states.
- Selection changes caused by native mobile controls must not hide the AI affordance while a valid selection remains.
- Local models may be unavailable, unsupported, or not yet downloaded; show an actionable setup state in Preferences and at first use.
- Validate action quality with deterministic prompt/output tests and a small documented sample set. Model-dependent behavior will be reported separately from deterministic code checks.
