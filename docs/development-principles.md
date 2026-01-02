# 开发原则与教训记录

## 🎯 核心原则

### 1. 优先使用已有代码原则

**问题案例**：
- **日期**: 2026-01-02
- **任务**: 修复聚类任务三模型并行功能
- **错误做法**: 绕过已有的`ClusteringGenerator`，在`AITaskProcessor`中重新实现单模型逻辑
- **正确做法**: 直接调用已有的`ClusteringGenerator.generate()`方法

**教训**：
```typescript
// ❌ 错误：绕过已有代码，重新实现
const aiResponse = await this.aiOrchestrator.generate(request, model)

// ✅ 正确：使用已有的、测试通过的代码
const clusteringResults = await this.clusteringGenerator.generate(
  clusteringInput,
  onProgress
)
```

**执行清单**：
在实现新功能或修复bug时，必须按以下顺序检查：

1. **第一步**: 搜索现有代码库，确认是否已有类似功能
   ```bash
   # 使用Grep工具搜索相关关键词
   - 功能关键词（如"clustering", "三模型", "并行"）
   - 类名关键词（如"Generator", "Service", "Processor"）
   - 文件名关键词（如"*generator.ts", "*service.ts"）
   ```

2. **第二步**: 阅读已有代码的实现
   - 理解其设计思路和架构
   - 确认其是否已解决问题
   - 检查是否有测试覆盖

3. **第三步**: 评估是否需要修改
   - 如果已有代码完美解决问题 → 直接调用
   - 如果需要扩展 → 在现有代码基础上扩展
   - 如果需要重构 → 先与用户讨论，获得批准

4. **第四步**: 记录决策
   - 为什么选择使用/不使用已有代码
   - 如果重写，必须说明充分理由

**禁止行为**：
- ❌ 在不了解现有代码的情况下直接重写
- ❌ 绕过已有的、经过测试的解决方案
- ❌ 重复造轮子
- ❌ 为了"更快"而复制代码而不是复用

---

## 🏗️ 架构设计原则

### 2. 避免循环依赖

**案例**: AITasksModule ↔ AIGenerationModule 循环依赖

**解决方案**: 使用`forwardRef()`

```typescript
// Module A
import { Module, forwardRef } from '@nestjs/common'
import { ModuleB } from './module-b.module'

@Module({
  imports: [
    forwardRef(() => ModuleB),  // ✅ 使用forwardRef
  ],
})
export class ModuleA {}

// Module B
import { Module, forwardRef } from '@nestjs/common'
import { ModuleA } from './module-a.module'

@Module({
  imports: [
    forwardRef(() => ModuleA),  // ✅ 双向都使用forwardRef
  ],
})
export class ModuleB {}
```

**预防措施**：
- 模块设计时考虑单向依赖
- Shared模块用于通用服务
- 使用依赖注入而非直接导入

---

## 📋 代码审查检查清单

### 3. 修改代码前的必做检查

在修改任何代码之前，必须完成以下检查：

- [ ] **搜索现有实现**: 使用Grep/Glob搜索关键词
- [ ] **阅读相关代码**: 理解现有实现的设计思路
- [ ] **检查测试覆盖**: 确认是否有测试保护
- [ ] **评估复用可能性**: 是否可以直接调用或扩展
- [ ] **与用户讨论**: 如果需要重写，先说明理由获得批准
- [ ] **记录决策**: 在代码注释或文档中说明选择原因

---

## 🧪 测试原则

### 4. 修改后必须验证

**每次修改后的验证步骤**：

1. **编译检查**:
   ```bash
   npx tsc --noEmit
   ```

2. **功能测试**:
   - 运行相关功能
   - 验证所有三个模型都被调用
   - 检查日志输出

3. **回归测试**:
   - 确认没有破坏现有功能
   - 检查其他任务类型是否正常

---

## 📚 具体案例记录

### 案例1: Clustering三模型并行

**背景**:
- 用户报告聚类任务只使用GPT-4，未实现三模型并行
- 原因：Processor绕过了ClusteringGenerator

**错误做法**:
```typescript
// ❌ 在AITaskProcessor中直接调用aiOrchestrator
const aiResponse = await this.aiOrchestrator.generate({
  prompt,
  systemPrompt,
  temperature: 0.7,
  maxTokens: 30000,
}, model)  // 只调用单个模型
```

**正确做法**:
```typescript
// ✅ 调用已有的ClusteringGenerator
if (type === 'clustering') {
  const clusteringResults = await this.clusteringGenerator.generate(
    clusteringInput,
    onProgress
  )
  // 返回三个模型的结果：gpt4, claude, domestic
}
```

**关键发现**:
- `ClusteringGenerator`已实现完整的三模型并行逻辑（第175-191行）
- 使用`Promise.allSettled`并行调用
- 有超时控制、降级机制、错误处理
- 已经过充分测试

**教训**:
> "不要重新发明轮子。先搜索、理解、复用，最后才是重写。"

---

## 🎓 经验总结

### 5. 黄金法则

1. **搜索优先**: 实现任何功能前，先搜索10分钟
2. **理解再改**: 阅读现有代码，理解设计意图
3. **复用优于重写**: 除非绝对必要，否则不重写
4. **讨论决策**: 重大重写必须与用户讨论
5. **记录理由**: 每次绕过现有代码都要记录理由

### 6. 时间线参考

| 阶段 | 正确做法 | 错误做法 |
|------|---------|---------|
| 发现问题 | 搜索现有解决方案 | 直接开始写代码 |
| 分析阶段 | 阅读已有实现 | 假设需要重写 |
| 实现阶段 | 复用/扩展已有代码 | 绕过重写 |
| 测试阶段 | 验证所有功能 | 只测试新代码 |

---

## 📌 联系方式

如有疑问或需要讨论架构决策，请联系用户确认。

**重要**: 这份文档是活的，每次遇到类似情况都要更新。
