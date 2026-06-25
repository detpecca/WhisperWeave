# WhisperWeave · 絮语织

> 把平时的碎碎念、零散笔记，借助 LLM 一键织成结构化的详细文档。
> 可导出、可下载、可一键同步到飞书云文档。

核心闭环：**碎片化输入 → 智能聚合 → 结构化输出 → 人工微调 → 导出 / 分享**

![WhisperWeave](https://img.shields.io/badge/Next.js-15-black) ![TS](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-3-38bdf8)

---

## ✨ 特性

- **随手记碎片**：快速捕获框，支持标签、⌘/Ctrl+Enter 快速保存，本地持久化。
- **一键自动织造**（核心）：不勾选任何碎片时，点「一键自动织造」→ 自动扫描全部未织造碎片 → LLM 按主题分类（优先复用已有标签 / 预设标签，不够则新建并标红待确认）→ 弹窗预览分组、可改名 → 确认后按分组**并行织造成多篇文档**，每类一篇。
- **手动织成单篇**：勾选若干碎片时，按钮切换为「织成单篇」，按所选文档类型（日报 / 周报 / 主题笔记 / 思考备忘 / 自动）织成一篇文章。
- **可配置预设标签集合**：在设置页维护常用标签，分类时 LLM 优先从中挑选；确认新标签后自动并入。
- **可配置多模型**：DeepSeek（默认）、OpenAI、Anthropic Claude、通义千问、智谱 GLM，或任意 OpenAI 兼容接口；运行时随时切换。
- **编辑 + 预览**：左侧 Markdown 编辑、右侧实时预览，可继续人工微调。
- **多格式导出**：`.md` / `.html` / `.txt` 一键下载。
- **飞书云文档同步**：填入飞书自建应用凭证，即可把文档推送到指定飞书云空间文件夹，返回可打开的链接。
- **纯前端存储**：碎片、文档、设置全部存在浏览器 `localStorage`，零后端数据库，开箱即用。

## 🧱 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | Next.js 15 (App Router) + React 19 |
| 语言 | TypeScript 5 |
| 样式 | Tailwind CSS 3 |
| 存储 | 浏览器 localStorage（`src/lib/storage.ts`） |
| LLM | 统一适配层（`src/lib/llm.ts`），经服务端 API Route 代理，Key 不进浏览器 |
| 飞书 | 飞书开放平台 OpenAPI（`src/lib/feishu.ts`），markdown 导入为 docx |

无重型第三方依赖（无 markdown / docx 解析库），Markdown 渲染与导出均为内置轻量实现，安装快、体积小。

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. （可选）配置凭证：复制环境变量模板
cp .env.example .env.local
#    按需填入 LLM_PROVIDER / OPENAI_API_KEY / DEEPSEEK_API_KEY 等

# 3. 启动开发服务器
npm run dev
#    打开 http://localhost:3000
```

> 生产构建：`npm run build && npm run start`

### 两种配置方式

所有配置都能在应用内「设置」页填写并保存在浏览器本地；也可以在 `.env.local` 里预置（适合部署到服务器、不想每次手填的场景）。两者**前端设置优先**，前端没填时回退到环境变量。

## 🔑 配置说明

### LLM（默认 DeepSeek）

| 提供商 | 需要的变量 / 设置项 |
| --- | --- |
| DeepSeek（默认） | `DEEPSEEK_API_KEY`，模型 `deepseek-chat` |
| OpenAI | `OPENAI_API_KEY`，模型 `gpt-4o-mini` |
| Anthropic | `ANTHROPIC_API_KEY`，模型 `claude-3-5-sonnet-20241022` |
| 通义千问 | `QWEN_API_KEY`，模型 `qwen-plus` |
| 智谱 GLM | `ZHIPU_API_KEY`，模型 `glm-4-flash` |
| OpenAI 兼容 | 自定义 `baseURL` + `apiKey` + `model` |

在设置页选好提供商，填入 API Key 即可；Base URL / 模型名会自动带默认值，可覆盖。

### 飞书云文档同步

1. 到 [飞书开放平台](https://open.feishu.cn/) 创建一个「**企业自建应用**」。
2. 在「权限管理」开启云文档相关权限，至少包括：
   - `docx:document`（创建/编辑 docx）
   - `drive:drive`、`drive:file`（云空间文件读写）
   - `docs:doc` 视情况
3. 发布应用版本，并由管理员审批通过。
4. 把 **App ID**、**App Secret** 填入设置页（或 `.env.local` 的 `FEISHU_APP_ID` / `FEISHU_APP_SECRET`）。
5. （可选）填 **目标文件夹 token**：在飞书云空间打开目标文件夹，从 URL 里取 `folderToken`；留空则同步到云空间根目录。

之后任意文档点「☁ 同步飞书」，会在飞书生成一篇 docx 并返回链接。

## 📁 项目结构

```
src/
├── app/
│   ├── api/
│   │   ├── aggregate/route.ts   # LLM 聚合接口（POST 单篇 / PUT 按分组）
│   │   ├── classify/route.ts    # LLM 碎片分类接口（返回 JSON 分组）
│   │   └── sync/route.ts        # 飞书同步接口（服务端代理）
│   ├── settings/page.tsx        # 设置页（含预设标签管理）
│   ├── layout.tsx
│   ├── page.tsx                 # 主界面：碎片 + 织造 + 编辑器 + 预览 + 分类弹窗
│   └── globals.css
├── components/
│   ├── MarkdownPreview.tsx      # 轻量 Markdown 渲染
│   ├── ExportButtons.tsx        # md/html/txt 导出
│   ├── SyncButton.tsx           # 飞书同步按钮
│   └── ClassifyConfirm.tsx      # 分类确认弹窗（改名/确认新标签）
└── lib/
    ├── types.ts                  # 数据模型（含 ClassifyGroup / ClassifyRequest/Response）
    ├── storage.ts                # localStorage 读写（含 tagFragments 批量打标）
    ├── prompt.ts                 # 聚合 + 分类 + 分组聚合 prompt
    ├── llm.ts                    # 多模型适配层（aggregate / classify / aggregateGroup）
    └── feishu.ts                 # 飞书客户端
```

## 🔄 核心数据流

```
未织造碎片(localStorage) ──► /api/classify ──► LLM ──► 分组 JSON
                                                      │
                                              分类确认弹窗
                                            （新标签标红、可改名）
                                                      │ 确认
                              ┌───────────────────────┴──────────────────────┐
                              ▼                                              ▼
                    /api/aggregate (PUT) × N 组                       回填标签到碎片
                    并行织造成多篇 Markdown                              （并入预设集合）
                              │
                              ▼
                    编辑器 + 预览（人工微调）
                              │
            ┌─────────────────┼──────────────────┐
            ▼                 ▼                  ▼
        导出文件         保存到本地         /api/sync → 飞书 docx
```

被织入文档的碎片会自动标记为「已织」，可在列表里过滤隐藏，避免重复处理。勾选特定碎片时则走「织成单篇」的手动模式，跳过分类。

## 📄 License

MIT
