/**
 * Feature flags for optional / experimental product capabilities.
 */

/**
 * Master flag controlling visibility of AI Writing Assistant features in the UI:
 * - Desktop text selection toolbar ("Writin Assist" button & popover)
 * - Mobile selection toolbar & floating pill ("AI actions" & MobileSelectionAiBar)
 * - Settings page ("Local AI & Writing Assistant" preferences section)
 *
 * To re-enable in the future:
 * Change the fallback to `true` or run with `VITE_ENABLE_AI_FEATURES=true`.
 */
export const ENABLE_AI_WRITING_ASSISTANT: boolean =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ENABLE_AI_FEATURES === 'true') ||
  (typeof process !== 'undefined' && process.env?.VITE_ENABLE_AI_FEATURES === 'true') ||
  false
