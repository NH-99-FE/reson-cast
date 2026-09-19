# Reson Cast - 现代化视频分享平台

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/tRPC-11-2596be?style=for-the-badge&logo=trpc" alt="tRPC" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3-38bdf8?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS" />
</div>

## 📖 项目简介

Reson Cast 是一个功能完整的现代化视频分享平台，类似 YouTube。项目采用 Next.js 15 全栈架构，实现了完整的视频分享平台，构建了用户认证订阅、视频点赞评论、多层级回复等社交互动体系，提供搜索分类、个性化推荐、热门内容等内容发现机制，以及面向创作者的视频管理工作台同时集成 DeepSeek 智能生成标题和简介功能。

<div align="center">
  <a href="https://reson-cast.lhiyn.xyz/" target="_blank">
    <img src="https://img.shields.io/badge/🌐_在线预览-Visit_Site-blue?style=for-the-badge" alt="在线预览" />
  </a>
</div>

### ✨ 核心特性

- 🎥 **视频管理** - 支持视频上传、删除、分享
- 🤖 **AI 智能生成** - 基于视频字幕自动生成标题和简介
- 👥 **用户系统** - 完整的身份认证、用户资料、订阅关系管理
- 💬 **社交互动** - 视频点赞评论、多层级回复、播放列表
- 🔍 **内容发现** - 搜索功能、分类浏览、个性化推荐
- 🎛️ **创作者工作台** - 视频管理界面、数据统计
- 📱 **响应式设计** - 完美适配移动端和桌面端

## 🛠️ 技术栈

### 前端技术

- **框架**: Next.js 15 + React 19 + TypeScript
- **样式**: Tailwind CSS + shadcn/ui
- **状态管理**: React Query + tRPC
- **表单处理**: React Hook Form + Zod
- **视频播放**: Mux Player

### 后端技术

- **API**: tRPC (类型安全的全栈通信)
- **数据库**: PostgreSQL + Drizzle ORM
- **身份认证**: Clerk
- **缓存限流**: Upstash Redis
- **视频处理**: Mux
- **AI 服务**: DeepSeek Flash（非思考模式）

### 开发工具

- **代码质量**: ESLint + Prettier + Husky + lint-staged
- **类型检查**: TypeScript 严格模式
- **提交规范**: Commitizen + Conventional Commits
- **部署**: Vercel
- **监控**: Vercel Speed Insights

## 🚀 快速开始

### 环境要求

- Node.js 18.17 或更高版本
- pnpm 8.0 或更高版本

### 安装依赖

```bash
# 克隆项目
git clone https://github.com/NH-99-FE/reson-cast.git
cd reson-cast

# 安装依赖
pnpm install
```

### 环境配置

创建 `.env` 文件并配置以下环境变量：

```env
# 数据库
DATABASE_URL="your-postgresql-url"

# Clerk 身份认证
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="your-clerk-publishable-key"
CLERK_SECRET_KEY="your-clerk-secret-key"

# Mux 视频处理
MUX_TOKEN_ID="your-mux-token-id"
MUX_TOKEN_SECRET="your-mux-token-secret"

# Upstash Redis
UPSTASH_REDIS_REST_URL="your-redis-url"
UPSTASH_REDIS_REST_TOKEN="your-redis-token"

# DeepSeek（仅服务端）
AI_API_URL="https://api.deepseek.com"
API_KEY="your-deepseek-api-key"
MODEL_ID="deepseek-flash"

# Upstash Workflow
QSTASH_TOKEN="your-qstash-token"
UPSTASH_WORKFLOW_URL="your-workflow-url"

# 应用配置
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 数据库设置

```bash
# 推送数据库模式
pnpm db:push

# 填充分类数据
pnpm db:seed

# 查看数据库 (可选)
pnpm db:view
```

### 启动开发服务器

```bash
# 启动开发服务器
pnpm dev

# 或同时启动 webhook (如需要)
pnpm dev:all
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## 📁 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # 认证相关页面
│   ├── (home)/            # 主页面组
│   ├── (studio)/          # 创作者工作台
│   └── api/               # API 路由
├── components/            # 通用组件
│   └── ui/               # UI 组件库
├── db/                   # 数据库配置
│   └── schema.ts         # 数据库模式
├── hooks/                # 自定义 Hooks
├── lib/                  # 工具函数
├── modules/              # 业务模块
│   ├── auth/            # 认证模块
│   ├── videos/          # 视频模块
│   ├── users/           # 用户模块
│   └── ...              # 其他模块
└── trpc/                # tRPC 配置
    ├── routers/         # API 路由
    └── init.ts          # tRPC 初始化
