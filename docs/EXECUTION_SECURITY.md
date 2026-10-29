# Execution Security Contract

**Status:** Design requirements for a future local executor; this file does not implement or enable execution.

## Scope and trust assumptions

ADC is a local-first Next.js application whose existing project/workflow documents are stored in the browser. The present application has no Codex runner or local execution service. The proposed future boundary is between the browser UI, a same-origin Next.js facade, a separate loopback Node service, a pinned Codex CLI child, and an explicitly allowlisted local test repository.

Assume a malicious or compromised browser origin, hostile project/workflow import, malicious task text, prompt-injected repository files (including repository instructions), malformed child output, a local process attempting to call the loopback service, and unexpected process/service termination. The model, generated text, tool output, code changes, workflow node config, and repository contents are not trusted policy. The service account and local OS remain trusted to the limits stated below.

## Protected assets

- User source files and Git state outside the selected test repository.
- Local Codex login credentials, API keys, environment values, and user configuration.
- Integrity of approved repository contents and execution authorization.
- Availability of the UI, Node service, and machine resources.
- Local run metadata, approval decisions, and any retained App Server transcript.

## Required security controls

### 1. Process and command boundary

- Ship no endpoint that accepts a command string, executable path, arbitrary arguments, environment map, `cwd`, shell snippet, or arbitrary App Server JSON-RPC.
- Select the Codex executable from trusted server configuration; launch using an argument array with `shell: false`.
- Pin an approved CLI version and test protocol compatibility before upgrades. Generate App Server bindings/schema from that installed binary.
- Explicitly request read-only permissions for the first version. Never use `danger-full-access`, yolo, `--dangerously-bypass-approvals-and-sandbox`, `--approve-for-me`, or a setting that silently approves actions.
- Expose only a strict allowlist of App Server methods required for thread/turn start, event handling, one-action approval, and interrupt. Deny `process/*`, `thread/shellCommand`, arbitrary MCP/tool calls, configuration writes, plugin/marketplace writes, web browsing, and remote-control methods.
- Treat child output as untrusted text. Escape on rendering, cap lengths/rates, and never feed tool-produced strings into a shell or protocol request.

### 2. Repository and path boundary

- v1 accepts only opaque repository IDs in a reviewed server-side allowlist of disposable/test repositories.
- Do not accept a path from a browser request. Resolve ID to configured root in the service.
- Normalize and resolve the true path; validate same volume and root containment immediately before launch. Reject UNC/network paths, traversal, symlink or junction escapes, and unexpected reparse points. Avoid plain string-prefix checks.
- Protect against time-of-check/time-of-use replacement: revalidate as close to launch as possible, prevent untrusted mutation of the allowlist/root parent, and keep the process constrained to the configured repository.
- Record initial Git HEAD and reject stale expected-head requests. Do not automatically stage, commit, push, merge, deploy, or clean files.

