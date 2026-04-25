import {
  TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION,
  TAXONOMY_ROLLOUT_POLICY_ATDD_FALLBACK_DECISION,
  TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION,
  TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION,
} from '../testing/taxonomy-rollout-policy.atdd.fixtures'

describe('Story 6.5 - Case Extraction Rollout Policy (ATDD)', () => {
  it.skip(
    '[P0][6.5-INT-004] should choose PRIMARY_CHAIN only when domain policy allows it and the primary chain is executable instead of relying on confidence ordering alone',
    async () => {
      const { CaseExtractionService } = require('./case-extraction.service')

      const complianceCaseRepository = {
        find: jest.fn().mockResolvedValue([
          {
            caseId: 'case-rollout-primary-001',
            importBatchId: 'batch-6-5-primary',
            status: 'pending',
            caseFacts: '核心业务系统被后台直接修改且未保留审计留痕。',
            penaltyReason: '后台修改核心业务数据、越权操作和日志缺失。',
          },
        ]),
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
        classifyCaseText: jest
          .fn()
          .mockImplementation(({ preferredL1Code }: { preferredL1Code: string }) => {
            if (preferredL1Code === 'IT07') {
              return {
                ...TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION.classifierResult,
                decisionSource: 'rule',
                matchedSignals: ['后台直接修改', '留痕缺失'],
                matchedPhrases: ['后台直接修改核心业务系统'],
                matchedTokens: ['后台', '留痕'],
                classifierVersion: 'taxonomy-classifier-6.4',
                mappingVersion: '2026-04-07',
                rulebookVersion: 'it07-rulebook-v1',
                classifiedAt: '2026-04-25T15:05:00+08:00',
                score: 0.91,
                l2Name: '核心业务系统数据被后台修改/篡改',
              }
            }

            return {
              l1Code: preferredL1Code,
              l2Code: null,
              l2Name: null,
              score: 0,
              confidenceScore: 0,
              scoreGap: 0,
              decisionSource: 'none',
              matchedSignals: [],
              matchedPhrases: [],
              matchedTokens: [],
              classifierVersion: 'taxonomy-classifier-6.4',
              mappingVersion: '2026-04-07',
              rulebookVersion: `${preferredL1Code.toLowerCase()}-rulebook-v1`,
              classifiedAt: '2026-04-25T15:05:00+08:00',
              pathDecision: 'UNCLASSIFIED',
              failureSemantics: 'NO_MATCH',
            }
          }),
      }
      const classificationRunService = {
        appendRunAndRefreshLatest: jest.fn().mockResolvedValue(undefined),
      }
      const classificationTelemetryService = {
        publishLatestSnapshotWritten: jest.fn().mockResolvedValue(undefined),
      }
      const domainRolloutPolicyService = {
        resolvePolicyDecision: jest.fn().mockReturnValue({
          rolloutState: TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION.rolloutState,
          pathDecision:
            TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION.expectedPathDecision,
          fallbackReason: null,
          primaryExecutability:
            TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION.primaryExecutability,
          policySnapshot: TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION,
        }),
      }
      const caseClusteringChainService = {
        resolveControlPointsByL2Code: jest.fn().mockResolvedValue({
          items: [{ controlCode: 'CTRL-IT07-001' }, { controlCode: 'CTRL-IT07-002' }],
          total: 2,
        }),
      }

      const service = new CaseExtractionService(
        complianceCaseRepository,
        regulationClauseRepository,
        caseThemeIntelligenceService,
        taxonomyClassifierService,
        runtimeDomainSelector,
        classificationRunService,
        classificationTelemetryService,
        undefined,
        domainRolloutPolicyService,
        caseClusteringChainService,
      )

      await service.extractBatch('batch-6-5-primary')

      expect(domainRolloutPolicyService.resolvePolicyDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          l1Code: 'IT07',
          primaryExecutability: expect.objectContaining({
            controlCandidateCount:
              TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION.primaryExecutability.controlCandidateCount,
          }),
        }),
      )
      expect(classificationRunService.appendRunAndRefreshLatest).toHaveBeenCalledWith(
        expect.objectContaining({
          pathDecision:
            TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION.expectedPathDecision,
          decisionTrace: expect.objectContaining({
            rolloutState: TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION.rolloutState,
          }),
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

  it.skip(
    '[P0][6.5-INT-005] should short-circuit primary path when kill switch is enabled and record the control-plane evidence in the latest classification trace',
    async () => {
      const { CaseExtractionService } = require('./case-extraction.service')

      const complianceCaseRepository = {
        find: jest.fn().mockResolvedValue([
          {
            caseId: 'case-rollout-kill-switch-001',
            importBatchId: 'batch-6-5-kill-switch',
            status: 'pending',
            caseFacts: '运维高风险场景，观察窗口内暂时要求强制回旧链。',
            penaltyReason: '切换窗口内触发 kill switch 保护。',
          },
        ]),
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
        classifyCaseText: jest.fn().mockReturnValue({
          ...TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION.classifierResult,
          decisionSource: 'rule',
          matchedSignals: ['核心系统', '留痕'],
          matchedPhrases: ['高风险观察窗口'],
          matchedTokens: ['观察窗口'],
          classifierVersion: 'taxonomy-classifier-6.4',
          mappingVersion: '2026-04-07',
          rulebookVersion: 'it07-rulebook-v1',
          classifiedAt: '2026-04-25T15:06:00+08:00',
          score: 0.95,
          l2Name: '核心业务系统数据被后台修改/篡改',
        }),
      }
      const classificationRunService = {
        appendRunAndRefreshLatest: jest.fn().mockResolvedValue(undefined),
      }
      const classificationTelemetryService = {
        publishLatestSnapshotWritten: jest.fn().mockResolvedValue(undefined),
      }
      const domainRolloutPolicyService = {
        resolvePolicyDecision: jest.fn().mockReturnValue({
          rolloutState:
            TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION.rolloutState,
          pathDecision:
            TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION.expectedPathDecision,
          fallbackReason:
            TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION.expectedFallbackReason,
          primaryExecutability:
            TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION.primaryExecutability,
          policySnapshot: TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION,
        }),
      }
      const caseClusteringChainService = {
        resolveControlPointsByL2Code: jest.fn().mockResolvedValue({
          items: [{ controlCode: 'CTRL-IT07-001' }],
          total: 1,
        }),
      }

      const service = new CaseExtractionService(
        complianceCaseRepository,
        regulationClauseRepository,
        caseThemeIntelligenceService,
        taxonomyClassifierService,
        runtimeDomainSelector,
        classificationRunService,
        classificationTelemetryService,
        undefined,
        domainRolloutPolicyService,
        caseClusteringChainService,
      )

      await service.extractBatch('batch-6-5-kill-switch')

      expect(classificationRunService.appendRunAndRefreshLatest).toHaveBeenCalledWith(
        expect.objectContaining({
          pathDecision:
            TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION.expectedPathDecision,
          fallbackReason:
            TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION.expectedFallbackReason,
          decisionTrace: expect.objectContaining({
            rolloutState:
              TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION.rolloutState,
            killSwitchEnabled: true,
          }),
        }),
      )
      expect(complianceCaseRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          l1Code: null,
          l2Code: null,
          fallbackReason:
            TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION.expectedFallbackReason,
          status: 'extracted',
        }),
      )
    },
  )

  it.skip(
    '[P1][6.5-INT-006] should refuse PRIMARY_CHAIN when failure-mode or control candidates are empty and fall back to ABSTAIN or LEGACY_FALLBACK according to domain policy',
    async () => {
      const { CaseExtractionService } = require('./case-extraction.service')

      const complianceCaseRepository = {
        find: jest.fn().mockResolvedValue([
          {
            caseId: 'case-rollout-abstain-001',
            importBatchId: 'batch-6-5-abstain',
            status: 'pending',
            caseFacts: '恢复演练告警命中，但当前域控制映射尚未满足 primary 可执行条件。',
            penaltyReason: '映射缺口存在，不允许直接用旧链兜底。',
          },
        ]),
        save: jest.fn().mockImplementation(async (entity: unknown) => entity),
      }
      const regulationClauseRepository = {
        find: jest.fn().mockResolvedValue([]),
      }
      const caseThemeIntelligenceService = {
        refineViolationThemes: jest.fn().mockResolvedValue(null),
      }
      const runtimeDomainSelector = {
        getSupportedDomains: jest.fn().mockReturnValue(['IT08']),
      }
      const taxonomyClassifierService = {
        classifyCaseText: jest.fn().mockReturnValue({
          ...TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION.classifierResult,
          decisionSource: 'semantic',
          matchedSignals: [],
          matchedPhrases: ['恢复演练告警'],
          matchedTokens: ['恢复', '演练'],
          classifierVersion: 'taxonomy-classifier-6.4',
          mappingVersion: '2026-04-07',
          rulebookVersion: 'it08-rulebook-v1',
          classifiedAt: '2026-04-25T15:07:00+08:00',
          score: 0.82,
          l2Name: '恢复演练与韧性验证不足',
        }),
      }
      const classificationRunService = {
        appendRunAndRefreshLatest: jest.fn().mockResolvedValue(undefined),
      }
      const classificationTelemetryService = {
        publishLatestSnapshotWritten: jest.fn().mockResolvedValue(undefined),
      }
      const domainRolloutPolicyService = {
        resolvePolicyDecision: jest.fn().mockReturnValue({
          rolloutState: TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION.rolloutState,
          pathDecision:
            TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION.expectedPathDecision,
          fallbackReason:
            TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION.expectedFallbackReason,
          primaryExecutability:
            TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION.primaryExecutability,
          policySnapshot: TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION,
        }),
      }
      const caseClusteringChainService = {
        resolveControlPointsByL2Code: jest.fn().mockResolvedValue({
          items: [],
          total: 0,
        }),
      }

      const service = new CaseExtractionService(
        complianceCaseRepository,
        regulationClauseRepository,
        caseThemeIntelligenceService,
        taxonomyClassifierService,
        runtimeDomainSelector,
        classificationRunService,
        classificationTelemetryService,
        undefined,
        domainRolloutPolicyService,
        caseClusteringChainService,
      )

      await service.extractBatch('batch-6-5-abstain')

      expect(classificationRunService.appendRunAndRefreshLatest).toHaveBeenCalledWith(
        expect.objectContaining({
          pathDecision:
            TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION.expectedPathDecision,
          fallbackReason:
            TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION.expectedFallbackReason,
        }),
      )
      expect(complianceCaseRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          l1Code: null,
          l2Code: null,
          fallbackReason:
            TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION.expectedFallbackReason,
          status: 'extracted',
        }),
      )
    },
  )
})
