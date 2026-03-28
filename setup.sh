#!/bin/bash
# ============================================
# 🚀 YT Bilingual App - 一键安装脚本
# ============================================
# 使用方法: chmod +x setup.sh && ./setup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "====================================="
echo "🔧 YT Bilingual App 安装程序"
echo "====================================="

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "❌ 未找到 Python3，请先安装 Python 3.10+"
    exit 1
fi
echo "✅ Python3: $(python3 --version)"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 Node.js，请先安装 Node.js 18+"
    exit 1
fi
echo "✅ Node.js: $(node --version)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ 未找到 npm"
    exit 1
fi
echo "✅ npm: $(npm --version)"

echo ""
echo "[1/3] 🐍 设置 Python 后端..."
cd "$SCRIPT_DIR/backend"
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "  ✅ 创建虚拟环境"
else
    echo "  ✅ 虚拟环境已存在"
fi
source venv/bin/activate
pip install -q -r requirements.txt
echo "  ✅ Python 依赖安装完成"

echo ""
echo "[2/3] 📦 设置前端..."
cd "$SCRIPT_DIR/frontend"
npm install --silent
echo "  ✅ 前端依赖安装完成"

echo ""
echo "[3/3] 🔑 检查配置..."
cd "$SCRIPT_DIR"
if [ ! -f ".env" ]; then
    echo "GEMINI_API_KEY=\"your_gemini_api_key_here\"" > .env
    echo "  ⚠️  已创建 .env 文件，请编辑并填入你的 Gemini API Key："
    echo "     $SCRIPT_DIR/.env"
else
    echo "  ✅ .env 文件已存在"
fi

# 确保 start_app.command 有执行权限
chmod +x start_app.command

echo ""
echo "====================================="
echo "✅ 安装完成！"
echo "====================================="
echo ""
echo "📝 下一步："
echo "  1. 编辑 .env 文件，填入你的 GEMINI_API_KEY"
echo "  2. 双击 start_app.command 启动应用"
echo "  3. 或运行: ./start_app.command"
echo ""
echo "  浏览器访问: http://localhost:5173"
echo ""
