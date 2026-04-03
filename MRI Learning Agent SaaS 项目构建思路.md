# MRI Learning Agent SaaS 项目构建思路

## 一、产品定位

| 项目 | 内容 |
|------|------|
| **产品名称** | MRI Learning Agent（建议） |
| **核心价值** | 让医学影像学习者高效掌握 MRI 原理 |
| **目标用户** | 放射科医生、医学物理师、MRI 技师、医学生、研究生 |
| **差异化** | 不是"问答工具"，而是"学习伙伴"——主动引导、跟踪进度、个性化建议 |

---

## 二、核心功能模块

```
┌─────────────────────────────────────────────────────────┐
│                    MRI Learning Agent                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐ │
│  │  学习规划器   │   │  知识导航器   │   │  进度追踪器   │ │
│  │ Planner Agent│   │ Navigator    │   │ Tracker      │ │
│  └──────────────┘   └──────────────┘   └──────────────┘ │
│          │                  │                  │        │
│          └──────────────────┼──────────────────┘        │
│                             ▼                            │
│                  ┌──────────────────┐                   │
│                  │   知识库引擎      │                   │
│                  │   Knowledge Base │                   │
│                  │   (PDF + RAG)    │                   │
│                  └──────────────────┘                   │
│                             │                            │
│          ┌──────────────────┼──────────────────┐        │
│          ▼                  ▼                  ▼        │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐ │
│  │  章节智能体   │   │  练习评估器   │   │  可视化助手   │ │
│  │ Chapter Agent│   │ Quiz Agent   │   │ Visualizer   │ │
│  └──────────────┘   └──────────────┘   └──────────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 三、Agent Harness 设计（基于 Anthropic 教程）

### 3.1 多 Agent 架构

采用 **Orchestrator-Worker + Router** 模式：

| Agent 角色 | 职责 |
|------------|------|
| **Orchestrator** | 中央协调器，理解用户意图，调度其他 Agent |
| **Planner Agent** | 根据用户背景和时间，制定个性化学习计划 |
| **Chapter Agent** | 针对特定章节提供深度讲解和建议 |
| **Quiz Agent** | 生成练习题、评估用户理解程度 |
| **Progress Tracker** | 跟踪学习进度，更新 feature list |
| **Visualizer** | 生成 MRI 原理可视化解释（图像、动画） |

### 3.2 状态管理（借鉴 Anthropic 长运行 Agent 设计）

```
用户学习状态
├── learning_plan.json        # 个性化学习计划
├── chapter_progress.json     # 各章节进度 (passes: false/true)
├── quiz_results.json         # 练习结果记录
├── notes.json                # 用户笔记汇总
└── weak_points.json          # 知识薄弱点记录
```

### 3.3 增量推进原则

**借鉴 Anthropic 的 "feature list" 思路**：

```json
{
  "chapter": "Chapter 3: Pulse Sequences",
  "topics": [
    {
      "topic": "Spin Echo",
      "description": "理解自旋回波的基本原理",
      "steps": [
        "阅读核心概念",
        "完成交互式演示",
        "回答3道练习题",
        "能够解释 TE/TR 的含义"
      ],
      "passes": false,
      "attempts": 2,
      "last_attempt": "2026-04-02T20:00:00Z"
    }
  ]
}
```

---

## 四、技术架构

### 4.1 知识库引擎（核心）

**挑战**：PDF 内容需要转化为 Agent 可理解、可检索的知识库。

**方案**：

| 层级 | 技术 | 作用 |
|------|------|------|
| **PDF 解析** | PyMuPDF / pdfplumber | 提取文本、图片、表格 |
| **结构化处理** | LLM 辅助分块 | 按章节、概念、公式切分 |
| **向量检索** | RAG (Pinecone/Milvus) | 语义搜索相关内容 |
| **知识图谱** | Neo4j / 内存图谱 | 概念关联关系 |

**关键设计**：

```
PDF → 章节切分 → 概念提取 → 向量化 → 知识图谱
                    ↓
              概念卡片库
              (每个概念一张卡片：定义、公式、图示、练习题)
