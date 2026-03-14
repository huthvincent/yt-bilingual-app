#!/bin/bash

# 从 .env 文件加载 API Key（不会上传到 GitHub）
SCRIPT_DIR_ENV="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR_ENV/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR_ENV/.env" | xargs)
fi

# 尝试清理旧的端口占用
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

echo "====================================="
echo "🚀 正在启动 英文学习双语应用..."
echo "====================================="

# 获取当前脚本所在绝对路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 启动后端 (Backend)
echo "[1/2] 启动后端服务..."
cd "$SCRIPT_DIR/backend"
source venv/bin/activate
uvicorn main:app --port 8000 > /dev/null 2>&1 &
BACKEND_PID=$!

# 启动前端 (Frontend)
echo "[2/2] 启动前端服务..."
cd "$SCRIPT_DIR/frontend"
npm run dev > /dev/null 2>&1 &
FRONTEND_PID=$!

sleep 3
open http://localhost:5173

echo ""
echo "✅ 启动成功！"
echo "👉 请在你的浏览器中打开这个固定的网址："
echo "   http://localhost:5173"
echo ""
echo "💡 (提示：如果你想关闭应用，只需按 Ctrl+C )"

# 监听退出信号以便同时退出前后端
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
