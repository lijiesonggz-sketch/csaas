---
stepsCompleted: [13]
workflowType: 'ux-design-implementation'
parentDoc: '../ux-design-specification.md'
project_name: 'Csaas'
user_name: '27937'
date: '2025-12-25'
---

# UX Implementation Guide - Csaas

**文档类型**: 实现指南（Steps 13-14）
**父文档**: [UX Design Specification](../ux-design-specification.md)
**项目**: Csaas AI咨询平台
**最后更新**: 2025-12-25

---

## 导读

本文档是Csaas UX设计规格的**实现层**，包含Steps 13-14的完整内容：

- **Step 13**: 响应式设计与无障碍策略（已完成）
- **Step 14**: 开发交付文档（待完成）

**适用人群**: 前端工程师、QA工程师、开发团队负责人

**关键输出**:
- 响应式断点策略与布局适配方案
- WCAG 2.1 A级无障碍基础实现
- 性能优化策略（虚拟滚动、SSR/CSR边界）
- 测试策略与性能SLA
- 开发交付清单

---

## Step 13: 响应式设计与无障碍策略

### 🎯 策略概览

**核心决策**（经过多智能体Party Mode审查）：
- **设计理念**：Desktop-First（桌面优先）
- **主力设备**：1920×1080桌面端（假设≥80%目标用户）
- **关键断点**：1440px（三列对比 vs 主视图切换分界线）
- **移动端定位**：只读查看模式（MVP），V1.0规划轻量级编辑
- **无障碍级别**：WCAG 2.1 A级（最低法律合规，应对国际市场）

**专家审查团队**：
- 💻 Amelia (开发工程师) - 技术实现可行性
- 🏗️ Winston (系统架构师) - 架构与扩展性
- 📋 John (产品经理) - 业务价值与用户需求
- 🧪 Murat (测试架构师) - 测试策略与质量保证

---

## 响应式策略

### 桌面端优先设计（Desktop-First）

**核心理念**：Csaas是为咨询师办公桌面环境设计的专业工具，优先优化1920×1080及以上分辨率的体验（假设≥80%目标用户使用此分辨率）。

**系统要求明示**：
- **建议分辨率**：1920×1080 或更高（获得最佳三列对比体验）
- **最低分辨率**：1024×768（功能可用，但降级为单列视图）
- **最佳浏览器**：Chrome 100+, Edge 100+ (主流咨询师浏览器)

---

### 主力设备：桌面端（≥1440px）

**目标分辨率**：1920×1080（全高清，主要支持）

**布局策略**：三列并排对比视图
- 左列：GPT-4 输出 + 评分 + 推理过程（宽度33%）
- 中列：Claude 输出 + 评分 + 推理过程（宽度33%）
- 右列：国产模型 输出 + 评分 + 推理过程（宽度33%）

**页面结构**：
- **内容最大宽度**：`max-w-[1920px] mx-auto`（超大屏4K显示器居中显示，避免过宽）
- **顶部栏**：统计面板（差异点数量、风险分布、一致性、成本）
- **底部操作区**：AI推荐 + 采纳按钮 + 手动选择
- **导航**：左侧固定导航（项目列表 → 四阶段流程 → 差异点列表）

**信息密度**：高密度，一屏展示完整差异点对比

**性能优化（Amelia建议）**：
- **虚拟滚动**：三列对比视图使用 `react-window` 实现虚拟滚动
  - **触发场景**：大文档（>500行）差异对比
  - **性能提升**：3000行文档只渲染可见区域（~50行），DOM节点从9000降至150
  - **实现方式**：

```tsx
import { FixedSizeList } from 'react-window';

// 三列对比虚拟滚动
<div className="grid grid-cols-3 gap-4 max-w-[1920px] mx-auto">
  {['gpt-4', 'claude', 'domestic'].map(model => (
    <FixedSizeList
      key={model}
      height={800}
      itemCount={diffLines.length}
      itemSize={60}
      width="100%"
    >
      {({ index, style }) => (
        <DiffLine
          key={index}
          style={style}
          line={diffLines[index]}
          model={model}
        />
      )}
    </FixedSizeList>
  ))}
</div>
```

**超大屏适配（≥2560px）**（Winston建议）：
- 内容区域最大宽度1920px，两侧留白
- 可选：两侧显示辅助面板（历史记录、快捷操作面板）

---

### 小屏桌面/笔记本（1024-1439px）

**布局调整**：主视图 + 侧边切换
- **主区域**：当前选中模型的完整输出（宽度70%）
- **侧边栏**：三模型快速切换标签 + 差异高亮指示器（宽度30%）

**导航**：左侧导航收起为图标模式

**信息密度**：中等，一次聚焦一个模型输出

**用户提示**：顶部显示提示条
> "💡 建议使用1440px以上分辨率获得最佳三列对比体验"

---

### 平板横屏（768-1023px）

