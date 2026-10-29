# Architecture

## Runtime shape

The App Router page is a server component that renders the client-only workspace shell. Canvas libraries are dynamically imported with `ssr: false`; their editors remain mounted while switching views so project switching and project export can address both documents. Each canvas is keyed to its project and document ID.

```text
app/
  page.tsx
  layout.tsx
components/
  layout/workspace.tsx       project selection, actions, inspector, canvas views
  canvas/design-canvas.tsx   tldraw editor and imported snapshot recovery
  workflow/                  React Flow graph and typed planning node
lib/
  project-model.ts           project and workflow contracts
  project-storage.ts         catalog, migration and pending design snapshots
  project-format.ts          import validation and project file contracts
  workflow-storage.ts        project-scoped workflow local storage
docs/
  ARCHITECTURE.md
  DATA_FORMAT.md
  ROADMAP.md
```

## Project ownership and storage

The versioned project catalog in local storage contains project metadata, a schema version, and the last opened project ID. Each record names an independent tldraw persistence key and workflow document key. The workflow document saves its nodes, edges, and viewport synchronously to a namespaced local storage key. Storage exceptions are surfaced in the workspace. If the catalog itself cannot be read, an ephemeral project keeps both canvases interactive while warning that project-list changes cannot persist; the raw catalog is left untouched.

tldraw owns design document persistence in IndexedDB. The first Phase 1 project reuses the Phase 0 tldraw key so existing shapes and uploaded assets stay available. The Phase 0 workflow snapshot is copied to a project-scoped key with an explicit node-type migration; the old key is retained as a recoverable backup. An unreadable project catalog is never replaced: the app opens an ephemeral session with a visible warning so canvas interaction can continue without overwriting the catalog.

Project import first validates the complete JSON package. It stores the tldraw snapshot as a pending IndexedDB record, writes the workflow under a new document ID, then adds a fresh project record to the catalog. The canvas applies that snapshot after tldraw loads and retains the recovery seed until a later mount confirms the imported page records are present in tldraw's local document. Node and edge IDs are regenerated on import; project and document IDs are always new. Existing project documents are never targeted by an import.

## Workflow contract

The node types are `requirement`, `design`, `implementation`, `verification`, and `approval`. Each node contains a stable ID, title, description, and JSON object configuration. Connections reject self-links, duplicate endpoint/handle combinations, missing node references, and links that move backward or sideways in the stage order. React Flow's `addEdge` also guards duplicate edges. The graph is a planning aid only: no executor, model calls, execution state, or credentials are present.

## Canvas and package APIs

- tldraw 5.6.0 `persistenceKey` uses the built-in local IndexedDB store. Official `serializeTldrawJson` creates a portable tldraw document file; it resolves local IndexedDB-backed media to data URLs. This application additionally attempts to fetch remote media and embeds it; export fails if it cannot make a media asset portable. `parseTldrawJsonFile` validates the tldraw schema and supported document format before a project is created.
- React Flow `@xyflow/react` 12.12.0 is used as a controlled graph with explicit project-scoped persistence. Its node and edge records and viewport are part of the project JSON.
- Next.js 16.4.3 App Router, React 19.3.1, TypeScript strict mode, Tailwind CSS 4.3.3, and lucide-react 1.64.0 are the installed versions at this phase.

## License and rendering constraints

tldraw is distributed under the tldraw license. Its default terms allow development only; production needs a valid trial, hobby, or commercial license key. A hobby license is for non-commercial use and requires the tldraw watermark. React Flow is MIT licensed. Next.js client components can still be server-rendered, so browser APIs stay inside effects or components loaded through the existing `next/dynamic` client-only boundary. The checked-in Next.js guide in `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` describes this distinction.

## Boundaries

All project data stays in the browser profile. There is no authentication, hosted database, external AI API, multi-device sync, or collaboration service. Browser storage is best-effort and users should keep exported backups for important projects.
