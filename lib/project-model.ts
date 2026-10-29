import type { Edge, Node, Viewport } from '@xyflow/react'

export const PROJECT_SCHEMA_VERSION = 1

export type WorkflowNodeType =
  | 'requirement'
  | 'design'
  | 'implementation'
  | 'verification'
  | 'approval'

export type WorkflowNodeData = {
  title: string
  description: string
  nodeType: WorkflowNodeType
  config: Record<string, unknown>
}

export type WorkflowNode = Node<WorkflowNodeData, 'workflow'>
export type WorkflowEdge = Edge

export type WorkflowDocument = {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  viewport: Viewport
}

export type ProjectRecord = {
  projectId: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  schemaVersion: number
  designDocumentId: string
  workflowDocumentId: string
}

export type ProjectCatalog = {
  schemaVersion: number
  projects: ProjectRecord[]
  lastOpenedProjectId: string
}

export type ProjectExport = {
  format: 'ai-development-canvas-project'
  schemaVersion: number
  exportedAt: string
  project: ProjectRecord
  workflow: WorkflowDocument
  design: Record<string, unknown>
}
