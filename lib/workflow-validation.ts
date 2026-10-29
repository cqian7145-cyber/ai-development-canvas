import type { Connection, Edge } from '@xyflow/react'
import type { WorkflowNode, WorkflowNodeType } from './project-model'

const stageOrder: Record<WorkflowNodeType, number> = {
  requirement: 0,
  design: 1,
  implementation: 2,
  verification: 3,
  approval: 4,
}

export function validateWorkflowConnection(
  connection: Connection | Edge,
  nodes: WorkflowNode[],
  edges: Edge[],
): string | null {
  if (!connection.source || !connection.target) return '请连接两个有效节点。'
  if (connection.source === connection.target) return '不能将节点连接到自身。'
  const source = nodes.find((node) => node.id === connection.source)
  const target = nodes.find((node) => node.id === connection.target)
  if (!source || !target) return '连接引用的节点不存在。'
  const duplicate = edges.some((edge) => edge.source === connection.source && edge.target === connection.target &&
    (edge.sourceHandle ?? null) === (connection.sourceHandle ?? null) && (edge.targetHandle ?? null) === (connection.targetHandle ?? null))
  if (duplicate) return '这条连线已经存在。'
  if (stageOrder[source.data.nodeType] >= stageOrder[target.data.nodeType]) return '连线只能从较早的流程阶段指向较晚阶段。'
  return null
}
