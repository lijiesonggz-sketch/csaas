import { Test, TestingModule } from '@nestjs/testing'
import {
  KG_CASE_IMPORT_EXTRACT_JOB_NAME,
  KG_CASE_IMPORT_PARSE_JOB_NAME,
} from '../constants/case-import.constants'
import { CaseImportProcessor } from './case-import.processor'
import {
  CaseExtractionBatchResult,
  CaseExtractionService,
} from '../services/case-extraction.service'
import { CaseImportService } from '../services/case-import.service'
import { CaseImportQueueService } from '../services/case-import-queue.service'
import { ComplianceCaseImportResult } from '../dto/import-compliance-cases.dto'

describe('CaseImportProcessor', () => {
  let processor: CaseImportProcessor

  const caseImportService = {
    importCases: jest.fn(),
  }

  const caseExtractionService = {
    extractBatch: jest.fn(),
  }

  const caseImportQueueService = {
    enqueueExtraction: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseImportProcessor,
        {
          provide: CaseImportService,
          useValue: caseImportService,
        },
        {
          provide: CaseExtractionService,
          useValue: caseExtractionService,
        },
        {
          provide: CaseImportQueueService,
          useValue: caseImportQueueService,
        },
      ],
    }).compile()

    processor = module.get(CaseImportProcessor)
    jest.clearAllMocks()
  })

  it('should process xlsx-parse jobs and enqueue ai-extract follow-up work', async () => {
    caseImportService.importCases.mockResolvedValue({
      batchId: 'PBOC-batch-001',
      filePath: 'D:/imports/cases.xlsx',
      regulatorCode: 'PBOC',
      totalRows: 2,
      importedCount: 2,
      failedCount: 0,
      failures: [],
    })

    const result = (await processor.process({
      id: 'job-1',
      name: KG_CASE_IMPORT_PARSE_JOB_NAME,
      attemptsMade: 0,
      data: {
        filePath: 'D:/imports/cases.xlsx',
        regulatorCode: 'PBOC',
        batchId: 'PBOC-batch-001',
      },
    } as never)) as ComplianceCaseImportResult

    expect(caseImportService.importCases).toHaveBeenCalledWith({
      filePath: 'D:/imports/cases.xlsx',
      regulatorCode: 'PBOC',
      batchId: 'PBOC-batch-001',
    })
    expect(caseImportQueueService.enqueueExtraction).toHaveBeenCalledWith('PBOC-batch-001')
    expect(result.importedCount).toBe(2)
  })

  it('should process ai-extract jobs through CaseExtractionService', async () => {
    caseExtractionService.extractBatch.mockResolvedValue({
      batchId: 'PBOC-batch-001',
      processedCount: 2,
      skippedCount: 0,
    })

    const result = (await processor.process({
      id: 'job-extract-1',
      name: KG_CASE_IMPORT_EXTRACT_JOB_NAME,
      attemptsMade: 0,
      data: {
        batchId: 'PBOC-batch-001',
      },
    } as never)) as CaseExtractionBatchResult

    expect(caseExtractionService.extractBatch).toHaveBeenCalledWith('PBOC-batch-001')
    expect(result.processedCount).toBe(2)
  })

  it('should rethrow processor failures so BullMQ can retry', async () => {
    const error = new Error('Queue processing failed')
    caseImportService.importCases.mockRejectedValue(error)

    await expect(
      processor.process({
        id: 'job-2',
        name: KG_CASE_IMPORT_PARSE_JOB_NAME,
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
