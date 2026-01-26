# Data Models - Backend

## Overview
This document describes the database schema and data models for the Csaas backend service.

**Database:** PostgreSQL
**ORM:** TypeORM 0.3.20
**Migration Strategy:** TypeORM migrations

---

## Entity Relationship Diagram

```
User (1) ──────< (N) Project
                      │
                      ├──< (N) AITask
                      │         │
                      │         ├──< (N) AIGenerationEvent
                      │         └──< (N) AICostTracking
                      │
                      ├──< (N) ProjectMember
                      ├──< (N) StandardDocument
                      └──< (N) CurrentStateDescription

AITask (1) ──────< (N) SurveyResponse
```

---

## Core Entities

### 1. User (`users`)
User accounts with role-based access.

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `email` (VARCHAR, UNIQUE) - User email address
- `password_hash` (VARCHAR) - Hashed password
- `role` (ENUM) - User role: `CONSULTANT`, `CLIENT_PM`, `RESPONDENT`
- `name` (VARCHAR, nullable) - Display name
- `tenant_id` (VARCHAR, nullable) - Multi-tenancy support
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp
- `deleted_at` (TIMESTAMP, nullable) - Soft delete timestamp

**Relationships:**
- One-to-Many with `Project` (as owner)

**Indexes:**
- Unique index on `email`

---

### 2. Project (`projects`)
Consulting project workspace.

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `name` (VARCHAR) - Project name
- `description` (TEXT, nullable) - Project description
- `client_name` (VARCHAR, nullable) - Client company name
- `standard_name` (VARCHAR, nullable) - Target standard name
- `tenant_id` (VARCHAR, nullable) - Multi-tenancy support
- `owner_id` (UUID, FK → users.id) - Project owner
- `status` (ENUM) - Project status: `DRAFT`, `ACTIVE`, `COMPLETED`, `ARCHIVED`
- `metadata` (JSONB, nullable) - Additional metadata
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp
- `deleted_at` (TIMESTAMP, nullable) - Soft delete timestamp

**Relationships:**
- Many-to-One with `User` (owner)
- One-to-Many with `AITask`
- One-to-Many with `ProjectMember`
- One-to-Many with `StandardDocument`
- One-to-Many with `CurrentStateDescription`

---

### 3. ProjectMember (`project_members`)
Project access control and collaboration.

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `project_id` (UUID, FK → projects.id) - Project reference
- `user_id` (UUID, FK → users.id) - User reference
- `role` (VARCHAR) - Member role: `OWNER`, `EDITOR`, `VIEWER`
- `added_at` (TIMESTAMP) - When member was added
- `added_by` (VARCHAR, nullable) - Who added this member

**Relationships:**
- Many-to-One with `Project` (CASCADE delete)
- Many-to-One with `User`

---

### 4. AITask (`ai_tasks`)
AI generation task tracking and orchestration.

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `project_id` (UUID, FK → projects.id) - Project reference
- `type` (ENUM) - Task type:
  - `SUMMARY` - 综述生成
  - `CLUSTERING` - 聚类分析
  - `MATRIX` - 矩阵生成
  - `QUESTIONNAIRE` - 问卷生成
  - `ACTION_PLAN` - 落地措施
  - `STANDARD_INTERPRETATION` - 标准解读
  - `STANDARD_RELATED_SEARCH` - 关联标准搜索
  - `STANDARD_VERSION_COMPARE` - 标准版本比对
  - `BINARY_QUESTIONNAIRE` - 判断题问卷
  - `BINARY_GAP_ANALYSIS` - 判断题差距分析
  - `QUICK_GAP_ANALYSIS` - 超简版差距分析
- `status` (ENUM) - Task status:
  - `PENDING` - Waiting to start
  - `PROCESSING` - In progress
  - `COMPLETED` - Successfully completed
  - `FAILED` - Failed with error
  - `MANUAL_MODE` - Level 4 degradation
  - `LOW_CONFIDENCE` - Level 3 degradation
- `generation_stage` (ENUM) - Generation pipeline stage:
  - `PENDING` - Not started
  - `GENERATING_MODELS` - AI models generating
  - `QUALITY_VALIDATION` - Quality validation in progress
  - `AGGREGATING` - Aggregating results
  - `COMPLETED` - Finished
  - `FAILED` - Failed
