# Glasscn Component Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle Writin's reusable UI library to match glasscn's `theme-system` showcase, then add every missing reusable web component while preserving Writin's behavior and product constraints.

**Architecture:** Retain Writin's existing `src/components/ui` primitives and APIs, establish shared glass tokens in `src/styles/globals.css`, and add glasscn-only primitives under `src/components/glass`. Use existing installed libraries and one Storybook entry per component family. Map each current catalog entry to an existing implementation, new implementation, or exclusion before coding.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Base UI, React Day Picker, Recharts, Storybook.

**Spec:** `docs/superpowers/specs/2026-11-23-glasscn-component-library-design.md`

## Global Constraints

- Use glasscn's `theme-system` palette and 85% clarity / 15% tint baseline.
- Keep Figtree typography, the solid white editor canvas, and existing sidebar appearance.
- Preserve Writin component APIs, accessibility, local-first data behavior, and mobile/PWA behavior.
- Do not port React Native twins or full-page showcase blocks.
- Reuse installed packages; justify any new dependency before adding it.
- Do not change document/editor persistence, auth, Drive sync, routes, or app data.

## Review Focus

- **Glass clarity and light/dark palette:** inspect default and dark themes at 85% clarity and ensure text/control contrast remains legible. Validate with token-focused Storybook stories and manual review.
- **Canvas and sidebar isolation:** verify broad surface selectors do not change editor canvas or sidebar appearance. Validate the Writin app shell and editor screen after each shared CSS change.
- **Touch and narrow viewport behavior:** inspect popovers, menus, sheets, controls, dock, and toolbar with a mobile viewport and coarse pointer; retain safe-area handling.
- **Keyboard and reduced motion/transparency:** verify focus, escape/enter/space interactions, and stable opaque fallbacks when reduced motion/transparency is enabled.
- **Existing behavior/data:** verify controlled/uncontrolled inputs, date ranges, table selections, menu items, chat streaming states, empty/loading/error cases, and RTL where supported.

---

## Catalog Inventory

Reference is the live glasscn docs index at implementation start. It currently exposes 87 component routes (the landing page separately says 83); use the documented route list as the source of truth and record any route changes in the matrix. `*` means a new reusable web component is needed unless the detailed API audit finds an equivalent.

| Category | Current Writin equivalent / disposition |
|---|---|
| Surfaces | Aurora*, Backdrop*, Glass*, Liquid glass*, Card → `ui/card.tsx`, Theme scope*, Background extension*, Scroll area → `ui/scroll-area.tsx`, Accordion → `ui/accordion.tsx`, Collapsible → `ui/collapsible.tsx`, Alert → `ui/alert.tsx`, Item → `ui/item.tsx`, Empty → `ui/empty.tsx` |
| Typography | Typography*, Prose* |
| Controls | Button → `ui/button.tsx`, Badge → `ui/badge.tsx`, Input → `ui/input.tsx`, Textarea → `ui/textarea.tsx`, Label → `ui/label.tsx`, Switch → `ui/switch.tsx`, Checkbox → `ui/checkbox.tsx`, Segmented control*, Tabs → `ui/tabs.tsx`, Glass group*, Glass cluster*, Glass morph*, Slider → `ui/slider.tsx`, Progress → `ui/progress.tsx`, Kbd → `ui/kbd.tsx`, Separator → `ui/separator.tsx`, Avatar → `ui/avatar.tsx`, Glass preferences*, Combobox → `ui/combobox.tsx`, Calendar → `ui/calendar.tsx`, Date picker → `stories/shadcnExamples.tsx` + `ui/popover.tsx`, Spinner → `ui/spinner.tsx`, Skeleton → `ui/skeleton.tsx`, Select → `ui/select.tsx`, Radio group → `ui/radio-group.tsx`, Field → `ui/field.tsx`, Input group → `ui/input-group.tsx`, Button group → `ui/button-group.tsx`, Toggle → `ui/toggle.tsx`, Toggle group → `ui/toggle-group.tsx`, Stepper* |
| Overlays | Dialog → `ui/dialog.tsx`, Alert dialog → `ui/alert-dialog.tsx`, Sheet → `ui/sheet.tsx`, Action sheet*, Popover → `ui/popover.tsx`, Tooltip → `ui/tooltip.tsx`, Dropdown menu → `ui/dropdown-menu.tsx`, Toaster → `ui/toast.tsx`, Command → `ui/command.tsx`, Drawer → `ui/drawer.tsx`, Context menu → `ui/context-menu.tsx`, Confirmation popover* |
| Navigation | Dock*, Toolbar*, Scroll edge*, Navigation bar*, Sidebar → `ui/sidebar.tsx` (review only; preserve its appearance), Search field*, Grouped list* |
| Data | Activity rings*, Progress ring*, Sparkline*, Stat*, KPI*, Widget*, Range chart*, Bar list*, Gauge*, Tracker*, Category bar*, Heatmap*, Chart → `ui/chart.tsx` (adapt; use existing Recharts), Area chart*, Bar chart*, Line chart*, Donut chart*, Table → `ui/table.tsx`, Data table* (current story is a static table; new component is interactive) |
| Chat | Chat → review `ui/message.tsx`, `ui/message-scroller.tsx`, `ui/bubble.tsx`; Chat markdown*; Chat parts* |
| Excluded | All glasscn Blocks routes (93–99) and React Native twins. |

