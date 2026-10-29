# AI Development Canvas

Phase 0 is a local, browser-based workspace with two interactive canvases: a freeform design board and an example product workflow.

## Requirements

- Node.js 20.9 or newer
- npm

## Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Stack

- Next.js App Router and React
- TypeScript in strict mode
- Tailwind CSS 4
- tldraw for the design canvas
- `@xyflow/react` (React Flow) for the workflow canvas
- lucide-react icons

The design canvas uses tldraw's `persistenceKey`, which saves the document and image assets in browser IndexedDB. The workflow canvas saves nodes, edges, and viewport in browser localStorage. Neither canvas sends data to a server.

## Phase 0 boundaries and limitations

- Workflow steps are editable examples. No AI model or executor is connected.
- Data stays in the current browser profile and is not synced between devices.
- tldraw's default license permits development use only. A valid hobby, trial, or commercial license key is required for production use; see [tldraw licensing](https://tldraw.dev/community/license).
- Mobile layouts fit the workspace, though canvas editing is designed primarily for desktop.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/ROADMAP.md](docs/ROADMAP.md).
