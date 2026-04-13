import { forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { FailureModeService } from '../../knowledge-graph/services/failure-mode.service'
import { CaseClusteringService } from './case-clustering.service'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChainControlPointItem = {
  failureModeId: string
  failureModeCode: string
  failureModeName: string
  controlPointId: string
  controlCode: string
  controlName: string
  relevance: string
  maturityLevel: string | null
  authoritativeScore: number | null
}

export type ChainResult = {
  items: ChainControlPointItem[]
  total: number
}

export type CaseChainMappingResult = {
  autoMappedCount: number
  shouldFallback: boolean
  source: 'FAILURE_MODE_CHAIN'
  writtenMappings: Array<{
    caseId: string
    controlId: string
    relationType: string
    reviewStatus: string
    source: string
    confidenceScore: string
  }>
}

const MATURITY_ORDER: Record<string, number> = {
  hard: 0,
  'draft-hard': 1,
  candidate: 2,
}

@Injectable()
export class CaseClusteringChainService {
  private readonly logger = new Logger(CaseClusteringChainService.name)
  private chainCache = new Map<string, ChainResult>()

  constructor(
    private readonly failureModeService: FailureModeService,
    @Inject(forwardRef(() => CaseClusteringService))
    private readonly clusteringService: CaseClusteringService,
  ) {}

  // ===========================================================================
  // resolveControlPointsByL2Code — l2Code → failure_modes → control_points
  // ===========================================================================

  async resolveControlPointsByL2Code(l2Code: string): Promise<ChainResult> {
    const cached = this.chainCache.get(l2Code)
    if (cached) {
      return cached
    }

    try {
      const failureModesResult = await this.failureModeService.findByL2Code(l2Code, {
        status: 'ACTIVE',
        limit: 50,
      })

      if (!failureModesResult.items.length) {
        const emptyResult: ChainResult = { items: [], total: 0 }
        this.chainCache.set(l2Code, emptyResult)
        return emptyResult
      }

      const allItems: ChainControlPointItem[] = []
      const seenControlIds = new Set<string>()

      for (const fm of failureModesResult.items) {
        const cpResult = await this.failureModeService.findControlPointsByFailureMode(
          fm.failureModeId,
          { limit: 20 },
        )

        for (const cp of cpResult.items) {
          if (seenControlIds.has(cp.controlId)) {
            continue
          }
          seenControlIds.add(cp.controlId)

          allItems.push({
            failureModeId: fm.failureModeId,
            failureModeCode: fm.failureModeCode,
            failureModeName: fm.name,
            controlPointId: cp.controlId,
            controlCode: cp.controlCode,
            controlName: cp.controlName,
            relevance: cp.relevance,
            maturityLevel: cp.maturityLevel,
            authoritativeScore: cp.authoritativeScore,
          })
        }
      }

      // Sort: maturity_level (hard > draft-hard > candidate), then authoritativeScore desc
      allItems.sort((a, b) => {
        const levelDiff =
          (MATURITY_ORDER[a.maturityLevel ?? ''] ?? 99) -
          (MATURITY_ORDER[b.maturityLevel ?? ''] ?? 99)
        if (levelDiff !== 0) return levelDiff
        return (b.authoritativeScore ?? 0) - (a.authoritativeScore ?? 0)
      })

      const result: ChainResult = { items: allItems, total: allItems.length }
      this.chainCache.set(l2Code, result)
      return result
    } catch (error) {
      if (error instanceof NotFoundException) {
        const emptyResult: ChainResult = { items: [], total: 0 }
        this.chainCache.set(l2Code, emptyResult)
        return emptyResult
      }
      throw error
    }
  }

  // ===========================================================================
  // mapCaseToControlPoints — 完整映射: case → l2Code → chain → case_control_maps
  // ===========================================================================

  async mapCaseToControlPoints(caseRecord: {
    caseId: string
    l2Code: string | null
  }): Promise<CaseChainMappingResult> {
    if (!caseRecord.l2Code) {
      return {
        autoMappedCount: 0,
        shouldFallback: true,
        source: 'FAILURE_MODE_CHAIN',
        writtenMappings: [],
      }
    }

    const chainResult = await this.resolveControlPointsByL2Code(caseRecord.l2Code)

    if (!chainResult.items.length) {
      return {
        autoMappedCount: 0,
        shouldFallback: true,
        source: 'FAILURE_MODE_CHAIN',
        writtenMappings: [],
      }
    }

    // Take top N candidates (up to 5 for initial mapping)
    const topCandidates = chainResult.items.slice(0, 5)
    const writtenMappings: CaseChainMappingResult['writtenMappings'] = []

    for (const candidate of topCandidates) {
      const confidence = this.computeChainConfidence(
        candidate.relevance,
        candidate.authoritativeScore,
      )

      await this.clusteringService.upsertCaseControlMap(
        caseRecord.caseId,
        candidate.controlPointId,
        confidence,
        'FAILURE_MODE_CHAIN',
      )

      writtenMappings.push({
        caseId: caseRecord.caseId,
        controlId: candidate.controlPointId,
        relationType: 'VIOLATES',
        reviewStatus: 'PENDING',
        source: 'FAILURE_MODE_CHAIN',
        confidenceScore: confidence.toFixed(4),
      })
    }

    return {
      autoMappedCount: writtenMappings.length,
      shouldFallback: false,
      source: 'FAILURE_MODE_CHAIN',
      writtenMappings,
    }
  }

  // ===========================================================================
  // computeChainConfidence — 基于 relevance + authoritativeScore 推导置信度
  // ===========================================================================

  computeChainConfidence(relevance: string, authoritativeScore: number | null): number {
    const base = relevance === 'PRIMARY' ? 0.75 : 0.55
    const score = authoritativeScore ?? 0.3
    return Math.min(0.95, base * 0.5 + score * 0.5)
  }

  // ===========================================================================
  // clearCache — batch 结束后清理缓存
  // ===========================================================================

  clearCache(): void {
    this.chainCache.clear()
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

}
