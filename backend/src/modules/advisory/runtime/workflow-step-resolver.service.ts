import { createHash } from 'node:crypto'
import { basename, dirname, join, normalize } from 'node:path/posix'
import { Injectable } from '@nestjs/common'
import { ThinkTankBrandMapperService } from './brand-mapper.service'
import { ThinkTankRuntimeError, ThinkTankRuntimeErrorCode } from './runtime.errors'
import { ThinkTankRuntimeFileProviderService } from './runtime-file-provider.service'
import {
  ThinkTankRuntimeFileDescriptor,
  ThinkTankWorkflowMetadata,
  ThinkTankWorkflowRuntimePlan,
  ThinkTankWorkflowRuntimeRouteResult,
  ThinkTankWorkflowRuntimeState,
  ThinkTankWorkflowRuntimeStep,
  ThinkTankWorkflowRuntimeStepSnapshot,
} from './runtime.types'

const RUNTIME_STATE_VERSION = 'workflow-step-runner-v1'
const STEP_SOURCE_REF_PREFIX = 'current-step'
const EMBEDDED_STEP_SOURCE_FRAGMENT_PREFIX = '#step-'

interface ParsedStepPath {
  index: number
  suffix: string
  routeKey: string
}

@Injectable()
export class ThinkTankWorkflowStepResolverService {
  constructor(
    private readonly fileProvider: ThinkTankRuntimeFileProviderService,
    private readonly brandMapper: ThinkTankBrandMapperService,
  ) {}

