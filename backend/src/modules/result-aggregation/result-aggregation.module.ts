import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AIGenerationResult } from '../../database/entities/ai-generation-result.entity'
import { ResultAggregatorService } from './result-aggregator.service'

/**
 * 结果聚合模块
 * 提供AI生成结果的聚合和投票功能
 */
@Module({
  imports: [TypeOrmModule.forFeature([AIGenerationResult])],
  providers: [ResultAggregatorService],
  exports: [ResultAggregatorService],
})
export class ResultAggregationModule {}
