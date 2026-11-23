# Glasscn Component Library Design

## Intent

Bring Writin's reusable UI library into visual alignment with the glasscn component showcase while preserving Writin's interaction behavior, public APIs, Figtree typography, responsive PWA support, and light system palette. The editor canvas remains solid white like Apple Notes; the existing sidebar treatment is outside this visual change.

The approved scope is the full reusable web component catalog: restyle every existing component under `src/components/ui`, then add reusable glasscn web components that do not already have a Writin equivalent. Do not add React Native twins or full-page showcase blocks.

## Goals

- Match glasscn's component colors, surface materials, outlines, radii, states, and animation behavior as closely as practical in Writin.
- Keep existing Writin font family, APIs, state/data behavior, accessibility semantics, and editor/storage flows.
- Add Storybook examples for new components and representative visual variants.
- Use existing React, Base UI, Tailwind, and installed packages; avoid dependencies unless a required capability is absent.
- Keep the white editor canvas and existing sidebar appearance intact.

## Non-goals and anti-goals

- Do not replace existing primitives with glasscn source wholesale or change Writin's component APIs without a concrete compatibility need.
- Do not add React Native/Expo implementations, full-page demo blocks, or product-level feature flows.
- Do not add a glass background to the editor canvas or restyle the sidebar as part of this work.
- Do not alter document persistence, editor behavior, auth, Drive sync, routes, or application data.
- Do not claim pixel-identical rendering where Writin's primitives or platform constraints differ; capture those gaps in the component mapping.

## Approaches

1. **Global CSS-only pass.** Fast and consistent for shared surfaces, but insufficient for component-specific states, geometry, and interactions, and risks styling the editor/sidebar unintentionally.
2. **Component-by-component adaptation in Writin's existing architecture (selected).** Audit each component, retain its implementation/API, add shared glass tokens/utilities where appropriate, and adapt component states and examples. This best preserves Writin behavior while allowing showcase-level visual fidelity.
3. **Install glasscn's registry source.** Provides direct source parity, but may introduce incompatible primitives, dependency assumptions, duplicate components, and unwanted behavior changes.

The selected approach is option 2. Shared CSS will provide common tokens and surfaces, while component code owns geometry and states.

## Scope and component mapping

- Existing scope: all source components in `src/components/ui` (currently 65 files, including test files); implementations and compatibility wrappers are reviewed individually. The editor canvas, sidebar, and app-specific feature components remain protected from broad selector side effects.
- Addition scope: every reusable web component in glasscn's current documented catalog that lacks an equivalent in Writin. Existing equivalents are adapted in place rather than duplicated. Components are grouped by surfaces, typography, controls, overlays, navigation, data, and chat.
- Excluded catalog material: native twins, full-page/demo blocks, and showcase-only compositions. Reusable primitives used by those compositions remain in scope.
- Before implementation, the plan must contain a complete source-to-target inventory so every existing component and each missing glasscn component has an explicit disposition (restyle, add, or exclude with reason).

## Visual and behavior constraints

- Use glasscn's `theme-system` palette and set `--glass-clarity: 0.15` for 85% clarity / 15% tint. glasscn defines clarity as 0 (clear) through 1 (tinted); preserve dark-mode behavior where already supported.
- Keep Figtree as the application font.
- Preserve Base UI, React Day Picker, and other existing component contracts and event/state behavior.
- Maintain keyboard operation, focus visibility, accessible names, reduced-motion support, touch target sizing, RTL behavior where supported, and narrow/mobile layouts.
- Keep glass effects modest and legible over Writin's existing white/light backgrounds; avoid assuming an aurora or animated background is present.
- New components use existing dependencies and Writin conventions. Any component that cannot be added without a new dependency is identified before adding that dependency.

## Acceptance criteria

- The plan's inventory accounts for all existing UI component implementations and all glasscn catalog entries, marking each as restyled, added, or intentionally excluded.
- Every in-scope implementation is complete and represented in Storybook, with visual states appropriate to its behavior.
- Existing APIs and behavior are preserved unless a narrowly scoped compatibility change is required and documented.
- Shared styling does not change the editor canvas or sidebar.
- Typecheck, lint, relevant tests, and Storybook build pass; responsive, keyboard, reduced-motion, and light/dark visual states receive manual review where applicable.

## Builder decisions

- Adapt into Writin's existing component architecture rather than installing the registry source.
- Use the current official glasscn website and documented web catalog (83 catalog entries at review time) as the visual/feature reference; do not port native twins or demo blocks.
- The docs index lists 87 reusable component routes while the home page says 83; use the docs index as the current source of truth and recheck the route matrix before implementation.
- When reference colors and Writin defaults conflict, use glasscn's `theme-system` palette and retain Writin's font family.
- Keep this work on the current `feature/glass-ui-styling` branch; do not merge it.
