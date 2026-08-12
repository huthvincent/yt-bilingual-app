# AI 开发者入口（AGENTS.md）

> 你是来二次开发这个项目的 AI agent？**只读 md 文件就能上手。** 按下面的顺序读，别先扎进代码。

## 这是什么项目

**Lingua Nova**：帮中文用户通过 YouTube 视频学英语的本地应用。三种学习模式：看视频（AI 双语字幕流式生成）、本地剧集（SRT）、句子精背。React 19 + FastAPI + DeepSeek V4。

## 读文档的顺序

1. **[CONSTITUTION.md](CONSTITUTION.md)** —— 项目宪法，7 条产品/工程原则。所有决策的最高依据，改代码前必读。
2. **[docs/架构.md](docs/架构.md)** —— 系统怎么运转：数据流、目录结构、前后端模块分工。
3. **[specs/README.md](specs/README.md)** —— 9 个功能各一份规格（做什么/为什么）。改哪个功能就读哪份，改完同步更新它。
4. **[docs/开发指南.md](docs/开发指南.md)** —— 怎么跑起来、怎么验证、规格驱动工作流。
5. 改 UI 才读 **[docs/设计语言.md](docs/设计语言.md)** —— 排版/颜色/材质/动效的配方，直接复制类名用。

每个代码文件夹里都有 `README.md` 描述该目录的文件与职责——进目录先读它。

## 硬性规则（违反即错误）

- **先规格后代码**：较大的新功能先在 `specs/` 写 spec（用 [.specify/templates/](.specify/templates/)），再实现；实现后把规格状态改为"已实现"并回填代码路径。
- **提交门禁**：前端 `cd frontend && npx tsc -b` 必须通过；后端 `cd backend && venv/bin/python -m py_compile *.py` 必须通过；UI 改动必须在浏览器实测过。
- **花钱/耗时的结果必须落盘缓存**（宪法原则 4）；失败要能自愈，不是报错了事。
- **不要提交**：`history/`（个人数据）、`subtitles/`（版权内容）、`.env`（密钥）——已在 .gitignore，别绕过。
- **UI 复用既有配方**（设计语言.md），不发明新样式；动效尊重 `prefers-reduced-motion`。
- **中文文档**：除根 README 外所有文档用简洁中文；提交信息用英文。
- **勤提交**：每完成一个子任务就 commit + push。

## 常用命令

```bash
./setup.sh                                   # 首次安装依赖
./start_app.command                          # 一键启动（macOS）
cd backend && source venv/bin/activate && uvicorn main:app --port 8000   # 后端
cd frontend && npm run dev                   # 前端 http://localhost:5173
cd frontend && npx tsc -b                    # 类型检查（提交门禁）
cd scripts && APP_URL=http://localhost:5173 node capture.mjs all         # 重录 README 动图
```

## 目录速查

| 目录 | 是什么 | 有 README |
|---|---|---|
| `backend/` | FastAPI 后端，7 个模块 | ✓ |
| `frontend/src/components/` | React UI 组件 | ✓ |
| `frontend/src/lib/` | 纯逻辑（无 UI） | ✓ |
| `content/sentences/` | 句子精背静态数据 | ✓ |
| `specs/` | 功能规格（9 份） | ✓ 索引 |
| `docs/` | 架构/设计/开发文档 | ✓ 导航 |
| `scripts/` | 媒体录制、字幕下载工具 | ✓ |
| `mobile/` | Expo 移动端（对接经典 API，未跟进流式） | ✓ |
| `.specify/` | 规格/方案/任务模板 | ✓ |
| `history/`、`subtitles/` | 运行时数据（不入库） | — |
