#!/bin/zsh
# Compile each diagram with tectonic and render a PNG preview with Quick Look.
set -e
cd "$(dirname "$0")"
for f in "$@"; do
  tectonic "$f.tex" 2>&1 | grep -E "^(error|!)|Error" || true
  [ -f "$f.pdf" ] || { echo "FAILED: $f"; continue; }
  rm -f "$f.pdf.png"
  qlmanage -t -s 1800 -o . "$f.pdf" >/dev/null 2>&1 && mv "$f.pdf.png" "$f.png"
  echo "ok: $f"
done
