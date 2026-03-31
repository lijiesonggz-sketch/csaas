import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Job } from 'bullmq'

import { PushProcessor } from './push.processor'
import { PushSchedulerService } from '../services/push-scheduler.service'
import { AnalyzedContentService } from '../services/analyzed-content.service'
import { AIAnalysisService } from '../services/ai-analysis.service'
import { PushLogService } from '../services/push-log.service'
import { TasksGateway } from '../../ai-tasks/gateways/tasks.gateway'
import { WeaknessSnapshot } from '../../../database/entities/weakness-snapshot.entity'
import { Organization } from '../../../database/entities/organization.entity'
import { PushPreference } from '../../../database/entities/push-preference.entity'
import { EmailService } from '../../admin/clients/email.service'

describe('PushProcessor - Email Channel Integration (Story 11.3)', () => {
  let processor: PushProcessor
  let pushSchedulerService: {
    getPendingPushes: jest.Mock
    groupByOrganization: jest.Mock
    markAsSent: jest.Mock
    markAsFailed: jest.Mock
  }
  let emailService: {
    sendRadarPushNotificationSummary: jest.Mock
  }
  let organizationRepo: {
    findOne: jest.Mock
  }
  let pushPreferenceRepo: {
    findOne: jest.Mock
  }
  let weaknessSnapshotRepo: {
    find: jest.Mock
  }

  const basePush = {
    id: 'push-1',
    organizationId: 'org-123',
    tenantId: 'tenant-123',
    radarType: 'tech' as const,
    relevanceScore: 0.95,
    priorityLevel: 'high' as const,
    analyzedContent: {
      aiSummary: '摘要',
      categories: [],
      tags: [],
      rawContent: {
        title: '零信任架构升级',
        summary: '原文摘要',
        publishDate: new Date('2026-03-31T00:00:00.000Z'),
        source: '金融科技周刊',
      },
    },
    scheduledAt: new Date('2026-03-31T09:00:00.000Z'),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushProcessor,
        {
          provide: PushSchedulerService,
          useValue: {
            getPendingPushes: jest.fn(),
            groupByOrganization: jest.fn(),
            markAsSent: jest.fn(),
            markAsFailed: jest.fn(),
          },
        },
        {
          provide: AnalyzedContentService,
          useValue: {},
        },
        {
          provide: AIAnalysisService,
          useValue: {
            analyzeROI: jest.fn(),
          },
        },
        {
          provide: PushLogService,
          useValue: {
            logSuccess: jest.fn(),
            logFailure: jest.fn(),
          },
        },
        {
          provide: TasksGateway,
          useValue: {
            server: {
              to: jest.fn().mockReturnThis(),
              emit: jest.fn(),
            },
          },
        },
        {
          provide: getRepositoryToken(WeaknessSnapshot),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendRadarPushNotificationSummary: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Organization),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PushPreference),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile()

    processor = module.get<PushProcessor>(PushProcessor)
    pushSchedulerService = module.get(PushSchedulerService)
    emailService = module.get(EmailService)
    organizationRepo = module.get(getRepositoryToken(Organization))
    pushPreferenceRepo = module.get(getRepositoryToken(PushPreference))
    weaknessSnapshotRepo = module.get(getRepositoryToken(WeaknessSnapshot))

    pushSchedulerService.groupByOrganization.mockReturnValue(new Map([['org-123', [basePush]]]))
    pushSchedulerService.getPendingPushes.mockResolvedValue([basePush])
    organizationRepo.findOne.mockResolvedValue({
      id: 'org-123',
      name: '测试机构',
      tenantId: 'tenant-123',
      contactEmail: 'client@example.com',
      tenant: {
        name: 'Acme Advisory',
        brandConfig: {
          companyName: 'Acme Advisory',
        },
      },
    })
    pushPreferenceRepo.findOne.mockResolvedValue({
      organizationId: 'org-123',
      relevanceFilter: 'high_medium',
    })
    weaknessSnapshotRepo.find.mockResolvedValue([])
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should send one summary email per organization after websocket delivery', async () => {
    const job = {
      id: 'job-1',
      data: { radarType: 'tech' },
    } as Job<{ radarType: 'tech' }>

    await processor.process(job)

    expect(emailService.sendRadarPushNotificationSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'client@example.com',
        clientName: '测试机构',
        tenantId: 'tenant-123',
        organizationId: 'org-123',
        pushes: [
          expect.objectContaining({
            title: '零信任架构升级',
            radarType: 'tech',
          }),
        ],
      }),
    )
  })

  it('should skip email summary when pushes do not satisfy high_only relevance filter', async () => {
    pushPreferenceRepo.findOne.mockResolvedValue({
      organizationId: 'org-123',
      relevanceFilter: 'high_only',
    })
    pushSchedulerService.getPendingPushes.mockResolvedValue([
      {
        ...basePush,
        id: 'push-2',
        relevanceScore: 0.82,
      },
    ])
    pushSchedulerService.groupByOrganization.mockReturnValue(new Map([[
      'org-123',
      [{
        ...basePush,
        id: 'push-2',
        relevanceScore: 0.82,
      }],
    ]]))

    const job = {
      id: 'job-2',
      data: { radarType: 'tech' },
    } as Job<{ radarType: 'tech' }>

    await processor.process(job)

    expect(emailService.sendRadarPushNotificationSummary).not.toHaveBeenCalled()
    expect(pushSchedulerService.markAsSent).toHaveBeenCalledWith('push-2')
  })

  it('should not fail push delivery when summary email sending throws', async () => {
    emailService.sendRadarPushNotificationSummary.mockRejectedValue(new Error('smtp timeout'))

    const job = {
      id: 'job-3',
      data: { radarType: 'tech' },
    } as Job<{ radarType: 'tech' }>

    await expect(processor.process(job)).resolves.not.toThrow()
    expect(pushSchedulerService.markAsSent).toHaveBeenCalledWith('push-1')
  })
})
