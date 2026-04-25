import { ComplianceCase } from '../../../database/entities/compliance-case.entity'
import { RegulationClause } from '../../../database/entities/regulation-clause.entity'
import {
  CLASSIFICATION_LEDGER_AUTOMATE_EMPTY_DOMAIN_CASE,
  CLASSIFICATION_LEDGER_AUTOMATE_MAPPING_MISSING_RESULT,
  CLASSIFICATION_LEDGER_AUTOMATE_PENDING_CASE,
  CLASSIFICATION_LEDGER_AUTOMATE_REGISTRY_ORDER_ATTEMPTS,
  CLASSIFICATION_LEDGER_AUTOMATE_SCORE_GAP_ATTEMPTS,
} from '../testing/classification-ledger-automate.fixtures'
import { ClassificationTelemetryService } from './classification-telemetry.service'
import { CaseExtractionService } from './case-extraction.service'
import { CaseThemeIntelligenceService } from './case-theme-intelligence.service'
import { ComplianceCaseClassificationRunService } from './compliance-case-classification-run.service'
import { RuntimeDomainSelectorService } from './runtime-domain-selector.service'
import { CaseClusteringChainService } from './case-clustering-chain.service'
import { TaxonomyClassifierService } from './taxonomy-classification/taxonomy-classifier.service'
import { CaseNormalizationService } from './taxonomy-classification/case-normalization.service'
import { DomainRolloutPolicyService } from './taxonomy-classification/domain-rollout-policy.service'
import { FailureModeService } from '../../knowledge-graph/services/failure-mode.service'

