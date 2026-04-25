import { CaseExtractionService } from './case-extraction.service'

describe('CaseExtractionService rollout policy integration', () => {
  const createHarness = () => {
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
      resolvePolicyDecision: jest.fn(),
    }
    const failureModeService = {
      findByL2Code: jest.fn(),
    }
    const caseClusteringChainService = {
      resolveControlPointsByL2Code: jest.fn(),
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
      taxonomyClassifierService,
      runtimeDomainSelectorService,
      classificationRunService,
      domainRolloutPolicyService,
      failureModeService,
      caseClusteringChainService,
    }
  }

  it('should persist primary snapshot when policy authorizes primary and the chain is executable', async () => {
    const harness = createHarness()
    harness.complianceCaseRepository.find.mockResolvedValue([
      {
        caseId: 'case-primary-001',
        importBatchId: 'batch-primary',
        status: 'pending',
        caseFacts: '后台直接修改核心业务系统数据。',
        penaltyReason: '留痕缺失。',
      },
    ])
    harness.runtimeDomainSelectorService.getSupportedDomains.mockReturnValue(['IT07'])
    harness.taxonomyClassifierService.classifyCaseText.mockReturnValue({
      l1Code: 'IT07',
      l2Code: 'IT07-06',
      l2Name: '核心业务系统数据被后台修改/篡改',
      score: 0.91,
      confidenceScore: 0.91,
      scoreGap: 0.18,
      decisionSource: 'rule',
      matchedSignals: ['后台直接修改'],
      matchedPhrases: ['后台直接修改'],
      matchedTokens: ['后台'],
      classifierVersion: 'taxonomy-classifier-6.4',
      mappingVersion: '2026-04-07',
      rulebookVersion: 'it07-rulebook-v1',
      classifiedAt: new Date().toISOString(),
      pathDecision: 'PRIMARY_CHAIN',
      failureSemantics: null,
    })
    harness.failureModeService.findByL2Code.mockResolvedValue({
      items: [{ failureModeCode: 'FM-1' }],
    })
    harness.caseClusteringChainService.resolveControlPointsByL2Code.mockResolvedValue({
      items: [{ controlCode: 'CTRL-1' }],
      total: 1,
    })
    harness.domainRolloutPolicyService.resolvePolicyDecision.mockResolvedValue({
      policy: {
        l1Code: 'IT07',
        rolloutState: 'domain-primary',
        allowLegacyFallback: false,
        primaryThreshold: 0.78,
        shadowWindowDays: 14,
        killSwitchEnabled: false,
        activeClassifierVersion: 'taxonomy-classifier-6.4',
      },
      rolloutState: 'domain-primary',
      stateAllowsPrimary: true,
      pathDecision: 'PRIMARY_CHAIN',
      failureSemantic: null,
      primaryExecutability: {
        failureModeCount: 1,
        controlCandidateCount: 1,
        isExecutable: true,
        reason: 'READY',
      },
      reason: 'primary-path-authorized',
    })

    await harness.service.extractBatch('batch-primary')

    expect(harness.classificationRunService.appendRunAndRefreshLatest).toHaveBeenCalledWith(
      expect.objectContaining({
        pathDecision: 'PRIMARY_CHAIN',
        decisionTrace: expect.objectContaining({
          rolloutState: 'domain-primary',
        }),
      }),
    )
    expect(harness.complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: 'IT07',
        l2Code: 'IT07-06',
        classificationSource: 'rule',
        status: 'extracted',
      }),
    )
  })

  it('should nullify latest snapshot and preserve fallback reason when policy forces legacy fallback', async () => {
    const harness = createHarness()
    harness.complianceCaseRepository.find.mockResolvedValue([
      {
        caseId: 'case-kill-switch-001',
        importBatchId: 'batch-kill-switch',
        status: 'pending',
        caseFacts: '观察窗口内风险切换。',
        penaltyReason: 'kill switch 触发。',
      },
    ])
    harness.runtimeDomainSelectorService.getSupportedDomains.mockReturnValue(['IT07'])
    harness.taxonomyClassifierService.classifyCaseText.mockReturnValue({
      l1Code: 'IT07',
      l2Code: 'IT07-06',
      l2Name: '核心业务系统数据被后台修改/篡改',
      score: 0.95,
      confidenceScore: 0.95,
      scoreGap: 0.22,
      decisionSource: 'rule',
      matchedSignals: ['观察窗口'],
      matchedPhrases: ['观察窗口'],
      matchedTokens: ['观察'],
      classifierVersion: 'taxonomy-classifier-6.4',
      mappingVersion: '2026-04-07',
      rulebookVersion: 'it07-rulebook-v1',
      classifiedAt: new Date().toISOString(),
      pathDecision: 'PRIMARY_CHAIN',
      failureSemantics: null,
    })
    harness.failureModeService.findByL2Code.mockResolvedValue({
      items: [{ failureModeCode: 'FM-1' }],
    })
    harness.caseClusteringChainService.resolveControlPointsByL2Code.mockResolvedValue({
      items: [{ controlCode: 'CTRL-1' }],
      total: 1,
    })
    harness.domainRolloutPolicyService.resolvePolicyDecision.mockResolvedValue({
      policy: {
        l1Code: 'IT07',
        rolloutState: 'domain-shadow',
        allowLegacyFallback: true,
        primaryThreshold: 0.78,
        shadowWindowDays: 14,
        killSwitchEnabled: true,
        activeClassifierVersion: 'taxonomy-classifier-6.4',
      },
      rolloutState: 'domain-shadow',
      stateAllowsPrimary: false,
      pathDecision: 'LEGACY_FALLBACK',
      failureSemantic: 'LEGACY_FALLBACK_TRIGGERED',
      primaryExecutability: {
        failureModeCount: 1,
        controlCandidateCount: 1,
        isExecutable: true,
        reason: 'READY',
      },
      reason: 'kill-switch-enabled',
    })

    await harness.service.extractBatch('batch-kill-switch')

    expect(harness.classificationRunService.appendRunAndRefreshLatest).toHaveBeenCalledWith(
      expect.objectContaining({
        pathDecision: 'LEGACY_FALLBACK',
        fallbackReason: 'LEGACY_FALLBACK_TRIGGERED',
      }),
    )
    expect(harness.complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: null,
        l2Code: null,
        classificationSource: 'none',
        fallbackReason: 'LEGACY_FALLBACK_TRIGGERED',
        status: 'extracted',
      }),
    )
  })

  it('should prefer an abstain-protected primary candidate over another domain legacy fallback', async () => {
    const harness = createHarness()
    harness.complianceCaseRepository.find.mockResolvedValue([
      {
        caseId: 'case-abstain-priority-001',
        importBatchId: 'batch-abstain-priority',
        status: 'pending',
        caseFacts: '同一案例同时触发两个域，其中主域 policy 禁止 fallback。',
        penaltyReason: '应优先进入人工复核而不是被次级域 old-chain 吞掉。',
      },
    ])
    harness.runtimeDomainSelectorService.getSupportedDomains.mockReturnValue([
      'IT04',
      'IT08',
    ])
    harness.taxonomyClassifierService.classifyCaseText.mockImplementation(
      ({ preferredL1Code }: { preferredL1Code: string }) => {
        if (preferredL1Code === 'IT08') {
          return {
            l1Code: 'IT08',
            l2Code: 'IT08-03',
            l2Name: '恢复演练与韧性验证不足',
            score: 0.9,
            confidenceScore: 0.9,
            scoreGap: 0.18,
            decisionSource: 'semantic',
            matchedSignals: [],
            matchedPhrases: ['恢复演练'],
            matchedTokens: ['恢复'],
            classifierVersion: 'taxonomy-classifier-6.4',
            mappingVersion: '2026-04-07',
            rulebookVersion: 'it08-rulebook-v1',
            classifiedAt: new Date().toISOString(),
            pathDecision: 'PRIMARY_CHAIN',
            failureSemantics: null,
          }
        }

        return {
          l1Code: 'IT04',
          l2Code: null,
          l2Name: null,
          score: 0.4,
          confidenceScore: 0.4,
          scoreGap: 0.01,
          decisionSource: 'none',
          matchedSignals: [],
          matchedPhrases: [],
          matchedTokens: [],
          classifierVersion: 'taxonomy-classifier-6.4',
          mappingVersion: '2026-04-07',
          rulebookVersion: 'it04-rulebook-v1',
          classifiedAt: new Date().toISOString(),
          pathDecision: 'UNCLASSIFIED',
          failureSemantics: 'LOW_CONFIDENCE',
        }
      },
    )
    harness.failureModeService.findByL2Code.mockImplementation(
      async (l2Code: string) => ({
        items: l2Code === 'IT08-03' ? [] : [{ failureModeCode: 'FM-1' }],
      }),
    )
    harness.caseClusteringChainService.resolveControlPointsByL2Code.mockResolvedValue({
      items: [],
      total: 0,
    })
    harness.domainRolloutPolicyService.resolvePolicyDecision
      .mockResolvedValueOnce({
        policy: {
          l1Code: 'IT04',
          rolloutState: 'domain-compare',
          allowLegacyFallback: true,
          primaryThreshold: 0.7,
          shadowWindowDays: 14,
          killSwitchEnabled: false,
          activeClassifierVersion: 'taxonomy-classifier-6.4',
        },
        rolloutState: 'domain-compare',
        stateAllowsPrimary: false,
        pathDecision: 'LEGACY_FALLBACK',
        failureSemantic: 'LOW_CONFIDENCE',
        primaryExecutability: {
          failureModeCount: 0,
          controlCandidateCount: 0,
          isExecutable: false,
          reason: 'NO_PRIMARY_CLASSIFICATION',
        },
        reason: 'state-prefers-legacy',
      })
      .mockResolvedValueOnce({
        policy: {
          l1Code: 'IT08',
          rolloutState: 'domain-primary',
          allowLegacyFallback: false,
          primaryThreshold: 0.7,
          shadowWindowDays: 14,
          killSwitchEnabled: false,
          activeClassifierVersion: 'taxonomy-classifier-6.4',
        },
        rolloutState: 'domain-primary',
        stateAllowsPrimary: true,
        pathDecision: 'ABSTAIN',
        failureSemantic: 'MAPPING_MISSING',
        primaryExecutability: {
          failureModeCount: 0,
          controlCandidateCount: 0,
          isExecutable: false,
          reason: 'NO_CONTROL_CANDIDATE',
        },
        reason: 'fallback-disallowed-by-policy',
      })

    await harness.service.extractBatch('batch-abstain-priority')

    expect(harness.classificationRunService.appendRunAndRefreshLatest).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: 'IT08',
        pathDecision: 'ABSTAIN',
      }),
    )
  })
})
