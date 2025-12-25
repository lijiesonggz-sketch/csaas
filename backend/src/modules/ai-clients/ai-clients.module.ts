import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { OpenAIClient } from './providers/openai.client'
import { AnthropicClient } from './providers/anthropic.client'
import { TongyiClient } from './providers/tongyi.client'
import { AIOrchestrator } from './ai-orchestrator.service'

@Module({
  imports: [ConfigModule],
  providers: [OpenAIClient, AnthropicClient, TongyiClient, AIOrchestrator],
  exports: [AIOrchestrator],
})
export class AIClientsModule {}
