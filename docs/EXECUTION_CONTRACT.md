# Execution Contract

**Status:** Proposed wire/domain contract for ADC-002B. It is not implemented or connected to the workflow canvas.
**Version:** `executionContractVersion: 1` (separate from project `schemaVersion`)

## Invariants

- A workflow node represents planning data. It does not execute itself.
- The browser can request a task but cannot select a system command, executable path, working directory, environment, sandbox profile, approval policy, or arbitrary Codex protocol method.
- `projectId`, `nodeId`, and `repositoryId` are validated against local project state and a server-side repository allowlist.
- `runId` is allocated by the execution service and never reused.
- Every run records the observed Git HEAD immediately before launch. A mismatch with an optional expected HEAD causes a conflict and no launch.
- A completed Codex turn is not equivalent to accepted code.

## Proposed TypeScript shapes

These shapes are illustrative. ADC-002B should implement runtime validation (for example, a narrow hand-written parser or an already available schema library only if dependency review justifies it). TypeScript types alone do not validate network input.

```ts
type ProjectId = string;
type WorkflowNodeId = string;
type RepositoryId = string; // opaque ID resolved by the service
type RunId = string;
type IsoTimestamp = string;
type GitHead = string; // validated full object ID for the selected repository

type TaskRequest = {
  requestId: string; // client-generated idempotency key, bounded and opaque
  projectId: ProjectId;
  nodeId: WorkflowNodeId;
  repositoryId: RepositoryId;
  taskText: string;
  expectedGitHead?: GitHead;
};

type RunStatus =
  | "pending"
  | "awaiting_approval"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";

type AcceptanceStatus = "not_run" | "passed" | "failed";

type ExecutionRun = {
  runId: RunId;
  requestId: string;
  projectId: ProjectId;
  nodeId: WorkflowNodeId;
  repositoryId: RepositoryId;
  /** Service-private; never serialized to browser clients. */
  canonicalWorkingDirectory: string;
  gitHeadAtStart: GitHead;
  status: RunStatus;
  createdAt: IsoTimestamp;
  startedAt?: IsoTimestamp;
  finishedAt?: IsoTimestamp;
  threadId?: string;
  turnId?: string;
  /** This does not imply that code was accepted. */
  acceptance: AcceptanceStatus;
};

type ExecutionEvent = {
  runId: RunId;
  sequence: number; // monotonically increasing within a run
  timestamp: IsoTimestamp;
  type: string; // normalized allowlisted event name, not arbitrary raw RPC
  threadId?: string;
  turnId?: string;
  itemId?: string;
  summary: string; // bounded, redacted, UI-safe text
  data?: Record<string, string | number | boolean | null>; // allowlisted fields only
};

type ApprovalRequest = {
  approvalId: string;
  runId: RunId;
  itemId: string;
  reason: string;
  commandPreview?: string; // escaped and bounded for display; never executable input
  workingDirectoryLabel: string; // display label, not an accepted path
  requestedPermissions: string[]; // enumerated safe display values
  createdAt: IsoTimestamp;
  expiresAt: IsoTimestamp;
};

type ApprovalDecision = {
  approvalId: string;
  decision: "approve_once" | "decline" | "cancel_run";
};

type ExecutionResult = {
  runId: RunId;
  status: "completed";
  summary: string;
  /** Run completion and acceptance are deliberately separate. */
  acceptance: AcceptanceStatus;
  verification?: { name: string; status: "passed" | "failed" | "not_run" }[];
  gitHeadAtStart: GitHead;
  gitHeadAtFinish?: GitHead;
};

type ExecutionError = {
  runId?: RunId;
  code:
    | "INVALID_REQUEST"
    | "PROJECT_NODE_NOT_FOUND"
    | "REPOSITORY_NOT_ALLOWED"
    | "PATH_VALIDATION_FAILED"
    | "GIT_HEAD_MISMATCH"
    | "CLI_UNAVAILABLE"
    | "AUTH_UNAVAILABLE"
    | "APP_SERVER_PROTOCOL_ERROR"
    | "APPROVAL_DECLINED"
    | "TIMEOUT"
    | "CANCELLED"
    | "CHILD_EXITED"
    | "OUTPUT_LIMIT"
    | "SERVICE_RESTARTED"
    | "INTERNAL_ERROR";
  message: string; // safe and redacted
  retryable: boolean;
  diagnosticId: string;
};
```

