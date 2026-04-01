import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ComplianceCasesAdminPage from './page'
import * as complianceCasesApi from '@/lib/api/compliance-cases'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: {
      user: {
        id: 'user-1',
        role: 'admin',
      },
    },
    status: 'authenticated',
  })),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/lib/api/compliance-cases')

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
}))

jest.mock('@/components/ui/select', () => {
  const React = require('react')

  const collectItems = (children: React.ReactNode): Array<{ value: string; children: React.ReactNode }> => {
    const items: Array<{ value: string; children: React.ReactNode }> = []
    React.Children.forEach(children, (child: any) => {
      if (!React.isValidElement(child)) return
      if (child.type === SelectItem) {
        items.push({ value: child.props.value, children: child.props.children })
        return
      }
      if (child.props?.children) items.push(...collectItems(child.props.children))
    })
    return items
  }

  const Select = ({ children, value, onValueChange }: any) => {
    const items = collectItems(children)
    return (
      <select value={value} onChange={(event) => onValueChange?.(event.target.value)}>
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.children}
          </option>
        ))}
      </select>
    )
  }

  const SelectContent = ({ children }: any) => <>{children}</>
  const SelectItem = ({ children, value }: any) => <option value={value}>{children}</option>
  const SelectTrigger = ({ children }: any) => <div>{children}</div>
  const SelectValue = () => null

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
})

const mockGetComplianceCases = complianceCasesApi.getComplianceCases as jest.MockedFunction<
  typeof complianceCasesApi.getComplianceCases
>
const mockEnqueueImport = complianceCasesApi.enqueueComplianceCaseImport as jest.MockedFunction<
  typeof complianceCasesApi.enqueueComplianceCaseImport
>
const mockGetExtraction = complianceCasesApi.getComplianceCaseExtraction as jest.MockedFunction<
  typeof complianceCasesApi.getComplianceCaseExtraction
>
const mockGetClustering = complianceCasesApi.getComplianceCaseClustering as jest.MockedFunction<
  typeof complianceCasesApi.getComplianceCaseClustering
>
const mockSearchControlPoints = complianceCasesApi.searchControlPoints as jest.MockedFunction<
  typeof complianceCasesApi.searchControlPoints
>
const mockSubmitReview = complianceCasesApi.submitComplianceCaseHumanReview as jest.MockedFunction<
  typeof complianceCasesApi.submitComplianceCaseHumanReview
>

const clusteredCase = {
  caseId: 'case-1',
  caseCode: 'PBOC-CASE-001',
  regulatorCode: 'PBOC',
  caseTitle: '处罚案例',
  sourceOrg: '人民银行',
  industry: 'banking',
  region: 'CN',
  caseDate: '2026-04-01T00:00:00.000Z',
  authorityName: '人民银行',
  penaltyType: null,
  caseFacts: '案例事实',
  penaltyReason: '处罚原因',
  rawSourceUrl: null,
  rawContentId: null,
  l1Code: null,
  l2Code: null,
  confidenceScore: null,
  importBatchId: 'PBOC-batch-001',
  status: 'clustered',
  humanReviewed: false,
  reviewedBy: null,
  reviewedAt: null,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
} as const

const extractionResult = {
  caseId: 'case-1',
  caseCode: 'PBOC-CASE-001',
  status: 'clustered',
  violationThemes: ['客户身份识别'],
  clauseCandidates: [
    {
      clauseId: 'clause-1',
      clauseCode: 'CLAUSE-001',
      summary: '条款摘要',
      matchedKeywords: ['KYC'],
      confidenceScore: 0.9,
    },
  ],
  extractedAt: '2026-04-01T00:10:00.000Z',
} as const

const clusteringResult = {
  caseId: 'case-1',
  caseCode: 'PBOC-CASE-001',
  status: 'clustered',
  normalizedThemes: ['客户身份识别'],
  candidateControlPoints: [
    {
      controlName: '交易监测',
      sourceTheme: '客户身份识别',
      confidenceScore: 0.8,
      reason: '主题相近',
    },
  ],
  clusteredAt: '2026-04-01T00:20:00.000Z',
  humanReviewed: false,
  reviewedBy: null,
  reviewedAt: null,
  caseControlMapDrafts: [
    {
      id: 'draft-1',
      controlId: 'control-1',
      controlCode: 'CTRL-001',
      controlName: '客户身份识别',
      relationType: 'VIOLATES',
      reviewStatus: 'PENDING',
      confidenceScore: '0.9000',
    },
  ],
} as const

