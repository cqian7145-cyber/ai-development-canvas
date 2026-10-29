# AI Development Canvas

AI Development Canvas is a local-first workspace with a design board and a typed workflow canvas. Phase 1 adds project separation, editable planning nodes, and project JSON import/export.

## Requirements

- Node.js 20.9 or newer
- npm
- A modern browser with IndexedDB and local storage enabled

## Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

`npm test` uses Node's built-in test runner and the existing TypeScript compiler; it adds no dependency. Run it with Node 20.14 or newer because tldraw leaves a MessagePort open in Node and the test runner uses `--test-force-exit`. The app itself retains the Next.js minimum of Node 20.9. Browser acceptance is performed with Playwright MCP when available; see [docs/ADC_001_ACCEPTANCE.md](docs/ADC_001_ACCEPTANCE.md) for the latest evidence and the distinction between automated code tests and browser checks.

## Stack

- Next.js App Router 16.4.3, React 19.3.1, TypeScript strict mode
- Tailwind CSS 4.3.3 and lucide-react 1.64.0
- tldraw 5.6.0 for the design canvas
- `@xyflow/react` 12.12.0 (React Flow) for the workflow canvas

The interactive workspace is a client component. Both canvas engines are dynamically imported with server rendering disabled because they depend on browser APIs. tldraw persists each design document in IndexedDB through its built-in `persistenceKey`; project metadata and workflow records use browser local storage. Imported tldraw data is staged in IndexedDB before activation.

## Projects and portable files

Projects are stored in the active browser profile. Every project owns a separate design document ID and workflow document ID. Use the project selector to switch projects, **New project** to create one, and **Export** / **Import** to move a project as a JSON file. Imports are validated and added as new projects. The format and limits are documented in [docs/DATA_FORMAT.md](docs/DATA_FORMAT.md).

## Known limitations

- There is no account, cloud database, cross-device sync, collaboration, or AI executor. Workflow nodes are planning data only.
- Browser local storage and IndexedDB can be cleared by the user, browser policy, or storage pressure. Keep project JSON exports as backups.
- Project JSON files are limited to 25 MiB; each embedded media asset is limited to 10 MiB and the total media payload to 18 MiB. Remote assets that cannot be fetched and embedded are rejected at export.
- Import accepts project schema version 1. Unknown or newer versions are rejected without changing existing projects. Phase 0 local data is migrated separately on first load.
- tldraw 5.6.0 is distributed under the tldraw license, not MIT. Its default terms permit development use; production requires a valid trial, hobby, or commercial license key. Hobby use is non-commercial and retains the watermark. See [tldraw licensing](https://tldraw.dev/community/license). React Flow is MIT licensed.
- The canvas editing experience is designed primarily for desktop. Mobile layouts keep project switching, import/export, and inspection controls available, while the canvases have limited viewport space.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATA_FORMAT.md](docs/DATA_FORMAT.md), and [docs/ROADMAP.md](docs/ROADMAP.md).
