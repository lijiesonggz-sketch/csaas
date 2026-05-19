import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import { readAdvisoryMessage, unwrapAdvisoryEnvelope } from './envelope'

export const THINKTANK_WORKFLOW_START_FAILED_MESSAGE =
  '暂时无法启动该 ThinkTank 工作流，请稍后重试或选择其他工作流。'
const EXPECTED_THINKTANK_WORKFLOW_KEYS = [
  'brainstorming',
  'domain-research',
  'market-research',
  'product-brief',
  'prd',
  'problem-solving',
  'design-thinking',
  'storytelling',
] as const

export interface ThinkTankWorkflowCatalogItem {
  key: string
  displayName: string
  canonicalName: string
  scenarioLabel: string
  description?: string
  sourcePath?: string
}

export interface ThinkTankWorkflowCatalogResult {
  workflows: ThinkTankWorkflowCatalogItem[]
}

export interface ThinkTankWorkflowCurrentStep {
  index: number
  label: string
  sourceRef?: string
}

export interface ThinkTankWorkflowLaunchResult {
  sessionId: string
  workflow: ThinkTankWorkflowCatalogItem
  status: 'active'
  sourceRefs: string[]
  firstPrompt: string
  currentStep: ThinkTankWorkflowCurrentStep
}

export async function fetchThinkTankWorkflows(): Promise<ThinkTankWorkflowCatalogResult> {
  const headers = await getAuthHeadersAsync()
  const response = await fetch('/api/advisory/workflows', {
    headers,
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(readAdvisoryMessage(body) ?? '暂时无法加载 ThinkTank 工作流目录，请稍后重试。')
  }

  const data = unwrapAdvisoryEnvelope<Partial<ThinkTankWorkflowCatalogResult>>(body)
  const workflows = Array.isArray(data?.workflows) ? data.workflows.map(normalizeWorkflow) : []

  if (!hasCompleteWorkflowCatalog(workflows)) {
    throw new Error('暂时无法加载 ThinkTank 工作流目录，请稍后重试。')
  }

  return {
    workflows,
  }
}

export async function launchThinkTankWorkflow(
  workflowKey: string
): Promise<ThinkTankWorkflowLaunchResult> {
  const headers = await getAuthHeadersAsync()
  const response = await fetch(
    `/api/advisory/workflows/${encodeURIComponent(workflowKey)}/launch`,
    {
      method: 'POST',
      headers,
      cache: 'no-store',
    }
  )
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(readAdvisoryMessage(body) ?? THINKTANK_WORKFLOW_START_FAILED_MESSAGE)
  }

  const data = unwrapAdvisoryEnvelope<ThinkTankWorkflowLaunchResult>(body)
  if (!data?.sessionId || !data.workflow || !data.firstPrompt || !data.currentStep) {
    throw new Error(THINKTANK_WORKFLOW_START_FAILED_MESSAGE)
  }

  return data
}

function normalizeWorkflow(workflow: ThinkTankWorkflowCatalogItem): ThinkTankWorkflowCatalogItem {
  return {
    key: workflow.key,
    displayName: workflow.displayName,
    canonicalName: workflow.canonicalName || workflow.displayName,
    scenarioLabel: workflow.scenarioLabel,
    description: workflow.description,
    sourcePath: workflow.sourcePath,
  }
}

function hasCompleteWorkflowCatalog(workflows: ThinkTankWorkflowCatalogItem[]): boolean {
  const keys = new Set(workflows.map((workflow) => workflow.key))

  return (
    workflows.length === EXPECTED_THINKTANK_WORKFLOW_KEYS.length &&
    EXPECTED_THINKTANK_WORKFLOW_KEYS.every((key) => keys.has(key))
  )
}
