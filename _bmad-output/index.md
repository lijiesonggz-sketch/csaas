# Csaas Project Documentation Index

## 📋 Project Overview

**Csaas (Consulting as a Service)** - AI-powered consulting platform for compliance assessment and improvement planning.

- **Type:** Multi-part Web Application (Frontend + Backend)
- **Architecture:** Client-Server with Real-time Updates
- **Primary Language:** TypeScript
- **Status:** Functional MVP

---

## 🚀 Quick Reference

### Project Structure
- **Backend:** NestJS 10.4 + TypeORM + PostgreSQL + Redis
- **Frontend:** Next.js 14.2 + React 18 + Ant Design + Material-UI
- **Architecture Pattern:** Layered (Backend), Component-based (Frontend)

### Key Technologies
| Component | Backend | Frontend |
|-----------|---------|----------|
| Framework | NestJS 10.4 | Next.js 14.2 |
| Language | TypeScript 5.6 | TypeScript 5.6 |
| Database | PostgreSQL + TypeORM | - |
| State | Redis + BullMQ | Zustand |
| Real-time | Socket.io | Socket.io-client |
| AI | Multi-provider | - |

### Entry Points
- **Backend:** `backend/src/main.ts`
- **Frontend:** `frontend/app/layout.tsx`
- **API Base:** `http://localhost:3000/api`
- **Frontend URL:** `http://localhost:3001`

---

## 📚 Generated Documentation

### Core Documentation

#### [Project Overview](./project-overview.md)
Executive summary, technology stack, features, and roadmap.

**Key Sections:**
- Executive Summary
- Technology Stack
- Core Features (7 major features)
- Architecture Overview
- Database Schema (14 entities)
- API Endpoints (50+ endpoints)
- Workflow Process
- Future Roadmap

---

#### [Source Tree Analysis](./source-tree-analysis.md)
Complete project structure with annotated directory tree.

**Key Sections:**
- Project Structure Overview
- Backend Module Structure (11 modules)
- Frontend Component Structure (24 pages, 27 components)
- Critical Directories
- Integration Points
- Configuration Files
- Key Observations

---

### Backend Documentation

#### [API Contracts - Backend](./api-contracts-backend.md)
Complete REST API and WebSocket endpoint documentation.

**API Groups:**
- Authentication (2 endpoints)
- Projects (10+ endpoints)
- AI Tasks (10+ endpoints)
- AI Generation (6 endpoints)
- Survey (8 endpoints)
- Files (1 endpoint)
- Health Checks (4 endpoints)
- Current State (5 endpoints)
- WebSocket Events (3 event types)

**Total:** 50+ REST endpoints + WebSocket real-time updates

---

#### [Data Models - Backend](./data-models-backend.md)
Database schema, entities, and relationships.

**Core Entities:**
1. **User** - User accounts with roles
2. **Project** - Consulting project workspace
3. **ProjectMember** - Access control
4. **AITask** - AI task orchestration (11 task types)
5. **AIGenerationEvent** - AI invocation audit log
6. **AICostTracking** - Cost tracking per model
7. **SurveyResponse** - Questionnaire responses
8. **StandardDocument** - Standard document storage
9. **CurrentStateDescription** - Enterprise current state
10. **ActionPlanMeasure** - Implementation measures

**Additional:** InterpretationResult, SystemUser, AuditLog, AIGenerationResult

**Migrations:** 11 migration files for schema evolution

---

### Frontend Documentation

#### [UI Component Inventory - Frontend](./ui-component-inventory-frontend.md)
Complete catalog of React components and pages.

**Component Categories:**
1. **Layout & Navigation** (3 components)
   - Header, Sidebar, MainLayout
2. **Project Management** (7 components)
   - ProjectList, ProjectCard, CreateProjectDialog, etc.
3. **AI Result Displays** (11 components)
   - Simple displays (5) + Full displays (6)
