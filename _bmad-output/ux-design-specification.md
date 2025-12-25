---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
workflowType: 'ux-design'
lastStep: 13
project_name: 'Csaas'
user_name: '27937'
date: '2025-12-25'
structure: 'modular'
files:
  - 'ux/01-foundation.md'
  - 'ux/02-design-directions.md'
  - 'ux/03-implementation-guide.md'
---

# UX Design Specification - Csaas

**项目名称**: Csaas (AI咨询平台)
**作者**: 27937
**最后更新**: 2025-12-25
**状态**: 进行中 (12/14 步骤已完成)

---

## Executive Summary

### 核心体验定义

**Csaas的核心体验是："高效审查并确认AI生成的咨询文档包"**

- **价值主张**: "快速搭建80%通用框架，让咨询师专注于20%行业洞察和定制化"
- **目标效率**: MVP阶段 <8小时完成项目，V1.0阶段 <4小时
- **技术机制**: 三模型AI共识（GPT-4 + Claude + 国产模型）差异点智能对比

### 关键设计决策

| 决策维度 | 选择 | 理由 |
|---------|------|------|
| **设计系统** | Ant Design 5.x + AntV | 企业级组件库，内置表格/表单，数据可视化完善 |
| **技术栈** | Next.js + Tailwind CSS | SSR性能优化，快速开发，字体加载优化 |
| **主色调** | 深蓝色 #1E3A8A | 传达专业、可信赖的咨询行业形象 |
| **核心UX模式** | 差异点分层审查 + 渐进式确认 | 优先显示高风险差异，减少认知负荷 |
| **北极星指标** | 月收入增长率 >30% (MVP) | 业务结果导向，而非纯生产力指标 |

### 三大创新UX模式

1. **Progressive Disclosure Diff Review（渐进式差异审查）**
   - 优先展示3个高风险差异点
   - 80%差异点提供AI推荐，快速采纳
   - 支持模式切换（差异点优先 vs 传统顺序审查）

2. **Honest Regeneration Approach（诚实重生成策略）**
   - MVP阶段采用全部重生成 + 高亮变化
   - 明确告知用户技术限制，避免"可控性幻觉"
   - V1.0再实现真正的部分重生成

3. **Consultant Fear Mitigation（咨询师核心恐惧消解）**
   - 解决"客户会发现这是AI做的"心理障碍
   - 提供完整的客户沟通话术库
   - 强化"AI是助手，咨询师是专家"定位

---

## Document Structure

本规格文档采用**模块化三段式结构**，以优化阅读体验和开发效率：

### 📘 [01 - Foundation（设计基础）](./ux/01-foundation.md)

**内容**: Steps 2-8 已完成
**大小**: ~3000行, ~40k tokens
**适用人群**: 产品经理、UX设计师、技术负责人

**包含章节**:
- Step 2: 项目理解与风险预判（Pre-mortem分析）
- Step 3: 核心用户体验定义
- Step 4: 期望情感反馈（5阶段情感旅程）
- Step 5: UX模式分析与灵感来源
- Step 6: 设计系统选择（Ant Design vs Alternatives）
- Step 7: 核心体验定义（整合专家反馈）
- Step 8: 视觉设计基础（色彩、排版、布局、无障碍）

**关键输出**:
- Ant Design主题配置（config/theme.ts）
- Next.js集成代码（app/layout.tsx, tailwind.config.js）
- 完整色彩系统与无障碍验证
- 咨询师用户心智模型与核心恐惧分析

---

### 🎨 [02 - Design Directions（设计方向）](./ux/02-design-directions.md)

**内容**: Steps 9-12 已完成
**大小**: ~1500行, ~20k tokens
**适用人群**: UI设计师、前端工程师

**包含章节**:
- Step 9: 设计方向探索（视觉mockups、风格板）
- Step 10: 详细用户旅程（关键时刻交互设计）
- Step 11: 组件策略（设计系统实现）
- Step 12: UX模式库（交互模式详细规格）

