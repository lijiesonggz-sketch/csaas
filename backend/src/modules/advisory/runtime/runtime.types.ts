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
