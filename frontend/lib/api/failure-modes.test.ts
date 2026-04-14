import {
  createFailureMode,
  createFailureModeControlMap,
  createFailureModeTaxonomyMap,
  deleteFailureModeControlMap,
  deleteFailureModeTaxonomyMap,
  getFailureMode,
  getTaxonomyTree,
  listFailureModes,
  suggestFailureModeCode,
  updateFailureMode,
} from './failure-modes'
import { apiFetch } from '../utils/api'

jest.mock('../utils/api', () => ({
  apiFetch: jest.fn(),
}))

describe('failure-modes API client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('lists failure modes with query filters', async () => {
    ;(apiFetch as jest.Mock).mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 })

    await listFailureModes({
      page: 1,
      limit: 20,
      category: 'DEFINITION_ERROR',
      status: 'ACTIVE',
      keyword: '报送',
    })

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/admin/knowledge-graph/failure-modes?page=1&limit=20&category=DEFINITION_ERROR&status=ACTIVE&keyword=%E6%8A%A5%E9%80%81',
      { cache: 'no-store' }
    )
  })

  it('gets failure mode detail', async () => {
    ;(apiFetch as jest.Mock).mockResolvedValue({})

    await getFailureMode('fm-1')

    expect(apiFetch).toHaveBeenCalledWith('/api/admin/knowledge-graph/failure-modes/fm-1', {
      cache: 'no-store',
    })
  })

  it('creates and updates a failure mode', async () => {
    ;(apiFetch as jest.Mock).mockResolvedValue({})

    await createFailureMode({
      failureModeCode: 'FM-DEF-001',
      name: '报送口径定义错误',
      category: 'DEFINITION_ERROR',
    })
    await updateFailureMode('fm-1', { name: '更新名称' })

    expect(apiFetch).toHaveBeenNthCalledWith(1, '/api/admin/knowledge-graph/failure-modes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        failureModeCode: 'FM-DEF-001',
        name: '报送口径定义错误',
        category: 'DEFINITION_ERROR',
      }),
    })
    expect(apiFetch).toHaveBeenNthCalledWith(2, '/api/admin/knowledge-graph/failure-modes/fm-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '更新名称' }),
    })
  })

  it('creates and deletes taxonomy/control maps', async () => {
    ;(apiFetch as jest.Mock).mockResolvedValue({})

    await createFailureModeTaxonomyMap('fm-1', { l2Code: 'IT04-01' })
    await deleteFailureModeTaxonomyMap('fm-1', 'map-1')
    await createFailureModeControlMap('fm-1', { controlId: 'cp-1', relevance: 'PRIMARY' })
    await deleteFailureModeControlMap('fm-1', 'cmap-1')

    expect(apiFetch).toHaveBeenNthCalledWith(
      1,
      '/api/admin/knowledge-graph/failure-modes/fm-1/taxonomy-maps',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ l2Code: 'IT04-01' }),
      }
    )
    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/admin/knowledge-graph/failure-modes/fm-1/taxonomy-maps/map-1',
      { method: 'DELETE' }
    )
    expect(apiFetch).toHaveBeenNthCalledWith(
      3,
      '/api/admin/knowledge-graph/failure-modes/fm-1/control-maps',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ controlId: 'cp-1', relevance: 'PRIMARY' }),
      }
    )
    expect(apiFetch).toHaveBeenNthCalledWith(
      4,
      '/api/admin/knowledge-graph/failure-modes/fm-1/control-maps/cmap-1',
      { method: 'DELETE' }
    )
  })

  it('gets active taxonomy tree for mapping selection', async () => {
    ;(apiFetch as jest.Mock).mockResolvedValue([])

    await getTaxonomyTree()

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/admin/knowledge-graph/taxonomy/tree?status=ACTIVE',
      {
        cache: 'no-store',
      }
    )
  })

  it('suggests a stable failure mode code from category and existing codes', () => {
    expect(
      suggestFailureModeCode({
        category: 'DEFINITION_ERROR',
        existingCodes: ['FM-DEF-001', 'FM-DEF-002', 'FM-MAP-001'],
      })
    ).toBe('FM-DEF-003')
  })
})
