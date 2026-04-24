import {
  CLASSIFICATION_LEDGER_ATDD_EXPECTED_PRIMARY_RUN,
  CLASSIFICATION_LEDGER_ATDD_PENDING_RECLASSIFY_RESULT,
  CLASSIFICATION_LEDGER_ATDD_PRIMARY_CASE,
  CLASSIFICATION_LEDGER_ATDD_PRIMARY_RESULTS_BY_DOMAIN,
  CLASSIFICATION_LEDGER_ATDD_SUPPORTED_RUNTIME_DOMAINS,
  CLASSIFICATION_LEDGER_ATDD_UNCLASSIFIED_RESULT,
} from '../testing/classification-ledger.atdd.fixtures'

describe('Story 6.3 - Case Extraction Classification Ledger (ATDD)', () => {
  it.skip(
    '[P0][6.3-INT-001] should evaluate runtime-ready domains instead of hardcoding IT04 and persist the strongest primary snapshot',
    async () => {
      const { CaseExtractionService } = require('./case-extraction.service')

      const complianceCaseRepository = {
        find: jest.fn().mockResolvedValue([CLASSIFICATION_LEDGER_ATDD_PRIMARY_CASE]),
        save: jest.fn().mockImplementation(async (entity: unknown) => entity),
      }
      const regulationClauseRepository = {
        find: jest.fn().mockResolvedValue([]),
      }
      const caseThemeIntelligenceService = {
        refineViolationThemes: jest.fn().mockResolvedValue(null),
      }
      const runtimeDomainSelector = {
        getSupportedDomains: jest
          .fn()
          .mockReturnValue([...CLASSIFICATION_LEDGER_ATDD_SUPPORTED_RUNTIME_DOMAINS]),
      }
      const taxonomyClassifierService = {
        classifyCaseText: jest.fn(({ preferredL1Code }: { preferredL1Code: string }) => {
          return (
            CLASSIFICATION_LEDGER_ATDD_PRIMARY_RESULTS_BY_DOMAIN[preferredL1Code] ??
            CLASSIFICATION_LEDGER_ATDD_UNCLASSIFIED_RESULT
          )
        }),
      }
      const classificationRunService = {
        appendRunAndRefreshLatest: jest.fn().mockResolvedValue(undefined),
      }
      const classificationTelemetryService = {
        publishLatestSnapshotWritten: jest.fn().mockResolvedValue(undefined),
      }

      const service = new CaseExtractionService(
        complianceCaseRepository,
        regulationClauseRepository,
        caseThemeIntelligenceService,
        taxonomyClassifierService,
        runtimeDomainSelector,
        classificationRunService,
        classificationTelemetryService,
      )

      await service.extractBatch(CLASSIFICATION_LEDGER_ATDD_PRIMARY_CASE.importBatchId)

      expect(runtimeDomainSelector.getSupportedDomains).toHaveBeenCalled()
      expect(taxonomyClassifierService.classifyCaseText).toHaveBeenCalledTimes(
        CLASSIFICATION_LEDGER_ATDD_SUPPORTED_RUNTIME_DOMAINS.length,
      )
      expect(taxonomyClassifierService.classifyCaseText).toHaveBeenCalledWith(
        expect.objectContaining({ preferredL1Code: 'IT07' }),
      )
      expect(complianceCaseRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          l1Code: 'IT07',
          l2Code: 'IT07-06',
          confidenceScore: '0.9200',
          status: 'extracted',
        }),
      )
    },
  )

  it.skip(
    '[P0][6.3-INT-002] should populate classificationSource/classificationVersion/fallbackReason on the latest snapshot together with l1/l2/confidence',
    async () => {
      const { CaseExtractionService } = require('./case-extraction.service')

      const complianceCaseRepository = {
        find: jest.fn().mockResolvedValue([CLASSIFICATION_LEDGER_ATDD_PRIMARY_CASE]),
        save: jest.fn().mockImplementation(async (entity: unknown) => entity),
      }
      const regulationClauseRepository = {
        find: jest.fn().mockResolvedValue([]),
      }
      const caseThemeIntelligenceService = {
        refineViolationThemes: jest.fn().mockResolvedValue(null),
      }
      const runtimeDomainSelector = {
        getSupportedDomains: jest.fn().mockReturnValue(['IT07']),
      }
      const taxonomyClassifierService = {
        classifyCaseText: jest.fn().mockReturnValue(
          CLASSIFICATION_LEDGER_ATDD_PRIMARY_RESULTS_BY_DOMAIN.IT07,
        ),
      }
      const classificationRunService = {
        appendRunAndRefreshLatest: jest.fn().mockResolvedValue(undefined),
      }
      const classificationTelemetryService = {
        publishLatestSnapshotWritten: jest.fn().mockResolvedValue(undefined),
      }

      const service = new CaseExtractionService(
        complianceCaseRepository,
        regulationClauseRepository,
        caseThemeIntelligenceService,
        taxonomyClassifierService,
        runtimeDomainSelector,
        classificationRunService,
        classificationTelemetryService,
      )

      await service.extractBatch(CLASSIFICATION_LEDGER_ATDD_PRIMARY_CASE.importBatchId)

      expect(complianceCaseRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          l1Code: 'IT07',
          l2Code: 'IT07-06',
          confidenceScore: '0.9200',
          classificationSource: 'rule',
          classificationVersion: CLASSIFICATION_LEDGER_ATDD_EXPECTED_PRIMARY_RUN.classificationVersion,
          fallbackReason: null,
          status: 'extracted',
        }),
      )
    },
  )

  it.skip(
    '[P1][6.3-INT-003] should keep extraction batch progressing and save UNCLASSIFIED semantics when all supported domains abstain',
    async () => {
      const { CaseExtractionService } = require('./case-extraction.service')

      const complianceCaseRepository = {
        find: jest.fn().mockResolvedValue([CLASSIFICATION_LEDGER_ATDD_PRIMARY_CASE]),
        save: jest.fn().mockImplementation(async (entity: unknown) => entity),
      }
      const regulationClauseRepository = {
        find: jest.fn().mockResolvedValue([]),
      }
      const caseThemeIntelligenceService = {
        refineViolationThemes: jest.fn().mockResolvedValue(null),
      }
      const runtimeDomainSelector = {
        getSupportedDomains: jest.fn().mockReturnValue(['IT04', 'IT07']),
      }
      const taxonomyClassifierService = {
        classifyCaseText: jest.fn().mockReturnValue(
          CLASSIFICATION_LEDGER_ATDD_UNCLASSIFIED_RESULT,
        ),
      }
      const classificationRunService = {
        appendRunAndRefreshLatest: jest.fn().mockResolvedValue(undefined),
      }
      const classificationTelemetryService = {
        publishLatestSnapshotWritten: jest.fn().mockResolvedValue(undefined),
      }

      const service = new CaseExtractionService(
        complianceCaseRepository,
        regulationClauseRepository,
        caseThemeIntelligenceService,
        taxonomyClassifierService,
        runtimeDomainSelector,
        classificationRunService,
        classificationTelemetryService,
      )

      const result = await service.extractBatch(CLASSIFICATION_LEDGER_ATDD_PRIMARY_CASE.importBatchId)

      expect(result).toEqual({
        batchId: CLASSIFICATION_LEDGER_ATDD_PRIMARY_CASE.importBatchId,
        processedCount: 1,
        skippedCount: 0,
      })
      expect(complianceCaseRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          l1Code: null,
          l2Code: null,
          confidenceScore: null,
          classificationSource: 'none',
          classificationVersion: 'taxonomy-classifier-6.3',
          fallbackReason: 'NO_MATCH',
          status: 'extracted',
        }),
      )
      expect(classificationRunService.appendRunAndRefreshLatest).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: CLASSIFICATION_LEDGER_ATDD_PRIMARY_CASE.caseId,
          pathDecision: 'UNCLASSIFIED',
          classificationStatus: 'ABSTAINED',
          fallbackReason: 'NO_MATCH',
        }),
      )
    },
  )

  it.skip(
    '[P1][6.3-INT-004] should persist PENDING_RECLASSIFY semantics without aborting extraction when classifier returns a terminal engine failure result',
    async () => {
      const { CaseExtractionService } = require('./case-extraction.service')

      const complianceCaseRepository = {
        find: jest.fn().mockResolvedValue([CLASSIFICATION_LEDGER_ATDD_PRIMARY_CASE]),
        save: jest.fn().mockImplementation(async (entity: unknown) => entity),
      }
      const regulationClauseRepository = {
        find: jest.fn().mockResolvedValue([]),
      }
      const caseThemeIntelligenceService = {
        refineViolationThemes: jest.fn().mockResolvedValue(null),
      }
      const runtimeDomainSelector = {
        getSupportedDomains: jest.fn().mockReturnValue(['IT07']),
      }
      const taxonomyClassifierService = {
        classifyCaseText: jest.fn().mockReturnValue(
          CLASSIFICATION_LEDGER_ATDD_PENDING_RECLASSIFY_RESULT,
        ),
      }
      const classificationRunService = {
        appendRunAndRefreshLatest: jest.fn().mockResolvedValue(undefined),
      }
      const classificationTelemetryService = {
        publishLatestSnapshotWritten: jest.fn().mockResolvedValue(undefined),
      }

      const service = new CaseExtractionService(
        complianceCaseRepository,
        regulationClauseRepository,
        caseThemeIntelligenceService,
        taxonomyClassifierService,
        runtimeDomainSelector,
        classificationRunService,
        classificationTelemetryService,
      )

      const result = await service.extractBatch(CLASSIFICATION_LEDGER_ATDD_PRIMARY_CASE.importBatchId)

      expect(result.processedCount).toBe(1)
      expect(complianceCaseRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          l1Code: null,
          l2Code: null,
          confidenceScore: null,
          fallbackReason: 'PENDING_RECLASSIFY',
          status: 'extracted',
        }),
      )
      expect(classificationRunService.appendRunAndRefreshLatest).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: CLASSIFICATION_LEDGER_ATDD_PRIMARY_CASE.caseId,
          pathDecision: 'UNCLASSIFIED',
          classificationStatus: 'FAILED',
          fallbackReason: 'PENDING_RECLASSIFY',
        }),
      )
    },
  )

  it.skip(
    '[P1][6.3-INT-005] should preserve the saved classification run trace even when telemetry publication fails after DB persistence',
    async () => {
      const { CaseExtractionService } = require('./case-extraction.service')

      const complianceCaseRepository = {
        find: jest.fn().mockResolvedValue([CLASSIFICATION_LEDGER_ATDD_PRIMARY_CASE]),
        save: jest.fn().mockImplementation(async (entity: unknown) => entity),
      }
      const regulationClauseRepository = {
        find: jest.fn().mockResolvedValue([]),
      }
      const caseThemeIntelligenceService = {
        refineViolationThemes: jest.fn().mockResolvedValue(null),
      }
      const runtimeDomainSelector = {
        getSupportedDomains: jest.fn().mockReturnValue(['IT07']),
      }
      const taxonomyClassifierService = {
        classifyCaseText: jest.fn().mockReturnValue(
          CLASSIFICATION_LEDGER_ATDD_PRIMARY_RESULTS_BY_DOMAIN.IT07,
        ),
      }
      const classificationRunService = {
        appendRunAndRefreshLatest: jest.fn().mockResolvedValue(undefined),
      }
      const classificationTelemetryService = {
        publishLatestSnapshotWritten: jest
          .fn()
          .mockRejectedValue(new Error('telemetry sink unavailable')),
      }

      const service = new CaseExtractionService(
        complianceCaseRepository,
        regulationClauseRepository,
        caseThemeIntelligenceService,
        taxonomyClassifierService,
        runtimeDomainSelector,
        classificationRunService,
        classificationTelemetryService,
      )

      const result = await service.extractBatch(CLASSIFICATION_LEDGER_ATDD_PRIMARY_CASE.importBatchId)

      expect(result.processedCount).toBe(1)
      expect(classificationRunService.appendRunAndRefreshLatest).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: CLASSIFICATION_LEDGER_ATDD_PRIMARY_CASE.caseId,
          pathDecision: 'PRIMARY_CHAIN',
        }),
      )
      expect(complianceCaseRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          l1Code: 'IT07',
          l2Code: 'IT07-06',
          status: 'extracted',
        }),
      )
    },
  )
})
