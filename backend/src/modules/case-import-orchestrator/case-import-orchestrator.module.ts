import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { RawContent } from '../../database/entities/raw-content.entity'
import { AuditModule } from '../audit/audit.module'
import { KnowledgeGraphModule } from '../knowledge-graph/knowledge-graph.module'
import { KG_CASE_IMPORT_QUEUE } from './constants/case-import.constants'
import { CaseImportController } from './controllers/case-import.controller'
import { CaseImportAuditFilter } from './filters/case-import-audit.filter'
import { CaseImportProcessor } from './processors/case-import.processor'
import { CaseImportService } from './services/case-import.service'
import { CaseImportQueueService } from './services/case-import-queue.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([RawContent]),
    BullModule.registerQueue({
      name: KG_CASE_IMPORT_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
    KnowledgeGraphModule,
    AuditModule,
  ],
  controllers: [CaseImportController],
  providers: [
    CaseImportService,
    CaseImportQueueService,
    CaseImportProcessor,
    CaseImportAuditFilter,
  ],
  exports: [CaseImportService, CaseImportQueueService],
})
export class CaseImportOrchestratorModule {}
