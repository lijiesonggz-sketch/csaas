import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AIUsageInterceptor, AIUsage } from './ai-usage.interceptor';
import { AIUsageService } from '@/modules/admin/cost-optimization/ai-usage.service';
import { AIUsageTaskType } from '@/database/entities/ai-usage-log.entity';

describe('AIUsageInterceptor', () => {
  let interceptor: AIUsageInterceptor;
  let aiUsageService: jest.Mocked<AIUsageService>;

  beforeEach(async () => {
    const mockAIUsageService = {
      logAIUsage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIUsageInterceptor,
        {
          provide: AIUsageService,
          useValue: mockAIUsageService,
        },
      ],
    }).compile();

    interceptor = module.get<AIUsageInterceptor>(AIUsageInterceptor);
    aiUsageService = module.get(AIUsageService);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    it('should log AI usage when response contains token information', async () => {
      // GIVEN: AI response with token information (actual format)
      const mockResponse = {
        content: 'AI generated content',
        tokens: {
          prompt: 1000,
          completion: 500,
          total: 1500,
        },
        model: 'qwen-plus',
        cost: 0.02,
      };

      const mockRequest = {
        user: {
          organizationId: 'org-123',
        },
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
        getHandler: () => {
          const handler = () => {};
          Reflect.defineMetadata('ai_task_type', AIUsageTaskType.TECH_ANALYSIS, handler);
          return handler;
        },
      } as unknown as ExecutionContext;

      const mockCallHandler: CallHandler = {
        handle: () => of(mockResponse),
      };

      // WHEN: intercepting the call
      const result = await interceptor.intercept(mockContext, mockCallHandler).toPromise();

      // THEN: should log AI usage
      expect(result).toEqual(mockResponse);
      expect(aiUsageService.logAIUsage).toHaveBeenCalledWith({
        organizationId: 'org-123',
        taskType: AIUsageTaskType.TECH_ANALYSIS,
        inputTokens: 1000,
        outputTokens: 500,
        requestId: 'qwen-plus',
      });
    });

    it('should not log if response does not contain token information', async () => {
      // GIVEN: response without token information
      const mockResponse = {
        content: 'Some content',
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ user: { organizationId: 'org-123' } }),
        }),
        getHandler: () => {
          const handler = () => {};
          Reflect.defineMetadata('ai_task_type', AIUsageTaskType.TECH_ANALYSIS, handler);
          return handler;
        },
      } as unknown as ExecutionContext;

      const mockCallHandler: CallHandler = {
        handle: () => of(mockResponse),
      };

      // WHEN: intercepting the call
      await interceptor.intercept(mockContext, mockCallHandler).toPromise();

      // THEN: should not log AI usage
      expect(aiUsageService.logAIUsage).not.toHaveBeenCalled();
    });

    it('should not throw error if logging fails', async () => {
      // GIVEN: AI usage service throws error
      const mockResponse = {
        content: 'AI generated content',
        tokens: {
          prompt: 1000,
          completion: 500,
          total: 1500,
        },
        model: 'qwen-plus',
        cost: 0.02,
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ user: { organizationId: 'org-123' } }),
        }),
        getHandler: () => {
          const handler = () => {};
          Reflect.defineMetadata('ai_task_type', AIUsageTaskType.TECH_ANALYSIS, handler);
          return handler;
        },
      } as unknown as ExecutionContext;

      const mockCallHandler: CallHandler = {
        handle: () => of(mockResponse),
      };

      aiUsageService.logAIUsage.mockRejectedValue(new Error('Database error'));

      // WHEN: intercepting the call
      const result = await interceptor.intercept(mockContext, mockCallHandler).toPromise();

      // THEN: should still return response without throwing
      expect(result).toEqual(mockResponse);
    });

    it('should handle missing user context gracefully', async () => {
      // GIVEN: request without user context
      const mockResponse = {
        content: 'AI generated content',
        tokens: {
          prompt: 1000,
          completion: 500,
          total: 1500,
        },
        model: 'qwen-plus',
        cost: 0.02,
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({}), // No user
        }),
        getHandler: () => {
          const handler = () => {};
          Reflect.defineMetadata('ai_task_type', AIUsageTaskType.TECH_ANALYSIS, handler);
          return handler;
        },
      } as unknown as ExecutionContext;

      const mockCallHandler: CallHandler = {
        handle: () => of(mockResponse),
      };

      // WHEN: intercepting the call
      const result = await interceptor.intercept(mockContext, mockCallHandler).toPromise();

      // THEN: should still return response
      expect(result).toEqual(mockResponse);
    });
  });

  describe('@AIUsage decorator', () => {
    it('should set metadata on method', () => {
      // GIVEN: a method with @AIUsage decorator
      class TestClass {
        @AIUsage(AIUsageTaskType.TECH_ANALYSIS)
        testMethod() {
          return 'test';
        }
      }

      const instance = new TestClass();
      const metadata = Reflect.getMetadata('ai_task_type', instance.testMethod);

      // THEN: metadata should be set
      expect(metadata).toBe(AIUsageTaskType.TECH_ANALYSIS);
    });
  });
});
