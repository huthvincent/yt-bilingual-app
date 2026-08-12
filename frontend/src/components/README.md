# components/ — UI 组件

全部遵循 [设计语言](../../../docs/设计语言.md)。带 `motion.` 的动效统一用标准弹簧参数。

| 组件 | 用在哪 | 职责 |
|---|---|---|
| `InputScreen.tsx` | 首页 | 搜索框、词汇轴、句子精背整宽入口卡、四张 bento 卡（最近学习/本地剧集/订阅/最新视频） |
| `AuroraBackground.tsx` | 首页 | 极光背景：光斑漂移、旋转光环、粒子、流星、鼠标聚光 |
| `TiltCard.tsx` | 首页 | bento 卡的 3D 倾斜 + 光斑悬停（CSS 变量驱动，零重渲染） |
| `VocabAxis.tsx` | 首页 | 词汇水平轴（Liftoff→Supernova 六站，见 specs/004） |
| `SentencePacks.tsx` | 首页 | 句子精背入口卡（5 册 + 进度） |
| `VideoPlayer.tsx` | 学习页 | YouTube 播放器封装：seek/播放暂停命令、倍速、全屏 |
| `TranscriptView.tsx` | 学习页 | 字幕列表：**Apple Music 式跟随滚动**、memo 化（只在换句时重渲染）、用户滚动时暂停跟随 |
| `TranscriptBlock.tsx` | 学习页 | 单句：时间戳、译文显隐、收藏星标、听写模糊；**导出 `HighlightedText`/`ClickableWords`/`cn`** 供他处复用 |
| `WordPopover.tsx` | 全局 | 点查词典卡：音标/释义/例句/TTS/入生词本 |
| `SentenceView.tsx` | 句子精背 | 背诵视图：册切换、按天卡片、自测遮中文、复习打卡、搜索 |
| `SentenceText.tsx` | 句子精背 | seg 渲染：四色语块 + ruby 注音 + 逐词可点 |
| `FavoritesModal.tsx` | 全局 | 收藏夹：分组、迷你播放器、**Anki/CSV 导出** |
| `ModelSelectionModal.tsx` | 首页流程 | 处理前选 DeepSeek 模型 + 费用预估 |
| `ChannelVideoList.tsx` | 全局 | 某频道的本地历史视频列表 |
| `ShowBrowser.tsx` | 首页 | 本地剧集浏览：剧→季→集 |
| `Toaster.tsx` | 全局 | 轻提示（配合 `lib/toast.ts`） |
