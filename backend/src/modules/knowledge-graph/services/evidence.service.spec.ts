import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ControlEvidenceMap } from '../../../database/entities/control-evidence-map.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { EvidenceType } from '../../../database/entities/evidence-type.entity'
import { EvidenceService } from './evidence.service'

describe('EvidenceService', () => {
  let service: EvidenceService

  const evidenceTypeRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }

  const controlEvidenceMapRepository = {
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
        EvidenceService,
        {
          provide: getRepositoryToken(EvidenceType),
          useValue: evidenceTypeRepository,
        },
        {
          provide: getRepositoryToken(ControlEvidenceMap),
          useValue: controlEvidenceMapRepository,
        },
        {
          provide: getRepositoryToken(ControlPoint),
          useValue: controlPointRepository,
        },
      ],
    }).compile()

    service = module.get(EvidenceService)
    jest.clearAllMocks()
  })

  it('should reject creating control-evidence map when control point does not exist', async () => {
    controlPointRepository.findOne.mockResolvedValue(null)

    await expect(
      service.createControlEvidenceMap({
        controlId: '550e8400-e29b-41d4-a716-446655440000',
        evidenceId: '660e8400-e29b-41d4-a716-446655440000',
        requiredLevel: 'REQUIRED',
      }),
    ).rejects.toThrow('control_point 550e8400-e29b-41d4-a716-446655440000 does not exist')
  })

  it('should reject duplicate control-evidence map before save', async () => {
    controlPointRepository.findOne.mockResolvedValue({
      controlId: 'control-id',
    })
    evidenceTypeRepository.findOne.mockResolvedValue({
      evidenceId: 'evidence-id',
    })
    controlEvidenceMapRepository.findOne.mockResolvedValue({
      id: 'existing-map',
      controlId: 'control-id',
      evidenceId: 'evidence-id',
    })

    await expect(
      service.createControlEvidenceMap({
        controlId: 'control-id',
        evidenceId: 'evidence-id',
        requiredLevel: 'RECOMMENDED',
      }),
    ).rejects.toThrow('control_evidence_map control-id/evidence-id already exists')
  })

  it('should return structured evidences with stable ordering and empty-safe semantics', async () => {
    controlPointRepository.findOne.mockResolvedValue({
      controlId: 'control-id',
    })

    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'map-required',
          controlId: 'control-id',
          requiredLevel: 'REQUIRED',
          notes: '核心证据',
          evidenceType: {
            evidenceId: 'evidence-id-1',
            evidenceCode: 'EVD-001',
            evidenceName: '审批记录',
            evidenceDesc: '关键审批留痕',
            evidenceCategory: 'approval',
            status: 'ACTIVE',
          },
        },
        {
          id: 'map-optional',
          controlId: 'control-id',
          requiredLevel: 'OPTIONAL',
          notes: null,
          evidenceType: {
            evidenceId: 'evidence-id-2',
            evidenceCode: 'EVD-002',
            evidenceName: '日志记录',
            evidenceDesc: '系统审计日志',
            evidenceCategory: 'log',
            status: 'ACTIVE',
          },
        },
      ]),
    }
    controlEvidenceMapRepository.createQueryBuilder.mockReturnValue(queryBuilder)

    const result = await service.findEvidencesByControlId('control-id')

    expect(queryBuilder.where).toHaveBeenCalledWith('mapping.control_id = :controlId', {
      controlId: 'control-id',
    })
    expect(result).toEqual({
      controlId: 'control-id',
      evidences: [
        {
          id: 'map-required',
          evidenceId: 'evidence-id-1',
          evidenceCode: 'EVD-001',
          evidenceName: '审批记录',
          evidenceDesc: '关键审批留痕',
          evidenceCategory: 'approval',
          status: 'ACTIVE',
          requiredLevel: 'REQUIRED',
          notes: '核心证据',
        },
        {
          id: 'map-optional',
          evidenceId: 'evidence-id-2',
          evidenceCode: 'EVD-002',
          evidenceName: '日志记录',
          evidenceDesc: '系统审计日志',
          evidenceCategory: 'log',
          status: 'ACTIVE',
          requiredLevel: 'OPTIONAL',
          notes: null,
        },
      ],
    })
  })
})
