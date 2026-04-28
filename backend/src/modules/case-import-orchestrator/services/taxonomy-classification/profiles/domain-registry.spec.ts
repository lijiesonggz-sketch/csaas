import {
  TAXONOMY_MULTIDOMAIN_ATDD_ALLOWED_READINESS_STATES,
  TAXONOMY_MULTIDOMAIN_ATDD_REQUIRED_PROFILE_FIELDS,
  TAXONOMY_MULTIDOMAIN_ATDD_RUNTIME_READINESS,
  TAXONOMY_MULTIDOMAIN_ATDD_SUPPORTED_L1_CODES,
} from '../../../testing/taxonomy-multidomain-atdd.fixtures'
import { createTaxonomyDomainRegistry, TAXONOMY_DOMAIN_REGISTRY } from './domain-registry'

describe('TAXONOMY_DOMAIN_REGISTRY', () => {
  it('should expose IT01-IT08 with required declarative profile fields', () => {
    expect(Object.keys(TAXONOMY_DOMAIN_REGISTRY).sort()).toEqual(
      [...TAXONOMY_MULTIDOMAIN_ATDD_SUPPORTED_L1_CODES].sort(),
    )

    for (const l1Code of TAXONOMY_MULTIDOMAIN_ATDD_SUPPORTED_L1_CODES) {
      const entry = TAXONOMY_DOMAIN_REGISTRY[l1Code]

      expect(entry.profile.l1Code).toBe(l1Code)
      expect(entry.rulebook.l1Code).toBe(l1Code)

      for (const field of TAXONOMY_MULTIDOMAIN_ATDD_REQUIRED_PROFILE_FIELDS) {
        expect(entry.profile).toHaveProperty(field)
      }

      Object.values(entry.profile).forEach((value) => {
        expect(typeof value).not.toBe('function')
      })
    }
  })

  it('should assign independent rulebook versions for every domain', () => {
    const versions = TAXONOMY_MULTIDOMAIN_ATDD_SUPPORTED_L1_CODES.map(
      (l1Code) => TAXONOMY_DOMAIN_REGISTRY[l1Code].rulebook.version,
    )

    expect(new Set(versions).size).toBe(TAXONOMY_MULTIDOMAIN_ATDD_SUPPORTED_L1_CODES.length)

    for (const l1Code of TAXONOMY_MULTIDOMAIN_ATDD_SUPPORTED_L1_CODES) {
      expect(TAXONOMY_DOMAIN_REGISTRY[l1Code].rulebook).not.toHaveProperty('precedenceStrategy')
      expect(TAXONOMY_DOMAIN_REGISTRY[l1Code].rulebook).not.toHaveProperty('rolloutState')
    }
  })

  it('should expose runtime-classifier-ready readiness metadata with verifiable entry points', () => {
    for (const l1Code of TAXONOMY_MULTIDOMAIN_ATDD_SUPPORTED_L1_CODES) {
      const readiness = TAXONOMY_DOMAIN_REGISTRY[l1Code].readiness

      expect(TAXONOMY_MULTIDOMAIN_ATDD_ALLOWED_READINESS_STATES).toContain(readiness.stage)
      expect(readiness.stage).toBe(TAXONOMY_MULTIDOMAIN_ATDD_RUNTIME_READINESS)
      expect(readiness.verifiableEntryPoint).toBe(`TAXONOMY_DOMAIN_REGISTRY.${l1Code}`)
    }
  })

  it('should fail fast when profile and compiled rulebook drift on version or fallbackBucket', () => {
    expect(() =>
      createTaxonomyDomainRegistry({
        rulebooks: {
          IT01: {
            ...TAXONOMY_DOMAIN_REGISTRY.IT01.rulebook,
            version: 'it01-rulebook-v999',
          },
        },
      }),
    ).toThrow(/IT01/i)

    expect(() =>
      createTaxonomyDomainRegistry({
        rulebooks: {
          IT04: {
            ...TAXONOMY_DOMAIN_REGISTRY.IT04.rulebook,
            fallbackBucket: 'IT04-99',
          },
        },
      }),
    ).toThrow(/IT04/i)
  })
})
