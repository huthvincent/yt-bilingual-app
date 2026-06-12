# 功能规格

参考 [spec-kit](https://github.com/github/spec-kit)：每个核心功能有一份**规格**（spec.md，讲"做什么、为什么"），复杂的还有**技术方案**（plan.md，讲"怎么做"）。这些是逆向补写的——描述目前已实现的系统，也作为后续迭代的基准。

## 怎么用

- **看懂一个功能**：读对应的 `spec.md`，不需要懂代码。
- **改一个功能**：先更新 spec，再改代码，保持两者一致。
- **加新功能**：用 [模板](../.specify/templates/) 新建 `00X-功能slug/`，按 [开发指南](../docs/开发指南.md) 的工作流走。

目录命名用 `编号-英文slug`（对 git/工具友好），内容全中文。

## 规格清单

| 编号 | 功能 | 一句话 | 状态 |
|---|---|---|---|
| [001](./001-streaming-pipeline/spec.md) | 字幕流式管线 | 英文秒出、翻译边看边补、断点续译 | 已实现 |
| [002](./002-dictionary/spec.md) | 点查词典 | 点任意单词查释义、音标、发音、入生词本 | 已实现 |
| [003](./003-listening-drills/spec.md) | 精听训练 | 听写模式、单句循环、倍速、键盘操作 | 已实现 |
| [004](./004-vocab-level/spec.md) | 生词水平轴 | 按词汇量高亮，Liftoff→Supernova 六级轴 | 已实现 |
| [005](./005-favorites-export/spec.md) | 收藏与导出 | 收藏句子/生词，导出 Anki / CSV | 已实现 |
| [006](./006-local-shows/spec.md) | 本地剧集 | 导入 SRT，双语看自己的剧 | 已实现 |
| [007](./007-subscriptions-resume/spec.md) | 订阅与续播 | 关注频道、记忆进度、自动续播 | 已实现 |
| [008](./008-asr-fallback/spec.md) | 无字幕转写回退 | 没字幕时本地 Whisper 转写 | 已实现（可选依赖） |
