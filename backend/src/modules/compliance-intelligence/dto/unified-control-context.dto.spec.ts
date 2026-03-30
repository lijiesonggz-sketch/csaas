import { describe, expect, it } from '@jest/globals';

import {
  ControlContext,
  SourceModule,
  MatchedControlReference,
} from './unified-control-context.dto';

describe('UnifiedControlContextDto', () => {
  describe('SourceModule', () => {
    it('should define correct enum values', () => {
      const radarModule: SourceModule = 'radar';
      const reportModule: SourceModule = 'report';
      const auditModule: SourceModule = 'audit';

      expect(radarModule).toBe('radar');
      expect(reportModule).toBe('report');
      expect(auditModule).toBe('audit');
    });
  });

  describe('MatchedControlReference', () => {
    it('should create valid reference object', () => {
      const reference: MatchedControlReference = {
        controlId: 'ctrl-001',
        controlName: '数据分类与标识',
        packSource: 'base',
        priority: 'HIGH',
      };

      expect(reference.controlId).toBe('ctrl-001');
      expect(reference.controlName).toBe('数据分类与标识');
      expect(reference.packSource).toBe('base');
      expect(reference.priority).toBe('HIGH');
    });
  });

  describe('ControlContext', () => {
    it('should create valid context with all required fields', () => {
      const context: ControlContext = {
        controlId: 'ctrl-001',
        matchedControls: [
          {
            controlId: 'ctrl-001',
            controlName: '数据分类与标识',
            packSource: 'base',
            priority: 'HIGH',
          },
        ],
        sourceModule: 'radar',
        sourceRecordId: 'record-123',
        sourceRoute: '/radar/compliance/123',
      };

      expect(context.controlId).toBe('ctrl-001');
      expect(context.matchedControls).toHaveLength(1);
      expect(context.sourceModule).toBe('radar');
      expect(context.sourceRecordId).toBe('record-123');
      expect(context.sourceRoute).toBe('/radar/compliance/123');
    });

    it('should allow null controlId for multiple controls scenario', () => {
      const context: ControlContext = {
        controlId: null,
        matchedControls: [
          {
            controlId: 'ctrl-001',
            controlName: '数据分类与标识',
            packSource: 'base',
            priority: 'HIGH',
          },
          {
            controlId: 'ctrl-002',
            controlName: '个人信息保护',
            packSource: 'sector',
            priority: 'MEDIUM',
          },
        ],
        sourceModule: 'report',
        sourceRecordId: 'report-456',
        sourceRoute: '/reports/report-456',
      };

      expect(context.controlId).toBeNull();
      expect(context.matchedControls).toHaveLength(2);
    });

    it('should allow empty matchedControls array', () => {
      const context: ControlContext = {
        controlId: null,
        matchedControls: [],
        sourceModule: 'audit',
        sourceRecordId: 'review-789',
        sourceRoute: '/projects/proj-001/review',
      };

      expect(context.matchedControls).toEqual([]);
    });

    it('should require null controlId when no controls are matched', () => {
      const context: ControlContext = {
        controlId: null,
        matchedControls: [],
        sourceModule: 'radar',
        sourceRecordId: 'record-123',
        sourceRoute: '/radar/compliance',
      };

      expect(context.controlId).toBeNull();
      expect(context.sourceRoute).toBe('/radar/compliance');
    });
  });
});