**布局策略**：单列聚焦视图
- **顶部**：三模型切换标签（Tab切换）
- **主区域**：当前模型完整输出
- **底部**：差异点导航（上一个/下一个）

**导航**：汉堡菜单折叠

**信息密度**：低，一次只显示一个模型

---

### 移动端（<768px）

**定位**：只读查看模式（MVP阶段，紧急情况下查看进度）

**支持功能**：
- ✅ 查看项目列表
- ✅ 查看当前项目进度（15个差异点中已处理5个）
- ✅ 查看差异点详情（只读，垂直堆叠三模型输出）
- ❌ 编辑和采纳推荐（回到桌面再操作）

**布局**：
- 单列垂直堆叠
- 底部Tab导航（项目/进度/详情）

**V1.0规划（John建议）**：
考虑轻量级编辑功能：
- 至少支持**一键采纳AI推荐**（客户现场紧急调整场景）
- 不支持复杂的手动编辑和富文本操作

---

## 断点策略

### 断点定义（基于80%用户使用≥1920×1080假设）

```css
/* 移动端（只读查看）*/
@media (max-width: 767px) {
  /* 单列垂直堆叠，底部Tab导航 */
  .diff-viewer {
    display: flex;
    flex-direction: column;
  }
}

/* 平板横屏（简化操作）*/
@media (min-width: 768px) and (max-width: 1023px) {
  /* 单列聚焦，Tab切换 */
  .diff-viewer {
    display: flex;
    flex-direction: column;
  }
  .model-tabs {
    display: flex;
  }
}

/* 小屏笔记本（简化三列）*/
@media (min-width: 1024px) and (max-width: 1439px) {
  /* 主视图（70%）+ 侧边切换（30%）*/
  .diff-viewer {
    display: grid;
    grid-template-columns: 70% 30%;
  }
}

/* 标准桌面（主战场，1920×1080）*/
@media (min-width: 1440px) and (max-width: 2559px) {
  /* 完整三列对比视图 */
  .diff-viewer {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    max-width: 1920px;
    margin: 0 auto;
  }
}

/* 超大屏（≥2560px，4K显示器）*/
@media (min-width: 2560px) {
  /* 三列对比 + 内容最大宽度1920px居中 */
  .diff-viewer {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    max-width: 1920px;
    margin: 0 auto;
  }
  /* 可选：两侧显示辅助面板 */
}
```

### Tailwind CSS配置

```js
// tailwind.config.js
module.exports = {
  theme: {
    screens: {
      'sm': '640px',
      'md': '768px',   // 平板横屏
      'lg': '1024px',  // 小屏笔记本
      'xl': '1440px',  // 标准桌面（关键断点）
      '2xl': '2560px', // 超大屏4K
    },
    extend: {
      maxWidth: {
        'content': '1920px', // 内容最大宽度
      },
    },
  },
}
```

### 设计原则

- **Desktop-First**：先设计1920×1080完整体验，再向下适配
- **关键断点**：1440px（三列 vs 主视图切换的分界线）
- **移动端降级**：功能降级为只读查看，避免小屏复杂操作
- **MVP后数据驱动**：上线后收集用户真实分辨率分布，必要时调整断点

---

## 基础无障碍与可用性

### 无障碍定位（John建议）

**目标合规级别**：WCAG 2.1 **A级**（最基础法律合规，应对国际市场扩展）

**不追求AA/AAA级**：避免过度投入，MVP阶段控制成本

**核心原因**：
- 某些国家/地区（如美国、欧盟）有数字无障碍法规（ADA, WCAG）
- Csaas未来可能拓展国际市场，需要最低法律合规
- A级成本不高，主要是语义化HTML + 基本键盘导航 + 颜色对比度

---

### 1. 语义化HTML结构（WCAG 2.1 A级要求）

使用语义化标签提升可访问性和SEO：

```html
<!-- ✅ 推荐：语义化结构 -->
<nav aria-label="主导航">
  <ul>
    <li><a href="/projects">项目列表</a></li>
    <li><a href="/diff">差异点审查</a></li>
  </ul>
</nav>

<main>
  <section aria-labelledby="diff-comparison-heading">
    <h1 id="diff-comparison-heading">差异点对比分析</h1>

    <article aria-labelledby="gpt4-output">
      <h2 id="gpt4-output">GPT-4 输出</h2>
      <!-- 内容 -->
    </article>

    <article aria-labelledby="claude-output">
      <h2 id="claude-output">Claude 输出</h2>
      <!-- 内容 -->
    </article>
  </section>
</main>

<footer>
  <p>&copy; 2025 Csaas. All rights reserved.</p>
</footer>
```

```html
<!-- ❌ 避免：非语义化div堆叠 -->
<div class="nav">
  <div class="nav-item">项目列表</div>
</div>
<div class="content">...</div>
```

---

### 2. 颜色对比度（WCAG 2.1 A级：≥4.5:1 正文，≥3:1 大文本）

