import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ControlDetailDrawer } from './ControlDetailDrawer'
import { getControlExplain } from '@/lib/api/compliance-intelligence'

jest.mock('@/lib/api/compliance-intelligence', () => ({
  getControlExplain: jest.fn(),
  normalizeControlExplainError: jest.requireActual('@/lib/api/compliance-intelligence').normalizeControlExplainError,
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
    applicabilityReason: '机构属于银行业且监管关注度高，需强化报送控制',
    clauses: [
      {
        clauseCode: 'REG-BANK-IT-042',
        articleNo: '第42条',
        clauseText: '金融机构应建立监管报送校验与复核机制。',
      },
    ],
    cases: [
      {
        caseCode: 'CASE-PBOC-2024-001',
        caseTitle: '某银行因报送不准被罚 50 万',
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
    ;(getControlExplain as jest.Mock).mockResolvedValue(baseResponse)
  })

  it('should render controlCode, controlName and radar source badge in header', async () => {
    render(<ControlDetailDrawer {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('CTRL-DG-004 · 监管报送准确性控制')).toBeInTheDocument()
    })

    expect(screen.getByTestId('control-detail-source-badge')).toHaveTextContent('来自雷达')
  })

  it('should render sections in the fixed shared order', async () => {
    render(<ControlDetailDrawer {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByTestId('control-detail-section-applicabilityReason')).toBeInTheDocument()
    })

    const sectionOrder = Array.from(document.body.querySelectorAll('[data-section-key]')).map((node) =>
      node.getAttribute('data-section-key'),
    )

    expect(sectionOrder).toEqual([
      'applicabilityReason',
      'clauses',
      'cases',
      'evidences',
      'questions',
      'remediations',
    ])
  })

  it('should show explicit empty states while keeping populated sections visible', async () => {
    ;(getControlExplain as jest.Mock).mockResolvedValue({
      ...baseResponse,
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
    expect(screen.getByText('监管报送前后的自动校验与人工复核记录')).toBeInTheDocument()
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

    const finalOrder = Array.from(document.body.querySelectorAll('[data-section-key]')).map((node) =>
      node.getAttribute('data-section-key'),
    )

    expect(firstOrder).toEqual(finalOrder)
  })
})
