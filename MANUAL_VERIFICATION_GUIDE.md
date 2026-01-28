# 📖 Story 1.4 手动验证指南

**验证日期**: 2026-01-26
**Story**: 1-4-unified-navigation-and-first-login-guidance
**验证方式**: 手动测试

---

## 🚀 准备工作

### 1. 启动服务器

**后端服务器**:
```bash
cd backend
npm run start:dev
```
✅ 确认看到: `Nest application successfully started`
✅ 确认端口: `http://localhost:3000` (API 服务器)

**前端服务器**:
```bash
cd frontend
npm run dev
```
✅ 确认看到: `ready - started server on 0.0.0.0:3001`
✅ 确认端口: `http://localhost:3001` (Web 界面)

---

## 📋 验收标准检查清单

### ✅ AC 1: 项目主页添加 Radar Service 入口

**步骤**:
1. 打开浏览器访问: `http://localhost:3001`
2. 登录系统（如果需要）
3. 进入任意项目详情页

**预期结果**:
- ✅ 在项目详情页看到 "Radar Service" 入口
- ✅ 入口可能显示为按钮、卡片或链接
- ✅ 点击后导航到 `/radar?orgId={organizationId}`

**检查点**:
```javascript
// 在浏览器控制台执行
window.location.pathname === '/projects/{projectId}'
// 应该能看到 Radar Service 相关的 UI 元素
```

---

### ✅ AC 2: 首次访问 Radar Service 显示引导弹窗

**步骤**:
1. 打开浏览器开发者工具 (F12)
2. 访问: `http://localhost:3001/radar?orgId=test-org-id`
3. 或者通过项目主页点击 Radar Service 入口

**预期结果**:
- ✅ 页面加载后自动弹出引导向导对话框
- ✅ 对话框标题: "欢迎使用 Radar Service！"
- ✅ 副标题: "让我们设置您的雷达偏好，只需3步即可完成配置"
- ✅ 显示 3 步骤的进度条
- ✅ 显示 "薄弱项识别"、"关注技术领域"、"关注同业机构" 三个步骤标签

**浏览器控制台验证**:
```javascript
// 检查 onboarding 状态
localStorage.getItem('radar_onboarding_test-org-id')
// 应该返回 null (首次访问)
```

---

### ✅ AC 3: 引导步骤 1 - 薄弱项识别

**步骤**:
1. 在 Onboarding Wizard 对话框中
2. 查看第一步内容

**预期结果**:
- ✅ 标题显示: "系统已自动识别您的薄弱项"
- ✅ 说明文字: "Radar Service将优先推送与这些薄弱项相关的技术趋势..."
- ✅ 显示薄弱项列表（最多 5 个）
- ✅ 每个薄弱项显示:
  - 薄弱项名称
  - 等级标签 (红色 `等级 3` 或橙色 `等级 1/2`)
  - 项数统计

**如果无薄弱项数据**:
- ✅ 显示提示: "暂无薄弱项数据。完成评估后，系统将自动识别并显示薄弱项。"

**API 验证** (在控制台):
```javascript
// 检查薄弱项 API 调用
fetch('/organizations/test-org-id/weaknesses/aggregated')
  .then(r => r.json())
  .then(d => console.log('薄弱项数据:', d))
```

**按钮状态**:
- ✅ "跳过" 按钮 - 可点击
- ✅ "上一步" 按钮 - 禁用（灰色）
- ✅ "下一步" 按钮 - 可点击

---

### ✅ AC 4: 引导步骤 2 - 关注技术领域

**步骤**:
1. 点击 "下一步" 按钮
2. 进入技术领域选择步骤

**预期结果**:
- ✅ 标题显示: "选择您关注的技术领域"
- ✅ 说明文字: "Radar Service将推送这些领域的技术趋势..."
- ✅ 显示一个自动完成的输入框
- ✅ 输入框占位符: "选择或输入技术领域"
- ✅ 预设选项包含:
  - 云原生
  - AI应用
  - 移动金融安全
  - 成本优化
  - 微服务架构
  - DevOps
  - 区块链技术
  - 大数据分析
