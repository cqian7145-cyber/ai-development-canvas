'use client'

import dynamic from 'next/dynamic'
import { useState, useSyncExternalStore } from 'react'
import {
  AlignLeft,
  Check,
  ChevronDown,
  Command,
  GitBranch,
  LayoutGrid,
  MousePointer2,
  Plus,
  Settings2,
  Shapes,
  Sparkles,
  Workflow,
} from 'lucide-react'

const DesignCanvas = dynamic(() => import('@/components/canvas/design-canvas').then((mod) => mod.DesignCanvas), { ssr: false })
const WorkflowCanvas = dynamic(() => import('@/components/workflow/workflow-canvas').then((mod) => mod.WorkflowCanvas), { ssr: false })

type CanvasMode = 'design' | 'workflow'

const subscribeToMobileViewport = (notify: () => void) => {
  const media = window.matchMedia('(max-width: 760px)')
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}

const getIsMobileViewport = () => window.matchMedia('(max-width: 760px)').matches

export function Workspace() {
  const [mode, setMode] = useState<CanvasMode>('workflow')
  const isMobile = useSyncExternalStore(subscribeToMobileViewport, getIsMobileViewport, () => false)
  const [inspectorOverride, setInspectorOverride] = useState<boolean | null>(null)
  const showInspector = inspectorOverride ?? !isMobile
  const [addNode, setAddNode] = useState<(() => void) | undefined>()

  return (
    <div className="workspace">
      <aside className="sidebar" aria-label="项目导航">
        <div className="brand">
          <span className="brand-mark"><Command size={15} strokeWidth={2.3} /></span>
          <span className="brand-name">Canvas Studio</span>
        </div>
        <div className="sidebar-label">Workspace</div>
        <div className="project-row"><LayoutGrid size={14} /><span>ADC Workspace</span><ChevronDown size={12} className="side-meta" /></div>
        <nav aria-label="画布视图">
          <button className={`side-link ${mode === 'design' ? 'active' : ''}`} onClick={() => setMode('design')}><Shapes size={14} /><span>Design canvas</span></button>
          <button className={`side-link ${mode === 'workflow' ? 'active' : ''}`} onClick={() => setMode('workflow')}><Workflow size={14} /><span>Workflow canvas</span><span className="side-meta">5</span></button>
        </nav>
        <div className="sidebar-label">Project</div>
        <button className="side-link"><GitBranch size={14} /><span>Phase 0 setup</span></button>
        <button className="side-link"><AlignLeft size={14} /><span>Notes</span></button>
        <div className="sidebar-bottom">Local workspace<br />Changes stay in this browser</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="crumbs"><span>ADC Workspace</span><span>/</span><span className="crumb-current">{mode === 'design' ? 'Design canvas' : 'Workflow canvas'}</span></div>
          <div className="top-actions">
            <span className="status-chip"><span className="status-dot" />Saved locally</span>
            <button className={`icon-button ${showInspector ? 'selected' : ''}`} aria-label="切换属性面板" aria-pressed={showInspector} onClick={() => setInspectorOverride((current) => !(current ?? !isMobile))}><Settings2 size={15} /></button>
          </div>
        </header>

        <div className="canvas-toolbar">
          <div className="view-tabs" role="tablist" aria-label="工作区视图">
            <button role="tab" aria-selected={mode === 'design'} className={`view-tab ${mode === 'design' ? 'active' : ''}`} onClick={() => setMode('design')}><Shapes size={14} />Design</button>
            <button role="tab" aria-selected={mode === 'workflow'} className={`view-tab ${mode === 'workflow' ? 'active' : ''}`} onClick={() => setMode('workflow')}><Workflow size={14} />Workflow</button>
          </div>
          <div className="tool-actions">
            {mode === 'workflow' ? <button className="text-button primary" onClick={() => addNode?.()}><Plus size={13} />Add node</button> : <span className="crumbs"><MousePointer2 size={13} /><span className="optional-label">Use the canvas toolbar to draw</span></span>}
          </div>
        </div>

        <section className="stage" aria-label={`${mode === 'design' ? 'Design' : 'Workflow'} canvas workspace`}>
          <div className="stage-content">
            <div className="canvas-frame" aria-hidden={false}>
              {mode === 'design' ? <DesignCanvas /> : <WorkflowCanvas onRegisterAddNode={setAddNode} />}
            </div>
            {mode === 'workflow' && <div className="canvas-hint"><Sparkles size={12} />Example flow only · no AI executor connected</div>}
          </div>
          {showInspector && <aside className={`side-panel ${showInspector ? 'is-open' : ''}`} aria-label="画布信息">
            <h2 className="panel-title">{mode === 'workflow' ? 'Workflow overview' : 'Canvas overview'}</h2>
            <p className="panel-copy">{mode === 'workflow' ? 'A sample product development sequence. Drag nodes to rearrange, or connect handles to change the flow.' : 'A freeform space for visual references, sketches, and notes.'}</p>
            <div className="panel-section"><p className="panel-label">CURRENT VIEW</p><div className="panel-value">{mode === 'workflow' ? 'Workflow canvas' : 'Design canvas'}</div></div>
            <div className="panel-section"><p className="panel-label">STORAGE</p><div className="panel-value"><Check size={12} style={{ display: 'inline', verticalAlign: '-2px', color: '#258a5b' }} /> Saved in this browser</div></div>
            <div className="panel-section"><p className="panel-label">PHASE 0</p><div className="panel-value">Local canvas tools only. Workflow nodes are examples and do not run AI tasks.</div></div>
          </aside>}
        </section>
      </main>
    </div>
  )
}