Do not serialize `canonicalWorkingDirectory`, raw environment, raw MCP configuration, auth state, unbounded App Server payloads, or provider credentials to the browser. The UI may receive an opaque repository label and a safe error code/message.

## State machine

```text
pending -> running
pending -> failed | cancelled | interrupted
running -> awaiting_approval
awaiting_approval -> running (approve this item only)
awaiting_approval -> running (decline response recorded, then turn outcome decides)
running -> completed | failed | cancelled | interrupted
awaiting_approval -> failed | cancelled | interrupted
```

Terminal statuses are immutable: `completed`, `failed`, `cancelled`, `interrupted`. A decline is a decision/event, not necessarily a run terminal status: the CLI may end the turn as failed or completed after the denied action, and the service records the actual turn result. `cancelled` means the service confirmed a requested cancellation and child termination. `interrupted` means completion is uncertain (for example service restart, abrupt transport loss, or unconfirmed child exit). Never convert `interrupted` into a resumed or duplicate task automatically.

`completed` means only that the Codex turn completed successfully according to the protocol. It does not mean edits are correct, tests pass, or a human accepted a diff. Only a separate verification/review step may update `acceptance` from `not_run` to `passed` or `failed`.

## Identity, association, and idempotency

- `runId`: service-issued, globally unique within this local installation.
- `requestId`: bounded idempotency key. Repeating the same request while its first result is known returns that run’s status; it must not spawn another process. If service state is uncertain after restart, return `interrupted` rather than retry.
- `projectId` / `nodeId`: stable local IDs, checked against the selected project and its workflow document at request time. A node’s display text is copied into a bounded task request only after user action; it is not trusted policy.
- `repositoryId`: opaque ID from a static service allowlist. The service records its configured canonical root privately.
- `canonicalWorkingDirectory`: derived by the service after true-path checks; never accepted from the client.
- `gitHeadAtStart`: recorded from the allowlisted repository immediately before launch. If an expected head was supplied and differs, reject without starting. Record a finish head if readable, but never assume it proves a clean diff or correctness.
- `threadId` / `turnId`: App Server identifiers associated with this run. Do not treat them as authorization tokens.

## Bounds and validation

ADC-002B must set and test explicit maximums for task-text length, request body size, events per run, event payload bytes, approval lifetime, concurrent runs, wall-clock duration, stdout/stderr bytes, and retry attempts. Reject unknown fields and enum values. Normalize newlines and safely encode displayed command previews. Do not evaluate task text, config, imported project text, or event fields as HTML, JavaScript, shell, or protocol commands.

## Restart and cancellation semantics

- On cancel: mark the request, send App Server `turn/interrupt`, wait only a bounded interval, terminate the service-owned process tree if needed, and verify termination. Return `cancelled` only after termination is confirmed; otherwise `interrupted`.
- On timeout: use the same interrupt/cleanup sequence and report `failed` with `TIMEOUT` if termination is confirmed; use `interrupted` if not.
- On expected child exit with a valid terminal event: map the protocol’s terminal state. A success exit alone is insufficient evidence; inspect the event/turn outcome.
- On malformed/missing terminal event, service restart, lost stdio, or ambiguous child lifetime: `interrupted`, no automatic replay.
- On restart: load minimal run metadata, identify owned live processes if possible, terminate or quarantine them, and reconcile each uncertain run to `interrupted`. Do not silently reattach/resume.

## Contract compatibility

Execution contract version is independent of `schemaVersion` in `docs/DATA_FORMAT.md`. Reject unknown newer contract versions. Add explicit migration functions for older persisted run records; never silently coerce unknown statuses or fields. Prefer additive fields; changing status semantics, required identity fields, or approval meaning requires a contract version increment and migration tests.
