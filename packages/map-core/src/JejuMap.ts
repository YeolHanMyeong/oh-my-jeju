import type { FeatureCollection } from 'geojson';
import maplibregl, {
  GeolocateControl,
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  type MapOptions,
  type RasterDEMSourceSpecification,
  type StyleSpecification,
} from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { type BasemapId, buildBasemap } from './basemaps.js';
import { JEJU_MAX_BOUNDS, LANDMARKS, type Landmark, type LandmarkId } from './constants.js';
import { type DataLayerHandle, type DataLayerOptions, createDataLayer } from './dataLayer.js';
import { type RouteHandle, type RouteOptions, createRoute } from './route.js';

const DEM_SOURCE_ID = 'jeju-dem';

let pmtilesRegistered = false;
function ensurePmtilesProtocol(): void {
  if (pmtilesRegistered) return;
  maplibregl.addProtocol('pmtiles', new Protocol().tile);
  pmtilesRegistered = true;
}

/** 상대 경로·.pmtiles 경로를 pmtiles:// 프로토콜 URL로 정규화 */
function normalizeTerrainUrl(url: string): string {
  if (url.startsWith('pmtiles://')) return url;
  if (url.endsWith('.pmtiles')) {
    const abs = typeof location !== 'undefined' ? new URL(url, location.href).href : url;
    return `pmtiles://${abs}`;
  }
  return url;
}

export type MapMode = '2d' | '3d';

export interface JejuMapView {
  center: [number, number];
  zoom?: number;
  pitch?: number;
  bearing?: number;
}

export interface JejuMapOptions {
  /** 지도를 렌더링할 요소 또는 요소 id */
  container: string | HTMLElement;
  /** 초기 모드. 기본 '3d' (terrainUrl이 없으면 '2d'로 동작) */
  mode?: MapMode;
  /** 베이스맵 프리셋. 기본 'satellite' */
  basemap?: BasemapId;
  /** vworld-* 베이스맵용 API 키 */
  vworldKey?: string;
  /** 지형 PMTiles URL (예: '/tiles/jeju-terrain.pmtiles'). 없으면 3D 지형 비활성 */
  terrainUrl?: string;
  /**
   * 지형 raster-dem 소스의 maxzoom. 기본 12. 더 높은 zoom으로 구운 DEM(예: NGII 5m → z14)을
   * 쓸 때 올린다 — 파이프라인 max_z와 반드시 일치시킬 것(낮으면 z12 타일을 overzoom해 추가
   * 디테일이 안 나오고, 높으면 없는 타일을 요청한다).
   */
  terrainMaxZoom?: number;
  /** 지형 과장 배율. 기본 1.35 */
  exaggeration?: number;
  /** 음영기복(hillshade) 레이어. 기본 true (terrainUrl 있을 때) */
  hillshade?: boolean;
  /** 초기 카메라: 랜드마크 id 또는 직접 지정. 기본 'hallasan' */
  view?: LandmarkId | JejuMapView;
  /** 지도 이동 범위를 제주로 고정. 기본 true */
  lockToJeju?: boolean;
  /** 내비게이션/축척 컨트롤 표시. 기본 true */
  controls?: boolean;
  /** 현재 위치 컨트롤(위치 따라가기 포함) 표시. 기본 false */
  geolocate?: boolean;
  /**
   * 글리프(텍스트 라벨) PBF 엔드포인트. 클러스터 개수 등 심볼 레이어 텍스트에 쓰인다.
   * 기본은 MapLibre 데모 서버(SLA 없음) — 프로덕션 배포 시 self-host 글리프로 교체 권장.
   */
  glyphs?: string;
  /** maplibre Map 생성 옵션 직접 오버라이드 (escape hatch) */
  mapOptions?: Partial<Omit<MapOptions, 'container' | 'style'>>;
  /**
   * ready()가 reject되기까지의 최대 대기 ms. 기본 15000. 0이면 비활성(load만 무한 대기).
   * 스타일/타일 로드가 끝나지 않으면(예: terrainUrl 아카이브에 bounds 내 타일 누락, 도달 불가
   * 베이스맵) MapLibre의 'load'가 영영 발생하지 않으므로, 무한 대기 대신 이 시간 후 reject한다.
   */
  readyTimeout?: number;
}

/**
 * 제주도에 미리 맞춰진 MapLibre 지도.
 *
 * ```ts
 * const jeju = new JejuMap({ container: 'map', terrainUrl: '/tiles/jeju-terrain.pmtiles' });
 * await jeju.ready();
 * jeju.flyTo('seongsan');
 * jeju.setMode('2d');
 * jeju.map // 원본 maplibregl.Map — 모든 MapLibre API 사용 가능
 * ```
 */
