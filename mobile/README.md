# mobile/ — Expo React Native 客户端

iOS/Android 伴侣应用。**状态：可用但滞后**——对接的是经典版 `POST /api/process-video`（非流式），Web 端的新能力（流式管线、点查词典、句子精背等）尚未跟进，见根 README 路线图"Mobile parity"。

- 启动：`npm install && npx expo start`（后端需在可达地址运行，见 `src/config/api.ts`）
- 结构：`App.tsx` 入口；`src/components/` 与 Web 端同名组件的 RN 版本；`src/config/api.ts` 后端地址
- 给它做功能前先读 Web 端对应的 [规格](../specs/README.md)，保持行为一致
