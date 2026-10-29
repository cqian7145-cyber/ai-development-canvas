# Roadmap

## Phase 0 — Workspace foundation

- Two interactive views: design canvas and workflow canvas.
- Browser-local persistence for canvas content and viewport.
- Example workflow, responsive shell, local developer commands, and baseline documentation.
- No AI executor, account system, server database, or collaboration service.

## Phase 1 — Project definition and workflow semantics

1. Define the project record, canvas ownership, and import/export format before introducing remote storage.
2. Add editable node titles, descriptions, and typed connections with clear validation and empty states.
3. Add a versioned JSON export/import path with migration and malformed-file handling.
4. Define execution contracts and safety boundaries before connecting any AI provider; keep credentials server-side if that phase is authorized.
5. Evaluate whether multi-device sync or collaboration has enough user value to justify a backend.

## Decisions to revisit

- Resolve a valid tldraw production license before deploying a production build.
- Choose project-scoped persistence and backups before users depend on local browser storage.
- Add end-to-end browser coverage before introducing execution or external integrations.
