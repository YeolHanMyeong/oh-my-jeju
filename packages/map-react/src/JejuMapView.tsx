import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { JejuMap, type JejuMapOptions, type MapMode } from '@oh-my-jeju/map-core';
import { JejuMapContext } from './context.js';

export interface JejuMapViewProps extends Omit<JejuMapOptions, 'container'> {
  className?: string;
  style?: CSSProperties;
  /** 지도 로드 완료 시 호출 */
  onReady?: (map: JejuMap) => void;
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
export function JejuMapView({ className, style, onReady, children, ...options }: JejuMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [jejuMap, setJejuMap] = useState<JejuMap | null>(null);

  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const initialOptionsRef = useRef(options);

  useEffect(() => {
    const map = new JejuMap({ container: containerRef.current!, ...initialOptionsRef.current });
    let alive = true;
    map.ready().then(() => {
      if (!alive) return;
      setJejuMap(map);
      onReadyRef.current?.(map);
    });
    return () => {
      alive = false;
      setJejuMap(null);
      map.destroy();
    };
  }, []);

  // mode prop 변경에 반응
  const mode: MapMode | undefined = options.mode;
  useEffect(() => {
    if (jejuMap && mode) jejuMap.setMode(mode);
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
