# AI 视频台本生成系统 — 使用说明

## 1. 启动与停止

### 启动开发服务器

```bash
cd D:\SelfMedia
pnpm dev
```

启动后访问 **http://localhost:3000**，首页会自动跳转到项目列表。

### 停止服务器

在终端按 `Ctrl + C`。

如果端口被占用导致启动失败，运行：

```bash
# Windows PowerShell / CMD
taskkill /F /IM node.exe

# 然后重新启动
pnpm dev
```

### 修改配置后需要重启吗？

- **`.env` 文件**：必须重启（环境变量在启动时加载）
- **`prisma/schema.prisma`**：修改后需要重新运行 `npx prisma db push`，再重启
- **其他源代码**：Next.js 开发模式会自动热更新，**不需要**重启

---

## 2. 配置文件说明

所有配置文件都在项目根目录 `D:\SelfMedia\` 下。

### `.env` — LLM 和数据库配置（核心配置文件）

```bash
# DeepSeek API Key（你的密钥）
LLM_API_KEY=sk-8dd91f3df0244ac6afd20db8b39ae297

# API 地址（DeepSeek 的 OpenAI 兼容接口）
LLM_BASE_URL=https://api.deepseek.com/v1

# 选题生成使用的模型（快模型，成本低）
LLM_TOPIC_MODEL=deepseek-v4-flash

# 台本生成使用的模型（强模型，质量高）
LLM_SCRIPT_MODEL=deepseek-v4-pro

# LLM 请求超时时间（毫秒），台本生成可能较慢
LLM_REQUEST_TIMEOUT_MS=180000

# SQLite 数据库文件路径（本地文件，无需安装数据库服务）
DATABASE_URL="file:./dev.db"
```

| 变量 | 作用 | 修改频率 |
|---|---|---|
| `LLM_API_KEY` | API 密钥，换成你自己的 Key | 按需 |
| `LLM_TOPIC_MODEL` | 选题 Agent 用的模型 | 按需 |
| `LLM_SCRIPT_MODEL` | 台本 Agent 用的模型 | 按需 |
| `LLM_REQUEST_TIMEOUT_MS` | 生成超时，台本长可调大到 300000 | 偶尔 |
| `DATABASE_URL` | 数据库位置 | 一般不改 |

### `prisma/schema.prisma` — 数据库结构

定义了 5 张核心表：`Project`（项目）、`SourceMaterial`（素材）、`Topic`（选题）、`Reference`（参考）、`ScriptVersion`（台本版本）。

修改后需要执行：

```bash
npx prisma db push    # 同步到数据库
```

### Agent 提示词配置文件

Agent 的 system prompt 和生成逻辑在以下文件中，修改后可自定义生成风格：

| Agent | 文件 | 位置 |
|---|---|---|
| 选题 Agent prompt | `src/lib/workflow-runner.ts` | `TOPIC_SYSTEM_PROMPT` 常量 |
| 台本生成 Agent prompt | `src/lib/workflow-runner.ts` | `SCRIPT_SYSTEM_PROMPT` 常量 |
| LLM 调用参数（温度等） | `src/lib/workflow-runner.ts` | `runTopicGeneration` / `runScriptGeneration` 方法内 |
| JSON 校验规则 | `src/lib/schemas.ts` | `validateScriptContent` 函数 |

---

## 3. 核心 Agent 说明

### 选题 Agent

- **输入**：原始素材 + 目标平台 + 视频类型 + 目标时长
- **输出**：3-5 个候选选题（标题、受众、冲突、情绪、评分、理由）
- **模型**：`LLM_TOPIC_MODEL`（建议用 flash 模型，速度快成本低）
- **温度**：0.5

### 台本生成 Agent

- **输入**：原始素材 + 选中选题 + 可选参考内容 + 目标时长
- **输出**：结构化台本（5+ 段落，每段含台词、字幕、画面、情绪、BGM、导演备注）
- **模型**：`LLM_SCRIPT_MODEL`（建议用 pro 模型，保证质量）
- **温度**：0.6

### 质量校验

生成台本后自动校验：
- JSON 结构完整性
- 至少 3 个段落
- 第一段从 0 秒开始
- 段落时间不重叠
- 台词字数与目标时长大致匹配（每秒 4-6 字）
- 总时长偏差不超过 10%

校验失败会自动做一次 repair retry（把错误信息发给 LLM 修复）。

---

## 4. 使用流程

### Step 1：创建项目

访问 `http://localhost:3000/projects/new`

