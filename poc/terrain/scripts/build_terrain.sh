#!/usr/bin/env bash
# 제주 지형 타일 파이프라인: DEM(GeoTIFF) -> terrain-RGB PMTiles
#
# 사용법:
#   ./build_terrain.sh <입력 DEM.tif> <출력이름> [max_zoom]
#
# 예시 (Copernicus 30m PoC):
#   ./build_terrain.sh ../data/jeju_dem_raw.tif jeju-terrain 12
# 예시 (NGII 5m, 추후 교체):
#   ./build_terrain.sh ../data/ngii_dem_5m.tif jeju-terrain-hd 14
set -euo pipefail

SRC="$1"
NAME="$2"
MAX_Z="${3:-12}"
MIN_Z=6

# 제주 본섬 + 우도 + 마라도 (경도/위도, EPSG:4326)
# ⚠️ packages/map-core/src/constants.ts의 JEJU_MAX_BOUNDS와 일치시킬 것 — 지도 이동 범위가
#    이 타일 커버리지를 넘으면 3D에서 DEM 타일이 누락된다. 범위를 바꾸면 양쪽 모두 수정.
BBOX_W=126.05
BBOX_S=33.05
BBOX_E=127.00
BBOX_N=33.65

DIR="$(cd "$(dirname "$0")" && pwd)"
WORK="$DIR/../data/_work"
OUT="$DIR/../tiles"
mkdir -p "$WORK" "$OUT"

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