确保所有文本与背景有足够对比度，长时间阅读不累眼：

**文本颜色对比度**：

| 用途 | 前景色 | 背景色 | 对比度 | 合规级别 |
|-----|--------|--------|--------|---------|
| 正文文本 | #1F2937（深灰）| #FFFFFF（白色）| 16:1 | AAA级 ✅ |
| 次要文本 | #6B7280（中灰）| #FFFFFF（白色）| 7:1 | AA级 ✅ |
| 链接文本 | #3B82F6（蓝色）| #FFFFFF（白色）| 8.6:1 | AAA级 ✅ |
| 按钮文本 | #FFFFFF（白色）| #1E3A8A（深蓝）| 12:1 | AAA级 ✅ |

**差异高亮颜色对比度**：

| 差异类型 | 背景色 | 文本色 | 对比度 | 合规级别 |
|---------|--------|--------|--------|---------|
| 高风险差异 | #FEE2E2（浅红背景）| #DC2626（红色文本）| 5.2:1 | AA级 ✅ |
| 一致区域 | #D1FAE5（浅绿背景）| #059669（绿色文本）| 4.8:1 | AA级 ✅ |
| 中风险差异 | #FEF3C7（浅黄背景）| #CA8A04（深黄文本）| 6.1:1 | AA级 ✅ |

**颜色对比度验证工具**：
- Chrome DevTools Lighthouse
- WebAIM Contrast Checker
- axe DevTools浏览器插件

---

### 3. 键盘导航支持（WCAG 2.1 A级要求）

**所有交互元素可通过键盘访问**：

| 键盘操作 | 功能 | 实现要求 |
|---------|------|---------|
| `Tab` | 向前移动焦点 | 所有button、a、input可聚焦 |
| `Shift+Tab` | 向后移动焦点 | 焦点顺序符合视觉流程 |
| `Enter` | 激活链接/按钮 | 所有交互元素响应Enter |
| `Space` | 激活按钮/勾选框 | 按钮、checkbox响应Space |
| `Esc` | 关闭弹窗/下拉菜单 | Modal、Dropdown响应Esc |

**焦点指示（仅键盘导航时显示）**：

```css
/* ✅ 使用 :focus-visible（现代标准）*/
button:focus-visible,
a:focus-visible,
input:focus-visible {
  outline: 2px solid #3B82F6; /* 蓝色描边 */
  outline-offset: 2px;
}

/* 鼠标点击时不显示焦点框（避免视觉干扰）*/
button:focus:not(:focus-visible) {
  outline: none;
}
```

**实现方式**：
- 确保HTML元素顺序符合Tab键导航顺序
- 避免使用 `tabindex > 0`（破坏自然顺序）
- 使用 `tabindex="-1"` 将元素从Tab序列移除（如装饰性元素）

---

### 4. 键盘快捷键（提升效率 + 避免冲突）

**调整后的快捷键（避免浏览器冲突 - Amelia建议）**：

| 快捷键 | 功能 | 使用场景 | 避免冲突方式 |
|--------|------|---------|-------------|
| `Ctrl/Cmd + Shift + Enter` | 采纳AI推荐 | 80%快速采纳场景 | 避免 `Ctrl+Enter` 浏览器冲突 |
| `Alt + 1` / `Alt + 2` / `Alt + 3` | 选择GPT-4 / Claude / 国产模型 | 手动选择模型 | 避免单键 `1/2/3` 冲突输入 |
| `Alt + ←` / `Alt + →` | 上一个/下一个差异点 | 快速导航 | Alt组合键较少冲突 |
| `Ctrl/Cmd + Shift + S` | 保存当前进度 | 防止丢失 | 避免 `Ctrl+S` 浏览器保存冲突 |
| `Ctrl/Cmd + Shift + E` | 导出完整PDF | 完成后快速导出 | Shift组合避免冲突 |
| `Esc` | 关闭当前弹窗 | 快速退出 | 标准快捷键 |

**实现方式（react-hotkeys-hook）**：

```tsx
import { useHotkeys } from 'react-hotkeys-hook';

// 采纳AI推荐（拦截浏览器默认行为）
useHotkeys('ctrl+shift+enter, cmd+shift+enter', (e) => {
  e.preventDefault();
  handleAcceptRecommendation();
}, { enableOnFormTags: true });

// 模型选择
useHotkeys('alt+1', () => selectModel('gpt-4'));
useHotkeys('alt+2', () => selectModel('claude'));
useHotkeys('alt+3', () => selectModel('domestic'));

// 差异点导航
useHotkeys('alt+left', () => navigateToPrevDiff());
useHotkeys('alt+right', () => navigateToNextDiff());

// 保存进度（拦截浏览器保存）
useHotkeys('ctrl+shift+s, cmd+shift+s', (e) => {
  e.preventDefault();
  handleSave();
}, { enableOnFormTags: true });
```

