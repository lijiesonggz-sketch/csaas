import { Test, TestingModule } from '@nestjs/testing'
import { FailureModeService } from '../../knowledge-graph/services/failure-mode.service'
import { CaseClusteringChainService } from './case-clustering-chain.service'
import { CaseClusteringService } from './case-clustering.service'

describe('CaseClusteringChainService', () => {
  let service: CaseClusteringChainService

  const failureModeService = {
    findByL2Code: jest.fn(),
    findControlPointsByFailureMode: jest.fn(),
  }

  const clusteringService = {
    upsertCaseControlMap: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseClusteringChainService,
        {
          provide: FailureModeService,
          useValue: failureModeService,
        },
        {
          provide: CaseClusteringService,
          useValue: clusteringService,
        },
      ],
    }).compile()

    service = module.get(CaseClusteringChainService)
    jest.clearAllMocks()
    // Reset cache between tests
    service.clearCache()
  })

  // ===========================================================================
  // resolveControlPointsByL2Code
  // ===========================================================================

  describe('resolveControlPointsByL2Code', () => {
    it('should return sorted control points when l2Code maps to failure modes', async () => {
      failureModeService.findByL2Code.mockResolvedValue({
        items: [
          {
            failureModeId: 'fm-001',
            failureModeCode: 'FM-IT04-001',
            name: '客户身份识别不到位',
            status: 'ACTIVE',
          },
          {
            failureModeId: 'fm-002',
            failureModeCode: 'FM-IT04-002',
            name: '交易监测机制缺失',
            status: 'ACTIVE',
          },
        ],
        total: 2,
      })

      failureModeService.findControlPointsByFailureMode
        .mockResolvedValueOnce({
          items: [
            {
              id: 'fcm-001',
              controlId: 'cp-001',
              controlCode: 'CTRL-AML-001',
              controlName: 'AML KYC Control',
              relevance: 'PRIMARY',
              maturityLevel: 'hard',
              authoritativeScore: '0.92',
            },
            {
              id: 'fcm-002',
              controlId: 'cp-002',
              controlCode: 'CTRL-ID-002',
              controlName: '身份验证控制',
              relevance: 'SECONDARY',
              maturityLevel: 'draft-hard',
              authoritativeScore: '0.78',
            },
          ],
          total: 2,
        })
        .mockResolvedValueOnce({
          items: [
            {
              id: 'fcm-003',
              controlId: 'cp-003',
              controlCode: 'CTRL-MON-001',
              controlName: '交易监测控制',
              relevance: 'PRIMARY',
              maturityLevel: 'hard',
              authoritativeScore: '0.88',
            },
            {
              id: 'fcm-004',
              controlId: 'cp-004',
              controlCode: 'CTRL-REP-001',
              controlName: '可疑交易报告控制',
              relevance: 'SECONDARY',
              maturityLevel: 'candidate',
              authoritativeScore: '0.65',
            },
          ],
          total: 2,
        })

      const result = await service.resolveControlPointsByL2Code('IT04')

      expect(result.items.length).toBe(4)
      // Verify sort order: hard > draft-hard > candidate, same level by authoritativeScore desc
      expect(result.items.map((item) => item.controlCode)).toEqual([
        'CTRL-AML-001',  // hard, 0.92
        'CTRL-MON-001',  // hard, 0.88
        'CTRL-ID-002',   // draft-hard, 0.78
        'CTRL-REP-001',  // candidate, 0.65
      ])
    })

    it('should return empty list when l2Code has no failure mode mappings', async () => {
      failureModeService.findByL2Code.mockResolvedValue({
        items: [],
        total: 0,
      })

      const result = await service.resolveControlPointsByL2Code('IT99')

      expect(result.items).toEqual([])
      expect(result.total).toBe(0)
    })

    it('should return empty list when l2Code does not exist (NotFoundException)', async () => {
      const { NotFoundException } = await import('@nestjs/common')
      failureModeService.findByL2Code.mockRejectedValue(
        new NotFoundException('taxonomy_l2 IT99_NOT_EXIST not found'),
      )

      const result = await service.resolveControlPointsByL2Code('IT99_NOT_EXIST')

      expect(result.items).toEqual([])
      expect(result.total).toBe(0)
    })

    it('should deduplicate control points that appear in multiple failure modes', async () => {
      failureModeService.findByL2Code.mockResolvedValue({
        items: [
          { failureModeId: 'fm-001', failureModeCode: 'FM-001', name: 'FM1', status: 'ACTIVE' },
          { failureModeId: 'fm-002', failureModeCode: 'FM-002', name: 'FM2', status: 'ACTIVE' },
        ],
        total: 2,
      })

      // Both FMs share cp-001
      failureModeService.findControlPointsByFailureMode
        .mockResolvedValueOnce({
          items: [
            {
              id: 'fcm-001',
              controlId: 'cp-001',
              controlCode: 'CTRL-001',
              controlName: 'Shared Control',
              relevance: 'PRIMARY',
              maturityLevel: 'hard',
              authoritativeScore: '0.90',
            },
          ],
          total: 1,
        })
        .mockResolvedValueOnce({
          items: [
            {
              id: 'fcm-002',
              controlId: 'cp-001',
              controlCode: 'CTRL-001',
              controlName: 'Shared Control',
              relevance: 'SECONDARY',
              maturityLevel: 'hard',
              authoritativeScore: '0.90',
            },
          ],
          total: 1,
        })

      const result = await service.resolveControlPointsByL2Code('IT04')

      expect(result.items.length).toBe(1)
      expect(result.items[0].controlPointId).toBe('cp-001')
    })

    it('should include failure mode metadata in each control point result', async () => {
      failureModeService.findByL2Code.mockResolvedValue({
        items: [
          {
            failureModeId: 'fm-001',
            failureModeCode: 'FM-IT04-001',
            name: '客户身份识别不到位',
            status: 'ACTIVE',
          },
        ],
        total: 1,
      })

      failureModeService.findControlPointsByFailureMode.mockResolvedValue({
        items: [
          {
            id: 'fcm-001',
            controlId: 'cp-001',
            controlCode: 'CTRL-AML-001',
            controlName: 'AML KYC Control',
            relevance: 'PRIMARY',
            maturityLevel: 'hard',
            authoritativeScore: '0.92',
          },
        ],
        total: 1,
      })

      const result = await service.resolveControlPointsByL2Code('IT04')

      for (const item of result.items) {
        expect(item).toMatchObject({
          failureModeCode: expect.any(String),
          failureModeName: expect.any(String),
          controlPointId: expect.any(String),
          controlCode: expect.any(String),
          controlName: expect.any(String),
          relevance: expect.stringMatching(/^(PRIMARY|SECONDARY)$/),
          maturityLevel: expect.any(String),
          authoritativeScore: expect.any(String),
        })
      }
    })

    it('should cache results by l2Code (same l2Code queried only once)', async () => {
      failureModeService.findByL2Code.mockResolvedValue({
        items: [
          {
            failureModeId: 'fm-001',
            failureModeCode: 'FM-001',
            name: 'FM1',
            status: 'ACTIVE',
          },
        ],
        total: 1,
      })
      failureModeService.findControlPointsByFailureMode.mockResolvedValue({
        items: [],
        total: 0,
      })

      await service.resolveControlPointsByL2Code('IT04')
      await service.resolveControlPointsByL2Code('IT04')

      expect(failureModeService.findByL2Code).toHaveBeenCalledTimes(1)
    })
  })

  // ===========================================================================
  // mapCaseToControlPoints
  // ===========================================================================

  describe('mapCaseToControlPoints', () => {
    it('should write case_control_maps with source=FAILURE_MODE_CHAIN when l2Code has mappings', async () => {
      failureModeService.findByL2Code.mockResolvedValue({
        items: [
          {
            failureModeId: 'fm-001',
            failureModeCode: 'FM-IT04-001',
            name: '客户身份识别不到位',
            status: 'ACTIVE',
          },
        ],
        total: 1,
      })

      failureModeService.findControlPointsByFailureMode.mockResolvedValue({
        items: [
          {
            id: 'fcm-001',
            controlId: 'cp-001-aml-kyc',
            controlCode: 'CTRL-AML-001',
            controlName: 'AML KYC Control',
            relevance: 'PRIMARY',
            maturityLevel: 'hard',
            authoritativeScore: '0.92',
          },
          {
            id: 'fcm-003',
            controlId: 'cp-003-tx-monitor',
            controlCode: 'CTRL-MON-001',
            controlName: '交易监测控制',
            relevance: 'PRIMARY',
            maturityLevel: 'hard',
            authoritativeScore: '0.88',
          },
        ],
        total: 2,
      })

      clusteringService.upsertCaseControlMap.mockResolvedValue(undefined)

      const result = await service.mapCaseToControlPoints({
        caseId: 'case-chain-001',
        l2Code: 'IT04',
      })

      expect(result.autoMappedCount).toBe(2)
      expect(result.shouldFallback).toBe(false)
      expect(result.source).toBe('FAILURE_MODE_CHAIN')
      expect(result.writtenMappings).toHaveLength(2)
      expect(result.writtenMappings[0]).toMatchObject({
        caseId: 'case-chain-001',
        relationType: 'VIOLATES',
        reviewStatus: 'PENDING',
        source: 'FAILURE_MODE_CHAIN',
      })
    })

    it('should set reviewStatus=PENDING and relationType=VIOLATES on new chain case_control_maps', async () => {
      failureModeService.findByL2Code.mockResolvedValue({
        items: [
          {
            failureModeId: 'fm-001',
            failureModeCode: 'FM-IT04-001',
            name: '客户身份识别不到位',
            status: 'ACTIVE',
          },
        ],
        total: 1,
      })

      failureModeService.findControlPointsByFailureMode.mockResolvedValue({
        items: [
          {
            id: 'fcm-001',
            controlId: 'cp-001-aml-kyc',
            controlCode: 'CTRL-AML-001',
            controlName: 'AML KYC Control',
            relevance: 'PRIMARY',
            maturityLevel: 'hard',
            authoritativeScore: '0.92',
          },
        ],
        total: 1,
      })

      clusteringService.upsertCaseControlMap.mockResolvedValue(undefined)

      const result = await service.mapCaseToControlPoints({
        caseId: 'case-chain-001',
        l2Code: 'IT04',
      })

      for (const mapping of result.writtenMappings) {
        expect(mapping).toMatchObject({
          caseId: 'case-chain-001',
          relationType: 'VIOLATES',
          reviewStatus: 'PENDING',
          source: 'FAILURE_MODE_CHAIN',
        })
      }
    })

    it('should return shouldFallback=true when l2Code is null', async () => {
      const result = await service.mapCaseToControlPoints({
        caseId: 'case-fallback-001',
        l2Code: null,
      })

      expect(result.shouldFallback).toBe(true)
      expect(result.autoMappedCount).toBe(0)
    })

    it('should return shouldFallback=true when l2Code exists but has no failure mode mappings', async () => {
      failureModeService.findByL2Code.mockResolvedValue({
        items: [],
        total: 0,
      })

      const result = await service.mapCaseToControlPoints({
        caseId: 'case-empty-chain-001',
        l2Code: 'IT99',
      })

      expect(result.shouldFallback).toBe(true)
      expect(result.autoMappedCount).toBe(0)
    })
  })

  // ===========================================================================
  // computeChainConfidence
  // ===========================================================================

  describe('computeChainConfidence', () => {
    it('should compute confidence based on relevance and authoritativeScore', () => {
      // PRIMARY + high score
      const score1 = service.computeChainConfidence('PRIMARY', 0.92)
      expect(score1).toBeGreaterThanOrEqual(0.70)
      expect(score1).toBeLessThanOrEqual(0.85)

      // SECONDARY + medium score
      const score2 = service.computeChainConfidence('SECONDARY', 0.65)
      expect(score2).toBeGreaterThanOrEqual(0.50)
      expect(score2).toBeLessThanOrEqual(0.65)

      // PRIMARY + null score (defaults to 0.3)
      const score3 = service.computeChainConfidence('PRIMARY', null)
      expect(score3).toBeGreaterThanOrEqual(0.40)
      expect(score3).toBeLessThanOrEqual(0.60)
    })

    it('should cap confidence at 0.95', () => {
      const score = service.computeChainConfidence('PRIMARY', 1.0)
      expect(score).toBeLessThanOrEqual(0.95)
    })
  })

  // ===========================================================================
  // clearCache
  // ===========================================================================

  describe('clearCache', () => {
    it('should clear the chain cache', async () => {
      failureModeService.findByL2Code.mockResolvedValue({
        items: [],
        total: 0,
      })

      await service.resolveControlPointsByL2Code('IT04')
      expect(failureModeService.findByL2Code).toHaveBeenCalledTimes(1)

      service.clearCache()

      await service.resolveControlPointsByL2Code('IT04')
      expect(failureModeService.findByL2Code).toHaveBeenCalledTimes(2)
    })
  })
})
