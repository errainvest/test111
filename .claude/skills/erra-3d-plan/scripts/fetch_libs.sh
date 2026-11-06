#!/bin/sh
# Download the JS libraries the page loads from the CDN, for offline headless tests (render_check.js, build_page.py --local-libs).
# The installed .skill already carries them; a repo checkout does not.
set -e
D="$(dirname "$0")/../engine/libs"; mkdir -p "$D"; cd "$D"
B=https://cdn.jsdelivr.net/npm
for f in three@0.147.0/build/three.min.js three@0.147.0/examples/js/controls/OrbitControls.js three@0.147.0/examples/js/environments/RoomEnvironment.js \
         three@0.147.0/examples/js/geometries/RoundedBoxGeometry.js three@0.147.0/examples/js/utils/BufferGeometryUtils.js polygon-clipping@0.15.3/dist/polygon-clipping.umd.min.js; do
  curl -sSfL "$B/$f" -o "$(basename "$f")"
done
ls -la