describe('ComplianceCasesAdminPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetComplianceCases.mockResolvedValue({
      items: [clusteredCase],
      total: 1,
      page: 1,
      limit: 10,
    })
    mockEnqueueImport.mockResolvedValue({
      jobId: 'case-import-PBOC-batch-001',
      batchId: 'PBOC-batch-001',
      filePath: 'D:/imports/cases.xlsx',
      regulatorCode: 'PBOC',
      status: 'queued',
    })
    mockGetExtraction.mockResolvedValue(extractionResult)
    mockGetClustering.mockResolvedValue(clusteringResult)
    mockSearchControlPoints.mockResolvedValue({
      items: [
        {
          controlId: 'control-2',
          controlCode: 'CTRL-002',
          controlName: '交易监测',
          controlDesc: null,
          l1Code: 'IT01',
          l2Code: 'IT01-01',
          controlFamily: '监测',
          controlType: 'DETECTIVE',
          mandatoryDefault: true,
          riskLevelDefault: 'HIGH',
          ownerRoleHint: null,
          status: 'ACTIVE',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
    })
    mockSubmitReview.mockResolvedValue({
      caseId: 'case-1',
      status: 'reviewed',
      humanReviewed: true,
      reviewedBy: 'user-1',
      reviewedAt: '2026-04-01T01:00:00.000Z',
      approvedCount: 1,
      rejectedCount: 0,
      manualMappingCount: 0,
    })
  })

  it('renders import form and case list', async () => {
    render(<ComplianceCasesAdminPage />)

    await waitFor(() => {
      expect(screen.getByText('案例运营')).toBeInTheDocument()
      expect(screen.getByLabelText('文件路径')).toBeInTheDocument()
      expect(screen.getByText('PBOC-CASE-001')).toBeInTheDocument()
    })
  })

  it('applies filters and refetches case list', async () => {
    render(<ComplianceCasesAdminPage />)

    await waitFor(() => expect(mockGetComplianceCases).toHaveBeenCalled())
    mockGetComplianceCases.mockClear()

    fireEvent.change(screen.getByLabelText('批次号'), { target: { value: 'NFRA-batch-001' } })
    fireEvent.change(screen.getByLabelText('监管编码', { selector: 'input#filter-regulator' }), {
      target: { value: 'NFRA' },
    })
    fireEvent.change(document.querySelector('select')!, { target: { value: 'reviewed' } })
    fireEvent.change(screen.getByLabelText('关键词'), { target: { value: '客户身份识别' } })
    fireEvent.click(screen.getByRole('button', { name: '查询' }))

    await waitFor(() => {
      expect(mockGetComplianceCases).toHaveBeenLastCalledWith({
        page: 1,
        limit: 10,
        batchId: 'NFRA-batch-001',
        regulatorCode: 'NFRA',
        status: 'reviewed',
        keyword: '客户身份识别',
      })
    })
  })

  it('submits import job and shows import result', async () => {
    render(<ComplianceCasesAdminPage />)

    await waitFor(() => expect(screen.getByLabelText('文件路径')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('文件路径'), { target: { value: 'D:/imports/cases.xlsx' } })
    fireEvent.change(
      screen.getByLabelText('监管编码', { selector: 'input#import-regulator-code' }),
      {
        target: { value: 'PBOC' },
      },
    )
    fireEvent.change(screen.getByLabelText('批次号（可选）'), { target: { value: 'PBOC-batch-001' } })
    fireEvent.click(screen.getByRole('button', { name: '创建导入任务' }))

    await waitFor(() => {
      expect(mockEnqueueImport).toHaveBeenCalledWith({
        filePath: 'D:/imports/cases.xlsx',
        regulatorCode: 'PBOC',
        batchId: 'PBOC-batch-001',
      })
      expect(screen.getByText(/导入任务已创建/)).toBeInTheDocument()
    })
  })

  it('opens detail dialog and loads extraction/clustering results', async () => {
    render(<ComplianceCasesAdminPage />)

    await waitFor(() => expect(screen.getByText('查看详情')).toBeInTheDocument())
    fireEvent.click(screen.getByText('查看详情'))

    await waitFor(() => {
      expect(mockGetExtraction).toHaveBeenCalledWith('case-1')
      expect(mockGetClustering).toHaveBeenCalledWith('case-1')
      expect(screen.getAllByText('客户身份识别').length).toBeGreaterThan(0)
      expect(screen.getByText('交易监测')).toBeInTheDocument()
    })
  })

  it('disables review submit for reviewed cases', async () => {
    mockGetComplianceCases.mockResolvedValueOnce({
      items: [{ ...clusteredCase, status: 'reviewed' }],
      total: 1,
      page: 1,
      limit: 10,
    })
    mockGetClustering.mockResolvedValueOnce({
      ...clusteringResult,
      status: 'reviewed',
      humanReviewed: true,
      reviewedBy: 'user-1',
      reviewedAt: '2026-04-01T01:00:00.000Z',
    })

    render(<ComplianceCasesAdminPage />)

    await waitFor(() => expect(screen.getByText('查看详情')).toBeInTheDocument())
    fireEvent.click(screen.getByText('查看详情'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '提交人工审核' })).toBeDisabled()
    })
  })

  it('submits human review for clustered case', async () => {
    render(<ComplianceCasesAdminPage />)

    await waitFor(() => expect(screen.getByText('查看详情')).toBeInTheDocument())
    fireEvent.click(screen.getByText('查看详情'))

    await waitFor(() => expect(screen.getByRole('button', { name: '确认' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '确认' }))
    fireEvent.click(screen.getByRole('button', { name: '提交人工审核' }))

    await waitFor(() => {
      expect(mockSubmitReview).toHaveBeenCalledWith('case-1', {
        approvedMapIds: ['draft-1'],
        rejectedMapIds: undefined,
        manualMappings: undefined,
      })
    })
  })
})
