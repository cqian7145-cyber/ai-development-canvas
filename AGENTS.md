# AI Development Canvas — Agent Instructions

## Scope and safety

- This repository's only authorized write boundary is this workspace.
- Never edit `D:\moonlight` or any other project while working here.
- Inspect files, Git status, and relevant instructions before changing existing work.
- Preserve user files. Do not delete, reset, clean, or overwrite unrelated work.
- Do not add paid APIs, authentication, hosted databases, or unrelated tools.
- Do not expose secrets. Keep local environment files ignored.

## Product constraints

- Phase 0 is a local, interactive dual-canvas workspace.
- Use tldraw for the design canvas and `@xyflow/react` for the workflow canvas.
- Workflow examples must never be presented as connected AI execution.
- Persist user canvas data locally and explain browser/profile limits.
- Keep dependencies and abstractions small; avoid a global state library unless a real shared-state need appears.

## Before implementation

- Confirm the repository root and current branch.
- Check `git status`, remotes, package scripts, and installed versions.
- Read the relevant official docs and licenses for library/API changes.
- Check current dependency compatibility before installation or upgrades.
- If user-specified paths conflict with the active workspace path, keep writes inside the active workspace and report the mismatch.

## UI and skills

- Use the available frontend UI skill when building or substantially changing user-facing screens.
- Use browser automation or Playwright skills when the task requires browser acceptance.
- Use design/reference skills for visual redesigns, not routine logic-only changes.
- Skills guide the work; they do not authorize scope expansion or dependency installation.
- Keep the visual system white, black, and blue unless the user changes the brief.
- Support keyboard focus, reduced motion, responsive layouts, and clear button labels.
- Do not use emoji as interface icons.

## Engineering

- Use strict TypeScript and follow existing project structure and style.
- Prefer small changes and existing libraries over custom canvas/diagram engines.
- Check browser-only APIs remain outside server rendering.
- Handle local storage failures without breaking canvas interaction.
- Keep documentation aligned with actual code and behavior.

## Verification

- Run only checks relevant to the requested work and report exact outcomes.
- For a feature task, run typecheck, lint, production build, and browser interaction checks when the environment supports them.
- Verify both canvas modes and local persistence after reload where browser automation is available.
- Check desktop and mobile widths for horizontal overflow.
- Never claim a test, browser, deployment, or external service passed unless it actually ran.
- Distinguish build evidence from real-browser or platform evidence.

## Git safety

- Do not use force push, destructive reset, or cleanup commands.
- Before committing, inspect status, ignored files, staged files, and staged diff.
- Commit only files belonging to this project and the authorized phase.
- Never stage secrets, credentials, dependencies, caches, or generated output.
- Push only when the user explicitly includes pushing in the task.
- Do not merge a pull request automatically.
- If the remote has no commit history, explain the initial baseline strategy; do not overwrite remote history.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
