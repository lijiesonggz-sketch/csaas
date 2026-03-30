import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

export const REPORT_PDF_JOB_STATUSES = ['queued', 'rendering', 'ready', 'failed'] as const
export type ReportPdfJobStatus = (typeof REPORT_PDF_JOB_STATUSES)[number]

@Entity('report_pdf_jobs')
@Index('IDX_report_pdf_jobs_org_report_created', ['organizationId', 'reportId', 'createdAt'])
@Index('IDX_report_pdf_jobs_expires_at', ['expiresAt'])
export class ReportPdfJob {
  @PrimaryGeneratedColumn('uuid', { name: 'pdf_job_id' })
  pdfJobId: string

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string

  @Column({ name: 'report_id', type: 'uuid' })
  reportId: string

  @Column({ name: 'requested_by_user_id', type: 'uuid', nullable: true })
  requestedByUserId: string | null

  @Column({ type: 'varchar', length: 20, default: 'queued' })
  status: ReportPdfJobStatus

  @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true })
  fileName: string | null

  @Column({ name: 'file_path', type: 'varchar', length: 500, nullable: true })
  filePath: string | null

  @Column({ name: 'file_size_bytes', type: 'int', nullable: true })
  fileSizeBytes: number | null

  @Column({ name: 'error_summary', type: 'varchar', length: 500, nullable: true })
  errorSummary: string | null

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null

  @Column({ name: 'failed_at', type: 'timestamp', nullable: true })
  failedAt: Date | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
