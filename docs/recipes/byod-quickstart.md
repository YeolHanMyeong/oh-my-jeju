# 5분 코스: 공공데이터 CSV → 지도 레이어

공공데이터포털에서 받은 "제주 전기차 충전소 현황.csv" 같은 파일을 지도에 올리는 전 과정.

## 1. CSV → GeoJSON

```bash
# 인코딩이 CP949면 먼저 변환
iconv -f CP949 -t UTF-8 충전소.csv > chargers.csv

# 좌표 컬럼 지정해서 GeoJSON 생성
ogr2ogr -f GeoJSON chargers.geojson chargers.csv \
  -oo X_POSSIBLE_NAMES=경도,lon -oo Y_POSSIBLE_NAMES=위도,lat -a_srs EPSG:4326
```

## 2. 스타터에 추가

가장 간단한 방법은 `apps/starter/public/`에 파일을 두고 URL로 로드하는 것이다(아래
`data="/chargers.geojson"`). 번들에 포함하고 싶으면 `.json`으로 rename 후
`import chargers from './chargers.json'`(Vite가 객체로 자동 파싱)하여 `data={chargers}`로 넘긴다.
※ `.geojson?raw`는 파일을 **문자열**로 읽어 오는데, `data`에 넘긴 문자열은 URL로 취급되므로 동작하지 않는다.

```tsx
<JejuDataLayer data="/chargers.geojson" type="cluster" color="#2ecc71"
  popup={(f) => (
    <div>
      <strong>{f.properties.충전소명}</strong>
      <p>{f.properties.주소}</p>
    </div>
  )}
  fitBounds
/>
```

`public/`에 두고 URL(`data="/chargers.geojson"`)로 로드하는 쪽이 제일 간단하다.

## 3. 시각화 바꿔보기

`type` 한 단어로 전환된다:

- `type="cluster"` — 밀집 지역이 숫자 원으로 묶임, 클릭하면 펼쳐짐
- `type="heatmap"` — 밀도 표현. `property="충전기수"` 주면 가중치 반영
- `type="circle"` — 전부 개별 점으로

## 자주 겪는 문제

- **아무것도 안 보임**: 좌표 순서 확인 — GeoJSON은 `[경도, 위도]` 순서다. 위도가 126이면 뒤집힌 것.
- **속성 한글 깨짐**: 1번의 iconv/ENCODING 단계를 건너뛴 것.
- **제주 밖에 점이 찍힘**: 원본 좌표계가 EPSG:5179/5186인데 4326으로 선언한 것. `-s_srs`를 지정해 재변환.
