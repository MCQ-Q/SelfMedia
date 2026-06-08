# AI 自媒体视频台本生成系统设计文档（完善版）

## 1. 项目概述

本系统是一个基于 Next.js 全栈架构的 BS 系统，面向自媒体创作者，将粗略聊天记录、个人感悟、灵感片段或主题想法，转化为可发布短视频所需的完整视频台本。

系统的核心目标不是简单生成一段口播文案，而是完成从"想法"到"导演级台本"的结构化创作流程，包括选题提炼、爆款参考知识库构建、视频框架生成、台词设计、钩子管理、情绪曲线、BGM 推荐、画面支线、AI 生图/生视频提示词以及导演位整合。

## 2. 核心目标

### 2.1 业务目标

- 从聊天记录或个人感悟中提炼可视频化主题。
- 搜集同类爆款视频，沉淀为当前选题的临时知识库。
- 生成完整视频框架，包括开头、承接、冲突、展开、反转、结尾。
- 将钩子自然融入台词，而不是独立堆砌。
- 梳理视频推进过程中的情绪起伏。
- 根据情绪变化推荐合适的 BGM 和音效。
- 生成画面支线，用 AI 图片或 AI 视频承接口播中的抽象概念。
- 通过导演位智能体整合多智能体输出，形成最终可剪辑台本。

### 2.2 技术目标

- 使用 Next.js 构建前后端一体化应用。
- 使用 PostgreSQL 存储项目、素材、智能体运行结果和台本版本。
- 使用 DeepSeek-V4 作为主要大模型。
- 使用任务队列处理搜索、生成、复核等长任务。
- 使用 SSE 向前端实时推送智能体运行进度。
- 将不同创作维度拆分为独立智能体，便于调试、复用和版本管理。
- 为后续剪辑、素材生成、发布平台对接预留扩展位。

## 3. 系统边界

### 3.1 MVP 范围

MVP 阶段聚焦于"完整剧本生成"：

- 输入聊天记录或感悟。
- 提炼主题和候选选题。
- 搜集爆款视频参考。
- 生成视频主线框架。
- 生成台词、情绪、画面、BGM、钩子支线。
- 导演位整合输出完整台本。
- 支持导出 Markdown、JSON、CSV。

### 3.2 暂不实现

- 视频自动剪辑。
- 自动发布到抖音、视频号、小红书、B 站等平台。
- 完整版权音乐库。
- 精确平台播放量数据抓取。
- 多人协作审批流。

这些能力在数据结构中预留，但不作为第一阶段核心功能。

## 4. 总体架构

### 4.1 架构全景图

```mermaid
flowchart TD
    subgraph 前端层
        A[Next.js App Router]
        A1[React Server Components]
        A2[Client Components + Zustand]
        A3[SSE Client 进度消费]
    end

    subgraph API 层
        B[Route Handlers]
        B1[Server Actions]
        B2[SSE Endpoints]
        B3[Auth Middleware]
    end

    subgraph 服务层
        C[Agent Orchestrator]
        D[Queue Worker]
        E[Search Adapter]
        F[LLM Adapter]
        G[SSE Broadcaster]
    end

    subgraph 数据层
        H[(PostgreSQL)]
        I[(Redis)]
        J[(Object Storage)]
    end

    A --> B
    B --> C
    B --> G
    C --> D
    D --> E
    D --> F
    D --> G
    C --> H
    D --> I
    F --> H
```

### 4.2 前端层

- Next.js App Router，React Server Components + Client Components。
- shadcn/ui 或 Radix UI 作为基础组件库。
- Tailwind CSS 实现界面样式。
- Zustand 管理前端工作流状态，消费 SSE 事件流更新各 Agent 运行进度。
- 主要页面：项目列表页、项目工作台、原始素材输入页、选题确认页、爆款参考页、台本编辑页、多智能体运行记录页、导出页。

### 4.3 服务层

- **API Gateway**：Next.js Route Handlers 提供 RESTful API，Server Actions 处理简单表单提交。
- **Auth Middleware**：JWT + Cookie 认证，每个请求注入 `userId` 上下文。
- **Agent Orchestrator**：负责编排多智能体执行流程，管理依赖关系（如前序 Agent 完成后才启动后续 Agent）。
- **Queue Worker**：基于 BullMQ + Redis 的异步任务队列，处理 LLM 调用、搜索等长任务。支持重试、超时、死信队列。
- **SSE Broadcaster**：基于 Redis Pub/Sub 的实时进度推送，每个项目一个频道。
- **Search Adapter**：抽象搜索接口，支持多搜索源（Bing API、SerpAPI、自定义爬虫）的适配器模式接入。
- **LLM Adapter**：封装 DeepSeek-V4 调用，支持结构化输出、重试、超时、token 预算控制。

### 4.4 数据层

- **PostgreSQL**：主数据库，存储项目、素材、Agent 运行记录、台本版本等核心业务数据。
- **Prisma**：ORM，管理 Schema 迁移和类型安全查询。
- **Redis**：用于任务队列 (BullMQ)、SSE Pub/Sub、分布式锁、Session 缓存。
- **Object Storage**（S3 兼容）：后续存储 AI 生成的图片、视频、音频素材。

## 5. 数据流设计

### 5.1 主数据流

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as Next.js 前端
    participant API as API 服务
    participant ORC as Agent Orchestrator
    participant Q as Queue Worker
    participant DB as PostgreSQL
    participant LLM as DeepSeek-V4
    participant Search as 搜索服务
    participant Redis as Redis Pub/Sub

    U->>FE: 输入聊天记录或个人感悟
    FE->>API: 创建项目与原始素材
    API->>DB: 保存 project 与 source_material
    API->>ORC: 启动主题提炼流程
    ORC->>Q: 入队 topic_extraction 任务
    Q->>LLM: 提炼主题和选题
    LLM-->>Q: 返回主题、受众、冲突、标题候选
    Q->>DB: 保存 topics
    Q->>Redis: 发布进度事件
    Redis-->>FE: SSE 推送"选题已生成"

    U->>FE: 选择目标选题
    FE->>API: 确认选题
    API->>ORC: 启动爆款搜索
    ORC->>Q: 入队 viral_search 任务
    Q->>Search: 搜索同类爆款内容
    Search-->>Q: 返回参考内容
    Q->>LLM: 提取结构、钩子、情绪、评论共鸣
    LLM-->>Q: 返回爆款分析
    Q->>DB: 保存 references 与 knowledge_items
    Q->>Redis: 发布进度事件

    ORC->>Q: 入队 outline 任务
    Q->>LLM: 生成视频框架
    LLM-->>Q: 返回框架
    Q->>DB: 保存 script_outline

    ORC->>Q: 并行入队 dialogue / hook / emotion / visual 任务
    par 并行执行
        Q->>LLM: 生成台词支线
        LLM-->>Q: 台词数据
    and
        Q->>LLM: 生成钩子支线
        LLM-->>Q: 钩子数据
    and
        Q->>LLM: 生成情绪支线
        LLM-->>Q: 情绪数据
    and
        Q->>LLM: 生成画面支线
        LLM-->>Q: 画面数据
    end
    Q->>DB: 保存各支线 agent_outputs
    Q->>Redis: 发布进度事件

    ORC->>Q: 入队 bgm 任务（依赖情绪支线）
    Q->>LLM: 生成 BGM 支线
    LLM-->>Q: BGM 数据

    ORC->>Q: 入队 director 任务
    Q->>LLM: 导演位整合
    LLM-->>Q: 最终台本
    Q->>DB: 保存 script_version 与 script_segments
    Q->>Redis: 发布完成事件
    Redis-->>FE: SSE 推送"台本已生成"

    FE->>API: 拉取最终台本
    API->>DB: 查询台本数据
    API->>FE: 返回结构化台本
