import { Test, TestingModule } from '@nestjs/testing'
import { CaseImportProcessor } from './case-import.processor'
import { CaseImportService } from '../services/case-import.service'

describe('CaseImportProcessor', () => {
  let processor: CaseImportProcessor

  const caseImportService = {
    importCases: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseImportProcessor,
        {
          provide: CaseImportService,
          useValue: caseImportService,
        },
      ],
    }).compile()

    processor = module.get(CaseImportProcessor)
    jest.clearAllMocks()
  })

  it('should process queued case import jobs through CaseImportService', async () => {
    caseImportService.importCases.mockResolvedValue({
      batchId: 'PBOC-batch-001',
      filePath: 'D:/imports/cases.xlsx',
      regulatorCode: 'PBOC',
      totalRows: 2,
      importedCount: 2,
      failedCount: 0,
      failures: [],
    })

    const result = await processor.process({
      id: 'job-1',
      attemptsMade: 0,
      data: {
        filePath: 'D:/imports/cases.xlsx',
        regulatorCode: 'PBOC',
        batchId: 'PBOC-batch-001',
      },
    } as never)

    expect(caseImportService.importCases).toHaveBeenCalledWith({
      filePath: 'D:/imports/cases.xlsx',
      regulatorCode: 'PBOC',
      batchId: 'PBOC-batch-001',
    })
    expect(result.importedCount).toBe(2)
  })

  it('should rethrow processor failures so BullMQ can retry', async () => {
    const error = new Error('Queue processing failed')
    caseImportService.importCases.mockRejectedValue(error)

    await expect(
      processor.process({
        id: 'job-2',
        attemptsMade: 1,
        data: {
          filePath: 'D:/imports/cases.xlsx',
          regulatorCode: 'NFRA',
          batchId: 'NFRA-batch-001',
        },
      } as never),
    ).rejects.toThrow('Queue processing failed')
  })
})
