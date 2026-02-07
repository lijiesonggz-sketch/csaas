import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Tenant } from '../../../database/entities/tenant.entity'
import { UpdateBrandingDto } from './dto/update-branding.dto'

/**
 * Admin Branding Service
 *
 * Service for managing tenant branding configuration.
 *
 * @story 6-3
 */
@Injectable()
export class AdminBrandingService {
  private readonly logger = new Logger(AdminBrandingService.name)

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  /**
   * Get branding configuration for a tenant
   *
   * @param tenantId - The tenant ID
   * @returns Branding configuration
   */
  async getBranding(tenantId: string): Promise<{
    companyName: string
    logoUrl: string | null
    primaryColor: string
    secondaryColor: string | null
    contactEmail: string | null
    contactPhone: string | null
    emailSignature: string | null
  }> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    })

    if (!tenant) {
      throw new NotFoundException('Tenant not found')
    }

    const brandConfig = tenant.brandConfig || {}

    return {
      companyName: brandConfig.companyName || tenant.name,
      logoUrl: brandConfig.logo || null,
      primaryColor: brandConfig.themeColor || '#1890ff',
      secondaryColor: brandConfig.secondaryColor || null,
      contactEmail: brandConfig.contactEmail || null,
      contactPhone: brandConfig.contactPhone || null,
      emailSignature: brandConfig.emailSignature || null,
    }
  }

  /**
   * Update branding configuration
   *
   * @param tenantId - The tenant ID
   * @param dto - Update branding data
   * @returns Updated branding configuration
   */
  async updateBranding(tenantId: string, dto: UpdateBrandingDto): Promise<{
    companyName: string
    logoUrl: string | null
    primaryColor: string
    secondaryColor: string | null
  }> {
    this.logger.log(`Updating branding for tenant ${tenantId}`)

    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    })

    if (!tenant) {
      this.logger.warn(`Tenant not found: ${tenantId}`)
      throw new NotFoundException('Tenant not found')
    }

    // Update brand config
    const brandConfig = tenant.brandConfig || {}

    if (dto.companyName !== undefined) {
      brandConfig.companyName = dto.companyName
    }
    if (dto.brandLogoUrl !== undefined) {
      brandConfig.logo = dto.brandLogoUrl
    }
    if (dto.brandPrimaryColor !== undefined) {
      brandConfig.themeColor = dto.brandPrimaryColor
    }
    if (dto.brandSecondaryColor !== undefined) {
      brandConfig.secondaryColor = dto.brandSecondaryColor
    }
    if (dto.contactEmail !== undefined) {
      brandConfig.contactEmail = dto.contactEmail
    }
    if (dto.contactPhone !== undefined) {
      brandConfig.contactPhone = dto.contactPhone
    }
    if (dto.emailSignature !== undefined) {
      brandConfig.emailSignature = dto.emailSignature
    }

    tenant.brandConfig = brandConfig

    await this.tenantRepository.save(tenant)

    this.logger.log(`Branding updated successfully for tenant ${tenantId}`)

    return {
      companyName: brandConfig.companyName || tenant.name,
      logoUrl: brandConfig.logo || null,
      primaryColor: brandConfig.themeColor || '#1890ff',
      secondaryColor: brandConfig.secondaryColor || null,
    }
  }

  /**
   * Update logo URL
   *
   * @param tenantId - The tenant ID
   * @param logoUrl - The logo URL
   * @returns Updated branding configuration
   */
  async updateLogo(tenantId: string, logoUrl: string): Promise<{
    companyName: string
    logoUrl: string
    primaryColor: string
  }> {
    return this.updateBranding(tenantId, { brandLogoUrl: logoUrl })
  }

  /**
   * Get public branding (limited fields)
   *
   * @param tenantId - The tenant ID
   * @returns Public branding configuration
   */
  async getPublicBranding(tenantId: string): Promise<{
    companyName: string
    logoUrl: string | null
    primaryColor: string
    secondaryColor: string | null
  } | null> {
    if (!tenantId) {
      return null
    }

    try {
      const branding = await this.getBranding(tenantId)
      return {
        companyName: branding.companyName,
        logoUrl: branding.logoUrl,
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor || null,
      }
    } catch (error) {
      // Return null if tenant not found (for public access)
      return null
    }
  }

  /**
   * Reset branding to default
   *
   * @param tenantId - The tenant ID
   */
  async resetBranding(tenantId: string): Promise<void> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    })

    if (!tenant) {
      throw new NotFoundException('Tenant not found')
    }

    tenant.brandConfig = null
    await this.tenantRepository.save(tenant)
  }
}
