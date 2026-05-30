# AI 自媒体视频台本生成系统设计文档 V3

## 1. 文档目标

本文档定义一个基于 Next.js 全栈架构的 BS 系统，用于将粗略聊天记录、个人感悟、灵感片段或初始选题，转化为可发布短视频所需的结构化台本。

系统第一阶段不做自动剪辑和自动发布，核心目标是稳定产出一份可进入剪辑阶段的导演级台本，包括台词、画面、情绪、BGM、钩子、字幕和剪辑预留信息。

## 2. 产品定位

系统不是普通文案生成器，而是一个短视频创作工作流编排系统。

核心能力：

- 从原始聊天记录或个人感悟中提炼可传播选题。
- 收集或录入同类爆款内容作为参考知识。
- 将选题拆成短视频主线结构。
- 设计开头钩子、中段留存钩子、结尾互动钩子。
- 将钩子自然融入台词。
- 梳理情绪曲线，并基于情绪推荐 BGM 与音效方向。
- 将抽象口播转化为画面支线，生成图片/视频提示词。
- 通过导演位 Agent 统一整合，输出完整台本。

## 3. MVP 范围

### 3.1 MVP 必做

- 用户注册、登录、项目管理。
- 创建视频项目。
- 输入原始素材，包括聊天记录、灵感、笔记、已有文案。
- 主题提炼，生成多个候选选题。
- 用户选择目标选题。
- 参考内容收集，支持手动录入和通用搜索。
- 参考内容分析，提取结构、钩子、情绪、评论共鸣、画面风格。
- 生成视频框架。
- 生成钩子计划。
- 生成台词支线。
- 生成情绪支线。
- 生成画面支线。
- 生成 BGM 支线。
- 导演位整合最终台本。
- 台本编辑、单段重写、锁定段落。
- 导出 Markdown、JSON、CSV。
- SSE 实时显示生成进度。

### 3.2 MVP 不做

- 自动剪辑成片。
- 自动发布到抖音、小红书、视频号、B 站。
- 平台级精确播放量抓取。
- 自建爬虫。
- 完整版权音乐库。
- 多人协作审批。
- AI 图片/视频真实生成。

MVP 只生成图片和视频提示词，不直接调用生图或生视频服务。

## 4. 总体架构

```mermaid
flowchart TD
    User[用户] --> FE[Next.js 前端]
    FE --> API[Next.js API Route Handlers]
    API --> Auth[认证与授权]
    API --> AppService[应用服务层]
    AppService --> Orchestrator[Workflow Orchestrator]
    Orchestrator --> Queue[BullMQ 队列]
    Queue --> Worker[Worker 进程]
    Worker --> LLM[DeepSeek 模型适配器]
    Worker --> Search[搜索适配器]
    Worker --> DB[(PostgreSQL)]
    Worker --> EventStore[(project_events)]
    API --> DB
    API --> EventStore
    FE --> SSE[SSE 订阅]
    SSE --> EventStore
    Worker --> Redis[(Redis)]
    Queue --> Redis
```

### 4.1 前端

- Next.js App Router。
- React Server Components 用于页面骨架和初始数据加载。
- Client Components 用于工作台、编辑器、SSE 进度展示。
- Tailwind CSS + shadcn/ui。
- Zustand 管理项目工作台状态。

### 4.2 后端

- Next.js Route Handlers 提供 REST API。
- Server Actions 只处理轻量表单，不承载长任务。
- BullMQ 处理长时间 Agent 任务。
- Worker 独立进程执行 LLM 调用、搜索、分析和台本生成。
- PostgreSQL 存储业务数据。
- Redis 用于 BullMQ 队列和分布式锁。
- SSE 从 `project_events` 表读取事件并推送，避免 Redis Pub/Sub 丢消息。

### 4.3 AI 模型

模型配置不在业务代码中写死，统一通过环境变量和 Agent Preset 管理。

推荐默认：

- 快速生成和普通分析：`deepseek-v4-flash`
- 导演位整合、长上下文复核：`deepseek-v4-pro`

如果模型名称后续变化，只调整配置，不改业务流程。

模型调用模式：

- 结构化输出和创意生成 Agent 默认关闭 thinking，确保 `temperature` 等采样参数可控。
- 导演位 Agent 可开启 thinking，用于长上下文整合、冲突检查和质量复核。
- 如果 thinking 开启，则不依赖 `temperature` 控制风格，优先通过 Prompt、Schema 和后处理校验控制输出。
- Agent Preset 必须显式声明 `thinking`，避免依赖模型服务端默认行为。

## 5. 核心数据流

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as 前端
    participant API as API
    participant ORC as Workflow Orchestrator
    participant W as Worker
    participant DB as PostgreSQL
    participant LLM as LLM
    participant Search as Search

    U->>FE: 输入聊天记录/感悟/灵感
    FE->>API: 创建项目和素材
    API->>DB: 保存 source_materials
    FE->>API: 请求生成候选选题
    API->>ORC: 创建 workflow_run
    ORC->>W: 入队 topic_extract
    W->>LLM: 主题提炼
    W->>DB: 保存 topics 和事件
    FE->>API: 选择选题
    FE->>API: 请求收集参考内容
    API->>ORC: 创建 reference_workflow
    W->>Search: 通用搜索
    W->>LLM: 分析参考内容
    W->>DB: 保存 references 和 knowledge_items
    FE->>API: 请求生成完整台本
    API->>ORC: 创建 script_workflow
    W->>LLM: 生成视频框架
    W->>LLM: 生成钩子计划
    W->>LLM: 根据钩子计划生成台词
    W->>LLM: 生成情绪支线
    W->>LLM: 生成画面支线
    W->>LLM: 基于情绪生成 BGM 支线
    W->>LLM: 导演位整合
    W->>DB: 保存 script_versions、script_segments、segment_tracks
    FE->>API: 拉取最终台本
