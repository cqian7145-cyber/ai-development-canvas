# Roadmap

## Phase 0 — Workspace foundation

- Design and workflow canvases using tldraw and React Flow.
- Browser-local persistence and the starter planning flow.
- No AI executor, account system, server database, or collaboration service.

## Phase 1 — Project workspace and data contracts

- Versioned project metadata and isolated canvas document IDs.
- Phase 0 workflow migration with its source key retained as a backup.
- Typed planning node categories, editable properties, JSON configuration, and forward-only validated connections.
- Project JSON import/export with tldraw document validation and embedded media assets.
- New-project imports, strict size limits, and failures that preserve existing projects.

## Phase 2 — Reliability and usability

- Consider user-controlled recovery snapshots and storage quota visibility.
- Add automated browser regression coverage for project isolation and import/export when a maintained test harness is justified.
- Evaluate richer workflow edge semantics only from concrete planning use cases.

## Future decisions

- Resolve the tldraw production license before any hosted production deployment.
- Evaluate sync or collaboration only if local-only project files no longer meet user needs.
- Define explicit AI execution contracts, approval boundaries, and credential handling before adding any executor.
