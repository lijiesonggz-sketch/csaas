# Project Overview - Csaas

## Executive Summary

**Csaas (Consulting as a Service)** is an AI-powered consulting platform designed to automate and streamline the compliance consulting process. The system helps enterprises assess their maturity against industry standards (such as GB/T 22239-2019) and generate actionable improvement plans.

**Project Type:** Multi-part Web Application (Frontend + Backend)
**Architecture:** Client-Server with Real-time Updates
**Status:** Functional MVP with core features implemented

---

## Project Information

- **Project Name:** Csaas (AI咨询平台)
- **Repository Type:** Multi-part (Frontend + Backend)
- **Primary Language:** TypeScript
- **Development Status:** Active Development
- **Target Users:** Consulting firms, Enterprise compliance teams

---

## Technology Stack

### Backend
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | NestJS | 10.4.0 |
| Language | TypeScript | 5.6.0 |
| Database | PostgreSQL | - |
| ORM | TypeORM | 0.3.20 |
| Cache/Queue | Redis + BullMQ | 5.8.2 / 5.66.2 |
| WebSocket | Socket.io | 4.8.3 |
| AI Integration | Multi-provider | - |
| Testing | Jest | 29.7.0 |

**AI Providers:**
- OpenAI API (智谱GLM-4.7)
- Anthropic API (Claude Sonnet 4.5)
- Tongyi API (Qwen3-max)

### Frontend
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Next.js | 14.2.0 |
| Language | TypeScript | 5.6.0 |
| UI Library | React | 18.3.0 |
| UI Components | Ant Design + Material-UI | 5.29.3 / 7.3.6 |
| State Management | Zustand | 4.5.0 |
| Styling | Tailwind CSS + Emotion | 3.4.0 / 11.14.0 |
| Charts | Recharts | 2.13.0 |
| WebSocket | Socket.io-client | 4.8.0 |

---

## Core Features

### 1. Standard Interpretation (标准解读)
- Upload and parse standard documents (PDF)
- AI-powered clause extraction and interpretation
- Multi-model generation for quality assurance

### 2. Clustering Analysis (聚类分析)
- Analyze multiple standard documents
- Group related requirements into clusters
- Generate comprehensive requirement taxonomy

### 3. Maturity Matrix (成熟度矩阵)
- Generate maturity assessment matrix from clusters
- Define maturity levels (1-5) for each requirement
- Export to Excel for offline use

### 4. Questionnaire Generation (问卷生成)
- Auto-generate assessment questionnaires from matrix
- Support for multiple question types
- Export to Word/Excel formats

### 5. Gap Analysis (差距分析)
- Collect survey responses from enterprise users
- Calculate maturity scores
- Identify compliance gaps

### 6. Action Plan (落地措施)
- Generate prioritized improvement measures
- Map measures to specific requirements
- Export implementation roadmap

### 7. Quick Gap Analysis (快速差距分析)
- Simplified workflow for rapid assessment
- Binary questionnaire (Yes/No questions)
- Faster turnaround time

---

## Architecture Overview

### System Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│  - React Components                                      │
│  - State Management (Zustand)                           │
│  - Real-time Updates (WebSocket)                        │
└────────────────────┬────────────────────────────────────┘
                     │ REST API + WebSocket
                     │
┌────────────────────┴────────────────────────────────────┐
│                    Backend (NestJS)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Controllers  │  │   Services   │  │  Processors  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   TypeORM    │  │   BullMQ     │  │ AI Clients   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└────────────────────┬────────────────────┬──────────────┘
                     │                    │
          ┌──────────┴──────────┐  ┌─────┴──────────┐
          │    PostgreSQL       │  │     Redis      │
          │    (Database)       │  │  (Cache/Queue) │
          └─────────────────────┘  └────────────────┘
