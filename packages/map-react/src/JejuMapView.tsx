import { JejuMap, type JejuMapOptions, type MapMode } from '@oh-my-jeju/map-core';
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import { JejuMapContext } from './context.js';

export interface JejuMapViewProps extends Omit<JejuMapOptions, 'container'> {
  className?: string;
  style?: CSSProperties;
  /** 지도 로드 완료 시 호출 */
  onReady?: (map: JejuMap) => void;
  /**
   * 코어의 실제 모드가 요청한 mode와 달라질 때 호출. 예: terrainUrl 없이 mode="3d"를 주면 코어가
   * 2D로 강등하는데, 이를 통지해 controlled mode state를 실제 모드와 동기화할 수 있다.
   */
  onModeChange?: (mode: MapMode) => void;
  /** 지도 생성/로드 실패 시 호출 (예: vworld 키 누락, ready() 타임아웃). */
  onError?: (err: unknown) => void;
  /** 마커·HUD 등 — 지도 로드 완료 후 mount되며 useJejuMap() 사용 가능 */
  children?: ReactNode;
}

/**
 * 제주 지도 React 컴포넌트.
 *
 * ```tsx
 * <JejuMapView mode="3d" terrainUrl="/tiles/jeju-terrain.pmtiles">
 *   <JejuMarker lng={126.533} lat={33.362}>한라산</JejuMarker>
 * </JejuMapView>
 * ```
 *
 * mode prop은 반응형으로 동작한다. 그 외 옵션은 최초 mount 시에만 적용됨.
 */
export function JejuMapView({
  className,
  style,
  onReady,
  onModeChange,
  onError,
  children,
  ...options
}: JejuMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [jejuMap, setJejuMap] = useState<JejuMap | null>(null);

  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onModeChangeRef = useRef(onModeChange);
  onModeChangeRef.current = onModeChange;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const initialOptionsRef = useRef(options);

  useEffect(() => {
    let map: JejuMap;
    try {
      // buildBasemap이 동기로 throw할 수 있다(예: vworld-* basemap에 vworldKey 누락).
      map = new JejuMap({ container: containerRef.current!, ...initialOptionsRef.current });
    } catch (err) {
      console.error('[JejuMapView] 지도 생성 실패:', err);
      onErrorRef.current?.(err);
      return;
    }
    let alive = true;
    map
      .ready()
      .then(() => {
        if (!alive) return;
        setJejuMap(map);
        onReadyRef.current?.(map);
        // 생성자가 모드를 강등했을 수 있음(terrainUrl 없이 3d) → 실제 모드를 통지해 desync 방지
        if (initialOptionsRef.current.mode && map.mode !== initialOptionsRef.current.mode) {
          onModeChangeRef.current?.(map.mode);
        }
      })
      .catch((err) => {
        // ready()는 reject될 수 있다(타임아웃·로드 실패) — 무한 대기 대신 onError로 surface
        if (!alive) return;
        console.error('[JejuMapView] 지도 로드 실패:', err);
        onErrorRef.current?.(err);
      });
    return () => {
      alive = false;
      setJejuMap(null);
      map.destroy();
    };
  }, []);

  // mode prop 변경에 반응 + 코어의 실제 모드와 reconcile (적용 안 되면 실제 모드 통지)
  const mode: MapMode | undefined = options.mode;
  useEffect(() => {
    if (!jejuMap || !mode) return;
    jejuMap.setMode(mode);
    if (jejuMap.mode !== mode) onModeChangeRef.current?.(jejuMap.mode);
  }, [jejuMap, mode]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', ...style }}
    >
      {jejuMap && <JejuMapContext.Provider value={jejuMap}>{children}</JejuMapContext.Provider>}
    </div>
  );
}
