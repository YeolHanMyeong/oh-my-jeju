import type { FeatureCollection } from 'geojson';
import type { ExpressionSpecification } from 'maplibre-gl';
import { mix } from './color.js';

/**
 * 데이터 레이어용 순수 헬퍼 (MapLibre 런타임 의존 없음 — 타입만 import).
 * createDataLayer에서 쓰는 표현식/지오메트리 계산을 분리해 단위 테스트 가능하게 한다.
 */

/** 지오메트리 타입에 따라 circle/line/fill 자동 선택 ('auto' 프리셋용) */
export function autoType(fc: FeatureCollection): 'circle' | 'line' | 'fill' {
  const g = fc.features[0]?.geometry?.type ?? 'Point';
  return g.includes('Polygon') ? 'fill' : g.includes('LineString') ? 'line' : 'circle';
}

/** 숫자로 해석 가능한 속성값만 추출 */
function numericValues(fc: FeatureCollection, property: string): number[] {
  return fc.features.map((f) => Number(f.properties?.[property])).filter(Number.isFinite);
}

/**
 * choropleth stops를 입력값 오름차순으로 정렬하고 동일 경계값을 제거한다.
 * MapLibre interpolate 표현식은 입력 stop이 '엄격히 오름차순'이어야 하며, 그렇지 않으면
 * 스타일 에러로 레이어 전체가 렌더되지 않는다 — 사용자가 임의 순서로 넘겨도 안전하게.
 */
export function sortStops(stops: Array<[number, string]>): Array<[number, string]> {
  return [...stops]
    .sort((a, b) => a[0] - b[0])
    .filter((s, i, arr) => i === 0 || s[0] > arr[i - 1][0]);
}

/**
 * choropleth에 실제로 사용할 stops를 계산한다.
 * - 사용자 stops가 있으면 정렬·중복제거 후 그대로 사용
 * - 없으면 property의 데이터 min~max를 5단계 색 램프로 자동 생성
 *
 * interpolate는 stop이 최소 2개여야 유효하다. 단일 stop(또는 모두 같은 경계값으로 dedup되어
 * 1개로 줄어든 경우)이나 유효 값이 없으면 null을 반환해 호출부가 단색 fill로 폴백하도록 한다.
 */
export function resolveChoroplethStops(
  fc: FeatureCollection,
  property: string | undefined,
  color: string,
  userStops?: Array<[number, string]>,
): Array<[number, string]> | null {
  if (userStops) {
    const sorted = sortStops(userStops);
    return sorted.length >= 2 ? sorted : null;
  }
  if (!property) return null;
  const vals = numericValues(fc, property);
  if (!vals.length) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  // min===max면 step=1로 떨어져 5개의 서로 다른 오름차순 경계가 생성됨 (단일 값도 안전)
  const step = (max - min) / 4 || 1;
  const ramp = [
    mix(color, '#ffffff', 0.8),
    mix(color, '#ffffff', 0.55),
    mix(color, '#ffffff', 0.3),
    color,
    mix(color, '#000000', 0.3),
  ];
  return ramp.map((c, i) => [min + step * i, c] as [number, string]);
}

/** resolveChoroplethStops 결과로 fill-color 표현식을 만든다. stops가 없으면 단색. */
export function choroplethFillExpr(
  stops: Array<[number, string]> | null,
  property: string | undefined,
  color: string,
): string | ExpressionSpecification {
  if (!property || !stops || stops.length < 2) return color;
  return [
    'interpolate',
    ['linear'],
    ['coalesce', ['to-number', ['get', property]], stops[0][0]],
    ...stops.flat(),
  ] as ExpressionSpecification;
}

/**
 * heatmap-weight 표현식. property가 없으면 상수 1.
 * 가중치 보간은 데이터 min~max를 입력 범위로 쓴다 — 0을 하한으로 박으면 모든 값이 음수일 때
 * 입력 stop이 비오름차순(0, 음수)이 되어 스타일 에러가 난다. min~max를 쓰면 음수·양수 모두 안전.
 * 모든 값이 같으면(범위 0) 보간이 불가능하므로 상수 1로 폴백.
 */
export function heatmapWeightExpr(
  fc: FeatureCollection,
  property: string | undefined,
): number | ExpressionSpecification {
  if (!property) return 1;
  const vals = numericValues(fc, property);
  if (!vals.length) return 1;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (!(max > min)) return 1;
  return [
    'interpolate',
    ['linear'],
    ['coalesce', ['to-number', ['get', property]], min],
    min,
    0,
    max,
    1,
  ] as ExpressionSpecification;
}

/** FeatureCollection의 경계 상자 [[w,s],[e,n]]. 좌표가 없으면 null. */
export function bboxOf(fc: FeatureCollection): [[number, number], [number, number]] | null {
  let w = Number.POSITIVE_INFINITY;
  let s = Number.POSITIVE_INFINITY;
  let e = Number.NEGATIVE_INFINITY;
  let n = Number.NEGATIVE_INFINITY;
  const visit = (c: unknown): void => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === 'number' && typeof c[1] === 'number') {
      w = Math.min(w, c[0]);
      e = Math.max(e, c[0]);
      s = Math.min(s, c[1]);
      n = Math.max(n, c[1]);
    } else {
      c.forEach(visit);
    }
  };
  for (const f of fc.features) {
    if (f.geometry && 'coordinates' in f.geometry) visit(f.geometry.coordinates);
  }
  return Number.isFinite(w)
    ? [
        [w, s],
        [e, n],
      ]
    : null;
}
