import { CompliancePlaybook } from './compliance-playbook.entity';

describe('CompliancePlaybook Entity', () => {
  describe('Entity Structure', () => {
    it('should create a valid compliance playbook entity', () => {
      // Arrange
      const playbook = new CompliancePlaybook();
      playbook.id = 'test-uuid';
      playbook.pushId = 'push-uuid';
      playbook.checklistItems = [
        {
          id: 'item-1',
          text: '检查系统权限配置',
          category: '权限管理',
          checked: false,
          order: 1,
        },
        {
          id: 'item-2',
          text: '审查数据加密措施',
          category: '数据安全',
          checked: false,
          order: 2,
        },
      ];
      playbook.solutions = [
        {
          name: '升级访问控制系统',
          estimatedCost: 50000,
          expectedBenefit: 200000,
          roiScore: 9,
          implementationTime: '2个月',
        },
      ];
      playbook.reportTemplate = '合规自查报告模板';
      playbook.policyReference = ['https://example.com/law1'];
      playbook.generatedAt = new Date();

      // Assert
      expect(playbook.id).toBe('test-uuid');
      expect(playbook.pushId).toBe('push-uuid');
      expect(playbook.checklistItems).toHaveLength(2);
      expect(playbook.checklistItems[0].order).toBe(1);
      expect(playbook.solutions).toHaveLength(1);
      expect(playbook.solutions[0].roiScore).toBe(9);
      expect(playbook.reportTemplate).toBeDefined();
      expect(playbook.policyReference).toBeDefined();
    });

    it('should handle empty checklist items', () => {
      // Arrange & Act
      const playbook = new CompliancePlaybook();
      playbook.checklistItems = [];
      playbook.solutions = [];
      playbook.reportTemplate = '';

      // Assert
      expect(playbook.checklistItems).toHaveLength(0);
      expect(playbook.solutions).toHaveLength(0);
      expect(playbook.reportTemplate).toBe('');
    });

    it('should handle null policy reference', () => {
      // Arrange & Act
      const playbook = new CompliancePlaybook();
      playbook.policyReference = null;

      // Assert
      expect(playbook.policyReference).toBeNull();
    });

    it('should handle checklist item with all required fields', () => {
      // Arrange
      const item = {
        id: 'item-1',
        text: '测试检查项',
        category: '测试分类',
        checked: false,
        order: 1,
      };

      // Act
      const playbook = new CompliancePlaybook();
      playbook.checklistItems = [item];

      // Assert
      expect(playbook.checklistItems[0].id).toBe('item-1');
      expect(playbook.checklistItems[0].text).toBe('测试检查项');
      expect(playbook.checklistItems[0].category).toBe('测试分类');
      expect(playbook.checklistItems[0].checked).toBe(false);
      expect(playbook.checklistItems[0].order).toBe(1);
    });

    it('should handle solution with all required fields', () => {
      // Arrange
      const solution = {
        name: '测试解决方案',
        estimatedCost: 100000,
        expectedBenefit: 500000,
        roiScore: 8,
        implementationTime: '3个月',
      };

      // Act
      const playbook = new CompliancePlaybook();
      playbook.solutions = [solution];

      // Assert
      expect(playbook.solutions[0].name).toBe('测试解决方案');
      expect(playbook.solutions[0].estimatedCost).toBe(100000);
      expect(playbook.solutions[0].expectedBenefit).toBe(500000);
      expect(playbook.solutions[0].roiScore).toBe(8);
      expect(playbook.solutions[0].implementationTime).toBe('3个月');
    });

    it('should handle multiple policy references', () => {
      // Arrange
      const references = [
        'https://example.com/law1',
        'https://example.com/law2',
        'https://example.com/law3',
      ];

      // Act
      const playbook = new CompliancePlaybook();
      playbook.policyReference = references;

      // Assert
      expect(playbook.policyReference).toHaveLength(3);
      expect(playbook.policyReference[0]).toBe('https://example.com/law1');
    });
  });

  describe('Field Validation', () => {
    it('should accept valid checklist item order', () => {
      // Arrange & Act
      const playbook = new CompliancePlaybook();
      playbook.checklistItems = [
        { id: '1', text: 'First', category: 'A', checked: false, order: 1 },
        { id: '2', text: 'Second', category: 'B', checked: false, order: 2 },
        { id: '3', text: 'Third', category: 'C', checked: false, order: 3 },
      ];

      // Assert
      expect(playbook.checklistItems[0].order).toBeLessThan(
        playbook.checklistItems[1].order,
      );
      expect(playbook.checklistItems[1].order).toBeLessThan(
        playbook.checklistItems[2].order,
      );
    });

    it('should accept ROI score in valid range (0-10)', () => {
      // Arrange
      const testScores = [0, 5, 7, 9, 10];

      // Act
      testScores.forEach((score) => {
        const playbook = new CompliancePlaybook();
        playbook.solutions = [
          {
            name: `Solution ${score}`,
            estimatedCost: 10000,
            expectedBenefit: 20000,
            roiScore: score,
            implementationTime: '1个月',
          },
        ];

        // Assert
        expect(playbook.solutions[0].roiScore).toBeGreaterThanOrEqual(0);
        expect(playbook.solutions[0].roiScore).toBeLessThanOrEqual(10);
      });
    });

    it('should accept estimated cost and benefit values', () => {
      // Arrange
      const playbook = new CompliancePlaybook();
      playbook.solutions = [
        {
          name: '低成本方案',
          estimatedCost: 1000,
          expectedBenefit: 5000,
          roiScore: 5,
          implementationTime: '1周',
        },
      ];

      // Assert
      expect(playbook.solutions[0].estimatedCost).toBe(1000);
      expect(playbook.solutions[0].expectedBenefit).toBe(5000);
      expect(playbook.solutions[0].expectedBenefit).toBeGreaterThan(
        playbook.solutions[0].estimatedCost,
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle maximum ROI score (10)', () => {
      // Arrange & Act
      const playbook = new CompliancePlaybook();
      playbook.solutions = [
        {
          name: '高ROI方案',
          estimatedCost: 10000,
          expectedBenefit: 200000,
          roiScore: 10,
          implementationTime: '1个月',
        },
      ];

      // Assert
      expect(playbook.solutions[0].roiScore).toBe(10);
    });

    it('should handle minimum ROI score (0)', () => {
      // Arrange & Act
      const playbook = new CompliancePlaybook();
      playbook.solutions = [
        {
          name: '低ROI方案',
          estimatedCost: 100000,
          expectedBenefit: 50000,
          roiScore: 0,
          implementationTime: '6个月',
        },
      ];

      // Assert
      expect(playbook.solutions[0].roiScore).toBe(0);
    });

    it('should handle checklist with 10 items (maximum)', () => {
      // Arrange
      const items = Array.from({ length: 10 }, (_, i) => ({
        id: `item-${i + 1}`,
        text: `检查项 ${i + 1}`,
        category: '分类',
        checked: false,
        order: i + 1,
      }));

      // Act
      const playbook = new CompliancePlaybook();
      playbook.checklistItems = items;

      // Assert
      expect(playbook.checklistItems).toHaveLength(10);
    });

    it('should handle checklist with 5 items (minimum)', () => {
      // Arrange
      const items = Array.from({ length: 5 }, (_, i) => ({
        id: `item-${i + 1}`,
        text: `检查项 ${i + 1}`,
        category: '分类',
        checked: false,
        order: i + 1,
      }));

      // Act
      const playbook = new CompliancePlaybook();
      playbook.checklistItems = items;

      // Assert
      expect(playbook.checklistItems).toHaveLength(5);
    });

    it('should handle generatedAt being null', () => {
      // Arrange & Act
      const playbook = new CompliancePlaybook();
      playbook.generatedAt = null;

      // Assert
      expect(playbook.generatedAt).toBeNull();
    });

    it('should handle generatedAt being set', () => {
      // Arrange
      const timestamp = new Date('2026-01-30T10:00:00Z');

      // Act
      const playbook = new CompliancePlaybook();
      playbook.generatedAt = timestamp;

      // Assert
      expect(playbook.generatedAt).toEqual(timestamp);
    });
  });
});