- `progress_details` (JSONB, nullable) - Detailed progress tracking:
  ```json
  {
    "gpt4": { "status": "completed", "tokens": 1500, "cost": 0.05 },
    "claude": { "status": "generating", "started_at": "..." },
    "domestic": { "status": "pending" },
    "validation_stage": "validating",
    "aggregation_stage": "pending",
    "current_model": "claude",
    "total_elapsed_ms": 45000
  }
  ```
- `cluster_generation_status` (JSONB, nullable) - Clustering task resume state:
  ```json
  {
    "totalClusters": 10,
    "completedClusters": ["cluster-1", "cluster-2"],
    "failedClusters": [],
    "pendingClusters": ["cluster-3", "cluster-4"],
    "clusterProgress": {
      "cluster-1": {
        "status": "completed",
        "questionsGenerated": 5,
        "questionsExpected": 5
      }
    }
  }
  ```
- `priority` (INTEGER, default: 1) - Task priority
- `input` (JSONB) - Task input parameters
- `result` (JSONB, nullable) - Task output result
- `backup_result` (JSONB, nullable) - Backup of previous result
- `backup_created_at` (TIMESTAMP, nullable) - Backup timestamp
- `progress` (FLOAT, default: 0) - Overall progress (0-100)
- `error_message` (TEXT, nullable) - Error details if failed
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp
- `completed_at` (TIMESTAMP, nullable) - Completion timestamp

**Relationships:**
- Many-to-One with `Project`
- One-to-Many with `AIGenerationEvent`
- One-to-Many with `AICostTracking`
- One-to-Many with `SurveyResponse`

**Indexes:**
- Index on `project_id`
- Index on `status`
- Index on `type`

---

### 5. AIGenerationEvent (`ai_generation_events`)
Audit log for AI model invocations.

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `task_id` (UUID, FK → ai_tasks.id) - Task reference
- `model` (ENUM) - AI model used: `GPT4`, `CLAUDE`, `DOMESTIC`
- `input` (JSONB) - Model input
- `output` (JSONB, nullable) - Model output
- `metadata` (JSONB, nullable) - Additional metadata
- `error_message` (TEXT, nullable) - Error if failed
- `execution_time_ms` (INTEGER, nullable) - Execution duration
- `created_at` (TIMESTAMP) - Event timestamp

**Relationships:**
- Many-to-One with `AITask`

---

### 6. AICostTracking (`ai_cost_tracking`)
AI usage cost tracking and billing.

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `task_id` (UUID, FK → ai_tasks.id) - Task reference
- `model` (ENUM) - AI model: `GPT4`, `CLAUDE`, `DOMESTIC`
- `tokens` (INTEGER) - Token count
- `cost` (DECIMAL(10,2)) - Cost in currency units
- `created_at` (TIMESTAMP) - Cost record timestamp

**Relationships:**
- Many-to-One with `AITask`

**Aggregations:**
- Cost per project
- Cost per task type
- Cost per model
- Cost over time

---

### 7. SurveyResponse (`survey_responses`)
Questionnaire responses from enterprise users.

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `questionnaire_task_id` (UUID, FK → ai_tasks.id) - Questionnaire task reference
- `respondent_name` (VARCHAR(100)) - Respondent name
- `respondent_email` (VARCHAR(200), nullable) - Respondent email
- `respondent_department` (VARCHAR(200), nullable) - Department
- `respondent_position` (VARCHAR(100), nullable) - Job position
- `status` (ENUM) - Survey status:
  - `DRAFT` - Not submitted
  - `SUBMITTED` - Submitted
  - `COMPLETED` - Action plan generated
- `answers` (JSONB) - All responses:
  ```json
  {
    "Q001": { "answer": "A", "score": 3 },
    "Q002": { "answer": ["A", "C"], "score": 4 }
  }
  ```
- `progress_percentage` (INTEGER, default: 0) - Completion progress (0-100)
- `total_score` (FLOAT, nullable) - Total score
- `max_score` (FLOAT, nullable) - Maximum possible score
- `started_at` (TIMESTAMP, nullable) - When survey was started
- `submitted_at` (TIMESTAMP, nullable) - When survey was submitted
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp
- `notes` (TEXT, nullable) - Additional notes

**Relationships:**
- Many-to-One with `AITask` (questionnaire task)

---

