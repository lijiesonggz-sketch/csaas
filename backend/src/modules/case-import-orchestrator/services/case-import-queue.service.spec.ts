import { Test, TestingModule } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { CaseImportQueueService } from './case-import-queue.service'
import {
  KG_CASE_IMPORT_EXTRACT_JOB_NAME,
  KG_CASE_IMPORT_PARSE_JOB_NAME,
  KG_CASE_IMPORT_QUEUE,
} from '../constants/case-import.constants'

describe('CaseImportQueueService', () => {
  let service: CaseImportQueueService

  const caseImportQueue = {
    add: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseImportQueueService,
        {
          provide: getQueueToken(KG_CASE_IMPORT_QUEUE),
          useValue: caseImportQueue,
        },
      ],
    }).compile()

    service = module.get(CaseImportQueueService)
    jest.clearAllMocks()
  })

  it('should enqueue case import jobs with retry and exponential backoff', async () => {
    caseImportQueue.add.mockResolvedValue({
      id: 'case-import-PBOC-batch-001',
    })

    const result = await service.enqueueImport({
      filePath: 'D:/imports/cases.xlsx',
      regulatorCode: 'pboc',
      batchId: 'PBOC-batch-001',
    })

    expect(caseImportQueue.add).toHaveBeenCalledWith(
      KG_CASE_IMPORT_PARSE_JOB_NAME,
      {
        filePath: 'D:/imports/cases.xlsx',
        regulatorCode: 'PBOC',
        batchId: 'PBOC-batch-001',
      },
      expect.objectContaining({
        jobId: 'case-import-PBOC-batch-001',
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      }),
    )
    expect(result).toEqual({
      jobId: 'case-import-PBOC-batch-001',
      batchId: 'PBOC-batch-001',
      filePath: 'D:/imports/cases.xlsx',
      regulatorCode: 'PBOC',
      status: 'queued',
    })
  })

  it('should enqueue ai-extract follow-up jobs for imported batches', async () => {
    caseImportQueue.add.mockResolvedValue({
      id: 'case-extract-PBOC-batch-001',
    })

    await service.enqueueExtraction('PBOC-batch-001')

    expect(caseImportQueue.add).toHaveBeenCalledWith(
      KG_CASE_IMPORT_EXTRACT_JOB_NAME,
      {
        batchId: 'PBOC-batch-001',
      },
      expect.objectContaining({
        jobId: 'case-extract-PBOC-batch-001',
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }),
    )
  })
})
