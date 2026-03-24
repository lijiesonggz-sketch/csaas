import { Injectable } from '@nestjs/common'
import {
  PredicateEvaluationResult,
  PredicateNode,
  RuleCondition,
  RuleLogicalOperator,
  RulePredicate,
  RuleTraceEntry,
  RULE_LOGICAL_OPERATORS,
} from '../types/applicability.types'

@Injectable()
export class RuleEvaluatorService {
  evaluatePredicate<TProfile extends object>(
    predicate: RulePredicate,
    profile: TProfile,
  ): PredicateEvaluationResult {
    const traceEntries: RuleTraceEntry[] = []
    const matched = this.evaluateNode(predicate, profile as Record<string, unknown>, traceEntries)

    return {
      matched,
      traceEntries,
    }
  }

  private evaluateNode(
    node: PredicateNode,
    profile: Record<string, unknown>,
    traceEntries: RuleTraceEntry[],
    logicalPath: RuleLogicalOperator[] = [],
  ): boolean {
    if (this.isRuleCondition(node)) {
      const actualValue = profile[node.field]
      const matched = this.evaluateCondition(node, actualValue)

      traceEntries.push({
        field: node.field,
        op: node.op,
        expectedValue: this.resolveExpectedValue(node),
        actualValue,
        matched,
        logicalPath,
      })

      return matched
    }

    const [operator, children] = this.getLogicalRoot(node)
    const childLogicalPath = [...logicalPath, operator]
    const childMatches = children.map((child) =>
      this.evaluateNode(child, profile, traceEntries, childLogicalPath),
    )

    if (operator === 'all') {
      return childMatches.every(Boolean)
    }

    if (operator === 'any') {
      return childMatches.some(Boolean)
    }

    return childMatches.every((matched) => !matched)
  }

  private evaluateCondition(condition: RuleCondition, actualValue: unknown): boolean {
    switch (condition.op) {
      case 'eq':
        return actualValue === condition.value
      case 'neq':
        return actualValue !== condition.value
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(actualValue as never)
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(actualValue as never)
      case 'gt':
        return typeof actualValue === 'number' && typeof condition.value === 'number'
          ? actualValue > condition.value
          : false
      case 'gte':
        return typeof actualValue === 'number' && typeof condition.value === 'number'
          ? actualValue >= condition.value
          : false
      case 'lt':
        return typeof actualValue === 'number' && typeof condition.value === 'number'
          ? actualValue < condition.value
          : false
      case 'lte':
        return typeof actualValue === 'number' && typeof condition.value === 'number'
          ? actualValue <= condition.value
          : false
      case 'exists':
        return actualValue !== undefined && actualValue !== null && actualValue !== ''
      case 'is_true':
        return actualValue === true
      case 'is_false':
        return actualValue === false
      case 'contains':
        return Array.isArray(actualValue) && actualValue.includes(condition.value as never)
      default: {
        const exhaustiveCheck: never = condition.op
        throw new Error(`Unsupported operator: ${exhaustiveCheck}`)
      }
    }
  }

  private resolveExpectedValue(condition: RuleCondition): RuleTraceEntry['expectedValue'] {
    if (condition.op === 'is_true') {
      return true
    }

    if (condition.op === 'is_false') {
      return false
    }

    return condition.value
  }

  private getLogicalRoot(
    predicate: RulePredicate,
  ): [RuleLogicalOperator, PredicateNode[]] {
    const entries = Object.entries(predicate) as Array<[string, PredicateNode[]]>

    if (entries.length !== 1) {
      throw new Error('Each predicate must contain exactly one logical root')
    }

    const [operator, children] = entries[0]

    if (!RULE_LOGICAL_OPERATORS.includes(operator as RuleLogicalOperator)) {
      throw new Error(`Unsupported logical operator: ${operator}`)
    }

    if (!Array.isArray(children) || children.length === 0) {
      throw new Error(`Predicate root ${operator} must contain at least one child node`)
    }

    return [operator as RuleLogicalOperator, children]
  }

  private isRuleCondition(node: PredicateNode): node is RuleCondition {
    return typeof node === 'object' && node !== null && 'field' in node && 'op' in node
  }
}
