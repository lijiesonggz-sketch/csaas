import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SimilarityCalculator } from './validators/similarity.calculator'
import { ConsistencyValidator } from './validators/consistency.validator'
import { CoverageChecker } from './validators/coverage.checker'
import { QualityValidationService } from './quality-validation.service'

/**
 * 质量验证模块
 * 提供AI生成结果的质量验证功能
 */
@Module({
  imports: [ConfigModule],
  providers: [
    SimilarityCalculator,
    ConsistencyValidator,
    CoverageChecker,
    QualityValidationService,
  ],
  exports: [
    SimilarityCalculator,
    ConsistencyValidator,
    CoverageChecker,
    QualityValidationService,
  ],
})
export class QualityValidationModule {}