```

### 4.2 Agent Harness 实现

**借鉴 Claude Agent SDK 模式**：

```typescript
// 学习规划 Agent
interface LearningPlanAgent {
  task: "create_learning_plan";
  inputs: {
    user_background: string;      // 用户背景（医生/学生/技师）
    time_available: number;       // 每周可用学习时间
    goal: string;                 // 学习目标
    current_knowledge: string[];  // 已掌握知识点
  };
  outputs: {
    plan: LearningPlan;           // 分章节、分周的学习计划
    milestones: Milestone[];      // 关里程碑
  };
}

// 章节 Agent
interface ChapterAgent {
  task: "teach_chapter";
  inputs: {
    chapter_id: string;
    user_progress: ChapterProgress;
    weak_points: string[];
  };
  outputs: {
    explanation: string;          // 个性化讲解
    visual_aids: Image[];         // 可视化辅助
    practice_questions: Quiz[];   // 针对性练习
    next_steps: string[];         // 下一步建议
  };
}
```

### 4.3 交互设计

**核心交互模式**：

| 场景 | Agent 行为 |
|------|-----------|
| **首次进入** | Planner Agent 了解背景，制定学习计划 |
| **开始章节** | Chapter Agent 提供导读、核心概念预览 |
| **学习过程中** | Navigator 按概念卡片引导，随时可提问 |
| **完成章节** | Quiz Agent 评估，标记 passes=true/false |
| **遇到困难** | 检测 weak_points，调整学习路径 |

---

## 五、关键技术实现

### 5.1 PDF 知识库构建流程

```python
# 步骤 1: PDF 解析
import fitz  # PyMuPDF

def parse_mri_pdf(pdf_path):
    chapters = []
    for page_num, page in enumerate(fitz.open(pdf_path)):
        text = page.get_text()
        images = page.get_images()
        # 检测章节标题（基于格式、关键词）
        if is_chapter_header(text):
            chapters.append({
                "title": extract_chapter_title(text),
                "content": text,
                "images": images,
                "page_range": (start_page, page_num)
            })
    return chapters

# 步骤 2: 概念卡片生成（LLM 辅助）
def generate_concept_cards(chapter_content):
    prompt = """
    从以下 MRI 教材章节中提取核心概念，每个概念生成一张学习卡片：
    - 概念名称
    - 简明定义（1-2句）
    - 关键公式（如有）
    - 学习要点（3-5个）
    - 常见误解
    - 推荐练习题类型
    """
    # 使用 LLM 生成结构化卡片
    return llm.generate_cards(chapter_content, prompt)

# 步骤 3: 向量化存储
def embed_and_store(cards):
    for card in cards:
        embedding = embedding_model.encode(card.content)
        vector_db.store({
            "id": card.id,
            "embedding": embedding,
            "metadata": card.metadata
        })
