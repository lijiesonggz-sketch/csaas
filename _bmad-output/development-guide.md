# Development Guide - Csaas Project

## Prerequisites

### Required Software
- **Node.js:** v20.17.0 or higher
- **npm:** v10.x or higher
- **PostgreSQL:** v14 or higher
- **Redis:** v6 or higher

### Development Tools
- **Git:** For version control
- **VS Code:** Recommended IDE
- **Postman/Insomnia:** For API testing

---

## Environment Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd csaas
```

### 2. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

### 3. Database Setup

**Create PostgreSQL Database:**
```bash
createdb csaas
```

**Configure Environment Variables:**

Create `backend/.env.development`:
```env
# Application
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3001

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=csaas

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# AI APIs
OPENAI_API_KEY=your_key_here
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4/
OPENAI_MODEL=glm-4.7

ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_BASE_URL=https://as.imds.ai/api
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929

TONGYI_API_KEY=your_key_here
TONGYI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
TONGYI_MODEL=qwen3-max

# Timeouts
CLUSTERING_GENERATION_TIMEOUT=900000
MODEL_GENERATION_TIMEOUT=900000
```

**Run Migrations:**
```bash
cd backend
npm run migration:run
```

---

## Running the Application

### Development Mode

**Backend (Terminal 1):**
```bash
cd backend
npm run start:dev
```
Server runs on: `http://localhost:3000`

**Frontend (Terminal 2):**
```bash
cd frontend
npm run dev
```
Frontend runs on: `http://localhost:3001`

**Redis (Terminal 3):**
```bash
redis-server
```

---

## Build Process

### Backend Build
```bash
cd backend
npm run build
```
Output: `backend/dist/`

### Frontend Build
```bash
cd frontend
npm run build
```
Output: `frontend/.next/`

---

## Testing

### Backend Tests
```bash
cd backend

# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

### Frontend Tests
```bash
cd frontend
npm run test  # (if configured)
```

---

## Code Quality

### Linting

**Backend:**
```bash
cd backend
npm run lint
```

**Frontend:**
```bash
cd frontend
npm run lint
```

### Formatting

**Backend:**
```bash
cd backend
npm run format
```

**Frontend:**
```bash
cd frontend
npm run format
```

---

## Database Management

### Generate Migration
```bash
cd backend
npm run migration:generate -- -n MigrationName
```

### Run Migrations
```bash
npm run migration:run
```

### Revert Migration
```bash
npm run migration:revert
```

### TypeORM CLI
```bash
npm run typeorm -- <command>
```

---

## Common Development Tasks

### 1. Add New API Endpoint

**Backend:**
1. Create DTO in `modules/<module>/dto/`
2. Add method to controller
3. Implement service logic
4. Add tests

**Frontend:**
1. Create API call function
2. Add to component/page
3. Handle loading/error states

### 2. Add New Database Entity

1. Create entity file in `database/entities/`
2. Add relationships
3. Generate migration: `npm run migration:generate -- -n AddEntityName`
4. Run migration: `npm run migration:run`

### 3. Add New UI Component

1. Create component in `components/<category>/`
2. Add TypeScript types
3. Style with Tailwind/Ant Design
4. Export from index (if needed)

### 4. Add New Page

1. Create page in `app/<route>/page.tsx`
2. Add to navigation if needed
3. Implement data fetching
4. Add loading/error states

---

## Debugging

### Backend Debugging

**VS Code Launch Configuration:**
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Backend",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "start:debug"],
  "cwd": "${workspaceFolder}/backend",
  "console": "integratedTerminal"
}
```

**Debug Mode:**
```bash
cd backend
npm run start:debug
```
Debugger listens on port 9229

### Frontend Debugging

Use browser DevTools or VS Code debugger with Next.js.

---

## Health Checks

### Backend Health
```bash
curl http://localhost:3000/api/health
```

### Database Connection
```bash
curl http://localhost:3000/api/health/db
```

### Redis Connection
```bash
curl http://localhost:3000/api/health/redis
```

---

## API Testing

### Using Postman

Import endpoints:
- Base URL: `http://localhost:3000/api`
- Add header: `x-user-id: <user-id>` (temporary auth)

### Using curl

**Create Project:**
```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-user" \
  -d '{"name":"Test Project","description":"Test"}'
```

**Get Projects:**
```bash
curl http://localhost:3000/api/projects \
  -H "x-user-id: test-user"
```

---

## Queue Management

### View Queue Stats
```bash
curl http://localhost:3000/api/ai-tasks/queue/stats
```

### Monitor Redis Queue
```bash
redis-cli
> KEYS bull:*
> LLEN bull:ai-tasks:waiting
```

---

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 3001
lsof -ti:3001 | xargs kill -9
```

### Database Connection Issues
1. Check PostgreSQL is running: `pg_isready`
2. Verify credentials in `.env.development`
3. Check database exists: `psql -l`

### Redis Connection Issues
1. Check Redis is running: `redis-cli ping`
2. Verify Redis host/port in `.env.development`

### Migration Errors
```bash
# Reset database (CAUTION: deletes all data)
npm run typeorm -- schema:drop
npm run migration:run
```

### Node Memory Issues
Backend uses `--max-old-space-size=4096` flag for AI processing.

---

## Git Workflow

### Commit Conventions
Using Conventional Commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code refactoring
- `test:` Tests
- `chore:` Maintenance

### Pre-commit Hooks
Husky + lint-staged configured:
- Runs ESLint
- Runs Prettier
- Validates commit message

---

## Performance Tips

### Backend
1. Use database indexes for frequent queries
2. Implement caching with Redis
3. Use BullMQ for long-running tasks
4. Monitor memory usage

### Frontend
1. Use Next.js Image component
2. Implement code splitting
3. Lazy load heavy components
4. Optimize bundle size

---

## Security Considerations

### Development
- Never commit `.env` files
- Use environment variables for secrets
- Keep dependencies updated
- Review security advisories

### API Security
- JWT authentication (planned)
- Input validation with class-validator
- SQL injection prevention (TypeORM)
- XSS prevention (React escaping)

---

## Useful Commands

### Backend
```bash
npm run build          # Build for production
npm run start:prod     # Run production build
npm run lint           # Lint code
npm run format         # Format code
npm run test           # Run tests
npm run health:check   # Check API health
```

### Frontend
```bash
npm run dev            # Development server
npm run build          # Production build
npm run start          # Start production server
npm run lint           # Lint code
npm run format         # Format code
```

---

## IDE Setup

### VS Code Extensions
- ESLint
- Prettier
- TypeScript
- Tailwind CSS IntelliSense
- GitLens
- Thunder Client (API testing)

### VS Code Settings
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

---

## Documentation

### API Documentation
Currently manual. Consider adding:
- Swagger/OpenAPI
- Postman collection
- API Blueprint

### Code Documentation
- Use JSDoc comments
- Document complex logic
- Add README in modules

---

## Next Steps

1. **Set up CI/CD pipeline**
2. **Add comprehensive tests**
3. **Implement JWT authentication**
4. **Add API documentation**
5. **Set up monitoring and logging**
6. **Optimize performance**
7. **Security audit**
