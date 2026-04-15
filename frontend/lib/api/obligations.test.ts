import {
  createObligation,
  createObligationControlMap,
  deleteObligationControlMap,
  getObligation,
  listObligations,
  searchRegulationClauses,
  suggestObligationCode,
  updateObligation,
} from './obligations'
import { apiFetch } from '../utils/api'

jest.mock('../utils/api', () => ({
  apiFetch: jest.fn(),
}))

describe('obligations API client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('lists obligations with query filters', async () => {
    ;(apiFetch as jest.Mock).mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 })

    await listObligations({
      page: 1,
      limit: 20,
      obligationType: 'MANDATORY',
      status: 'ACTIVE',
      applicableSector: '银行',
      keyword: '复核',
    })

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/admin/knowledge-graph/obligations?page=1&limit=20&obligationType=MANDATORY&status=ACTIVE&applicableSector=%E9%93%B6%E8%A1%8C&keyword=%E5%A4%8D%E6%A0%B8',
      { cache: 'no-store' },
    )
  })

  it('gets obligation detail and searches regulation clauses', async () => {
    ;(apiFetch as jest.Mock).mockResolvedValue({})

    await getObligation('obl-1')
    await searchRegulationClauses({ page: 1, limit: 10, keyword: '复核' })

    expect(apiFetch).toHaveBeenNthCalledWith(
      1,
      '/api/admin/knowledge-graph/obligations/obl-1',
      { cache: 'no-store' },
    )
    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/admin/knowledge-graph/regulation-clauses?page=1&limit=10&keyword=%E5%A4%8D%E6%A0%B8',
      { cache: 'no-store' },
    )
  })

  it('creates and updates an obligation', async () => {
    ;(apiFetch as jest.Mock).mockResolvedValue({})

    await createObligation({
      clauseId: 'clause-1',
      obligationCode: 'OBL-IT04-4.1-02',
      obligationText: '应当建立复核机制',
      obligationType: 'MANDATORY',
      applicableSector: ['银行'],
      status: 'ACTIVE',
    })
    await updateObligation('obl-1', { obligationText: '更新后的义务描述' })

    expect(apiFetch).toHaveBeenNthCalledWith(
      1,
      '/api/admin/knowledge-graph/obligations',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clauseId: 'clause-1',
          obligationCode: 'OBL-IT04-4.1-02',
          obligationText: '应当建立复核机制',
          obligationType: 'MANDATORY',
          applicableSector: ['银行'],
          status: 'ACTIVE',
        }),
      },
    )
    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/admin/knowledge-graph/obligations/obl-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ obligationText: '更新后的义务描述' }),
      },
    )
  })

  it('creates and deletes obligation control maps', async () => {
    ;(apiFetch as jest.Mock).mockResolvedValue({})

    await createObligationControlMap('obl-1', {
      controlId: 'cp-1',
      coverage: 'FULL',
    })
    await deleteObligationControlMap('obl-1', 'map-1')

    expect(apiFetch).toHaveBeenNthCalledWith(
      1,
      '/api/admin/knowledge-graph/obligations/obl-1/control-maps',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ controlId: 'cp-1', coverage: 'FULL' }),
      },
    )
    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/admin/knowledge-graph/obligations/obl-1/control-maps/map-1',
      { method: 'DELETE' },
    )
  })

  it('suggests a stable obligation code from clause context and existing codes', () => {
    expect(
      suggestObligationCode({
        clauseCode: 'CLAUSE-IT04-REP-001',
        articleNo: '4.1',
        existingCodes: ['OBL-IT04-4.1-01', 'OBL-IT04-4.4-01'],
      }),
    ).toBe('OBL-IT04-4.1-02')
  })
})
