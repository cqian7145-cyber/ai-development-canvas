'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type Edge,
  type NodeChange,
  type Viewport,
} from '@xyflow/react'
import { readWorkflowForProject, saveWorkflowForProject } from '@/lib/project-storage'
import type { WorkflowDocument, WorkflowNode, WorkflowNodeData } from '@/lib/project-model'
import { validateWorkflowConnection } from '@/lib/workflow-validation'
import { WorkflowNode as WorkflowNodeView } from './workflow-node'

const starterNodes: WorkflowNode[] = [
  { id: 'requirements', type: 'workflow', position: { x: 80, y: 180 }, data: { title: '需求分析', description: '梳理目标与用户问题', nodeType: 'requirement', config: {} } },
  { id: 'design', type: 'workflow', position: { x: 340, y: 180 }, data: { title: 'UI 设计', description: '规划界面与交互', nodeType: 'design', config: {} } },
  { id: 'development', type: 'workflow', position: { x: 600, y: 180 }, data: { title: 'Codex 开发', description: '在本地实现产品', nodeType: 'implementation', config: {} } },
  { id: 'verification', type: 'workflow', position: { x: 860, y: 180 }, data: { title: '测试验证', description: '检查功能与质量', nodeType: 'verification', config: {} } },
  { id: 'review', type: 'workflow', position: { x: 1120, y: 180 }, data: { title: '人工审核', description: '由你决定是否交付', nodeType: 'approval', config: {} } },
]

const starterEdges = starterNodes.slice(0, -1).map((node, index) => ({
  id: `${node.id}-${starterNodes[index + 1].id}`,
  source: node.id,
  target: starterNodes[index + 1].id,
  type: 'smoothstep',
  animated: false,
  style: { stroke: '#aab8d0', strokeWidth: 1.5 },
}))

export type WorkflowCanvasHandle = {
  addNode: () => void
  updateNode: (id: string, data: Partial<WorkflowNodeData>) => void
}

type WorkflowCanvasProps = {
  documentId: string
  onRegister: (handle: WorkflowCanvasHandle) => void
  onSelectNode: (node: WorkflowNode | null) => void
}

function initialDocument(documentId: string): { document: WorkflowDocument; hadSavedDocument: boolean; error: string } {
  try {
    const saved = readWorkflowForProject(documentId)
    return {
      document: {
        nodes: (saved?.nodes as WorkflowNode[] | undefined) ?? starterNodes,
        edges: saved?.edges ?? starterEdges,
        viewport: saved?.viewport ?? { x: 0, y: 0, zoom: 0.72 },
      },
      hadSavedDocument: Boolean(saved),
      error: '',
    }
  } catch (error) {
    return {
      document: { nodes: starterNodes, edges: starterEdges, viewport: { x: 0, y: 0, zoom: 0.72 } },
      hadSavedDocument: true,
      error: error instanceof Error ? error.message : '工作流数据不可读取，编辑不会覆盖已有数据。',
    }
  }
}

