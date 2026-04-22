import {
  buildControlExplainPath,
  getControlExplain,
  normalizeControlExplainError,
} from './compliance-intelligence'
import { apiFetch } from '@/lib/utils/api'

jest.mock('@/lib/utils/api', () => ({
  apiFetch: jest.fn(),
}))

describe('compliance-intelligence API client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should build the control-explain path with organizationId query', () => {
    expect(
      buildControlExplainPath({
        controlId: 'control-123',
        organizationId: 'org-456',
        sourceModule: 'radar',
      }),
    ).toBe('/compliance-intelligence/control-explain/control-123?organizationId=org-456')
  })

  it('should build the admin full-context path without organizationId', () => {
    expect(
      buildControlExplainPath({
        controlId: 'control-123',
        sourceModule: 'admin',
      }),
    ).toBe('/api/admin/knowledge-graph/control-points/control-123/full-context')
  })

  it('should call apiFetch with the control-explain path', async () => {
    ;(apiFetch as jest.Mock).mockResolvedValue({
      control: {
        controlCode: 'CTRL-001',
        controlName: '测试控制点',
      },
      governance: {
        originType: 'both',
        maturityLevel: 'hard',
        authoritativeScore: 0.8333,
        authorityProfile: {
          has_source_basis: true,
        },
        applicableSector: ['银行'],
        sectorRequirements: {
          银行: {
            review_frequency: '季度',
          },
        },
      },
      applicabilityReason: '测试原因',
      failureModes: [
        {
          failureModeId: 'fm-001',
          failureModeCode: 'FM-001',
          name: '测试失效模式',
          category: 'DEFINITION_ERROR',
          relevance: 'PRIMARY',
        },
      ],
      obligations: [
        {
          obligationId: 'obl-001',
          obligationCode: 'OBL-001',
          obligationText: '应当建立复核机制',
          obligationType: 'MANDATORY',
          coverage: 'FULL',
        },
      ],
      reasoningChain: {
        l2: {
          code: 'IT04-04',
          name: 'EAST数据质量不符合规范要求',
        },
        cases: [],
        failureModes: [],
        selectedControl: {
          controlCode: 'CTRL-001',
          controlName: '测试控制点',
        },
        evidenceTypes: [],
      },
      clauses: [],
      cases: [],
      evidences: [],
      questions: [],
      remediations: [],
    })

    const result = await getControlExplain({
      controlId: 'control-123',
      organizationId: 'org-456',
      sourceModule: 'radar',
    })

    expect(apiFetch).toHaveBeenCalledWith(
      '/compliance-intelligence/control-explain/control-123?organizationId=org-456',
    )
    expect(result).toMatchObject({
      governance: {
        originType: 'both',
        maturityLevel: 'hard',
        authoritativeScore: 0.8333,
      },
      failureModes: [
        expect.objectContaining({
          failureModeCode: 'FM-001',
        }),
      ],
      obligations: [
        expect.objectContaining({
          obligationCode: 'OBL-001',
        }),
      ],
      reasoningChain: {
        l2: {
          code: 'IT04-04',
        },
      },
    })
  })

  it('should normalize 403 into a permission error state', () => {
    expect(
      normalizeControlExplainError({
        status: 403,
        message: 'Forbidden resource',
      }),
    ).toEqual({
      kind: 'permission',
      message: '您没有权限查看该控制点详情',
      retryable: true,
      leakedDataKeys: [],
    })
  })

  it('should normalize 500 into a retryable generic error state', () => {
    expect(
      normalizeControlExplainError({
        status: 500,
        message: 'Internal server error',
      }),
    ).toEqual({
      kind: 'generic',
      message: '控制点详情加载失败，请重试',
      retryable: true,
    })
  })

  it('should normalize 404 into a non-retryable unavailable state', () => {
    expect(
      normalizeControlExplainError({
        status: 404,
        message: 'control_point control-123 not found',
      }),
    ).toEqual({
      kind: 'generic',
      message: '该控制点已移除或停用',
      retryable: false,
    })
  })

  it('should normalize 410 into a non-retryable unavailable state', () => {
    expect(
      normalizeControlExplainError({
        status: 410,
        message: 'Gone',
      }),
    ).toEqual({
      kind: 'generic',
      message: '该控制点已移除或停用',
      retryable: false,
    })
  })

  it('should keep generic 404s retryable instead of misclassifying them as removed controls', () => {
    expect(
      normalizeControlExplainError({
        status: 404,
        message: 'Not Found',
      }),
    ).toEqual({
      kind: 'generic',
      message: '控制点详情加载失败，请重试',
      retryable: true,
    })
  })

  it('should fail fast when required context is missing', async () => {
    await expect(
      getControlExplain({
        controlId: '',
        organizationId: 'org-456',
        sourceModule: 'radar',
      }),
    ).rejects.toThrow('controlId and organizationId are required for control detail drawer')

    expect(apiFetch).not.toHaveBeenCalled()
  })
})
