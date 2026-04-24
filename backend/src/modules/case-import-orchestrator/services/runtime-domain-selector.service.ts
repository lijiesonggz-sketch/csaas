import { Injectable } from '@nestjs/common'
import { listRuntimeReadyTaxonomyDomainCodes } from './taxonomy-classification/profiles/domain-registry'

@Injectable()
export class RuntimeDomainSelectorService {
  getSupportedDomains(): string[] {
    return listRuntimeReadyTaxonomyDomainCodes()
  }
}
