import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AIUsageService } from '@/modules/admin/cost-optimization/ai-usage.service';
import { AIUsageTaskType } from '@/database/entities/ai-usage-log.entity';

/**
 * AI Usage Interceptor
 *
 * Automatically logs AI API usage for cost tracking.
 * Extracts token information from AI client responses and records usage.
 *
 * Usage:
 * ```typescript
 * @UseInterceptors(AIUsageInterceptor)
 * @AIUsage(AIUsageTaskType.TECH_ANALYSIS)
 * async analyzeContent(...) { ... }
 * ```
 *
 * @story 7-4
 * @module backend/src/common/interceptors
 */
@Injectable()
export class AIUsageInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AIUsageInterceptor.name);

  constructor(private aiUsageService: AIUsageService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const taskType = Reflect.getMetadata('ai_task_type', context.getHandler());

    return next.handle().pipe(
      tap(async (response) => {
        try {
          // Extract token information from AIClientResponse
          // Support both formats: tokens.prompt/completion (actual) and promptTokens/completionTokens (legacy)
          const promptTokens = response?.tokens?.prompt ?? response?.promptTokens;
          const completionTokens = response?.tokens?.completion ?? response?.completionTokens;

          if (promptTokens !== undefined && completionTokens !== undefined) {
            await this.aiUsageService.logAIUsage({
              organizationId: request.user?.organizationId,
              taskType,
              inputTokens: promptTokens,
              outputTokens: completionTokens,
              requestId: response.model || 'unknown',
            });
          }
        } catch (error) {
          // Log error but don't block business logic
          this.logger.error('Failed to log AI usage', error);
        }
      }),
    );
  }
}

/**
 * AI Usage Decorator
 *
 * Marks a method with its AI task type for usage tracking.
 *
 * @param taskType - Type of AI task being performed
 * @returns Method decorator
 */
export const AIUsage = (taskType: AIUsageTaskType) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('ai_task_type', taskType, descriptor.value);
    return descriptor;
  };
};
