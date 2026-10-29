# ADC-001A Quality Gate

Date: 2026-10-29
Workspace: `D:\Dai-development-canvas`
Branch: `feat/adc-001-project-workspace`

## Result summary

- **PASS** — project and workflow data contracts, migration, import validation, workflow connection rules, and storage error handling pass the repeatable Node suite.
- **PASS** — Playwright MCP browser checks confirm that an invalid backward connection is rejected with visible feedback, storage failures are visible, and the degraded catalog path leaves the canvas available.
- **PASS** — 1440px and 390px workspace layout checks show the sidebar and main workspace in the expected grid columns with no horizontal document overflow.
- **PASS** — typecheck, lint, production build, and all six automated tests pass.
- **NOT VERIFIED** — there is no checked-in Playwright browser runner; browser acceptance was performed in the available Playwright MCP session. `npm test` provides repeatable contract, storage, migration, import/export, and connection-rule coverage, while tldraw IndexedDB refresh was confirmed in browser.
- **NOT VERIFIED** — a single browser automation run combining project creation, two-project switching, JSON download/upload, and reload is not part of the checked-in test suite.
- **FAIL** — none in the final quality gate.

## Repeatable automated tests

Command: `npm test`
Runner: Node built-in `node:test`, with the installed TypeScript compiler used to load the project TypeScript modules. The suite uses a fixed synthetic project fixture at `tests/fixtures/project-v1.json`; no package dependency was added.

Final result: **6 passed, 0 failed**.

Coverage:

1. Two projects keep workflow documents isolated; workflow nodes, edges, viewport, and last-opened project restore from storage.
2. Phase 0 workflow data migrates to typed nodes while its original local key remains intact.
3. Catalog quota errors surface as a typed storage error.
4. Workflow connection rules reject backward, self, missing-node, and duplicate links, while allowing a forward link.
5. Project JSON import/export round-trips through the installed tldraw parser, remaps project/node/edge IDs, preserves references, and validates embedded media.
6. Invalid JSON, a future project version, broken edge references, and browser-only blob assets are rejected without changing the storage fixture.

The suite uses `node --test --test-force-exit` because tldraw leaves a `MessagePort` active in Node after document parsing. That CLI option is available in Node 20.14+; the app runtime requirement remains Node 20.9+.

## Playwright MCP browser evidence

### Invalid React Flow connection — PASS

The browser loaded `http://127.0.0.1:3001/`. A Playwright pointer sequence used the accessible node groups and stable handle test IDs to drag from the **UI 设计** output handle back to **需求分析**. The rejection message appeared: “连接被拒绝：请勿自连接或重复连线，并按流程阶段从前向后连接。” The graph remained at four edges. This is a real browser interaction, separate from the pure connection-validator unit test.

### Storage failure handling — PASS

- With catalog `localStorage.setItem` simulated to throw `QuotaExceededError`, creating a project showed “项目目录保存失败。浏览器存储可能已满或不可用。” The dialog stayed open and the project was not reported as saved.
- With catalog reads simulated to throw `SecurityError` at page startup, the app displayed **Temporary session** and the warning that the canvas remains interactive while project-list changes will not persist. The original catalog was not overwritten.

### Project import/export and restoration — PASS (browser session evidence)

The browser downloaded a real project JSON package (8,925 bytes, schema version 1, six workflow nodes, four edges, and one embedded image). The file chooser imported it as a new project. After a page reload, the imported project remained selected, all six workflow nodes were present, and the tldraw image content remained visible. The unit suite separately repeats package import/export validation and local workflow restoration.

### Responsive layout and console — PASS with one known library warning

At 1440px, the measured grid columns were approximately `224px 1217px`, with document width equal to the viewport. At 390px, columns were approximately `54px 336px`, again with no horizontal overflow. The skip link is positioned outside grid flow, preventing it from consuming the second grid cell and collapsing the main workspace.

The latest storage-failure browser run reported zero console errors and zero warnings. An earlier image-upload run emitted tldraw's non-blocking `Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true` warning from the tldraw bundle. No app-owned console error was observed; the warning is retained as a known library-level item rather than suppressed.

## Commands and final outcomes

| Command | Result |
| --- | --- |
| `npm test` | PASS — 6/6 |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS — Next.js production build |

## Git evidence

The quality gate began on `feat/adc-001-project-workspace`, with a clean working tree and the two ADC-001 commits at HEAD. The branch base remained `origin/main` at `b757200b3a6bdad505d94502474ee8c99099e969`. ADC-001A changes are committed locally on the same branch; the final SHA is recorded in the task report. No push, PR, merge, or deployment was performed.

## Remaining limits

- Browser interaction evidence depends on the configured Playwright MCP session; no separate browser binary or test framework was installed.
- Full browser project import/export/reload is evidenced in this session, while `npm test` focuses on repeatable storage/data contracts and import/export validation.
- Browser local storage and IndexedDB remain scoped to the current browser profile and are not transactionally coupled.