- ✅ 支持自定义输入（自由文本）
- ✅ 支持多选
- ✅ 选中的项显示为标签（Chip）

**测试操作**:
1. 点击输入框，查看下拉列表
2. 选择 "云原生"
3. 选择 "AI应用"
4. 尝试输入自定义技术领域（如 "量子计算"）
5. 查看选中的标签显示

**按钮状态**:
- ✅ "跳过" 按钮 - 可点击
- ✅ "上一步" 按钮 - 可点击
- ✅ "下一步" 按钮 - 可点击

---

### ✅ AC 5: 引导步骤 3 - 关注同业机构

**步骤**:
1. 点击 "下一步" 按钮
2. 进入同业机构选择步骤

**预期结果**:
- ✅ 标题显示: "选择您关注的同业机构"
- ✅ 说明文字: "Radar Service将推送这些机构的技术实践案例..."
- ✅ 显示一个自动完成的输入框
- ✅ 输入框占位符: "选择或输入机构名称"
- ✅ 预设选项包含:
  - 杭州银行
  - 绍兴银行
  - 招商银行
  - 宁波银行
  - 浙江农信
  - 温州银行
- ✅ 支持自定义输入机构名称
- ✅ 支持多选
- ✅ 选中的机构显示为标签

**测试操作**:
1. 点击输入框，查看下拉列表
2. 选择 "杭州银行"
3. 选择 "招商银行"
4. 尝试输入自定义机构（如 "建设银行"）
5. 查看选中的标签显示

**按钮状态**:
- ✅ "跳过" 按钮 - 可点击
- ✅ "上一步" 按钮 - 可点击
- ✅ "完成" 按钮 - 可点击（步骤 3 的下一步按钮文字变为"完成"）

---

### ✅ AC 6: 引导完成和雷达激活

**步骤**:
1. 在步骤 3 中选择一些同业机构
2. 点击 "完成" 按钮
3. 等待提交完成

**预期结果**:

**6.1 API 调用**:
- ✅ 调用 `POST /organizations/{orgId}/watched-topics/batch`
- ✅ 调用 `POST /organizations/{orgId}/watched-peers/batch`
- ✅ 调用 `POST /organizations/{orgId}/radar-activate`
- ✅ 所有 API 返回 200 或 201 状态码

**浏览器控制台查看网络请求**:
```javascript
// 打开 Network 标签
// 查看以下请求:
// 1. watched-topics/batch - 状态: 201
// 2. watched-peers/batch - 状态: 201
// 3. radar-activate - 状态: 200
```

**6.2 localStorage 状态更新**:
```javascript
// 检查 localStorage
localStorage.getItem('radar_onboarding_test-org-id')
// 应该返回: 'true'
```

**6.3 UI 更新**:
- ✅ Onboarding Wizard 对话框关闭
- ✅ 页面不刷新（使用状态更新，而不是 window.location.reload()）
- ✅ Radar Dashboard 页面显示
- ✅ 显示 "✓ Radar已激活" 按钮或徽章
- ✅ 按钮颜色为绿色（success color）

**6.4 Radar Dashboard 内容**:
- ✅ 显示三大雷达卡片:
  - 🔵 技术雷达 (蓝色)
  - 🟠 行业雷达 (橙色)
  - 🔴 合规雷达 (红色)
- ✅ 每个卡片包含:
  - 图标
  - 标题
  - 描述文字
  - "进入雷达" 按钮

**6.5 再次访问**:
```javascript
// 刷新页面或重新访问 /radar?orgId=test-org-id
// Onboarding Wizard 不应该再显示
```

---

### ✅ AC 7: 统一导航和面包屑

**步骤**:
1. 在 Radar Dashboard 页面
2. 检查导航栏和面包屑

**预期结果**:

**7.1 顶部导航栏**:
- ✅ 显示项目/组织名称
- ✅ 显示当前用户信息
- ✅ 导航链接可点击

**7.2 面包屑导航**:
- ✅ 显示层级路径
- ✅ 格式: `首页 / 组织 / Radar Service` 或类似
- ✅ 每个面包屑项可点击
- ✅ 点击后正确跳转

**7.3 页面标题**:
- ✅ 浏览器标签页显示正确的标题
- ✅ 包含 "Radar Service" 文字

**7.4 导航一致性**:
- ✅ 所有 Radar 子页面（技术雷达、行业雷达、合规雷达）保持一致的导航样式
- ✅ 返回按钮正常工作

---

## 🔍 详细测试场景

### 场景 1: 完整的首次访问流程

**前置条件**:
- 清除浏览器 localStorage
- 清除浏览器 cookies

**步骤**:
1. 访问 `http://localhost:3001`
2. 登录系统
3. 进入项目详情页
4. 点击 "Radar Service" 入口
5. 完成 Onboarding Wizard 的 3 个步骤
6. 选择 2-3 个技术领域
7. 选择 2-3 个同业机构
8. 点击 "完成"

**预期结果**:
- ✅ 所有步骤流畅无卡顿
- ✅ 无 JavaScript 错误
- ✅ 无网络请求失败
- ✅ 提交成功后引导消失
- ✅ Radar 激活状态正确显示

---

### 场景 2: 跳过 Onboarding

**步骤**:
1. 访问 `/radar?orgId=test-org-id-2`
2. Onboarding Wizard 出现
3. 点击 "跳过" 按钮

**预期结果**:
- ✅ Onboarding Wizard 关闭
- ✅ 显示 Radar Dashboard（未激活状态）
- ✅ 显示 "激活 Radar Service" 按钮（非选中状态）
- ✅ 可以点击按钮重新打开 Onboarding

---

### 场景 3: 分步骤导航

**步骤**:
1. 打开 Onboarding Wizard
2. 在步骤 1 点击 "下一步" → 进入步骤 2
3. 在步骤 2 点击 "上一步" → 返回步骤 1
4. 再次点击 "下一步" → 进入步骤 2
5. 在步骤 2 点击 "下一步" → 进入步骤 3
6. 在步骤 3 点击 "上一步" → 返回步骤 2

**预期结果**:
- ✅ 每次切换步骤流畅
- ✅ 之前选择的选项保留（技术领域、同业机构）
- ✅ 进度条正确更新
- ✅ 按钮状态正确切换

---

### 场景 4: API 错误处理

**前置条件**: 停止后端服务器

**步骤**:
1. 打开 Onboarding Wizard
2. 选择技术领域和同业机构
3. 点击 "完成"

**预期结果**:
- ✅ 显示错误提示信息
- ✅ 不关闭 Onboarding Wizard
- ✅ "完成" 按钮不再显示加载状态
- ✅ 用户可以修改选择后重试

---

### 场景 5: 雷达卡片导航

**步骤**:
1. 完成 Onboarding
2. 在 Radar Dashboard 页面
3. 点击 "技术雷达" 卡片的 "进入雷达" 按钮

**预期结果**:
- ✅ 导航到 `/radar/tech?orgId=test-org-id`
- ✅ 显示占位页面或实际内容
- ✅ 面包屑正确更新

---

## 🐛 常见问题排查

### 问题 1: Onboarding Wizard 不显示

**可能原因**:
- localStorage 中已经记录了完成状态

**解决方法**:
```javascript
// 在浏览器控制台执行
localStorage.clear()
// 或者删除特定的 key
localStorage.removeItem('radar_onboarding_test-org-id')
```

---

### 问题 2: API 请求失败 (404)

**检查项**:
1. 后端服务器是否运行: `http://localhost:3001`
2. 检查 API 路径是否正确（不应该有 `/api` 前缀）
3. 检查 orgId 参数是否有效

