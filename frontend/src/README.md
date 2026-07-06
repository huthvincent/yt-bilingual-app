# frontend/src/ — 前端源码

React 19 + TypeScript + Tailwind + Framer Motion。类型检查 `npx tsc -b` 是提交门禁。

## 结构

| 位置 | 职责 |
|---|---|
| `main.tsx` | 入口：挂载 `<App />`，引入 `index.css` |
| `App.tsx` | **顶层编排**（唯一的大状态组件）：视频/字幕/收藏/订阅状态、SSE 流接收、播放控制与快捷键、单句循环、三种视图（首页/学习/句子精背）切换、进度记忆 |
| `index.css` | 全局样式：字体、聚焦环、滚动条、玻璃材质（`.glass-panel/.glass-card`）、极光背景、流光/光边动效、ruby 注音 |
| `components/` | UI 组件，见 [components/README](./components/README.md) |
| `lib/` | 纯逻辑（无 UI、可单测），见 [lib/README](./lib/README.md) |

## 改 UI 前必读

[设计语言](../../docs/设计语言.md) —— 按钮/卡片/弹窗/分段控件都有现成类名配方，直接复制，不要发明新样式。
