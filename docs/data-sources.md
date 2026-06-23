# 제주 데이터, 어디서 구해서 어떻게 꽂나

이 스타터팩은 데이터를 번들하지 않는다 (지형 제외). 너희 아이디어에 맞는 데이터를
직접 구해서 `<JejuDataLayer>`에 꽂는 구조다. 아래는 출처와, 한국 공공데이터
특유의 함정을 빠르게 통과하는 치트시트.

## 출처

| 출처 | 내용 | 비고 |
|---|---|---|
| [제주데이터허브](https://www.jejudatahub.net) | 제주 특화 — 관광, 교통, 환경, 상권 | API 키 발급 (즉시) |
| [공공데이터포털](https://www.data.go.kr) | 전국 공공데이터, "제주" 검색 | CSV/SHP/오픈API |
| [통계청 SGIS](https://sgis.kostat.go.kr) | 인구 격자, 사업체, 주거 통계 | 히트맵/단계구분도 재료 |
| [VWorld](https://www.vworld.kr) | 행정경계, 건물, 연속지적 | SHP 다운로드 |
| [OSM / Geofabrik](https://download.geofabrik.de/asia/south-korea.html) | POI, 도로, 건물 윤곽 | PBF → ogr2ogr/osmium |
| [국토정보플랫폼](https://map.ngii.go.kr) | DEM(수치표고), 정밀 지도 | 지형 업그레이드용 |

## 한국 공공데이터 3대 함정 치트시트

도구: `brew install gdal` (ogr2ogr 포함)

**① 좌표계가 경위도가 아님** — SHP가 EPSG:5179(UTM-K)나 5186(중부원점)인 경우가 대부분.

```bash
ogr2ogr -f GeoJSON out.geojson in.shp -s_srs EPSG:5179 -t_srs EPSG:4326
```

좌표계 표기가 없을 때 추정: 값이 경도 126.xx/위도 33.xx면 그대로 WGS84,
x가 80만~100만/y가 140만~155만대면 EPSG:5179. 그 외엔 QGIS에서 열어 확인.

**② 인코딩이 EUC-KR/CP949** — 속성 한글이 깨질 때.

```bash
# SHP의 DBF 인코딩 지정
ogr2ogr -f GeoJSON out.geojson in.shp -oo ENCODING=CP949 -s_srs EPSG:5186 -t_srs EPSG:4326
# CSV 변환
iconv -f CP949 -t UTF-8 in.csv > out.csv
```

**③ CSV에 좌표가 컬럼으로** — 경도/위도 컬럼명을 지정해 GeoJSON으로.

```bash
ogr2ogr -f GeoJSON out.geojson in.csv \
  -oo X_POSSIBLE_NAMES=경도,lon,longitude,x \
  -oo Y_POSSIBLE_NAMES=위도,lat,latitude,y \
  -a_srs EPSG:4326
```

## 지도에 꽂기

```tsx
import myData from './my-data.json';

<JejuDataLayer
  data={myData as FeatureCollection}   // 또는 data="/api/spots.geojson" (URL)
  type="cluster"                        // cluster | heatmap | choropleth | circle | line | fill | auto
  color="#ff8a3d"
  property="인구수"                      // choropleth 색상 / heatmap 가중치 기준
  popup={(f) => <strong>{f.properties.name}</strong>}
  fitBounds
/>
```

> ⚠️ 바닐라 코어(`jeju.addDataLayer`)에서 popup으로 **문자열**을 반환하면 raw HTML로 삽입된다.
> 신뢰할 수 없는 속성값은 `escapeHtml()`로 감싸거나 HTMLElement를 반환하라. React `<JejuDataLayer>`는
> JSX를 안전하게 렌더링하므로 신경 쓸 필요 없다.

실시간 데이터는 `jeju.addDataLayer()`가 반환하는 핸들의 `setData()`로 갱신한다.
자세한 단계별 예시는 [recipes/byod-quickstart.md](recipes/byod-quickstart.md),
PostGIS 연동은 [recipes/postgis.md](recipes/postgis.md) 참고.

## 데이터가 클 때 (10MB+ GeoJSON)

건물 전체, 상세 도로망 같은 대용량은 GeoJSON 소스가 무거워진다.
[tippecanoe](https://github.com/felt/tippecanoe)로 벡터 타일(PMTiles)로 변환하는 게 정석:

```bash
brew install tippecanoe
tippecanoe -o data.pmtiles -zg --drop-densest-as-needed data.geojson
```

생성된 .pmtiles는 `public/tiles/`에 두면 된다. 벡터 PMTiles 레이어 프리셋은
v1.1에서 지원 예정 — 그 전엔 `jeju.map`으로 MapLibre vector source를 직접 추가하면 된다.
