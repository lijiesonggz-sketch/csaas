import {
  CLASSIFICATION_LEDGER_ATDD_EXPECTED_LEDGER_FIELDS,
  CLASSIFICATION_LEDGER_ATDD_EXPECTED_LATEST_POINTER_CASE,
  CLASSIFICATION_LEDGER_ATDD_EXPECTED_PRIMARY_RUN,
} from '../testing/classification-ledger.atdd.fixtures'

describe('Story 6.3 - Compliance Case Classification Run Service (ATDD)', () => {
  it.skip(
    '[P0][6.3-INT-006] should flip the previous latest run to false before inserting the new latest run for the same case',
    async () => {
      const { ComplianceCaseClassificationRunService } = require('./compliance-case-classification-run.service')

      let manager
      manager = {
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        create: jest
          .fn()
          .mockImplementation((_entity: unknown, payload: unknown) => payload),
        save: jest
          .fn()
          .mockImplementation(async (_entity: unknown, payload: unknown) => payload),
        transaction: jest
          .fn()
          .mockImplementation(async (callback: (tx: typeof manager) => unknown) =>
            callback(manager),
          ),
      }
      const classificationRunRepository = {
        manager,
      }

      const service = new ComplianceCaseClassificationRunService(
        classificationRunRepository,
      )

      await service.appendRunAndRefreshLatest(CLASSIFICATION_LEDGER_ATDD_EXPECTED_PRIMARY_RUN)

      expect(manager.transaction).toHaveBeenCalled()
      expect(manager.update).toHaveBeenCalledWith(
        expect.any(Function),
        {
          caseId: CLASSIFICATION_LEDGER_ATDD_EXPECTED_LATEST_POINTER_CASE.caseId,
          isLatest: true,
        },
        { isLatest: false },
      )
      expect(manager.save).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          caseId: CLASSIFICATION_LEDGER_ATDD_EXPECTED_PRIMARY_RUN.caseId,
          isLatest: true,
        }),
      )
    },
  )

  it.skip(
    '[P0][6.3-UNIT-007] should map classifier versions, signals, decisionTrace, pathDecision, classificationStatus, and fallbackReason into the append-only run payload',
    async () => {
      const { ComplianceCaseClassificationRunService } = require('./compliance-case-classification-run.service')

      let manager
      manager = {
        update: jest.fn().mockResolvedValue({ affected: 0 }),
        create: jest
          .fn()
          .mockImplementation((_entity: unknown, payload: unknown) => payload),
        save: jest
          .fn()
          .mockImplementation(async (_entity: unknown, payload: unknown) => payload),
        transaction: jest
          .fn()
          .mockImplementation(async (callback: (tx: typeof manager) => unknown) =>
            callback(manager),
          ),
      }
      const classificationRunRepository = {
        manager,
      }

      const service = new ComplianceCaseClassificationRunService(
        classificationRunRepository,
      )

      await service.appendRunAndRefreshLatest(CLASSIFICATION_LEDGER_ATDD_EXPECTED_PRIMARY_RUN)

      for (const field of CLASSIFICATION_LEDGER_ATDD_EXPECTED_LEDGER_FIELDS) {
        expect(manager.create).toHaveBeenCalledWith(
          expect.any(Function),
          expect.objectContaining({
            [field]:
              CLASSIFICATION_LEDGER_ATDD_EXPECTED_PRIMARY_RUN[
                field as keyof typeof CLASSIFICATION_LEDGER_ATDD_EXPECTED_PRIMARY_RUN
              ],
          }),
        )
      }
    },
  )

  it.skip(
    '[P1][6.3-UNIT-008] should keep classification semantics off ComplianceCase.status and express them only through latest snapshot fields plus run classificationStatus',
    async () => {
      const { buildLatestClassificationSnapshot } = require('./compliance-case-classification-run.service')

      const snapshot = buildLatestClassificationSnapshot(
        CLASSIFICATION_LEDGER_ATDD_EXPECTED_PRIMARY_RUN,
      )

      expect(snapshot).toEqual(
        expect.objectContaining({
          l1Code: 'IT07',
          l2Code: 'IT07-06',
          classificationSource: 'rule',
          classificationVersion: 'taxonomy-classifier-6.3',
          fallbackReason: null,
        }),
      )
      expect(snapshot).not.toHaveProperty('status', 'SUCCEEDED')
      expect(snapshot).not.toHaveProperty('status', 'UNCLASSIFIED')
      expect(snapshot).not.toHaveProperty('status', 'PENDING_RECLASSIFY')
    },
  )
})