function FlowContent({ documentId, onRegister, onSelectNode }: WorkflowCanvasProps) {
  const [initial] = useState(() => initialDocument(documentId))
  const [nodes, setNodes] = useState<WorkflowNode[]>(initial.document.nodes)
  const [edges, setEdges] = useState<WorkflowDocument['edges']>(initial.document.edges)
  const [viewport, setViewport] = useState<Viewport>(initial.document.viewport)
  const [storageError, setStorageError] = useState(initial.error)
  const storageLocked = useRef(Boolean(initial.error))
  const [connectionErrorMessage, setConnectionErrorMessage] = useState('')
  const { fitView } = useReactFlow()
  const nodeTypes = useMemo(() => ({ workflow: WorkflowNodeView }), [])

  const persist = useCallback((nextNodes: WorkflowNode[], nextEdges: WorkflowDocument['edges'], nextViewport: Viewport) => {
    if (storageLocked.current) return
    try {
      saveWorkflowForProject(documentId, { nodes: nextNodes, edges: nextEdges, viewport: nextViewport })
      setStorageError('')
    } catch {
      setStorageError('工作流暂时无法保存。请检查浏览器本地存储空间。')
    }
  }, [documentId])

  const handleNodesChange = useCallback((changes: NodeChange<WorkflowNode>[]) => {
    const next = applyNodeChanges(changes, nodes) as WorkflowNode[]
    setNodes(next)
    persist(next, edges, viewport)
  }, [nodes, edges, viewport, persist])

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    const next = applyEdgeChanges(changes, edges)
    setEdges(next)
    persist(nodes, next, viewport)
  }, [nodes, edges, viewport, persist])

  const updateNode = useCallback((id: string, data: Partial<WorkflowNodeData>) => {
    const next = nodes.map((node) => node.id === id ? { ...node, data: { ...node.data, ...data } } : node)
    setNodes(next)
    persist(next, edges, viewport)
  }, [nodes, edges, viewport, persist])

  const addNode = useCallback(() => {
    const nextNode: WorkflowNode = {
      id: crypto.randomUUID(),
      type: 'workflow',
      position: { x: 280 + (nodes.length % 3) * 44, y: 330 + Math.floor(nodes.length / 3) * 110 },
      data: { title: `新建步骤 ${nodes.length - starterNodes.length + 1}`, description: '规划节点 · 不会自动执行', nodeType: 'implementation', config: {} },
    }
    const next = [...nodes, nextNode]
    setNodes(next)
    persist(next, edges, viewport)
    onSelectNode(nextNode)
  }, [nodes, edges, viewport, persist, onSelectNode])

  const onConnect = useCallback((connection: Connection) => {
    const reason = validateWorkflowConnection(connection, nodes, edges)
    if (reason) {
      setConnectionErrorMessage(reason)
      return
    }
    const next = addEdge({ ...connection, type: 'smoothstep', style: { stroke: '#7395d3', strokeWidth: 1.5 } }, edges)
    setEdges(next)
    persist(nodes, next, viewport)
    setConnectionErrorMessage('')
  }, [nodes, edges, viewport, persist])

  const isValidConnection = useCallback((connection: Connection | Edge) => validateWorkflowConnection(connection, nodes, edges) === null, [nodes, edges])
  const handle = useMemo(() => ({ addNode, updateNode }), [addNode, updateNode])
  // Keep the current imperative surface in sync for the workspace toolbar and inspector.
  useEffect(() => { onRegister(handle) }, [handle, onRegister])

  return (
    <ReactFlow
      className="workflow-canvas"
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={handleNodesChange}
      onEdgesChange={handleEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      onConnectEnd={(_, state) => {
        if (!state.isValid) setConnectionErrorMessage('连接被拒绝：请勿自连接或重复连线，并按流程阶段从前向后连接。')
      }}
      onMoveEnd={(_, next) => { setViewport(next); persist(nodes, edges, next) }}
      onInit={() => {
        if (!initial.hadSavedDocument) {
          persist(nodes, edges, viewport)
          void fitView({ padding: 0.2, duration: 220 })
        }
      }}
      minZoom={0.18}
      maxZoom={1.8}
      deleteKeyCode={['Backspace', 'Delete']}
      onNodeClick={(_, node) => onSelectNode(node as WorkflowNode)}
      onPaneClick={() => onSelectNode(null)}
      attributionPosition="top-right"
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e6eaf0" />
      <Controls position="bottom-right" showInteractive={false} />
      <MiniMap position="bottom-left" pannable zoomable nodeColor="#aac3f2" maskColor="rgba(245,247,250,.72)" />
      <div className="workflow-validation-note">连接只允许从较早阶段指向较晚阶段；自连接和重复连线会被拒绝。</div>
      {(connectionErrorMessage || storageError) && <div className="workflow-alert" role={storageError ? 'alert' : 'status'}>{connectionErrorMessage || storageError}</div>}
    </ReactFlow>
  )
}

export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return <ReactFlowProvider><FlowContent {...props} /></ReactFlowProvider>
}
