import {
  createControlMapPayload,
  createObligationPayload,
  expectedSuggestionPattern,
  obligationDetailResponse,
  obligationListResponse,
  regulationClausesResponse,
  updateObligationPayload,
  VALID_CONTROL_MAP_ID,
  VALID_OBLIGATION_ID,
} from './atdd-story-kg2-4-3-fixtures'

type ObligationsClientSubject = {
  apiFetch: jest.Mock
  listObligations: (input?: Record<string, unknown>) => Promise<Record<string, unknown>>
  getObligation: (id: string) => Promise<Record<string, unknown>>
  searchRegulationClauses: (input?: Record<string, unknown>) => Promise<Record<string, unknown>>
  createObligation: (input: Record<string, unknown>) => Promise<Record<string, unknown>>
  updateObligation: (id: string, input: Record<string, unknown>) => Promise<Record<string, unknown>>
  createObligationControlMap: (
    obligationId: string,
    input: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>
  deleteObligationControlMap: (
    obligationId: string,
    mapId: string,
  ) => Promise<Record<string, unknown>>
  suggestObligationCode: (input: {
    clauseCode: string
    articleNo?: string | null
    existingCodes: string[]
  }) => string
}

describe('Story KG2 4.3 ATDD RED - obligation admin typed client contract', () => {
  const createSubject = (): ObligationsClientSubject => {
    throw new Error(
      'RED PHASE: obligation admin typed client has not been implemented yet',
    )
  }

  test.skip(
    '[P1][4.3-API-001] should call the paginated obligations admin list endpoint with obligationType/status/applicableSector/keyword filters and return the stable page envelope',
    async () => {
      const subject = createSubject()

      const result = await subject.listObligations({
        page: 1,
        limit: 20,
        keyword: '复核',
        obligationType: 'MANDATORY',
        status: 'ACTIVE',
        applicableSector: '银行',
      })

      expect(subject.apiFetch).toHaveBeenCalledWith(
        '/api/admin/knowledge-graph/obligations?page=1&limit=20&obligationType=MANDATORY&status=ACTIVE&applicableSector=%E9%93%B6%E8%A1%8C&keyword=%E5%A4%8D%E6%A0%B8',
        expect.any(Object),
      )
      expect(result).toMatchObject(obligationListResponse)
    },
  )

  test.skip(
    '[P1][4.3-API-002] should expose obligation detail and clause search helpers so the page never needs ad-hoc fetch logic for clause linking or detail display',
    async () => {
      const subject = createSubject()

      const detail = await subject.getObligation(VALID_OBLIGATION_ID)
      const clauses = await subject.searchRegulationClauses({
        page: 1,
        limit: 10,
        keyword: '复核',
      })
      await subject.deleteObligationControlMap(
        VALID_OBLIGATION_ID,
        VALID_CONTROL_MAP_ID,
      )

      expect(detail).toMatchObject(obligationDetailResponse)
      expect(clauses).toMatchObject(regulationClausesResponse)
      expect(subject.apiFetch).toHaveBeenCalledWith(
        `/api/admin/knowledge-graph/obligations/${VALID_OBLIGATION_ID}`,
        expect.any(Object),
      )
      expect(subject.apiFetch).toHaveBeenCalledWith(
        '/api/admin/knowledge-graph/regulation-clauses?page=1&limit=10&keyword=%E5%A4%8D%E6%A0%B8',
        expect.any(Object),
      )
      expect(subject.apiFetch).toHaveBeenCalledWith(
        `/api/admin/knowledge-graph/obligations/${VALID_OBLIGATION_ID}/control-maps/${VALID_CONTROL_MAP_ID}`,
        expect.objectContaining({ method: 'DELETE' }),
      )
    },
  )

  test.skip(
    '[P1][4.3-API-003] should expose create/update/control-map helpers and a stable obligation code suggestion derived from the selected clause context',
    async () => {
      const subject = createSubject()

      const suggestedCode = subject.suggestObligationCode({
        clauseCode: 'CLAUSE-IT04-REP-001',
        articleNo: '4.1',
        existingCodes: ['OBL-IT04-4.1-01', 'OBL-IT04-4.4-01'],
      })
      const created = await subject.createObligation(createObligationPayload)
      await subject.updateObligation(VALID_OBLIGATION_ID, updateObligationPayload)
      await subject.createObligationControlMap(
        VALID_OBLIGATION_ID,
        createControlMapPayload,
      )

      expect(suggestedCode).toMatch(expectedSuggestionPattern)
      expect(subject.apiFetch).toHaveBeenCalledWith(
        '/api/admin/knowledge-graph/obligations',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(createObligationPayload),
        }),
      )
      expect(subject.apiFetch).toHaveBeenCalledWith(
        `/api/admin/knowledge-graph/obligations/${VALID_OBLIGATION_ID}`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(updateObligationPayload),
        }),
      )
      expect(subject.apiFetch).toHaveBeenCalledWith(
        `/api/admin/knowledge-graph/obligations/${VALID_OBLIGATION_ID}/control-maps`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(createControlMapPayload),
        }),
      )
      expect(created).toMatchObject({
        obligationCode: createObligationPayload.obligationCode,
        obligationText: createObligationPayload.obligationText,
      })
    },
  )
})
