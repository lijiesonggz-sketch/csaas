# Csaas Frontend

AI驱动的IT咨询成熟度评估SaaS平台 - 前端应用

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **UI库**: Ant Design 5.x
- **样式**: Tailwind CSS 3.x
- **认证**: NextAuth.js
- **状态管理**: Zustand
- **实时通信**: Socket.IO
- **图表**: Recharts

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 到 `.env.local` 并填写配置：

```bash
cp .env.example .env.local
```

### 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

### 构建生产版本

```bash
npm run build
npm run start
```

## 项目结构

```
/app                  # Next.js App Router页面
  /(auth)            # 认证相关页面
  /dashboard         # 仪表盘
  /projects          # 项目管理
/components          # React组件
  /ui               # 基础UI组件
  /layout           # 布局组件
  /features         # 业务组件
/lib                 # 工具库
  /api              # API调用
  /hooks            # React Hooks
  /utils            # 工具函数
  /types            # TypeScript类型
/config             # 配置文件
/public             # 静态资源
```

## 代码规范

- 组件: PascalCase (`ProjectCard.tsx`)
- 文件夹: kebab-case (`project-details/`)
- 函数: camelCase (`fetchProjects()`)
- 常量: UPPER_SNAKE_CASE (`MAX_FILE_SIZE`)

## 开发命令

```bash
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
npm run start    # 启动生产服务器
npm run lint     # 运行ESLint检查
npm run format   # 格式化代码
```

## License

Private
