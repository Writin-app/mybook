# Agent Instructions

These instructions apply to the entire repository.

The goal is to keep development safe, predictable, and easy to promote through:

```
task branch
    ↓
dev
    ↓
stg
    ↓
main
```

`main` is production and must remain stable.

---

## Branch Model

The repository uses three permanent branches:

- `dev` — active integrated development.
- `stg` — release candidate / staging.
- `main` — production.

Environment mapping:

```
dev  → dev.writin.app
stg  → staging.writin.app
main → writin.app
```

Normal development must not happen directly on any of these permanent branches.

---

## Task Branches

Always create a dedicated branch for implementation work.

Use:

- `feature/...` for new user-facing functionality.
- `fix/...` for normal bug fixes.
- `hotfix/...` for urgent production fixes.
- `refactor/...` for internal restructuring without intentional behavior changes.
- `docs/...` for documentation-only changes.
- `chore/...` for maintenance, tooling, dependency, or cleanup work.
- `test/...` for test-only changes.

Examples:

```
feature/global-search
feature/table-selection
fix/editor-cursor
fix/mobile-scroll
hotfix/google-login
refactor/editor-block-controls
docs/infrastructure-setup
chore/update-eslint
test/table-selection
```

Keep branch names:

- short
- lowercase
- descriptive
- hyphen-separated

Do not automatically use a `codex/` prefix.

---

## Default Branch For New Work

For normal feature development, bug fixes, refactors, chores, documentation, and tests:

```
base branch = dev
```

Do not create normal work from `main`.

Do not create normal work from `stg`.

Before starting normal work:

1. Check the current branch.
2. Check the working tree.
3. Fetch the latest remote refs.
4. Confirm the task branch is based on the latest `origin/dev`.

Preferred starting point:

```bash
git fetch origin
git switch dev
git pull --ff-only origin dev
git switch -c fix/example
```

If updating `dev` would overwrite, conflict with, or otherwise affect existing user changes, stop and report the situation instead of modifying those changes.

---

## Never Work Directly On Permanent Branches

Do not directly implement changes on:

```
dev
stg
main
```

This applies even when the requested change is very small.

Create a task branch first.

Example:

```
dev
 └── fix/editor-cursor
```

The task branch is where implementation, testing, and code changes should happen.

---

## Promotion Rules

Code should move through environments in this direction:

```
task branch
    ↓
dev
    ↓
stg
    ↓
main
```

Do not skip environments for normal releases.

Do not manually recreate the same change separately on `dev`, `stg`, and `main`.

Git should promote the same tested commits.

Normal promotion:

```
feature/fix branch
        ↓
       dev
        ↓
       stg
        ↓
      main
```

Promotion between permanent branches should be deliberate and should normally happen through a pull request.

---

## Dev Rules

`dev` represents completed work that is ready for integration testing.

A task should not be merged into `dev` if it is knowingly incomplete or broken.

Before considering work ready for `dev`:

- implementation should be complete for the requested scope
- relevant tests should pass
- build should pass
- obvious regressions should be checked
- temporary debug code should be removed
- unfinished UI should not be exposed unless intentionally feature-flagged

Do not use `dev` as a storage branch for unfinished work.

Keep unfinished work on its task branch.

---

## Staging Rules

`stg` represents the next release candidate.

Once a release candidate is being tested on staging:

- avoid adding unrelated new features
- prioritize regression fixes
- keep the release scope stable
- do not make experimental changes directly on `stg`

Normal promotion:

```
dev → stg
```

should only happen when the selected development work is considered ready for final testing.

---

## Fixes Found In Staging

If a bug is discovered while testing `stg`, do not edit `stg` directly.

Create a fix branch from the staging state when the fix is specifically for that release.

Example:

```
stg
 └── fix/table-column-drag
```

After the fix is verified, ensure the fix reaches both:

```
stg
dev
```

The fix must not exist only on staging, otherwise a later release from `dev` may reintroduce the bug.

---

## Production Rules

`main` represents the exact code running in production.

Treat `main` as protected.

Do not:

- develop directly on `main`
- commit directly to `main`
- force-push to `main`
- reset `main`
- rebase shared `main`
- make a "small last-minute fix" directly on `main`

Normal production promotion is:

```
stg → main
```

The code promoted to production should be the same release candidate that was tested on staging.

---

## Production Hotfixes

Urgent production bugs are the exception to the normal `dev → stg → main` flow.

For a critical production issue:

```
main
 └── hotfix/<name>
```

Example:

```
hotfix/google-login
```

The hotfix should:

