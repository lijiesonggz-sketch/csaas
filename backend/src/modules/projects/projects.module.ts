import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ProjectsController } from './controllers/projects.controller'
import { TestDebugController } from './test-debug.controller'
import { ProjectsService } from './services/projects.service'
import { ProjectMembersService } from './services/project-members.service'
import { TaskRerunService } from './services/task-rerun.service'
import { AuditLogService } from './services/audit-log.service'
import { ProjectAccessGuard } from './guards/project-access.guard'
import { Project } from '../../database/entities/project.entity'
import { ProjectMember } from '../../database/entities/project-member.entity'
import { AITask } from '../../database/entities/ai-task.entity'
import { AIGenerationResult } from '../../database/entities/ai-generation-result.entity'
import { AuditLog } from '../../database/entities/audit-log.entity'
import { ControlPoint } from '../../database/entities/control-point.entity'
import { RegulationClause } from '../../database/entities/regulation-clause.entity'
import { AIGenerationModule } from '../ai-generation/ai-generation.module'
import { AIClientsModule } from '../ai-clients/ai-clients.module'
import { AITasksModule } from '../ai-tasks/ai-tasks.module'
import { OrganizationsModule } from '../organizations/organizations.module'
import { ProjectReviewController } from './controllers/project-review.controller'
import { ProjectReviewService } from './services/project-review.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ProjectMember,
      AITask,
      AIGenerationResult,
      AuditLog,
      ControlPoint,
      RegulationClause,
    ]),
    AIGenerationModule,
    AIClientsModule,
    AITasksModule,
    OrganizationsModule,
  ],
  controllers: [ProjectsController, ProjectReviewController, TestDebugController],
  providers: [
    ProjectsService,
    ProjectMembersService,
    TaskRerunService,
    AuditLogService,
    ProjectReviewService,
    ProjectAccessGuard,
  ],
  exports: [
    ProjectsService,
    ProjectMembersService,
    TaskRerunService,
    AuditLogService,
    ProjectReviewService,
    ProjectAccessGuard,
  ],
})
export class ProjectsModule {}
