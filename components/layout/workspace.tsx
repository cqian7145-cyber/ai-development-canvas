'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import {
  Check,
  ChevronDown,
  Command,
  Download,
  FilePlus2,
  GitBranch,
  LayoutGrid,
  Plus,
  Settings2,
  Shapes,
  Sparkles,
  Upload,
  Workflow,
} from 'lucide-react'
import { serializeTldrawJson, type Editor } from 'tldraw'
import { createProjectExport, validateProjectImport, MAX_PROJECT_FILE_BYTES } from '@/lib/project-format'
import {
  createProjectRecord,
  deletePendingDesign,
  loadProjectCatalog,
  savePendingDesign,
  saveProjectCatalog,
  saveWorkflowForProject,
} from '@/lib/project-storage'
import type { ProjectCatalog, ProjectRecord, WorkflowDocument, WorkflowNode } from '@/lib/project-model'
import type { WorkflowCanvasHandle } from '@/components/workflow/workflow-canvas'
import { readWorkflowSnapshot } from '@/lib/workflow-storage'

const DesignCanvas = dynamic(() => import('@/components/canvas/design-canvas').then((mod) => mod.DesignCanvas), { ssr: false })
const WorkflowCanvas = dynamic(() => import('@/components/workflow/workflow-canvas').then((mod) => mod.WorkflowCanvas), { ssr: false })

type CanvasMode = 'design' | 'workflow'
type ProjectDialogMode = 'create' | 'rename' | null

const subscribeToMobileViewport = (notify: () => void) => {
  const media = window.matchMedia('(max-width: 760px)')
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}

const getIsMobileViewport = () => window.matchMedia('(max-width: 760px)').matches

function portableDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('资源读取失败。'))
    reader.onerror = () => reject(new Error('资源读取失败。'))
    reader.readAsDataURL(blob)
  })
}

async function exportPortableDesign(editor: Editor): Promise<Record<string, unknown>> {
  const file = JSON.parse(await serializeTldrawJson(editor)) as Record<string, unknown>
  if (!Array.isArray(file.records)) throw new Error('tldraw 未返回有效文档记录。')
  for (const record of file.records) {
    if (!record || typeof record !== 'object') continue
    const asset = record as Record<string, unknown>
    if (asset.typeName !== 'asset' || (asset.type !== 'image' && asset.type !== 'video')) continue
    const props = asset.props as Record<string, unknown> | undefined
    if (!props || typeof props.src !== 'string' || props.src.startsWith('data:')) continue
    const resolved = await editor.resolveAssetUrl(asset.id as Parameters<Editor['resolveAssetUrl']>[0], { shouldResolveToOriginal: true })
    if (!resolved) throw new Error(`资源 ${String(props.name ?? '')} 无法读取，未生成不完整导出文件。`)
    const response = await fetch(resolved)
    if (!response.ok) throw new Error(`资源 ${String(props.name ?? '')} 读取失败，未生成不完整导出文件。`)
    const blob = await response.blob()
    if (!blob.type.startsWith('image/') && !blob.type.startsWith('video/')) throw new Error('发现无法安全导出的画布资源类型。')
    props.src = await portableDataUrl(blob)
  }
  return file
}

function safeFileName(name: string): string {
  return name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 80) || 'adc-project'
}

