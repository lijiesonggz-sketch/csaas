import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CaseControlMap } from '../../../database/entities/case-control-map.entity'
import {
  ComplianceCase,
  ComplianceCaseControlPointDraft,
} from '../../../database/entities/compliance-case.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'

export type CaseClusteringBatchResult = {
  batchId: string
  processedCount: number
  skippedCount: number
}

@Injectable()
export class CaseClusteringService {
  constructor(
    @InjectRepository(ComplianceCase)
    private readonly complianceCaseRepository: Repository<ComplianceCase>,
    @InjectRepository(ControlPoint)
    private readonly controlPointRepository: Repository<ControlPoint>,
    @InjectRepository(CaseControlMap)
    private readonly caseControlMapRepository: Repository<CaseControlMap>,
  ) {}

  async clusterBatch(batchId: string): Promise<CaseClusteringBatchResult> {
    const cases = await this.complianceCaseRepository.find({
      where: {
        importBatchId: batchId,
        status: 'extracted',
      },
      order: {
        createdAt: 'ASC',
      },
    })
    const controlPoints = await this.controlPointRepository.find({
      where: {
        status: 'ACTIVE',
      },
      take: 200,
      order: {
        updatedAt: 'DESC',
      },
    })

    let processedCount = 0

    for (const caseRecord of cases) {
      const normalizedThemes = this.normalizeThemes(caseRecord.violationThemes ?? [])
      const candidateControlPoints: ComplianceCaseControlPointDraft[] = []

      for (const theme of normalizedThemes) {
        const match = this.findBestControlPoint(theme, controlPoints)

        if (match) {
          await this.upsertCaseControlMap(
            caseRecord.caseId,
            match.controlPoint.controlId,
            match.score,
          )
          continue
        }

        candidateControlPoints.push({
          controlName: theme,
          sourceTheme: theme,
          confidenceScore: 0.45,
          reason: 'No existing control point reached the clustering threshold',
        })
      }

      caseRecord.normalizedThemes = normalizedThemes
      caseRecord.candidateControlPoints = candidateControlPoints
      caseRecord.clusteredAt = new Date()
      caseRecord.status = 'clustered'

      await this.complianceCaseRepository.save(caseRecord)
      processedCount += 1
    }

    return {
      batchId,
      processedCount,
      skippedCount: 0,
    }
  }

  private normalizeThemes(themes: string[]): string[] {
    return Array.from(
      new Set(
        themes
          .map((theme) =>
            theme
              .replace(/(不到位|缺失|未及时|未按|未|不|违规|失败|薄弱|问题)/g, '')
              .replace(/\s+/g, '')
              .trim(),
          )
          .filter((theme) => theme.length >= 2),
      ),
    )
  }

  private findBestControlPoint(
    theme: string,
    controlPoints: ControlPoint[],
  ): { controlPoint: ControlPoint; score: number } | null {
    const matches = controlPoints
      .map((controlPoint) => {
        const haystack = [controlPoint.controlName, controlPoint.controlDesc]
          .filter((value): value is string => Boolean(value))
          .join(' ')

        const score = this.calculateMatchScore(theme, haystack)

        if (score < 0.5) {
          return null
        }

        return {
          controlPoint,
          score,
        }
      })
      .filter((match): match is { controlPoint: ControlPoint; score: number } => match !== null)
      .sort((left, right) => right.score - left.score)

    return matches[0] ?? null
  }

  private calculateMatchScore(theme: string, haystack: string): number {
    if (haystack.includes(theme)) {
      return 0.9
    }

    const themeTokens = this.tokenize(theme)
    const matchedTokens = themeTokens.filter((token) => haystack.includes(token))

    if (matchedTokens.length === 0) {
      return 0
    }

    return Number(Math.min(0.85, 0.3 + matchedTokens.length * 0.2).toFixed(2))
  }

  private tokenize(text: string): string[] {
    return Array.from(
      new Set(
        (text.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,10}/g) ?? []).flatMap((token) => [
          token,
          token.length >= 4 ? token.slice(0, 4) : null,
        ]),
      ),
    ).filter((token): token is string => Boolean(token))
  }

  private async upsertCaseControlMap(
    caseId: string,
    controlId: string,
    score: number,
  ): Promise<void> {
    const existing = await this.caseControlMapRepository.findOne({
      where: { caseId, controlId },
    })

    if (existing) {
      existing.reviewStatus = 'PENDING'
      existing.relationType = 'VIOLATES'
      existing.confidenceScore = score.toFixed(4)
      await this.caseControlMapRepository.save(existing)
      return
    }

    const entity = this.caseControlMapRepository.create({
      caseId,
      controlId,
      relationType: 'VIOLATES',
      reviewStatus: 'PENDING',
      confidenceScore: score.toFixed(4),
    })

    await this.caseControlMapRepository.save(entity)
  }
}
