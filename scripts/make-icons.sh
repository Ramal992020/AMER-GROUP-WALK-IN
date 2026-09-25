#!/usr/bin/env bash
#
# make-icons.sh — يولّد كل أيقونات التطبيق (PWA + iOS + Favicon) من صورة واحدة.
#
# الاستخدام:
#   ./scripts/make-icons.sh <مسار-الصورة> [لون-الخلفية]
#
# أمثلة:
#   ./scripts/make-icons.sh ~/logo.png              # الافتراضي: #E30613 (أحمر Amer)
#   ./scripts/make-icons.sh ~/logo.png "#FFFFFF"    # خلفية بيضاء
#
# اللي بيعمله السكربت:
#   1. يوحّد مقاس الصورة لمربع 1024×1024.
#   2. يشيل أي زوايا دائرية مطبوعة جوه الصورة (اللي بتخلي iOS وأندرويد
#      يطبّقوا شكلين زوايا فوق بعض) ويوحّد لون الخلفية على لون العلامة.
#   3. يصغّر المحتوى لحوالي 86% ويوسّطه => حشو أمان (~7%) حول اللوجو.
#   4. يصدّر: 1024 / 512 / 192 / 180 / 32 + أيقونة Maskable + favicon.ico
#
set -euo pipefail

SRC="${1:-}"
TARGET_BG="${2:-#E30613}"
PAD_PCT=7          # نسبة الحشو حول اللوجو في الأيقونة العادية
MASKABLE_SCALE=80  # نسبة حجم المحتوى لأيقونة أندرويد التكيفية

if [[ -z "$SRC" || ! -f "$SRC" ]]; then
  echo "الاستخدام: ./scripts/make-icons.sh <مسار-الصورة> [لون-الخلفية]" >&2
  exit 1
fi

command -v convert >/dev/null 2>&1 || {
  echo "خطأ: محتاج ImageMagick (الأمر convert) يكون مثبّت." >&2
  exit 1
}

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/public"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "▸ المصدر:      $SRC"
echo "▸ لون الخلفية: $TARGET_BG"
echo "▸ المخرجات:    $OUT"
echo

# ── 1) نسخة مربعة 1024×1024 ────────────────────────────────────────────
#    لو الصورة مش مربعة: بتتحط في المنتصف على لون الخلفية (من غير قص).
src_dims="$(identify -format '%wx%h' "$SRC")"
src_w="${src_dims%x*}"; src_h="${src_dims#*x}"
echo "▸ أبعاد المصدر: ${src_w}×${src_h}"

ar_diff=$(( (src_w > src_h ? src_w * 100 / src_h : src_h * 100 / src_w) - 100 ))
if (( ar_diff > 5 )); then
  echo "▸ الصورة مش مربعة — بتتحط في المنتصف على خلفية $TARGET_BG"
  convert "$SRC" -background "$TARGET_BG" -alpha remove -alpha off \
    -resize 1024x1024 -gravity center -extent 1024x1024 -strip "$TMP/step1.png"
else
  convert "$SRC" -background "$TARGET_BG" -alpha remove -alpha off \
    -resize 1024x1024^ -gravity center -extent 1024x1024 -strip "$TMP/step1.png"
fi

# ── 2) إزالة الزوايا المطبوعة ──────────────────────────────────────────
corner="$(convert "$TMP/step1.png" -format '%[pixel:p{10,10}]' info:)"
edge="$(convert "$TMP/step1.png" -format '%[pixel:p{512,30}]' info:)"

# كشف الخلفية البيضاء/الفاتحة (لو حصل، التوحيد اللوني هيبوّظ اللوجو الأبيض)
edge_r="$(convert "$TMP/step1.png" -format '%[fx:int(255*u.p{512,30}.r)]' info:)"
edge_g="$(convert "$TMP/step1.png" -format '%[fx:int(255*u.p{512,30}.g)]' info:)"
edge_b="$(convert "$TMP/step1.png" -format '%[fx:int(255*u.p{512,30}.b)]' info:)"

if (( edge_r > 200 && edge_g > 200 && edge_b > 200 )); then
  echo "⚠ خلفية الصورة فاتحة/بيضاء — مش هيتم تغيير لون الخلفية."
  echo "  (لو اللوجو نفسه أبيض، هيبان مخفي على خلفية بيضاء)"
  SKIP_RECOLOR=1
else
  SKIP_RECOLOR=0
fi

