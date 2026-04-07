import { join } from 'path'

export const KG_CASE_IMPORT_QUEUE = 'kg-case-import'
export const KG_CASE_IMPORT_PARSE_JOB_NAME = 'xlsx-parse'
export const KG_CASE_IMPORT_EXTRACT_JOB_NAME = 'ai-extract'
export const KG_CASE_IMPORT_CLUSTER_JOB_NAME = 'ai-cluster'
export const KG_CASE_IMPORT_UPLOAD_DIR = join(process.cwd(), '.tmp', 'case-imports')
export const KG_CASE_IMPORT_MAX_FILE_SIZE = 20 * 1024 * 1024
export const KG_CASE_IMPORT_ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'] as const
