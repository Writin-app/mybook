# Sidebar Redesign Implementation Plan

## Goal

Update the desktop sidebar to match the provided vault, navigation, favorites, and account menu references while retaining current workspace and account actions.

## Approaches

- Keep sidebar behavior in `AppLayout.tsx` and restyle/reorganize the existing shadcn controls. This preserves current workspace and account state wiring with minimal scope.
- Extract a new sidebar component and move state/actions into props. This separates presentation but broadens the change and adds interfaces without a current need.

Use the first approach because the existing sidebar and actions are already co-located in `AppLayout.tsx`.

## Scope and constraints

- Add an inline vault selector with the selected vault name and a vault icon.
- Keep workspace switching and creation, local mirroring, export, cloud connection, mirror disconnection, appearance, About, Preferences, and logout available through the vault or account menus.
- Use shadcn UI components for search, dropdowns, and account menu controls; use Hugeicons for navigation and content icons.
- Match WDS Nav Item and Nav Group dimensions and states: 32px default items, 6px icon gap, 8px radius, active indicator, Figtree label, 12px/16px group title, and 2px group spacing.
- Change Home to Recent, retain Library, replace the recent-file list in the sidebar with an overflow-scroll favorites list, and retain Trash plus a Support & help destination at the bottom.
- Display account identity and local/cloud status in the footer account trigger.
- Keep existing routing and persistence behavior; do not add new dependencies or invent destinations for unavailable actions.
- Surface the existing global search shortcut in a small shadcn dialog from the account menu.
- Use the existing support email for the report issue link.

## Files

- `src/components/layout/AppLayout.tsx`: sidebar UI, vault and account menu composition, status labels, search trigger, favorites scroll area, and existing action wiring.
- `src/components/ui/sidebar.tsx`: opt-in navigation button variant and WDS nav sizing/state styling while keeping existing variants intact.
- `src/styles/globals.css`: light and dark semantic tokens for WDS navigation states and focus rings.

## Validation

- Review the changed diff and run the project's available static checks. Automated tests are excluded by the active execution instruction.

## Known constraints

- The current application has no separate What's new destination. The menu keeps the existing About page and support email rather than adding a placeholder destination.