```

### 5.2 素材数据流

原始输入不是直接进入最终台本，而是经过多层结构化：

1. `source_materials` 保存原始聊天记录、感悟或笔记。
2. `topics` 保存主题和选题。
3. `viral_references` 保存爆款视频参考。
4. `knowledge_items` 保存从爆款内容中提取的结构化知识。
5. `script_outlines` 保存视频框架。
6. `agent_outputs` 保存每个智能体的中间结果。
7. `script_versions` 保存最终台本版本。
8. `script_segments` 保存按时间轴拆分的分镜段落。

## 6. 智能体设计

### 6.1 主题提炼 Agent

**职责**：

- 从聊天记录中提炼主题。
- 提取用户真实关心的问题。
- 将抽象表达转化为可传播选题。
- 生成多个候选选题。

**输入**：原始聊天记录、用户补充说明、目标平台、视频类型偏好。

**输出 Schema**：

```json
{
  "themeSummary": "关于拖延症本质的重新认知",
  "candidates": [
    {
      "title": "你不是拖延，你是在逃避一个太模糊的目标",
      "targetAudience": "25-35岁职场人群",
      "coreConflict": "拖延 vs 恐惧模糊",
      "emotionalTone": "刺痛后释然",
      "score": 0.92,
      "viralityPotential": "high",
      "reason": "反常识 + 身份代入 + 实用解决方案"
    }
  ],
  "targetAudience": "对自我成长有焦虑的年轻人",
  "emotionalTone": "先刺痛后给出希望",
  "uncertaintyNotes": "用户输入中未明确平台偏好，默认按抖音60秒口播风格生成"
}
```

### 6.2 爆款搜索 Agent

**职责**：搜索类似选题的爆款视频、标题、评论和文案，过滤无关内容，提炼可借鉴结构，构建当前项目知识库。

**输出 Schema**：

```json
{
  "references": [
    {
      "platform": "douyin",
      "title": "拖延症不是懒，是你对自己太苛刻了",
      "url": "https://...",
      "author": "心理学李博士",
      "metrics": { "plays": 1200000, "likes": 89000, "comments": 4500, "shares": 23000 },
      "transcript": "...",
      "analysis": {
        "hookPattern": "反常识 + 共情开头",
        "narrativeStructure": "提出问题 → 颠覆认知 → 给出方法 → 情感升华",
        "emotionalArc": ["好奇 6/10", "刺痛 8/10", "释然 5/10", "希望 7/10"],
        "commentInsights": ["原来我不是懒", "这个方法真的有用", "收藏了"],
        "visualStyle": "单人出镜 + 文字叠加",
        "pacePattern": "前3秒快节奏，中段平稳，结尾加速"
      }
    }
  ],
  "knowledgeItems": [
    {
      "itemType": "hook",
      "content": "开头用'你以为...其实...'反常识句式打破认知",
      "tags": ["反常识", "认知重构", "开头钩子"],
      "confidence": 0.95
    }
  ],
  "searchSummary": "共找到23个相关视频，提炼12条可借鉴模式",
  "uncertaintyNotes": "部分视频字幕为自动生成，可能存在误差"
}
```

### 6.3 视频框架 Agent

**职责**：将选题拆解成完整短视频结构，明确每一段的目标，规划节奏、转折、信息密度和结尾动作。

**输出 Schema**：

```json
{
  "totalDurationSeconds": 60,
  "summary": "通过重新定义拖延的本质，引导观众从自我谴责转向行动",
  "segments": [
    {
      "orderIndex": 1,
      "goal": "3秒内抓住注意力，打破对拖延的常见认知",
      "coreInfo": "拖延的本质不是懒，而是目标太模糊导致的恐惧",
      "startTime": 0,
      "endTime": 5,
      "emotionTarget": "制造认知冲突",
      "intensityLevel": 8
    },
    {
      "orderIndex": 2,
      "goal": "展开论证，用具体例子让观众产生'这就是我'的共鸣",
      "coreInfo": "模糊目标→大脑恐惧→拖延行为 的链条",
      "startTime": 5,
      "endTime": 25,
      "emotionTarget": "共鸣 + 被理解",
      "intensityLevel": 6
    }
  ],
  "climaxPosition": "40-50秒处",
  "endingAction": "引导观众写下第一个具体步骤并关注"
}
```

### 6.4 台词 Agent

**职责**：生成口播台词，将主题转化为自然表达，控制句长、停顿和口语化程度，与钩子 Agent 协作将钩子自然嵌入台词。

**输出 Schema**：

```json
{
  "segments": [
    {
      "segmentId": "seg_1",
      "dialogue": "你以为你是在拖延，其实你是在害怕开始。",
      "tone": "冷静、有穿透力",
      "pauseAfter": 0.8,
      "emphasisWords": ["害怕开始"],
      "subtitleSuggestion": "你不是拖延，是害怕开始",
      "subtitleEmphasis": ["害怕开始"],
      "sentenceLengthCheck": "pass",
      "colloquialScore": 0.9
    }
  ],
  "globalNotes": {
    "averageSentenceLength": 12,
    "colloquialScore": 0.88,
    "hookIntegrationQuality": "natural"
  }
}
```

### 6.5 钩子 Agent

**职责**：设计开头钩子、中段防流失钩子、结尾互动钩子，检查钩子是否和主题一致。

**钩子类型**：反常识钩子、情绪共鸣钩子、悬念钩子、身份代入钩子、损失厌恶钩子、冲突升级钩子。

**输出 Schema**：

```json
{
  "segments": [
    {
      "segmentId": "seg_1",
      "hookType": "反常识钩子",
      "hookContent": "重新定义'拖延'的本质",
      "intent": "打破用户对拖延的惯性理解，制造认知缺口",
      "integrationPoint": "开头第一句",
      "expectedViewerReaction": "嗯？什么意思？",
      "retentionProbability": 0.85,
      "themeAlignment": "high"
    }
  ],
  "hookDensity": "每15秒一个轻钩子，每30秒一个重钩子",
  "openingHookStrength": 9,
  "midpointRetentionHooks": 3,
  "endingCTAHook": "评论区写下你明天要做的第一件事"
}
```

### 6.6 情绪 Agent

**职责**：设计视频情绪曲线，精确标注每一段情绪状态，确定情绪变化方向，避免整条视频情绪单调。

**输出 Schema**：

```json
{
  "emotionalArc": "V 型曲线——从刺痛到低谷到希望",
  "segments": [
    {
      "segmentId": "seg_1",
      "primaryEmotion": "好奇",
      "secondaryEmotion": "不安",
      "intensity": 7,
      "direction": "上升",
      "trigger": "认知被挑战",
      "expectedViewerReaction": "停下来继续看",
      "valence": "negative",
      "arousal": "high"
    }
  ],
  "overallCurve": {
    "maxIntensity": 9,
    "minIntensity": 3,
    "varietyScore": 0.85,
    "monotonyWarning": null
  }
}
```

### 6.7 BGM Agent

**职责**：根据情绪曲线推荐 BGM，标注每段音乐的进入、退出和强弱，推荐音效点位。

**输出 Schema**：

```json
{
  "segments": [
    {
      "segmentId": "seg_1",
      "bgmMood": "悬疑低频",
      "bpmRange": "70-85",
      "instrumentPreference": ["ambient pad", "soft pulse synth"],
      "volumeCurve": "渐入，从 60% 到 80%",
      "entryPoint": "0.0s",
      "exitPoint": "5.0s",
      "soundEffect": {
        "type": "woosh",
        "timing": "0.3s",
        "purpose": "配合认知冲击"
      },
      "searchKeywords": ["ambient tension", "mystery background", "cinematic low drone"]
    }
  ],
  "globalBgmMood": "悬疑 → 共鸣 → 力量",
  "copyrightNote": "给出情绪标签和搜索关键词，不推荐具体版权曲目"
}
```

### 6.8 画面 Agent

**职责**：将抽象口播转化为视觉画面，为每一段生成画面说明，生成 AI 图片提示词或 AI 视频提示词，提供镜头语言和剪辑建议。

**输出 Schema**：

```json
{
  "segments": [
    {
      "segmentId": "seg_1",
      "visualDescription": "一个人坐在电脑前，鼠标停在空白文档上，房间昏暗",
      "shotType": "close-up",
      "framing": "中近景",
      "cameraMovement": "缓慢推进 (slow push-in)",
      "imagePrompt": "a young professional sitting in front of a blank document on a laptop, dim room with single desk lamp, close-up shot, realistic cinematic lighting, shallow depth of field, moody atmosphere --ar 9:16",
      "videoPrompt": "slow push-in shot of a laptop screen showing blank document, cursor blinking, person's hands resting motionless on keyboard, quiet tense atmosphere, cinematic 4K --ar 9:16",
      "subtitleLayout": "底部居中，关键词放大 + 红色高亮",
      "transitionTo": "hard cut"
    }
  ],
  "visualStyle": "写实电影感 + 文字动态叠加",
  "consistencyCheck": "所有画面主体一致，光线统一偏暗暖调"
}
```

### 6.9 导演位 Agent

**职责**：整合所有支线，检查一致性，修复节奏、钩子、画面问题，输出最终台本。

**导演位检查项**：

- 主题是否清晰。
- 开头 3 秒是否有效。
- 中段是否存在流失风险。
- 情绪曲线是否有变化。
- 画面是否能承接口播。
- BGM 是否和情绪匹配。
- 钩子是否自然嵌入台词。
- 结尾是否有记忆点。
- 是否适合目标平台。

**输出 Schema**：

```json
{
  "title": "你不是拖延，你是在逃避一个太模糊的目标",
  "durationSeconds": 60,
  "segments": [
    {
      "orderIndex": 1,
      "startTime": 0,
      "endTime": 5,
      "segmentGoal": "3秒内打破认知",
      "dialogue": "你以为你是在拖延，其实你是在害怕开始。",
      "subtitleText": "你不是拖延，是害怕开始",
      "directorNote": "开头字幕0.5秒内出现关键词'害怕开始'，字体加粗放大",
      "tracks": {
        "hook": { "type": "反常识钩子", "strength": 9, "integrated": true },
        "emotion": { "primary": "好奇", "intensity": 7, "direction": "上升" },
        "bgm": { "mood": "悬疑低频", "bpm": "70-85", "keywords": ["ambient tension"] },
        "visual": {
          "description": "电脑前空白文档特写",
          "imagePrompt": "a young professional sitting in front of blank laptop document, dim room, close-up, cinematic --ar 9:16",
          "videoPrompt": "slow push-in shot of laptop with blank document, quiet tense atmosphere --ar 9:16"
        },
        "edit": { "transitionIn": "cut", "transitionOut": "cut", "subtitleStyle": "bottom-center-bold" }
      }
    }
  ],
  "qualityChecklist": {
    "themeClarity": "pass",
    "opening3Seconds": "pass",
    "midpointRetention": "pass",
    "emotionalVariety": "pass",
    "visualDialogueAlignment": "pass",
    "bgmEmotionMatch": "pass",
    "endingMemorability": "pass",
    "platformFit": "pass - douyin"
  },
  "revisionSuggestions": []
}
```

## 7. 数据库设计

### 7.1 ER 图

```mermaid
erDiagram
    users ||--o{ projects : owns
    projects ||--o{ source_materials : has
    projects ||--o{ topics : has
    topics ||--o{ viral_references : uses
    viral_references ||--o{ knowledge_items : extracts
    topics ||--o{ knowledge_items : aggregates
    projects ||--o{ agent_runs : has
    agent_runs ||--o{ agent_outputs : produces
    projects ||--o{ script_versions : has
    script_versions ||--o{ script_segments : contains
    script_segments ||--o{ segment_tracks : has
    projects ||--o{ media_assets : reserves
```

### 7.2 主要表结构

#### users

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK, DEFAULT gen_random_uuid() | 用户 ID |
| name | varchar(100) | NOT NULL | 用户名 |
| email | varchar(255) | UNIQUE, NOT NULL | 邮箱 |
| password_hash | varchar(255) | NOT NULL | bcrypt 哈希 |
| avatar_url | text | | 头像 URL |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 创建时间 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 更新时间 |

#### projects

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | 项目 ID |
| user_id | uuid | FK → users.id, NOT NULL | 用户 ID |
| title | varchar(200) | NOT NULL | 项目标题 |
| status | varchar(30) | NOT NULL, DEFAULT 'draft' | 见状态机章节 |
| target_platform | varchar(30) | NOT NULL | douyin / xiaohongshu / bilibili / video_account |
| video_type | varchar(30) | NOT NULL | oral / story / knowledge / opinion / mixed |
| duration_seconds | int | NOT NULL, CHECK(15-300) | 目标时长(秒) |
| current_step | varchar(30) | DEFAULT 'input' | 当前创作步骤 |
| metadata | jsonb | DEFAULT '{}' | 扩展元数据 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 创建时间 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 更新时间 |

#### source_materials

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | 素材 ID |
| project_id | uuid | FK → projects.id, NOT NULL | 项目 ID |
| type | varchar(30) | NOT NULL | chat_log / reflection / note / draft |
| content | text | NOT NULL | 原始内容 |
| is_encrypted | boolean | DEFAULT false | 是否已加密 |
| metadata | jsonb | DEFAULT '{}' | 来源、平台、标签等 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 创建时间 |

#### topics

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | 选题 ID |
| project_id | uuid | FK → projects.id, NOT NULL | 项目 ID |
| title | varchar(300) | NOT NULL | 选题标题 |
| theme_summary | text | NOT NULL | 主题摘要 |
| target_audience | text | | 目标受众 |
| core_conflict | text | | 核心冲突 |
| emotional_tone | varchar(50) | | 情绪基调 |
| score | numeric(3,2) | CHECK(0-1) | 推荐分 |
| virality_potential | varchar(20) | | high / medium / low |
| selected | boolean | DEFAULT false | 是否选中 |
| agent_run_id | uuid | FK → agent_runs.id | 生成此选题的 Agent 运行 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 创建时间 |

#### viral_references

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | 参考 ID |
| topic_id | uuid | FK → topics.id, NOT NULL | 选题 ID |
| platform | varchar(30) | NOT NULL | 平台 |
| title | varchar(500) | NOT NULL | 标题 |
| url | text | | 链接 |
| author | varchar(200) | | 作者 |
| metrics | jsonb | DEFAULT '{}' | 播放量、点赞、评论等 |
| transcript | text | | 文案或字幕 |
| raw_data | jsonb | DEFAULT '{}' | 原始搜索数据 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 创建时间 |

#### knowledge_items

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | 知识项 ID |
| reference_id | uuid | FK → viral_references.id, NOT NULL | 来源参考 |
| topic_id | uuid | FK → topics.id | 关联选题 |
| item_type | varchar(30) | NOT NULL | hook / structure / emotion / visual / comment_insight |
| content | text | NOT NULL | 提炼内容 |
| tags | text[] | DEFAULT '{}' | 标签 |
| confidence | numeric(3,2) | CHECK(0-1) | 置信度 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 创建时间 |

#### agent_runs

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | 运行 ID |
| project_id | uuid | FK → projects.id, NOT NULL | 项目 ID |
| agent_type | varchar(30) | NOT NULL | topic / search / outline / dialogue / hook / emotion / bgm / visual / director |
| status | varchar(20) | NOT NULL, DEFAULT 'pending' | pending / running / success / failed / cancelled |
| model | varchar(50) | NOT NULL | 使用的模型名 |
| input_snapshot | jsonb | | 输入快照(脱敏后) |
| output_summary | text | | 输出摘要 |
| error_message | text | | 错误信息 |
| retry_count | int | DEFAULT 0 | 重试次数 |
| token_usage | jsonb | | { prompt, completion, total } |
| duration_ms | int | | 执行耗时 |
| started_at | timestamptz | | 开始时间 |
| finished_at | timestamptz | | 结束时间 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 创建时间 |

#### agent_outputs

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | 输出 ID |
| agent_run_id | uuid | FK → agent_runs.id, NOT NULL | 运行 ID |
| output_type | varchar(30) | NOT NULL | topic_list / outline / dialogue / hook_track / emotion_track / bgm_track / visual_track / final_script |
| content | jsonb | NOT NULL | 结构化输出 |
| schema_version | varchar(10) | DEFAULT '1.0' | Schema 版本 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 创建时间 |

#### script_versions

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | 台本版本 ID |
| project_id | uuid | FK → projects.id, NOT NULL | 项目 ID |
| version_no | int | NOT NULL | 版本号 |
| title | varchar(300) | NOT NULL | 台本标题 |
| summary | text | | 台本摘要 |
| total_duration_seconds | numeric(6,1) | NOT NULL | 总时长 |
| status | varchar(20) | NOT NULL, DEFAULT 'draft' | draft / approved / exported |
| created_by_agent_run_id | uuid | FK → agent_runs.id | 导演位运行 ID |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 创建时间 |

#### script_segments

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | 段落 ID |
| script_version_id | uuid | FK → script_versions.id, NOT NULL | 台本版本 ID |
| order_index | int | NOT NULL | 顺序 |
| start_time | numeric(6,1) | NOT NULL | 开始秒数 |
| end_time | numeric(6,1) | NOT NULL | 结束秒数 |
| segment_goal | text | | 段落目标 |
| dialogue | text | NOT NULL | 台词 |
| subtitle_text | text | | 字幕文本 |
| director_note | text | | 导演备注 |
| is_locked | boolean | DEFAULT false | 是否锁定(禁止重新生成) |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 创建时间 |

#### segment_tracks

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | 支线 ID |
| segment_id | uuid | FK → script_segments.id, NOT NULL | 段落 ID |
| track_type | varchar(20) | NOT NULL | hook / emotion / bgm / visual / edit |
| content | jsonb | NOT NULL | 支线内容 |
| agent_run_id | uuid | FK → agent_runs.id | 生成此支线的 Agent 运行 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 创建时间 |

#### media_assets

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | 素材 ID |
| project_id | uuid | FK → projects.id, NOT NULL | 项目 ID |
| segment_id | uuid | FK → script_segments.id | 关联段落 |
| asset_type | varchar(20) | NOT NULL | image / video / audio / bgm / sfx |
| generation_prompt | text | | 生成提示词 |
| storage_url | text | | 文件地址 |
| metadata | jsonb | DEFAULT '{}' | 尺寸、时长、版权等 |
| status | varchar(20) | NOT NULL, DEFAULT 'planned' | planned / generated / selected / rejected |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 创建时间 |

### 7.3 索引策略

```sql
-- 项目查询
CREATE INDEX idx_projects_user_status ON projects(user_id, status);
CREATE INDEX idx_projects_updated ON projects(updated_at DESC);

-- Agent 运行追踪
CREATE INDEX idx_agent_runs_project ON agent_runs(project_id, agent_type);
CREATE INDEX idx_agent_runs_status ON agent_runs(status);

-- 素材查询
CREATE INDEX idx_source_materials_project ON source_materials(project_id);

-- 选题查询
CREATE INDEX idx_topics_project ON topics(project_id);
CREATE INDEX idx_topics_selected ON topics(project_id) WHERE selected = true;

-- 台本查询
CREATE INDEX idx_script_versions_project ON script_versions(project_id, version_no DESC);
CREATE INDEX idx_script_segments_version ON script_segments(script_version_id, order_index);
```

## 8. 项目状态机

### 8.1 项目生命周期

```mermaid
stateDiagram-v2
    [*] --> draft: 创建项目
    draft --> material_input: 输入素材
    material_input --> topics_generated: 主题提炼完成
    material_input --> material_input: 继续添加素材
    topics_generated --> topic_selected: 选择选题
    topics_generated --> topics_generated: 重新生成选题
    topic_selected --> references_collected: 爆款搜索完成
    references_collected --> outline_generated: 框架生成完成
    outline_generated --> tracks_generating: 开始生成支线
    tracks_generating --> script_draft: 全部支线 + 导演位完成
    script_draft --> script_draft: 编辑/重写段落
    script_draft --> script_exported: 导出
    script_exported --> script_draft: 继续编辑
    script_draft --> archived: 归档
    script_exported --> archived: 归档

    draft --> archived: 放弃项目
    material_input --> archived: 放弃项目
    topics_generated --> archived: 放弃项目
```

### 8.2 创作步骤 (current_step)

| 步骤 | 值 | 说明 |
|---|---|---|
| 素材输入 | `input` | 等待用户输入聊天记录或感悟 |
| 主题提炼 | `topics` | 等待或正在生成候选选题 |
| 选题确认 | `topic_selection` | 等待用户选择选题 |
| 爆款搜索 | `references` | 正在搜索或等待确认参考 |
| 框架生成 | `outline` | 正在生成或等待确认框架 |
| 支线生成 | `tracks` | 正在生成各支线 |
| 台本编辑 | `script` | 台本已生成，等待编辑/导出 |
| 已导出 | `exported` | 已导出 |

### 8.3 Agent 运行状态

```mermaid
stateDiagram-v2
    [*] --> pending: 入队
    pending --> running: Worker 拾取
    running --> success: LLM 返回有效结果
    running --> failed: 异常/超时/格式错误
    failed --> pending: 重试 (retry_count < 3)
    failed --> dead: 重试耗尽
    success --> [*]
    dead --> [*]
    pending --> cancelled: 用户取消
    running --> cancelled: 用户取消
```

## 9. API 设计

### 9.1 通用规范

#### 基础 URL

```
/api/v1
```

#### 认证

所有 API 请求需携带 HttpOnly Cookie 中的 JWT Token。Middleware 自动校验并注入 `request.userId`。

#### 分页

```json
// 请求
GET /api/v1/projects?page=1&pageSize=20

// 响应
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 156,
    "totalPages": 8
  }
}
```

#### 错误格式

```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "项目不存在或无权访问",
    "details": {},
    "requestId": "req_abc123"
  }
}
```

#### 幂等性

创建类接口支持可选的 `Idempotency-Key` 请求头，重复请求返回首次结果。

### 9.2 项目接口

#### 创建项目

`POST /api/v1/projects`

```json
{
  "title": "关于拖延症的短视频",
  "targetPlatform": "douyin",
  "videoType": "oral",
  "durationSeconds": 60
}
```

#### 获取项目列表

`GET /api/v1/projects?page=1&pageSize=20&status=draft&sort=updatedAt`

#### 获取项目详情

`GET /api/v1/projects/:projectId`

#### 更新项目

`PATCH /api/v1/projects/:projectId`

```json
{
  "title": "新标题",
  "targetPlatform": "xiaohongshu"
}
```

#### 删除项目

`DELETE /api/v1/projects/:projectId`

### 9.3 原始素材接口

#### 添加原始素材

`POST /api/v1/projects/:projectId/source-materials`

```json
{
  "type": "chat_log",
  "content": "这里是用户和 AI 的聊天记录...",
  "metadata": { "source": "manual_input" }
}
```

#### 获取素材列表

`GET /api/v1/projects/:projectId/source-materials`

### 9.4 选题接口

#### 生成候选选题

`POST /api/v1/projects/:projectId/topics/generate`

```json
{
  "style": "sharp_emotional",
  "count": 5
}
```

响应：

```json
{
  "runId": "agent_run_uuid",
  "status": "running"
}
```

#### 获取选题列表

`GET /api/v1/projects/:projectId/topics`

#### 选择选题

`POST /api/v1/projects/:projectId/topics/:topicId/select`

#### 重新生成选题

`POST /api/v1/projects/:projectId/topics/regenerate`

### 9.5 爆款参考接口

#### 搜索爆款参考

`POST /api/v1/projects/:projectId/references/search`

```json
{
  "platforms": ["douyin", "xiaohongshu", "bilibili"],
  "limit": 20
}
```

#### 获取参考列表

`GET /api/v1/projects/:projectId/references`

#### 获取知识项

`GET /api/v1/projects/:projectId/knowledge-items?type=hook`

### 9.6 台本接口

#### 生成完整台本

`POST /api/v1/projects/:projectId/scripts/generate`

```json
{
  "topicId": "topic_uuid",
  "durationSeconds": 60,
  "style": "sharp_emotional_oral"
}
```

#### 获取台本版本列表

`GET /api/v1/projects/:projectId/scripts`

#### 获取台本详情

`GET /api/v1/projects/:projectId/scripts/:scriptVersionId`

#### 更新台本段落

`PATCH /api/v1/script-segments/:segmentId`

```json
{
  "dialogue": "新的台词内容",
  "directorNote": "加强这里的停顿",
  "isLocked": true
}
```

#### 单段重写

`POST /api/v1/script-segments/:segmentId/rewrite`

```json
{
  "rewriteTargets": ["dialogue", "visual"],
  "feedback": "台词不够口语化，太书面"
}
```

#### 导出台本

`GET /api/v1/scripts/:scriptVersionId/export?format=markdown`

支持格式：`markdown` | `json` | `csv`

### 9.7 进度推送接口

#### SSE 订阅

`GET /api/v1/projects/:projectId/events`

响应（SSE 流）：

```
event: agent_started
data: {"agentType":"topic","runId":"uuid","startedAt":"..."}

event: agent_progress
data: {"agentType":"topic","runId":"uuid","message":"正在分析聊天记录..."}

event: agent_completed
data: {"agentType":"topic","runId":"uuid","durationMs":3200}

event: agent_failed
data: {"agentType":"topic","runId":"uuid","error":"LLM timeout"}

event: workflow_completed
data: {"scriptVersionId":"uuid","status":"success"}
```

### 9.8 Agent 运行记录接口

#### 获取运行状态

`GET /api/v1/agent-runs/:runId`

#### 获取项目全部运行记录

`GET /api/v1/projects/:projectId/agent-runs?page=1&pageSize=50`

#### 取消运行

`POST /api/v1/agent-runs/:runId/cancel`

## 10. Agent 编排伪代码

### 10.1 总编排流程

```ts
async function generateFullVideoScript(projectId: string, topicId: string) {
  const project = await projectRepo.findById(projectId);
  const topic = await topicRepo.findById(topicId);
  const sources = await sourceRepo.findByProjectId(projectId);
  const references = await referenceRepo.findByTopicId(topicId);
  const knowledgeItems = await knowledgeRepo.findByTopicId(topicId);

  // 第1步：视频框架（串行，因为后续所有支线都依赖它）
  const outline = await runAgent("outline", {
    project, topic, sources, references, knowledgeItems,
  });

  // 第2步：4条独立支线并行生成
  const [dialogueTrack, hookTrack, emotionTrack, visualTrack] =
    await Promise.all([
      runAgent("dialogue", { project, topic, outline, knowledgeItems }),
      runAgent("hook",      { project, topic, outline, knowledgeItems }),
      runAgent("emotion",   { project, topic, outline, knowledgeItems }),
      runAgent("visual",    { project, topic, outline, knowledgeItems }),
    ]);

  // 第3步：BGM 依赖情绪支线，必须串行
  const bgmTrack = await runAgent("bgm", {
    project, topic, outline, emotionTrack,
  });

  // 第4步：导演位整合所有支线
  const finalScript = await runAgent("director", {
    project, topic, outline,
    dialogueTrack, hookTrack, emotionTrack, bgmTrack, visualTrack,
  });

  return await scriptRepo.createVersionFromDirectorOutput(projectId, finalScript);
}
```

**依赖图**：

```mermaid
flowchart TD
    OUTLINE[视频框架 Agent] --> DIALOGUE[台词 Agent]
    OUTLINE --> HOOK[钩子 Agent]
    OUTLINE --> EMOTION[情绪 Agent]
    OUTLINE --> VISUAL[画面 Agent]
    EMOTION --> BGM[BGM Agent]
    DIALOGUE --> DIRECTOR[导演位 Agent]
    HOOK --> DIRECTOR
    EMOTION --> DIRECTOR
    BGM --> DIRECTOR
    VISUAL --> DIRECTOR
```

### 10.2 智能体运行封装

```ts
async function runAgent<TInput, TOutput>(
  agentType: AgentType,
  input: TInput
): Promise<TOutput> {
  const run = await agentRunRepo.create({
    agentType,
    status: "running",
    model: "deepseek-v4",
    inputSnapshot: sanitizeForLogging(input),
  });

  // 通过 SSE 通知前端
  await sseBroadcaster.publish(run.projectId, {
    event: "agent_started",
    data: { agentType, runId: run.id },
  });

  try {
    const prompt = buildPrompt(agentType, input);
    const schema = getOutputSchema(agentType);

    const { output, usage } = await llmClient.generateStructured({
      model: "deepseek-v4",
      prompt,
      schema,
      temperature: getAgentTemperature(agentType),
      maxTokens: getAgentMaxTokens(agentType),
      timeout: 120_000,
    });

    await agentOutputRepo.create({
      agentRunId: run.id,
      outputType: getOutputType(agentType),
      content: output,
    });

    await agentRunRepo.markSuccess(run.id, usage);

    await sseBroadcaster.publish(run.projectId, {
      event: "agent_completed",
      data: { agentType, runId: run.id, durationMs: run.durationMs },
    });

    return output;
  } catch (error) {
    await agentRunRepo.markFailed(run.id, String(error));

    await sseBroadcaster.publish(run.projectId, {
      event: "agent_failed",
      data: { agentType, runId: run.id, error: summarizeError(error) },
    });

    throw error;
  }
}
```

### 10.3 导演位整合伪代码

```ts
async function directFinalScript(input: DirectorInput): Promise<FinalScript> {
  const segments = input.outline.segments.map((segment) => {
    const dialogue = findTrackItem(input.dialogueTrack, segment.id);
    const hook = findTrackItem(input.hookTrack, segment.id);
    const emotion = findTrackItem(input.emotionTrack, segment.id);
    const bgm = findTrackItem(input.bgmTrack, segment.id);
    const visual = findTrackItem(input.visualTrack, segment.id);

    return {
      orderIndex: segment.orderIndex,
      startTime: segment.startTime,
      endTime: segment.endTime,
      segmentGoal: segment.goal,
      dialogue: mergeHookIntoDialogue(dialogue.text, hook),
      subtitleText: buildSubtitle(dialogue.text, hook),
      tracks: { hook, emotion, bgm, visual, edit: buildEditSuggestion(segment, hook, emotion, visual) },
      directorNote: buildDirectorNote(segment, hook, emotion, bgm, visual),
    };
  });

  return {
    title: input.topic.title,
    summary: input.outline.summary,
    totalDurationSeconds: input.project.durationSeconds,
    segments,
    qualityChecklist: validateScriptQuality(segments),
  };
}
```

## 11. LLM Prompt 设计

### 11.1 通用约束

所有智能体都使用结构化输出，避免只返回自然语言。

通用要求：

- 输出必须符合 JSON Schema。
- 不直接复制爆款参考内容，只借鉴结构、节奏和表达策略。
- 标注不确定性（`uncertaintyNotes` 字段）。
- 每个结论尽量绑定来源或依据（`source` 字段）。
- 保持适合目标平台的表达风格。

### 11.2 台词 Agent Prompt 模板

```
## System Prompt

你是一位资深短视频编剧，专门为抖音/小红书/视频号创作口播脚本。

## 核心原则

1. 口语化：台词必须像朋友聊天，不能像念论文。
2. 短句：每句话不超过18个字，长句拆成短句。
3. 停顿：在关键信息前留0.5-1秒停顿空间。
4. 钩子嵌入：钩子（由钩子Agent提供）必须自然融入台词，不能生硬插入。
5. 金句克制：金句只为服务主题，每60秒视频最多1-2句。
6. 避免AI味：拒绝"在当今社会""众所周知""值得注意的是"等书面表达。

## 平台风格

- 抖音：直接、犀利、前3秒必须炸
- 小红书：温暖、共情、娓娓道来
- 视频号：稳重、有深度、偏中年语感
- B站：活泼、有梗、可适当玩梗

## User Prompt

目标平台：{{targetPlatform}}
视频时长：{{durationSeconds}}秒
视频类型：{{videoType}}
选题：{{topic.title}}
核心冲突：{{topic.coreConflict}}
情绪基调：{{topic.emotionalTone}}

视频框架：
{{#each outline.segments}}
- [{{startTime}}-{{endTime}}s] 目标：{{goal}}，核心信息：{{coreInfo}}
{{/each}}

爆款知识库参考：
{{#each knowledgeItems}}
- 类型：{{itemType}}，内容：{{content}}，置信度：{{confidence}}
{{/each}}

钩子安排：
{{#each hookTrack.segments}}
- 段落{{segmentId}}：{{hookType}}，意图：{{intent}}
{{/each}}

请为每一段生成口播台词，输出严格的 JSON 格式。
```

### 11.3 情绪 Agent Prompt 模板

```
## System Prompt

你是一位短视频情绪设计专家，专门为口播内容设计精确的情绪曲线。

## 核心原则

1. 情绪必须变化：一条视频如果从头到尾一个情绪，观众会在15秒内划走。
2. 每段一个主情绪 + 一个辅助情绪：主情绪是观众感知到的，辅助情绪是潜在的。
3. 量化强度：1-10分，1=几乎无情绪，10=情绪极度强烈。
4. 标注方向：上升（情绪加强）、下降（情绪减弱）、停顿（维持）、反转（情绪突变）。
5. 给出观众心理反应预测：此刻观众可能在想什么、感受到什么。

## 情绪类型库

- 好奇、惊讶、共鸣、刺痛、愤怒、焦虑、释然、希望、力量、温暖、幽默、紧迫

## User Prompt

目标平台：{{targetPlatform}}
视频时长：{{durationSeconds}}秒
选题：{{topic.title}}

视频框架：
{{#each outline.segments}}
- [{{startTime}}-{{endTime}}s] 目标：{{goal}}
{{/each}}

台词：
{{#each dialogueTrack.segments}}
- 段落{{segmentId}}：{{dialogue}}
{{/each}}

请为每一段设计情绪，输出严格的 JSON 格式。确保整体情绪曲线有起伏变化。
```

### 11.4 画面 Agent Prompt 模板

```
## System Prompt

你是一位短视频视觉导演，专门为口播内容设计配套画面。

## 核心原则

1. 画面承接口播：每个画面必须有信息增量，不能只是"说话的人"或装饰画面。
2. 抽象→具象：将抽象观点转化为可视化的隐喻或具体场景。
3. 镜头语言：明确镜头类型（特写/中景/远景）、景别、运动方式。
4. 提示词规范：AI图片/视频提示词必须包含主体、场景、光线、构图、风格、运动6要素。
5. 9:16构图：所有画面默认竖屏比例。
6. 一致性：整个视频的视觉风格、色调、光线保持统一。

## 提示词六要素

1. 主体（Subject）：画面中最核心的人或物
2. 场景（Setting）：环境、背景、空间
3. 光线（Lighting）：光源方向、色温、氛围
4. 构图（Composition）：拍摄角度、景别、画面布局
5. 风格（Style）：写实/动画/极简/电影感等
6. 运动（Movement）：镜头运动方式、画面动态

## User Prompt

目标平台：{{targetPlatform}}
选题：{{topic.title}}
视觉风格偏好：写实电影感

视频框架：
{{#each outline.segments}}
- [{{startTime}}-{{endTime}}s] 目标：{{goal}}，核心信息：{{coreInfo}}
{{/each}}

台词：
{{#each dialogueTrack.segments}}
- 段落{{segmentId}}：{{dialogue}}
{{/each}}

情绪曲线：
{{#each emotionTrack.segments}}
- 段落{{segmentId}}：主情绪={{primaryEmotion}}，强度={{intensity}}
{{/each}}

请为每一段生成画面描述和 AI 提示词，输出严格的 JSON 格式。
```

### 11.5 导演位 Prompt 模板

```
## System Prompt

你是一位短视频导演，负责整合编剧、情绪设计、视觉导演、BGM和钩子策划的输出，形成一份完整的可执行台本。

## 你的职责

1. 整合所有支线，形成统一的时间轴。
2. 检查一致性：台词、画面、情绪、BGM、钩子是否互相支撑。
3. 修复问题：节奏不顺、钩子突兀、画面无法执行、情绪断层。
4. 加导演备注：每段给出具体的执行建议。

## 检查清单

- [ ] 主题是否在前3秒内清晰传达？
- [ ] 开头钩子是否有效（会让人停下来看）？
- [ ] 中段（15-40秒）是否存在流失风险？
- [ ] 情绪曲线是否有至少2次明显变化？
- [ ] 画面能否实际执行（不是抽象描述）？
- [ ] BGM情绪是否匹配每段内容？
- [ ] 钩子是否自然嵌入台词（不是独立存在的）？
- [ ] 结尾是否有记忆点或行动号召？
- [ ] 整体是否适合目标平台的节奏和风格？

## User Prompt

目标平台：{{targetPlatform}}
视频时长：{{durationSeconds}}秒
选题：{{topic.title}}

框架：{{outline}}
台词：{{dialogueTrack}}
钩子：{{hookTrack}}
情绪：{{emotionTrack}}
BGM：{{bgmTrack}}
画面：{{visualTrack}}

请整合以上所有支线，进行一致性检查和修复，输出最终台本。如有无法自动修复的问题，在 revisionSuggestions 中标注。
```

## 12. DeepSeek-V4 接入设计

### 12.1 LLM Client 抽象

```ts
interface LLMClient {
  generateText(input: GenerateTextInput): Promise<GenerateTextOutput>;
  generateStructured<T>(input: GenerateStructuredInput<T>): Promise<GenerateStructuredOutput<T>>;
}

interface GenerateStructuredInput<T> {
  model: string;
  prompt: string;
  schema: JsonSchema;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

interface GenerateStructuredOutput<T> {
  data: T;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationMs: number;
}

interface LLMError {
  code: "TIMEOUT" | "RATE_LIMITED" | "INVALID_RESPONSE" | "SCHEMA_MISMATCH" | "CONTENT_FILTER";
  message: string;
  retryable: boolean;
}
```

### 12.2 模型使用策略

| 场景 | temperature | maxTokens | 说明 |
|---|---|---|---|
| 主题提炼 | 0.4 | 4096 | 兼顾准确和发散 |
| 爆款分析 | 0.2 | 8192 | 更偏分析和归纳 |
| 视频框架 | 0.5 | 4096 | 保持结构创造力 |
| 台词生成 | 0.7 | 8192 | 需要表达活性 |
| 钩子生成 | 0.8 | 4096 | 需要强创意 |
| 情绪分析 | 0.4 | 4096 | 需要稳定判断 |
| BGM 推荐 | 0.4 | 4096 | 基于情绪匹配 |
| 画面生成 | 0.7 | 8192 | 需要视觉创意 |
| 导演整合 | 0.3 | 16384 | 偏一致性和校验，需要大上下文 |

### 12.3 重试与超时策略

```ts
const RETRY_CONFIG: Record<LLMErrorCode, { maxRetries: number; backoffMs: number }> = {
  TIMEOUT:          { maxRetries: 2, backoffMs: 1000 },
  RATE_LIMITED:     { maxRetries: 3, backoffMs: 5000 },
  INVALID_RESPONSE: { maxRetries: 1, backoffMs: 500 },
  SCHEMA_MISMATCH:  { maxRetries: 1, backoffMs: 500 },
  CONTENT_FILTER:   { maxRetries: 0, backoffMs: 0 },  // 不可重试
};
```

## 13. 搜索适配器设计

### 13.1 适配器接口

```ts
interface SearchAdapter {
  name: string;
  search(params: SearchParams): Promise<SearchResult[]>;
  healthCheck(): Promise<boolean>;
}

interface SearchParams {
  query: string;
  platforms?: string[];
  limit?: number;
  timeRange?: "day" | "week" | "month" | "year";
}

interface SearchResult {
  platform: string;
  title: string;
  url: string;
  author: string;
  transcript?: string;
  metrics: {
    plays?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
  publishedAt?: string;
  rawData: Record<string, unknown>;
}
```

### 13.2 搜索源策略

| 来源 | 适配器 | MVP 阶段 | 说明 |
|---|---|---|---|
| Bing Web Search | `BingSearchAdapter` | 启用 | 通用搜索，覆盖多平台 |
| SerpAPI | `SerpApiAdapter` | 可选 | 结构化搜索结果 |
| 手动录入 | `ManualAdapter` | 启用 | 用户自己粘贴爆款链接和内容 |
| 平台 API | `PlatformApiAdapter` | 后续 | 需各平台开放API权限 |
| 自建爬虫 | `CrawlerAdapter` | 后续 | 法律合规审查后启用 |

### 13.3 搜索结果处理管道

```
原始搜索结果 → 去重 → 过滤低质内容 → LLM 提炼分析 → 存入 viral_references + knowledge_items
```

去重策略：基于 URL + 标题相似度（> 0.9 视为重复）。

过滤规则：
- 播放量 < 10000 的参考价值低
- 标题为空或过短
- 内容与选题关键词匹配度 < 阈值

## 14. 任务队列设计

### 14.1 队列选型

使用 **BullMQ** (基于 Redis) 作为任务队列。

| 队列名 | 用途 | 并发数 | 超时 |
|---|---|---|---|
| `agent-tasks` | 所有 Agent LLM 调用 | 5 | 120s |
| `search-tasks` | 外部搜索请求 | 3 | 60s |
| `export-tasks` | 台本导出（Markdown/JSON/CSV） | 2 | 30s |

### 14.2 任务定义

```ts
interface AgentTaskData {
  projectId: string;
  agentType: AgentType;
  input: Record<string, unknown>;
  runId: string;
}

interface SearchTaskData {
  projectId: string;
  topicId: string;
  query: string;
  platforms: string[];
  limit: number;
}
```

### 14.3 重试策略

```ts
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 2000,
  },
  removeOnComplete: { age: 3600 * 24 },  // 成功任务24小时后清理
  removeOnFail: { age: 3600 * 24 * 7 },   // 失败任务7天后清理
};
```

### 14.4 死信队列

重试 3 次后仍失败的任务进入死信队列（`dead-letter`），通过管理面板查看和手动重试。

### 14.5 Worker 健康检查

```ts
// GET /api/v1/health/queues
{
  "queues": {
    "agent-tasks": { "waiting": 3, "active": 2, "completed": 156, "failed": 1, "dead": 0 },
    "search-tasks": { "waiting": 0, "active": 1, "completed": 89, "failed": 0, "dead": 0 },
    "export-tasks": { "waiting": 0, "active": 0, "completed": 34, "failed": 0, "dead": 0 }
  }
}
```

## 15. 实时进度推送设计

### 15.1 架构

```
Queue Worker ──→ Redis Pub/Sub ──→ SSE Broadcaster ──→ 前端 EventSource
```

### 15.2 SSE 频道设计

每个项目一个频道：`project:{projectId}:events`

### 15.3 事件类型

| 事件 | 触发时机 | 关键字段 |
|---|---|---|
| `agent_queued` | 任务入队 | agentType, runId |
| `agent_started` | Worker 拾取任务 | agentType, runId, startedAt |
| `agent_progress` | LLM 流式输出中 | agentType, runId, message |
| `agent_completed` | Agent 执行成功 | agentType, runId, durationMs |
| `agent_failed` | Agent 执行失败 | agentType, runId, error, retryCount |
| `workflow_step_completed` | 一个编排步骤完成 | step, completedAgents |
| `workflow_completed` | 全流程完成 | scriptVersionId |
| `workflow_failed` | 全流程失败 | error, failedAgent |

### 15.4 前端消费

```ts
// hooks/useProjectSSE.ts
function useProjectSSE(projectId: string) {
  const store = useProjectStore();

  useEffect(() => {
    const es = new EventSource(`/api/v1/projects/${projectId}/events`);

    es.addEventListener("agent_started", (e) => {
      store.setAgentRunning(JSON.parse(e.data));
    });
    es.addEventListener("agent_completed", (e) => {
      store.setAgentCompleted(JSON.parse(e.data));
    });
    es.addEventListener("agent_failed", (e) => {
      store.setAgentFailed(JSON.parse(e.data));
    });
    es.addEventListener("workflow_completed", (e) => {
      store.setWorkflowCompleted(JSON.parse(e.data));
    });

    return () => es.close();
  }, [projectId]);

  return store;
}
```

### 15.5 断线重连

- 前端 EventSource 自动重连。
- 后端在 SSE 连接中发送 `id` 字段（基于事件序号），前端重连时通过 `Last-Event-ID` 请求头续传。
- Redis Pub/Sub 消息缓存最近 100 条事件，支持断线补发。

## 16. 前端设计

### 16.1 项目工作台布局

```
┌──────────┬──────────────────────────────┬─────────────┐
│  左侧     │         中间                  │   右侧       │
│  导航     │       主工作区                │  上下文面板   │
│          │                              │             │
│ 1.素材   │  ┌────────────────────────┐  │ 项目信息     │
│ 2.选题   │  │                        │  │ 目标平台     │
│ 3.参考   │  │   当前步骤内容           │  │ 视频类型     │
│ 4.框架   │  │                        │  │ 目标时长     │
│ 5.台本   │  │                        │  │             │
│          │  └────────────────────────┘  │ Agent 状态   │
│ 进度条   │                              │ ● 台词 done  │
│ ○○○●○○  │  Agent 运行进度              │ ◐ 钩子 run   │
│          │  [已完成3/7]                 │ ○ 情绪 wait  │
│          │                              │             │
│          │                              │ 版本历史     │
│          │                              │ v3 - 5分钟前 │
│          │                              │ v2 - 1小时前 │
│          │                              │             │
│          │                              │ [导出]      │
└──────────┴──────────────────────────────┴─────────────┘
```

### 16.2 台本编辑器

时间轴表格为核心交互：

| 时间 | 台词 | 画面 | 情绪 | BGM | 钩子 | 导演备注 | 操作 |
|---|---|---|---|---|---|---|---|
| 0-5s | 开头台词... | 快切画面 | 好奇 7/10 | 悬疑低频 | 反常识 | 字幕放大 | 重写/锁定 |

功能：
- **单段重写**：选中某段 → 选择重写目标（台词/画面/情绪/BGM）→ 提供反馈 → 重新生成。
- **单支线重写**：重写整个情绪曲线或整个画面支线。
- **锁定机制**：锁定满意段落，后续重写不覆盖。
- **溯源查看**：点击任意一段，查看该段由哪些 Agent 输出组成，可跳转到对应的 `agent_run` 详情。
- **导出**：Markdown / JSON / CSV。

### 16.3 Zustand Store 结构

```ts
interface ProjectStore {
  // 项目
  project: Project | null;
  setProject: (p: Project) => void;

  // Agent 运行状态
  agentRuns: Map<string, AgentRunState>;
  setAgentRunning: (data: AgentEvent) => void;
  setAgentCompleted: (data: AgentEvent) => void;
  setAgentFailed: (data: AgentEvent) => void;

  // 当前步骤
  currentStep: ProjectStep;
  setCurrentStep: (step: ProjectStep) => void;

  // 台本编辑器
  script: ScriptVersion | null;
  lockedSegments: Set<string>;
  toggleSegmentLock: (segmentId: string) => void;
  updateSegment: (segmentId: string, data: Partial<ScriptSegment>) => void;

  // 导出
  exportFormat: "markdown" | "json" | "csv";
  setExportFormat: (f: ExportFormat) => void;
}
```

## 17. 认证与授权设计

### 17.1 认证方案

- **JWT + HttpOnly Cookie**：用户登录后，服务端签发 JWT，存入 HttpOnly Secure SameSite Cookie。
- **Token 有效期**：Access Token 2小时，Refresh Token 7天（存在数据库中）。
- **密码存储**：bcrypt, cost factor = 12。

### 17.2 API Middleware

```ts
// middleware.ts
export async function authMiddleware(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  try {
    const payload = await verifyJWT(token);
    request.headers.set("x-user-id", payload.sub);
    request.headers.set("x-user-role", payload.role);
    return NextResponse.next();
  } catch {
    return NextResponse.json({ error: { code: "TOKEN_EXPIRED" } }, { status: 401 });
  }
}

export const config = {
  matcher: "/api/v1/:path*",  // 排除公开路由: /api/v1/auth/*
};
```

### 17.3 授权策略

- **项目级隔离**：所有数据库查询必须带 `user_id` 过滤。
- **Prisma Middleware** 注入 `WHERE user_id = currentUserId`（对于 projects 表）。
- **API 层二次校验**：即使数据库层有过滤，API 层也显式检查 `project.user_id === request.userId`。

```ts
async function getProject(projectId: string, userId: string): Promise<Project> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.userId !== userId) {
    throw new AppError("PROJECT_NOT_FOUND", 404);
  }
  return project;
}
```

### 17.4 数据加密

- 原始素材（聊天记录）在数据库中使用 AES-256-GCM 加密存储。
- 加密密钥从环境变量 `ENCRYPTION_KEY` 读取，由 KMS 管理（生产环境）。
- 导出内容时，敏感信息自动脱敏。

### 17.5 安全头

```http
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

## 18. 错误处理与降级策略

### 18.1 错误分类

| 类别 | 示例 | 处理策略 |
|---|---|---|
| LLM 超时 | 生成超过 120 秒 | 自动重试 2 次，仍失败则降级为简化输出 |
| LLM 格式错误 | JSON 不匹配 Schema | 自动重试 1 次，附加格式纠正 prompt |
| LLM 内容过滤 | 触发安全审查 | 不可重试，返回友好提示，建议修改输入 |
| 搜索失败 | 外部 API 超时或限流 | 降级为仅使用已有知识库和 LLM 知识 |
| 数据库异常 | 连接池耗尽 | 返回 503，等待恢复 |
| 队列满载 | 任务堆积超过阈值 | 拒绝新任务，提示用户稍后重试 |

### 18.2 降级策略

```ts
async function searchViralReferencesWithFallback(
  topic: Topic,
  platforms: string[]
): Promise<SearchResult[]> {
  try {
    return await searchAdapter.search({ query: topic.title, platforms });
  } catch (error) {
    logger.warn("Search failed, falling back to LLM knowledge", { error });

    // 降级：仅用 LLM 的内置知识分析选题
    return await llmClient.generateStructured({
      model: "deepseek-v4",
      prompt: buildFallbackSearchPrompt(topic),
      schema: fallbackSearchSchema,
      temperature: 0.3,
    });
  }
}
```

### 18.3 全局错误处理

```ts
// error-handler.ts
function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "请求参数不合法", details: error.flatten() } },
      { status: 400 }
    );
  }

  // 未知错误
  logger.error("Unhandled error", { error });
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
    { status: 500 }
  );
}
```

## 19. 可观测性设计

### 19.1 日志

使用结构化日志（JSON 格式），关键字段：

```ts
logger.info("Agent run completed", {
  runId: string,
  agentType: string,
  projectId: string,
  durationMs: number,
  tokenUsage: { prompt: number, completion: number, total: number },
  status: "success" | "failed",
});
```

日志级别：
- `debug`：开发调试。
- `info`：Agent 运行、用户操作。
- `warn`：重试、降级、搜索失败。
- `error`：LLM 异常、数据库故障、队列死信。

### 19.2 Metrics

| 指标 | 类型 | 说明 |
|---|---|---|
| `agent_run_duration_ms` | Histogram | 各 Agent 执行耗时 |
| `agent_run_total` | Counter | Agent 运行次数（按 type, status 分组） |
| `llm_token_usage_total` | Counter | Token 消耗总量 |
| `llm_request_errors_total` | Counter | LLM 请求错误数（按 error_code 分组） |
| `search_request_duration_ms` | Histogram | 搜索耗时 |
| `queue_waiting_tasks` | Gauge | 各队列等待任务数 |
| `api_request_duration_ms` | Histogram | API 请求耗时 |
| `api_request_errors_total` | Counter | API 错误数（按 status_code 分组） |

### 19.3 Token 成本追踪

```ts
// 每次 LLM 调用记录
interface TokenUsageRecord {
  runId: string;
  agentType: string;
  projectId: string;
  userId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostCents: number;
  timestamp: Date;
}
```

支持按项目、用户、日期范围查询 Token 消耗和成本估算。

### 19.4 健康检查

```
GET /api/v1/health
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "llm": "ok",
    "search": "degraded",
    "queue": "ok"
  },
  "uptime": 86400
}
```

## 20. 测试策略

### 20.1 测试金字塔

```
        ┌─────┐
        │ E2E │  少量：核心用户流程
        ├─────┤
        │集成  │  中等：Agent 编排、API、数据库
        ├─────┤
        │ 单元  │  大量：工具函数、Prompt 构建、数据校验
        └─────┘
```

### 20.2 单元测试

- **Prompt 构建函数**：验证不同 Agent 类型和输入组合产生正确的 Prompt 文本。
- **Schema 校验**：验证各 Agent 的 JSON Schema 定义正确。
- **状态机转换**：验证 `project.status` 合法转换。
- **工具函数**：`mergeHookIntoDialogue`、`buildSubtitle`、`buildDirectorNote` 等。

```ts
describe("buildPrompt - dialogue agent", () => {
  it("should include platform-specific style guidance", () => {
    const prompt = buildPrompt("dialogue", { project: { targetPlatform: "douyin" }, ... });
    expect(prompt).toContain("抖音");
    expect(prompt).toContain("前3秒必须炸");
  });

  it("should embed hook placement into prompt context", () => {
    const prompt = buildPrompt("dialogue", { hookTrack: { segments: [...] }, ... });
    expect(prompt).toContain("钩子安排");
  });
});
```

### 20.3 集成测试

- **API 端点**：使用 `supertest` 测试路由处理、认证中间件、错误处理。
- **Agent 编排**：Mock LLM 返回，验证编排流程的串并行逻辑正确。
- **数据库查询**：验证 Prisma 查询的正确性、索引命中。

```ts
describe("POST /api/v1/projects/:id/scripts/generate", () => {
  it("should return 401 without auth", async () => { ... });
  it("should return 404 for non-existent project", async () => { ... });
  it("should return runId and start async workflow", async () => { ... });
  it("should reject if project is not in correct state", async () => { ... });
});
```

### 20.4 Agent 输出质量评估

非自动化，人工抽样评估。评估维度：

| 维度 | 评分标准 | 目标 |
|---|---|---|
| 口语化程度 | 1-5 分，5=完全像真人说话 | ≥ 4 |
| 钩子自然度 | 钩子是否生硬插入 | ≥ 4 |
| 情绪曲线合理 | 情绪是否有变化 | ≥ 3 |
| 画面可执行性 | AI 提示词是否可直接使用 | ≥ 4 |
| 整体一致性 | 台词/画面/情绪是否协调 | ≥ 4 |

每 50 次生成抽样评估 1 次，记录趋势。

### 20.5 测试基础设施

- **测试框架**：Vitest（单元 + 集成）
- **E2E**：Playwright（核心用户流程）
- **数据库**：测试用 PostgreSQL 容器（Testcontainers）
- **Redis**：ioredis-mock 或测试用 Redis 容器
- **LLM Mock**：预定义的 JSON fixture 文件

## 21. 配置管理

### 21.1 环境变量

```bash
# .env.example

# 应用
NODE_ENV=development
APP_URL=http://localhost:3000
LOG_LEVEL=debug

# 数据库
DATABASE_URL=postgresql://user:pass@localhost:5432/scriptcraft
SHADOW_DATABASE_URL=postgresql://user:pass@localhost:5432/scriptcraft_shadow

# Redis
REDIS_URL=redis://localhost:6379/0

# DeepSeek
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_DEFAULT_MODEL=deepseek-v4
LLM_REQUEST_TIMEOUT_MS=120000

# 搜索
BING_SEARCH_API_KEY=xxx
SERAPI_API_KEY=xxx
SEARCH_TIMEOUT_MS=60000

# 安全
JWT_SECRET=xxx
ENCRYPTION_KEY=xxx
BCRYPT_COST=12

# 对象存储 (S3)
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=scriptcraft-media

# 功能开关
FEATURE_ENABLE_SEARCH=true
FEATURE_ENABLE_IMAGE_GEN=false
FEATURE_ENABLE_VIDEO_GEN=false
FEATURE_ENABLE_EXPORT=true
```

### 21.2 功能开关

运行时通过配置控制，支持按环境或按用户百分比灰度：

```ts
// config/features.ts
const featureFlags = {
  search: envBoolean("FEATURE_ENABLE_SEARCH", true),
  imageGeneration: envBoolean("FEATURE_ENABLE_IMAGE_GEN", false),
  videoGeneration: envBoolean("FEATURE_ENABLE_VIDEO_GEN", false),
  export: envBoolean("FEATURE_ENABLE_EXPORT", true),
  maxAgentRetries: envNumber("AGENT_MAX_RETRIES", 3),
  agentConcurrency: envNumber("AGENT_CONCURRENCY", 5),
};
```

### 21.3 模型参数集中管理

```ts
// config/agent-presets.ts
export const AGENT_PRESETS: Record<AgentType, AgentPreset> = {
  topic:     { temperature: 0.4, maxTokens: 4096 },
  search:    { temperature: 0.2, maxTokens: 8192 },
  outline:   { temperature: 0.5, maxTokens: 4096 },
  dialogue:  { temperature: 0.7, maxTokens: 8192 },
  hook:      { temperature: 0.8, maxTokens: 4096 },
  emotion:   { temperature: 0.4, maxTokens: 4096 },
  bgm:       { temperature: 0.4, maxTokens: 4096 },
  visual:    { temperature: 0.7, maxTokens: 8192 },
  director:  { temperature: 0.3, maxTokens: 16384 },
};
```

## 22. 部署与 CI/CD

### 22.1 容器化

```dockerfile
# Dockerfile
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN pnpm build

FROM base AS runner
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["node", "server.js"]
```

### 22.2 部署架构

```
┌──────────┐     ┌──────────────┐     ┌───────────────┐
│  Nginx    │────→│  Next.js     │────→│  PostgreSQL    │
│  (反向代理) │     │  (API + SSR)  │     │  (主数据库)     │
└──────────┘     └──────┬───────┘     └───────────────┘
                        │
                        ├────→ Redis (队列 + 缓存 + Pub/Sub)
                        │
                        └────→ Queue Worker (独立进程)
                                   │
                                   ├──→ DeepSeek API
                                   └──→ Search APIs
```

- Next.js 应用和 Queue Worker 是两个独立进程，可独立扩缩。
- PostgreSQL 和 Redis 使用托管服务（如 Supabase + Upstash）。
- 静态资源（图片、视频素材）走 S3 兼容对象存储 + CDN。

### 22.3 CI/CD 流程

```yaml
# .github/workflows/ci.yml (简化)
name: CI/CD
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: test }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma migrate deploy
      - run: pnpm test
      - run: pnpm lint
      - run: pnpm typecheck

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: pnpm build
      - run: docker build -t scriptcraft .
      - run: docker push registry.example.com/scriptcraft:latest
      # 触发部署 (Railway / Vercel / K8s 等)
```

### 22.4 数据库迁移

使用 Prisma Migrate：

```bash
# 开发环境：自动生成迁移
npx prisma migrate dev --name add_encryption_fields

# 生产环境：应用迁移
npx prisma migrate deploy

# 回滚（手动编写反向迁移脚本）
npx prisma migrate diff --from-... --to-... > rollback.sql
```

迁移策略：
- 所有迁移文件纳入版本控制。
- 先在 staging 环境运行迁移验证。
- 生产迁移在低峰期执行，有 rollback 预案。

## 23. 后续剪辑预留

虽然 MVP 不做自动剪辑，但数据结构应提前保留剪辑字段：

- 镜头时长。
- 转场类型（cut / dissolve / wipe / zoom）。
- 字幕样式（字体、大小、颜色、位置、动画）。
- 字幕强调词。
- 音效点位（SFX type, timing, duration）。
- BGM 入点和出点（fade in/out duration）。
- 素材文件地址（storage_url）。
- AI 生成素材提示词。

后续可扩展为：

- 接入 Remotion（React 视频渲染引擎）生成视频。
- 接入 FFmpeg 自动合成。
- 接入 Jianying/CapCut 草稿格式（JSON 导出直接导入剪辑软件）。
- 接入云端视频渲染队列（批量和并行渲染）。
- 素材库管理（复用以前生成的 AI 素材）。

## 24. MVP 开发里程碑

### 阶段一：基础设施 + 项目输入（第 1-2 周）

- 项目脚手架搭建（Next.js + Prisma + Redis + BullMQ）。
- 认证系统（注册、登录、JWT）。
- 项目 CRUD。
- 原始素材输入和加密存储。
- 基础 UI 框架搭建。

### 阶段二：主题提炼 + 爆款参考（第 3-4 周）

- 主题提炼 Agent 接入。
- 候选选题 UI。
- 搜索适配器接口 + Bing 接入。
- 爆款参考保存和展示。
- 知识项提炼。

### 阶段三：台本生成（第 5-7 周）

- 视频框架 Agent。
- 台词支线 Agent。
- 钩子支线 Agent。
- 情绪支线 Agent。
- BGM 支线 Agent。
- 画面支线 Agent。
- 导演位整合 Agent。
- SSE 实时进度推送。
- 任务队列 + 重试 + 死信队列。

### 阶段四：编辑 + 导出 + 上线（第 8-9 周）

- 台本时间轴编辑器。
- 单段重写 + 支线重写。
- 锁定机制。
- 版本管理。
- Markdown / JSON / CSV 导出。
- 可观测性（日志 + Metrics + Token 追踪）。
- 部署上线。

## 25. 风险与对策

| 风险 | 说明 | 对策 |
|---|---|---|
| 爆款数据难获取 | 平台限制较多 | 先支持手动录入和通用搜索；降级时用 LLM 内置知识 |
| 生成结果不稳定 | 多 Agent 可能风格不一致 | 导演位统一复核；温度参数调优；多版本对比 |
| 台词有 AI 味 | 过于抽象或书面 | 台词 Agent 增加口语化评分检查；Prompt 增加反例 |
| 画面无法落地 | 提示词太虚 | 画面 Agent 强制六要素输出；提供 Prompt 质量评分 |
| BGM 版权问题 | 不能直接推荐侵权音乐 | 只推荐情绪标签和搜索关键词，不推荐具体曲目 |
| 长任务体验差 | 多 Agent 生成耗时 30-60 秒 | SSE 实时进度 + 并行执行 + 队列异步化 |
| Token 成本高 | 多 Agent 每次生成消耗大量 Token | Token 预算追踪；按需重写而非全量重生成；缓存重复 Prompt |
| 隐私泄露 | 聊天记录包含敏感个人信息 | 加密存储 + 脱敏日志 + 导出时二次确认 |
| LLM 服务不可用 | API 故障或限流 | 重试 + 降级 + 用户友好提示 |

## 26. 最终输出格式示例

```json
{
  "title": "你不是拖延，你是在逃避一个太模糊的目标",
  "durationSeconds": 60,
  "segments": [
    {
      "orderIndex": 1,
      "startTime": 0,
      "endTime": 3,
      "segmentGoal": "打破认知，制造好奇",
      "dialogue": "你以为你是在拖延，其实你是在害怕开始。",
      "subtitleText": "你不是拖延，是害怕开始",
      "directorNote": "开头字幕直接压上，0.5秒内出现关键词'害怕开始'，字体加粗。",
      "tracks": {
        "hook": {
          "type": "反常识钩子",
          "intent": "打破用户对拖延的常见理解",
          "integrated": true
        },
        "emotion": {
          "primary": "刺痛",
          "secondary": "被看见",
          "intensity": 8,
          "direction": "上升"
        },
        "bgm": {
          "mood": "低频悬疑",
          "bpm": "70-85",
          "keywords": ["ambient tension", "soft pulse"]
        },
        "visual": {
          "description": "一个人坐在电脑前，鼠标停在空白文档上很久",
          "imagePrompt": "a young creator sitting in front of a blank document on a laptop, dim room, close-up, realistic cinematic lighting, shallow depth of field --ar 9:16",
          "videoPrompt": "slow push-in shot of a laptop with blank document, creator's hand hovering over keyboard, quiet tense atmosphere, cinematic 4K --ar 9:16"
        },
        "edit": {
          "transitionIn": "cut",
          "transitionOut": "cut",
          "subtitleStyle": "bottom-center-bold-red-keyword"
        }
      }
    }
  ]
}
```

## 27. 结论

本系统的核心价值在于将自媒体视频创作从单点文案生成升级为结构化创作流程。通过主题提炼、爆款知识库、多支线智能体和导演位整合，系统可以稳定产出更接近真实短视频生产流程的完整台本。

完善版设计文档在原有基础上补充了：
- 认证授权完整方案。
- 任务队列与异步处理机制。
- SSE 实时进度推送。
- 错误处理与降级策略。
- 可观测性（日志、Metrics、Token 追踪）。
- 分层测试策略。
- 配置管理与功能开关。
- CI/CD 与部署架构。
- 搜索适配器接口定义。
- 项目状态机与 Agent 状态机。
- 完整的 Agent 输出 JSON Schema。
- 核心 Agent 的 Prompt 模板。
- Prisma 中间件级别的授权过滤。

第一阶段应优先打通"输入素材 → 选题 → 爆款参考 → 多支线台本 → 导出"的闭环。剪辑、素材生成和发布平台对接可以在该闭环稳定后逐步扩展。