Microsoft documents junctions and symbolic links as reparse-point behavior that must be accounted for by file operations. Implement and test the actual Windows APIs/runtime behavior used; a lexical `path.resolve` check alone is insufficient. See [Windows reparse points](https://learn.microsoft.com/en-us/windows/win32/fileio/reparse-points-and-file-operations) and [hard links and junctions](https://learn.microsoft.com/en-us/windows/win32/fileio/hard-links-and-junctions).

### 3. Local network boundary

- Bind the separate service to `127.0.0.1` only; do not listen on `0.0.0.0`, LAN, or an unauthenticated WebSocket.
- The Next.js facade performs exact Origin validation, Fetch Metadata/CSRF checks, schema and body-size validation, and rate/concurrency limits.
- The service additionally requires a random per-process capability known only to the local server-side facade. Do not put it in client JavaScript, localStorage, URLs, logs, or exported project data.
- Restrict accepted Host/Origin and content types. CORS is not authorization and is not sufficient CSRF protection.
- Do not expose Codex App Server stdio or raw JSON-RPC to browser code. Current official docs describe WebSocket support as experimental; the selected local transport is stdio.

### 4. Approval and permission boundary

- Read-only is the fixed baseline; user approval cannot escalate it.
- Present one bounded, escaped approval request at a time, with the operation/reason and safe repository label. Decisions are `approve_once`, `decline`, or `cancel_run`; no session-wide acceptance, policy amendment, or arbitrary command editor.
- Expire stale approvals. Bind each decision to an unguessable local approval ID, run, and item. Reject replay, cross-run, expired, and duplicate decisions.
- A denial is an event, not a promise that the task will end in a particular status; map the actual terminal turn status.
- If CLI/App Server requests a permission increase or an unapproved method, deny and fail closed.

### 5. Secrets, output, and retention

- Never read or log auth-file contents, tokens, API keys, cookies, authorization headers, or raw environment/global configuration. Exclude secrets from child environment unless the CLI requires a specific value; then pass only that allowlisted variable.
- Redact before persistence and before UI delivery. Cap stdout, stderr, JSONL/JSON-RPC frames, event count, transcript size, concurrency, and wall-clock time.
- Persist only necessary run metadata and bounded normalized events. Codex App Server threads are persistent by default in current docs; define retention, deletion, and user disclosure before creating persistent threads. `codex exec --ephemeral` does not establish that App Server sessions or provider-side records are ephemeral.
- Return safe error codes plus diagnostic IDs; do not send raw stack traces, private paths, arbitrary child output, or user configuration details to the browser.

### 6. Lifecycle and OS enforcement

- Use request idempotency. If run delivery becomes uncertain, mark interrupted; do not retry automatically.
- Bound execution duration and all I/O. On cancellation/timeout call App Server interrupt, then terminate the owned process tree after a grace period and verify exit.
- On Windows, use a Job Object configured to terminate owned descendants when the service closes where the implementation can enforce this reliably. Test process trees, breakaway behavior, service crashes, and cleanup. A best-effort PID kill is not enough.
- Keep the service unprivileged and isolated from sensitive directories. Use a disposable VM or OS account/repository where practical. Codex sandboxing and read-only application policy are defense in depth, not substitutes for operating-system isolation.
- The local Windows build and CLI audited in this phase do not meet the current documented MXC compatibility floor; do not infer that MXC or equivalent sandbox protection is active.

## Threat scenarios and treatment

| Threat path | Likely impact | Required treatment / residual risk |
| --- | --- | --- |
| Malicious browser request supplies `cwd`, command, or arbitrary RPC | Execution outside intended project; privilege misuse | Strict schemas and allowlisted fields in facade and service; no generic proxy. Verify with adversarial API tests. |
| Path traversal, junction swap, symlink/reparse escape | Read/write outside approved test repo | Opaque repo IDs, canonical/true-path checks, reparse rejection, revalidation at launch, OS isolation. TOCTOU remains a concern unless repository parents are protected and process sandbox is verified. |
| Prompt injection in task, repository file, or imported project | Model attempts unsafe action or leaks context | Read-only sandbox, action approvals, curated tools, minimal credentials, test fixture isolation. Prompt injection can still influence outputs and approved operations. |
| App Server method or configured MCP bypasses UI policy | Arbitrary process/tool operation | Server-side method allowlist, no raw protocol forwarding, curated/disabled MCPs, fixed service policy. CLI user config must not silently add capabilities. |
| Loopback CSRF or local webpage calls service | Unauthorized local run/approval or data disclosure | Exact Origin, Fetch Metadata, CSRF checks, random server-to-service capability, host validation, body/rate limits. Loopback is not a trust boundary by itself. |
| Child hangs, floods output, or leaves descendants | Resource exhaustion or ongoing work after UI says stopped | Time/output/concurrency caps, interrupt then Job Object cleanup, explicit `interrupted` state, process-tree tests. |
| Service restarts after request but before outcome | Duplicate work or false completion | Idempotency key, persist minimal state, reconcile uncertain runs as `interrupted`, never auto-replay. |
| Logs or transcript expose local credentials/private data | Credential theft or privacy exposure | Allowlisted/redacted event fields, bounded local retention, no raw config/env, explicit transcript retention/deletion. Third-party processing/account telemetry remains outside local storage guarantees. |

## Residual risk statement

Even with these controls, a local Codex process can access whatever the OS identity and effective sandbox permit. Read-only does not guarantee confidentiality: readable source, repository instructions, task text, model context, and configured tools can disclose data through outputs or network-enabled tools. Prompt injection cannot be eliminated by UI labels or JSON schema. Keep v1 to disposable test repositories with no secrets and no sensitive source; require explicit per-action approval and a verified OS isolation layer before widening scope. Do not claim Codex sandbox equals a VM/container security boundary.

## Security verification required in ADC-002B

Test arbitrary command/cwd rejection, project/node authorization, Origin/CSRF/capability failure, allowlist lookup, drive/UNC/traversal cases, symlink/junction/reparse escape and race cases, Git HEAD mismatch, unknown JSON-RPC methods, MCP denial, approval replay/expiry/escalation, push/merge/deploy denial, output flooding, secret redaction, timeout, interrupt, process-tree cleanup, abrupt service restart, and no automatic replay. Tests must run only against disposable local fixtures and must document what the OS sandbox does and does not enforce.
