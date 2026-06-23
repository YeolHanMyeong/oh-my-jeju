import { Marker, type Map as MapLibreMap } from 'maplibre-gl';

export interface RouteOptions {
  id?: string;
  /** 기본 '#ff3b30' */
  color?: string;
  /** 선 두께 px. 기본 4 */
  width?: number;
  /** 경로를 따라 이동하는 마커 애니메이션 */
  animate?: boolean;
  /** 애니메이션 한 바퀴 시간 ms. 기본 10000 */
  duration?: number;
}

export interface RouteHandle {
  readonly id: string;
  remove(): void;
}

/** 스타일 load 이후에 호출되어야 한다. JejuMap.addRoute()가 큐잉을 처리함 */
export function createRoute(
  map: MapLibreMap,
  coordinates: [number, number][],
  options: RouteOptions & { id: string },
): RouteHandle {
  const { id } = options;
  const color = options.color ?? '#ff3b30';
  const width = options.width ?? 4;

  map.addSource(id, {
    type: 'geojson',
    data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } },
  });
  map.addLayer({
    id: `${id}-casing`,
    type: 'line',
    source: id,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': width + 2.5, 'line-opacity': 0.9 },
  });
  map.addLayer({
    id: `${id}-line`,
    type: 'line',
    source: id,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': color, 'line-width': width },
  });

  let marker: Marker | null = null;
  let raf = 0;

  if (options.animate && coordinates.length > 1) {
    const el = document.createElement('div');
    el.style.cssText =
      `width:14px;height:14px;border-radius:50%;background:${color};` +
      'border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4)';
    marker = new Marker({ element: el }).setLngLat(coordinates[0]).addTo(map);

    // 누적 거리 테이블 (위도 보정 평면 근사 — 애니메이션 보간용으로 충분)
    const cum: number[] = [0];
    for (let i = 1; i < coordinates.length; i++) {
      cum.push(cum[i - 1] + planarDist(coordinates[i - 1], coordinates[i]));
    }
    const total = cum[cum.length - 1] || 1;
    const duration = options.duration ?? 10000;
    let start: number | null = null;

    const tick = (now: number) => {
      start ??= now;
      const d = (((now - start) % duration) / duration) * total;
      let i = cum.findIndex((cd) => cd > d);
      if (i < 1) i = cum.length - 1;
      const f = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      const a = coordinates[i - 1];
      const b = coordinates[i];
      marker!.setLngLat([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    map.once('remove', () => cancelAnimationFrame(raf));
  }

  return {
    id,
    remove() {
      cancelAnimationFrame(raf);
      marker?.remove();
      for (const lid of [`${id}-line`, `${id}-casing`]) {
        if (map.getLayer(lid)) map.removeLayer(lid);
      }
      if (map.getSource(id)) map.removeSource(id);
    },
  };
}

function planarDist(a: [number, number], b: [number, number]): number {
  const kx = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.hypot((b[0] - a[0]) * kx, b[1] - a[1]);
}
