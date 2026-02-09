import { Test, TestingModule } from '@nestjs/testing'
import { Job } from 'bullmq'

import {
  PeerContentAnalysisProcessor,
  PeerContentAnalysisJob,
} from './peer-content-analysis.processor'
import { PeerContentAnalyzerService } from '../services/peer-content-analyzer.service'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'

describe('PeerContentAnalysisProcessor', () => {
  let processor: PeerContentAnalysisProcessor
  let peerContentAnalyzerService: jest.Mocked<PeerContentAnalyzerService>

  const mockJobData: PeerContentAnalysisJob = {
    type: 'peer-content-analysis',
    rawContentId: 'raw-content-1',
    peerName: '杭州银行',
    content: '杭州银行容器化改造实践内容...',
    tenantId: 'tenant-1',
    retryCount: 0,
  }

  const createMockJob = (overrides: Partial<Job<PeerContentAnalysisJob>> = {}): Job<PeerContentAnalysisJob> => {
    return {
      data: mockJobData,
      attemptsMade: 0,
      ...overrides,
    } as Job<PeerContentAnalysisJob>
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeerContentAnalysisProcessor,
        {
          provide: PeerContentAnalyzerService,
          useValue: {
            analyzePeerContent: jest.fn(),
          },
        },
      ],
    }).compile()

    processor = module.get<PeerContentAnalysisProcessor>(PeerContentAnalysisProcessor)
    peerContentAnalyzerService = module.get(PeerContentAnalyzerService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('process', () => {
    it('should process peer content analysis job successfully', async () => {
      // Arrange
      const mockAnalyzedContent: Partial<AnalyzedContent> = {
        id: 'analyzed-1',
        contentId: mockJobData.rawContentId,
        confidence: 'high',
        selectedModel: 'gpt4',
      }

      peerContentAnalyzerService.analyzePeerContent.mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      const job = createMockJob()

      // Act
      const result = await processor.process(job)

      // Assert
      expect(peerContentAnalyzerService.analyzePeerContent).toHaveBeenCalledWith(mockJobData.rawContentId)
      expect(result).toEqual({
        success: true,
        analyzedContentId: 'analyzed-1',
        confidence: 'high',
      })
    })

    it('should handle medium confidence results', async () => {
      // Arrange
      const mockAnalyzedContent: Partial<AnalyzedContent> = {
        id: 'analyzed-2',
        contentId: mockJobData.rawContentId,
        confidence: 'medium',
        selectedModel: 'claude',
      }

      peerContentAnalyzerService.analyzePeerContent.mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      const job = createMockJob()

      // Act
      const result = await processor.process(job)

      // Assert
      expect(result).toEqual({
        success: true,
        analyzedContentId: 'analyzed-2',
        confidence: 'medium',
      })
    })

    it('should handle low confidence results', async () => {
      // Arrange
      const mockAnalyzedContent: Partial<AnalyzedContent> = {
        id: 'analyzed-3',
        contentId: mockJobData.rawContentId,
        confidence: 'low',
        selectedModel: 'tongyi',
        reviewStatus: 'pending',
      }

      peerContentAnalyzerService.analyzePeerContent.mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      const job = createMockJob()

      // Act
      const result = await processor.process(job)

      // Assert
      expect(result).toEqual({
        success: true,
        analyzedContentId: 'analyzed-3',
        confidence: 'low',
      })
    })

    it('should throw error for retry on first failure', async () => {
      // Arrange
      peerContentAnalyzerService.analyzePeerContent.mockRejectedValue(new Error('Analysis failed'))

      const job = createMockJob({ attemptsMade: 0 })

      // Act & Assert
      await expect(processor.process(job)).rejects.toThrow('Analysis failed')
    })

    it('should return error result after max retries', async () => {
      // Arrange
      peerContentAnalyzerService.analyzePeerContent.mockRejectedValue(new Error('Analysis failed'))

      const job = createMockJob({ attemptsMade: 2 })

      // Act
      const result = await processor.process(job)

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Analysis failed',
      })
    })
  })

  describe('onCompleted', () => {
    it('should log successful completion', () => {
      // Arrange
      const job = createMockJob()
      const result = {
        success: true,
        analyzedContentId: 'analyzed-1',
        confidence: 'high' as const,
      }

      const loggerSpy = jest.spyOn(processor['logger'], 'log')

      // Act
      processor.onCompleted(job, result)

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Peer content analysis job completed'),
      )
    })

    it('should log failure', () => {
      // Arrange
      const job = createMockJob()
      const result = {
        success: false,
        error: 'Analysis failed',
      }

      const loggerSpy = jest.spyOn(processor['logger'], 'error')

      // Act
      processor.onCompleted(job, result)

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Peer content analysis job failed'),
      )
    })
  })

  describe('onFailed', () => {
    it('should log job failure', () => {
      // Arrange
      const job = createMockJob()
      const error = new Error('Job processing failed')

      const loggerSpy = jest.spyOn(processor['logger'], 'error')

      // Act
      processor.onFailed(job, error)

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Peer content analysis job failed'),
      )
    })
  })
})