```

## 🎯 核心功能

### 视频管理（MUX）

- 多格式视频上传支持
- 自动视频编码和转码
- HLS 自适应流媒体播放
- 视频封面生成
- 字幕提取和显示

### AI 智能功能

- 基于视频字幕自动生成标题
- 智能生成视频简介
- 封面支持手动上传、Mux 默认封面和独立配置的 AI 生图服务
- 异步处理工作流

### 用户体验

- 响应式设计适配全端
- 无限滚动加载
- 骨架屏加载状态
- 实时搜索建议

### 性能优化

- React Suspense 组件懒加载
- useMemo 缓存计算结果
- React Query 数据缓存
- tRPC 数据预取 (tRPC prefetch)，提升首屏加载速度

## 📊 性能指标

- **Real Experience Score**: 86/100
- **First Contentful Paint**: 0.85s
- **Largest Contentful Paint**: 3.85s
- **Interaction to Next Paint**: 8ms
- **Cumulative Layout Shift**: 0
- **Time to First Byte**: 0.15s

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 开发规范

- 使用 TypeScript 进行类型安全开发
- 遵循 ESLint 和 Prettier 代码规范
- 使用 Conventional Commits 提交规范

## 🙏 致谢

- [Next.js](https://nextjs.org/) - React 全栈框架
- [tRPC](https://trpc.io/) - 类型安全的 API
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [Shadcn UI](https://ui.shadcn.com/) - 现代组件库
- [Mux](https://mux.com/) - 视频基础设施
- [Clerk](https://clerk.com/) - 身份认证服务

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 邮箱: lianglh_only@163.com
- GitHub: [@NH-99-FE](https://github.com/NH-99-FE)

---

<div align="center">
  Made with ❤️ llh
</div>

### DeepSeek 配置与验证

标题和简介共用 `src/lib/video-ai.ts`，读取 `API_KEY`、`AI_API_URL`、`MODEL_ID`。
默认使用 `deepseek-flash`，关闭思考模式并限制输出长度；需要更高质量时可以将 `MODEL_ID` 改为 `deepseek-v4-pro`。
AI 密钥仅供服务端使用，不要添加 `NEXT_PUBLIC_` 前缀。

本地配置 `.env` 后重启开发服务。线上需要在 Vercel 配置同名变量并重新部署。
`UPSTASH_WORKFLOW_URL` 必须指向运行新代码、QStash 可以访问的 HTTPS 地址；
若它仍指向 Vercel，本地点击生成也会执行线上工作流。测试本地工作流时请使用公网隧道地址。

```bash
# 使用最新视频字幕实测标题和简介；会消耗少量 DeepSeek 额度，不写入数据库
RUN_AI_TEST=1 pnpm exec tsx scripts/verify-video-ai.ts
```

此脚本验证 Mux 字幕读取和 DeepSeek 调用，不包含 QStash 调度或数据库写回。
部署后从工作台分别触发标题、简介生成，完成后自动保存并同步对应表单字段；并发修改保留生成建议供手动采用，不覆盖其他页面的修改。任务状态保存在数据库，可跨页面恢复。部署前应用 `scripts/sql/add-video-generation-jobs.sql`。详见 [AI 生成与保存](docs/video-generation.md)。
DeepSeek 未提供图片生成接口，AI 封面使用独立服务。未配置时入口会提示“AI 封面服务尚未配置”，不会提交工作流。

```env
# Agnes 生图接口（服务端）
IMAGE_AI_API_URL=https://apihub.agnes-ai.com/v1/images/generations
IMAGE_AI_API_KEY=
IMAGE_AI_MODEL=agnes-image-2.5-flash
```

当前适配 Agnes 同步 JSON 生图接口：Bearer 鉴权，封面固定请求 `size: "1K"`、`ratio: "16:9"`
（原生输出 `1312×736`），并通过 `extra_body.response_format: "url"` 返回图片链接。
响应支持 `data[0].url` 或 `images[0].url`（HTTPS 图片链接）。
其他服务若不兼容这些请求参数，或只返回 Base64、异步任务 ID，需要补充适配，不能只换模型名。
图片通过 UploadThing 默认公开存储上传，不覆盖 ACL，兼容免费套餐，并沿用删除保护和旧封面清理逻辑。
自定义及 AI 封面的源文件直链不受视频可见性保护；即使视频转私有，持有直链的人仍可访问封面。
