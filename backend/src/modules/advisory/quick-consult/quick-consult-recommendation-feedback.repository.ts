import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DeepPartial, Repository } from 'typeorm'
import { AdvisoryRecommendationFeedback } from '../../../database/entities/advisory-recommendation-feedback.entity'
import { BaseRepository } from '../../../database/repositories/base.repository'

@Injectable()
export class QuickConsultRecommendationFeedbackRepository extends BaseRepository<AdvisoryRecommendationFeedback> {
  constructor(
    @InjectRepository(AdvisoryRecommendationFeedback)
    repository: Repository<AdvisoryRecommendationFeedback>,
  ) {
    super(repository)
  }

  async createFeedback(
    tenantId: string,
    data: DeepPartial<AdvisoryRecommendationFeedback>,
  ): Promise<AdvisoryRecommendationFeedback> {
    return this.create(tenantId, data)
  }

  async findFeedbackForContext(
    tenantId: string,
    actorId: string,
    quickConsultContextId: string,
  ): Promise<AdvisoryRecommendationFeedback | null> {
    return this.findOneWhere(tenantId, {
      actorId,
      quickConsultContextId,
    } as never)
  }
}
