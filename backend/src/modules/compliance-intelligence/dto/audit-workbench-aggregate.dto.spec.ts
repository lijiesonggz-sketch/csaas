import { describe, expect, it } from '@jest/globals'

import {
  AuditWorkbenchAggregateResponseDto,
  createEmptyAuditControlContext,
  createEmptyAuditControlContextForItem,
  enrichAuditResponseWithControlContext,
} from './audit-workbench-aggregate.dto'

describe('AuditWorkbenchAggregateDto', () => {
  describe('createEmptyAuditControlContext', () => {
    it('should reject missing audit record metadata', () => {
      expect(() => createEmptyAuditControlContext()).toThrow(
        'createEmptyAuditControlContext requires a reviewItemId and projectId',
      )
    })
  })

  describe('createEmptyAuditControlContextForItem', () => {
    it('should return an explicit formal empty context for a concrete audit item', () => {
      expect(createEmptyAuditControlContextForItem('review-item-1', 'project-123')).toEqual({
        controlId: null,
        matchedControls: [],
        sourceRecordId: 'review-item-1',
        sourceModule: 'audit',
        sourceRoute: '/projects/project-123/review',
      })
    })
  })

  describe('enrichAuditResponseWithControlContext', () => {
    const baseResponse: Omit<
      AuditWorkbenchAggregateResponseDto,
      'controlId' | 'matchedControls' | 'sourceRecordId' | 'sourceModule' | 'sourceRoute'
    > = {
      reviewItemId: 'review-item-1',
      reviewStatus: 'pending',
      confidenceLevel: 'medium',
      consistencyScores: {
        structural: null,
        semantic: 0.81,
        detail: 0.72,
      },
      highRiskFlag: false,
      canRerun: true,
      provenanceStatus: 'missing',
      citationChain: null,
    }

    it('should attach audit source metadata together with explicit empty control context', () => {
      const enriched = enrichAuditResponseWithControlContext(baseResponse, 'project-123')

      expect(enriched).toMatchObject({
        reviewItemId: 'review-item-1',
        controlId: null,
        matchedControls: [],
        sourceModule: 'audit',
        sourceRecordId: 'review-item-1',
        sourceRoute: '/projects/project-123/review',
      })
    })

    it('should preserve non-context review fields while enriching audit context', () => {
      const enriched = enrichAuditResponseWithControlContext(baseResponse, 'project-999')

      expect(enriched.reviewStatus).toBe('pending')
      expect(enriched.confidenceLevel).toBe('medium')
      expect(enriched.consistencyScores).toEqual(baseResponse.consistencyScores)
      expect(enriched.highRiskFlag).toBe(false)
      expect(enriched.canRerun).toBe(true)
    })
  })
})