**快捷键提示UI**：

```tsx
// 页面底部快捷键提示组件（可折叠）
<KeyboardShortcutsPanel>
  <h3>键盘快捷键</h3>
  <ul>
    <li><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Enter</kbd> - 采纳AI推荐</li>
    <li><kbd>Alt</kbd> + <kbd>1/2/3</kbd> - 选择模型</li>
    <li><kbd>Alt</kbd> + <kbd>←/→</kbd> - 上一个/下一个差异点</li>
    <li><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> - 保存进度</li>
  </ul>
</KeyboardShortcutsPanel>
```

**首次使用引导**：
- 用户首次进入差异点审查页面时，显示快捷键引导
- "使用 `Ctrl+Shift+Enter` 快速采纳AI推荐，提升审查效率！"
- 用户可选择"不再显示"

---

### 5. ARIA标签（屏幕阅读器基础支持）

虽然不做深度屏幕阅读器优化，但添加基础ARIA标签提升可访问性：

```html
<!-- 按钮明确标签 -->
<button
  aria-label="采纳AI推荐的GPT-4输出"
  onClick={handleAcceptGPT4}
>
  采纳推荐
</button>

<!-- 动态内容通知（屏幕阅读器会朗读更新）-->
<div role="status" aria-live="polite">
  差异点已更新：15个差异点中已处理5个
</div>

<!-- 加载状态 -->
<div role="alert" aria-live="assertive">
  正在生成AI对比分析，请稍候...
</div>

<!-- 导航地标 -->
<nav aria-label="项目导航">
  <ul>
    <li><a href="/projects">项目列表</a></li>
  </ul>
</nav>

<!-- 表单标签关联 -->
<label for="project-name">项目名称</label>
<input id="project-name" type="text" name="projectName" />
```

**ARIA最佳实践**：
- 优先使用语义化HTML，ARIA作为补充
- 不滥用ARIA：`<button>` 优于 `<div role="button">`
- 确保 `aria-label` 描述清晰具体

---

### 6. 触摸目标大小（WCAG 2.1 A级：≥44×44px）

确保所有可点击元素有足够的触摸区域（桌面鼠标 + 平板触摸）：

| 元素类型 | 最小尺寸 | 应用场景 |
|---------|---------|---------|
| 按钮（主要操作）| 48×48px | 采纳推荐、保存、导出 |
| 按钮（次要操作）| 44×44px | 取消、返回 |
| 链接文本 | 行高≥48px | 项目列表项、差异点列表项 |
| 差异点列表项 | 60×∞px | 方便点击选择 |
| Tab切换标签 | 80×48px | 三模型切换 |
| 图标按钮 | 44×44px | 编辑、删除、复制 |

**实现方式**：

```css
/* 按钮最小尺寸 */
.btn-primary {
  min-width: 120px;
  min-height: 48px;
  padding: 12px 24px;
}

.btn-secondary {
  min-width: 100px;
  min-height: 44px;
  padding: 10px 20px;
}

/* 差异点列表项 */
.diff-item {
  min-height: 60px;
  padding: 16px;
  cursor: pointer;
}

/* 图标按钮增加可点击区域 */
.icon-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

**桌面端优化**：
- 桌面端鼠标精度高，可适当缩小（但不低于36×36px）
- 移动端/平板严格遵守44×44px最小尺寸

---

## 技术实现细节

### SSR/CSR边界定义（Winston建议）

明确哪些组件服务端渲染（SSR），哪些客户端渲染（CSR），优化首屏性能和交互体验：

**服务端渲染（SSR）组件**：

| 组件 | 原因 | 实现方式 |
|-----|------|---------|
| 项目列表页 | SEO友好，首屏加载快 | Next.js App Router默认SSR |
| 项目概览/进度统计 | 静态内容，服务端生成 | 使用 `async` 组件 |
| 用户导航/菜单 | 全局组件，SSR预渲染 | Layout组件SSR |
| 公共页面（关于、帮助）| SEO需要 | 静态页面SSR |

**客户端渲染（CSR）组件**：

| 组件 | 原因 | 实现方式 |
|-----|------|---------|
| 三列差异对比视图 | 数据量大，交互复杂，CSR更高效 | `'use client'` directive |
| 实时编辑器 | 富文本编辑，必须CSR | `'use client'` + Quill/TipTap |
| AI推荐动态更新 | WebSocket实时推送，CSR | `'use client'` + Socket.IO |
| 虚拟滚动列表 | 需要DOM操作，CSR | `'use client'` + react-window |

**实现方式（Next.js 14 App Router）**：

```tsx
// ✅ SSR：项目列表页
// app/projects/page.tsx
export default async function ProjectsPage() {
  const projects = await fetchProjects(); // 服务端获取数据
  return <ProjectList projects={projects} />;
}

