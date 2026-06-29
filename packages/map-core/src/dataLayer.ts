import type { Feature, FeatureCollection, Point } from 'geojson';
import {
  type ExpressionSpecification,
  type GeoJSONSource,
  type LayerSpecification,
  type MapLayerMouseEvent,
  type Map as MapLibreMap,
  Popup,
} from 'maplibre-gl';
import { mix, withAlpha } from './color.js';
import {
  autoType,
  bboxOf,
  choroplethFillExpr,
  heatmapWeightExpr,
  resolveChoroplethStops,
} from './expr.js';

/**
 * 시각화 프리셋.
 * - auto: 지오메트리 타입에 따라 circle/line/fill 자동 선택
 * - cluster: 포인트 클러스터링 (+개수 라벨, 클릭 시 확대)
 * - heatmap: 히트맵 (줌인하면 개별 포인트 표시)
 * - choropleth: 숫자 속성값에 따른 단계 구분도 (폴리곤)
 */
export type DataLayerType =
  | 'auto'
  | 'circle'
  | 'cluster'
  | 'heatmap'
  | 'line'
  | 'fill'
  | 'choropleth';

export interface DataLayerOptions {
  /** 레이어 id. 생략 시 자동 생성 */
  id?: string;
  /** GeoJSON FeatureCollection 객체 또는 URL */
  data: FeatureCollection | string;
  type?: DataLayerType;
  /** 기본 색 (hex). 기본 '#0a84ff' */
  color?: string;
  opacity?: number;
  /** 포인트 반지름 px. 기본 6 */
  radius?: number;
  /** 선 두께 px (line 타입). 기본 3.5 */
  width?: number;
  /** choropleth 색상·heatmap 가중치에 쓸 숫자 속성명 */
  property?: string;
  /** choropleth 색 구간 [경계값, 색]. 생략 시 데이터 min~max 5단계 자동 생성 */
  stops?: Array<[number, string]>;
  /**
   * 피처 클릭 시 팝업 내용.
   * ⚠️ 문자열을 반환하면 raw HTML로 삽입된다(innerHTML). 신뢰할 수 없는 속성값(BYOD 데이터)을
   * 끼워 넣을 땐 `escapeHtml()`로 감싸거나 HTMLElement를 반환하라(textContent는 안전).
   * React를 쓴다면 `<JejuDataLayer popup={...}>`가 JSX를 안전하게 렌더링한다.
   */
  popup?: (feature: Feature) => string | HTMLElement;
  onClick?: (feature: Feature, lngLat: [number, number]) => void;
  /** 추가 후 데이터 전체가 보이도록 카메라 이동. 기본 false */
  fitBounds?: boolean;
  /**
   * data가 URL일 때 로드/파싱 실패 시 호출. console.error와 별개로 프로그램적 실패 처리(예: 실패 UI)에 쓴다.
   */
  onError?: (err: unknown) => void;
}

export interface DataLayerHandle {
  readonly id: string;
  /** 데이터 교체 (실시간 갱신용) */
  setData(data: FeatureCollection): void;
  remove(): void;
}

type Listener = [string, string, (e: MapLayerMouseEvent) => void];