  async resolveWorkflowStepPlan(
    workflow: ThinkTankWorkflowMetadata,
  ): Promise<ThinkTankWorkflowRuntimePlan> {
    const stepSources = await this.resolveStepSources(workflow)
    const steps = await this.loadWorkflowSteps(workflow, stepSources)

    if (steps.length === 0) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.WorkflowMalformed,
        'ThinkTank workflow has no executable runtime steps',
        { sourcePath: workflow.sourcePath },
      )
    }

    const firstStep =
      steps.find((step) => step.sourcePath === workflow.firstPromptSource) ??
      steps.find((step) => step.index === 1) ??
      steps[0]

    return {
      workflowKey: workflow.key,
      steps,
      firstStep,
      sourceRefs: steps.map((step) => step.sourcePath),
    }
  }

  async resolveLaunchState(
    workflow: ThinkTankWorkflowMetadata,
  ): Promise<ThinkTankWorkflowRuntimeState> {
    const plan = await this.resolveWorkflowStepPlan(workflow)

    return this.toRuntimeState(plan, plan.firstStep)
  }

  async resolveCurrentStep(context: {
    workflow: ThinkTankWorkflowMetadata
    currentStep?: ThinkTankWorkflowRuntimeStepSnapshot
    metadata?: Record<string, unknown>
  }): Promise<ThinkTankWorkflowRuntimeState> {
    const plan = await this.resolveWorkflowStepPlan(context.workflow)
    const currentSource = this.readMetadataText(context.metadata?.runtime_current_step_source)
    const currentIndex = this.readMetadataNumber(context.metadata?.runtime_current_step_index)
    const currentRouteKey =
      this.readMetadataText(context.metadata?.runtime_current_step_route_key) ??
      this.readSnapshotRouteKey(context.currentStep?.sourceRef)
    const snapshotIndex = this.readSnapshotIndex(context.currentStep)

    const step =
      (currentSource
        ? plan.steps.find((candidate) => candidate.sourcePath === currentSource)
        : null) ??
      (currentSource ? await this.tryLoadAdHocStep(currentSource, plan.steps.length) : null) ??
      (currentRouteKey
        ? (plan.steps.find((candidate) => candidate.routeKey === currentRouteKey) ?? null)
        : null) ??
      (currentIndex
        ? (plan.steps.find((candidate) => candidate.index === currentIndex) ?? null)
        : null) ??
      (snapshotIndex
        ? (plan.steps.find((candidate) => candidate.index === snapshotIndex) ?? null)
        : null) ??
      plan.firstStep

    return this.toRuntimeState(plan, step)
  }

  async resolveRouteForUserInput(context: {
    workflow: ThinkTankWorkflowMetadata
    currentStep?: ThinkTankWorkflowRuntimeStepSnapshot
    metadata?: Record<string, unknown>
    userInput: string
    decisionAction?: string
  }): Promise<ThinkTankWorkflowRuntimeRouteResult | null> {
    const choice = this.normalizeRouteChoice(context.userInput, context.decisionAction)
    if (!choice) return null

    const currentState = await this.resolveCurrentStep(context)
    if (
      this.isContinueChoice(choice) &&
      this.requiresSpecificContinuationPhrase(currentState.step)
    ) {
      return null
    }

    const explicitTarget = this.findExplicitRoutePath(currentState.step, choice)
    const explicitStep = explicitTarget
      ? await this.findStepBySourcePath(currentState.plan, explicitTarget)
      : null

    if (explicitStep && explicitStep.sourcePath !== currentState.step.sourcePath) {
      return {
        ...this.toRuntimeState(currentState.plan, explicitStep),
        previousStep: currentState.currentStep,
        routeSource: 'explicit',
      }
    }

    if (!this.isContinueChoice(choice)) return null

    const sequentialStep = this.findNextSequentialStep(currentState.plan, currentState.step)
    if (!sequentialStep || sequentialStep.sourcePath === currentState.step.sourcePath) return null

    return {
      ...this.toRuntimeState(currentState.plan, sequentialStep),
      previousStep: currentState.currentStep,
      routeSource: 'sequential',
    }
  }

  private async resolveStepSources(workflow: ThinkTankWorkflowMetadata): Promise<string[]> {
    const workflowDir = dirname(workflow.sourcePath)
    const candidateDirs = new Set<string>()

    if (workflow.firstPromptSource && workflow.firstPromptSource !== workflow.sourcePath) {
      candidateDirs.add(dirname(workflow.firstPromptSource))
    }

    for (const stepDir of ['steps', 'steps-c', 'domain-steps']) {
      candidateDirs.add(join(workflowDir, stepDir))
    }

    const discovered = new Set<string>()
    for (const directory of candidateDirs) {
      const files = await this.fileProvider.listMarkdownFiles(directory)
      for (const file of files) {
        if (/^step-[\w-]+\.md$/i.test(basename(file))) {
          discovered.add(normalize(file))
        }
      }
    }

    if (
      workflow.firstPromptSource &&
      workflow.firstPromptSource !== workflow.sourcePath &&
      !discovered.has(workflow.firstPromptSource)
    ) {
      discovered.add(workflow.firstPromptSource)
    }

    const sortedStepSources = [...discovered].sort((left, right) =>
      this.compareStepSources(left, right),
    )

    if (sortedStepSources.length > 0) {
      return sortedStepSources
    }

    return [workflow.firstPromptSource || workflow.sourcePath]
  }

  private async loadStep(
    sourcePath: string,
    ordinal: number,
  ): Promise<ThinkTankWorkflowRuntimeStep> {
    const descriptor = await this.fileProvider.load(sourcePath)

    return this.toRuntimeStep(descriptor, ordinal)
  }

  private async loadWorkflowSteps(
    workflow: ThinkTankWorkflowMetadata,
    stepSources: string[],
  ): Promise<ThinkTankWorkflowRuntimeStep[]> {
    if (stepSources.length === 1 && stepSources[0] === workflow.sourcePath) {
      const workflowDescriptor = await this.fileProvider.load(workflow.sourcePath)
      const embeddedSteps = this.extractEmbeddedWorkflowSteps(workflowDescriptor)
      if (embeddedSteps.length > 0) return embeddedSteps

      return [this.toRuntimeStep(workflowDescriptor, 0)]
    }

    return Promise.all(stepSources.map((sourcePath, ordinal) => this.loadStep(sourcePath, ordinal)))
  }

  private extractEmbeddedWorkflowSteps(
    descriptor: ThinkTankRuntimeFileDescriptor,
  ): ThinkTankWorkflowRuntimeStep[] {
    const stepPattern = /<step\s+[^>]*\bn\s*=\s*["'](\d+)["'][^>]*>([\s\S]*?)<\/step>/gi
    const steps: ThinkTankWorkflowRuntimeStep[] = []
    let match: RegExpExecArray | null

    while ((match = stepPattern.exec(descriptor.content)) !== null) {
      const index = Number.parseInt(match[1], 10)
      const rawBody = match[2]?.trim()
      if (!Number.isFinite(index) || index <= 0 || !rawBody) continue

      const rawOpeningTag = this.extractOpeningTag(match[0])
      const goal = this.extractEmbeddedStepGoal(rawOpeningTag)
      const rawContent = [`# Step ${index}${goal ? `: ${goal}` : ''}`, '', rawBody].join('\n')
      const mappedContent = this.brandMapper.mapVisibleText(rawContent)
      const label = goal
        ? this.deriveStepLabel(`# Step ${index}: ${this.brandMapper.mapVisibleText(goal)}`, index)
        : this.deriveStepLabel(mappedContent, index)

      steps.push({
        index,
        label,
        sourcePath: `${descriptor.relativePath}${EMBEDDED_STEP_SOURCE_FRAGMENT_PREFIX}${index}`,
        sourceRef: `${STEP_SOURCE_REF_PREFIX}:${index}`,
        routeKey: `${index}`,
        content: mappedContent,
        rawContent,
        contentHash: createHash('sha256').update(rawContent).digest('hex'),
      })
    }

    return steps.sort((left, right) => left.index - right.index)
  }

  private extractOpeningTag(value: string): string {
    return value.match(/^<step\b[^>]*>/i)?.[0] ?? ''
  }

  private extractEmbeddedStepGoal(openingTag: string): string | null {
    return openingTag.match(/\bgoal\s*=\s*["']([^"']+)["']/i)?.[1]?.trim() ?? null
  }

  private toRuntimeStep(
    descriptor: ThinkTankRuntimeFileDescriptor,
    ordinal: number,
  ): ThinkTankWorkflowRuntimeStep {
    const parsed = this.parseStepSource(descriptor.relativePath, ordinal)
    const mappedContent = this.brandMapper.mapVisibleText(descriptor.content)
    const label = this.deriveStepLabel(mappedContent, parsed.index)

    return {
      index: parsed.index,
      label,
      sourcePath: descriptor.relativePath,
      sourceRef: `${STEP_SOURCE_REF_PREFIX}:${parsed.routeKey}`,
      routeKey: parsed.routeKey,
      content: mappedContent,
      rawContent: descriptor.content,
      contentHash: descriptor.contentHash,
    }
  }

  private toRuntimeState(
    plan: ThinkTankWorkflowRuntimePlan,
    step: ThinkTankWorkflowRuntimeStep,
  ): ThinkTankWorkflowRuntimeState {
    return {
      plan,
      step,
      currentStep: this.toStepSnapshot(plan, step),
      metadata: this.toRuntimeMetadata(plan, step),
    }
  }

  private toStepSnapshot(
    plan: ThinkTankWorkflowRuntimePlan,
    step: ThinkTankWorkflowRuntimeStep,
  ): ThinkTankWorkflowRuntimeStepSnapshot {
    const finalStepIndex = Math.max(...plan.steps.map((candidate) => candidate.index))

    return {
      index: step.index,
      label: step.label,
      sourceRef: step.sourceRef,
      totalSteps: finalStepIndex,
      isFinal: step.index >= finalStepIndex,
      isFinalStep: step.index >= finalStepIndex,
    }
  }

  private toRuntimeMetadata(
    plan: ThinkTankWorkflowRuntimePlan,
    step: ThinkTankWorkflowRuntimeStep,
  ): Record<string, string | number | boolean | null> {
    return {
      runtime_state_version: RUNTIME_STATE_VERSION,
      runtime_step_count: plan.steps.length,
      runtime_step_sources: JSON.stringify(plan.steps.map((candidate) => candidate.sourcePath)),
      runtime_current_step_source: step.sourcePath,
      runtime_current_step_index: step.index,
      runtime_current_step_label: step.label,
      runtime_current_step_hash: step.contentHash,
      runtime_current_step_route_key: step.routeKey,
      runtime_current_step_append_on_route: this.shouldAppendStepOnRoute(step),
      runtime_current_step_append_provider_response: this.shouldAppendProviderResponse(plan, step),
    }
  }

  private shouldAppendStepOnRoute(step: ThinkTankWorkflowRuntimeStep): boolean {
    const content = step.rawContent
    if (this.isNoContentCompletionStep(content)) return false

    return (
      /APPEND TO DOCUMENT|Append to document|append (?:the )?(?:final )?content|append .*document/i.test(
        content,
      ) ||
      /Save content to|saved to document|content saved to document|save the current artifact/i.test(
        content,
      ) ||
      /<template-output>/i.test(content) ||
      /stepsCompleted|Update frontmatter/i.test(content)
    )
  }

  private shouldAppendProviderResponse(
    plan: ThinkTankWorkflowRuntimePlan,
    step: ThinkTankWorkflowRuntimeStep,
  ): boolean {
    const finalStepIndex = Math.max(...plan.steps.map((candidate) => candidate.index))
    if (step.index < finalStepIndex) return false
    if (this.isNoContentCompletionStep(step.rawContent)) return false

    return (
      /Generate final output|final output|final comprehensive|final synthesis/i.test(
        step.rawContent,
      ) ||
      /complete .*document|comprehensive .*document|<template-output>/i.test(step.rawContent) ||
      /APPEND TO DOCUMENT|append (?:the )?(?:final )?content/i.test(step.rawContent)
    )
  }

  private isNoContentCompletionStep(content: string): boolean {
    return /NO content generation|FORBIDDEN to generate new content|no new content generation/i.test(
      content,
    )
  }

  private deriveStepLabel(content: string, stepIndex: number): string {
    const heading = content.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim()
    const label = heading && !this.isUnsafeLabel(heading) ? heading : `Step ${stepIndex}`

    return label.length > 120 ? `${label.slice(0, 117).trim()}...` : label
  }

  private isUnsafeLabel(value: string): boolean {
    return /(_bmad|source|prompt|file|folder|[\\/])/i.test(value)
  }

  private parseStepSource(sourcePath: string, ordinal: number): ParsedStepPath {
    const fileName = basename(sourcePath)
    const match = fileName.match(/^step-(\d+)([a-z]?)(?:-|\.|$)/i)
    if (!match) {
      return {
        index: ordinal + 1,
        suffix: '',
        routeKey: `${ordinal + 1}`,
      }
    }

    const index = Number.parseInt(match[1], 10)
    const suffix = (match[2] ?? '').toLowerCase()

    return {
      index,
      suffix,
      routeKey: `${index}${suffix}`,
    }
  }

  private compareStepSources(left: string, right: string): number {
    const leftParsed = this.parseStepSource(left, 0)
    const rightParsed = this.parseStepSource(right, 0)

    if (leftParsed.index !== rightParsed.index) {
      return leftParsed.index - rightParsed.index
    }

    const suffixComparison = leftParsed.suffix.localeCompare(rightParsed.suffix)
    if (suffixComparison !== 0) return suffixComparison

    return left.localeCompare(right)
  }

  private normalizeRouteChoice(userInput: string, decisionAction?: string): string | null {
    const action = this.normalizeChoiceToken(decisionAction)
    if (action === 'continue') return 'continue'
    if (action === 'deepen' || action === 'revise' || action === 'party-mode') return null
    if (action) return action

    const text = this.normalizeChoiceToken(userInput)
    if (!text) return null

    if (/^\[?[0-9a-z]\]?$/i.test(text)) {
      return text.replace(/[\[\]]/g, '').toLowerCase()
    }

    if (['continue', 'next', 'yes', 'ok', 'okay', 'confirm'].includes(text)) {
      return 'continue'
    }

    if (['继续', '下一步', '可以', '确认', '是', '好的', '开始'].includes(text)) {
      return 'continue'
    }

    if (
      /\b(?:move\s+to\s+organization|organize|organisation|organization)\b/i.test(text) ||
      /组织|整理/.test(text)
    ) {
      return 'organization'
    }

    if (['back', 'return', '返回', '上一步'].includes(text)) {
      return 'b'
    }

    if (['modify', 'details', 'categories'].includes(text)) {
      return text
    }

    return null
  }

  private normalizeChoiceToken(value?: string): string | null {
    if (typeof value !== 'string') return null
    const normalized = value.trim().toLowerCase()
    if (!normalized) return null

    return normalized
  }

  private findExplicitRoutePath(
    currentStep: ThinkTankWorkflowRuntimeStep,
    choice: string,
  ): string | null {
    const routePattern =
      /\b(?:Load|load|Route to|route to|Return to|return to|follow)\b\s*:?\s*`?([^`\r\n]+?\.md)`?/g
    const aliases = this.routeChoiceAliases(choice)
    let match: RegExpExecArray | null

    while ((match = routePattern.exec(currentStep.rawContent)) !== null) {
      const reference = match[1]?.trim()
      if (!reference) continue

      const precedingContext = this.extractRouteDecisionContext(currentStep.rawContent, match.index)
      if (!this.contextMatchesRouteChoice(precedingContext, aliases, choice)) continue

      return this.resolveStepReference(currentStep.sourcePath, reference)
    }

    return null
  }

  private extractRouteDecisionContext(content: string, routeIndex: number): string {
    const beforeRoute = content.slice(0, routeIndex)
    const markers = [
      '\n#### If',
      '\n### If',
      '\n#### When',
      '\n### When',
      '\n- If',
      '\n**If',
      '\nAfter user selects',
      '\nONLY WHEN',
      '\n#### Menu Handling Logic',
    ]
    const markerIndex = Math.max(...markers.map((marker) => beforeRoute.lastIndexOf(marker)))

    if (markerIndex >= 0) {
      return beforeRoute.slice(markerIndex)
    }

    return beforeRoute.slice(Math.max(0, beforeRoute.length - 300))
  }

  private routeChoiceAliases(choice: string): string[] {
    if (this.isContinueChoice(choice)) {
      return ['c']
    }

    if (choice === 'b') {
      return ['b', 'back', 'return']
    }

    if (choice === 'organization') {
      return ['c', 'organization', 'organize']
    }

    return [choice]
  }

  private contextMatchesRouteChoice(context: string, aliases: string[], choice: string): boolean {
    if (this.isContinueChoice(choice)) {
      if (/\[\s*c\s*\]|['"]\s*c\s*['"]|\bif\s+c\b|\bselects?\s+['"]?c['"]?/i.test(context)) {
        return true
      }

      return (
        /\b(confirm|confirms|confirmed|confirmation)\b/i.test(context) &&
        !/\[\s*(?:\d+|[abd-z])\s*\]/i.test(context)
      )
    }

    for (const alias of aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const patterns = [
        new RegExp(`\\[\\s*${escaped}\\s*\\]`, 'i'),
        new RegExp(`['"]\\s*${escaped}\\s*['"]`, 'i'),
        new RegExp(`\\*\\*\\[\\s*${escaped}\\s*\\]\\*\\*`, 'i'),
        new RegExp(`\\bselects?\\s+\\*\\*\\[\\s*${escaped}\\s*\\]\\*\\*`, 'i'),
        new RegExp(`\\bif\\s+${escaped}\\b`, 'i'),
      ]

      if (patterns.some((pattern) => pattern.test(context))) return true
    }

    return false
  }

  private resolveStepReference(currentSourcePath: string, reference: string): string {
    const cleaned = reference.trim()
    if (cleaned.startsWith('_bmad/')) {
      return normalize(cleaned)
    }

    return normalize(join(dirname(currentSourcePath), cleaned))
  }

  private async findStepBySourcePath(
    plan: ThinkTankWorkflowRuntimePlan,
    sourcePath: string,
  ): Promise<ThinkTankWorkflowRuntimeStep | null> {
    const normalized = normalize(sourcePath)
    const existing = plan.steps.find((step) => step.sourcePath === normalized)
    if (existing) return existing

    return this.tryLoadAdHocStep(normalized, plan.steps.length)
  }

  private async tryLoadAdHocStep(
    sourcePath: string,
    ordinal: number,
  ): Promise<ThinkTankWorkflowRuntimeStep | null> {
    try {
      return await this.loadStep(sourcePath, ordinal)
    } catch (error) {
      if (
        error instanceof ThinkTankRuntimeError &&
        error.code === ThinkTankRuntimeErrorCode.FileNotFound
      ) {
        return null
      }

      throw error
    }
  }

  private findNextSequentialStep(
    plan: ThinkTankWorkflowRuntimePlan,
    currentStep: ThinkTankWorkflowRuntimeStep,
  ): ThinkTankWorkflowRuntimeStep | null {
    const candidates = plan.steps.filter(
      (step) =>
        step.index > currentStep.index &&
        step.sourcePath !== currentStep.sourcePath &&
        !this.isContinuationOnlyStep(step),
    )
    const nextIndex = Math.min(...candidates.map((step) => step.index))
    if (!Number.isFinite(nextIndex)) return null

    const nextCandidates = candidates.filter((step) => step.index === nextIndex)
    return nextCandidates.length === 1 ? nextCandidates[0] : null
  }

  private isContinuationOnlyStep(step: ThinkTankWorkflowRuntimeStep): boolean {
    return /^1[a-z]+$/.test(step.routeKey) && /continue/i.test(step.sourcePath)
  }

  private requiresSpecificContinuationPhrase(step: ThinkTankWorkflowRuntimeStep): boolean {
    return (
      /bmad-brainstorming\/steps\/step-03-technique-execution\.md$/i.test(step.sourcePath) ||
      (/DEFAULT IS TO KEEP EXPLORING/i.test(step.rawContent) &&
        /Move to organization/i.test(step.rawContent))
    )
  }

  private isContinueChoice(choice: string): boolean {
    return choice === 'continue' || choice === 'c'
  }

  private readMetadataText(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
  }

  private readMetadataNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
      const parsed = Number.parseInt(value.trim(), 10)
      return parsed > 0 ? parsed : null
    }

    return null
  }

  private readSnapshotRouteKey(value: unknown): string | null {
    const sourceRef = this.readMetadataText(value)
    if (!sourceRef) return null

    const match = sourceRef.match(/^current-step:([0-9]+[a-z]?)$/i)
    return match?.[1]?.toLowerCase() ?? null
  }

  private readSnapshotIndex(currentStep?: ThinkTankWorkflowRuntimeStepSnapshot): number | null {
    return typeof currentStep?.index === 'number' &&
      Number.isFinite(currentStep.index) &&
      currentStep.index > 0
      ? currentStep.index
      : null
  }
}
