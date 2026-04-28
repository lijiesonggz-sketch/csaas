import {
  exportTaxonomyRuntimeProfile,
  getReasoningChain,
  getRegulationGraph,
  getTaxonomyTree,
  listRegulationSources,
} from './knowledge-graph'
import { apiFetch, clearTokenCache, getAuthToken } from '../utils/api'

// Mock apiFetch
jest.mock('../utils/api', () => ({
  apiFetch: jest.fn(),
  clearTokenCache: jest.fn(),
  getAuthToken: jest.fn(),
}))

const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>
const mockedClearTokenCache = clearTokenCache as jest.MockedFunction<typeof clearTokenCache>
const mockedGetAuthToken = getAuthToken as jest.MockedFunction<typeof getAuthToken>

describe('knowledge-graph API client', () => {
  const originalFetch = global.fetch
  const originalCreateObjectUrl = window.URL.createObjectURL
  const originalRevokeObjectUrl = window.URL.revokeObjectURL
  const originalAnchorClick = HTMLAnchorElement.prototype.click

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn() as unknown as typeof fetch
    window.URL.createObjectURL = jest.fn(() => 'blob:taxonomy-runtime-profile')
    window.URL.revokeObjectURL = jest.fn()
    HTMLAnchorElement.prototype.click = jest.fn()
  })

  afterAll(() => {
    global.fetch = originalFetch
    window.URL.createObjectURL = originalCreateObjectUrl
    window.URL.revokeObjectURL = originalRevokeObjectUrl
    HTMLAnchorElement.prototype.click = originalAnchorClick
  })

  describe('[P0] getTaxonomyTree', () => {
    it('应该调用正确的 API 端点', async () => {
      const mockData = [
        {
          l1Code: 'IT01',
          l1Name: '战略与治理',
          children: [{ l2Code: 'IT01-01', l2Name: 'IT战略规划', failureModeCount: 5 }],
        },
      ]

      mockedApiFetch.mockResolvedValue(mockData)

      const result = await getTaxonomyTree()

      expect(mockedApiFetch).toHaveBeenCalledWith('/api/admin/knowledge-graph/taxonomy/tree', {
        cache: 'no-store',
      })
      expect(result).toEqual(mockData)
    })

    it('应该返回空数组当 API 返回空数据', async () => {
      mockedApiFetch.mockResolvedValue([])

      const result = await getTaxonomyTree()

      expect(result).toEqual([])
    })

    it('应该抛出错误当 API 调用失败', async () => {
      const error = new Error('Network error')
      mockedApiFetch.mockRejectedValue(error)

      await expect(getTaxonomyTree()).rejects.toThrow('Network error')
    })
  })

  describe('[P0] getReasoningChain', () => {
    it('应该调用正确的 API 端点并传递 l2Code', async () => {
      const mockData = {
        taxonomy: {
          l1Code: 'IT01',
          l1Name: '战略与治理',
          l2Code: 'IT01-01',
          l2Name: 'IT战略规划',
        },
        failureModes: [
          {
            failureModeId: 'fm-1',
            failureModeCode: 'FM-IT01-001',
            name: 'IT战略与业务战略不一致',
            category: 'DEFINITION_ERROR' as const,
            controlPointCount: 3,
          },
        ],
        controlPoints: [
          {
            controlId: 'cp-1',
            controlCode: 'CP-IT01-001',
            controlName: 'IT战略规划流程',
            maturityLevel: 'hard',
            authoritativeScore: 0.95,
            originType: 'standard',
            failureModeRelevance: 'PRIMARY' as const,
            failureModeId: 'fm-1',
          },
        ],
        obligations: [
          {
            obligationId: 'ob-1',
            obligationCode: 'OBL-IT01-001',
            obligationText: '应当建立IT战略规划流程',
            obligationType: 'MANDATORY' as const,
            controlId: 'cp-1',
            coverage: 'FULL' as const,
          },
        ],
      }

      mockedApiFetch.mockResolvedValue(mockData)

      const result = await getReasoningChain('IT01-01')

      expect(mockedApiFetch).toHaveBeenCalledWith(
        '/api/admin/knowledge-graph/reasoning-chain/IT01-01',
        { cache: 'no-store' }
      )
      expect(result).toEqual(mockData)
    })

    it('应该正确处理不同的 l2Code 格式', async () => {
      const mockData = {
        taxonomy: { l1Code: 'IT02', l1Name: '数据管理', l2Code: 'IT02-01', l2Name: '数据质量管理' },
        failureModes: [],
        controlPoints: [],
        obligations: [],
      }

      mockedApiFetch.mockResolvedValue(mockData)

      await getReasoningChain('IT02-01')

      expect(mockedApiFetch).toHaveBeenCalledWith(
        '/api/admin/knowledge-graph/reasoning-chain/IT02-01',
        { cache: 'no-store' }
      )
    })

    it('应该抛出错误当 l2Code 不存在', async () => {
      const error = new Error('taxonomy_l2 INVALID-CODE not found')
      mockedApiFetch.mockRejectedValue(error)

      await expect(getReasoningChain('INVALID-CODE')).rejects.toThrow(
        'taxonomy_l2 INVALID-CODE not found'
      )
    })

    it('应该抛出错误当 API 返回 404', async () => {
      const error = new Error('Not Found')
      mockedApiFetch.mockRejectedValue(error)

      await expect(getReasoningChain('IT99-99')).rejects.toThrow('Not Found')
    })

    it('应该处理空的推理链路数据', async () => {
      const mockData = {
        taxonomy: { l1Code: 'IT03', l1Name: '应用系统', l2Code: 'IT03-01', l2Name: '应用开发' },
        failureModes: [],
        controlPoints: [],
        obligations: [],
      }

      mockedApiFetch.mockResolvedValue(mockData)

      const result = await getReasoningChain('IT03-01')

      expect(result.failureModes).toEqual([])
      expect(result.controlPoints).toEqual([])
      expect(result.obligations).toEqual([])
    })
  })

  describe('[P1] 错误处理', () => {
    it('应该处理网络超时错误', async () => {
      const error = new Error('Request timeout')
      mockedApiFetch.mockRejectedValue(error)

      await expect(getTaxonomyTree()).rejects.toThrow('Request timeout')
    })

    it('应该处理 401 未认证错误', async () => {
      const error = new Error('Unauthorized')
      mockedApiFetch.mockRejectedValue(error)

      await expect(getReasoningChain('IT01-01')).rejects.toThrow('Unauthorized')
    })

    it('应该处理 403 权限错误', async () => {
      const error = new Error('Forbidden')
      mockedApiFetch.mockRejectedValue(error)

      await expect(getReasoningChain('IT01-01')).rejects.toThrow('Forbidden')
    })
  })

  describe('[P0] regulation graph APIs', () => {
    it('应该调用法规来源列表端点', async () => {
      const mockData = {
        items: [
          {
            sourceId: 'source-1',
            sourceCode: 'SRC-001',
            sourceName: '监管指引',
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
      }
      mockedApiFetch.mockResolvedValue(mockData)

      const result = await listRegulationSources({ page: 1, limit: 50, sourceStatus: 'ACTIVE' })

      expect(mockedApiFetch).toHaveBeenCalledWith(
        '/api/admin/knowledge-graph/regulation-sources?page=1&limit=50&sourceStatus=ACTIVE',
        { cache: 'no-store' }
      )
      expect(result).toEqual(mockData)
    })

    it('应该调用法规驱动线聚合端点', async () => {
      const mockData = {
        source: {
          sourceId: 'source-1',
          sourceCode: 'SRC-001',
          sourceName: '监管指引',
          sourceLevel: 'guideline',
          authorityName: '监管机构',
          clauseCount: 1,
          obligationCount: 1,
          controlPointCount: 1,
        },
        clauses: [],
        obligations: [],
        controlPoints: [],
      }
      mockedApiFetch.mockResolvedValue(mockData)

      const result = await getRegulationGraph('source-1')

      expect(mockedApiFetch).toHaveBeenCalledWith(
        '/api/admin/knowledge-graph/regulation-graph/source-1',
        { cache: 'no-store' }
      )
      expect(result).toEqual(mockData)
    })
  })

  describe('[P1] taxonomy governance export', () => {
    it('应该在 401 后刷新 token 并重试导出请求', async () => {
      mockedGetAuthToken.mockResolvedValueOnce('expired-token').mockResolvedValueOnce('fresh-token')
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({
            'content-disposition': 'attachment; filename="taxonomy-runtime-profile.csv"',
          }),
          blob: jest.fn().mockResolvedValue(new Blob(['csv-content'], { type: 'text/csv' })),
        })

      await exportTaxonomyRuntimeProfile()

      expect(mockedClearTokenCache).toHaveBeenCalledTimes(1)
      expect(mockedGetAuthToken).toHaveBeenNthCalledWith(1)
      expect(mockedGetAuthToken).toHaveBeenNthCalledWith(2, true)
      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        '/api/admin/knowledge-graph/taxonomy-governance/runtime-profile/export',
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Headers),
        })
      )
      expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1)
      expect(window.URL.revokeObjectURL).toHaveBeenCalledTimes(1)
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1)
    })

    it('应该在重试后仍失败时抛出导出错误', async () => {
      mockedGetAuthToken.mockResolvedValueOnce('expired-token').mockResolvedValueOnce('fresh-token')
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: new Headers(),
        })

      await expect(exportTaxonomyRuntimeProfile()).rejects.toThrow('导出 Runtime Profile 失败')
    })

    it('应该在 token 没有真正刷新时直接抛出错误而不进行第二次导出请求', async () => {
      mockedGetAuthToken
        .mockResolvedValueOnce('expired-token')
        .mockResolvedValueOnce('expired-token')
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
      })

      await expect(exportTaxonomyRuntimeProfile()).rejects.toThrow('导出 Runtime Profile 失败')

      expect(mockedClearTokenCache).toHaveBeenCalledTimes(1)
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })
})