```

## 6. Agent 设计

### 6.1 主题提炼 Agent

职责：

- 从原始素材中提炼主题。
- 将抽象表达转成可传播选题。
- 输出多个候选选题。

输入：

- source_materials
- target_platform
- video_type
- duration_seconds

输出：

```json
{
  "themeSummary": "关于拖延本质的重新解释",
  "candidates": [
    {
      "title": "你不是拖延，你是在逃避一个太模糊的目标",
      "targetAudience": "25-35岁职场人",
      "coreConflict": "拖延 vs 目标模糊带来的恐惧",
      "emotionalTone": "刺痛后释然",
      "score": 0.91,
      "reason": "具备反常识、代入感和方法价值"
    }
  ],
  "uncertaintyNotes": "原始素材未明确目标平台，默认按抖音口播处理"
}
```

### 6.2 参考内容 Agent

职责：

- 收集类似选题的参考内容。
- 支持手动录入和通用搜索。
- 提炼结构、钩子、情绪、画面风格、评论共鸣。

重要边界：

- MVP 不承诺获取真实平台播放量和完整评论。
- 如果搜索结果缺少指标，只保存可获得信息。
- 参考内容只借鉴结构，不复制表达。

输出：

```json
{
  "references": [
    {
      "sourceType": "manual",
      "platform": "douyin",
      "title": "拖延不是懒，是你对自己太苛刻",
      "url": "https://example.com",
      "transcript": "用户粘贴的字幕或文案",
      "metrics": {
        "plays": null,
        "likes": null
      },
      "analysis": {
        "hookPattern": "反常识开头",
        "narrativeStructure": "问题-反转-解释-方法-升华",
        "emotionalArc": ["好奇", "刺痛", "共鸣", "释然"],
        "visualStyle": "单人口播+关键词字幕",
        "commentInsights": ["原来我不是懒", "这个解释很像我"]
      }
    }
  ],
  "knowledgeItems": [
    {
      "itemType": "hook",
      "content": "用“你以为...其实...”制造认知反差",
      "tags": ["反常识", "开头钩子"],
      "confidence": 0.86
    }
  ]
}
```

### 6.3 视频框架 Agent

职责：

- 将选题拆成视频主线。
- 明确每段目标、时长、信息密度和转折点。

输出：

```json
{
  "totalDurationSeconds": 60,
  "summary": "通过重新解释拖延，引导观众从自责转向行动",
  "segments": [
    {
      "segmentKey": "s1",
      "orderIndex": 1,
      "startTime": 0,
      "endTime": 5,
      "goal": "制造认知冲突",
      "coreInfo": "拖延不是懒，而是害怕开始",
      "intensityLevel": 8
    }
  ],
  "climaxPosition": "40-50s",
  "endingAction": "引导观众写下明天的第一个具体动作"
}
```

### 6.4 钩子计划 Agent

职责：

- 先于台词生成。
- 规划开头钩子、中段防流失钩子、结尾互动钩子。
- 输出钩子意图和植入位置，不直接写完整台词。

输出：

```json
{
  "segments": [
    {
      "segmentKey": "s1",
      "hookType": "反常识钩子",
      "intent": "打破观众对拖延的常规理解",
      "hookSeed": "你以为你是在拖延，其实你是在害怕开始",
      "placement": "first_sentence",
      "strength": 9
    }
  ],
  "densityRule": "前3秒强钩子，之后每15-20秒设置一次轻钩子"
}
```

### 6.5 台词 Agent

职责：

- 根据视频框架和钩子计划生成口播台词。
- 将钩子自然写进台词。
- 控制句长、停顿、口语化程度和字幕重点。

输出：

```json
{
  "segments": [
    {
      "segmentKey": "s1",
      "dialogue": "你以为你是在拖延，其实你是在害怕开始。",
      "tone": "冷静、有穿透力",
      "pauseAfter": 0.8,
      "emphasisWords": ["害怕开始"],
      "subtitleText": "你不是拖延，是害怕开始",
      "colloquialScore": 0.91
    }
  ],
  "globalNotes": {
    "averageSentenceLength": 14,
    "hookIntegrationQuality": "natural"
  }
}
```

### 6.6 情绪 Agent

职责：

- 设计情绪曲线。
- 明确每段主情绪、副情绪、强度、方向和观众反应。

输出：

```json
{
  "emotionalArc": "刺痛-共鸣-释然-行动",
  "segments": [
    {
      "segmentKey": "s1",
      "primaryEmotion": "刺痛",
      "secondaryEmotion": "好奇",
      "intensity": 8,
      "direction": "up",
      "viewerReaction": "停下来继续看",
      "valence": "negative",
      "arousal": "high"
    }
  ]
}
```

### 6.7 画面 Agent

职责：

- 将抽象台词转成画面表达。
- 为每段生成镜头说明、图片提示词、视频提示词、字幕布局和转场建议。

输出：

```json
{
  "segments": [
    {
      "segmentKey": "s1",
      "visualDescription": "一个年轻人坐在电脑前，空白文档闪烁，房间光线偏暗",
      "shotType": "close-up",
      "cameraMovement": "slow push-in",
      "imagePrompt": "young professional sitting in front of a blank document on laptop, dim room, cinematic lighting, close-up, vertical 9:16",
      "videoPrompt": "slow push-in shot of blinking cursor on blank document, quiet tense atmosphere, vertical 9:16",
      "subtitleLayout": "bottom-center, keyword highlighted",
      "transitionTo": "hard_cut"
    }
  ],
  "visualStyle": "写实电影感+关键词字幕"
}
```

### 6.8 BGM Agent

职责：

- 根据情绪支线推荐音乐情绪、BPM 范围、乐器倾向和音效点位。
- 不推荐具体版权曲目，只输出搜索关键词和情绪标签。

输出：

```json
{
  "segments": [
    {
      "segmentKey": "s1",
      "bgmMood": "低频悬疑",
      "bpmRange": "70-85",
      "instrumentPreference": ["ambient pad", "soft pulse"],
      "volumeCurve": "fade_in_to_70_percent",
      "soundEffect": {
        "type": "whoosh",
        "timing": "0.3s",
        "purpose": "配合认知冲击"
      },
      "searchKeywords": ["ambient tension", "soft pulse background"]
    }
  ],
  "copyrightNote": "只提供情绪标签和搜索关键词，不推荐具体版权曲目"
}
```

### 6.9 导演位 Agent

职责：

- 整合视频框架、钩子、台词、情绪、画面和 BGM。
- 检查时长、节奏、钩子自然度、情绪变化和画面可执行性。
- 输出最终台本。

输出：

```json
{
  "title": "你不是拖延，你是在逃避一个太模糊的目标",
  "durationSeconds": 60,
  "segments": [
    {
      "orderIndex": 1,
      "startTime": 0,
      "endTime": 5,
      "segmentGoal": "制造认知冲突",
      "dialogue": "你以为你是在拖延，其实你是在害怕开始。",
      "subtitleText": "你不是拖延，是害怕开始",
      "directorNote": "0.5秒内出现关键词字幕，声音压低，停顿0.8秒",
      "tracks": {
        "hook": {
          "type": "反常识钩子",
          "integrated": true
        },
        "emotion": {
          "primary": "刺痛",
          "secondary": "好奇",
          "intensity": 8
        },
        "bgm": {
          "mood": "低频悬疑",
          "keywords": ["ambient tension"]
        },
        "visual": {
          "description": "空白文档和停滞的手",
          "imagePrompt": "young professional sitting in front of a blank document on laptop, dim room, cinematic lighting, vertical 9:16"
        },
        "edit": {
          "transitionIn": "cut",
          "transitionOut": "hard_cut",
          "subtitleStyle": "bottom-center-bold-keyword"
        }
      }
    }
  ],
  "qualityChecklist": {
    "openingHook": "pass",
    "hookDialogueIntegration": "pass",
    "emotionVariety": "pass",
    "visualExecutable": "pass",
    "bgmEmotionMatch": "pass"
  }
}
```

## 7. Agent 执行依赖

```mermaid
flowchart TD
    Topic[主题提炼] --> Reference[参考内容分析]
    Reference --> Outline[视频框架]
    Outline --> Hook[钩子计划]
    Hook --> Dialogue[台词生成]
    Outline --> Emotion[情绪支线]
    Dialogue --> Visual[画面支线]
    Emotion --> BGM[BGM支线]
    Dialogue --> Director[导演位整合]
    Visual --> Director
    Emotion --> Director
    BGM --> Director
