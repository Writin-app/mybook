# Writin

A local-first browser workspace for documents and spreadsheets, with account-free local vaults and optional Google Drive backup and synchronization.

Read the [feature and module specifications](docs/README.md) for behavior, storage formats, implementation references and remaining work for each feature.

## Product name and compatibility

**Writin** is the app name, including its title, install name, icon and npm package. On connection, the app renames an existing MyBook Drive folder to **Writin** in place, preserving its ID and contents. A saved folder ID takes priority; a fresh browser searches both names before creating anything. Failed, incomplete or ambiguous discovery never creates a replacement. Legacy storage keys and file formats remain readable without a local-data migration. See [Drive folder migration](docs/google-drive-sync.md#folder-name-migration).

## Features present in the code

| Area | Implemented surface |
| --- | --- |
| Local vaults | Account-free onboarding; selected device folder where supported; named private vault with OPFS or IndexedDB fallback; storage persistence request |
| Library | Documents and spreadsheets; nested folders; favorites; filename search, filters and sorting; rename, duplicate, move, Trash, restore and permanent deletion |
| Document editing | Tiptap rich text; headings H1–H4; bold, italic, underline, strike and code; lists and checklists; quotes, links, tables, dividers; undo/redo and slash commands |
| Advanced blocks | Callouts, toggles, images, video, audio, attachments, bookmark previews, website mentions, embeds, document links, table of contents and database-style blocks; contextual block/table controls |
| Editor layout | Desktop menus and toolbar, page/full-width views and zoom; mobile bottom toolbar and contextual sheets |
| Spreadsheets | Univer workbook grid, formulas, sheets, toolbar and zoom; dedicated XLSX import/export |
| Local saving | IndexedDB autosave; document recovery drafts; local Markdown files and companion attachments; workspace scanning and legacy-layout discovery |
| Import and backup | DOCX and Markdown document import/export; JSON workspace backup/restore; folder and vault ZIP downloads |
| Google Drive | Browser or backend OAuth, token renewal/reconnect, `Writin` backup folder, queued file/folder operations, startup/reconnect imports, conflict handling and stored versions |
| App experience | Light/dark themes, responsive navigation, PWA/offline configuration, settings and diagnostics; Storybook and design-system page |

These are source-reviewed capabilities, not a claim that every browser, format round trip, or live cloud flow has passed acceptance testing. AI summaries, user mentions, and a references/citations workflow are not implemented features.

## Run locally

Use **Node.js 22.13+ within the 22.x line, or Node.js 24+**, and npm. The current test dependencies do not support Node 18.

```sh
npm ci
npm run dev
```

Open the address printed by Vite and choose a local vault. Google credentials are not needed for local-only use. Folder selection depends on browser capabilities; private browser storage is the fallback. Clearing website data can remove local-only content.

For Google login, copy `.env.example` to a local environment file without overwriting existing configuration, set `VITE_GOOGLE_CLIENT_ID`, and use the fixed OAuth origin:

```sh
npm run dev:oauth
```

Follow [Google OAuth setup](GOOGLE_OAUTH_SETUP.md). Browser auth uses `VITE_GOOGLE_AUTH_MODE=browser`. Server auth additionally requires the backend environment variables and a running API; Vite alone does not serve the authentication backend. Never put `GOOGLE_CLIENT_SECRET` or `AUTH_COOKIE_SECRET` in frontend `VITE_*` variables.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run lint` | ESLint checks |
| `npm run typecheck` | TypeScript project checks |
| `npm test -- --run` | Vitest suite |
| `npm run build` | TypeScript check and production bundle in `dist/` |
| `npm run build:production` | Lint, typecheck, tests, then Vite build |
| `npm run preview` | Preview the build |
| `npm run test:e2e` | Playwright browser tests; browser installation required |
| `npm run storybook` | Component explorer |

## Storage and current limitations

- Documents use Tiptap JSON internally. Local-folder documents, document downloads, and Drive document backups use `.md`. Legacy `.mybook.md` files remain supported on import. Advanced blocks use Writin-specific syntax and may render differently in other Markdown editors.
- Local media can be extracted into `<document>_attachments` folders. ZIP export packages embedded media with document paths; externally hosted media is not downloaded into the archive.
- **Spreadsheet caveat:** local-folder writes and vault ZIP exports currently put workbook text under an `.xlsx` filename. Use the spreadsheet editor's dedicated XLSX export for an actual Excel file. Importing arbitrary binary XLSX through the folder scanner is also incomplete.
- Connecting Drive queues local items for cloud backup, but continued saving into the previously selected device folder is incomplete: file persistence is gated on local workspace mode. Do not assume the proposed combined local-folder/cloud workflow is finished.
- Drive import and conflict code exists, but this is not live collaborative editing. Fresh-device recovery, concurrent edits, offline reconnection and attachment fidelity still need live acceptance testing.
- Disk-write error reporting, filename collisions, attachment rename/move safety and legacy recovery need further verification. See the [local-vault specification](docs/local-vaults.md) for recovery requirements.

## Documentation and deployment

- [Documentation index](docs/README.md)
- [Local vaults and device storage](docs/local-vaults.md)
- [Backup, import and export](docs/backup-and-export.md)
- [App settings, navigation and PWA](docs/app-settings-and-pwa.md)
- [Vault and synchronization roadmap](docs/new-syncing-implementation.md)
- [Production deployment](PRODUCTION_DEPLOYMENT.md)
- [Node authentication server](server/README.md)
- [Contributor instructions](AGENTS.md)

The repository includes Vercel API routes and SPA routing in `vercel.json`, plus cPanel configuration. Static-only hosting supports browser OAuth but needs an equivalent API for bookmark metadata; backend OAuth needs the auth server. Existing cPanel paths and domain examples must be adapted to your deployment. Run `npm run build:production` before release.

## Stack

React 19, TypeScript, Vite, Tailwind CSS, Tiptap, Univer Sheets, Dexie/IndexedDB, Zustand, Vitest and Playwright.
