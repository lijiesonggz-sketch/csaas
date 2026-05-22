export type ThinkTankRuntimeFileExtension = '.md' | '.yaml' | '.yml' | '.csv'

export interface ThinkTankRuntimeFileDescriptor {
  relativePath: string
  absolutePath: string
  content: string
  contentHash: string
  extension: ThinkTankRuntimeFileExtension
  modifiedAt: Date
}

export interface ThinkTankRuntimeFileProviderOptions {
  repoRoot?: string
  approvedRoots?: string[]
  supportedExtensions?: ThinkTankRuntimeFileExtension[]
}

export interface ThinkTankWorkflowSourceConfig {
  key?: string
  displayName?: string
  scenarioLabel?: string
  sourcePath: string
  firstPromptSource?: string
  description?: string
  methodLibraryPaths?: string[]
  agentSourcePaths?: string[]
}

export interface ThinkTankWorkflowRegistryOptions {
  workflowSources?: ThinkTankWorkflowSourceConfig[]
  workflowSourcePaths?: string[]
  manifestPaths?: string[]
}

export interface ThinkTankWorkflowMetadata {
  key: string
  displayName: string
  scenarioLabel: string
  sourcePath: string
  supportedFileType: ThinkTankRuntimeFileExtension
  firstPromptSource: string
  methodLibraryPaths: string[]
  agentSourcePaths: string[]
  description?: string
}

export interface ThinkTankParsedWorkflowDefinition {
  title: string
  description?: string
  firstPromptSource: string
}

export interface ThinkTankParsedMethodLibrary {
  headers: string[]
  rowCount: number
  rows: Record<string, string>[]
}

export type ThinkTankPromptSourceDescriptor = Omit<ThinkTankRuntimeFileDescriptor, 'absolutePath'>

export interface ThinkTankPromptAssemblyRequest {
  workflowKey: string
  includeMethodLibraries?: boolean
  includeAgentSources?: boolean
}

export interface ThinkTankAssembledPrompt {
  workflow: ThinkTankWorkflowMetadata
  visiblePrompt: string
  sourceRefs: string[]
  sources: ThinkTankPromptSourceDescriptor[]
}

export interface ThinkTankPartyModeAdvisorSelectionRequest {
  workflowKey: string
  currentStepLabel?: string
  currentStepSourceRef?: string | null
  latestUserMessage?: string
  targetCount?: number
  minimumCount?: number
}

export interface ThinkTankPartyModeAdvisorPersona {
  id: string
  displayName: string
  role: string
  identity: string
  communicationStyle: string
  principles: string
  capabilities: string[]
  module: string
  sourcePath: string
  sourceHash: string
  perspective: string
  roleFamily: string
  selectionReason: string
}

export interface ThinkTankPartyModeAdvisorOmission {
  id: string
  displayName: string
  reason: string
  sourcePath?: string
}

export interface ThinkTankPartyModeAdvisorSelection {
  advisors: ThinkTankPartyModeAdvisorPersona[]
  omittedAdvisors: ThinkTankPartyModeAdvisorOmission[]
  visibleSummary: string
  metadata: Record<string, string | number | boolean | null>
}
