import 'reflect-metadata'
import { Test } from '@nestjs/testing'
import { AdvisoryModule } from '../advisory.module'
import { ThinkTankBrandMapperService } from './brand-mapper.service'
import { ThinkTankPromptAssemblerService } from './prompt-assembler.service'
import { ThinkTankRuntimeFileProviderService } from './runtime-file-provider.service'
import { ThinkTankWorkflowParserService } from './workflow-parser.service'
import { ThinkTankWorkflowRegistryService } from './workflow-registry.service'

describe('AdvisoryModule runtime registration', () => {
  it('registers and exports runtime services from the existing AdvisoryModule', () => {
    const providers = Reflect.getMetadata('providers', AdvisoryModule) ?? []
    const exports = Reflect.getMetadata('exports', AdvisoryModule) ?? []
    const runtimeServices = [
      ThinkTankRuntimeFileProviderService,
      ThinkTankBrandMapperService,
      ThinkTankWorkflowParserService,
      ThinkTankWorkflowRegistryService,
      ThinkTankPromptAssemblerService,
    ]

    for (const service of runtimeServices) {
      expect(providers).toContain(service)
      expect(exports).toContain(service)
    }
  })

  it('compiles the runtime provider graph and resolves each runtime service', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ThinkTankRuntimeFileProviderService,
        ThinkTankBrandMapperService,
        ThinkTankWorkflowParserService,
        ThinkTankWorkflowRegistryService,
        ThinkTankPromptAssemblerService,
      ],
    }).compile()

    expect(moduleRef.get(ThinkTankRuntimeFileProviderService)).toBeInstanceOf(
      ThinkTankRuntimeFileProviderService,
    )
    expect(moduleRef.get(ThinkTankBrandMapperService)).toBeInstanceOf(ThinkTankBrandMapperService)
    expect(moduleRef.get(ThinkTankWorkflowParserService)).toBeInstanceOf(
      ThinkTankWorkflowParserService,
    )
    expect(moduleRef.get(ThinkTankWorkflowRegistryService)).toBeInstanceOf(
      ThinkTankWorkflowRegistryService,
    )
    expect(moduleRef.get(ThinkTankPromptAssemblerService)).toBeInstanceOf(
      ThinkTankPromptAssemblerService,
    )
  })
})
