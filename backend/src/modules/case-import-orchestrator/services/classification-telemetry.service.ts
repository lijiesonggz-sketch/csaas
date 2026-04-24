import { Injectable } from '@nestjs/common'
import type {
  ComplianceCaseClassificationRunFallbackReason,
  ComplianceCaseClassificationRunStatus,
} from '../../../database/entities/compliance-case-classification-run.entity'
import type { ComplianceCaseClassificationSource } from '../../../database/entities/compliance-case.entity'

export type ClassificationTelemetryEvent = {
  caseId: string
  batchId: string | null
  l1Code: string | null
  l2Code: string | null
  classificationSource: ComplianceCaseClassificationSource | null
  classificationVersion: string | null
  fallbackReason: ComplianceCaseClassificationRunFallbackReason | null
  classificationStatus: ComplianceCaseClassificationRunStatus
  pathDecision: string
}

@Injectable()
export class ClassificationTelemetryService {
  async publishLatestSnapshotWritten(
    _event: ClassificationTelemetryEvent,
  ): Promise<void> {
    // 6.3 只建立独立职责边界；具体 telemetry sink 由后续 story 扩展。
  }
}
