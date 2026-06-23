# 제주 3D 지형 PoC

고품질 + 고성능 3D 제주 지형의 핵심 전략 검증: **무거운 작업은 전부 오프라인에서 미리 굽고, 런타임은 정적 파일 스트리밍만 한다.**

## 결과 (2026-06-12)

- DEM: Copernicus GLO-30 (30m, 인증 불필요) → terrain-RGB PMTiles **단일 8MB 파일** (z6–z12, 80타일, 제주 전역)
- 렌더링: MapLibre GL JS v5 + 3D terrain + hillshade + sky
- 성능: 정지 121 FPS / 회전 투어 중 120–124 FPS (M-시리즈 맥, 디스플레이 주사율 고정, 프레임 드랍 없음)
- 비주얼: `shots/` 참고 — z13.6 백록담 근접 뷰에서도 분화구 능선 유지

## 실행

```bash
# 1. 파이프라인 (data/jeju_dem_raw.tif → tiles/jeju-terrain.pmtiles)
cd scripts && ./build_terrain.sh ../data/jeju_dem_raw.tif jeju-terrain 12

# 2. 데모 (Range 요청 지원 서버 필수 — python http.server 불가)
cd .. && npx http-server -p 8718 --cors
# → http://localhost:8718/demo/
```

필요 도구: `brew install gdal pmtiles`, `uv` (타일러 스크립트 의존성 자동 처리)

## 입력·산출물은 git에 포함하지 않음

용량 절감을 위해 다음은 커밋하지 않는다(`.gitignore`):

- `data/jeju_dem_raw.tif` (원본 DEM) — Copernicus GLO-30. [OpenTopography](https://portal.opentopography.org)
  에서 제주 영역(126.05,33.05–127.0,33.65)을 받아 이 경로에 저장하면 파이프라인을 재현할 수 있다.
- `tiles/`, `data/_work/` — `build_terrain.sh`가 재생성하는 산출물.

앱이 실제로 쓰는 최종 타일은 `apps/starter/public/tiles/jeju-terrain.pmtiles`에 보존되어 있고,
`build_terrain.sh`는 파이프라인 종료 시 그쪽으로도 복사한다. 이 데모(`demo/`)는 `tiles/`의 로컬
산출물을 참조하므로, 새로 클론한 환경에서는 파이프라인을 먼저 한 번 실행해야 데모가 뜬다.

## 파이프라인 구조

```
DEM GeoTIFF
  → gdalwarp: 제주 bbox(126.05,33.05–127.0,33.65) 클리핑 + EPSG:3857 재투영
  → dem_to_terrain_mbtiles.py: terrain-RGB(mapbox 인코딩, 512px) MBTiles
  → pmtiles convert: 단일 PMTiles 파일
```

rio-rgbify는 최신 rasterio와 호환이 깨져 있어 자체 타일러(`dem_to_terrain_mbtiles.py`)로 대체함.

**중요 — 바다 타일도 반드시 포함할 것**: bbox 안에서 타일이 하나라도 누락되면
MapLibre가 해당 타일을 영영 pending으로 두어 `load` 이벤트가 발생하지 않는다
(high-pitch 3D에서 수평선 근처 바다 타일까지 요청되면서 발현). 타일러는 상수
0(바다) 타일을 PNG 한 장으로 재사용해 용량 증가 없이 전체 bbox를 채운다.

## 다음 단계

1. **NGII 5m DEM 교체** (품질 대폭 향상): 국토정보플랫폼(map.ngii.go.kr)에서 제주 수치표고모델 수동 다운로드(로그인 필요) 후:
   ```bash
   ./build_terrain.sh ../data/ngii_dem_5m.tif jeju-terrain-hd 14
   ```
   파이프라인은 그대로, 입력과 max_zoom만 교체.
2. **VWorld API 키 발급** → 한국어 라벨 베이스맵/위성 타일로 교체 (현재는 Esri World Imagery)
3. PMTiles를 GitHub Pages/Cloudflare에 올리면 타일 서버 없이 배포 완료
4. 검증된 이 구성을 `packages/map-core` 모듈로 정식 이전
