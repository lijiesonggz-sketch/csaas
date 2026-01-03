import { Controller, Get, Req } from '@nestjs/common'
import { Logger } from '@nestjs/common'

@Controller('test-debug')
export class TestDebugController {
  private readonly logger = new Logger(TestDebugController.name)

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
}
