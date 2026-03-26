import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { RawContent } from '../../database/entities/raw-content.entity'
import { KnowledgeGraphModule } from '../knowledge-graph/knowledge-graph.module'
import { CaseImportService } from './services/case-import.service'

@Module({
  imports: [TypeOrmModule.forFeature([RawContent]), KnowledgeGraphModule],
  providers: [CaseImportService],
  exports: [CaseImportService],
})
export class CaseImportOrchestratorModule {}
