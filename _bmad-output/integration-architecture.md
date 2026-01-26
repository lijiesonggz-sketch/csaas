# Integration Architecture - Csaas Project

## Overview
This document describes how the frontend and backend components integrate and communicate.

**Architecture Type:** Client-Server with Real-time Updates
**Communication:** REST API + WebSocket

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│                    (Next.js 14.2 + React 18)                │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Pages      │  │  Components  │  │    Stores    │     │
│  │  (App Router)│  │   (React)    │  │  (Zustand)   │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                   ┌────────┴────────┐                       │
│                   │   API Client    │                       │
│                   │  (Fetch + WS)   │                       │
│                   └────────┬────────┘                       │
└────────────────────────────┼─────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │   HTTP/WS       │
                    │  localhost:3000 │
                    └────────┬────────┘
                             │
┌────────────────────────────┼─────────────────────────────────┐
│                            │                                  │
│                   ┌────────┴────────┐                        │
│                   │  NestJS Router  │                        │
│                   └────────┬────────┘                        │
│                            │                                  │
│         ┌──────────────────┼──────────────────┐             │
│         │                  │                   │             │
│  ┌──────┴──────┐  ┌───────┴────────┐  ┌──────┴──────┐     │
│  │ Controllers │  │   WebSocket    │  │   Guards    │     │
│  │             │  │    Gateway     │  │             │     │
│  └──────┬──────┘  └───────┬────────┘  └──────┬──────┘     │
│         │                  │                   │             │
│  ┌──────┴──────────────────┴───────────────────┴──────┐    │
│  │                    Services                          │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │    │
│  │  │ Projects │  │ AI Tasks │  │  Survey  │         │    │
│  │  └──────────┘  └──────────┘  └──────────┘         │    │
│  └──────┬──────────────────┬───────────────┬──────────┘    │
│         │                  │               │                │
│  ┌──────┴──────┐  ┌───────┴────────┐  ┌──┴──────┐        │
│  │  TypeORM    │  │   BullMQ       │  │AI Clients│        │
│  │  (Database) │  │   (Queue)      │  │          │        │
│  └──────┬──────┘  └───────┬────────┘  └──┬───────┘        │
│         │                  │               │                │
│                     Backend (NestJS 10.4)                   │
└─────────┼──────────────────┼───────────────┼────────────────┘
          │                  │               │
     ┌────┴────┐        ┌───┴────┐     ┌───┴────────┐
     │PostgreSQL│        │ Redis  │     │ AI Providers│
     │  (DB)    │        │(Cache) │     │ (External)  │
     └──────────┘        └────────┘     └─────────────┘
```

---

## Integration Points

### 1. REST API Communication

**Base URL:** `http://localhost:3000/api`

**Request Flow:**
```
Frontend Component
    ↓ (fetch)
API Client Function
    ↓ (HTTP Request)
NestJS Controller
    ↓ (calls)
Service Layer
    ↓ (queries)
Database/External APIs
    ↓ (returns)
Service Layer
    ↓ (returns)
Controller
    ↓ (HTTP Response)
API Client
    ↓ (updates)
Frontend State/UI
```

**Example: Create Project**
```typescript
// Frontend (API call)
const response = await fetch('http://localhost:3000/api/projects', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-user-id': userId
  },
  body: JSON.stringify({ name, description })
});

// Backend (Controller)
@Post()
async create(@Body() dto: CreateProjectDto, @Req() req: any) {
  const userId = req.headers['x-user-id'];
  return this.projectsService.create(userId, dto);
}
```

---

### 2. WebSocket Real-time Updates

**Connection:** `ws://localhost:3000`

**Event Flow:**
```
Frontend subscribes to task
    ↓ (emit: subscribe-to-task)
WebSocket Gateway
    ↓ (registers subscription)
Task Processor (BullMQ)
    ↓ (updates progress)
WebSocket Gateway
    ↓ (emit: task-progress)
Frontend receives update
    ↓ (updates UI)
Progress Bar/Status Display
```

