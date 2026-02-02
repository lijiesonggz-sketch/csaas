# 集成测试环境设置指南

## 📋 概述

本项目使用NestJS的E2E测试框架进行集成测试，验证完整的数据流和业务逻辑。

## 🚀 快速开始

### 前置条件

1. **PostgreSQL数据库**（必须运行）
   ```bash
   # 使用Docker启动测试数据库
   docker run -d \
     --name csaas-test-db \
     -e POSTGRES_USER=csaas \
     -e POSTGRES_PASSWORD=csaas_test \
     -e POSTGRES_DB=csaas_test \
     -p 5433:5432 \
     postgres:16-alpine
   ```

2. **Redis**（可选，BullMQ队列需要）
   ```bash
   docker run -d \
     --name csaas-test-redis \
     -p 6380:6379 \
     redis:7-alpine
   ```

### 环境配置

创建或修改 `.env.test` 文件：

```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=csaas
DB_PASSWORD=csaas_test
DB_DATABASE=csaas_test

# Redis配置（可选）
REDIS_HOST=localhost
REDIS_PORT=6380

# 其他配置
NODE_ENV=test
JWT_SECRET=test_jwt_secret_do_not_use_in_production
```

### 数据库迁移

```bash
# 运行所有迁移
npm run migration:run

# 或者使用测试数据库
DATABASE_URL="postgresql://csaas:csaas_test@localhost:5433/csaas_test" npm run migration:run
```

## 🧪 运行测试

### 运行所有E2E测试

```bash
# 方式1: 使用npm脚本
npm run test:e2e

# 方式2: 直接使用jest
npm test -- --config test/jest-e2e.json
```

### 运行Task 2.2集成测试

```bash
# 只运行matchedPeers集成测试
npm test -- matched-peers-integration.e2e-spec.ts --config test/jest-e2e.json
```

### 运行特定测试

```bash
# 运行单个测试用例
npm test -- matched-peers-integration.e2e-spec.ts --testNamePattern="should store matchedPeers" --config test/jest-e2e.json

# 运行所有雷达推送相关测试
npm test -- radar-push.e2e-spec.ts --config test/jest-e2e.json
```

## 📊 可用的集成测试

| 测试文件 | 描述 | 状态 |
|---------|------|------|
| `matched-peers-integration.e2e-spec.ts` | Story 5.2 Task 2.2: matchedPeers功能 | ✅ 新创建 |
| `radar-push.e2e-spec.ts` | Story 2.3: 推送系统与调度 | ✅ 已有 |
| `organization-workflow.e2e-spec.ts` | 组织工作流 | ✅ 已有 |
| `auth-and-permissions.e2e-spec.ts` | 认证与权限 | ✅ 已有 |
| `ai-analysis.e2e-spec.ts` | AI分析服务 | ✅ 已有 |

## 🧹 清理测试数据

测试会自动清理数据，但如果需要手动清理：

```bash
# 连接到测试数据库
psql -h localhost -p 5433 -U csaas -d csaas_test

# 删除测试数据
DELETE FROM radar_pushes WHERE organization_id LIKE '20000000%';
DELETE FROM analyzed_contents WHERE id LIKE '60000000%';
DELETE FROM raw_contents WHERE id LIKE '50000000%';
DELETE FROM watched_peers WHERE id LIKE '30000000%';
DELETE FROM watched_topics WHERE organization_id LIKE '20000000%';
DELETE FROM weakness_snapshots WHERE organization_id LIKE '20000000%';
DELETE FROM tags WHERE id LIKE '40000000%';
DELETE FROM organization_members WHERE organization_id LIKE '20000000%';
DELETE FROM organizations WHERE id LIKE '20000000%';
DELETE FROM users WHERE id LIKE '10000000%';
```

## 🔍 故障排查

### 问题1: 数据库连接失败

**错误**: `Connection refused: localhost:5433`

**解决方案**:
```bash
# 检查测试数据库是否运行
docker ps | grep csaas-test-db

# 如果没有运行，启动它
docker start csaas-test-db
```

### 问题2: 迁移未执行

**错误**: `relation "xxx" does not exist`

**解决方案**:
```bash
# 运行迁移
npm run migration:run

# 检查迁移状态
npm run migration:show
```

### 问题3: 测试超时

**错误**: `Test timeout of 30000ms exceeded`

**解决方案**:
- 增加测试超时时间：修改 `test/jest-e2e.json` 中的 `testTimeout`
- 检查数据库性能
- 减少并发测试数量：添加 `--maxWorkers=1`

### 问题4: 端口冲突

**错误**: `Port 5433 is already in use`

**解决方案**:
```bash
# 查找占用端口的进程
lsof -i :5433  # macOS/Linux
netstat -ano | findstr :5433  # Windows

# 杀死进程或更改端口
docker stop csaas-test-db
# 或修改 .env.test 中的 DB_PORT
```

## 📝 编写新的集成测试

### 模板

```typescript
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { AppModule } from '../src/app.module'

describe('Feature Name (E2E)', () => {
  let app: INestApplication
  let dataSource: DataSource

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    dataSource = app.get<DataSource>(DataSource)

    await app.init()
    await setupTestData()
  })

  afterAll(async () => {
    await cleanupTestData()
    await app.close()
  })

  it('should do something', async () => {
    // Arrange
    // Act
    // Assert
  })
})
```

### 最佳实践

1. ✅ **使用真实数据库**: E2E测试应该连接真实的测试数据库
2. ✅ **清理测试数据**: 每个测试前后清理数据，避免相互干扰
3. ✅ **测试完整流程**: 从API请求到数据库存储的完整数据流
4. ✅ **使用事务**: 对于复杂的测试，考虑使用数据库事务以便回滚
5. ❌ **不要Mock服务**: E2E测试应该使用真实的服务实例

## 🎯 Task 2.2集成测试说明

### 测试覆盖场景

1. **行业雷达推送时，matchedPeers正确存储到数据库**
   - 验证: `push.matchedPeers === ['杭州银行']`

2. **行业雷达推送时，多同业匹配场景**
   - 验证: `push.matchedPeers` 包含所有匹配的同业

3. **技术雷达推送时，matchedPeers为null**
   - 验证: `push.matchedPeers === null`

4. **无同业匹配时，matchedPeers为null**
   - 验证: `push.matchedPeers === null`

5. **全文回退匹配场景**
   - 验证: 当`rawContent.peerName`为null时，通过标题/摘要匹配同业

### 运行方式

```bash
# 运行所有Task 2.2集成测试
npm test -- matched-peers-integration.e2e-spec.ts --config test/jest-e2e.json

# 查看测试覆盖率
npm test -- matched-peers-integration.e2e-spec.ts --config test/jest-e2e.json --coverage
```

## 📚 相关文档

- [NestJS E2E Testing](https://docs.nestjs.com/fundamentals/testing#end-to-end-testing)
- [Jest Configuration](https://jestjs.io/docs/configuration)
- [TypeORM Testing](https://typeorm.io/#/e2e-testing)

---

**最后更新**: 2026-02-01
**维护者**: Dev Team
