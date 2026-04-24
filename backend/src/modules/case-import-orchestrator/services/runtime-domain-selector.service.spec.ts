import { TAXONOMY_MULTIDOMAIN_ATDD_SUPPORTED_L1_CODES } from '../testing/taxonomy-multidomain-atdd.fixtures'
import { RuntimeDomainSelectorService } from './runtime-domain-selector.service'

describe('RuntimeDomainSelectorService', () => {
  it('[P1][6.3-AUTO-005] should expose runtime-ready domains in stable registry order for extraction fan-out', () => {
    const service = new RuntimeDomainSelectorService()

    expect(service.getSupportedDomains()).toEqual([
      ...TAXONOMY_MULTIDOMAIN_ATDD_SUPPORTED_L1_CODES,
    ])
  })
})
