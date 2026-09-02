#!/bin/bash
set -e

cd "$(dirname "$0")"

# 检查环境
node scripts/check-env.js
if [ $? -ne 0 ]; then
    echo "环境检测未通过，请按提示安装缺失项"
    exit 1
fi

echo ""
node scripts/start.js
