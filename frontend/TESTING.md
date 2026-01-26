# Frontend Testing Guide

## 测试框架

本项目使用以下测试框架：
- **Jest**: 测试运行器
- **React Testing Library**: React组件测试
- **jsdom**: 浏览器环境模拟

## 安装依赖

```bash
cd frontend
npm install
```

这将安装所有必需的测试依赖：
- `@testing-library/react`
- `@testing-library/jest-dom`
- `@testing-library/user-event`
- `jest`
- `jest-environment-jsdom`
- `ts-jest`

## 运行测试

### 运行所有测试
```bash
npm test
```

### 监视模式（开发时推荐）
```bash
npm run test:watch
```

### 生成覆盖率报告
```bash
npm run test:coverage
```

### 运行特定测试文件
```bash
npm test -- organizations
npm test -- useOrganizationStore
```

## 测试文件位置

```
frontend/
├── lib/
│   ├── api/
│   │   ├── organizations.ts
│   │   └── organizations.spec.ts       # API客户端测试
│   ├── stores/
│   │   ├── useOrganizationStore.ts
│   │   └── useOrganizationStore.spec.ts # Zustand store测试
│   └── types/
│       ├── organization.ts
│       └── organization.spec.ts         # 类型定义测试（占位符）
```

## 编写测试

### API测试示例

```typescript
import { OrganizationsApi } from './organizations'

describe('OrganizationsApi', () => {
  it('should fetch user organizations', async () => {
    // Arrange
    const mockOrgs = [{ id: 'org-123', name: 'Test Org' }]
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockOrgs }),
    })

    // Act
    const api = new OrganizationsApi()
    const result = await api.getUserOrganizations()

    // Assert
    expect(result).toEqual(mockOrgs)
  })
})
```

### Store测试示例

```typescript
import { renderHook, act } from '@testing-library/react'
import { useOrganizationStore } from './useOrganizationStore'

describe('useOrganizationStore', () => {
  it('should fetch organizations', async () => {
    const { result } = renderHook(() => useOrganizationStore())

    await act(async () => {
      await result.current.fetchOrganizations()
    })

    expect(result.current.organizations).toHaveLength(1)
  })
})
```

## 测试覆盖率目标

- **API层**: >80% 覆盖率
- **Store层**: >80% 覆盖率
- **组件层**: >70% 覆盖率（未来）

## CI/CD集成

在GitHub Actions中运行测试：

```yaml
- name: Run Frontend Tests
  run: |
    cd frontend
    npm install
    npm test -- --coverage
```

## 已知问题和限制

1. **Next.js App Router测试**: 某些Next.js特性需要特殊mock处理
2. **API路由测试**: 需要集成测试框架（如Supertest）
3. **WebSocket测试**: Socket.io客户端测试需要额外配置

## 下一步

- [ ] 添加组件测试（React Testing Library）
- [ ] 添加API集成测试（MSW或Supertest）
- [ ] 添加E2E测试（Playwright或Cypress）
- [ ] 设置CI测试覆盖率报告
