import { describe, expect, it } from '@jest/globals'

import { enrichControlNodeWithContext } from './compile-control-report.dto'

describe('CompileControlReportDto', () => {
  describe('enrichControlNodeWithContext', () => {
    const baseNode = {
      controlId: 'control-1',
      controlCode: 'CTRL-DG-001',
      controlName: '监管报送准确性控制',
      currentStatus: 'PARTIAL' as const,
      gapLevel: 'HIGH' as const,
      clauses: [],
      cases: [],
      evidences: [],
      recommendations: [],
    }

    it('should enrich a control node with the Story 7.1 report context contract', () => {
      const enriched = enrichControlNodeWithContext(baseNode, 'report-123')

      expect(enriched).toMatchObject({
        controlId: 'control-1',
        matchedControls: [
          {
            controlId: 'control-1',
            controlName: '监管报送准确性控制',
            packSource: 'report',
            priority: 'HIGH',
          },
        ],
        sourceModule: 'report',
        sourceRecordId: 'report-123',
        sourceRoute: '/reports/report-123',
      })
    })

    it('should keep single-control shortcuts aligned with matchedControls', () => {
      const enriched = enrichControlNodeWithContext(baseNode, 'report-456')

      expect(enriched.controlId).toBe('control-1')
      expect(enriched.matchedControls).toHaveLength(1)
      expect(enriched.matchedControls[0].controlId).toBe(enriched.controlId)
      expect(enriched.matchedControls[0].controlName).toBe(baseNode.controlName)
    })
  })
})