**Example: Task Progress Tracking**
```typescript
// Frontend (WebSocket client)
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.emit('subscribe-to-task', { taskId });

socket.on('task-progress', (data) => {
  setProgress(data.progress);
  setStatus(data.status);
});

// Backend (WebSocket Gateway)
@WebSocketGateway()
export class TasksGateway {
  @SubscribeMessage('subscribe-to-task')
  handleSubscribe(client: Socket, payload: { taskId: string }) {
    client.join(`task-${payload.taskId}`);
  }

  emitProgress(taskId: string, progress: number) {
    this.server.to(`task-${taskId}`).emit('task-progress', {
      taskId,
      progress,
      status: 'IN_PROGRESS'
    });
  }
}
```

---

### 3. File Upload Integration

**Endpoint:** `POST /api/files/parse-pdf`

**Flow:**
```
Frontend File Input
    ↓ (FormData)
Multipart Upload
    ↓ (Express Multer)
Files Controller
    ↓ (buffer)
PDF Parser Service
    ↓ (extracted text)
Controller Response
    ↓ (JSON)
Frontend State
```

**Example:**
```typescript
// Frontend
const formData = new FormData();
formData.append('file', pdfFile);

const response = await fetch('http://localhost:3000/api/files/parse-pdf', {
  method: 'POST',
  body: formData
});

const { data } = await response.json();
const extractedText = data.text;

// Backend
@Post('parse-pdf')
@UseInterceptors(FileInterceptor('file'))
async parsePdf(@UploadedFile() file: Express.Multer.File) {
  const text = await this.filesService.parsePdf(file.buffer);
  return { success: true, data: { text } };
}
```

---

### 4. AI Task Queue Integration

**Flow:**
```
Frontend creates AI task
    ↓ (POST /api/ai-tasks)
AI Tasks Controller
    ↓ (creates task record)
Database (AITask entity)
    ↓ (adds to queue)
BullMQ Queue
    ↓ (processes)
AI Task Processor
    ↓ (calls)
AI Generation Service
    ↓ (calls)
AI Clients (GPT-4/Claude/Qwen)
    ↓ (returns result)
AI Task Processor
    ↓ (updates database)
Database
    ↓ (emits via WebSocket)
WebSocket Gateway
    ↓ (receives)
Frontend
```

---

## Data Flow Patterns

### 1. CRUD Operations

**Pattern:** Request → Controller → Service → Repository → Database

**Example: Get Project**
```
GET /api/projects/:id
    ↓
ProjectsController.findOne()
    ↓
ProjectsService.findOne()
    ↓
TypeORM Repository.findOne()
    ↓
PostgreSQL Query
    ↓
Return Project Entity
```

---

### 2. Async Task Processing

**Pattern:** Create Task → Queue → Process → Notify

**Example: Generate Questionnaire**
```
POST /api/ai-generation/questionnaire
    ↓
AIGenerationController.generateQuestionnaire()
    ↓
AIGenerationService.createTask()
    ↓
Database (save task)
    ↓
BullMQ.add(task)
    ↓
[Async Processing]
    ↓
AITaskProcessor.process()
    ↓
AI Clients (generate content)
    ↓
Database (update result)
    ↓
WebSocket (emit progress)
    ↓
Frontend (update UI)
```

---

### 3. Multi-Model Generation

**Pattern:** Orchestrate → Parallel Generation → Validate → Aggregate

```
AI Orchestrator
    ├─→ GPT-4 Client ──→ Result 1
    ├─→ Claude Client ──→ Result 2
    └─→ Qwen Client ──→ Result 3
         ↓
    Quality Validator
         ↓
    Result Aggregator
         ↓
    Final Result
```

---

## Authentication & Authorization

### Current Implementation (Temporary)

**Header-based User ID:**
```typescript
// Frontend
headers: {
  'x-user-id': userId
}

// Backend
const userId = req.headers['x-user-id'];
```

### Planned Implementation (JWT)

