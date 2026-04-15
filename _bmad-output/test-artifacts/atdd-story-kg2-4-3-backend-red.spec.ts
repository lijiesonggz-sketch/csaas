import {
  createControlMapPayload,
  VALID_CONTROL_ID,
  VALID_CONTROL_MAP_ID,
  VALID_OBLIGATION_ID,
} from './atdd-story-kg2-4-3-fixtures'

type ObligationAdminBackendSubject = {
  createControlMap: (
    obligationId: string,
    input: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>
  deleteControlMap: (obligationId: string, mapId: string) => Promise<Record<string, unknown>>
  obligationControlMapRepo: {
    findOne: jest.Mock
    create: jest.Mock
    save: jest.Mock
    delete: jest.Mock
  }
}

describe('Story KG2 4.3 ATDD RED - obligation control-map management guardrails', () => {
  const createSubject = (): ObligationAdminBackendSubject => {
    throw new Error(
      'RED PHASE: obligation admin backend has not been upgraded with create/delete control-map operations yet',
    )
  }

  test.skip(
    '[P0][4.3-BE-001] should create an obligation control map for the selected obligation and persist the requested FULL/PARTIAL coverage semantics',
    async () => {
      const subject = createSubject()

      const result = await subject.createControlMap(
        VALID_OBLIGATION_ID,
        createControlMapPayload,
      )

      expect(subject.obligationControlMapRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          obligationId: VALID_OBLIGATION_ID,
          controlId: VALID_CONTROL_ID,
          coverage: createControlMapPayload.coverage,
        }),
      )
      expect(subject.obligationControlMapRepo.save).toHaveBeenCalled()
      expect(result).toMatchObject({
        controlId: VALID_CONTROL_ID,
        coverage: createControlMapPayload.coverage,
      })
    },
  )

  test.skip(
    '[P0][4.3-BE-002] should reject duplicate obligation-control-map creation instead of silently creating duplicated regulation obligations to control-point relations',
    async () => {
      const subject = createSubject()

      await expect(
        subject.createControlMap(VALID_OBLIGATION_ID, createControlMapPayload),
      ).rejects.toThrow('obligation control map already exists')
    },
  )

  test.skip(
    '[P0][4.3-BE-003] should delete an obligation control map only when the map belongs to the currently selected obligation',
    async () => {
      const subject = createSubject()

      const result = await subject.deleteControlMap(
        VALID_OBLIGATION_ID,
        VALID_CONTROL_MAP_ID,
      )

      expect(subject.obligationControlMapRepo.findOne).toHaveBeenCalled()
      expect(subject.obligationControlMapRepo.delete).toHaveBeenCalledWith({
        id: VALID_CONTROL_MAP_ID,
      })
      expect(result).toMatchObject({ success: true })
    },
  )

  test.skip(
    '[P0][4.3-BE-004] should reject control-map deletion when the map belongs to another obligation to prevent cross-record data corruption',
    async () => {
      const subject = createSubject()

      await expect(
        subject.deleteControlMap(VALID_OBLIGATION_ID, VALID_CONTROL_MAP_ID),
      ).rejects.toThrow('obligation control map does not belong to the current obligation')
    },
  )
})
