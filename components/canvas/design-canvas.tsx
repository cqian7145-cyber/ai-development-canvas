'use client'

import { useCallback } from 'react'
import { deletePendingDesign, getPendingDesign } from '@/lib/project-storage'
import { loadSnapshot, Tldraw, type Editor } from 'tldraw'

const appliedPendingDesignProjects = new Set<string>()

type DesignCanvasProps = {
  documentId: string
  projectId: string
  onRegisterEditor: (editor: Editor) => void
  onError: (message: string) => void
}

export function DesignCanvas({ documentId, projectId, onRegisterEditor, onError }: DesignCanvasProps) {
  const onMount = useCallback((editor: Editor) => {
    onRegisterEditor(editor)
    void getPendingDesign(projectId).then(async (snapshot) => {
      if (!snapshot) return
      if (appliedPendingDesignProjects.has(projectId)) return
      const expectedStore = (snapshot as { store?: { store?: Record<string, { typeName?: string }> } }).store?.store
      const expectedPageIds = Object.entries(expectedStore ?? {})
        .filter(([, record]) => record.typeName === 'page')
        .map(([id]) => id)
      const currentStore = editor.store.getStoreSnapshot().store
      const currentHasImportedPages = expectedPageIds.length > 0 && expectedPageIds.every((id) => id in currentStore)
      if (currentHasImportedPages) {
        // A later mount proves tldraw's IndexedDB document survived the prior session.
        await deletePendingDesign(projectId)
        return
      }
      loadSnapshot(editor.store, snapshot as Parameters<typeof loadSnapshot>[1])
      // Keep the import seed until a later mount confirms the persisted document contains its page IDs.
      appliedPendingDesignProjects.add(projectId)
    }).catch(() => onError('导入的设计画布暂存数据无法读取，原项目包仍保留在本地浏览器中。'))
  }, [onRegisterEditor, onError, projectId])

  return <div className="design-canvas" style={{ position: 'absolute', inset: 0 }}><Tldraw key={documentId} persistenceKey={documentId} onMount={onMount} /></div>
}