// ✅ CSR：差异点对比页
// app/projects/[id]/diff/page.tsx
'use client'; // 显式声明客户端组件

import { DiffViewer } from '@/components/DiffViewer';

export default function DiffComparisonPage() {
  return <DiffViewer />;
}

// ✅ 混合：服务端Layout + 客户端交互
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Header /> {/* SSR */}
        <main>{children}</main> {/* SSR或CSR取决于子页面 */}
        <Footer /> {/* SSR */}
      </body>
    </html>
  );
}
```

**缓存策略（ISR - Incremental Static Regeneration）**：

```tsx
// 项目列表页使用ISR，每60秒重新生成
export const revalidate = 60;

export default async function ProjectsPage() {
  const projects = await fetchProjects();
  return <ProjectList projects={projects} />;
}
```

---

### 响应式系统统一（Tailwind Only - Amelia建议）

**决策：只用Tailwind CSS做布局，Ant Design只用组件**

避免混用两个响应式系统，降低维护复杂度。

**✅ 推荐用法：**

```tsx
// ✅ Tailwind响应式布局
<div className="
  flex flex-col          /* 移动端：垂直堆叠 */
  md:flex-row            /* 平板：水平排列 */
  xl:grid xl:grid-cols-3 /* 桌面（≥1440px）：三列对比 */
  gap-4
  max-w-[1920px] mx-auto /* 超大屏居中 */
">
  <ModelOutput model="gpt-4" />
  <ModelOutput model="claude" />
  <ModelOutput model="domestic" />
</div>

// ✅ Ant Design只用组件
import { Button, Form, Table, Modal } from 'antd';

<Button type="primary" size="large">
  采纳推荐
</Button>

<Form layout="vertical">
  <Form.Item label="项目名称">
    <Input />
  </Form.Item>
</Form>

<Table
  columns={columns}
  dataSource={diffData}
  pagination={{ pageSize: 20 }}
/>
```

**❌ 避免用法：**

```tsx
// ❌ 不推荐：混用Ant Design Grid和Tailwind
import { Row, Col } from 'antd';

<Row gutter={[16, 16]} className="xl:grid xl:grid-cols-3">
  <Col xs={24} md={24} xl={8}>...</Col>
</Row>
```

**原因**：
- 两个响应式系统断点不一致（Ant Design: xs/sm/md/lg/xl/xxl vs Tailwind: sm/md/lg/xl/2xl）
- 混用导致维护困惑，团队需要记住两套规则
- Tailwind更灵活，Ant Design Grid较重

---

### 虚拟滚动实现（大文档性能优化 - Amelia建议）

**问题**：三列对比视图渲染大文档（3000+行PRD）时，DOM节点过多导致卡顿。

**解决方案**：使用 `react-window` 虚拟滚动，只渲染可见区域。

**性能提升**：
- **无虚拟滚动**：3000行 × 3列 = 9000个DOM节点 → 首次渲染>5秒，滚动卡顿
- **有虚拟滚动**：只渲染可见区域（~50行）× 3列 = 150个DOM节点 → 首次渲染<1秒，滚动流畅60fps

**实现代码**：

```tsx
import { FixedSizeList } from 'react-window';

interface DiffLine {
  id: string;
  content: string;
  type: 'added' | 'removed' | 'unchanged';
  gpt4Score: number;
  claudeScore: number;
  domesticScore: number;
}

// 三列对比虚拟滚动组件
export function DiffComparison({ diffLines }: { diffLines: DiffLine[] }) {
  const models = ['gpt-4', 'claude', 'domestic'];

  return (
    <div className="grid grid-cols-3 gap-4 max-w-[1920px] mx-auto">
      {models.map(model => (
        <div key={model} className="border rounded">
          <h2 className="p-4 bg-gray-50 font-semibold">
            {model === 'gpt-4' ? 'GPT-4' : model === 'claude' ? 'Claude' : '国产模型'}
          </h2>

          <FixedSizeList
            height={800}           // 可见区域高度
            itemCount={diffLines.length}
            itemSize={60}          // 每行高度
            width="100%"
          >
            {({ index, style }) => (
              <DiffLineItem
                key={diffLines[index].id}
                style={style}
                line={diffLines[index]}
                model={model}
              />
            )}
          </FixedSizeList>
        </div>
      ))}
    </div>
  );
}

// 单行差异组件
function DiffLineItem({
  line,
  model,
  style
}: {
  line: DiffLine;
  model: string;
  style: React.CSSProperties;
}) {
  const score = model === 'gpt-4' ? line.gpt4Score
              : model === 'claude' ? line.claudeScore
              : line.domesticScore;

  return (
    <div
      style={style}
      className={`
        p-3 border-b
        ${line.type === 'added' ? 'bg-green-50' : ''}
        ${line.type === 'removed' ? 'bg-red-50' : ''}
      `}
    >
      <div className="flex justify-between items-center">
        <span className="text-sm">{line.content}</span>
        <span className="text-xs text-gray-500">评分: {score}</span>
      </div>
    </div>
  );
}
```

**触发条件**：
- 文档 **>500行** 自动启用虚拟滚动
- 文档 **≤500行** 使用普通渲染（避免过度优化）

**滚动同步（可选）**：
如果需要三列滚动同步（用户在GPT-4列滚动，Claude和国产模型列跟随滚动）：

```tsx
import { useRef } from 'react';

