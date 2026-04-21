import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../../common/decorators/roles.decorator'
import { UserRole } from '../../../database/entities/user.entity'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { RegulationGraphResponseDto } from '../dto/regulation-graph.dto'
import { ReasoningChainResponseDto } from '../dto/reasoning-chain.dto'
import { RegulationService } from '../services/regulation.service'
import { TaxonomyService } from '../services/taxonomy.service'

@ApiTags('Knowledge Graph')
@ApiBearerAuth()
@Controller('api/admin/knowledge-graph')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONSULTANT)
export class KnowledgeGraphController {
  constructor(
    private readonly taxonomyService: TaxonomyService,
    private readonly regulationService: RegulationService,
  ) {}

  /**
   * 获取完整推理链路数据。
   * 注意：此端点路径 `/reasoning-chain/:l2Code` 是特殊设计，用于表达"基于 L2 分类获取推理链路"的语义。
   * 虽然不完全符合 RESTful 资源命名规范，但更清晰地表达了业务意图。
   * 保持现有路径以维持 API 稳定性。
   */
  @Get('reasoning-chain/:l2Code')
  @ApiOperation({ summary: '获取完整推理链路数据' })
  @ApiResponse({ status: 200, type: ReasoningChainResponseDto })
  @ApiResponse({ status: 404, description: 'L2 分类代码不存在' })
  async getReasoningChain(@Param('l2Code') l2Code: string) {
    return this.taxonomyService.getReasoningChain(l2Code)
  }

  @Get('regulation-graph/:sourceId')
  @ApiOperation({ summary: '获取法规驱动线图谱数据' })
  @ApiResponse({ status: 200, type: RegulationGraphResponseDto })
  @ApiResponse({ status: 404, description: '法规来源不存在' })
  async getRegulationGraph(@Param('sourceId', ParseUUIDPipe) sourceId: string) {
    return this.regulationService.getRegulationGraph(sourceId)
  }
}
