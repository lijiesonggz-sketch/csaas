import { RadarPush } from './radar-push.entity';

describe('RadarPush Entity - Compliance Extensions (Story 4.2)', () => {
  describe('Compliance Playbook Support', () => {
    it('should have checklistCompletedAt field', () => {
      // Arrange & Act
      const push = new RadarPush();
      push.checklistCompletedAt = new Date('2026-01-30T10:00:00Z');

      // Assert
      expect(push.checklistCompletedAt).toBeDefined();
      expect(push.checklistCompletedAt).toEqual(
        new Date('2026-01-30T10:00:00Z')
      );
    });

    it('should have checklistCompletedAt nullable', () => {
      // Arrange & Act
      const push = new RadarPush();
      push.checklistCompletedAt = null;

      // Assert
      expect(push.checklistCompletedAt).toBeNull();
    });

    it('should have playbookStatus field with ready status', () => {
      // Arrange & Act
      const push = new RadarPush();
      push.playbookStatus = 'ready';

      // Assert
      expect(push.playbookStatus).toBe('ready');
    });

    it('should have playbookStatus field with generating status', () => {
      // Arrange & Act
      const push = new RadarPush();
      push.playbookStatus = 'generating';

      // Assert
      expect(push.playbookStatus).toBe('generating');
    });

    it('should have playbookStatus field with failed status', () => {
      // Arrange & Act
      const push = new RadarPush();
      push.playbookStatus = 'failed';

      // Assert
      expect(push.playbookStatus).toBe('failed');
    });

    it('should have playbookStatus nullable', () => {
      // Arrange & Act
      const push = new RadarPush();
      push.playbookStatus = null;

      // Assert
      expect(push.playbookStatus).toBeNull();
    });

    it('should support compliance radar workflow', () => {
      // Arrange
      const push = new RadarPush();
      push.radarType = 'compliance';
      push.playbookStatus = 'ready';
      push.checklistCompletedAt = null;

      // Assert
      expect(push.radarType).toBe('compliance');
      expect(push.playbookStatus).toBe('ready');
      expect(push.checklistCompletedAt).toBeNull();
    });
  });

  describe('Compliance Playbook Status Transitions', () => {
    it('should transition from ready to generating', () => {
      // Arrange
      const push = new RadarPush();
      push.playbookStatus = 'ready';

      // Act
      push.playbookStatus = 'generating';

      // Assert
      expect(push.playbookStatus).toBe('generating');
    });

    it('should transition from generating to ready', () => {
      // Arrange
      const push = new RadarPush();
      push.playbookStatus = 'generating';

      // Act
      push.playbookStatus = 'ready';

      // Assert
      expect(push.playbookStatus).toBe('ready');
    });

    it('should transition from generating to failed', () => {
      // Arrange
      const push = new RadarPush();
      push.playbookStatus = 'generating';

      // Act
      push.playbookStatus = 'failed';

      // Assert
      expect(push.playbookStatus).toBe('failed');
    });

    it('should set checklistCompletedAt when submission happens', () => {
      // Arrange
      const push = new RadarPush();
      push.playbookStatus = 'ready';
      push.checklistCompletedAt = null;

      // Act
      push.checklistCompletedAt = new Date();

      // Assert
      expect(push.checklistCompletedAt).toBeDefined();
      expect(push.checklistCompletedAt).toBeInstanceOf(Date);
    });
  });

  describe('Non-Compliance Radar Support', () => {
    it('should allow null playbookStatus for tech radar', () => {
      // Arrange & Act
      const push = new RadarPush();
      push.radarType = 'tech';
      push.playbookStatus = null;

      // Assert
      expect(push.radarType).toBe('tech');
      expect(push.playbookStatus).toBeNull();
    });

    it('should allow null playbookStatus for industry radar', () => {
      // Arrange & Act
      const push = new RadarPush();
      push.radarType = 'industry';
      push.playbookStatus = null;

      // Assert
      expect(push.radarType).toBe('industry');
      expect(push.playbookStatus).toBeNull();
    });

    it('should allow null checklistCompletedAt for non-compliance radar', () => {
      // Arrange & Act
      const push = new RadarPush();
      push.radarType = 'industry';
      push.checklistCompletedAt = null;

      // Assert
      expect(push.radarType).toBe('industry');
      expect(push.checklistCompletedAt).toBeNull();
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with existing RadarPush fields', () => {
      // Arrange & Act
      const push = new RadarPush();
      push.id = 'test-uuid';
      push.organizationId = 'org-uuid';
      push.radarType = 'compliance';
      push.contentId = 'content-uuid';
      push.relevanceScore = 0.85;
      push.priorityLevel = 'high';
      push.status = 'scheduled';
      push.scheduledAt = new Date();
      push.playbookStatus = 'ready';
      push.checklistCompletedAt = null;

      // Assert
      expect(push.id).toBe('test-uuid');
      expect(push.organizationId).toBe('org-uuid');
      expect(push.radarType).toBe('compliance');
      expect(push.contentId).toBe('content-uuid');
      expect(push.relevanceScore).toBe(0.85);
      expect(push.priorityLevel).toBe('high');
      expect(push.status).toBe('scheduled');
      expect(push.scheduledAt).toBeDefined();
      expect(push.playbookStatus).toBe('ready');
      expect(push.checklistCompletedAt).toBeNull();
    });

    it('should maintain all existing fields', () => {
      // Arrange & Act
      const push = new RadarPush();
      push.isRead = false;
      push.readAt = null;
      push.isBookmarked = false;
      push.sentAt = null;
      push.scheduleConfigId = null;

      // Assert
      expect(push.isRead).toBe(false);
      expect(push.readAt).toBeNull();
      expect(push.isBookmarked).toBe(false);
      expect(push.sentAt).toBeNull();
      expect(push.scheduleConfigId).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle compliance push with all states', () => {
      // Arrange
      const push = new RadarPush();
      push.radarType = 'compliance';
      push.status = 'sent';
      push.isRead = true;
      push.playbookStatus = 'ready';
      push.checklistCompletedAt = new Date();

      // Assert
      expect(push.radarType).toBe('compliance');
      expect(push.status).toBe('sent');
      expect(push.isRead).toBe(true);
      expect(push.playbookStatus).toBe('ready');
      expect(push.checklistCompletedAt).toBeDefined();
    });

    it('should handle compliance push with failed playbook', () => {
      // Arrange & Act
      const push = new RadarPush();
      push.radarType = 'compliance';
      push.playbookStatus = 'failed';
      push.checklistCompletedAt = null;

      // Assert
      expect(push.radarType).toBe('compliance');
      expect(push.playbookStatus).toBe('failed');
      expect(push.checklistCompletedAt).toBeNull();
    });

    it('should handle compliance push with generating playbook', () => {
      // Arrange & Act
      const push = new RadarPush();
      push.radarType = 'compliance';
      push.playbookStatus = 'generating';
      push.checklistCompletedAt = null;

      // Assert
      expect(push.radarType).toBe('compliance');
      expect(push.playbookStatus).toBe('generating');
      expect(push.checklistCompletedAt).toBeNull();
    });

    it('should handle timestamp precision for checklistCompletedAt', () => {
      // Arrange
      const timestamp = new Date('2026-01-30T10:30:45.123Z');

      // Act
      const push = new RadarPush();
      push.checklistCompletedAt = timestamp;

      // Assert
      expect(push.checklistCompletedAt).toEqual(timestamp);
      expect(push.checklistCompletedAt.getMilliseconds()).toBe(123);
    });
  });
});
