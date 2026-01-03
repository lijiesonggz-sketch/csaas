import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common'

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  private readonly logger = new Logger(ProjectAccessGuard.name)

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const { projectId } = request.params
    const user = request.user || { id: request.headers['x-user-id'] }

    this.logger.log(`🔍 ProjectAccessGuard: projectId=${projectId}, userId=${user?.id}`)

    if (!user || !user.id) {
      throw new ForbiddenException('用户未登录')
    }

    // 简化版权限检查：只检查用户是否登录，不检查项目成员关系
    // TODO: 后续添加项目成员权限检查
    this.logger.log(`✅ Access granted to user ${user.id}`)

    // 将用户ID注入request供后续使用
    request.user = request.user || { id: user.id }

    return true
  }
}