The source review covers all 63 implementation files in `src/components/ui` (the directory has 65 TSX files including two test files). Explicit Writin-only files to preserve and review for token consistency: `aspect-ratio.tsx`, `attachment.tsx`, `bubble.tsx`, `carousel.tsx`, `chart.tsx`, `compat-dropdown.tsx`, `direction.tsx`, `marker.tsx`, `message-scroller.tsx`, `message.tsx`, `native-select.tsx`, `pagination.tsx`, `questionnaire.tsx`, `resizable.tsx`, `tree.tsx`. The remaining source files are the equivalences listed above; no API removals are planned.

## Implementation Tasks

### Task 1: Confirm reference matrix and shared glass foundations

**Files:**
- Modify: `docs/superpowers/specs/2026-11-23-glasscn-component-library-design.md`
- Modify: `src/styles/globals.css`
- Modify: `.storybook/preview.tsx`
- Create: `src/components/glass/glass.tsx` (shared visual surface primitive if required by the catalog audit)
- Create: `src/stories/components/GlassFoundations.stories.tsx`

- [ ] Check the current glasscn docs route list and registry metadata; update the inventory above to exact route names and mark each route `restyle`, `add`, or `excluded`.
- [ ] Inspect how `--glass-clarity` currently maps to surface alpha in Writin and define the precise 85%-clarity / 15%-tint value without changing unrelated tokens.
- [ ] Centralize glass material, rim, highlight, shadow, transition, and reduced-transparency fallbacks as reusable CSS variables/utilities; scope selectors to explicit component slots.
- [ ] Add a Storybook foundation story showing `theme-system`, the clarity value, surface variants, and reduced-transparency fallback.
- [ ] Run `npm run typecheck`, `npm run lint`, and `npm run build-storybook`; visually inspect the Writin shell/editor for canvas/sidebar isolation.
- [ ] Commit as `refactor: establish glass component foundations`.

### Task 2: Restyle existing surfaces, typography, and Writin-only primitives

**Files:**
- Modify all surface/layout files under `src/components/ui`: `accordion.tsx`, `alert.tsx`, `aspect-ratio.tsx`, `attachment.tsx`, `bubble.tsx`, `card.tsx`, `carousel.tsx`, `collapsible.tsx`, `empty.tsx`, `item.tsx`, `marker.tsx`, `message.tsx`, `message-scroller.tsx`, `resizable.tsx`, `scroll-area.tsx`, `separator.tsx`, `skeleton.tsx`, `tree.tsx`.
- Modify: corresponding stories in `src/stories/components/` and examples in `src/stories/shadcnExamples.tsx`.

- [ ] Apply reference surfaces, borders, radii, fill hierarchy, and motion, retaining each component's existing exports and DOM behavior.
- [ ] Ensure Writin-only attachments/messages/trees use the same tokens without acquiring new product behavior.
- [ ] Add or update Storybook states for default, hover/focus, disabled, empty/loading, and responsive cases as relevant.
- [ ] Run typecheck, lint, and Storybook build; review at desktop/mobile widths and reduced motion/transparency.
- [ ] Commit as `style: align surfaces with glasscn`.

### Task 3: Restyle controls, fields, and date selection