export function DiffComparison({ diffLines }: { diffLines: DiffLine[] }) {
  const listRefs = useRef<Array<FixedSizeList | null>>([]);

  const handleScroll = ({ scrollOffset }: { scrollOffset: number }) => {
    // 同步三列滚动位置
    listRefs.current.forEach(list => {
      if (list) {
        list.scrollTo(scrollOffset);
      }
    });
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {models.map((model, index) => (
        <FixedSizeList
          ref={el => listRefs.current[index] = el}
          onScroll={handleScroll}
          height={800}
          itemCount={diffLines.length}
          itemSize={60}
          width="100%"
        >
          {/* ... */}
        </FixedSizeList>
      ))}
    </div>
  );
}
```

---

## 测试策略

### 响应式测试

#### 桌面端测试（主要）

**浏览器兼容测试**：

| 浏览器 | 版本 | 优先级 | 测试范围 |
|-------|------|--------|---------|
| Chrome | 100+ | 高（主要浏览器）| 全功能测试 |
| Edge | 100+ | 高（主要浏览器）| 全功能测试 |
| Firefox | 100+ | 中（次要浏览器）| 核心功能测试 |
| Safari on Mac | 16+ | 中（Murat建议）| Browserstack测试，避免布局Bug |

**分辨率测试**：

| 分辨率 | 布局模式 | 测试工具 | 测试重点 |
|-------|---------|---------|---------|
| 1920×1080 | 三列对比 | Chrome DevTools | 完整功能，主战场 |
| 1440×900 | 三列对比 | Chrome DevTools | 边界情况 |
| 1366×768 | 主视图+侧边 | Chrome DevTools | 降级体验验证 |
| 2560×1440 | 三列对比居中 | 实际4K显示器 | 超大屏适配 |

**实际设备测试**：
- ✅ 27寸显示器（1920×1080）
- ✅ 15寸笔记本（1366×768）
- ✅ 4K显示器（2560×1440）

**虚拟滚动性能测试**：
- ✅ 3000行文档滚动流畅度（目标≥50fps）
- ✅ 内存占用（虚拟滚动 vs 完整渲染对比）

---

#### 移动端测试（次要）

**模拟器测试**：

| 设备 | 分辨率 | 测试重点 |
|-----|--------|---------|
| iPhone 12 Pro | 390×844 | 只读查看，垂直堆叠 |
| iPad Air | 820×1180 | 横屏Tab切换 |
| Android手机 | 360×800 | 底部Tab导航 |

**真实设备测试（Murat建议）**：
- ✅ iPhone 13（iOS Safari） - 避免Safari特有Bug
- ✅ iPad Air（iPadOS Safari） - 平板横屏体验
- ✅ Android平板（Chrome） - Android兼容性

**测试功能**：
- ✅ 查看项目列表
- ✅ 查看进度统计
- ✅ 查看差异点详情（垂直堆叠三模型）
- ❌ 编辑功能（MVP不支持）

---

### 性能测试（明确SLA - Murat建议）

**性能服务级别协议（Performance SLA）**：

| 指标 | 目标值 | 测试条件 | 测量工具 | 失败阈值 |
|-----|--------|---------|---------|---------|
| **首屏加载时间（LCP）** | <2秒 | 1920×1080, 4G网络 | Lighthouse | >3秒需优化 |
| **三列对比首次渲染（FCP）** | <2秒 | 1000行文档，1920×1080 | Chrome DevTools Performance | >3秒需优化 |
| **滚动帧率（FPS）** | ≥50fps | 3000行文档，虚拟滚动 | Chrome FPS Meter | <30fps不可接受 |
| **差异高亮切换** | <100ms | 用户点击模型切换按钮 | React Profiler | >200ms影响体验 |
| **键盘快捷键响应** | <50ms | 按下快捷键到功能执行 | 手动测试 + 计时 | >100ms影响体验 |
| **内存占用** | <500MB | 3000行文档，虚拟滚动 | Chrome Memory Profiler | >800MB需优化 |

**测试场景**：

```tsx
// Lighthouse CI配置（自动化性能测试）
// .lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000/projects',
        'http://localhost:3000/projects/123/diff',
      ],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
  },
};
```

**性能回归测试**：
- 每次发布前跑性能测试套件
- 性能指标劣化>10%需排查原因并优化
- 集成到CI/CD流程（GitHub Actions）

---

### 无障碍测试（WCAG 2.1 A级验证）

**自动化测试**：

| 工具 | 测试范围 | 使用频率 |
|-----|---------|---------|
| Lighthouse Accessibility | 全页面WCAG审计 | 每次发布前 |
| axe DevTools | 浏览器插件，实时检测违规 | 开发中实时 |
| WebAIM Contrast Checker | 颜色对比度检查 | 设计阶段一次 |

**实现方式（Playwright自动化）**：

```tsx
// tests/accessibility.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('无障碍测试', () => {
  test('差异点对比页符合WCAG 2.1 A级', async ({ page }) => {
    await page.goto('/projects/123/diff');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag21a']) // 只测试A级
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('所有按钮有明确的aria-label', async ({ page }) => {
    await page.goto('/projects/123/diff');

    const buttons = await page.locator('button').all();
    for (const button of buttons) {
      const ariaLabel = await button.getAttribute('aria-label');
      const textContent = await button.textContent();

      // 按钮必须有aria-label或文本内容
      expect(ariaLabel || textContent).toBeTruthy();
    }
  });
});
```

---

#### 键盘导航测试（测试矩阵 - Murat建议）

**测试矩阵**：6个快捷键 × 3个OS × 3个浏览器 = 54个测试用例

**自动化测试（Playwright）**：

```tsx
// tests/keyboard-shortcuts.spec.ts
import { test, expect } from '@playwright/test';