**Flow:**
```
Login Request
    ↓
Auth Service (validate)
    ↓
Generate JWT Token
    ↓
Return Token to Frontend
    ↓
Store in localStorage/cookie
    ↓
Include in Authorization header
    ↓
JWT Guard validates token
    ↓
Extract user from token
    ↓
Proceed to controller
```

---

## Error Handling

### Frontend Error Handling
```typescript
try {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  return data;
} catch (error) {
  // Show toast notification
  toast.error(error.message);
  // Log to monitoring service
  console.error(error);
}
```

### Backend Error Handling
```typescript
@Post()
async create(@Body() dto: CreateDto) {
  try {
    return await this.service.create(dto);
  } catch (error) {
    throw new HttpException(
      { success: false, error: error.message },
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
```

---

## State Management

### Frontend State (Zustand)

**Project Store:**
```typescript
interface ProjectStore {
  projects: Project[];
  currentProject: Project | null;
  fetchProjects: () => Promise<void>;
  setCurrentProject: (project: Project) => void;
}
```

**Task Store:**
```typescript
interface TaskStore {
  tasks: Map<string, AITask>;
  updateTaskProgress: (taskId: string, progress: number) => void;
  subscribeToTask: (taskId: string) => void;
}
```

---

## Caching Strategy

### Frontend Caching
- **React Query/SWR:** (Recommended, not yet implemented)
- **Local State:** Zustand stores
- **Session Storage:** Temporary data

### Backend Caching
- **Redis:** Session data, frequently accessed data
- **In-Memory:** Short-lived cache for API responses

---

## Performance Optimizations

### Frontend
1. **Code Splitting:** Next.js automatic splitting
2. **Lazy Loading:** Dynamic imports for heavy components
3. **Memoization:** React.memo for expensive renders
4. **Debouncing:** Input handlers

### Backend
1. **Database Indexing:** Indexes on frequently queried columns
2. **Query Optimization:** Select only needed fields
3. **Caching:** Redis for expensive queries
4. **Queue Processing:** BullMQ for async tasks

---

## Security Measures

### Frontend
- **XSS Prevention:** React automatic escaping
- **CSRF Protection:** (To be implemented)
- **Input Validation:** Client-side validation
- **Secure Storage:** HttpOnly cookies for tokens (planned)

### Backend
- **Input Validation:** class-validator DTOs
- **SQL Injection:** TypeORM parameterized queries
- **Rate Limiting:** (To be implemented)
- **CORS:** Configured for frontend origin
- **Helmet:** Security headers (recommended)

---

## Monitoring & Logging

### Current Implementation
- **Console Logging:** Development debugging
- **Sentry:** Error tracking (configured but optional)

### Recommended Additions
- **Winston/Pino:** Structured logging
- **Prometheus:** Metrics collection
- **Grafana:** Metrics visualization
- **ELK Stack:** Log aggregation

---

## Deployment Considerations

### Frontend Deployment
- **Platform:** Vercel/Netlify (recommended for Next.js)
- **Environment Variables:** Configure API URL
- **Build Command:** `npm run build`
- **Output:** Static files in `.next/`

### Backend Deployment
- **Platform:** AWS/GCP/Azure/Railway
- **Environment Variables:** Database, Redis, AI API keys
- **Build Command:** `npm run build`
- **Start Command:** `npm run start:prod`
- **Health Checks:** `/api/health` endpoint

### Database & Redis
- **PostgreSQL:** Managed service (AWS RDS, etc.)
- **Redis:** Managed service (AWS ElastiCache, etc.)
- **Backups:** Automated daily backups
- **Scaling:** Read replicas for database

---

## Future Enhancements

1. **GraphQL API:** Consider GraphQL for flexible queries
2. **Server-Sent Events:** Alternative to WebSocket for one-way updates
3. **API Gateway:** Kong/Nginx for rate limiting and caching
4. **Microservices:** Split AI processing into separate service
5. **Message Queue:** RabbitMQ/Kafka for event-driven architecture
6. **Service Mesh:** Istio for microservices communication