```

### Architecture Pattern
- **Backend:** Layered Architecture (Controllers → Services → Repositories)
- **Frontend:** Component-based Architecture with App Router
- **Communication:** REST API for CRUD, WebSocket for real-time updates
- **Processing:** Queue-based async processing with BullMQ

---

## Project Structure

```
csaas/
├── backend/           # NestJS API Backend
│   ├── src/
│   │   ├── modules/   # Feature modules (11 modules)
│   │   ├── database/  # Entities and migrations
│   │   └── config/    # Configuration files
│   └── package.json
│
├── frontend/          # Next.js Web Frontend
│   ├── app/           # App Router pages (24 pages)
│   ├── components/    # React components (27 components)
│   ├── lib/           # Utilities and hooks
│   └── package.json
│
├── docs/              # Project documentation
├── _bmad/             # BMad workflow framework
└── _bmad-output/      # Generated documentation
```

---

## Key Modules

### Backend Modules
1. **auth** - User authentication
2. **projects** - Project management
3. **ai-tasks** - AI task orchestration
4. **ai-generation** - AI content generation
5. **ai-clients** - AI provider integration
6. **survey** - Questionnaire and survey management
7. **files** - File upload and parsing
8. **health** - System health monitoring
9. **current-state** - Enterprise current state management
10. **quality-validation** - AI output quality assurance
11. **result-aggregation** - Multi-model result aggregation

### Frontend Features
1. **Project Management** - Create and manage consulting projects
2. **Document Upload** - Upload and parse standard documents
3. **AI Generation** - Trigger and monitor AI tasks
4. **Result Display** - View and export AI-generated content
5. **Survey Forms** - Collect assessment responses
6. **Real-time Progress** - Live task progress updates

---

## Database Schema

### Core Entities (14 tables)
- **users** - User accounts
- **projects** - Consulting projects
- **project_members** - Project access control
- **ai_tasks** - AI generation tasks
- **ai_generation_events** - AI invocation audit log
- **ai_cost_tracking** - AI usage cost tracking
- **survey_responses** - Questionnaire responses
- **standard_documents** - Standard document storage
- **current_state_descriptions** - Enterprise current state
- **action_plan_measures** - Implementation measures
- **interpretation_results** - Standard interpretation results
- **ai_generation_results** - (Deprecated)
- **system_users** - System administrators
- **audit_logs** - System audit trail

---

## API Endpoints

### Main API Groups
- **/auth** - Authentication (2 endpoints)
- **/projects** - Project management (10+ endpoints)
- **/ai-tasks** - Task management (10+ endpoints)
- **/ai-generation** - AI generation (6 endpoints)
- **/survey** - Survey management (8 endpoints)
- **/files** - File operations (1 endpoint)
- **/health** - Health checks (4 endpoints)
- **/projects/:id/current-state** - Current state (5 endpoints)

**Total:** 50+ REST API endpoints + WebSocket events

---

## Workflow Process

### Standard Consulting Workflow
1. **Create Project** → Define project scope and standards
2. **Upload Documents** → Upload standard documents (PDF)
3. **Standard Interpretation** → AI extracts and interprets clauses
4. **Clustering** → Group requirements into logical clusters
5. **Generate Matrix** → Create maturity assessment matrix
6. **Generate Questionnaire** → Auto-generate assessment questions
7. **Collect Responses** → Enterprise users fill questionnaires
8. **Gap Analysis** → Calculate maturity scores and gaps
9. **Action Plan** → Generate prioritized improvement measures
10. **Export & Deliver** → Export reports to Word/Excel

### Quick Workflow (Simplified)
1. **Create Project**
2. **Upload Current State Description**
3. **Upload Standard Documents**
4. **Quick Gap Analysis** → Binary questionnaire
5. **Action Plan**
6. **Export**

---

## Real-time Features

### WebSocket Events
- **task-progress** - Task progress updates (0-100%)
- **task-error** - Task error notifications
- **task-completed** - Task completion notifications

### Use Cases
- Live progress bars during AI generation
- Real-time status updates for long-running tasks
- Instant notifications for task completion/failure

---

## AI Integration

### Multi-Model Strategy
The system uses three AI providers simultaneously for quality assurance:
1. **GPT-4 (智谱GLM)** - Primary model
2. **Claude (Anthropic)** - Secondary model
3. **Qwen (Tongyi)** - Domestic model

### Generation Pipeline
```
Input → [GPT-4, Claude, Qwen] → Quality Validation → Aggregation → Final Result
```

### Quality Assurance
- Consistency validation across models
- Confidence scoring
- Fallback to manual mode if quality is low

---

## Performance Characteristics

### Backend
- **API Response Time:** < 200ms (CRUD operations)
- **AI Generation Time:** 30s - 15min (depending on task complexity)
- **Queue Processing:** Async with BullMQ
- **Concurrent Tasks:** Supports multiple parallel AI tasks

### Frontend
- **Initial Load:** ~2-3s
- **Page Navigation:** < 500ms (Next.js routing)
- **Real-time Updates:** < 100ms latency (WebSocket)

---

## Security Features

### Current Implementation
- Password hashing with bcrypt
- Input validation with class-validator
- SQL injection prevention (TypeORM)
- XSS prevention (React escaping)
- Project-level access control

### Planned Enhancements
- JWT authentication
- Rate limiting
- API key management
- Audit logging
- RBAC (Role-Based Access Control)

---

## Deployment

### Development
- **Backend:** `npm run start:dev` (localhost:3000)
- **Frontend:** `npm run dev` (localhost:3001)
- **Database:** PostgreSQL (localhost:5432)
- **Redis:** Redis server (localhost:6379)

### Production (Recommended)
- **Backend:** Docker container on cloud platform
- **Frontend:** Vercel/Netlify (Next.js optimized)
- **Database:** Managed PostgreSQL (AWS RDS, etc.)
- **Redis:** Managed Redis (AWS ElastiCache, etc.)

---

## Testing

### Current Coverage
- Backend unit tests (Jest)
- E2E tests (partial)
- Manual testing

### Testing Gaps
- Frontend component tests
- Integration tests
- Performance tests
- Security tests

---

## Documentation

### Available Documentation
- **API Contracts** - REST API endpoint documentation
- **Data Models** - Database schema and entities
- **UI Components** - Frontend component inventory
- **Source Tree** - Project structure analysis
- **Development Guide** - Setup and development instructions
- **Integration Architecture** - System integration details

### Documentation Location
All generated documentation is in `_bmad-output/` directory.

---

## Known Issues & Limitations

1. **Dual UI Libraries** - Both Ant Design and Material-UI increase bundle size
2. **No JWT Auth** - Currently using temporary header-based auth
3. **Limited Test Coverage** - Need more comprehensive tests
4. **No API Documentation** - Swagger/OpenAPI not yet implemented
5. **Performance** - Large document processing can be slow
6. **Scalability** - Single-instance deployment, needs horizontal scaling

---

## Future Roadmap

### Short-term (1-3 months)
- [ ] Implement JWT authentication
- [ ] Add Swagger API documentation
- [ ] Improve test coverage
- [ ] Optimize bundle size
- [ ] Add monitoring and logging

### Medium-term (3-6 months)
- [ ] Implement RBAC
- [ ] Add multi-tenancy support
- [ ] Optimize AI generation performance
- [ ] Add more export formats
- [ ] Implement caching strategy

### Long-term (6-12 months)
- [ ] Microservices architecture
- [ ] Advanced analytics dashboard
- [ ] Mobile app (React Native)
- [ ] API marketplace
- [ ] White-label solution

---

## Team & Contacts

**Development Team:** (To be filled)
**Project Manager:** (To be filled)
**Technical Lead:** (To be filled)

---

## License

(To be determined)

---

## Getting Started

For detailed setup instructions, see [Development Guide](./development-guide.md).

For API documentation, see [API Contracts](./api-contracts-backend.md).

For architecture details, see [Integration Architecture](./integration-architecture.md).
