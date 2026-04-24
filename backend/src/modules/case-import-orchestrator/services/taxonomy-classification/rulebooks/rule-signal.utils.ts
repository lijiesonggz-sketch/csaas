import type { TaxonomyRuleSignal } from '../contracts/classification-result.contract'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

type KeywordPattern = RegExp | string

export function keywordSignal(
  label: string,
  weight: number,
  phrases: KeywordPattern[],
): TaxonomyRuleSignal {
  if (phrases.length === 0) {
    throw new Error('keywordSignal requires at least one phrase')
  }

  return {
    label,
    weight,
    pattern: new RegExp(
      phrases
        .map((phrase) => (phrase instanceof RegExp ? phrase.source : escapeRegExp(phrase)))
        .join('|'),
    ),
  }
}