1. Start from the latest production `main`.
2. Make only the minimum required change.
3. Be tested before production promotion.
4. Be merged back into `main`.
5. Also be propagated to `stg` and `dev`.

Required synchronization:

```
hotfix
   ├──→ main
   ├──→ stg
   └──→ dev
```

Do not allow the hotfix to exist only on `main`.

---

## Working Tree Safety

Before modifying files:

- inspect the current branch
- inspect `git status`
- identify existing modified/untracked files
- preserve unrelated user work

Do not:

- overwrite user changes
- revert user changes
- delete user changes
- discard untracked files
- run destructive cleanup commands without explicit permission

If unrelated files are already modified, leave them unchanged.

Keep edits scoped to the requested task.

Avoid broad formatting or unrelated refactors.

---

## Git Safety

Avoid destructive Git operations unless explicitly requested.

Do not automatically run commands such as:

```bash
git reset --hard
git clean -fd
git checkout -- .
git restore .
git push --force
git push --force-with-lease
```

Do not rewrite shared branch history.

Prefer safe, reversible operations.

If branch history is unexpectedly different from the remote, inspect and report the situation before attempting to repair it.

---

## Sync Before Starting Work

For normal tasks, compare the local state with `origin/dev`.

Preferred flow:

```bash
git fetch origin
```

Then verify that the task branch is based on the appropriate current remote state.

If local `dev` is behind and can be updated safely:

```bash
git switch dev
git pull --ff-only origin dev
```

If local changes prevent a safe update, do not stash, discard, rebase, or overwrite them automatically.

Report the issue.

---

## Existing Task Branches

Before creating a new branch:

- check whether an appropriate branch already exists
- do not create duplicate branches unnecessarily
- do not switch away from a branch containing unresolved user work without protecting it

If the user is already working on a task branch relevant to the requested task, continue there unless doing so would be unsafe.

---

## Merging

Do not automatically merge a completed task into:

```
dev
stg
main
```

unless the user explicitly asks for the merge.

It is acceptable to prepare the branch so it is ready to merge.

The final response should clearly state:

```
Ready to merge into dev
```

when appropriate.

Promotion to `stg` or `main` should be treated as a release decision.

---

## Pull Request Preparation

For every task branch intended to be merged into `dev`, prepare a concise Pull Request description before finishing.

The PR description should include:

- **Summary** — what was changed and why.
- **Changes** — the main implementation details.
- **Testing** — checks and manual testing performed.
- **Risk / Impact** — areas that could be affected.
- **Screenshots / UI Notes** — include when the change is visual or interaction-related.
- **Environment / Config Changes** — mention any new environment variables, OAuth changes, migrations, or setup requirements.
- **Known Issues** — anything intentionally left unresolved.

Use this structure:

```markdown
## Summary

Briefly explain the purpose of this change.

## Changes

- Change one
- Change two
- Change three

## Testing

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test -- --run`
- [x] `npm run build`

Manual testing:
- Tested relevant desktop behavior
- Tested relevant mobile behavior

## Risk / Impact

Describe affected areas and any regression risk.

## Screenshots / UI Notes

Add screenshots or interaction notes if applicable.

## Environment / Config Changes

None.

## Known Issues

None.
```

Do not claim a check was completed unless it was actually run.

If the task is documentation-only or very small, keep the PR description proportionate to the change.

When finishing a task, include the prepared PR title and PR description in the final response.

Recommended PR titles should follow a concise format such as:

```
feat: add table row selection
fix: preserve editor cursor on empty-space click
refactor: simplify editor block controls
docs: add infrastructure setup guide
```

Do not automatically open or merge the Pull Request unless explicitly asked. Prepare it so the user can review and create the PR safely.

---

## Conflict Handling

Do not blindly resolve merge conflicts.

When conflicts occur:

1. Understand both versions.
2. Preserve intentional behavior from both sides when possible.
3. Avoid choosing one side purely to make Git continue.
4. Run relevant tests after resolution.

If a conflict involves unfamiliar or potentially important user work, report it rather than guessing.

---

## Project Stack

Follow the existing project architecture and conventions.

Current stack includes:

- React
- TypeScript
- Vite
- Tailwind CSS

Prefer existing:

- components
- utilities
- hooks
- services
- types
- styling patterns
- state-management patterns
- test helpers

before introducing new abstractions.

---

## Scope Discipline

Keep implementation focused on the requested task.

Do not automatically:

- redesign adjacent functionality
- refactor unrelated code
- rename unrelated files
- introduce architecture changes
- change UX outside the requested behavior
- add speculative features

If a broader change is required to safely implement the task, keep it minimal and explain why.

---

## MVP Discipline

Writin is still being developed toward a stable product release.

Prefer:

- simple architecture
- maintainable code
- reliable behavior
- good UX
- low regression risk

Avoid unnecessary complexity.

Do not introduce advanced infrastructure, abstractions, or product functionality merely because it may be useful later.

Build for the current requirement while avoiding choices that unnecessarily block future evolution.

---

## Dependencies

Do not add dependencies unless they are clearly justified.

Before adding a package:

1. Check whether the project already provides the required capability.
2. Prefer existing utilities and browser APIs when reasonable.
3. Consider bundle size and maintenance cost.
4. Avoid packages for trivial functionality.

If a dependency is added, explain:

- what it provides
- why existing code is insufficient
- where it is used

---

## Environment Separation

The application uses separate environments:

```
Local
Dev
Staging
Production
```

Environment-specific values must not be hardcoded.

Use environment variables for values such as:

- application URLs
- OAuth configuration
- API endpoints
- feature flags
- environment identifiers
- service configuration

Do not assume development values are safe for production.

---

## Environment URLs

Expected environments:

```
Local:
localhost

