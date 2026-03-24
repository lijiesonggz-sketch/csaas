import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { TaxonomyL1 } from '../../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../../database/entities/taxonomy-l2.entity'
import { ControlPointService } from './control-point.service'

describe('ControlPointService', () => {
  let service: ControlPointService

  const controlPointRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }

  const taxonomyL1Repository = {
    findOne: jest.fn(),
  }

  const taxonomyL2Repository = {
    findOne: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ControlPointService,
        {
          provide: getRepositoryToken(ControlPoint),
          useValue: controlPointRepository,
        },
        {
          provide: getRepositoryToken(TaxonomyL1),
          useValue: taxonomyL1Repository,
        },
        {
          provide: getRepositoryToken(TaxonomyL2),
          useValue: taxonomyL2Repository,
        },
      ],
    }).compile()

    service = module.get(ControlPointService)
    jest.clearAllMocks()
  })

  it('should reject invalid l1Code/l2Code hierarchy relations', async () => {
    taxonomyL1Repository.findOne.mockResolvedValue({ l1Code: 'IT02' })
    taxonomyL2Repository.findOne.mockResolvedValue({ l2Code: 'IT04-06', l1Code: 'IT04' })

    await expect(
      service.create({
        controlCode: 'CTRL-ACC-021',
        controlName: 'Privileged Session Review Control',
        controlDesc: 'desc',
        l1Code: 'IT02',
        l2Code: 'IT04-06',
        controlFamily: 'ACC_PRIVILEGED',
        controlType: 'detective',
        mandatoryDefault: true,
        riskLevelDefault: 'HIGH',
        ownerRoleHint: ['CISO'],
        status: 'ACTIVE',
      }),
    ).rejects.toThrow('Invalid l1Code/l2Code hierarchy relation')
  })

  it('should reject duplicate controlCode before save', async () => {
    taxonomyL1Repository.findOne.mockResolvedValue({ l1Code: 'IT02' })
    taxonomyL2Repository.findOne.mockResolvedValue({ l2Code: 'IT02-03', l1Code: 'IT02' })
    controlPointRepository.findOne
      .mockResolvedValueOnce({ controlId: 'existing', controlCode: 'CTRL-ACC-002' })
      .mockResolvedValueOnce(null)

    await expect(
      service.create({
        controlCode: 'CTRL-ACC-002',
        controlName: 'Privileged Session Review Control',
        controlDesc: 'desc',
        l1Code: 'IT02',
        l2Code: 'IT02-03',
        controlFamily: 'ACC_PRIVILEGED',
        controlType: 'detective',
        mandatoryDefault: true,
        riskLevelDefault: 'HIGH',
        ownerRoleHint: ['CISO'],
        status: 'ACTIVE',
      }),
    ).rejects.toThrow('control_code CTRL-ACC-002 already exists')
  })

  it('should update status without deleting control point', async () => {
    const existing = {
      controlId: 'control-id',
      status: 'ACTIVE',
    }
    controlPointRepository.findOne.mockResolvedValue(existing)
    controlPointRepository.save.mockResolvedValue({
      ...existing,
      status: 'INACTIVE',
    })

    const result = await service.updateStatus('control-id', { status: 'INACTIVE' })

    expect(controlPointRepository.save).toHaveBeenCalledWith({
      controlId: 'control-id',
      status: 'INACTIVE',
    })
    expect(result.status).toBe('INACTIVE')
  })

  it('should reject null controlType on update before mutating the entity', async () => {
    await expect(
      service.update('control-id', {
        controlType: null as never,
      }),
    ).rejects.toThrow('controlType cannot be null')

    expect(controlPointRepository.findOne).not.toHaveBeenCalled()
  })
})