### 8. StandardDocument (`standard_documents`)
Standard document storage and management.

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `name` (VARCHAR) - Standard name (e.g., "GB/T 22239-2019")
- `content` (TEXT) - Full text content
- `metadata` (JSONB, nullable) - Standard metadata:
  ```json
  {
    "standard_code": "GB/T 22239-2019",
    "version": "2019",
    "publish_date": "2019-05-10",
    "category": "国家标准"
  }
  ```
- `project_id` (UUID, FK → projects.id, nullable) - Optional project association
- `created_at` (TIMESTAMP) - Upload timestamp

**Relationships:**
- Many-to-One with `Project` (optional)

---

### 9. CurrentStateDescription (`current_state_descriptions`)
Enterprise current state documentation.

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `project_id` (UUID, FK → projects.id) - Project reference
- `description` (TEXT) - Current state description (min 500 chars)
- `source` (ENUM, nullable) - Input source:
  - `MANUAL_INPUT` - Manually entered
  - `DOC_UPLOAD` - Extracted from document
- `metadata` (JSONB, nullable) - Additional metadata:
  ```json
  {
    "word_count": 1500,
    "extracted_keywords": ["security", "compliance"]
  }
  ```
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

**Relationships:**
- Many-to-One with `Project`

---

### 10. ActionPlanMeasure (`action_plan_measures`)
Action plan implementation measures.

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `survey_id` (UUID, FK → survey_responses.id) - Survey reference
- `cluster_id` (VARCHAR) - Cluster identifier
- `cluster_name` (VARCHAR) - Cluster name
- `priority` (VARCHAR) - Priority level
- `measures` (JSONB) - Implementation measures array
- `created_at` (TIMESTAMP) - Creation timestamp

**Relationships:**
- Many-to-One with `SurveyResponse`

---

## Additional Entities

### 11. SystemUser (`system_users`)
System-level administrative users.

### 12. AuditLog (`audit_logs`)
System audit trail for compliance.

### 13. InterpretationResult (`interpretation_results`)
Standard interpretation analysis results.

### 14. AIGenerationResult (`ai_generation_results`)
Deprecated - replaced by `AITask.result` field.

---

## Database Migrations

**Migration Files:** `backend/src/database/migrations/`

**Key Migrations:**
1. `1735097000000-InitialSchema.ts` - Initial database schema
2. `1766633092012-UpdateAITaskEntity.ts` - Enhanced AI task tracking
3. `1767291591745-AddTaskProgressFields.ts` - Added progress tracking
4. `1767797000000-AddClusterGenerationStatusColumn.ts` - Clustering resume support

**Running Migrations:**
```bash
npm run migration:run
```

**Generating Migrations:**
```bash
npm run migration:generate -- -n MigrationName
```

---

## Indexes and Performance

**Critical Indexes:**
- `users.email` (UNIQUE)
- `ai_tasks.project_id`
- `ai_tasks.status`
- `ai_tasks.type`
- `project_members.project_id`
- `project_members.user_id`

**JSONB Indexes:**
Consider adding GIN indexes for JSONB columns with frequent queries:
```sql
CREATE INDEX idx_ai_tasks_result ON ai_tasks USING GIN (result);
CREATE INDEX idx_ai_tasks_progress_details ON ai_tasks USING GIN (progress_details);
```

---

## Data Retention

**Soft Deletes:**
- `User` - Uses `deleted_at` column
- `Project` - Uses `deleted_at` column

**Hard Deletes:**
- `AITask` - Cascade deletes related events and costs
- `ProjectMember` - Cascade delete on project removal

---

## Backup Strategy

**Recommended:**
1. Daily PostgreSQL dumps
2. Point-in-time recovery (PITR) enabled
3. Backup retention: 30 days
4. Test restore procedures monthly

---

## Security Considerations

1. **Password Storage:** Bcrypt hashing with salt
2. **Sensitive Data:** Consider encrypting `StandardDocument.content`
3. **API Keys:** Store in environment variables, not database
4. **Audit Trail:** `AIGenerationEvent` provides full audit log
5. **Multi-tenancy:** `tenant_id` field for data isolation

---

## Future Enhancements

1. **Partitioning:** Consider partitioning `ai_generation_events` by date
2. **Archiving:** Move completed tasks older than 6 months to archive tables
3. **Caching:** Redis cache for frequently accessed projects and tasks
4. **Read Replicas:** For analytics and reporting queries
