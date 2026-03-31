import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import * as he from 'he'

import { EmailService } from './email.service'
import { EmailTemplateService } from '../branding/email-template.service'
import { AdminBrandingService } from '../branding/admin-branding.service'

describe('EmailService - Radar Push Summary', () => {
  let service: EmailService
  let configService: { get: jest.Mock }
  let brandingService: { getBranding: jest.Mock }
  const mockTransporter = {
    sendMail: jest.fn(),
  }

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const values: Record<string, string> = {
          EMAIL_ENABLED: 'false',
          EMAIL_FROM: 'noreply@csaas.com',
          APP_URL: 'https://csaas.example.com',
        }

        return values[key] ?? defaultValue
      }),
    }
    brandingService = {
      getBranding: jest.fn().mockResolvedValue({
        companyName: 'Acme Advisory',
        logoUrl: null,
        primaryColor: '#123456',
        secondaryColor: null,
        contactEmail: 'support@acme.test',
        contactPhone: null,
        emailSignature: 'Acme Team',
      }),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        EmailTemplateService,
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: AdminBrandingService,
          useValue: brandingService,
        },
      ],
    }).compile()

    service = module.get<EmailService>(EmailService)
    ;(service as any).transporter = mockTransporter
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should send branded radar push summary email', async () => {
    mockTransporter.sendMail.mockResolvedValue({ messageId: 'msg-1' })

    await service.sendRadarPushNotificationSummary({
      to: 'client@example.com',
      clientName: '测试机构',
      tenantId: 'tenant-123',
      organizationId: 'org-123',
      pushes: [
        {
          radarType: 'tech',
          title: '零信任架构升级',
          summary: '新的零信任实践摘要',
          source: '金融科技周刊',
          publishDate: '2026-03-31',
          relevanceScore: 0.95,
        },
      ],
    })

    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'client@example.com',
        subject: 'Acme Advisory 雷达更新：1 条新推送',
        html: expect.stringContaining('/radar/history?orgId=org-123'),
      }),
    )
    expect(he.decode(mockTransporter.sendMail.mock.calls[0][0].html)).toContain('零信任架构升级')
    expect(mockTransporter.sendMail.mock.calls[0][0].html).toContain('技术雷达')
  })

  it('should retry once when the first email attempt fails', async () => {
    mockTransporter.sendMail
      .mockRejectedValueOnce(new Error('smtp timeout'))
      .mockResolvedValueOnce({ messageId: 'msg-2' })

    await service.sendRadarPushNotificationSummary({
      to: 'client@example.com',
      clientName: '测试机构',
      tenantId: 'tenant-123',
      organizationId: 'org-123',
      pushes: [
        {
          radarType: 'compliance',
          title: '监管通报更新',
          summary: '摘要',
          relevanceScore: 0.91,
        },
      ],
    })

    expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2)
  })
})
