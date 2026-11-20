#!/bin/bash
# ============================================================
# Belwee Pet Clinic — Backup Script
# Tạo file backup nén toàn bộ mã nguồn dự án
# ============================================================
# Usage: bash backup.sh [tên_file_custom]
# Ví dụ: bash backup.sh belwee-v2-custom
#
# Để backup CẢ public folder (có video nặng ~106MB):
#   bash backup.sh --full
# ============================================================

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CUSTOM_NAME="${1:-}"
INCLUDE_PUBLIC=false

if [ "$1" = "--full" ]; then
  INCLUDE_PUBLIC=true
  FILENAME="backup_belwee_full_${TIMESTAMP}.tar.gz"
elif [ -n "$CUSTOM_NAME" ]; then
  FILENAME="${CUSTOM_NAME}.tar.gz"
else
  FILENAME="backup_belwee_code_${TIMESTAMP}.tar.gz"
fi

echo "🐾 Belwee Pet Clinic — Backup Tool"
echo "==================================="
echo "📦 Tên file: $FILENAME"
echo "📂 Bao gồm public: $([ \"$INCLUDE_PUBLIC\" = true ] && echo 'Có (full)' || echo 'Không (code only)')"
echo ""

if [ "$INCLUDE_PUBLIC" = true ]; then
  tar -czf "$FILENAME" \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.zcode' \
    --exclude='*.log' \
    --exclude='.env.local' \
    --exclude='.env' \
    --exclude='tsconfig.tsbuildinfo' \
    --exclude='tmp-*' \
    --exclude='package-lock.json' \
    --exclude='backup_*' \
    .
else
  tar -czf "$FILENAME" \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.zcode' \
    --exclude='public' \
    --exclude='*.log' \
    --exclude='.env.local' \
    --exclude='.env' \
    --exclude='tsconfig.tsbuildinfo' \
    --exclude='tmp-*' \
    --exclude='package-lock.json' \
    --exclude='backup_*' \
    .
fi

echo ""
echo "✅ Backup hoàn tất: $FILENAME"
echo "📁 Kích thước: $(du -h "$FILENAME" | cut -f1)"
echo ""
echo "💡 Để khôi phục:"
echo "   tar -xzf $FILENAME"
echo "   npm install"
echo ""
echo "💡 Để backup đầy đủ (kể cả video):"
echo "   bash backup.sh --full"
