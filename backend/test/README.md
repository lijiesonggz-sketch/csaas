# E2E Tests Setup Guide

## Prerequisites

1. **PostgreSQL Database** (Test Database)
   ```bash
   # Create test database
   createdb csaas_test

   # Or using psql
   psql -U postgres -c "CREATE DATABASE csaas_test;"
   ```

2. **Run Migrations on Test Database**
   ```bash
   cd backend
   # Set test database in .env.test
   DB_DATABASE=csaas_test npm run migration:run
   ```

3. **Redis** (Optional but recommended)
   ```bash
   # Make sure Redis is running
   redis-server
   ```

## Running E2E Tests

### Run all E2E tests
```bash
cd backend
npm run test:e2e
```

### Run specific E2E test suite
```bash
npm run test:e2e -- organization-workflow
```

### Run E2E tests with coverage
```bash
npm run test:e2e -- --coverage
```

## Test Database Management

### Reset test database
```bash
# Drop and recreate test database
dropdb csaas_test && createdb csaas_test

# Run migrations
DB_DATABASE=csaas_test npm run migration:run
```

### Seed test data (optional)
```bash
# Run seed script if available
npm run seed:test
```

## CI/CD Integration

For GitHub Actions or similar:

```yaml
- name: Setup Test Database
  run: |
    createdb csaas_test
    DB_DATABASE=csaas_test npm run migration:run

- name: Run E2E Tests
  run: npm run test:e2e
  env:
    DB_DATABASE: csaas_test
```

## Troubleshooting

### Issue: Tests fail with "relation does not exist"
**Solution**: Run migrations on test database
```bash
DB_DATABASE=csaas_test npm run migration:run
```

### Issue: Tests timeout
**Solution**: Increase timeout in jest-e2e.json or check if services are running

### Issue: Port already in use
**Solution**: Kill process using port 3000
```bash
# Linux/Mac
lsof -ti:3000 | xargs kill

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

## Current E2E Test Suites

- ✅ `organization-workflow.e2e-spec.ts` - Tests Story 1.1 organization auto-creation
  - AC 1.1: First project auto-creates organization
  - AC 1.2: Second project reuses organization
  - AC 1.3: Weakness snapshot auto-creation
  - AC 1.4: Weakness aggregation across projects
  - API endpoint validation

## Test Data Cleanup

E2E tests automatically clean up test data after completion:
- Test users are deleted
- Organizations are deleted
- Projects are deleted
- Weakness snapshots are deleted

If tests fail, manual cleanup may be needed:
```bash
DB_DATABASE=csaas_test psql -U postgres -c "TRUNCATE TABLE weakness_snapshots, organization_members, organizations, projects CASCADE;"
```
