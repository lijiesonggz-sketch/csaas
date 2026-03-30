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
      }),
    ).toBe('/compliance-intelligence/control-explain/control-123?organizationId=org-456')
  })

  it('should call apiFetch with the control-explain path', async () => {
    ;(apiFetch as jest.Mock).mockResolvedValue({
      control: {
        controlCode: 'CTRL-001',
        controlName: '测试控制点',
      },
      applicabilityReason: '测试原因',
      clauses: [],
      cases: [],
      evidences: [],
      questions: [],
      remediations: [],
    })

    await getControlExplain({
      controlId: 'control-123',
      organizationId: 'org-456',
    })

    expect(apiFetch).toHaveBeenCalledWith(
      '/compliance-intelligence/control-explain/control-123?organizationId=org-456',
    )
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
      }),
    ).rejects.toThrow('controlId and organizationId are required for control detail drawer')

    expect(apiFetch).not.toHaveBeenCalled()
  })
})
