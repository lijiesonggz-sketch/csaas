import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ControlDetailDrawer } from './ControlDetailDrawer'
import { getControlExplain } from '@/lib/api/compliance-intelligence'

const mockPush = jest.fn()

jest.mock('@/lib/api/compliance-intelligence', () => ({
  getControlExplain: jest.fn(),
  normalizeControlExplainError: jest.requireActual('@/lib/api/compliance-intelligence').normalizeControlExplainError,
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('ControlDetailDrawer', () => {
  const baseResponse = {
    control: {
      controlId: 'control-001',
      controlCode: 'CTRL-DG-004',
      controlName: '监管报送准确性控制',
      controlDesc: '确保监管报送口径、校验与对账控制稳定执行',
      l1: {
        code: 'IT04',
        name: '数据治理与监管数据报送',
      },
      l2: {
        code: 'IT04-06',
        name: '监管报送准确性控制',
      },
    },
    governance: {
      originType: 'both',
      maturityLevel: 'hard',
      authoritativeScore: 0.8333,
      authorityProfile: {
        has_source_basis: true,
        has_applicability_scope: true,
        has_control_activity: true,
        has_expected_evidence: true,
        has_human_review: true,
        has_case_validation: false,
      },
      applicableSector: ['银行', '证券'],
      sectorRequirements: {
        银行: {
          review_frequency: '季度',
          log_retention: '6个月',
        },
      },
    },
    applicabilityReason: '机构属于银行业且监管关注度高，需强化报送控制',
    failureModes: [
      {
        failureModeId: 'fm-001',
        failureModeCode: 'FM-REP-001',
        name: '报送口径定义错误',
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
        clause: {
          clauseId: 'clause-001',
          clauseCode: 'REG-BANK-IT-042',
          articleNo: '第42条',
        },
      },
    ],
    reasoningChain: {
      l2: {
        code: 'IT04-06',
        name: '监管报送准确性控制',
      },
      cases: [
        {
          caseCode: 'CASE-PBOC-2024-001',
          caseTitle: '某银行因报送不准被罚 50 万',
        },
      ],
      failureModes: [
        {
          failureModeId: 'fm-001',
          failureModeCode: 'FM-REP-001',
          name: '报送口径定义错误',
          relevance: 'PRIMARY',
        },
      ],
      selectedControl: {
        controlId: 'control-001',
        controlCode: 'CTRL-DG-004',
        controlName: '监管报送准确性控制',
        maturityLevel: 'hard',
        authoritativeScore: 0.8333,
      },
      evidenceTypes: [
        {
          evidenceId: 'evidence-001',
          evidenceCode: 'EVD-REPORT-001',
          evidenceName: '报送对账记录',
          evidenceCategory: 'DOCUMENT',
          autoCollectable: false,
          requiredLevel: 'HIGH',
          frequency: 'monthly',
        },
      ],
    },
    clauses: [
      {
        clauseCode: 'REG-BANK-IT-042',
        articleNo: '第42条',
        clauseText: '金融机构应建立监管报送校验与复核机制。',
      },
    ],
    cases: [
      {
        caseId: 'case-001',
        caseCode: 'CASE-PBOC-2024-001',
        caseTitle: '某银行因报送不准被罚 50 万',
        relationType: 'VIOLATES',
        confidenceScore: '0.9100',
      },
    ],
    evidences: [
      {
        evidenceCode: 'EVD-REPORT-001',
        evidenceName: '报送对账记录',
        requiredLevel: 'required',
        description: '监管报送前后的自动校验与人工复核记录',
      },
    ],
    questions: [
      {
        questionId: 'Q-CTRL-DG-004-01',
        questionText: '是否建立监管报送数据源到报送口径的映射台账？',
        questionType: 'single_choice',
        scoringRule: 'A=5,B=3,C=0',
      },
    ],
    remediations: [
      {
        remediationActionId: 'RA-CTRL-DG-004-01',
        title: '建立监管报送双人复核流程',
        description: '将关键报送口径纳入提交前复核清单',
        priority: 'HIGH',
      },
    ],
  }

  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    organizationId: 'org-001',
    controlId: 'control-001',
    sourceModule: 'radar' as const,
    sourceRecordId: 'push-001',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockPush.mockReset()
    ;(getControlExplain as jest.Mock).mockResolvedValue(baseResponse)
  })

  it('should render controlCode, controlName and radar source badge in header', async () => {
    render(<ControlDetailDrawer {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('CTRL-DG-004 · 监管报送准确性控制')).toBeInTheDocument()
    })

    expect(screen.getByTestId('control-detail-source-badge')).toHaveTextContent('来自雷达')
  })

  it('should render governance summary badges, score and authority checklist in an expandable panel', async () => {
    render(<ControlDetailDrawer {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByTestId('control-detail-origin-badge')).toHaveTextContent('双轨覆盖')
    })

    expect(screen.getByTestId('control-detail-maturity-badge')).toHaveTextContent('正式硬控制点')
    expect(screen.getByText('83%')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /6 项.*权威度构成维度/ }))
    expect(screen.getByText('有来源依据')).toBeInTheDocument()
    expect(screen.getByText('有案例验证')).toBeInTheDocument()
  })

  it('should render sections in the fixed shared order', async () => {
    render(<ControlDetailDrawer {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByTestId('control-detail-section-governance-summary')).toBeInTheDocument()
    })

    const sectionOrder = Array.from(document.body.querySelectorAll('[data-section-key]')).map((node) =>
      node.getAttribute('data-section-key'),
    )

    expect(sectionOrder).toEqual([
      'governance-summary',
      'sector-requirements',
      'failure-modes',
      'obligations',
      'reasoning-chain',
      'cases',
      'applicabilityReason',
      'clauses',
      'evidences',
      'questions',
      'remediations',
    ])
  })

  it('should render sector requirements, failure mode cards, obligation cards and the reasoning chain', async () => {
    render(<ControlDetailDrawer {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByTestId('control-detail-section-sector-requirements')).toBeInTheDocument()
    })

    expect(screen.getByTestId('control-detail-sector-requirements')).toHaveTextContent('银行')
    fireEvent.click(screen.getByRole('button', { name: /银行.*项差异化参数/ }))
    expect(screen.getByText('季度')).toBeInTheDocument()
    expect(screen.getByTestId('control-detail-failure-mode-cards')).toHaveTextContent('FM-REP-001')
    expect(screen.getByTestId('control-detail-obligation-cards')).toHaveTextContent('应当建立复核机制')
    expect(screen.getByTestId('control-detail-reasoning-chain')).toBeInTheDocument()
    expect(screen.getByText('CTRL-DG-004')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('control-detail-reasoning-step-cases'))
    expect(screen.getByTestId('control-detail-reasoning-step-panel-cases')).toHaveTextContent(
      'CASE-PBOC-2024-001',
    )
  })

  it('should show explicit empty states while keeping populated sections visible', async () => {
    ;(getControlExplain as jest.Mock).mockResolvedValue({
      ...baseResponse,
      failureModes: [],
      obligations: [],
      reasoningChain: {
        ...baseResponse.reasoningChain,
        cases: [],
        evidenceTypes: [],
      },
      clauses: [],
      cases: [],
      questions: [],
    })

    render(<ControlDetailDrawer {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('暂无法规条款')).toBeInTheDocument()
    })

    expect(screen.getByText('暂无处罚案例')).toBeInTheDocument()
    expect(screen.getByText('暂无问卷题目')).toBeInTheDocument()
    expect(screen.getByText('当前控制点暂无失效模式映射')).toBeInTheDocument()
    expect(screen.getByText('当前控制点暂无法规义务映射')).toBeInTheDocument()
    expect(screen.getByText('监管报送前后的自动校验与人工复核记录')).toBeInTheDocument()
  })

  it('should truncate obligation card text to a 100-character summary', async () => {
    const longObligationText = 'A'.repeat(120)
    ;(getControlExplain as jest.Mock).mockResolvedValueOnce({
      ...baseResponse,
      obligations: [
        {
          ...baseResponse.obligations[0],
          obligationText: longObligationText,
        },
      ],
    })

    render(<ControlDetailDrawer {...defaultProps} />)

    await waitFor(() =>
      expect(screen.getByTestId('control-detail-obligation-cards')).toBeInTheDocument(),
    )
    expect(screen.getByText(`${'A'.repeat(100)}...`)).toBeInTheDocument()
    expect(screen.queryByText(longObligationText)).not.toBeInTheDocument()
  })

  it('should show a loading-only content state while request is pending', () => {
    ;(getControlExplain as jest.Mock).mockImplementation(
      () => new Promise(() => undefined),
    )

    render(<ControlDetailDrawer {...defaultProps} />)

    expect(screen.getByTestId('control-detail-loading')).toBeInTheDocument()
    const overlay = screen.queryByTestId('control-detail-overlay')
    if (overlay) {
      expect(overlay).toHaveClass('pointer-events-none')
    }
  })

  it('should clear previous detail data on permission error and show stable permission copy', async () => {
    ;(getControlExplain as jest.Mock)
      .mockResolvedValueOnce(baseResponse)
      .mockRejectedValueOnce({
        status: 403,
        message: 'Forbidden resource',
      })

    const { rerender } = render(<ControlDetailDrawer {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('CTRL-DG-004 · 监管报送准确性控制')).toBeInTheDocument()
    })

    rerender(
      <ControlDetailDrawer
        {...defaultProps}
        controlId="control-002"
        sourceRecordId="push-002"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('您没有权限查看该控制点详情')).toBeInTheDocument()
    })

    expect(screen.queryByText('监管报送前后的自动校验与人工复核记录')).not.toBeInTheDocument()
  })

  it('should retry a generic error without closing the parent drawer', async () => {
    ;(getControlExplain as jest.Mock)
      .mockRejectedValueOnce({
        status: 500,
        message: 'Internal server error',
      })
      .mockResolvedValueOnce(baseResponse)

    render(<ControlDetailDrawer {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('控制点详情加载失败，请重试')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('control-detail-retry'))

    await waitFor(() => {
      expect(screen.getByText('CTRL-DG-004 · 监管报送准确性控制')).toBeInTheDocument()
    })

    expect(getControlExplain).toHaveBeenCalledTimes(2)
  })

  it('should show an explicit unavailable message for removed or disabled controls without leaking stale content', async () => {
    ;(getControlExplain as jest.Mock)
      .mockResolvedValueOnce(baseResponse)
      .mockRejectedValueOnce({
        status: 404,
        message: 'control_point control-404 not found',
      })

    const { rerender } = render(<ControlDetailDrawer {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('CTRL-DG-004 · 监管报送准确性控制')).toBeInTheDocument()
    })

    rerender(
      <ControlDetailDrawer
        {...defaultProps}
        controlId="control-404"
        sourceRecordId="push-404"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('该控制点已移除或停用')).toBeInTheDocument()
    })

    expect(screen.queryByText('监管报送前后的自动校验与人工复核记录')).not.toBeInTheDocument()
    expect(screen.queryByTestId('control-detail-retry')).not.toBeInTheDocument()
  })

  it('should preserve the same structure across audit, radar and report contexts while changing the source badge', async () => {
    const { rerender } = render(<ControlDetailDrawer {...defaultProps} sourceModule="audit" sourceRecordId="review-row-001" />)

    await waitFor(() => {
      expect(screen.getByTestId('control-detail-source-badge')).toHaveTextContent('来自审核台')
    })

    const firstOrder = Array.from(document.body.querySelectorAll('[data-section-key]')).map((node) =>
      node.getAttribute('data-section-key'),
    )

    rerender(<ControlDetailDrawer {...defaultProps} sourceModule="radar" sourceRecordId="push-001" />)

    await waitFor(() => {
      expect(screen.getByTestId('control-detail-source-badge')).toHaveTextContent('来自雷达')
    })

    rerender(<ControlDetailDrawer {...defaultProps} sourceModule="report" sourceRecordId="report-node-001" />)

    await waitFor(() => {
      expect(screen.getByTestId('control-detail-source-badge')).toHaveTextContent('来自报告')
    })

    rerender(
      <ControlDetailDrawer
        {...defaultProps}
        sourceModule="admin"
        sourceRecordId="fm-001"
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('control-detail-source-badge')).toHaveTextContent('来自管理端')
    })

    const finalOrder = Array.from(document.body.querySelectorAll('[data-section-key]')).map((node) =>
      node.getAttribute('data-section-key'),
    )

    expect(firstOrder).toEqual(finalOrder)
  })

  it('should call the admin full-context endpoint path when sourceModule is admin', async () => {
    render(
      <ControlDetailDrawer
        {...defaultProps}
        sourceModule="admin"
        sourceRecordId="fm-001"
      />,
    )

    await waitFor(() => {
      expect(getControlExplain).toHaveBeenCalledWith({
        controlId: 'control-001',
        sourceModule: 'admin',
      })
    })
  })

  it('should render source trace details when opened from a derived compliance case mapping', async () => {
    render(
      <ControlDetailDrawer
        {...defaultProps}
        sourceModule="admin"
        sourceRecordId="case-001"
        sourceTrace={{
          label: '案例推导路径',
          detail: 'CASE-001 → FM-REP-001 · 报送口径定义错误 → CTRL-DG-004',
        }}
      />,
    )

    await waitFor(() =>
      expect(screen.getByTestId('control-detail-source-trace')).toHaveTextContent(
        'CASE-001 → FM-REP-001 · 报送口径定义错误 → CTRL-DG-004',
      ),
    )
  })

  it('should keep related cards non-interactive outside admin source contexts', async () => {
    render(<ControlDetailDrawer {...defaultProps} sourceModule="radar" />)

    await waitFor(() =>
      expect(screen.getByTestId('control-detail-failure-mode-cards')).toBeInTheDocument(),
    )

    expect(
      screen
        .getByTestId('control-detail-failure-mode-cards')
        .querySelector('button'),
    ).toBeNull()
    expect(
      screen
        .getByTestId('control-detail-obligation-cards')
        .querySelector('button'),
    ).toBeNull()
    expect(
      screen
        .getByTestId('control-detail-section-cases')
        .querySelector('button'),
    ).toBeNull()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('should render related cards as non-interactive when ids are missing even in admin mode', async () => {
    ;(getControlExplain as jest.Mock).mockResolvedValueOnce({
      ...baseResponse,
      failureModes: [
        {
          failureModeCode: 'FM-NO-ID-001',
          name: '缺少 failureModeId',
          category: 'DEFINITION_ERROR',
          relevance: 'PRIMARY',
        },
      ],
      obligations: [
        {
          obligationCode: 'OBL-NO-ID-001',
          obligationText: '缺少 obligationId 的义务映射',
          obligationType: 'MANDATORY',
          coverage: 'FULL',
        },
      ],
      cases: [
        {
          caseCode: 'CASE-NO-ID-001',
          caseTitle: '缺少 caseId 的案例映射',
          relationType: 'VIOLATES',
          confidenceScore: '0.9100',
        },
      ],
    })

    render(
      <ControlDetailDrawer
        {...defaultProps}
        sourceModule="admin"
        sourceRecordId="fm-001"
      />,
    )

    await waitFor(() =>
      expect(screen.getByTestId('control-detail-failure-mode-cards')).toHaveTextContent(
        'FM-NO-ID-001',
      ),
    )

    expect(
      screen.getByTestId('control-detail-failure-mode-cards').querySelector('button'),
    ).toBeNull()
    expect(
      screen.getByTestId('control-detail-obligation-cards').querySelector('button'),
    ).toBeNull()
    expect(
      screen.getByTestId('control-detail-section-cases').querySelector('button'),
    ).toBeNull()
  })

  it('should encode admin cross-navigation query parameters before routing', async () => {
    ;(getControlExplain as jest.Mock).mockResolvedValueOnce({
      ...baseResponse,
      failureModes: [
        {
          failureModeId: 'fm/with?weird=value',
          failureModeCode: 'FM-ENC-001',
          name: '异常失效模式',
          category: 'DEFINITION_ERROR',
          relevance: 'PRIMARY',
        },
      ],
      obligations: [
        {
          ...baseResponse.obligations[0],
          obligationId: 'obl/with?weird=value',
        },
      ],
      cases: [
        {
          caseId: 'case/with?weird=value',
          caseCode: 'CASE-ENC-001',
          caseTitle: '特殊案例',
          relationType: 'VIOLATES',
          confidenceScore: '0.9100',
        },
      ],
    })

    render(
      <ControlDetailDrawer
        {...defaultProps}
        sourceModule="admin"
        sourceRecordId="fm-001"
      />,
    )

    await waitFor(() =>
      expect(screen.getByTestId('control-detail-failure-mode-cards')).toHaveTextContent(
        'FM-ENC-001',
      ),
    )

    fireEvent.click(screen.getByText('FM-ENC-001'))
    fireEvent.click(screen.getByText('OBL-001'))
    fireEvent.click(screen.getByText('CASE-ENC-001'))

    expect(mockPush).toHaveBeenNthCalledWith(
      1,
      '/admin/failure-modes?failureModeId=fm%2Fwith%3Fweird%3Dvalue',
    )
    expect(mockPush).toHaveBeenNthCalledWith(
      2,
      '/admin/obligations?obligationId=obl%2Fwith%3Fweird%3Dvalue',
    )
    expect(mockPush).toHaveBeenNthCalledWith(
      3,
      '/admin/compliance-cases?caseId=case%2Fwith%3Fweird%3Dvalue',
    )
  })
})
