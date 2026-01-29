import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { Roles } from '../../../common/decorators/roles.decorator'
import { UserRole } from '../../../database/entities/user.entity'
import { RadarSourceService } from '../services/radar-source.service'
import {
  CreateRadarSourceDto,
  UpdateRadarSourceDto,
  QueryRadarSourceDto,
} from '../dto/radar-source.dto'

/**
 * RadarSourceController
 *
 * 提供雷达信息源配置管理的 API 端点
 *
 * Story 3.1: 配置行业雷达信息源
 *
 * 权限要求：所有端点需要 CONSULTANT 角色（管理员）
 */
@Controller('api/admin/radar-sources')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CONSULTANT)
export class RadarSourceController {
  constructor(private readonly radarSourceService: RadarSourceService) {}

  /**
   * 获取所有信息源
   * GET /api/admin/radar-sources
   *
   * @param query - 查询参数（category, isActive）
   */
  @Get()
  async findAll(@Query() query: QueryRadarSourceDto) {
    const sources = await this.radarSourceService.findAll(
      query.category,
      query.isActive,
    )

    return {
      success: true,
      data: sources,
      total: sources.length,
    }
  }

  /**
   * 获取单个信息源
   * GET /api/admin/radar-sources/:id
   *
   * @param id - 信息源 ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const source = await this.radarSourceService.findById(id)

    return {
      success: true,
      data: source,
    }
  }

  /**
   * 创建新的信息源
   * POST /api/admin/radar-sources
   *
   * @param dto - 创建数据
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateRadarSourceDto) {
    const source = await this.radarSourceService.create(dto)

    return {
      success: true,
      data: source,
      message: 'Radar source created successfully',
    }
  }

  /**
   * 更新信息源
   * PUT /api/admin/radar-sources/:id
   *
   * @param id - 信息源 ID
   * @param dto - 更新数据
   */
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateRadarSourceDto) {
    const source = await this.radarSourceService.update(id, dto)

    return {
      success: true,
      data: source,
      message: 'Radar source updated successfully',
    }
  }

  /**
   * 删除信息源
   * DELETE /api/admin/radar-sources/:id
   *
   * @param id - 信息源 ID
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.radarSourceService.delete(id)

    return {
      success: true,
      message: 'Radar source deleted successfully',
    }
  }

  /**
   * 切换信息源启用状态
   * PATCH /api/admin/radar-sources/:id/toggle
   *
   * @param id - 信息源 ID
   */
  @Patch(':id/toggle')
  async toggleActive(@Param('id') id: string) {
    const source = await this.radarSourceService.toggleActive(id)

    return {
      success: true,
      data: source,
      message: `Radar source ${source.isActive ? 'enabled' : 'disabled'} successfully`,
    }
  }

  /**
   * 测试爬虫功能
   * POST /api/admin/radar-sources/:id/test-crawl
   *
   * 触发一次性爬虫测试，验证信息源配置是否正确
   *
   * @param id - 信息源 ID
   */
  @Post(':id/test-crawl')
  async testCrawl(@Param('id') id: string) {
    const source = await this.radarSourceService.findById(id)

    try {
      // 调用爬虫服务进行测试爬取
      const result = await this.radarSourceService.testCrawl(source)

      return {
        success: true,
        data: {
          sourceId: source.id,
          source: source.source,
          url: source.url,
          status: 'success',
          message: 'Test crawl completed successfully',
          result: {
            contentId: result.id,
            title: result.title,
            contentLength: result.fullContent?.length || 0,
            url: result.url,
          },
        },
      }
    } catch (error) {
      return {
        success: false,
        data: {
          sourceId: source.id,
          source: source.source,
          url: source.url,
          status: 'failed',
          message: error.message || 'Test crawl failed',
        },
      }
    }
  }

  /**
   * 获取按类别分组的信息源统计
   * GET /api/admin/radar-sources/stats/by-category
   */
  @Get('stats/by-category')
  async getStatsByCategory() {
    const allSources = await this.radarSourceService.findAll()

    const stats = {
      tech: {
        total: 0,
        active: 0,
        inactive: 0,
      },
      industry: {
        total: 0,
        active: 0,
        inactive: 0,
      },
      compliance: {
        total: 0,
        active: 0,
        inactive: 0,
      },
    }

    allSources.forEach((source) => {
      stats[source.category].total++
      if (source.isActive) {
        stats[source.category].active++
      } else {
        stats[source.category].inactive++
      }
    })

    return {
      success: true,
      data: stats,
    }
  }
}
