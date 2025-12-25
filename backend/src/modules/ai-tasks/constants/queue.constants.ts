export const AI_TASK_QUEUE = 'ai-tasks'

export enum AITaskJobType {
  PROCESS_TASK = 'process-task',
  RETRY_FAILED = 'retry-failed',
  CLEANUP_OLD = 'cleanup-old',
}
