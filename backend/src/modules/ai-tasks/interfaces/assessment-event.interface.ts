/**
 * Assessment Completed Event Interface
 *
 * Emitted when a Csaas maturity assessment is completed
 * Triggers weakness identification and snapshot creation
 */
export interface AssessmentCompletedEvent {
  projectId: string
  organizationId: string
  assessmentResult: {
    categories: Array<{
      name: string
      level: number
      description?: string
    }>
    completedAt: Date
  }
}