4. **Input & Upload** (2 components)
   - DocumentUploader, MissingClausesHandler
5. **Progress & Status** (3 components)
   - TaskProgressBar, QuestionnaireProgressDisplay, etc.

**Pages:** 24 page components using Next.js App Router

**UI Libraries:** Ant Design 5.29.3 + Material-UI 7.3.6

---

### Integration & Architecture

#### [Integration Architecture](./integration-architecture.md)
System integration patterns and data flow.

**Key Topics:**
- System Architecture Diagram
- Integration Points (4 major integration patterns)
- Data Flow Patterns (CRUD, Async Tasks, Multi-Model)
- Authentication & Authorization
- Error Handling
- State Management
- Caching Strategy
- Performance Optimizations
- Security Measures
- Deployment Considerations

**Integration Patterns:**
1. REST API Communication
2. WebSocket Real-time Updates
3. File Upload Integration
4. AI Task Queue Integration

---

### Development & Operations

#### [Development Guide](./development-guide.md)
Complete setup and development instructions.

**Sections:**
- Prerequisites (Node.js, PostgreSQL, Redis)
- Environment Setup
- Running the Application
- Build Process
- Testing (Unit, E2E, Coverage)
- Code Quality (Linting, Formatting)
- Database Management (Migrations)
- Common Development Tasks
- Debugging
- Health Checks
- API Testing
- Queue Management
- Troubleshooting
- Git Workflow
- Performance Tips
- Security Considerations
- Useful Commands
- IDE Setup

---

## 🗂️ Existing Project Documentation

### Project Documentation (`docs/`)
- **成熟度分析功能实现总结.md** - Maturity analysis implementation summary
- **成熟度分析功能测试指南.md** - Testing guide
- **成熟度分析功能修复记录.md** - Bug fix records
- **permissions-implementation-guide.md** - Permission system guide
- **development-principles.md** - Development principles
- **document-template.md** - Document templates

### Component READMEs
- `backend/README.md` - Backend-specific documentation
- `frontend/README.md` - Frontend-specific documentation

---

## 🎯 Getting Started

### For New Developers

1. **Read First:**
   - [Project Overview](./project-overview.md) - Understand the system
   - [Development Guide](./development-guide.md) - Set up your environment

2. **Understand Architecture:**
   - [Source Tree Analysis](./source-tree-analysis.md) - Project structure
   - [Integration Architecture](./integration-architecture.md) - How parts connect

3. **Start Coding:**
   - [API Contracts](./api-contracts-backend.md) - API reference
   - [Data Models](./data-models-backend.md) - Database schema
   - [UI Components](./ui-component-inventory-frontend.md) - Frontend components

### For API Consumers

1. **API Documentation:**
   - [API Contracts - Backend](./api-contracts-backend.md)
   - Base URL: `http://localhost:3000/api`
   - Authentication: Header-based (JWT planned)

2. **WebSocket Integration:**
   - Connection: `ws://localhost:3000`
   - Events: `task-progress`, `task-error`, `task-completed`

### For DevOps/Deployment

1. **Setup Requirements:**
   - Node.js 20.17.0+
   - PostgreSQL 14+
   - Redis 6+

