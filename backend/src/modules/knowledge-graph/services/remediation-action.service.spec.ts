import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { RemediationAction } from '../../../database/entities/remediation-action.entity'
import { RemediationActionService } from './remediation-action.service'

describe('RemediationActionService', () => {
  let service: RemediationActionService

  const remediationActionRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  }

  const controlPointRepository = {
    findOne: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemediationActionService,
        {
          provide: getRepositoryToken(RemediationAction),
          useValue: remediationActionRepository,
        },
        {
          provide: getRepositoryToken(ControlPoint),
          useValue: controlPointRepository,
        },
      ],
    }).compile()

    service = module.get(RemediationActionService)
    jest.clearAllMocks()
  })

  it('should reject creating remediation action when control point does not exist', async () => {
    controlPointRepository.findOne.mockResolvedValue(null)

    await expect(
      service.create({
        controlId: '550e8400-e29b-41d4-a716-446655440000',
        actionCode: 'RA-CTRL-001',
        actionTitle: '建立正式制度',
      }),
    ).rejects.toThrow('control_point 550e8400-e29b-41d4-a716-446655440000 does not exist')
  })

  it('should reject duplicate action code before save', async () => {
    controlPointRepository.findOne.mockResolvedValue({
      controlId: 'control-id',
    })
    remediationActionRepository.findOne.mockResolvedValue({
      actionId: 'existing-action',
      actionCode: 'RA-CTRL-001',
    })

    await expect(
      service.create({
        controlId: 'control-id',
        actionCode: 'RA-CTRL-001',
        actionTitle: '建立正式制度',
      }),
    ).rejects.toThrow('action_code RA-CTRL-001 already exists')
  })

  it('should return structured remediations with stable ordering and empty-safe semantics', async () => {
    controlPointRepository.findOne.mockResolvedValue({
      controlId: 'control-id',
    })

    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          actionId: 'action-high',
          controlId: 'control-id',
          actionCode: 'RA-CTRL-001',
          actionTitle: '建立正式制度',
          actionDesc: '补齐管理制度并审批发布',
          priorityDefault: 'HIGH',
          effortLevel: 'medium',
          expectedBenefit: 'HIGH',
          outputTemplate: { reportBullet: '建立制度并完成发布' },
          status: 'ACTIVE',
        },
        {
          actionId: 'action-low',
          controlId: 'control-id',
          actionCode: 'RA-CTRL-002',
          actionTitle: '补充台账',
          actionDesc: '补充整改跟踪台账',
          priorityDefault: 'LOW',
          effortLevel: 'low',
          expectedBenefit: 'MEDIUM',
          outputTemplate: null,
          status: 'ACTIVE',
        },
      ]),
    }
    remediationActionRepository.createQueryBuilder.mockReturnValue(queryBuilder)

    const result = await service.findByControlId('control-id')

    expect(queryBuilder.where).toHaveBeenCalledWith('remediation.control_id = :controlId', {
      controlId: 'control-id',
    })
    expect(result).toEqual({
      controlId: 'control-id',
      remediations: [
        {
          actionId: 'action-high',
          controlId: 'control-id',
          actionCode: 'RA-CTRL-001',
          actionTitle: '建立正式制度',
          actionDesc: '补齐管理制度并审批发布',
          priorityDefault: 'HIGH',
          effortLevel: 'medium',
          expectedBenefit: 'HIGH',
          outputTemplate: { reportBullet: '建立制度并完成发布' },
          status: 'ACTIVE',
        },
        {
          actionId: 'action-low',
          controlId: 'control-id',
          actionCode: 'RA-CTRL-002',
          actionTitle: '补充台账',
          actionDesc: '补充整改跟踪台账',
          priorityDefault: 'LOW',
          effortLevel: 'low',
          expectedBenefit: 'MEDIUM',
          outputTemplate: null,
          status: 'ACTIVE',
        },
      ],
    })
  })
})
