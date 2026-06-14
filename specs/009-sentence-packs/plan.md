# 技术方案：句子精背

**对应规格：** [spec.md](./spec.md)

---

## 总体思路
最大化复用现有能力：句子的"分段+注释"数据结构和字幕高亮**同构**，所以渲染、点查词典、TTS、收藏、设计语言全部复用，只新增"内容来源 + 一个视图"。

## 数据
- 源：一套精选 500 句（原 `Sentences/500-sentences.html` 内联的 `DATA`）。按句号切成 5 级 × 100 句（每级 10 天）。
- 落地：`content/sentences/level-{1..5}.json` + `index.json`（索引）。
- 单句结构：`{ d(天 1–10), n(级内序号 1–100), cat: think|work|daily, zh, seg }`。
  - `seg` 是有序数组：普通字符串 或 语块 `{ t: 英文, g: 中文注释, c: adv|col|idi|phr }`。

## 接口（仿 `/api/shows`）
- `GET /api/sentences/levels` → 索引：`[{ id, title, subtitle, count, days }]`
- `GET /api/sentences/level/{id}` → 该级 100 句

## 前端
| 文件 | 职责 |
|---|---|
| `lib/sentences.ts` | 类型、拉取、四色映射、按级×天的进度（localStorage，独立 key） |
| `components/SentenceView.tsx` | 背诵视图：级导航、按天卡片、搜索、译文显隐、勾选、进度 |
| `components/SentencePacks.tsx` | 首页 bento 入口卡（5 级 + 进度） |
| `components/TranscriptBlock.tsx` | 导出 `ClickableWords`，供 seg 渲染复用"逐词可点" |
| `App.tsx` | 新增 `sentenceLevel` 状态，作为第三模式渲染分支 |

- **seg 渲染**：普通段落 → `ClickableWords`（逐词可点查词典）；语块 → 四色 + ruby 中文注释，块内词同样可点。颜色：高级词紫、固定搭配天蓝、习语琥珀、短语动词翠绿（含图例）。
- **复用**：单词点击 → `WordPopover`；朗读 → `lib/tts.ts`；收藏 → 现有 favorites（合成 `videoId = sentence-L{n}`，`type: sentence`）；译文显隐 → 复用 `TranslationMode` 思路（这里用"显示/隐藏译文"开关）。

## 取舍
- **为什么后端 served 而非 bundle 进前端**：与 shows/history 一致（"内容由后端读文件提供"），前端保持精简，未来可服务端扩展。
- **为什么复用 favorites 而不新建生词本**：打通两个学习模式，共享 Anki 导出，符合 [宪法原则 1](../../.specify/memory/constitution.md)（一个完整闭环）。
- **四色是否违反"单一强调色"**：四色是**内容语义**（四类语块），类比 AI 生词的紫色高亮，属受控例外，有图例说明。

## 风险与缓解
- 收藏的合成 id 不能和真实 videoId 冲突 → 用 `sentence-L{n}-{序号}` 前缀。
- 数据较大（500 句）→ 按级懒加载（每次只取 100 句）。
