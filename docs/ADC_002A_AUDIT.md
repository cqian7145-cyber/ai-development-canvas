# ADC-002A Audit Record

**Date:** 2026-10-29 (Asia/Shanghai)
**Scope:** Baseline audit, current Codex CLI capability check, official-document research, and execution/security contract design. No executor implementation.

## Baseline and repository

| Check | Result | Evidence |
| --- | --- | --- |
| Actual checkout root | **PASS** | `git rev-parse --show-toplevel` → `D:/Dai-development-canvas`. This resolves the prior `D:\ai-development-canvas` vs `D:\Dai-development-canvas` mismatch. No second checkout created. |
| Main contains Phase 1 | **PASS** | After `git fetch origin main`, `origin/main` is `b674ff8835521e00bc20e4c34e40d3a5857688f0`, merge commit `Merge pull request #1 from cqian7145-cyber/feat/adc-001-project-workspace`. `git cat-file -e origin/main:docs/ADC_001_ACCEPTANCE.md`, `docs/DATA_FORMAT.md`, and `lib/project-model.ts` succeeded. |
| Starting status | **PASS** | Before branch creation, `git status --short --branch` reported only `feat/adc-001-project-workspace...origin/feat/adc-001-project-workspace`; no dirty paths. |
| Feature branch base | **PASS** | `feat/adc-002a-execution-contract` was created from `origin/main` at `b674ff8835521e00bc20e4c34e40d3a5857688f0`. |
| Required project instructions/docs | **PASS** | `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, and `docs/DATA_FORMAT.md` were read. Existing repo guidance was consistent with the user-provided boundaries. |
| Existing model and storage | **PASS** | `lib/project-model.ts`, `lib/project-storage.ts`, `lib/workflow-storage.ts`, `components/layout/workspace.tsx`, `components/workflow/workflow-canvas.tsx`, and `package.json` were inspected. Projects/workflows are local browser data; tldraw design snapshots use IndexedDB and workflow data uses localStorage. Existing node shape is title/description/nodeType/config. There is no executor, run lifecycle, server route, or Codex integration. |
| UI skills / Playwright tool availability | **PASS (availability only)** | Skill catalog includes `frontend-ui-engineering`, `vercel-react-best-practices`, and `web-design-guidelines`; Playwright MCP tool definitions are available. This phase makes no UI changes, so no UI skill workflow or browser test was needed. No claim of browser validation is made. |

## Installed Codex CLI

| Check | Result | Evidence |
| --- | --- | --- |
| Platform | **PASS** | Windows 11 Home China, 25H2, build `26200.9168`, x64. |
| Executable/version | **PASS** | `codex` resolves to `C:\Users\29644\AppData\Roaming\npm\codex.ps1`; `codex --version` → `codex-cli 0.145.0`. |
| Login state | **PASS** | `codex login status` → “Logged in using ChatGPT.” No credential or auth-file contents were read. |
| Available commands | **PASS** | `codex --help` listed `exec`, `app-server`, `sandbox`, and `debug`; installed `codex app-server --help` exposed stdio default plus WebSocket options. No App Server protocol session was started. |
| `exec` flags | **PASS (parser support)** | `codex exec --help` lists `--sandbox read-only`, `--json`, `--cd`, `--ephemeral`, and `--strict-config`. The same help did not list `--ask-for-approval`. Parser availability does not establish sandbox enforcement. |
| Strict config smoke run | **NOT VERIFIED** | A read-only JSON smoke command in `tests/fixtures` with `--strict-config` was rejected by a user-wide configuration parse error at `C:\Users\29644\.codex\config.toml:205:1`, unknown field `mcp_servers.context7.type`. The global file was not read or changed. |
| Model compatibility smoke | **NOT VERIFIED** | Without strict config, inherited default `gpt-6-luna` produced JSONL `error` and `turn.failed` with `model_not_found`. Explicit `gpt-5.5` also failed as unsupported for the current ChatGPT login, exit code `1`. No auth workaround was attempted. |
| JSONL event/exit smoke | **PARTIAL PASS** | Explicit `gpt-5.6-sol`, with the same fixture, `--sandbox read-only --json --cd ... --ephemeral`, emitted parseable `thread.started`, `turn.started`, `item.completed`, and `turn.completed`; process exit was `0`. The run attempted a configured `playwright.browser_navigate` MCP tool call to a local file URL, which was cancelled/rejected; the model then stated it could not inspect the fixture and still emitted `turn.completed`. No file was written. This is evidence that exit code `0` alone is not task success. It is not evidence that read-only sandbox enforcement works or that a useful task completed. |
| Windows sandbox capability | **NOT VERIFIED** | Current official Windows documentation describes MXC compatibility for a later 25H2 UBR and CLI support in a newer CLI version than this machine’s `0.145.0`; machine build is `26200.9168`. Active backend and write-denial behavior were not probed. Do not assume MXC or OS isolation is active. |
| App Server lifecycle / approvals | **NOT VERIFIED** | CLI help and current official docs reviewed, but no App Server child was launched and no approval, interrupt, reconnect, or restart flow was tested. |

The audit did not modify global Codex configuration, install dependencies, access credential contents, or run an executor against a user repository. The only smoke-test working directory was the authorized repository fixture directory. The CLI surfaced a configured Playwright MCP capability, which is a reason a future service must explicitly curate/disable MCP access rather than inherit a user configuration blindly.

## Official-source review

Documentation checked on 2026-10-29:

- [Codex CLI reference](https://learn.chatgpt.com/docs/cli/reference)
- [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
- [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)
- [Codex App Server](https://learn.chatgpt.com/docs/app-server)
- [Codex Windows sandbox](https://learn.chatgpt.com/docs/windows/windows-sandbox)
- [Codex approvals and security](https://learn.chatgpt.com/docs/agent-approvals-security)
- [Codex permissions](https://learn.chatgpt.com/docs/permissions)
- [Windows Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)
- [Windows reparse points](https://learn.microsoft.com/en-us/windows/win32/fileio/reparse-points-and-file-operations)
- [Windows hard links and junctions](https://learn.microsoft.com/en-us/windows/win32/fileio/hard-links-and-junctions)

Current docs describe `codex exec` as the stable non-interactive path with JSONL events; App Server as an experimental JSON-RPC protocol over newline-delimited stdio, with streamed turn events, approval requests, and interrupts; and the TypeScript SDK as a server-side option. App Server offers operations that run outside the Codex sandbox (including process/shell helpers); these must not be exposed. App Server new threads are persistent by default, so persistence/deletion requires explicit product design. Windows paths can contain reparse points/junctions; process-tree cleanup should use OS job containment where supported.

## Findings

1. **Current data model has no execution contract.** Existing workflow nodes are planning-only. No workflow node is currently executed and no AI executor is connected.
2. **Recommended architecture:** separate local Node service (B) hosting official App Server over stdio (C), with a narrow same-origin Next.js facade. This separates service/process lifetime from the UI and supports streaming/approval/interrupt semantics; App Server's experimental/versioned status and persistent transcript behavior are material constraints.
3. **Read-only must be fixed in the service.** Frontend configuration cannot select executable, cwd, shell, sandbox, approval policy, or protocol method. A completed turn is not accepted code.
4. **Windows path/process security is a first-class requirement.** Opaque repository IDs, canonical true-path checks, reparse-point defense, TOCTOU controls, and Job Object cleanup are required. Sandbox behavior on this exact CLI/OS was not verified.
5. **MCP configuration is a capability boundary.** The smoke run surfaced a Playwright MCP call. Future service configuration must be controlled and cannot silently inherit arbitrary tools.

## ADC-002B proposed work breakdown

1. Add versioned domain contracts and pure transition/idempotency tests.
2. Add repository allowlisting and Windows canonical/reparse path validation with adversarial tests.
3. Implement a loopback-only Node service with capability, origin/CSRF, request-size, rate, and concurrency checks.
4. Pin CLI and generate matching App Server types; implement only the allowlisted stdio protocol surface and disable/curate MCPs.
5. Implement fixed read-only profile, per-operation approvals, cancellation/timeouts, Job Object process cleanup, event redaction/limits, retention and restart reconciliation.
6. Add same-origin Next facade and planning/approval/run/result UI; keep completion distinct from acceptance.
7. Validate with disposable test repositories, malicious request/path fixtures, simulated failures/restarts, and browser security tests before enabling any user-selected repository.

## Audit status

- **PASS:** ADC-001/001A main baseline identified, current code/storage architecture inspected, required project docs read, current CLI version/login/help/option availability recorded, JSONL and non-zero-error handling observed, design/security contracts documented, and no execution feature implemented.
- **FAIL:** None of the audited Phase 0/1 application checks failed in this documentation-only task. This does not mean an executor exists or passed tests.
- **NOT VERIFIED:** successful end-to-end Codex task against the test fixture; active OS sandbox backend/write denial; App Server protocol session; approval/cancel/reconnect/restart flows; child-tree cleanup; path reparse/junction defenses; service/browser boundary; and execution security tests. The CLI smoke attempt that got `turn.completed` did not accomplish its requested inspection.