/** 스타일 load 이후에 호출되어야 한다. JejuMap.addDataLayer()가 큐잉을 처리함 */
export function createDataLayer(
  map: MapLibreMap,
  options: DataLayerOptions & { id: string },
): DataLayerHandle {
  const { id } = options;
  const color = options.color ?? '#0a84ff';
  const layerIds: string[] = [];
  const listeners: Listener[] = [];
  let popup: Popup | null = null;
  let destroyed = false;
  let built = false;
  let pendingData: FeatureCollection | null = null;
  // property 기반 색/가중치 램프를 setData 시 데이터에 맞춰 재계산하기 위한 훅
  // (heatmap-weight, choropleth fill-color). 그 외 타입에선 null.
  let recomputePaint: ((fc: FeatureCollection) => void) | null = null;

  const add = (layer: LayerSpecification, beforeId?: string) => {
    map.addLayer(layer, beforeId);
    layerIds.push(layer.id);
  };
  const on = (ev: string, layer: string, fn: (e: MapLayerMouseEvent) => void) => {
    map.on(ev as 'click', layer, fn);
    listeners.push([ev, layer, fn]);
  };

  const makeInteractive = (layerId: string) => {
    if (!options.popup && !options.onClick) return;
    on('click', layerId, (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const feature = f as unknown as Feature;
      options.onClick?.(feature, [e.lngLat.lng, e.lngLat.lat]);
      if (options.popup) {
        const content = options.popup(feature);
        popup ??= new Popup({ offset: 14, closeButton: false, maxWidth: '300px' });
        if (typeof content === 'string') popup.setHTML(content);
        else popup.setDOMContent(content);
        popup.setLngLat(e.lngLat).addTo(map);
      }
    });
    on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
    });
  };

  const pointPaint = {
    'circle-radius': options.radius ?? 6,
    'circle-color': color,
    'circle-stroke-width': 1.5,
    'circle-stroke-color': '#ffffff',
    'circle-opacity': options.opacity ?? 0.95,
  };

  const build = (fc: FeatureCollection) => {
    if (destroyed || built) return;
    built = true;

    let type = options.type ?? 'auto';
    if (type === 'auto') type = autoType(fc);

    // 폴리곤류는 지형 음영(hillshade) 아래에 깔아 입체감 유지
    const hillshadeBefore = map.getLayer('jeju-hillshade') ? 'jeju-hillshade' : undefined;

    switch (type) {
      case 'cluster': {
        map.addSource(id, {
          type: 'geojson',
          data: fc,
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50,
        });
        add({
          id: `${id}-clusters`,
          type: 'circle',
          source: id,
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'step',
              ['get', 'point_count'],
              color,
              25,
              mix(color, '#000000', 0.18),
              100,
              mix(color, '#000000', 0.35),
            ] as ExpressionSpecification,
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              16,
              25,
              21,
              100,
              27,
            ] as ExpressionSpecification,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9,
          },
        });
        add({
          id: `${id}-count`,
          type: 'symbol',
          source: id,
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'] as ExpressionSpecification,
            'text-font': ['Open Sans Semibold'],
            'text-size': 12,
          },
          paint: { 'text-color': '#ffffff' },
        });
        add({
          id: `${id}-points`,
          type: 'circle',
          source: id,
          filter: ['!', ['has', 'point_count']],
          paint: pointPaint,
        });
        // 클러스터 클릭 → 펼쳐지는 줌으로 확대
        on('click', `${id}-clusters`, async (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const clusterId = (f.properties as { cluster_id: number }).cluster_id;
          const source = map.getSource(id) as GeoJSONSource;
          try {
            const zoom = await source.getClusterExpansionZoom(clusterId);
            if (destroyed) return; // await 동안 레이어/맵이 정리됐을 수 있음
            map.easeTo({ center: (f.geometry as Point).coordinates as [number, number], zoom });
          } catch (err) {
            console.error('[JejuMap] 클러스터 확대 줌 계산 실패:', err);
          }
        });
        on('mouseenter', `${id}-clusters`, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        on('mouseleave', `${id}-clusters`, () => {
          map.getCanvas().style.cursor = '';
        });
        makeInteractive(`${id}-points`);
        break;
      }

      case 'heatmap': {
        map.addSource(id, { type: 'geojson', data: fc });
        const weight = heatmapWeightExpr(fc, options.property);
        // property 가중치는 데이터 범위(min~max)에 의존 → setData 시 재계산해 stale ramp 방지
        if (options.property) {
          recomputePaint = (next) =>
            map.setPaintProperty(
              `${id}-heat`,
              'heatmap-weight',
              heatmapWeightExpr(next, options.property),
            );
        }
        add({
          id: `${id}-heat`,
          type: 'heatmap',
          source: id,
          paint: {
            'heatmap-weight': weight,
            'heatmap-intensity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8,
              0.9,
              13,
              2,
            ] as ExpressionSpecification,
            'heatmap-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8,
              12,
              13,
              28,
            ] as ExpressionSpecification,
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0,
              'rgba(0,0,0,0)',
              0.2,
              withAlpha(mix(color, '#ffffff', 0.6), 0.5),
              0.45,
              withAlpha(mix(color, '#ffffff', 0.3), 0.7),
              0.7,
              withAlpha(color, 0.85),
              1,
              mix(color, '#000000', 0.25),
            ] as ExpressionSpecification,
            'heatmap-opacity': options.opacity ?? 0.85,
          },
        });
        // 줌인하면 개별 포인트로 전환
        add({ id: `${id}-points`, type: 'circle', source: id, minzoom: 13, paint: pointPaint });
        makeInteractive(`${id}-points`);
        break;
      }

      case 'choropleth': {
        map.addSource(id, { type: 'geojson', data: fc });
        const prop = options.property;
        // interpolate는 stop이 2개 이상이어야 유효 — 단일 stop/값이면 resolved=null → 단색 폴백
        const resolved = resolveChoroplethStops(fc, prop, color, options.stops);
        if (!resolved) {
          console.error(
            `[JejuMap] choropleth 레이어 '${id}'에는 property(숫자 속성)와 유효한 값, 또는 2개 이상의 stops가 필요합니다. 단색 fill로 표시합니다.`,
          );
        }
        const fillColor = choroplethFillExpr(resolved, prop, color);
        // 자동 ramp(stops 미지정 + property)는 데이터 범위에 의존 → setData 시 재계산
        if (prop && !options.stops) {
          recomputePaint = (next) =>
            map.setPaintProperty(
              `${id}-fill`,
              'fill-color',
              choroplethFillExpr(
                resolveChoroplethStops(next, prop, color, options.stops),
                prop,
                color,
              ),
            );
        }
        add(
          {
            id: `${id}-fill`,
            type: 'fill',
            source: id,
            paint: { 'fill-color': fillColor, 'fill-opacity': options.opacity ?? 0.75 },
          },
          hillshadeBefore,
        );
        add(
          {
            id: `${id}-outline`,
            type: 'line',
            source: id,
            paint: { 'line-color': '#ffffff', 'line-width': 1 },
          },
          hillshadeBefore,
        );
        makeInteractive(`${id}-fill`);
        break;
      }

      case 'line': {
        map.addSource(id, { type: 'geojson', data: fc });
        add({
          id: `${id}-line`,
          type: 'line',
          source: id,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': color,
            'line-width': options.width ?? 3.5,
            'line-opacity': options.opacity ?? 0.9,
          },
        });
        makeInteractive(`${id}-line`);
        break;
      }

      case 'fill': {
        map.addSource(id, { type: 'geojson', data: fc });
        add(
          {
            id: `${id}-fill`,
            type: 'fill',
            source: id,
            paint: { 'fill-color': color, 'fill-opacity': options.opacity ?? 0.45 },
          },
          hillshadeBefore,
        );
        add(
          {
            id: `${id}-outline`,
            type: 'line',
            source: id,
            paint: { 'line-color': mix(color, '#000000', 0.3), 'line-width': 1.5 },
          },
          hillshadeBefore,
        );
        makeInteractive(`${id}-fill`);
        break;
      }

      default: {
        // circle
        map.addSource(id, { type: 'geojson', data: fc });
        add({ id: `${id}-points`, type: 'circle', source: id, paint: pointPaint });
        makeInteractive(`${id}-points`);
      }
    }

    if (options.fitBounds) {
      const b = bboxOf(fc);
      if (b) map.fitBounds(b, { padding: 60, maxZoom: 15, duration: 1000 });
    }
    if (pendingData) {
      (map.getSource(id) as GeoJSONSource).setData(pendingData);
      recomputePaint?.(pendingData);
      pendingData = null;
    }
  };

  if (typeof options.data === 'string') {
    fetch(options.data)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<FeatureCollection>;
      })
      .then(build)
      .catch((err) => {
        console.error(`[JejuMap] 데이터 레이어 '${id}' 로드 실패:`, err);
        options.onError?.(err);
      });
  } else {
    build(options.data);
  }

  return {
    id,
    setData(data) {
      if (destroyed) return;
      if (built) {
        (map.getSource(id) as GeoJSONSource).setData(data);
        // property 기반 heatmap/choropleth는 색/가중치 ramp를 새 데이터 범위로 갱신
        recomputePaint?.(data);
      } else {
        pendingData = data;
      }
    },
    remove() {
      if (destroyed) return;
      destroyed = true;
      if (!built) return;
      popup?.remove();
      for (const [ev, layer, fn] of listeners) map.off(ev as 'click', layer, fn);
      for (const lid of layerIds) if (map.getLayer(lid)) map.removeLayer(lid);
      if (map.getSource(id)) map.removeSource(id);
    },
  };
}
