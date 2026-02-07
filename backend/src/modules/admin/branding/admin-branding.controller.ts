import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiConsumes } from '@nestjs/swagger'
import { AdminBrandingService } from './admin-branding.service'
import { UpdateBrandingDto } from './dto/update-branding.dto'
import { FileUploadService } from './file-upload.service'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { Roles } from '../../auth/decorators/roles.decorator'
import { UserRole } from '../../../database/entities/user.entity'

/**
 * Admin Branding Controller
 *
 * REST API controller for managing tenant branding configuration.
 *
 * @story 6-3
 * @route /api/v1/admin/branding
 */
@ApiTags('Admin - Branding')
@ApiBearerAuth()
@Controller('api/v1/admin/branding')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminBrandingController {
  constructor(
    private readonly adminBrandingService: AdminBrandingService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  /**
   * Get branding configuration
   */
  @Get()
  @ApiOperation({ summary: '获取品牌配置', description: '获取当前租户的品牌配置信息' })
  @ApiResponse({ status: 200, description: '成功返回品牌配置' })
  @ApiResponse({ status: 404, description: '租户不存在' })
  async getBranding(@Request() req) {
    const tenantId = req.tenantId
    const branding = await this.adminBrandingService.getBranding(tenantId)

    return {
      success: true,
      data: {
        brandPrimaryColor: branding.primaryColor,
        brandSecondaryColor: branding.secondaryColor,
        brandLogoUrl: branding.logoUrl,
        companyName: branding.companyName,
        contactEmail: branding.contactEmail,
        contactPhone: branding.contactPhone,
        emailSignature: branding.emailSignature,
      },
    }
  }

  /**
   * Update branding configuration
   */
  @Put()
  @ApiOperation({ summary: '更新品牌配置', description: '更新租户的品牌配置信息' })
  @ApiBody({ type: UpdateBrandingDto })
  @ApiResponse({ status: 200, description: '成功更新品牌配置' })
  @ApiResponse({ status: 404, description: '租户不存在' })
  async updateBranding(@Request() req, @Body() dto: UpdateBrandingDto) {
    const tenantId = req.tenantId
    const branding = await this.adminBrandingService.updateBranding(tenantId, dto)

    return {
      success: true,
      data: {
        brandPrimaryColor: branding.primaryColor,
        brandSecondaryColor: branding.secondaryColor,
        brandLogoUrl: branding.logoUrl,
        companyName: branding.companyName,
      },
    }
  }

  /**
   * Upload logo
   */
  @Post('logo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: '上传 Logo', description: '上传租户品牌 Logo 文件 (PNG/JPG/SVG, 最大 2MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Logo 文件 (PNG/JPG/SVG)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: '成功上传 Logo', schema: { properties: { logoUrl: { type: 'string' } } } })
  @ApiResponse({ status: 400, description: '文件验证失败' })
  @ApiResponse({ status: 404, description: '租户不存在' })
  async uploadLogo(@Request() req, @UploadedFile() file: Express.Multer.File) {
    const tenantId = req.tenantId

    // Delete old logo before uploading new one
    try {
      const oldBranding = await this.adminBrandingService.getBranding(tenantId)
      if (oldBranding.logoUrl) {
        // Extract filename from URL path
        const urlParts = oldBranding.logoUrl.split('/')
        const oldFilename = urlParts[urlParts.length - 1]
        await this.fileUploadService.deleteFile(tenantId, oldFilename)
      }
    } catch (error) {
      // Continue even if deletion fails (old file might not exist)
    }

    // Save and compress file
    const logoUrl = await this.fileUploadService.saveFile(file, tenantId)

    // Update tenant branding
    const branding = await this.adminBrandingService.updateLogo(tenantId, logoUrl)

    return {
      success: true,
      data: {
        brandLogoUrl: branding.logoUrl,
      },
    }
  }
}

/**
 * Public Branding Controller
 *
 * Provides public access to branding configuration for frontend initialization.
 * No authentication required.
 *
 * @story 6-3
 * @route /api/v1/tenant/branding
 */
@ApiTags('Public - Branding')
@Controller('api/v1/tenant/branding')
export class PublicBrandingController {
  constructor(private readonly adminBrandingService: AdminBrandingService) {}

  /**
   * Get branding configuration for current tenant
   *
   * For authenticated users: automatically extracts tenantId from JWT token
   * For unauthenticated users: requires x-tenant-id header
   */
  @Get()
  @ApiOperation({ summary: '获取公开品牌配置', description: '获取当前租户的公开品牌配置（无需认证）' })
  @ApiResponse({ status: 200, description: '成功返回品牌配置' })
  @ApiResponse({ status: 200, description: '租户不存在时返回默认配置' })
  async getPublicBranding(@Request() req) {
    // Try to get tenantId from authenticated user first (if logged in)
    let tenantId = req.user?.tenantId || req.tenantId

    // If not authenticated, try to get from header
    if (!tenantId) {
      tenantId = req.headers['x-tenant-id'] as string
    }

    // Validate tenantId format (UUID)
    if (!tenantId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      // Return default branding if no valid tenantId
      return {
        success: true,
        data: {
          brandPrimaryColor: '#1890ff',
          brandSecondaryColor: null,
          brandLogoUrl: null,
          companyName: 'Csaas',
        },
      }
    }

    const branding = await this.adminBrandingService.getPublicBranding(tenantId)
    if (!branding) {
      // Return default branding if tenant not found
      return {
        success: true,
        data: {
          brandPrimaryColor: '#1890ff',
          brandSecondaryColor: null,
          brandLogoUrl: null,
          companyName: 'Csaas',
        },
      }
    }

    // Return in frontend-expected format with correct field names
    return {
      success: true,
      data: {
        brandPrimaryColor: branding.primaryColor,
        brandSecondaryColor: branding.secondaryColor,
        brandLogoUrl: branding.logoUrl,
        companyName: branding.companyName,
      },
    }
  }
}
