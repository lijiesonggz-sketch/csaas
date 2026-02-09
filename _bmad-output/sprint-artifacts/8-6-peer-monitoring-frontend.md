---
epic: epic-8
story: 8-6-peer-monitoring-frontend
status: story-completed
completed-date: 2026-02-09
---

# Story 8.6: 同业动态前端展示增强

## 用户故事

**As a** 金融机构 IT 总监,
**I want** 在行业雷达页面看到与我关注同业相关的动态,
**So that** 我可以及时了解标杆机构的技术实践。

## 验收标准

### AC1: 同业动态卡片展示
**Given** 用户访问 /radar/industry
**When** 页面加载
**Then** 显示同业动态推送卡片
**And** 卡片显示"与您关注的XX银行相关"标签
**And** 卡片显示同业实践详情：成本、周期、效果

### AC2: 卡片内容格式
**Given** 同业动态推送卡片显示
**When** 渲染卡片
**Then** 卡片包含：
  - 同业机构名称和logo（如有）
  - "同业动态"标签（区别于普通行业雷达内容）
  - 实践描述摘要
  - 投入成本、实施周期、技术效果
  - 相关性标注
  - 查看详情按钮

### AC3: 详情弹窗
**Given** 用户点击"查看详情"
**When** 详情弹窗打开
**Then** 显示完整同业案例信息：
  - 同业机构背景
  - 技术实践详细描述
  - 投入成本/实施周期/效果
  - 可借鉴点总结
  - 信息来源和发布日期
  - 相关技术标签

### AC4: 关注同业筛选
**Given** 用户筛选关注同业
**When** 使用筛选器
**Then** 仅显示 peerName 匹配 WatchedPeer 的推送
**And** 高亮显示关注的同业机构名称

## 技术规范

### 组件设计
```typescript
// 同业动态卡片组件
interface PeerMonitoringCardProps {
  push: {
    id: string
    pushType: 'peer-monitoring' | 'industry' | 'tech' | 'compliance'  // 标识推送类型
    peerName: string
    peerLogo?: string
    practiceDescription: string
    estimatedCost: string
    implementationPeriod: string
    technicalEffect: string
    relevanceScore: number
    priorityLevel: 'high' | 'medium' | 'low'
    sentAt: string
    isRead: boolean
    source?: string        // 信息来源
    publishDate?: string   // 发布日期
    tags?: string[]        // 相关技术标签
  }
  isWatchedPeer: boolean
  onMarkAsRead: () => void
  onViewDetail: () => void
}

// 详情弹窗组件
interface PeerMonitoringDetailModalProps {
  open: boolean
  push: {
    id: string
    pushType: 'peer-monitoring'
    peerName: string
    peerLogo?: string
    peerBackground?: string           // 同业机构背景
    practiceDescription: string
    estimatedCost: string
    implementationPeriod: string
    technicalEffect: string
    learnablePoints?: string[]        // 可借鉴点总结
    source: string                    // 信息来源
    publishDate: string               // 发布日期
    tags: string[]                    // 相关技术标签
    relevanceScore: number
    priorityLevel: 'high' | 'medium' | 'low'
    isRead: boolean
    isBookmarked: boolean
  }
  onClose: () => void
  onBookmark: () => void
  onMarkAsRead: () => void
}
```

### 页面修改
修改 `app/radar/industry/page.tsx`：
- 添加同业动态推送列表（pushType='peer-monitoring'）
- 添加"与我关注的同业相关"筛选器
- 添加同业动态卡片渲染逻辑

**组件复用策略:**
- **方案A（推荐）**: 扩展现有 `PushCard` 组件，添加 `variant='peer-monitoring'` 支持
  - 复用现有的卡片布局、样式和交互逻辑
  - 添加同业特有的字段展示（peerName、practiceDescription、estimatedCost等）
  - 保持与现有行业雷达卡片的一致性
- **方案B**: 创建独立的 `PeerMonitoringCard` 组件
  - 当同业卡片需要完全不同的交互或布局时使用
  - 注意保持视觉风格与现有卡片一致

**WebSocket 实时更新:**
```typescript
// 监听同业动态推送事件
socket.on('radar:push:new', (newPush: RadarPush) => {
  if (newPush.pushType === 'peer-monitoring') {
    // 添加到同业动态列表顶部
    setPeerPushes((prev) => [newPush, ...prev])
  }
})
```

### API 集成
```typescript
// 获取同业动态推送
GET /api/radar/pushes?pushType=peer-monitoring&organizationId={id}&radarType=industry

// 标记已读
POST /api/radar/pushes/:id/read

// 收藏推送
POST /api/radar/pushes/:id/bookmark
```

**API 错误处理:**
- 401 Unauthorized: 用户未登录，重定向到登录页
- 403 Forbidden: 用户无权限访问该组织数据
- 404 Not Found: 推送不存在或已被删除
- 500 Server Error: 显示友好错误提示，提供重试按钮

### 样式规范
- 同业动态卡片使用特殊边框颜色（主题色）
- "同业动态"标签使用 Badge 组件
- 成本、周期、效果使用 Icon + Text 组合展示
- 关注同业的卡片添加"⭐ 关注"标识

**UI 状态规范:**

1. **加载状态:**
   - 列表加载: 显示 Skeleton 卡片（3-5个占位）
   - 详情加载: 显示 CircularProgress 在弹窗中央

2. **空状态:**
   - 无同业动态: 显示友好提示"暂无关注的同业动态，请先在设置中添加关注的同业机构"
   - 筛选无结果: 显示"没有符合条件的同业动态，请调整筛选条件"

3. **错误状态:**
   - API 错误: Alert 组件显示错误信息，提供"重试"按钮
   - 网络错误: 显示离线提示，自动重试机制

4. **交互反馈:**
   - 标记已读: Toast 提示"已标记为已读"
   - 收藏成功: Toast 提示"已收藏到您的收藏夹"
   - 收藏取消: Toast 提示"已取消收藏"

## 任务拆分

### Task 1: 组件开发
- [x] 创建 PeerMonitoringCard 组件
- [x] 创建 PeerMonitoringDetailModal 组件
- [x] 创建 PeerMonitoringFilter 组件

### Task 2: 页面集成
- [x] 修改行业雷达页面
- [x] 集成同业动态推送列表
- [x] 实现筛选功能
- [x] 实现已读标记

### Task 3: API 集成
- [x] 实现同业动态推送查询
- [x] 实现已读标记 API
- [x] 实现收藏功能

### Task 4: 样式优化
- [x] 实现同业动态卡片样式
- [x] 实现详情弹窗样式
- [x] 响应式适配

### Task 5: 测试
- [x] 单元测试: PeerMonitoringCard 组件渲染和交互 (24 tests passed)
- [x] 单元测试: PeerMonitoringDetailModal 组件 (23 tests passed)
- [x] 单元测试: 筛选器逻辑
- [x] 集成测试: API 集成和错误处理
- [x] E2E 测试: 完整用户流程（查看卡片 -> 查看详情 -> 标记已读 -> 收藏）
- [x] 可访问性测试: 键盘导航、屏幕阅读器支持
