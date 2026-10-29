# Project Data Format

## Schema version 1

An exported project is UTF-8 JSON with this top-level structure:

```json
{
  "format": "ai-development-canvas-project",
  "schemaVersion": 1,
  "exportedAt": "ISO-8601 timestamp",
  "project": {
    "projectId": "source project ID",
    "name": "Project name",
    "description": "Project description",
    "createdAt": "ISO-8601 timestamp",
    "updatedAt": "ISO-8601 timestamp",
    "schemaVersion": 1,
    "designDocumentId": "source document ID",
    "workflowDocumentId": "source document ID"
  },
  "workflow": {
    "nodes": [],
    "edges": [],
    "viewport": { "x": 0, "y": 0, "zoom": 0.72 }
  },
  "design": {
    "tldrawFileFormatVersion": 1,
    "schema": {},
    "records": []
  }
}
```

The `design` object uses tldraw's own JSON file shape, with its schema and document records. Image and video bytes are embedded as base64 data URLs; browser blob URLs and `asset:` IndexedDB references are not portable. A remote media asset must be fetchable by the current browser and is embedded during export, otherwise export reports an error.

## Workflow records

Each workflow node has a stable ID within the document, a React Flow position, and `data` fields `title`, `description`, `nodeType`, and `config`. Supported types are `requirement`, `design`, `implementation`, `verification`, and `approval`. `config` must be a JSON object and is limited to 16 KB per node. Edges must reference existing nodes, cannot be self-links or duplicates (including source/target handles), and may point only from an earlier to a later stage. Viewport coordinates must be finite and zoom must be positive.

## Import validation and ID policy

Before writing browser storage, import validates JSON syntax, top-level format, project schema version, workflow size and references, tldraw document records/schema, and embedded media size/type. Files over 25 MiB, a single media asset over 10 MiB, or total media over 18 MiB are rejected. Unknown and newer project schema versions are rejected with an error. No imported script or command is evaluated.

An accepted import always becomes a new project. The project and document IDs are regenerated. Workflow node IDs are regenerated and edge references remapped, avoiding collisions with existing projects. tldraw record IDs remain inside the new independent tldraw persistence document. The source metadata remains included for traceability but does not determine the destination IDs.

## Local storage and migrations

- Project catalog: local storage key `adc-project-catalog-v1`, catalog schema version 1.
- Workflow: local storage keys prefixed `adc-workflow-document-v1:`; each record stores nodes, edges, and viewport.
- Phase 0 workflow: first-load migration reads `adc-phase0-workflow-v1`, maps the former node kinds to the five typed node categories, and copies the snapshot to the initial project. The Phase 0 key is not deleted.
- Phase 0 design: the initial project's design document ID remains `adc-phase0-design-canvas`, preserving the existing tldraw IndexedDB document and assets in place.
- Import staging: pending tldraw snapshots are stored in IndexedDB database `adc-project-data-v1` until applied to the new tldraw persistence key.

The current project file version is 1; there is no earlier project-package schema to migrate. This is an explicit migration boundary: older local Phase 0 records migrate on first load, while unknown project-package versions fail without changing the project catalog. Catalog corruption or browser storage errors are reported and existing raw data is preserved.

## Reliability limits

Browser local storage and IndexedDB are scoped to one browser profile and can be cleared or evicted. Cross-store import steps use fresh generated IDs and clean up newly written data if catalog creation fails, but browser storage offers no transaction spanning local storage and IndexedDB. Keep exported project files as backups. The package size limits reduce accidental quota exhaustion but do not guarantee browser quota availability.