describe('CaseExtractionService automation regression', () => {
  const createServiceHarness = () => {
    const complianceCaseRepository = {
      find: jest.fn(),
      save: jest.fn().mockImplementation(async (entity: unknown) => entity),
    }
    const regulationClauseRepository = {
      find: jest.fn().mockResolvedValue([]),
    }
    const caseThemeIntelligenceService = {
      refineViolationThemes: jest.fn().mockResolvedValue(null),
    }
    const taxonomyClassifierService = {
      classifyCaseText: jest.fn(),
    }
    const runtimeDomainSelectorService = {
      getSupportedDomains: jest.fn(),
    }
    const classificationRunService = {
      appendRunAndRefreshLatest: jest.fn().mockResolvedValue(undefined),
    }
    const classificationTelemetryService = {
      publishLatestSnapshotWritten: jest.fn().mockResolvedValue(undefined),
    }
    const caseNormalizationService = {
      normalize: jest.fn().mockReturnValue({
        rawText: 'normalized input',
        caseFacts: null,
        penaltyReason: null,
        mergedText: 'normalized input',
        normalizedText: 'normalizedinput',
        normalizedTokens: ['normalized', 'input'],
        normalizedPhrases: [],
      }),
    }
    const domainRolloutPolicyService = {
      resolvePolicyDecision: jest.fn().mockImplementation(
        async ({
          l1Code,
          classifierResult,
          primaryExecutability,
        }: {
          l1Code: string
          classifierResult: {
            classifierVersion: string
            failureSemantics: string | null
            pathDecision: 'PRIMARY_CHAIN' | 'LEGACY_FALLBACK' | 'ABSTAIN' | 'UNCLASSIFIED'
          }
          primaryExecutability: { isExecutable: boolean }
        }) => ({
          policy: {
            l1Code,
            rolloutState: 'domain-primary',
            allowLegacyFallback: true,
            primaryThreshold: 0.7,
            shadowWindowDays: 14,
            killSwitchEnabled: false,
            activeClassifierVersion: classifierResult.classifierVersion,
          },
          rolloutState: 'domain-primary',
          stateAllowsPrimary: true,
          pathDecision:
            classifierResult.pathDecision === 'PRIMARY_CHAIN' &&
            primaryExecutability.isExecutable
              ? 'PRIMARY_CHAIN'
              : classifierResult.pathDecision,
          failureSemantic:
            classifierResult.pathDecision === 'PRIMARY_CHAIN' &&
            !primaryExecutability.isExecutable
              ? 'MAPPING_MISSING'
              : classifierResult.failureSemantics,
          primaryExecutability,
          reason: 'test-double',
        }),
      ),
    }
    const failureModeService = {
      findByL2Code: jest.fn().mockResolvedValue({
        items: [{ failureModeCode: 'FM-DEFAULT' }],
      }),
    }
    const caseClusteringChainService = {
      resolveControlPointsByL2Code: jest.fn().mockResolvedValue({
        items: [{ controlCode: 'CTRL-DEFAULT' }],
        total: 1,
      }),
    }

    const service = new CaseExtractionService(
      complianceCaseRepository as never,
      regulationClauseRepository as never,
      caseThemeIntelligenceService as never,
      taxonomyClassifierService as never,
      runtimeDomainSelectorService as never,
      classificationRunService as never,
      classificationTelemetryService as never,
      caseNormalizationService as never,
      domainRolloutPolicyService as never,
      failureModeService as never,
      caseClusteringChainService as never,
    )

    return {
      service,
      complianceCaseRepository,
      regulationClauseRepository,
      caseThemeIntelligenceService,
      taxonomyClassifierService,
      runtimeDomainSelectorService,
      classificationRunService,
      classificationTelemetryService,
      caseNormalizationService,
      domainRolloutPolicyService,
      failureModeService,
      caseClusteringChainService,
    }
  }

  it('[P0][6.3-AUTO-001] should mark latest snapshot as PENDING_RECLASSIFY when no runtime-ready domains are exposed', async () => {
    const harness = createServiceHarness()
    harness.complianceCaseRepository.find.mockResolvedValue([
      CLASSIFICATION_LEDGER_AUTOMATE_EMPTY_DOMAIN_CASE,
    ])
    harness.runtimeDomainSelectorService.getSupportedDomains.mockReturnValue([])

    const result = await harness.service.extractBatch(
      CLASSIFICATION_LEDGER_AUTOMATE_EMPTY_DOMAIN_CASE.importBatchId,
    )

    expect(result).toEqual({
      batchId: CLASSIFICATION_LEDGER_AUTOMATE_EMPTY_DOMAIN_CASE.importBatchId,
      processedCount: 1,
      skippedCount: 0,
    })
    expect(harness.taxonomyClassifierService.classifyCaseText).not.toHaveBeenCalled()
    expect(harness.classificationRunService.appendRunAndRefreshLatest).toHaveBeenCalledWith(
      expect.objectContaining({
        classifierVersion: 'runtime-domain-selector-unconfigured',
        mappingVersion: 'unconfigured',
        rulebookVersion: 'unconfigured',
        fallbackReason: 'PENDING_RECLASSIFY',
        classificationStatus: 'FAILED',
        decisionTrace: expect.objectContaining({
          evaluatedDomains: [],
          rootFailureSemantic: 'UNSUPPORTED_DOMAIN',
        }),
      }),
    )
    expect(harness.complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: null,
        l2Code: null,
        confidenceScore: null,
        classificationSource: 'none',
        classificationVersion: 'runtime-domain-selector-unconfigured',
        fallbackReason: 'PENDING_RECLASSIFY',
        status: 'extracted',
      }),
    )
  })

  it('[P0][6.3-AUTO-002] should choose the higher scoreGap candidate when multiple primary domains tie on confidence', async () => {
    const harness = createServiceHarness()
    harness.complianceCaseRepository.find.mockResolvedValue([
      CLASSIFICATION_LEDGER_AUTOMATE_PENDING_CASE,
    ])
    harness.runtimeDomainSelectorService.getSupportedDomains.mockReturnValue([
      'IT03',
      'IT04',
    ])
    harness.taxonomyClassifierService.classifyCaseText.mockImplementation(
      ({ preferredL1Code }: { preferredL1Code: string }) =>
        CLASSIFICATION_LEDGER_AUTOMATE_SCORE_GAP_ATTEMPTS[preferredL1Code],
    )

    await harness.service.extractBatch(
      CLASSIFICATION_LEDGER_AUTOMATE_PENDING_CASE.importBatchId,
    )

    expect(harness.complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: 'IT04',
        l2Code: 'IT04-10',
        classificationSource: 'rule',
      }),
    )
    expect(harness.classificationRunService.appendRunAndRefreshLatest).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: 'IT04',
        l2Code: 'IT04-10',
        decisionTrace: expect.objectContaining({
          chosenDomain: 'IT04',
          tieBreakRule:
            'confidenceScore-desc,scoreGap-desc,score-desc,registry-order',
        }),
      }),
    )
  })

  it('[P0][6.3-AUTO-003] should fall back to registry order when primary candidates tie on confidence, scoreGap, and score', async () => {
    const harness = createServiceHarness()
    harness.complianceCaseRepository.find.mockResolvedValue([
      CLASSIFICATION_LEDGER_AUTOMATE_PENDING_CASE,
    ])
    harness.runtimeDomainSelectorService.getSupportedDomains.mockReturnValue([
      'IT03',
      'IT04',
    ])
    harness.taxonomyClassifierService.classifyCaseText.mockImplementation(
      ({ preferredL1Code }: { preferredL1Code: string }) =>
        CLASSIFICATION_LEDGER_AUTOMATE_REGISTRY_ORDER_ATTEMPTS[preferredL1Code],
    )

    await harness.service.extractBatch(
      CLASSIFICATION_LEDGER_AUTOMATE_PENDING_CASE.importBatchId,
    )

    expect(harness.complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: 'IT03',
        l2Code: 'IT03-03',
        classificationSource: 'rule',
      }),
    )
    expect(harness.classificationRunService.appendRunAndRefreshLatest).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: 'IT03',
        l2Code: 'IT03-03',
        decisionTrace: expect.objectContaining({
          chosenDomain: 'IT03',
        }),
      }),
    )
  })

  it('[P1][6.3-AUTO-004] should normalize MAPPING_MISSING to PENDING_RECLASSIFY without aborting extraction', async () => {
    const harness = createServiceHarness()
    harness.complianceCaseRepository.find.mockResolvedValue([
      CLASSIFICATION_LEDGER_AUTOMATE_PENDING_CASE,
    ])
    harness.runtimeDomainSelectorService.getSupportedDomains.mockReturnValue(['IT04'])
    harness.taxonomyClassifierService.classifyCaseText.mockReturnValue(
      CLASSIFICATION_LEDGER_AUTOMATE_MAPPING_MISSING_RESULT,
    )

    const result = await harness.service.extractBatch(
      CLASSIFICATION_LEDGER_AUTOMATE_PENDING_CASE.importBatchId,
    )

    expect(result.processedCount).toBe(1)
    expect(harness.classificationRunService.appendRunAndRefreshLatest).toHaveBeenCalledWith(
      expect.objectContaining({
        pathDecision: 'UNCLASSIFIED',
        fallbackReason: 'PENDING_RECLASSIFY',
        classificationStatus: 'FAILED',
        decisionTrace: expect.objectContaining({
          rootFailureSemantic: 'MAPPING_MISSING',
          normalizedFailureSemantic: 'PENDING_RECLASSIFY',
        }),
      }),
    )
    expect(harness.complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: null,
        l2Code: null,
        classificationSource: 'none',
        fallbackReason: 'PENDING_RECLASSIFY',
        status: 'extracted',
      }),
    )
  })
})
