---
epic: epic-11
status: story-created
---

# Epic 11: UI 框架统一（MUI + Tailwind）

## 背景

当前前端项目混合使用了多种 UI 框架：
- Ant Design（主要）
- MUI/Material-UI（部分）
- Tailwind CSS（样式）

这种混合使用导致：
- 样式不一致
- 包体积过大
- 维护成本高
- 学习曲线陡峭

## 目标

统一使用 MUI + Tailwind CSS，完全移除 Ant Design。

## 包含 Stories

- 11-1-mui-theme-setup: MUI 主题配置和基础组件
- 11-2-layout-migration: 布局组件迁移（Sidebar, Header, MainLayout）
- 11-3-ai-generation-migration: AI Generation 页面迁移
- 11-4-features-migration: Features 组件迁移
- 11-5-auth-migration: 认证页面迁移
- 11-6-cleanup-antd: 清理 Ant Design 依赖

## 成功标准

- 所有页面使用 MUI 组件
- Ant Design 完全移除
- 所有测试通过
- 视觉效果保持一致或更好
