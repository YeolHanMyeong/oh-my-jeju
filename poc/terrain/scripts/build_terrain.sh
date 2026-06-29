#!/usr/bin/env bash
# 제주 지형 타일 파이프라인: DEM(GeoTIFF) -> terrain-RGB PMTiles
#
# 사용법:
#   ./build_terrain.sh <입력 DEM.tif> <출력이름> [max_zoom]
#
# 예시 (Copernicus 30m PoC):
#   ./build_terrain.sh ../data/jeju_dem_raw.tif jeju-terrain 12
# 예시 (NGII 5m HD — 출력명은 jeju-terrain로 유지해 앱이 그대로 소비, 소스 maxzoom은
#       <JejuMapView terrainMaxZoom={14}>로 올린다):
#   ./build_terrain.sh ../data/ngii_dem_5m.tif jeju-terrain 14
set -euo pipefail

usage() { echo "usage: $0 <input DEM.tif> <output name> [max_zoom]" >&2; exit 1; }
[ "$#" -ge 2 ] || usage

SRC="$1"
NAME="$2"
MAX_Z="${3:-12}"
MIN_Z=6

[ -f "$SRC" ] || { echo "오류: 입력 DEM을 찾을 수 없습니다: $SRC" >&2; exit 1; }
for tool in gdalwarp uv pmtiles; do
  command -v "$tool" >/dev/null 2>&1 \
    || { echo "오류: '$tool'가 설치되어 있지 않습니다 (README의 '필요 도구' 참고)." >&2; exit 1; }
done

DIR="$(cd "$(dirname "$0")" && pwd)"
WORK="$DIR/../data/_work"
OUT="$DIR/../tiles"
mkdir -p "$WORK" "$OUT"

# 제주 본섬 + 우도 + 마라도 (경도/위도, EPSG:4326). 단일 출처: poc/terrain/jeju-bbox.json
# ⚠️ 이 범위는 packages/map-core/src/constants.ts의 JEJU_MAX_BOUNDS, demo/index.html의 maxBounds와
#    일치해야 한다 — 지도 이동 범위가 타일 커버리지를 넘으면 3D에서 DEM 타일이 누락된다.
BBOX_JSON="$DIR/../jeju-bbox.json"
if command -v node >/dev/null 2>&1 && [ -f "$BBOX_JSON" ]; then
  BBOX_W=$(node -p "require('$BBOX_JSON').w")
  BBOX_S=$(node -p "require('$BBOX_JSON').s")
  BBOX_E=$(node -p "require('$BBOX_JSON').e")
  BBOX_N=$(node -p "require('$BBOX_JSON').n")
else
  # fallback — jeju-bbox.json과 동일하게 유지할 것
  BBOX_W=126.05
  BBOX_S=33.05
  BBOX_E=127.00
  BBOX_N=33.65
fi

echo "==> 1/3 제주 영역 클리핑 + EPSG:3857 재투영"
gdalwarp -overwrite \
  -t_srs EPSG:3857 \
  -te "$BBOX_W" "$BBOX_S" "$BBOX_E" "$BBOX_N" -te_srs EPSG:4326 \
  -r bilinear \
  -co COMPRESS=DEFLATE -co TILED=YES \
  "$SRC" "$WORK/${NAME}_3857.tif"

echo "==> 2/3 terrain-RGB 인코딩 -> MBTiles (z${MIN_Z}-z${MAX_Z})"
rm -f "$WORK/${NAME}.mbtiles"
uv run "$DIR/dem_to_terrain_mbtiles.py" \
  "$WORK/${NAME}_3857.tif" "$WORK/${NAME}.mbtiles" "$MIN_Z" "$MAX_Z"

echo "==> 3/3 PMTiles 변환"
pmtiles convert "$WORK/${NAME}.mbtiles" "$OUT/${NAME}.pmtiles"

# 앱이 실제로 소비하는 위치로도 복사 — 지형 업그레이드(예: NGII 5m DEM)가 스타터에 바로 반영되게.
STARTER_TILES="$DIR/../../../apps/starter/public/tiles"
if [ -d "$STARTER_TILES" ]; then
  cp "$OUT/${NAME}.pmtiles" "$STARTER_TILES/${NAME}.pmtiles"
  echo "→ 스타터에도 복사: $STARTER_TILES/${NAME}.pmtiles"
fi

echo "완료: $OUT/${NAME}.pmtiles"
ls -lh "$OUT/${NAME}.pmtiles"