export class JejuMap {
  readonly map: MapLibreMap;

  private _mode: MapMode;
  private _loaded = false;
  private _layerSeq = 0;
  private readonly _exaggeration: number;
  private readonly _hasTerrain: boolean;
  private readonly _readyPromise: Promise<this>;
  /** ready() 대기를 정리(타이머 해제 + 리스너 off)하는 함수 — destroy() 시 호출해 teardown 후 reject 방지 */
  private _cancelReady: (() => void) | null = null;

  constructor(options: JejuMapOptions) {
    const {
      container,
      mode = '3d',
      basemap = 'satellite',
      vworldKey,
      terrainUrl,
      terrainMaxZoom = 12,
      exaggeration = 1.35,
      hillshade = true,
      view = 'hallasan',
      lockToJeju = true,
      controls = true,
      geolocate = false,
      glyphs = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      readyTimeout = 15000,
      mapOptions = {},
    } = options;

    this._hasTerrain = Boolean(terrainUrl);
    this._mode = this._hasTerrain ? mode : '2d';
    this._exaggeration = exaggeration;

    const { sources, layers } = buildBasemap(basemap, vworldKey);
    const style: StyleSpecification = {
      version: 8,
      // 클러스터 개수 등 텍스트 렌더링용 글리프 (glyphs 옵션으로 self-host 교체 가능)
      glyphs,
      sources,
      layers,
      sky: {
        'sky-color': '#7fb8e6',
        'horizon-color': '#e8f4fb',
        'fog-color': '#dfe9f0',
        'sky-horizon-blend': 0.6,
        'horizon-fog-blend': 0.6,
        'fog-ground-blend': 0.85,
      },
    };

    if (terrainUrl) {
      ensurePmtilesProtocol();
      const demSource: RasterDEMSourceSpecification = {
        type: 'raster-dem',
        url: normalizeTerrainUrl(terrainUrl),
        tileSize: 512,
        encoding: 'mapbox',
        maxzoom: terrainMaxZoom,
      };
      style.sources[DEM_SOURCE_ID] = demSource;
      if (hillshade) {
        // terrain과 소스를 공유하면 렌더링 품질이 떨어진다는 maplibre 권고에 따라 분리
        style.sources[`${DEM_SOURCE_ID}-hillshade`] = { ...demSource };
        style.layers.push({
          id: 'jeju-hillshade',
          type: 'hillshade',
          source: `${DEM_SOURCE_ID}-hillshade`,
          paint: {
            'hillshade-exaggeration': 0.25,
            'hillshade-shadow-color': '#1a2633',
          },
        });
      }
      // 주의: terrainUrl 아카이브는 bounds 안의 모든 타일(바다 포함)을 담고
      // 있어야 한다. 타일이 누락되면 high-pitch 3D에서 해당 타일이 영영
      // pending으로 남아 'load' 이벤트가 발생하지 않는다.
      if (this._mode === '3d') {
        style.terrain = { source: DEM_SOURCE_ID, exaggeration };
      }
    }

    const v = resolveView(view);
    this.map = new MapLibreMap({
      container,
      style,
      center: v.center,
      zoom: v.zoom ?? 10.5,
      pitch: this._mode === '3d' ? (v.pitch ?? 60) : 0,
      bearing: v.bearing ?? 0,
      maxPitch: 80,
      maxBounds: lockToJeju ? JEJU_MAX_BOUNDS : undefined,
      ...mapOptions,
    });

    if (controls) {
      this.map.addControl(new NavigationControl({ visualizePitch: true }));
      this.map.addControl(new ScaleControl());
    }
    if (geolocate) {
      this.map.addControl(
        new GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
        }),
      );
    }

    this._readyPromise = new Promise((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onLoad = () => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        this._cancelReady = null;
        this._loaded = true;
        resolve(this);
      };
      this.map.once('load', onLoad);
      if (readyTimeout > 0) {
        timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          this.map.off('load', onLoad);
          this._cancelReady = null;
          reject(
            new Error(
              `[JejuMap] 지도가 ${readyTimeout}ms 내에 로드되지 않았습니다. terrainUrl 아카이브에 bounds 내 모든 타일(바다 포함)이 있는지, 베이스맵/타일 URL이 도달 가능한지 확인하세요. (readyTimeout 옵션으로 조정·비활성 가능)`,
            ),
          );
        }, readyTimeout);
      }
      // destroy()가 load 전에 호출되면 타이머를 정리해, teardown 후 reject(미처리 rejection)를 막는다.
      this._cancelReady = () => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        this.map.off('load', onLoad);
      };
    });
    // destroy 전에 누구도 .catch하지 않은 채 reject되면 unhandled rejection이 되므로, 소비자가
    // ready()를 호출하지 않더라도 안전하도록 no-op catch를 붙여 둔다(원본 promise는 그대로 반환).
    this._readyPromise.catch(() => {});
  }

  /**
   * 스타일·초기 타일 로드 완료 시 resolve.
   * ⚠️ reject 가능: readyTimeout(기본 15s) 내에 'load'가 발생하지 않으면 reject된다
   * (도달 불가 베이스맵, bounds 내 DEM 타일 누락 등). 호출부는 .catch로 degrade를 처리하라.
   */
  ready(): Promise<this> {
    return this._readyPromise;
  }

  get mode(): MapMode {
    return this._mode;
  }

  /** terrainUrl이 설정되어 3D 지형을 쓸 수 있는지 여부 */
  get hasTerrain(): boolean {
    return this._hasTerrain;
  }

  /**
   * 2D/3D 전환. 3D는 terrainUrl이 설정된 경우에만 동작.
   * @returns 요청한 모드가 실제 적용됐는지(또는 이미 그 모드였는지). terrainUrl 없이 3D를
   *   요청하면 false를 반환한다 — 호출부가 실제 모드(get mode)와 UI 상태를 reconcile할 수 있다.
   */
  setMode(mode: MapMode, { animate = true }: { animate?: boolean } = {}): boolean {
    if (mode === this._mode) return true;
    if (mode === '3d' && !this._hasTerrain) {
      console.warn('[JejuMap] terrainUrl 없이 3D 모드를 켤 수 없습니다.');
      return false;
    }
    this._mode = mode;
    const apply = () => {
      this.map.setTerrain(
        mode === '3d' ? { source: DEM_SOURCE_ID, exaggeration: this._exaggeration } : null,
      );
      this.map.easeTo({ pitch: mode === '3d' ? 60 : 0, duration: animate ? 800 : 0 });
    };
    this._whenLoaded(apply);
    return true;
  }

  /** 랜드마크 프리셋 또는 임의 좌표로 카메라 이동 */
  flyTo(target: LandmarkId | JejuMapView, options: { duration?: number } = {}): void {
    const v = resolveView(target);
    this.map.flyTo({
      center: v.center,
      zoom: v.zoom ?? this.map.getZoom(),
      pitch: this._mode === '3d' ? (v.pitch ?? this.map.getPitch()) : 0,
      bearing: v.bearing ?? 0,
      duration: options.duration ?? 2500,
    });
  }

  /**
   * GeoJSON 데이터를 시각화 프리셋(cluster/heatmap/choropleth 등)으로 추가.
   * 어떤 데이터든 꽂으면 기본 스타일·팝업·클릭이 자동 적용되는 BYOD 소켓.
   *
   * ```ts
   * // ⚠️ 문자열 popup은 raw HTML로 삽입된다 — 신뢰 못 할 값은 escapeHtml로 감쌀 것
   * const layer = jeju.addDataLayer({ data: myGeojson, type: 'cluster', popup: f => escapeHtml(f.properties.name) });
   * layer.setData(updated); // 실시간 갱신
   * layer.remove();
   * ```
   */
  addDataLayer(options: DataLayerOptions): DataLayerHandle {
    const id = options.id ?? `jeju-data-${++this._layerSeq}`;
    let real: DataLayerHandle | null = null;
    let removed = false;
    let pending: FeatureCollection | null = null;
    this._whenLoaded(() => {
      if (removed) return;
      real = createDataLayer(this.map, { ...options, id });
      if (pending) {
        real.setData(pending);
        pending = null;
      }
    });
    return {
      id,
      setData: (data) => {
        if (real) real.setData(data);
        else pending = data;
      },
      remove: () => {
        removed = true;
        real?.remove();
      },
    };
  }

  /** 좌표 배열로 경로 라인 표시. animate 옵션으로 이동 마커 애니메이션 */
  addRoute(coordinates: [number, number][], options: RouteOptions = {}): RouteHandle {
    const id = options.id ?? `jeju-route-${++this._layerSeq}`;
    let real: RouteHandle | null = null;
    let removed = false;
    this._whenLoaded(() => {
      if (!removed) real = createRoute(this.map, coordinates, { ...options, id });
    });
    return {
      id,
      remove: () => {
        removed = true;
        real?.remove();
      },
    };
  }

  private _whenLoaded(fn: () => void): void {
    if (this._loaded) fn();
    else this.map.once('load', fn);
  }

  destroy(): void {
    this._cancelReady?.();
    this._cancelReady = null;
    this.map.remove();
  }
}

function resolveView(view: LandmarkId | JejuMapView): Landmark | JejuMapView {
  return typeof view === 'string' ? LANDMARKS[view] : view;
}
