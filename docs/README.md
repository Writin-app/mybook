# Writin feature and module specifications

Each guide documents the module's behavior, data flow, implementation files, verification and remaining work. Existing guides are updated in place; separate guides cover modules that previously had no dedicated specification.

| Module | Specification |
| --- | --- |
| Files, folders, search, favorites and Trash | [Files and folders](./files-and-folders.md) |
| Rich text, autosave and responsive editor controls | [Document editor](./document-editor.md) |
| Advanced blocks, media, document links, database blocks and portable syntax | [Advanced editor and Markdown format](./advanced-editor-and-format-spec.md) |
| Bookmark previews and website mentions | [Bookmark previews](./bookmark-previews.md) |
| Workbook editing and Excel conversion | [Spreadsheet editor](./spreadsheet-editor.md) |
| Account-free onboarding, device folders, private storage and discovery | [Local vaults](./local-vaults.md) |
| JSON recovery, Markdown/DOCX/XLSX and ZIP downloads | [Backup, import and export](./backup-and-export.md) |
| Google sign-in, sessions, tokens and reconnect | [Authentication and Drive tokens](./auth-and-drive-tokens.md) |
| Design token sources and regeneration | [Design tokens](./design-tokens.md) |
| Cloud bootstrap, queues, imports and conflicts | [Google Drive synchronization](./google-drive-sync.md) |
| Local/base/remote versions, reconciler and conflicts; groundwork for collaboration | [Collaboration-ready sync](./collaboration-ready-sync.md) |
| Navigation, theme, diagnostics, branding, install and offline behavior | [App settings and PWA](./app-settings-and-pwa.md) |

## Setup and deployment

- [GitHub overview and local setup](../README.md)
- [Google OAuth setup](../GOOGLE_OAUTH_SETUP.md)
- [Production deployment](../PRODUCTION_DEPLOYMENT.md)
- [Node authentication server](../server/README.md)
- [Contributor instructions](../AGENTS.md)

## Additional requirements

[New syncing implementation](./new-syncing-implementation.md) retains the original workspace issue and proposed requirements. Current storage/sync behavior is documented in the dedicated module guides above; proposed behavior is not automatically implemented behavior.