**Files:**
- Modify: `src/components/ui/{breadcrumb,button,button-group,badge,checkbox,combobox,field,input,input-group,input-otp,label,native-select,progress,questionnaire,radio-group,select,slider,spinner,switch,tabs,textarea,toggle,toggle-group,calendar,kbd}.tsx`.
- Modify: related stories under `src/stories/components/` and examples in `src/stories/shadcnExamples.tsx`.

- [ ] Align fills, focus rings, selected/invalid/disabled states, touch targets, capsules, calendar range behavior, and press/drag motion with glasscn.
- [ ] Preserve Base UI / React Day Picker semantics and all existing controlled/uncontrolled APIs; keep Figtree.
- [ ] Include keyboard focus, error, disabled, selected, and mobile-target cases in stories where relevant.
- [ ] Run typecheck, lint, and Storybook build; manually inspect keyboard operation and touch layouts.
- [ ] Commit as `style: align controls with glasscn`.

### Task 4: Restyle overlays and existing navigation surfaces

**Files:**
- Modify: `src/components/ui/{alert-dialog,command,context-menu,dialog,drawer,dropdown-menu,hover-card,menubar,navigation-menu,pagination,popover,sheet,sidebar,toast,tooltip}.tsx` or apply the shared styling through the corresponding explicit `data-slot` selectors in `src/styles/globals.css`.
- Modify: related stories under `src/stories/components/` and examples in `src/stories/shadcnExamples.tsx`.

- [ ] Align panel material, dimming, offsets, open/close animation, nested menu states, touch sizing, safe-area handling, and focus behavior with glasscn.
- [ ] Preserve the existing Sidebar visual appearance while auditing its selectors and ensuring the new foundation does not affect it.
- [ ] Preserve dropdown bottom-sheet behavior, drawer/sheet interaction, toast lifecycle, escape handling, and portal stacking.
- [ ] Run typecheck, lint, and Storybook build; manually inspect nested menus, keyboard dismissal, mobile sheets, and reduced transparency.
- [ ] Commit as `style: align overlays with glasscn`.

### Task 5: Restyle existing data components and finish the source audit

**Files:**
- Modify: `src/components/ui/{chart,table}.tsx` and any remaining `src/components/ui` files not listed in Tasks 2–4 (`compat-dropdown.tsx`, `direction.tsx`).
- Modify: all affected stories in `src/stories/components/`.

- [ ] Finish the audit of all 63 component implementations, including compatibility and Writin-only primitives, and ensure no existing file is omitted from the matrix.
- [ ] Adapt the shared chart/table surfaces, tooltips, legends, headers, selection and loading states with current Recharts and table APIs.
- [ ] Run typecheck, lint, and Storybook build; verify long labels, empty data, and narrow container layout.
- [ ] Commit as `style: finish glasscn styling audit`.

### Task 6: Add missing surfaces and typography

**Files:**
- Create modules and stories under `src/components/glass/` and `src/stories/components/glass/` for `aurora`, `backdrop`, `liquid-glass`, `theme-scope`, `background-extension`, `typography`, and `prose`.
- Add `glass` if Task 1's API audit determines no shared reusable surface primitive already exists.

- [ ] Implement each missing item using glasscn docs APIs where documented, Writin tokens and installed browser/CSS capabilities; omit any page/demo composition.
- [ ] Keep typography bound to Figtree and preserve semantic HTML; ensure Aurora/background effects honor reduced motion and do not alter the editor canvas.
- [ ] Add focused stories for surface/material variants, text scale, and reduced-motion states.
- [ ] Run typecheck, lint, and Storybook build; inspect contrast on white and dark backgrounds.
- [ ] Commit as `feat: add glass surfaces and typography`.

### Task 7: Add missing glass controls and overlays

**Files:**
- Create modules/stories under `src/components/glass/` and `src/stories/components/glass/` for `segmented-control`, `glass-group`, `glass-cluster`, `glass-morph`, `glass-preferences`, `stepper`, `action-sheet`, and `confirmation-popover`.

- [ ] Match glasscn documented props and interaction states; design Writin-compatible APIs where glasscn is a distinct control.
- [ ] For Glass preferences, expose clarity/reduced-transparency controls as a local UI that writes only the documented theme CSS variables; do not persist user settings until an existing preference store is identified and approved by its current contract.
- [ ] Implement drag, long-press, hold-to-repeat, and passive-dismiss behavior with keyboard/touch alternatives and reduced-motion fallbacks.
- [ ] Add stories for controlled/uncontrolled use, disabled states, and mobile/keyboard interactions.
- [ ] Run typecheck, lint, and Storybook build; manually validate event/focus behavior.
- [ ] Commit as `feat: add glass controls and confirmation surfaces`.

