#!/usr/bin/env bash
# Transcode full-resolution engagement originals into web derivatives.
#
# Originals are Adobe RGB (1998) 300dpi print masters (~127MB total) and live
# in assets/images/ (gitignored; masters archived in Google Drive). They MUST
# be ICC-converted to sRGB or browsers render them visibly desaturated.
#
# This is a manually-run tool, NOT a build step.
# Usage:  bash tools/optimize-photos.sh
set -euo pipefail
cd "$(dirname "$0")/.."

SRC_DIR="assets/images"
OUT_DIR="images/gallery/engagement"
SRGB="/System/Library/ColorSync/Profiles/sRGB Profile.icc"

command -v magick >/dev/null || { echo "ERROR: ImageMagick not found (brew install imagemagick)"; exit 1; }
[ -f "$SRGB" ] || { echo "ERROR: sRGB ICC profile not found at $SRGB"; exit 1; }
[ -d "$SRC_DIR" ] || { echo "ERROR: $SRC_DIR not found — originals are gitignored; restore from Drive"; exit 1; }

mkdir -p "$OUT_DIR"

shopt -s nullglob
count=0
for src in "$SRC_DIR"/TheresaRyan_ENG_*.jpg; do
  # TheresaRyan_ENG_022.jpg -> 022
  num="${src##*_}"; num="${num%.jpg}"
  for w in 800 1600; do
    out="$OUT_DIR/eng-${num}-${w}"
    magick "$src" -intent perceptual -profile "$SRGB" -colorspace sRGB \
      -resize "${w}x${w}>" -strip -interlace Plane \
      -quality 80 -sampling-factor 4:2:0 "${out}.jpg"
    magick "$src" -intent perceptual -profile "$SRGB" -colorspace sRGB \
      -resize "${w}x${w}>" -strip \
      -quality 78 -define webp:method=6 "${out}.webp"
  done
  count=$((count+1))
  printf '  %s -> eng-%s-{800,1600}.{jpg,webp}\n' "$(basename "$src")" "$num"
done

echo
echo "Transcoded $count photo(s). Output in $OUT_DIR:"
du -sh "$OUT_DIR"
echo
echo "Largest derivative:"
find "$OUT_DIR" -type f -printf '%s %p\n' 2>/dev/null | sort -rn | head -1 \
  || find "$OUT_DIR" -type f -exec ls -l {} + | sort -k5 -rn | head -1
