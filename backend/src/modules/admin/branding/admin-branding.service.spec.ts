import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AdminBrandingService } from './admin-branding.service'
import { Tenant } from '../../../database/entities/tenant.entity'

describe('AdminBrandingService', () => {
  let service: AdminBrandingService
  let tenantRepository: Repository<Tenant>

  const mockTenantRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminBrandingService,
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockTenantRepository,
        },
      ],
    }).compile()

    service = module.get<AdminBrandingService>(AdminBrandingService)
    tenantRepository = module.get<Repository<Tenant>>(getRepositoryToken(Tenant))

    jest.clearAllMocks()
  })

  describe('getBranding', () => {
    it('should return branding configuration', async () => {
      const tenantId = 'tenant-123'
      const tenant = {
        id: tenantId,
        name: 'Test Consulting',
        brandConfig: {
          companyName: 'Custom Name',
          logo: 'https://example.com/logo.png',
          themeColor: '#ff0000',
        },
      }

      mockTenantRepository.findOne.mockResolvedValue(tenant)

      const result = await service.getBranding(tenantId)

      expect(result.companyName).toBe('Custom Name')
      expect(result.logoUrl).toBe('https://example.com/logo.png')
      expect(result.primaryColor).toBe('#ff0000')
    })

    it('should return default values when no brand config', async () => {
      const tenantId = 'tenant-123'
      const tenant = {
        id: tenantId,
        name: 'Test Consulting',
        brandConfig: null,
      }

      mockTenantRepository.findOne.mockResolvedValue(tenant)

      const result = await service.getBranding(tenantId)

      expect(result.companyName).toBe('Test Consulting')
      expect(result.logoUrl).toBeNull()
      expect(result.primaryColor).toBe('#1890ff')
    })

    it('should throw NotFoundException when tenant not found', async () => {
      mockTenantRepository.findOne.mockResolvedValue(null)

      await expect(service.getBranding('non-existent')).rejects.toThrow('Tenant not found')
    })
  })

  describe('updateBranding', () => {
    it('should update branding configuration', async () => {
      const tenantId = 'tenant-123'
      const tenant = {
        id: tenantId,
        name: 'Test Consulting',
        brandConfig: {},
      }

      mockTenantRepository.findOne.mockResolvedValue(tenant)
      mockTenantRepository.save.mockImplementation((t) => Promise.resolve(t))

      const result = await service.updateBranding(tenantId, {
        companyName: 'New Name',
        brandPrimaryColor: '#00ff00',
      })

      expect(result.companyName).toBe('New Name')
      expect(result.primaryColor).toBe('#00ff00')
    })

    it('should update all brand config fields', async () => {
      const tenantId = 'tenant-123'
      const tenant = {
        id: tenantId,
        name: 'Test Consulting',
        brandConfig: {},
      }

      mockTenantRepository.findOne.mockResolvedValue(tenant)
      mockTenantRepository.save.mockImplementation((t) => Promise.resolve(t))

      await service.updateBranding(tenantId, {
        companyName: 'ABC Consulting',
        brandLogoUrl: 'https://example.com/logo.png',
        brandPrimaryColor: '#ff0000',
        brandSecondaryColor: '#00ff00',
        contactEmail: 'contact@abc.com',
        contactPhone: '400-123-4567',
        emailSignature: 'Best regards,\nABC Team',
      })

      expect(tenant.brandConfig).toEqual({
        companyName: 'ABC Consulting',
        logo: 'https://example.com/logo.png',
        themeColor: '#ff0000',
        secondaryColor: '#00ff00',
        contactEmail: 'contact@abc.com',
        contactPhone: '400-123-4567',
        emailSignature: 'Best regards,\nABC Team',
      })
    })
  })

  describe('getPublicBranding', () => {
    it('should return public branding', async () => {
      const tenantId = 'tenant-123'
      const tenant = {
        id: tenantId,
        name: 'Test Consulting',
        brandConfig: {
          companyName: 'Public Name',
          logo: 'https://example.com/logo.png',
          themeColor: '#0000ff',
        },
      }

      mockTenantRepository.findOne.mockResolvedValue(tenant)

      const result = await service.getPublicBranding(tenantId)

      expect(result).toEqual({
        companyName: 'Public Name',
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#0000ff',
        secondaryColor: null,
      })
    })

    it('should return null for missing tenant', async () => {
      mockTenantRepository.findOne.mockResolvedValue(null)

      const result = await service.getPublicBranding('non-existent')

      expect(result).toBeNull()
    })

    it('should return null for empty tenantId', async () => {
      const result = await service.getPublicBranding('')

      expect(result).toBeNull()
    })
  })

  describe('resetBranding', () => {
    it('should reset branding to default', async () => {
      const tenantId = 'tenant-123'
      const tenant = {
        id: tenantId,
        name: 'Test Consulting',
        brandConfig: { logo: 'old-logo.png' },
      }

      mockTenantRepository.findOne.mockResolvedValue(tenant)
      mockTenantRepository.save.mockImplementation((t) => Promise.resolve(t))

      await service.resetBranding(tenantId)

      expect(tenant.brandConfig).toBeNull()
      expect(mockTenantRepository.save).toHaveBeenCalledWith(tenant)
    })
  })
})
