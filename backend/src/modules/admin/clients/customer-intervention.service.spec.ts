import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerInterventionService } from './customer-intervention.service';
import { CustomerInterventionRepository } from '../../../database/repositories/customer-intervention.repository';
import { Organization } from '../../../database/entities/organization.entity';
import { NotFoundException } from '@nestjs/common';

/**
 * CustomerInterventionService Unit Tests
 *
 * Story 7.3: 客户管理与流失风险预警
 */
describe('CustomerInterventionService', () => {
  let service: CustomerInterventionService;
  let interventionRepo: jest.Mocked<CustomerInterventionRepository>;
  let rawOrgRepo: jest.Mocked<Repository<Organization>>;

  const mockOrganization: Organization = {
    id: 'org-123',
    name: 'Test Organization',
    tenantId: 'tenant-123',
    radarActivated: true,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Organization;

  const mockIntervention = {
    id: 'intervention-123',
    organizationId: 'org-123',
    interventionType: 'contact' as const,
    result: 'contacted' as const,
    notes: 'Customer was contacted',
    createdBy: 'admin-123',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerInterventionService,
        {
          provide: CustomerInterventionRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByOrganization: jest.fn(),
            findRecent: jest.fn(),
            getStatistics: jest.fn(),
            getSuccessRate: jest.fn(),
            updateResult: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Organization),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CustomerInterventionService>(CustomerInterventionService);
    interventionRepo = module.get(CustomerInterventionRepository);
    rawOrgRepo = module.get(getRepositoryToken(Organization));
  });

  describe('createIntervention', () => {
    it('should create intervention successfully', async () => {
      // Arrange
      const orgId = 'org-123';
      const data = {
        organizationId: orgId,
        interventionType: 'contact' as const,
        result: 'contacted' as const,
        notes: 'Test notes',
        createdBy: 'admin-123',
      };

      rawOrgRepo.findOne.mockResolvedValue(mockOrganization);
      interventionRepo.create.mockResolvedValue(mockIntervention as any);

      // Act
      const result = await service.createIntervention(data);

      // Assert
      expect(result).toEqual(mockIntervention);
      expect(interventionRepo.create).toHaveBeenCalledWith({
        organizationId: orgId,
        interventionType: 'contact',
        result: 'contacted',
        notes: 'Test notes',
        createdBy: 'admin-123',
      });
    });

    it('should throw NotFoundException if organization not found', async () => {
      // Arrange
      const data = {
        organizationId: 'non-existent',
        interventionType: 'contact' as const,
        result: 'contacted' as const,
        createdBy: 'admin-123',
      };

      rawOrgRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createIntervention(data)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getInterventions', () => {
    it('should return interventions for organization', async () => {
      // Arrange
      const orgId = 'org-123';
      const interventions = [mockIntervention];

      rawOrgRepo.findOne.mockResolvedValue(mockOrganization);
      interventionRepo.findByOrganization.mockResolvedValue(interventions as any);

      // Act
      const result = await service.getInterventions(orgId);

      // Assert
      expect(result).toEqual(interventions);
      expect(interventionRepo.findByOrganization).toHaveBeenCalledWith(orgId);
    });

    it('should throw NotFoundException if organization not found', async () => {
      // Arrange
      rawOrgRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getInterventions('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getInterventionById', () => {
    it('should return intervention by id', async () => {
      // Arrange
      interventionRepo.findById.mockResolvedValue(mockIntervention as any);

      // Act
      const result = await service.getInterventionById('intervention-123');

      // Assert
      expect(result).toEqual(mockIntervention);
    });

    it('should throw NotFoundException if intervention not found', async () => {
      // Arrange
      interventionRepo.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getInterventionById('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateInterventionResult', () => {
    it('should update intervention result', async () => {
      // Arrange
      const updatedIntervention = {
        ...mockIntervention,
        result: 'resolved' as const,
        notes: 'Updated notes',
      };

      interventionRepo.updateResult.mockResolvedValue(updatedIntervention as any);

      // Act
      const result = await service.updateInterventionResult(
        'intervention-123',
        'resolved',
        'Updated notes',
      );

      // Assert
      expect(result.result).toBe('resolved');
      expect(result.notes).toBe('Updated notes');
    });

    it('should throw NotFoundException if intervention not found', async () => {
      // Arrange
      interventionRepo.updateResult.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updateInterventionResult('non-existent', 'resolved'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getInterventionSuggestions', () => {
    it('should suggest contact for churn risk', () => {
      // Act
      const suggestions = service.getInterventionSuggestions(45, []);

      // Assert
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          type: 'contact',
          priority: 'high',
        }),
      );
    });

    it('should suggest config adjustment for irrelevant content', () => {
      // Act
      const suggestions = service.getInterventionSuggestions(70, [
        '推送内容不相关',
      ]);

      // Assert
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          type: 'config_adjustment',
          title: '调整关注领域',
          priority: 'high',
        }),
      );
    });

    it('should suggest frequency adjustment for too many pushes', () => {
      // Act
      const suggestions = service.getInterventionSuggestions(70, [
        '推送频率过高',
      ]);

      // Assert
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          type: 'config_adjustment',
          title: '调整推送频率',
          priority: 'medium',
        }),
      );
    });

    it('should suggest training for unmet feature needs', () => {
      // Act
      const suggestions = service.getInterventionSuggestions(70, [
        '功能不满足需求',
      ]);

      // Assert
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          type: 'training',
          title: '提供功能培训',
          priority: 'medium',
        }),
      );
    });

    it('should suggest survey for low login frequency', () => {
      // Act
      const suggestions = service.getInterventionSuggestions(70, [
        '登录频率过低',
      ]);

      // Assert
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          type: 'survey',
          title: '发送使用调研',
          priority: 'medium',
        }),
      );
    });

    it('should return default suggestion for healthy clients', () => {
      // Act
      const suggestions = service.getInterventionSuggestions(90, []);

      // Assert
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          type: 'contact',
          title: '定期客户回访',
          priority: 'low',
        }),
      );
    });
  });

  describe('getStatistics', () => {
    it('should return intervention statistics', async () => {
      // Arrange
      const stats = {
        total: 10,
        byType: { contact: 5, survey: 3, training: 2 },
        byResult: { contacted: 6, resolved: 3, churned: 1 },
      };
      interventionRepo.getStatistics.mockResolvedValue(stats);

      // Act
      const result = await service.getStatistics();

      // Assert
      expect(result).toEqual(stats);
    });
  });

  describe('getOrganizationSuccessRate', () => {
    it('should return success rate for organization', async () => {
      // Arrange
      const rate = {
        total: 10,
        resolved: 7,
        churned: 2,
        successRate: 70,
      };
      interventionRepo.getSuccessRate.mockResolvedValue(rate);

      // Act
      const result = await service.getOrganizationSuccessRate('org-123');

      // Assert
      expect(result).toEqual(rate);
      expect(interventionRepo.getSuccessRate).toHaveBeenCalledWith('org-123');
    });
  });
});
