/* eslint-disable @typescript-eslint/no-require-imports */
require('./register-typescript.cjs')

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { afterEach, test } = require('node:test')

const {
  createProjectExport,
  validateProjectImport,
} = require('../lib/project-format.ts')
const {
  createProjectRecord,
  loadProjectCatalog,
  ProjectStorageError,
  readWorkflowForProject,
  saveProjectCatalog,
  saveWorkflowForProject,
} = require('../lib/project-storage.ts')
const { validateWorkflowConnection } = require('../lib/workflow-validation.ts')

const fixturePath = path.join(__dirname, 'fixtures', 'project-v1.json')
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))

afterEach(() => { delete global.window })

function useMemoryStorage() {
  const values = new Map()
  const storage = {
    getItem(key) { return values.has(key) ? values.get(key) : null },
    setItem(key, value) { values.set(key, String(value)) },
    removeItem(key) { values.delete(key) },
    clear() { values.clear() },
  }
  global.localStorage = storage
  return values
}

function exposeWindowStorage() {
  global.window = { localStorage: global.localStorage }
}

function nodes() {
  return [
    { id: 'req', type: 'workflow', position: { x: 0, y: 0 }, data: { title: '需求', description: '', nodeType: 'requirement', config: {} } },
    { id: 'design', type: 'workflow', position: { x: 100, y: 0 }, data: { title: '设计', description: '', nodeType: 'design', config: {} } },
    { id: 'approval', type: 'workflow', position: { x: 200, y: 0 }, data: { title: '审核', description: '', nodeType: 'approval', config: {} } },
  ]
}

test('project documents stay isolated and restore nodes, edges, and viewport', () => {
  useMemoryStorage()
  exposeWindowStorage()
  const first = createProjectRecord('First')
  const second = createProjectRecord('Second')
  const firstDocument = { nodes: nodes().slice(0, 1), edges: [], viewport: { x: 1, y: 2, zoom: 1 } }
  const secondDocument = { nodes: nodes(), edges: [{ id: 'req-design', source: 'req', target: 'design' }], viewport: { x: -50, y: 30, zoom: 0.8 } }

  saveWorkflowForProject(first.workflowDocumentId, firstDocument)
  saveWorkflowForProject(second.workflowDocumentId, secondDocument)
  saveProjectCatalog({ schemaVersion: 1, projects: [first, second], lastOpenedProjectId: second.projectId })

  assert.deepEqual(readWorkflowForProject(first.workflowDocumentId), firstDocument)
  assert.deepEqual(readWorkflowForProject(second.workflowDocumentId), secondDocument)
  assert.equal(loadProjectCatalog().catalog.lastOpenedProjectId, second.projectId)
  assert.notEqual(first.workflowDocumentId, second.workflowDocumentId)
  assert.notEqual(first.designDocumentId, second.designDocumentId)
  delete global.window
})

test('Phase 0 workflow migrates while retaining its source backup', () => {
  const values = useMemoryStorage()
  exposeWindowStorage()
  const legacy = {
    nodes: [{ id: 'old-analysis', type: 'workflow', position: { x: 4, y: 9 }, data: { label: 'Old requirements', description: 'legacy', kind: 'analysis' } }],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 0.72 },
  }
  localStorage.setItem('adc-phase0-workflow-v1', JSON.stringify(legacy))

  const { catalog } = loadProjectCatalog()
  const migrated = readWorkflowForProject(catalog.projects[0].workflowDocumentId)

  assert.equal(migrated.nodes[0].data.title, 'Old requirements')
  assert.equal(migrated.nodes[0].data.nodeType, 'requirement')
  assert.deepEqual(JSON.parse(values.get('adc-phase0-workflow-v1')), legacy)
  delete global.window
})

test('catalog storage failure reports a typed error without replacing data', () => {
  useMemoryStorage()
  global.localStorage.setItem = () => { throw new Error('quota') }
  assert.throws(() => saveProjectCatalog({ schemaVersion: 1, projects: [], lastOpenedProjectId: '' }), ProjectStorageError)
})

test('connection validator rejects backward, self, missing, and duplicate links', () => {
  const graphNodes = nodes()
  const existing = [{ id: 'req-design', source: 'req', target: 'design', sourceHandle: null, targetHandle: null }]

  assert.match(validateWorkflowConnection({ source: 'design', target: 'req' }, graphNodes, []), /较早/)
  assert.match(validateWorkflowConnection({ source: 'req', target: 'req' }, graphNodes, []), /自身/)
  assert.match(validateWorkflowConnection({ source: 'missing', target: 'design' }, graphNodes, []), /不存在/)
  assert.match(validateWorkflowConnection({ source: 'req', target: 'design' }, graphNodes, existing), /已经存在/)
  assert.equal(validateWorkflowConnection({ source: 'design', target: 'approval' }, graphNodes, []), null)
})

test('project export imports as a fresh project with remapped workflow references and portable media', () => {
  const originalNodeIds = fixture.workflow.nodes.map((node) => node.id)
  const originalProjectId = fixture.project.projectId
  const imported = validateProjectImport(JSON.stringify(fixture))
  const exported = createProjectExport(imported.project, imported.workflow, fixture.design)
  const restored = validateProjectImport(JSON.stringify(exported))
  const asset = restored.designSnapshot.store['asset:-778846990']

  assert.notEqual(imported.project.projectId, originalProjectId)
  assert.ok(imported.workflow.nodes.every((node) => !originalNodeIds.includes(node.id)))
  assert.ok(imported.workflow.edges.every((edge) => imported.workflow.nodes.some((node) => node.id === edge.source) && imported.workflow.nodes.some((node) => node.id === edge.target)))
  assert.equal(restored.workflow.nodes.length, fixture.workflow.nodes.length)
  assert.equal(restored.workflow.edges.length, fixture.workflow.edges.length)
  assert.match(asset.props.src, /^data:image\//)
})

test('malformed, future-version, broken-reference, and non-portable packages reject before storage changes', () => {
  const values = useMemoryStorage()
  saveProjectCatalog({ schemaVersion: 1, projects: [createProjectRecord('Existing')], lastOpenedProjectId: 'existing' })
  const before = new Map(values)
  const future = structuredClone(fixture)
  future.schemaVersion = 999
  const brokenReference = structuredClone(fixture)
  brokenReference.workflow.edges[0].target = 'missing-node'
  const localAsset = structuredClone(fixture)
  const asset = localAsset.design.records.find((record) => record.typeName === 'asset' && record.type === 'image')
  asset.props.src = 'blob:http://localhost/only-this-browser'

  assert.throws(() => validateProjectImport('{'))
  assert.throws(() => validateProjectImport(JSON.stringify(future)), /不受支持/)
  assert.throws(() => validateProjectImport(JSON.stringify(brokenReference)), /不存在的节点/)
  assert.throws(() => validateProjectImport(JSON.stringify(localAsset)), /未内嵌/)
  assert.deepEqual(values, before)
})
