import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ControlPack } from '../../../database/entities/control-pack.entity'
import { ControlPackItem } from '../../../database/entities/control-pack-item.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { PackResolverService } from '../../applicability-engine/services/pack-resolver.service'
import { ControlPackLinkService } from './control-pack-link.service'

describe('ControlPackLinkService', () => {
  let service: ControlPackLinkService

  const controlPackItemRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  }

  const controlPackRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  }

  const controlPointRepository = {
    findOne: jest.fn(),
  }

  const packResolverService = {
    resolveByOrganizationId: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ControlPackLinkService,
        {
          provide: getRepositoryToken(ControlPackItem),
          useValue: controlPackItemRepository,
        },
        {
          provide: getRepositoryToken(ControlPack),
          useValue: controlPackRepository,
        },
        {
          provide: getRepositoryToken(ControlPoint),
          useValue: controlPointRepository,
        },
        {
          provide: PackResolverService,
          useValue: packResolverService,
        },
      ],
    }).compile()

    service = module.get(ControlPackLinkService)
    jest.clearAllMocks()
  })

  it('should reject duplicate pack-control map before save', async () => {
    controlPackRepository.findOne.mockResolvedValue({
      packId: 'pack-id',
      packCode: 'PACK-BASE-CYBER',
    })
    controlPointRepository.findOne.mockResolvedValue({
      controlId: 'control-id',
      controlCode: 'CTRL-ACC-002',
    })
    controlPackItemRepository.findOne.mockResolvedValue({
      id: 'existing-map',
      packId: 'pack-id',
      controlId: 'control-id',
    })

    await expect(
      service.create({
        packId: 'pack-id',
        controlId: 'control-id',
        itemRole: 'INCLUDE',
        priority: 10,
      }),
    ).rejects.toThrow('control_pack_item pack-id/control-id already exists')
  })

  it('should return static pack links with pack metadata ordered by priority', async () => {
    controlPointRepository.findOne.mockResolvedValue({
      controlId: 'control-id',
      controlCode: 'CTRL-ACC-002',
    })

    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'map-1',
          packId: 'pack-1',
          controlId: 'control-id',
          itemRole: 'INCLUDE',
          priority: 10,
          controlPack: {
            packId: 'pack-1',
            packCode: 'PACK-BASE-CYBER',
            packName: '网络安全基线包',
            packType: 'base',
          },
        },
      ]),
    }
    controlPackItemRepository.createQueryBuilder.mockReturnValue(queryBuilder)

    const result = await service.findPackLinksByControlId('control-id')

    expect(result).toEqual({
      controlId: 'control-id',
      items: [
        {
          id: 'map-1',
          packId: 'pack-1',
          packCode: 'PACK-BASE-CYBER',
          packName: '网络安全基线包',
          packType: 'base',
          itemRole: 'INCLUDE',
          priority: 10,
        },
      ],
    })
  })

  it('should return matched=false context when the control is not applicable for the organization', async () => {
    controlPointRepository.findOne.mockResolvedValue({
      controlId: 'control-id',
      controlCode: 'CTRL-ACC-002',
    })

    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }
    controlPackItemRepository.createQueryBuilder.mockReturnValue(queryBuilder)
    packResolverService.resolveByOrganizationId.mockResolvedValue({
      matchedPacks: ['PACK-BASE-CYBER'],
      matchedRules: ['RULE-PACK-BASE-CYBER-INCLUDE-001'],
      controls: [],
      summary: {
        totalControls: 0,
        mandatoryCount: 0,
        matchedPacks: 1,
        matchedRules: 1,
        excludedControls: 0,
      },
      debugLog: [],
    })

    const result = await service.buildApplicabilityContext('control-id', {
      organizationId: 'org-id',
    })

    expect(result).toEqual({
      controlId: 'control-id',
      organizationId: 'org-id',
      matched: false,
      linkedPacks: [],
      matchedPacks: [],
      matchedRules: [],
      priority: null,
      mandatory: false,
      reasons: [],
      questionPackCodes: [],
      evidencePackCodes: [],
      remediationPackCodes: [],
    })
  })

  it('should build applicability context by combining static pack links and resolver metadata', async () => {
    controlPointRepository.findOne.mockResolvedValue({
      controlId: 'control-id',
      controlCode: 'CTRL-ACC-002',
    })

    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'map-1',
          packId: 'pack-1',
          controlId: 'control-id',
          itemRole: 'INCLUDE',
          priority: 10,
          controlPack: {
            packId: 'pack-1',
            packCode: 'PACK-BASE-CYBER',
            packName: '网络安全基线包',
            packType: 'base',
          },
        },
      ]),
    }
    controlPackItemRepository.createQueryBuilder.mockReturnValue(queryBuilder)
    packResolverService.resolveByOrganizationId.mockResolvedValue({
      matchedPacks: ['PACK-BASE-CYBER', 'PACK-SECTOR-BANK'],
      matchedRules: ['RULE-PACK-BASE-CYBER-INCLUDE-001', 'RULE-CTRL-ACC-PRIVILEGED-STRENGTHEN-001'],
      controls: [
        {
          controlId: 'control-id',
          controlCode: 'CTRL-ACC-002',
          controlName: '特权访问控制',
          controlFamily: 'ACC_PRIVILEGED',
          mandatory: true,
          priority: 'HIGH',
          matchedPacks: ['PACK-BASE-CYBER', 'PACK-SECTOR-BANK'],
          matchedRules: ['RULE-PACK-BASE-CYBER-INCLUDE-001', 'RULE-CTRL-ACC-PRIVILEGED-STRENGTHEN-001'],
          reasons: ['所有金融机构均应满足网络安全控制要求', '关键系统需强化特权访问控制'],
          questionPackCodes: ['QPACK-ACC-BASE', 'QPACK-ACC-PRIV'],
          evidencePackCodes: ['EPACK-ACC-BASE'],
          remediationPackCodes: ['RPACK-ACC-BASE'],
        },
      ],
      summary: {
        totalControls: 1,
        mandatoryCount: 1,
        matchedPacks: 2,
        matchedRules: 2,
        excludedControls: 0,
      },
      debugLog: [],
    })
    controlPackRepository.find.mockResolvedValue([
      {
        packId: 'pack-1',
        packCode: 'PACK-BASE-CYBER',
        packName: '网络安全基线包',
        packType: 'base',
      },
      {
        packId: 'pack-2',
        packCode: 'PACK-SECTOR-BANK',
        packName: '银行业增强包',
        packType: 'sector',
      },
    ])

    const result = await service.buildApplicabilityContext('control-id', {
      organizationId: 'org-id',
    })

    expect(result).toEqual({
      controlId: 'control-id',
      organizationId: 'org-id',
      matched: true,
      linkedPacks: [
        {
          id: 'map-1',
          packId: 'pack-1',
          packCode: 'PACK-BASE-CYBER',
          packName: '网络安全基线包',
          packType: 'base',
          itemRole: 'INCLUDE',
          priority: 10,
        },
      ],
      matchedPacks: [
        {
          packCode: 'PACK-BASE-CYBER',
          packName: '网络安全基线包',
          packType: 'base',
        },
        {
          packCode: 'PACK-SECTOR-BANK',
          packName: '银行业增强包',
          packType: 'sector',
        },
      ],
      matchedRules: ['RULE-PACK-BASE-CYBER-INCLUDE-001', 'RULE-CTRL-ACC-PRIVILEGED-STRENGTHEN-001'],
      priority: 'HIGH',
      mandatory: true,
      reasons: ['所有金融机构均应满足网络安全控制要求', '关键系统需强化特权访问控制'],
      questionPackCodes: ['QPACK-ACC-BASE', 'QPACK-ACC-PRIV'],
      evidencePackCodes: ['EPACK-ACC-BASE'],
      remediationPackCodes: ['RPACK-ACC-BASE'],
    })
  })
})

