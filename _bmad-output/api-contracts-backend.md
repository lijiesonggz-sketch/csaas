# API Contracts - Backend

## Overview
This document describes all REST API endpoints exposed by the Csaas backend service.

**Base URL:** `http://localhost:3000/api`

**Authentication:** Currently using header-based user identification (`x-user-id`). JWT authentication is planned.

---

## 1. Authentication (`/auth`)

### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "string",
  "password": "string",
  "username": "string"
}
```

**Response:** User object (without password hash)

### POST /auth/login
Authenticate user and login.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "user": { /* user object */ },
  "message": "Login successful"
}
```

---

## 2. Projects (`/projects`)

### POST /projects
Create a new project.

**Headers:** `x-user-id: string`

**Request Body:**
```json
{
  "name": "string",
  "description": "string"
}
```

**Response:** Project object

### GET /projects
Get all projects accessible to the current user.

**Headers:** `x-user-id: string`

**Response:** Array of project objects

### GET /projects/:id
Get project details by ID.

**Response:** Project object with members and tasks

### PATCH /projects/:id
Update project information.

**Request Body:**
```json
{
  "name": "string (optional)",
  "description": "string (optional)"
}
```

### DELETE /projects/:id
Delete a project.

**Response:** 204 No Content

### POST /projects/:projectId/members
Add a member to the project.

**Request Body:**
```json
{
  "userId": "string",
  "role": "OWNER | ADMIN | MEMBER | VIEWER"
}
```

### PATCH /projects/:projectId/members/:memberId
Update project member role.

**Request Body:**
```json
{
  "role": "OWNER | ADMIN | MEMBER | VIEWER"
}
```

### DELETE /projects/:projectId/members/:memberId
Remove a member from the project.

### POST /projects/:projectId/tasks/rerun
Rerun a specific task.

**Request Body:**
```json
{
  "taskId": "string",
  "taskType": "STANDARD_INTERPRETATION | CLUSTERING | QUESTIONNAIRE | MATRIX | ACTION_PLAN"
}
```

### POST /projects/:projectId/tasks/rollback
Rollback to a previous task state.

**Request Body:**
```json
{
  "taskId": "string",
  "targetVersion": "number"
}
```

---

## 3. AI Tasks (`/ai-tasks`)

### POST /ai-tasks
Create a new AI task.

**Request Body:**
```json
{
  "projectId": "string",
  "type": "STANDARD_INTERPRETATION | CLUSTERING | QUESTIONNAIRE | MATRIX | ACTION_PLAN",
  "input": { /* task-specific input */ }
}
```

**Response:** Task object

### GET /ai-tasks/:id
Get task details by ID.

**Response:** Task object with full details

