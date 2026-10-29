import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { ClipboardList, Code2, Palette, Search, ShieldCheck } from 'lucide-react'

export type WorkflowNodeData = { label: string; description: string; kind: string }
export type WorkflowNodeModel = Node<WorkflowNodeData, 'workflow'>

const icons = {
  analysis: Search,
  design: Palette,
  development: Code2,
  verification: ClipboardList,
  review: ShieldCheck,
} as const

export function WorkflowNode({ data, selected }: NodeProps<WorkflowNodeModel>) {
  const Icon = icons[data.kind as keyof typeof icons] ?? ClipboardList
  return (
    <div className={`workflow-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="workflow-node-top"><span className="node-icon"><Icon size={14} /></span><span className="node-name">{data.label}</span></div>
      <p className="node-caption">{data.description}</p>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
