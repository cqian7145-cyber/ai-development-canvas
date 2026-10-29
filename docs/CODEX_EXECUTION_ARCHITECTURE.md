# Codex Execution Architecture

**Status:** ADC-002A design only. No execution service or executor is implemented.
**Reviewed:** 2026-10-29

## Current application boundary

The application is a local-first Next.js App Router UI. `components/layout/workspace.tsx` owns project selection and browser persistence; `components/workflow/workflow-canvas.tsx` renders React Flow planning nodes. `lib/project-model.ts` and `lib/workflow-storage.ts` define local project/workflow data. There is no server execution endpoint, process manager, Codex integration, or executor status in this baseline. The workflow nodes are plans only.

The browser is an untrusted presentation client. In a future phase, node title, description, config, imported JSON, project IDs, and all browser-supplied values must be treated as untrusted input. A workflow node must never become a shell command or executable path.

## Options considered

| Option | Strengths | Costs and limits | Fit |
| --- | --- | --- | --- |
| A. Next.js route directly spawns `codex exec` | Fewest moving parts; stable one-shot JSONL interface; route can validate a request and call a fixed executable. | App/server lifecycle and hot reload are a poor home for durable jobs; cancellation, reconnect, approvals, orphan process cleanup, and run history need to be built around each process. It is suitable for a constrained one-shot prototype, not a persistent interactive run manager. | Not selected as the execution host. A narrow Next.js API facade remains useful. |
| B. Separate local Node service directly calls `codex exec` | Independent lifecycle and process ownership; straightforward one-shot read-only tasks; JSONL is suitable for an event parser. | Must implement and maintain approval, event normalization, cancellation, recovery, and process coordination itself. `codex exec` is not a browser-oriented interactive protocol. | Viable minimal first experiment; not the preferred long-lived protocol. |
| C. Official SDK or App Server | SDK simplifies server-side TypeScript use. App Server provides JSON-RPC over stdio, thread/turn lifecycle, streamed events, approval requests, and interrupt operations. Installed CLI can generate matching schemas. | App Server is experimental and version-coupled; persistent threads can retain conversation/session data. It is a privileged protocol and must not be exposed raw to the browser. The SDK is simpler for straightforward local runs but less suited to a custom approval/event UI. | Selected engine for a later, staged implementation, behind a separate local Node service and a strict protocol allowlist. |

