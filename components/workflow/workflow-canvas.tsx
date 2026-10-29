'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type Viewport,
} from '@xyflow/react'
import { readWorkflowSnapshot, writeWorkflowSnapshot, type WorkflowSnapshot } from '@/lib/workflow-storage'
import { WorkflowNode, type WorkflowNodeModel } from './workflow-node'

const initialNodes: WorkflowNodeModel[] = [
  { id: 'requirements', type: 'workflow', position: { x: 80, y: 180 }, data: { label: '需求分析', description: '梳理目标与用户问题', kind: 'analysis' } },
  { id: 'design', type: 'workflow', position: { x: 340, y: 180 }, data: { label: 'UI 设计', description: '规划界面与交互', kind: 'design' } },
  { id: 'development', type: 'workflow', position: { x: 600, y: 180 }, data: { label: 'Codex 开发', description: '在本地实现产品', kind: 'development' } },
  { id: 'verification', type: 'workflow', position: { x: 860, y: 180 }, data: { label: '测试验证', description: '检查功能与质量', kind: 'verification' } },
  { id: 'review', type: 'workflow', position: { x: 1120, y: 180 }, data: { label: '人工审核', description: '由你决定是否交付', kind: 'review' } },
]

const initialEdges: Edge[] = initialNodes.slice(0, -1).map((node, index) => ({
  id: `${node.id}-${initialNodes[index + 1].id}`,
  source: node.id,
  target: initialNodes[index + 1].id,
  type: 'smoothstep',
  animated: false,
  style: { stroke: '#aab8d0', strokeWidth: 1.5 },
}))

function FlowContent({ onRegisterAddNode }: { onRegisterAddNode: (add: () => void) => void }) {
  const [saved] = useState<Partial<WorkflowSnapshot> | null>(() => typeof window === 'undefined' ? null : readWorkflowSnapshot())
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<WorkflowNodeModel['data']>>((saved?.nodes as WorkflowNodeModel[] | undefined) ?? initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState((saved?.edges as Edge[] | undefined) ?? initialEdges)
  const [viewport, setViewport] = useState<Viewport>(saved?.viewport ?? { x: 0, y: 0, zoom: 0.72 })
  const { fitView } = useReactFlow()
  const nodeTypes = useMemo(() => ({ workflow: WorkflowNode }), [])

  useEffect(() => {
    const timeout = window.setTimeout(() => writeWorkflowSnapshot({ nodes, edges, viewport }), 180)
    return () => window.clearTimeout(timeout)
  }, [nodes, edges, viewport])

  const onConnect = useCallback((connection: Connection) => {
    setEdges((current) => addEdge({ ...connection, type: 'smoothstep', style: { stroke: '#7395d3', strokeWidth: 1.5 } }, current))
  }, [setEdges])

  const addNewNode = useCallback(() => {
    const id = crypto.randomUUID()
    setNodes((current) => {
      const index = current.length - initialNodes.length + 1
      const next: WorkflowNodeModel = {
        id,
        type: 'workflow',
        position: { x: 280 + (current.length % 3) * 44, y: 330 + Math.floor(current.length / 3) * 110 },
        data: { label: `新建步骤 ${index}`, description: '示例节点 · 可连接与移动', kind: 'development' },
      }
      return [...current, next]
    })
  }, [setNodes])

  useEffect(() => {
    onRegisterAddNode(() => addNewNode)
    return () => onRegisterAddNode(() => () => undefined)
  }, [addNewNode, onRegisterAddNode])

  return (
    <ReactFlow
      className="workflow-canvas"
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      defaultViewport={viewport}
      onMoveEnd={(_, next) => setViewport(next)}
      onInit={() => { if (!saved?.viewport) void fitView({ padding: 0.2, duration: 220 }) }}
      fitViewOptions={{ padding: 0.2, duration: 220 }}
      minZoom={0.18}
      maxZoom={1.8}
      deleteKeyCode={['Backspace', 'Delete']}
      attributionPosition="top-right"
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e6eaf0" />
      <Controls position="bottom-right" showInteractive={false} />
      <MiniMap position="bottom-left" pannable zoomable nodeColor="#aac3f2" maskColor="rgba(245,247,250,.72)" />
    </ReactFlow>
  )
}

export function WorkflowCanvas({ onRegisterAddNode }: { onRegisterAddNode: (add: () => void) => void }) {
  return <ReactFlowProvider><FlowContent onRegisterAddNode={onRegisterAddNode} /></ReactFlowProvider>
}
