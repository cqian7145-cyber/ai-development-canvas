import { createTLStore, parseTldrawJsonFile } from 'tldraw'
import type { Edge, Viewport } from '@xyflow/react'
import { createProjectRecord } from './project-storage'
import type { ProjectExport, WorkflowDocument, WorkflowNode, WorkflowNodeData, WorkflowNodeType } from './project-model'

export const PROJECT_EXPORT_SCHEMA_VERSION = 1
export const MAX_PROJECT_FILE_BYTES = 25 * 1024 * 1024
const MAX_ASSET_BYTES = 10 * 1024 * 1024
const MAX_TOTAL_ASSETS_BYTES = 18 * 1024 * 1024
const MAX_NODES = 500
const MAX_EDGES = 2000
const stageOrder: Record<WorkflowNodeType, number> = {
  requirement: 0,
  design: 1,
  implementation: 2,
  verification: 3,
  approval: 4,
}
const validNodeTypes = new Set(Object.keys(stageOrder))

export type ValidatedProjectImport = {
  project: ReturnType<typeof createProjectRecord>
  workflow: WorkflowDocument
  designSnapshot: unknown
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function requireString(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== 'string' || value.length > maxLength) throw new Error(`${name} 格式无效。`)
  return value
}

function assertSafeConfig(value: unknown, nodeId: string): Record<string, unknown> {
  if (!isObject(value)) throw new Error(`节点 ${nodeId} 的配置必须是 JSON 对象。`)
  const encoded = JSON.stringify(value)
  if (encoded.length > 16_000) throw new Error(`节点 ${nodeId} 的配置超过 16 KB。`)
  return JSON.parse(encoded) as Record<string, unknown>
}

function validateWorkflow(value: unknown): WorkflowDocument {
  if (!isObject(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    throw new Error('工作流缺少 nodes 或 edges。')
  }
  if (value.nodes.length > MAX_NODES || value.edges.length > MAX_EDGES) throw new Error('工作流节点或连线数量超过限制。')
  const ids = new Set<string>()
  const nodes: WorkflowNode[] = value.nodes.map((candidate, index) => {
    if (!isObject(candidate) || !isObject(candidate.position) || !isObject(candidate.data)) {
      throw new Error(`第 ${index + 1} 个节点格式无效。`)
    }
    const id = requireString(candidate.id, `节点 ${index + 1} ID`, 128)
    if (!id || ids.has(id)) throw new Error(`节点 ID 为空或重复：${id || index + 1}`)
    ids.add(id)
    const data = candidate.data
    const nodeType = requireString(data.nodeType, `节点 ${id} 类型`, 32)
    if (!validNodeTypes.has(nodeType)) throw new Error(`节点 ${id} 类型不受支持。`)
    const x = candidate.position.x
    const y = candidate.position.y
    if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y)) {
      throw new Error(`节点 ${id} 坐标无效。`)
    }
    const nodeData: WorkflowNodeData = {
      title: requireString(data.title, `节点 ${id} 标题`, 160),
      description: requireString(data.description, `节点 ${id} 描述`, 2000),
      nodeType: nodeType as WorkflowNodeType,
      config: assertSafeConfig(data.config, id),
    }
    return {
      id,
      type: 'workflow',
      position: { x, y },
      data: nodeData,
    }
  })
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const edgeKeys = new Set<string>()
  const edgeIds = new Set<string>()
  const edges: Edge[] = value.edges.map((candidate, index) => {
    if (!isObject(candidate)) throw new Error(`第 ${index + 1} 条连线格式无效。`)
    const source = requireString(candidate.source, `连线 ${index + 1} source`, 128)
    const target = requireString(candidate.target, `连线 ${index + 1} target`, 128)
    if (!nodeById.has(source) || !nodeById.has(target)) throw new Error(`连线引用不存在的节点：${source} → ${target}`)
    if (source === target) throw new Error('工作流不允许节点自连接。')
    const sourceHandle = typeof candidate.sourceHandle === 'string' ? candidate.sourceHandle : null
    const targetHandle = typeof candidate.targetHandle === 'string' ? candidate.targetHandle : null
    const edgeKey = `${source}\0${target}\0${sourceHandle ?? ''}\0${targetHandle ?? ''}`
    if (edgeKeys.has(edgeKey)) throw new Error(`检测到重复连线：${source} → ${target}`)
    edgeKeys.add(edgeKey)
    const id = requireString(candidate.id, `连线 ${index + 1} ID`, 128)
    if (!id || edgeIds.has(id)) throw new Error(`连线 ID 为空或重复：${id || index + 1}`)
    edgeIds.add(id)
    if (stageOrder[nodeById.get(source)!.data.nodeType] >= stageOrder[nodeById.get(target)!.data.nodeType]) {
      throw new Error(`连线方向无效：${source} → ${target}。流程只能从较早阶段指向较晚阶段。`)
    }
    return {
      id,
      source,
      target,
      ...(sourceHandle ? { sourceHandle } : {}),
      ...(targetHandle ? { targetHandle } : {}),
      type: 'smoothstep',
      style: { stroke: '#aab8d0', strokeWidth: 1.5 },
    }
  })
  const viewport = value.viewport
  if (!isObject(viewport) || ![viewport.x, viewport.y, viewport.zoom].every((n) => typeof n === 'number' && Number.isFinite(n)) || (viewport.zoom as number) <= 0) {
    throw new Error('工作流视口格式无效。')
  }
  return { nodes, edges, viewport: viewport as Viewport }
}