test.describe('键盘快捷键测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects/123/diff');
  });

  test('Ctrl+Shift+Enter 采纳AI推荐', async ({ page }) => {
    await page.keyboard.press('Control+Shift+Enter');
    await expect(page.locator('[data-testid="recommendation-accepted"]'))
      .toBeVisible();
  });

  test('Alt+1 选择GPT-4', async ({ page }) => {
    await page.keyboard.press('Alt+1');
    await expect(page.locator('[data-model="gpt-4"]'))
      .toHaveClass(/active/);
  });

  test('Alt+→ 下一个差异点', async ({ page }) => {
    const initialDiff = await page.locator('[data-testid="current-diff"]')
      .getAttribute('data-diff-id');

    await page.keyboard.press('Alt+ArrowRight');

    const newDiff = await page.locator('[data-testid="current-diff"]')
      .getAttribute('data-diff-id');

    expect(newDiff).not.toBe(initialDiff);
  });

  test('Esc 关闭弹窗', async ({ page }) => {
    await page.click('[data-testid="open-modal"]');
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });
});
```

**冲突检测测试**：

```tsx
test('快捷键不与浏览器默认行为冲突', async ({ page }) => {
  // 测试Ctrl+S不会触发浏览器保存页面
  await page.keyboard.press('Control+Shift+S');

  // 验证自定义保存功能被触发
  await expect(page.locator('[data-testid="save-success"]')).toBeVisible();

  // 验证浏览器保存对话框没有弹出（通过页面不失焦判断）
  expect(await page.evaluate(() => document.hasFocus())).toBeTruthy();
});
```

**手动测试清单**：

| 快捷键 | Windows (Chrome) | Mac (Safari) | Linux (Firefox) | 冲突检测 |
|--------|-----------------|--------------|----------------|---------|
| Ctrl+Shift+Enter | ✅ | ✅ (Cmd+Shift+Enter) | ✅ | 无冲突 |
| Alt+1/2/3 | ✅ | ✅ (Option+1/2/3) | ✅ | 无冲突 |
| Alt+←/→ | ✅ | ✅ | ✅ | 无冲突 |
| Ctrl+Shift+S | ✅ | ✅ | ✅ | 已拦截浏览器保存 |
| Esc | ✅ | ✅ | ✅ | 标准行为 |

**焦点管理测试**：

```tsx
test('Tab键正确移动焦点', async ({ page }) => {
  await page.goto('/projects/123/diff');

  // 按Tab键3次
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');

  // 验证焦点在预期元素上
  const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
  expect(['BUTTON', 'A', 'INPUT']).toContain(focusedElement);
});
```

---

## 开发交付清单

### 前端开发清单

**布局系统**：
- [ ] 配置Tailwind断点（sm: 640px, md: 768px, lg: 1024px, xl: 1440px, 2xl: 2560px）
- [ ] 实现三列对比视图（`xl:grid xl:grid-cols-3`）
- [ ] 实现主视图+侧边切换（`lg:grid lg:grid-cols-[70%_30%]`）
- [ ] 设置内容最大宽度（`max-w-[1920px] mx-auto`）
- [ ] 添加系统要求提示（<1440px显示"建议使用更高分辨率"）

**性能优化**：
- [ ] 集成 `react-window` 虚拟滚动
- [ ] 三列对比视图虚拟化（>500行文档触发）
- [ ] 实现滚动同步（可选，三列联动滚动）
- [ ] 图片懒加载（`loading="lazy"`）
- [ ] 代码分割（Next.js动态导入 `next/dynamic`）

**SSR/CSR配置**：
- [ ] 项目列表页SSR（`app/projects/page.tsx`，使用 `async` 组件）
- [ ] 差异对比页CSR（`'use client'` directive）
- [ ] 配置Next.js缓存策略（ISR: `export const revalidate = 60`）
- [ ] 优化Web Vitals（LCP <2.5s, FID <100ms, CLS <0.1）

**键盘快捷键**：
- [ ] 集成 `react-hotkeys-hook`
- [ ] 实现6个快捷键（Ctrl+Shift+Enter, Alt+1/2/3, Alt+←/→, Ctrl+Shift+S/E, Esc）
- [ ] 拦截浏览器默认行为（`e.preventDefault()`）
- [ ] 页面底部快捷键提示组件（可折叠）
- [ ] 首次使用引导（localStorage记录"不再显示"）

**无障碍实现**：
- [ ] 语义化HTML（nav, main, section, article, h1-h6）
- [ ] ARIA标签（aria-label, aria-live, role）
- [ ] 焦点指示（`:focus-visible`样式）
- [ ] 颜色对比度验证（所有文本/背景组合≥4.5:1）
- [ ] 触摸目标大小（所有按钮≥44×44px）

**移动端降级**：
- [ ] 移动端只读模式UI（<768px）
- [ ] 底部Tab导航（项目/进度/详情）
- [ ] 垂直堆叠三模型输出
- [ ] "不支持编辑"提示条
- [ ] V1.0规划：轻量级编辑（至少支持一键采纳推荐）

---

### QA测试清单

**响应式测试**：
- [ ] Chrome DevTools模拟（1920×1080, 1440×900, 1366×768, 2560×1440）
- [ ] 实际设备测试（27寸显示器, 15寸笔记本, 4K显示器）
- [ ] 移动端模拟器（iPhone 12 Pro, iPad Air, Android手机）
- [ ] 真实移动设备测试（iPhone 13, iPad Air, Android平板）
- [ ] Safari on Mac测试（Browserstack）

**性能测试**：
- [ ] Lighthouse CI集成（性能评分≥90）
- [ ] 首屏加载时间 <2秒（1920×1080, 4G）
- [ ] 三列对比首次渲染 <2秒（1000行文档）
- [ ] 滚动帧率 ≥50fps（3000行文档，虚拟滚动）
- [ ] 差异高亮切换 <100ms
- [ ] 内存占用 <500MB（3000行文档）

**无障碍测试**：
- [ ] Lighthouse Accessibility审计（无WCAG A级违规）
- [ ] axe DevTools扫描（无违规）
- [ ] 颜色对比度检查（所有组合≥4.5:1）
- [ ] Tab键导航验证（所有交互元素可达）
- [ ] 焦点指示验证（键盘导航时显示蓝色描边）

**键盘快捷键测试**：
- [ ] 54个测试用例（6快捷键 × 3 OS × 3浏览器）
- [ ] Playwright自动化测试通过
- [ ] 冲突检测（无浏览器/OS快捷键冲突）
- [ ] 焦点管理（Tab键正确移动焦点）

---

## 总结

### 关键决策记录

| 决策维度 | 选择 | 原因 | 审查者 |
|---------|------|------|--------|
| 设计理念 | Desktop-First | 咨询师主要在办公桌面工作（80%用户≥1920×1080）| Sally, John |
| 关键断点 | 1440px | 三列对比 vs 主视图切换的平衡点 | Winston |
| 响应式系统 | Tailwind Only | 避免与Ant Design Grid混用，降低维护复杂度 | Amelia |
| 虚拟滚动 | react-window | 大文档性能优化，DOM节点从9000降至150 | Amelia |
| SSR/CSR边界 | 列表SSR，对比CSR | 优化首屏性能和交互体验 | Winston |
| 键盘快捷键 | Ctrl+Shift+组合 | 避免与浏览器默认快捷键冲突 | Amelia |
| 无障碍级别 | WCAG 2.1 A级 | 最低法律合规，应对国际市场扩展 | John |
| 移动端定位 | MVP只读，V1.0轻量编辑 | 控制开发成本，覆盖紧急场景 | John |
| Safari测试 | Browserstack | 避免Mac用户布局Bug | Murat |
| 性能SLA | 明确量化指标 | 首屏<2s，滚动≥50fps，可测量 | Murat |

---

### 下一步

Step 14将生成完整的开发交付文档（Handoff Specs），包括：
- Figma设计文件规范
- 组件库实现清单
- API接口文档
- 设计token导出
- 前后端协作流程

**当前进度**: Step 13已完成 ✅

---

**文档版本**: v1.0
**最后更新**: 2025-12-25
**审查团队**: Sally (UX), Amelia (Dev), Winston (Architect), John (PM), Murat (QA)
**生成工具**: BMAD UX Design Workflow - Party Mode Multi-Agent Review
