export { JejuMapView } from './JejuMapView.js';
export type { JejuMapViewProps } from './JejuMapView.js';
export { JejuMarker } from './JejuMarker.js';
export type { JejuMarkerProps } from './JejuMarker.js';
export { JejuDataLayer } from './JejuDataLayer.js';
export type { JejuDataLayerProps } from './JejuDataLayer.js';
export { JejuRoute } from './JejuRoute.js';
export type { JejuRouteProps } from './JejuRoute.js';
export { JejuMapContext, useJejuMap } from './context.js';

// 코어 re-export — react 패키지만 설치해도 상수·타입·헬퍼 사용 가능
export { JejuMap, JEJU_CENTER, JEJU_MAX_BOUNDS, LANDMARKS, escapeHtml } from '@oh-my-jeju/map-core';
export type {
  BasemapId,
  DataLayerHandle,
  DataLayerOptions,
  DataLayerType,
  JejuMapOptions,
  Landmark,
  LandmarkId,
  MapMode,
  RouteHandle,
  RouteOptions,
} from '@oh-my-jeju/map-core';