export function Workspace() {
  const [mode, setMode] = useState<CanvasMode>('workflow')
  const [inspectorOverride, setInspectorOverride] = useState<boolean | null>(null)
  const [catalog, setCatalog] = useState<ProjectCatalog | null>(null)
  const [catalogReadOnly, setCatalogReadOnly] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error' | 'warning'; text: string } | null>(null)
  const [dialogMode, setDialogMode] = useState<ProjectDialogMode>(null)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [workflowHandle, setWorkflowHandle] = useState<WorkflowCanvasHandle | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null)
  const [configDraft, setConfigDraft] = useState('{}')
  const [configError, setConfigError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeProject = catalog?.projects.find((project) => project.projectId === catalog.lastOpenedProjectId) ?? null

  const subscribe = useCallback((notify: () => void) => subscribeToMobileViewport(notify), [])
  const getMobile = useCallback(() => getIsMobileViewport(), [])
  const mobile = useSyncExternalStore(subscribe, getMobile, () => false)
  const showInspector = inspectorOverride ?? !mobile

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const result = loadProjectCatalog()
        setCatalog(result.catalog)
        if (result.warning) setMessage({ kind: 'warning', text: result.warning })
      } catch (error) {
        const temporary = createProjectRecord('临时工作区', '项目目录不可用时的临时会话；项目列表不会持久化')
        setCatalog({ schemaVersion: 1, projects: [temporary], lastOpenedProjectId: temporary.projectId })
        setCatalogReadOnly(true)
        setMessage({
          kind: 'warning',
          text: `${error instanceof Error ? error.message : '无法读取项目目录。'} 画布仍可交互，但项目列表更改不会跨刷新保存。`,
        })
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const selectWorkflowNode = useCallback((node: WorkflowNode | null) => {
    setSelectedNode(node)
    setConfigDraft(node ? JSON.stringify(node.data.config, null, 2) : '{}')
    setConfigError('')
  }, [])

  const updateCatalog = useCallback((next: ProjectCatalog) => {
    if (catalogReadOnly) {
      setCatalog(next)
      return true
    }
    try {
      saveProjectCatalog(next)
      setCatalog(next)
      return true
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : '项目目录保存失败。' })
      return false
    }
  }, [catalogReadOnly])

  const switchProject = useCallback((projectId: string) => {
    if (!catalog || !catalog.projects.some((project) => project.projectId === projectId)) return
    const next = { ...catalog, lastOpenedProjectId: projectId }
    if (updateCatalog(next)) {
      setEditor(null)
      setWorkflowHandle(null)
      selectWorkflowNode(null)
      setMessage(null)
    }
  }, [catalog, updateCatalog, selectWorkflowNode])

  const openCreateDialog = useCallback(() => {
    setProjectName('新项目')
    setProjectDescription('')
    setDialogMode('create')
  }, [])

  const openRenameDialog = useCallback(() => {
    if (!activeProject) return
    setProjectName(activeProject.name)
    setProjectDescription(activeProject.description)
    setDialogMode('rename')
  }, [activeProject])

  const saveProjectDialog = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!catalog || !projectName.trim()) return
    if (dialogMode === 'create') {
      const project = createProjectRecord(projectName, projectDescription)
      const next: ProjectCatalog = { ...catalog, projects: [...catalog.projects, project], lastOpenedProjectId: project.projectId }
      if (updateCatalog(next)) {
        setEditor(null)
        setWorkflowHandle(null)
        selectWorkflowNode(null)
        setMessage({ kind: 'success', text: `已创建项目“${project.name}”。` })
        setDialogMode(null)
      }
      return
    }
    if (dialogMode === 'rename' && activeProject) {
      const now = new Date().toISOString()
      const next: ProjectCatalog = {
        ...catalog,
        projects: catalog.projects.map((project) => project.projectId === activeProject.projectId
          ? { ...project, name: projectName.trim(), description: projectDescription.trim(), updatedAt: now }
          : project),
      }
      if (updateCatalog(next)) {
        setMessage({ kind: 'success', text: '项目资料已保存。' })
        setDialogMode(null)
      }
    }
  }, [catalog, projectName, projectDescription, dialogMode, activeProject, updateCatalog, selectWorkflowNode])

  const handleExport = useCallback(async () => {
    if (!activeProject || !editor) {
      setMessage({ kind: 'error', text: '画布仍在初始化，请稍后重试导出。' })
      return
    }
    try {
      const design = await exportPortableDesign(editor)
      const workflow = readWorkflowSnapshot(activeProject.workflowDocumentId)
      const snapshot: WorkflowDocument = {
        nodes: (workflow?.nodes as WorkflowDocument['nodes'] | undefined) ?? [],
        edges: workflow?.edges ?? [],
        viewport: workflow?.viewport ?? { x: 0, y: 0, zoom: 0.72 },
      }
      const output = createProjectExport(activeProject, snapshot, design)
      const json = JSON.stringify(output, null, 2)
      if (new Blob([json]).size > MAX_PROJECT_FILE_BYTES) throw new Error('导出文件超过 25 MB 限制。')
      const blobUrl = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `${safeFileName(activeProject.name)}.adc-project.json`
      link.click()
      URL.revokeObjectURL(blobUrl)
      setMessage({ kind: 'success', text: '项目 JSON 已导出，画布资源已内嵌。' })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : '项目导出失败。' })
    }
  }, [activeProject, editor])

  const handleImport = useCallback(async (file: File | undefined) => {
    if (!file || !catalog) return
    if (file.size > MAX_PROJECT_FILE_BYTES) {
      setMessage({ kind: 'error', text: '项目文件超过 25 MB 限制。' })
      return
    }
    let createdProject: ProjectRecord | null = null
    try {
      const validated = validateProjectImport(await file.text())
      createdProject = validated.project
      await savePendingDesign(createdProject.projectId, validated.designSnapshot)
      saveWorkflowForProject(createdProject.workflowDocumentId, validated.workflow)
      const next: ProjectCatalog = {
        ...catalog,
        projects: [...catalog.projects, createdProject],
        lastOpenedProjectId: createdProject.projectId,
      }
      if (!updateCatalog(next)) {
        await deletePendingDesign(createdProject.projectId)
        localStorage.removeItem(`adc-workflow-document-v1:${createdProject.workflowDocumentId}`)
        return
      }
      setEditor(null)
      setWorkflowHandle(null)
      selectWorkflowNode(null)
      setMessage({ kind: 'success', text: `已将“${createdProject.name}”导入为新项目。` })
    } catch (error) {
      if (createdProject) {
        await deletePendingDesign(createdProject.projectId).catch(() => undefined)
        localStorage.removeItem(`adc-workflow-document-v1:${createdProject.workflowDocumentId}`)
      }
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : '项目导入失败，现有项目未更改。' })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [catalog, updateCatalog, selectWorkflowNode])

  const updateSelectedNode = useCallback((patch: Partial<WorkflowNode['data']>) => {
    if (!selectedNode) return
    workflowHandle?.updateNode(selectedNode.id, patch)
    setSelectedNode((current) => current ? { ...current, data: { ...current.data, ...patch } } : current)
  }, [selectedNode, workflowHandle])

  const updateConfig = useCallback((raw: string) => {
    setConfigDraft(raw)
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('配置必须是 JSON 对象。')
      setConfigError('')
      updateSelectedNode({ config: parsed as Record<string, unknown> })
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : 'JSON 格式无效。')
    }
  }, [updateSelectedNode])

  if (!catalog || !activeProject) return <main className="workspace-loading" aria-live="polite">正在读取本地项目…</main>

  const inspectorTitle = selectedNode ? '节点属性' : mode === 'workflow' ? 'Workflow overview' : 'Canvas overview'

  return (
    <div className="workspace">
      <aside className="sidebar" aria-label="项目导航">
        <div className="brand"><span className="brand-mark"><Command aria-hidden="true" size={15} strokeWidth={2.3} /></span><span className="brand-name">Canvas Studio</span></div>
        <div className="sidebar-label">Workspace</div>
        <label className="project-select-wrap" aria-label="切换项目">
          <LayoutGrid aria-hidden="true" size={14} />
          <select className="project-select" value={activeProject.projectId} onChange={(event) => switchProject(event.target.value)} aria-label="当前项目">
            {catalog.projects.map((project) => <option key={project.projectId} value={project.projectId}>{project.name}</option>)}
          </select>
          <ChevronDown aria-hidden="true" size={12} />
        </label>
        <nav aria-label="画布视图">
          <button className={`side-link ${mode === 'design' ? 'active' : ''}`} onClick={() => setMode('design')}><Shapes aria-hidden="true" size={14} /><span>Design canvas</span></button>
          <button className={`side-link ${mode === 'workflow' ? 'active' : ''}`} onClick={() => setMode('workflow')}><Workflow aria-hidden="true" size={14} /><span>Workflow canvas</span></button>
        </nav>
        <div className="sidebar-label">Project</div>
        <button className="side-link" onClick={openRenameDialog}><GitBranch aria-hidden="true" size={14} /><span>Project details</span></button>
        <div className="sidebar-bottom">Local workspace<br />Changes stay in this browser</div>
      </aside>

      <a className="skip-link" href="#workspace-main">跳至工作区</a>
      <main className="main" id="workspace-main">
        <h1 className="visually-hidden">AI Development Canvas — {activeProject.name}</h1>
        <header className="topbar">
          <div className="crumbs"><span className="project-crumb">{activeProject.name}</span><span>/</span><span className="crumb-current">{mode === 'design' ? 'Design canvas' : 'Workflow canvas'}</span></div>
          <div className="top-actions">
            <span className="status-chip"><span className="status-dot" />{catalogReadOnly ? 'Temporary session' : 'Saved locally'}</span>
            <button className={`icon-button ${showInspector ? 'selected' : ''}`} aria-label="切换属性面板" aria-pressed={showInspector} onClick={() => setInspectorOverride((current) => !(current ?? !mobile))}><Settings2 aria-hidden="true" size={15} /></button>
          </div>
        </header>

        <div className="canvas-toolbar">
          <div className="view-tabs" role="tablist" aria-label="工作区视图">
            <button role="tab" aria-selected={mode === 'design'} className={`view-tab ${mode === 'design' ? 'active' : ''}`} onClick={() => setMode('design')}><Shapes aria-hidden="true" size={14} />Design</button>
            <button role="tab" aria-selected={mode === 'workflow'} className={`view-tab ${mode === 'workflow' ? 'active' : ''}`} onClick={() => setMode('workflow')}><Workflow aria-hidden="true" size={14} />Workflow</button>
          </div>
          <div className="tool-actions">
            {mode === 'workflow' && <button className="text-button primary" onClick={() => workflowHandle?.addNode()}><Plus aria-hidden="true" size={13} />Add node</button>}
            <button className="text-button" onClick={openCreateDialog}><FilePlus2 aria-hidden="true" size={13} /><span className="optional-label">New project</span><span className="compact-label">New</span></button>
            <button className="text-button" onClick={handleExport} aria-label="导出项目 JSON"><Download aria-hidden="true" size={13} /><span className="optional-label">Export</span></button>
            <button className="text-button" onClick={() => fileInputRef.current?.click()} aria-label="导入项目 JSON"><Upload aria-hidden="true" size={13} /><span className="optional-label">Import</span></button>
            <input ref={fileInputRef} className="visually-hidden" type="file" accept=".json,application/json" aria-label="选择项目 JSON 文件" onChange={(event) => void handleImport(event.target.files?.[0])} />
          </div>
        </div>

        <section className="stage" aria-label={`${mode === 'design' ? 'Design' : 'Workflow'} canvas workspace`}>
          <div className="stage-content">
            <div className="canvas-frame">
              <div className="canvas-layer" aria-hidden={mode !== 'design'} style={{ visibility: mode === 'design' ? 'visible' : 'hidden', pointerEvents: mode === 'design' ? 'auto' : 'none' }}>
                <DesignCanvas key={activeProject.projectId} documentId={activeProject.designDocumentId} projectId={activeProject.projectId} onRegisterEditor={setEditor} onError={(text) => setMessage({ kind: 'error', text })} />
              </div>
              <div className="canvas-layer" aria-hidden={mode !== 'workflow'} style={{ visibility: mode === 'workflow' ? 'visible' : 'hidden', pointerEvents: mode === 'workflow' ? 'auto' : 'none' }}>
                <WorkflowCanvas key={activeProject.projectId} documentId={activeProject.workflowDocumentId} onRegister={setWorkflowHandle} onSelectNode={selectWorkflowNode} />
              </div>
            </div>
            {mode === 'workflow' && <div className="canvas-hint"><Sparkles aria-hidden="true" size={12} />Planning only · forward-stage links · no AI executor</div>}
            {message && <div className={`workspace-toast ${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}><span>{message.text}</span><button aria-label="关闭消息" onClick={() => setMessage(null)}>×</button></div>}
          </div>
          {showInspector && <aside className={`side-panel ${showInspector ? 'is-open' : ''}`} aria-label="属性面板">
            <h2 className="panel-title">{inspectorTitle}</h2>
            {selectedNode ? <>
              <p className="panel-copy">编辑规划节点属性。节点不会调用模型或启动外部任务。</p>
              <div className="property-field"><label htmlFor="node-title">标题</label><input id="node-title" name="node-title" autoComplete="off" value={selectedNode.data.title} maxLength={160} onChange={(event) => updateSelectedNode({ title: event.target.value })} /></div>
              <div className="property-field"><label htmlFor="node-description">描述</label><textarea id="node-description" name="node-description" rows={3} maxLength={2000} value={selectedNode.data.description} onChange={(event) => updateSelectedNode({ description: event.target.value })} /></div>
              <div className="property-field"><label htmlFor="node-type">节点类型</label><input id="node-type" value={selectedNode.data.nodeType} readOnly /></div>
              <div className="property-field"><label htmlFor="node-config">配置（JSON）</label><textarea id="node-config" name="node-config" className="config-editor" rows={9} spellCheck={false} value={configDraft} onChange={(event) => updateConfig(event.target.value)} aria-invalid={Boolean(configError)} />{configError && <span className="field-error" role="alert">{configError}</span>}</div>
            </> : <>
              <p className="panel-copy">{mode === 'workflow' ? '选择节点后可编辑标题、描述与安全的 JSON 配置。此流程只表达计划。' : '自由绘制画布用于视觉参考、草图与备注。'}</p>
              <div className="panel-section"><p className="panel-label">PROJECT</p><div className="panel-value">{activeProject.name}</div></div>
              <div className="panel-section"><p className="panel-label">STORAGE</p><div className="panel-value">{catalogReadOnly ? 'Temporary session · project list will not persist' : <><Check aria-hidden="true" size={12} style={{ display: 'inline', verticalAlign: '-2px', color: '#258a5b' }} /> Saved in this browser</>}</div></div>
              <div className="panel-section"><p className="panel-label">PHASE 1</p><div className="panel-value">Each project owns a separate design document and workflow.</div></div>
            </>}
          </aside>}
        </section>
      </main>

      {dialogMode && <div className="dialog-backdrop" role="presentation">
        <form className="project-dialog" role="dialog" aria-modal="true" aria-labelledby="project-dialog-title" onSubmit={saveProjectDialog}>
          <h2 id="project-dialog-title">{dialogMode === 'create' ? '新建项目' : '项目资料'}</h2>
          <p>项目数据保存在当前浏览器中。</p>
          <label htmlFor="project-name">项目名称</label>
          <input id="project-name" name="project-name" autoComplete="off" autoFocus required maxLength={120} value={projectName} onChange={(event) => setProjectName(event.target.value)} />
          <label htmlFor="project-description">项目描述</label>
          <textarea id="project-description" name="project-description" rows={3} maxLength={2000} value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} />
          <div className="dialog-actions"><button type="button" className="text-button" onClick={() => setDialogMode(null)}>取消</button><button type="submit" className="text-button primary">保存</button></div>
        </form>
      </div>}
    </div>
  )
}