Development:
https://dev.writin.app

Staging:
https://staging.writin.app

Production:
https://writin.app
```

Do not change these assumptions without an explicit infrastructure task.

---

## Secrets

Never commit:

- passwords
- API keys
- access tokens
- refresh tokens
- OAuth client secrets
- private keys
- service-account credentials
- production secrets
- personal credentials

Do not expose secrets in:

- source files
- test fixtures
- logs
- screenshots
- documentation
- commits

Use appropriate environment configuration.

---

## Environment Files

Local environment files should remain ignored by Git where appropriate.

Examples:

```
.env
.env.local
.env.*.local
```

Do not remove environment files from `.gitignore` unless explicitly required.

If a new environment variable is required:

- add it to the appropriate example/documentation file
- document its purpose
- do not provide a real secret value

Example:

```
VITE_APP_ENV=
VITE_GOOGLE_CLIENT_ID=
```

---

## Google And Drive Safety

Google authentication and Google Drive are critical Writin functionality.

Changes involving:

- OAuth
- authentication
- Drive permissions
- Drive file IDs
- Drive folders
- sync
- backup
- document persistence

must be treated as high-risk.

Preserve existing working Google functionality unless the task specifically requires changing it.

When modifying these areas:

- inspect existing behavior first
- avoid unnecessary permission changes
- avoid destructive migration behavior
- maintain backward compatibility where reasonably possible
- add/update focused tests

Do not silently change the user's storage model.

---

## Data Safety

Writin handles user-created content.

Changes involving documents, folders, databases, backups, imports, exports, or synchronization must prioritize data preservation.

Never intentionally delete or overwrite stored user content as part of a migration unless that behavior is explicitly required and safely designed.

Prefer:

```
read existing data
→ transform safely
→ validate
→ write new state
```

over destructive replacement.

Consider compatibility with previously saved Writin data.

---

## Local-First Behavior

For Writin workspaces using Google Drive, preserve the local-first principle:

```
User action
    ↓
Local save/update immediately
    ↓
