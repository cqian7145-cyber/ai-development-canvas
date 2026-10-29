import type { Edge, Node, Viewport } from '@xyflow/react'

export const LEGACY_WORKFLOW_STORAGE_KEY = 'adc-phase0-workflow-v1'

export type WorkflowSnapshot = {
  nodes: Node[]
  edges: Edge[]
  viewport: Viewport
}

function workflowKey(documentId: string): string {
  return `adc-workflow-document-v1:${documentId}`
}

export function readWorkflowSnapshot(documentId: string): Partial<WorkflowSnapshot> | null {
  const raw = window.localStorage.getItem(workflowKey(documentId))
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw new Error('工作流本地数据无法解析。当前项目已进入只读保护，避免覆盖原始数据。')
  }
  if (!value || typeof value !== 'object') throw new Error('工作流数据格式无效。当前项目已进入只读保护。')
  const snapshot = value as Partial<WorkflowSnapshot>
  if (!Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges) || !snapshot.viewport ||
    ![snapshot.viewport.x, snapshot.viewport.y, snapshot.viewport.zoom].every((number) => typeof number === 'number' && Number.isFinite(number))) {
    throw new Error('工作流数据字段不完整。当前项目已进入只读保护。')
  }
  return { nodes: snapshot.nodes, edges: snapshot.edges, viewport: snapshot.viewport }
}

export function writeWorkflowSnapshot(documentId: string, snapshot: WorkflowSnapshot): void {
  window.localStorage.setItem(workflowKey(documentId), JSON.stringify(snapshot))
}

export function readLegacyWorkflowSnapshot(): Partial<WorkflowSnapshot> | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_WORKFLOW_STORAGE_KEY)
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