```

### 5.2 学习进度追踪（借鉴 Anthropic Progress File）

```json
// learning_progress.json
{
  "user_id": "user_123",
  "book": "MRI from Picture to Proton",
  "started_at": "2026-04-01",
  "current_chapter": "Chapter 5",
  "chapters": [
    {
      "id": "ch1",
      "title": "Introduction to MRI",
      "status": "completed",
      "completed_at": "2026-04-02",
      "quiz_score": 85,
      "time_spent_hours": 3.5
    },
    {
      "id": "ch2",
      "title": "Basic Physics",
      "status": "in_progress",
      "topics": [
        { "topic": "Magnetic moments", "passes": true },
        { "topic": "Larmor frequency", "passes": false, "attempts": 2 }
      ]
    }
  ],
  "weak_points": ["Larmor frequency calculation", "RF pulse timing"],
  "next_session_plan": "继续 Chapter 2，重点攻克 Larmor frequency"
}
```

---

## 六、商业模式

### 6.1 收费模式

| 模式 | 价格 | 目标用户 |
|------|------|---------|
| **免费试用** | 7天免费 | 让用户体验核心功能 |
| **个人订阅** | ¥99/月 或 ¥699/年 | 医学生、研究生 |
| **机构订阅** | ¥2999/年/席位 | 医院放射科、医学院 |
| **一次性买断** | ¥1999 | 完整课程包（终身访问） |

### 6.2 价值点定价

| 版本 | 功能 |
|------|------|
| **基础版** | PDF 知识库 + 问答交互 |
| **专业版** | 学习计划 + 进度追踪 + 练习评估 |
| **机构版** | 多用户管理 + 学习分析报告 + 定制内容 |

---

## 七、实施路径

### Phase 1: MVP（4-6周）

| 任务 | 时间 | 产出 |
|------|------|------|
| PDF 解析与结构化 | 2周 | 章节切分 + 概念卡片库 |
| RAG 知识检索 | 1周 | 语义搜索 API |
| 单 Agent 问答原型 | 1周 | 基础问答功能 |
| 前端界面 | 2周 | Web 界面 + 移动端适配 |

### Phase 2: 多 Agent Harness（6-8周）

| 任务 | 时间 | 产出 |
|------|------|------|
| Planner Agent | 2周 | 学习计划生成 |
| Progress Tracker | 2周 | 进度追踪系统 |
| Chapter Agent | 2周 | 章节深度讲解 |
| Quiz Agent | 2周 | 练习生成与评估 |

### Phase 3: 商业化（4周）

| 任务 | 时间 | 产出 |
|------|------|------|
| 用户系统 | 1周 | 注册、登录、订阅 |
| 支付集成 | 1周 | 微信支付、支付宝 |
| 数据分析 | 2周 | 学习报告、管理员后台 |

---

## 八、关键成功因素

### 8.1 知识库质量（核心）

- PDF 解析要**准确**：公式、图片、表格不能丢失
- 概念卡片要**精炼**：每个概念都能在 5 分钟内理解
- 关联关系要**清晰**：概念之间的依赖关系图谱

### 8.2 Agent 体验

- **不只是问答**：主动引导、预判困难、调整路径
- **个性化程度**：根据用户背景调整讲解深度
- **可视化辅助**：MRI 原理需要图像理解，Agent 应能生成或推荐图示

### 8.3 用户留存

- 进度可视化：学习曲线、里程碑、成就系统
- 社交元素：学习小组、排行榜（可选）
- 持续价值：更新内容、新增练习、专家答疑

---

## 九、技术栈建议

| 层级 | 推荐技术 |
|------|---------|
| **前端** | React + TypeScript, Tailwind CSS |
| **后端** | Node.js / Python FastAPI |
| **Agent Framework** | Claude Agent SDK / LangGraph |
| **向量数据库** | Pinecone / Milvus / Weaviate |
| **LLM** | Claude (主) + GPT-4 (备) |
| **PDF 处理** | PyMuPDF + LLM 辅助结构化 |
| **知识图谱** | Neo4j / 内存图谱 |
| **部署** | Docker + Kubernetes (弹性伸缩) |

---

## 十、总结

**核心定位**：这个项目的核心不是"AI问答"，而是"AI学习伙伴"——需要借鉴 Anthropic 的 Harness Engineering 设计，构建一个能主动规划、跟踪进度、调整路径的多 Agent 系统，让 PDF 教材变成一个"会教书"的智能导师。

**关键借鉴点**：
- Feature List 模式 → 知识点进度追踪
- Progress File → 学习状态持久化
- Incremental Progress → 增量学习推进
- Multi-Agent Architecture → 专业 Agent 分工协作

---

## 参考资源

- Anthropic Harness Engineering 教程合集
- Claude Agent SDK 文档: https://platform.claude.com/docs/en/agent-sdk/overview
- LangGraph 多 Agent 框架: https://langchain-ai.github.io/langgraph/