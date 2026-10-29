import type { ProjectCatalog, ProjectRecord, WorkflowDocument, WorkflowNode, WorkflowNodeType } from './project-model'
import { PROJECT_SCHEMA_VERSION } from './project-model'
import { readWorkflowSnapshot, writeWorkflowSnapshot, type WorkflowSnapshot } from './workflow-storage'

export const PROJECT_CATALOG_KEY = 'adc-project-catalog-v1'
const PENDING_DESIGN_DB = 'adc-project-data-v1'
const PENDING_DESIGN_STORE = 'pending-design'
const CATALOG_SCHEMA_VERSION = 1

const legacyTypeByKind: Record<string, WorkflowNodeType> = {
  analysis: 'requirement',
  design: 'design',
  development: 'implementation',
  verification: 'verification',
  review: 'approval',
}

export class ProjectStorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectStorageError'
  }
}

export function createProjectRecord(name: string, description = ''): ProjectRecord {
  const now = new Date().toISOString()
  const projectId = crypto.randomUUID()
  return {
    projectId,
    name: name.trim(),
    description: description.trim(),
    createdAt: now,
    updatedAt: now,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    designDocumentId: `adc-design-${projectId}`,
    workflowDocumentId: `adc-workflow-${projectId}`,
  }
}

function isProjectRecord(value: unknown): value is ProjectRecord {
  if (!value || typeof value !== 'object') return false
  const project = value as Partial<ProjectRecord>
  return typeof project.projectId === 'string' && typeof project.name === 'string' &&
    typeof project.description === 'string' && typeof project.createdAt === 'string' &&
    typeof project.updatedAt === 'string' && typeof project.schemaVersion === 'number' &&
    typeof project.designDocumentId === 'string' && typeof project.workflowDocumentId === 'string'
}

function readCatalogRaw(): ProjectCatalog | null {
  const raw = localStorage.getItem(PROJECT_CATALOG_KEY)
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw new ProjectStorageError('项目目录无法解析。原始数据已保留，请先导出或备份后再处理。')
  }
  if (!value || typeof value !== 'object') throw new ProjectStorageError('项目目录格式无效，原始数据已保留。')
  const catalog = value as Partial<ProjectCatalog>
  if (catalog.schemaVersion !== CATALOG_SCHEMA_VERSION) {
    throw new ProjectStorageError(`项目目录版本 ${String(catalog.schemaVersion)} 不受支持，原始数据已保留。`)
  }
  if (!Array.isArray(catalog.projects) || !catalog.projects.every(isProjectRecord) || typeof catalog.lastOpenedProjectId !== 'string') {
    throw new ProjectStorageError('项目目录字段不完整，原始数据已保留。')
  }
  return catalog as ProjectCatalog
}

function migrateLegacyWorkflow(value: unknown): WorkflowDocument | null {
  if (!value || typeof value !== 'object') return null
  const snapshot = value as Partial<WorkflowSnapshot>
  if (!Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges)) return null
  const nodes: WorkflowNode[] = snapshot.nodes.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const node = entry as Record<string, unknown>
    const data = node.data as Record<string, unknown> | undefined
    const oldKind = typeof data?.kind === 'string' ? data.kind : 'development'
    const title = typeof data?.label === 'string' ? data.label : '未命名步骤'
    return [{
      ...node,
      type: 'workflow',
      data: {
        title,
        description: typeof data?.description === 'string' ? data.description : '',
        nodeType: legacyTypeByKind[oldKind] ?? 'implementation',
        config: {},
      },
    } as WorkflowNode]
  })
  const edges = snapshot.edges.filter((edge) => edge && typeof edge === 'object') as WorkflowDocument['edges']
  const viewport = snapshot.viewport && typeof snapshot.viewport.x === 'number' &&
    typeof snapshot.viewport.y === 'number' && typeof snapshot.viewport.zoom === 'number'
    ? snapshot.viewport
    : { x: 0, y: 0, zoom: 0.72 }
  return { nodes, edges, viewport }
}

