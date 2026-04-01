import {
  enqueueComplianceCaseImport,
  getComplianceCaseClustering,
  getComplianceCaseExtraction,
  getComplianceCases,
  searchControlPoints,
  submitComplianceCaseHumanReview,
} from './compliance-cases'

jest.mock('../utils/api', () => ({
  apiFetch: jest.fn(),
}))

const mockApiFetch = jest.requireMock('../utils/api').apiFetch as jest.Mock

describe('Compliance Cases API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should build case list query with batchId and filters', async () => {
    mockApiFetch.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    })

    await getComplianceCases({
      page: 1,
      limit: 10,
      batchId: 'PBOC-batch-001',
      regulatorCode: 'PBOC',
      status: 'clustered',
      keyword: '客户身份识别',
    })

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/admin/knowledge-graph/compliance-cases?page=1&limit=10&batchId=PBOC-batch-001&regulatorCode=PBOC&status=clustered&keyword=%E5%AE%A2%E6%88%B7%E8%BA%AB%E4%BB%BD%E8%AF%86%E5%88%AB',
    )
  })

  it('should post import payload to existing import endpoint', async () => {
    mockApiFetch.mockResolvedValue({
      jobId: 'case-import-PBOC-batch-001',
      batchId: 'PBOC-batch-001',
      filePath: 'D:/imports/cases.xlsx',
      regulatorCode: 'PBOC',
      status: 'queued',
    })

    await enqueueComplianceCaseImport({
      filePath: 'D:/imports/cases.xlsx',
      regulatorCode: 'PBOC',
      batchId: 'PBOC-batch-001',
    })

    expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/knowledge-graph/cases/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filePath: 'D:/imports/cases.xlsx',
        regulatorCode: 'PBOC',
        batchId: 'PBOC-batch-001',
      }),
    })
  })

  it('should read extraction and clustering detail from existing endpoints', async () => {
    mockApiFetch.mockResolvedValue({})

    await getComplianceCaseExtraction('case-1')
    await getComplianceCaseClustering('case-1')

    expect(mockApiFetch).toHaveBeenNthCalledWith(
      1,
      '/api/admin/knowledge-graph/compliance-cases/case-1/extraction',
    )
    expect(mockApiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/admin/knowledge-graph/compliance-cases/case-1/clustering',
    )
  })

  it('should submit human review payload to existing endpoint', async () => {
    mockApiFetch.mockResolvedValue({
      caseId: 'case-1',
      status: 'reviewed',
    })

    await submitComplianceCaseHumanReview('case-1', {
      approvedMapIds: ['draft-1'],
      rejectedMapIds: ['draft-2'],
      manualMappings: [
        {
          controlId: 'control-1',
          relationType: 'VIOLATES',
          confidenceScore: 0.92,
        },
      ],
    })

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/admin/knowledge-graph/compliance-cases/case-1/human-review',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approvedMapIds: ['draft-1'],
          rejectedMapIds: ['draft-2'],
          manualMappings: [
            {
              controlId: 'control-1',
              relationType: 'VIOLATES',
              confidenceScore: 0.92,
            },
          ],
        }),
      },
    )
  })

  it('should search control points with existing query endpoint', async () => {
    mockApiFetch.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    })

    await searchControlPoints({
      page: 1,
      limit: 10,
      status: 'ACTIVE',
      keyword: '客户身份识别',
    })

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/admin/knowledge-graph/control-points?page=1&limit=10&status=ACTIVE&keyword=%E5%AE%A2%E6%88%B7%E8%BA%AB%E4%BB%BD%E8%AF%86%E5%88%AB',
    )
  })
})