Official references: [Codex CLI reference](https://learn.chatgpt.com/docs/cli/reference), [non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode), [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk), and [App Server](https://learn.chatgpt.com/docs/app-server). The App Server documentation describes the protocol and current limitations; re-check it and generate bindings from the installed CLI version during implementation.

## Recommended topology

```text
Browser UI (existing Next.js client)
        | same-origin request; project/node IDs and task text only
        v
Next.js API facade (CSRF/origin checks; narrow request/response schema)
        | loopback HTTP + per-process capability; no browser-visible secret
        v
Separate Node execution service (127.0.0.1 only; repo allowlist; run registry)
        | fixed executable + argv, shell:false; App Server JSON-RPC over stdio
        v
Pinned Codex CLI App Server child process
        | fixed repository, read-only permission profile, human per-action approval
        v
Pre-approved local test repository
```

The service, not the browser, resolves a repository ID to its canonical working directory. Use a per-process random capability between the Next.js facade and local service, store it in server-only memory, and never return it to the browser or persist it. Enforce exact expected `Origin`, appropriate Fetch Metadata/CSRF checks, bounded request bodies, and same-origin policy at the facade. CORS alone is not a CSRF control. The Node service binds only to `127.0.0.1`; do not create a WebSocket listener. App Server stdio is the selected transport.

App Server JSON-RPC must be mediated by a server-side allowlist. Expose only the minimum needed thread/turn start, event, approval response, and interrupt operations. Do not forward arbitrary JSON-RPC requests. In particular, do not expose `process/*`, `thread/shellCommand`, configuration mutation, arbitrary MCP/tool execution, marketplace/plugin mutation, or web/remote-control operations. Do not assume an installed MCP configuration is safe: the audit smoke run surfaced a configured Playwright tool. A future service must use an explicitly curated environment/configuration and reject unapproved tools.

## Lifecycle and data flow

1. UI submits a typed `TaskRequest` containing a stable `projectId`, `nodeId`, allowlisted `repositoryId`, user task text, and optionally an expected Git HEAD. It cannot supply `cwd`, executable, arguments, permission mode, approval policy, environment variables, or a shell command.
2. Facade validates origin, payload size, schema, and that the selected project/node exist. Service repeats validation; client validation is not a trust boundary.
3. Service maps repository ID through a static server-side allowlist, resolves and validates its true path, records the initial Git HEAD, and allocates a new `runId`.
4. Service starts a pinned CLI child with a fixed executable path and fixed argv. It starts an App Server stdio session, subscribes to supported events, and starts a turn using the approved task text and fixed read-only profile.
5. Events are normalized, assigned monotonically increasing sequence numbers, bounded, redacted, and associated with `runId`, `projectId`, `nodeId`, repository ID, thread ID, and turn ID. Approval events pause the UI state until a one-action human decision is returned.
6. A completed Codex turn becomes `completed`; it does not imply the diff was reviewed or accepted. Separate verification records tests/review as `not_run`, `passed`, or `failed`.
7. On cancel, timeout, child exit, service restart, or transport loss, perform the explicit transitions defined in [the execution contract](./EXECUTION_CONTRACT.md). Never automatically resume or duplicate a run after uncertain delivery.

## Windows 11 process and path handling

Use `child_process.spawn` with a fixed executable selected by service configuration, an argument array, and `shell: false`. Do not concatenate a shell string. Capture and cap stdout/stderr, redact secrets before logging, and bound event size/count/rate. Use a Windows Job Object with kill-on-close semantics for the service-owned child process tree where the chosen Node/native integration permits reliable configuration. On timeout or cancel, first send App Server `turn/interrupt`, wait a bounded grace interval, then terminate the owned process tree and verify child exit. Do not rely only on killing the immediate PID.

The current machine audit reported Windows 11 25H2 build `26200.9168`; installed CLI is `0.145.0`. Current official Windows sandbox documentation describes MXC compatibility at a later 25H2 UBR and CLI support in a later CLI version. Therefore MXC support and active sandbox behavior on this machine are **not verified**. Do not claim the read-only flag is OS-level isolation. Re-check current official requirements before selecting a backend. Codex sandboxing is defense in depth; it does not replace OS/VM isolation.

Repository IDs resolve only to pre-approved test repositories. Canonicalize the path and validate volume/root membership and real path immediately before child launch. Reject symlinks, junctions, other reparse points, and path components that resolve outside the approved root; account for time-of-check/time-of-use replacement. A string prefix comparison is insufficient. Do not accept UNC paths or network shares in v1. Keep repository allowlist changes server-side and reviewed.

## Persistence and observability

Persist only the minimum run metadata and bounded, redacted normalized events needed by the local UI. Never log API tokens, auth files, environment values, cookies, or raw global configuration. App Server threads may write persistent session history by default; design an explicit retention and deletion experience before enabling persistent threads. `--ephemeral` is a CLI exec option and must not be generalized to App Server thread behavior or to provider-side metrics. Do not assume local-only means no provider processing.

Use safe error codes and diagnostic IDs for the UI. Keep private paths and raw tool payloads out of browser-visible errors. A service restart must reconcile known child processes, mark uncertain runs `interrupted`, and never silently start them again. Keep an operator-visible run state even if detailed transcript retention is disabled.

## Implementation sequence for ADC-002B

1. Freeze versioned request/run/event/result/error types and pure state transition tests; no process spawning.
2. Add a static repository ID allowlist and dedicated path-validation tests for drive roots, traversal, symlinks, junctions/reparse points, and races.
3. Build an isolated loopback Node service with origin/capability checks, request limits, no browser-supplied command/path, and health/shutdown lifecycle.
4. Pin a supported CLI version, generate App Server TypeScript/JSON Schema from that exact binary, and implement only the allowlisted stdio methods. Disable or curate MCP/tool access.
5. Add fixed read-only turns, per-action human approvals, timeout/interrupt, Windows Job Object process-tree cleanup, bounded redacted event storage, and restart reconciliation.
6. Connect the Next.js facade and UI after service security tests pass; show planning, pending, approval, running, result, and error states without claiming code acceptance.
7. Validate with isolated test repositories and adversarial browser requests. Explicitly test that push, merge, deploy, arbitrary commands, external paths, and escalation are rejected.

## Acceptance gates before any real execution

- Only a pre-approved repository ID is accepted; canonical resolved path remains under its configured root and contains no disallowed reparse-point escape.
- Browser cannot choose command, executable, environment, cwd, permission mode, or arbitrary RPC method.
- Service binds loopback only and rejects invalid Origin/CSRF requests and requests without its internal capability.
- Child argv is fixed, `shell:false`, and explicit read-only; approval is per operation and cannot escalate the sandbox.
- Approval, cancellation, timeout, abrupt disconnect, service restart, output floods, child exit, and orphan cleanup are tested.
- Logs/events are bounded and redacted; App Server transcript retention/deletion behavior is documented.
- `completed` is visually and programmatically distinct from review/test acceptance.
- No push, merge, deploy, or arbitrary MCP/tool operation can be triggered.