**验证方法**:
```javascript
// 在控制台测试 API
fetch('/organizations/test-org-id/radar-status')
  .then(r => console.log('状态:', r.status))
  .catch(e => console.error('错误:', e))
```

---

### 问题 3: 页面空白或报错

**检查步骤**:
1. 打开浏览器控制台（F12）
2. 查看 Console 标签页的 JavaScript 错误
3. 查看 Network 标签页的网络请求
4. 截图错误信息

**常见错误**:
- `useSearchParams() should be wrapped in a suspense boundary` → 已修复，应该不会出现
- `localStorage is not defined` → 已修复，应该不会出现

---

### 问题 4: 薄弱项不显示

**可能原因**:
- 组织还没有评估数据
- API 返回空数组

**验证方法**:
```javascript
// 检查薄弱项 API
fetch('/organizations/test-org-id/weaknesses/aggregated')
  .then(r => r.json())
  .then(d => {
    console.log('薄弱项数据:', d)
    console.log('数量:', d.data?.length || 0)
  })
```

**预期**: 即使没有薄弱项，也应该显示提示信息

---

## ✅ 验收标准总结

| AC | 描述 | 状态 | 备注 |
|----|------|------|------|
| AC 1 | 项目主页添加 Radar Service 入口 | ⬜ | 在项目详情页查找入口 |
| AC 2 | 首次访问显示引导弹窗 | ⬜ | 检查 localStorage 为空时是否显示 |
| AC 3 | 引导步骤1 - 薄弱项识别 | ⬜ | 检查薄弱项列表显示 |
| AC 4 | 引导步骤2 - 关注技术领域 | ⬜ | 测试多选和自定义输入 |
| AC 5 | 引导步骤3 - 关注同业机构 | ⬜ | 测试多选和自定义输入 |
| AC 6 | 引导完成和雷达激活 | ⬜ | 检查 API 调用和状态更新 |
| AC 7 | 统一导航和面包屑 | ⬜ | 检查导航栏和面包屑显示 |

---

## 📝 验证记录模板

**验证人**: ___________
**验证日期**: ___________
**环境**: ☐ 开发环境  ☐ 测试环境

### 验证结果

| AC | 通过 | 失败 | 备注 |
|----|------|------|------|
| AC 1 | ⬜ | ⬜ | |
| AC 2 | ⬜ | ⬜ | |
| AC 3 | ⬜ | ⬜ | |
| AC 4 | ⬜ | ⬜ | |
| AC 5 | ⬜ | ⬜ | |
| AC 6 | ⬜ | ⬜ | |
| AC 7 | ⬜ | ⬜ | |

### 发现的问题

1. _
2. _
3. _

### 总体评价

- ⬜ 所有 AC 通过，可以合并
- ⬜ 部分 AC 失败，需要修复
- ⬜ 阻塞性问题，需要立即处理

---

## 🎯 快速验证命令

在浏览器控制台执行以下命令进行快速验证：

```javascript
// 1. 检查当前路由
console.log('当前路径:', window.location.pathname)
console.log('Org ID:', new URLSearchParams(window.location.search).get('orgId'))

// 2. 检查 onboarding 状态
const orgId = new URLSearchParams(window.location.search).get('orgId')
console.log('Onboarding 状态:', localStorage.getItem(`radar_onboarding_${orgId}`))

// 3. 测试薄弱项 API
fetch(`/organizations/${orgId}/weaknesses/aggregated`)
  .then(r => r.json())
  .then(d => console.log('薄弱项:', d))

// 4. 测试雷达状态 API
fetch(`/organizations/${orgId}/radar-status`)
  .then(r => r.json())
  .then(d => console.log('雷达状态:', d))

// 5. 清除 onboarding 状态（重新测试用）
// localStorage.removeItem(`radar_onboarding_${orgId}`)
// location.reload()
```

---

**验证完成后，请将结果反馈给开发团队！** 🚀
