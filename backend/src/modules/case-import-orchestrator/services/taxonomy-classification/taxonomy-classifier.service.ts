import { Inject, Injectable } from '@nestjs/common'
import { CaseNormalizationService } from './case-normalization.service'
import type {
  TaxonomyClassificationRequest,
  TaxonomyClassificationResult,
  TaxonomyDomainRegistryEntry,
} from './contracts/classification-result.contract'
import {
  TAXONOMY_MAPPING_REPOSITORY,
  type MappingRepository,
} from './mapping-repository.interface'
import { TaxonomyClassifierEngine } from './taxonomy-classifier.engine'
import { getTaxonomyDomainRegistryEntry } from './profiles/domain-registry'

export const TAXONOMY_CLASSIFIER_VERSION = 'taxonomy-classifier-6.1'

@Injectable()
export class TaxonomyClassifierService {
  constructor(
    private readonly caseNormalizationService: CaseNormalizationService,
    @Inject(TAXONOMY_MAPPING_REPOSITORY)
    private readonly mappingRepository: MappingRepository,
    private readonly taxonomyClassifierEngine: TaxonomyClassifierEngine,
  ) {}

  classifyCaseText(
    request: TaxonomyClassificationRequest,
  ): TaxonomyClassificationResult {
    const activeDomain = this.resolveActiveDomain(request.preferredL1Code)
    if (!activeDomain) {
      return this.buildUnsupportedDomainResult(request.preferredL1Code ?? null)
    }
    if (activeDomain.readiness.stage !== 'runtime-classifier-ready') {
      return this.buildUnsupportedDomainResult(request.preferredL1Code ?? null)
    }

    try {
      const { profile, rulebook } = activeDomain
      const mappings = this.mappingRepository.loadByL1Code(profile.l1Code)
      const normalizedInput = this.caseNormalizationService.normalize(request)

      return this.taxonomyClassifierEngine.classify({
        input: normalizedInput,
        mappings,
        rulebook,
        activeProfile: profile,
        classifierVersion: TAXONOMY_CLASSIFIER_VERSION,
        mappingVersion: this.mappingRepository.getVersion(),
        classifiedAt: new Date().toISOString(),
      })
    } catch {
      return this.buildEngineErrorResult(activeDomain)
    }
  }

  private resolveActiveDomain(
    preferredL1Code?: string | null,
  ): TaxonomyDomainRegistryEntry | null {
    return getTaxonomyDomainRegistryEntry(preferredL1Code)
  }

  private buildUnsupportedDomainResult(
    requestedL1Code: string | null,
  ): TaxonomyClassificationResult {
    return {
      l1Code: requestedL1Code,
      l2Code: null,
      l2Name: null,
      score: 0,
      confidenceScore: 0,
      scoreGap: 0,
      decisionSource: 'none',
      matchedSignals: [],
      matchedPhrases: [],
      matchedTokens: [],
      classifierVersion: TAXONOMY_CLASSIFIER_VERSION,
      mappingVersion: this.mappingRepository.getVersion(),
      rulebookVersion: 'unconfigured',
      classifiedAt: new Date().toISOString(),
      pathDecision: 'UNCLASSIFIED',
      failureSemantics: 'UNSUPPORTED_DOMAIN',
    }
  }

  private buildEngineErrorResult(
    domain: TaxonomyDomainRegistryEntry,
  ): TaxonomyClassificationResult {
    return {
      l1Code: domain.profile.l1Code,
      l2Code: null,
      l2Name: null,
      score: 0,
      confidenceScore: 0,
      scoreGap: 0,
      decisionSource: 'none',
      matchedSignals: [],
      matchedPhrases: [],
      matchedTokens: [],
      classifierVersion: TAXONOMY_CLASSIFIER_VERSION,
      mappingVersion: this.mappingRepository.getVersion(),
      rulebookVersion: domain.profile.rulebookVersion,
      classifiedAt: new Date().toISOString(),
      pathDecision: 'UNCLASSIFIED',
      failureSemantics: 'ENGINE_ERROR',
    }
  }
}
