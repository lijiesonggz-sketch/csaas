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
import { AuditLog } from '../../database/entities/audit-log.entity'
import { AIGenerationModule } from '../ai-generation/ai-generation.module'
import { AIClientsModule } from '../ai-clients/ai-clients.module'
import { OrganizationsModule } from '../organizations/organizations.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, ProjectMember, AITask, AuditLog]),
    AIGenerationModule,
    AIClientsModule,
    OrganizationsModule,
  ],
  controllers: [ProjectsController, TestDebugController],
  providers: [
    ProjectsService,
    ProjectMembersService,
    TaskRerunService,
    AuditLogService,
    ProjectAccessGuard,
  ],
  exports: [
    ProjectsService,
    ProjectMembersService,
    TaskRerunService,
    AuditLogService,
    ProjectAccessGuard,
  ],
})
export class ProjectsModule {}
