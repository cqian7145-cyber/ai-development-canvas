# Architecture

## Runtime shape

The App Router page provides the workspace shell. The interactive canvas packages depend on browser APIs, so each canvas is loaded through a client-side dynamic boundary with server rendering disabled. Shared layout and presentation stay in small React components; no global store is needed for this single-page Phase 0.

```text
app/
  page.tsx                 workspace route
  layout.tsx               document metadata and global styles
components/
  layout/workspace.tsx     navigation, toolbar, inspector, view switch
  canvas/design-canvas.tsx tldraw editor
  workflow/                React Flow graph and node type
lib/
  workflow-storage.ts      validated local snapshot read/write
```

## Canvas engines and license notes

- **tldraw**: uses the installed `tldraw` React SDK and its built-in editor, shape tools, image assets, undo/redo, and IndexedDB persistence via `persistenceKey`. The package is distributed under the tldraw license. Its default terms allow development use; production requires an active trial, hobby, or commercial license key. Do not ship a production deployment without resolving that license requirement.
- **React Flow**: uses `@xyflow/react` for node movement, connections, keyboard deletion, zoom, pan, minimap, and controls. React Flow is MIT licensed.
- **Next.js**: App Router and strict TypeScript. Browser-dependent canvas components are client-only to avoid evaluating `window`, IndexedDB, or DOM assumptions during server rendering.
- **Tailwind CSS**: utility framework is installed; the first screen uses a small set of explicit workspace styles so the canvas layout and vendor canvas styles remain predictable.
- **lucide-react**: MIT icon package for consistent line icons.

Check the package lock and upstream license pages when upgrading. Current authoritative license links: [tldraw](https://tldraw.dev/community/license), [React Flow](https://github.com/xyflow/xyflow/blob/main/packages/react/LICENSE), [Next.js](https://github.com/vercel/next.js/blob/canary/license.md).

## Data and persistence

The design canvas uses a stable `persistenceKey`; tldraw manages the document and uploaded assets in IndexedDB. The workflow stores `nodes`, `edges`, and `viewport` under one versioned localStorage key. Writes are debounced and storage exceptions are caught so a full or unavailable store does not disable editing. The app has no backend, account, or cross-device sync.

## Workflow semantics

The five starter nodes are illustrative planning steps. Nodes can be moved, connected, added, and deleted. Their appearance describes a workflow only; there is no model invocation, task execution, or status integration in Phase 0.
