import { Inject, Injectable } from '@nestjs/common'
import { CaseNormalizationService } from './case-normalization.service'
import type {
  TaxonomyClassificationRequest,
  TaxonomyClassificationResult,
  TaxonomyDomainProfile,
  TaxonomyRulebook,
} from './contracts/classification-result.contract'
import {
  TAXONOMY_MAPPING_REPOSITORY,
  type MappingRepository,
} from './mapping-repository.interface'
import { TaxonomyClassifierEngine } from './taxonomy-classifier.engine'
import {
  IT04_DOMAIN_PROFILE,
  IT04_RULEBOOK,
} from './rulebooks/it04.rulebook'

export const TAXONOMY_CLASSIFIER_VERSION = 'taxonomy-classifier-6.1'

const DEFAULT_DOMAIN_PROFILES: Record<string, TaxonomyDomainProfile> = {
  IT04: IT04_DOMAIN_PROFILE,
}

const DEFAULT_RULEBOOKS: Record<string, TaxonomyRulebook> = {
  IT04: IT04_RULEBOOK,
}

@Injectable()
export class TaxonomyClassifierService {
  private readonly profiles = DEFAULT_DOMAIN_PROFILES
  private readonly rulebooks = DEFAULT_RULEBOOKS

  constructor(
    private readonly caseNormalizationService: CaseNormalizationService,
    @Inject(TAXONOMY_MAPPING_REPOSITORY)
    private readonly mappingRepository: MappingRepository,
    private readonly taxonomyClassifierEngine: TaxonomyClassifierEngine,
  ) {}

  classifyCaseText(
    request: TaxonomyClassificationRequest,
  ): TaxonomyClassificationResult {
    const activeProfile = this.resolveActiveProfile(request.preferredL1Code)
    if (!activeProfile) {
      return this.buildUnsupportedDomainResult(request.preferredL1Code ?? null)
    }

    try {
      const mappings = this.mappingRepository.loadByL1Code(activeProfile.l1Code)
      const normalizedInput = this.caseNormalizationService.normalize(request)

      return this.taxonomyClassifierEngine.classify({
        input: normalizedInput,
        mappings,
        rulebook: this.rulebooks[activeProfile.l1Code],
        activeProfile,
        classifierVersion: TAXONOMY_CLASSIFIER_VERSION,
        mappingVersion: this.mappingRepository.getVersion(),
        classifiedAt: new Date().toISOString(),
      })
    } catch {
      return this.buildEngineErrorResult(activeProfile.l1Code)
    }
  }

  private resolveActiveProfile(
    preferredL1Code?: string | null,
  ): TaxonomyDomainProfile | null {
    if (!preferredL1Code) {
      return null
    }

    return this.profiles[preferredL1Code] ?? null
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
    l1Code: string | null,
  ): TaxonomyClassificationResult {
    return {
      l1Code,
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
      rulebookVersion: this.resolveActiveProfile(l1Code)?.rulebookVersion ?? 'unconfigured',
      classifiedAt: new Date().toISOString(),
      pathDecision: 'UNCLASSIFIED',
      failureSemantics: 'ENGINE_ERROR',
    }
  }
}