```

关键原则：

- 钩子先于台词，避免后期硬插。
- BGM 依赖情绪支线。
- 画面依赖台词和框架。
- 导演位只做整合和修正，不承担所有创作。

## 8. 数据库设计

### 8.1 ER 图

```mermaid
erDiagram
    users ||--o{ projects : owns
    projects ||--o{ source_materials : has
    projects ||--o{ topics : has
    topics ||--o{ references : uses
    references ||--o{ knowledge_items : extracts
    projects ||--o{ workflow_runs : has
    workflow_runs ||--o{ workflow_steps : has
    workflow_steps ||--o{ agent_runs : triggers
    agent_runs ||--o{ agent_outputs : produces
    projects ||--o{ script_versions : has
    script_versions ||--o{ script_segments : contains
    script_segments ||--o{ segment_tracks : has
    projects ||--o{ project_events : emits
    projects ||--o{ media_assets : reserves
```

### 8.2 核心表

#### users

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | 用户 ID |
| name | varchar(100) | 用户名 |
| email | varchar(255) unique | 邮箱 |
| password_hash | varchar(255) | 密码哈希 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

#### projects

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | 项目 ID |
| user_id | uuid FK | 用户 ID |
| title | varchar(200) | 项目标题 |
| status | varchar(30) | draft / material_input / topics_generated / topic_selected / references_ready / script_generating / script_draft / exported / archived |
| target_platform | varchar(30) | douyin / xiaohongshu / bilibili / video_account |
| video_type | varchar(30) | oral / story / knowledge / opinion / mixed |
| duration_seconds | int | 目标时长，15-300 |
| current_step | varchar(30) | 当前步骤 |
| metadata | jsonb | 扩展信息 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

约束：

```sql
CHECK (duration_seconds BETWEEN 15 AND 300)
```

#### source_materials

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | 素材 ID |
| project_id | uuid FK | 项目 ID |
| type | varchar(30) | chat_log / reflection / note / draft |
| content_encrypted | text | 加密后的内容 |
| content_preview | text | 脱敏预览 |
| metadata | jsonb | 来源、标签等 |
| created_at | timestamptz | 创建时间 |

Agent 上下文读取规则：

- `content_encrypted` 只在 `buildAgentContext` 内部解密。
- `agent_runs.input_snapshot` 只能保存脱敏摘要和素材 ID，不保存原始明文。
- `content_preview` 用于列表展示和调试定位，不作为 Agent 生成的唯一输入。

#### topics

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | 选题 ID |
| project_id | uuid FK | 项目 ID |
| title | varchar(300) | 选题标题 |
| theme_summary | text | 主题摘要 |
| target_audience | text | 目标受众 |
| core_conflict | text | 核心冲突 |
| emotional_tone | varchar(50) | 情绪基调 |
| score | numeric(3,2) | 推荐分 |
| selected | boolean | 是否选中 |
| agent_run_id | uuid FK | 生成来源 |
| created_at | timestamptz | 创建时间 |

约束：

```sql
CHECK (score BETWEEN 0 AND 1)
```

建议唯一约束：

```sql
CREATE UNIQUE INDEX uniq_selected_topic_per_project
ON topics(project_id)
WHERE selected = true;
```

#### references

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | 参考 ID |
| topic_id | uuid FK | 选题 ID |
| source_type | varchar(20) | manual / web_search / platform_api |
| platform | varchar(30) | 平台 |
| title | varchar(500) | 标题 |
| url | text | 链接 |
| author | varchar(200) | 作者 |
| transcript | text | 字幕或文案 |
| metrics | jsonb | 可获得指标 |
| raw_data | jsonb | 原始数据 |
| created_at | timestamptz | 创建时间 |

#### knowledge_items

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | 知识项 ID |
| reference_id | uuid FK | 来源参考 |
| topic_id | uuid FK | 选题 ID |
| item_type | varchar(30) | hook / structure / emotion / visual / comment_insight / bgm |
| content | text | 提炼内容 |
| tags | text[] | 标签 |
| confidence | numeric(3,2) | 置信度 |
| created_at | timestamptz | 创建时间 |

#### workflow_runs

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | 工作流 ID |
| project_id | uuid FK | 项目 ID |
| workflow_type | varchar(30) | topic_generation / reference_collection / script_generation / segment_rewrite |
| status | varchar(20) | pending / running / success / failed / cancelled |
| input | jsonb | 工作流输入 |
| result | jsonb | 工作流关键输出，如 scriptVersionId |
| project_status_before | varchar(30) | 工作流启动前的项目状态 |
| current_step_before | varchar(30) | 工作流启动前的项目步骤 |
| error_message | text | 错误信息 |
| started_at | timestamptz | 开始时间 |
| finished_at | timestamptz | 结束时间 |
| created_at | timestamptz | 创建时间 |

#### workflow_steps

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | 步骤 ID |
| workflow_run_id | uuid FK | 工作流 ID |
| step_key | varchar(50) | topic / reference / outline / hook / dialogue / emotion / visual / bgm / director / segment_rewrite |
| status | varchar(20) | pending / running / success / failed / skipped |
| depends_on | text[] | 前置步骤 |
| retry_count | int | 重试次数 |
| error_message | text | 步骤失败原因 |
| started_at | timestamptz | 开始时间 |
| finished_at | timestamptz | 结束时间 |

#### agent_runs

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | Agent 运行 ID |
| project_id | uuid FK | 项目 ID |
| workflow_run_id | uuid FK | 工作流 ID |
| workflow_step_id | uuid FK | 步骤 ID |
| agent_type | varchar(30) | topic / reference / outline / hook / dialogue / emotion / visual / bgm / director / segment_rewrite |
| status | varchar(20) | pending / running / success / failed / cancelled |
| model | varchar(80) | 模型 ID |
| input_snapshot | jsonb | 脱敏输入 |
| output_summary | text | 输出摘要 |
| error_message | text | 错误信息 |
| retry_count | int | 重试次数 |
| attempt_no | int | 当前步骤第几次尝试 |
| token_usage | jsonb | token 消耗 |
| duration_ms | int | 耗时 |
| created_at | timestamptz | 创建时间 |
| started_at | timestamptz | 开始时间 |
| finished_at | timestamptz | 结束时间 |

#### agent_outputs

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | 输出 ID |
| agent_run_id | uuid FK | Agent 运行 ID |
| output_type | varchar(40) | topic_list / reference_analysis / outline / hook_plan / dialogue_track / emotion_track / visual_track / bgm_track / final_script / segment_rewrite |
| content | jsonb | 结构化输出 |
| schema_version | varchar(20) | Schema 版本 |
| created_at | timestamptz | 创建时间 |

#### script_versions

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | 台本版本 ID |
| project_id | uuid FK | 项目 ID |
| workflow_run_id | uuid FK | 来源工作流 |
| version_no | int | 版本号 |
| title | varchar(300) | 台本标题 |
| summary | text | 台本摘要 |
| total_duration_seconds | numeric(6,1) | 总时长 |
| status | varchar(20) | draft / approved / exported |
| created_by_agent_run_id | uuid FK | 导演位 Agent |
| created_at | timestamptz | 创建时间 |

版本管理说明：

- MVP 阶段只保证 `version_no` 递增和当前版本可导出。
- `parent_version_id`、`change_reason`、`created_by` 等完整版本追踪字段后续再补，不阻塞核心闭环。

#### script_segments

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | 段落 ID |
| script_version_id | uuid FK | 台本版本 |
| segment_key | varchar(50) | 段落键 |
| order_index | int | 顺序 |
| start_time | numeric(6,1) | 开始秒数 |
| end_time | numeric(6,1) | 结束秒数 |
| segment_goal | text | 段落目标 |
| dialogue | text | 台词 |
| subtitle_text | text | 字幕 |
| director_note | text | 导演备注 |
| is_locked | boolean | 是否锁定 |
| created_at | timestamptz | 创建时间 |

#### segment_tracks

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | 支线 ID |
| segment_id | uuid FK | 段落 ID |
| track_type | varchar(20) | hook / emotion / visual / bgm / edit |
| content | jsonb | 支线内容 |
| agent_run_id | uuid FK | 来源 Agent |
| created_at | timestamptz | 创建时间 |

#### project_events

| 字段 | 类型 | 说明 |
|---|---|---|
| id | bigserial PK | 事件序号 |
| project_id | uuid FK | 项目 ID |
| workflow_run_id | uuid FK | 工作流 ID |
| event_type | varchar(50) | 事件类型 |
| payload | jsonb | 事件内容 |
| created_at | timestamptz | 创建时间 |

说明：

- SSE 使用 `project_events.id` 作为 `Last-Event-ID`。
- 断线重连时查询 `id > last_event_id` 的事件补发。

#### media_assets

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | 素材 ID |
| project_id | uuid FK | 项目 ID |
| segment_id | uuid FK | 关联段落 |
| asset_type | varchar(20) | image / video / audio / bgm / sfx |
| generation_prompt | text | 生成提示词 |
| storage_url | text | 文件地址，MVP 可为空 |
| metadata | jsonb | 尺寸、时长、版权等 |
| status | varchar(20) | planned / generated / selected / rejected |
| created_at | timestamptz | 创建时间 |

## 9. 索引策略

```sql
CREATE INDEX idx_projects_user_status ON projects(user_id, status);
CREATE INDEX idx_projects_updated ON projects(updated_at DESC);

CREATE INDEX idx_source_materials_project ON source_materials(project_id);
CREATE INDEX idx_topics_project ON topics(project_id);

CREATE INDEX idx_references_topic ON references(topic_id);
CREATE INDEX idx_knowledge_items_topic_type ON knowledge_items(topic_id, item_type);

CREATE INDEX idx_workflow_runs_project ON workflow_runs(project_id, workflow_type, status);
CREATE INDEX idx_workflow_steps_workflow ON workflow_steps(workflow_run_id, status);

CREATE INDEX idx_agent_runs_workflow ON agent_runs(workflow_run_id, agent_type);
CREATE INDEX idx_agent_runs_status ON agent_runs(status);
CREATE UNIQUE INDEX uniq_active_agent_run_per_step
ON agent_runs(workflow_step_id)
WHERE status IN ('pending', 'running');

CREATE INDEX idx_script_versions_project ON script_versions(project_id, version_no DESC);
CREATE INDEX idx_script_segments_version ON script_segments(script_version_id, order_index);

CREATE INDEX idx_project_events_project_id ON project_events(project_id, id);
```

## 10. 项目状态机

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> material_input
    material_input --> topics_generated
    topics_generated --> topic_selected
    topic_selected --> references_ready
    references_ready --> script_generating
    script_generating --> script_draft
    script_draft --> exported
    exported --> script_draft
    script_draft --> archived
    exported --> archived
```

状态更新规则：

| 触发动作 | 项目状态 | current_step |
|---|---|---|
| 创建项目 | `draft` | `input` |
| 首次保存原始素材 | `material_input` | `topics` |
| 选题生成工作流成功 | `topics_generated` | `topic_selection` |
| 用户选择选题 | `topic_selected` | `references` |
| 参考内容分析完成 | `references_ready` | `script` |
| 台本生成工作流开始 | `script_generating` | `script` |
| 导演位成功并写入台本版本 | `script_draft` | `script` |
| 导出成功 | `exported` | `exported` |

实现要求：

- `workflow_run` 成功或失败时，必须在同一事务或可靠后置任务中更新 `projects.status` 和 `projects.current_step`。
- 前端页面刷新后，以 `projects.status/current_step` 和当前 `workflow_run` 恢复工作台状态。
- 工作流启动时必须保存 `project_status_before` 和 `current_step_before`。
- 如果工作流失败，`projectStateService.applyWorkflowFailure` 使用上述两个字段恢复到进入工作流前的可编辑阶段，并展示失败步骤。

`projectStateService.applyWorkflowSuccess` 映射：

| workflow_type | 成功后的项目状态 | current_step |
|---|---|---|
| `topic_generation` | `topics_generated` | `topic_selection` |
| `reference_collection` | `references_ready` | `script` |
| `script_generation` | `script_draft` | `script` |
| `segment_rewrite` | 保持不变 | 保持不变 |

## 11. API 设计

### 11.1 通用规范

基础路径：

```text
/api/v1
```

错误格式：

```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "项目不存在或无权访问",
    "details": {},
    "requestId": "req_xxx"
  }
}
```

创建类接口支持 `Idempotency-Key` 请求头。

### 11.2 认证接口

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
GET  /api/v1/auth/me
```

认证方案：

- Access Token 存 HttpOnly Cookie。
- Refresh Token 存数据库哈希。
- Cookie 使用 `HttpOnly`、`Secure`、`SameSite=Lax`。
- 对 `POST/PATCH/DELETE` 增加 CSRF Token 或 Origin 校验。

### 11.3 项目接口

```text
POST   /api/v1/projects
GET    /api/v1/projects
GET    /api/v1/projects/:projectId
PATCH  /api/v1/projects/:projectId
DELETE /api/v1/projects/:projectId
```

创建项目请求：

```json
{
  "title": "关于拖延症的短视频",
  "targetPlatform": "douyin",
  "videoType": "oral",
  "durationSeconds": 60
}
```

### 11.4 素材接口

```text
POST /api/v1/projects/:projectId/source-materials
GET  /api/v1/projects/:projectId/source-materials
```

### 11.5 选题接口

```text
POST /api/v1/projects/:projectId/topics/generate
GET  /api/v1/projects/:projectId/topics
POST /api/v1/projects/:projectId/topics/:topicId/select
POST /api/v1/projects/:projectId/topics/regenerate
```

生成选题响应：

```json
{
  "workflowRunId": "uuid",
  "status": "running"
}
```

### 11.6 参考内容接口

```text
POST /api/v1/projects/:projectId/references/manual
POST /api/v1/projects/:projectId/references/search
GET  /api/v1/projects/:projectId/references
GET  /api/v1/projects/:projectId/knowledge-items?type=hook
```

手动录入参考：

```json
{
  "topicId": "uuid",
  "platform": "douyin",
  "title": "参考视频标题",
  "url": "https://example.com",
  "transcript": "用户粘贴的视频文案或字幕"
}
```

边界说明：

- `references/manual` 只保存用户提供的原始参考内容，不直接生成 `knowledge_items`。
- `references/search` 或 `reference_collection` 工作流负责分析参考内容，并生成 `knowledge_items`。
- 如果用户只手动录入参考，也需要启动 `reference_collection`，对已保存参考进行结构化分析。

### 11.7 台本接口

```text
POST  /api/v1/projects/:projectId/scripts/generate
GET   /api/v1/projects/:projectId/scripts
GET   /api/v1/projects/:projectId/scripts/:scriptVersionId
PATCH /api/v1/script-segments/:segmentId
POST  /api/v1/script-segments/:segmentId/rewrite
GET   /api/v1/scripts/:scriptVersionId/export?format=markdown
```

导出规则：

- 导出只读取 `script_versions`、`script_segments`、`segment_tracks`。
- 导出过程不调用 LLM，不重新生成内容。
- Markdown、JSON、CSV 三种格式必须来自同一份结构化台本数据。
- 导出成功后可将 `script_versions.status` 标记为 `exported`，并更新项目状态为 `exported`。

生成完整台本请求：

```json
{
  "topicId": "uuid",
  "durationSeconds": 60,
  "style": "sharp_emotional_oral"
}
```

单段重写请求：

```json
{
  "rewriteTargets": ["dialogue", "visual"],
  "feedback": "台词太书面，画面提示词不够具体"
}
```

### 11.8 工作流接口

```text
GET  /api/v1/projects/:projectId/workflows/current?type=script_generation
GET  /api/v1/workflow-runs/:workflowRunId
GET  /api/v1/workflow-runs/:workflowRunId/outputs
POST /api/v1/workflow-runs/:workflowRunId/cancel
POST /api/v1/workflow-steps/:workflowStepId/retry
```

用途：

- 前端刷新后恢复生成现场。
- 工作台展示每个步骤的状态、耗时、错误和 Agent 输出摘要。
- 用户取消长任务或重试失败步骤。
- `outputs` 接口返回当前工作流已生成的中间结果，便于调试和人工接管。

### 11.9 SSE 接口

```text
GET /api/v1/projects/:projectId/events
```

事件示例：

```text
id: 1024
event: agent_started
data: {"agentType":"dialogue","workflowRunId":"uuid","runId":"uuid"}

id: 1025
event: agent_completed
data: {"agentType":"dialogue","durationMs":8300}

id: 1026
event: workflow_completed
data: {"result":{"scriptVersionId":"uuid"}}

id: 1027
event: workflow_failed
data: {"failedStep":"director","error":"LLM timeout"}
```

断线补发：

- 前端重连时携带 `Last-Event-ID`。
- 后端查询 `project_events.id > Last-Event-ID` 并补发。
- 补发完成后继续等待新事件。

## 12. 工作流编排伪代码

### 12.1 创建工作流

```ts
async function startTopicGeneration(projectId: string, userId: string) {
  await assertProjectOwner(projectId, userId);

  const workflowRun = await workflowRepo.create({
    projectId,
    workflowType: "topic_generation",
    status: "pending",
    input: {},
  });

  await workflowRepo.createSteps(workflowRun.id, [
    { stepKey: "topic", dependsOn: [] },
  ]);

  await workflowDispatcher.start(workflowRun.id);
  return workflowRun;
}

async function startReferenceCollection(projectId: string, topicId: string, userId: string) {
  await assertProjectOwner(projectId, userId);

  const workflowRun = await workflowRepo.create({
    projectId,
    workflowType: "reference_collection",
    status: "pending",
    input: { topicId },
  });

  await workflowRepo.createSteps(workflowRun.id, [
    { stepKey: "reference", dependsOn: [] },
  ]);

  await workflowDispatcher.start(workflowRun.id);
  return workflowRun;
}

async function startScriptGeneration(projectId: string, topicId: string, userId: string) {
  await assertProjectOwner(projectId, userId);

  const workflowRun = await workflowRepo.create({
    projectId,
    workflowType: "script_generation",
    status: "pending",
    input: { topicId },
  });

  await workflowRepo.createSteps(workflowRun.id, [
    { stepKey: "outline", dependsOn: [] },
    { stepKey: "hook", dependsOn: ["outline"] },
    { stepKey: "dialogue", dependsOn: ["hook"] },
    { stepKey: "emotion", dependsOn: ["outline"] },
    { stepKey: "visual", dependsOn: ["dialogue"] },
    { stepKey: "bgm", dependsOn: ["emotion"] },
    { stepKey: "director", dependsOn: ["outline", "hook", "dialogue", "emotion", "visual", "bgm"] },
  ]);

  await projectStateService.applyWorkflowStarted(workflowRun);
  await workflowDispatcher.start(workflowRun.id);
  return workflowRun;
}
```

`workflowDispatcher` 是工作流启动入口：

```ts
interface WorkflowDispatcher {
  start(workflowRunId: string): Promise<void>;
  tick(workflowRunId: string): Promise<void>;
  runAgent(job: AgentJob): Promise<void>;
}
```

实现：

- 阶段零使用 `LocalWorkflowDispatcher`，在当前进程内同步调用 `tickWorkflow` 和 `runAgentJob`。
- 阶段一及以后使用 `BullMqWorkflowDispatcher`，将 `workflow.tick` 和 `agent.run` 放入 BullMQ。
- 业务代码只能依赖 `workflowDispatcher`，不能直接调用 `queue.add`。
- `workflowDispatcher.start` 负责将 `workflow_runs.status` 从 `pending` 更新为 `running`，并写入 `workflow_started` 事件。
- `startScriptGeneration` 在启动前调用 `projectStateService.applyWorkflowStarted`，将项目状态切到 `script_generating`。
- `workflowDispatcher.start` 必须保存 `project_status_before` 和 `current_step_before`，供失败回滚使用。
- `BullMqWorkflowDispatcher` 入队时必须设置稳定 `jobId`：`workflow.tick` 使用 `workflowRunId`，`agent.run` 使用 `workflowStepId`，避免重复入队。
- `LocalWorkflowDispatcher` 阶段零可以顺序执行步骤，不要求并发；它必须在每个步骤开始前检查 `workflow_runs.status` 是否已取消。

工作流输出落库：

- `topic_generation.topic` 成功后写入 `topics`。
- `reference_collection.reference` 成功后写入 `references` 和 `knowledge_items`。
- `script_generation.director` 成功后写入 `script_versions`、`script_segments`、`segment_tracks`。
- `segment_rewrite.segment_rewrite` 成功后更新指定 `script_segments` 和 `segment_tracks`，不创建新台本版本。
- `projects.status/current_step` 只由 `projectStateService` 更新，`applyAgentOutput` 不更新项目状态。

### 12.2 推进工作流

```ts
async function tickWorkflow(workflowRunId: string) {
  const workflow = await workflowRepo.findWithSteps(workflowRunId);

  if (workflow.status === "cancelled") return;

  const runnableSteps = workflow.steps.filter((step) => {
    return step.status === "pending" &&
      step.dependsOn.every((key) => workflow.stepsByKey[key].status === "success");
  });

  if (runnableSteps.length === 0) {
    if (workflow.steps.every((step) => step.status === "success")) {
      await workflowRepo.markSuccess(workflowRunId);
      await projectStateService.applyWorkflowSuccess(workflow);
      await eventRepo.emit(workflow.projectId, workflowRunId, "workflow_completed", {
        result: workflow.result,
      });
      return;
    }

    const failedStep = workflow.steps.find((step) => step.status === "failed");
    if (failedStep) {
      await workflowRepo.markFailed(workflowRunId, failedStep.errorMessage);
      await projectStateService.applyWorkflowFailure(workflow);
      await eventRepo.emit(workflow.projectId, workflowRunId, "workflow_failed", {
        failedStep: failedStep.stepKey,
        error: failedStep.errorMessage,
      });
    }
    return;
  }

  for (const step of runnableSteps) {
    // 原子 claim，避免多个 workflow.tick 并发时重复入队。
    const claimed = await workflowRepo.claimPendingStep(step.id);
    if (!claimed) continue;

    await workflowDispatcher.runAgent({
      workflowRunId,
      workflowStepId: step.id,
      agentType: step.stepKey,
    });
  }
}
```

`claimPendingStep` 必须在数据库事务中执行，语义等价于：

```sql
UPDATE workflow_steps
SET status = 'running', started_at = now()
WHERE id = $1 AND status = 'pending'
RETURNING *;
```

同一个 `workflow_step_id` 同一时间只允许存在一个 active `agent_run`。如果需要重试，递增 `workflow_steps.retry_count`，创建新的 `agent_run.attempt_no`，保留失败历史。

重试语义：

- `POST /workflow-steps/:workflowStepId/retry` 只允许重试 `failed` 状态的步骤。
- MVP 阶段只允许重试叶子失败步骤，或由用户重新启动整个工作流。
- 重试时将该步骤状态改回 `pending`，清空 `error_message`，递增 `retry_count`。
- 如果后续已经存在依赖该步骤的成功输出，MVP 不做局部回滚，直接拒绝并提示重新生成整个工作流。

取消语义：

- `POST /workflow-runs/:workflowRunId/cancel` 将 `workflow_runs.status` 标记为 `cancelled`。
- 尚未开始的 `workflow_steps` 标记为 `skipped`。
- 正在运行的 `workflow_steps` 和 `agent_runs` 标记为 `cancelled`，底层 LLM 请求采用尽力中断；如果无法中断，返回后丢弃输出。
- `BullMqWorkflowDispatcher` 需要尽力移除尚未执行的 BullMQ job。
- `LocalWorkflowDispatcher` 在每个 step 前检查取消状态，发现取消后立即停止后续步骤。
- 取消后写入 `workflow_cancelled` 事件，项目状态恢复到 `project_status_before/current_step_before`。

导演位说明：

- `director` 显式依赖 `outline` 和 `hook`，避免只看到台词、情绪、画面和 BGM 后丢失主线设计意图。
- `buildAgentContext("director")` 需要加载项目、选题、参考知识、视频框架、钩子计划以及所有成功支线输出。

### 12.3 Agent 执行

```ts
async function runAgentJob(job: AgentJob) {
  const context = await buildAgentContext(job.workflowRunId, job.agentType);
  const agentRun = await agentRunRepo.createFromJob(job, context.model);

  await eventRepo.emit(context.projectId, job.workflowRunId, "agent_started", {
    agentType: job.agentType,
    runId: agentRun.id,
  });

  try {
    const prompt = buildPrompt(job.agentType, context);
    const schema = getSchema(job.agentType);

    const result = await llmClient.generateStructured({
      model: context.model,
      prompt,
      schema,
      temperature: context.temperature,
      maxTokens: context.maxTokens,
      thinking: context.thinking,
      reasoningEffort: context.reasoningEffort,
      responseFormat: "json_object",
    });

    const applied = await db.transaction(async (tx) => {
      await agentOutputRepo.create({
        tx,
        agentRunId: agentRun.id,
        outputType: getOutputType(job.agentType),
        content: result.data,
        schemaVersion: "1.0",
      });

      const appliedResult = await applyAgentOutput({
        tx,
        agentType: job.agentType,
        output: result.data,
        context,
      });

      await agentRunRepo.markSuccess(agentRun.id, result.usage, result.durationMs, tx);
      await workflowRepo.markStepSuccess(job.workflowStepId, tx);
      await workflowRepo.mergeResult(job.workflowRunId, appliedResult, tx);

      return appliedResult;
    });

    await eventRepo.emit(context.projectId, job.workflowRunId, "agent_completed", {
      agentType: job.agentType,
      runId: agentRun.id,
      durationMs: result.durationMs,
      result: applied,
    });

    await workflowDispatcher.tick(job.workflowRunId);
  } catch (error) {
    await agentRunRepo.markFailed(agentRun.id, summarizeError(error));
    await workflowRepo.markStepFailed(job.workflowStepId, summarizeError(error));
    await eventRepo.emit(context.projectId, job.workflowRunId, "agent_failed", {
      agentType: job.agentType,
      runId: agentRun.id,
      error: summarizeError(error),
    });
    await workflowDispatcher.tick(job.workflowRunId);
  }
}
```

`applyAgentOutput` 负责将 Agent 输出写入核心业务表：

```ts
async function applyAgentOutput(params: ApplyAgentOutputParams) {
  const { tx, agentType, output, context } = params;

  switch (agentType) {
    case "topic": {
      const topics = await topicRepo.createManyFromAgentOutput(tx, context.projectId, output);
      return { topicIds: topics.map((topic) => topic.id) };
    }
    case "reference": {
      const saved = await referenceRepo.saveReferencesAndKnowledge(tx, context.topicId, output);
      return {
        referenceIds: saved.references.map((reference) => reference.id),
        knowledgeItemIds: saved.knowledgeItems.map((item) => item.id),
      };
    }
    case "director": {
      const scriptVersion = await scriptRepo.createVersionFromFinalScript(tx, context.projectId, output);
      return { scriptVersionId: scriptVersion.id };
    }
    case "segment_rewrite": {
      await scriptRepo.applySegmentRewrite(tx, context.segmentId, output);
      return { segmentId: context.segmentId };
    }
    default:
      // outline / hook / dialogue / emotion / visual / bgm 只保存 agent_outputs，
      // 由 director 或 rewrite 流程读取后再进入最终业务表。
      return {};
  }
}
```

要求：

- `agent_outputs`、业务表写入、`agent_runs` 成功状态、`workflow_steps` 成功状态必须在同一事务内完成。
- 如果业务落库失败，该步骤视为失败，不允许只保存 `agent_outputs` 后继续推进。
- `applyAgentOutput` 必须返回可合并到 `workflow_runs.result` 的关键业务 ID。
- `director` 输出写入台本版本后，必须返回 `scriptVersionId` 供 `workflow_completed` 事件使用。

### 12.4 单段重写流程

MVP 阶段单段重写采用“原地更新当前段落”的方式，不创建新的 `script_version`。

规则：

- 如果 `script_segments.is_locked = true`，拒绝自动重写。
- 重写只允许修改用户指定的 `rewriteTargets`，例如 `dialogue`、`visual`、`bgm`。
- 重写必须创建 `workflow_run(type = segment_rewrite)`、`workflow_step`、`agent_run` 和 `agent_output`。
- 重写成功后，在事务中更新 `script_segments` 和对应 `segment_tracks`。
- 重写完成后写入 `project_events`，前端局部刷新该段。

伪代码：

```ts
async function rewriteSegment(segmentId: string, input: RewriteInput, userId: string) {
  const segment = await scriptRepo.findSegmentForUser(segmentId, userId);
  if (segment.isLocked) {
    throw new AppError("SEGMENT_LOCKED", 409);
  }

  const workflowRun = await workflowRepo.create({
    projectId: segment.projectId,
    workflowType: "segment_rewrite",
    status: "pending",
    input: {
      segmentId,
      rewriteTargets: input.rewriteTargets,
      feedback: input.feedback,
    },
  });

  await workflowRepo.createSteps(workflowRun.id, [
    { stepKey: "segment_rewrite", dependsOn: [] },
  ]);

  await workflowDispatcher.start(workflowRun.id);
  return workflowRun;
}
```

## 13. 搜索适配器

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
  platform?: string;
  title: string;
  url?: string;
  author?: string;
  snippet?: string;
  transcript?: string;
  metrics?: {
    plays?: number | null;
    likes?: number | null;
    comments?: number | null;
    shares?: number | null;
  };
  rawData: Record<string, unknown>;
}
```

MVP 搜索源：

| 来源 | 状态 | 说明 |
|---|---|---|
| 手动录入 | 必做 | 用户粘贴链接、文案、字幕、截图摘要 |
| 通用 Web 搜索 | 必做 | 只作为参考线索，不保证平台指标完整 |
| 平台 API | 后续 | 等权限和合规确定 |
| 自建爬虫 | 后续 | 需要合规审查 |

## 14. LLM Client

```ts
interface LLMClient {
  generateText(input: GenerateTextInput): Promise<GenerateTextOutput>;
  generateStructured<T>(input: GenerateStructuredInput): Promise<GenerateStructuredOutput<T>>;
}

interface GenerateStructuredInput {
  model: string;
  prompt: string;
  schema: JsonSchema;
  responseFormat: "json_object";
  thinking: "enabled" | "disabled";
  reasoningEffort?: "high" | "max";
  temperature: number;
  maxTokens: number;
  timeoutMs?: number;
}

interface GenerateStructuredOutput<T> {
  data: T;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationMs: number;
  finishReason?: "stop" | "length" | "content_filter" | "tool_calls";
}
```

结构化输出要求：

- 请求侧使用 `responseFormat: "json_object"`。
- Prompt 必须明确要求返回 JSON，并给出目标结构示例。
- 模型输出后必须经过 Zod 或 JSON Schema 校验。
- 校验失败时进入一次 repair retry，将校验错误和原始输出作为修复上下文。
- 如果 `finishReason === "length"`，视为输出被截断，必须重试或降低输出规模。
- `generateStructured` 的职责不是相信模型完全遵守 Schema，而是完成“生成、解析、校验、修复、失败归类”的闭环。

Agent 默认参数：

| Agent | 模型 | thinking | reasoningEffort | temperature | maxTokens |
|---|---|---|---|---:|---:|
| topic | deepseek-v4-flash | disabled |  | 0.4 | 4096 |
| reference | deepseek-v4-flash | disabled |  | 0.2 | 8192 |
| outline | deepseek-v4-flash | disabled |  | 0.5 | 4096 |
| hook | deepseek-v4-flash | disabled |  | 0.8 | 4096 |
| dialogue | deepseek-v4-flash | disabled |  | 0.7 | 8192 |
| emotion | deepseek-v4-flash | disabled |  | 0.4 | 4096 |
| visual | deepseek-v4-flash | disabled |  | 0.7 | 8192 |
| bgm | deepseek-v4-flash | disabled |  | 0.4 | 4096 |
| director | deepseek-v4-pro | enabled | high | 0.3 | 16384 |
| segment_rewrite | deepseek-v4-flash | disabled |  | 0.6 | 4096 |

### 14.1 Agent Prompt 与 Schema Registry

每个 Agent 必须有固定文件结构，避免 Prompt、Schema 和测试样例散落在业务代码中。

推荐目录：

```text
src/ai/agents/
  topic/
    prompt.ts
    schema.ts
    fixtures/success.json
  reference/
    prompt.ts
    schema.ts
    fixtures/success.json
  outline/
    prompt.ts
    schema.ts
    fixtures/success.json
  hook/
    prompt.ts
    schema.ts
    fixtures/success.json
  dialogue/
    prompt.ts
    schema.ts
    fixtures/success.json
  emotion/
    prompt.ts
    schema.ts
    fixtures/success.json
  visual/
    prompt.ts
    schema.ts
    fixtures/success.json
  bgm/
    prompt.ts
    schema.ts
    fixtures/success.json
  director/
    prompt.ts
    schema.ts
    fixtures/success.json
  segment-rewrite/
    prompt.ts
    schema.ts
    fixtures/success.json
```

约定：

- `prompt.ts` 导出 `buildPrompt(context)`。
- `schema.ts` 导出 Zod Schema，并可转换为 JSON Schema。
- `fixtures/success.json` 用于单元测试，确保 Agent 输出解析逻辑稳定。
- 新增 Agent 必须同时补齐 Prompt、Schema、Preset 和至少一个 fixture。

## 15. 前端页面设计

### 15.1 页面

- `/login`：登录页。
- `/projects`：项目列表。
- `/projects/new`：创建项目。
- `/projects/:id/input`：素材输入。
- `/projects/:id/topics`：选题确认。
- `/projects/:id/references`：参考内容收集和分析。
- `/projects/:id/workbench`：生成进度和 Agent 输出。
- `/projects/:id/script`：台本编辑器。
- `/projects/:id/export`：导出。

### 15.2 工作台布局

工作台分为三列：

- 左侧：项目步骤、Agent 状态、生成进度。
- 中间：当前步骤主要内容，如选题、参考、台本时间轴。
- 右侧：参考知识、单段详情、重写控制、导出设置。

### 15.3 台本编辑器

编辑器按时间轴显示，每段包含：

- 时间范围。
- 台词。
- 字幕。
- 钩子。
- 情绪。
- BGM。
- 画面提示词。
- 导演备注。
- 锁定开关。
- 单段重写按钮。

## 16. 安全设计

- 密码使用 bcrypt。
- Access Token 存 HttpOnly Cookie。
- Refresh Token 只存哈希。
- 原始聊天记录加密存储。
- MVP 暂不引入密钥版本管理，先通过单一 `ENCRYPTION_KEY` 跑通核心闭环。
- 日志中不得输出原始素材全文。
- 导出前提示用户确认敏感信息。
- 所有项目查询必须带 `user_id` 授权过滤。
- 写操作增加 CSRF 或 Origin 校验。

## 17. 错误处理与降级

| 场景 | 策略 |
|---|---|
| LLM 超时 | 自动重试，仍失败则标记步骤失败 |
| JSON Schema 不匹配 | 追加格式修正 Prompt 重试一次 |
| 搜索失败 | 降级为手动录入和已有参考 |
| 参考指标缺失 | 保存 null，不阻塞流程 |
| Worker 崩溃 | BullMQ 重试，workflow_steps 保留状态 |
| SSE 断线 | 使用 project_events 补发 |
| 导演位失败 | 保留各支线输出，允许用户重试导演位 |

## 18. 可观测性

日志字段：

```ts
logger.info("agent_run_completed", {
  projectId,
  workflowRunId,
  agentRunId,
  agentType,
  model,
  durationMs,
  tokenUsage,
  status: "success",
});
```

核心指标：

- `agent_run_duration_ms`
- `agent_run_total`
- `workflow_run_total`
- `llm_token_usage_total`
- `llm_request_errors_total`
- `queue_waiting_jobs`
- `api_request_duration_ms`
- `sse_connected_clients`

## 19. 测试策略

单元测试：

- Prompt 构建。
- JSON Schema 校验。
- 状态机流转。
- Agent 输出解析。
- 权限过滤。

集成测试：

- 创建项目到生成选题。
- 手动录入参考并提炼知识项。
- 完整台本生成工作流。
- SSE 事件补发。
- 单段重写。
- 导出 Markdown / JSON / CSV。

E2E 测试：

- 用户登录。
- 创建项目。
- 输入素材。
- 生成选题。
- 选择选题。
- 录入参考。
- 生成台本。
- 编辑并导出。

## 20. 环境变量

```bash
NODE_ENV=development
APP_URL=http://localhost:3000
LOG_LEVEL=debug

DATABASE_URL=postgresql://user:pass@localhost:5432/scriptcraft
SHADOW_DATABASE_URL=postgresql://user:pass@localhost:5432/scriptcraft_shadow
REDIS_URL=redis://localhost:6379/0

DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_FAST_MODEL=deepseek-v4-flash
DEEPSEEK_REASONING_MODEL=deepseek-v4-pro
LLM_REQUEST_TIMEOUT_MS=120000

BING_SEARCH_API_KEY=
SERPAPI_API_KEY=
SEARCH_TIMEOUT_MS=60000

JWT_SECRET=xxx
CSRF_SECRET=xxx
ENCRYPTION_KEY=xxx
BCRYPT_COST=12

S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=scriptcraft-media

FEATURE_ENABLE_WEB_SEARCH=true
FEATURE_ENABLE_IMAGE_GEN=false
FEATURE_ENABLE_VIDEO_GEN=false
FEATURE_ENABLE_EXPORT=true
```

## 21. 部署方案

MVP 推荐拆成三个进程：

- `web`：Next.js Web + API。
- `worker`：BullMQ Worker。
- `scheduler`：可选，用于清理过期事件、失败任务巡检。

依赖：

- PostgreSQL。
- Redis。
- S3 兼容对象存储，MVP 可先不用。

部署结构：

```text
Nginx / Platform Router
        |
        v
Next.js Web/API  ---- PostgreSQL
        |
        v
      Redis  ---- BullMQ Worker ---- DeepSeek API / Search API
```

## 22. 开发里程碑

### 阶段零：核心竖切验证

目标是在最短时间内验证“素材到台本”的核心价值，不先追求完整账户体系和复杂队列体验。

- 单用户本地模式。
- 允许使用 `localWorkflowRunner` 同步执行工作流，暂不依赖 Redis/BullMQ。
- 输入一段素材。
- 调用主题提炼 Agent 生成候选选题。
- 选择一个选题。
- 使用手动参考或空参考生成视频框架。
- 跑通钩子、台词、情绪、画面、BGM、导演位。
- 保存 `script_versions`、`script_segments`、`segment_tracks`。
- 导出 Markdown。

验收标准：

- 一条 60 秒口播视频台本可以完整生成。
- 最终台本包含台词、钩子、情绪、画面提示词、BGM 建议和导演备注。
- 失败时能看到失败 Agent 和错误信息。
- 生成结果可再次打开查看。

### 阶段一：基础设施

- Next.js 项目初始化。
- Prisma + PostgreSQL。
- Redis + BullMQ。
- 用户认证。
- 项目 CRUD。
- 素材输入。

### 阶段二：选题与参考

- 主题提炼 Agent。
- 候选选题 UI。
- 手动参考录入。
- 通用搜索适配器。
- 参考内容分析。
- knowledge_items 展示。

### 阶段三：台本生成

- workflow_runs / workflow_steps。
- Agent 编排。
- 视频框架 Agent。
- 钩子计划 Agent。
- 台词 Agent。
- 情绪 Agent。
- 画面 Agent。
- BGM Agent。
- 导演位 Agent。
- SSE 进度。

### 阶段四：编辑与导出

- 台本时间轴编辑器。
- 段落锁定。
- 单段重写。
- 版本管理。
- Markdown / JSON / CSV 导出。
- 基础日志和 Token 成本追踪。

## 23. 最终输出格式

最终台本以 `script_versions + script_segments + segment_tracks` 存储，导出时可组合为以下结构：

```json
{
  "title": "你不是拖延，你是在逃避一个太模糊的目标",
  "durationSeconds": 60,
  "segments": [
    {
      "orderIndex": 1,
      "startTime": 0,
      "endTime": 5,
      "dialogue": "你以为你是在拖延，其实你是在害怕开始。",
      "subtitleText": "你不是拖延，是害怕开始",
      "directorNote": "开头停顿0.8秒，关键词字幕加粗",
      "hook": {
        "type": "反常识钩子",
        "intent": "制造认知冲突"
      },
      "emotion": {
        "primary": "刺痛",
        "intensity": 8
      },
      "bgm": {
        "mood": "低频悬疑",
        "keywords": ["ambient tension"]
      },
      "visual": {
        "description": "空白文档和停滞的手",
        "imagePrompt": "young professional sitting in front of a blank document on laptop, dim room, cinematic lighting, vertical 9:16"
      },
      "edit": {
        "transitionIn": "cut",
        "transitionOut": "hard_cut",
        "subtitleStyle": "bottom-center-bold-keyword"
      }
    }
  ]
}
```

## 24. 结论

V3 版本的系统设计以可落地为第一原则。它保留多智能体导演系统的核心价值，同时收紧 MVP 边界：第一阶段只负责从素材到完整台本，不承担自动剪辑、自动发布和平台数据抓取。

系统最重要的工程闭环是：

```text
素材输入 -> 选题提炼 -> 参考内容分析 -> 视频框架 -> 钩子计划 -> 台词 -> 情绪 -> 画面/BGM -> 导演整合 -> 台本编辑与导出
```

只要这个闭环稳定，后续的 AI 生图、生视频、Remotion/FFmpeg 自动剪辑、发布平台对接，都可以自然扩展到已有数据结构之上。