填写：
- **项目标题**：给你的视频起名
- **目标平台**：抖音（douyin）/ 小红书 / B站 / 视频号
- **视频类型**：口播 / 故事 / 知识 / 观点
- **目标时长**：15-180 秒（默认 60）
- **原始素材**：粘贴聊天记录、灵感笔记、已有文案

### Step 2：生成选题

在工作台页面（`/projects/[id]/workbench`）点击「生成选题」。

系统会基于素材生成 3-5 个候选选题，每个都有推荐评分和理由。点击选择一个。

「重新生成」会覆盖未选中的旧选题。

### Step 3：添加参考（可选）

参考内容帮助 AI 理解你想要的风格和结构。默认跳过。

如果添加：粘贴参考视频的文案或字幕即可。AI 只参考结构和表达方向，不复制内容。

### Step 4：生成台本

选择选题后，点击「生成台本」。生成时间取决于模型和时长，通常 30-90 秒。

生成后可点击「查看已有台本」进入台本页。

### Step 5：编辑和导出

台本页展示完整时间轴分段。你可以：
- **查看**：每段的台词、字幕、画面、情绪、BGM、导演备注
- **编辑**：点击「编辑」按钮，修改台词、字幕、画面描述等
- **导出**：点击「导出 Markdown」，下载 `.md` 文件

---

## 5. 项目目录速查

```
D:\SelfMedia\
├── .env                          # ★ 核心配置
├── prisma/schema.prisma          # 数据库表结构
├── prisma/dev.db                 # SQLite 数据库文件
├── src/
│   ├── app/
│   │   ├── api/projects/...      # 所有后端 API（11 个路由）
│   │   └── projects/...          # 4 个前端页面
│   ├── components/ui/            # 通用 UI 组件
│   └── lib/
│       ├── llm-client.ts         # LLM 调用封装
│       ├── workflow-runner.ts    # ★ Agent prompt 和生成流程
│       ├── schemas.ts            # ★ 数据结构和校验规则
│       ├── markdown-exporter.ts  # Markdown 导出渲染
│       ├── prisma.ts             # 数据库连接
│       ├── errors.ts             # 错误类型定义
│       └── utils.ts              # 工具函数
└── package.json
```

---

## 6. 常见问题

**Q: 怎么查看数据库里的数据？**

```bash
npx prisma studio
```

会打开一个 Web 界面（`http://localhost:5555`），可以浏览和编辑所有表。

**Q: 怎么重置数据库？**

```bash
rm prisma/dev.db          # 删除数据库文件
npx prisma db push        # 重新创建
```

**Q: LLM 生成超时怎么办？**

修改 `.env` 中 `LLM_REQUEST_TIMEOUT_MS=300000`（5 分钟），然后重启。

**Q: 想换模型提供商？**

修改 `.env`：
```bash
LLM_BASE_URL=https://api.openai.com/v1     # 或其他兼容接口
LLM_API_KEY=sk-your-key
LLM_TOPIC_MODEL=gpt-4o-mini
LLM_SCRIPT_MODEL=gpt-4o
```

只要是 OpenAI 兼容 API（`/v1/chat/completions`），无需改代码。

---

## 7. 快捷命令汇总

```bash
pnpm dev                  # 启动开发服务器
npx prisma studio         # 打开数据库管理界面
npx prisma db push        # 同步数据库结构
taskkill /F /IM node.exe  # 强制停止所有 Node 进程（Windows）
```
