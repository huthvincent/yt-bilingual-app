# 英文学习双语应用使用指南 🎓

这个全栈应用可以帮助你通过 YouTube 视频学习英语。它会在左侧播放原视频，在右侧同步滚动显示双语字幕，并将重点词汇高亮展示。

## 🛠️ 环境准备与启动

该项目由两部分组成：Python FastAPI 后端和 React (Vite) 前端。

### 第一步：启动后端服务 (Backend)

后端负责解析 YouTube 视频链接，提取英文字幕并调用大语言模型（在这个版本中使用了Mock数据来节省Token）生成对应的中文翻译和重点词汇高亮。

1. 打开终端（Terminal），进入后端目录：
   ```bash
   cd /Users/rui/Desktop/yt-bilingual-app/backend
   ```
2. 激活 Python 虚拟环境：
   ```bash
   source venv/bin/activate
   ```
3. 启动 FastAPI 服务：
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   *看到 `Application startup complete.` 说明后端已成功运行在 `http://127.0.0.1:8000`。请保持这个终端不要关闭。*

### 第二步：启动前端应用 (Frontend)

前端提供了一个现代化的暗色系交互界面。

1. 新开一个终端窗口，进入前端目录：
   ```bash
   cd /Users/rui/Desktop/yt-bilingual-app/frontend
   ```
2. 启动 Vite 开发服务器：
   ```bash
   npm run dev
   ```
3. 在浏览器中打开本地链接：**`http://localhost:5173`**

## 💡 使用说明

1. **输入视频链接**：
   在打开的网页中，你会看到一个居中的搜索框。请输入有效的 YouTube 视频链接（例如：`https://www.youtube.com/watch?v=dQw4w9WgXcQ`），然后点击 **"Start Learning"**。

2. **视频与字幕同步互动**：
   * 左侧为 YouTube 播放器。右侧则是时间轴对齐的交互式字幕栏。
   * 点击播放视频，右侧的字幕会**自动根据视频的当前时间**跳转并高亮正在播放的那一句。
   * **点击跳转（Click-to-Seek）**：点击右侧任意一句对应的字幕块，左侧的视频会自动跳转到那句话对应的时间点。
   * **重点单词高亮**：每一段字幕中，英语原文里的高级词汇（如有）会用紫色虚线标注，并在下方的中文翻译中对应高亮，方便你对照学习。

## 🔧 常见问题与后续开发

* **为什么要用 Mock 数据？**
  目前的后端中，我为你写好了一个 `mock_llm_processing` 函数。在测试阶段，一次性把长视频字幕都发给大模型（如 Gemini）既耗时又消耗大量 Token。你可以先用这个 mock 确保前端UI的工作逻辑（例如滚动、精确匹配的高亮）是正确的。
* **接入真正的 Gemini API**：
  当你觉得前端 UI、字幕滚动和高亮功能都没问题后，你可以修改 `backend/main.py`。把里面的 `mock_llm_processing` 替换为真实的 Gemini API 调用。
  *建议*：不要一次把所有字幕丢给模型。先分块（Chunking），比如每 10-20 句发一次请求。
* **高亮字符串匹配**：
  前端目前采用了“精确子串匹配” (Exact Substring Matching) 来实现高亮。大语言模型有时会返回标点符号不一致的答案，我在前端已经极力兼容了这种情况。如果遇到部分词没高亮，可能是由于大小写或连字符的不同引起的。
