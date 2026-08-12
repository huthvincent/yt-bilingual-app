#!/bin/bash

# 从 .env 文件加载 API Key（不会上传到 GitHub）
SCRIPT_DIR_ENV="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR_ENV/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR_ENV/.env" | xargs)
fi
# 运行环境路径初始化 (解决双击启动找不到 lsof 或 npm 的问题)
export PATH="/usr/local/bin:/usr/sbin:/sbin:/opt/homebrew/bin:$PATH"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

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
uvicorn main:app --host 0.0.0.0 --port 8000 > /dev/null 2>&1 &
BACKEND_PID=$!

# 启动前端 (Frontend)
echo "[2/3] 启动前端服务..."
cd "$SCRIPT_DIR/frontend"
npm run dev > /dev/null 2>&1 &
FRONTEND_PID=$!

# 公网穿透隧道 (Localtunnel)：默认关闭。
# 开启会把后端暴露到公网——请先在 .env 设置 API_AUTH_KEY，再设 ENABLE_TUNNEL=1。
TUNNEL_PID=""
if [ "$ENABLE_TUNNEL" = "1" ]; then
    if [ -z "$API_AUTH_KEY" ]; then
        echo "⚠️  ENABLE_TUNNEL=1 但未设置 API_AUTH_KEY——公网隧道将无鉴权暴露你的 DeepSeek 配额，已跳过。"
    else
        echo "[3/3] 启动公网穿透隧道..."
        npx localtunnel --port 8000 --subdomain "${TUNNEL_SUBDOMAIN:-yt-bilingual-app-rui}" > /dev/null 2>&1 &
        TUNNEL_PID=$!
    fi
else
    echo "[3/3] 公网隧道未开启（如需手机远程访问：在 .env 设置 API_AUTH_KEY 与 ENABLE_TUNNEL=1）"
fi

sleep 3
open http://localhost:5173

echo ""
echo "✅ 启动成功！"
echo "👉 请在你的浏览器中打开这个固定的网址："
echo "   http://localhost:5173"
echo ""
echo "💡 (提示：如果你想关闭应用，只需按 Ctrl+C )"

# 监听退出信号以便同时退出前后端和隧道
trap "kill $BACKEND_PID $FRONTEND_PID $TUNNEL_PID 2>/dev/null" EXIT
wait