if [[ "$corner" != "$edge" ]]; then
  echo "▸ تم كشف زوايا دائرية مطبوعة — جاري إزالتها"
  convert "$TMP/step1.png" -fuzz 28% -fill "$edge" \
    -draw "color 0,0 floodfill color 1023,0 floodfill color 0,1023 floodfill color 1023,1023 floodfill" \
    "$TMP/step2.png"
else
  echo "▸ مفيش زوايا مطبوعة"
  cp "$TMP/step1.png" "$TMP/step2.png"
fi

# ── 3) توحيد لون الخلفية على لون العلامة ───────────────────────────────
#    الصور المصدَّرة فيها عادةً أكتر من درجة حمراء: إطار + خلفية + لمعة/
#    تدرّج. الفصل بالسطوع مش دقيق (اللمعة الفاتحة بتتلوّن غلط)، فبنفصل
#    بتشبّع اللون بدل كده:
#      • الخلفية الحمراء: R أكبر بكتير من G  => (R-G) عالي
#      • اللوجو الأبيض:   R ≈ G              => (R-G) ≈ 0
#    الناتج: خلفية موحّدة 100% على لون العلامة + لوجو أبيض بحواف ناعمة.
if (( SKIP_RECOLOR == 0 )); then
  echo "▸ فصل اللوجو عن الخلفية وتوحيد اللون على $TARGET_BG"
  convert "$TMP/step2.png" -fx "(r-g)" -level 8%,20% -blur 0x0.6 \
    -alpha off -depth 8 -strip "$TMP/mask.png"
  convert \( -size 1024x1024 xc:"$TARGET_BG" \) "$TMP/mask.png" \
    -alpha off -compose CopyOpacity -composite \
    -background white -alpha remove -alpha off -depth 8 -strip "$TMP/step3.png"
  CANVAS="$TARGET_BG"
else
  cp "$TMP/step2.png" "$TMP/step3.png"
  CANVAS="white"
fi

# ── 4) تصغير المحتوى وتوسيطه => حشو أمان حول اللوجو ────────────────────
#    بنصغّر الصورة كلها ونوسّطها على نفس لون الخلفية. من غير أي trim،
#    لأن القصّ بيتأثر بأي بكسل شاذ على الحدود.
inner=$(( 1024 * (100 - PAD_PCT * 2) / 100 ))
convert "$TMP/step3.png" -resize "${inner}x${inner}" \
  -background "$CANVAS" -gravity center -extent 1024x1024 \
  -alpha off -depth 8 -strip "$TMP/master.png"

# ── 5) تصدير المقاسات ─────────────────────────────────────────────────
emit() { # <الاسم> <المقاس> <ملف-المصدر>
  convert "$3" -resize "${2}x${2}" -alpha off -depth 8 \
    -strip -define png:compression-level=9 -define png:compression-filter=5 \
    "$OUT/$1"
  printf '  ✔ %-24s %sx%s  (%s)\n' "$1" "$2" "$2" "$(du -h "$OUT/$1" | cut -f1)"
}

echo
echo "▸ الأيقونات:"
emit icon-1024.png        1024 "$TMP/master.png"
emit icon-512.png          512 "$TMP/master.png"
emit icon-192.png          192 "$TMP/master.png"
emit apple-touch-icon.png  180 "$TMP/master.png"
emit favicon-32.png         32 "$TMP/master.png"

# أيقونة أندرويد التكيفية: حشو أكبر لأن النظام بيقصّ لحد دايرة 80%
mask_inner=$(( 1024 * MASKABLE_SCALE / 100 ))
convert "$TMP/step3.png" -resize "${mask_inner}x${mask_inner}" \
  -background "$CANVAS" -gravity center -extent 1024x1024 \
  -alpha off -depth 8 -resize 512x512 -strip -define png:compression-level=9 \
  "$OUT/maskable-icon-512.png"
printf '  ✔ %-24s %sx%s  (%s)\n' "maskable-icon-512.png" 512 512 "$(du -h "$OUT/maskable-icon-512.png" | cut -f1)"

# favicon متعدد المقاسات للمتصفحات
convert "$TMP/master.png" -depth 8 -define icon:auto-resize=48,32,16 -strip "$OUT/favicon.ico"
printf '  ✔ %-24s 16/32/48  (%s)\n' "favicon.ico" "$(du -h "$OUT/favicon.ico" | cut -f1)"

echo
echo "✅ تم توليد كل الأيقونات في $OUT"