### GET /ai-tasks/:id/status
Get task status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "PENDING | IN_PROGRESS | COMPLETED | FAILED",
    "progress": "number (0-100)"
  }
}
```

### GET /ai-tasks/project/:projectId
Get all tasks for a project.

**Response:** Array of task objects

### POST /ai-tasks/:id/retry
Retry a failed task.

**Response:** Success message

### GET /ai-tasks/queue/stats
Get BullMQ queue statistics.

**Response:** Queue stats object

### GET /ai-tasks/websocket/stats
Get WebSocket subscription statistics.

**Response:** WebSocket stats object

### GET /ai-tasks/cost/project/:projectId
Get cost statistics for a project.

**Response:** Cost breakdown by task type and model

### GET /ai-tasks/cost/task/:taskId
Get cost statistics for a specific task.

**Response:** Detailed cost information

### GET /ai-tasks/cost/overview
Get cost overview for all projects.

**Response:** Aggregated cost statistics

---

## 4. AI Generation (`/ai-generation`)

### POST /ai-generation/summary
Generate summary from standard document.

**Request Body:**
```json
{
  "taskId": "string",
  "standardDocument": "string (min 100 chars)",
  "temperature": "number (optional)",
  "maxTokens": "number (optional)"
}
```

### POST /ai-generation/clustering
Generate clustering from multiple documents.

**Request Body:**
```json
{
  "taskId": "string",
  "documents": [
    {
      "id": "string",
      "name": "string",
      "content": "string (min 100 chars)"
    }
  ],
  "projectId": "string (optional)",
  "temperature": "number (optional)",
  "maxTokens": "number (optional)"
}
```

### POST /ai-generation/matrix
Generate maturity matrix from clustering result.

**Request Body:**
```json
{
  "taskId": "string",
  "clusteringResult": { /* clustering output */ },
  "clusteringTaskId": "string (optional)",
  "temperature": "number (optional)",
  "maxTokens": "number (optional)"
}
```

### POST /ai-generation/questionnaire
Generate questionnaire from matrix.

**Request Body:**
```json
{
  "taskId": "string",
  "matrixResult": { /* matrix output */ },
  "matrixTaskId": "string (optional)"
}
```

### POST /ai-generation/action-plan
Generate action plan from survey responses.

**Request Body:**
```json
{
  "taskId": "string",
  "surveyId": "string",
  "matrixTaskId": "string"
}
```

### GET /ai-generation/task/:taskId/result
Get generation result for a task.

**Response:** Task result object

### PATCH /ai-generation/task/:taskId/result
Update task result (for manual edits).

**Request Body:**
```json
{
  "result": { /* updated result object */ }
}
```

---

## 5. Survey (`/survey`)

### POST /survey
Create a new survey response record.

**Request Body:**
```json
{
  "questionnaireTaskId": "string",
  "projectId": "string"
}
```

**Response:** Survey object

### PUT /survey/:id/draft
Save survey draft.

**Request Body:**
```json
{
  "responses": { /* question responses */ }
}
```

### POST /survey/:id/submit
Submit completed survey.

**Request Body:**
```json
{
  "responses": { /* question responses */ }
}
```

### GET /survey/:id
Get survey by ID.

**Response:** Survey object with responses

### GET /survey/by-questionnaire/:questionnaireTaskId
Get all surveys for a questionnaire task.

**Response:** Array of survey objects

### DELETE /survey/:id
Delete a survey.

**Response:** 204 No Content

### POST /survey/:id/analyze-maturity
Analyze maturity from survey responses.

**Response:** Maturity analysis result

### POST /survey/:id/generate-action-plan
Generate action plan from survey.

**Response:** Action plan result

### POST /survey/upload-and-analyze
Upload document and analyze for quick gap analysis.

**Request Body:**
```json
{
  "projectId": "string",
  "documentText": "string",
  "standardDocuments": [ /* array of standard docs */ ]
}
```

---

## 6. Current State (`/projects/:projectId/current-state`)

### POST /projects/:projectId/current-state
Create current state description for a project.

**Request Body:**
```json
{
  "description": "string (min 500 chars)",
  "source": "MANUAL_INPUT | DOC_UPLOAD (optional)",
  "metadata": {
    "word_count": "number (optional)",
    "extracted_keywords": ["string"] (optional)
  }
}
```

### GET /projects/:projectId/current-state
Get all current state descriptions for a project.

**Response:** Array of current state objects

### GET /projects/:projectId/current-state/:id
Get specific current state by ID.

**Response:** Current state object

### PUT /projects/:projectId/current-state/:id
Update current state description.

**Request Body:**
```json
{
  "description": "string (min 500 chars, optional)",
  "metadata": { /* optional */ }
}
```

### DELETE /projects/:projectId/current-state/:id
Delete current state description.

**Response:** 204 No Content

---

## 7. Files (`/files`)

### POST /files/parse-pdf
Parse PDF file and extract text content.

**Content-Type:** `multipart/form-data`

**Request Body:**
- `file`: PDF file (max 10MB)

**Response:**
```json
{
  "success": true,
  "data": {
    "text": "string",
    "filename": "string",
    "size": "number"
  }
}
```

---

## 8. Health Check (`/health`)

### GET /health
Basic health check for all system components.

**Response:**
```json
{
  "status": "ok | error",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "memory_heap": { "status": "up" },
    "memory_rss": { "status": "up" },
    "disk": { "status": "up" }
  }
}
```

### GET /health/detailed
Detailed health check with metrics.

### GET /health/db
Database-only health check.

### GET /health/redis
Redis-only health check.

---

## WebSocket Events

**Connection:** `ws://localhost:3000`

### Client → Server Events

#### `subscribe-to-task`
Subscribe to task progress updates.

**Payload:**
```json
{
  "taskId": "string"
}
```

#### `unsubscribe-from-task`
Unsubscribe from task updates.

**Payload:**
```json
{
  "taskId": "string"
}
```

### Server → Client Events

#### `task-progress`
Task progress update.

**Payload:**
```json
{
  "taskId": "string",
  "status": "PENDING | IN_PROGRESS | COMPLETED | FAILED",
  "progress": "number (0-100)",
  "message": "string (optional)",
  "result": { /* task result if completed */ }
}
```

#### `task-error`
Task error notification.

**Payload:**
```json
{
  "taskId": "string",
  "error": "string"
}
```

---

## Error Responses

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400
}
```

**Common Status Codes:**
- `400` - Bad Request (validation errors)
- `401` - Unauthorized
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

Currently no rate limiting is implemented. This should be added before production deployment.

---

## Notes

1. **Authentication:** JWT authentication is planned but not yet implemented. Currently using `x-user-id` header.
2. **Permissions:** Project-level permissions are enforced via `ProjectAccessGuard`.
3. **AI Models:** System supports multiple AI providers (OpenAI/智谱GLM, Anthropic/Claude, Tongyi/Qwen).
4. **Task Queue:** Long-running AI tasks are processed via BullMQ with Redis.
5. **Real-time Updates:** WebSocket connections provide real-time task progress updates.
