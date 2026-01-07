import { Controller, Get, Req } from '@nestjs/common'
import { Logger } from '@nestjs/common'
import { AIOrchestrator } from '../ai-clients/ai-orchestrator.service'

@Controller('test-debug')
export class TestDebugController {
  private readonly logger = new Logger(TestDebugController.name)

  constructor(private readonly aiOrchestrator: AIOrchestrator) {}

  @Get('hello')
  async hello() {
    this.logger.log('🎉 TestDebugController.hello() called!')
    return {
      success: true,
      message: 'Hello from test controller!',
      timestamp: new Date().toISOString(),
    }
  }

  @Get('headers')
  async headers(@Req() req: any) {
    this.logger.log('🔍 TestDebugController.headers() called!')
    this.logger.log(`Headers: ${JSON.stringify(req.headers)}`)

    return {
      success: true,
      headers: req.headers,
      'x-user-id': req.headers['x-user-id'],
      'x-user-id lowercase': req.headers['x-user-id'],
    }
  }

  @Get('ai-providers')
  async checkAIProviders() {
    this.logger.log('🤖 TestDebugController.checkAIProviders() called!')

    const providers = this.aiOrchestrator.getAvailableProviders()

    return {
      success: true,
      timestamp: new Date().toISOString(),
      providers,
      hasAnyProvider: this.aiOrchestrator.hasAvailableProvider(),
    }
  }

  @Get('check-env')
  async checkEnvironmentVariables() {
    this.logger.log('🔍 TestDebugController.checkEnvironmentVariables() called!')

    return {
      success: true,
      timestamp: new Date().toISOString(),
      environmentVariables: {
        TONGYI_API_KEY: process.env.TONGYI_API_KEY
          ? `${process.env.TONGYI_API_KEY.substring(0, 15)}...`
          : '❌ MISSING',
        TONGYI_BASE_URL: process.env.TONGYI_BASE_URL || '❌ MISSING',
        TONGYI_MODEL: process.env.TONGYI_MODEL || '❌ MISSING',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY
          ? `${process.env.OPENAI_API_KEY.substring(0, 15)}...`
          : '❌ MISSING',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
          ? `${process.env.ANTHROPIC_API_KEY.substring(0, 15)}...`
          : '❌ MISSING',
      },
      nodeEnv: process.env.NODE_ENV,
    }
  }
}