function defaultCatalog(): ProjectCatalog {
  const project = createProjectRecord('ADC Workspace', '本地 AI 产品开发工作区')
  // The first Phase 1 project reuses tldraw's Phase 0 key so its IndexedDB document and assets migrate in place.
  project.designDocumentId = 'adc-phase0-design-canvas'
  project.workflowDocumentId = `adc-workflow-${project.projectId}`
  const catalog: ProjectCatalog = { schemaVersion: CATALOG_SCHEMA_VERSION, projects: [project], lastOpenedProjectId: project.projectId }

  const legacyRaw = localStorage.getItem('adc-phase0-workflow-v1')
  if (legacyRaw) {
    try {
      const legacy = migrateLegacyWorkflow(JSON.parse(legacyRaw))
      if (legacy) writeWorkflowSnapshot(project.workflowDocumentId, legacy)
      // Keep the original key as a recoverable backup even after a successful migration.
    } catch {
      // Preserve unreadable legacy data; the workspace surfaces a migration warning below.
    }
  }
  localStorage.setItem(PROJECT_CATALOG_KEY, JSON.stringify(catalog))
  return catalog
}

export function loadProjectCatalog(): { catalog: ProjectCatalog; warning?: string } {
  try {
    const catalog = readCatalogRaw() ?? defaultCatalog()
    if (!catalog.projects.length) throw new ProjectStorageError('项目目录没有项目记录，原始数据已保留。')
    const lastOpened = catalog.projects.some((project) => project.projectId === catalog.lastOpenedProjectId)
      ? catalog.lastOpenedProjectId
      : catalog.projects[0].projectId
    if (lastOpened !== catalog.lastOpenedProjectId) saveProjectCatalog({ ...catalog, lastOpenedProjectId: lastOpened })
    const warning = localStorage.getItem('adc-phase0-workflow-v1') &&
      !localStorage.getItem(`adc-workflow-document-v1:${catalog.projects[0].workflowDocumentId}`)
      ? '检测到 Phase 0 工作流备份，但无法自动解析；原数据仍保留在浏览器本地存储中。'
      : undefined
    return { catalog: { ...catalog, lastOpenedProjectId: lastOpened }, ...(warning ? { warning } : {}) }
  } catch (error) {
    if (error instanceof ProjectStorageError) throw error
    throw new ProjectStorageError('无法读取本地项目目录。请检查浏览器存储空间和权限。')
  }
}

export function saveProjectCatalog(catalog: ProjectCatalog): void {
  try {
    localStorage.setItem(PROJECT_CATALOG_KEY, JSON.stringify(catalog))
  } catch {
    throw new ProjectStorageError('项目目录保存失败。浏览器存储可能已满或不可用。')
  }
}

export function saveWorkflowForProject(documentId: string, snapshot: WorkflowDocument): void {
  writeWorkflowSnapshot(documentId, snapshot)
}

export function readWorkflowForProject(documentId: string): WorkflowDocument | null {
  return readWorkflowSnapshot(documentId) as WorkflowDocument | null
}

function openProjectDataDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PENDING_DESIGN_DB, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PENDING_DESIGN_STORE)) {
        request.result.createObjectStore(PENDING_DESIGN_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })
}

export async function savePendingDesign(projectId: string, snapshot: unknown): Promise<void> {
  const db = await openProjectDataDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(PENDING_DESIGN_STORE, 'readwrite')
    transaction.objectStore(PENDING_DESIGN_STORE).put(snapshot, projectId)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB write failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB write aborted'))
  }).finally(() => db.close())
}

export async function getPendingDesign(projectId: string): Promise<unknown | undefined> {
  const db = await openProjectDataDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PENDING_DESIGN_STORE, 'readonly')
    const request = transaction.objectStore(PENDING_DESIGN_STORE).get(projectId)
    request.onsuccess = () => resolve(request.result as unknown | undefined)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'))
    transaction.oncomplete = () => db.close()
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('IndexedDB read aborted')) }
  })
}

export async function deletePendingDesign(projectId: string): Promise<void> {
  const db = await openProjectDataDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(PENDING_DESIGN_STORE, 'readwrite')
    transaction.objectStore(PENDING_DESIGN_STORE).delete(projectId)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB delete failed'))
  }).finally(() => db.close())
}