function validateTldrawDocument(design: unknown): { file: Record<string, unknown>; snapshot: unknown } {
  if (!isObject(design)) throw new Error('设计画布文档格式无效。')
  const file = design
  if (!Array.isArray(file.records)) throw new Error('设计画布缺少文档记录。')
  let totalAssetBytes = 0
  for (const candidate of file.records) {
    if (!isObject(candidate) || candidate.typeName !== 'asset') continue
    const props = candidate.props
    if (!isObject(props) || typeof props.src !== 'string') continue
    const type = candidate.type
    if (type !== 'image' && type !== 'video') continue
    const match = /^data:(image\/[a-zA-Z0-9.+-]+|video\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(props.src)
    if (!match) throw new Error('项目包含未内嵌的图片或视频。请确认资源可读取后重新导出。')
    const bytes = Math.floor(match[2].length * 3 / 4)
    if (bytes > MAX_ASSET_BYTES) throw new Error('单个画布资源超过 10 MB。')
    totalAssetBytes += bytes
  }
  if (totalAssetBytes > MAX_TOTAL_ASSETS_BYTES) throw new Error('画布资源总量超过 18 MB。')
  const validationStore = createTLStore()
  const parsed = parseTldrawJsonFile({ json: JSON.stringify(file), schema: validationStore.schema })
  if (!parsed.ok) {
    if (parsed.error.type === 'fileFormatVersionTooNew') throw new Error(`设计画布版本 ${parsed.error.version} 高于当前支持版本。`)
    throw new Error('设计画布文档损坏或版本迁移失败。')
  }
  return { file, snapshot: parsed.value.getStoreSnapshot() }
}

export function validateProjectImport(json: string): ValidatedProjectImport {
  if (new Blob([json]).size > MAX_PROJECT_FILE_BYTES) throw new Error('项目文件超过 25 MB 限制。')
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('文件不是有效 JSON。')
  }
  if (!isObject(parsed)) throw new Error('项目文件根节点必须是 JSON 对象。')
  if (parsed.format !== 'ai-development-canvas-project') throw new Error('文件格式不是 AI Development Canvas 项目包。')
  if (parsed.schemaVersion !== PROJECT_EXPORT_SCHEMA_VERSION) {
    throw new Error(`项目格式版本 ${String(parsed.schemaVersion)} 不受支持；当前支持版本为 ${PROJECT_EXPORT_SCHEMA_VERSION}。`)
  }
  if (!isObject(parsed.project)) throw new Error('项目包缺少项目元数据。')
  const name = requireString(parsed.project.name, '项目名称', 120).trim()
  const description = requireString(parsed.project.description, '项目描述', 2000)
  if (!name) throw new Error('项目名称不能为空。')
  const workflow = validateWorkflow(parsed.workflow)
  const design = validateTldrawDocument(parsed.design)
  const project = createProjectRecord(name, description)
  const idMap = new Map(workflow.nodes.map((node) => [node.id, crypto.randomUUID()]))
  workflow.nodes = workflow.nodes.map((node) => ({ ...node, id: idMap.get(node.id)! }))
  workflow.edges = workflow.edges.map((edge) => ({
    ...edge,
    id: crypto.randomUUID(),
    source: idMap.get(edge.source)!,
    target: idMap.get(edge.target)!,
  }))
  return { project, workflow, designSnapshot: design.snapshot }
}

export function createProjectExport(project: ProjectExport['project'], workflow: WorkflowDocument, design: Record<string, unknown>): ProjectExport {
  return { format: 'ai-development-canvas-project', schemaVersion: PROJECT_EXPORT_SCHEMA_VERSION, exportedAt: new Date().toISOString(), project, workflow, design }
}
