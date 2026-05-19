declare module 'jest-axe' {
  import type { MatcherFunction } from 'expect'

  export interface AxeResults {
    violations: Array<{
      id: string
      impact?: string | null
      description: string
      help: string
      helpUrl: string
      nodes: Array<{
        html: string
        target: string[]
        failureSummary?: string
      }>
    }>
  }

  export function axe(html: Element | Document): Promise<AxeResults>

  export const toHaveNoViolations: {
    toHaveNoViolations: MatcherFunction<[AxeResults?]>
  }
}

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveNoViolations(): R
    }
  }
}
