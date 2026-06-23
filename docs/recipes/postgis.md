# PostGIS 연동 레시피

공간 질의("반경 3km 안", "가장 가까운 5개")나 팀 자체 데이터가 필요한 팀용.
스타터팩은 DB를 강제하지 않는다 — 이 레시피는 직접 PostGIS를 운영하는 팀을 위한 최단 경로.

## 1. PostGIS 띄우기

```yaml
# docker-compose.yml
services:
  db:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: jeju
    ports: ["5432:5432"]
```

## 2. 데이터 적재 (GeoJSON/SHP → 테이블)

```bash
ogr2ogr -f PostgreSQL "PG:host=localhost dbname=jeju user=postgres password=postgres" \
  spots.geojson -nln spots -lco GEOMETRY_NAME=geom -t_srs EPSG:4326
```

## 3. API 한 장 (GeoJSON 반환)

어떤 백엔드든 `ST_AsGeoJSON`으로 FeatureCollection을 만들면 끝. Express 예시:

```js
app.get('/api/spots', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'features', coalesce(jsonb_agg(ST_AsGeoJSON(t.*)::jsonb), '[]')
    ) AS fc
    FROM (SELECT name, category, geom FROM spots) t`);
  res.json(rows[0].fc);
});
```

## 4. 지도에 연결

```tsx
<JejuDataLayer data="/api/spots" type="cluster" popup={f => f.properties.name} />
```

실시간 갱신이 필요하면:

```ts
const layer = jeju.addDataLayer({ data: initial, type: 'circle' });
setInterval(async () => {
  layer.setData(await (await fetch('/api/spots')).json());
}, 5000);
```

## 보너스: 자주 쓰는 공간 질의

```sql
-- 현 위치에서 가까운 순 5개
SELECT name FROM spots ORDER BY geom <-> ST_SetSRID(ST_Point(126.53, 33.36), 4326) LIMIT 5;

-- 반경 3km 안 (geography 캐스팅으로 미터 단위)
SELECT name FROM spots
WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_Point(126.53, 33.36), 4326)::geography, 3000);

-- 점이 속한 행정구역 (경계 테이블 적재 후)
SELECT adm_nm FROM boundaries WHERE ST_Contains(geom, ST_SetSRID(ST_Point(126.53, 33.36), 4326));
```
