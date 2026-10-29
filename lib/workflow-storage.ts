import type { Edge, Node, Viewport } from '@xyflow/react'

export const WORKFLOW_STORAGE_KEY = 'adc-phase0-workflow-v1'

export type WorkflowSnapshot = {
  nodes: Node[]
  edges: Edge[]
  viewport: Viewport
}

export function readWorkflowSnapshot(): Partial<WorkflowSnapshot> | null {
  try {
    const raw = window.localStorage.getItem(WORKFLOW_STORAGE_KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return null
    const snapshot = value as Partial<WorkflowSnapshot>
    return {
      ...(Array.isArray(snapshot.nodes) ? { nodes: snapshot.nodes } : {}),
      ...(Array.isArray(snapshot.edges) ? { edges: snapshot.edges } : {}),
      ...(snapshot.viewport && typeof snapshot.viewport.zoom === 'number' ? { viewport: snapshot.viewport } : {}),
    }
  } catch {
    return null
  }
}

export function writeWorkflowSnapshot(snapshot: WorkflowSnapshot) {
  try {
    window.localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Storage can be unavailable or full; keep the canvas interactive in that case.
  }
}