**关键输出**:
- 差异点审查界面设计方向
- 三模型对比可视化方案
- 关键交互流程详细设计
- 组件库实现清单
- UX交互模式详细规格

---

### 🛠️ [03 - Implementation Guide（实现指南）](./ux/03-implementation-guide.md)

**内容**: Steps 13-14 待生成
**预计大小**: ~2000行, ~25k tokens
**适用人群**: 前端工程师、QA工程师

**计划章节**:
- Step 13: 响应式设计与无障碍实现
- Step 14: 开发交付文档（Handoff Specs）

**关键输出**:
- 响应式断点策略
- 无障碍测试清单
- Figma/代码交付规范

---

## Quick Reference

### 核心体验5个关键时刻

1. **首次发现AI差异** - 10秒内定位第一个高风险差异点
2. **快速采纳推荐** - 一键采纳AI推荐，80%差异点<5秒处理
3. **专业判断覆盖** - 咨询师override AI建议时系统"庆祝"专业判断
4. **客户沟通准备** - 数据溯源完整，能回答客户任何质疑
5. **项目完成导出** - 一键导出完整PDF，包含决策链和调整历史

### 成功标准（MVP阶段）

| 指标 | 目标 | 测量方法 |
|-----|------|---------|
| 项目完成时间 | <8小时 | 系统计时：上传文件→确认导出 |
| 调整率 | <40% | (咨询师修改的AI建议数) / (总AI建议数) |
| 三模型一致性 | >70% | 无差异的段落数 / 总段落数 |
| 月收入增长率 | >30% | (当月收入 - 上月收入) / 上月收入 |
| 成本控制 | <$5/项目 | 三模型API调用总费用 + 存储 |

### 技术栈总览

```
Frontend:
  - Next.js 14 (App Router)
  - React 18
  - TypeScript
  - Ant Design 5.x
  - Tailwind CSS 3.x
  - AntV (G2Plot, G6)

Backend (未在此UX文档详述):
  - Node.js / Python (待定)
  - OpenAI API (GPT-4)
  - Anthropic API (Claude)
  - 国产大模型API (待选型)

Infrastructure:
  - Vercel / AWS
  - PostgreSQL
  - Redis (缓存)
```

---

## Change Log

| 日期 | 步骤 | 主要变更 | 原因 |
|-----|------|---------|------|
| 2025-12-24 | Step 8 | 成功色拆分为background/text双token | 解决WCAG AA对比度问题（专家反馈） |
| 2025-12-24 | Step 8 | Card padding拆分为20px/24px | 支持默认和大卡片不同内边距 |
| 2025-12-24 | Step 8 | Typography行高调整为1.71 | 优化中文长文本阅读体验 |
| 2025-12-24 | Step 7 | 成功标准调整为MVP/V1.0两阶段 | 整合PM/Architect现实性反馈 |
| 2025-12-24 | Step 7 | 新增"客户沟通话术"章节 | 解决咨询师核心恐惧（PM反馈） |
| 2025-12-24 | All | 文档拆分为三段式模块化结构 | 优化上下文管理，降低token消耗 |

---

## How to Use This Document

### 👤 如果你是产品经理/项目负责人
→ 阅读本页Executive Summary + [Foundation](./ux/01-foundation.md) Step 2-4

### 🎨 如果你是UX/UI设计师
→ 阅读 [Foundation](./ux/01-foundation.md) Step 5-8 + [Design Directions](./ux/02-design-directions.md) 全文

### 💻 如果你是前端工程师
→ 阅读 [Foundation](./ux/01-foundation.md) Step 6, 8 + [Implementation Guide](./ux/03-implementation-guide.md) 全文

### 🧪 如果你是QA工程师
→ 阅读 [Foundation](./ux/01-foundation.md) Step 4 (情感目标) + [Implementation Guide](./ux/03-implementation-guide.md) Step 13 (无障碍测试)

---

**生成工具**: BMAD UX Design Workflow
**协作方式**: Party Mode多智能体评审（Sally/UX + John/PM + Winston/Architect + Amelia/Dev）
**下一步**: 继续Step 13 - 响应式设计与无障碍实现
