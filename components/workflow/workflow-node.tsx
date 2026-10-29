import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ClipboardList, Code2, Palette, Search, ShieldCheck } from 'lucide-react'

import type { WorkflowNode, WorkflowNodeType } from '@/lib/project-model'

export type WorkflowNodeModel = WorkflowNode

const icons = {
  requirement: Search,
  design: Palette,
  implementation: Code2,
  verification: ClipboardList,
  approval: ShieldCheck,
} as const

const labels: Record<WorkflowNodeType, string> = {
  requirement: '需求分析',
  design: 'UI 设计',
  implementation: 'Codex 开发',
  verification: '测试验证',
  approval: '人工审核',
}

export function WorkflowNode({ data, selected }: NodeProps<WorkflowNodeModel>) {
  const Icon = icons[data.nodeType] ?? ClipboardList
  return (
    <div className={`workflow-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="workflow-node-top"><span className="node-icon"><Icon size={14} /></span><span className="node-name">{data.title}</span></div>
      <p className="node-caption">{data.description}</p>
      <span className="node-type-label">{labels[data.nodeType]}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