Background Drive synchronization
```

The user interface should not normally wait for Google Drive before reflecting a local editing action.

Google Drive is the sync/backup layer, not the editing source.

Do not change this architecture unless explicitly asked.

---

## Editor Safety

The document editor is core product functionality.

When modifying editor behavior, pay particular attention to regressions in:

- typing
- cursor position
- selection
- keyboard navigation
- slash commands
- block insertion
- block deletion
- drag and drop
- copy/duplicate
- mobile behavior
- touch interaction
- scrolling
- undo/redo
- persistence

A fix for one block type should not unnecessarily change behavior for other block types.

---

## Accessibility

Changes to interactive UI should preserve or improve accessibility.

Check where applicable:

- keyboard navigation
- focus visibility
- logical tab order
- accessible names
- semantic controls
- Escape behavior
- Enter/Space activation
- screen-reader-compatible labels
- touch target size

Do not remove accessibility behavior merely to simplify implementation.

---

## Responsive Behavior

Writin is used across:

- desktop
- laptop
- tablet
- mobile
- PWA

Changes to shared UI should consider different viewport sizes.

Do not assume desktop-only behavior unless the feature is intentionally desktop-specific.

Pay particular attention to:

- mobile editor behavior
- touch interaction
- scrolling
- menus/popovers
- viewport overflow
- fixed/sticky UI
- virtual keyboard interaction

---

## Tests

Add or update tests when behavior changes.

Tests should:

- cover the changed behavior
- cover meaningful regressions
- remain focused
- avoid unnecessary implementation coupling

Do not remove or weaken a test merely to make CI pass.

If an existing test is genuinely obsolete because expected behavior changed, update it to represent the new intended behavior.

---

## Required Checks

Before saying normal code work is complete, run the checks relevant to the change.

Preferred baseline:

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

For production-related validation:

```bash
npm run build:production
```

If the repository's scripts change, use the actual current project scripts rather than assuming these commands exist.

---

## Targeted Checks

For small changes, targeted tests may be run during development.

Example:

```bash
npm test -- --run path/to/relevant.test.ts
```

However, before declaring a meaningful code change complete, run the broader checks appropriate to its regression risk.

High-risk areas such as:

- authentication
- persistence
- sync
- editor core
- routing
- build configuration

should receive broader validation.

---

## Build Failures

If a check fails because of the current task:

- investigate
- fix it
- rerun the check

If a failure is clearly pre-existing and unrelated:

- do not modify unrelated code just to silence it
- report the exact failing command
- explain why it appears unrelated

Do not claim that all checks passed when they did not.

---

## Warnings

Do not ignore new warnings introduced by the task when they indicate a real implementation issue.

Avoid:

- unused variables
- accidental `any`
- unreachable code
- React key warnings
- dependency-array mistakes
- hydration errors
- console errors

Do not remove useful diagnostics simply to produce a clean console.

---

## Logging And Debug Code

Remove temporary debugging before finishing.

Do not leave unnecessary:

```
console.log
console.debug
debugger
temporary alerts
test-only UI
```

in production code.

Intentional production logging should follow existing project conventions.

---

## Error Handling

Do not silently swallow meaningful errors.

Prefer existing Writin error-handling patterns.

User-facing failures should be:

- understandable
- actionable where possible
- non-destructive

Avoid exposing internal implementation details or secrets in error messages.

---

## Backward Compatibility

Before changing persisted structures or serialized document formats, check whether existing user content depends on the old format.

When format changes are required:

- preserve compatibility when practical
- migrate intentionally
- add tests for existing saved data
- avoid silently breaking old documents

Examples include:

- Markdown serialization
- custom block formats
- table data
- database blocks
- document links
- local backups
- Drive backups

---

## Do Not Guess About Existing Architecture

Before implementing significant changes:

- inspect relevant files
- trace existing flows
- identify current abstractions
- understand related tests

Do not create a second implementation of behavior that already exists elsewhere.

Prefer extending existing architecture over parallel duplicate systems.

---

## Documentation

Update documentation when a change introduces:

- a new environment variable
- a new setup step
- an important architectural behavior
- a new developer workflow
- a migration requirement

Do not add documentation for trivial internal implementation details.

---

## Production Readiness

A change is not production-ready merely because it builds.

For user-facing changes, consider:

- happy path
- loading state
- empty state
- error state
- existing data
- mobile behavior
- keyboard behavior
- persistence
- refresh/reload
- regression risk

Only test areas relevant to the task; do not artificially expand every small change into a full product QA exercise.

---

## Releases

Production releases should follow:

```
task branches
    ↓
dev
    ↓
stg
    ↓
main
```

Once a staging release candidate is approved, avoid modifying it except for release-blocking fixes.

Do not introduce new feature work while the same staging candidate is undergoing final QA.

---

## Release Tags

Production releases should use Git tags when the release process supports them.

Examples:

```
v0.1.0
v0.1.1
v0.2.0
```

Tags should point to the production commit that was actually released.

Do not move or rewrite existing release tags.

---

## Rollback Safety

Do not solve production incidents by deleting history or force-pushing branches.

Prefer:

- reverting a problematic commit
- deploying a known-good Vercel deployment
- applying a focused hotfix

Preserve history so the cause and recovery remain traceable.

---

## Final Response

When finishing implementation work, provide:

### Summary

Briefly explain what changed.

### Branch

State the branch used.

Example:

```
fix/editor-cursor
```

### Checks

List checks actually run.

Example:

```
✓ npm run lint
✓ npm run typecheck
✓ npm test -- --run
✓ npm run build
```

Do not list checks that were not run.

### Risks / Follow-up

Mention:

- known risks
- skipped checks
- unresolved issues
- required environment changes
- migrations
- manual testing that is still recommended

If there are none, say so briefly.

### Merge Readiness

State the appropriate next step.

Examples:

```
Ready to merge into dev.
```

or:

```
Not ready to merge: staging OAuth configuration is still required.
```

Do not claim the task is production-ready unless it has actually completed the required promotion and validation process.
