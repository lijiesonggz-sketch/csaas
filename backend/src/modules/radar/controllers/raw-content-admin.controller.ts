import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { Roles } from '../../../common/decorators/roles.decorator'
import { UserRole } from '../../../database/entities/user.entity'
import { RawContentService } from '../services/raw-content.service'
import { AnalyzedContentService } from '../services/analyzed-content.service'
import {
  QueryRawContentDto,
  RawContentListResponseDto,
  RawContentStatsDto,
  RawContentDetailDto,
} from '../dto/raw-content.dto'

/**
 * RawContentAdminController
 *
 * Story 8.3: 文件导入状态管理界面
 *
 * 提供文件导入内容管理的后台API
 * - 列表查询（支持筛选、分页）
 * - 统计信息
 * - 内容详情
 * - 重新分析
 * - 删除内容
 */
@ApiTags('Raw Content Admin')
@Controller('api/admin/raw-contents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONSULTANT)
@ApiBearerAuth()
export class RawContentAdminController {
  constructor(
    private readonly rawContentService: RawContentService,
    private readonly analyzedContentService: AnalyzedContentService,
  ) {}

  /**
   * 获取RawContent列表
   * GET /api/admin/raw-contents
   *
   * Story 8.3: 支持状态、分类、来源筛选和分页
   */
  @Get()
  @ApiOperation({ summary: '获取文件导入内容列表', description: '支持状态、分类、来源筛选和分页' })
  @ApiResponse({ status: 200, description: '成功', type: RawContentListResponseDto })
  async findAll(@Query() query: QueryRawContentDto): Promise<RawContentListResponseDto> {
    const { items, total, page, limit } = await this.rawContentService.findWithFilters({
      status: query.status,
      category: query.category,
      source: query.source,
      organizationId: query.organizationId,
      search: query.keyword,
      page: query.page,
      limit: query.limit,
    })

    return {
      data: items.map(item => this.mapToListItem(item)),
      total,
      page,
      limit,
    }
  }

  /**
   * 获取统计信息
   * GET /api/admin/raw-contents/stats
   *
   * Story 8.3: 各状态数量和今日导入数量
   */
  @Get('stats')
  @ApiOperation({ summary: '获取文件导入统计', description: '各状态数量和今日导入数量' })
  @ApiResponse({ status: 200, description: '成功', type: RawContentStatsDto })
  async getStats(): Promise<RawContentStatsDto> {
    return await this.rawContentService.getStats()
  }

  /**
   * 获取内容详情
   * GET /api/admin/raw-contents/:id
   *
   * Story 8.3: 查看单条内容详情
   */
  @Get(':id')
  @ApiOperation({ summary: '获取内容详情', description: '查看单条文件导入内容的详细信息' })
  @ApiResponse({ status: 200, description: '成功', type: RawContentDetailDto })
  @ApiResponse({ status: 404, description: '内容不存在' })
  async findOne(@Param('id') id: string): Promise<RawContentDetailDto> {
    const content = await this.rawContentService.findById(id)

    if (!content) {
      throw new NotFoundException('Content not found')
    }

    // 获取AI分析结果
    const analyzedContent = await this.analyzedContentService.findByContentId(id)

    return this.mapToDetail(content, analyzedContent)
  }

  /**
   * 重新触发AI分析
   * POST /api/admin/raw-contents/:id/reanalyze
   *
   * Story 8.3: 对失败或待分析内容重新触发分析
   */
  @Post(':id/reanalyze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '重新分析内容', description: '对失败或待分析内容重新触发AI分析' })
  @ApiResponse({ status: 200, description: '成功' })
  @ApiResponse({ status: 404, description: '内容不存在' })
  async reanalyze(@Param('id') id: string): Promise<{ message: string }> {
    await this.rawContentService.reanalyze(id)
    return { message: '重新分析已触发' }
  }

  /**
   * 删除内容
   * DELETE /api/admin/raw-contents/:id
   *
   * Story 8.3: 删除导入的内容
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除内容', description: '删除导入的文件内容' })
  @ApiResponse({ status: 204, description: '删除成功' })
  @ApiResponse({ status: 404, description: '内容不存在' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.rawContentService.delete(id)
  }

  /**
   * 映射为列表项DTO
   */
  private mapToListItem(item: any): any {
    return {
      id: item.id,
      title: item.title,
      author: item.author,
      source: item.source,
      category: item.category,
      status: item.status,
      originalUrl: item.url,
      sourceName: item.sourceName,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }
  }

  /**
   * 映射为详情DTO
   */
  private mapToDetail(item: any, analyzedContent?: any): any {
    const dto: any = {
      id: item.id,
      title: item.title,
      author: item.author,
      publishDate: item.publishDate,
      source: item.source,
      category: item.category,
      status: item.status,
      originalUrl: item.url,
      sourceName: item.sourceName,
      fullContent: item.fullContent,
      analysisResult: item.analysisResult,
      generatedContentId: item.generatedContentId,
      organizationId: item.organizationId,
      errorMessage: item.errorMessage,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }

    // 添加AI分析结果
    if (analyzedContent) {
      dto.aiSummary = analyzedContent.aiSummary
      dto.aiAnalysisStatus = analyzedContent.status
      dto.aiModel = analyzedContent.aiModel
      dto.keywords = analyzedContent.keywords
      dto.categories = analyzedContent.categories
      dto.targetAudience = analyzedContent.targetAudience
      dto.roiAnalysis = analyzedContent.roiAnalysis

      // 合规分析结果
      if (analyzedContent.complianceAnalysis) {
        dto.complianceAnalysis = analyzedContent.complianceAnalysis
      }
    }

    return dto
  }
}
