export enum ThinkTankRuntimeErrorCode {
  FileOutsideApprovedRoot = 'THINKTANK_RUNTIME_FILE_OUTSIDE_APPROVED_ROOT',
  FileNotFound = 'THINKTANK_RUNTIME_FILE_NOT_FOUND',
  FileUnreadable = 'THINKTANK_RUNTIME_FILE_UNREADABLE',
  UnsupportedExtension = 'THINKTANK_RUNTIME_FILE_UNSUPPORTED_EXTENSION',
  EmptyFile = 'THINKTANK_RUNTIME_FILE_EMPTY',
  WorkflowMalformed = 'THINKTANK_RUNTIME_WORKFLOW_MALFORMED',
  WorkflowNotFound = 'THINKTANK_RUNTIME_WORKFLOW_NOT_FOUND',
  InvalidWorkflowKey = 'THINKTANK_RUNTIME_INVALID_WORKFLOW_KEY',
  PartyModeAdvisorSetUnavailable = 'THINKTANK_RUNTIME_PARTY_MODE_ADVISORS_UNAVAILABLE',
}

export class ThinkTankRuntimeError extends Error {
  readonly code: ThinkTankRuntimeErrorCode | string
  readonly sourcePath?: string
  readonly details?: Record<string, unknown>

  constructor(
    code: ThinkTankRuntimeErrorCode | string,
    message: string,
    options: {
      sourcePath?: string
      details?: Record<string, unknown>
      cause?: unknown
    } = {},
  ) {
    super(message)
    this.name = 'ThinkTankRuntimeError'
    this.code = code
    this.sourcePath = options.sourcePath
    this.details = options.details
  }
}