2. **Environment Variables:**
   - See [Development Guide](./development-guide.md#environment-setup)

3. **Health Checks:**
   - `/api/health` - Overall health
   - `/api/health/db` - Database
   - `/api/health/redis` - Redis

---

## 🏗️ Architecture Quick View

### Backend Architecture
```
Controllers → Services → Repositories → Database
     ↓
  BullMQ Queue → AI Task Processor → AI Clients
     ↓
WebSocket Gateway → Frontend
```

### Frontend Architecture
```
Pages (App Router) → Components → API Client → Backend
                  ↓
            Zustand Stores
                  ↓
          WebSocket Client → Real-time Updates
```

### Data Flow
```
User Action → Frontend → REST API → Backend Service
                                        ↓
                                   Database/Queue
                                        ↓
                              Async Processing (BullMQ)
                                        ↓
                              AI Providers (GPT-4/Claude/Qwen)
                                        ↓
                              WebSocket → Frontend Update
```

---

## 🔧 Common Tasks

### Backend Development
```bash
cd backend
npm run start:dev          # Start dev server
npm run migration:generate # Generate migration
npm run migration:run      # Run migrations
npm run test               # Run tests
npm run lint               # Lint code
```

### Frontend Development
```bash
cd frontend
npm run dev                # Start dev server
npm run build              # Build for production
npm run lint               # Lint code
```

### Database Operations
```bash
cd backend
npm run typeorm -- migration:create -n MigrationName
npm run migration:run
npm run migration:revert
```

---

## 📊 Project Statistics

### Backend
- **Modules:** 11 feature modules
- **Controllers:** 10 controllers
- **Entities:** 14 database entities
- **Migrations:** 11 migration files
- **API Endpoints:** 50+ REST endpoints
- **WebSocket Events:** 3 event types

### Frontend
- **Pages:** 24 page components
- **Components:** 27 feature components
- **Routes:** 15+ unique routes
- **UI Libraries:** 2 (Ant Design + Material-UI)

### Database
- **Tables:** 14 tables
- **Relationships:** Complex many-to-one and one-to-many
- **Indexes:** Multiple indexes for performance

---

## 🚨 Important Notes

### Current Limitations
1. **Authentication:** Temporary header-based auth (JWT planned)
2. **UI Libraries:** Dual libraries increase bundle size
3. **Test Coverage:** Limited test coverage
4. **API Docs:** No Swagger/OpenAPI yet
5. **Monitoring:** Basic logging only

### Security Considerations
- Passwords hashed with bcrypt
- Input validation with class-validator
- SQL injection prevention via TypeORM
- XSS prevention via React escaping
- Project-level access control implemented

### Performance Notes
- API response time: < 200ms (CRUD)
- AI generation: 30s - 15min (task dependent)
- Queue-based async processing
- WebSocket for real-time updates

---

## 📞 Support & Resources

### Documentation
- All documentation in `_bmad-output/` directory
- Existing docs in `docs/` directory
- Component READMEs in respective folders

### Development
- **Backend Port:** 3000
- **Frontend Port:** 3001
- **Database Port:** 5432
- **Redis Port:** 6379

### Health Checks
- **Overall:** `GET /api/health`
- **Database:** `GET /api/health/db`
- **Redis:** `GET /api/health/redis`

---

## 🔄 Document Updates

**Generated:** 2026-01-21
**Scan Mode:** Exhaustive
**Scan Level:** Complete source file analysis
**Documentation Version:** 1.0.0

**Files Generated:**
1. project-overview.md
2. source-tree-analysis.md
3. api-contracts-backend.md
4. data-models-backend.md
5. ui-component-inventory-frontend.md
6. integration-architecture.md
7. development-guide.md
8. index.md (this file)

---

## 📝 Next Steps

### For Development
1. Review [Development Guide](./development-guide.md)
2. Set up local environment
3. Run health checks
4. Start coding!

### For Architecture Review
1. Read [Project Overview](./project-overview.md)
2. Study [Integration Architecture](./integration-architecture.md)
3. Review [Source Tree Analysis](./source-tree-analysis.md)

### For API Integration
1. Check [API Contracts](./api-contracts-backend.md)
2. Test endpoints with Postman/curl
3. Implement WebSocket client

### For Database Work
1. Review [Data Models](./data-models-backend.md)
2. Understand entity relationships
3. Plan schema changes

---

## 🎉 Documentation Complete!

This comprehensive documentation set provides everything needed to understand, develop, and maintain the Csaas project. All documentation is generated from actual source code analysis and reflects the current state of the project.

**Happy Coding! 🚀**