### Task 8: Add missing navigation components

**Files:**
- Create modules/stories under `src/components/glass/` and `src/stories/components/glass/` for `dock`, `toolbar`, `scroll-edge`, `navigation-bar`, `search-field`, and `grouped-list`.

- [ ] Implement the documented reusable primitives with responsive, safe-area-aware web behavior; do not replace Writin's current sidebar or global app navigation.
- [ ] Ensure scroll minimization responds to a caller-provided scroll source and is keyboard accessible; search suggestions remain controlled by the consumer.
- [ ] Add stories for compact/mobile, expanded/desktop, overflow, search focus, and grouped row variants.
- [ ] Run typecheck, lint, and Storybook build; manually inspect scroll and keyboard behavior.
- [ ] Commit as `feat: add glass navigation primitives`.

### Task 9: Add missing data components

**Files:**
- Create modules/stories under `src/components/glass/` and `src/stories/components/glass/` for `activity-rings`, `progress-ring`, `sparkline`, `stat`, `kpi`, `widget`, `range-chart`, `bar-list`, `gauge`, `tracker`, `category-bar`, `heatmap`, `area-chart`, `bar-chart`, `line-chart`, `donut-chart`, and `data-table`.
- Reuse: `src/components/ui/chart.tsx`, `src/components/ui/table.tsx`, existing Recharts.

- [ ] Implement chart/data primitives with typed props, deterministic empty/loading/error states, and accessible text summaries; use Recharts where suitable and browser SVG/CSS otherwise.
- [ ] Do not introduce TanStack Table or chart dependencies until implementation proves existing Recharts/table APIs insufficient; if a package is essential, pause that subtask and report the concrete gap.
- [ ] Keep formatting locale-aware and handle empty values, negative values, single-point series, and long labels.
- [ ] Add stories with representative datasets, edge cases, and narrow responsive frames.
- [ ] Run typecheck, lint, Storybook build; manually verify data labels and keyboard-accessible tabular alternatives.
- [ ] Commit as `feat: add glass data components`.

### Task 10: Add missing chat components and complete integration review

**Files:**
- Create modules/stories under `src/components/glass/` and `src/stories/components/glass/` for `chat`, `chat-markdown`, and `chat-parts`.
- Reuse: `src/components/ui/{bubble,message,message-scroller,avatar,attachment}.tsx` and existing markdown/parser capabilities where available.
- Modify: `.storybook/preview.tsx`, relevant `src/stories/components/`, and `src/styles/globals.css` only for final integration fixes.

- [ ] Build composable chat primitives for grouped turns, streaming-safe content, tool/source/error parts, reactions/actions, and attachment display; keep data/model state controlled by the consumer.
- [ ] Inspect installed markdown and syntax-highlighting capabilities; do not add markdown/highlighting packages without proving the current parser cannot meet the documented requirements.
- [ ] Complete the catalog matrix and Storybook entry for every in-scope component; verify excluded blocks/native twins are not included.
- [ ] Run `npm run lint`, `npm run typecheck`, and `npm run build-storybook`; manually review desktop/mobile, keyboard, reduced-motion/transparency, contrast, canvas/sidebar isolation, and RTL-supported stories.
- [ ] Commit as `feat: add glass chat components`.

## Final Review

- [ ] Compare the final component-to-catalog matrix with the live glasscn docs and document any new/removed routes.
- [ ] Review `git diff --check` and final branch diff for unintended app shell/editor/data changes.
- [ ] Prepare PR title `feat: bring Writin UI library to glasscn style` and description with actual checks and known gaps; leave the branch unmerged.

## Plan Self-review

- Coverage: every Writin UI implementation is assigned to a review/restyle task or is explicitly protected; every documented glasscn component route has a disposition in the matrix; blocks and native twins are excluded.
- Task boundaries: foundations precede existing component styling; additions are grouped by subsystem and each has its own review/build cycle.
- Review focus: color/clarity, canvas/sidebar isolation, touch/mobile, keyboard/reduced effects, and controlled/data edge cases are connected to the tasks that own them.
- Proportion: the catalog is large; tasks group related primitives while keeping each component's API/story work independently reviewable inside its subsystem.
